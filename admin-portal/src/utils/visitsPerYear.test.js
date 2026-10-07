import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MAX_VISITS_PER_YEAR, resolveVisits, sanitizeVisits } from './visitsPerYear.js';

const require = createRequire(import.meta.url);
const { validateService, calculateServiceQuote } = require('../../../backend/utils/servicePricing.js');

const service = validateService({
  service_name: 'Deep Cleaning', category: 'Cleaning', pricing_method: 'area_based', unit: 'Sq Ft',
  applicable_property_types: ['APT'], default_frequency: 'Quarterly', default_visits_per_year: 4,
  allow_frequency_override: true, allow_manual_visits: true, default_markup_percentage: 35,
  rate_per_unit: 5, description: 'Complete cleaning; stain removal best effort.'
});

test('only digits reach the state, however the box is typed into', () => {
  // What a number input lets through and then reports as '': the field showed the text while the
  // component held nothing, and the service was quoted with no visits
  for (const typed of ['n', 'e', '-', '+', '.', '1e5', '--4', 'abc']) {
    const visits = sanitizeVisits(typed);
    assert.ok(visits === '' || Number.isInteger(visits), `${typed} -> ${visits}`);
    assert.ok(!Number.isNaN(visits), typed);
  }
  assert.equal(sanitizeVisits('1e5'), 15);
  assert.equal(sanitizeVisits('-4'), 4);
  assert.equal(sanitizeVisits('007'), 7);
  assert.equal(sanitizeVisits(''), '');
  assert.equal(sanitizeVisits('n'), '');
  assert.equal(sanitizeVisits(null), '');
});

test('the count is capped at a year of days, as the server caps it', () => {
  assert.equal(sanitizeVisits('99999'), MAX_VISITS_PER_YEAR);
  assert.equal(sanitizeVisits('366'), 366);
  assert.throws(() => calculateServiceQuote(service, { property_type: 'APT', area: 7, frequency: 'Quarterly', visits: 367 }, 'admin'));
});

test('leaving the field empty restores the frequency count rather than sending nothing', () => {
  assert.equal(resolveVisits('', 4), 4);
  assert.equal(resolveVisits('n', 12), 12);
  assert.equal(resolveVisits('6', 4), 6);
  // Zero visits belong to On Request alone; the server refuses them for any other frequency
  assert.equal(resolveVisits('0', 4), 1);
  assert.equal(resolveVisits('0', 0), 0);
  assert.throws(() => calculateServiceQuote(service, { property_type: 'APT', area: 7, frequency: 'Quarterly', visits: 0 }, 'admin'));
});

test('every value the field settles on is one the server prices', () => {
  for (const typed of ['', 'n', '-', '0', '2', '366', '99999']) {
    const visits = resolveVisits(typed, 4);
    const quote = calculateServiceQuote(service, { property_type: 'APT', area: 7, frequency: 'Quarterly', visits }, 'admin');
    assert.equal(quote.visits, visits);
  }
});
