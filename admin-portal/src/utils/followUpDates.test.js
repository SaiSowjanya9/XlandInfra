import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  LEAD_STATUSES, CONTACT_METHODS, CUSTOMER_RESPONSES, NEXT_ACTIONS, DUE_STATUSES,
  COMPLETED_LEAD_STATUSES, FOLLOW_UP_INTERVAL_DAYS,
  istToday, toDateOnly, addDays, nextFollowUpFrom, dueStatus, isOpenLead,
  contactStamp, DUE_STATUS_STYLES
} from './followUpDates.js';

const require = createRequire(import.meta.url);
const server = require('../../../backend/utils/marketingFollowUp.js');

// The browser copy exists only because a browser cannot require the CommonJS module the server
// validates with. If the two ever disagree, the tracker offers an option the PUT rejects, or
// draws a due status the dashboard does not count.
test('the mirror offers exactly the options the server accepts', () => {
  assert.deepEqual(LEAD_STATUSES, server.LEAD_STATUSES);
  assert.deepEqual(CONTACT_METHODS, server.CONTACT_METHODS);
  assert.deepEqual(CUSTOMER_RESPONSES, server.CUSTOMER_RESPONSES);
  assert.deepEqual(NEXT_ACTIONS, server.NEXT_ACTIONS);
  assert.deepEqual(DUE_STATUSES, server.DUE_STATUSES);
  assert.deepEqual(COMPLETED_LEAD_STATUSES, server.COMPLETED_LEAD_STATUSES);
  assert.equal(FOLLOW_UP_INTERVAL_DAYS, server.FOLLOW_UP_INTERVAL_DAYS);
});

test('both copies read the same Indian date from the same instant', () => {
  for (const iso of [
    '2026-10-11T18:29:00Z', // 23:59 IST on the 11th
    '2026-10-11T18:30:00Z', // 00:00 IST on the 12th
    '2026-10-11T20:00:00Z',
    '2026-01-01T00:00:00Z',
    '2026-12-31T23:59:00Z'
  ]) {
    const at = new Date(iso);
    assert.equal(istToday(at), server.istToday(at), iso);
  }
});

test('both copies normalise the same date shapes identically', () => {
  for (const value of [
    '2026-08-05', '2026-08-05T00:00:00.000Z', '', null, undefined, 'not a date',
    new Date(2026, 7, 5), new Date('nonsense')
  ]) {
    assert.equal(toDateOnly(value), server.toDateOnly(value), String(value));
  }
});

test('both copies add days identically across months, years and leap days', () => {
  for (const date of ['2026-08-05', '2026-08-29', '2026-12-30', '2028-02-26', '2027-02-26', '']) {
    for (const days of [-7, -1, 0, 1, 4, 30]) {
      assert.equal(addDays(date, days), server.addDays(date, days), `${date} + ${days}`);
    }
  }
});

test('both copies schedule the next follow-up four days out', () => {
  assert.equal(FOLLOW_UP_INTERVAL_DAYS, 4);
  for (const date of ['2026-08-05', '2026-12-30', '']) {
    assert.equal(nextFollowUpFrom(date), server.nextFollowUpFrom(date), date);
  }
  assert.equal(nextFollowUpFrom('2026-08-05'), '2026-08-09');
});

test('both copies derive the same due status for every branch', () => {
  const today = '2026-08-10';
  const dates = ['', null, '2026-08-09', '2026-08-10', '2026-08-11', '2025-12-31', new Date(2026, 7, 10)];
  const statuses = ['', 'Customer Review', 'Closed', 'Service Started', 'Not Interested', 'Agreement Pending'];
  for (const date of dates) {
    for (const status of statuses) {
      assert.equal(
        dueStatus(date, status, today),
        server.dueStatus(date, status, today),
        `${String(date)} / ${status}`
      );
    }
  }
});

test('due status follows the workbook formula, blank test first', () => {
  const today = '2026-08-10';
  assert.equal(dueStatus('2026-08-09', 'Customer Review', today), 'Overdue');
  assert.equal(dueStatus('2026-08-10', 'Customer Review', today), 'Due Today');
  assert.equal(dueStatus('2026-08-11', 'Customer Review', today), 'Upcoming');
  assert.equal(dueStatus('2026-01-01', 'Closed', today), 'Completed');
  assert.equal(dueStatus('', 'Closed', today), 'No Date', 'no date wins over completed');
});

test('both copies agree on which leads are still open', () => {
  for (const status of ['', 'Customer Review', 'Closed', 'Service Started', 'Not Interested']) {
    assert.equal(isOpenLead(status), server.isOpenLead(status), status);
  }
});

test('a contact stamps today in IST and schedules four days out', () => {
  const at = new Date('2026-10-11T20:00:00Z'); // already the 12th in India
  assert.deepEqual(contactStamp(at), {
    last_contact_date: '2026-10-12',
    next_follow_up_date: '2026-10-16'
  });
});

test('every due status has a style, and nothing styles a status that cannot happen', () => {
  for (const status of DUE_STATUSES) {
    assert.ok(DUE_STATUS_STYLES[status], `${status} must be drawable`);
  }
  for (const styled of Object.keys(DUE_STATUS_STYLES)) {
    assert.ok(DUE_STATUSES.includes(styled), `${styled} is not a real due status`);
  }
});
