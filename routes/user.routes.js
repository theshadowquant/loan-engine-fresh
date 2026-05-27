const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/auth.controller');

router.get('/me', auth, c.me);

module.exports = router;
