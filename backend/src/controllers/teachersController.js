const bcrypt = require('bcryptjs');
const { db } = require('../db/database');

// ─── GET /api/teachers — list all staff (admin only) ─────────────────────────
const getAllTeachers = async (req, res) => {
  const teachers = await db.prepare(`
    SELECT id, name, email, role, created_at
    FROM   teachers
    ORDER  BY id ASC
  `).all();

  res.json({ teachers });
};

// ─── POST /api/teachers — create a new staff member (admin only) ─────────────
const createTeacher = async (req, res) => {
  const { name, email, password, role } = req.body;

  // ── Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Staff name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const staffRole = (role === 'admin') ? 'admin' : 'teacher';

  // Check duplicate email
  const existing = await db.prepare('SELECT id FROM teachers WHERE email = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: `A staff member with email "${cleanEmail}" already exists.` });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await db.prepare(
    'INSERT INTO teachers (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), cleanEmail, hash, staffRole);

  const newTeacher = await db.prepare('SELECT id, name, email, role, created_at FROM teachers WHERE id = ?')
    .get(result.lastInsertRowid);

  console.log(`➕ Staff created by admin: ${name.trim()} (${cleanEmail}) | Role: ${staffRole}`);

  res.status(201).json({
    success: true,
    message: `Staff "${name.trim()}" added successfully!`,
    teacher: newTeacher,
  });
};

// ─── PUT /api/teachers/:id — update staff member (admin only) ────────────────
const updateTeacher = async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role } = req.body;

  const teacher = await db.prepare('SELECT * FROM teachers WHERE id = ?').get(parseInt(id));
  if (!teacher) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  // ── Validation
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Staff name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const staffRole = (role === 'admin') ? 'admin' : 'teacher';

  // Prevent admin from demoting themselves
  if (parseInt(id) === req.teacher.id && staffRole !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin privileges.' });
  }

  // Check duplicate email (exclude current teacher)
  const duplicate = await db.prepare('SELECT id FROM teachers WHERE email = ? AND id != ?')
    .get(cleanEmail, parseInt(id));
  if (duplicate) {
    return res.status(409).json({ error: `Email "${cleanEmail}" is already in use by another staff member.` });
  }

  // Update with or without password change
  if (password && password.length >= 6) {
    const hash = bcrypt.hashSync(password, 10);
    await db.prepare(`
      UPDATE teachers SET name = ?, email = ?, password_hash = ?, role = ? WHERE id = ?
    `).run(name.trim(), cleanEmail, hash, staffRole, parseInt(id));
  } else {
    await db.prepare(`
      UPDATE teachers SET name = ?, email = ?, role = ? WHERE id = ?
    `).run(name.trim(), cleanEmail, staffRole, parseInt(id));
  }

  const updated = await db.prepare('SELECT id, name, email, role, created_at FROM teachers WHERE id = ?')
    .get(parseInt(id));

  console.log(`✏️ Staff updated by admin: ${name.trim()} (#${id}) | Role: ${staffRole}`);

  res.json({
    success: true,
    message: `Staff "${name.trim()}" updated successfully!`,
    teacher: updated,
  });
};

// ─── DELETE /api/teachers/:id — remove staff member (admin only) ─────────────
const deleteTeacher = async (req, res) => {
  const { id } = req.params;

  const teacher = await db.prepare('SELECT * FROM teachers WHERE id = ?').get(parseInt(id));
  if (!teacher) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  // Prevent admin from deleting themselves
  if (parseInt(id) === req.teacher.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  // Count associated data
  const studentCount = await db.prepare('SELECT COUNT(*) as count FROM students WHERE teacher_id = ?')
    .get(parseInt(id));

  // Reassign students to the current admin before deleting
  if (studentCount.count > 0) {
    await db.prepare('UPDATE students SET teacher_id = ? WHERE teacher_id = ?')
      .run(req.teacher.id, parseInt(id));
    console.log(`📦 Reassigned ${studentCount.count} students from teacher #${id} to admin #${req.teacher.id}`);
  }

  // Delete the teacher
  await db.prepare('DELETE FROM teachers WHERE id = ?').run(parseInt(id));

  console.log(`🗑️ Staff deleted by admin: ${teacher.name} (#${id})`);

  res.json({
    success: true,
    message: `Staff "${teacher.name}" has been removed. ${studentCount.count} student(s) were reassigned to you.`,
    reassignedStudents: studentCount.count,
  });
};

module.exports = { getAllTeachers, createTeacher, updateTeacher, deleteTeacher };
