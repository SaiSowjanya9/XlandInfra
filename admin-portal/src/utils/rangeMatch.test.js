import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { capacityForSlab, narrowestRange } from './rangeMatch.js';

const require = createRequire(import.meta.url);
const { validateService, calculateServiceQuote } = require('../../../backend/utils/servicePricing.js');

const service = slabs => validateService({
  service_name: 'Lift Fully Manual', category: 'Lifts', pricing_method: 'capacity_slab', unit: 'KL',
  applicable_property_types: ['APT'], default_frequency: 'Monthly', default_visits_per_year: 12,
  allow_frequency_override: false, allow_manual_visits: false, default_markup_percentage: 35,
  description: 'Inspection and minor adjustment', capacity_slabs: slabs
});

test('every overlapping slab can be chosen, and the server prices the one chosen', () => {
  // The service in the screenshot: three slabs that all start at 0
  const config = service([
    { capacityFrom: 0, capacityTo: 3, vendorRate: 6000 },
    { capacityFrom: 0, capacityTo: 6, vendorRate: 8000 },
    { capacityFrom: 0, capacityTo: null, isCustomQuote: true }
  ]);
  const slabs = config.capacity_slabs;
  assert.deepEqual(slabs.map(slab => capacityForSlab(slabs, slab)), [0, 4, 7]);
  for (const slab of slabs) {
    const capacity = capacityForSlab(slabs, slab);
    assert.equal(narrowestRange(slabs, capacity, 'capacityFrom', 'capacityTo'), slab, `${slab.capacityFrom}-${slab.capacityTo}`);
    const quote = calculateServiceQuote(config, { property_type: 'APT', capacity }, 'admin');
    if (slab.isCustomQuote) assert.equal(quote.requiresCustomQuote, true);
    else assert.equal(quote.vendorRatePerVisit, slab.vendorRate);
  }
});

test('non-overlapping slabs still price from their lower bound', () => {
  const slabs = service([
    { capacityFrom: 1, capacityTo: 6, vendorRate: 500 },
    { capacityFrom: 7, capacityTo: 10, vendorRate: 750 },
    { capacityFrom: 11, capacityTo: null, isCustomQuote: true }
  ]).capacity_slabs;
  assert.deepEqual(slabs.map(slab => capacityForSlab(slabs, slab)), [1, 7, 11]);
});

test('slabs as typed in the form (text values, open-ended last) work too', () => {
  const slabs = [{ id: 1, capacityFrom: '0', capacityTo: '3' }, { id: 2, capacityFrom: '0', capacityTo: '6' }, { id: 3, capacityFrom: '0', capacityTo: null }];
  assert.deepEqual(slabs.map(slab => capacityForSlab(slabs, slab)), [0, 4, 7]);
  // A slab a tighter duplicate hides entirely falls back to its own lower bound
  const shadowed = [{ capacityFrom: 0, capacityTo: 3 }, { capacityFrom: 0, capacityTo: 3 }];
  assert.equal(capacityForSlab(shadowed, shadowed[1]), 0);
});
