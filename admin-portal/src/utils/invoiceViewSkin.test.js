import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The generated-invoice view modal is drawn in the estimate view's warm skin.
 *
 * Both invoice screens carried the old black-and-gold document chrome: a `#1a1a1a` header, a
 * `#D39A1A`/`#B77A00` gradient divider and total banner, `bg-[#c9a227]` table headers and a
 * `from-[#c9a227]/10` payment-link panel. The estimate view long ago moved to the warm palette —
 * `warm-section` surfaces, `warm-border` rules, `warm-accent` bands in dark `warm-text` — and the
 * user asked for the invoice modal to match it in every dedicated portal. `GeneratedInvoices` is
 * the shared screen all six portals mount; `Invoices` carries the same modal again.
 *
 * Run: node --test admin-portal/src/utils/invoiceViewSkin.test.js
 */

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), 'utf8');

const FILES = ['pages/billing/GeneratedInvoices.jsx', 'pages/billing/Invoices.jsx'];

// The dark/gold values the estimate view replaced. `text-[#c9a227]` is allowed: it is #C9A227, the
// brand gold the estimate's own contact icons are drawn in.
const LEGACY = [
  /#1a1a1a/,                    // the black header band
  /#D39A1A/i,                   // bright gold: branding, banner, gradient
  /#B77A00/i,                   // gradient endpoints
  /#FBF7EE/i,                   // pre-token cream, now warm.section
  /#E8DCC8/i,                   // pre-token cream border, now warm.border
  /bg-\[#c9a227\]/i,            // gold button / table-header surface
  /border-\[#c9a227\]/i,        // gold outlined copy button / panel rule
  /from-\[#c9a227\]/i,          // payment-link panel gradient
  /hover:bg-\[#b08a1f\]/i,      // gold hover
  /hover:bg-\[#b8941f\]/i,      // gold hover
];

for (const file of FILES) {
  test(`${file} carries no black/gold document chrome`, () => {
    const body = read(...file.split('/'));
    for (const pattern of LEGACY) {
      assert.doesNotMatch(body, pattern, `${file}: ${pattern} is back — use the warm skin`);
    }
  });

  test(`${file} draws the modal in the estimate's warm palette`, () => {
    const body = read(...file.split('/'));
    for (const token of ['bg-warm-section', 'border-warm-border', 'bg-warm-accent-soft', 'text-warm-text', 'text-warm-muted']) {
      assert.match(body, new RegExp(token), `${file}: missing ${token}`);
    }
    // The bands sit in light cream, dark text — the solid warm-accent (tan) fill was swapped
    // for accent-soft at the user's request; assert no solid accent fill remains
    assert.doesNotMatch(body, /bg-warm-accent(?![-\w/])/, `${file}: a solid warm-accent fill is back`);
    // The Total sits on the cream band in dark text, bordered like the card it ends
    assert.match(body, /bg-warm-accent-soft[^>]*>[\s\S]{0,200}text-warm-text[^>]*>Total/, `${file}: the Total band is not the cream band`);
  });

  test(`${file} letterhead uses the estimate's logo icon`, () => {
    const body = read(...file.split('/'));
    // Same file the estimate letterhead sets beside the typeset name — logo.png carries the
    // company name baked into the image, which duplicates the text the modal already prints
    assert.match(body, /COMPANY_LOGO_ICON/, `${file}: the modal logo is not the shared icon`);
    assert.doesNotMatch(body, /src="\/logo\.(png|webp)"/, `${file}: a hard-coded logo path is back`);
  });
}

// The row-status pill in pages/billing/Invoices.jsx (mounted by every portal) is a label, not
// a control: 'sent' comes from the send action, 'overdue' from the due date, 'paid'/
// 'partially_paid' from a recorded payment. No dropdown exists to mislead any of them.
test('the invoice status pill is never a picker', () => {
  const body = read('pages', 'billing', 'Invoices.jsx');
  assert.doesNotMatch(body, /showStatusUpdate|handleUpdateStatus|status-dropdown-container/,
    'the invoice status dropdown is back');
  assert.doesNotMatch(body, /invoices\/\$\{invoiceId?\}\/status|invoices\/\$\{invoice\.id\}\/status/,
    'a frontend caller still PUTs a hand-picked invoice status');
});
