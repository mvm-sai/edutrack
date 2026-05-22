require('dotenv').config();

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const { initDatabase }  = require('./src/db/database');

const app  = express();
const PORT = process.env.PORT || 3001;

// Prevent Chrome/Puppeteer crashes from killing the server
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled rejection (server continues):', reason?.message || reason);
});

// Wrap everything in async so we can await database init
(async () => {

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app domain
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true); // In production, tighten this to your specific domain
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Request logger (dev-friendly) ───────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/teachers',   require('./src/routes/teachers'));
app.use('/api/students',   require('./src/routes/students'));
app.use('/api/attendance', require('./src/routes/attendance'));
app.use('/api/whatsapp',   require('./src/routes/whatsapp'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), port: PORT });
});

// ─── Serve frontend in production ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));

  // SPA catch-all: any non-API route serves index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── 404 handler (API routes only in production) ──────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error. Please try again.' });
});

  // ─── Init database (async WASM load) ──────────────────────────────────────
  console.log('⏳ Initializing database...');
  await initDatabase();
  console.log('✅ Database ready.\n');

  // ─── Start server ─────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log(`║   🏫  Teacher Attendance & WhatsApp App — Backend         ║`);
    console.log(`║   🚀  Running on: http://localhost:${PORT}                  ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('📋 API Routes:');
    console.log('   POST /api/auth/login');
    console.log('   GET  /api/auth/me');
    console.log('   GET  /api/students');
    console.log('   GET  /api/students/:id');
    console.log('   POST /api/students');
    console.log('   PUT  /api/students/:id');
    console.log('   DEL  /api/students/:id');
    console.log('   POST /api/attendance/submit');
    console.log('   GET  /api/attendance/history');
    console.log('   GET  /api/attendance/student/:id');
    console.log('   GET  /api/whatsapp/status');
    console.log('   GET  /api/whatsapp/status');
    console.log('');
  });

})().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
