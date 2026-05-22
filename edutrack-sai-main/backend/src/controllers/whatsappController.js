const { getStatus, logoutWhatsApp, requestPairingCode } = require('../whatsapp/client');

// GET /api/whatsapp/status
const getWhatsAppStatus = (req, res) => {
  const { isReady, hasClient, isInitializing } = getStatus();

  let statusMessage;
  let statusCode;

  if (isReady) {
    statusMessage = 'WhatsApp is connected and ready to send messages.';
    statusCode    = 'connected';
  } else if (isInitializing || hasClient) {
    statusMessage = 'WhatsApp is initializing. Please link via phone number or scan QR code.';
    statusCode    = 'pending';
  } else {
    statusMessage = 'WhatsApp client is not running.';
    statusCode    = 'disconnected';
  }

  res.json({ isReady, hasClient, isInitializing, statusCode, statusMessage });
};

// POST /api/whatsapp/logout
const logoutWhatsAppSession = async (req, res) => {
  try {
    const result = await logoutWhatsApp();
    console.log(`🔓 WhatsApp logout triggered by ${req.teacher?.name || 'unknown'} (${req.teacher?.email || ''})`);
    res.json(result);
  } catch (err) {
    console.error('❌ WhatsApp logout error:', err.message);
    res.status(500).json({
      success: false,
      message: `Logout failed: ${err.message}`,
    });
  }
};

// POST /api/whatsapp/pair
const pairWithPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required. Format: 919876543210',
      });
    }

    const result = await requestPairingCode(phoneNumber);
    console.log(`📱 Pairing code requested by ${req.teacher?.name || 'unknown'} for ${phoneNumber}`);
    res.json(result);
  } catch (err) {
    console.error('❌ Pairing code error:', err.message);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = { getWhatsAppStatus, logoutWhatsAppSession, pairWithPhoneNumber };
