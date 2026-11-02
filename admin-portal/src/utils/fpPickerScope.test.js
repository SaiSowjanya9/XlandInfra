import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const jsxFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? jsxFiles(full) : (entry.name.endsWith('.jsx') ? [full] : []);
});

/**
 * The franchise-partner picker narrows the head office's view to one partner. A screen that takes
 * a `portalType` is mounted by the FP, Manager and Supervisor portals too, and those are already
 * scoped to one partner by their own token — FPContext returns no FP list and a null selectedFp
 * for them, so an ungated picker renders the admin's "all partners" label over an empty dropdown,
 * a control that reads like company-wide access and does nothing. PaymentsDashboard shipped it on
 * four portals. The gate is `isAdminPortal`, and it must open before the picker's markup.
 *
 * A page with no `portalType` belongs to one portal, so it needs no gate and is not checked here.
 */
test('a portal-shared screen gates its FP picker behind the admin portal', () => {
  const offenders = [];
  for (const file of jsxFiles(srcDir)) {
    const source = fs.readFileSync(file, 'utf8');
    const picker = source.indexOf('Admin (All FPs)');
    if (picker === -1 || !/\bportalType\b/.test(source)) continue;
    const gate = source.indexOf('{isAdminPortal && (');
    if (gate === -1 || gate > picker) offenders.push(path.relative(srcDir, file));
  }
  assert.deepEqual(offenders, [], `FP picker shown to every portal:\n${offenders.join('\n')}`);
});
