/**
 * Shared helpers for the fp_marketing_complaints table.
 *
 * Marketing > Complaint Form logs a customer complaint against a property -- the same fields the
 * "XLAND Customer complaints form" collects. Customers file the same record from their portal's
 * Contact page, which is why this lives in a util instead of franchisePartner.js: the FP routes
 * write every field, the customer route derives all but concern/comments from the login profile.
 * Deleting a row only archives it: it leaves the form's list and lands in Marketing > Archived
 * under its own tab, restorable from there.
 *
 * A complaint is also a piece of work, and this file owns that workflow too (schema_v51): the FP
 * assigns it to one zone-centric employee, the assignee works it and saves a note, and the FP or
 * its manager verifies and closes it -- closing archives it. Who may move it where is
 * `resolveComplaintStatus` below, so the rule is one function rather than a condition repeated in
 * five portals. Regression test: `node --test backend/utils/marketingComplaints.test.js`.
 */

const { pool } = require('../config/database');
const { decodeEntities } = require('./htmlEntities');

const COMPLAINT_TABLE = 'fp_marketing_complaints';

// The workflow columns, added to a table created by schema_v47 (which has none of them). Checked
// against information_schema rather than with MariaDB's "ADD COLUMN IF NOT EXISTS", which MySQL 8
// does not support -- the same tolerance ensureMarketingTrackerColumns gives fp_estimates.
const COMPLAINT_WORKFLOW_COLUMNS = [
  { name: 'status', def: "VARCHAR(40) NOT NULL DEFAULT 'Open'" },
  { name: 'assigned_employee_id', def: 'INT NULL' },
  { name: 'assigned_employee_name', def: 'VARCHAR(255) NULL' },
  { name: 'assigned_employee_role', def: 'VARCHAR(60) NULL' },
  { name: 'assigned_at', def: 'TIMESTAMP NULL' },
  { name: 'assigned_by', def: 'VARCHAR(150) NULL' },
  { name: 'complaint_note', def: 'TEXT NULL' },
  { name: 'note_updated_by', def: 'VARCHAR(150) NULL' },
  { name: 'note_updated_by_role', def: 'VARCHAR(60) NULL' },
  { name: 'note_updated_at', def: 'TIMESTAMP NULL' },
  { name: 'status_updated_by', def: 'VARCHAR(150) NULL' },
  { name: 'status_updated_by_role', def: 'VARCHAR(60) NULL' },
  { name: 'status_updated_at', def: 'TIMESTAMP NULL' },
  { name: 'closed_at', def: 'TIMESTAMP NULL' },
  { name: 'closed_by', def: 'VARCHAR(150) NULL' },
  // Who filed it, so the complaint can report back (schema_v52). The email is stamped at filing
  // rather than looked up each time, for the same reason the assignee's name is.
  { name: 'customer_account_id', def: 'INT NULL' },
  { name: 'customer_email', def: 'VARCHAR(255) NULL' }
];

