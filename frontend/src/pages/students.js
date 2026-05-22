import { getStudents, createStudent, updateStudent, deleteStudent } from '../api.js';
import { showToast } from '../components/toast.js';
import { renderPageSpinner, setButtonLoading } from '../components/spinner.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const initials = (name) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const escapeHTML = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

// ─── State ───────────────────────────────────────────────────────────────────
let allStudents = [];
let searchQuery = '';
let editingStudent = null; // null = create mode, object = edit mode

const filteredStudents = () => {
  if (!searchQuery) return allStudents;
  const q = searchQuery.toLowerCase();
  return allStudents.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
    s.grade.toLowerCase().includes(q) ||
    (s.parent_name && s.parent_name.toLowerCase().includes(q)) ||
    s.parent_whatsapp.includes(q)
  );
};

// ─── Student Row HTML ─────────────────────────────────────────────────────────
const studentRowHTML = (student, index) => {
  const avt = initials(student.name);
  return `
    <tr class="student-mgmt-row" style="animation-delay:${index * 0.03}s">
      <td>
        <div class="sm-student-cell">
          <div class="sm-avatar">${avt}</div>
          <div class="sm-name-wrap">
            <span class="sm-name">${escapeHTML(student.name)}</span>
            <span class="sm-id">#${student.id}</span>
          </div>
        </div>
      </td>
      <td><span class="sm-roll">${escapeHTML(student.roll_number) || '—'}</span></td>
      <td><span class="sm-grade-badge">${escapeHTML(student.grade)}</span></td>
      <td>
        <div class="sm-parent-cell">
          <span class="sm-parent-name">${escapeHTML(student.parent_name) || '—'}</span>
          <span class="sm-parent-phone">📱 +${student.parent_whatsapp}</span>
        </div>
      </td>
      <td>
        <div class="sm-actions">
          <button class="sm-btn-edit" data-id="${student.id}" title="Edit Student">
            ✏️ Edit
          </button>
          <button class="sm-btn-delete" data-id="${student.id}" title="Delete Student">
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>
  `;
};

// ─── Modal HTML ──────────────────────────────────────────────────────────────
const studentFormModalHTML = (student = null) => {
  const isEdit = !!student;
  const title = isEdit ? `Edit Student — ${escapeHTML(student?.name)}` : 'Add New Student';
  const btnLabel = isEdit ? '💾 Save Changes' : '➕ Add Student';

  return `
    <div class="sm-modal-overlay" id="student-modal-overlay">
      <div class="sm-modal">
        <div class="sm-modal-header">
          <h3>${title}</h3>
          <button class="sm-modal-close" id="modal-close-btn">&times;</button>
        </div>
        <form id="student-form" novalidate>
          <div class="sm-modal-body">
            <div class="grid-2">
              <div class="form-group">
                <label for="sf-name">👤 Student Full Name *</label>
                <input id="sf-name" type="text" placeholder="e.g. Rahul Sharma"
                  value="${escapeHTML(student?.name)}" maxlength="100" required />
              </div>
              <div class="form-group">
                <label for="sf-roll">🔢 Roll Number</label>
                <input id="sf-roll" type="text" placeholder="e.g. 101"
                  value="${escapeHTML(student?.roll_number)}" maxlength="20" />
              </div>
            </div>
            <div class="form-group">
              <label for="sf-grade">📚 Class / Grade *</label>
              <input id="sf-grade" type="text" placeholder="e.g. 10 CBSE"
                value="${escapeHTML(student?.grade)}" maxlength="50" required />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label for="sf-parent-name">👨‍👩‍👦 Parent Name *</label>
                <input id="sf-parent-name" type="text" placeholder="e.g. Mr. Sharma"
                  value="${escapeHTML(student?.parent_name)}" maxlength="100" required />
              </div>
              <div class="form-group">
                <label for="sf-phone">📱 Parent WhatsApp Number *</label>
                <input id="sf-phone" type="tel" placeholder="e.g. 919876543210"
                  value="${student?.parent_whatsapp || ''}" maxlength="15" required />
              </div>
            </div>
          </div>
          <div class="sm-modal-footer">
            <button type="button" class="sm-btn-cancel" id="modal-cancel-btn">Cancel</button>
            <button type="submit" class="sm-btn-submit" id="modal-submit-btn">${btnLabel}</button>
          </div>
        </form>
      </div>
    </div>
  `;
};

