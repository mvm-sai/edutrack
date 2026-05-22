import { getStudents, getHistory, getWhatsAppStatus, getWhatsAppQR, submitBulkAttendance, getAttendanceReport, logoutWhatsAppAPI, pairWhatsApp } from '../api.js';
import { showToast } from '../components/toast.js';
import { renderPageSpinner, setButtonLoading } from '../components/spinner.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (name) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusBadge = (status) => {
  if (!status) return `<span class="status-badge pending">🕐 Pending</span>`;
  if (status === 'present') return `<span class="status-badge present">✅ Present</span>`;
  return `<span class="status-badge absent">❌ Absent</span>`;
};

const navbarHTML = (teacher, waStatus) => {
  const waClass = waStatus?.isReady ? 'connected' : waStatus?.hasClient ? 'pending' : 'disconnected';
  const waLabel = waStatus?.isReady ? 'WA Connected' : waStatus?.hasClient ? 'WA Scan QR' : 'WA Offline';
  const avt     = initials(teacher.name);
  const isAdmin = teacher.role === 'admin';

  return `
    <nav class="navbar">
      <div class="navbar-brand">
        <span class="brand-icon">🏫</span>
        <span class="brand-name">EduTrack</span>
      </div>
      <div class="navbar-right">
        <div class="wa-badge ${waClass}" id="wa-status-badge" title="${waStatus?.statusMessage || ''}">
          <span class="wa-dot"></span>
          <span>${waLabel}</span>
        </div>
        ${isAdmin ? '<button class="btn-admin-panel" id="admin-panel-btn">👑 Admin Panel</button>' : ''}
        <button class="btn-manage-students" id="manage-students-btn">👨‍🎓 Manage Students</button>
        <div class="teacher-pill">
          <div class="teacher-avatar">${avt}</div>
          <div class="teacher-info">
            <div class="teacher-name">${teacher.name}</div>
            <div class="teacher-role">${isAdmin ? '👑 Admin' : 'Staff'}</div>
          </div>
        </div>
        <button class="btn-logout" id="logout-btn">Logout</button>
      </div>
    </nav>
  `;
};

// ─── Class Filter ─────────────────────────────────────────────────────────────
const classFilterHTML = (grades, selectedGrade) => {
  const options = grades.map(g => {
    const selected = g === selectedGrade ? 'selected' : '';
    return `<option value="${g}" ${selected}>${g}</option>`;
  }).join('');

  return `
    <div class="class-filter-bar">
      <div class="filter-label">
        <span class="filter-icon">📚</span>
        <span>Select Class:</span>
      </div>
      <select id="class-filter" class="class-filter-select">
        <option value="">— Choose a class —</option>
        ${options}
      </select>
      <div class="filter-summary" id="filter-summary"></div>
    </div>
  `;
};

// ─── Bulk Attendance Row per Student ──────────────────────────────────────────
const bulkStudentRow = (student, index) => {
  const avt = initials(student.name);
  const isMarked = !!student.today_status;
  const defaultStatus = student.today_status || 'present'; // Default to present
  const waSentIcon = student.today_whatsapp_sent ? '📱✅' : '';

  return `
    <div class="bulk-student-row" data-student-id="${student.id}" data-index="${index}" style="animation-delay:${index * 0.03}s">
      <div class="bulk-student-info">
        <div class="bulk-avatar">${avt}</div>
        <div class="bulk-name-wrap">
          <span class="bulk-name">${student.name}</span>
          <span class="bulk-phone">📱 +${student.parent_whatsapp}</span>
        </div>
      </div>
      <div class="bulk-status-toggle" data-student-id="${student.id}">
        <button type="button" class="bulk-toggle present ${defaultStatus === 'present' ? 'active' : ''}" data-val="present">
          ✅ Present
        </button>
        <button type="button" class="bulk-toggle absent ${defaultStatus === 'absent' ? 'active' : ''}" data-val="absent">
          ❌ Absent
        </button>
      </div>
      <div class="bulk-row-status">
        ${isMarked ? `<span class="bulk-already-marked">Updated</span>` : ''}
        <span class="bulk-wa-icon">${waSentIcon}</span>
      </div>
    </div>
  `;
};

