/**
 * What the identity lifetime bound changes, for every existing customer, before you trust it.
 *
 * `customerWorkOrderScope` used to claim a work order on a bare `customer_email` or `resident_id`
 * match. Both identifiers can be reused — an email is freed by permanently deleting its customer,
 * and `resident_id` began as a foreign key to the legacy `residents` table — so those grounds are
 * now confined to the account's own lifetime. A property ground is unchanged: a place keeps its
 * history.
 *
 * That is a narrowing, so it can only ever *remove* rows from a customer's view. This reports
 * exactly which, per account, and sorts them into:
 *
 *   belongs elsewhere   the row names a property, and it is not this customer's. Correctly
 *                       dropped — it was another household's request all along.
 *   orphan now hidden   the row names no property at all, so no other ground can find it, and it
 *                       predates the account. **These are the ones to look at**: either the email
 *                       belonged to someone else before (drop it) or the work order lost its
 *                       property reference and should be re-pointed at one.
 *   review              anything that fits neither description.
 *
 * Read-only; writes nothing. Run it after deploying and before you consider the matter closed.
 *
 *   node scripts/audit-customer-work-order-scope.js
 *   node scripts/audit-customer-work-order-scope.js --verbose   # list every account, not just changes
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { customerWorkOrderScope, resolveCustomerProperty } = require('../routes/customers');

const verbose = process.argv.includes('--verbose');

// The rule as it stood before the lifetime bound, so the two can be compared on real rows
const previousScope = ({ numericPropertyId, propertyCode, customerId, email }) => {
  const conditions = [];
  const params = [];
  if (numericPropertyId) { conditions.push('wo.property_id = ?'); params.push(numericPropertyId); }
  if (propertyCode && propertyCode !== numericPropertyId) { conditions.push('wo.property_id = ?'); params.push(propertyCode); }
  if (customerId) { conditions.push('wo.resident_id = ?'); params.push(customerId); }
  if (email) { conditions.push('LOWER(wo.customer_email) = LOWER(?)'); params.push(email); }
  return { sql: conditions.length ? `(${conditions.join(' OR ')})` : '1=0', params };
};

const claimed = async (scope) => {
  if (scope.sql === '1=0') return [];
  const [rows] = await pool.query(
    `SELECT wo.id, wo.work_order_id, wo.property_id, wo.property_code, wo.resident_id,
            wo.customer_email, wo.property_name, wo.status, wo.source, wo.created_at
     FROM work_orders wo WHERE ${scope.sql}`,
    scope.params
  );
  return rows;
};

const has = value => value !== null && value !== undefined && String(value).trim() !== '';

(async () => {
  try {
    const [accounts] = await pool.query(
      `SELECT id, email, first_name, last_name, property_id, property_code, property_name, created_at
       FROM customer_accounts WHERE is_active = 1 ORDER BY id`
    );

    const tally = { accounts: accounts.length, changed: 0, elsewhere: 0, orphan: 0, review: 0 };
    const orphans = [];

    for (const account of accounts) {
      const property = await resolveCustomerProperty(
        account.property_id, account.property_code, account.property_name
      );
      const before = await claimed(previousScope({ ...property, customerId: account.id, email: account.email }));
      const after = await claimed(await customerWorkOrderScope({
        ...property, customerId: account.id, email: account.email, accountCreatedAt: account.created_at
      }));

      const kept = new Set(after.map(row => row.id));
      const dropped = before.filter(row => !kept.has(row.id));

      if (!dropped.length) {
        if (verbose) console.log(`#${account.id} ${account.email}: ${after.length} work order(s), unchanged`);
        continue;
      }

      // resolveCustomerProperty answers { numericPropertyId, propertyCode, propertyName } -- the
      // names the scope builders take. Reading .id/.code/.name off it yields undefined, which
      // prints as "-" and makes every property-bearing row look foreign.
      const { numericPropertyId, propertyCode, propertyName } = property;

      tally.changed += 1;
      console.log(`\n#${account.id}  ${account.email}  "${propertyName || '-'}" (${propertyCode || '-'})`);
      console.log(`  account created ${account.created_at}`);
      console.log(`  ${before.length} claimed before -> ${after.length} after; ${dropped.length} dropped:`);

      for (const row of dropped) {
        const namesAProperty = has(row.property_id) || has(row.property_code);
        const isMine = (has(row.property_code) && String(row.property_code) === String(propertyCode))
          || String(row.property_id) === String(propertyCode)
          || String(row.property_id) === String(numericPropertyId);
        const foreign = namesAProperty && !isMine;
        let verdict;
        if (foreign) { verdict = 'belongs elsewhere'; tally.elsewhere += 1; }
        else if (!namesAProperty) {
          verdict = 'ORPHAN NOW HIDDEN';
          tally.orphan += 1;
          orphans.push({ account, row });
        } else { verdict = 'review'; tally.review += 1; }

        console.log(`    ${row.work_order_id}  ${String(row.status).padEnd(10)} raised ${new Date(row.created_at).toISOString().slice(0, 10)}  ` +
          `property_id=${row.property_id ?? 'NULL'} code=${row.property_code ?? 'NULL'} name="${row.property_name ?? '-'}"  ` +
          `source=${row.source ?? '-'}  => ${verdict}`);
      }
    }

    console.log('\n' + '-'.repeat(70));
    console.log(`${tally.accounts} active account(s); ${tally.changed} see a different list`);
    console.log(`  belongs elsewhere : ${tally.elsewhere}   (correctly dropped)`);
    console.log(`  orphan now hidden : ${tally.orphan}   (look at these)`);
    console.log(`  review            : ${tally.review}`);

    if (orphans.length) {
      console.log('\nAn orphan names no property, so nothing but the email could ever find it. If one is\n' +
        'genuinely the customer\'s, give it their property and it is claimed on solid ground:');
      const { account, row } = orphans[0];
      const property = await resolveCustomerProperty(account.property_id, account.property_code, account.property_name);
      console.log(`  UPDATE work_orders SET property_id = '${property.numericPropertyId}', ` +
        `property_code = '${property.propertyCode}' WHERE work_order_id = '${row.work_order_id}';`);
    }
  } catch (error) {
    console.error('Audit failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
