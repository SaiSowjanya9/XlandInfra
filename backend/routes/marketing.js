/**
 * Marketing routes -- Dashboard, Tracker, Complaint Form and Archived.
 *
 * One router, mounted three times: the FP portal sees its own partner's rows, the Manager portal
 * sees its partner's rows within its assigned zones, and the Admin portal sees every partner's
 * (optionally narrowed with ?fpId=). The mount supplies a `resolveScope` function; everything
 * below is identical for all three, so a change to a tracker field or a complaint rule can never
 * apply to one portal and not another -- which is what six divergent copies of a screen cost us
 * elsewhere in this repo.
 *
 * The tracker is not a table: it is columns on fp_estimates, attached to a direct estimate
 * (schema_v42/43/44/48). A row therefore always belongs to exactly one franchise partner, and
 * every statement below is filtered by that, including the writes -- the id in the URL is never
 * trusted on its own.
 */

const express = require('express');
const { pool } = require('../config/database');
const { decodeEntities } = require('../utils/htmlEntities');
const {
  LEAD_SOURCES, PRIORITIES, CUSTOMER_DECISIONS, TRACKER_STATUSES, MANUAL_TRACKER_STATUSES,
  FOLLOW_UP_STAGES, buildMarketingDashboard
} = require('../utils/marketingDashboard');
const {
  LEAD_STATUSES, CONTACT_METHODS, CUSTOMER_RESPONSES, NEXT_ACTIONS,
  toDateOnly, dueStatus, effectiveCustomerResponse
} = require('../utils/marketingFollowUp');
const {
  COMPLAINT_TABLE, complaintSelect, ensureMarketingComplaintsTable, parseComplaintBody
} = require('../utils/marketingComplaints');
const { partnerNameExpression } = require('../utils/franchisePartnerName');
const { ROLE_NAMES } = require('../config/roles');

// ============================================
// TRACKER COLUMNS
// ============================================
//
// The lead-tracking answers live on fp_estimates itself (schema_v42_marketing_tracker.sql); this
// backfill keeps a deployment that has not applied the file working, the same tolerance the
// estimates list gives its own late columns.
const MARKETING_TRACKER_COLUMNS = [
  { name: 'lead_source', def: 'VARCHAR(100) NULL' },
  { name: 'priority', def: 'VARCHAR(50) NULL' },
  { name: 'maintenance_system', def: 'VARCHAR(100) NULL' },
  { name: 'maintenance_system_other', def: 'VARCHAR(255) NULL' },
  { name: 'proposal_given', def: 'VARCHAR(100) NULL' },
  { name: 'proposal_given_other', def: 'VARCHAR(255) NULL' },
  { name: 'customer_decision', def: 'VARCHAR(100) NULL' },
  { name: 'customer_decision_other', def: 'VARCHAR(255) NULL' },
  { name: 'tracked_at', def: 'TIMESTAMP NULL' },
  // Follow-up workflow fields (schema_v43_marketing_tracker_stages.sql)
  { name: 'tracker_status', def: 'VARCHAR(60) NULL' },
  { name: 'coordinator_reviewed', def: 'VARCHAR(10) NULL' },
  { name: 'follow_up_stage', def: 'VARCHAR(60) NULL' },
  { name: 'coordinator_name', def: 'VARCHAR(255) NULL' },
  // Soft delete from the tracker only (schema_v44_marketing_tracker_archive.sql); the estimate
  // itself stays live in All Estimates -- is_archived is the estimate's own flag.
  { name: 'tracker_archived_at', def: 'TIMESTAMP NULL' },
  // Follow-up columns from the workbook (schema_v48_marketing_followup_fields.sql). The dates are
  // DATE, not DATETIME: they are calendar days in IST. Due Status is derived, never stored.
  { name: 'lead_status', def: 'VARCHAR(60) NULL' },
  { name: 'last_contact_date', def: 'DATE NULL' },
  { name: 'last_contact_method', def: 'VARCHAR(60) NULL' },
  { name: 'customer_response', def: 'VARCHAR(60) NULL' },
  { name: 'next_follow_up_date', def: 'DATE NULL' },
  { name: 'next_action', def: 'VARCHAR(60) NULL' },
  // Who last touched this row, and when (schema_v49_marketing_tracker_actor.sql). The tracker is
  // edited inline by several people across three portals, so a row that changed under somebody
  // could not be traced to anyone. `updated_at` is the estimate's own column and moves for reasons
  // that have nothing to do with the tracker, which is why this keeps its own timestamp.
  { name: 'tracker_updated_by', def: 'VARCHAR(150) NULL' },
  { name: 'tracker_updated_by_role', def: 'VARCHAR(60) NULL' },
  { name: 'tracker_updated_at', def: 'TIMESTAMP NULL' }
];

