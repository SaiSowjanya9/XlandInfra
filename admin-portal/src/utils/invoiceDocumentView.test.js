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

// The document's columns, in the order every surface prints them.
//
// Method is on none of them: how XLAND prices a service (Capacity Slab, Area Based) is how the
// figure was arrived at, not something the customer is billed for, so the user asked for it off
// every invoice surface -- the PDFs and the email bodies, which never carried it, and the staff
// screens and the customer's own invoice view, which did.
const COLUMNS = ['#', 'Service', 'Description', 'Input / Details', 'Frequency', 'Visits'];

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

test('the PDF draws the same columns as the screen, less the Method it never prints', () => {
  const pdf = read('backend/services/pdfService.js');
  const section = pdf.slice(pdf.indexOf('const SERVICE_COLUMNS'), pdf.indexOf('const serviceColumnWidth'));
  for (const label of COLUMNS) assert.match(section, new RegExp(`label: '${label.replace(/\//g, '\\/')}'`), `the PDF has no ${label} column`);
  assert.doesNotMatch(section, /label: 'Method'/, "the PDF's Method column is back");
  // The invoice draws with the shared renderer rather than a table of its own
  const invoice = pdf.slice(pdf.indexOf('const generateInvoicePDF'), pdf.indexOf('const generateReceiptPDF'));
  assert.match(invoice, /drawServicesTable\(/, 'the invoice PDF does not use the shared services table');
  assert.doesNotMatch(invoice, /label: 'Amount'|label: 'Qty'/, "the invoice PDF's per-row Amount/Qty columns are back");
});

test('the email prints the same columns too', () => {
  const body = read('backend/utils/invoiceDocument.js');
  const declaration = body.slice(body.indexOf('const INVOICE_SERVICE_COLUMNS'), body.indexOf('const escapeHtml'));
  for (const label of COLUMNS) assert.ok(declaration.includes(`'${label}'`), `the invoice email has no ${label} column`);
  assert.doesNotMatch(declaration, /'Method'/, "the invoice email's Method column is back");
});

test('the portal\'s own estimate export drops Method as well', () => {
  // The downloaded and printed PDF is the same document as the emailed one, so it lists the same
  // columns: one of them carrying Method would read as a different estimate on paper.
  const exporter = read('admin-portal/src/utils/pdfExport.js');
  const head = exporter.slice(exporter.indexOf('const serviceHead'), exporter.indexOf('const serviceTableStyles'));
  assert.match(head, /'INPUT \/ DETAILS', 'FREQUENCY'/, 'the export no longer heads its services with the document columns');
  assert.doesNotMatch(head, /METHOD/, "the export's Method column is back");
});

test('a service name reads larger than the lines under it, on every surface', () => {
  // The category and the "Package" mark qualify the name; set at the name's own size they read as
  // three services stacked in one cell. The PDFs are checked where they are generated
  // (backend/services/estimateDelivery.test.js asserts the drawn sizes).
  for (const [file, name, sub] of [
    ['admin-portal/src/components/billing/InvoiceServicesTable.jsx', /text-xs font-medium text-gray-800/, /text-\[10px\]/],
    ['admin-portal/src/components/estimates/EstimateServicesTable.jsx', /font-medium text-gray-800 text-xs/, /text-\[10px\]/],
    ['backend/utils/invoiceDocument.js', /font-size: 12px/, /font-size: 10\.5px/],
    ['backend/services/emailService.js', /font-size: 12px/, /font-size: 11px/]
  ]) {
    const body = read(...file.split('/'));
    assert.match(body, name, `${file}: the service name's own size`);
    assert.match(body, sub, `${file}: the lines under the name are no longer set smaller`);
  }
  // The exporter hands autoTable the parts and draws the sub-lines itself, since autoTable sets
  // one font size per cell
  const exporter = read('admin-portal/src/utils/pdfExport.js');
  assert.match(exporter, /SERVICE_SUB_SIZE/, 'the export sets no smaller size for the lines under a name');
  assert.match(exporter, /serviceNameHooks\(doc, warmMuted\)/, 'the services table does not draw the sub-lines');
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

test('no invoice surface states how a service is priced', () => {
  // Method came off the screens too, so neither the shared table nor the customer's copy heads a
  // column with it, no row renders a `method`, and the FP page's screen capture no longer has to
  // strip the column out of the clone it renders
  for (const file of ['admin-portal/src/components/billing/InvoiceServicesTable.jsx',
    'frontend/src/pages/Payment.jsx', 'backend/utils/invoiceDocument.js']) {
    const body = read(...file.split('/'));
    assert.doesNotMatch(body, /'Method'|"Method"|>Method</, `${file}: the Method column is back`);
  }
  assert.doesNotMatch(read('admin-portal', 'src', 'components', 'billing', 'InvoiceServicesTable.jsx'),
    /row\.method/, 'the shared table renders a method again');
  assert.doesNotMatch(read('frontend', 'src', 'pages', 'Payment.jsx'),
    /item\.method/, "the customer's invoice view renders a method again");
  assert.doesNotMatch(read('admin-portal', 'src', 'pages', 'FPInvoiceView.jsx'),
    /data-column="Method"/, 'the FP download still strips a Method column');
});

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
