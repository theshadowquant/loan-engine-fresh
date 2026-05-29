const db = require('../config/db');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function profileDetail() {
  console.log('⚡ Starting Detailed Profiler...');
  const testEmail = `profile_detail_${Date.now()}@example.com`;
  const password = 'SQ@TestPassword2026!';

  // --- REGISTER PROFILING ---
  console.log('\n--- REGISTER DETAILS ---');
  
  // step 1: check if user exists
  const startSelect = Date.now();
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [testEmail]);
  const endSelect = Date.now();
  console.log(`⏱️ SELECT query (existing user check) took: ${endSelect - startSelect}ms`);

  // step 2: bcrypt hash
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
  console.log(`🔑 Hashing with BCRYPT_ROUNDS = ${rounds}...`);
  const startHash = Date.now();
  const hash = await bcrypt.hash(password, rounds);
  const endHash = Date.now();
  console.log(`⏱️ Bcrypt hashing took: ${endHash - startHash}ms`);

  // step 3: insert into database
  const startInsert = Date.now();
  const [result] = await db.query(
    `INSERT INTO users 
    (email, password_hash, first_name, last_name, phone_number, date_of_birth, pan_number) 
    VALUES (?,?,?,?,?,?,?)`,
    [
      testEmail,
      hash,
      'Profiler',
      'Test',
      `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      '1995-05-15',
      `DETP${Math.floor(1000 + Math.random() * 9000)}A`
    ]
  );
  const endInsert = Date.now();
  console.log(`⏱️ INSERT query took: ${endInsert - startInsert}ms`);

  // --- LOGIN PROFILING ---
  console.log('\n--- LOGIN DETAILS ---');

  // step 1: fetch user
  const startLoginSelect = Date.now();
  const [[user]] = await db.query('SELECT * FROM users WHERE email = ?', [testEmail]);
  const endLoginSelect = Date.now();
  console.log(`⏱️ SELECT query (login fetch) took: ${endLoginSelect - startLoginSelect}ms`);

  if (user) {
    // step 2: bcrypt compare
    const startCompare = Date.now();
    const match = await bcrypt.compare(password, user.password_hash);
    const endCompare = Date.now();
    console.log(`⏱️ Bcrypt compare took: ${endCompare - startCompare}ms (match: ${match})`);
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  const startDelete = Date.now();
  await db.query('DELETE FROM users WHERE email = ?', [testEmail]);
  console.log(`🧹 Delete took ${Date.now() - startDelete}ms`);

  await db.end();
}

profileDetail().catch(console.error);
