/**
 * The invoice email's Pay Now link has to be one a customer can actually act on.
 *
 * Every offline payment started from an invoice email used to be lost: the URL carried no token,
 * `POST /public/record-payment-intent` demands one, and the page swallowed the 400 — so the
 * customer read the bank details while the team was shown no pending payment to verify. These
 * tests fail if a link goes out without a token again, if a writer hand-builds the URL instead
 * of using `paymentPageUrl`, or if a public write route goes back to looking an invoice up *by*
 * `payment_token_hash`, which no emailed token is ever stored in.
 */

process.env.PAYMENT_TOKEN_SECRET = process.env.PAYMENT_TOKEN_SECRET || 'test-payment-secret';
process.env.FRONTEND_URL = 'https://xlandinfra.com';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { invoicePaymentToken, authorizeInvoiceToken, paymentPageUrl } = require('./invoicePaymentToken');

const invoice = { id: 22, invoice_id: 'INV-00022' };
const other = { id: 23, invoice_id: 'INV-00023' };

test('the token is the same every time, so a re-send does not kill the first email', () => {
  const first = invoicePaymentToken(invoice);
  assert.ok(first && first.length > 20);
  assert.equal(invoicePaymentToken({ ...invoice }), first);
  // ...and it is the invoice's own: one invoice's token must not open another
  assert.notEqual(invoicePaymentToken(other), first);
  assert.equal(authorizeInvoiceToken(other, first), false);
});

test('authorisation accepts the link token and the stored-hash tokens, nothing else', () => {
  assert.equal(authorizeInvoiceToken(invoice, invoicePaymentToken(invoice)), true);

  // The QR and send-payment-link flows store sha256(token) on the row; both must keep working
  const qrToken = 'qr-token-value';
  const withHash = { ...invoice, payment_token_hash: crypto.createHash('sha256').update(qrToken).digest('hex') };
  assert.equal(authorizeInvoiceToken(withHash, qrToken), true);
  assert.equal(authorizeInvoiceToken(withHash, invoicePaymentToken(invoice)), true);

  for (const bad of ['', null, undefined, 'nope', invoicePaymentToken(invoice) + 'x']) {
    assert.equal(authorizeInvoiceToken(invoice, bad), false, `accepted ${JSON.stringify(bad)}`);
  }
});

test('the payment page URL carries a token that authorises the invoice', () => {
  const url = paymentPageUrl(invoice);
  assert.match(url, /^https:\/\/xlandinfra\.com\/pay\/INV-00022\?token=.+/);
  const token = decodeURIComponent(new URL(url).searchParams.get('token'));
  assert.equal(authorizeInvoiceToken(invoice, token), true);
});

test('without a secret the link still goes out, just as the tokenless one it replaced', () => {
  const secret = process.env.PAYMENT_TOKEN_SECRET;
  const jwt = process.env.JWT_SECRET;
  delete process.env.PAYMENT_TOKEN_SECRET;
  delete process.env.JWT_SECRET;
  try {
    assert.equal(invoicePaymentToken(invoice), null);
    assert.equal(paymentPageUrl(invoice), 'https://xlandinfra.com/pay/INV-00022');
  } finally {
    process.env.PAYMENT_TOKEN_SECRET = secret;
    if (jwt !== undefined) process.env.JWT_SECRET = jwt;
  }
});

const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const WRITERS = ['routes/payments.js', 'services/invoiceService.js', 'routes/razorpay.js'];

test('no invoice email builds its own /pay/ URL', () => {
  for (const file of WRITERS) {
    const text = source(file);
    assert.ok(text.includes("require('../utils/invoicePaymentToken')"),
      `${file} does not use the shared payment page URL`);
    // A hand-built link is a template literal ending in /pay/${...} — and is how the token
    // went missing from every invoice email in the first place
    assert.doesNotMatch(text, /\/pay\/\$\{/, `${file} builds a /pay/ URL by hand`);
  }
});

test('the public write routes authorise the token instead of querying by its hash', () => {
  const text = source('routes/razorpay.js');
  const routeBody = (marker) => {
    const start = text.indexOf(marker);
    assert.ok(start > 0, `${marker} is gone`);
    const end = text.indexOf("\nrouter.", start + marker.length);
    return text.slice(start, end < 0 ? undefined : end);
  };
  for (const marker of ["router.post('/public/payment-link'", "router.post('/public/record-payment-intent'"]) {
    const body = routeBody(marker);
    assert.match(body, /authorizeInvoiceToken\(/, `${marker} does not authorise the token`);
    assert.doesNotMatch(body, /payment_token_hash = \?/,
      `${marker} looks the invoice up by a hash an emailed token is never stored in`);
  }
});
