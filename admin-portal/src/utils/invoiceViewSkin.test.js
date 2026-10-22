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
    for (const token of ['bg-warm-section', 'border-warm-border', 'bg-warm-accent', 'text-warm-text', 'text-warm-muted']) {
      assert.match(body, new RegExp(token), `${file}: missing ${token}`);
    }
    // The Total sits on the tan accent in dark text, like EstimatePriceSummary
    assert.match(body, /bg-warm-accent[^>]*>[\s\S]{0,200}text-warm-text[^>]*>Total/, `${file}: the Total band is not the estimate's tan band`);
  });
}
