const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { db } = require('../db/database');

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const teacher = await db.prepare('SELECT * FROM teachers WHERE email = ?').get(email.toLowerCase().trim());
  if (!teacher) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isValid = bcrypt.compareSync(password, teacher.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign(
    { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role || 'teacher' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  console.log(`🔐 Teacher logged in: ${teacher.name} (${teacher.email})`);

  res.json({
    token,
    teacher: { id: teacher.id, name: teacher.name, email: teacher.email, role: teacher.role || 'teacher' },
  });
};

// GET /api/auth/me  (protected)
const me = async (req, res) => {
  const teacher = await db.prepare('SELECT id, name, email, role FROM teachers WHERE id = ?').get(req.teacher.id);
  if (!teacher) {
    return res.status(404).json({ error: 'Teacher account not found.' });
  }
  res.json({ teacher });
};

module.exports = { login, me };
