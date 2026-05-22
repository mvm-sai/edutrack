/**
 * database.js (PostgreSQL version for production)
 * 
 * Replaces sql.js with PostgreSQL via pg client.
 * Uses connection pooling for better performance.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Force IPv4 — Render free tier doesn't support IPv6 outbound
dns.setDefaultResultOrder('ipv4first');

// ─── Configuration ────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/edutrack';

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20, // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});

// ─── Error handling ───────────────────────────────────────────────────────────
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

process.on('SIGTERM', () => {
  pool.end(() => {
    console.log('pool ended');
    process.exit(0);
  });
});

// ─── Database Interface ───────────────────────────────────────────────────────
const db = {
  /**
   * Prepare and execute a query with parameters
   * Usage: db.prepare('SELECT * FROM teachers WHERE email = ?').get(email)
   */
  prepare: (sql) => ({
    async get(...params) {
      try {
        const client = await pool.connect();
        try {
          // Convert ? placeholders to $1, $2, etc.
          const { query, values } = convertPlaceholders(sql, params);
          const result = await client.query(query, values);
          return result.rows[0] || undefined;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
      }
    },

    async all(...params) {
      try {
        const client = await pool.connect();
        try {
          const { query, values } = convertPlaceholders(sql, params);
          const result = await client.query(query, values);
          return result.rows;
        } finally {
          client.release();
        }
      } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
      }
    },

    async run(...params) {
      try {
        const client = await pool.connect();
        try {
          const { query, values } = convertPlaceholders(sql, params);
          const result = await client.query(query, values);
          
          // Try to get last insert ID
          let lastInsertRowid = 0;
          if (query.toLowerCase().includes('insert')) {
            const idResult = await client.query("SELECT lastval() as id");
            lastInsertRowid = idResult.rows[0]?.id || 0;
          }
          
          return {
            changes: result.rowCount,
            lastInsertRowid,
          };
        } finally {
          client.release();
        }
      } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
      }
    },
  }),

  async exec(sql) {
    try {
      const client = await pool.connect();
      try {
        await client.query(sql);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Database exec error:', err.message);
      throw err;
    }
    return this;
  },

  pragma() {
    return this; // No-op for compatibility
  },

  /** Check if database is ready */
  get ready() {
    return !!pool;
  },
};

// ─── Helper: Convert ? placeholders to PostgreSQL $1, $2 format ────────────────
function convertPlaceholders(sql, params) {
  const flatParams = params.length === 1 && Array.isArray(params[0]) 
    ? params[0] 
    : params;

  let paramIndex = 1;
  let query = sql.replace(/\?/g, () => `$${paramIndex++}`);

  return { query, values: flatParams };
}

// ─── Initialize Database ──────────────────────────────────────────────────────
const initDatabase = async () => {
  try {
    console.log('⏳ Connecting to PostgreSQL...');
    
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected at', result.rows[0].now);
    client.release();

    // Run migrations if needed
    await runMigrations();

    console.log('✅ Database ready.');
    return db;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
};

// ─── Run Migrations ───────────────────────────────────────────────────────────
async function runMigrations() {
  try {
    const migrationsPath = path.join(__dirname, '../migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsPath)) {
      console.log('ℹ️  No migrations directory found. Skipping migrations.');
      return;
    }

    const files = fs.readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsPath, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      console.log(`📐 Running migration: ${file}`);
      await db.exec(sql);
    }
  } catch (err) {
    // Migrations may fail if already applied, that's okay
    console.log('ℹ️  Migration check complete');
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { db, initDatabase, pool };
