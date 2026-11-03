import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * The Service cell of the estimate PDF the portal downloads and prints.
 *
 * A service's name carries two lines that qualify it -- its category, and the mark that it comes
 * with the AMC package -- and autoTable sets one font size per cell, so all three used to print at
 * the table's own size: three lines of equal weight that read as three services stacked in one
 * cell. `serviceNameHooks` leaves the name to autoTable and draws those lines itself, smaller.
 *
 * `pdfExport.js` cannot be imported here (it reads `import.meta.env` at module scope, which only a
 * bundler defines), so the helpers are taken from its source and run as written -- the real code,
 * not a copy of it.
 *
 * Run: node --test admin-portal/src/utils/serviceNameCellPdf.test.js
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'pdfExport.js'), 'utf8');
const block = source.slice(source.indexOf('const SERVICE_SUB_SIZE'), source.indexOf('// Generate Premium PDF'));
assert.ok(block.includes('serviceNameHooks'), 'the service-name helpers are no longer where this test reads them');
// eslint-disable-next-line no-new-func
const { serviceNameCell, serviceNameHooks, SERVICE_SUB_SIZE } =
  new Function(`${block}\nreturn { serviceNameCell, serviceNameHooks, SERVICE_SUB_SIZE };`)();

const BODY_SIZE = 7;
const MUTED = [107, 114, 128];

// The services table as `generatePDF` draws it: fixed column widths, cream header, the hooks last
const render = rows => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const draws = [];
  const original = doc.text.bind(doc);
  doc.text = (text, x, y, options) => {
    const { fontName, fontStyle } = doc.getFont();
    draws.push({ lines: Array.isArray(text) ? text : [String(text)], x, y, size: doc.getFontSize(), font: `${fontName}-${fontStyle}` });
    return original(text, x, y, options);
  };
  autoTable(doc, {
    startY: 20,
    head: [['#', 'SERVICE', 'DESCRIPTION', 'INPUT / DETAILS', 'FREQUENCY', 'VISITS']],
    body: rows,
    margin: { left: 15, right: 15 },
    styles: { fontSize: BODY_SIZE, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 35 }, 2: { cellWidth: 73 }, 3: { cellWidth: 28 }, 4: { cellWidth: 22 }, 5: { cellWidth: 14 } },
    ...serviceNameHooks(doc, MUTED)
  });
  const drawn = line => draws.find(draw => draw.lines.includes(line));
  return { doc, draws, drawn, table: doc.lastAutoTable };
};

const row = (name, category, tag) =>
  [['1', serviceNameCell(name, [{ text: category }, { text: tag, italic: true }]), 'Monthly inspection', '4 Lift', 'Monthly', '12']];

test('the category and the Package mark are drawn smaller than the name', () => {
  const { drawn } = render(row('Plumbing', 'Plumbing', 'Package'));
  const name = drawn('Plumbing');
  const tag = drawn('Package');
  assert.ok(name, 'the service name is not drawn');
  assert.ok(tag, 'the Package mark is not drawn');
  assert.equal(name.size, BODY_SIZE, 'the name must keep the table size');
  assert.equal(tag.size, SERVICE_SUB_SIZE);
  assert.ok(tag.size < name.size, `the mark (${tag.size}pt) must read smaller than the name (${name.size}pt)`);
  // The name is the heading of the cell, so it is bold where the lines under it are not: at one
  // weight as well as one size, the three lines read as three services
  assert.match(name.font, /bold/, `the name is set in ${name.font}, not a bold face`);
  assert.doesNotMatch(tag.font, /bold/, 'the Package mark is as bold as the name above it');
  // The mark is italic, as it is on screen and in the email
  assert.match(tag.font, /italic/);
  // The category is drawn on its own, at the smaller size: the name's cell text is the name alone,
  // so a draw carrying both lines would mean the hooks never ran
  const category = render(row('Plumbing', 'Water Management', 'Package')).drawn('Water Management');
  assert.equal(category.size, SERVICE_SUB_SIZE);
  assert.match(category.font, /normal/);
});

test('they sit under the name, inside the cell, in order', () => {
  const { draws, drawn, table } = render(row('Watchman Support', 'Watchman Support', 'Package'));
  const name = drawn('Watchman Support');
  const tag = drawn('Package');
  const cell = table.body[0].cells[1];
  assert.ok(name.y < tag.y, 'the mark must sit under the name');
  assert.ok(tag.y > cell.y, 'the mark must sit inside its own cell');
  assert.ok(tag.y <= cell.y + cell.height, `the mark (y ${tag.y}) overflows the cell (y ${cell.y} + ${cell.height})`);
  // Same left edge as the name: the lines read as one block, not an indent
  assert.equal(tag.x, name.x);
  // And nothing draws the three lines as one string any more
  assert.ok(!draws.some(draw => draw.lines.some(line => line.includes('\n'))), 'a cell still joins the name and its lines');
});

test('a service with neither category nor mark is left to autoTable', () => {
  const { drawn, draws } = render(row('Test Slab', '', ''));
  assert.equal(drawn('Test Slab').size, BODY_SIZE);
  assert.ok(!draws.some(draw => draw.size === SERVICE_SUB_SIZE), 'nothing is drawn under a bare name');
});