const ensureMarketingComplaintsTable = async () => {
  try {
    const [tables] = await pool.execute(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [COMPLAINT_TABLE]
    );
    if (tables[0].n === 0) {
      // Same statement as schema_v47_marketing_complaints.sql plus the schema_v51 workflow
      // columns, so a deployment that has applied neither file still works.
      await pool.execute(
        `CREATE TABLE ${COMPLAINT_TABLE} (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          franchise_partner_id INT NOT NULL,
          property_id VARCHAR(255) NOT NULL,
          zone VARCHAR(255) NOT NULL,
          responsible_person VARCHAR(255) NOT NULL,
          concern_with VARCHAR(100) NOT NULL,
          concern_with_other VARCHAR(255) NULL,
          contact_person_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(50) NOT NULL,
          comments TEXT NOT NULL,
          status VARCHAR(40) NOT NULL DEFAULT 'Open',
          assigned_employee_id INT NULL,
          assigned_employee_name VARCHAR(255) NULL,
          assigned_employee_role VARCHAR(60) NULL,
          assigned_at TIMESTAMP NULL,
          assigned_by VARCHAR(150) NULL,
          complaint_note TEXT NULL,
          note_updated_by VARCHAR(150) NULL,
          note_updated_by_role VARCHAR(60) NULL,
          note_updated_at TIMESTAMP NULL,
          status_updated_by VARCHAR(150) NULL,
          status_updated_by_role VARCHAR(60) NULL,
          status_updated_at TIMESTAMP NULL,
          closed_at TIMESTAMP NULL,
          closed_by VARCHAR(150) NULL,
          customer_account_id INT NULL,
          customer_email VARCHAR(255) NULL,
          archived_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_fp_marketing_complaints_fp (franchise_partner_id),
          KEY idx_fp_marketing_complaints_assignee (assigned_employee_id),
          KEY idx_fp_marketing_complaints_customer (customer_account_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
      return;
    }
    for (const col of COMPLAINT_WORKFLOW_COLUMNS) {
      // SHOW COLUMNS ... LIKE ? cannot bind its pattern in a prepared statement, so the existence
      // check goes through information_schema instead
      const [cols] = await pool.execute(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [COMPLAINT_TABLE, col.name]
      );
      if (cols[0].n === 0) {
        await pool.execute(`ALTER TABLE ${COMPLAINT_TABLE} ADD COLUMN ${col.name} ${col.def}`);
      }
    }
  } catch (e) { /* table exists or cannot be created; the query below will say which */ }
};

// The concern options the complaint form offers; 'Other' carries its free text in
// concern_with_other. Keep in step with CONCERN_OPTIONS in FPMarketingComplaintForm.jsx and
// frontend/src/pages/Contact.jsx.
const CONCERN_OPTIONS = ['Service Delay', 'Poor Quality Work', 'Incomplete Work', 'Safety Issue', 'Vendor Issue', 'Maintenance Issue', 'Pricing/Payments', 'Other'];

const COMPLAINT_TEXT_FIELDS = [
  ['property_id', 'Property ID', 255],
  ['zone', 'Zone', 255],
  ['responsible_person', 'Responsible person', 255],
  ['contact_person_name', 'Contact Person Name', 255],
  ['phone_number', 'Phone number', 50],
  ['comments', 'Comments', 4000]
];

const COMPLAINT_COLUMNS = [
  // The owning partner rides along because every notification the workflow sends is resolved from
  // it -- the assignee's mailbox, the partner's own, and its managers' are all looked up by it.
  'id', 'franchise_partner_id', 'property_id', 'zone', 'responsible_person',
  'concern_with', 'concern_with_other', 'contact_person_name', 'phone_number', 'comments',
  'status', 'assigned_employee_id', 'assigned_employee_name', 'assigned_employee_role',
  'assigned_at', 'assigned_by',
  'complaint_note', 'note_updated_by', 'note_updated_by_role', 'note_updated_at',
  'status_updated_by', 'status_updated_by_role', 'status_updated_at',
  'closed_at', 'closed_by',
  'customer_account_id', 'customer_email',
  'archived_at', 'created_at', 'updated_at'
];

// The same columns, optionally qualified ('c.'). A staff list joins franchise_partners for the
// owning partner's name, and both tables carry id and created_at, so an unqualified list would
// make that join ambiguous rather than merely untidy.
const complaintSelect = (prefix = '') => COMPLAINT_COLUMNS.map((col) => `${prefix}${col}`).join(', ');

const COMPLAINT_SELECT = complaintSelect();

// The customer form only asks for the concern and comments; the concern validation is shared by
// both parsers. Request text arrives HTML-escaped (middleware/security.js); it is stored exactly
// as it came so the escapes are not doubled, but validation judges the decoded text --
// 'Pricing&#x2F;Payments' has to match 'Pricing/Payments'.
const parseConcern = (body, complaint, errors) => {
  const concernRaw = (body.concern_with || '').toString().trim().slice(0, 100);
  const concern = decodeEntities(concernRaw).trim();
  if (!concern) {
    errors.push('Concern With is required');
  } else if (!CONCERN_OPTIONS.includes(concern)) {
    errors.push(`Concern With must be one of: ${CONCERN_OPTIONS.join(', ')}`);
  } else {
    complaint.concern_with = concernRaw;
  }
  const otherRaw = (body.concern_with_other || '').toString().trim().slice(0, 255);
  complaint.concern_with_other = concern === 'Other' ? otherRaw : null;
  if (concern === 'Other' && !decodeEntities(otherRaw).trim()) {
    errors.push('Please specify the concern when Other is selected');
  }
};

// Every field is required, exactly as the complaint form marks them.
const parseComplaintBody = (body) => {
  const errors = [];
  const complaint = {};
  for (const [field, label, max] of COMPLAINT_TEXT_FIELDS) {
    const raw = (body[field] || '').toString().trim().slice(0, max);
    complaint[field] = raw;
    if (!decodeEntities(raw).trim()) errors.push(`${label} is required`);
  }
  if (complaint.phone_number && !/^\d{10}$/.test(complaint.phone_number)) {
    errors.push('Phone number must be 10 digits');
  }
  parseConcern(body, complaint, errors);
  return { errors, complaint };
};

// The customer portal sends only the concern and comments; the rest is filled from the profile.
const parseCustomerComplaintBody = (body) => {
  const errors = [];
  const complaint = {};
  const comments = (body.comments || '').toString().trim().slice(0, 4000);
  complaint.comments = comments;
  if (!decodeEntities(comments).trim()) errors.push('Comments is required');
  parseConcern(body, complaint, errors);
  return { errors, complaint };
};

// ============================================
// WORKFLOW
// ============================================

/**
 * Where a complaint can be, in order:
 *
 *   Open       filed, nobody is on it yet
 *   Assigned   handed to one zone-centric employee (set by the assignment itself)
 *   In Review  that employee has reported back -- set by *saving their note*, never by hand
 *   Closed     the FP or its manager verified the note and closed it, which archives the row
 *
 * The employee has no status control at all: writing up what they did is the report, so the note
 * is the signal and the status follows from it. That is why 'In Progress' and 'Reviewed' are gone
 * -- one step, "the employee is done and the FP has to look", covered both, and a dropdown that
 * let the assignee pick between them let them sign their own work off.
 */
const COMPLAINT_STATUSES = ['Open', 'Assigned', 'In Review', 'Closed'];

/**
 * The two statuses this workflow replaced, and what they are read as now.
 *
 * `schema_v54_complaint_in_review.sql` rewrites the stored rows, but normalising on the way out
 * as well means a deployment that has not applied it yet still reads sensibly -- and a browser
 * left open on the old dropdown posts a status that resolves instead of 400ing.
 */
const LEGACY_COMPLAINT_STATUSES = { 'In Progress': 'In Review', Reviewed: 'In Review' };

/**
 * A stored or posted status as one of COMPLAINT_STATUSES. Text arrives HTML-escaped
 * (middleware/security.js), so it is decoded before being compared. Anything unrecognised --
 * including the empty status every row written before schema_v51 carries -- reads as 'Open',
 * because a blank where the workflow should be says nothing at all.
 */
const normalizeComplaintStatus = (status) => {
  const value = decodeEntities(String(status || '')).trim();
  if (LEGACY_COMPLAINT_STATUSES[value]) return LEGACY_COMPLAINT_STATUSES[value];
  return COMPLAINT_STATUSES.includes(value) ? value : 'Open';
};

// The four portals a complaint can be assigned into: each of them has the Complaint Form screen to
// read the assignment in and report back from. The supervisor portal has that screen and nothing
// else of Marketing -- no tracker, no marketing dashboard -- which its mount enforces with
// `canReadTracker: false` rather than by leaving the router unmounted (see routes/supervisor.js).
const ASSIGNABLE_ROLES = ['manager', 'coordinator', 'supervisor', 'executive'];

// fp_employees.role is 'manager' on rows written by the current employee form and 'fp_manager' on
// rows from schema_v8's ENUM, so the prefix is dropped before either is compared with a role name.
const normalizeEmployeeRole = (role) => String(role || '').trim().toLowerCase().replace(/^fp_/, '');

const isAssignableRole = (role) => ASSIGNABLE_ROLES.includes(normalizeEmployeeRole(role));

/**
 * The note behind the bubble in the Actions column -- one box per complaint, like the marketing
 * tracker's. Judged on the decoded text: the stored form is escaped once by middleware/security.js,
 * so the escaped length is not what the user typed.
 */
const parseComplaintNote = (body) => {
  const raw = body?.note;
  const note = raw === undefined || raw === null ? '' : String(raw).trim();
  if (decodeEntities(note).trim().length > 500) {
    return { error: 'Note must be 500 characters or fewer.', note: null };
  }
  return { error: null, note: note || null };
};

/**
 * Who may move a complaint where.
 *
 * `canClose` is the FP and its manager: they verify the employee's note and close the complaint,
 * which is also what archives the row. They keep the full dropdown so a row can be corrected --
 * pushed back to Assigned is the exception, because assigning is what produces that status and
 * offering it would let a row claim an assignee nobody chose.
 *
 * **The assignee may set nothing.** They report by saving their note, which the server moves to
 * 'In Review' for them (`PUT /complaints/:id/note`). An employee who could also set the status
 * could mark their own work reviewed, and the point of the step is that somebody else looks.
 *
 * @returns {string[]} the statuses this caller may select, in workflow order. Empty = read-only.
 */
const complaintStatusesFor = ({ canClose = false } = {}) => {
  if (canClose) return COMPLAINT_STATUSES.filter((status) => status !== 'Assigned');
  return [];
};

/**
 * Validate a requested status against the caller and the row.
 *
 * Returns `{ error }` with the message to answer, or `{ status }` with the canonical status to
 * write. `forbidden` separates "no such status" (a 400) from "not yours to set" (a 403), so a
 * portal that offers the wrong option and a caller reaching past their permissions do not answer
 * with the same thing. Request text arrives HTML-escaped, so 'In&#x20;Review' never appears -- but
 * an apostrophe or slash would, and validation therefore judges the decoded text exactly as the
 * concern options do.
 *
 * A retired status ('In Progress', 'Reviewed') is accepted as 'In Review' rather than refused: the
 * only thing that still sends one is a browser left open on the old dropdown, and answering 400
 * there would be a dead screen rather than a corrected one.
 *
 * `isAssignee` is taken but deliberately grants nothing -- an assignee's report is their note. It
 * stays in the signature so the caller can be told *that*, instead of a bare "no permission".
 */
const resolveComplaintStatus = (body, { canClose = false, isAssignee = false } = {}) => {
  const raw = (body?.status || '').toString().trim().slice(0, 40);
  const decoded = decodeEntities(raw).trim();
  if (!decoded) return { error: 'Status is required' };
  const status = LEGACY_COMPLAINT_STATUSES[decoded] || decoded;
  if (!COMPLAINT_STATUSES.includes(status)) {
    return { error: `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}` };
  }
  const allowed = complaintStatusesFor({ canClose });
  if (!allowed.includes(status)) {
    return {
      forbidden: true,
      error: allowed.length
        ? `You may only set: ${allowed.join(', ')}`
        : isAssignee
          ? 'Save your notes instead — that moves the complaint to In Review for your franchise partner to verify and close.'
          : 'You do not have permission to change a complaint status.'
    };
  }
  return { error: null, status };
};

module.exports = {
  COMPLAINT_TABLE,
  COMPLAINT_COLUMNS,
  COMPLAINT_SELECT,
  COMPLAINT_STATUSES,
  LEGACY_COMPLAINT_STATUSES,
  normalizeComplaintStatus,
  ASSIGNABLE_ROLES,
  complaintSelect,
  CONCERN_OPTIONS,
  ensureMarketingComplaintsTable,
  parseComplaintBody,
  parseCustomerComplaintBody,
  parseComplaintNote,
  normalizeEmployeeRole,
  isAssignableRole,
  complaintStatusesFor,
  resolveComplaintStatus
};
