/**
 * The marketing router is mounted by three portals, so the thing worth testing is the scope: an
 * FP must never see another partner's leads, a zone manager must never see a zone it was not
 * assigned, and the view-only Operations Manager must be refused on the server and not merely in
 * the sidebar. The assertions below read the SQL the router builds, because that is where a lost
 * filter actually shows up -- a mock that silently returns the same rows for every caller would
 * pass a test written against the response alone.
 *
 * Run: node --test backend/routes/marketing.test.js
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const trackerRow = {
  id: 31, estimate_id: 'EST-1', client_name: 'Client', status: 'draft',
  lead_status: 'Estimate Sent', last_contact_date: '2026-01-05', next_follow_up_date: '2026-01-09',
  tracker_status: null, tracked_at: '2026-01-05 10:00:00', tracker_archived_at: null
};
// Assigned to employee 4 and being worked on, which is what the status and note routes are judged
// against: the current-row read in both of them comes back as this.
const complaintRow = {
  id: 7, franchise_partner_id: 8, property_id: 'PROP-1', zone: 'North Zone', comments: 'Late visit',
  status: 'Assigned', assigned_employee_id: 4, assigned_employee_name: 'Priya N',
  assigned_employee_role: 'coordinator', archived_at: null,
  // Filed by, or about, this resident -- who hears about every move the complaint makes.
  customer_account_id: 55, customer_email: 'asha@example.com'
};

// The partner's staff. 4, 5 and 10 are assignable -- each has the Complaint Form screen to read the
// assignment in. Employee 9 is field staff, with no portal of their own, so a complaint handed to
// them would go to a screen that does not exist and the route refuses it.
const employeeRows = {
  4: { id: 4, franchise_partner_id: 8, user_id: 42, first_name: 'Priya', last_name: 'N', email: 'priya@example.com', role: 'coordinator', is_active: 1 },
  5: { id: 5, franchise_partner_id: 8, user_id: 43, first_name: 'Ravi', last_name: 'M', email: 'ravi@example.com', role: 'fp_manager', is_active: 1 },
  9: { id: 9, franchise_partner_id: 8, user_id: 44, first_name: 'Sita', last_name: 'B', email: 'sita@example.com', role: 'field_staff', is_active: 1 },
  10: { id: 10, franchise_partner_id: 8, user_id: 45, first_name: 'Vikram', last_name: 'S', email: 'vikram@example.com', role: 'supervisor', is_active: 1 }
};

const calls = [];
const pool = {
  execute: async (sql, params = []) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    // The partner-name lookup asks which of the candidate columns this database actually has.
    // This one is modelled on the real schema, which has company_name and owner_name but no
    // contact_person -- naming that third column is what made the admin list answer 500.
    if (sql.includes("table_name = 'franchise_partners'")) {
      return [[{ column_name: 'company_name' }, { column_name: 'owner_name' }]];
    }
    // Both runtime backfills report the column/table as already present.
    if (sql.includes('information_schema.columns')) return [[{ n: 1 }]];
    if (sql.includes('information_schema.tables')) return [[{ n: 1 }]];
    // The PUT's current-row read carries the stored follow-up stage, so the forward-only rule
    // has something to judge submissions against: this lead sits at Step 3. It is also tracked,
    // days old and unreviewed, so its automatic tracker status is Pending Employee Review --
    // which is what the store-NULL-on-match rule is judged against.
    if (sql.startsWith('SELECT id, follow_up_stage')) {
      return [[{
        id: 31, follow_up_stage: 'Step 3 - Follow-Up 1',
        status: 'draft', tracker_status: null,
        tracked_at: '2026-01-05 10:00:00', coordinator_reviewed: 'No',
        created_at: '2026-01-01 00:00:00'
      }]];
    }
    if (sql.includes('FROM fp_estimates')) return [[trackerRow]];
    if (sql.startsWith('UPDATE fp_estimates')) return [{ affectedRows: 1 }];
    // One employee, by id and partner (the assignment's own lookup)...
    if (sql.includes('FROM fp_employees') && sql.includes('WHERE id = ?')) {
      const row = employeeRows[params[0]];
      return [row && row.franchise_partner_id === params[1] ? [row] : []];
    }
    // ...and the whole assignable roster, with the zones that make one "recommended".
    if (sql.includes('FROM fp_employees')) return [Object.values(employeeRows)];
    if (sql.includes('FROM fp_employee_zones')) {
      return [[{ fp_employee_id: 4, zone_name: 'North Zone' }, { fp_employee_id: 5, zone_name: 'all' }]];
    }
    // The resident a staff-filed complaint is about: one account on this property, so there is no
    // ambiguity about who to report back to.
    if (sql.includes('FROM customer_accounts')) {
      return [[{ id: 55, email: 'asha@example.com', first_name: 'Asha', last_name: 'K', phone: '9876543210', property_code: 'PROP-1' }]];
    }
    if (sql.includes(`FROM ${COMPLAINT_TABLE}`)) return [[complaintRow]];
    if (sql.startsWith(`INSERT INTO ${COMPLAINT_TABLE}`)) return [{ insertId: 7 }];
    if (sql.startsWith(`UPDATE ${COMPLAINT_TABLE}`)) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected SQL: ${sql}`);
  }
};
// Installed before anything that reaches for a connection: utils/marketingComplaints.js requires
// config/database itself, so requiring it first would hand the real pool to the table backfill and
// point this test at the local database.
require.cache[require.resolve('../config/database')] = { exports: { pool } };

// Stands in for the notification service, which would otherwise load emailService and open a real
// SMTP connection for every assignment this file makes. What is worth asserting is *that* a hop
// announces itself and to whom, which is what this records.
const notified = [];
require.cache[require.resolve('../services/complaintNotifications')] = {
  exports: {
    notifyComplaintAssigned: (complaint) => notified.push({ event: 'assigned', id: complaint?.id }),
    notifyComplaintProgress: (complaint, opts = {}) => notified.push({ event: 'progress', id: complaint?.id, ...opts }),
    notifyComplaintClosed: (complaint) => notified.push({ event: 'closed', id: complaint?.id }),
    notifyCustomerComplaintStatus: (complaint, { status } = {}) =>
      notified.push({ event: 'customer', id: complaint?.id, status, to: complaint?.customer_email })
  }
};

const { COMPLAINT_TABLE } = require('../utils/marketingComplaints');
const { createMarketingRouter } = require('./marketing');

// The three real mounts, plus the view-only variant the Operations Manager gets.
const scopes = {
  // Assigning a complaint and closing one are the franchise partner's own; the manager shares the
  // close (it is the review step) but never the assignment.
  fp: () => ({
    fpIds: [8], writeFpId: 8, zones: null,
    canWrite: true, canAssign: true, canClose: true, withPartnerName: false
  }),
  admin: (req) => ({
    fpIds: req.query.fpId ? [Number(req.query.fpId)] : null,
    writeFpId: req.query.fpId ? Number(req.query.fpId) : (Number(req.body?.franchise_partner_id) || null),
    zones: null,
    canWrite: true,
    withPartnerName: true
  }),
  manager: () => ({
    fpIds: [8], writeFpId: 8, zones: ['North Zone', 'South Zone'],
    canWrite: true, canClose: true, assignee: { employeeId: 5 }, withPartnerName: false
  }),
  // The coordinator reads the pipeline and marks the review; the executive only reads. Both are
  // also allowed the leads they entered themselves, wherever the property sits -- and the
  // complaint assigned to them, which they report on.
  coordinator: () => ({
    fpIds: [8], writeFpId: 8, zones: ['North Zone'],
    creator: { id: 42, email: 'priya@example.com', username: 'priya' },
    assignee: { employeeId: 4 },
    canWrite: false, canReview: true, withPartnerName: false
  }),
  executive: () => ({
    fpIds: [8], writeFpId: 8, zones: ['North Zone'],
    creator: { id: 42, email: 'priya@example.com', username: 'priya' },
    // Assigned to somebody else, so every complaint write must be refused on the row above.
    assignee: { employeeId: 6 },
    canWrite: false, canReview: false, withPartnerName: false
  }),
  // The supervisor portal: the Complaint Form and no lead pipeline at all.
  supervisor: () => ({
    fpIds: [8], writeFpId: 8, zones: ['North Zone'],
    assignee: { employeeId: 4 },
    canWrite: false, canReview: false, canReadTracker: false, withPartnerName: false
  }),
  opsManager: () => ({ fpIds: null, writeFpId: null, zones: null, canWrite: false, withPartnerName: true }),
  noZones: () => ({ fpIds: [8], writeFpId: 8, zones: [], canWrite: true, withPartnerName: false }),
  refused: () => {
    throw Object.assign(new Error('Marketing is available to the franchise partner account only.'), { status: 403 });
  }
};

const validTracker = {
  proposal_given: 'Yes',
  customer_decision: 'Interested',
  // middleware/security.js escapes every request string, so an option carrying a slash arrives
  // like this. It must still be recognised, and stored exactly as it came.
  last_contact_method: 'SMS&#x2F;Text'
};

const validComplaint = {
  property_id: 'PROP-1', zone: 'North Zone', responsible_person: 'Ravi',
  concern_with: 'Service Delay', contact_person_name: 'Asha',
  phone_number: '9876543210', comments: 'The visit was late.'
};

const startServer = async (t) => {
  const app = express();
  app.use(express.json());
  // Stands in for the authenticate middleware each real mount sits behind, so a test can say who
  // is making the request -- the tracker records the caller from req.user, never from the body.
  app.use((req, res, next) => {
    if (req.headers['x-test-user']) req.user = JSON.parse(req.headers['x-test-user']);
    next();
  });
  for (const [name, resolveScope] of Object.entries(scopes)) {
    app.use(`/${name}/marketing`, createMarketingRouter({ resolveScope }));
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return async (path, method = 'GET', body, user) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'x-test-user': JSON.stringify(user) } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, ...(await response.json()) };
  };
};

const lastCall = (fragment) => [...calls].reverse().find((call) => call.sql.includes(fragment));

test('each portal reads only the rows its scope allows', async (t) => {
  const request = await startServer(t);

  // One partner's rows, bound -- never interpolated.
  calls.length = 0;
  assert.equal((await request('/fp/marketing/tracker')).status, 200);
  let call = lastCall('FROM fp_estimates');
  assert.match(call.sql, /franchise_partner_id IN \(\?\)/);
  assert.deepEqual(call.params, [8]);
  assert.doesNotMatch(call.sql, /franchise_partner_name/);

  // Admin sees every partner, so there is no partner condition at all -- and the owning partner's
  // name is joined in, which is what lets one list carry rows from several franchises.
  calls.length = 0;
  assert.equal((await request('/admin/marketing/tracker')).status, 200);
  call = lastCall('FROM fp_estimates');
  assert.doesNotMatch(call.sql, /franchise_partner_id IN/);
  assert.match(call.sql, /franchise_partner_name/);
  assert.match(call.sql, /LEFT JOIN franchise_partners/);
  assert.deepEqual(call.params, []);
  // Only the columns this database has are named. contact_person is absent here, and selecting it
  // anyway is what failed the whole statement.
  assert.match(call.sql, /COALESCE\(fpx\.company_name, fpx\.owner_name\)/);
  assert.doesNotMatch(call.sql, /contact_person/);

  // ?fpId= narrows the admin to one partner.
  calls.length = 0;
  await request('/admin/marketing/tracker?fpId=9');
  assert.deepEqual(lastCall('FROM fp_estimates').params, [9]);

  // A zone manager is held to its assigned zones as well as its partner.
  calls.length = 0;
  await request('/manager/marketing/tracker');
  call = lastCall('FROM fp_estimates');
  assert.match(call.sql, /franchise_partner_id IN \(\?\)/);
  assert.match(call.sql, /zone IN \(\?,\?\)/);
  assert.deepEqual(call.params, [8, 'North Zone', 'South Zone']);

  // A manager with no zone assigned sees nothing. `IN ()` is not SQL, so an empty list has to be
  // spelled as a condition that matches no row -- never as an omitted filter, which would show
  // that manager every lead the partner has.
  calls.length = 0;
  await request('/noZones/marketing/tracker');
  assert.match(lastCall('FROM fp_estimates').sql, /AND 1 = 0/);

  // A scope may refuse the request outright; that is how the FP mount keeps answering 403 to an
  // FP's own staff.
  const refused = await request('/refused/marketing/tracker');
  assert.equal(refused.status, 403);
  assert.equal(refused.message, 'Marketing is available to the franchise partner account only.');
});

test('the dashboard, archived list and complaints carry the same scope', async (t) => {
  const request = await startServer(t);

  for (const path of ['/tracker/archived', '/dashboard']) {
    calls.length = 0;
    assert.equal((await request(`/manager/marketing${path}`)).status, 200, path);
    const call = lastCall('FROM fp_estimates');
    assert.match(call.sql, /franchise_partner_id IN \(\?\)/, path);
    assert.match(call.sql, /zone IN \(\?,\?\)/, path);
  }

  for (const path of ['/complaints', '/complaints/archived']) {
    calls.length = 0;
    assert.equal((await request(`/manager/marketing${path}`)).status, 200, path);
    const call = lastCall(`FROM ${COMPLAINT_TABLE}`);
    assert.match(call.sql, /c\.franchise_partner_id IN \(\?\)/, path);
    assert.match(call.sql, /c\.zone IN \(\?,\?\)/, path);
  }

  // The archived tab is the one place a row is read by its archive stamp rather than its id.
  calls.length = 0;
  await request('/fp/marketing/tracker/archived');
  assert.match(lastCall('FROM fp_estimates').sql, /tracker_archived_at IS NOT NULL/);

  // The Complaints inbox is one list with no Archived tab beside it, so it asks for the archived
  // rows too and shows them last. Filtering them out would simply lose them.
  calls.length = 0;
  await request('/admin/marketing/complaints?includeArchived=true');
  let call = lastCall(`FROM ${COMPLAINT_TABLE}`);
  assert.doesNotMatch(call.sql, /archived_at IS NULL/);
  assert.match(call.sql, /ORDER BY \(c\.archived_at IS NOT NULL\), c\.created_at DESC/);

  // Marketing > Complaint Form pairs with /complaints/archived instead, so it leaves the flag off.
  calls.length = 0;
  await request('/admin/marketing/complaints');
  call = lastCall(`FROM ${COMPLAINT_TABLE}`);
  assert.match(call.sql, /c\.archived_at IS NULL/);
});

test('a write is filtered by scope too -- the id in the URL is never trusted alone', async (t) => {
  const request = await startServer(t);

  // The reply feeds the row straight back into the admin's list, so it has to carry the partner
  // name as well -- without it the Franchise Partner cell blanked on every inline save.
  calls.length = 0;
  assert.equal((await request('/admin/marketing/tracker/31', 'PUT', validTracker)).status, 200);
  assert.match(lastCall('FROM fp_estimates e LEFT JOIN').sql, /franchise_partner_name/);

  calls.length = 0;
  assert.equal((await request('/manager/marketing/tracker/31', 'PUT', validTracker)).status, 200);
  const update = lastCall('UPDATE fp_estimates');
  assert.match(update.sql, /franchise_partner_id IN \(\?\)/);
  assert.match(update.sql, /zone IN \(\?,\?\)/);
  // id first, then the scope's own parameters
  assert.deepEqual(update.params.slice(-3), [8, 'North Zone', 'South Zone']);

  for (const path of ['/tracker/31/archive', '/tracker/31/unarchive']) {
    calls.length = 0;
    assert.equal((await request(`/fp/marketing${path}`, 'PUT')).status, 200, path);
    assert.match(lastCall('UPDATE fp_estimates').sql, /franchise_partner_id IN \(\?\)/, path);
  }

  for (const path of ['/complaints/7', '/complaints/7/archive', '/complaints/7/unarchive']) {
    calls.length = 0;
    const body = path === '/complaints/7' ? validComplaint : undefined;
    assert.equal((await request(`/fp/marketing${path}`, 'PUT', body)).status, 200, path);
    assert.match(lastCall(`UPDATE ${COMPLAINT_TABLE}`).sql, /franchise_partner_id IN \(\?\)/, path);
  }

  // A non-numeric id is refused before it reaches the database.
  assert.equal((await request('/fp/marketing/tracker/abc', 'PUT', validTracker)).status, 400);
  assert.equal((await request('/fp/marketing/complaints/abc', 'PUT', validComplaint)).status, 400);
});

test('the view-only Operations Manager may read but never write', async (t) => {
  const request = await startServer(t);

  assert.equal((await request('/opsManager/marketing/tracker')).status, 200);
  assert.equal((await request('/opsManager/marketing/dashboard')).status, 200);
  assert.equal((await request('/opsManager/marketing/complaints')).status, 200);

  for (const [path, method, body] of [
    ['/tracker/31', 'PUT', validTracker],
    ['/tracker/31/archive', 'PUT'],
    ['/tracker/31/unarchive', 'PUT'],
    ['/complaints', 'POST', validComplaint],
    ['/complaints/7', 'PUT', validComplaint],
    ['/complaints/7/archive', 'PUT'],
    ['/complaints/7/unarchive', 'PUT']
  ]) {
    const response = await request(`/opsManager/marketing${path}`, method, body);
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test('a complaint is created against exactly one partner', async (t) => {
  const request = await startServer(t);

  calls.length = 0;
  assert.equal((await request('/fp/marketing/complaints', 'POST', validComplaint)).status, 200);
  assert.equal(lastCall(`INSERT INTO ${COMPLAINT_TABLE}`).params[0], 8);

  // The column is NOT NULL, so an admin looking at every partner has to say which one owns the
  // complaint. Left to MySQL this was an unexplained 500.
  const missing = await request('/admin/marketing/complaints', 'POST', validComplaint);
  assert.equal(missing.status, 400);
  assert.equal(missing.message, 'Select the franchise partner this complaint belongs to.');

  calls.length = 0;
  assert.equal((await request('/admin/marketing/complaints?fpId=9', 'POST', validComplaint)).status, 200);
  assert.equal(lastCall(`INSERT INTO ${COMPLAINT_TABLE}`).params[0], 9);

  // Every field the form marks required is required here too.
  const incomplete = await request('/fp/marketing/complaints', 'POST', { ...validComplaint, comments: '' });
  assert.equal(incomplete.status, 400);
  assert.match(incomplete.message, /Comments is required/);
});

test('a complaint is filed against the resident it is about, who is told at once', async (t) => {
  const request = await startServer(t);

  calls.length = 0;
  notified.length = 0;
  assert.equal((await request('/fp/marketing/complaints', 'POST', validComplaint)).status, 200);

  // The account is resolved from the property and the contact phone and stamped onto the row, so
  // every later update is addressed without looking it up again -- and a resident who moves house
  // still hears about the complaint already under way.
  const lookup = lastCall('FROM customer_accounts');
  assert.deepEqual(lookup.params, ['PROP-1']);
  const insert = lastCall(`INSERT INTO ${COMPLAINT_TABLE}`);
  assert.match(insert.sql, /customer_account_id, customer_email/);
  assert.deepEqual(insert.params.slice(-2), [55, 'asha@example.com']);

  // Filing it is itself an update: the acknowledgement goes out as Open rather than leaving the
  // resident wondering whether a complaint about their home reached anyone.
  assert.deepEqual(notified, [{ event: 'customer', id: 7, status: 'Open', to: 'asha@example.com' }]);
});

test('tracker validation judges the decoded text, not the escaped request string', async (t) => {
  const request = await startServer(t);

  // 'SMS&#x2F;Text' is how 'SMS/Text' arrives; rejecting it would turn every option carrying a
  // slash, apostrophe or ampersand into a 400 the portal cannot explain.
  calls.length = 0;
  assert.equal((await request('/fp/marketing/tracker/31', 'PUT', validTracker)).status, 200);
  // Stored exactly as it came, so it is escaped once rather than twice.
  assert.ok(lastCall('UPDATE fp_estimates').params.includes('SMS&#x2F;Text'));

  const required = await request('/fp/marketing/tracker/31', 'PUT', {});
  assert.equal(required.status, 400);
  assert.match(required.message, /proposal_given is required/);
  assert.match(required.message, /customer_decision is required/);

  const badOption = await request('/fp/marketing/tracker/31', 'PUT', { ...validTracker, priority: 'Whenever' });
  assert.equal(badOption.status, 400);
  assert.match(badOption.message, /priority must be one of/);

  // 'Other' has to carry its free text, or the option would hold typed input.
  const other = await request('/fp/marketing/tracker/31', 'PUT', { ...validTracker, proposal_given: 'Other' });
  assert.equal(other.status, 400);
  assert.match(other.message, /proposal_given_other is required/);

  // The dates stay editable, so anything that is not a calendar day is refused rather than stored
  // as NULL and read back as "No Date".
  const badDate = await request('/fp/marketing/tracker/31', 'PUT', { ...validTracker, next_follow_up_date: 'soon' });
  assert.equal(badDate.status, 400);
  assert.match(badDate.message, /next_follow_up_date must be a date/);
});

test('an option left blank clears its own free-text column', async (t) => {
  const request = await startServer(t);

  // Only the required pair is answered here, so Current Maintenance System is blank. Its
  // maintenance_system_other used to be left undefined, and mysql2 refuses an undefined bind, so
  // the save came back 500 with nothing in the portal to explain it.
  calls.length = 0;
  const saved = await request('/fp/marketing/tracker/31', 'PUT', validTracker);
  assert.equal(saved.status, 200);
  const update = lastCall('UPDATE fp_estimates');
  for (const [index, value] of update.params.entries()) {
    assert.notEqual(value, undefined, `bind parameter ${index} is undefined`);
  }
  // Blank parent, blank free text -- not a stale value left behind either.
  assert.equal(update.params[2], null, 'maintenance_system');
  assert.equal(update.params[3], null, 'maintenance_system_other');
});

test('no marketing query binds LIMIT', async (t) => {
  const request = await startServer(t);

  calls.length = 0;
  for (const path of ['/tracker', '/tracker/archived', '/dashboard', '/complaints', '/complaints/archived']) {
    await request(`/admin/marketing${path}`);
  }
  // pool.execute prepares its statement, and a prepared LIMIT ? fails with "Incorrect arguments
  // to mysqld_stmt_execute" -- which surfaces as a 500 or, where the error is swallowed, as a
  // permanently empty list.
  for (const call of calls) assert.doesNotMatch(call.sql, /LIMIT \?/);
});

test('every tracker write records who made it, from the token and not the body', async (t) => {
  const request = await startServer(t);
  const admin = { id: 3, role: 'admin', firstName: 'Bhavani', lastName: 'Rao', username: 'bhavani' };

  calls.length = 0;
  await request('/admin/marketing/tracker/31', 'PUT', {
    ...validTracker,
    // A caller naming somebody else must be ignored: a field the client can set is worth nothing
    // as a record of who changed the row.
    tracker_updated_by: 'Somebody Else',
    tracker_updated_by_role: 'super_admin',
    tracker_updated_at: '2020-01-01'
  }, admin);

  const update = lastCall('UPDATE fp_estimates SET');
  assert.match(update.sql, /tracker_updated_by = \?, tracker_updated_by_role = \?, tracker_updated_at = NOW\(\)/);
  assert.ok(update.params.includes('Bhavani Rao'), 'the name comes from the token');
  assert.ok(update.params.includes('admin'), 'and so does the role');
  assert.ok(!update.params.includes('Somebody Else'), 'the body cannot name the editor');
  assert.ok(!update.params.includes('super_admin'), 'nor their role');
  // The timestamp is the server's NOW(), so it is never a bound parameter.
  assert.ok(!update.params.includes('2020-01-01'));
});

test('a caller with no name is still identified', async (t) => {
  const request = await startServer(t);

  // The manager login signs { id, username, email, role, managerId } -- no first or last name --
  // so the username is the identity, and a row must never be left claiming nobody edited it.
  calls.length = 0;
  await request('/manager/marketing/tracker/31', 'PUT', validTracker,
    { id: 5, role: 'manager', username: 'north.manager', email: 'north@example.com' });
  assert.ok(lastCall('UPDATE fp_estimates SET').params.includes('north.manager'));

  calls.length = 0;
  await request('/fp/marketing/tracker/31', 'PUT', validTracker, { id: 8, role: 'franchise_partner' });
  assert.ok(lastCall('UPDATE fp_estimates SET').params.includes('Unknown user'));
});

test('archiving and restoring a row are changes too, and name their editor', async (t) => {
  const request = await startServer(t);
  const user = { id: 3, role: 'operations_manager', firstName: 'Asha', lastName: 'K' };

  for (const action of ['archive', 'unarchive']) {
    calls.length = 0;
    await request(`/admin/marketing/tracker/31/${action}`, 'PUT', undefined, user);
    const update = lastCall('UPDATE fp_estimates SET tracker_archived_at');
    assert.match(update.sql, /tracker_updated_by = \?/, action);
    assert.deepEqual(update.params.slice(0, 2), ['Asha K', 'operations_manager'], action);
  }
});

test('the row carries a readable role label, so the portal needs no copy of the role names', async (t) => {
  const { presentTrackerRow } = require('./marketing');
  assert.equal(
    presentTrackerRow({ ...trackerRow, tracker_updated_by: 'Asha K', tracker_updated_by_role: 'operations_manager' })
      .tracker_updated_by_role_label,
    'Operations Manager'
  );
  // An unknown code is shown as it is rather than hidden, and no role at all reads as nothing.
  assert.equal(presentTrackerRow({ ...trackerRow, tracker_updated_by_role: 'new_role' }).tracker_updated_by_role_label, 'new_role');
  assert.equal(presentTrackerRow(trackerRow).tracker_updated_by_role_label, '');
});

test('the coordinator name is whoever marked the review, not whatever was typed', async (t) => {
  const request = await startServer(t);
  const coordinator = { id: 9, role: 'coordinator', firstName: 'Priya', lastName: 'N' };

  calls.length = 0;
  await request('/admin/marketing/tracker/31', 'PUT', {
    ...validTracker,
    coordinator_reviewed: 'Yes',
    coordinator_name: 'Someone Made Up'
  }, coordinator);

  const update = lastCall('UPDATE fp_estimates SET');
  // Resolved in SQL against the stored row, so the first reviewer keeps the credit: the table
  // re-sends the whole payload on every inline edit, and recomputing it from the caller would
  // hand the review to the next person who touched an unrelated cell.
  assert.match(update.sql, /coordinator_name = CASE WHEN \? = 'Yes'\s*THEN COALESCE\(NULLIF\(coordinator_name, ''\), \?\) ELSE NULL END/);
  assert.ok(update.params.includes('Priya N'), 'the reviewer comes from the token');
  assert.ok(!update.params.includes('Someone Made Up'), 'a typed name is ignored');
});

test('clearing the review clears the name with it', async (t) => {
  const request = await startServer(t);

  calls.length = 0;
  await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, coordinator_reviewed: 'No' },
    { id: 9, role: 'coordinator', firstName: 'Priya', lastName: 'N' });
  const update = lastCall('UPDATE fp_estimates SET');
  // The CASE answers NULL for anything that is not Yes, so a review nobody stands behind cannot
  // be left with a name against it.
  const caseArg = update.params[update.params.indexOf('Priya N') - 1];
  assert.equal(caseArg, 'No', 'the flag drives the CASE');
});

test('a reviewer-only portal sees its zones and its own leads, and writes one column', async (t) => {
  const request = await startServer(t);
  const priya = { id: 42, role: 'coordinator', firstName: 'Priya', lastName: 'N', username: 'priya' };

  calls.length = 0;
  await request('/coordinator/marketing/tracker');
  const list = lastCall('FROM fp_estimates');
  // An estimate's zone is the property's, not the author's, so zone-only would hide an
  // executive's own visits from them.
  assert.match(list.sql, /AND \(e\.zone IN \(\?\) OR e\.created_by_id = \? OR e\.created_by_name = \? OR e\.created_by_name = \?\)/);
  assert.deepEqual(list.params.slice(-4), ['North Zone', 42, 'priya@example.com', 'priya']);

  calls.length = 0;
  const saved = await request('/coordinator/marketing/tracker/31', 'PUT', {
    ...validTracker,
    coordinator_reviewed: 'Yes',
    // Everything below must be ignored: the table re-sends the whole payload on every edit, so a
    // reviewer-only caller must not be able to ride one in.
    lead_status: 'Closed', next_action: 'Close Lead', tracker_status: 'Rejected'
  }, priya);
  assert.equal(saved.status, 200);
  const update = lastCall('UPDATE fp_estimates SET');
  assert.doesNotMatch(update.sql, /lead_status|next_action|tracker_status|proposal_given/);
  assert.match(update.sql, /coordinator_reviewed = \?/);
  assert.ok(update.params.includes('Priya N'));
});

test('a read-only portal is refused every write, including the review', async (t) => {
  const request = await startServer(t);
  const user = { id: 42, role: 'executive', firstName: 'Bhavani', lastName: 'K' };

  for (const [path, method, body] of [
    ['/executive/marketing/tracker/31', 'PUT', { ...validTracker, coordinator_reviewed: 'Yes' }],
    ['/executive/marketing/tracker/31/archive', 'PUT', undefined],
    ['/executive/marketing/complaints', 'POST', validComplaint]
  ]) {
    const response = await request(path, method, body, user);
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test('the creator clause is for fp_estimates only -- complaints have no created_by_id', async (t) => {
  const request = await startServer(t);

  // Asking for it against fp_marketing_complaints fails the whole statement with "Unknown column
  // 'c.created_by_id'", which answered 500 where the list should have been.
  for (const path of ['/complaints', '/complaints/archived']) {
    calls.length = 0;
    await request(`/coordinator/marketing${path}`);
    const query = lastCall(COMPLAINT_TABLE);
    assert.doesNotMatch(query.sql, /created_by_id/, path);
    assert.match(query.sql, /c\.zone IN/, path);
  }
});

test('a tracked lead moves itself along until the coordinator reviews it', async () => {
  const { autoTrackerStatus, effectiveTrackerStatus, COORDINATOR_REVIEW_AFTER_MS } = require('./marketing');
  const now = Date.UTC(2026, 9, 14, 12, 0, 0);
  const tracked = { tracked_at: '2026-10-13 12:00:00' };
  const at = (msAgo, rest = {}) => ({ ...tracked, created_at: new Date(now - msAgo), ...rest });

  // The first day belongs to the executive who entered it.
  assert.equal(autoTrackerStatus(at(0), now), 'Created by Executive');
  assert.equal(autoTrackerStatus(at(COORDINATOR_REVIEW_AFTER_MS - 1000), now), 'Created by Executive');
  // A day old, and it is the coordinator's to look at.
  assert.equal(autoTrackerStatus(at(COORDINATOR_REVIEW_AFTER_MS), now), 'Pending Employee Review');
  assert.equal(autoTrackerStatus(at(10 * COORDINATOR_REVIEW_AFTER_MS), now), 'Pending Employee Review',
    'it waits there however long it takes');
  // Until somebody reviews it -- which is the one thing a coordinator may record.
  assert.equal(autoTrackerStatus(at(10 * COORDINATOR_REVIEW_AFTER_MS, { coordinator_reviewed: 'Yes' }), now),
    'Reviewed by Employee');
  assert.equal(autoTrackerStatus(at(0, { coordinator_reviewed: 'No' }), now), 'Created by Executive');

  // "after 1 day" is 24 hours, not the next calendar date: a lead entered at 11pm must not be
  // the coordinator's an hour later.
  const lateEvening = { ...tracked, created_at: new Date(Date.UTC(2026, 9, 13, 23, 0, 0)) };
  assert.equal(autoTrackerStatus(lateEvening, Date.UTC(2026, 9, 14, 0, 30, 0)), 'Created by Executive');

  // An estimate that has not been tracked yet has not started, and a hand-picked status outranks
  // the automatic one so the progression never drags a lead back.
  assert.equal(autoTrackerStatus({ created_at: new Date(now) }, now), 'Not Started');
  assert.equal(effectiveTrackerStatus({ ...at(0), tracker_status: 'Estimate Sent' }), 'Estimate Sent');
  assert.equal(effectiveTrackerStatus({ ...at(0), status: 'approved' }), 'Approved');
});

test('saving a row does not freeze its automatic status', async (t) => {
  const request = await startServer(t);

  // The table re-sends the resolved status with every inline edit. The mocked lead's automatic
  // status is Pending Employee Review, so re-submitting exactly that stores NULL and the
  // derivation keeps driving the row.
  calls.length = 0;
  await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, tracker_status: 'Pending Employee Review' });
  assert.equal(lastCall('UPDATE fp_estimates SET').params[8], null, 'the automatic status is never stored');

  // Every other pickable status is a deliberate pin and is stored literally.
  for (const pinned of ['Not Started', 'Created by Executive', 'Reviewed by Employee', 'Estimate Sent']) {
    calls.length = 0;
    await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, tracker_status: pinned });
    assert.equal(lastCall('UPDATE fp_estimates SET').params[8], pinned, `${pinned} is a manual pick and is kept`);
  }

  // Approved/Rejected are never stored by hand -- the estimate's own status decides them.
  for (const terminal of ['Approved', 'Rejected']) {
    calls.length = 0;
    await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, tracker_status: terminal });
    assert.equal(lastCall('UPDATE fp_estimates SET').params[8], null, `${terminal} comes from the estimate, not the tracker`);
  }

  // A revision status is a real choice and is kept.
  for (const manual of ['Revision Required', 'Revised Estimate Sent']) {
    calls.length = 0;
    await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, tracker_status: manual });
    const update = lastCall('UPDATE fp_estimates SET');
    assert.equal(update.params[8], manual);
  }
});

test('a follow-up stage only moves forward', async (t) => {
  const request = await startServer(t);

  // The mocked row sits at Step 3, so an earlier step -- or a blank one, which a stale tab
  // re-sending the payload it loaded can produce on any unrelated edit -- keeps the stored
  // stage rather than walking the pipeline back.
  for (const backward of ['Step 1 - Thank You', undefined]) {
    calls.length = 0;
    const response = await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, follow_up_stage: backward });
    assert.equal(response.status, 200);
    assert.equal(lastCall('UPDATE fp_estimates SET').params[10], 'Step 3 - Follow-Up 1');
  }

  // The step it is already on, and every step ahead of it, are still real choices.
  for (const onward of ['Step 3 - Follow-Up 1', 'Step 5A - Executive Call', 'Closed']) {
    calls.length = 0;
    const response = await request('/admin/marketing/tracker/31', 'PUT', { ...validTracker, follow_up_stage: onward });
    assert.equal(response.status, 200);
    assert.equal(lastCall('UPDATE fp_estimates SET').params[10], onward);
  }
});

test('the note bubble writes one capped field, scoped and credited like every write', async (t) => {
  const request = await startServer(t);
  const admin = { id: 3, role: 'admin', firstName: 'Bhavani', lastName: 'Rao', username: 'bhavani' };

  calls.length = 0;
  const saved = await request('/admin/marketing/tracker/31/note', 'PUT',
    { note: 'Customer asked to call back after Diwali' }, admin);
  assert.equal(saved.status, 200);
  const update = lastCall('UPDATE fp_estimates SET tracker_note');
  assert.match(update.sql, /tracker_note = \?/);
  assert.match(update.sql, /tracked_at IS NOT NULL/);
  // The text is bound, never interpolated, and the write names its editor like any other.
  assert.ok(update.params.includes('Customer asked to call back after Diwali'));
  assert.ok(update.params.includes('Bhavani Rao'));
  // The reply feeds the row straight back into the list, so the partner name rides along on the
  // admin mount exactly as it does on the tracker PUT.
  assert.match(lastCall('FROM fp_estimates e LEFT JOIN').sql, /franchise_partner_name/);

  // The id in the URL is never trusted alone: a zone manager's write is held to its zones.
  calls.length = 0;
  await request('/manager/marketing/tracker/31/note', 'PUT', { note: 'x' });
  assert.match(lastCall('UPDATE fp_estimates').sql, /zone IN \(\?,\?\)/);

  // The cap is 500 typed characters judged on the decoded text -- 'A &amp; B' arrives escaped,
  // and its escaped length must not count against the caller.
  const long = await request('/fp/marketing/tracker/31/note', 'PUT', { note: 'x'.repeat(501) });
  assert.equal(long.status, 400);
  assert.match(long.message, /500/);
  const escaped = await request('/fp/marketing/tracker/31/note', 'PUT', { note: '&amp;'.repeat(150) });
  assert.equal(escaped.status, 200, '750 escaped characters are 150 typed ones');

  // Clearing the box stores NULL rather than an empty string the read views would show as blank.
  calls.length = 0;
  await request('/fp/marketing/tracker/31/note', 'PUT', { note: '   ' });
  assert.equal(lastCall('UPDATE fp_estimates SET tracker_note').params[0], null);

  // The note is an edit, not a review: the view-only portals are refused on the server.
  assert.equal((await request('/opsManager/marketing/tracker/31/note', 'PUT', { note: 'x' })).status, 403);
  assert.equal((await request('/executive/marketing/tracker/31/note', 'PUT', { note: 'x' })).status, 403);
});

// ============================================
// COMPLAINT WORKFLOW
// ============================================
//
// Open -> Assigned -> In Progress -> Reviewed -> Closed. The FP hands a complaint to one
// zone-centric employee, that employee reports progress and saves a note, and the FP or its
// manager verifies it and closes it -- which archives the row.

test('only the franchise partner hands a complaint to an employee', async (t) => {
  const request = await startServer(t);
  const fp = { id: 8, role: 'franchise_partner', companyName: 'Hyderabad Partner' };

  calls.length = 0;
  notified.length = 0;
  const assigned = await request('/fp/marketing/complaints/7/assign', 'PUT', { employeeId: 4 }, fp);
  assert.equal(assigned.status, 200);

  const update = lastCall(`UPDATE ${COMPLAINT_TABLE} SET assigned_employee_id`);
  // Assigning is what produces the Assigned status -- it is never set from a dropdown.
  assert.match(update.sql, /status = 'Assigned'/);
  assert.match(update.sql, /archived_at IS NULL/);
  assert.match(update.sql, /franchise_partner_id IN \(\?\)/);
  // The name and role are stamped onto the row, so a renamed or removed employee still reads, and
  // the role is stored in the one spelling the rest of the code compares against.
  assert.deepEqual(update.params.slice(0, 3), [4, 'Priya N', 'coordinator']);
  // Who assigned it comes from the token, never from the body.
  assert.ok(update.params.includes('Hyderabad Partner'));
  // And the assignee is told, after the write and never inside it -- as is the resident, who hears
  // that their complaint has reached somebody (but never who: the name is for the staff portals).
  assert.deepEqual(notified, [
    { event: 'assigned', id: 7 },
    { event: 'customer', id: 7, status: 'Assigned', to: 'asha@example.com' }
  ]);

  // Everyone else is refused -- including the manager, which may close but never assign, and the
  // admin portal, which may otherwise edit complaints freely.
  for (const portal of ['manager', 'admin', 'coordinator', 'executive', 'opsManager']) {
    const response = await request(`/${portal}/marketing/complaints/7/assign`, 'PUT', { employeeId: 4 });
    assert.equal(response.status, 403, portal);
  }
});

test('a complaint is assigned inside its own partner, and only to a role with the screen', async (t) => {
  const request = await startServer(t);

  // A supervisor is assignable: that portal has the Complaint Form, which is the whole point of
  // mounting Marketing for it.
  calls.length = 0;
  const supervisor = await request('/fp/marketing/complaints/7/assign', 'PUT', { employeeId: 10 });
  assert.equal(supervisor.status, 200);
  assert.deepEqual(lastCall(`UPDATE ${COMPLAINT_TABLE} SET assigned_employee_id`).params.slice(0, 3),
    [10, 'Vikram S', 'supervisor']);

  // Field staff are not: there is no portal for them to read the assignment in.
  calls.length = 0;
  const fieldStaff = await request('/fp/marketing/complaints/7/assign', 'PUT', { employeeId: 9 });
  assert.equal(fieldStaff.status, 400);
  assert.match(fieldStaff.message, /manager, coordinator, supervisor or executive/);

  // The lookup is scoped to the partner, so the id in the body is never trusted on its own.
  assert.deepEqual(lastCall('FROM fp_employees').params, [9, 8]);

  const missing = await request('/fp/marketing/complaints/7/assign', 'PUT', { employeeId: 404 });
  assert.equal(missing.status, 404);
});

test('the assignable list recommends the employees holding the zone', async (t) => {
  const request = await startServer(t);

  const listed = await request('/fp/marketing/complaints/employees?zone=North%20Zone');
  assert.equal(listed.status, 200);
  // The field staff member is left out; the three with the Complaint Form are offered, the
  // recommended ones first.
  assert.deepEqual(listed.data.map((e) => e.id), [4, 5, 10]);
  assert.deepEqual(listed.data.map((e) => e.recommended), [true, true, false]);
  // 'all' is the every-zone assignment, so that manager covers North Zone too -- and the role is
  // normalised, since schema_v8 spelled it fp_manager.
  assert.deepEqual(listed.data.map((e) => e.role), ['coordinator', 'manager', 'supervisor']);
  // Never the password hash or the rest of the employment record.
  assert.deepEqual(Object.keys(listed.data[0]).sort(),
    ['email', 'employee_code', 'id', 'name', 'phone', 'recommended', 'role', 'user_id', 'zones']);

  // A zone this coordinator does not hold still lists everybody -- an empty picker would leave the
  // FP unable to act on the complaint at all -- but recommends only who covers it.
  const other = await request('/fp/marketing/complaints/employees?zone=East%20Zone');
  assert.deepEqual(other.data.map((e) => [e.id, e.recommended]), [[5, true], [4, false], [10, false]]);

  // It is the assignment's own picker, so the portals that cannot assign cannot read it either.
  assert.equal((await request('/manager/marketing/complaints/employees')).status, 403);
});

test('the assignee reports progress on their own complaint, and cannot close it', async (t) => {
  const request = await startServer(t);
  const priya = { id: 42, role: 'coordinator', firstName: 'Priya', lastName: 'N', username: 'priya' };

  calls.length = 0;
  notified.length = 0;
  const progress = await request('/coordinator/marketing/complaints/7/status', 'PUT', { status: 'In Progress' }, priya);
  assert.equal(progress.status, 200);

  const update = lastCall(`UPDATE ${COMPLAINT_TABLE} SET status`);
  // A caller who may not edit marketing records reaches exactly one complaint: their own. Without
  // this clause an assignee could report on every complaint their zones cover.
  assert.match(update.sql, /assigned_employee_id = \?/);
  assert.ok(update.params.includes(4));
  // Closing is the review step and archives the row, so neither is written here.
  assert.doesNotMatch(update.sql, /closed_at = NOW\(\)/);
  assert.match(update.sql, /archived_at = archived_at/);
  // Who reported it comes from the token.
  assert.ok(update.params.includes('Priya N'));
  // The FP and its manager are asked to review it, and the customer is told it is being worked on.
  assert.deepEqual(notified, [
    { event: 'progress', id: 7, statusChanged: true },
    { event: 'customer', id: 7, status: 'In Progress', to: 'asha@example.com' }
  ]);

  // In Progress is the one status they may set; Reviewed and Closed belong to the review.
  for (const status of ['Reviewed', 'Closed', 'Open']) {
    const refused = await request('/coordinator/marketing/complaints/7/status', 'PUT', { status }, priya);
    assert.equal(refused.status, 403, status);
    assert.match(refused.message, /only set: In Progress/, status);
  }

  // Somebody else's complaint is refused even where the zone would have shown it to them: the
  // status route is held to the row, not merely to the zone.
  calls.length = 0;
  const notMine = await request('/executive/marketing/complaints/7/status', 'PUT', { status: 'In Progress' });
  assert.equal(notMine.status, 403);
  assert.match(lastCall(`FROM ${COMPLAINT_TABLE}`).sql, /assigned_employee_id = \?/);
});

test('closing a complaint is also what archives it', async (t) => {
  const request = await startServer(t);
  const manager = { id: 5, role: 'manager', username: 'north.manager' };

  for (const portal of ['fp', 'manager']) {
    calls.length = 0;
    notified.length = 0;
    const closed = await request(`/${portal}/marketing/complaints/7/status`, 'PUT', { status: 'Closed' }, manager);
    assert.equal(closed.status, 200, portal);
    assert.match(closed.message, /Archived/, portal);

    const update = lastCall(`UPDATE ${COMPLAINT_TABLE} SET status`);
    // Closed and archived are one event: left apart, a closed complaint would sit in the live list
    // for ever.
    assert.match(update.sql, /closed_at = NOW\(\)/, portal);
    assert.match(update.sql, /archived_at = NOW\(\)/, portal);
    assert.match(update.sql, /closed_by = \?/, portal);
    // The employee who did the work is told it is finished, and so is the customer -- the close is
    // the update they have been waiting for. Nobody is told about their own act.
    assert.deepEqual(notified, [
      { event: 'closed', id: 7 },
      { event: 'customer', id: 7, status: 'Closed', to: 'asha@example.com' }
    ], portal);
  }

  // The admin portal may edit complaints but not close them: the review is the FP's and its
  // manager's.
  assert.equal((await request('/admin/marketing/complaints/7/status', 'PUT', { status: 'Closed' })).status, 403);
});

test('an archived complaint is read-only until it is restored, and comes back reopened', async (t) => {
  const request = await startServer(t);

  // The stored row is archived for this one assertion.
  complaintRow.archived_at = '2026-02-01 10:00:00';
  const refused = await request('/fp/marketing/complaints/7/status', 'PUT', { status: 'Reviewed' });
  complaintRow.archived_at = null;
  assert.equal(refused.status, 400);
  assert.match(refused.message, /Restore it/);

  // Restoring a complaint that was archived by being closed brings it back as Reviewed: closing is
  // what archives one, so a Closed row in the live list would contradict the rule the whole
  // workflow rests on -- and reopening it is the only reason to restore it.
  calls.length = 0;
  await request('/fp/marketing/complaints/7/unarchive', 'PUT', undefined,
    { id: 8, role: 'franchise_partner', companyName: 'Hyderabad Partner' });
  const update = lastCall(`UPDATE ${COMPLAINT_TABLE} SET archived_at = NULL`);
  assert.match(update.sql, /status = CASE WHEN status = 'Closed' THEN 'Reviewed' ELSE status END/);
  assert.match(update.sql, /closed_at = NULL, closed_by = NULL/);
  // MySQL evaluates a single-table UPDATE's assignments left to right, so the stamps are written
  // before `status`: after it they would be testing the value this statement had just changed, and
  // a reopened complaint would record nobody as having reopened it.
  assert.ok(
    update.sql.indexOf('status_updated_by = CASE') < update.sql.indexOf("status = CASE WHEN status = 'Closed'"),
    'the status assignment comes last'
  );
});

test('a complaint assigned to an employee is theirs to see, wherever the property sits', async (t) => {
  const request = await startServer(t);

  for (const path of ['/complaints', '/complaints/archived']) {
    calls.length = 0;
    assert.equal((await request(`/coordinator/marketing${path}`)).status, 200, path);
    const list = lastCall(COMPLAINT_TABLE);
    // Zone alone would hide an assignment from the person who has to act on it -- and it is the FP
    // who picks the assignee, so it can legitimately be someone outside their zones.
    assert.match(list.sql, /AND \(c\.zone IN \(\?\) OR c\.assigned_employee_id = \?\)/, path);
    assert.deepEqual(list.params.slice(-2), ['North Zone', 4], path);
    // The complaints table still has no created_by_id, and asking for one failed the statement.
    assert.doesNotMatch(list.sql, /created_by_id/, path);
  }

  // The shared screen cannot work out whose row it is looking at -- it does not know which
  // fp_employees row the caller is -- so the server says so.
  const { presentComplaintRow } = require('./marketing');
  assert.equal(presentComplaintRow(complaintRow, scopes.coordinator()).assigned_to_me, true);
  assert.equal(presentComplaintRow(complaintRow, scopes.executive()).assigned_to_me, false);
  assert.equal(presentComplaintRow(complaintRow, {}).assigned_to_me, false);
  // Rows written before schema_v51 have no status at all; a list of them would show nothing where
  // the workflow is.
  assert.equal(presentComplaintRow({ ...complaintRow, status: null }, {}).status, 'Open');
  assert.equal(presentComplaintRow(complaintRow, {}).assigned_employee_role_label, 'Coordinator');
});

test('a portal can have the complaints without the lead pipeline', async (t) => {
  const request = await startServer(t);
  const vikram = { id: 45, role: 'supervisor', firstName: 'Vikram', lastName: 'S', username: 'vikram' };

  // The supervisor portal is mounted for the complaints -- they are assigned to supervisors like
  // they are to coordinators -- and for nothing else of Marketing. Leaving the router unmounted was
  // the old answer; now the scope says so, because the sidebar is not a permission.
  for (const path of ['/tracker', '/tracker/archived', '/dashboard']) {
    const refused = await request(`/supervisor/marketing${path}`);
    assert.equal(refused.status, 403, path);
    assert.match(refused.message, /tracker is not available/, path);
  }

  // The complaints themselves read normally, held to the zones and to their own assignments.
  calls.length = 0;
  assert.equal((await request('/supervisor/marketing/complaints')).status, 200);
  const list = lastCall(COMPLAINT_TABLE);
  assert.match(list.sql, /AND \(c\.zone IN \(\?\) OR c\.assigned_employee_id = \?\)/);
  assert.deepEqual(list.params.slice(-2), ['North Zone', 4]);

  // And the assignee reports on their own row exactly as a coordinator does.
  calls.length = 0;
  notified.length = 0;
  const progress = await request('/supervisor/marketing/complaints/7/status', 'PUT', { status: 'In Progress' }, vikram);
  assert.equal(progress.status, 200);
  assert.match(lastCall(`UPDATE ${COMPLAINT_TABLE} SET status`).sql, /assigned_employee_id = \?/);
  assert.ok(notified.some((n) => n.event === 'progress'), 'the FP and its manager are asked to review');
  assert.equal((await request('/supervisor/marketing/complaints/7/note', 'PUT', { note: 'Cleared the blockage.' }, vikram)).status, 200);

  // It writes nothing else: no new complaints, no edits, no assigning, no closing.
  for (const [path, method, body] of [
    ['/complaints', 'POST', validComplaint],
    ['/complaints/7', 'PUT', validComplaint],
    ['/complaints/7/assign', 'PUT', { employeeId: 4 }],
    ['/complaints/7/archive', 'PUT'],
    ['/tracker/31', 'PUT', validTracker]
  ]) {
    assert.equal((await request(`/supervisor/marketing${path}`, method, body, vikram)).status, 403, `${method} ${path}`);
  }
  assert.equal((await request('/supervisor/marketing/complaints/7/status', 'PUT', { status: 'Closed' }, vikram)).status, 403);
});

test('the complaint note is the assignee\'s report, capped like the tracker\'s', async (t) => {
  const request = await startServer(t);
  const priya = { id: 42, role: 'coordinator', firstName: 'Priya', lastName: 'N', username: 'priya' };

  calls.length = 0;
  notified.length = 0;
  const saved = await request('/coordinator/marketing/complaints/7/note', 'PUT',
    { note: 'Replaced the pump and tested it with the association secretary.' }, priya);
  assert.equal(saved.status, 200);

  const update = lastCall(`UPDATE ${COMPLAINT_TABLE} SET complaint_note`);
  assert.match(update.sql, /complaint_note = \?/);
  assert.match(update.sql, /archived_at IS NULL/);
  // Their own row only, and credited from the token.
  assert.match(update.sql, /assigned_employee_id = \?/);
  assert.ok(update.params.includes('Priya N'));
  assert.ok(update.params.includes('Replaced the pump and tested it with the association secretary.'));
  // The FP and its manager are told there is something to read -- and the customer is not: the
  // field notes are the assignee's report for the staff to verify, not a message to the resident.
  assert.deepEqual(notified, [{ event: 'progress', id: 7, noteChanged: true }]);
  assert.ok(!notified.some((n) => n.event === 'customer'), 'a note is not a customer update');

  // 500 typed characters, judged on the decoded text: '&amp;' is one character to whoever typed it.
  const long = await request('/fp/marketing/complaints/7/note', 'PUT', { note: 'x'.repeat(501) });
  assert.equal(long.status, 400);
  assert.match(long.message, /500/);
  assert.equal((await request('/fp/marketing/complaints/7/note', 'PUT', { note: '&amp;'.repeat(150) })).status, 200);

  // Clearing the box stores NULL rather than an empty string the read views would show as blank.
  calls.length = 0;
  await request('/fp/marketing/complaints/7/note', 'PUT', { note: '   ' });
  assert.equal(lastCall(`UPDATE ${COMPLAINT_TABLE} SET complaint_note`).params[0], null);

  // A portal with neither an assignment nor write permission is refused outright.
  assert.equal((await request('/opsManager/marketing/complaints/7/note', 'PUT', { note: 'x' })).status, 403);
  assert.equal((await request('/opsManager/marketing/complaints/7/status', 'PUT', { status: 'Reviewed' })).status, 403);
});
