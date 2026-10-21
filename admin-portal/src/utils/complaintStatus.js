/**
 * The complaint workflow, as the shared Complaint Form screen sees it.
 *
 *   Open -> Assigned -> In Review -> Closed
 *
 * This mirrors `backend/utils/marketingComplaints.js`, which is the authority: it refuses anything
 * these rules would have hidden, whatever a screen renders. The copy exists so a portal shows the
 * statuses its caller can actually set, rather than a dropdown of options that answer 403.
 * `complaintStatus.test.js` compares the two, so they cannot drift.
 *
 * Who may set what:
 *   the FP and its manager       everything except 'Assigned'
 *   everyone else, assignee      nothing; the status reads as a badge
 *
 * **The assignee has no status at all**, which is the point: they report by saving their note and
 * the server moves the row to In Review in the same write. An employee who could also set the
 * status could mark their own work reviewed, and the step exists so that somebody else looks.
 *
 * Nobody sets 'Assigned' by hand either: assigning a complaint is what produces it, so offering it
 * would let a row claim an assignee nobody chose.
 */

export const COMPLAINT_STATUSES = ['Open', 'Assigned', 'In Review', 'Closed'];

/**
 * The two statuses In Review replaced. The server normalises stored rows on the way out
 * (schema_v54), so these only reach a screen on a tab left open across the change -- but a row
 * whose badge fell back to 'Open' would read as if the work had never started.
 */
const RETIRED_STATUSES = { 'In Progress': 'In Review', Reviewed: 'In Review' };

/** A stored status as one of COMPLAINT_STATUSES. Blank is 'Open': schema_v47 had no column. */
export const normalizeComplaintStatus = (status) => {
  const value = String(status || '').trim();
  if (RETIRED_STATUSES[value]) return RETIRED_STATUSES[value];
  return COMPLAINT_STATUSES.includes(value) ? value : 'Open';
};

/** The statuses this caller may select, in workflow order. Empty means read-only. */
export const complaintStatusesFor = ({ canClose = false } = {}) => {
  if (canClose) return COMPLAINT_STATUSES.filter((status) => status !== 'Assigned');
  return [];
};

/**
 * The note is the assignee's report of what they did, so they may write it in portals that are
 * read-only everywhere else; the FP, its manager and the admin read it and may add to it when they
 * verify. `assigned_to_me` is stamped on the row by the server -- the browser cannot work out which
 * fp_employees row the caller is.
 */
export const canNoteOnComplaint = (complaint, { canEdit = false } = {}) => (
  !!canEdit || !!complaint?.assigned_to_me
);

// Status tints stay semantic: they are how a state is read at a glance, which is why the warm
// skin's single accent does not apply to them (see AGENTS.md, Warm Beige UI System).
const STATUS_STYLES = {
  Open: 'bg-gray-50 text-gray-600 border-gray-200',
  Assigned: 'bg-warm-info text-blue-700 border-[#D5E3FA]',
  'In Review': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export const complaintStatusStyle = (status) => (
  STATUS_STYLES[normalizeComplaintStatus(status)]
);
