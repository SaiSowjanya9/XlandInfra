const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * PUT /api/payments/:id/verify settles its invoice through utils/invoiceSettlement.js, which
 * sums `SUM(amount) ... status IN ('paid','completed')` — a sum that already contains the
 * payment it just marked. The route used to add `p.amount` on top of that sum, so every
 * verified payment was counted twice: a single ₹1,00,870 payment wrote amount_paid =
 * ₹2,01,740 and balance ₹0 — the clamped balance hid the over-count on the invoice itself.
 *
 * It used to run each statement on `pool` too, so a failure mid-way left the payment marked
 * paid while the invoice said otherwise. The guards: settlement goes through the shared
 * resync, inside one transaction, and nothing is added to the payments-table sum.
 *
 * Run: node --test backend/routes/paymentsVerify.test.js
 */

const routes = fs.readFileSync(path.join(__dirname, 'payments.js'), 'utf8');
const settlement = fs.readFileSync(path.join(__dirname, '..', 'utils', 'invoiceSettlement.js'), 'utf8');

const verifyStart = routes.indexOf("router.put('/:id/verify'");
const verifyBlock = routes.slice(verifyStart, verifyStart + 40000);

test('the payment is marked inside a transaction before its invoice is resynced', () => {
  const beginIdx = verifyBlock.indexOf('beginTransaction()');
  const updateIdx = verifyBlock.indexOf('UPDATE payments SET', beginIdx);
  const resyncIdx = verifyBlock.indexOf('resyncInvoiceSettlement(p.invoice_id, connection)');
  const commitIdx = verifyBlock.indexOf('commit()', resyncIdx);
  assert.ok(beginIdx > -1, 'the verify route opens no transaction');
  assert.ok(updateIdx > beginIdx, 'the payments UPDATE runs outside the transaction');
  assert.ok(resyncIdx > updateIdx, 'the invoice is resynced before the payment is marked — the sum is the truth only after the update');
  assert.ok(commitIdx > resyncIdx, 'the transaction is not committed after the resync');
});

test('the invoice settles through the shared resync — nothing is added to the sum', () => {
  assert.match(settlement, /COALESCE\(SUM\(amount\), 0\) AS total_paid/);
  assert.doesNotMatch(verifyBlock, /\+\s*(p\.amount|paymentAmount|finalAmount)/,
    'the verified payment is added on top of a sum that already includes it');
});

test('the receipt states the amount the verifier confirmed, not the requested amount', () => {
  // A verifier can correct the figure (amountReceived -> finalAmount); the receipt must show it
  assert.match(routes, /const amountPaid = parseFloat\(finalAmount\)/,
    'the receipt still reads p.amount — a corrected verification emails the wrong figure');
});

test('resending an invoice cannot downgrade a paid status back to sent', () => {
  // POST /invoices/:id/send used to write status='sent' unconditionally, so a resend of a paid
  // invoice produced a row that read sent and paid at once
  assert.match(routes, /status = CASE WHEN status IN \('paid', 'partially_paid'\) THEN status ELSE 'sent' END/,
    'the send route clobbers a paid status again');
});

test('POST /payments cannot settle an invoice for a non-settled status', () => {
  // 'failed' is a valid payments.status member — gating settlement on `!= verification_pending`
  // let a recorded "failed" payment increase amount_paid
  assert.match(routes, /RECORDABLE_STATUSES = \['completed', 'paid', 'verification_pending', 'pending', 'failed'\]/);
  assert.match(routes, /settlesInvoice = finalPaymentStatus === 'completed' \|\| finalPaymentStatus === 'paid'/);
});

test('editing a payment resyncs its invoice in the same transaction', () => {
  const editIdx = routes.indexOf("router.put('/:id', authenticate, canEditPayments");
  const editBlock = routes.slice(editIdx, editIdx + 8000);
  assert.match(editBlock, /beginTransaction\(\)/, 'the payment update is not transactional');
  assert.match(editBlock, /resyncInvoiceSettlement\(paymentRow\.invoice_id, connection\)/,
    'a changed amount or status leaves the invoice totals stale again');
});

