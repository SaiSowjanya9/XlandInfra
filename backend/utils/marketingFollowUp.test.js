const test = require('node:test');
const assert = require('node:assert');

const {
  LEAD_STATUSES, CONTACT_METHODS, CUSTOMER_RESPONSES, NEXT_ACTIONS, DUE_STATUSES,
  COMPLETED_LEAD_STATUSES, ESTIMATE_DRIVEN_RESPONSES, FOLLOW_UP_INTERVAL_DAYS,
  istToday, toDateOnly, addDays, nextFollowUpFrom, dueStatus, isOpenLead,
  isCustomerResponseLocked, effectiveCustomerResponse
} = require('./marketingFollowUp');

test('the option lists are the workbook Dropdown Lists sheet, in its order', () => {
  assert.strictEqual(LEAD_STATUSES.length, 18);
  assert.strictEqual(LEAD_STATUSES[0], 'New Visit Completed');
  assert.strictEqual(LEAD_STATUSES[LEAD_STATUSES.length - 1], 'Closed');
  assert.deepStrictEqual(CONTACT_METHODS,
    ['WhatsApp', 'SMS/Text', 'Email', 'Phone Call', 'Field Visit', 'Portal Message', 'Other']);
  // The sheet listed nine; 'Rejected' is the tenth, because the estimate's own status drives
  // this column and a rejection is not the same answer as "never interested".
  assert.strictEqual(CUSTOMER_RESPONSES.length, 10);
  assert.ok(CUSTOMER_RESPONSES.includes('Not Interested'), 'Not Interested is offered as a response');
  assert.ok(CUSTOMER_RESPONSES.includes('Approved'), 'an approved estimate needs a response to map to');
  assert.ok(CUSTOMER_RESPONSES.includes('Rejected'), 'and so does a rejected one');
  assert.strictEqual(NEXT_ACTIONS.length, 14);
  assert.strictEqual(NEXT_ACTIONS[0], 'Coordinator Review');
  assert.strictEqual(NEXT_ACTIONS[NEXT_ACTIONS.length - 1], 'Close Lead');
  assert.deepStrictEqual(DUE_STATUSES, ['No Date', 'Overdue', 'Due Today', 'Upcoming', 'Completed']);
});

test('every completed lead status is a real lead status', () => {
  for (const status of COMPLETED_LEAD_STATUSES) {
    assert.ok(LEAD_STATUSES.includes(status), `${status} must exist in LEAD_STATUSES`);
  }
});

