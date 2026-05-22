/**
 * API client — wraps fetch with JWT injection and error handling.
 *
 * In development: requests go to /api/* and Vite proxies to localhost:3001
 * In production:  VITE_API_URL points to the deployed backend (e.g. Render)
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  fetch(`${API_BASE}/auth/login`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify({ email, password }),
  }).then(handleResponse);

export const getMe = () =>
  fetch(`${API_BASE}/auth/me`, { headers: headers() }).then(handleResponse);

// ─── Students ─────────────────────────────────────────────────────────────────
export const getStudents = (grade) => {
  const url = grade
    ? `${API_BASE}/students?grade=${encodeURIComponent(grade)}`
    : `${API_BASE}/students`;
  return fetch(url, { headers: headers() }).then(handleResponse);
};

export const getStudent = (id) =>
  fetch(`${API_BASE}/students/${id}`, { headers: headers() }).then(handleResponse);

export const createStudent = (data) =>
  fetch(`${API_BASE}/students`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(data),
  }).then(handleResponse);

export const updateStudent = (id, data) =>
  fetch(`${API_BASE}/students/${id}`, {
    method:  'PUT',
    headers: headers(),
    body:    JSON.stringify(data),
  }).then(handleResponse);

export const deleteStudent = (id) =>
  fetch(`${API_BASE}/students/${id}`, {
    method:  'DELETE',
    headers: headers(),
  }).then(handleResponse);

// ─── Attendance ───────────────────────────────────────────────────────────────
export const submitAttendance = (payload) =>
  fetch(`${API_BASE}/attendance/submit`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  }).then(handleResponse);

export const submitBulkAttendance = (payload) =>
  fetch(`${API_BASE}/attendance/submit-bulk`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  }).then(handleResponse);

export const getHistory = () =>
  fetch(`${API_BASE}/attendance/history`, { headers: headers() }).then(handleResponse);

export const getStudentHistory = (studentId) =>
  fetch(`${API_BASE}/attendance/student/${studentId}`, { headers: headers() }).then(handleResponse);

export const getAttendanceReport = (from, to, grade) => {
  let url = `${API_BASE}/attendance/report?from=${from}&to=${to}`;
  if (grade) url += `&grade=${encodeURIComponent(grade)}`;
  return fetch(url, { headers: headers() }).then(handleResponse);
};

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
export const getWhatsAppStatus = () =>
  fetch(`${API_BASE}/whatsapp/status`, { headers: headers() }).then(handleResponse);



// ─── Teachers (Admin only) ────────────────────────────────────────────────────
export const getTeachers = () =>
  fetch(`${API_BASE}/teachers`, { headers: headers() }).then(handleResponse);

export const createTeacherAPI = (data) =>
  fetch(`${API_BASE}/teachers`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(data),
  }).then(handleResponse);

export const updateTeacherAPI = (id, data) =>
  fetch(`${API_BASE}/teachers/${id}`, {
    method:  'PUT',
    headers: headers(),
    body:    JSON.stringify(data),
  }).then(handleResponse);

export const deleteTeacherAPI = (id) =>
  fetch(`${API_BASE}/teachers/${id}`, {
    method:  'DELETE',
    headers: headers(),
  }).then(handleResponse);
