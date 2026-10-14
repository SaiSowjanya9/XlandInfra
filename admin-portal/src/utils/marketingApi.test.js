import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMarketingApiPath, getMarketingBasePath, marketingFpId, withMarketingFp, canLogComplaint,
  marketingPermissions
} from './marketingApi.js';

test('every portal that shows Marketing resolves to its own API prefix', () => {
  assert.equal(getMarketingApiPath('franchise'), 'fp');
  assert.equal(getMarketingApiPath('fp'), 'fp');
  assert.equal(getMarketingApiPath('manager'), 'manager');
  // The admin portal's routes live under /employee but its API prefix is /api/admin.
  assert.equal(getMarketingApiPath('admin'), 'admin');
  assert.equal(getMarketingApiPath('employee'), 'admin');
  // The coordinator and executive portals read the same screens; their own mounts decide what
  // they answer and what they will not write.
  assert.equal(getMarketingApiPath('coordinator'), 'coordinator');
  assert.equal(getMarketingApiPath('executive'), 'executive');
  // An unknown portal falls back to the FP prefix, which is scoped by the caller's own token --
  // never to the admin prefix, which would be the one that shows every partner's leads.
  assert.equal(getMarketingApiPath(undefined), 'fp');
  assert.equal(getMarketingApiPath('supervisor'), 'fp', 'the supervisor portal has no Marketing');
});

test('only the portals that own the records may change them', () => {
  for (const portal of ['franchise', 'fp', 'admin', 'employee', 'manager']) {
    assert.deepEqual(marketingPermissions(portal), { canEdit: true, canReview: true }, portal);
  }
  // The coordinator's one write is the review -- setting it to Yes records their name, which is
  // what that column is for.
  assert.deepEqual(marketingPermissions('coordinator'), { canEdit: false, canReview: true });
  assert.deepEqual(marketingPermissions('executive'), { canEdit: false, canReview: false });
  // An unknown portal is never silently given write access it was not granted... except that the
  // default is the FP portal's own, which is scoped to the caller's token either way.
  assert.deepEqual(marketingPermissions(undefined), { canEdit: true, canReview: true });
});

test('navigation base path follows the portal, not the API prefix', () => {
  assert.equal(getMarketingBasePath('franchise'), '/fp');
  assert.equal(getMarketingBasePath('manager'), '/manager');
  assert.equal(getMarketingBasePath('admin'), '/employee');
  assert.equal(getMarketingBasePath('employee'), '/employee');
});

test('only the admin narrows to one partner, and only when one is picked', () => {
  // 'all' is what FPContext stores for Admin (All FPs); it and an absent selection both mean
  // every partner, so neither may send an fpId.
  assert.equal(marketingFpId('admin', { id: 'all' }), null);
  assert.equal(marketingFpId('admin', null), null);
  assert.equal(marketingFpId('admin', {}), null);
  assert.equal(marketingFpId('admin', { id: '' }), null);
  assert.equal(marketingFpId('admin', { id: 9 }), 9);
  assert.equal(marketingFpId('admin', { id: '9' }), 9);
  assert.equal(marketingFpId('employee', { id: 9 }), 9);

  // An FP or a manager is scoped by its token. Sending a partner id from those portals would be
  // asking for somebody else's rows, so the helper refuses to build one even if a stale selection
  // is lying around in the context.
  assert.equal(marketingFpId('franchise', { id: 9 }), null);
  assert.equal(marketingFpId('manager', { id: 9 }), null);

  // Junk never becomes a filter: it would silently widen the request to every partner.
  assert.equal(marketingFpId('admin', { id: 'abc' }), null);
  assert.equal(marketingFpId('admin', { id: -3 }), null);
  assert.equal(marketingFpId('admin', { id: 0 }), null);
});

test('the fpId is appended with the right separator, or not at all', () => {
  assert.equal(withMarketingFp('/api/admin/marketing/tracker', 9), '/api/admin/marketing/tracker?fpId=9');
  assert.equal(
    withMarketingFp('/api/admin/marketing/complaints?includeArchived=true', 9),
    '/api/admin/marketing/complaints?includeArchived=true&fpId=9'
  );
  assert.equal(withMarketingFp('/api/fp/marketing/tracker', null), '/api/fp/marketing/tracker');
});

test('a complaint can only be logged once its owning partner is known', () => {
  // The column is NOT NULL and the server answers 400 without it, so the form has to wait for the
  // admin to pick a partner rather than offering a Save that cannot succeed.
  assert.equal(canLogComplaint('admin', { id: 'all' }), false);
  assert.equal(canLogComplaint('admin', null), false);
  assert.equal(canLogComplaint('admin', { id: 9 }), true);
  // The other portals carry their partner on the token.
  assert.equal(canLogComplaint('franchise', null), true);
  assert.equal(canLogComplaint('manager', null), true);
});
