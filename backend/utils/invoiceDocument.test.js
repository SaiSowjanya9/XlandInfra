const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { invoiceDocument } = require('./invoiceDocument');

/**
 * An invoice bills an estimate's services, so every surface reads them from the estimate.
 *
 * The bugs this pins down were all live at once on INV-00021: the modal showed the add-on as
 * "Quarterly / Rs. 3,360" while the PDF of the same invoice showed "Other / 0"; every package
 * service printed the package price divided by the number of services (Rs. 497 each, summing to
 * nothing the summary stated); and every row printed its description twice, because the stored
 * line carried it as both `description` ("Name - detail") and `details` ("detail").
 *
 * Run: node --test backend/utils/invoiceDocument.test.js
 */

const estimate = {
  estimate_id: 'EST-1793641827962723',
  estimate_type: 'property_based',
  package_id: 7,
  package_name: 'AMC 4-Service Package',
  package_price: 4170,
  subtotal: 7530,
  total_amount: 7530,
  package_services: JSON.stringify([
    { name: 'Plumbing', description: 'This is a test message', frequencyType: 'Monthly', frequencyCount: 12, price: 1000 },
    { name: 'Deep Cleaning', description: 'Complete cleaning; stain removal best effort.', frequencyType: 'Yearly', frequencyCount: 1, price: 1200 }
  ]),
  addons_data: JSON.stringify([
    {
      addonId: 'CAT-51',
      name: 'CCTV Maintenance',
      category: 'Security',
      description: 'Routine inspection and basic troubleshooting; parts/replacement extra.',
      details: 'Routine inspection and basic troubleshooting; parts/replacement extra.\nSecurity | Quantity Based | Primary Input: Camera | Quantity: 8 Camera | Property Types: Apartment',
      pricing_method: 'quantity_based',
      unit: 'Camera',
      quantity: 8,
      frequencyType: 'Quarterly',
      frequencyCount: 4,
      totalPrice: 3360,
      pricingInputs: { quantity: 8, visits: 4, frequency: 'Quarterly' }
    }
  ])
};

// What the draft was raised with: the package price split evenly across its services, and the
// name repeated inside the description
const storedLineItems = [
  { name: 'Plumbing', description: 'Plumbing - This is a test message', details: 'This is a test message', quantity: 1, unit_price: 497, total_price: 497, type: 'service', frequency: 'Monthly', visits: 12 },
  { name: 'Deep Cleaning', description: 'Deep Cleaning - Complete cleaning; stain removal best effort.', details: 'Complete cleaning; stain removal best effort.', quantity: 1, unit_price: 497, total_price: 497, type: 'service', frequency: 'Yearly', visits: 1 }
];

const invoice = { invoice_id: 'INV-00021', source_estimate_id: estimate.estimate_id, subtotal: 7530, line_items: JSON.stringify(storedLineItems) };

test('the services come from the estimate, not the stored snapshot', () => {
  const document = invoiceDocument(invoice, estimate);
  assert.equal(document.source, 'estimate');
  // The add-on the snapshot never carried is listed
  assert.deepEqual(document.services.map(service => service.name), ['Plumbing', 'Deep Cleaning', 'CCTV Maintenance']);
  assert.equal(document.packageName, 'AMC 4-Service Package');
  assert.equal(document.packagePrice, 4170);
});

test('an add-on keeps the frequency and visits the estimate gave it', () => {
  const [, , cctv] = invoiceDocument(invoice, estimate).services;
  assert.equal(cctv.frequency, 'Quarterly', "the PDF used to read 'Other'");
  assert.equal(cctv.visits, 4);
  assert.equal(cctv.price, 3360, 'the PDF used to print 0 for an add-on');
  assert.equal(cctv.category, 'Security');
});

test("a package's own services are tagged, an added service is not", () => {
  const services = invoiceDocument(invoice, estimate).services;
  assert.deepEqual(services.map(service => service.tag), ['Package', 'Package', '']);
});

test('a description is stated once, and carries no internal segment', () => {
  const services = invoiceDocument(invoice, estimate).services;
  for (const service of services) {
    assert.doesNotMatch(service.description, new RegExp(`^${service.name}\\s-\\s`), `${service.name}: the name is repeated in its description`);
    assert.doesNotMatch(service.description, /Property Types:|Slab:|Rate:/, `${service.name}: an internal segment reached the document`);
  }
  assert.equal(services[0].description, 'This is a test message');
});

test('Method and Input / Details are projected for a configured service', () => {
  const [, , cctv] = invoiceDocument(invoice, estimate).services;
  assert.equal(cctv.method, 'Quantity Based');
  assert.equal(cctv.input, '8 Camera');
});

test('the services total is the invoice subtotal, never a per-row fiction', () => {
  const document = invoiceDocument(invoice, estimate);
  assert.equal(document.servicesTotal, 7530);
  // 497 was the package price divided by its service count; no row states it any more
  assert.ok(!document.services.some(service => service.price === 497));
});

test('an invoice with no estimate behind it still lists its stored lines, once', () => {
  const document = invoiceDocument({ invoice_id: 'INV-00007', subtotal: 2000, line_items: JSON.stringify([
    { description: 'Pest Control - Quarterly treatment', quantity: 1, total_price: 2000 }
  ]) }, null);
  assert.equal(document.source, 'line_items');
  assert.deepEqual(document.services.map(service => [service.name, service.description]), [['Pest Control', 'Quarterly treatment']]);
  assert.equal(document.servicesTotal, 2000);
});

test('a work order estimate bills the rows it stores in work_order_services', () => {
  const document = invoiceDocument({ subtotal: 5000 }, {
    estimate_id: 'EST-WO-1', estimate_type: 'work_order', work_order_id: 'WO-1', subtotal: 5000,
    work_order_services: JSON.stringify([{ name: 'Water Tank Cleaning', description: 'Two tanks', frequencyType: 'One-time', frequencyCount: 1, price: 5000 }])
  });
  assert.deepEqual(document.services.map(service => service.name), ['Water Tank Cleaning']);
});

test('a missing estimate falls back to the snapshot rather than an empty document', () => {
  const document = invoiceDocument(invoice, null);
  assert.equal(document.source, 'line_items');
  assert.equal(document.services.length, 2);
});

test('every surface resolves the document through this module', () => {
  // The two inline "enrichment" blocks this replaced read the AMC package's services and matched
  // the stored lines by position; they are what made the modal and the PDF disagree.
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  for (const file of ['routes/payments.js', 'routes/customers.js', 'services/invoiceService.js', 'services/emailService.js']) {
    const body = read(file);
    assert.match(body, /invoiceDocument/, `${file} does not resolve the invoice document`);
    assert.doesNotMatch(body, /amcPackageServicesByName/, `${file} rebuilds the services itself again`);
  }
});
