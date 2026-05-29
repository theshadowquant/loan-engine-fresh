const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

// ── Admin auth: verifies JWT AND checks ADMIN role in DB ──────
module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check ADMIN role in memory first (extremely fast), then fall back to database if roles claim is missing
  if (decoded.roles) {
    if (decoded.roles.includes('ADMIN')) {
      req.user = decoded;
      return next();
    } else {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
  }

  // Check ADMIN role in database (Fallback for older tokens/sessions)
  try {
    const [[roleRow]] = await db.query(
      `SELECT ur.id FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND r.name = 'ADMIN' AND ur.is_active = 1`,
      [decoded.id]
    );

    if (!roleRow) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Role verification failed' });
  }
};
