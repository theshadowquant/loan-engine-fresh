const db = require('../config/db');

exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) { next(err); }
};
