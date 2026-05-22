const { db } = require('../db/database');
const { sendMessageWithRetry, getStatus } = require('../whatsapp/client');
const { randomDelay, WA_DELAY_MIN, WA_DELAY_MAX, WA_RETRY_DELAY, WA_MAX_RETRIES } = require('../utils/delay');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const buildMessage = (studentName, status, classTaken, homework) => {
  if (status === 'present') {
    return (
      `Dear Parent,\n\n` +
      `✅ ${studentName} attended class today.\n\n` +
      `📚 Class Taken: ${classTaken}\n` +
      `📝 Homework: ${homework}\n\n` +
      `Thank you.`
    );
  }
  return (
    `Dear Parent,\n\n` +
    `⚠️ ${studentName} was absent today.\n\n` +
    `📚 Class Taken: ${classTaken}\n` +
    `📝 Homework: ${homework}\n\n` +
    `Please ensure your child completes and submits the homework tomorrow.\n\n` +
    `Thank you.`
  );
};

// ─── POST /api/attendance/submit ─────────────────────────────────────────────
const submitAttendance = async (req, res) => {
  const { student_id, status, class_taken, homework } = req.body;

  // ── Validation
  if (!student_id || !status || !class_taken || !homework) {
    return res.status(400).json({ error: 'All fields are required: student_id, status, class_taken, homework.' });
  }
  if (!['present', 'absent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "present" or "absent".' });
  }
  if (class_taken.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter a valid class description.' });
  }
  if (homework.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter valid homework details.' });
  }

  // ── Verify student exists (any staff can mark attendance for any student)
  const student = await db.prepare(`
    SELECT * FROM students WHERE id = ?
  `).get(student_id);

  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const today = new Date().toISOString().split('T')[0];

  // ── Check if already submitted today (for upsert)
  const existingRecord = await db.prepare(
    'SELECT id FROM attendance WHERE student_id = ? AND date = ?'
  ).get(student_id, today);

  // ── Build WhatsApp message
  const message = buildMessage(student.name, status, class_taken.trim(), homework.trim());

  // ── Attempt WhatsApp send (with retry)
  let whatsapp_sent  = 0;
  let whatsapp_error = null;

  console.log(`\n📤 Sending WhatsApp to ${student.name}'s parent (${student.parent_whatsapp})...`);
  const result = await sendMessageWithRetry(student.parent_whatsapp, message, {
    maxRetries: WA_MAX_RETRIES,
    retryDelay: WA_RETRY_DELAY,
  });

  if (result.success) {
    whatsapp_sent = 1;
    console.log(`✅ WhatsApp sent → ${student.name}'s parent (attempt ${result.attempts})`);
  } else {
    whatsapp_error = result.error;
    console.warn(`⚠️  WhatsApp failed for ${student.name} after ${result.attempts} attempts: ${result.error}`);
  }

  // ── Save to database (upsert by student_id + date)
  if (existingRecord) {
    await db.prepare(`
      UPDATE attendance
      SET status = ?, class_taken = ?, homework = ?,
          whatsapp_sent = ?, whatsapp_error = ?, teacher_id = ?
      WHERE student_id = ? AND date = ?
    `).run(status, class_taken.trim(), homework.trim(), whatsapp_sent, whatsapp_error, req.teacher.id, student_id, today);
  } else {
    await db.prepare(`
      INSERT INTO attendance (student_id, teacher_id, date, status, class_taken, homework, whatsapp_sent, whatsapp_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(student_id, req.teacher.id, today, status, class_taken.trim(), homework.trim(), whatsapp_sent, whatsapp_error);
  }

  const isUpdate = !!existingRecord;

  res.json({
    success:         true,
    updated:         isUpdate,
    student:         student.name,
    status,
    whatsapp_sent:   whatsapp_sent === 1,
    whatsapp_error,
    message_preview: message,
    feedback:        whatsapp_sent === 1
      ? `✅ Attendance ${isUpdate ? 'updated' : 'marked'} and WhatsApp message sent to ${student.name}'s parent!`
      : `📋 Attendance ${isUpdate ? 'updated' : 'marked'}. WhatsApp message could not be sent: ${whatsapp_error}`,
  });
};

