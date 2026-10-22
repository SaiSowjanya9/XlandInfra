const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Guards for the payment -> receipt -> customer/email routes.
 *
 * Three failure shapes this file exists to prevent:
 *  - a payment route building its own nodemailer transporter off credentials nothing
 *    configures (production EAUTH), instead of the shared services/emailService sender;
 *  - the receipt email HTML living in two copies in payments.js, so a fix to one path
 *    silently missed the other;
 *  - the customer portal showing 'Paid' with no way to see or download the receipt —
 *    /api/payments/:id/receipt is staff-only, so customers get their own scoped routes.
 *
 * Run: node --test backend/routes/paymentReceiptRoutes.test.js
 */

const payments = fs.readFileSync(path.join(__dirname, 'payments.js'), 'utf8');
const razorpay = fs.readFileSync(path.join(__dirname, 'razorpay.js'), 'utf8');
const customers = fs.readFileSync(path.join(__dirname, 'customers.js'), 'utf8');
const razorpayPayment = fs.readFileSync(path.join(__dirname, '..', 'services', 'razorpayPayment.js'), 'utf8');
const receiptEmail = fs.readFileSync(path.join(__dirname, '..', 'services', 'receiptEmail.js'), 'utf8');

test('no payment/receipt path keeps an ad-hoc nodemailer transporter', () => {
  for (const [name, src] of [['payments.js', payments], ['razorpay.js', razorpay], ['customers.js', customers]]) {
    assert.doesNotMatch(src, /nodemailer\.createTransport/,
      `${name} creates its own transporter — receipts must go through services/emailService`);
  }
});

test('every receipt email goes through the shared services/receiptEmail sender', () => {
  const verifyIdx = payments.indexOf("router.put('/:id/verify'");
  const resendIdx = payments.indexOf("router.post('/:id/receipt/send'");
  assert.match(payments.slice(verifyIdx, resendIdx), /sendReceiptEmail/,
    'the verify route emails a receipt but not through the shared sender');
  assert.match(payments.slice(resendIdx), /sendReceiptEmail/,
    'the resend route keeps its own email body — it must share the sender');
});

test('a Razorpay payment emails the receipt post-commit, only when newly recorded', () => {
  const commitIdx = razorpayPayment.indexOf('connection.commit()');
  const emailIdx = razorpayPayment.indexOf('sendReceiptEmail');
  assert.ok(commitIdx > -1 && emailIdx > commitIdx,
    'the receipt email must run after the payment commit — never inside the transaction');
  // A duplicate webhook/callback returns through the alreadyRecorded branch before this point
  const dupIdx = razorpayPayment.indexOf('alreadyRecorded: true');
  assert.ok(dupIdx > -1 && dupIdx < emailIdx,
    'the duplicate path must return before the email or a retried webhook sends it twice');
});

test('receipt_sent is only written after the shared send reports success', () => {
  assert.match(razorpayPayment, /receiptResult\.success[\s\S]*receipt_sent = 1/,
    'receipt_sent is set without checking the send result');
});

test('customers get their own receipt routes, scoped to their own invoice', () => {
  assert.match(customers, /router\.get\('\/payments\/:id\/receipt'/);
  assert.match(customers, /router\.get\('\/payments\/:id\/receipt\/pdf'/);
  // The ownership check must run before serving — a payment row id is guessable
  assert.match(customers, /customerCanAccessInvoice/,
    'the customer receipt routes serve a payment without checking it is theirs');
  // Only settled money gets a receipt — a verification_pending row is not one
  assert.match(customers, /p\.status IN \('completed', 'paid', 'refunded'\)/,
    'customer receipts must not open for pending or failed payments');
});

test('the shared sender builds the PDF and mails it in one place', () => {
  assert.match(receiptEmail, /generateReceiptPDF/);
  assert.match(receiptEmail, /sendEmail\(/);
  assert.match(receiptEmail, /Receipt_\$\{paymentData\.paymentId\}\.pdf/);
});
