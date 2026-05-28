const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const db = require('../config/db');
const Decimal = require('decimal.js');

// ── GET ALL APPLICATIONS (Admin) ──────────────────────────────
router.get('/applications', adminAuth, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT la.*, u.first_name, u.last_name, u.email
      FROM loan_applications la
      LEFT JOIN users u ON la.user_id = u.id
      ORDER BY la.created_at DESC
    `);
    res.json({ applications: rows });
  } catch (err) { next(err); }
});

// ── APPROVE APPLICATION ───────────────────────────────────────
router.post('/applications/:id/approve', adminAuth, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { approved_amount, interest_rate, tenure_months, remarks } = req.body;
    const appId = req.params.id;

    // Update application status
    await conn.query(
      `UPDATE loan_applications SET status = 'APPROVED', reviewed_by = ?, remarks = ? WHERE id = ?`,
      [req.user.id, remarks || null, appId]
    );

    // Get application
    const [[app]] = await conn.query('SELECT * FROM loan_applications WHERE id = ?', [appId]);
    if (!app) throw new Error('Application not found');

    // Calculate EMI using Decimal
    const P = new Decimal(approved_amount);
    const annualRate = new Decimal(interest_rate);
    const r = annualRate.div(100).div(12);
    const n = new Decimal(tenure_months);
    const onePlusR = r.plus(1);
    const onePlusRpowN = onePlusR.pow(n);
    const emi = P.mul(r).mul(onePlusRpowN).div(onePlusRpowN.minus(1)).toDecimalPlaces(2);

    // Create placeholder loan reference, updated with format immediately after insertion
    const tempLoanRef = 'TEMP' + Date.now();

    // Create loan (saves loan_type)
    const [loanResult] = await conn.query(`
      INSERT INTO loans (user_id, loan_reference, loan_type, principal_amount, interest_rate, tenure_months, emi_amount_at_origination, outstanding_principal, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [app.user_id, tempLoanRef, app.loan_type || 'PERSONAL', approved_amount, interest_rate, tenure_months, emi.toString(), approved_amount]);

    const loanId = loanResult.insertId;

    // Formatted Loan Reference: LN-YYYY-XXXXX
    const formattedLoanRef = `LN-${new Date().getFullYear()}-${String(loanId).padStart(5, '0')}`;
    
    // Update loan_reference in database
    await conn.query('UPDATE loans SET loan_reference = ? WHERE id = ?', [formattedLoanRef, loanId]);

    // Generate EMI schedule
    let balance = P;
    const scheduleRows = [];
    let dueDate = new Date();

    for (let i = 1; i <= tenure_months; i++) {
      dueDate = new Date(dueDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      const interestComp = balance.mul(r).toDecimalPlaces(2);
      const principalComp = emi.minus(interestComp).toDecimalPlaces(2);
      balance = balance.minus(principalComp).toDecimalPlaces(2);
      if (i === tenure_months && balance.abs().lt(2)) balance = new Decimal(0);
      scheduleRows.push([loanId, i, dueDate.toISOString().split('T')[0], emi.toString(), principalComp.toString(), interestComp.toString(), balance.lt(0) ? '0' : balance.toString(), 'PENDING']);
    }

    // Bulk insert EMI schedule
    await conn.query(
      `INSERT INTO emi_schedule (loan_id, installment_number, due_date, emi_amount, principal_component, interest_component, balance_after, status) VALUES ?`,
      [scheduleRows]
    );

    // Create loan_summary entry
    await conn.query(`
      INSERT INTO loan_summary (loan_id, total_principal, total_interest, total_payable, amount_paid, outstanding_principal, penalties_due, last_updated)
      VALUES (?, ?, ?, ?, 0, ?, 0, NOW())
      ON DUPLICATE KEY UPDATE outstanding_principal = VALUES(outstanding_principal), last_updated = NOW()
    `, [loanId, approved_amount, emi.mul(tenure_months).minus(approved_amount).toDecimalPlaces(2).toString(), emi.mul(tenure_months).toDecimalPlaces(2).toString(), approved_amount]);

    // Notify user
    await conn.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'LOAN_APPROVED', ?, 0)`,
      [app.user_id, `Your loan application #${appId} has been approved! Loan ID: ${formattedLoanRef}. EMI: ₹${emi.toString()}/month.`]
    );

    await conn.commit();
    res.json({ message: 'Loan approved successfully', loanId, loanReference: formattedLoanRef, emi: emi.toString() });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
});

// ── REJECT APPLICATION ────────────────────────────────────────
router.post('/applications/:id/reject', adminAuth, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const [[app]] = await db.query('SELECT * FROM loan_applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    await db.query(
      `UPDATE loan_applications SET status = 'REJECTED', reviewed_by = ?, remarks = ? WHERE id = ?`,
      [req.user.id, reason, req.params.id]
    );

    await db.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'LOAN_REJECTED', ?, 0)`,
      [app.user_id, `Your loan application #${req.params.id} was not approved. Reason: ${reason}`]
    );

    res.json({ message: 'Application rejected' });
  } catch (err) { next(err); }
});

