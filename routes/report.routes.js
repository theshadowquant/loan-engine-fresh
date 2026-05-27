const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/report.controller');

router.get('/summary', auth, c.summary);

module.exports = router;
