import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const jsxFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? jsxFiles(full) : (entry.name.endsWith('.jsx') ? [full] : []);
});

/**
 * A page that renders `<PageHeader icon={Foo}>` without importing `Foo` builds perfectly well and
 * then throws a ReferenceError the moment the page is opened — `vite build` does not resolve
 * identifiers, so a blank screen is the first sign of it. PaymentsDashboard shipped exactly that
 * for the length of one commit. This reads the icon each header asks for and checks the file
 * actually imports it.
 */
test('every PageHeader icon is imported by the page that uses it', () => {
  const offenders = [];
  for (const file of jsxFiles(srcDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<PageHeader[\s\S]{0,120}?icon=\{(\w+)\}/g)) {
      const icon = match[1];
      const imported = [...source.matchAll(/import\s+(?:\w+,\s*)?\{([\s\S]*?)\}\s+from\s+'[^']+'/g)]
        .map(entry => entry[1]).join(',')
        .split(',').map(name => name.trim().split(/\s+as\s+/).pop());
      if (!imported.includes(icon)) offenders.push(`${path.relative(srcDir, file)} → ${icon}`);
    }
  }
  assert.deepEqual(offenders, [], `PageHeader icons used but never imported:\n${offenders.join('\n')}`);
});