// ─── Delete Confirmation Modal ───────────────────────────────────────────────
const deleteConfirmHTML = (student) => `
  <div class="sm-modal-overlay" id="delete-modal-overlay">
    <div class="sm-modal sm-modal-sm">
      <div class="sm-modal-header sm-modal-header-danger">
        <h3>⚠️ Delete Student</h3>
        <button class="sm-modal-close" id="delete-modal-close">&times;</button>
      </div>
      <div class="sm-modal-body">
        <p class="sm-delete-msg">
          Are you sure you want to delete <strong>${escapeHTML(student.name)}</strong>?
        </p>
        <div class="sm-delete-warning">
          <span>⚠️</span>
          <span>This will also permanently delete all attendance records for this student. This action cannot be undone.</span>
        </div>
      </div>
      <div class="sm-modal-footer">
        <button type="button" class="sm-btn-cancel" id="delete-cancel-btn">Cancel</button>
        <button type="button" class="sm-btn-danger" id="delete-confirm-btn">🗑️ Delete Forever</button>
      </div>
    </div>
  </div>
`;

// ─── Main Render ──────────────────────────────────────────────────────────────
export const renderStudents = async (navigate) => {
  const app     = document.getElementById('app');
  const teacher = JSON.parse(localStorage.getItem('teacher') || '{}');
  const avt     = initials(teacher.name || 'T');

  // Loading state
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

  // Fetch students
  try {
    const data = await getStudents();
    allStudents = data.students || [];
  } catch (err) {
    if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
      localStorage.removeItem('token');
      navigate('login');
      return;
    }
    showToast('Failed to load students: ' + err.message, 'error');
    allStudents = [];
  }

  renderStudentsPage(navigate, teacher);
};

// ─── Render the full page (called after data load and after CRUD ops) ────────
const renderStudentsPage = (navigate, teacher) => {
  const app = document.getElementById('app');
  const avt = initials(teacher.name || 'T');
  const students = filteredStudents();

  const tableRows = students.length > 0
    ? students.map((s, i) => studentRowHTML(s, i)).join('')
    : `<tr class="empty-row"><td colspan="5">📭 No students found. Click "Add Student" to get started!</td></tr>`;

  app.innerHTML = `
    <div class="app-layout">
      <nav class="navbar">
        <div class="navbar-brand">
          <span class="brand-icon">🏫</span>
          <span class="brand-name">EduTrack</span>
        </div>
        <div class="navbar-right">
          <div class="teacher-pill">
            <div class="teacher-avatar">${avt}</div>
            <div class="teacher-info">
              <div class="teacher-name">${teacher.name}</div>
              <div class="teacher-role">${teacher.role === 'admin' ? '👑 Admin' : 'Staff'}</div>
            </div>
          </div>
          <button class="btn-logout" id="nav-back-btn">← Dashboard</button>
        </div>
      </nav>

      <div class="main-content sm-page">

        <div class="page-header">
          <div>
            <h2>👨‍🎓 Manage Students</h2>
            <p>Add, edit, or remove students from your roster</p>
          </div>
          <div class="header-badges">
            <span class="student-count-badge">👨‍🎓 ${allStudents.length} Student${allStudents.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="sm-toolbar">
          <div class="sm-search-wrap">
            <span class="sm-search-icon">🔍</span>
            <input id="sm-search" type="text" placeholder="Search by name, roll, grade, parent..."
              value="${escapeHTML(searchQuery)}" />
          </div>
          <button class="sm-btn-add" id="add-student-btn">
            <span>➕</span> Add Student
          </button>
        </div>

        <div class="sm-table-wrap">
          <table class="sm-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No.</th>
                <th>Grade</th>
                <th>Parent / WhatsApp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="students-tbody">
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div class="sm-back-row">
          <button class="back-btn" id="back-to-dashboard">← Back to Dashboard</button>
        </div>

      </div>
    </div>

    <div id="modal-container"></div>
  `;

  // ─── Wire events ──────────────────────────────────────────────────────────

  // Back buttons
  document.getElementById('nav-back-btn')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('back-to-dashboard')?.addEventListener('click', () => navigate('dashboard'));

  // Search
  document.getElementById('sm-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderStudentsPage(navigate, teacher);
    // Restore focus & cursor position
    const input = document.getElementById('sm-search');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  // Add student
  document.getElementById('add-student-btn')?.addEventListener('click', () => {
    editingStudent = null;
    openStudentModal(navigate, teacher);
  });

  // Edit & Delete buttons (event delegation on tbody)
  document.getElementById('students-tbody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.sm-btn-edit');
    const deleteBtn = e.target.closest('.sm-btn-delete');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const student = allStudents.find(s => s.id === id);
      if (student) {
        editingStudent = student;
        openStudentModal(navigate, teacher);
      }
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      const student = allStudents.find(s => s.id === id);
      if (student) {
        openDeleteConfirm(navigate, teacher, student);
      }
    }
  });
};

