/**
 * Production-ready server.js with security, monitoring, and anti-ban protection
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
let db;
let whatsappClient;

// ─────────────────────────────────────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────────────────────────────────────

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.',
});

const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Rate limit exceeded for attendance operations.',
});

const whatsappLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute
  message: 'Too many WhatsApp requests, please try again later.',
});

// CORS Configuration
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
    if (origin?.endsWith('.vercel.app')) return callback(null, true);
    
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    // In production, be more strict
    if (NODE_ENV === 'production') {
      callback(new Error('Not allowed by CORS'));
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Request Logging
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.get('x-request-id') || Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  console.log(`[${timestamp}] ${req.method} ${req.url} [${requestId}]`);
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check Endpoint (before database dependency)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    uptime: parseFloat(uptime.toFixed(2)),
    timestamp: new Date().toISOString(),
    database: db?.ready ? 'connected' : 'connecting',
    whatsapp: whatsappClient ? 'initialized' : 'initializing',
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
    },
    environment: NODE_ENV,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Initialize Application
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log('⏳ Initializing EduTrack Backend...');

    // ─ Initialize Database ───────────────────────────────────────────────────
    console.log(`📦 Using ${process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'} database...`);
    
    if (process.env.DATABASE_URL) {
      // Production: PostgreSQL
      const { initDatabase } = require('./src/db/database-postgresql');
      db = await initDatabase();
    } else {
      // Development: SQLite
      const { initDatabase } = require('./src/db/database');
      db = await initDatabase();
    }

    // ─ Initialize WhatsApp Client ────────────────────────────────────────────
    console.log('📱 Initializing WhatsApp client...');
    const { initWhatsApp } = require('./src/whatsapp/client');
    initWhatsApp();
    whatsappClient = true;

    // ─────────────────────────────────────────────────────────────────────────
    // API Routes
    // ─────────────────────────────────────────────────────────────────────────

    app.use('/api/auth', authLimiter, require('./src/routes/auth'));
    app.use('/api/teachers', require('./src/routes/teachers'));
    app.use('/api/students', require('./src/routes/students'));
    app.use('/api/attendance', attendanceLimiter, require('./src/routes/attendance'));
    app.use('/api/whatsapp', whatsappLimiter, require('./src/routes/whatsapp'));

    // ─────────────────────────────────────────────────────────────────────────
    // 404 Handler
    // ─────────────────────────────────────────────────────────────────────────
    app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Global Error Handler
    // ─────────────────────────────────────────────────────────────────────────
    app.use((err, req, res, next) => {
      console.error(`❌ Error [${req.requestId}]:`, err.message);
      
      const statusCode = err.statusCode || err.status || 500;
      const isDev = NODE_ENV === 'development';
      
      res.status(statusCode).json({
        error: err.message || 'Internal Server Error',
        ...(isDev && { stack: err.stack }),
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Start Server
    // ─────────────────────────────────────────────────────────────────────────
    app.listen(PORT, () => {
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║   🏫  EduTrack — Teacher Attendance & WhatsApp App      ║');
      console.log(`║   🚀  Running on: http://0.0.0.0:${PORT}                         ║`);
      console.log(`║   🌍  Environment: ${NODE_ENV.toUpperCase()}                               ║`);
      console.log('║   📊  API Status: /api/health                             ║');
      console.log('╚══════════════════════════════════════════════════════════╝\n');

      // Log API routes
      console.log('📋 Available API Routes:');
      console.log('   POST /api/auth/login');
      console.log('   GET  /api/auth/me');
      console.log('   GET  /api/students');
      console.log('   POST /api/students');
      console.log('   POST /api/attendance/submit');
      console.log('   GET  /api/whatsapp/status');
      console.log('   GET  /api/health\n');
    });

  } catch (err) {
    console.error('❌ Initialization failed:', err.message);
    process.exit(1);
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────────────────────────

process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM received, shutting down gracefully...');
  
  try {
    if (db) {
      // Close database connection
      if (typeof db.close === 'function') {
        await db.close();
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

module.exports = app;
