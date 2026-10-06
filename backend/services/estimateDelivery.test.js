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
      pricingSnapshot: { pricing_method: 'capacity_based', unit: 'KL', category: 'Water Management', default_markup_percentage: 30,
        applicable_property_types: ['APT', 'VILLA'], vendorCost: 9123.45, profit: 2700 } }]
  }, 'test-action-token');
  assert.equal(result.success, true);
  assert.match(mail.html, /Tank &lt;Cleaning&gt;/);
  assert.match(mail.html, /Half-Yearly[\s\S]{0,240}>\s*2\s*</, 'frequency and its visit count have columns of their own');
  assert.match(mail.html, /10 KL/);
  assert.match(mail.html, /11,700.25/);
  assert.match(mail.html, /GST \(0%\)/);
  assert.doesNotMatch(mail.html, /<script>|9123.45|876.54|vendorCost|pricingSnapshot|operating_cost/);
  // The letterhead's mark and its three contact icons are attached and referenced by Content-ID:
  // hotlinking them puts the header behind the "display images" prompt, and Gmail strips an SVG.
  assert.deepEqual(mail.attachments.filter(item => item.cid).map(item => item.cid),
    ['xland-logo', 'xland-icon-phone', 'xland-icon-email', 'xland-icon-website']);
  const attachedPdf = mail.attachments.find(item => String(item.filename).endsWith('.pdf'));
  assert.equal(attachedPdf.content.subarray(0, 4).toString(), '%PDF');
  const pdfText = texts.join('\n');
  assert.match(pdfText, /10 KL/);
  assert.match(pdfText, /11,700.25/);
  assert.match(pdfText, /PROP-TEST/);
  assert.match(pdfText, /Saved address/);
  assert.doesNotMatch(pdfText, /9123.45|876.54|vendorCost|pricingSnapshot|operating_cost/);
  // What the customer reads of a service: its category, how it is priced and what was measured at
  // their property -- every column of the portal's view but the internal costs
  for (const text of ['Water Management', 'Capacity Based', '10 KL']) {
    assert.ok(mail.html.includes(text), `email: ${text}`);
    assert.ok(pdfText.includes(text), `pdf: ${text}`);
  }
  // The category belongs with the service name, not in the Description column. In the email it
  // follows the name immediately; in the PDF the Service cell is drawn with both.
  assert.match(mail.html, /<strong[^>]*>Tank &lt;Cleaning&gt;<\/strong>\s*<br><span[^>]*>Water Management<\/span>/);
  assert.ok(texts.some(text => /^Tank <Cleaning>\nWater Management$/.test(text)), 'pdf service cell carries the category');
  // Every field of the service has its own column in the attachment. No Qty and no Price: the
  // estimate is priced as a whole, in Total Services Price and the Price Summary, and the printed
  // and downloaded estimate reads the same. Figures say "Rs." (PDFKit's built-in Helvetica has no
  // rupee glyph, so a ₹ would print as a stray mark).
  // Compared without case: a column heading is drawn in caps on the cream header bar
  const headings = texts.map(text => text.toUpperCase());
  for (const heading of ['Service', 'Description', 'Frequency', 'Visits']) {
    assert.ok(headings.includes(heading.toUpperCase()), `pdf column: ${heading}`);
  }
  assert.ok(!headings.includes('QTY'), 'no Qty column');
  assert.ok(!headings.includes('PRICE'), 'no per-service Price column');
  assert.ok(texts.includes('Rs. 11,700.25'), 'the estimate is still priced, in its summary');
  // The derived input label and the types the service is configured for are ours. The measured
  // amount has its own Input / Details column, so the description does not repeat it.
  assert.ok(!texts.some(text => /Capacity: 10 KL/.test(text)), 'pdf: the amount is not repeated in the description');
  for (const text of ['Primary Input', 'Property Types']) {
    assert.ok(!mail.html.includes(text), `email leaked: ${text}`);
    assert.ok(!pdfText.includes(text), `pdf leaked: ${text}`);
  }
  // Markup is internal, so it is in neither
  assert.doesNotMatch(mail.html + pdfText, /[Mm]arkup/);
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
  for (const text of ['Housekeeping Staff', 'Manpower', '2 Persons', '1500 Sq Ft', '1001–2000 Sq Ft', 'Overtime Hours: 1']) {
    assert.ok(mail.html.includes(text), text);
    assert.ok(pdfText.includes(text), text);
  }
  assert.match(mail.html, /Monthly[\s\S]{0,240}>\s*12\s*</, 'frequency and its visit count have columns of their own');
  assert.doesNotMatch(mail.html + pdfText, /12,240|3,672|rate_per_person|overtime_rate_per_hour|vendorCost|profit/);
});

