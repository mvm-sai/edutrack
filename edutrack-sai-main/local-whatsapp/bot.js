/**
 * EduTrack WhatsApp Bot — Local Edition
 * 
 * This bot runs on your local machine (or a Raspberry Pi / VPS) and:
 *   1. Connects to WhatsApp via QR code (one-time)
 *   2. Polls the cloud EduTrack server for pending messages
 *   3. Sends the messages via WhatsApp
 *   4. Reports delivery status back to the cloud
 * 
 * Usage:
 *   cd local-whatsapp
 *   npm install
 *   npm start
 * 
 * First run: scan the QR code with your WhatsApp.
 * Subsequent runs: auto-connects using saved session.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ─── Configuration ───────────────────────────────────────────────────────────
const CLOUD_URL  = process.env.CLOUD_URL  || 'https://edutrack-sai-production.up.railway.app';
const BOT_KEY    = process.env.BOT_KEY    || 'edutrack-bot-secret-2024';
const POLL_INTERVAL   = parseInt(process.env.POLL_INTERVAL)   || 30000; // 30 seconds
const WA_DELAY_MIN    = parseInt(process.env.WA_DELAY_MIN)    || 8000;  // 8s min delay
const WA_DELAY_MAX    = parseInt(process.env.WA_DELAY_MAX)    || 15000; // 15s max delay
const WA_MAX_RETRIES  = parseInt(process.env.WA_MAX_RETRIES)  || 2;     // retry failed sends
const WA_RETRY_DELAY  = parseInt(process.env.WA_RETRY_DELAY)  || 5000;  // 5s before retry

// ─── State ───────────────────────────────────────────────────────────────────
let isWhatsAppReady = false;
let messagesSentToday = 0;

// ─── Print banner ────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   🚀 EduTrack WhatsApp Bot — Local Edition          ║');
console.log('╠══════════════════════════════════════════════════════╣');
console.log(`║  Cloud API : ${CLOUD_URL.substring(0, 40).padEnd(40)}║`);
console.log(`║  Poll Rate : Every ${(POLL_INTERVAL / 1000)}s${' '.repeat(33)}║`);
console.log('╚══════════════════════════════════════════════════════╝\n');

// ─── WhatsApp Client ─────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n👉 Open WhatsApp → Settings → Linked Devices → Link a Device\n');
});

client.on('ready', () => {
  isWhatsAppReady = true;
  console.log('✅ WhatsApp is connected and ready!');
  console.log(`📡 Polling ${CLOUD_URL} every ${POLL_INTERVAL / 1000}s for pending messages...\n`);
  startPolling();
});

client.on('authenticated', () => {
  console.log('🔐 Session authenticated (saved for next time)');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
  console.log('💡 Try deleting the .wwebjs_auth folder and scanning again.');
});

client.on('disconnected', (reason) => {
  isWhatsAppReady = false;
  console.log('❌ WhatsApp disconnected:', reason);
  console.log('🔄 Reconnecting in 10 seconds...');
  setTimeout(() => client.initialize(), 10000);
});

// ─── Polling Loop ────────────────────────────────────────────────────────────
let pollTimer = null;

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(checkAndSendMessages, POLL_INTERVAL);
  // Run immediately on start
  checkAndSendMessages();
}

async function checkAndSendMessages() {
  if (!isWhatsAppReady) {
    console.log('⏳ WhatsApp not ready, skipping poll...');
    return;
  }

  try {
    const response = await axios.get(`${CLOUD_URL}/api/whatsapp/pending-messages`, {
      headers: { 'x-bot-key': BOT_KEY },
      timeout: 10000,
    });

    const { count, messages } = response.data;

    if (count === 0) {
      // Silent — no spam in the console
      return;
    }

    console.log(`\n📬 Found ${count} pending message(s). Sending sequentially...`);
    console.log(`⏱️  Delay between messages: ${WA_DELAY_MIN / 1000}s – ${WA_DELAY_MAX / 1000}s (randomized)\n`);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const progress = `[${i + 1}/${messages.length}]`;

      console.log(`${progress} 📨 Sending to ${msg.student_name || msg.phone}...`);
      await sendAndReport(msg, progress);

      // Human-like random delay between messages (skip after last)
      if (i < messages.length - 1) {
        const delayMs = await randomDelay(WA_DELAY_MIN, WA_DELAY_MAX);
        console.log(`${progress} ⏳ Waiting ${(delayMs / 1000).toFixed(1)}s before next message...\n`);
      }
    }

    console.log(`\n✅ Batch complete. Total sent today: ${messagesSentToday}\n`);

  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.log('⚠️  Cannot reach cloud server. Is it running?');
    } else if (error.response?.status === 401) {
      console.log('⚠️  Invalid BOT_KEY! Check your configuration.');
    } else {
      console.log(`⚠️  Poll error: ${error.message}`);
    }
  }
}

async function sendAndReport(msg, progress = '') {
  const { id, phone, message, student_name } = msg;
  let attempts = 0;
  let success = false;
  let lastError = null;

  // Retry loop
  while (attempts <= WA_MAX_RETRIES) {
    attempts++;
    try {
      // Resolve correct chat ID (avoid "No LID for user" errors)
      const numberId = await client.getNumberId(phone);
      if (!numberId) {
        throw new Error(`Phone ${phone} is not registered on WhatsApp.`);
      }
      const chatId = numberId._serialized;
      await client.sendMessage(chatId, message);

      success = true;
      messagesSentToday++;
      console.log(`${progress} ✅ Sent to ${student_name || phone} (attempt ${attempts})`);
      break;
    } catch (error) {
      lastError = error.message;
      if (attempts <= WA_MAX_RETRIES) {
        console.log(`${progress}    🔄 Retry ${attempts}/${WA_MAX_RETRIES} for ${student_name || phone} in ${WA_RETRY_DELAY / 1000}s — ${error.message}`);
        await sleep(WA_RETRY_DELAY);
      }
    }
  }

  // Report result to cloud
  try {
    if (success) {
      await axios.post(`${CLOUD_URL}/api/whatsapp/mark-sent`, {
        messageId: id,
        success: true,
      }, {
        headers: { 'x-bot-key': BOT_KEY },
        timeout: 10000,
      });
    } else {
      console.log(`${progress} ❌ Failed for ${student_name || phone} after ${attempts} attempts: ${lastError}`);
      await axios.post(`${CLOUD_URL}/api/whatsapp/mark-sent`, {
        messageId: id,
        success: false,
        error: lastError,
      }, {
        headers: { 'x-bot-key': BOT_KEY },
        timeout: 10000,
      });
    }
  } catch (reportErr) {
    console.log(`${progress} ⚠️  Could not report to cloud: ${reportErr.message}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await sleep(ms);
  return ms;
}

// ─── Graceful shutdown ───────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (pollTimer) clearInterval(pollTimer);
  if (isWhatsAppReady) {
    await client.destroy();
  }
  process.exit(0);
});

// ─── Start ───────────────────────────────────────────────────────────────────
console.log('🔄 Initializing WhatsApp client...');
client.initialize();
