/**
 * Marketing is one set of screens served to five portals: the FP portal, the admin portal
 * (/employee), the Ops Manager portal (/manager), and -- read-only -- the coordinator and
 * executive portals. The pages are shared, so what differs per portal is the API prefix, the
 * partner a request is narrowed to (the admin sees every franchise partner at once) and how much
 * of a row the caller may change.
 *
 * The supervisor portal has no Marketing section, deliberately: there is no mount for it in the
 * backend and no nav entry for it here.
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
  executive: 'executive'
};

export const getMarketingApiPath = (portalType) => PORTAL_API_PATHS[portalType] || 'fp';

const PORTAL_BASE_PATHS = {
  manager: '/manager',
  employee: '/employee',
  admin: '/employee',
  coordinator: '/coordinator',
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
 */
const PORTAL_PERMISSIONS = {
  coordinator: { canEdit: false, canReview: true },
  executive: { canEdit: false, canReview: false }
};

export const marketingPermissions = (portalType) => (
  PORTAL_PERMISSIONS[portalType] || { canEdit: true, canReview: true }
);

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
