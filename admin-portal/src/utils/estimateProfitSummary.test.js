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

test('a package estimate counts what the package costs as well as what it sells for', () => {
  // ₹12,000 package costing ₹10,000, plus a typed service at ₹5,000 costing ₹4,000
  const packaged = { estimate_id: 'E5', status: 'draft', subtotal: 17000, package_price: 12000,
    package_services: JSON.stringify([{ name: 'Lift AMC', vendorCost: 10000 }, { name: 'Uncosted row' }]),
    addons_data: [{ name: 'Deep cleaning', customService: true, totalPrice: 5000, vendorCost: 4000 }] };
  for (const result of [estimateProfit(packaged), estimateMargin(packaged)]) {
    assert.equal(result.vendorCost, 14000);
    assert.equal(result.customerPrice, 17000);
    assert.equal(result.profit, 3000);
    assert.equal(result.marginPercent, 17.65);
  }
  // Stored as an array as well as as JSON text
  assert.equal(estimateProfit({ ...packaged, package_services: [{ vendorCost: 10000 }] }).vendorCost, 14000);
});

test('the summary adds up every live estimate, and flags how many carry no cost', () => {
  const summary = estimateProfitSummary([costed, snapshotOnly, typedOnly, rejected]);
  assert.equal(summary.estimateCount, 3);
  assert.equal(summary.excludedCount, 1, 'rejected is not counted');
  assert.equal(summary.costedCount, 2);
  assert.equal(summary.uncostedCount, 1, 'hand-typed with no cost still counts, but is flagged');
  // Every live estimate's value is in the totals — the typed one's ₹900 price included
  assert.equal(summary.customerPrice, 7600);
  assert.equal(summary.actualCost, 5200);
  assert.equal(summary.profit, 2400);
  assert.equal(summary.marginPercent, 31.58);
  // The same live rows give the same totals as the server's panel
  const server = estimateMarginTotals([costed, typedOnly]);
  const client = estimateProfitSummary([costed, typedOnly]);
  for (const field of ['customerPrice', 'vendorCost', 'actualCost', 'profit', 'marginPercent', 'costedCount', 'uncostedCount']) {
    assert.equal(client[field], server[field], field);
  }
  assert.equal(estimateProfitSummary([]).marginPercent, null);
});
