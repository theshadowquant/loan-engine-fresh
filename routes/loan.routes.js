const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const loan = require('../controllers/loan.controller');
const payment = require('../controllers/payment.controller');

router.get('/', auth, loan.getAll);
router.get('/:id', auth, loan.getOne);
router.get('/:id/emi-schedule', auth, loan.getEMISchedule);
router.get('/:id/payments', auth, loan.getPayments);
router.post('/:id/payments', auth, payment.makePayment);

module.exports = router;