const ensureMarketingTrackerColumns = async (table = 'fp_estimates') => {
  for (const col of MARKETING_TRACKER_COLUMNS) {
    try {
      // SHOW ... LIKE ? cannot bind its pattern in a prepared statement, so the existence
      // check goes through information_schema instead
      const [cols] = await pool.execute(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, col.name]
      );
      if (cols[0].n === 0) {
        await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.def}`);
      }
    } catch (e) { /* column exists or cannot be added; the query below will say which */ }
  }
};

// The fixed option sets the tracker modal offers. 'Other' carries its free text in the matching
// *_other column, so the option itself never holds typed input.
//
// The five lists the dashboard also charts live in utils/marketingDashboard.js and are imported
// here, so adding a stage makes the PUT accept it and the dashboard draw it in one change --
// they used to be declared in both places. Regression test:
// `node --test backend/utils/marketingDashboard.test.js`.
const TRACKER_OPTIONS = {
  lead_source: LEAD_SOURCES,
  priority: PRIORITIES,
  maintenance_system: ['Self-managed', 'Existing Vendor', 'Association Managed', 'No System', 'Other'],
  proposal_given: ['Yes', 'No', 'Other'],
  customer_decision: CUSTOMER_DECISIONS,
  tracker_status: TRACKER_STATUSES,
  coordinator_reviewed: ['Yes', 'No'],
  follow_up_stage: FOLLOW_UP_STAGES,
  // The workbook's follow-up columns; their lists live in utils/marketingFollowUp.js.
  lead_status: LEAD_STATUSES,
  last_contact_method: CONTACT_METHODS,
  customer_response: CUSTOMER_RESPONSES,
  next_action: NEXT_ACTIONS
};

// The two date columns, validated as calendar days rather than against an option list.
const TRACKER_DATE_FIELDS = ['last_contact_date', 'next_follow_up_date'];
const TRACKER_OTHER_FIELDS = {
  maintenance_system: 'maintenance_system_other',
  proposal_given: 'proposal_given_other',
  customer_decision: 'customer_decision_other'
};

// Every column the tracker reads, qualified on request: the admin list joins franchise_partners
// for the owning partner's name, and both tables carry id/status/created_at, so an unqualified
// list would make the join ambiguous rather than merely untidy.
const TRACKER_COLUMNS = [
  'id', 'estimate_id', 'client_name', 'client_phone', 'client_email',
  'property_type', 'property_name', 'total_units', 'total_amount', 'status',
  'number_of_blocks', 'units_per_block', 'block_names', 'block_unit_types',
  'tower_name', 'block_number', 'villa_plot_number',
  'created_at', 'created_by_name', 'created_by_role',
  'lead_source', 'priority',
  'maintenance_system', 'maintenance_system_other',
  'proposal_given', 'proposal_given_other',
  'customer_decision', 'customer_decision_other',
  'tracker_status', 'coordinator_reviewed', 'follow_up_stage', 'coordinator_name',
  'lead_status', 'last_contact_date', 'last_contact_method', 'customer_response',
  'next_follow_up_date', 'next_action',
  'tracked_at', 'tracker_archived_at',
  'tracker_updated_by', 'tracker_updated_by_role', 'tracker_updated_at'
];

// Who is making this change, as the tracker's Last Updated By column will name them.
//
// The three portals' tokens do not agree on what they carry: the FP's holds firstName/lastName,
// an admin's is built from a users row and holds the same, but the manager login signs only
// { id, username, email, role, managerId, ... } -- so a name is not always there and the username
// is the next best identity. Never blank: a row that changed under somebody has to name someone.
const ACTOR_FALLBACK = 'Unknown user';

const trackerActor = (req) => {
  const user = req.user || {};
  const parts = [user.firstName || user.first_name, user.lastName || user.last_name]
    .filter(Boolean).join(' ').trim();
  const name = parts || user.companyName || user.username || user.email || ACTOR_FALLBACK;
  return {
    // The columns are VARCHAR(150)/(60); MySQL would otherwise refuse or truncate the write.
    name: String(name).slice(0, 150),
    role: String(user.role || '').slice(0, 60) || null
  };
};

const trackerSelect = (alias = 'e') => TRACKER_COLUMNS.map((col) => `${alias}.${col}`).join(', ');

// How long a new lead sits with the executive before it is the coordinator's to review.
const COORDINATOR_REVIEW_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Where a tracked lead has got to on its own, with nobody having set a status by hand:
 *
 *   Created by Executive       the first day after the estimate was written
 *   Pending Employee Review from a day old, and it stays there...
 *   Reviewed by Employee    ...until a coordinator marks Coordinator Reviewed as Yes
 *
 * Derived on read rather than stored, like Due Status: a stored "Pending Employee Review" is
 * wrong the moment somebody reviews it, and nothing would be running to correct it. It also means
 * the rule applies to rows that were tracked before it existed.
 *
 * A day is 24 hours from created_at, not the next calendar date -- "after 1 day" should not mean
 * "in an hour" for a lead entered at 11pm.
 */
const autoTrackerStatus = (est, now = Date.now()) => {
  if (!est.tracked_at) return 'Not Started';
  if (decodeEntities(String(est.coordinator_reviewed || '')).trim() === 'Yes') {
    return 'Reviewed by Employee';
  }
  const created = est.created_at ? new Date(est.created_at).getTime() : NaN;
  if (Number.isNaN(created)) return 'Created by Executive';
  return now - created >= COORDINATOR_REVIEW_AFTER_MS
    ? 'Pending Employee Review'
    : 'Created by Executive';
};

// The tracker status the row should show. The estimate's own status is the authority at the ends
// of the pipeline -- approved/rejected always win, and a sent estimate defaults to Estimate Sent
// until it is moved further along by hand. A status chosen by hand outranks the automatic one,
// so the progression never drags a lead back from where somebody deliberately put it.
const effectiveTrackerStatus = (est) => {
  if (est.status === 'approved') return 'Approved';
  if (est.status === 'rejected') return 'Rejected';
  if (est.tracker_status) return est.tracker_status;
  if (est.status === 'sent') return 'Estimate Sent';
  return autoTrackerStatus(est);
};

// What a tracker row looks like to the portal: the resolved status the list shows, the two dates
// as plain 'YYYY-MM-DD' (mysql2 hands back a Date, which JSON would turn into a UTC timestamp and
// read a day early in IST), the Customer Response the estimate dictates once it is approved or
// rejected, and the derived Due Status. None of the derived values are stored.
const presentTrackerRow = (row) => {
  const lead_status = row.lead_status || '';
  const last_contact_date = toDateOnly(row.last_contact_date);
  const next_follow_up_date = toDateOnly(row.next_follow_up_date);
  return {
    ...row,
    tracker_status: effectiveTrackerStatus(row),
    last_contact_date,
    next_follow_up_date,
    customer_response: effectiveCustomerResponse(row.status, row.customer_response),
    due_status: dueStatus(next_follow_up_date, lead_status),
    // The role is stored as its code; the label it reads as belongs to config/roles.js, which is
    // CommonJS and so cannot be imported by the browser. Sending the resolved label keeps the
    // portal from carrying a fourth copy of the role names that has to be kept in step.
    tracker_updated_by_role_label: row.tracker_updated_by_role
      ? (ROLE_NAMES[row.tracker_updated_by_role] || row.tracker_updated_by_role)
      : ''
  };
};

// ============================================
// SCOPE
// ============================================
//
// A mount's resolveScope(req) answers which partners' rows are in view, who owns a new complaint,
// and whether this caller may write at all. It may throw { status, message } to refuse the request
// outright -- that is how the FP mount keeps answering 403 to an FP's own staff.
//
//   fpIds           number[] | null   null = every partner (admin); [] = nothing in view
//   writeFpId       number | null     partner a newly created complaint belongs to
//   zones           string[] | null   null = unrestricted; [] = no zones assigned
//   canWrite        boolean           false = reads only (the view-only Operations Manager)
//   withPartnerName boolean           join franchise_partners into the lists

// `fpIds === null` is the admin's "every partner", so it adds no condition. A list binds one
// placeholder per id. An empty list means the caller can see nothing, and `IN ()` is not SQL, so
// it is spelled as a condition no row matches -- never as an omitted filter.
const fpFilter = (scope, prefix = '') => {
  if (scope.fpIds === null) return { sql: '', params: [] };
  if (!scope.fpIds.length) return { sql: ' AND 1 = 0', params: [] };
  return {
    sql: ` AND ${prefix}franchise_partner_id IN (${scope.fpIds.map(() => '?').join(',')})`,
    params: [...scope.fpIds]
  };
};

// A zone-restricted caller (the Manager portal) sees only rows in its assigned zones. This is the
// filter the manager's own estimates list and complaints inbox already applied; it is here so the
// tracker and its writes cannot become the one screen that ignores it.
// `withCreator` is for fp_estimates only. A coordinator or an executive is also allowed the leads
// they entered themselves, wherever the property sits -- the same "my zones or my own records"
// rule their other screens use, and without it an executive would open the tracker on their own
// visits and find it empty, since an estimate's zone is the property's and not theirs. The
// complaints table has a zone but no created_by_id, so asking for the clause there fails the whole
// statement with "Unknown column 'c.created_by_id'", which is a 500 where a list should be.
const zoneFilter = (scope, prefix = '', { withCreator = false } = {}) => {
  if (!scope.zones) return { sql: '', params: [] };

  const creator = withCreator && scope.creator && [
    { column: 'created_by_id', value: scope.creator.id },
    { column: 'created_by_name', value: scope.creator.email },
    { column: 'created_by_name', value: scope.creator.username }
  ].filter((match) => match.value !== undefined && match.value !== null && match.value !== '');

  const creatorSql = creator && creator.length
    ? creator.map((match) => ` OR ${prefix}${match.column} = ?`).join('')
    : '';
  const creatorParams = creator ? creator.map((match) => match.value) : [];

  // No zone assigned at all: own records only, rather than everything or nothing.
  if (!scope.zones.length) {
    return creatorSql
      ? { sql: ` AND (1 = 0${creatorSql})`, params: creatorParams }
      : { sql: ' AND 1 = 0', params: [] };
  }
  return {
    sql: ` AND (${prefix}zone IN (${scope.zones.map(() => '?').join(',')})${creatorSql})`,
    params: [...scope.zones, ...creatorParams]
  };
};

// The partner-name column and the join that feeds it, or nothing at all for a scope that is
// already one partner's. Which columns are safe to name is decided by
// utils/franchisePartnerName.js -- `contact_person` does not exist on every deployment, and
// naming it failed the whole statement, so this list used to answer 500 instead of complaints.
const partnerNameParts = async (scope, prefix) => {
  if (!scope.withPartnerName) return { column: '', join: '' };
  return {
    column: `, ${await partnerNameExpression(pool, 'fpx')} AS franchise_partner_name`,
    join: ` LEFT JOIN franchise_partners fpx ON ${prefix}franchise_partner_id = fpx.id`
  };
};

const parseRowId = (value) => {
  const id = parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

const fail = (res, error, message) => {
  console.error(`${message}:`, error);
  res.status(500).json({ success: false, message, error: error.message });
};

/**
 * Build the marketing router for one portal.
 * @param {object} options
 * @param {(req) => object|Promise<object>} options.resolveScope - see the scope contract above
 */
const createMarketingRouter = ({ resolveScope }) => {
  const router = express.Router();

  // Every handler runs against a resolved scope; a scope that throws answers with its own status
  // instead of reaching the database.
  const scoped = (handler) => async (req, res) => {
    let scope;
    try {
      scope = await resolveScope(req);
    } catch (error) {
      return res.status(error.status || 403).json({
        success: false,
        message: error.message || 'Access denied.'
      });
    }
    return handler(req, res, scope);
  };

  // Reads are open to anyone the mount lets through; writes need canWrite, which is what keeps the
  // view-only Operations Manager read-only on the server and not merely in the sidebar.
  const scopedWrite = (handler) => scoped(async (req, res, scope) => {
    if (!scope.canWrite) {
      return res.status(403).json({ success: false, message: 'You do not have permission to change marketing records.' });
    }
    return handler(req, res, scope);
  });

  // The tracker PUT is the one write a reviewer-only caller may make. A coordinator reads the
  // pipeline and marks Coordinator Reviewed -- which is the whole point of that column, since
  // setting it to Yes records their name -- but changes nothing else, so `canReview` admits them
  // here and the handler below writes only that column. `canWrite: false, canReview: false` (the
  // executive, the Operations Manager) is refused as before.
  const scopedTrackerWrite = (handler) => scoped(async (req, res, scope) => {
    if (!scope.canWrite && !scope.canReview) {
      return res.status(403).json({ success: false, message: 'You do not have permission to change marketing records.' });
    }
    return handler(req, res, scope);
  });

  // ============================================
  // MARKETING TRACKER
  // ============================================

  // Direct estimates for the tracker list and the New picker; latest first.
  router.get('/tracker', scoped(async (req, res, scope) => {
    try {
      await ensureMarketingTrackerColumns();
      const fp = fpFilter(scope, 'e.');
      const zone = zoneFilter(scope, 'e.', { withCreator: true });
      const partner = await partnerNameParts(scope, 'e.');
      const [rows] = await pool.execute(
        `SELECT ${trackerSelect('e')}${partner.column}
         FROM fp_estimates e${partner.join}
         WHERE e.estimate_type = 'direct'
           AND (e.is_archived = 0 OR e.is_archived IS NULL)
           AND e.tracker_archived_at IS NULL${fp.sql}${zone.sql}
         ORDER BY e.created_at DESC`,
        [...fp.params, ...zone.params]
      );
      res.json({ success: true, data: rows.map(presentTrackerRow) });
    } catch (error) {
      fail(res, error, 'Failed to fetch tracker data');
    }
  }));

  // Tracker entries that were archived -- newest archive first.
  router.get('/tracker/archived', scoped(async (req, res, scope) => {
    try {
      await ensureMarketingTrackerColumns();
      const fp = fpFilter(scope, 'e.');
      const zone = zoneFilter(scope, 'e.', { withCreator: true });
      const partner = await partnerNameParts(scope, 'e.');
      const [rows] = await pool.execute(
        `SELECT ${trackerSelect('e')}${partner.column}
         FROM fp_estimates e${partner.join}
         WHERE e.estimate_type = 'direct'
           AND e.tracker_archived_at IS NOT NULL${fp.sql}${zone.sql}
         ORDER BY e.tracker_archived_at DESC`,
        [...fp.params, ...zone.params]
      );
      res.json({ success: true, data: rows.map(presentTrackerRow) });
    } catch (error) {
      fail(res, error, 'Failed to fetch archived tracker data');
    }
  }));

  // Everything Marketing > Dashboard draws, from the rows Marketing > Tracker edits: tracked,
  // non-archived direct estimates. The counting rules live in utils/marketingDashboard.js so they
  // can be tested without a database.
  router.get('/dashboard', scoped(async (req, res, scope) => {
    try {
      await ensureMarketingTrackerColumns();
      const fp = fpFilter(scope, 'e.');
      const zone = zoneFilter(scope, 'e.', { withCreator: true });
      const [rows] = await pool.execute(
        `SELECT ${trackerSelect('e')}
         FROM fp_estimates e
         WHERE e.estimate_type = 'direct'
           AND (e.is_archived = 0 OR e.is_archived IS NULL)
           AND e.tracker_archived_at IS NULL
           AND e.tracked_at IS NOT NULL${fp.sql}${zone.sql}
         ORDER BY e.created_at DESC`,
        [...fp.params, ...zone.params]
      );
      // The dashboard reports on the status the tracker shows, not the raw column -- an approved
      // estimate reads Approved there even when nobody set tracker_status by hand.
      const resolved = rows.map((row) => ({ ...row, tracker_status: effectiveTrackerStatus(row) }));
      res.json({ success: true, data: buildMarketingDashboard(resolved) });
    } catch (error) {
      fail(res, error, 'Failed to fetch dashboard data');
    }
  }));

  router.put('/tracker/:id', scopedTrackerWrite(async (req, res, scope) => {
    try {
      await ensureMarketingTrackerColumns();
      const id = parseRowId(req.params.id);
      if (id === null) {
        return res.status(400).json({ success: false, message: 'Invalid estimate id' });
      }

      // A reviewer-only caller writes one column. The restriction is applied by building a
      // different statement rather than by checking the body against the stored row: the table
      // re-sends the whole tracker payload on every inline edit, so anything short of naming the
      // columns explicitly would let one of those payloads through as a full edit.
      if (!scope.canWrite) {
        const reviewed = decodeEntities(String(req.body.coordinator_reviewed ?? '')).trim();
        if (!TRACKER_OPTIONS.coordinator_reviewed.includes(reviewed)) {
          return res.status(400).json({
            success: false,
            message: `coordinator_reviewed must be one of: ${TRACKER_OPTIONS.coordinator_reviewed.join(', ')}`
          });
        }
        const fp = fpFilter(scope);
        const zone = zoneFilter(scope, '', { withCreator: true });
        const actor = trackerActor(req);
        const [result] = await pool.execute(
          `UPDATE fp_estimates SET
             coordinator_reviewed = ?,
             coordinator_name = CASE WHEN ? = 'Yes'
               THEN COALESCE(NULLIF(coordinator_name, ''), ?) ELSE NULL END,
             tracker_updated_by = ?, tracker_updated_by_role = ?, tracker_updated_at = NOW(),
             updated_at = NOW()
           WHERE id = ? AND estimate_type = 'direct'
             AND tracked_at IS NOT NULL${fp.sql}${zone.sql}`,
          [reviewed, reviewed, actor.name, actor.name, actor.role, id, ...fp.params, ...zone.params]
        );
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Tracked estimate not found' });
        }
        const partner = await partnerNameParts(scope, 'e.');
        const [rows] = await pool.execute(
          `SELECT ${trackerSelect('e')}${partner.column}
           FROM fp_estimates e${partner.join}
           WHERE e.id = ?`,
          [id]
        );
        return res.json({ success: true, message: 'Review recorded', data: presentTrackerRow(rows[0]) });
      }

      const updates = {};
      const errors = [];
      for (const [field, options] of Object.entries(TRACKER_OPTIONS)) {
        const value = req.body[field];
        // proposal_given and customer_decision are the form's required fields; the rest pass through
        // empty when left unanswered.
        const required = field === 'proposal_given' || field === 'customer_decision';
        if (value === undefined || value === null || value === '') {
          if (required) errors.push(`${field} is required`);
          updates[field] = null;
          // The paired free-text column has to be cleared here too. Left unset it stayed
          // undefined, and mysql2 refuses an undefined bind ("Bind parameters must not contain
          // undefined"), so a tracker saved with no Current Maintenance System answered 500 --
          // the required pair above was all that normally stopped the request reaching this far.
          const pairedOtherField = TRACKER_OTHER_FIELDS[field];
          if (pairedOtherField) updates[pairedOtherField] = null;
          continue;
        }
        // middleware/security.js escapes every request string, so 'SMS/Text' reaches us as
        // 'SMS&#x2F;Text'. Validation judges the decoded text -- comparing the raw value would
        // reject every option containing a slash, apostrophe or ampersand with a 400 the portal
        // cannot explain. The escaped form is what gets stored, so it is escaped exactly once.
        const decoded = decodeEntities(String(value)).trim();
        if (!options.includes(decoded)) {
          errors.push(`${field} must be one of: ${options.join(', ')}`);
          continue;
        }
        updates[field] = value;

        const otherField = TRACKER_OTHER_FIELDS[field];
        if (otherField) {
          const otherText = (req.body[otherField] || '').toString().trim().slice(0, 255);
          // Judged on the decoded value for the same reason as the option itself.
          if (decoded === 'Other' && !decodeEntities(otherText).trim()) {
            errors.push(`${otherField} is required when ${field} is Other`);
          }
          updates[otherField] = decoded === 'Other' ? otherText : null;
        }
      }
      // coordinator_name is deliberately not read from the body. It is the person who set
      // Reviewed to Yes, resolved in the UPDATE below from the token, so the column records who
      // actually reviewed the estimate rather than whatever anybody chose to type.

      // The two dates. The portal fills them in -- picking a follow-up stage stamps today in IST and
      // schedules four days out -- but they stay editable, so anything that is not a calendar date
      // is refused rather than silently stored as NULL and read as "No Date".
      for (const field of TRACKER_DATE_FIELDS) {
        const raw = req.body[field];
        if (raw === undefined || raw === null || raw === '') {
          updates[field] = null;
          continue;
        }
        const date = toDateOnly(raw);
        if (!date) {
          errors.push(`${field} must be a date`);
          continue;
        }
        updates[field] = date;
      }

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join('; ') });
      }

      const fp = fpFilter(scope);
      const zone = zoneFilter(scope, '', { withCreator: true });

      // Only the two revision statuses are stored; everything else is derived and stays derived.
      //
      // The dropdown locks the automated options, and the table re-sends the whole tracker
      // payload on every inline edit anyway -- including the *resolved* status it was given, so
      // a row sitting at "Pending Employee Review" submits that same text while somebody is
      // editing an unrelated cell. Storing it would freeze the lead there, the progression dead
      // for that row. Any submitted status that is not a manual choice is written as NULL, which
      // keeps the automatic one in charge -- and heals a row frozen by an older version, since
      // its next edit clears the stale value rather than keeping it.
      const [[current]] = await pool.execute(
        `SELECT id, follow_up_stage FROM fp_estimates
         WHERE id = ? AND estimate_type = 'direct'${fp.sql}${zone.sql}`,
        [id, ...fp.params, ...zone.params]
      );
      if (!current) {
        return res.status(404).json({ success: false, message: 'Direct estimate not found' });
      }
      if (updates.tracker_status && !MANUAL_TRACKER_STATUSES.includes(updates.tracker_status)) {
        updates.tracker_status = null;
      }

      // Follow-Up Stage moves forward only -- the dropdown locks the steps behind the current
      // one, and the same holds here so a stale tab or a direct call cannot walk the pipeline
      // back. A submission behind the stored step, or a blank one, keeps what is stored rather
      // than refusing: the table re-sends the whole payload on every inline edit, and the other
      // cells in it are still worth saving.
      const storedStageIdx = FOLLOW_UP_STAGES.indexOf(decodeEntities(String(current.follow_up_stage || '')).trim());
      const submittedStageIdx = FOLLOW_UP_STAGES.indexOf(decodeEntities(String(req.body.follow_up_stage ?? '')).trim());
      if (storedStageIdx >= 0 && submittedStageIdx < storedStageIdx) {
        updates.follow_up_stage = current.follow_up_stage;
      }

      // Who changed it is recorded by the server from the token, never taken from the body: a
      // field the caller could set would be worth nothing as a record of who did what.
      const actor = trackerActor(req);
      const [result] = await pool.execute(
        `UPDATE fp_estimates SET
           lead_source = ?, priority = ?,
           maintenance_system = ?, maintenance_system_other = ?,
           proposal_given = ?, proposal_given_other = ?,
           customer_decision = ?, customer_decision_other = ?,
           tracker_status = ?, coordinator_reviewed = ?, follow_up_stage = ?,
           -- Who reviewed it is not typed in, it is whoever set Reviewed to Yes. Resolved in SQL
           -- against the stored row so the first reviewer keeps the credit: the table re-sends the
           -- whole payload on every inline edit, so recomputing it from the caller would hand the
           -- review to the next person who touched an unrelated cell. Clearing the flag clears
           -- the name with it, rather than leaving a review nobody stands behind.
           coordinator_name = CASE WHEN ? = 'Yes'
             THEN COALESCE(NULLIF(coordinator_name, ''), ?) ELSE NULL END,
           lead_status = ?, last_contact_date = ?, last_contact_method = ?,
           customer_response = ?, next_follow_up_date = ?, next_action = ?,
           tracker_updated_by = ?, tracker_updated_by_role = ?, tracker_updated_at = NOW(),
           tracked_at = NOW(), updated_at = NOW()
         WHERE id = ? AND estimate_type = 'direct'${fp.sql}${zone.sql}`,
        [
          updates.lead_source, updates.priority,
          updates.maintenance_system, updates.maintenance_system_other,
          updates.proposal_given, updates.proposal_given_other,
          updates.customer_decision, updates.customer_decision_other,
          updates.tracker_status, updates.coordinator_reviewed, updates.follow_up_stage,
          updates.coordinator_reviewed, actor.name,
          updates.lead_status, updates.last_contact_date, updates.last_contact_method,
          updates.customer_response, updates.next_follow_up_date, updates.next_action,
          actor.name, actor.role,
          id, ...fp.params, ...zone.params
        ]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Direct estimate not found' });
      }

      const partner = await partnerNameParts(scope, 'e.');
      // The partner name rides along: the tracker puts this row straight back into its list, so a
      // reply without it would blank the Franchise Partner cell on the admin's table until the
      // next reload.
      const [rows] = await pool.execute(
        `SELECT ${trackerSelect('e')}${partner.column}
         FROM fp_estimates e${partner.join}
         WHERE e.id = ?`,
        [id]
      );
      res.json({ success: true, message: 'Tracker updated', data: presentTrackerRow(rows[0]) });
    } catch (error) {
      fail(res, error, 'Failed to save tracker data');
    }
  }));

  // Soft-delete a tracked row from the tracker (it lands in Marketing > Archived); the estimate
  // itself is untouched. The same flag is what the New picker and tracker list filter on.
  router.put('/tracker/:id/archive', scopedWrite(async (req, res, scope) => {
    try {
      await ensureMarketingTrackerColumns();
      const id = parseRowId(req.params.id);
      if (id === null) {
        return res.status(400).json({ success: false, message: 'Invalid estimate id' });
      }
      const fp = fpFilter(scope);
      const zone = zoneFilter(scope, '', { withCreator: true });
      // Archiving is a change to the row like any other, so it names whoever did it.
      const actor = trackerActor(req);
      const [result] = await pool.execute(
        `UPDATE fp_estimates SET tracker_archived_at = NOW(),
           tracker_updated_by = ?, tracker_updated_by_role = ?, tracker_updated_at = NOW()
         WHERE id = ? AND estimate_type = 'direct'
           AND tracked_at IS NOT NULL${fp.sql}${zone.sql}`,
        [actor.name, actor.role, id, ...fp.params, ...zone.params]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Tracked estimate not found' });
      }
      res.json({ success: true, message: 'Moved to Archived' });
    } catch (error) {
      fail(res, error, 'Failed to archive tracker entry');
    }
  }));

  // Bring an archived tracker entry back to the tracker list.
  router.put('/tracker/:id/unarchive', scopedWrite(async (req, res, scope) => {
    try {
      await ensureMarketingTrackerColumns();
      const id = parseRowId(req.params.id);
      if (id === null) {
        return res.status(400).json({ success: false, message: 'Invalid estimate id' });
      }
      const fp = fpFilter(scope);
      const zone = zoneFilter(scope, '', { withCreator: true });
      const actor = trackerActor(req);
      const [result] = await pool.execute(
        `UPDATE fp_estimates SET tracker_archived_at = NULL,
           tracker_updated_by = ?, tracker_updated_by_role = ?, tracker_updated_at = NOW()
         WHERE id = ? AND estimate_type = 'direct'
           AND tracker_archived_at IS NOT NULL${fp.sql}${zone.sql}`,
        [actor.name, actor.role, id, ...fp.params, ...zone.params]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Archived tracker entry not found' });
      }
      res.json({ success: true, message: 'Restored to tracker' });
    } catch (error) {
      fail(res, error, 'Failed to restore tracker entry');
    }
  }));

  // ============================================
  // MARKETING COMPLAINTS
  // ============================================
  // Marketing > Complaint Form logs a customer complaint against a property -- the same fields the
  // "XLAND Customer complaints form" collects. Deleting a row only archives it: it leaves the
  // form's list and lands in Marketing > Archived under its own tab, restorable from there. The
  // table helpers are shared with the customer portal's Contact-page complaint form.

  // Complaints in view -- newest first.
  //
  // `?includeArchived=true` returns archived rows as well, sorted after the live ones. That is
  // what the read-only Complaints inbox asks for: it is a single list with no Archived tab beside
  // it, so filtering the archived rows out would simply lose them. Marketing > Complaint Form
  // leaves the flag off and pairs with /complaints/archived instead.
  router.get('/complaints', scoped(async (req, res, scope) => {
    try {
      await ensureMarketingComplaintsTable();
      const includeArchived = req.query.includeArchived === 'true';
      const fp = fpFilter(scope, 'c.');
      const zone = zoneFilter(scope, 'c.');
      const partner = await partnerNameParts(scope, 'c.');
      const [rows] = await pool.execute(
        `SELECT ${complaintSelect('c.')}${partner.column}
         FROM ${COMPLAINT_TABLE} c${partner.join}
         WHERE 1 = 1${includeArchived ? '' : ' AND c.archived_at IS NULL'}${fp.sql}${zone.sql}
         ORDER BY ${includeArchived ? '(c.archived_at IS NOT NULL), ' : ''}c.created_at DESC`,
        [...fp.params, ...zone.params]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      fail(res, error, 'Failed to fetch complaints');
    }
  }));

  // Archived complaints -- newest archive first. Declared before /:id so it is not swallowed as an
  // id (there is no GET /:id, but keep the ordering the other marketing routes follow).
  router.get('/complaints/archived', scoped(async (req, res, scope) => {
    try {
      await ensureMarketingComplaintsTable();
      const fp = fpFilter(scope, 'c.');
      const zone = zoneFilter(scope, 'c.');
      const partner = await partnerNameParts(scope, 'c.');
      const [rows] = await pool.execute(
        `SELECT ${complaintSelect('c.')}${partner.column}
         FROM ${COMPLAINT_TABLE} c${partner.join}
         WHERE c.archived_at IS NOT NULL${fp.sql}${zone.sql}
         ORDER BY c.archived_at DESC`,
        [...fp.params, ...zone.params]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      fail(res, error, 'Failed to fetch archived complaints');
    }
  }));

  // Log a complaint. A complaint is owned by exactly one partner, so a caller who sees every
  // partner's rows (admin) has to say which one it belongs to -- the column is NOT NULL, and
  // leaving it to MySQL would turn a missing choice into an unexplained 500.
  router.post('/complaints', scopedWrite(async (req, res, scope) => {
    try {
      await ensureMarketingComplaintsTable();
      if (!scope.writeFpId) {
        return res.status(400).json({ success: false, message: 'Select the franchise partner this complaint belongs to.' });
      }
      const { errors, complaint } = parseComplaintBody(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join('; ') });
      }
      const [result] = await pool.execute(
        `INSERT INTO ${COMPLAINT_TABLE}
           (franchise_partner_id, property_id, zone, responsible_person,
            concern_with, concern_with_other, contact_person_name, phone_number, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scope.writeFpId, complaint.property_id, complaint.zone, complaint.responsible_person,
          complaint.concern_with, complaint.concern_with_other,
          complaint.contact_person_name, complaint.phone_number, complaint.comments
        ]
      );
      const partner = await partnerNameParts(scope, 'c.');
      const [rows] = await pool.execute(
        `SELECT ${complaintSelect('c.')}${partner.column}
         FROM ${COMPLAINT_TABLE} c${partner.join}
         WHERE c.id = ?`,
        [result.insertId]
      );
      res.json({ success: true, message: 'Complaint logged', data: rows[0] });
    } catch (error) {
      fail(res, error, 'Failed to save complaint');
    }
  }));

  // Modify a complaint. Archived rows are read-only here -- restore them first.
  router.put('/complaints/:id', scopedWrite(async (req, res, scope) => {
    try {
      await ensureMarketingComplaintsTable();
      const id = parseRowId(req.params.id);
      if (id === null) {
        return res.status(400).json({ success: false, message: 'Invalid complaint id' });
      }
      const { errors, complaint } = parseComplaintBody(req.body);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join('; ') });
      }
      const fp = fpFilter(scope);
      const zone = zoneFilter(scope);
      const [result] = await pool.execute(
        `UPDATE ${COMPLAINT_TABLE} SET
           property_id = ?, zone = ?, responsible_person = ?,
           concern_with = ?, concern_with_other = ?,
           contact_person_name = ?, phone_number = ?, comments = ?
         WHERE id = ? AND archived_at IS NULL${fp.sql}${zone.sql}`,
        [
          complaint.property_id, complaint.zone, complaint.responsible_person,
          complaint.concern_with, complaint.concern_with_other,
          complaint.contact_person_name, complaint.phone_number, complaint.comments,
          id, ...fp.params, ...zone.params
        ]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Complaint not found' });
      }
      const partner = await partnerNameParts(scope, 'c.');
      const [rows] = await pool.execute(
        `SELECT ${complaintSelect('c.')}${partner.column}
         FROM ${COMPLAINT_TABLE} c${partner.join}
         WHERE c.id = ?`,
        [id]
      );
      res.json({ success: true, message: 'Complaint updated', data: rows[0] });
    } catch (error) {
      fail(res, error, 'Failed to update complaint');
    }
  }));

  // Soft-delete a complaint; it lands in Marketing > Archived under the Complaint Forms tab.
  router.put('/complaints/:id/archive', scopedWrite(async (req, res, scope) => {
    try {
      await ensureMarketingComplaintsTable();
      const id = parseRowId(req.params.id);
      if (id === null) {
        return res.status(400).json({ success: false, message: 'Invalid complaint id' });
      }
      const fp = fpFilter(scope);
      const zone = zoneFilter(scope);
      const [result] = await pool.execute(
        `UPDATE ${COMPLAINT_TABLE} SET archived_at = NOW()
         WHERE id = ? AND archived_at IS NULL${fp.sql}${zone.sql}`,
        [id, ...fp.params, ...zone.params]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Complaint not found' });
      }
      res.json({ success: true, message: 'Moved to Archived' });
    } catch (error) {
      fail(res, error, 'Failed to archive complaint');
    }
  }));

  // Bring an archived complaint back to the complaint form list.
  router.put('/complaints/:id/unarchive', scopedWrite(async (req, res, scope) => {
    try {
      await ensureMarketingComplaintsTable();
      const id = parseRowId(req.params.id);
      if (id === null) {
        return res.status(400).json({ success: false, message: 'Invalid complaint id' });
      }
      const fp = fpFilter(scope);
      const zone = zoneFilter(scope);
      const [result] = await pool.execute(
        `UPDATE ${COMPLAINT_TABLE} SET archived_at = NULL
         WHERE id = ? AND archived_at IS NOT NULL${fp.sql}${zone.sql}`,
        [id, ...fp.params, ...zone.params]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Archived complaint not found' });
      }
      res.json({ success: true, message: 'Restored to complaints' });
    } catch (error) {
      fail(res, error, 'Failed to restore complaint');
    }
  }));

  return router;
};

module.exports = {
  createMarketingRouter,
  ensureMarketingTrackerColumns,
  MARKETING_TRACKER_COLUMNS,
  TRACKER_OPTIONS,
  trackerSelect,
  presentTrackerRow,
  effectiveTrackerStatus,
  autoTrackerStatus,
  COORDINATOR_REVIEW_AFTER_MS
};
