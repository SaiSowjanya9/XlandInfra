import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One legend size for every chart on every dashboard: 12px.
 *
 * `ChartLegend` took a `size` prop with three values -- 11px, 12/14px and a flat 14px -- so the
 * three donut cards of a single row could each read at a different size, while the hand-written
 * legends beside them (Work Orders, Estimates, the staff dashboards) were 12px, and the Vendor,
 * Customer and invoice-status legends were 14px. At 14px a label and its figure also stopped
 * sharing a line in a legend column a third of a row wide: the figure dropped under its own label,
 * where it reads as a second entry rather than as that label's value.
 *
 * Run: node --test admin-portal/src/utils/chartLegendSize.test.js
 */

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 'text-xs';

const jsxFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? jsxFiles(full) : (entry.name.endsWith('.jsx') ? [full] : []);
});

// The screens that draw charts. A legend lives on one of these; a coloured dot anywhere else is a
// status badge, and badges keep the size of the text they sit in.
const CHART_FILE = /(Dashboard|PieChart|OverviewBlocks|ChartLegend)\.jsx$/;

// A legend dot is coloured from the data. That is what tells it apart from a badge's fixed
// `bg-amber-500`, so legends whose colours are hard-coded (the trend keys) are not covered here.
const LEGEND_DOT = /rounded-(?:full|sm)/;
const DATA_COLOUR = /backgroundColor:|background:/;
// A hover card states its figures at 14px by design and is not a legend.
const HOVER_CARD = /shadow-lg|ChartTooltip/;
const BIGGER = /text-(?:sm|base|lg|xl)\b/g;

test('ChartLegend declares one text size, and it is 12px', () => {
  const source = fs.readFileSync(path.join(src, 'components', 'common', 'ChartLegend.jsx'), 'utf8');
  const sizes = [...new Set([...source.matchAll(/text-(?:xs|sm|base|lg|xl|\[\d+px\])/g)].map(m => m[0]))];
  assert.deepEqual(sizes, [SIZE], `ChartLegend may only use ${SIZE}; found ${sizes.join(', ')}`);
  const [, signature] = source.match(/export default function ChartLegend\(([^)]*)\)/);
  assert.doesNotMatch(signature, /\bsize\b/, 'ChartLegend must not take a size prop again');
});

test('no chart asks its legend for a different size', () => {
  const offenders = [];
  for (const file of jsxFiles(src)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [call] of source.matchAll(/<ChartLegend\b[\s\S]*?\/>/g)) {
      if (/\bsize=/.test(call)) offenders.push(path.relative(src, file));
    }
  }
  assert.deepEqual(offenders, [], `call sites passing a size:\n${offenders.join('\n')}`);
});

test('a hand-written legend row is 12px as well', () => {
  const offenders = [];
  for (const file of jsxFiles(src).filter(f => CHART_FILE.test(f))) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!LEGEND_DOT.test(line) || !DATA_COLOUR.test(line)) return;
      // A legend row carries its size on the container just above the dot or on the label just
      // below it, so only that neighbourhood is read: a figure further down the block is a stat
      // tile's own number (the staff dashboards' Properties by Type keys), which is meant to be
      // large. A dot inside a hover card is skipped - a hover states its figures at 14px.
      if (lines.slice(Math.max(0, index - 4), index + 3).some(l => HOVER_CARD.test(l))) return;
      const bigger = lines.slice(Math.max(0, index - 2), index + 3).flatMap(l => l.match(BIGGER) || []);
      if (bigger.length) offenders.push(`${path.relative(src, file)}:${index + 1} legend row at ${bigger[0]}`);
    });
  }
  assert.deepEqual(offenders, [], `legend rows that are not ${SIZE}:\n${offenders.join('\n')}`);
});

test("recharts' own legend is given the same 12px", () => {
  const offenders = [];
  for (const file of jsxFiles(src)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [block] of source.matchAll(/<Legend\b[\s\S]*?(?:\/>|>)/g)) {
      const font = block.match(/fontSize:\s*['"](\d+)px['"]/);
      if (font && font[1] !== '12') offenders.push(`${path.relative(src, file)}: <Legend> at ${font[1]}px`);
    }
  }
  assert.deepEqual(offenders, [], `recharts legends at another size:\n${offenders.join('\n')}`);
});
