/**
 * Toast notification component.
 *
 * Usage:
 *   import { showToast } from './toast.js';
 *   showToast('Message sent!', 'success');
 *   showToast('Error occurred', 'error');
 *   showToast('Please wait...', 'warning');
 *   showToast('FYI', 'info');
 */

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
const AUTO_DISMISS = { success: 4000, error: 6000, warning: 5000, info: 4000 };

export const showToast = (message, type = 'info', duration) => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  const dismiss = () => {
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  toast.addEventListener('click', dismiss);

  setTimeout(dismiss, duration ?? AUTO_DISMISS[type] ?? 4000);
};
