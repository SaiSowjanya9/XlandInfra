const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateService, calculateServiceQuote, calculateEstimateSummary } = require('./servicePricing');

const config = (overrides = {}) => ({
  service_name: 'Generator Maintenance', category: 'Generator', pricing_method: 'fixed_price', unit: 'Visit',
  applicable_property_types: ['APT', 'GC'], default_frequency: 'Monthly', default_visits_per_year: 12,
  allow_frequency_override: true, allow_manual_visits: false, default_markup_percentage: 50,
  description: '', fixed_price: 100, ...overrides
});
const quote = (overrides, inputs = {}) => calculateServiceQuote(validateService(config(overrides)), { property_type: 'APT', ...inputs }, 'admin');

test('lift reference calculates slab, operating cost, customer price and profit exactly', () => {
  const lift = { pricing_method: 'capacity_slab', unit: 'Persons', default_markup_percentage: 35, capacity_slabs: [
    { capacityFrom: 1, capacityTo: 6, vendorRate: 500 },
    { capacityFrom: 7, capacityTo: 10, vendorRate: 750 },
    { capacityFrom: 11, capacityTo: 15, vendorRate: 1000 },
    { capacityFrom: 16, capacityTo: 20, vendorRate: 1250 },
    { capacityFrom: 21, capacityTo: null, isCustomQuote: true }
  ] };
  const result = quote(lift, { capacity: 10, operating_cost: 1800 });
  assert.equal(result.vendorRatePerVisit, 750);
  assert.equal(result.vendorCost, 9000);
  assert.equal(result.actualCost, 10800);
  assert.equal(result.totalPrice, 14580);
  assert.equal(result.profit, 3780);
  assert.equal(result.marginPercentage, 25.93);
  assert.equal(calculateEstimateSummary([result]).gst, 2624);
  assert.equal(calculateEstimateSummary([result]).total, 17204);
  assert.equal(quote(lift, { capacity: 21 }).requiresCustomQuote, true);
  assert.throws(() => quote(lift, { capacity: 0 }), /below the first/i);
  assert.equal(calculateEstimateSummary([result], 50).profit, -3510);
  assert.equal(quote(lift, { capacity: 10, markup_percentage: 0 }).profit, 0);
  assert.throws(() => quote(lift, { capacity: 10, operating_cost: -1 }), /operating cost/i);
});

test('all eight methods calculate vendor cost and marked-up customer totals', () => {
  const cases = [
    [{}, {}, 1200],
    [{ pricing_method: 'quantity_based', unit: 'Lifts', rate_per_quantity: 125.5 }, { quantity: 3 }, 4518],
    [{ pricing_method: 'area_based', unit: 'Sq Ft', rate_per_unit: 1.2 }, { area: 10000 }, 144000],
    [{ pricing_method: 'capacity_based', unit: 'KL', rate_per_capacity: 100 }, { capacity: 2.5 }, 3000],
    [{ pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [{ capacityFrom: 0, capacityTo: 25, vendorRate: 2000, isCustomQuote: false }, { capacityFrom: 26, capacityTo: null, vendorRate: null, isCustomQuote: true }] }, { capacity: 25 }, 24000],
    [{ pricing_method: 'manpower', unit: 'Guards', monthly_rate: 10000, period_months: 12, billing_period: 'Quarterly' }, { personnel: 2 }, 240000],
    [{ pricing_method: 'fixed_visit_custom', unit: 'Visit', visit_charge: 500, custom_work_rate: 1000 }, {}, 7000],
    [{ pricing_method: 'custom_quote', unit: 'Quote' }, { custom_quote: 4000 }, 4000]
  ];
  for (const [configuration, inputs, expected] of cases) {
    const result = quote(configuration, inputs);
    assert.equal(result.vendorCost, expected);
    assert.equal(result.totalPrice, expected * 1.5);
  }
});

