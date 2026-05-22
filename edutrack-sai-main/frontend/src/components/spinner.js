/**
 * Spinner utility — injects/removes a loading spinner inside a button.
 *
 * Usage:
 *   import { setButtonLoading } from './spinner.js';
 *   const restore = setButtonLoading(buttonEl, 'Sending...');
 *   // ... async work ...
 *   restore();
 */

export const setButtonLoading = (btn, loadingText = 'Loading...') => {
  const originalHTML    = btn.innerHTML;
  btn.disabled         = true;
  btn.innerHTML        = `<span class="spinner-sm"></span>${loadingText}`;

  return () => {
    btn.disabled  = false;
    btn.innerHTML = originalHTML;
  };
};

/**
 * Render a full-page centered spinner.
 * Used while async data is loading.
 */
export const renderPageSpinner = () => `
  <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
    <div class="loader-ring"></div>
  </div>
`;