// ─── POST /api/attendance/submit-bulk ────────────────────────────────────────
const submitBulkAttendance = async (req, res) => {
  const { records, class_taken, homework } = req.body;

  // ── Validation
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records array is required and must not be empty.' });
  }
  if (!class_taken || class_taken.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter a valid class description.' });
  }
  if (!homework || homework.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter valid homework details.' });
  }

  const today = new Date().toISOString().split('T')[0];
  const results = [];
  const totalCount = records.length;

  console.log('\n' + '='.repeat(60));
  console.log(`📨 BULK ATTENDANCE — ${totalCount} students`);
  console.log(`📅 Date: ${today}  |  📚 Class: ${class_taken.trim()}`);
  console.log('='.repeat(60));

  // ── Save ALL attendance records to DB first (fast, synchronous)
  for (const rec of records) {
    const { student_id, status } = rec;

    if (!student_id || !['present', 'absent'].includes(status)) {
      results.push({ student_id, success: false, error: 'Invalid student_id or status.', whatsapp_sent: false });
      continue;
    }

    const student = await db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
    if (!student) {
      results.push({ student_id, success: false, error: 'Student not found.', whatsapp_sent: false });
      continue;
    }

    const existingRecord = await db.prepare(
      'SELECT id FROM attendance WHERE student_id = ? AND date = ?'
    ).get(student_id, today);

    // Save attendance immediately (don't wait for WhatsApp)
    if (existingRecord) {
      await db.prepare(`
        UPDATE attendance
        SET status = ?, class_taken = ?, homework = ?,
            whatsapp_sent = 0, whatsapp_error = NULL, teacher_id = ?
        WHERE student_id = ? AND date = ?
      `).run(status, class_taken.trim(), homework.trim(), req.teacher.id, student_id, today);
    } else {
      await db.prepare(`
        INSERT INTO attendance (student_id, teacher_id, date, status, class_taken, homework, whatsapp_sent, whatsapp_error)
        VALUES (?, ?, ?, ?, ?, ?, 0, NULL)
      `).run(student_id, req.teacher.id, today, status, class_taken.trim(), homework.trim());
    }

    results.push({
      student_id,
      student_name: student.name,
      student_phone: student.parent_whatsapp,
      status,
      success: true,
      updated: !!existingRecord,
      whatsapp_sent: false,
      whatsapp_error: null,
      message: buildMessage(student.name, status, class_taken.trim(), homework.trim()),
    });
  }

  // ── Respond immediately (attendance is saved, WhatsApp sends in background)
  const totalSuccess = results.filter(r => r.success).length;

  res.json({
    success: true,
    total: results.length,
    saved: totalSuccess,
    whatsapp_sent: 0,
    whatsapp_failed: 0,
    whatsapp_status: 'sending',
    results: results.map(r => ({
      student_id: r.student_id,
      student_name: r.student_name,
      status: r.status,
      success: r.success,
      updated: r.updated,
      whatsapp_sent: false,
      whatsapp_error: r.error || null,
    })),
    feedback: `✅ Attendance saved for ${totalSuccess} students. WhatsApp messages are being sent in the background...`,
  });

  // ── Send WhatsApp messages SEQUENTIALLY in the background with human-like delays
  const successRecords = results.filter(r => r.success);
  let waSent   = 0;
  let waFailed = 0;

  console.log(`\n📤 Starting sequential WhatsApp delivery for ${successRecords.length} students...`);
  console.log(`⏱️  Delay between messages: ${WA_DELAY_MIN / 1000}s – ${WA_DELAY_MAX / 1000}s (randomized)\n`);

  for (let i = 0; i < successRecords.length; i++) {
    const rec = successRecords[i];
    const progress = `[${i + 1}/${successRecords.length}]`;

    console.log(`${progress} 📨 Sending to ${rec.student_name} (${rec.student_phone})...`);

    const sendResult = await sendMessageWithRetry(rec.student_phone, rec.message, {
      maxRetries: WA_MAX_RETRIES,
      retryDelay: WA_RETRY_DELAY,
    });

    if (sendResult.success) {
      waSent++;
      console.log(`${progress} ✅ Sent to ${rec.student_name} (attempt ${sendResult.attempts})`);

      // Update DB: mark as sent
      await db.prepare(`
        UPDATE attendance SET whatsapp_sent = 1, whatsapp_error = NULL
        WHERE student_id = ? AND date = ?
      `).run(rec.student_id, today);
    } else {
      waFailed++;
      console.log(`${progress} ❌ Failed for ${rec.student_name} after ${sendResult.attempts} attempts: ${sendResult.error}`);

      // Update DB: record error
      await db.prepare(`
        UPDATE attendance SET whatsapp_sent = 0, whatsapp_error = ?
        WHERE student_id = ? AND date = ?
      `).run(sendResult.error, rec.student_id, today);
    }

    // ── Add random delay before next message (skip after last one)
    if (i < successRecords.length - 1) {
      const delayMs = await randomDelay(WA_DELAY_MIN, WA_DELAY_MAX);
      console.log(`${progress} ⏳ Waiting ${(delayMs / 1000).toFixed(1)}s before next message...\n`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`🏁 BULK DELIVERY COMPLETE`);
  console.log(`   ✅ Sent: ${waSent}  |  ❌ Failed: ${waFailed}  |  Total: ${successRecords.length}`);
  console.log('='.repeat(60) + '\n');
};

// ─── GET /api/attendance/history ──────────────────────────────────────────────
const getHistory = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  const records = await db.prepare(`
    SELECT
      a.id, a.date, a.status, a.class_taken, a.homework,
      a.whatsapp_sent, a.whatsapp_error, a.created_at,
      s.name AS student_name, s.grade AS student_grade,
      t.name AS teacher_name
    FROM   attendance a
    JOIN   students   s ON a.student_id = s.id
    JOIN   teachers   t ON a.teacher_id = t.id
    ORDER  BY a.created_at DESC
    LIMIT  ?
  `).all(limit);

  res.json({ records });
};

