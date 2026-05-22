/**
 * database.js — Smart database router
 * 
 * When DATABASE_URL is set (production), uses PostgreSQL.
 * Otherwise (local dev), uses sql.js SQLite (WASM, works everywhere).
 */

// Log which database engine will be used
console.log(`🔍 DATABASE_URL is ${process.env.DATABASE_URL ? 'SET → PostgreSQL mode' : 'NOT SET → SQLite mode'}`);

if (process.env.DATABASE_URL) {
  // Production: re-export PostgreSQL module
  module.exports = require('./database-postgresql');
} else {
  // Local development / fallback: use sql.js SQLite (WASM)
  module.exports = require('./database-sqlite');
}