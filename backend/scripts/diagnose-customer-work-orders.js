/**
 * Why does this customer see these work orders?
 *
 * `customerWorkOrderScope` (routes/customers.js) claims a work order for a customer on any of
 * four grounds, OR'd together, and the portal shows no sign of which one fired:
 *
 *   1. wo.property_id = the property's row number
 *   2. wo.property_id = the property's code
 *   3. wo.resident_id = the customer_accounts.id
 *   4. wo.customer_email = the account's email
 *
 * Read-only. Prints the account, the property it resolves to, and every work order the scope
 * returns with the grounds each one matched on -- so a row that is not the customer's own can be
 * traced to the condition that let it through.
 *
 *   node scripts/diagnose-customer-work-orders.js GC-1793673531543
 *   node scripts/diagnose-customer-work-orders.js someone@example.com
 *
 * Takes a property code, a customer email, or a customer_accounts id.
 */
require('dotenv').config();
const { pool } = require('../config/database');

const needle = process.argv[2];

// The same resolution routes/customers.js does: the code is looked up before the number,
// because properties.id 5 and onboarded_properties.id 5 are different properties
const resolveProperty = async (storedId, storedCode) => {
  const lookups = [...new Set([storedCode, storedId]
    .filter(value => value !== null && value !== undefined && value !== '')
    .map(String))];
  for (const lookup of lookups) {
    const numeric = /^\d+$/.test(lookup) ? Number(lookup) : 0;
    for (const [table, idCol, nameCol] of [
      ['onboarded_properties', 'id', 'community_name'], ['properties', 'id', 'name']
    ]) {
      const [rows] = await pool.query(
        `SELECT ${idCol} AS id, property_id AS code, ${nameCol} AS name FROM ${table} WHERE ${idCol} = ? OR property_id = ?`,
        [numeric, lookup]
      );
      if (rows.length) return { ...rows[0], table };
    }
  }
  return { id: storedId, code: storedCode, name: null, table: '(unresolved)' };
};

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
      const property = await resolveProperty(account.property_id, account.property_code);
      console.log('\n' + '='.repeat(78));
      console.log(`ACCOUNT #${account.id}  ${account.email}  (${account.first_name || ''} ${account.last_name || ''})`.trim());
      console.log(`  created ${account.created_at} by ${account.created_by}, active=${account.is_active}, activated=${account.is_activated}`);
      console.log(`  stored property_id=${account.property_id}  property_code=${account.property_code}`);
      console.log(`  resolves to ${property.table} id=${property.id} code=${property.code} "${property.name}"`);
      console.log('='.repeat(78));

      const [rows] = await pool.query(
        `SELECT wo.id, wo.work_order_id, wo.property_id, wo.property_code, wo.resident_id,
                wo.customer_email, wo.property_name, wo.category_name, wo.status, wo.source,
                wo.created_at, wo.updated_at, wo.completed_at
         FROM work_orders wo
         WHERE wo.property_id = ? OR wo.property_id = ? OR wo.resident_id = ? OR LOWER(wo.customer_email) = LOWER(?)
         ORDER BY COALESCE(wo.completed_at, wo.updated_at, wo.created_at) DESC`,
        [property.id, property.code, account.id, account.email]
      );

      console.log(`\n${rows.length} work order(s) claimed by this account:\n`);
      for (const row of rows) {
        const grounds = [];
        if (String(row.property_id) === String(property.id)) grounds.push('1:number');
        if (String(row.property_id) === String(property.code)) grounds.push('2:code');
        if (row.resident_id !== null && String(row.resident_id) === String(account.id)) grounds.push('3:resident_id');
        if ((row.customer_email || '').toLowerCase() === (account.email || '').toLowerCase()) grounds.push('4:email');

        // Does the work order's own code say it belongs to someone else?
        const foreign = row.property_code && property.code && row.property_code !== property.code;
        const date = row.completed_at || row.updated_at || row.created_at;

        console.log(`  ${row.work_order_id}  ${String(row.status).padEnd(11)} ${new Date(date).toISOString().slice(0, 10)}  ${row.category_name || '-'}`);
        console.log(`    matched on: ${grounds.join(', ') || '(none -- check the query)'}`);
        console.log(`    wo.property_id=${row.property_id}  wo.property_code=${row.property_code ?? 'NULL'}  ` +
          `wo.resident_id=${row.resident_id ?? 'NULL'}  wo.customer_email=${row.customer_email ?? 'NULL'}`);
        console.log(`    wo.property_name="${row.property_name ?? '-'}"  source=${row.source ?? '-'}` +
          (foreign ? `   <-- BELONGS TO ${row.property_code}, NOT THIS CUSTOMER` : ''));
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
