/**
 * The complaint workflow, as the shared Complaint Form screen sees it.
 *
 *   Open -> Assigned -> In Progress -> Reviewed -> Closed
 *
 * This mirrors `backend/utils/marketingComplaints.js`, which is the authority: it refuses anything
 * these rules would have hidden, whatever a screen renders. The copy exists so a portal shows the
 * statuses its caller can actually set, rather than a dropdown of options that answer 403.
 * `complaintStatus.test.js` compares the two, so they cannot drift.
 *
 * Who may set what:
 *   the assignee                 'In Progress' only -- they report progress, they do not sign it off
 *   the FP and its manager       everything except 'Assigned'
 *   everyone else                nothing; the status reads as a badge
 *
 * Nobody sets 'Assigned' by hand: assigning a complaint is what produces it, so offering it would
 * let a row claim an assignee nobody chose.
 */

export const COMPLAINT_STATUSES = ['Open', 'Assigned', 'In Progress', 'Reviewed', 'Closed'];

/** The statuses this caller may select, in workflow order. Empty means read-only. */
export const complaintStatusesFor = ({ canClose = false, isAssignee = false } = {}) => {
  if (canClose) return COMPLAINT_STATUSES.filter((status) => status !== 'Assigned');
  if (isAssignee) return ['In Progress'];
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
  'In Progress': 'bg-warm-warning text-amber-700 border-[#F3E2B3]',
  Reviewed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200'
};

export const complaintStatusStyle = (status) => (
  STATUS_STYLES[status] || STATUS_STYLES.Open
);
