const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getWhatsAppStatus } = require('../controllers/whatsappController');

// GET /api/whatsapp/status  — check if Meta WhatsApp API is configured
router.get('/status', auth, getWhatsAppStatus);

module.exports = router;
