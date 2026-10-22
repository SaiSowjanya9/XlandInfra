const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  CURRENT_METHODS, STORABLE_METHODS, ONLINE_METHODS, OFFLINE_METHODS,
  normalizePaymentMethod, resolvePaymentMethod
} = require('./paymentMethods');

/**
 * `payments.payment_method` is an ENUM, and POST /payments inserts straight into it inside the
 * payment's own transaction. A value the column cannot hold raises WARN_DATA_TRUNCATED (errno
 * 1265), which rolled the whole payment back -- the staff member recorded a payment and nothing
 * was saved. The admin Invoices screen was offering `debit_credit_card`, which is not a member and
 * never has been.
 */

test('the current methods are Razorpay and the three offline ones', () => {
  assert.deepEqual(ONLINE_METHODS, ['razorpay']);
  assert.deepEqual(OFFLINE_METHODS, ['cash', 'cheque', 'bank_transfer']);
  // Everything taken online is 'razorpay' whatever the instrument was, so there is no separate
  // card or net banking method to offer.
  assert.ok(!CURRENT_METHODS.includes('credit_card'));
  assert.ok(!CURRENT_METHODS.includes('net_banking'));
});

test('a value the column cannot hold is refused, not written', () => {
  // The exact value the Invoices screen used to send
  const refused = resolvePaymentMethod('debit_credit_card');
  assert.match(refused.error, /Unsupported payment method/);
  assert.equal(refused.method, undefined);
  // And the message says what to send instead, naming only the current methods
  assert.match(refused.error, /razorpay, cash, cheque, bank_transfer/);

  assert.equal(normalizePaymentMethod('debit_credit_card'), null);
  assert.equal(normalizePaymentMethod('gift_card'), null);
});

test('a missing method is its own message', () => {
  for (const empty of ['', '   ', null, undefined]) {
    assert.match(resolvePaymentMethod(empty).error, /required/);
  }
});

test('the UI spellings resolve to the member the column holds', () => {
  // 'check' is what the forms say; 'cheque' is the canonical member, so one method is never
  // stored under two names on a current database
  assert.equal(normalizePaymentMethod('check'), 'cheque');
  assert.equal(normalizePaymentMethod('bank'), 'bank_transfer');
  // Both Razorpay radios in MakePayments end at the same flow
  assert.equal(normalizePaymentMethod('upi_razorpay'), 'razorpay');
  // Case and surrounding space are not the caller's problem
  assert.equal(normalizePaymentMethod('  Bank_Transfer '), 'bank_transfer');
  // Request text is escaped by middleware/security.js before it reaches a route
  assert.equal(normalizePaymentMethod('bank&#x5F;transfer'), 'bank_transfer');
});

test('every current method is storable, and every storable one resolves to itself', () => {
  for (const method of CURRENT_METHODS) {
    assert.ok(STORABLE_METHODS.includes(method), `${method} is offered but not storable`);
    assert.equal(resolvePaymentMethod(method).method, method, method);
  }
  // A retired member is still accepted so an existing screen does not become a 400
  assert.equal(normalizePaymentMethod('upi_manual'), 'upi_manual');
  assert.equal(normalizePaymentMethod('card_pos'), 'card_pos');
});

test('the storable list matches the ENUM the schema declares', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'schema_v20_entity_linkage.sql'), 'utf8'
  );
  const declared = schema.match(/MODIFY COLUMN payment_method ENUM\(([^)]*)\)/);
  assert.ok(declared, 'schema_v20 no longer declares the payment_method ENUM');
  const members = [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const member of members) {
    assert.ok(STORABLE_METHODS.includes(member), `${member} is in the ENUM but not STORABLE_METHODS`);
  }
  // The two utils/paymentColumns.js widens the column for at runtime
  for (const widened of ['check', 'upi']) {
    assert.ok(STORABLE_METHODS.includes(widened), widened);
  }
});

test('no payment is written without going through the guard', () => {
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'payments.js'), 'utf8');
  // Both manual-record routes resolve the method and insert the resolved value
  assert.equal((routes.match(/resolvePaymentMethod\(paymentMethod\)/g) || []).length, 2);
  assert.equal((routes.match(/^\s+storedPaymentMethod,$/gm) || []).length, 2);
  // And neither binds the raw request value. In both INSERTs the method sits directly after the
  // amount, which is specific enough not to trip over the verify route's req.body destructure.
  assert.doesNotMatch(routes, /paymentAmount,\s*\r?\n\s*paymentMethod,/,
    'a manual payment INSERT still binds the unvalidated request value');
});

test('no screen offers a method that cannot be stored', () => {
  const src = path.join(__dirname, '..', '..', 'admin-portal', 'src');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/\.jsx?$/.test(file) || file.endsWith('.test.js')) continue;
      const text = fs.readFileSync(file, 'utf8');
      // A picker offers a method as `value: 'x'` or `<option value="x">`
      for (const match of text.matchAll(/(?:value:\s*|value=)["']([a-z_]+)["']/g)) {
        const candidate = match[1];
        // Only judge things that look like a payment method, not every select in the portal
        if (!/^(?:cash|cheque|check|bank|bank_transfer|upi\w*|card\w*|credit\w*|debit\w*|net_banking|wallet|razorpay\w*)$/.test(candidate)) continue;
        if (!normalizePaymentMethod(candidate)) {
          offenders.push(`${path.relative(src, file)}: ${candidate}`);
        }
      }
    }
  };
  walk(src);
  assert.deepEqual(offenders, [], 'these would truncate payments.payment_method');
});
