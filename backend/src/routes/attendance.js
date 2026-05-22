const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { submitAttendance, submitBulkAttendance, getHistory, getStudentHistory, getAttendanceReport } = require('../controllers/attendanceController');

// POST /api/attendance/submit            — mark/update attendance + send WhatsApp
router.post('/submit', auth, submitAttendance);

// POST /api/attendance/submit-bulk       — bulk mark attendance for a whole class
router.post('/submit-bulk', auth, submitBulkAttendance);

// GET  /api/attendance/history           — recent attendance for this teacher
router.get('/history', auth, getHistory);

// GET  /api/attendance/report            — aggregated attendance report (for PDF)
router.get('/report', auth, getAttendanceReport);

// GET  /api/attendance/student/:studentId — per-student attendance history
router.get('/student/:studentId', auth, getStudentHistory);

module.exports = router;

