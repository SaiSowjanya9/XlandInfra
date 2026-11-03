/**
 * Why does this customer see these work orders -- and why not the others?
 *
 * `customerWorkOrderScope` (routes/customers.js) claims a work order on four grounds, OR'd, and
 * the portal shows no sign of which one fired:
 *
 *   1. wo.property_id   = the property's row number
 *   2. wo.property_id   = the property's code        (some writers put the code there)
 *   2c. wo.property_code = the property's code       (schema_v62, the unambiguous one)
 *   3. wo.resident_id   = the customer_accounts.id   } identity grounds: bounded by the
 *   4. wo.customer_email = the account's email       } account's own lifetime
 *
 * **The live scope is imported, never reimplemented here.** An earlier version of this script
 * carried its own copy of the four grounds as a flat OR; once the identity grounds gained their
 * lifetime bound the copy went stale and the script reported a leak that had already been fixed,
 * contradicting `audit-customer-work-order-scope.js` on the same database. A diagnostic that can
 * disagree with the code it diagnoses is worse than no diagnostic.
 *
 * Every candidate is listed -- anything that matches a ground at all -- and marked CLAIMED or
 * EXCLUDED according to the rule the portal actually runs, with the grounds it matched on. So a
 * row the customer should not see can be traced to the ground that let it through, and a row they
 * expect but cannot see can be traced to the one that is missing.
 *
 * Read-only; writes nothing.
 *
 *   node scripts/diagnose-customer-work-orders.js GC-1793673531543
 *   node scripts/diagnose-customer-work-orders.js someone@example.com
 *   node scripts/diagnose-customer-work-orders.js 52
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { customerWorkOrderScope, resolveCustomerProperty } = require('../routes/customers');

const needle = process.argv[2];

// Which table holds the property -- display only; the resolution itself is the route's own
const propertyTable = async (code) => {
  if (!code) return '(unresolved)';
  for (const table of ['onboarded_properties', 'properties']) {
    const [rows] = await pool.query(`SELECT 1 FROM ${table} WHERE property_id = ? LIMIT 1`, [code]);
    if (rows.length) return table;
  }
  return '(unresolved)';
};

const SELECT = `SELECT wo.id, wo.work_order_id, wo.property_id, wo.property_code, wo.resident_id,
         wo.customer_email, wo.property_name, wo.category_name, wo.status, wo.source,
         wo.created_at, wo.updated_at, wo.completed_at
  FROM work_orders wo`;

(async () => {
  try {
    if (!needle) {
      console.error('Usage: node scripts/diagnose-customer-work-orders.js <property code | email | account id>');
      process.exitCode = 1;
      return;
    }

    const [accounts] = await pool.query(
      `SELECT id, customer_id, email, first_name, last_name, property_id, property_code, property_name,
              is_active, is_activated, created_by, created_at
       FROM customer_accounts
       WHERE property_code = ? OR LOWER(email) = LOWER(?) OR id = ?`,
      [needle, needle, /^\d+$/.test(needle) ? Number(needle) : 0]
    );

    if (!accounts.length) {
      console.log(`No customer account matches "${needle}".`);
      return;
    }

    for (const account of accounts) {
      const { numericPropertyId, propertyCode, propertyName } = await resolveCustomerProperty(
        account.property_id, account.property_code, account.property_name
      );
      const table = await propertyTable(propertyCode);

      console.log('\n' + '='.repeat(78));
      console.log(`ACCOUNT #${account.id}  ${account.email}  (${`${account.first_name || ''} ${account.last_name || ''}`.trim()})`);
      console.log(`  created ${account.created_at} by ${account.created_by}, active=${account.is_active}, activated=${account.is_activated}`);
      console.log(`  stored property_id=${account.property_id}  property_code=${account.property_code}`);
      console.log(`  resolves to ${table} id=${numericPropertyId} code=${propertyCode} "${propertyName}"`);
      console.log('='.repeat(78));

      // What the portal actually returns
      const scope = await customerWorkOrderScope({
        numericPropertyId, propertyCode, customerId: account.id,
        email: account.email, accountCreatedAt: account.created_at
      });
      const [claimedRows] = scope.sql === '1=0'
        ? [[]]
        : await pool.query(`${SELECT} WHERE ${scope.sql}`, scope.params);
      const claimed = new Set(claimedRows.map(row => row.id));

      // Anything that touches a ground at all, so an exclusion can be explained too
      const [candidates] = await pool.query(
        `${SELECT} WHERE wo.property_id = ? OR wo.property_id = ? OR wo.property_code = ?
           OR wo.resident_id = ? OR LOWER(wo.customer_email) = LOWER(?)
         ORDER BY COALESCE(wo.completed_at, wo.updated_at, wo.created_at) DESC`,
        [numericPropertyId, propertyCode, propertyCode, account.id, account.email]
      );

      console.log(`\n${claimed.size} work order(s) shown to this customer; ` +
        `${candidates.length - claimed.size} other(s) touch a ground but are excluded:\n`);

      for (const row of candidates) {
        const grounds = [];
        if (String(row.property_id) === String(numericPropertyId)) grounds.push('1:number');
        if (String(row.property_id) === String(propertyCode)) grounds.push('2:code-in-property_id');
        if (row.property_code && String(row.property_code) === String(propertyCode)) grounds.push('2c:property_code');
        if (row.resident_id !== null && String(row.resident_id) === String(account.id)) grounds.push('3:resident_id');
        if ((row.customer_email || '').toLowerCase() === (account.email || '').toLowerCase()) grounds.push('4:email');

        const isClaimed = claimed.has(row.id);
        const foreign = row.property_code && propertyCode && row.property_code !== propertyCode;
        const predates = new Date(row.created_at) < new Date(account.created_at);
        const date = row.completed_at || row.updated_at || row.created_at;

        console.log(`  ${isClaimed ? 'CLAIMED ' : 'excluded'}  ${row.work_order_id}  ${String(row.status).padEnd(10)} ` +
          `${new Date(date).toISOString().slice(0, 10)}  ${row.category_name || '-'}`);
        console.log(`    grounds: ${grounds.join(', ') || '(none)'}` +
          (!isClaimed && grounds.length ? '   -- matched, but the live rule does not claim it' : ''));
        console.log(`    wo.property_id=${row.property_id ?? 'NULL'}  wo.property_code=${row.property_code ?? 'NULL'}  ` +
          `wo.resident_id=${row.resident_id ?? 'NULL'}  wo.customer_email=${row.customer_email ?? 'NULL'}`);
        console.log(`    wo.property_name="${row.property_name ?? '-'}"  source=${row.source ?? '-'}  ` +
          `raised ${new Date(row.created_at).toISOString().slice(0, 10)}${predates ? ' (before this account existed)' : ''}` +
          (foreign ? `\n    BELONGS TO ${row.property_code}, NOT THIS CUSTOMER` : ''));
        console.log('');
      }
    }
  } catch (error) {
    console.error('Diagnosis failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