test('frequency defaults and overrides determine visits without double multiplying manpower', () => {
  assert.equal(quote({}, { frequency: 'Quarterly' }).visits, 4);
  assert.equal(quote({}, { frequency: 'Every 2 Months' }).vendorCost, 600);
  assert.throws(() => quote({ allow_frequency_override: false }, { frequency: 'Yearly' }), /frequency override/i);
  assert.throws(() => quote({}, { visits: 5 }), /manual visits/i);
  assert.equal(quote({ allow_manual_visits: true, default_visits_per_year: 7 }).visits, 7);
  assert.equal(quote({ allow_manual_visits: true }, { visits: 5 }).vendorCost, 500);
});

test('slab boundaries are inclusive and above-range custom quotes are explicit', () => {
  const configuration = { pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: [
    { capacityFrom: 0, capacityTo: 25, vendorRate: 20.75, isCustomQuote: false },
    { capacityFrom: 26, capacityTo: 50, vendorRate: 30, isCustomQuote: false },
    { capacityFrom: 51, capacityTo: null, vendorRate: null, isCustomQuote: true }
  ] };
  assert.equal(quote(configuration, { capacity: 25 }).vendorCost, 249);
  assert.equal(quote(configuration, { capacity: 26 }).vendorCost, 360);
  assert.equal(quote(configuration, { capacity: 51 }).requiresCustomQuote, true);
  assert.equal(quote(configuration, { capacity: 51, custom_quote: 800 }).vendorCost, 800);
  assert.throws(() => quote(configuration, { capacity: 25.5 }), /whole number/i);
  assert.throws(() => calculateServiceQuote(validateService(config(configuration)), { property_type: 'APT', capacity: 51, custom_quote: 800 }, 'supervisor'), /admin or manager/i);
});

test('invalid, overlapping, gapped, and premature open-ended slabs are rejected', () => {
  for (const slabs of [[],
    [{ capacityFrom: 0, capacityTo: 25, vendorRate: 1 }, { capacityFrom: 25, capacityTo: 50, vendorRate: 1 }],
    [{ capacityFrom: 0, capacityTo: 25, vendorRate: 1 }, { capacityFrom: 27, capacityTo: 50, vendorRate: 1 }],
    [{ capacityFrom: 0, capacityTo: null, vendorRate: 1 }, { capacityFrom: 26, capacityTo: 50, vendorRate: 1 }]
  ]) assert.throws(() => validateService(config({ pricing_method: 'capacity_slab', unit: 'KVA', capacity_slabs: slabs })), /slab/i);
});

test('configuration rejects invalid names, percentages, property types, units, and rates', () => {
  for (const overrides of [
    { service_name: ' ' }, { category: '' }, { applicable_property_types: [] },
    { applicable_property_types: ['INVALID'] }, { fixed_price: -1 }, { fixed_price: '' },
    { fixed_price: Infinity }, { fixed_price: true }, { unit: 'KL' }, { pricing_method: 'unknown' },
    { default_frequency: 'Never' }, { default_visits_per_year: 3 }, { default_markup_percentage: -1 },
    { applicable_property_types: ['COMMERCIAL'] }, { allow_manual_visits: 'false' }
  ]) assert.throws(() => validateService(config(overrides)));
});

test('estimate inputs reject unsupported properties, missing quantity, zero visits and invalid quotes', () => {
  assert.throws(() => quote({}, { property_type: 'PLOT' }), /property type/i);
  assert.throws(() => quote({ pricing_method: 'quantity_based', unit: 'Lifts', rate_per_quantity: 1 }), /quantity/i);
  assert.throws(() => quote({ allow_manual_visits: true }, { visits: 0 }), /visits/i);
  assert.throws(() => quote({ pricing_method: 'custom_quote', unit: 'Quote' }, { custom_quote: -1 }), /quote/i);
  assert.equal(quote({ pricing_method: 'custom_quote', unit: 'Quote' }).requiresCustomQuote, true);
});
