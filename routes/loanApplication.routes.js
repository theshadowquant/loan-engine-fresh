const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/loanApplication.controller');

router.post('/', auth, c.apply);
router.get('/', auth, c.getAll);
router.get('/:id', auth, c.getOne);

module.exports = router;
