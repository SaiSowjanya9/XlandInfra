import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The invoice document is one document: the view modal, the PDF download, the emailed PDF, the
 * email body and the customer's own copy list the same services in the same columns.
 *
 * Each screen used to build its own pair of tables -- "Services Included" and "Services" -- by
 * sniffing the word "addon" out of a description, while the PDF drew a single
 * `# / Description / Frequency / Visits / Qty / Amount` table whose Amount was the AMC package
 * price divided by the number of services it covered. The same invoice therefore read differently
 * on screen and on paper (an add-on showed "Quarterly / Rs. 3,360" in the modal and "Other / 0" in
 * the PDF), and the customer portal rendered the services half only, so an added service was
 * missing from the customer's copy entirely.
 *
 * Run: node --test admin-portal/src/utils/invoiceDocumentView.test.js
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repo, ...parts), 'utf8');

// The document's columns, in the order every surface prints them
const COLUMNS = ['#', 'Service', 'Description', 'Input / Details', 'Method', 'Frequency', 'Visits'];

const SCREENS = [
  ['admin-portal/src/pages/billing/GeneratedInvoices.jsx', 'the generated-invoice modal'],
  ['admin-portal/src/pages/billing/Invoices.jsx', 'the sent-invoice modal'],
  ['admin-portal/src/pages/FPInvoiceView.jsx', 'the FP invoice page']
];

test('the shared table carries the document columns, in order', () => {
  const body = read('admin-portal/src/components/billing/InvoiceServicesTable.jsx');
  const order = COLUMNS.map(label => body.indexOf(`'${label}'`));
  for (const [index, at] of order.entries()) {
    assert.ok(at > 0, `${COLUMNS[index]} is not a column of InvoiceServicesTable`);
    if (index) assert.ok(at > order[index - 1], `${COLUMNS[index]} is out of order`);
  }
  // No money in the table at all: the invoice is priced in the Price Summary beside it, and the
  // PDFs state no services total either -- one directly above a Subtotal said the same figure twice
  assert.doesNotMatch(body, /'(Price|Amount|Qty|Customer Price)'/, 'a per-service money column is back');
  assert.doesNotMatch(body, /Total Services Price/, 'the table foots to a total the PDF does not print');
});

test('no surface foots the services table to a total', () => {
  // The screen and the PDF agree on what the table does not say, too
  for (const file of ['backend/services/pdfService.js', 'frontend/src/pages/Payment.jsx',
    'admin-portal/src/components/billing/InvoiceServicesTable.jsx']) {
    const body = read(...file.split('/'));
    assert.doesNotMatch(body, /Total Services Price: Rs\.|>Total Services Price</, `${file} states a services total`);
  }
});

test('the PDF draws the same columns as the screen', () => {
  const pdf = read('backend/services/pdfService.js');
  const section = pdf.slice(pdf.indexOf('const SERVICE_COLUMNS'), pdf.indexOf('const serviceColumnWidth'));
  for (const label of COLUMNS) assert.match(section, new RegExp(`label: '${label.replace(/\//g, '\\/')}'`), `the PDF has no ${label} column`);
  // The invoice draws with the shared renderer rather than a table of its own
  const invoice = pdf.slice(pdf.indexOf('const generateInvoicePDF'), pdf.indexOf('const generateReceiptPDF'));
  assert.match(invoice, /drawServicesTable\(/, 'the invoice PDF does not use the shared services table');
  assert.doesNotMatch(invoice, /label: 'Amount'|label: 'Qty'/, "the invoice PDF's per-row Amount/Qty columns are back");
});

test('the email prints the same columns too', () => {
  const body = read('backend/utils/invoiceDocument.js');
  const listed = body.slice(body.indexOf('const INVOICE_SERVICE_COLUMNS'));
  for (const label of COLUMNS) assert.ok(listed.includes(`'${label}'`), `the invoice email has no ${label} column`);
});

for (const [file, what] of SCREENS) {
  test(`${what} mounts the shared services table`, () => {
    const body = read(...file.split('/'));
    assert.match(body, /InvoiceServicesTable/, `${what} draws its own services table`);
    // Nothing splits the document's rows back into services and add-ons
    assert.doesNotMatch(body, /type === 'addon'/, `${what} still sniffs add-ons out of the rows`);
    assert.doesNotMatch(body, /Services Included/, `${what} still carries the two-table layout`);
  });
}

test("the customer's copy lists every service, in the same columns", () => {
  const body = read('frontend/src/pages/Payment.jsx');
  for (const label of COLUMNS) assert.ok(body.includes(`'${label}'`), `the customer's invoice view has no ${label} column`);
  assert.doesNotMatch(body, /filter\(item => item\.type === 'addon'\)/, "the customer's view splits the rows again");
  assert.match(body, /invoice\.services/, "the customer's view does not read the resolved document");
});

test('no screen renders an invoice service from the raw stored snapshot alone', () => {
  // Every surface prefers `services` (resolved from the estimate) and falls back to `lineItems`
  for (const [file, what] of SCREENS) {
    const body = read(...file.split('/'));
    assert.match(body, /services=\{(invoice|selectedInvoice)\.services \|\|/, `${what} does not prefer the resolved services`);
  }
});

test('there is one invoice PDF, and it is the server’s', () => {
  const exporter = read('admin-portal/src/utils/pdfExport.js');
  assert.doesNotMatch(exporter, /exportInvoiceToPDF/, 'a second invoice PDF layout is back in the client');
  for (const [file, what] of [...SCREENS, ['admin-portal/src/pages/billing/Invoices.jsx', 'the sent-invoice screen']]) {
    const body = read(...file.split('/'));
    if (/download/i.test(body)) {
      assert.doesNotMatch(body, /exportInvoiceToPDF/, `${what} downloads a client-built invoice PDF`);
    }
  }
});
