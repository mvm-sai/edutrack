/**
 * Delay Utilities — Human-like timing for WhatsApp message sending.
 *
 * These utilities help avoid WhatsApp's spam/bulk detection by
 * adding randomized delays between messages, mimicking real human behavior.
 */

/**
 * Wait for a specified number of milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for a random duration between min and max milliseconds.
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 * @returns {Promise<number>} The actual delay used (ms)
 */
const randomDelay = async (minMs, maxMs) => {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await delay(ms);
  return ms;
};

/**
 * Default delay range for WhatsApp messages (8–15 seconds).
 * Mimics natural human typing/sending cadence.
 */
const WA_DELAY_MIN = 8000;
const WA_DELAY_MAX = 15000;

/**
 * Delay before retrying a failed message (5 seconds).
 */
const WA_RETRY_DELAY = 5000;

/**
 * Maximum number of retry attempts for a failed message.
 */
const WA_MAX_RETRIES = 2;

module.exports = {
  delay,
  randomDelay,
  WA_DELAY_MIN,
  WA_DELAY_MAX,
  WA_RETRY_DELAY,
  WA_MAX_RETRIES,
};
