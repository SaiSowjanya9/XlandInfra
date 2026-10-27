import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { legendColumns, legendSplits, LEGEND_SPLIT_AT } from './legendColumns.js';
import { WORK_ORDER_FRAME_CATEGORIES } from './chartColors.js';

/**
 * A legend longer than the chart it keys splits across columns; a short one stays one column.
 *
 * Seventeen work-order categories beside a 120px ring read as a card that was mostly key and no
 * chart. `legendColumns` is the one place that decides, `ChartLegend` is the component that must
 * consume it, and `WORK_ORDER_FRAME_CATEGORIES` is deliberately below the threshold -- the empty
 * card's key stays one column while real data can grow past it.
 *
 * Run: node --test admin-portal/src/utils/legendColumns.test.js
 */

const src = path.dirname(fileURLToPath(import.meta.url));

test('a short legend keeps one column; a long one splits', () => {
  assert.equal(legendSplits(LEGEND_SPLIT_AT - 1), false);
  assert.equal(legendSplits(LEGEND_SPLIT_AT), true);
  assert.equal(legendSplits(17), true);
  assert.equal(legendColumns(LEGEND_SPLIT_AT - 1), 'space-y-1.5');
  assert.match(legendColumns(LEGEND_SPLIT_AT), /^grid\b/);
  assert.match(legendColumns(LEGEND_SPLIT_AT), /repeat\(auto-fill/,
    'columns must be width-driven, not a fixed count -- one column at a narrow width');
});

test('the zero-data category frame stays under the split', () => {
  assert.ok(
    WORK_ORDER_FRAME_CATEGORIES.length < LEGEND_SPLIT_AT,
    `empty key is ${WORK_ORDER_FRAME_CATEGORIES.length} items; keep it one column`
  );
});

test('ChartLegend takes the split rather than its own list class', () => {
  const source = fs.readFileSync(path.join(src, '../components/common/ChartLegend.jsx'), 'utf8');
  assert.match(source, /import \{ legendColumns \}/, 'ChartLegend must call legendColumns');
  assert.match(source, /legendColumns\(rows\.length\)/, 'the list layout must come from legendColumns');
  assert.doesNotMatch(source, /w-full space-y-1\.5/, 'one-column spacing is legendColumns\' to give, not hard-coded');
});
