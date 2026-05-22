const express = require('express');
const router  = express.Router();
const QRCode  = require('qrcode');
const auth    = require('../middleware/auth');
const { getWhatsAppStatus, logoutWhatsAppSession, pairWithPhoneNumber } = require('../controllers/whatsappController');
const { getLatestQr } = require('../whatsapp/client');

// GET /api/whatsapp/status  — check if WhatsApp is connected
router.get('/status', auth, getWhatsAppStatus);

// POST /api/whatsapp/logout — disconnect WhatsApp session (requires auth)
router.post('/logout', auth, logoutWhatsAppSession);

// POST /api/whatsapp/pair   — link via phone number (get pairing code)
router.post('/pair', auth, pairWithPhoneNumber);

// GET /api/whatsapp/qr  — show QR code in browser (no auth, for easy scanning)
router.get('/qr', async (_req, res) => {
  const qrString = getLatestQr();

  if (!qrString) {
    return res.send(`
      <!DOCTYPE html>
      <html><head><title>WhatsApp QR</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b141a; color: #e9edef; }
        .card { text-align: center; padding: 40px; border-radius: 16px; background: #1f2c33; }
        h2 { color: #25D366; }
        p { color: #8696a0; }
        .btn { display: inline-block; margin-top: 20px; padding: 10px 24px; background: #25D366; color: #111; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
      <meta http-equiv="refresh" content="3">
      </head><body>
        <div class="card">
          <h2>✅ No QR Code Needed</h2>
          <p>WhatsApp is either already connected or still initializing.</p>
          <p style="font-size:13px; opacity:0.6;">This page auto-refreshes every 3 seconds.</p>
          <a class="btn" href="/api/whatsapp/qr">Refresh Now</a>
        </div>
      </body></html>
    `);
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(qrString, { width: 400, margin: 2 });
    res.send(`
      <!DOCTYPE html>
      <html><head><title>Scan WhatsApp QR</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b141a; color: #e9edef; }
        .card { text-align: center; padding: 40px; border-radius: 16px; background: #1f2c33; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        h2 { color: #25D366; margin-bottom: 8px; }
        p { color: #8696a0; margin-top: 4px; }
        img { border-radius: 12px; margin: 20px 0; }
        .steps { text-align: left; display: inline-block; color: #8696a0; font-size: 14px; line-height: 1.8; }
        .steps b { color: #e9edef; }
      </style>
      <meta http-equiv="refresh" content="15">
      </head><body>
        <div class="card">
          <h2>📱 Scan QR Code</h2>
          <p>Link your WhatsApp to this app</p>
          <img src="${qrDataUrl}" alt="WhatsApp QR Code" />
          <div class="steps">
            <b>1.</b> Open WhatsApp on your phone<br/>
            <b>2.</b> Tap <b>Settings → Linked Devices</b><br/>
            <b>3.</b> Tap <b>Link a Device</b><br/>
            <b>4.</b> Point your camera at this QR code
          </div>
          <p style="font-size:12px; margin-top:20px; opacity:0.5;">Page auto-refreshes. QR expires periodically.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR image.' });
  }
});

// GET /api/whatsapp/qr-data  — JSON endpoint for frontend QR modal
router.get('/qr-data', async (_req, res) => {
  const { isReady, hasClient, isInitializing } = require('../whatsapp/client').getStatus();

  const qrString = getLatestQr();

  if (isReady) {
    return res.json({ status: 'connected', qr: null, message: 'WhatsApp is already connected!' });
  }

  if (!qrString) {
    return res.json({
      status: isInitializing ? 'initializing' : 'no_qr',
      qr: null,
      message: isInitializing
        ? 'WhatsApp is initializing, QR will appear shortly...'
        : 'No QR code available. WhatsApp may need to be restarted.',
    });
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(qrString, { width: 400, margin: 2 });
    return res.json({ status: 'qr_ready', qr: qrDataUrl, message: 'Scan this QR code with WhatsApp' });
  } catch (err) {
    return res.status(500).json({ status: 'error', qr: null, message: 'Failed to generate QR image.' });
  }
});

// ─── WhatsApp Queue API (for local bot) ──────────────────────────────────────
// These endpoints are used by the local WhatsApp bot to poll and process messages.
// Secured with a simple API key (BOT_API_KEY env variable).

const botAuth = (req, res, next) => {
  const key = req.headers['x-bot-key'] || req.query.key;
  const expectedKey = process.env.BOT_API_KEY || 'edutrack-bot-secret-2024';
  if (key !== expectedKey) {
    return res.status(401).json({ error: 'Invalid bot API key.' });
  }
  next();
};

// GET /api/whatsapp/pending-messages — local bot polls this
router.get('/pending-messages', botAuth, async (_req, res) => {
  try {
    const { db } = require('../db/database');
    const pending = await db.prepare(`
      SELECT id, phone, message, student_name, attendance_id, attempts, created_at
      FROM whatsapp_queue
      WHERE sent = 0 AND attempts < 3
      ORDER BY created_at ASC
      LIMIT 50
    `).all();
    res.json({ count: pending.length, messages: pending });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/whatsapp/mark-sent — local bot marks message as delivered
router.post('/mark-sent', botAuth, async (req, res) => {
  try {
    const { db } = require('../db/database');
    const { messageId, success, error: sendError } = req.body;

    if (!messageId) {
      return res.status(400).json({ error: 'messageId is required.' });
    }

    if (success) {
      // Mark as sent
      await db.prepare(`
        UPDATE whatsapp_queue SET sent = 1, sent_at = datetime('now') WHERE id = ?
      `).run(messageId);

      // Also update the attendance record
      const queueItem = await db.prepare('SELECT attendance_id FROM whatsapp_queue WHERE id = ?').get(messageId);
      if (queueItem && queueItem.attendance_id) {
        await db.prepare(`
          UPDATE attendance SET whatsapp_sent = 1, whatsapp_error = NULL WHERE id = ?
        `).run(queueItem.attendance_id);
      }
    } else {
      // Increment attempt count
      await db.prepare(`
        UPDATE whatsapp_queue SET attempts = attempts + 1, error = ? WHERE id = ?
      `).run(sendError || 'Unknown error', messageId);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/whatsapp/queue-stats — check queue status
router.get('/queue-stats', botAuth, async (_req, res) => {
  try {
    const { db } = require('../db/database');
    const stats = await db.prepare(`
      SELECT
        COUNT(*)                                    AS total,
        SUM(CASE WHEN sent = 1 THEN 1 ELSE 0 END)  AS sent,
        SUM(CASE WHEN sent = 0 AND attempts < 3 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN sent = 0 AND attempts >= 3 THEN 1 ELSE 0 END) AS failed
      FROM whatsapp_queue
    `).get();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
