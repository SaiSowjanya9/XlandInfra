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
const layout = () => read('components', 'Layout.jsx');
const css = () => read('index.css');

test('the bottom bar is locked to the bottom of the viewport', () => {
  const nav = bottomNav();
  // Fixed, full width, above the page, and clear of a phone's home indicator
  assert.match(nav, /fixed bottom-0 inset-x-0 z-40/);
  assert.match(nav, /env\(safe-area-inset-bottom\)/);
});

test('nothing between the bar and the viewport is a containing block for fixed', () => {
  // The bar's ancestors are body > #root > .portal-shell, and a transform on any of them makes
  // that element the containing block for every fixed descendant: `bottom: 0` then means the
  // bottom of the *document*, so the bar scrolls away and only looks pinned at the end of a page.
  // index.css carried `body { transform: translateZ(0) }` for "GPU acceleration" and did exactly
  // that to the whole app, modal overlays included.
  const sheet = css();
  const bodyRules = [...sheet.matchAll(/(^|\n)([^@{}\n][^{}]*)\{([^}]*)\}/g)]
    .filter(([, , selector]) => /(^|,)\s*(body|html|#root)\s*(,|$)/.test(selector.trim()))
    .filter(([, , , body]) => /(^|[^-])transform\s*:/.test(body) && !/transform\s*:\s*none/.test(body));

  assert.deepEqual(bodyRules.map(([, , s]) => s.trim()), [],
    'a transform is back on body/html/#root — every fixed element in the app resolves against it');
});

test('the bar is below a dialog, never over one', () => {
  // z-40 against the modal shell's z-50 floor (components/common/Modal.jsx). A bar that outranked
  // a dialog would sit across the payment flow's buttons.
  assert.match(bottomNav(), /fixed bottom-0 inset-x-0 z-40/);
  assert.doesNotMatch(bottomNav(), /fixed bottom-0 inset-x-0 z-(50|\[\d+\])/);
});

test('the bar keeps its fixed tab order: Home, Work Orders, Payments, Schedules, More', () => {
  const nav = bottomNav();
  const labels = [...nav.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Home', 'Work Orders', 'Payments', 'Schedules']);
  // More is rendered after the mapped tabs
  assert.ok(nav.indexOf('TABS.map') < nav.indexOf('>More<'), 'More is no longer the last tab');
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
  assert.match(bottomNav(), /overlayClassName="lg:hidden/);
});

test('the More sheet rests on the bar rather than across it', () => {
  const nav = bottomNav();
  // A bottom sheet padded with a flat `p-3` ends 12px from the viewport: over the bar that opened
  // it, and under an iPhone's home indicator. Its bottom padding clears both.
  assert.doesNotMatch(nav, /padding="p-3"/, 'the sheet is back to a flat padding with no room for the bar');
  assert.match(nav, /overlayClassName="lg:hidden pb-\[calc\(var\(--portal-nav-space\)_\+_[\d.]+rem\)\]"/);
});

test('the bar and the page clearance under it are one number', () => {
  // Written out twice they drift, and the gap under the last card shrinks by the size of a home
  // indicator the padding knows nothing about.
  assert.match(css(), /--portal-nav-h:\s*[\d.]+rem/);
  assert.match(css(), /--portal-nav-space:\s*calc\(var\(--portal-nav-h\) \+ env\(safe-area-inset-bottom, 0px\)\)/);

  // The bar draws its row from the height...
  assert.match(bottomNav(), /h-\[var\(--portal-nav-h\)\]/);
  // ...and the page leaves exactly that plus the inset, lifting at lg with the bar itself.
  // Padding that lifted at md would leave a tablet's last card under the bar.
  assert.match(layout(), /pb-\[var\(--portal-nav-space\)\] lg:pb-6/);
  assert.doesNotMatch(layout(), /pb-\d+ lg:pb-6/, 'the clearance is a magic number again');
});

test('a tab is a 48px touch target, and stretches to the row rather than setting its own height', () => {
  const nav = bottomNav();
  // --portal-nav-h (3.75rem/60px) less my-1.5 top and bottom (12px) is the 48px target. A `py-*`
  // on the tab would set a second height that no longer tracks the variable.
  assert.match(css(), /--portal-nav-h:\s*3\.75rem/);
  assert.match(nav, /const tabClass = \(active\) => `flex flex-col items-center justify-center gap-1 mx-1 my-1\.5 /);
  assert.doesNotMatch(nav, /justify-center gap-1 py-\d/, 'the tab sets its own height again');
});

test('the portal shell uses a viewport unit that tracks the address bar', () => {
  // min-h-screen is 100vh, the viewport with the address bar hidden, so a short page scrolls into
  // ~100px of empty space below its own content with the fixed bar hanging over the gap.
  assert.match(layout(), /className="portal-shell /);
  assert.doesNotMatch(layout(), /min-h-screen/, 'the shell is back on raw 100vh');

  // The dvh rule is its own @supports block: as a second declaration beside the 100vh fallback,
  // the build's minifier drops the fallback and Safari before 15.4 gets no min-height at all.
  assert.match(css(), /\.portal-shell \{\s*\n\s*min-height: 100vh;\s*\n\}/);
  assert.match(css(), /@supports \(min-height: 100dvh\) \{\s*\n\s*\.portal-shell \{\s*\n\s*min-height: 100dvh;/);
});

test('the tabs are capped and centred so a tablet does not stretch them', () => {
  // Five items across a tablet's full width are 150px each with the icon adrift in the middle.
  assert.match(bottomNav(), /h-\[var\(--portal-nav-h\)\] w-full max-w-xl mx-auto/);
});

test('every tab is reachable and legible without its icon', () => {
  const nav = bottomNav();
  // A keyboard must be able to see where it is, and the icons are decoration beside a real label
  assert.match(nav, /focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500/);
  assert.equal((nav.match(/className="w-5 h-5" aria-hidden="true"/g) || []).length, 2,
    'a bar icon is exposed to a screen reader beside the label it repeats');
  // The sheet is a dialog, and the tab that opens it says so
  assert.match(nav, /aria-haspopup="dialog"/);
  assert.match(nav, /aria-expanded=\{showMore\}/);
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
