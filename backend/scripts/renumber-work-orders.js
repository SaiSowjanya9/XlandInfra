/**
 * Renumbers work orders whose ID is not "WO-" followed by digits (e.g. WO-MTWCEEFE-0P6H, made by the
 * customer portal and the visit schedulers before utils/workOrderId.js) into the numeric format.
 *
 * The new number is the work order's own creation time in milliseconds -- the same thing every
 * numeric ID already is -- moved up a millisecond at a time if it is taken. Only two columns refer to
 * a work order by this code rather than by its row id, and both are updated in the same transaction:
 * fp_estimates.work_order_id and invoices.source_work_order_id. Every other reference
 * (attachments, history, schedules, scheduled_visits, invoices.work_order_id) uses work_orders.id
 * and is untouched.
 *
 *   node scripts/renumber-work-orders.js          # dry run: lists what would change, changes nothing
 *   node scripts/renumber-work-orders.js --apply  # renumbers, all or nothing
 *
 * Uses the same database settings as the server (config/database.js), so on the VPS it runs against
 * production when NODE_ENV=production. Take a backup first.
 */
require('dotenv').config();
const { pool } = require('../config/database');
const { formatWorkOrderId, isNumericWorkOrderId } = require('../utils/workOrderId');

const apply = process.argv.includes('--apply');

const columnExists = async (connection, table, column) => {
  const [rows] = await connection.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, column]);
  return rows.length > 0;
};

(async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [all] = await connection.query('SELECT id, work_order_id, created_at FROM work_orders ORDER BY created_at, id FOR UPDATE');
    const taken = new Set(all.map(row => row.work_order_id));
    const toFix = all.filter(row => !isNumericWorkOrderId(row.work_order_id));
    const references = [];
    for (const [table, column] of [['fp_estimates', 'work_order_id'], ['invoices', 'source_work_order_id']]) {
      if (await columnExists(connection, table, column)) references.push([table, column]);
    }

    console.log(`${all.length} work orders, ${toFix.length} not in the numeric format.`);
    const changes = [];
    for (const row of toFix) {
      let number = new Date(row.created_at || Date.now()).getTime();
      if (!Number.isFinite(number)) number = Date.now();
      while (taken.has(formatWorkOrderId(number))) number += 1;
      const next = formatWorkOrderId(number);
      taken.add(next);
      changes.push({ id: row.id, from: row.work_order_id, to: next });
    }
    for (const change of changes) {
      const counts = [];
      for (const [table, column] of references) {
        const [[{ n }]] = await connection.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, [change.from]);
        counts.push(`${table}.${column}: ${n}`);
        if (apply && n) await connection.query(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`, [change.to, change.from]);
      }
      if (apply) await connection.query('UPDATE work_orders SET work_order_id = ? WHERE id = ?', [change.to, change.id]);
      console.log(`  ${change.from}  ->  ${change.to}   (${counts.join(', ') || 'no references'})`);
    }

    if (apply) {
      await connection.commit();
      console.log(`Renumbered ${changes.length} work order(s).`);
    } else {
      await connection.rollback();
      console.log(changes.length ? 'Dry run only. Re-run with --apply to make these changes.' : 'Nothing to change.');
    }
  } catch (error) {
    await connection.rollback();
    console.error('Renumbering failed, nothing was changed:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
})();
