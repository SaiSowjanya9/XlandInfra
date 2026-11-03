const { pool } = require('../config/database');

/**
 * Which property a work order is about, recorded unambiguously.
 *
 * `work_orders.property_id` is a VARCHAR holding a bare row number, and there are two live
 * property tables whose numbers are independent: the FP portal's Add Customer writes
 * `properties`, while Manager/Coordinator/Supervisor/Executive Add Customer and the admin
 * portal's onboarding write `onboarded_properties`. schema_v28 copied `properties.id` into
 * `onboarded_properties.id` deliberately, so the two id spaces overlap and have been
 * diverging ever since -- `properties.id` 37 and `onboarded_properties.id` 37 are two
 * different communities, and nothing in a work order row says which one its 37 meant.
 *
 * The customer portal matches on that number, so a brand-new FP customer saw the work
 * orders of whichever other community shared its row number: another household's
 * descriptions and entry notes, and wrong counts on their dashboard. Invoices never had
 * this problem because `invoices` carries `property_code` next to `property_id` and
 * `customerInvoiceScope` refuses a numeric match that names a different code. This gives
 * `work_orders` the same second identifier, so the same guard can be applied.
 *
 * The code (`GC-1793673531543`, `APT-…`, `V-…`, `PL-…`, `FL-…`) is unique across both
 * tables; the number is not. Where a writer knows the code it is stored verbatim. Where
 * only a number is known it is resolved, and **an ambiguous number resolves to nothing**:
 * a row left without a code keeps matching on the number alone, exactly as today, which is
 * far better than stamping a guess that would hand the work order to the wrong household
 * permanently.
 *
 * DDL commits implicitly in MySQL, so only `ensureWorkOrderPropertyCode` alters the table
 * and it is called once at boot (config/database.js). Everything on a request path uses
 * `workOrderPropertyCodeAvailable`, which never alters anything and is therefore safe
 * inside a transaction.
 *
 * Regression test: node --test backend/utils/workOrderPropertyCode.test.js
 */

// schema_v62_work_order_property_code.sql
const COLUMN_DEFINITION = 'VARCHAR(50) DEFAULT NULL';
const MIGRATION = 'backend/database/migrations/schema_v62_work_order_property_code.sql';

let state = null;

const columnExists = async (executor) => {
  const [rows] = await executor.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND COLUMN_NAME = 'property_code'`
  );
  return rows.length > 0;
};

const resolveState = (allowAlter, executor) => {
  state = (async () => {
    if (await columnExists(executor)) return true;
    if (!allowAlter) {
      console.warn(`[work_orders] property_code is missing; apply ${MIGRATION}. ` +
        'Until then a work order is matched by its property number alone.');
      return false;
    }
    await executor.execute(`ALTER TABLE work_orders ADD COLUMN property_code ${COLUMN_DEFINITION}`);
    await executor.execute('CREATE INDEX idx_work_orders_property_code ON work_orders (property_code)')
      .catch(() => {}); // an index that already exists is not a failure
    console.log(`[work_orders] added property_code; ${MIGRATION} had not been applied`);
    return true;
  })().catch(error => {
    // Never cache a failed pass: the next caller tries again rather than staying broken
    state = null;
    console.warn(`[work_orders] property_code check failed (${error.message})`);
    return false;
  });
  return state;
};

/** Add the column if it is missing. Boot only -- DDL commits any open transaction. */
const ensureWorkOrderPropertyCode = (executor = pool) => state || resolveState(true, executor);

/** Does the column exist? Read-only, so this is safe on a request path and in a transaction. */
const workOrderPropertyCodeAvailable = (executor = pool) => state || resolveState(false, executor);

/**
 * A property code is never all digits -- that is how a code is told from a row number
 * wherever a writer holds one value that could be either.
 */
const isPropertyCode = (value) => {
  const text = String(value ?? '').trim();
  return text !== '' && text !== 'undefined' && text !== 'null' && !/^\d+$/.test(text);
};

/**
 * The unique code for a property, or null when it cannot be known.
 *
 * Null is returned for a number that exists in both tables under different codes. That
 * work order genuinely does not say which community it belongs to, and the two candidates
 * are equally likely -- see the backfill script, which reports these for a human instead.
 */
const resolveWorkOrderPropertyCode = async (property = {}, executor = pool) => {
  const { propertyCode, propertyId } = property;
  if (isPropertyCode(propertyCode)) return String(propertyCode).trim();
  if (isPropertyCode(propertyId)) return String(propertyId).trim();

  const numeric = /^\d+$/.test(String(propertyId ?? '').trim()) ? Number(propertyId) : null;
  if (!numeric) return null;

  const [rows] = await executor.execute(
    `SELECT property_id AS code FROM onboarded_properties WHERE id = ?
     UNION
     SELECT property_id AS code FROM properties WHERE id = ?`,
    [numeric, numeric]
  );
  const codes = [...new Set(rows.map(row => row.code).filter(Boolean))];
  return codes.length === 1 ? codes[0] : null;
};

/**
 * Record which property a freshly inserted work order is about.
 *
 * Called right after the INSERT rather than spliced into it: there are eleven creation
 * sites with eleven different column lists, and a one-line call that cannot be mis-ordered
 * is worth more than saving a round trip. It never throws -- a work order that exists is
 * worth more than its second identifier, and a row without one behaves exactly as every
 * row did before this column existed.
 */
const stampWorkOrderPropertyCode = async (workOrderRowId, property = {}, executor = pool) => {
  if (!workOrderRowId) return null;
  try {
    if (!(await workOrderPropertyCodeAvailable(executor))) return null;
    const code = await resolveWorkOrderPropertyCode(property, executor);
    if (!code) return null;
    await executor.execute('UPDATE work_orders SET property_code = ? WHERE id = ?', [code, workOrderRowId]);
    return code;
  } catch (error) {
    console.warn(`[work_orders] could not record property_code for #${workOrderRowId} (${error.message})`);
    return null;
  }
};

/**
 * The condition a reader adds to a numeric property match, as SQL plus its parameter.
 *
 * The same shape `customerInvoiceScope` uses: a row that has not been stamped yet still
 * matches on the number alone, so nothing disappears from a customer's history before
 * `scripts/backfill-work-order-property-codes.js` has run. Once a row carries a code, a
 * number that belongs to a different community no longer reaches it.
 *
 * Returns empty SQL where the column does not exist, because naming a missing column
 * fails the whole statement and would empty the customer's dashboard outright.
 */
const propertyCodeAgreement = async (alias, propertyCode, executor = pool) => {
  if (!propertyCode || !(await workOrderPropertyCodeAvailable(executor))) {
    return { sql: '', params: [] };
  }
  return {
    sql: ` AND (${alias}.property_code IS NULL OR ${alias}.property_code = '' OR ${alias}.property_code = ?)`,
    params: [propertyCode]
  };
};

// Tests need to forget what we learned about the table
const resetWorkOrderPropertyCodeCache = () => { state = null; };

module.exports = {
  ensureWorkOrderPropertyCode,
  workOrderPropertyCodeAvailable,
  isPropertyCode,
  resolveWorkOrderPropertyCode,
  stampWorkOrderPropertyCode,
  propertyCodeAgreement,
  resetWorkOrderPropertyCodeCache
};
