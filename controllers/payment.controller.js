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

    // Mark exactly ONE next PENDING EMI as PAID (use single quotes — Aiven uses ANSI_QUOTES mode)
    const [[nextEMI]] = await db.query(
      "SELECT * FROM emi_schedule WHERE loan_id = ? AND status = 'PENDING' ORDER BY installment_number ASC LIMIT 1",
      [loanId]
    );

    if (nextEMI) {
      await db.query(
        "UPDATE emi_schedule SET status = 'PAID' WHERE id = ?",
        [nextEMI.id]
      );

      const principalPaid = parseFloat(nextEMI.principal_component || 0);
      const totalPaidAmount = parseFloat(amount || 0);

      // Reduce outstanding_principal in loans table by the principal component of the EMI
      await db.query(
        'UPDATE loans SET outstanding_principal = GREATEST(0, outstanding_principal - ?) WHERE id = ?',
        [principalPaid, loanId]
      );

      // Update loan_summary table: add to amount_paid, reduce outstanding_principal
      await db.query(
        `UPDATE loan_summary 
         SET amount_paid = amount_paid + ?, 
             outstanding_principal = GREATEST(0, outstanding_principal - ?) 
         WHERE loan_id = ?`,
        [totalPaidAmount, principalPaid, loanId]
      );
    } else {
      // Fallback: if there are no pending EMIs but they still pay
      const totalPaidAmount = parseFloat(amount || 0);
      await db.query(
        'UPDATE loans SET outstanding_principal = GREATEST(0, outstanding_principal - ?) WHERE id = ?',
        [totalPaidAmount, loanId]
      );
      await db.query(
        `UPDATE loan_summary 
         SET amount_paid = amount_paid + ?, 
             outstanding_principal = GREATEST(0, outstanding_principal - ?) 
         WHERE loan_id = ?`,
        [totalPaidAmount, totalPaidAmount, loanId]
      );
    }

    // If no more PENDING EMIs, close the loan
    if (nextEMI) {
      const [[{ remaining }]] = await db.query(
        "SELECT COUNT(*) AS remaining FROM emi_schedule WHERE loan_id = ? AND status = 'PENDING'",
        [loanId]
      );
      if (Number(remaining) === 0) {
        await db.query(
          "UPDATE loans SET status = 'CLOSED', outstanding_principal = 0 WHERE id = ?",
          [loanId]
        );
        await db.query(
          "UPDATE loan_summary SET outstanding_principal = 0 WHERE loan_id = ?",
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
      `SELECT p.*, l.loan_reference 
       FROM payments p
       LEFT JOIN loans l ON p.loan_id = l.id
       WHERE p.user_id = ? 
       ORDER BY p.payment_date DESC`,
      [req.user.id]
    );
    res.json({ payments: rows });
  } catch (err) { next(err); }
};
