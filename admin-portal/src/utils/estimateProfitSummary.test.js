import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { estimateProfit, estimateProfitSummary } from './estimateProfitSummary.js';

const require = createRequire(import.meta.url);
const { estimateMargin, estimateMarginTotals } = require('../../../backend/utils/estimateMargins.js');

const costed = { estimate_id: 'E1', status: 'sent', subtotal: 5200, addons_data: JSON.stringify([
  { name: 'Lift', totalPrice: 5200, vendorCost: 4000, pricingSnapshot: { vendorCost: 4000, operatingCost: 0, totalPrice: 5200 } }]) };
const snapshotOnly = { estimate_id: 'E2', status: 'approved', subtotal: 0, package_price: 0, addons_data: [
  { name: 'Tank', pricingSnapshot: JSON.stringify({ vendorCost: 1000, operatingCost: 200, totalPrice: 1500 }) }] };
const typedOnly = { estimate_id: 'E3', status: 'draft', subtotal: 900, addons_data: [{ name: 'Typed', customService: true, totalPrice: 900 }] };
const rejected = { estimate_id: 'E4', status: 'rejected', subtotal: 9999, addons_data: [{ vendorCost: 1, totalPrice: 9999 }] };

test('each estimate is costed exactly as the payments dashboard costs it', () => {
  for (const estimate of [costed, typedOnly]) {
    const server = estimateMargin(estimate);
    const client = estimateProfit(estimate);
    for (const field of ['vendorCost', 'operatingCost', 'actualCost', 'customerPrice', 'profit', 'marginPercent']) {
      assert.equal(client[field], server[field], `${estimate.estimate_id} ${field}`);
    }
  }
  // A snapshot stored as a JSON string is read too
  assert.equal(estimateProfit(snapshotOnly).actualCost, 1200);
  assert.equal(estimateProfit(snapshotOnly).customerPrice, 1500);
});

test('the summary adds up costed live estimates only, and says what it left out', () => {
  const summary = estimateProfitSummary([costed, snapshotOnly, typedOnly, rejected]);
  assert.equal(summary.estimateCount, 3);
  assert.equal(summary.excludedCount, 1, 'rejected is not counted');
  assert.equal(summary.costedCount, 2);
  assert.equal(summary.uncostedCount, 1, 'hand-typed with no cost is not averaged in');
  assert.equal(summary.customerPrice, 6700);
  assert.equal(summary.actualCost, 5200);
  assert.equal(summary.profit, 1500);
  assert.equal(summary.marginPercent, 22.39);
  // The same live rows give the same totals as the server's panel
  const server = estimateMarginTotals([costed, typedOnly]);
  const client = estimateProfitSummary([costed, typedOnly]);
  for (const field of ['customerPrice', 'vendorCost', 'actualCost', 'profit', 'marginPercent', 'costedCount', 'uncostedCount']) {
    assert.equal(client[field], server[field], field);
  }
  assert.equal(estimateProfitSummary([]).marginPercent, null);
});
