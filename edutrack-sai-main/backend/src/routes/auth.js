const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { login, me } = require('../controllers/authController');

// POST /api/auth/login  — public
router.post('/login', login);

// GET  /api/auth/me     — protected (validates token)
router.get('/me', auth, me);

module.exports = router;