test('istToday reports the Indian calendar date, not the server timezone', () => {
  // 20:00 UTC on 11 Oct is already 01:30 on 12 Oct in India. A server in UTC that stamped its own
  // date would file an evening contact under the previous day.
  assert.strictEqual(istToday(new Date('2026-10-11T20:00:00Z')), '2026-10-12');
  // And just before the IST day rolls over, it is still the 11th.
  assert.strictEqual(istToday(new Date('2026-10-11T18:00:00Z')), '2026-10-11');
  assert.match(istToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('toDateOnly reads a MySQL DATE without rolling it back a day', () => {
  // mysql2 hands back a DATE as a Date at local midnight; toISOString() on that is the previous
  // day anywhere east of UTC, which is exactly where this product runs.
  const fromMysql = new Date(2026, 7, 5); // 5 Aug 2026, local midnight
  assert.strictEqual(toDateOnly(fromMysql), '2026-08-05');
});

test('toDateOnly accepts the shapes a form and an API actually send', () => {
  assert.strictEqual(toDateOnly('2026-08-05'), '2026-08-05');
  assert.strictEqual(toDateOnly('2026-08-05T00:00:00.000Z'), '2026-08-05');
  assert.strictEqual(toDateOnly(''), '');
  assert.strictEqual(toDateOnly(null), '');
  assert.strictEqual(toDateOnly(undefined), '');
  assert.strictEqual(toDateOnly('not a date'), '');
  assert.strictEqual(toDateOnly(new Date('nonsense')), '');
});

test('addDays crosses months, years and leap days', () => {
  assert.strictEqual(addDays('2026-08-05', 4), '2026-08-09');
  assert.strictEqual(addDays('2026-08-29', 4), '2026-09-02');
  assert.strictEqual(addDays('2026-12-30', 4), '2027-01-03');
  assert.strictEqual(addDays('2028-02-26', 4), '2028-03-01', 'leap year: 29 Feb exists');
  assert.strictEqual(addDays('2027-02-26', 4), '2027-03-02', 'non-leap year');
  assert.strictEqual(addDays('', 4), '');
});

test('the next follow-up is four days after the contact', () => {
  assert.strictEqual(FOLLOW_UP_INTERVAL_DAYS, 4);
  assert.strictEqual(nextFollowUpFrom('2026-08-05'), '2026-08-09');
  assert.strictEqual(nextFollowUpFrom(''), '');
});

test('due status reproduces the workbook formula', () => {
  const today = '2026-08-10';
  assert.strictEqual(dueStatus('2026-08-09', 'Customer Review', today), 'Overdue');
  assert.strictEqual(dueStatus('2026-08-10', 'Customer Review', today), 'Due Today');
  assert.strictEqual(dueStatus('2026-08-11', 'Customer Review', today), 'Upcoming');
  assert.strictEqual(dueStatus('', 'Customer Review', today), 'No Date');
});

test('a finished lead reads Completed whatever its date says', () => {
  const today = '2026-08-10';
  for (const status of ['Closed', 'Service Started', 'Not Interested']) {
    assert.strictEqual(dueStatus('2026-01-01', status, today), 'Completed', `${status} is not overdue`);
    assert.strictEqual(dueStatus('2026-12-31', status, today), 'Completed', `${status} is not upcoming`);
  }
});

test('the blank test comes before the completed test, as in the formula', () => {
  // =IF(S="","No Date", IF(OR(...),"Completed", ...)) -- a closed lead with no date is "No Date".
  assert.strictEqual(dueStatus('', 'Closed', '2026-08-10'), 'No Date');
  assert.strictEqual(dueStatus(null, 'Service Started', '2026-08-10'), 'No Date');
});

test('due status copes with a Date object and an untrimmed status', () => {
  assert.strictEqual(dueStatus(new Date(2026, 7, 10), 'Customer Review', '2026-08-10'), 'Due Today');
  assert.strictEqual(dueStatus('2026-01-01', '  Closed  ', '2026-08-10'), 'Completed');
});

test('a year boundary is compared as a date, not as text length', () => {
  assert.strictEqual(dueStatus('2025-12-31', 'Customer Review', '2026-01-01'), 'Overdue');
  assert.strictEqual(dueStatus('2026-01-02', 'Customer Review', '2025-12-31'), 'Upcoming');
});

test('due status defaults to the Indian date when none is passed', () => {
  assert.strictEqual(dueStatus(istToday(), 'Customer Review'), 'Due Today');
  assert.strictEqual(dueStatus(addDays(istToday(), -1), 'Customer Review'), 'Overdue');
  assert.strictEqual(dueStatus(addDays(istToday(), 1), 'Customer Review'), 'Upcoming');
});

test('every due status the helper returns is one the workbook lists', () => {
  const produced = new Set([
    dueStatus('', 'Customer Review', '2026-08-10'),
    dueStatus('2026-08-09', 'Customer Review', '2026-08-10'),
    dueStatus('2026-08-10', 'Customer Review', '2026-08-10'),
    dueStatus('2026-08-11', 'Customer Review', '2026-08-10'),
    dueStatus('2026-08-11', 'Closed', '2026-08-10')
  ]);
  assert.strictEqual(produced.size, 5, 'all five branches are reachable');
  for (const value of produced) assert.ok(DUE_STATUSES.includes(value), `${value} is a listed status`);
});

test('an approved or rejected estimate answers Customer Response itself', () => {
  assert.strictEqual(effectiveCustomerResponse('approved', ''), 'Approved');
  assert.strictEqual(effectiveCustomerResponse('rejected', ''), 'Rejected');
  // And it overrules whatever the FP had chosen -- the tracker cannot say the customer is still
  // reviewing an estimate that has been approved.
  assert.strictEqual(effectiveCustomerResponse('approved', 'Received - Reviewing'), 'Approved');
  assert.strictEqual(effectiveCustomerResponse('rejected', 'Interested'), 'Rejected');
});

test('while the estimate is open the FP keeps their own answer', () => {
  for (const status of ['draft', 'sent', '', null, undefined, 'pending']) {
    assert.strictEqual(effectiveCustomerResponse(status, 'Need Call Back'), 'Need Call Back', String(status));
  }
  assert.strictEqual(effectiveCustomerResponse('sent', ''), '', 'no answer stays no answer');
  assert.strictEqual(effectiveCustomerResponse('draft', null), '');
});

test('the estimate status is matched case- and space-insensitively', () => {
  // fp_estimates.status is lowercase today, but the column is free text and the portal has sent
  // 'Approved' before now.
  for (const status of ['Approved', 'APPROVED', ' approved ']) {
    assert.strictEqual(effectiveCustomerResponse(status, 'Interested'), 'Approved', status);
  }
  assert.strictEqual(effectiveCustomerResponse(' Rejected ', 'Interested'), 'Rejected');
});

test('the response is locked exactly when the estimate has been decided', () => {
  assert.strictEqual(isCustomerResponseLocked('approved'), true);
  assert.strictEqual(isCustomerResponseLocked('rejected'), true);
  for (const status of ['draft', 'sent', '', null, undefined]) {
    assert.strictEqual(isCustomerResponseLocked(status), false, String(status));
  }
  // A status that merely looks like one of them must not lock the field.
  assert.strictEqual(isCustomerResponseLocked('approved_by_manager'), false);
});

test('every value the estimate can force is a selectable response', () => {
  for (const response of Object.values(ESTIMATE_DRIVEN_RESPONSES)) {
    assert.ok(CUSTOMER_RESPONSES.includes(response),
      `${response} is forced onto the row but the PUT would reject it`);
  }
});

test('the tracker list derives the response rather than storing it', () => {
  // A stored copy would be right only until somebody changed the estimate; presentTrackerRow has
  // to resolve it on every read, the same way it resolves the tracker status.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'marketing.js'), 'utf8');
  assert.match(source, /customer_response: effectiveCustomerResponse\(row\.status, row\.customer_response\)/,
    'presentTrackerRow must derive customer_response from the estimate status');
});

test('the tracker PUT validates options on the decoded value', () => {
  // middleware/security.js escapes '/' to '&#x2F;', so 'SMS/Text' arrives escaped. Validating the
  // raw value rejects it with a 400 the portal cannot explain, and the Last Contact Method select
  // silently stops saving. The route must decode before it compares, and store the escaped form.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'marketing.js'), 'utf8');

  assert.match(source, /const decoded = decodeEntities\(String\(value\)\)\.trim\(\);/,
    'the option loop must decode the submitted value');
  assert.match(source, /if \(!options\.includes\(decoded\)\)/,
    'the option list must be checked against the decoded value, not the raw one');
  assert.ok(!/if \(!options\.includes\(value\)\)/.test(source),
    'the raw-value check must be gone');

  // And at least one offered option really does contain a character that gets escaped.
  const escaped = CONTACT_METHODS.filter((m) => /[/&'"<>\\`]/.test(m));
  assert.ok(escaped.length > 0, 'SMS/Text is why this rule exists');
});

test('an open lead is anything not finished', () => {
  assert.strictEqual(isOpenLead('Customer Review'), true);
  assert.strictEqual(isOpenLead(''), true, 'a lead with no status is still being worked');
  assert.strictEqual(isOpenLead('Closed'), false);
  assert.strictEqual(isOpenLead('Service Started'), false);
  assert.strictEqual(isOpenLead('Not Interested'), false);
});
