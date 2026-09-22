import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleFieldValue, scheduleFieldValues, scheduleFilterOptions, matchesScheduleFilter
} from './scheduleFilterOptions.js';

// One row per shape the schedules endpoints actually return.
const rescheduleRequest = { serviceName: 'Housekeeping', vendorName: 'Alpha Services', zone: 'North', packageName: 'Gold AMC' };
const cancelledVisit = { service: 'Pest Control', vendor: 'Beta Facility', zone: 'South' };
const allSchedulesRow = { serviceName: 'Housekeeping', vendorName: 'beta facility', zone: { name: 'North' } };
const pendingProperty = { packageName: 'Silver AMC', zone: 'West', vendorNames: ['Gamma Care', 'Alpha Services'] };

test('reads a field across the shapes the schedules endpoints return', () => {
  assert.equal(scheduleFieldValue(rescheduleRequest, 'vendor'), 'Alpha Services');
  assert.equal(scheduleFieldValue(cancelledVisit, 'vendor'), 'Beta Facility');
  assert.equal(scheduleFieldValue(allSchedulesRow, 'zone'), 'North');
  assert.equal(scheduleFieldValue(rescheduleRequest, 'package'), 'Gold AMC');
  assert.deepEqual(scheduleFieldValues(pendingProperty, 'vendor'), ['Gamma Care', 'Alpha Services']);
  assert.deepEqual(scheduleFieldValues({ zone: { zone_name: 'East' } }, 'zone'), ['East']);
});

test('a missing, blank or unnamed value yields no option rather than an empty one', () => {
  for (const row of [{}, { vendor: '' }, { vendor: '   ' }, { vendor: null }, { vendor: {} }, { vendorNames: [] }]) {
    assert.deepEqual(scheduleFieldValues(row, 'vendor'), [], JSON.stringify(row));
    assert.equal(scheduleFieldValue(row, 'vendor'), '');
  }
  assert.deepEqual(scheduleFilterOptions([{}, { vendor: null }], 'vendor'), []);
  assert.deepEqual(scheduleFieldValues(null, 'vendor'), []);
  assert.deepEqual(scheduleFieldValues(rescheduleRequest, 'unknownField'), []);
});

test('options are the distinct values present in the section, sorted', () => {
  const rows = [rescheduleRequest, cancelledVisit, allSchedulesRow, pendingProperty];
  assert.deepEqual(scheduleFilterOptions(rows, 'vendor'),
    ['Alpha Services', 'beta facility', 'Beta Facility', 'Gamma Care']);
  assert.deepEqual(scheduleFilterOptions(rows, 'service'), ['Housekeeping', 'Pest Control']);
  assert.deepEqual(scheduleFilterOptions(rows, 'zone'), ['North', 'South', 'West']);
  assert.deepEqual(scheduleFilterOptions(rows, 'package'), ['Gold AMC', 'Silver AMC']);
  assert.deepEqual(scheduleFilterOptions(undefined, 'vendor'), []);
});

test('every offered option matches at least one row of the section', () => {
  const rows = [rescheduleRequest, cancelledVisit, allSchedulesRow, pendingProperty];
  for (const field of ['service', 'vendor', 'zone', 'package']) {
    for (const option of scheduleFilterOptions(rows, field)) {
      assert.ok(rows.some(row => matchesScheduleFilter(row, field, option)), `${field}: ${option}`);
    }
  }
});

test('the all-option keeps every row, including under a section specific sentinel', () => {
  assert.equal(matchesScheduleFilter(cancelledVisit, 'vendor', 'all'), true);
  assert.equal(matchesScheduleFilter(cancelledVisit, 'vendor', ''), true);
  assert.equal(matchesScheduleFilter(cancelledVisit, 'vendor', undefined), true);
  assert.equal(matchesScheduleFilter(cancelledVisit, 'vendor', 'All Vendors', 'All Vendors'), true);
  assert.equal(matchesScheduleFilter(cancelledVisit, 'vendor', 'Alpha Services'), false);
  assert.equal(matchesScheduleFilter(pendingProperty, 'vendor', 'Alpha Services'), true);
  // A row without the field is filtered out, never treated as a match
  assert.equal(matchesScheduleFilter({}, 'zone', 'North'), false);
});
