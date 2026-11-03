const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Razorpay does not write to the customer; XLAND does.
 *
 * A Payment Link created with `notify.email: true` makes Razorpay send its own mail: branded as
 * Razorpay, headed "Payment requested by XLAND INFRA PRIVATE LIMITED", carrying a "This Payment
 * Link is created in Test Mode" banner whenever the keys are test keys, and naming the link id
 * (`plink_…`) rather than the invoice. The customer received that beside our own invoice email —
 * two requests for the same money, one of them stamped Test Mode.
 *
 * `reminder_enable` has to go off with it. Reminders are the same Razorpay mail sent again days
 * later and are governed separately (Razorpay's docs: pass `reminder_enable: false` to disable
 * them for a link), so turning off `notify.email` alone leaves the mail arriving on a delay.
 *
 * Our own invoice email still carries the Pay Now button, to `/pay/<invoice>`, so nothing the
 * customer needs went with it.
 *
 * Run: node --test backend/services/paymentLinkNotifications.test.js
 */

const root = path.join(__dirname, '..');
const CREATORS = [
  ['services/invoiceService.js', 'the invoice send and auto-generated link'],
  ['routes/razorpay.js', 'the staff payment link'],
  ['routes/customers.js', "the customer portal's own link"]
];

// The options object handed to `paymentLink.create`, so the assertions read that call and not
// some unrelated `email: true` elsewhere in a 3,000-line route file
const linkOptions = source => {
  const at = source.indexOf('paymentLink.create(');
  assert.ok(at > 0, 'no paymentLink.create in this file');
  return source.slice(Math.max(0, at - 2500), at);
};

test('no payment link asks Razorpay to notify the customer', () => {
  for (const [file, what] of CREATORS) {
    const options = linkOptions(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.match(options, /notify:\s*\{\s*sms:\s*false,\s*email:\s*false\s*\}/,
      `${what} lets Razorpay mail or text the customer`);
    assert.match(options, /reminder_enable:\s*false/,
      `${what} leaves Razorpay's reminders on, which send the same mail days later`);
  }
});

test('every payment link the backend creates is one of those three', () => {
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'uploads'].includes(entry.name)) walk(full);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')
        && fs.readFileSync(full, 'utf8').includes('paymentLink.create(')) {
        found.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  };
  walk(root);
  assert.deepEqual(found.sort(), CREATORS.map(([file]) => file).sort(),
    'a new payment-link creator must decide about Razorpay notifications too');
});
