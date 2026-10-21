/**
 * The complaint workflow's rules, which five portals share and none of them may re-interpret:
 * who may move a complaint where, what a note may hold, and which employees can be handed one.
 *
 * The statuses are the agreed lifecycle -- Open -> Assigned -> In Review -> Closed -- and what
 * matters most is what nobody may set. **The assignee may set no status at all**: they report by
 * saving their note, which the server moves to In Review for them, because an employee who could
 * set the status could mark their own work reviewed and the step exists so somebody else looks.
 * And nobody sets 'Assigned' by hand, because assigning is what produces it -- a row claiming an
 * assignee it does not have is how an unassigned complaint would look attended to.
 *
 * Run: node --test backend/utils/marketingComplaints.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

// The module reaches for a connection to back-fill its table; nothing below touches the database,
// but requiring config/database for real would point this test at the local one.
require.cache[require.resolve('../config/database')] = {
  exports: { pool: { execute: async () => [[{ n: 1 }]] } }
};

const {
  COMPLAINT_STATUSES,
  ASSIGNABLE_ROLES,
  normalizeComplaintStatus,
  complaintStatusesFor,
  resolveComplaintStatus,
  parseComplaintNote,
  normalizeEmployeeRole,
  isAssignableRole
} = require('./marketingComplaints');

const FP = { canClose: true };
const ASSIGNEE = { isAssignee: true };
const READER = {};

test('the lifecycle is the agreed one, in order', () => {
  assert.deepEqual(COMPLAINT_STATUSES, ['Open', 'Assigned', 'In Review', 'Closed']);
});

test('the assignee may set no status at all -- their note is the report', () => {
  assert.deepEqual(complaintStatusesFor(ASSIGNEE), []);

  // Closing is the review step, and it archives the complaint -- never the assignee's to make.
  const closed = resolveComplaintStatus({ status: 'Closed' }, ASSIGNEE);
  assert.equal(closed.forbidden, true);

  // Nor may they declare their own work reviewed, which is exactly what a status of their own
  // would have let them do -- so the refusal points them at the note instead of saying "no".
  const reviewed = resolveComplaintStatus({ status: 'In Review' }, ASSIGNEE);
  assert.equal(reviewed.forbidden, true);
  assert.match(reviewed.error, /Save your notes/);
});

test('the FP and its manager may set anything except Assigned', () => {
  assert.deepEqual(complaintStatusesFor(FP), ['Open', 'In Review', 'Closed']);

  for (const status of ['Open', 'In Review', 'Closed']) {
    assert.equal(resolveComplaintStatus({ status }, FP).error, null, status);
  }

  // Assigning is what produces 'Assigned'. Offered from the dropdown it would let a row claim an
  // assignee nobody chose.
  const assigned = resolveComplaintStatus({ status: 'Assigned' }, FP);
  assert.equal(assigned.forbidden, true);
  assert.doesNotMatch(assigned.error, /Assigned/);
});

test('a caller who is neither may not touch the status at all', () => {
  assert.deepEqual(complaintStatusesFor(READER), []);
  const refused = resolveComplaintStatus({ status: 'In Review' }, READER);
  assert.equal(refused.forbidden, true);
  assert.match(refused.error, /do not have permission/);
});

test('the two retired statuses resolve to In Review rather than 400ing', () => {
  // 'In Progress' and 'Reviewed' described one state between them and are gone (schema_v54). The
  // only thing that still sends one is a browser left open on the old dropdown, and answering
  // "Status must be one of" there would be a dead screen rather than a corrected one.
  for (const legacy of ['In Progress', 'Reviewed']) {
    const resolved = resolveComplaintStatus({ status: legacy }, FP);
    assert.equal(resolved.error, null, legacy);
    assert.equal(resolved.status, 'In Review', legacy);
  }
  // A stored row is read the same way, so a deployment without schema_v54 still shows the
  // workflow rather than a status no portal has.
  assert.equal(normalizeComplaintStatus('In Progress'), 'In Review');
  assert.equal(normalizeComplaintStatus('Reviewed'), 'In Review');
  // Blank is 'Open': schema_v47 created the table with no status column at all.
  assert.equal(normalizeComplaintStatus(null), 'Open');
  assert.equal(normalizeComplaintStatus(''), 'Open');
  // And anything unrecognised reads as Open rather than echoing itself into a badge.
  assert.equal(normalizeComplaintStatus('Escalated'), 'Open');
  // Escaped text is decoded first, exactly as the concern options are.
  assert.equal(normalizeComplaintStatus('In&#x20;Review'), 'In Review');
});

test('a status that does not exist is a bad request, not a refusal', () => {
  // The two are answered with different codes: a portal offering the wrong option and a caller
  // reaching past their permissions are not the same mistake.
  const unknown = resolveComplaintStatus({ status: 'Done' }, FP);
  assert.ok(!unknown.forbidden);
  assert.match(unknown.error, /must be one of/);

  const missing = resolveComplaintStatus({}, FP);
  assert.ok(!missing.forbidden);
  assert.match(missing.error, /required/);
});

test('the status is stored as the canonical name, trimmed', () => {
  // Request text is escaped once by middleware/security.js, but none of the four statuses contains
  // a character that escapes, so the canonical name is also the stored form -- and writing it
  // rather than echoing the request is what lets a retired status be corrected on the way in.
  assert.equal(resolveComplaintStatus({ status: ' In Review ' }, FP).status, 'In Review');
  assert.equal(resolveComplaintStatus({ status: 'Closed' }, FP).status, 'Closed');
});

test('the note is capped on what was typed, not on what was escaped', () => {
  // 500 slashes arrive as 500 x '&#x2F;' -- 3000 characters. Judged on the escaped length, a note
  // the form accepted would be refused by the server with nothing to explain it.
  const slashes = '&#x2F;'.repeat(500);
  assert.equal(parseComplaintNote({ note: slashes }).error, null);
  assert.equal(parseComplaintNote({ note: slashes }).note, slashes);

  assert.match(parseComplaintNote({ note: 'x'.repeat(501) }).error, /500 characters or fewer/);

  // An empty box clears the note rather than storing '' -- mysql2 refuses an undefined bind, and
  // the column reads back as "no note" either way.
  assert.deepEqual(parseComplaintNote({ note: '   ' }), { error: null, note: null });
  assert.deepEqual(parseComplaintNote({}), { error: null, note: null });
});

test('only a role with the Complaint Form screen can be assigned a complaint', () => {
  // The four portals that have that screen. The supervisor portal has it and nothing else of
  // Marketing -- no tracker, no marketing dashboard -- which its own mount enforces.
  assert.deepEqual(ASSIGNABLE_ROLES, ['manager', 'coordinator', 'supervisor', 'executive']);

  // schema_v8 spelled the roles with an fp_ prefix and the employee form spells them without, so
  // both describe the same person.
  assert.equal(normalizeEmployeeRole('fp_manager'), 'manager');
  assert.equal(normalizeEmployeeRole(' Executive '), 'executive');
  assert.equal(normalizeEmployeeRole(null), '');
  for (const role of ['manager', 'fp_manager', 'coordinator', 'supervisor', 'fp_supervisor', 'executive', 'fp_executive']) {
    assert.equal(isAssignableRole(role), true, role);
  }

  // Anything else has no portal to read the assignment in, so a complaint handed to it would go to
  // a screen that does not exist.
  for (const role of ['field_staff', 'fp_admin', 'vendor', '', null]) {
    assert.equal(isAssignableRole(role), false, String(role));
  }
});