// ─── History Table ────────────────────────────────────────────────────────────
const historyTableHTML = (records) => {
  if (!records.length) {
    return `
      <div class="table-wrap">
        <table><tbody>
          <tr class="empty-row"><td colspan="7">📭 No attendance records yet. Start marking attendance above!</td></tr>
        </tbody></table>
      </div>
    `;
  }

  const rows = records.map((r) => `
    <tr>
      <td>${formatDate(r.date)}</td>
      <td><strong>${r.student_name}</strong></td>
      <td>${r.student_grade}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.class_taken}">${r.class_taken}</td>
      <td style="font-size:.8rem">${r.whatsapp_sent ? '📱 Sent' : '⚠️ Not sent'}</td>
      <td style="font-size:.8rem;color:var(--text-2)">${r.teacher_name || '—'}</td>
    </tr>
  `).join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Student</th>
            <th>Grade</th>
            <th>Status</th>
            <th>Class Taken</th>
            <th>WhatsApp</th>
            <th>Marked By</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

// ─── State ────────────────────────────────────────────────────────────────────
let currentGradeFilter = '';

// ─── Main render ──────────────────────────────────────────────────────────────
export const renderDashboard = async (navigate) => {
  const app     = document.getElementById('app');
  const teacher = JSON.parse(localStorage.getItem('teacher') || '{}');

  // Loading state
  app.innerHTML = `
    <div class="app-layout">
      ${navbarHTML(teacher, null)}
      <div class="main-content">${renderPageSpinner()}</div>
    </div>
  `;

  // Wire logout immediately
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('teacher');
    showToast('Logged out successfully.', 'info');
    navigate('login');
  });

  // Fetch data in parallel
  let students = [];
  let grades   = [];
  let history  = [];
  let waStatus = null;

  try {
    const gradeParam = currentGradeFilter || undefined;
    [{ students, grades }, { records: history }, waStatus] = await Promise.all([
      getStudents(gradeParam),
      getHistory(),
      getWhatsAppStatus().catch(() => null),
    ]);
  } catch (err) {
    if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
      localStorage.removeItem('token');
      navigate('login');
      return;
    }
    showToast('Failed to load data: ' + err.message, 'error');
  }

  // Show WhatsApp warning if not ready
  if (waStatus && !waStatus.isReady) {
    showToast('⚠️ WhatsApp is not connected. Scan the QR code in the server terminal.', 'warning', 8000);
  }

  // Count stats
  const markedCount  = students.filter(s => s.today_status).length;
  const pendingCount = students.length - markedCount;
  const hasClassSelected = !!currentGradeFilter;

  // Build the bulk attendance section (only shown when a class is selected)
  const bulkSection = hasClassSelected && students.length > 0 ? `
    <div class="bulk-attendance-section">
      <div class="bulk-header">
        <div class="bulk-header-left">
          <h3>📋 Mark Attendance — ${currentGradeFilter}</h3>
          <p>${students.length} students · Enter subject & homework, then mark each student</p>
        </div>
        <div class="bulk-quick-actions">
          <button type="button" class="bulk-action-btn mark-all-present" id="mark-all-present">
            ✅ All Present
          </button>
          <button type="button" class="bulk-action-btn mark-all-absent" id="mark-all-absent">
            ❌ All Absent
          </button>
        </div>
      </div>

      <div class="bulk-form-fields">
        <div class="grid-2">
          <div class="form-group">
            <label for="bulk-class-taken">📚 Subject / Class Taken Today</label>
            <input
              id="bulk-class-taken"
              type="text"
              placeholder="e.g. Chapter 5 – Photosynthesis"
              maxlength="200"
              required
            />
          </div>
          <div class="form-group">
            <label for="bulk-homework">📝 Homework to Submit</label>
            <input
              id="bulk-homework"
              type="text"
              placeholder="e.g. Exercise 5.2, Q 1–10"
              maxlength="300"
              required
            />
          </div>
        </div>
      </div>

      <div class="bulk-students-list" id="bulk-students-list">
        ${students.map((s, i) => bulkStudentRow(s, i)).join('')}
      </div>

      <div class="bulk-submit-bar">
        <div class="bulk-submit-summary" id="bulk-submit-summary">
          <span class="summary-present">✅ <strong id="present-count">${students.length}</strong> Present</span>
          <span class="summary-absent">❌ <strong id="absent-count">0</strong> Absent</span>
        </div>
        <button class="btn-submit bulk-submit-btn" id="bulk-submit-btn" type="button">
          📤 Submit All & Send WhatsApp
        </button>
      </div>

      <div id="bulk-result" style="display:none;"></div>
    </div>
  ` : '';

  const noClassMessage = !hasClassSelected ? `
    <div class="select-class-prompt">
      <div class="prompt-icon">👆</div>
      <h3>Select a Class to Begin</h3>
      <p>Choose a class from the dropdown above to mark attendance for all students at once.</p>
    </div>
  ` : '';

  const noStudentsMessage = hasClassSelected && students.length === 0 ? `
    <div class="select-class-prompt">
      <div class="prompt-icon">📭</div>
      <h3>No Students Found</h3>
      <p>There are no students in <strong>${currentGradeFilter}</strong>.</p>
    </div>
  ` : '';

  // Render full dashboard
  app.innerHTML = `
    <div class="app-layout">
      ${navbarHTML(teacher, waStatus)}
      <div class="main-content">

        <div class="page-header">
          <div>
            <h2>Class Attendance</h2>
            <p>Select a class, mark attendance for all students, and send WhatsApp notifications in one click</p>
          </div>
          <div class="header-badges">
            ${hasClassSelected ? `
              <span class="student-count-badge">👨‍🎓 ${students.length} Student${students.length !== 1 ? 's' : ''}</span>
              <span class="student-count-badge marked">✅ ${markedCount} Marked</span>
              <span class="student-count-badge pending-badge">🕐 ${pendingCount} Pending</span>
            ` : ''}
          </div>
        </div>

        ${classFilterHTML(grades, currentGradeFilter)}

        ${noClassMessage}
        ${noStudentsMessage}
        ${bulkSection}

        <div class="section-title" style="margin-top:40px;">
          <span class="section-icon">📋</span>
          Recent Attendance History
        </div>
        ${historyTableHTML(history)}

        <div class="download-attendance-section">
          <div class="download-header">
            <div class="download-header-left">
              <span class="section-icon">📥</span>
              <div>
                <h3>Download Attendance Report</h3>
                <p>Select a date range to download the attendance sheet as PDF</p>
              </div>
            </div>
          </div>

          <div class="download-controls">
            <div class="download-dates">
              <div class="form-group">
                <label for="report-from">📅 From Date</label>
                <input id="report-from" type="date" class="date-input" />
              </div>
              <div class="form-group">
                <label for="report-to">📅 To Date</label>
                <input id="report-to" type="date" class="date-input" />
              </div>
            </div>

            <div class="download-presets">
              <button type="button" class="preset-btn" id="preset-this-week">📅 This Week</button>
              <button type="button" class="preset-btn" id="preset-last-week">📅 Last Week</button>
              <button type="button" class="preset-btn" id="preset-this-month">📅 This Month</button>
              <button type="button" class="preset-btn" id="preset-last-month">📅 Last Month</button>
            </div>

            <button class="btn-download-pdf" id="download-pdf-btn" type="button">
              📥 Download PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  // ─── Wire events ────────────────────────────────────────────────────────────

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('teacher');
    showToast('Logged out successfully.', 'info');
    navigate('login');
  });

  // Manage Students
  document.getElementById('manage-students-btn')?.addEventListener('click', () => {
    navigate('students');
  });

  // Admin Panel (admin only)
  document.getElementById('admin-panel-btn')?.addEventListener('click', () => {
    navigate('admin');
  });

  // Class filter dropdown
  document.getElementById('class-filter')?.addEventListener('change', (e) => {
    currentGradeFilter = e.target.value;
    renderDashboard(navigate); // re-render with new filter
  });

  // WA badge click → open QR modal
  document.getElementById('wa-status-badge')?.addEventListener('click', () => {
    openWhatsAppQRModal(navigate);
  });

  // ─── Bulk attendance wiring (only if class selected) ───────────────────────
  if (hasClassSelected && students.length > 0) {

    // Track statuses: default all to present
    const statuses = {};
    students.forEach(s => {
      statuses[s.id] = s.today_status || 'present';
    });

    const updateCounts = () => {
      const presentCount = Object.values(statuses).filter(s => s === 'present').length;
      const absentCount  = Object.values(statuses).filter(s => s === 'absent').length;
      const el1 = document.getElementById('present-count');
      const el2 = document.getElementById('absent-count');
      if (el1) el1.textContent = presentCount;
      if (el2) el2.textContent = absentCount;
    };

    // Per-student toggle click
    document.getElementById('bulk-students-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.bulk-toggle');
      if (!btn) return;
      const row = btn.closest('.bulk-status-toggle');
      const studentId = row.dataset.studentId;
      const val = btn.dataset.val;

      statuses[studentId] = val;

      // Update active state for this row
      row.querySelectorAll('.bulk-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateCounts();
    });

    // Mark all present
    document.getElementById('mark-all-present')?.addEventListener('click', () => {
      Object.keys(statuses).forEach(id => statuses[id] = 'present');
      document.querySelectorAll('.bulk-toggle.present').forEach(b => b.classList.add('active'));
      document.querySelectorAll('.bulk-toggle.absent').forEach(b => b.classList.remove('active'));
      updateCounts();
      showToast('All students marked as Present ✅', 'success', 2000);
    });

    // Mark all absent
    document.getElementById('mark-all-absent')?.addEventListener('click', () => {
      Object.keys(statuses).forEach(id => statuses[id] = 'absent');
      document.querySelectorAll('.bulk-toggle.absent').forEach(b => b.classList.add('active'));
      document.querySelectorAll('.bulk-toggle.present').forEach(b => b.classList.remove('active'));
      updateCounts();
      showToast('All students marked as Absent ❌', 'info', 2000);
    });

    // Submit bulk
    document.getElementById('bulk-submit-btn')?.addEventListener('click', async () => {
      const classTaken = document.getElementById('bulk-class-taken')?.value.trim();
      const homework   = document.getElementById('bulk-homework')?.value.trim();

      if (!classTaken || classTaken.length < 2) {
        showToast('Please enter the subject / class taken today.', 'warning');
        document.getElementById('bulk-class-taken')?.focus();
        return;
      }
      if (!homework || homework.length < 2) {
        showToast('Please enter homework details.', 'warning');
        document.getElementById('bulk-homework')?.focus();
        return;
      }

      const records = Object.entries(statuses).map(([student_id, status]) => ({
        student_id: parseInt(student_id),
        status,
      }));

      const submitBtn = document.getElementById('bulk-submit-btn');
      const restore   = setButtonLoading(submitBtn, 'Submitting & Sending WhatsApp...');
      const resultBox = document.getElementById('bulk-result');
      resultBox.style.display = 'none';

      try {
        const result = await submitBulkAttendance({
          records,
          class_taken: classTaken,
          homework,
        });

        const isFullSuccess = result.whatsapp_failed === 0;
        const resultClass   = isFullSuccess ? 'success' : 'warning';

        // Build per-student result rows
        const detailRows = result.results.map(r => `
          <div class="bulk-result-row ${r.whatsapp_sent ? 'sent' : 'failed'}">
            <span class="bulk-result-name">${r.student_name}</span>
            <span class="bulk-result-status">${r.status === 'present' ? '✅' : '❌'}</span>
            <span class="bulk-result-wa">${r.whatsapp_sent ? '📱 Sent' : '⚠️ Failed'}</span>
          </div>
        `).join('');

        resultBox.innerHTML = `
          <div class="submit-result ${resultClass}">
            <span class="result-icon">${isFullSuccess ? '🎉' : '⚠️'}</span>
            <div class="result-msg">
              <strong>${result.feedback}</strong>
              <div class="bulk-result-details">${detailRows}</div>
            </div>
          </div>
        `;
        resultBox.style.display = 'block';
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

        showToast(result.feedback, isFullSuccess ? 'success' : 'warning', 6000);

        // Refresh dashboard after 5 seconds
        setTimeout(() => renderDashboard(navigate), 5000);
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
        resultBox.innerHTML = `
          <div class="submit-result error">
            <span class="result-icon">❌</span>
            <div class="result-msg">
              <strong>Submission failed</strong>
              <span>${err.message}</span>
            </div>
          </div>
        `;
        resultBox.style.display = 'block';
      } finally {
        restore();
      }
    });
  }

  // ─── Download Attendance PDF ─────────────────────────────────────────────────

  // Set default date range to this week
  const setThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const fromEl = document.getElementById('report-from');
    const toEl   = document.getElementById('report-to');
    if (fromEl) fromEl.value = monday.toISOString().split('T')[0];
    if (toEl)   toEl.value   = now.toISOString().split('T')[0];
  };
  setThisWeek(); // default

  document.getElementById('preset-this-week')?.addEventListener('click', setThisWeek);

  document.getElementById('preset-last-week')?.addEventListener('click', () => {
    const now = new Date();
    const day = now.getDay();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    document.getElementById('report-from').value = lastMonday.toISOString().split('T')[0];
    document.getElementById('report-to').value   = lastSunday.toISOString().split('T')[0];
  });

  document.getElementById('preset-this-month')?.addEventListener('click', () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('report-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('report-to').value   = now.toISOString().split('T')[0];
  });

  document.getElementById('preset-last-month')?.addEventListener('click', () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth(), 0);
    document.getElementById('report-from').value = firstDay.toISOString().split('T')[0];
    document.getElementById('report-to').value   = lastDay.toISOString().split('T')[0];
  });

  document.getElementById('download-pdf-btn')?.addEventListener('click', async () => {
    const from = document.getElementById('report-from')?.value;
    const to   = document.getElementById('report-to')?.value;

    if (!from || !to) {
      showToast('Please select both From and To dates.', 'warning');
      return;
    }
    if (from > to) {
      showToast('From date must be before To date.', 'warning');
      return;
    }

    const btn = document.getElementById('download-pdf-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-sm"></span> Generating PDF...';
    btn.disabled = true;

    try {
      const data = await getAttendanceReport(from, to, currentGradeFilter || undefined);

      if (!data.report || data.report.length === 0) {
        showToast('No attendance data found for the selected date range.', 'warning');
        return;
      }

      generateAttendancePDF(data, from, to, teacher);
      showToast(`✅ PDF downloaded! ${data.total_students} students, ${data.working_days} working days.`, 'success');
    } catch (err) {
      showToast('Failed to generate report: ' + err.message, 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
};
// ─── PDF Generation ───────────────────────────────────────────────────────────
const generateAttendancePDF = (data, from, to, teacher) => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('portrait', 'mm', 'a4');

  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header
  doc.setFillColor(7, 7, 26);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(122, 108, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('EduTrack', 14, 18);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Attendance Report', 14, 28);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated by ${teacher.name || 'Staff'} on ${new Date().toLocaleDateString('en-IN')}`, 14, 35);

  // ── Date range info
  const fromFormatted = new Date(from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const toFormatted   = new Date(to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  doc.setTextColor(122, 108, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Period: ${fromFormatted}  —  ${toFormatted}`, pageWidth - 14, 18, { align: 'right' });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Working Days: ${data.working_days}  |  Students: ${data.total_students}`, pageWidth - 14, 26, { align: 'right' });

  if (data.grade_filter && data.grade_filter !== 'All') {
    doc.text(`Class: ${data.grade_filter}`, pageWidth - 14, 33, { align: 'right' });
  }

  // ── Table
  const tableData = data.report.map(r => [
    r.sno,
    r.name,
    r.grade,
    r.working_days,
    r.present,
    `${r.percentage}%`,
  ]);

  doc.autoTable({
    startY: 48,
    head: [['S.No', 'Student Name', 'Class & Board', 'Working Days', 'Present', 'Percentage']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [122, 108, 255],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 30, 30],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'left', cellWidth: 52 },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 26 },
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    didParseCell: function(hookData) {
      // Color-code percentage column
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const pct = parseInt(hookData.cell.raw);
        if (pct >= 90) {
          hookData.cell.styles.textColor = [22, 163, 74];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (pct >= 75) {
          hookData.cell.styles.textColor = [202, 138, 4];
          hookData.cell.styles.fontStyle = 'bold';
        } else {
          hookData.cell.styles.textColor = [220, 38, 38];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`EduTrack Attendance Report  •  ${fromFormatted} to ${toFormatted}`, 14, pageH - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageH - 8, { align: 'right' });
  }

  // ── Download
  const gradeSlug = data.grade_filter && data.grade_filter !== 'All'
    ? `_${data.grade_filter.replace(/\s+/g, '-')}`
    : '';
  const filename = `EduTrack_Attendance${gradeSlug}_${from}_to_${to}.pdf`;
  doc.save(filename);
};

// ─── WhatsApp Link Modal ──────────────────────────────────────────────────────
let qrRefreshInterval = null;

const openWhatsAppQRModal = async (navigate) => {
  // Remove any existing modal
  document.getElementById('wa-qr-overlay')?.remove();
  if (qrRefreshInterval) clearInterval(qrRefreshInterval);

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'wa-qr-overlay';
  overlay.className = 'wa-qr-overlay';
  overlay.innerHTML = `
    <div class="wa-qr-modal">
      <div class="wa-qr-header">
        <div class="wa-qr-header-left">
          <span class="wa-qr-header-icon">📱</span>
          <h3>Link WhatsApp</h3>
        </div>
        <button class="wa-qr-close" id="wa-qr-close-btn">✕</button>
      </div>

      <div class="wa-link-tabs">
        <button class="wa-tab" id="wa-tab-qr" type="button">📷 Scan QR Code</button>
        <button class="wa-tab active" id="wa-tab-phone" type="button">📞 Link with Phone Number</button>
      </div>

      <div class="wa-qr-body" id="wa-qr-body">
        <div class="wa-qr-initializing">
          <div class="loader-ring"></div>
          <p class="wa-qr-status-msg">Checking connection...</p>
        </div>
      </div>

      <div class="wa-qr-footer">
        <div class="wa-qr-refresh-indicator">
          <span class="refresh-dot"></span>
          <span>Auto-checks connection every 5s</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  // Close handlers
  const closeModal = () => {
    if (qrRefreshInterval) { clearInterval(qrRefreshInterval); qrRefreshInterval = null; }
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 300);
  };

  document.getElementById('wa-qr-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // ── Tab state
  let activeTab = 'phone'; // Default to phone pairing

  const renderQRTab = async () => {
    const body = document.getElementById('wa-qr-body');
    if (!body) return;

    try {
      const data = await getWhatsAppQR();

      if (data.status === 'qr_ready' && data.qr) {
        body.innerHTML = `
          <div class="wa-qr-image-wrap">
            <img src="${data.qr}" alt="WhatsApp QR Code" />
          </div>
          <p class="wa-qr-status-msg">${data.message}</p>
          <ul class="wa-qr-steps">
            <li><span class="step-num">1</span> Open WhatsApp on your phone</li>
            <li><span class="step-num">2</span> Tap <strong>Settings → Linked Devices</strong></li>
            <li><span class="step-num">3</span> Tap <strong>Link a Device</strong></li>
            <li><span class="step-num">4</span> Point your camera at this QR code</li>
          </ul>
        `;
      } else {
        body.innerHTML = `
          <div class="wa-qr-initializing">
            <div class="loader-ring"></div>
            <p class="wa-qr-status-msg">${data.message || 'Waiting for QR code...'}</p>
          </div>
        `;
      }
    } catch (err) {
      body.innerHTML = `
        <div style="font-size:2rem; margin-bottom:8px;">⚠️</div>
        <p class="wa-qr-status-msg error">Failed to load QR code. Is the server running?</p>
      `;
    }
  };

  const renderPhoneTab = () => {
    const body = document.getElementById('wa-qr-body');
    if (!body) return;

    body.innerHTML = `
      <div class="wa-phone-pair">
        <div class="wa-phone-icon" style="font-size:3rem; margin-bottom:12px;">📞</div>
        <p class="wa-qr-status-msg" style="margin-bottom:16px;">Enter the WhatsApp phone number to link</p>
        <div class="wa-phone-input-group">
          <input
            type="tel"
            id="wa-phone-input"
            class="wa-phone-input"
            placeholder="e.g. 919876543210"
            maxlength="15"
            style="width:100%; padding:12px 16px; border-radius:10px; border:1px solid rgba(122,108,255,0.3); background:rgba(255,255,255,0.05); color:#e9edef; font-size:1.1rem; text-align:center; letter-spacing:2px; outline:none;"
          />
          <p style="font-size:0.75rem; color:#8696a0; margin-top:6px;">Format: country code + number (no + or spaces)</p>
        </div>
        <button type="button" id="wa-pair-btn" class="btn-submit" style="margin-top:16px; width:100%; padding:12px; border-radius:10px; font-size:1rem;">
          🔗 Get Pairing Code
        </button>
        <div id="wa-pair-result" style="margin-top:16px; display:none;"></div>
        <ul class="wa-qr-steps" style="margin-top:20px;">
          <li><span class="step-num">1</span> Enter the phone number above & click "Get Pairing Code"</li>
          <li><span class="step-num">2</span> Open WhatsApp → <strong>Settings → Linked Devices</strong></li>
          <li><span class="step-num">3</span> Tap <strong>Link a Device</strong></li>
          <li><span class="step-num">4</span> Tap <strong>"Link with phone number instead"</strong></li>
          <li><span class="step-num">5</span> Enter the <strong>8-digit code</strong> shown here</li>
        </ul>
      </div>
    `;

    // Wire pair button
    document.getElementById('wa-pair-btn')?.addEventListener('click', async () => {
      const phoneInput = document.getElementById('wa-phone-input');
      const phone = phoneInput?.value.trim().replace(/[^0-9]/g, '');
      const resultDiv = document.getElementById('wa-pair-result');

      if (!phone || phone.length < 10) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p style="color:#ff6b6b; font-size:0.9rem;">⚠️ Enter a valid phone number (e.g. 919876543210)</p>';
        return;
      }

      const btn = document.getElementById('wa-pair-btn');
      btn.innerHTML = '<span class="spinner-sm"></span> Requesting code...';
      btn.disabled = true;

      try {
        const result = await pairWhatsApp(phone);
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background:rgba(37,211,102,0.1); border:1px solid rgba(37,211,102,0.3); border-radius:12px; padding:20px; text-align:center;">
            <p style="color:#25D366; font-size:0.9rem; margin-bottom:8px;">✅ Pairing code generated!</p>
            <div style="font-size:2.5rem; font-weight:bold; letter-spacing:8px; color:#fff; font-family:monospace; padding:12px;">
              ${result.pairingCode}
            </div>
            <p style="color:#8696a0; font-size:0.8rem; margin-top:8px;">Enter this code in WhatsApp → Linked Devices → Link with phone number</p>
            <p style="color:#ff9800; font-size:0.75rem; margin-top:6px;">⏳ Code expires in ~60 seconds</p>
          </div>
        `;
      } catch (err) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `<p style="color:#ff6b6b; font-size:0.9rem;">❌ ${err.message}</p>`;
      } finally {
        btn.innerHTML = '🔗 Get Pairing Code';
        btn.disabled = false;
      }
    });
  };

  const renderConnected = () => {
    const body = document.getElementById('wa-qr-body');
    if (!body) return;

    body.innerHTML = `
      <div style="font-size:3rem; margin-bottom:8px;">✅</div>
      <p class="wa-qr-status-msg connected">WhatsApp is connected and ready!</p>
      <button class="btn-wa-logout" id="wa-logout-btn" type="button">
        🔓 Logout WhatsApp
      </button>
    `;
    if (qrRefreshInterval) { clearInterval(qrRefreshInterval); qrRefreshInterval = null; }

    document.getElementById('wa-logout-btn')?.addEventListener('click', () => {
      openWhatsAppLogoutConfirm(closeModal, navigate);
    });
  };

  // ── Check connection status periodically
  const checkConnection = async () => {
    try {
      const status = await getWhatsAppStatus();
      if (status.isReady) {
        renderConnected();
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };

  // ── Render active tab content
  const renderActiveTab = async () => {
    const connected = await checkConnection();
    if (connected) return;
    if (activeTab === 'qr') {
      await renderQRTab();
    } else {
      renderPhoneTab();
    }
  };

  // ── Tab switching
  document.getElementById('wa-tab-qr')?.addEventListener('click', () => {
    activeTab = 'qr';
    document.getElementById('wa-tab-qr').classList.add('active');
    document.getElementById('wa-tab-phone').classList.remove('active');
    renderActiveTab();
  });

  document.getElementById('wa-tab-phone')?.addEventListener('click', () => {
    activeTab = 'phone';
    document.getElementById('wa-tab-phone').classList.add('active');
    document.getElementById('wa-tab-qr').classList.remove('active');
    renderActiveTab();
  });

  // Initial render
  await renderActiveTab();

  // Auto-check connection every 5 seconds
  qrRefreshInterval = setInterval(async () => {
    const connected = await checkConnection();
    if (connected) return;
    // Only refresh QR tab automatically
    if (activeTab === 'qr') {
      await renderQRTab();
    }
  }, 5000);
};

// ─── WhatsApp Logout Confirmation ─────────────────────────────────────────────
const openWhatsAppLogoutConfirm = (closeQrModal, navigate) => {
  // Remove any existing logout overlay
  document.getElementById('wa-logout-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'wa-logout-overlay';
  overlay.className = 'sm-modal-overlay';
  overlay.innerHTML = `
    <div class="sm-modal sm-modal-sm">
      <div class="sm-modal-header sm-modal-header-danger">
        <h3>🔓 Logout WhatsApp</h3>
        <button class="sm-modal-close" id="wa-logout-close">&times;</button>
      </div>
      <div class="sm-modal-body">
        <p class="sm-delete-msg">
          Are you sure you want to <strong>logout WhatsApp</strong>?
        </p>
        <div class="sm-delete-warning">
          <span>⚠️</span>
          <span>This will disconnect the current WhatsApp session. You'll need to scan a new QR code to reconnect. Pending messages will not be sent until reconnected.</span>
        </div>
      </div>
      <div class="sm-modal-footer">
        <button type="button" class="sm-btn-cancel" id="wa-logout-cancel">Cancel</button>
        <button type="button" class="sm-btn-danger" id="wa-logout-confirm">🔓 Logout WhatsApp</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  const closeLogoutModal = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 250);
  };

  document.getElementById('wa-logout-close')?.addEventListener('click', closeLogoutModal);
  document.getElementById('wa-logout-cancel')?.addEventListener('click', closeLogoutModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLogoutModal();
  });

  document.getElementById('wa-logout-confirm')?.addEventListener('click', async () => {
    const btn = document.getElementById('wa-logout-confirm');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-sm"></span> Logging out...';
    btn.disabled = true;

    try {
      const result = await logoutWhatsAppAPI();
      showToast(result.message || 'WhatsApp session logged out!', 'success', 5000);
      closeLogoutModal();

      // Close QR modal too
      if (closeQrModal) closeQrModal();

      // Refresh dashboard after a short delay to show updated status
      setTimeout(() => {
        if (navigate) navigate('dashboard');
      }, 1500);
    } catch (err) {
      showToast('Logout failed: ' + err.message, 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
};
