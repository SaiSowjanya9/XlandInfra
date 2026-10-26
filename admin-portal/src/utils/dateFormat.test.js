import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDate, formatDateTime, toDateInputValue, maskTypedDate, parseTypedDate, toTypedDate,
  istTodayValue, DATE_PLACEHOLDER, formatMonthYear
} from './dateFormat.js';

test('every date reads dd/mm/yyyy', () => {
  assert.equal(formatDate('2026-08-05'), '05/08/2026');
  assert.equal(formatDate('2026-12-31'), '31/12/2026');
  // Single digits are padded, so a column of dates lines up.
  assert.equal(formatDate('2026-01-02'), '02/01/2026');
  assert.equal(DATE_PLACEHOLDER, 'dd/mm/yyyy');
});

test('a date-only value never shifts by a day, whatever timezone the browser is in', () => {
  // This is the bug in the fifty local copies: new Date('2026-08-05') is UTC midnight, and
  // toLocaleDateString then renders it in the viewer's zone -- 04/08 anywhere west of UTC.
  // A calendar day has no time to convert, so it is read from its own digits.
  assert.equal(formatDate('2026-08-05'), '05/08/2026');
  assert.equal(formatDate('2026-08-05T00:00:00'), '05/08/2026');
  assert.equal(formatDate('2026-08-05T00:00:00.000Z'), '05/08/2026');
  assert.equal(toDateInputValue('2026-08-05T00:00:00.000Z'), '2026-08-05');
});

test('a real timestamp is reported as the day it was in India', () => {
  // 20:00 UTC on 11 Oct is already past midnight in India, so it belongs to the 12th. A viewer in
  // London would otherwise see the 11th and an Indian colleague the 12th, for the same record.
  assert.equal(formatDate(new Date('2026-10-11T20:00:00Z')), '12/10/2026');
  // And just before the IST day rolls over it is still the 11th.
  assert.equal(formatDate(new Date('2026-10-11T18:00:00Z')), '11/10/2026');
});

test('empty and unparseable values answer the fallback the local helpers used', () => {
  for (const empty of ['', null, undefined]) assert.equal(formatDate(empty), '-');
  assert.equal(formatDate('not a date'), '-');
  assert.equal(formatDate(new Date('nonsense')), '-');
  assert.equal(formatDate('', ''), '', 'the fallback is overridable');
  assert.equal(formatDateTime(null), '-');
});

test('a date and time is dd/mm/yyyy on a 12-hour IST clock', () => {
  // 10:30 UTC is 16:00 IST. The screens that show a time were already 12-hour, so only their
  // date part changes.
  const formatted = formatDateTime(new Date('2026-08-05T10:30:00Z'));
  assert.match(formatted, /^05\/08\/2026, 4:00\s?[ap]m$/i, formatted);
  assert.equal(formatDateTime('', 'Never'), 'Never', 'the fallback is overridable');
});

test('the wire format stays yyyy-mm-dd', () => {
  // Every existing change handler and the server's DATE columns expect this, so the display
  // format must not leak into the value.
  assert.equal(toDateInputValue('2026-08-05'), '2026-08-05');
  assert.equal(toDateInputValue(new Date('2026-08-05T10:30:00Z')), '2026-08-05');
  assert.equal(toDateInputValue(''), '');
  assert.equal(toDateInputValue('rubbish'), '');
});

test('typing is masked into dd/mm/yyyy', () => {
  assert.equal(maskTypedDate('0'), '0');
  assert.equal(maskTypedDate('05'), '05');
  assert.equal(maskTypedDate('058'), '05/8');
  assert.equal(maskTypedDate('0508'), '05/08');
  assert.equal(maskTypedDate('05082026'), '05/08/2026');
  // Separators the user types themselves are ignored; only digits count.
  assert.equal(maskTypedDate('05/08/2026'), '05/08/2026');
  assert.equal(maskTypedDate('5-8-2026'), '58/20/26');
  // And it cannot grow past a date.
  assert.equal(maskTypedDate('050820261234'), '05/08/2026');
});

test('a typed date becomes a value only when it is a real calendar day', () => {
  assert.equal(parseTypedDate('05/08/2026'), '2026-08-05');
  assert.equal(parseTypedDate('5/8/2026'), '2026-08-05');
  // Incomplete input is not a date yet.
  assert.equal(parseTypedDate('05/08'), '');
  assert.equal(parseTypedDate(''), '');
  // 31 February would be rolled forward to 3 March by `new Date`; that silently stores a day the
  // user did not choose, so it is refused instead.
  assert.equal(parseTypedDate('31/02/2026'), '');
  assert.equal(parseTypedDate('30/02/2028'), '', 'not even in a leap year');
  assert.equal(parseTypedDate('29/02/2028'), '2028-02-29', 'but a leap day is real');
  assert.equal(parseTypedDate('00/08/2026'), '');
  assert.equal(parseTypedDate('05/13/2026'), '', 'month 13 is not a US date, it is no date');
  assert.equal(parseTypedDate('31/12/2026'), '2026-12-31');
});

test('a stored value round-trips through the box without drifting', () => {
  for (const value of ['2026-08-05', '2026-01-01', '2028-02-29', '2026-12-31']) {
    assert.equal(parseTypedDate(toTypedDate(value)), value, value);
  }
  assert.equal(toTypedDate(''), '');
});

test('today is the Indian today', () => {
  assert.match(istTodayValue(), /^\d{4}-\d{2}-\d{2}$/);
  const istNow = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  assert.equal(istTodayValue(), istNow);
});

test('a chart month reads "May 2026", never 01/05/2026', () => {
  assert.equal(formatMonthYear(new Date(2026, 4, 1)), 'May 2026');
  assert.equal(formatMonthYear(new Date(2026, 11, 31)), 'Dec 2026');
  assert.equal(formatMonthYear('2026-10-01'), 'Oct 2026');
  assert.equal(formatMonthYear(''), '-');
  assert.equal(formatMonthYear(new Date('nope')), '-');
});
