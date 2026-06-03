const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
require('dotenv').config();

// ── Hash-migration guard ─────────────────────────────────────────────────────
// This Set prevents the same user from having multiple concurrent bcrypt.hash()
// jobs queued at once.  Without it, rapid/concurrent logins by the same user
// would flood libuv's threadpool (UV_THREADPOOL_SIZE=4 by default) with
// background hash jobs, causing ALL subsequent bcrypt.compare() calls to stall
// for 20-30 seconds after a few hours of uptime.
const migratingUsers = new Set();

// ================= REGISTER =================
exports.register = async (req, res, next) => {
  try {
    let { email, password, first_name, last_name, phone_number, date_of_birth, pan_number } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // 🔥 Normalize input
    email = email.trim().toLowerCase();
    password = password.trim();

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hash = await bcrypt.hash(
      password,
      parseInt(process.env.BCRYPT_ROUNDS) || 8
    );

    const [result] = await db.query(
      `INSERT INTO users 
      (email, password_hash, first_name, last_name, phone_number, date_of_birth, pan_number) 
      VALUES (?,?,?,?,?,?,?)`,
      [
        email,
        hash,
        first_name || null,
        last_name || null,
        phone_number || null,
        date_of_birth || null,
        pan_number || null
      ]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    next(err);
  }
};


// ================= LOGIN =================
exports.login = async (req, res, next) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Normalize input
    email    = email.trim().toLowerCase();
    password = password.trim();

    // Only fetch the columns we actually need (avoids sending password_hash etc. over the wire unnecessarily)
    const [[user]] = await db.query(
      `SELECT id, email, first_name, last_name, password_hash, is_active
       FROM users WHERE email = ?`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled. Please contact support.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch user roles
    const [userRoles] = await db.query(
      `SELECT r.name FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ? AND ur.is_active = 1`,
      [user.id]
    );
    const roles = userRoles.map(r => r.name);

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, roles },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
    );

    // ── Send the response FIRST so the user is never kept waiting ────────────
    res.json({
      message: 'Login success',
      accessToken,
      user: {
        id:         user.id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        roles,
      }
    });

    // ── Background hash-migration (AFTER response is sent) ───────────────────
    // Downgrade old high-cost hashes to BCRYPT_ROUNDS for future fast logins.
    // The migratingUsers Set ensures that even under concurrent logins for the
    // same account we only ever queue ONE bcrypt.hash() at a time, preventing
    // libuv threadpool saturation (the root cause of the 20-30s login delay).
    const targetRounds = parseInt(process.env.BCRYPT_ROUNDS) || 8;
    const hashParts    = user.password_hash.split('$');

    if (hashParts.length >= 4) {
      const currentRounds = parseInt(hashParts[2], 10);

      if (currentRounds > targetRounds && !migratingUsers.has(user.id)) {
        migratingUsers.add(user.id);

        bcrypt.hash(password, targetRounds)
          .then(newHash => db.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newHash, user.id]
          ))
          .then(() => {
            console.log(`[Hash Migration] User ${user.id}: rounds ${currentRounds} → ${targetRounds}`);
          })
          .catch(err => {
            console.error('[Hash Migration] Failed for user', user.id, err.message);
          })
          .finally(() => {
            migratingUsers.delete(user.id);
          });
      }
    }

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    next(err);
  }
};



// ================= ME =================
exports.me = async (req, res, next) => {
  try {
    const [[user]] = await db.query(
      `SELECT id, email, first_name, last_name, phone_number, 
              pan_number, date_of_birth, is_active, is_verified 
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    res.json({ user });

  } catch (err) {
    console.error("ME ERROR:", err);
    next(err);
  }
};