// ─── Open Student Modal (Create / Edit) ──────────────────────────────────────
const openStudentModal = (navigate, teacher) => {
  const container = document.getElementById('modal-container');
  container.innerHTML = studentFormModalHTML(editingStudent);

  // Animate in
  requestAnimationFrame(() => {
    const overlay = document.getElementById('student-modal-overlay');
    overlay?.classList.add('visible');
  });

  const closeModal = () => {
    const overlay = document.getElementById('student-modal-overlay');
    overlay?.classList.remove('visible');
    setTimeout(() => { container.innerHTML = ''; }, 250);
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);

  // Close on overlay click
  document.getElementById('student-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'student-modal-overlay') closeModal();
  });

  // Close on Escape
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // Form submit
  document.getElementById('student-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name            = document.getElementById('sf-name').value.trim();
    const roll_number     = document.getElementById('sf-roll').value.trim();
    const grade           = document.getElementById('sf-grade').value.trim();
    const parent_name     = document.getElementById('sf-parent-name').value.trim();
    const parent_whatsapp = document.getElementById('sf-phone').value.trim();

    // Client-side validation
    if (!name) { showToast('Student name is required.', 'warning'); document.getElementById('sf-name').focus(); return; }
    if (!grade) { showToast('Class/Grade is required.', 'warning'); document.getElementById('sf-grade').focus(); return; }
    if (!parent_name) { showToast('Parent name is required.', 'warning'); document.getElementById('sf-parent-name').focus(); return; }
    if (!parent_whatsapp) { showToast('WhatsApp number is required.', 'warning'); document.getElementById('sf-phone').focus(); return; }

    const cleanPhone = parent_whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('Please enter a valid WhatsApp number (at least 10 digits).', 'warning');
      document.getElementById('sf-phone').focus();
      return;
    }

    const submitBtn = document.getElementById('modal-submit-btn');
    const restore = setButtonLoading(submitBtn, editingStudent ? 'Saving...' : 'Adding...');

    try {
      const payload = { name, grade, roll_number, parent_name, parent_whatsapp: cleanPhone };

      if (editingStudent) {
        const result = await updateStudent(editingStudent.id, payload);
        showToast(result.message || 'Student updated!', 'success');
      } else {
        const result = await createStudent(payload);
        showToast(result.message || 'Student added!', 'success');
      }

      closeModal();

      // Refresh data
      const data = await getStudents();
      allStudents = data.students || [];
      renderStudentsPage(navigate, teacher);
    } catch (err) {
      showToast(err.message || 'Operation failed.', 'error');
    } finally {
      restore();
    }
  });

  // Focus first field
  setTimeout(() => document.getElementById('sf-name')?.focus(), 100);
};

// ─── Open Delete Confirmation ─────────────────────────────────────────────────
const openDeleteConfirm = (navigate, teacher, student) => {
  const container = document.getElementById('modal-container');
  container.innerHTML = deleteConfirmHTML(student);

  requestAnimationFrame(() => {
    const overlay = document.getElementById('delete-modal-overlay');
    overlay?.classList.add('visible');
  });

  const closeModal = () => {
    const overlay = document.getElementById('delete-modal-overlay');
    overlay?.classList.remove('visible');
    setTimeout(() => { container.innerHTML = ''; }, 250);
  };

  document.getElementById('delete-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('delete-cancel-btn')?.addEventListener('click', closeModal);

  document.getElementById('delete-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal-overlay') closeModal();
  });

  document.getElementById('delete-confirm-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('delete-confirm-btn');
    const restore = setButtonLoading(btn, 'Deleting...');

    try {
      const result = await deleteStudent(student.id);
      showToast(result.message || 'Student deleted!', 'success');
      closeModal();

      // Refresh data
      const data = await getStudents();
      allStudents = data.students || [];
      renderStudentsPage(navigate, teacher);
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    } finally {
      restore();
    }
  });
};
