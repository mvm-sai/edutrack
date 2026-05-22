const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  getMyStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentsController');

// GET /api/students      — all students (shared pool) + today's status
router.get('/', auth, getMyStudents);

// GET /api/students/:id  — single student detail
router.get('/:id', auth, getStudent);

// POST /api/students     — create a new student
router.post('/', auth, createStudent);

// PUT /api/students/:id  — update student details
router.put('/:id', auth, updateStudent);

// DELETE /api/students/:id — delete student + attendance records
router.delete('/:id', auth, deleteStudent);

module.exports = router;