// ── GET ALL LOANS (Admin) ─────────────────────────────────────
router.get('/loans', adminAuth, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, ls.total_principal, ls.total_interest, ls.total_payable, ls.amount_paid,
             u.first_name, u.last_name, u.email
      FROM loans l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN loan_summary ls ON l.id = ls.loan_id
      ORDER BY l.id DESC
    `);
    res.json({ loans: rows });
  } catch (err) { next(err); }
});

// ── GET ALL USERS (Admin) ─────────────────────────────────────
router.get('/users', adminAuth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, email, first_name, last_name, phone_number, pan_number, is_active, is_verified, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  } catch (err) { next(err); }
});

// ── VERIFY / UNVERIFY USER (Admin) ───────────────────────────
router.patch('/users/:id/verify', adminAuth, async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { verified } = req.body; // true = verify, false = unverify

    const [[user]] = await db.query('SELECT id, first_name, is_verified FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.query('UPDATE users SET is_verified = ? WHERE id = ?', [verified ? 1 : 0, userId]);

    // Send notification to the user
    const msg = verified
      ? `🎉 Congratulations! Your account has been verified by ShadowQuant Admin. You now have full access to all platform features.`
      : `Your account verification has been revoked. Please contact support for assistance.`;
    await db.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'SYSTEM', ?, 0)`,
      [userId, msg]
    );

    res.json({ message: `User ${verified ? 'verified' : 'unverified'} successfully`, is_verified: verified });
  } catch (err) { next(err); }
});

// ── MARK APPLICATION AS UNDER REVIEW (Admin) ──────────────────
router.post('/applications/:id/under-review', adminAuth, async (req, res, next) => {
  try {
    const appId = req.params.id;
    const [[app]] = await db.query('SELECT * FROM loan_applications WHERE id = ?', [appId]);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    await db.query(
      `UPDATE loan_applications SET status = 'UNDER_REVIEW', reviewed_by = ? WHERE id = ?`,
      [req.user.id, appId]
    );

    // Notify user
    await db.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'SYSTEM', ?, 0)`,
      [app.user_id, `Your loan application #${appId} is now under review.`]
    );

    res.json({ message: 'Application status updated to Under Review' });
  } catch (err) { next(err); }
});

// ── MARK LOAN AS DEFAULTED (Admin) ────────────────────────────
router.post('/loans/:id/default', adminAuth, async (req, res, next) => {
  try {
    const loanId = req.params.id;
    const [[loan]] = await db.query('SELECT * FROM loans WHERE id = ?', [loanId]);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    await db.query(`UPDATE loans SET status = 'DEFAULTED' WHERE id = ?`, [loanId]);

    // Notify user
    await db.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'OVERDUE', ?, 0)`,
      [loan.user_id, `⚠️ CRITICAL: Your loan ${loan.loan_reference || '#' + loanId} has been marked as DEFAULTED due to non-payment. Please contact support immediately.`]
    );

    res.json({ message: 'Loan status updated to DEFAULTED' });
  } catch (err) { next(err); }
});

// ── MARK LOAN AS NPA (Admin) ──────────────────────────────────
router.post('/loans/:id/npa', adminAuth, async (req, res, next) => {
  try {
    const loanId = req.params.id;
    const [[loan]] = await db.query('SELECT * FROM loans WHERE id = ?', [loanId]);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    await db.query(`UPDATE loans SET status = 'NPA' WHERE id = ?`, [loanId]);

    // Notify user
    await db.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'OVERDUE', ?, 0)`,
      [loan.user_id, `🚨 WARNING: Your loan ${loan.loan_reference || '#' + loanId} has been classified as an NPA (Non-Performing Asset) by our auditing systems.`]
    );

    res.json({ message: 'Loan status updated to NPA' });
  } catch (err) { next(err); }
});

// ── RESTORE LOAN TO ACTIVE (Admin) ────────────────────────────
router.post('/loans/:id/active', adminAuth, async (req, res, next) => {
  try {
    const loanId = req.params.id;
    const [[loan]] = await db.query('SELECT * FROM loans WHERE id = ?', [loanId]);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });

    await db.query(`UPDATE loans SET status = 'ACTIVE' WHERE id = ?`, [loanId]);

    // Notify user
    await db.query(
      `INSERT INTO notifications (user_id, type, message, is_read) VALUES (?, 'SYSTEM', ?, 0)`,
      [loan.user_id, `Your loan ${loan.loan_reference || '#' + loanId} has been successfully restored to ACTIVE status.`]
    );

    res.json({ message: 'Loan status updated to ACTIVE' });
  } catch (err) { next(err); }
});

module.exports = router;
