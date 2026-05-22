const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

let whatsappClient = null;
let isReady = false;
let isInitializing = false;
let latestQr = null;

// Find Chrome/Chromium binary across different environments
function findChromePath() {
  const candidates = [
    // Render Docker (installed via apt-get)
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Environment variable override
    process.env.PUPPETEER_EXECUTABLE_PATH,
    // Common Linux paths
    '/usr/lib/chromium/chromium',
    '/snap/bin/chromium',
    // Windows (local dev)
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        console.log(`🔍 Found Chrome at: ${p}`);
        return p;
      }
    } catch {}
  }

  // Fallback: let Puppeteer find it automatically
  console.log('⚠️  No Chrome found at known paths, letting Puppeteer auto-detect');
  return undefined;
}

const initWhatsApp = () => {
  if (isInitializing || whatsappClient) return;
  isInitializing = true;

  const { Client, LocalAuth } = require('whatsapp-web.js');

  const chromePath = findChromePath();
  console.log(`🌐 Using Chrome at: ${chromePath || 'auto-detect'}`);

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

  // Only set executablePath if we found one — otherwise let Puppeteer auto-detect
  if (chromePath) {
    puppeteerOpts.executablePath = chromePath;
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(process.cwd(), '.wwebjs_auth'),
    }),
    puppeteer: puppeteerOpts,
  });

  // ── EVENTS ─────────────────────────────────────
  client.on('qr', (qr) => {
    latestQr = qr;

    console.log('\n📱 SCAN THIS QR:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    isReady = true;
    latestQr = null;
    console.log('✅ WhatsApp READY');
  });

  client.on('authenticated', () => {
    console.log('🔐 Authenticated');
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
    whatsappClient = null;
    isInitializing = false;
    setTimeout(initWhatsApp, 30000);
  });

  client.on('disconnected', async () => {
    console.log('⚠️ Disconnected');
    isReady = false;

    try {
      await client.destroy();
    } catch {}

    whatsappClient = null;
    isInitializing = false;
    setTimeout(initWhatsApp, 10000);
  });

  client.initialize().catch((err) => {
    console.error('❌ WhatsApp init error:', err.message);
    whatsappClient = null;
    isInitializing = false;
    setTimeout(initWhatsApp, 30000);
  });

  whatsappClient = client;
};

// ─────────────────────────────────────────────

const sendMessage = async (phone, message) => {
  if (!whatsappClient || !isReady) {
    throw new Error('WhatsApp not ready');
  }

  const numberId = await whatsappClient.getNumberId(phone);
  if (!numberId) throw new Error('Number not on WhatsApp');

  await whatsappClient.sendMessage(numberId._serialized, message);
};

const getStatus = () => ({
  isReady,
  hasClient: !!whatsappClient,
  isInitializing,
});

const getLatestQr = () => latestQr;

const logoutWhatsApp = async () => {
  if (!whatsappClient) {
    return { success: true, message: 'No active WhatsApp session.' };
  }
  try {
    await whatsappClient.logout();
    await whatsappClient.destroy();
  } catch {}
  whatsappClient = null;
  isReady = false;
  isInitializing = false;
  latestQr = null;
  return { success: true, message: 'WhatsApp session ended.' };
};

const requestPairingCode = async (phoneNumber) => {
  if (!whatsappClient) {
    throw new Error('WhatsApp client is not initialized. Please wait.');
  }
  const code = await whatsappClient.requestPairingCode(phoneNumber);
  return { success: true, pairingCode: code };
};

// ─────────────────────────────────────────────

module.exports = {
  initWhatsApp,
  sendMessage,
  getStatus,
  getLatestQr,
  logoutWhatsApp,
  requestPairingCode,
};