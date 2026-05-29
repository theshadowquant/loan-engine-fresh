require('dotenv').config();
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

async function start() {
  console.log('[SERVER] Testing database connection...');
  try {
    await db.query('SELECT 1');
    console.log('[DB] MySQL connected');
  } catch (err) {
    console.error('[DB] Warning: MySQL connection failed on startup:', err.message);
    console.error('[DB] The server will still run and try to reconnect on subsequent requests.');
  }

  app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
}

start();
