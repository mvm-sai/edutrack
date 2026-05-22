const { db } = require('../db/database');

// GET /api/students  — returns ALL students (shared pool) + today's attendance status
// Supports ?grade=... query param for class filtering
const getMyStudents = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const gradeFilter = req.query.grade;

  let sql = `
    SELECT
      s.id,
      s.name,
      s.grade,
      s.roll_number,
      s.parent_name,
      s.parent_whatsapp,
      s.teacher_id,
      a.status          AS today_status,
      a.class_taken     AS today_class,
      a.homework        AS today_homework,
      a.whatsapp_sent   AS today_whatsapp_sent,
      a.created_at      AS today_marked_at
    FROM students s
    LEFT JOIN attendance a
      ON  a.student_id = s.id
      AND a.date       = ?
  `;

  const params = [today];

  if (gradeFilter) {
    sql += ' WHERE s.grade = ?';
    params.push(gradeFilter);
  }

  sql += ' ORDER BY s.grade ASC, s.name ASC';

  const students = await db.prepare(sql).all(...params);

  // Get unique grades for filter dropdown
  const grades = (await db.prepare(
    'SELECT DISTINCT grade FROM students ORDER BY grade ASC'
  ).all()).map(r => r.grade);

  res.json({ students, date: today, grades });
};

// GET /api/students/:id  — single student (any staff can view)
const getStudent = async (req, res) => {
  const student = await db.prepare(`
    SELECT id, name, grade, roll_number, parent_name, parent_whatsapp, teacher_id
    FROM   students
    WHERE  id = ?
  `).get(req.params.id);

  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  // Include recent attendance for this student
  const recentAttendance = await db.prepare(`
    SELECT date, status, class_taken, homework, whatsapp_sent, created_at
    FROM   attendance
    WHERE  student_id = ?
    ORDER  BY date DESC
    LIMIT  10
  `).all(student.id);

  res.json({ student, recentAttendance });
};

// ─── POST /api/students ─────────────────────────────────────────────────────
const createStudent = async (req, res) => {
  const { name, grade, roll_number, parent_name, parent_whatsapp } = req.body;
  const teacherId = req.teacher.id;

  // ── Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Student name is required.' });
  }
  if (!grade || !grade.trim()) {
    return res.status(400).json({ error: 'Class/Grade is required.' });
  }
  if (!parent_whatsapp || !parent_whatsapp.trim()) {
    return res.status(400).json({ error: 'Parent WhatsApp number is required.' });
  }
  if (!parent_name || !parent_name.trim()) {
    return res.status(400).json({ error: 'Parent name is required.' });
  }

  // Sanitize WhatsApp number — digits only
  const cleanPhone = parent_whatsapp.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid WhatsApp number (at least 10 digits).' });
  }

  // Check duplicate roll_number for this teacher
  if (roll_number && roll_number.trim()) {
    const duplicate = await db.prepare(
      'SELECT id FROM students WHERE teacher_id = ? AND roll_number = ?'
    ).get(teacherId, roll_number.trim());

    if (duplicate) {
      return res.status(409).json({ error: `Roll number "${roll_number.trim()}" already exists for your students.` });
    }
  }

  // ── Insert
  const result = await db.prepare(`
    INSERT INTO students (name, grade, roll_number, parent_name, parent_whatsapp, teacher_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    grade.trim(),
    roll_number?.trim() || null,
    parent_name.trim(),
    cleanPhone,
    teacherId
  );

  const newStudent = await db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);

  console.log(`➕ Student created: ${name.trim()} (${grade.trim()}) by teacher #${teacherId}`);

  res.status(201).json({
    success: true,
    message: `Student "${name.trim()}" added successfully!`,
    student: newStudent,
  });
};

// ─── PUT /api/students/:id ──────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const teacherId = req.teacher.id;
  const { name, grade, roll_number, parent_name, parent_whatsapp } = req.body;

  // ── Find student
  const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  // ── Ownership check (admins can edit any student)
  if (student.teacher_id !== teacherId && req.teacher.role !== 'admin') {
    return res.status(403).json({ error: 'You can only edit your own students.' });
  }

  // ── Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Student name is required.' });
  }
  if (!grade || !grade.trim()) {
    return res.status(400).json({ error: 'Class/Grade is required.' });
  }
  if (!parent_whatsapp || !parent_whatsapp.trim()) {
    return res.status(400).json({ error: 'Parent WhatsApp number is required.' });
  }
  if (!parent_name || !parent_name.trim()) {
    return res.status(400).json({ error: 'Parent name is required.' });
  }

  const cleanPhone = parent_whatsapp.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid WhatsApp number (at least 10 digits).' });
  }

  // Check duplicate roll_number (exclude current student)
  if (roll_number && roll_number.trim()) {
    const duplicate = await db.prepare(
      'SELECT id FROM students WHERE teacher_id = ? AND roll_number = ? AND id != ?'
    ).get(teacherId, roll_number.trim(), parseInt(id));

    if (duplicate) {
      return res.status(409).json({ error: `Roll number "${roll_number.trim()}" already exists for another student.` });
    }
  }

  // ── Update
  await db.prepare(`
    UPDATE students
    SET name = ?, grade = ?, roll_number = ?, parent_name = ?, parent_whatsapp = ?
    WHERE id = ?
  `).run(
    name.trim(),
    grade.trim(),
    roll_number?.trim() || null,
    parent_name.trim(),
    cleanPhone,
    parseInt(id)
  );

  const updated = await db.prepare('SELECT * FROM students WHERE id = ?').get(parseInt(id));

  console.log(`✏️ Student updated: ${name.trim()} (#${id}) by teacher #${teacherId}`);

  res.json({
    success: true,
    message: `Student "${name.trim()}" updated successfully!`,
    student: updated,
  });
};

// ─── DELETE /api/students/:id ───────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  const { id } = req.params;
  const teacherId = req.teacher.id;

  // ── Find student
  const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(parseInt(id));
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  // ── Ownership check (admins can delete any student)
  if (student.teacher_id !== teacherId && req.teacher.role !== 'admin') {
    return res.status(403).json({ error: 'You can only delete your own students.' });
  }

  // ── Count related attendance records
  const attCount = await db.prepare(
    'SELECT COUNT(*) as count FROM attendance WHERE student_id = ?'
  ).get(parseInt(id));

  // ── Delete attendance records first
  await db.prepare('DELETE FROM attendance WHERE student_id = ?').run(parseInt(id));

  // ── Delete student
  await db.prepare('DELETE FROM students WHERE id = ?').run(parseInt(id));

  console.log(`🗑️ Student deleted: ${student.name} (#${id}) + ${attCount.count} attendance records by teacher #${teacherId}`);

  res.json({
    success: true,
    message: `Student "${student.name}" and ${attCount.count} attendance record(s) deleted.`,
    deletedAttendanceCount: attCount.count,
  });
};

module.exports = { getMyStudents, getStudent, createStudent, updateStudent, deleteStudent };
