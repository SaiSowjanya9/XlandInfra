/**
 * Marketing is one set of screens served to six portals: the FP portal, the admin portal
 * (/employee), the Ops Manager portal (/manager), and -- read-only -- the coordinator, supervisor
 * and executive portals. The pages are shared, so what differs per portal is the API prefix, the
 * partner a request is narrowed to (the admin sees every franchise partner at once) and how much
 * of a row the caller may change.
 *
 * The **supervisor portal has the Complaint Form and nothing else of Marketing** -- no tracker, no
 * marketing dashboard. Complaints are assigned to supervisors as they are to coordinators, so the
 * screen has to be there; the partner's lead pipeline is none of a supervisor's business, and its
 * backend mount refuses those reads outright (`canReadTracker: false`) rather than trusting the
 * sidebar not to link them.
 *
 * The backend mounts the same router at every prefix (backend/routes/marketing.js), so a path that
 * works for one portal works for the others, and each mount's own scope decides what it answers.
 *
 * Regression test: node --test admin-portal/src/utils/marketingApi.test.js
 */

const PORTAL_API_PATHS = {
  franchise: 'fp',
  fp: 'fp',
  // The admin portal's routes live under /employee but its API prefix is /api/admin, the same
  // split the schedules and work-order screens already make.
  employee: 'admin',
  admin: 'admin',
  manager: 'manager',
  coordinator: 'coordinator',
  supervisor: 'supervisor',
  executive: 'executive'
};

export const getMarketingApiPath = (portalType) => PORTAL_API_PATHS[portalType] || 'fp';

const PORTAL_BASE_PATHS = {
  manager: '/manager',
  employee: '/employee',
  admin: '/employee',
  coordinator: '/coordinator',
  supervisor: '/supervisor',
  executive: '/executive'
};

export const getMarketingBasePath = (portalType) => PORTAL_BASE_PATHS[portalType] || '/fp';

/**
 * What this portal may change, mirroring each backend mount's scope. The server is the authority --
 * it refuses the rest with a 403 whatever the page renders -- but a screen full of controls that
 * all fail is worse than one that shows the row as read-only.
 *
 *   canEdit    the tracker's fields, complaints, archiving and restoring
 *   canReview  Coordinator Reviewed only; setting it to Yes records the reviewer's name
 *   canAssign  hand a complaint to one of the partner's zone-centric employees
 *   canClose   verify a complaint and close it, which also moves it to Archived
 *
 * Assigning is the franchise partner's own decision, and closing is the review the FP and its
 * manager perform -- which is why the admin portal, although it may create and edit complaints,
 * does neither. A coordinator or executive may still report on a complaint assigned to *them*:
 * that is per row, not per portal, so it rides on `assigned_to_me` rather than here.
 */
const DEFAULT_PERMISSIONS = { canEdit: true, canReview: true, canAssign: false, canClose: false };

const PORTAL_PERMISSIONS = {
  franchise: { ...DEFAULT_PERMISSIONS, canAssign: true, canClose: true },
  fp: { ...DEFAULT_PERMISSIONS, canAssign: true, canClose: true },
  manager: { ...DEFAULT_PERMISSIONS, canClose: true },
  coordinator: { canEdit: false, canReview: true, canAssign: false, canClose: false },
  // The supervisor reads the same Complaint Form and reports on its own assignments, exactly as the
  // executive does; neither reviews a lead, because neither sees the tracker.
  supervisor: { canEdit: false, canReview: false, canAssign: false, canClose: false },
  executive: { canEdit: false, canReview: false, canAssign: false, canClose: false }
};

export const marketingPermissions = (portalType) => (
  PORTAL_PERMISSIONS[portalType] || DEFAULT_PERMISSIONS
);

/**
 * Whether this portal sees the lead pipeline at all — the Dashboard, the Tracker, and the Tracker
 * Entries tab of Archived.
 *
 * The supervisor portal does not: it has the Complaint Form because complaints are assigned to
 * supervisors, and nothing else of Marketing. Its backend mount answers 403 to the tracker reads
 * (`canReadTracker: false`), so a screen that asked anyway would show an error where a tab should
 * be — this is what keeps the two in step.
 */
export const marketingHasTracker = (portalType) => portalType !== 'supervisor';

/**
 * The franchise partner an admin request is scoped to, or null for "every partner".
 *
 * Only the admin portal has a partner picker; 'all' is what FPContext stores for Admin (All FPs),
 * and both that and no selection at all mean every partner, so neither sends the parameter. The
 * other portals are scoped by their own token and must never send one -- an FP that asked for
 * another partner's leads would be refused, but it should not be asking.
 */
export const marketingFpId = (portalType, selectedFp) => {
  if (getMarketingApiPath(portalType) !== 'admin') return null;
  const id = selectedFp?.id;
  if (id === undefined || id === null || id === '' || id === 'all') return null;
  const numeric = Number(id);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

/** Append ?fpId= (or &fpId=) only when there is a partner to narrow to. */
export const withMarketingFp = (url, fpId) => (
  fpId ? `${url}${url.includes('?') ? '&' : '?'}fpId=${fpId}` : url
);

/**
 * A complaint belongs to exactly one partner, so the admin has to have picked one before the form
 * can be saved -- the column is NOT NULL and the server answers 400 without it. The FP and Manager
 * portals carry their partner on the token, so they are always ready.
 */
export const canLogComplaint = (portalType, selectedFp) => (
  getMarketingApiPath(portalType) !== 'admin' || marketingFpId(portalType, selectedFp) !== null
);
