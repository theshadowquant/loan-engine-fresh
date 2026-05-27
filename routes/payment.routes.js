const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const payment = require('../controllers/payment.controller');

router.get('/', auth, payment.getUserPayments);

module.exports = router;
