/**
 * Marketing is one set of screens served to three portals: the FP portal, the admin portal
 * (/employee) and the Ops Manager portal (/manager). The pages are shared, so the only thing that
 * differs is the API prefix and -- for the admin, who sees every franchise partner at once -- the
 * partner the request is narrowed to.
 *
 * The backend mounts the same router at all three prefixes (backend/routes/marketing.js), so a
 * path that works for one portal works for the others.
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
  manager: 'manager'
};

export const getMarketingApiPath = (portalType) => PORTAL_API_PATHS[portalType] || 'fp';

export const getMarketingBasePath = (portalType) => {
  if (portalType === 'manager') return '/manager';
  if (portalType === 'employee' || portalType === 'admin') return '/employee';
  return '/fp';
};

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
