-- EduTrack PostgreSQL Schema Migration
-- Run this in Supabase SQL Editor or with: psql $DATABASE_URL < migrations/001-initial.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- TEACHERS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teachers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) DEFAULT 'teacher',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teachers_email ON teachers(email);
CREATE INDEX idx_teachers_created_at ON teachers(created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- STUDENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  grade            VARCHAR(50) NOT NULL,
  roll_number      VARCHAR(50),
  parent_name      VARCHAR(255),
  parent_whatsapp  VARCHAR(20) NOT NULL,
  teacher_id       INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_teacher_id ON students(teacher_id);
CREATE INDEX idx_students_created_at ON students(created_at);
CREATE INDEX idx_students_grade ON students(grade);

-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id              SERIAL PRIMARY KEY,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id      INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  status          VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent')),
  class_taken     VARCHAR(255) NOT NULL,
  homework        TEXT,
  whatsapp_sent   BOOLEAN DEFAULT FALSE,
  whatsapp_error  TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, date)
);

CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_teacher_id ON attendance(teacher_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_created_at ON attendance(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP QUEUE TABLE (for message queueing & retry logic)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id              SERIAL PRIMARY KEY,
  phone           VARCHAR(20) NOT NULL,
  message         TEXT NOT NULL,
  student_name    VARCHAR(255),
  attendance_id   INTEGER REFERENCES attendance(id) ON DELETE SET NULL,
  sent            BOOLEAN DEFAULT FALSE,
  attempts        INTEGER DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMP
);

CREATE INDEX idx_whatsapp_queue_sent ON whatsapp_queue(sent);
CREATE INDEX idx_whatsapp_queue_created_at ON whatsapp_queue(created_at DESC);
CREATE INDEX idx_whatsapp_queue_phone ON whatsapp_queue(phone);

-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP SESSIONS TABLE (for persistent session management)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id              SERIAL PRIMARY KEY,
  session_name    VARCHAR(255) UNIQUE NOT NULL,
  session_data    JSONB,
  is_active       BOOLEAN DEFAULT TRUE,
  last_connected  TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUTO-CLEANUP TRIGGER (delete old queue items after 7 days)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS void AS $$
BEGIN
  DELETE FROM whatsapp_queue 
  WHERE sent = TRUE 
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Run cleanup daily at midnight
-- (Note: Koyeb will need a scheduled task job, or use a background worker)

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA (optional - for testing)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO teachers (name, email, password_hash, role)
VALUES (
  'Tamil Teacher',
  'tamil@dream.com',
  '$2a$10$JJ9hc/PnvtCyHYXfg8EiJ.Xs6c6k/8R2Z0L.7mL8jvL8jvL8j', -- hash of "password123"
  'teacher'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO students (name, grade, roll_number, parent_name, parent_whatsapp, teacher_id)
VALUES 
  ('Raj Kumar', '10A', '001', 'Raj S.', '919876543210', 1),
  ('Priya Singh', '10A', '002', 'Priya S.', '919876543211', 1),
  ('Amit Patel', '10A', '003', 'Amit P.', '919876543212', 1)
ON CONFLICT DO NOTHING;
