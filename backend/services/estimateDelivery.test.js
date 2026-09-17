const { test } = require('node:test');
const assert = require('node:assert/strict');
let mail;
require.cache[require.resolve('nodemailer')] = { exports: { createTransport: () => ({ sendMail: async options => { mail = options; return { messageId: 'mock-message' }; } }) } };
require.cache[require.resolve('../config/database')] = { exports: { pool: { execute: async () => { throw new Error('Unexpected database access'); } } } };
const PDFDocument = require('pdfkit');
const { sendEstimateEmail } = require('./emailService');

test('customer email and PDF retain catalog details, zero GST and decimals without internal prices', async t => {
  const texts = [];
  const originalText = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function (text, ...args) { texts.push(String(text)); return originalText.call(this, text, ...args); };
  t.after(() => { PDFDocument.prototype.text = originalText; });
  const result = await sendEstimateEmail({ estimateId: 'EST-DELIVERY', estimateType: 'custom', customerName: 'Customer', customerEmail: 'customer@example.test',
    propertyCode: 'PROP-TEST', propertyType: 'APT', address: 'Saved address', createdAt: '2026-09-16', subtotal: 11700.25, total: 11700.25, tax: 0, gstPercent: 0,
    addons: [{ catalogServiceId: 1, name: 'Tank <Cleaning>', description: 'Inspect <script>unsafe</script>', totalPrice: 11700.25,
      frequency_type: 'Half-Yearly', frequency_count: 2, pricingInputs: { capacity: 10, operating_cost: 876.54, markup_percentage: 30 },
      pricingSnapshot: { pricing_method: 'capacity_based', unit: 'KL', vendorCost: 9123.45, profit: 2700 } }]
  }, 'test-action-token');
  assert.equal(result.success, true);
  assert.match(mail.html, /Tank &lt;Cleaning&gt;/);
  assert.match(mail.html, /Half-Yearly - 2 visits/);
  assert.match(mail.html, /Capacity Based/);
  assert.match(mail.html, /10 KL/);
  assert.match(mail.html, /11,700.25/);
  assert.match(mail.html, /GST \(0%\)/);
  assert.doesNotMatch(mail.html, /<script>|9123.45|876.54|vendorCost|pricingSnapshot|operating_cost/);
  assert.equal(mail.attachments.length, 1);
  assert.equal(mail.attachments[0].content.subarray(0, 4).toString(), '%PDF');
  const pdfText = texts.join('\n');
  assert.match(pdfText, /10 KL/);
  assert.match(pdfText, /11,700.25/);
  assert.match(pdfText, /PROP-TEST/);
  assert.match(pdfText, /Saved address/);
  assert.doesNotMatch(pdfText, /9123.45|876.54|vendorCost|pricingSnapshot|operating_cost/);
});

test('manpower email and PDF show the selected range, personnel and overtime without internal rates', async t => {
  const texts = [];
  const originalText = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function (text, ...args) { texts.push(String(text)); return originalText.call(this, text, ...args); };
  t.after(() => { PDFDocument.prototype.text = originalText; });
  const result = await sendEstimateEmail({ estimateId: 'EST-MANPOWER', estimateType: 'custom', customerEmail: 'customer@example.test', subtotal: 15912, total: 15912,
    addons: [{ catalogServiceId: 9, name: 'Housekeeping', totalPrice: 15912,
      pricingInputs: { personnel: 2, area: 1500, frequency: 'Monthly', visits: 12, working_hours_per_visit: 2, overtime_hours_per_visit: 1,
        manpower_range: { areaFrom: 1001, areaTo: 2000, recommendedMin: 2, recommendedMax: 3 } },
      pricingSnapshot: { pricing_method: 'manpower', unit: 'Persons', manpower_basis: 'per_visit', role_designation: 'Housekeeping Staff',
        rate_per_person: 450, overtime_rate_per_hour: 60, vendorCost: 12240, profit: 3672 } }]
  }, 'test-token');
  assert.equal(result.success, true);
  const pdfText = texts.join('\n');
  for (const text of ['Housekeeping Staff', 'Personnel: 2 Persons', '1500 Sq Ft', '1001–2000 Sq Ft', 'Overtime Hours: 1']) {
    assert.ok(mail.html.includes(text), text);
    assert.ok(pdfText.includes(text), text);
  }
  assert.match(mail.html, /Monthly - 12 visits/);
  assert.doesNotMatch(mail.html + pdfText, /12,240|3,672|rate_per_person|overtime_rate_per_hour|vendorCost|profit/);
});

test('PDF generation failure does not send a customer email without its attachment', async t => {
  const originalText = PDFDocument.prototype.text;
  PDFDocument.prototype.text = () => { throw new Error('Simulated PDF failure'); };
  t.after(() => { PDFDocument.prototype.text = originalText; });
  mail = null;
  const result = await sendEstimateEmail({ estimateId: 'EST-FAILED', customerEmail: 'customer@example.test', total: 100 }, 'test-token');
  assert.equal(result.success, false);
  assert.equal(mail, null);
});
