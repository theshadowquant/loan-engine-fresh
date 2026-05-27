const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const password = process.argv[2];
  if (!password) {
    console.error('Error: Please provide your Aiven database password.');
    console.log('Usage: node migrate-aiven.js <YOUR_PASSWORD>');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: 'mysql-b89eecf-theshadowquant-d9f2.c.aivencloud.com',
    port: 18222,
    user: 'avnadmin',
    password: password,
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false },
    multipleStatements: true
  });

  console.log('🚀 Connected to Aiven MySQL! Running schema.sql...');
  
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  
  // Aiven MySQL is ready. Run the schema commands.
  await connection.query(sql);
  
  console.log('✅ Database migrated successfully! All tables initialized in defaultdb.');
  await connection.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
