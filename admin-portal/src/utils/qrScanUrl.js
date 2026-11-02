/**
 * The URL a QR code encodes.
 *
 * This is the one thing about a QR code that cannot be corrected after it is printed, and it was
 * built from the browser's own hostname:
 *
 *   const QR_BASE_URL = window.location.hostname === 'localhost'
 *     ? `http://localhost:5000/api/qr/r`
 *     : `https://admin.xlandinfra.com/api/qr/r`;
 *
 * So a code downloaded from a dev machine encoded `http://localhost:5000/...`, which resolves to
 * the phone itself and can never reach anything; and the production branch hard-coded a host
 * instead of reading `VITE_API_URL`, against the rule that every admin-portal URL is built from
 * `API_BASE`. Either way the page offered no way to see what a code pointed at -- the card and the
 * table both showed `current_url`, the *destination*, under the label "Redirect URL" -- so a code
 * that bypassed `/api/qr/r/:slug` entirely, and therefore could never be counted, looked identical
 * to a working one.
 *
 * A scan is only ever recorded for a request to `/api/qr/r/:slug`. A code that points anywhere else
 * -- straight at xlandinfra.com, or at the retired qr.xlandinfra.com host -- still opens the site,
 * so it looks like it works, and silently counts nothing.
 *
 * Regression test: node --test admin-portal/src/utils/qrScanUrl.test.js
 */

/** The backend route that records a scan and then redirects. Nothing else counts. */
export const QR_REDIRECT_PATH = '/api/qr/r';

const trimTrailingSlashes = (value) => String(value ?? '').trim().replace(/\/+$/, '');

/**
 * The origin a scan URL is built on.
 *
 * `VITE_QR_PUBLIC_URL` wins when it is set, so codes can be printed against the public brand
 * domain even when the API is addressed elsewhere. Otherwise `VITE_API_URL`, which is the host
 * that actually serves `/api`. `window.location.origin` is the last resort rather than the first
 * guess: the admin SPA and the API are not always the same host.
 *
 * @param {object} env  import.meta.env
 * @param {string} fallbackOrigin  window.location.origin
 */
export const qrRedirectBase = (env = {}, fallbackOrigin = '') =>
  trimTrailingSlashes(env?.VITE_QR_PUBLIC_URL || env?.VITE_API_URL || fallbackOrigin);

/** The full URL a QR code for `slug` must encode. */
export const qrScanUrl = (slug, env = {}, fallbackOrigin = '') =>
  `${qrRedirectBase(env, fallbackOrigin)}${QR_REDIRECT_PATH}/${encodeURIComponent(slug ?? '')}`;

// Hosts that exist only on the machine or the LAN. A phone scanning a code resolves the name
// itself, so every one of these points the visitor back at their own device.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
const PRIVATE_RANGES = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./
];

/**
 * Can a phone somewhere else actually reach this URL?
 *
 * Mirrors the backend's own redirect-target check (`isValidUrl` in routes/qr.js), which is the
 * reason this matters at all: a code is printed once and scanned for years.
 */
export const isPubliclyScannable = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;

  const host = parsed.hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return false;
  if (PRIVATE_RANGES.some((range) => range.test(host))) return false;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return false;
  // A bare name with no dot is resolved on the local network only
  if (!host.includes('.')) return false;
  return true;
};

/**
 * Why a URL is not fit to print, in words the page can show. Null when it is fine.
 * A download that silently produces a dead code is the failure this exists to prevent.
 */
export const unscannableReason = (url) => {
  if (isPubliclyScannable(url)) return null;
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return `"${url}" is not a valid URL, so a QR code built from it cannot be scanned.`;
  }
  return `This QR code would encode ${host}, which only resolves on this machine or network. `
    + 'A phone scanning it would reach its own device, and the scan would never be recorded. '
    + 'Set VITE_QR_PUBLIC_URL (or build with .env.production) before downloading codes to print.';
};
