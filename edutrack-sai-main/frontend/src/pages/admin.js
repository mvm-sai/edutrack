import { getTeachers, createTeacherAPI, updateTeacherAPI, deleteTeacherAPI } from '../api.js';
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
let allTeachers = [];
let editingTeacher = null;

// ─── Teacher Row HTML ─────────────────────────────────────────────────────────
const teacherRowHTML = (teacher, index, currentId) => {
  const avt = initials(teacher.name);
  const isSelf = teacher.id === currentId;
  const roleBadge = teacher.role === 'admin'
    ? '<span class="admin-role-badge admin">👑 Admin</span>'
    : '<span class="admin-role-badge staff">👤 Staff</span>';

  return `
    <tr class="student-mgmt-row" style="animation-delay:${index * 0.03}s">
      <td>
        <div class="sm-student-cell">
          <div class="sm-avatar ${teacher.role === 'admin' ? 'admin-avatar' : ''}">${avt}</div>
          <div class="sm-name-wrap">
            <span class="sm-name">${escapeHTML(teacher.name)}${isSelf ? ' <span class="admin-you-badge">(You)</span>' : ''}</span>
            <span class="sm-id">#${teacher.id}</span>
          </div>
        </div>
      </td>
      <td><span class="sm-roll">${escapeHTML(teacher.email)}</span></td>
      <td>${roleBadge}</td>
      <td>
        <div class="sm-actions">
          <button class="sm-btn-edit" data-id="${teacher.id}" title="Edit Staff">
            ✏️ Edit
          </button>
          ${!isSelf ? `
            <button class="sm-btn-delete" data-id="${teacher.id}" title="Remove Staff">
              🗑️ Remove
            </button>
          ` : '<span class="admin-self-note">—</span>'}
        </div>
      </td>
    </tr>
  `;
};

// ─── Modal HTML ──────────────────────────────────────────────────────────────
const teacherFormModalHTML = (teacher = null) => {
  const isEdit = !!teacher;
  const title = isEdit ? `Edit Staff — ${escapeHTML(teacher?.name)}` : 'Add New Staff';
  const btnLabel = isEdit ? '💾 Save Changes' : '➕ Add Staff';

  return `
    <div class="sm-modal-overlay" id="teacher-modal-overlay">
      <div class="sm-modal">
        <div class="sm-modal-header">
          <h3>${title}</h3>
          <button class="sm-modal-close" id="t-modal-close-btn">&times;</button>
        </div>
        <form id="teacher-form" novalidate>
          <div class="sm-modal-body">
            <div class="grid-2">
              <div class="form-group">
                <label for="tf-name">👤 Full Name *</label>
                <input id="tf-name" type="text" placeholder="e.g. John Smith"
                  value="${escapeHTML(teacher?.name)}" maxlength="100" required />
              </div>
              <div class="form-group">
                <label for="tf-email">📧 Email *</label>
                <input id="tf-email" type="email" placeholder="e.g. john@dream.com"
                  value="${escapeHTML(teacher?.email)}" maxlength="100" required />
              </div>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label for="tf-password">🔒 Password ${isEdit ? '(leave blank to keep current)' : '*'}</label>
                <input id="tf-password" type="password" placeholder="${isEdit ? '••••••••' : 'Min. 6 characters'}"
                  minlength="6" maxlength="100" ${isEdit ? '' : 'required'} />
              </div>
              <div class="form-group">
                <label for="tf-role">🎭 Role *</label>
                <select id="tf-role" class="class-filter-select" style="width:100%">
                  <option value="teacher" ${(!teacher || teacher?.role === 'teacher') ? 'selected' : ''}>👤 Staff</option>
                  <option value="admin" ${teacher?.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
                </select>
              </div>
            </div>
          </div>
          <div class="sm-modal-footer">
            <button type="button" class="sm-btn-cancel" id="t-modal-cancel-btn">Cancel</button>
            <button type="submit" class="sm-btn-submit" id="t-modal-submit-btn">${btnLabel}</button>
          </div>
        </form>
      </div>
    </div>
  `;
};

