import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A search box must accept a space.
 *
 * Every one of the portal's ~40 search inputs was written
 * `onChange={(e) => setSearchTerm(e.target.value.trim())}`, which trims on **every keystroke**:
 * press space after "Urban" and the value is set back to "Urban", so the space never reaches the
 * field and the next letter gives "UrbanH". No multi-word term -- "Urban Heights", "Ravi Kumar",
 * a street in an address -- could be searched for anywhere in the portal.
 *
 * The term is trimmed where it is *used* instead: `searchTerm.trim().toLowerCase()` in a client
 * filter, `.trim()` on the value sent to a server search. Trimming on input is what broke it.
 *
 * Run: node --test admin-portal/src/utils/searchInput.test.js
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..');

const sources = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return sources(full);
  return /\.jsx?$/.test(entry.name) && !entry.name.endsWith('.test.js') ? [full] : [];
});

const files = sources(src);
const label = file => path.relative(src, file).replace(/\\/g, '/');

test('every file is scanned', () => {
  assert.ok(files.length > 100, `only ${files.length} sources found - the walk is broken`);
});

test('no search input trims the value on keystroke', () => {
  const offenders = files
    .filter(file => /setSearchTerm\(\s*e\.target\.value\.trim\(\)\s*\)/.test(fs.readFileSync(file, 'utf8')))
    .map(label);
  assert.deepEqual(offenders, [], 'these inputs cannot hold a space');
});

test('no setter of any search-ish field trims on keystroke either', () => {
  // The same mistake under another name: a filter box, a header search, a quick find
  const offenders = [];
  for (const file of files) {
    const body = fs.readFileSync(file, 'utf8');
    const matches = body.match(/set\w*(?:Search|Filter|Query)\w*\(\s*e\.target\.value\.trim\(\)\s*\)/g);
    if (matches) offenders.push(`${label(file)}: ${matches[0]}`);
  }
  assert.deepEqual(offenders, [], 'these inputs cannot hold a space');
});

test('a client-side filter trims the term where it reads it', () => {
  // `searchTerm.toLowerCase()` with no trim leaves a trailing space in the needle, so the list
  // empties the moment a space is typed -- the symptom the input trim was papering over
  const offenders = [];
  for (const file of files) {
    const body = fs.readFileSync(file, 'utf8');
    // `.toLowerCase()` reached directly off the raw term, with no `.trim()` between
    if (/[^.\w]searchTerm\.toLowerCase\(\)/.test(body)) offenders.push(label(file));
  }
  assert.deepEqual(offenders, [], 'these filters match against an untrimmed term');
});

test('a server search is sent the trimmed term', () => {
  // Trimmed at the append, or held in a variable that was trimmed where it was built
  for (const file of files) {
    const body = fs.readFileSync(file, 'utf8');
    const appends = body.match(/params\.append\('search',\s*([^)]+(?:\(\))?)\)/g) || [];
    for (const append of appends) {
      if (/\.trim\(\)/.test(append)) continue;
      const identifier = append.match(/params\.append\('search',\s*([A-Za-z_$][\w$]*)\s*\)/)?.[1];
      assert.ok(identifier, `${label(file)}: ${append} sends an untrimmed expression`);
      assert.match(body, new RegExp(`(const|let)\\s+${identifier}\\s*=[^;]*\\.trim\\(\\)`),
        `${label(file)}: ${append} sends ${identifier}, which is never trimmed`);
    }
  }
});

test("the Property Management page keeps its filters out of the URL", () => {
  // Filters were read back out of the query string, so each keystroke was a router navigation
  // that rewrote the address bar. `view` and `edit` stay -- they name an open modal, not a filter.
  const body = fs.readFileSync(path.join(src, 'pages', 'FPProperties.jsx'), 'utf8');
  for (const filter of ['search', 'type', 'zone', 'status', 'category']) {
    assert.doesNotMatch(body, new RegExp(`searchParams\\.get\\('${filter}'\\)`),
      `${filter} is a URL parameter again`);
  }
  for (const state of ['searchTerm', 'activeTab', 'selectedZone', 'statusFilter', 'selectedCategory']) {
    assert.match(body, new RegExp(`const \\[${state}, set\\w+\\] = useState\\(`),
      `${state} is no longer component state`);
  }
  assert.match(body, /searchParams\.get\('view'\)/, 'the view deep-link is gone');
  assert.match(body, /searchParams\.get\('edit'\)/, 'the edit deep-link is gone');
});