test('the payments dashboard excludes archived invoices from its totals', () => {
  const dashIdx = routes.indexOf("router.get('/dashboard'");
  const dashBlock = routes.slice(dashIdx, dashIdx + 3000);
  assert.match(dashBlock, /i\.archived = 0 OR i\.archived IS NULL/,
    'archived invoices are summed into the dashboard totals');
});

test('deleting an invoice with recorded payments is refused', () => {
  const delIdx = routes.indexOf("router.delete('/invoices/:id'");
  const delBlock = routes.slice(delIdx, delIdx + 4000);
  assert.match(delBlock, /status\(409\)/, 'a paid invoice can still be hard-deleted, orphaning its payments');
  assert.match(delBlock, /UPDATE payments SET invoice_id = NULL/, 'pending intents are not detached before the delete');
});

test('the manual status route offers workflow states only — money states need a payment', () => {
  const statusIdx = routes.indexOf("router.put('/invoices/:id/status'");
  const block = routes.slice(statusIdx, statusIdx + 3500);
  // 'paid'/'partially_paid' selected by hand would write a settlement no payment explains
  assert.match(block, /validStatuses = \['sent', 'overdue', 'cancelled'\]/,
    'the status route still lets a click mark an invoice paid');
  assert.match(block, /status\(409\)/,
    'a paid invoice must refuse a manual status change that rewinds its money state');
});

test('no staff path can record or confirm more than the outstanding balance', () => {
  // Recording or verifying past the balance used to write amount_paid beyond total_amount —
  // the balance clamp hid it and the invoice still read Paid
  const postIdx = routes.indexOf("router.post('/payments'");
  const postBlock = routes.slice(postIdx, postIdx + 9000);
  assert.match(postBlock, /paymentAmount > invoiceBalance/, 'POST /payments accepts an overpaying amount');
  const recordIdx = routes.indexOf("router.post('/record'");
  const recordBlock = routes.slice(recordIdx, recordIdx + 9000);
  assert.match(recordBlock, /paymentAmount > invoiceBalance/, 'POST /record accepts an overpaying amount');
  assert.match(verifyBlock, /checkAmount > invoiceBalance/, 'a verifier can correct the amount past the balance');
});

test('payment emails go through the shared EMAIL_* transporter, not ad-hoc SMTP_* creds', () => {
  // The receipt sends built their own nodemailer transport on SMTP_USER/SMTP_PASS while
  // emailService uses EMAIL_USER/EMAIL_PASS — a deployment that only sets EMAIL_* got
  // EAUTH "Missing credentials for PLAIN" on every receipt.
  assert.doesNotMatch(routes, /SMTP_USER/, 'payments.js still builds a transporter on SMTP_USER');
  assert.doesNotMatch(routes, /SMTP_PASS/, 'payments.js still builds a transporter on SMTP_PASS');
  const razorpayRoutes = fs.readFileSync(path.join(__dirname, 'razorpay.js'), 'utf8');
  assert.doesNotMatch(razorpayRoutes, /SMTP_USER|SMTP_PASS/, 'razorpay.js still uses SMTP_* creds');
});

test('the scheduling trigger repairs the pending_property_schedules schema first', () => {
  // added_at/updated_at came from schema_v22's CREATE TABLE IF NOT EXISTS, which never adds
  // columns to an existing table — drifted deployments failed the whole trigger with
  // ER_BAD_FIELD_ERROR on 'added_at'.
  const workflow = fs.readFileSync(path.join(__dirname, '..', 'services', 'schedulingWorkflow.js'), 'utf8');
  const markIdx = workflow.indexOf('function markPaymentCompleted');
  const markBlock = workflow.slice(markIdx, markIdx + 4000);
  assert.match(markBlock, /ensurePendingScheduleSchema\(\)/,
    'markPaymentCompleted writes added_at/updated_at without the drift ensure');
});
