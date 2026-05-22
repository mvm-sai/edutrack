/**
 * database-sqlite.js — Pure WASM SQLite using sql.js
 *
 * This module is used in local development and in environments without
 * DATABASE_URL configured.
 */

const path = require('path');
const fs   = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE  = path.join(DATA_DIR, 'attendance.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Internal state ───────────────────────────────────────────────────────────
let _SQL = null; // sql.js module
let _db  = null; // sql.js Database instance

function makeStmt(sql) {
  return {
    get(...params) {
      if (!_db) throw new Error('Database not initialized');
      const stmt = _db.prepare(sql);
      const args = flatten(params);
      if (args.length) stmt.bind(args);
      const ok  = stmt.step();
      const row = ok ? toObj(stmt) : undefined;
      stmt.free();
      return row;
    },

    all(...params) {
      if (!_db) throw new Error('Database not initialized');
      const stmt = _db.prepare(sql);
      const args = flatten(params);
      if (args.length) stmt.bind(args);
      const rows = [];
      while (stmt.step()) rows.push(toObj(stmt));
      stmt.free();
      return rows;
    },

    run(...params) {
      if (!_db) throw new Error('Database not initialized');
      const stmt = _db.prepare(sql);
      const args = flatten(params);
      if (args.length) stmt.bind(args);
      stmt.step();
      stmt.free();
      const changes   = _db.getRowsModified();
      const lastIdRes = _db.exec('SELECT last_insert_rowid()');
      const lastId    = lastIdRes[0]?.values[0]?.[0] ?? 0;
      save();
      return { changes, lastInsertRowid: lastId };
    },
  };
}

function flatten(params) {
  if (!params.length) return [];
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function toObj(stmt) {
  const cols = stmt.getColumnNames();
  const vals = stmt.get();
  const obj  = {};
  cols.forEach((c, i) => { obj[c] = vals[i]; });
  return obj;
}

function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

const db = {
  prepare: (sql) => makeStmt(sql),

  exec(sql) {
    if (!_db) throw new Error('Database not initialized');
    _db.run(sql);
    save();
    return this;
  },

  pragma(str) {
    try { if (_db) _db.run(`PRAGMA ${str}`); } catch (_) {}
    return this;
  },

  get ready() { return !!_db; },
};

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS teachers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    DEFAULT 'teacher',
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    grade            TEXT    NOT NULL,
    roll_number      TEXT,
    parent_name      TEXT,
    parent_whatsapp  TEXT    NOT NULL,
    teacher_id       INTEGER NOT NULL,
    created_at       TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    teacher_id      INTEGER NOT NULL,
    date            TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    class_taken     TEXT    NOT NULL,
    homework        TEXT    NOT NULL,
    whatsapp_sent   INTEGER DEFAULT 0,
    whatsapp_error  TEXT,
    created_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS whatsapp_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phone           TEXT    NOT NULL,
    message         TEXT    NOT NULL,
    student_name    TEXT,
    attendance_id   INTEGER,
    sent            INTEGER DEFAULT 0,
    attempts        INTEGER DEFAULT 0,
    error           TEXT,
    created_at      TEXT    DEFAULT (datetime('now')),
    sent_at         TEXT
  );
`;

const initDatabase = async () => {
  if (_db) return db;

  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    _db = new _SQL.Database(fileBuffer);
    console.log(`📦 Database loaded from ${DB_FILE}`);
  } else {
    _db = new _SQL.Database();
    console.log(`📦 New database created at ${DB_FILE}`);
  }

  _db.run(SCHEMA);

  try {
    _db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date
        ON attendance(student_id, date)
    `);
  } catch (_) {}

  const colCheck = (table, col) => {
    try {
      const info = _db.exec(`PRAGMA table_info(${table})`);
      if (info.length) {
        const cols = info[0].values.map(row => row[1]);
        return cols.includes(col);
      }
    } catch (_) {}
    return false;
  };

  if (!colCheck('students', 'roll_number')) {
    try { _db.run('ALTER TABLE students ADD COLUMN roll_number TEXT'); console.log('📐 Migration: added roll_number column'); } catch (_) {}
  }
  if (!colCheck('students', 'parent_name')) {
    try { _db.run('ALTER TABLE students ADD COLUMN parent_name TEXT'); console.log('📐 Migration: added parent_name column'); } catch (_) {}
  }
  if (!colCheck('teachers', 'role')) {
    try { _db.run("ALTER TABLE teachers ADD COLUMN role TEXT DEFAULT 'teacher'"); console.log('📐 Migration: added role column to teachers'); } catch (_) {}
  }

  try {
    _db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_teacher_roll
        ON students(teacher_id, roll_number)
        WHERE roll_number IS NOT NULL AND roll_number != ''
    `);
  } catch (_) {}

  save();
  return db;
};

module.exports = { db, initDatabase };
