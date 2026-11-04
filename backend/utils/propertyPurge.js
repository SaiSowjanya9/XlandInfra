const { pool } = require('../config/database');
const { ensureInvoiceColumns } = require('./invoiceColumns');
const { ensureClientColumns } = require('./clientPropertyLink');
const { propertyAccountScope } = require('./propertyAccountScope');

/**
 * Permanent delete of a customer (property) and everything attached to it.
 *
 * "Move to inactive" only flips `status`; the permanent delete is where the data
 * actually goes. The rules the route used to get wrong:
 *
 *   - Sections that have an archive move there instead of being deleted:
 *     `fp_estimates` (is_archived) and `invoices` (archived/archived_at).
 *   - `payments` (and their `payment_history` rows) are never deleted -- money
 *     records outlive the customer. They are only unlinked from the property.
 *   - Everything else is deleted: work orders, schedules, visits, vendor
 *     assignments, contacts, residents, units, customer accounts and clients.
 *
 * Which tables a bare `property_id` can reach is split the same way the rest of
 * the codebase splits it: the schedule stack is keyed to onboarded_properties.id
 * only, so it is purged only when the onboarded row is the one being deleted --
 * a legacy `properties` row sharing the same number must not take another
 * community's visits down with it. Tables that can hold either table's id
 * (estimates, invoices, work orders, payments, contacts, residents, units) are
 * matched on the property's unique code where a code column exists, and on the
 * bare number otherwise -- the same overreach the old unlink already accepted.
 *
 * The schedule stack's ON DELETE CASCADE only exists on onboarded_properties,
 * and `work_orders.property_id -> properties(id)` is RESTRICT, so children are
 * deleted BEFORE the property row -- the old order could leave the row alive
 * behind a silently swallowed FK error.
 */

