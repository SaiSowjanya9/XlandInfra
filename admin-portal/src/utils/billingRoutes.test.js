import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Billing > Payments and Billing > Payment History must not be the same screen again.
 *
 * Every portal registered both paths as `<Payments />`. The online/offline tab that was meant to
 * tell them apart had its online half switched off behind `{false && ...}`, nothing ever called
 * `setActiveTab`, and the header was hard-coded to "Payments" — so the two URLs rendered
 * byte-identical pages, down to the breadcrumb, and the only difference was a
 * `fetchRazorpayHistory()` request whose result had nowhere to go.
 *
 * Run: node --test admin-portal/src/utils/billingRoutes.test.js
 */

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), 'utf8');

const PORTALS = ['employee', 'fp', 'manager', 'coordinator', 'supervisor', 'executive'];

test('every portal routes Payment History to its own screen, not to Payments', () => {
  const app = read('App.jsx');
  for (const portal of PORTALS) {
    const route = new RegExp(
      `<Route path="billing/payment-history" element=\\{<(\\w+) user=\\{user\\} portalType="${portal}"`
    );
    const match = app.match(route);
    assert.ok(match, `no payment-history route for the ${portal} portal`);
    assert.equal(match[1], 'PaymentHistory', `the ${portal} portal still mounts ${match[1]} at payment-history`);
  }
  // And the two screens are genuinely two files
  assert.match(app, /import PaymentHistory from '\.\/pages\/billing\/PaymentHistory'/);
});

test('the two screens announce themselves differently', () => {
  // The heading was the giveaway: Payment History said "Payments" because the title was a literal
  // on a component both routes shared.
  assert.match(read('pages', 'billing', 'Payments.jsx'), /title="Payments"/);
  const history = read('pages', 'billing', 'PaymentHistory.jsx');
  assert.match(history, /title="Payment History"/);
  assert.match(history, /subtitle="Home › Billing & Payments › Payment History"/);
});

test('Payment History reads the audit trail, which nothing else did', () => {
  const history = read('pages', 'billing', 'PaymentHistory.jsx');
  // GET /api/payments/history serves payment_history and had no caller at all before this screen
  assert.match(history, /\/api\/payments\/history/);
  // Through API_BASE, or a relative URL resolves to admin.xlandinfra.com instead of xlandinfra.com
  assert.match(history, /const API_BASE = import\.meta\.env\.VITE_API_URL \|\| ''/);
  assert.match(history, /\$\{API_BASE\}\/api\/payments\/history/);
});

test('every action the server writes to payment_history has a label here', () => {
  const history = read('pages', 'billing', 'PaymentHistory.jsx');
  // The five the column held as an ENUM, plus the three schema_v27 widened it for — see
  // backend/utils/paymentHistoryAction.js, where writing one outside the list once cost a payment.
  for (const action of [
    'created', 'updated', 'status_changed', 'refunded', 'deleted',
    'razorpay_payment', 'failed', 'refund'
  ]) {
    assert.match(history, new RegExp(`\\b${action}:`), `${action} has no row style`);
  }
});

test('the disabled Razorpay block and its dead fetch are gone from Payments', () => {
  const payments = read('pages', 'billing', 'Payments.jsx');
  // `{false && (` wrapped ~190 lines that could never render. Anchored to the start of a line so
  // the comment above, which names the pattern it is warning about, is not itself the offender.
  assert.doesNotMatch(payments, /^\s*\{false &&/m, 'a permanently disabled block is back');
  // The tab state that only ever chose whether to make that request
  for (const dead of ['activeTab', 'razorpayHistory', 'fetchRazorpayHistory', 'getInitialTab']) {
    assert.doesNotMatch(payments, new RegExp(`\\b${dead}\\b`), `${dead} is back in Payments.jsx`);
  }
});

test('no screen links to /payments/history, which was never a route', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/\.jsx?$/.test(file) || file.endsWith('.test.js')) continue;
      // The real path is billing/payment-history; FPPaymentDashboard's "View All" went nowhere
      if (/['"`]\/\w+\/payments\/history/.test(fs.readFileSync(file, 'utf8'))) {
        offenders.push(path.relative(src, file));
      }
    }
  };
  walk(src);
  assert.deepEqual(offenders, [], 'link to /<portal>/billing/payment-history instead');
});
