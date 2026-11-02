const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// The service pulls in the database pool and the mailer at require time; neither is needed to add up
const originalLoad = Module._load;
Module._load = function (request) {
  if (request === '../config/database') return { pool: { execute: async () => [[]], query: async () => [[]] } };
  if (request === 'nodemailer') return { createTransport: () => ({ sendMail: async () => ({}) }) };
  return originalLoad.apply(this, arguments);
};
const invoiceService = require('./invoiceService');
const { calculateInvoiceAmounts } = invoiceService;

/**
 * An invoice carries no GST. It used to apply a hardcoded 18 whatever the estimate said, so an
 * estimate quoted, sent and approved at 0% was billed at 18% -- the customer agreed to one figure
 * and paid another. GST is now 0 on every invoice and no invoice document shows a GST line.
 */
test('an invoice is never taxed', () => {
  const amounts = calculateInvoiceAmounts(100000);
  assert.equal(amounts.taxPercentage, 0);
  assert.equal(amounts.taxAmount, 0);
  assert.equal(amounts.totalAmount, 100000);
  assert.equal(amounts.balanceAmount, 100000);
});

test('the discount is the only thing taken off the subtotal', () => {
  const amounts = calculateInvoiceAmounts(100000, 10);
  assert.equal(amounts.discountAmount, 10000);
  assert.equal(amounts.taxPercentage, 0);
  assert.equal(amounts.taxAmount, 0);
  assert.equal(amounts.totalAmount, 90000);
  assert.equal(amounts.balanceAmount, amounts.totalAmount);
});

test('no caller can pass a rate back in', () => {
  // A third argument is ignored rather than charged: reinstating GST must take a code change,
  // not a stray argument from one call site.
  assert.equal(calculateInvoiceAmounts(50000, 0, 18).taxAmount, 0);
  assert.equal(calculateInvoiceAmounts(50000, 0, 18).totalAmount, 50000);
});

test('no statutory rate is exported for anything to fall back on', () => {
  assert.equal(invoiceService.GST_RATE, undefined);
});
