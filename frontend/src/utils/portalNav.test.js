import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The customer portal offers its navigation twice if the bottom bar and the home page's Quick
 * Access are ever visible at the same width.
 *
 * They carry the same four destinations. The bar was `md:hidden` while Quick Access had no
 * breakpoint at all, so every phone and small-tablet screen showed a fixed bar across the bottom
 * *and* a column of cards saying the same thing. They are now one complementary pair on one
 * breakpoint: `lg:hidden` on the bar, `hidden lg:block` on the cards. Moving one without the other
 * brings the duplication back, or leaves a width with no navigation at all.
 *
 * Run: node --test frontend/src/utils/portalNav.test.js
 */

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(src, ...parts), 'utf8');

const bottomNav = () => read('components', 'BottomNav.jsx');
const dashboard = () => read('pages', 'Dashboard.jsx');

test('the bottom bar is locked to the bottom of the viewport', () => {
  const nav = bottomNav();
  // Fixed, full width, above the page, and clear of a phone's home indicator
  assert.match(nav, /fixed bottom-0 inset-x-0 z-40/);
  assert.match(nav, /env\(safe-area-inset-bottom\)/);
});

test('the bar and Quick Access hide at the same breakpoint, in opposite directions', () => {
  // The bar: phones and tablets only
  assert.match(bottomNav(), /className="lg:hidden fixed bottom-0/);
  assert.doesNotMatch(bottomNav(), /className="md:hidden fixed bottom-0/,
    'the bar is back to md:hidden while Quick Access hides at lg');

  // Quick Access: desktop only
  assert.match(dashboard(), /<section className="hidden lg:block">\s*\n\s*<h2[^>]*>Quick Access</,
    'the Quick Access section is not hidden below lg');
});

test('the More sheet is hidden with the bar that opens it', () => {
  // On the overlay, not the card: hiding only the card leaves a transparent fixed inset-0
  // swallowing every click on the page behind it.
  assert.match(bottomNav(), /overlayClassName="lg:hidden"/);
});

test('the page keeps its content clear of the fixed bar, to the same breakpoint', () => {
  // Padding that lifted at md would leave a tablet's last card under the bar
  assert.match(read('components', 'Layout.jsx'), /pb-24 lg:pb-6/);
});

test('neither the bar nor Quick Access carries a destination the other lacks', () => {
  const paths = (source) => [...source.matchAll(/path: '(\/dashboard[^']*)'/g)].map((m) => m[1]);
  const barPaths = paths(bottomNav());
  const cardPaths = paths(dashboard());

  // The bar's four tabs, plus Contact / Help which it reaches through the More sheet
  assert.ok(barPaths.includes('/dashboard'), 'the bar has no Home tab');
  assert.match(bottomNav(), /to="\/dashboard\/contact"/, 'More does not reach Contact / Help');

  // Everything Quick Access offers is reachable from the bar, or a phone loses a destination
  // entirely when the cards are hidden.
  const reachable = new Set([...barPaths, '/dashboard/contact']);
  const unreachable = cardPaths.filter((candidate) => !reachable.has(candidate));
  assert.deepEqual(unreachable, [],
    'these are only on the desktop cards, so a phone cannot reach them at all');
});
