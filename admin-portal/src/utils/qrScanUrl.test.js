import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QR_REDIRECT_PATH, qrRedirectBase, qrScanUrl, isPubliclyScannable, unscannableReason
} from './qrScanUrl.js';

const PAGE = readFileSync(new URL('../pages/QRManagement.jsx', import.meta.url), 'utf8');

test('a scan URL goes through the route that records the scan', () => {
  // Only /api/qr/r/:slug writes a qr_scans row. A code pointing straight at the site opens fine
  // and counts nothing, which is exactly how the dashboard came to read zero.
  assert.equal(QR_REDIRECT_PATH, '/api/qr/r');
  assert.equal(
    qrScanUrl('main', { VITE_API_URL: 'https://xlandinfra.com' }),
    'https://xlandinfra.com/api/qr/r/main'
  );
});

test('the base comes from configuration, never from the browser it was downloaded in', () => {
  const env = { VITE_API_URL: 'https://xlandinfra.com' };
  // The admin SPA is served from admin.xlandinfra.com while the API answers on xlandinfra.com,
  // so the page's own origin is the wrong answer even in production.
  assert.equal(qrRedirectBase(env, 'https://admin.xlandinfra.com'), 'https://xlandinfra.com');
  // An explicit public URL wins, so codes can be printed against the brand domain
  assert.equal(
    qrRedirectBase({ ...env, VITE_QR_PUBLIC_URL: 'https://qr.xlandinfra.com' }, ''),
    'https://qr.xlandinfra.com'
  );
  // Only with nothing configured at all does the current origin stand in
  assert.equal(qrRedirectBase({}, 'https://admin.xlandinfra.com'), 'https://admin.xlandinfra.com');
});

test('a trailing slash never doubles up', () => {
  assert.equal(
    qrScanUrl('main', { VITE_API_URL: 'https://xlandinfra.com/' }),
    'https://xlandinfra.com/api/qr/r/main'
  );
  assert.equal(qrRedirectBase({ VITE_API_URL: 'https://xlandinfra.com///' }), 'https://xlandinfra.com');
});

test('a local address is not fit to print', () => {
  // This is the bug: a code downloaded on a dev machine encoded http://localhost:5000/api/qr/r/...
  // and a phone scanning it resolved localhost to itself.
  for (const url of [
    'http://localhost:5000/api/qr/r/main',
    'http://127.0.0.1:5000/api/qr/r/main',
    'http://[::1]:5000/api/qr/r/main',
    'http://192.168.1.14:5000/api/qr/r/main',
    'http://10.0.0.5/api/qr/r/main',
    'http://172.16.3.1/api/qr/r/main',
    'http://169.254.1.1/api/qr/r/main',
    'http://my-laptop/api/qr/r/main',
    'http://my-laptop.local/api/qr/r/main'
  ]) {
    assert.equal(isPubliclyScannable(url), false, url);
    assert.match(unscannableReason(url) || '', /never be recorded|not a valid URL/);
  }
});

test('a public address is', () => {
  for (const url of [
    'https://xlandinfra.com/api/qr/r/main',
    'https://admin.xlandinfra.com/api/qr/r/customer',
    'http://xlandinfra.com/api/qr/r/main'
  ]) {
    assert.equal(isPubliclyScannable(url), true, url);
    assert.equal(unscannableReason(url), null);
  }
  // 172.x outside the private block is a real public range; the backend's own check rejects all
  // of 172.* and is wrong to, so this must not copy it.
  assert.equal(isPubliclyScannable('http://172.217.0.1/api/qr/r/main'), true);
});

test('nonsense is not scannable rather than throwing', () => {
  for (const url of ['', null, undefined, 'not a url', 'ftp://xlandinfra.com/x', 'javascript:alert(1)']) {
    assert.equal(isPubliclyScannable(url), false, String(url));
  }
});

test('the page builds its QR URLs here and shows what a code encodes', () => {
  // The hostname-sniffing base is what printed the dead codes; it must not come back.
  assert.doesNotMatch(PAGE, /window\.location\.hostname === 'localhost'/);
  assert.doesNotMatch(PAGE, /https:\/\/admin\.xlandinfra\.com\/api\/qr\/r/);
  assert.match(PAGE, /from '\.\.\/utils\/qrScanUrl'/);
  assert.match(PAGE, /qrScanUrl\(/);
  // A download that would hand over an unscannable code has to refuse
  assert.match(PAGE, /unscannableReason\(/);
  // The scan URL is on screen, not just the destination: that is how a code that bypasses
  // /api/qr/r/:slug stayed invisible.
  assert.match(PAGE, /Scan URL/);
});

test('the page shows times in IST, from the shared formatter', () => {
  // formatDate renders in Asia/Kolkata; the page's own formatTime asked the browser for the time
  // with no timezone, so every row paired an IST date with the viewer's local clock.
  assert.doesNotMatch(PAGE, /toLocaleTimeString/);
  assert.match(PAGE, /import \{ formatDate, formatTime \} from '\.\.\/utils\/dateFormat'/);
});

test('trend labels are read from the bucket, not converted from an instant', () => {
  // The buckets are the *server's* wall clock (backend/utils/qrScan.js hourKey uses getHours() to
  // match MySQL's DATE_FORMAT on the same host), so rendering item.at in any other zone slides
  // every bar off the hour it counts.
  assert.doesNotMatch(PAGE, /toLocaleDateString/);
  assert.doesNotMatch(PAGE, /new Date\(item\.at\)/);
  assert.match(PAGE, /bucketLabel\(item\.bucket, granularity\)/);
  assert.match(PAGE, /bucketTitle\(item\.bucket, granularity\)/);
});
