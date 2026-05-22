const express = require('express');
const router  = express.Router();
const auth      = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const {
  getAllTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} = require('../controllers/teachersController');

// All routes require auth + admin
router.use(auth, adminAuth);

// GET    /api/teachers       — list all staff
router.get('/', getAllTeachers);

// POST   /api/teachers       — create staff member
router.post('/', createTeacher);

// PUT    /api/teachers/:id   — update staff member
router.put('/:id', updateTeacher);

// DELETE /api/teachers/:id   — remove staff member
router.delete('/:id', deleteTeacher);

module.exports = router;
