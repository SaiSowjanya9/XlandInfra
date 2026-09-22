import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldValue, fieldValues, filterOptions, matchesFilter
} from './filterOptions.js';

// One row per shape the schedules endpoints actually return.
const rescheduleRequest = { serviceName: 'Housekeeping', vendorName: 'Alpha Services', zone: 'North', packageName: 'Gold AMC' };
const cancelledVisit = { service: 'Pest Control', vendor: 'Beta Facility', zone: 'South' };
const allSchedulesRow = { serviceName: 'Housekeeping', vendorName: 'beta facility', zone: { name: 'North' } };
const pendingProperty = { packageName: 'Silver AMC', zone: 'West', vendorNames: ['Gamma Care', 'Alpha Services'] };

test('reads a field across the shapes the schedules endpoints return', () => {
  assert.equal(fieldValue(rescheduleRequest, 'vendor'), 'Alpha Services');
  assert.equal(fieldValue(cancelledVisit, 'vendor'), 'Beta Facility');
  assert.equal(fieldValue(allSchedulesRow, 'zone'), 'North');
  assert.equal(fieldValue(rescheduleRequest, 'package'), 'Gold AMC');
  assert.deepEqual(fieldValues(pendingProperty, 'vendor'), ['Gamma Care', 'Alpha Services']);
  assert.deepEqual(fieldValues({ zone: { zone_name: 'East' } }, 'zone'), ['East']);
  // A vendor row names its zone in zone_name and may hold an id in zone
  assert.deepEqual(fieldValues({ zone: 4, zone_name: 'West' }, 'zone'), ['West']);
});

test('an employee lists every zone it is assigned to', () => {
  const employee = { name: 'Asha', assignedZones: ['North', 'South'] };
  assert.deepEqual(fieldValues(employee, 'zone'), ['North', 'South']);
  assert.deepEqual(fieldValues({ assigned_zones: ['East'] }, 'zone'), ['East']);
  assert.equal(matchesFilter(employee, 'zone', 'South'), true);
  assert.equal(matchesFilter(employee, 'zone', 'East'), false);
  // 'all' is an assignment rather than a zone; pages drop it from the options they offer
  assert.deepEqual(filterOptions([employee, { assignedZones: 'all' }], 'zone').filter(z => z !== 'all'),
    ['North', 'South']);
});

test('a missing, blank or unnamed value yields no option rather than an empty one', () => {
  for (const row of [{}, { vendor: '' }, { vendor: '   ' }, { vendor: null }, { vendor: {} }, { vendorNames: [] }]) {
    assert.deepEqual(fieldValues(row, 'vendor'), [], JSON.stringify(row));
    assert.equal(fieldValue(row, 'vendor'), '');
  }
  assert.deepEqual(filterOptions([{}, { vendor: null }], 'vendor'), []);
  assert.deepEqual(fieldValues(null, 'vendor'), []);
  assert.deepEqual(fieldValues(rescheduleRequest, 'unknownField'), []);
});

test('options are the distinct values present in the section, sorted', () => {
  const rows = [rescheduleRequest, cancelledVisit, allSchedulesRow, pendingProperty];
  assert.deepEqual(filterOptions(rows, 'vendor'),
    ['Alpha Services', 'beta facility', 'Beta Facility', 'Gamma Care']);
  assert.deepEqual(filterOptions(rows, 'service'), ['Housekeeping', 'Pest Control']);
  assert.deepEqual(filterOptions(rows, 'zone'), ['North', 'South', 'West']);
  assert.deepEqual(filterOptions(rows, 'package'), ['Gold AMC', 'Silver AMC']);
  assert.deepEqual(filterOptions(undefined, 'vendor'), []);
});

test('every offered option matches at least one row of the section', () => {
  const rows = [rescheduleRequest, cancelledVisit, allSchedulesRow, pendingProperty];
  for (const field of ['service', 'vendor', 'zone', 'package']) {
    for (const option of filterOptions(rows, field)) {
      assert.ok(rows.some(row => matchesFilter(row, field, option)), `${field}: ${option}`);
    }
  }
});

test('the all-option keeps every row, including under a section specific sentinel', () => {
  assert.equal(matchesFilter(cancelledVisit, 'vendor', 'all'), true);
  assert.equal(matchesFilter(cancelledVisit, 'vendor', ''), true);
  assert.equal(matchesFilter(cancelledVisit, 'vendor', undefined), true);
  assert.equal(matchesFilter(cancelledVisit, 'vendor', 'All Vendors', 'All Vendors'), true);
  assert.equal(matchesFilter(cancelledVisit, 'vendor', 'Alpha Services'), false);
  assert.equal(matchesFilter(pendingProperty, 'vendor', 'Alpha Services'), true);
  // A row without the field is filtered out, never treated as a match
  assert.equal(matchesFilter({}, 'zone', 'North'), false);
});