// ─── Delete Confirmation ─────────────────────────────────────────────────────
const deleteTeacherConfirmHTML = (teacher) => `
  <div class="sm-modal-overlay" id="delete-teacher-overlay">
    <div class="sm-modal sm-modal-sm">
      <div class="sm-modal-header sm-modal-header-danger">
        <h3>⚠️ Remove Staff</h3>
        <button class="sm-modal-close" id="dt-close-btn">&times;</button>
      </div>
      <div class="sm-modal-body">
        <p class="sm-delete-msg">
          Are you sure you want to remove <strong>${escapeHTML(teacher.name)}</strong>?
        </p>
        <div class="sm-delete-warning">
          <span>⚠️</span>
          <span>Their students will be reassigned to you. This action cannot be undone.</span>
        </div>
      </div>
      <div class="sm-modal-footer">
        <button type="button" class="sm-btn-cancel" id="dt-cancel-btn">Cancel</button>
        <button type="button" class="sm-btn-danger" id="dt-confirm-btn">🗑️ Remove Forever</button>
      </div>
    </div>
  </div>
`;

// ─── Main Render ──────────────────────────────────────────────────────────────
export const renderAdmin = async (navigate) => {
  const app     = document.getElementById('app');
  const teacher = JSON.parse(localStorage.getItem('teacher') || '{}');

  // Only admins can access this page
  if (teacher.role !== 'admin') {
    showToast('Access denied. Admin privileges required.', 'error');
    navigate('dashboard');
    return;
  }

  const avt = initials(teacher.name || 'A');

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

  // Fetch teachers
  try {
    const data = await getTeachers();
    allTeachers = data.teachers || [];
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('403')) {
      showToast('Access denied or session expired.', 'error');
      navigate('dashboard');
      return;
    }
    showToast('Failed to load staff: ' + err.message, 'error');
    allTeachers = [];
  }

  renderAdminPage(navigate, teacher);
};

