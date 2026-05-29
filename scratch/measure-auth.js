const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function measure() {
  console.log('🔌 Connecting to the database...');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  console.log('🔍 Querying users...');
  const startQuery = Date.now();
  const [users] = await conn.query('SELECT id, email, password_hash FROM users LIMIT 10');
  console.log(`⏱️ Query took ${Date.now() - startQuery}ms. Found ${users.length} users.`);

  for (const user of users) {
    const hashParts = user.password_hash.split('$');
    let rounds = 'unknown';
    if (hashParts.length >= 4) {
      rounds = parseInt(hashParts[2], 10);
    }
    
    console.log(`👤 User ID: ${user.id}, Email: ${user.email}`);
    console.log(`   Hash: ${user.password_hash}`);
    console.log(`   Rounds: ${rounds}`);

    // Try a dummy compare to see how long it takes
    const startCompare = Date.now();
    // Compare against the admin password SQ@Admin2024! or a random password
    const match = await bcrypt.compare('SQ@Admin2024!', user.password_hash);
    console.log(`   Bcrypt compare took: ${Date.now() - startCompare}ms (match: ${match})`);
  }

  await conn.end();
}

measure().catch(console.error);
