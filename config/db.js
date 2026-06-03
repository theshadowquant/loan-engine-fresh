const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'loan_engine',

  // ── Connection pool settings ─────────────────────────────────
  waitForConnections: true,
  connectionLimit:    parseInt(process.env.DB_POOL_SIZE) || 10,  // was 3 — far too small

  // ── Keep connections alive to Aiven cloud (prevents ECONNRESET after idle) ──
  enableKeepAlive:      true,
  keepAliveInitialDelay: 30000, // send keepalive ping every 30 s

  // ── Timeout for establishing a new connection ────────────────
  connectTimeout: 10000,        // 10 s — fail fast on network issues

  // ── Decimal / SSL ────────────────────────────────────────────
  decimalNumbers: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

module.exports = pool;
