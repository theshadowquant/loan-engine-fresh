require('dotenv').config();
const app = require('./app');
const db = require('./config/db');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('[DB] MySQL connected');
    app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
}

start();
