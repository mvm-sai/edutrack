const path    = require('path');
const qrcode  = require('qrcode-terminal');

let whatsappClient = null;
let isReady        = false;
let isInitializing = false;
let latestQr       = null;

/**
 * Boot the WhatsApp Web client.
 * Prints a QR code to the terminal on first run.
 * Session is cached in .wwebjs_auth/ so future starts skip QR.
 *
 * Uses PUPPETEER_EXECUTABLE_PATH env var if available (Docker/cloud),
 * otherwise falls back to bundled Chromium (local dev).
 */
const initWhatsApp = () => {
  if (isInitializing || whatsappClient) return;
  isInitializing = true;

  // Dynamic require so builds don't fail if puppeteer is missing
  const { Client, LocalAuth } = require('whatsapp-web.js');

  const puppeteerArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--single-process',
  ];

  const puppeteerOpts = {
    headless: true,
    args: puppeteerArgs,
  };

  // Use system Chromium if available (Docker / Railway)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(process.cwd(), '.wwebjs_auth'),
    }),
    puppeteer: puppeteerOpts,
  });

  // ── Events ──────────────────────────────────────────────────────────────────
  client.on('qr', (qr) => {
    latestQr = qr;
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║        📱  SCAN THIS QR CODE WITH WHATSAPP  📱           ║');
    console.log('║   Open WhatsApp → Settings → Linked Devices → Link       ║');
    console.log('║   Or visit the /api/whatsapp/qr page in your browser     ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\n');
    qrcode.generate(qr, { small: true });
    console.log('\n⏳ Waiting for QR scan...\n');
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`⏳ WhatsApp loading: ${percent}% — ${message}`);
  });

  client.on('authenticated', () => {
    latestQr = null;
    console.log('🔐 WhatsApp authenticated! Loading session...');
  });

  client.on('ready', () => {
    isReady = true;
    latestQr = null;
    console.log('✅ WhatsApp client is ready — messages will be sent automatically!');
  });

  client.on('auth_failure', (msg) => {
    isReady = false;
    console.error('❌ WhatsApp auth failure:', msg);
    console.log('🔄 Retrying in 30 seconds...');
    setTimeout(() => {
      whatsappClient = null;
      isInitializing = false;
      initWhatsApp();
    }, 30_000);
  });

  client.on('disconnected', async (reason) => {
    isReady = false;
    console.warn('⚠️  WhatsApp disconnected:', reason);

    // Safely destroy the old client before reinitializing
    try {
      await client.destroy();
    } catch (e) {
      // Ignore destroy errors — client may already be dead
    }

    whatsappClient = null;
    isInitializing = false;
    console.log('🔄 Reconnecting in 10 seconds...');
    setTimeout(initWhatsApp, 10_000);
  });

  client.initialize().catch((err) => {
    console.error('❌ WhatsApp init error:', err.message);
    whatsappClient = null;
    isInitializing = false;
    // Retry after 30 seconds
    console.log('🔄 Retrying WhatsApp in 30 seconds...');
    setTimeout(initWhatsApp, 30_000);
  });

  whatsappClient = client;
};
/**
 * Send a WhatsApp message to a phone number.
 * @param {string} phone  - Number with country code, e.g. "919876543210"
 * @param {string} message - Message text
 */
const sendMessage = async (phone, message) => {
  if (!whatsappClient || !isReady) {
    throw new Error('WhatsApp client not ready. Please scan the QR code first.');
  }

  // Use getNumberId() to resolve the correct chat ID and avoid "No LID for user" errors
  const numberId = await whatsappClient.getNumberId(phone);
  if (!numberId) {
    throw new Error(`Phone number ${phone} is not registered on WhatsApp.`);
  }

  const chatId = numberId._serialized;
  await whatsappClient.sendMessage(chatId, message);
};

/**
 * Send a WhatsApp message with retry logic.
 * Retries up to `maxRetries` times with a delay between attempts.
 *
 * @param {string} phone     - Number with country code
 * @param {string} message   - Message text
 * @param {object} options   - { maxRetries: 2, retryDelay: 5000 }
 * @returns {{ success: boolean, attempts: number, error?: string }}
 */
const sendMessageWithRetry = async (phone, message, options = {}) => {
  const { delay: delayFn } = require('../utils/delay');
  const maxRetries  = options.maxRetries  || 2;
  const retryDelay  = options.retryDelay  || 5000;
  let attempts = 0;
  let lastError = null;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      await sendMessage(phone, message);
      return { success: true, attempts, error: null };
    } catch (err) {
      lastError = err.message;

      if (attempts <= maxRetries) {
        console.log(`   🔄 Retry ${attempts}/${maxRetries} for ${phone} in ${retryDelay / 1000}s — Error: ${err.message}`);
        await delayFn(retryDelay);
      }
    }
  }

  return { success: false, attempts, error: lastError };
};

