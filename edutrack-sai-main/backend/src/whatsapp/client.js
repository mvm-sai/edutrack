const axios = require('axios');

/**
 * Send a WhatsApp message using the Official Meta Cloud API.
 * Requires META_WA_PHONE_NUMBER_ID and META_WA_ACCESS_TOKEN in env.
 */
const sendMessage = async (phone, message) => {
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  const token = process.env.META_WA_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.error('⚠️ Meta WhatsApp API credentials missing. Message not sent.');
    throw new Error('WhatsApp API not configured');
  }

  // Format phone: remove all non-digits. The API expects the country code without '+'
  const formattedPhone = phone.replace(/\D/g, '');

  try {
    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;
    
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { preview_url: false, body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Meta WhatsApp message sent to ${formattedPhone}`);
  } catch (err) {
    const errorDetail = err.response?.data?.error?.message || err.message;
    console.error(`❌ Meta WhatsApp send failed to ${formattedPhone}:`, errorDetail);
    throw new Error(`WhatsApp API Error: ${errorDetail}`);
  }
};

const getStatus = () => {
  const hasCreds = !!(process.env.META_WA_PHONE_NUMBER_ID && process.env.META_WA_ACCESS_TOKEN);
  return {
    isReady: hasCreds,
    hasClient: hasCreds,
    isInitializing: false,
  };
};

module.exports = {
  sendMessage,
  getStatus,
};