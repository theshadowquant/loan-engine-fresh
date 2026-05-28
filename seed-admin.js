const mysql = require('mysql2/promise');
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}
require('dotenv').config();

async function seedAdmin() {
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

  // Check if admin already exists
  const [[existing]] = await conn.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
  let adminId;

  if (existing) {
    adminId = existing.id;
    console.log(`ℹ️  Admin user already exists (ID: ${adminId}). Skipping creation.`);
  } else {
    const hash = await bcrypt.hash(adminPassword, parseInt(process.env.BCRYPT_ROUNDS) || 8);
    const [result] = await conn.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone_number, date_of_birth, pan_number, is_active, is_verified)
       VALUES (?, ?, 'ShadowQuant', 'Admin', '9999999999', '1990-01-01', 'ADMIN1234A', 1, 1)`,
      [adminEmail, hash]
    );
    adminId = result.insertId;
    console.log(`✅ Admin user created (ID: ${adminId})`);
  }

  // Get ADMIN role ID
  const [[role]] = await conn.query("SELECT id FROM roles WHERE name = 'ADMIN'");
  if (!role) throw new Error('ADMIN role not found in roles table. Run migrations first.');

  // Assign ADMIN role (ignore if already assigned)
  await conn.query(
    `INSERT IGNORE INTO user_roles (user_id, role_id, is_active) VALUES (?, ?, 1)`,
    [adminId, role.id]
  );
  console.log(`✅ ADMIN role assigned to user ID ${adminId}`);
  console.log('');
  console.log('🔐 Admin Credentials:');
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('');
  console.log('🚨 IMPORTANT: Change this password after first login!');

  await conn.end();
}

seedAdmin().catch(err => {
  console.error('❌ Admin seeding failed:', err.message);
  process.exit(1);
});
