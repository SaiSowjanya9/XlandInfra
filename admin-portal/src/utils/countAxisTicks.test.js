import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A counting axis never labels itself in fractions.
 *
 * Recharts picks its own ticks and only rounds them off above a peak of three, so an axis left on
 * the default `allowDecimals` reads correctly on a busy deployment and wrong on a new one: the
 * Estimate Trend with three estimates in its tallest month was labelled
 * `0 / 0.75 / 1.5 / 2.25 / 3` — two and a quarter estimates. Every axis on these dashboards that
 * measures a count of rows (estimates, work orders, properties, schedules, leads) sets
 * `allowDecimals={false}`; only an axis that formats its own ticks (`tickFormatter` for ₹1.5L) or
 * carries labels rather than figures (`type="category"`, `unit="%"`) is exempt.
 *
 * Run: node --test admin-portal/src/utils/countAxisTicks.test.js
 */

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const jsxFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? jsxFiles(full) : (entry.name.endsWith('.jsx') ? [full] : []);
});

// An axis that formats its ticks states its own scale — money is compacted to ₹1.5L and the margin
// axis is a percentage — so a fractional domain never reaches the reader.
const SELF_FORMATTED = /tickFormatter|type="category"|unit="%"/;

const axisBlocks = (source) => [...source.matchAll(/<(XAxis|YAxis)\b[\s\S]*?\/>/g)];

test('every counting axis sets allowDecimals={false}', () => {
  const offenders = [];
  for (const file of jsxFiles(src)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [block, tag] of axisBlocks(source)) {
      // A YAxis is numeric unless it is told otherwise; an XAxis is the bucket axis except on a
      // horizontal bar chart, where `type="number"` makes it the counting one.
      const counts = tag === 'YAxis' ? !/type="category"/.test(block) : /type="number"/.test(block);
      if (!counts || /allowDecimals=\{false\}/.test(block) || SELF_FORMATTED.test(block)) continue;
      offenders.push(`${path.relative(src, file)}: <${tag}> may label a count in fractions`);
    }
  }
  assert.deepEqual(offenders, [], `axes missing allowDecimals={false}:\n${offenders.join('\n')}`);
});

// The sweep above reads self-closing axes. An axis written with children (`<YAxis>…</YAxis>`) would
// slip past it unseen, so it is reported rather than silently skipped.
test('every axis in the portal is readable by this sweep', () => {
  const unread = [];
  for (const file of jsxFiles(src)) {
    const source = fs.readFileSync(file, 'utf8');
    const tags = [...source.matchAll(/<(XAxis|YAxis)\b/g)].length;
    const blocks = axisBlocks(source).length;
    if (tags !== blocks) unread.push(`${path.relative(src, file)}: ${tags} axes, ${blocks} readable`);
  }
  assert.deepEqual(unread, [], `axes this test cannot read:\n${unread.join('\n')}`);
});
