import { getStudent, submitAttendance } from '../api.js';
import { showToast } from '../components/toast.js';
import { setButtonLoading, renderPageSpinner } from '../components/spinner.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (name) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const buildPreview = (studentName, status, classTaken, homework) => {
  if (!status) return 'Select Present or Absent to see the message preview.';
  if (status === 'present') {
    return (
      `Dear Parent,\n\n` +
      `✅ ${studentName} attended class today.\n\n` +
      `📚 Class Taken: ${classTaken || '[class details]'}\n` +
      `📝 Homework: ${homework || '[homework details]'}\n\n` +
      `Thank you.`
    );
  }
  return (
    `Dear Parent,\n\n` +
    `⚠️ ${studentName} was absent today.\n\n` +
    `📚 Class Taken: ${classTaken || '[class details]'}\n` +
    `📝 Homework: ${homework || '[homework details]'}\n\n` +
    `Please ensure your child completes and submits the homework tomorrow.\n\n` +
    `Thank you.`
  );
};

// ─── Main render ──────────────────────────────────────────────────────────────
export const renderAttendance = async (navigate, params = {}) => {
  const app       = document.getElementById('app');
  const { studentId } = params;

  if (!studentId) {
    navigate('dashboard');
    return;
  }

  // Loading
  app.innerHTML = `
    <div class="app-layout">
      <nav class="navbar">
        <div class="navbar-brand">
          <span class="brand-icon">🏫</span>
          <span class="brand-name">EduTrack</span>
        </div>
        <div class="navbar-right">
          <button class="btn-logout" id="nav-back-btn">← Dashboard</button>
        </div>
      </nav>
      <div class="main-content">${renderPageSpinner()}</div>
    </div>
  `;
  document.getElementById('nav-back-btn')?.addEventListener('click', () => navigate('dashboard'));

  // Fetch student details
  let student, recentAttendance;
  try {
    const data    = await getStudent(studentId);
    student       = data.student;
    recentAttendance = data.recentAttendance || [];
  } catch (err) {
    showToast('Could not load student: ' + err.message, 'error');
    navigate('dashboard');
    return;
  }

  const avt = initials(student.name);

  // Build recent history rows
  const historyRows = recentAttendance.length
    ? recentAttendance.slice(0, 5).map((r) => `
        <tr>
          <td>${r.date}</td>
          <td>${r.status === 'present'
            ? '<span class="status-badge present">✅ Present</span>'
            : '<span class="status-badge absent">❌ Absent</span>'}</td>
          <td style="font-size:.82rem;color:var(--text-2)">${r.class_taken}</td>
          <td style="font-size:.8rem">${r.whatsapp_sent ? '📱 Sent' : '—'}</td>
        </tr>
      `).join('')
    : `<tr class="empty-row"><td colspan="4">No history yet.</td></tr>`;

  // Render full page
  app.innerHTML = `
    <div class="app-layout">
      <nav class="navbar">
        <div class="navbar-brand">
          <span class="brand-icon">🏫</span>
          <span class="brand-name">EduTrack</span>
        </div>
        <div class="navbar-right">
          <button class="btn-logout" id="nav-back-btn">← Dashboard</button>
        </div>
      </nav>

      <div class="main-content attendance-page">

        <button class="back-btn" id="back-btn">← Back to Dashboard</button>

        <!-- Student header -->
        <div class="student-header-card">
          <div class="student-avatar-lg">${avt}</div>
          <div class="student-header-info">
            <h2>${student.name}</h2>
            <p>📚 ${student.grade} &nbsp;|&nbsp; 📱 +${student.parent_whatsapp}</p>
          </div>
        </div>

        <!-- Attendance form -->
        <div class="form-card">
          <h3>📅 Mark Attendance for Today</h3>

          <!-- Present / Absent toggle -->
          <div class="attendance-toggle" id="toggle-group">
            <button class="toggle-btn present" data-val="present" type="button">
              <span class="toggle-emoji">✅</span> Present
            </button>
            <button class="toggle-btn absent" data-val="absent" type="button">
              <span class="toggle-emoji">❌</span> Absent
            </button>
          </div>

          <form class="att-form" id="att-form" novalidate>
            <div class="grid-2">
              <div class="form-group">
                <label for="class-taken">📚 Class Taken Today</label>
                <input
                  id="class-taken"
                  type="text"
                  placeholder="e.g. Chapter 5 – Photosynthesis"
                  maxlength="200"
                  required
                />
              </div>
              <div class="form-group">
                <label for="homework">📝 Homework to Submit</label>
                <input
                  id="homework"
                  type="text"
                  placeholder="e.g. Exercise 5.2, Q 1–10"
                  maxlength="300"
                  required
                />
              </div>
            </div>

            <!-- Live WhatsApp message preview -->
            <div class="form-group mt-8">
              <label>📱 WhatsApp Message Preview</label>
              <div class="message-preview">
                <p id="msg-preview">Select Present or Absent to see the message preview.</p>
              </div>
            </div>

            <button class="btn-submit" id="submit-btn" type="submit" disabled>
              📤 Submit Attendance
            </button>
          </form>

          <div id="submit-result" style="display:none;"></div>
        </div>

        <!-- Recent history -->
        <div class="section-title">
          <span class="section-icon">🕐</span>
          Recent Attendance History
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Status</th><th>Class</th><th>WhatsApp</th></tr>
            </thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>

      </div>
    </div>
  `;

  // ── Wire back buttons
  const goBack = () => navigate('dashboard');
  document.getElementById('back-btn')?.addEventListener('click', goBack);
  document.getElementById('nav-back-btn')?.addEventListener('click', goBack);

  // ── State
  let selectedStatus = null;

  const updatePreview = () => {
    const classTaken  = document.getElementById('class-taken')?.value.trim() || '';
    const homework    = document.getElementById('homework')?.value.trim() || '';
    const preview     = buildPreview(student.name, selectedStatus, classTaken, homework);
    const previewEl   = document.getElementById('msg-preview');
    const submitBtn   = document.getElementById('submit-btn');
    if (previewEl) previewEl.textContent = preview;
    if (submitBtn) submitBtn.disabled = !selectedStatus;
  };

  // ── Toggle buttons
  document.getElementById('toggle-group')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-val]');
    if (!btn) return;

    selectedStatus = btn.dataset.val;

    // Update active state
    document.querySelectorAll('.toggle-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    updatePreview();
  });

  // ── Live preview on input
  document.getElementById('class-taken')?.addEventListener('input', updatePreview);
  document.getElementById('homework')?.addEventListener('input', updatePreview);

  // ── Form submit
  document.getElementById('att-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const classTaken = document.getElementById('class-taken').value.trim();
    const homework   = document.getElementById('homework').value.trim();

    if (!selectedStatus) { showToast('Please select Present or Absent.', 'warning'); return; }
    if (!classTaken)     { showToast('Please enter the class taken today.', 'warning'); return; }
    if (!homework)       { showToast('Please enter homework details.', 'warning'); return; }

    const submitBtn = document.getElementById('submit-btn');
    const restore   = setButtonLoading(submitBtn, 'Submitting & Sending WhatsApp...');

    // Hide previous result
    const resultBox = document.getElementById('submit-result');
    resultBox.style.display = 'none';

    try {
      const result = await submitAttendance({
        student_id:  parseInt(studentId),
        status:      selectedStatus,
        class_taken: classTaken,
        homework,
      });

      const isSuccess    = result.whatsapp_sent;
      const resultClass  = isSuccess ? 'success' : 'error';
      const resultIcon   = isSuccess ? '📱✅' : '⚠️';

      resultBox.innerHTML = `
        <div class="submit-result ${resultClass}">
          <span class="result-icon">${resultIcon}</span>
          <div class="result-msg">
            <strong>${result.feedback}</strong>
            ${!isSuccess && result.whatsapp_error
              ? `<span style="font-size:.82rem;opacity:.8">Error: ${result.whatsapp_error}</span>`
              : ''
            }
          </div>
        </div>
      `;
      resultBox.style.display = 'block';

      showToast(
        isSuccess
          ? `✅ Attendance marked & WhatsApp sent for ${student.name}!`
          : `📋 Attendance saved. WhatsApp pending.`,
        isSuccess ? 'success' : 'warning'
      );

      console.log('📊 Attendance result:', result);

      // Navigate back after short delay
      setTimeout(() => navigate('dashboard'), 3000);
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
};
