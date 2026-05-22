const path = require('path');
const qrcode = require('qrcode-terminal');

let whatsappClient = null;
let isReady = false;
let isInitializing = false;
let latestQr = null;

const initWhatsApp = () => {
  if (isInitializing || whatsappClient) return;
  isInitializing = true;

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

  // ✅ FIXED: Works both LOCAL (Windows) + RENDER (Docker)
  const puppeteerOpts = {
    headless: true,
    args: puppeteerArgs,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  };

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
    console.error('❌ Init error:', err.message);
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

// ─────────────────────────────────────────────

module.exports = {
  initWhatsApp,
  sendMessage,
  getStatus,
  getLatestQr,
};