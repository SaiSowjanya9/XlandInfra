/**
 * Gives every work order that has no property_code one, resolved from its property number.
 *
 * `work_orders.property_id` is a bare row number and there are two live property tables whose
 * numbers are independent -- the FP portal's Add Customer writes `properties`, the other four
 * staff portals and the admin portal's onboarding write `onboarded_properties`, and schema_v28
 * copied `properties.id` into `onboarded_properties.id` so the two id spaces overlap. The
 * customer portal matched on that number, so a customer was shown the work orders of whichever
 * other community shared its row number. schema_v62 adds `property_code`, which is unique
 * across both tables; this fills it in for rows written before that.
 *
 *   node scripts/backfill-work-order-property-codes.js          # dry run
 *   node scripts/backfill-work-order-property-codes.js --apply  # writes the codes
 *
 * Three kinds of row come out of this:
 *
 *   resolved   the number exists in exactly one table (or in both under the same code, which
 *              is what schema_v28's copy produced) -- the code is certain, and is written
 *   code       `property_id` already holds the code rather than a number; copied across
 *   AMBIGUOUS  the number exists in both tables under *different* codes. The row genuinely
 *              does not say which community it belongs to and the two candidates are equally
 *              likely, so nothing is written and both are printed for a human to settle. Until
 *              one is chosen the row keeps matching on its number, i.e. it behaves exactly as
 *              it does today -- which is the leak, so these are the rows worth resolving by
 *              hand. There is usually a handful at most.
 *   unknown    the number matches no property at all (deleted property, bad data); skipped.
 *
 * Uses the same database settings as the server (config/database.js), so on the VPS it runs
 * against production when NODE_ENV=production. Take a backup first. Safe to re-run: a work
 * order that already has a code is never touched.
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { ensureWorkOrderPropertyCode, isPropertyCode } = require('../utils/workOrderPropertyCode');

const apply = process.argv.includes('--apply');

(async () => {
  try {
    if (!(await ensureWorkOrderPropertyCode())) {
      console.error('work_orders.property_code does not exist and could not be added. Apply ' +
        'backend/database/migrations/schema_v62_work_order_property_code.sql first.');
      process.exitCode = 1;
      return;
    }

    const [rows] = await pool.query(`
      SELECT id, work_order_id, property_id, property_name, created_at
      FROM work_orders
      WHERE (property_code IS NULL OR property_code = '')
        AND property_id IS NOT NULL AND property_id <> ''
      ORDER BY id
    `);

    // One pass over each property table rather than two queries per work order
    const [onboarded] = await pool.query('SELECT id, property_id AS code, community_name AS name FROM onboarded_properties');
    const [legacy] = await pool.query('SELECT id, property_id AS code, name FROM properties');
    const byNumber = new Map();
    const add = (row, table) => {
      if (!row.code) return;
      const key = String(row.id);
      if (!byNumber.has(key)) byNumber.set(key, []);
      byNumber.get(key).push({ code: row.code, name: row.name, table });
    };
    onboarded.forEach(row => add(row, 'onboarded_properties'));
    legacy.forEach(row => add(row, 'properties'));

    const counts = { resolved: 0, code: 0, ambiguous: 0, unknown: 0 };
    const ambiguous = [];

    console.log(`${rows.length} work order(s) without a property code${apply ? '' : ' (dry run)'}\n`);

    for (const row of rows) {
      const stored = String(row.property_id).trim();
      const label = `${row.work_order_id || `#${row.id}`}  property_id=${stored}  ${row.property_name || '-'}`;

      // Some writers put the code straight into property_id; copy it across unchanged
      if (isPropertyCode(stored)) {
        counts.code += 1;
        if (apply) await pool.execute(
          "UPDATE work_orders SET property_code = ? WHERE id = ? AND (property_code IS NULL OR property_code = '')",
          [stored, row.id]
        );
        console.log(`  ${apply ? 'copied  ' : 'would copy  '}${stored}  <- ${label}`);
        continue;
      }

      const candidates = byNumber.get(stored) || [];
      const codes = [...new Set(candidates.map(candidate => candidate.code))];

      if (codes.length === 0) {
        counts.unknown += 1;
        console.log(`  skip (no such property)  ${label}`);
        continue;
      }
      if (codes.length > 1) {
        counts.ambiguous += 1;
        ambiguous.push({ row, candidates });
        console.log(`  AMBIGUOUS  ${label}`);
        candidates.forEach(candidate =>
          console.log(`             candidate ${candidate.code}  ${candidate.name || '-'}  (${candidate.table})`));
        continue;
      }

      counts.resolved += 1;
      if (apply) await pool.execute(
        "UPDATE work_orders SET property_code = ? WHERE id = ? AND (property_code IS NULL OR property_code = '')",
        [codes[0], row.id]
      );
      console.log(`  ${apply ? 'set     ' : 'would set   '}${codes[0]}  <- ${label}`);
    }

    console.log(`\nresolved ${counts.resolved}, already a code ${counts.code}, ` +
      `ambiguous ${counts.ambiguous}, no such property ${counts.unknown}`);

    if (ambiguous.length) {
      console.log('\nThe ambiguous rows are the ones a customer can currently see by mistake. ' +
        'Decide each from its property name and date, then set it directly, e.g.');
      const [{ row, candidates }] = ambiguous;
      console.log(`  UPDATE work_orders SET property_code = '${candidates[0].code}' WHERE id = ${row.id};`);
    }
    if (!apply && rows.length) console.log('\nRe-run with --apply to write them.');
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