/**
 * Get current WhatsApp connection status.
 */
const getStatus = () => ({
  isReady,
  hasClient:    !!whatsappClient,
  isInitializing,
  isDisabled:   false,
});

const getLatestQr = () => latestQr;

/**
 * Safely logout WhatsApp, destroy client, clean up session files,
 * and re-initialize for a fresh QR code.
 *
 * @returns {{ success: boolean, message: string }}
 */
const logoutWhatsApp = async () => {
  const fs = require('fs');

  console.log('\n🔓 WhatsApp logout requested...');

  // Step 1: Logout the client session (if connected)
  if (whatsappClient) {
    try {
      if (isReady) {
        console.log('   📤 Logging out WhatsApp session...');
        await whatsappClient.logout();
        console.log('   ✅ Session logged out');
      }
    } catch (err) {
      console.warn(`   ⚠️  Logout call failed (may be already disconnected): ${err.message}`);
    }

    // Step 2: Destroy the client (closes Puppeteer browser)
    try {
      console.log('   🔄 Destroying client...');
      await whatsappClient.destroy();
      console.log('   ✅ Client destroyed');
    } catch (err) {
      console.warn(`   ⚠️  Destroy call failed: ${err.message}`);
    }
  }

  // Step 3: Reset state
  whatsappClient = null;
  isReady        = false;
  isInitializing = false;
  latestQr       = null;

  // Step 4: Remove auth files
  const authPath = path.join(process.cwd(), '.wwebjs_auth');
  try {
    if (fs.existsSync(authPath)) {
      console.log(`   🗑️  Removing auth files: ${authPath}`);
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('   ✅ Auth files removed');
    } else {
      console.log('   ℹ️  No auth files found (already clean)');
    }
  } catch (err) {
    console.warn(`   ⚠️  Could not remove auth files: ${err.message}`);
  }

  // Step 5: Re-initialize after a short delay (allow cleanup to finish)
  console.log('   🔄 Re-initializing WhatsApp client in 3 seconds...\n');
  setTimeout(() => {
    initWhatsApp();
  }, 3000);

  return {
    success: true,
    message: 'WhatsApp session logged out. A new QR code will appear shortly.',
  };
};

/**
 * Request a pairing code for phone-number-based WhatsApp linking.
 * User enters the returned code on their phone in WhatsApp > Linked Devices > Link with phone number.
 *
 * @param {string} phoneNumber - Phone number with country code, e.g. "919876543210"
 * @returns {Promise<{ success: boolean, code?: string, message: string }>}
 */
const requestPairingCode = async (phoneNumber) => {
  if (!whatsappClient) {
    throw new Error('WhatsApp client is not initialized. Please wait for it to start.');
  }

  if (isReady) {
    throw new Error('WhatsApp is already connected. Logout first to link a new device.');
  }

  // Clean the phone number (remove +, spaces, dashes)
  const cleaned = phoneNumber.replace(/[\s\-\+]/g, '');

  if (!/^\d{10,15}$/.test(cleaned)) {
    throw new Error('Invalid phone number. Use format: 919876543210 (country code + number).');
  }

  console.log(`\n📱 Requesting pairing code for ${cleaned}...`);

  try {
    // The puppeteer page needs the `onCodeReceivedEvent` function exposed
    // before requestPairingCode can work (normally only set up in pairing init mode).
    const page = whatsappClient.pupPage;
    if (page) {
      try {
        const hasHandler = await page.evaluate(() => typeof window.onCodeReceivedEvent === 'function');
        if (!hasHandler) {
          await page.exposeFunction('onCodeReceivedEvent', (code) => code);
        }
      } catch (exposeErr) {
        // May fail if already exposed or page context changed — that's OK
        console.log(`   ℹ️  exposeFunction note: ${exposeErr.message}`);
      }
    }

    const code = await whatsappClient.requestPairingCode(cleaned);
    console.log(`✅ Pairing code generated: ${code}`);
    console.log(`   Enter this code on WhatsApp → Linked Devices → Link with Phone Number\n`);
    return {
      success: true,
      code,
      message: `Enter this code on your WhatsApp: ${code}`,
    };
  } catch (err) {
    const errorMsg = err?.message || String(err) || 'Unknown error';
    console.error(`❌ Pairing code request failed: ${errorMsg}`, err);
    
    // Provide helpful error message
    let userMessage = 'Failed to generate pairing code.';
    if (errorMsg.includes('already')) {
      userMessage = 'WhatsApp is already connected. Please logout first.';
    } else if (errorMsg.length <= 2) {
      userMessage = 'WhatsApp pairing code service is temporarily unavailable. Try the QR code method instead.';
    }
    
    throw new Error(userMessage);
  }
};

module.exports = { initWhatsApp, sendMessage, sendMessageWithRetry, getStatus, getLatestQr, logoutWhatsApp, requestPairingCode };