// ─── Render Full Page ─────────────────────────────────────────────────────────
const renderAdminPage = (navigate, teacher) => {
  const app = document.getElementById('app');
  const avt = initials(teacher.name || 'A');

  const adminCount = allTeachers.filter(t => t.role === 'admin').length;
  const staffCount = allTeachers.filter(t => t.role === 'teacher').length;

  const tableRows = allTeachers.length > 0
    ? allTeachers.map((t, i) => teacherRowHTML(t, i, teacher.id)).join('')
    : `<tr class="empty-row"><td colspan="4">📭 No staff members found.</td></tr>`;

  app.innerHTML = `
    <div class="app-layout">
      <nav class="navbar">
        <div class="navbar-brand">
          <span class="brand-icon">🏫</span>
          <span class="brand-name">EduTrack</span>
        </div>
        <div class="navbar-right">
          <div class="teacher-pill">
            <div class="teacher-avatar admin-avatar">${avt}</div>
            <div class="teacher-info">
              <div class="teacher-name">${teacher.name}</div>
              <div class="teacher-role">👑 Admin</div>
            </div>
          </div>
          <button class="btn-logout" id="nav-back-btn">← Dashboard</button>
        </div>
      </nav>

      <div class="main-content sm-page">

        <div class="page-header">
          <div>
            <h2>👑 Admin Panel</h2>
            <p>Manage staff members, roles, and access</p>
          </div>
          <div class="header-badges">
            <span class="student-count-badge admin-badge-gold">👑 ${adminCount} Admin${adminCount !== 1 ? 's' : ''}</span>
            <span class="student-count-badge">👤 ${staffCount} Staff</span>
          </div>
        </div>

        <div class="sm-toolbar">
          <div class="admin-toolbar-info">
            <span class="admin-info-icon">ℹ️</span>
            <span>Admins can manage all staff and students. Staff can only manage their own students.</span>
          </div>
          <button class="sm-btn-add" id="add-teacher-btn">
            <span>➕</span> Add Staff
          </button>
        </div>

        <div class="sm-table-wrap">
          <table class="sm-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="teachers-tbody">
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

  // Add teacher
  document.getElementById('add-teacher-btn')?.addEventListener('click', () => {
    editingTeacher = null;
    openTeacherModal(navigate, teacher);
  });

  // Edit & Delete buttons (event delegation)
  document.getElementById('teachers-tbody')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.sm-btn-edit');
    const deleteBtn = e.target.closest('.sm-btn-delete');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const t = allTeachers.find(x => x.id === id);
      if (t) {
        editingTeacher = t;
        openTeacherModal(navigate, teacher);
      }
    }

    if (deleteBtn) {
      const id = parseInt(deleteBtn.dataset.id);
      const t = allTeachers.find(x => x.id === id);
      if (t) {
        openDeleteTeacherConfirm(navigate, teacher, t);
      }
    }
  });
};

// ─── Open Teacher Modal (Create / Edit) ──────────────────────────────────────
const openTeacherModal = (navigate, currentTeacher) => {
  const container = document.getElementById('modal-container');
  container.innerHTML = teacherFormModalHTML(editingTeacher);

  requestAnimationFrame(() => {
    document.getElementById('teacher-modal-overlay')?.classList.add('visible');
  });

  const closeModal = () => {
    document.getElementById('teacher-modal-overlay')?.classList.remove('visible');
    setTimeout(() => { container.innerHTML = ''; }, 250);
  };

  document.getElementById('t-modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('t-modal-cancel-btn')?.addEventListener('click', closeModal);

  document.getElementById('teacher-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'teacher-modal-overlay') closeModal();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  // Form submit
  document.getElementById('teacher-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name     = document.getElementById('tf-name').value.trim();
    const email    = document.getElementById('tf-email').value.trim();
    const password = document.getElementById('tf-password').value;
    const role     = document.getElementById('tf-role').value;

    // Client-side validation
    if (!name) { showToast('Name is required.', 'warning'); return; }
    if (!email) { showToast('Email is required.', 'warning'); return; }
    if (!editingTeacher && (!password || password.length < 6)) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }
    if (editingTeacher && password && password.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('t-modal-submit-btn');
    const restore = setButtonLoading(submitBtn, editingTeacher ? 'Saving...' : 'Adding...');

    try {
      const payload = { name, email, role };
      if (password) payload.password = password;

      if (editingTeacher) {
        const result = await updateTeacherAPI(editingTeacher.id, payload);
        showToast(result.message || 'Staff updated!', 'success');

        // If we edited ourselves, update localStorage
        if (editingTeacher.id === currentTeacher.id) {
          const updatedTeacher = { ...currentTeacher, name, email, role };
          localStorage.setItem('teacher', JSON.stringify(updatedTeacher));
        }
      } else {
        const result = await createTeacherAPI(payload);
        showToast(result.message || 'Staff added!', 'success');
      }

      closeModal();

      // Refresh
      const data = await getTeachers();
      allTeachers = data.teachers || [];
      renderAdminPage(navigate, JSON.parse(localStorage.getItem('teacher') || '{}'));
    } catch (err) {
      showToast(err.message || 'Operation failed.', 'error');
    } finally {
      restore();
    }
  });

  setTimeout(() => document.getElementById('tf-name')?.focus(), 100);
};

// ─── Open Delete Confirmation ─────────────────────────────────────────────────
const openDeleteTeacherConfirm = (navigate, currentTeacher, teacher) => {
  const container = document.getElementById('modal-container');
  container.innerHTML = deleteTeacherConfirmHTML(teacher);

  requestAnimationFrame(() => {
    document.getElementById('delete-teacher-overlay')?.classList.add('visible');
  });

  const closeModal = () => {
    document.getElementById('delete-teacher-overlay')?.classList.remove('visible');
    setTimeout(() => { container.innerHTML = ''; }, 250);
  };

  document.getElementById('dt-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('dt-cancel-btn')?.addEventListener('click', closeModal);

  document.getElementById('delete-teacher-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-teacher-overlay') closeModal();
  });

  document.getElementById('dt-confirm-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('dt-confirm-btn');
    const restore = setButtonLoading(btn, 'Removing...');

    try {
      const result = await deleteTeacherAPI(teacher.id);
      showToast(result.message || 'Staff removed!', 'success');
      closeModal();

      // Refresh
      const data = await getTeachers();
      allTeachers = data.teachers || [];
      renderAdminPage(navigate, currentTeacher);
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    } finally {
      restore();
    }
  });
};
