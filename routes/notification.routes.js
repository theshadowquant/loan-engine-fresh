const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/notification.controller');

router.get('/', auth, c.getAll);
router.put('/read', auth, c.markAllRead);

module.exports = router;
