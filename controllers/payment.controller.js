const db = require('../config/db');

exports.makePayment = async (req, res, next) => {
  try {
    const { amount, payment_method, transaction_reference } = req.body;
    const loanId = req.params.id;

    if (!amount || !payment_method || !transaction_reference)
      return res.status(400).json({ error: 'Amount, method and reference are required' });

    // Verify loan belongs to this user
    const [[loan]] = await db.query(
      'SELECT * FROM loans WHERE id = ? AND user_id = ?',
      [loanId, req.user.id]
    );
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    // Idempotency — if this exact transaction was already recorded, don't do anything again
    const [existing] = await db.query(
      'SELECT id FROM payments WHERE transaction_reference = ?',
      [transaction_reference]
    );
    if (existing.length) {
      return res.status(200).json({ message: 'Payment already recorded', paymentId: existing[0].id });
    }

    // Record the payment
    const [result] = await db.query(
      'INSERT INTO payments (loan_id, user_id, amount_paid, payment_mode, transaction_reference, payment_status) VALUES (?,?,?,?,?,?)',
      [loanId, req.user.id, amount, payment_method, transaction_reference, 'SUCCESS']
    );

    // Mark exactly ONE next PENDING EMI as PAID
    const [[nextEMI]] = await db.query(
      'SELECT * FROM emi_schedule WHERE loan_id = ? AND status = "PENDING" ORDER BY installment_number ASC LIMIT 1',
      [loanId]
    );

    if (nextEMI) {
      // Mark this EMI as PAID
      await db.query(
        'UPDATE emi_schedule SET status = "PAID" WHERE id = ?',
        [nextEMI.id]
      );
    }

    // Reduce outstanding by the actual amount paid — direct and intuitive
    await db.query(
      'UPDATE loans SET outstanding_principal = GREATEST(0, outstanding_principal - ?) WHERE id = ?',
      [parseFloat(amount), loanId]
    );

    // If no more PENDING EMIs, close the loan
    if (nextEMI) {
      const [[{ remaining }]] = await db.query(
        'SELECT COUNT(*) AS remaining FROM emi_schedule WHERE loan_id = ? AND status = "PENDING"',
        [loanId]
      );
      if (Number(remaining) === 0) {
        await db.query(
          'UPDATE loans SET status = "CLOSED", outstanding_principal = 0 WHERE id = ?',
          [loanId]
        );
      }
    }

    res.status(201).json({ message: 'Payment recorded and EMI updated successfully', paymentId: result.insertId });
  } catch (err) { next(err); }
};

exports.getUserPayments = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC',
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) { next(err); }
};