const generateNotificationId = () =>
  `NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// The two tables a customer can live in. ?sourceTable= narrows to one so an id
// shared across both only touches the row the screen actually named.
const resolveSourceTables = (source) =>
  source === 'properties' || source === 'onboarded_properties' ? [source] : ['properties', 'onboarded_properties'];

/**
 * The customer's rows in the property tables: code (unique across both tables),
 * contact email, display name and owning partner. Deleting by code is the only
 * unambiguous scope available -- see utils/propertyAccountScope.js.
 */
const fetchPropertyRows = async (tables, id, fpId) => {
  const rows = [];
  const fpClause = fpId ? ' AND franchise_partner_id = ?' : '';
  const params = fpId ? [id, fpId] : [id];

  if (tables.includes('properties')) {
    try {
      const [r] = await pool.execute(
        `SELECT contact_email, property_id, name AS prop_name, franchise_partner_id
         FROM properties WHERE id = ?${fpClause}`, params);
      if (r.length) rows.push({ table: 'properties', code: r[0].property_id, email: r[0].contact_email, name: r[0].prop_name, fpId: r[0].franchise_partner_id });
    } catch (e) {}
  }
  if (tables.includes('onboarded_properties')) {
    try {
      const [r] = await pool.execute(
        `SELECT contact_email, property_id, community_name AS prop_name, franchise_partner_id
         FROM onboarded_properties WHERE id = ?${fpClause}`, params);
      if (r.length) rows.push({ table: 'onboarded_properties', code: r[0].property_id, email: r[0].contact_email, name: r[0].prop_name, fpId: r[0].franchise_partner_id });
    } catch (e) {}
  }
  return rows;
};

// `property_id = ?` OR (where a code column exists and a code is known) the
// unique code -- the pair keeps a shared row number from reaching the wrong
// property while still catching rows that only ever stored the code.
const propertyMatch = (code, codeCol = 'property_code') =>
  code ? `(property_id = ? OR ${codeCol} = ?)` : `property_id = ?`;
const matchParams = (id, code) => (code ? [id, code] : [id]);

/**
 * Live records a permanent delete will still find. Everything counted here is
 * "the customer is not done with us" -- money owed, visits on the calendar,
 * payments awaiting verification, open work orders -- and drives both the
 * warning the deleting employee sees and the notification written afterwards.
 */
const getDeleteImpact = async (id, code, { onboarded = true } = {}) => {
  const impact = {
    activeInvoices: 0, outstandingAmount: 0, pendingPayments: 0,
    upcomingVisits: 0, activeSchedules: 0, openWorkOrders: 0, estimates: 0
  };

  const count = async (sql, params, fields) => {
    try {
      const [r] = await pool.execute(sql, params);
      fields.forEach(([key, col]) => { impact[key] += Number(r[0]?.[col]) || 0; });
    } catch (e) {}
  };

  const invoiceCols = await ensureInvoiceColumns();
  const archivedClause = invoiceCols.has('archived') ? 'AND COALESCE(archived, 0) = 0' : '';
  await count(
    `SELECT COUNT(*) AS c, COALESCE(SUM(balance_amount), 0) AS s FROM invoices
     WHERE ${propertyMatch(code)} ${archivedClause}
       AND status <> 'cancelled' AND balance_amount > 0`,
    matchParams(id, code), [['activeInvoices', 'c'], ['outstandingAmount', 's']]);

  await count(
    `SELECT COUNT(*) AS c FROM payments
     WHERE property_id = ? AND status = 'verification_pending'`,
    [id], [['pendingPayments', 'c']]);

  // The schedule stack is keyed to onboarded_properties.id only; a legacy
  // `properties` row sharing the number would warn about another property's
  // visits, so those counts apply only to an onboarded delete
  if (onboarded) {
    await count(
      `SELECT COUNT(*) AS c FROM scheduled_visits
       WHERE property_id = ? AND status IN ('scheduled', 'confirmed')`,
      [id], [['upcomingVisits', 'c']]);

    await count(
      `SELECT COUNT(*) AS c FROM property_service_schedules
       WHERE property_id = ? AND status NOT IN ('completed', 'cancelled')`,
      [id], [['activeSchedules', 'c']]);
  }

  // work_orders.property_code only exists once schema_v62 has applied; fall
  // back to the bare id where it has not
  try {
    const [r] = await pool.execute(
      `SELECT COUNT(*) AS c FROM work_orders
       WHERE ${propertyMatch(code)} AND status NOT IN ('completed', 'closed', 'cancelled')`,
      matchParams(id, code));
    impact.openWorkOrders = Number(r[0]?.c) || 0;
  } catch (e) {
    await count(
      `SELECT COUNT(*) AS c FROM work_orders
       WHERE property_id = ? AND status NOT IN ('completed', 'closed', 'cancelled')`,
      [id], [['openWorkOrders', 'c']]);
  }

  await count(
    `SELECT COUNT(*) AS c FROM fp_estimates
     WHERE property_id = ? AND COALESCE(is_archived, 0) = 0`,
    [id], [['estimates', 'c']]);

  return impact;
};

const hasLiveRecords = (impact) =>
  impact.activeInvoices > 0 || impact.pendingPayments > 0 ||
  impact.upcomingVisits > 0 || impact.activeSchedules > 0 || impact.openWorkOrders > 0;

/**
 * Remove or archive every record the customer left behind. Returns a summary
 * of affected rows per step; a step that cannot run (missing table/column on a
 * drifted deployment) logs and continues, matching the route's existing style.
 */
const purgePropertyRecords = async ({ tables, id, code, scopedRows, fpId }) => {
  // FP deletes keep the same partner scope the old unlinks had, so a shared row
  // number can never reach another partner's money or work records
  const fp = (sql, params) =>
    fpId ? [`${sql} AND franchise_partner_id = ?`, [...params, fpId]] : [sql, params];
  const summary = {};
  const step = async (key, sql, params) => {
    try {
      const [r] = await pool.execute(sql, params);
      summary[key] = r.affectedRows || 0;
      if (r.affectedRows > 0) console.log(`📋 [propertyPurge] ${key}:`, r.affectedRows);
    } catch (e) {
      summary[key] = 0;
      console.log(`[propertyPurge] ${key} skipped:`, e.message);
    }
  };

  // Logins and client rows, scoped to this property's account only
  try {
    const scope = propertyAccountScope(scopedRows, id);
    if (scope.params.length) await step('customerAccounts', `DELETE FROM customer_accounts WHERE ${scope.sql}`, scope.params);
  } catch (e) {}
  try {
    const hasCodeCol = (await ensureClientColumns()).has('property_code');
    const scope = propertyAccountScope(scopedRows, id, { codeColumn: hasCodeCol });
    if (scope.params.length) await step('clients', `DELETE FROM clients WHERE ${scope.sql}`, scope.params);
  } catch (e) {}

  // Sections with an archive move there, they are not deleted
  await step('estimatesArchived',
    ...fp(`UPDATE fp_estimates SET is_archived = 1, archived_at = NOW() WHERE property_id = ?`, [id]));

  const invoiceCols = await ensureInvoiceColumns();
  if (invoiceCols.has('archived')) {
    await step('invoicesArchived',
      ...fp(`UPDATE invoices SET archived = 1, archived_at = NOW(), property_id = NULL WHERE ${propertyMatch(code)}`,
        matchParams(id, code)));
  } else {
    await step('invoicesUnlinked',
      ...fp(`UPDATE invoices SET property_id = NULL WHERE ${propertyMatch(code)}`,
        matchParams(id, code)));
  }

  // Payment history is the one record that must survive: keep the rows, drop
  // only the property link so the property row itself can go.
  await step('paymentsUnlinked',
    ...fp(`UPDATE payments SET property_id = NULL WHERE property_id = ?`, [id]));

  // Work orders go entirely (attachments/history follow on their FK cascade)
  try {
    const [r] = await pool.execute(
      ...fp(`DELETE FROM work_orders WHERE ${propertyMatch(code)}`, matchParams(id, code)));
    summary.workOrders = r.affectedRows || 0;
    if (r.affectedRows > 0) console.log('📋 [propertyPurge] workOrders:', r.affectedRows);
  } catch (e) {
    await step('workOrders', ...fp(`DELETE FROM work_orders WHERE property_id = ?`, [id]));
  }

  // The schedule stack is keyed to onboarded_properties.id only -- purge it
  // only when that row is the one being deleted
  if (tables.includes('onboarded_properties')) {
    await step('scheduleOccurrences',
      `DELETE so FROM schedule_occurrences so
       JOIN schedule_series ss ON so.series_id = ss.id WHERE ss.property_id = ?`, [id]);
    await step('scheduleRenewals',
      `DELETE FROM schedule_renewals WHERE property_id = ?`, [id]);
    await step('renewalSettings',
      `DELETE FROM property_renewal_settings WHERE property_id = ?`, [id]);
    await step('scheduleSeries',
      `DELETE FROM schedule_series WHERE property_id = ?`, [id]);
    await step('scheduledVisits',
      `DELETE FROM scheduled_visits WHERE property_id = ?`, [id]);
    await step('serviceSchedules',
      `DELETE FROM property_service_schedules WHERE property_id = ?`, [id]);
    await step('pendingSchedules',
      `DELETE FROM pending_property_schedules WHERE property_id = ?`, [id]);
    await step('vendorAssignments',
      `DELETE FROM property_vendor_assignments WHERE property_id = ?`, [id]);
  }

  // Contacts, residents and units can carry either table's row number
  await step('propertyContacts', `DELETE FROM property_contacts WHERE property_id = ?`, [id]);
  await step('residents', `DELETE FROM residents WHERE property_id = ?`, [id]);
  await step('units', `DELETE FROM units WHERE property_id = ?`, [id]);

  // Stale bell entries that would otherwise point at a deleted customer
  await step('notifications',
    `DELETE FROM portal_notifications WHERE reference_type = 'property' AND reference_id = ?`, [id]);

  return summary;
};

/**
 * In-portal heads-up that a customer with live records was permanently
 * deleted. One row for the admin bell (it reads every notification) and one
 * scoped to the owning partner's bell; nothing is written when the customer
 * had no live records.
 */
const notifyPermanentDelete = async ({ propertyCode, propertyName, impact, actorName, fpId }) => {
  if (!hasLiveRecords(impact)) return;

  const parts = [];
  if (impact.activeInvoices > 0) parts.push(`${impact.activeInvoices} unpaid invoice(s) — ₹${Number(impact.outstandingAmount || 0).toLocaleString('en-IN')} outstanding`);
  if (impact.pendingPayments > 0) parts.push(`${impact.pendingPayments} payment(s) awaiting verification`);
  if (impact.upcomingVisits > 0) parts.push(`${impact.upcomingVisits} upcoming visit(s)`);
  if (impact.activeSchedules > 0) parts.push(`${impact.activeSchedules} active service schedule(s)`);
  if (impact.openWorkOrders > 0) parts.push(`${impact.openWorkOrders} open work order(s)`);

  const title = `Permanent delete: ${propertyName || 'customer'} (${propertyCode || 'no code'})`;
  const message =
    `${title} was permanently deleted by ${actorName} while it still had ${parts.join(', ')}. ` +
    `Estimates and invoices were moved to archive; payment history is preserved.`;

  const insert = (roleType, targetFpId) => pool.execute(
    `INSERT INTO portal_notifications
     (notification_id, franchise_partner_id, user_id, role_type, type, title, message,
      reference_type, reference_id, reference_data, action_url, action_label, priority)
     VALUES (?, ?, NULL, ?, 'alert', ?, ?, 'customer_delete', NULL, ?, NULL, NULL, 'high')`,
    [generateNotificationId(), targetFpId, roleType, title, message,
     JSON.stringify({ propertyCode, propertyName, impact })]);

  try { await insert('admin', null); } catch (e) { console.log('[propertyPurge] admin notification skipped:', e.message); }
  if (fpId) {
    try { await insert('fp', fpId); } catch (e) { console.log('[propertyPurge] fp notification skipped:', e.message); }
  }
};

module.exports = {
  resolveSourceTables,
  fetchPropertyRows,
  getDeleteImpact,
  hasLiveRecords,
  purgePropertyRecords,
  notifyPermanentDelete
};
