const { getStatus } = require('../whatsapp/client');

// GET /api/whatsapp/status
const getWhatsAppStatus = (req, res) => {
  const { isReady } = getStatus();

  let statusMessage;
  let statusCode;

  if (isReady) {
    statusMessage = 'Meta WhatsApp API is configured and ready.';
    statusCode    = 'connected';
  } else {
    statusMessage = 'Meta API credentials missing. Please set META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN.';
    statusCode    = 'disconnected';
  }

  res.json({ isReady, hasClient: isReady, isInitializing: false, statusCode, statusMessage });
};

module.exports = { getWhatsAppStatus };
