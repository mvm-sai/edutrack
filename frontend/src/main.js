/**
 * SPA Router — entry point for EduTrack frontend.
 *
 * Pages:
 *   login      → Login form
 *   dashboard  → Student list + history
 *   attendance → Mark attendance for a student
 *   students   → Manage Students (CRUD)
 */

import './styles/main.css';
import { renderLogin }      from './pages/login.js';
import { renderDashboard }  from './pages/dashboard.js';
import { renderAttendance } from './pages/attendance.js';
import { renderStudents }   from './pages/students.js';
import { renderAdmin }      from './pages/admin.js';

// ─── Simple hash-based router ─────────────────────────────────────────────────
let currentPage   = null;
let currentParams = {};

/**
 * Navigate to a page by name.
 * @param {'login'|'dashboard'|'attendance'|'students'} page
 * @param {object} params  — e.g. { studentId: '3' }
 */
const navigate = (page, params = {}) => {
  const token = localStorage.getItem('token');

  // Redirect unauthenticated users to login
  if (page !== 'login' && !token) {
    renderPage('login', {});
    return;
  }

  // Redirect authenticated users away from login
  if (page === 'login' && token) {
    renderPage('dashboard', {});
    return;
  }

  renderPage(page, params);
};

const renderPage = (page, params) => {
  currentPage   = page;
  currentParams = params;

  switch (page) {
    case 'login':
      renderLogin(navigate);
      break;

    case 'dashboard':
      renderDashboard(navigate);
      break;

    case 'attendance':
      renderAttendance(navigate, params);
      break;

    case 'students':
      renderStudents(navigate);
      break;

    case 'admin':
      renderAdmin(navigate);
      break;

    default:
      navigate('login');
  }
};

// ─── Initial load ─────────────────────────────────────────────────────────────
const token = localStorage.getItem('token');

if (token) {
  navigate('dashboard');
} else {
  navigate('login');
}

// ─── Keyboard shortcut: Escape → back to dashboard ───────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (currentPage === 'attendance' || currentPage === 'students' || currentPage === 'admin')) {
    navigate('dashboard');
  }
});
