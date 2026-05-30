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

    const outstandingPrincipal = parseFloat(loan.outstanding_principal || 0);
    const paymentAmount = parseFloat(amount || 0);
    const closureTolerance = parseFloat(process.env.CLOSURE_TOLERANCE || '1.00');

    if (paymentAmount >= outstandingPrincipal - closureTolerance) {
      // 1. FULL FORECLOSURE / PAYOFF
      // Mark all remaining pending EMIs as PAID
      await db.query(
        "UPDATE emi_schedule SET status = 'PAID' WHERE loan_id = ? AND status = 'PENDING'",
        [loanId]
      );
      // Close the loan and set outstanding to 0
      await db.query(
        "UPDATE loans SET status = 'CLOSED', outstanding_principal = 0 WHERE id = ?",
        [loanId]
      );
      // Update loan summary
      await db.query(
        `UPDATE loan_summary 
         SET amount_paid = amount_paid + ?, 
             outstanding_principal = 0 
         WHERE loan_id = ?`,
        [paymentAmount, loanId]
      );
    } else {
      // 2. PARTIAL PAYMENT / PREPAYMENT / REGULAR EMI(s)
      // Retrieve all pending EMIs ordered by installment number
      const [pendingEMIs] = await db.query(
        "SELECT * FROM emi_schedule WHERE loan_id = ? AND status = 'PENDING' ORDER BY installment_number ASC",
        [loanId]
      );

      let remainingPayment = paymentAmount;
      let totalPrincipalPaid = 0;

      for (const emi of pendingEMIs) {
        const emiAmount = parseFloat(emi.emi_amount || 0);
        if (remainingPayment >= emiAmount) {
          // Mark this EMI as paid
          await db.query(
            "UPDATE emi_schedule SET status = 'PAID' WHERE id = ?",
            [emi.id]
          );
          totalPrincipalPaid += parseFloat(emi.principal_component || 0);
          remainingPayment -= emiAmount;
        } else {
          // Not enough to fully pay the next EMI.
          // Apply leftover amount directly as prepayment to reduce the outstanding principal
          if (remainingPayment > 0) {
            totalPrincipalPaid += remainingPayment;
            remainingPayment = 0;
          }
          break;
        }
      }

      if (remainingPayment > 0) {
        totalPrincipalPaid += remainingPayment;
      }

      // Reduce outstanding principal in loans table
      await db.query(
        'UPDATE loans SET outstanding_principal = GREATEST(0, outstanding_principal - ?) WHERE id = ?',
        [totalPrincipalPaid, loanId]
      );

      // Update loan_summary table
      await db.query(
        `UPDATE loan_summary 
         SET amount_paid = amount_paid + ?, 
             outstanding_principal = GREATEST(0, outstanding_principal - ?) 
         WHERE loan_id = ?`,
        [paymentAmount, totalPrincipalPaid, loanId]
      );

      // If all pending EMIs are paid, close the loan
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
