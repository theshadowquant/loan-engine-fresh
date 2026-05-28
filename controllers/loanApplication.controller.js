const db = require('../config/db');

exports.apply = async (req, res, next) => {
  try {
    const { requested_amount, tenure_months, purpose, interest_rate, loan_type } = req.body;
    if (!requested_amount || !tenure_months || !purpose)
      return res.status(400).json({ error: 'Amount, tenure and purpose are required' });

    const [result] = await db.query(
      'INSERT INTO loan_applications (user_id, loan_type, requested_amount, tenure_months, purpose, interest_rate, status) VALUES (?,?,?,?,?,?,?)',
      [req.user.id, loan_type || 'PERSONAL', requested_amount, tenure_months, purpose, interest_rate || 12, 'APPLIED']
    );
    res.status(201).json({ message: 'Application submitted successfully', applicationId: result.insertId });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM loan_applications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ applications: rows });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const [[row]] = await db.query(
      'SELECT * FROM loan_applications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'Application not found' });
    res.json({ application: row });
  } catch (err) { next(err); }
};
