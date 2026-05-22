import { login } from '../api.js';
import { showToast } from '../components/toast.js';
import { setButtonLoading } from '../components/spinner.js';

export const renderLogin = (navigate) => {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <div class="login-logo">
          <span class="logo-icon">🏫</span>
          <h1>EduTrack</h1>
          <p>Teacher Attendance Portal</p>
        </div>

        <div id="login-error" class="login-error" style="display:none;">
          <span>⚠️</span>
          <span id="error-msg">Invalid credentials</span>
        </div>

        <form id="login-form" autocomplete="on" novalidate>
          <div class="form-group">
            <label for="email">Email Address</label>
            <div class="input-wrap">
              <span class="input-icon">✉️</span>
              <input
                id="email"
                type="email"
                placeholder="you@dream.com"
                autocomplete="email"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="input-wrap">
              <span class="input-icon">🔒</span>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
              />
            </div>
          </div>

          <button id="login-btn" type="submit" class="btn-primary">
            Sign In
          </button>
        </form>

        <p style="text-align:center;margin-top:24px;font-size:.78rem;color:var(--text-3);">
          Admin: srikanth@dream.com / teacher123
        </p>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');
  const errorBox = document.getElementById('login-error');
  const errorMsg = document.getElementById('error-msg');

  const showError = (msg) => {
    errorMsg.textContent = msg;
    errorBox.style.display = 'flex';
    // Shake animation
    errorBox.style.animation = 'none';
    requestAnimationFrame(() => { errorBox.style.animation = ''; });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email) { showError('Please enter your email address.'); return; }
    if (!password) { showError('Please enter your password.'); return; }

    const restore = setButtonLoading(btn, 'Signing in...');

    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('teacher', JSON.stringify(data.teacher));
      showToast(`Welcome back, ${data.teacher.name}! 👋`, 'success');
      navigate('dashboard');
    } catch (err) {
      showError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      restore();
    }
  });

  // Auto-focus email field
  setTimeout(() => document.getElementById('email')?.focus(), 100);
};
