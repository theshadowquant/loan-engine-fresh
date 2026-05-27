const db = require('../config/db');

exports.summary = async (req, res, next) => {
  try {
    const [[loanStats]] = await db.query(
      `SELECT 
        COUNT(*) as total_loans,
        COALESCE(SUM(principal_amount), 0) as total_borrowed,
        COALESCE(SUM(outstanding_principal), 0) as total_outstanding
       FROM loans WHERE user_id = ?`,
      [req.user.id]
    );
    const [[appStats]] = await db.query(
      'SELECT COUNT(*) as total_applications FROM loan_applications WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ summary: { ...loanStats, ...appStats } });
  } catch (err) { next(err); }
};
