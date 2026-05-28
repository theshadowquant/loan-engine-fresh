const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt'); // Use native bcrypt
require('dotenv').config();

async function fixAdminHash() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  const adminEmail = 'admin@shadowquant.com';
  const adminPassword = 'SQ@Admin2024!';

  console.log('🔄 Fetching admin user...');
  const [[admin]] = await conn.query('SELECT id, password_hash FROM users WHERE email = ?', [adminEmail]);

  if (!admin) {
    console.log('❌ Admin user not found in database!');
    await conn.end();
    return;
  }

  console.log(`ℹ️ Admin user found (ID: ${admin.id})`);
  console.log(`Current hash: ${admin.password_hash}`);

  // Generate 8 round hash
  console.log('🔑 Generating new 8-round hash...');
  const start = Date.now();
  const newHash = await bcrypt.hash(adminPassword, 8);
  console.log(`Generated in ${Date.now() - start}ms: ${newHash}`);

  // Update in database
  console.log('💾 Updating database with new hash...');
  await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, admin.id]);
  console.log('✅ Admin user password hash successfully updated to BCRYPT_ROUNDS=8!');

  await conn.end();
}

fixAdminHash().catch(err => {
  console.error('❌ Failed to fix admin hash:', err);
  process.exit(1);
});
