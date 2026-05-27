// repair-emi.js  — run to sync EMI state with actual payments
const mysql = require('mysql2/promise');
require('dotenv').config();

async function repair() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'loan_engine',
  });

  const LOAN_ID = 16;

  // 1. Get loan info
  const [[loan]] = await db.query('SELECT * FROM loans WHERE id = ?', [LOAN_ID]);
  console.log(`Loan principal: ₹${loan.principal_amount}`);

  // 2. Count actual successful payments
  const [[{ payCount }]] = await db.query(
    'SELECT COUNT(*) AS payCount FROM payments WHERE loan_id = ? AND payment_status = "SUCCESS"',
    [LOAN_ID]
  );
  const realPayments = Number(payCount);
  console.log(`✅ Actual payments in DB: ${realPayments}`);

  // 3. Reset ALL EMIs to PENDING
  await db.query('UPDATE emi_schedule SET status = "PENDING" WHERE loan_id = ?', [LOAN_ID]);
  console.log('🔄 Reset all EMIs to PENDING');

  // 4. Re-mark exactly N EMIs as PAID and compute outstanding from principal components
  if (realPayments > 0) {
    const [emis] = await db.query(
      `SELECT * FROM emi_schedule WHERE loan_id = ? ORDER BY installment_number ASC LIMIT ${realPayments}`,
      [LOAN_ID]
    );

    let totalPrincipalPaid = 0;
    for (const emi of emis) {
      await db.query('UPDATE emi_schedule SET status = "PAID" WHERE id = ?', [emi.id]);
      totalPrincipalPaid += parseFloat(emi.principal_component || 0);
      console.log(`  ✓ Marked EMI #${emi.installment_number} as PAID (principal: ₹${emi.principal_component})`);
    }

    // outstanding = principal_amount - sum of all paid principal components
    const outstanding = parseFloat(loan.principal_amount) - totalPrincipalPaid;
    const outstandingFixed = Math.max(0, Math.round(outstanding * 100) / 100);

    await db.query(
      'UPDATE loans SET outstanding_principal = ? WHERE id = ?',
      [outstandingFixed, LOAN_ID]
    );
    console.log(`\n💰 Total principal paid: ₹${totalPrincipalPaid.toFixed(2)}`);
    console.log(`💰 Outstanding set to: ₹${outstandingFixed}`);
  } else {
    await db.query(
      'UPDATE loans SET outstanding_principal = principal_amount WHERE id = ?',
      [LOAN_ID]
    );
    console.log('💰 Outstanding reset to full principal');
  }

  console.log('\n🎉 Repair complete!');
  await db.end();
}

repair().catch(console.error);
