const db = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT l.*, ls.total_principal, ls.total_interest, ls.total_payable, ls.amount_paid, ls.outstanding_principal as summary_outstanding_principal
       FROM loans l
       LEFT JOIN loan_summary ls ON l.id = ls.loan_id
       WHERE l.user_id = ? 
       ORDER BY l.id DESC`,
      [req.user.id]
    );
    res.json({ loans: rows });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const [[row]] = await db.query(
      `SELECT l.*, ls.total_principal, ls.total_interest, ls.total_payable, ls.amount_paid, ls.outstanding_principal as summary_outstanding_principal
       FROM loans l
       LEFT JOIN loan_summary ls ON l.id = ls.loan_id
       WHERE l.id = ? AND l.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'Loan not found' });
    res.json({ loan: row });
  } catch (err) { next(err); }
};

exports.getEMISchedule = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM emi_schedule WHERE loan_id = ? ORDER BY installment_number',
      [req.params.id]
    );
    res.json({ schedule: rows });
  } catch (err) { next(err); }
};

exports.getPayments = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date DESC',
      [req.params.id]
    );
    res.json({ payments: rows });
  } catch (err) { next(err); }
};