// ─── GET /api/attendance/student/:studentId ───────────────────────────────────
const getStudentHistory = async (req, res) => {
  const { studentId } = req.params;

  const student = await db.prepare(
    'SELECT id, name, grade FROM students WHERE id = ?'
  ).get(studentId);

  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const records = await db.prepare(`
    SELECT date, status, class_taken, homework, whatsapp_sent, whatsapp_error, created_at
    FROM   attendance
    WHERE  student_id = ?
    ORDER  BY date DESC
    LIMIT  30
  `).all(studentId);

  // Attendance summary counts
  const summary = await db.prepare(`
    SELECT
      COUNT(*)                                  AS total,
      SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent_count
    FROM attendance
    WHERE student_id = ?
  `).get(studentId);

  res.json({ student, records, summary });
};

// ─── GET /api/attendance/report?from=YYYY-MM-DD&to=YYYY-MM-DD ────────────────
// Returns aggregated attendance data per student for PDF download
const getAttendanceReport = async (req, res) => {
  const { from, to, grade } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Both "from" and "to" date parameters are required (YYYY-MM-DD).' });
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
  }

  if (from > to) {
    return res.status(400).json({ error: '"from" date must be before or equal to "to" date.' });
  }

  // Count working days (distinct dates with at least one attendance record in range)
  const workingDaysResult = await db.prepare(`
    SELECT COUNT(DISTINCT date) AS working_days
    FROM   attendance
    WHERE  date BETWEEN ? AND ?
  `).get(from, to);

  const workingDays = workingDaysResult?.working_days || 0;

  // Build student filter
  let studentFilter = '';
  const params = [from, to];

  if (grade) {
    studentFilter = ' AND s.grade = ?';
    params.push(grade);
  }

  // Get per-student aggregated data
  const students = await db.prepare(`
    SELECT
      s.id,
      s.name,
      s.grade,
      COUNT(a.id)                                          AS total_records,
      SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END) AS absent_count
    FROM students s
    LEFT JOIN attendance a
      ON  a.student_id = s.id
      AND a.date BETWEEN ? AND ?
    WHERE 1=1 ${studentFilter}
    GROUP BY s.id, s.name, s.grade
    ORDER BY s.grade ASC, s.name ASC
  `).all(...params);

  // Calculate percentage for each student
  const report = students.map((s, index) => ({
    sno:          index + 1,
    name:         s.name,
    grade:        s.grade,
    working_days: workingDays,
    present:      s.present_count || 0,
    absent:       s.absent_count || 0,
    percentage:   workingDays > 0
      ? Math.round(((s.present_count || 0) / workingDays) * 100)
      : 0,
  }));

  res.json({
    from,
    to,
    working_days: workingDays,
    total_students: report.length,
    grade_filter: grade || 'All',
    report,
  });
};

module.exports = { submitAttendance, submitBulkAttendance, getHistory, getStudentHistory, getAttendanceReport };
