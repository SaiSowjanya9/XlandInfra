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
const { calculateInvoiceAmounts, GST_RATE } = require('./invoiceService');

/**
 * An invoice charges the GST the estimate carried, and an estimate carries none unless someone set
 * one. This used to apply a hardcoded 18 whatever the estimate said, so an estimate quoted, sent
 * and approved at 0% was billed at 18% -- the customer agreed to one figure and paid another.
 */
test('a rate nobody set is no tax at all', () => {
  const amounts = calculateInvoiceAmounts(100000);
  assert.equal(amounts.taxPercentage, 0);
  assert.equal(amounts.taxAmount, 0);
  assert.equal(amounts.totalAmount, 100000);
  // The same for every shape of "not set" a row or a form can produce
  for (const nothing of [undefined, null, 0, '', '0', NaN]) {
    assert.equal(calculateInvoiceAmounts(100000, 0, nothing).taxAmount, 0, String(nothing));
  }
});

test('the rate it is given is charged, and charged after the discount', () => {
  const amounts = calculateInvoiceAmounts(100000, 10, 18);
  assert.equal(amounts.discountAmount, 10000);
  assert.equal(amounts.taxPercentage, 18);
  assert.equal(amounts.taxAmount, 16200);       // 18% of 90,000, not of 100,000
  assert.equal(amounts.totalAmount, 106200);
  assert.equal(amounts.balanceAmount, amounts.totalAmount);
  // A rate arriving as a string from a form or a DECIMAL column is still a rate
  assert.deepEqual(calculateInvoiceAmounts(100000, 10, '18'), amounts);
});

test('a rate other than the statutory one is honoured, not rounded to 18', () => {
  assert.equal(calculateInvoiceAmounts(50000, 0, 5).taxAmount, 2500);
  assert.equal(calculateInvoiceAmounts(50000, 0, 12).taxAmount, 6000);
});

test('GST_RATE is the statutory rate, not a fallback', () => {
  // It is exported for a screen that offers 18% as a choice. Nothing may use it to fill a blank:
  // that is what silently taxed a zero-rated estimate.
  assert.equal(GST_RATE, 18);
  assert.notEqual(calculateInvoiceAmounts(100000).taxPercentage, GST_RATE);
});