test('terms reach the email and the attached PDF only when the estimate carries them', async t => {
  const { DEFAULT_ESTIMATE_TERMS } = require('../utils/estimateTerms');
  const originalText = PDFDocument.prototype.text;
  t.after(() => { PDFDocument.prototype.text = originalText; });
  const send = async estimate => {
    const texts = [];
    PDFDocument.prototype.text = function (text, ...args) { texts.push(String(text)); return originalText.call(this, text, ...args); };
    const result = await sendEstimateEmail({ estimateId: 'EST-TERMS', customerEmail: 'customer@example.test', total: 100, ...estimate }, 'test-token');
    assert.equal(result.success, true);
    return { pdfText: texts.join('\n'), html: mail.html };
  };

  const included = await send({ include_terms: 1 });
  assert.match(included.pdfText, /TERMS & CONDITIONS/);
  for (const clause of DEFAULT_ESTIMATE_TERMS) assert.ok(included.pdfText.includes(clause), clause);
  // The customer reads the same terms wherever they open the estimate. They were once in the
  // attachment alone, to keep the message short; the message now carries the whole document.
  assert.match(included.html, /Terms &amp; Conditions|TERMS &amp; CONDITIONS/i);
  for (const clause of DEFAULT_ESTIMATE_TERMS) assert.ok(included.html.includes(clause), `email: ${clause}`);

  const custom = await send({ includeTerms: true, termsConditions: 'Only clause.\nSecond clause.' });
  assert.match(custom.pdfText, /1\. Only clause\./);
  assert.match(custom.pdfText, /2\. Second clause\./);
  assert.ok(!custom.pdfText.includes(DEFAULT_ESTIMATE_TERMS[0]));

  // Excluded, and an estimate created before the feature, print no terms at all
  for (const estimate of [{ include_terms: 0, terms_conditions: 'Not chosen.' }, {}]) {
    const excluded = await send(estimate);
    assert.doesNotMatch(excluded.pdfText, /TERMS & CONDITIONS|Not chosen\./);
    assert.doesNotMatch(excluded.html, /Terms &amp; Conditions|Not chosen\./i);
  }
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

// What the portal's view and printed copy show must reach the customer's email and its PDF too.
const captureEstimate = async (t, estimate) => {
  const texts = [];
  const originalText = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function (text, ...args) { texts.push(String(text)); return originalText.call(this, text, ...args); };
  t.after(() => { PDFDocument.prototype.text = originalText; });
  const result = await sendEstimateEmail(estimate, 'test-action-token');
  assert.equal(result.success, true);
  return { html: mail.html, pdf: texts.join('\n') };
};

test('a property-based package estimate emails the same totals, package note, billing and terms as the portal', async t => {
  const { html, pdf } = await captureEstimate(t, {
    estimateId: 'EST-PKG', estimateType: 'property_based', customerName: 'Charan', customerEmail: 'customer@example.test',
    propertyName: 'SS property', propertyType: 'GC', propertyCode: 'GC-1', packageName: 'GC Test', packagePrice: 45000,
    billingDuration: 'half-yearly', includeTerms: 1, termsConditions: 'Clause one.\nClause two.',
    services: [{ name: 'Deep Cleaning', frequencyType: 'Monthly', frequencyCount: 12 }, { name: 'Pest Control', frequencyType: 'Quarterly', frequencyCount: 4 }],
    addons: [{ name: 'Security Support', totalPrice: 336000, frequency_type: 'Monthly', frequency_count: 12 },
      { name: 'Common Area Cleaning', totalPrice: 6384, frequency_type: 'Monthly', frequency_count: 12 }],
    subtotal: 387384, total: 387384, tax: 0, gstPercent: 0
  });
  for (const [where, text] of [['email', html], ['PDF', pdf]]) {
    assert.match(text, /Total Services Price: Rs\. 3,87,384/, `${where}: the total includes the package price`);
    assert.doesNotMatch(text, /Total Services Price: Rs\. 3,42,384/, `${where}: not the added services alone`);
    assert.match(text, /Includes the AMC package (&ldquo;|")GC Test(&rdquo;|") at Rs\. 45,000/, `${where}: names the package beneath the total`);
    // No service states a price of its own: the added services' 3,36,000 and 6,384 are only in the total
    assert.doesNotMatch(text, /3,36,000|6,384/, `${where}: no per-service price`);
    assert.match(text, /Clause one\.[\s\S]*Clause two\./, `${where}: carries the estimate's Terms & Conditions`);
  }
  assert.match(html, /Half yearly/, 'the estimate\'s own billing period, not a default Yearly');
  assert.doesNotMatch(pdf, /^QTY$/m, 'the emailed PDF has no Qty column, like the printed one');
});

test('a direct custom estimate emails its total and terms, with no package note', async t => {
  const { html, pdf } = await captureEstimate(t, {
    estimateId: 'EST-DIRECT', estimateType: 'direct', customerName: 'Sai', customerEmail: 'customer@example.test', propertyType: 'VILLA',
    includeTerms: true, termsConditions: 'Direct clause.',
    addons: [{ name: 'Plumbing Service Visit', totalPrice: 3000, frequency_type: 'On Request', frequency_count: 0 }],
    subtotal: 3000, total: 3000, tax: 0, gstPercent: 0
  });
  for (const [where, text] of [['email', html], ['PDF', pdf]]) {
    assert.match(text, /Total Services Price: Rs\. 3,000/, `${where}: total`);
    assert.doesNotMatch(text, /Includes the AMC package/, `${where}: no package, no note`);
    assert.match(text, /Direct clause\./, `${where}: terms`);
  }
});
