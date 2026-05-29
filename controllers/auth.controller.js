const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

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

    // 🔥 Normalize input (CRITICAL FIX)
    email = email.trim().toLowerCase();
    password = password.trim();

    const [[user]] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 🔥 Auto Hash Migration: If the stored hash uses more than BCRYPT_ROUNDS (8), re-hash it with 8 rounds to make future logins super-fast!
    const hashParts = user.password_hash.split('$');
    if (hashParts.length >= 4) {
      const rounds = parseInt(hashParts[2], 10);
      const targetRounds = parseInt(process.env.BCRYPT_ROUNDS) || 8;
      if (rounds > targetRounds) {
        bcrypt.hash(password, targetRounds).then(newHash => {
          db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id])
            .then(() => {
              console.log(`[Hash Migration] Successfully upgraded user ID ${user.id} password hash from ${rounds} to ${targetRounds} rounds.`);
            })
            .catch(err => {
              console.error('[Hash Migration] Failed to update password hash:', err);
            });
        }).catch(err => {
          console.error('[Hash Migration] Failed to re-hash password:', err);
        });
      }
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

    res.json({
      message: 'Login success',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        roles
      }
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
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