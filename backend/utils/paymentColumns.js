const { pool } = require('../config/database');

/**
 * What a payment write may rely on in `payments` beyond the base schema_v17 table.
 *
 * schema_v31_cheque_payment_details.sql adds the cheque detail columns, transaction_id and
 * payment_location; schema_v20/v46 add the receipt and linkage columns. A deployment that has
 * not applied them fails the INSERT with "Unknown column 'cheque_number' in 'field list'" and,
 * once that is fixed, with WARN_DATA_TRUNCATED on the ENUMs: payment_method never had 'cheque'
 * until schema_v20 widened it, and status never had 'verification_pending'/'paid' until
 * schema_v25. The cheque INSERT sits inside the payment's own transaction, so the error rolls
 * the whole payment back -- the record is simply lost.
 *
 * This resolves it the way paymentHistoryAction resolves its column: check information_schema
 * once per process, ALTER exactly what the migration would, and say in the log which migration
 * was missing. A database that is already current pays one cached flag check.
 */

const COLUMNS = {
  // schema_v31_cheque_payment_details.sql
  cheque_number: 'VARCHAR(100) NULL',
  cheque_date: 'DATE NULL',
  bank_name: 'VARCHAR(255) NULL',
  branch_name: 'VARCHAR(255) NULL',
  payee_name: 'VARCHAR(255) NULL',
  payment_location: 'VARCHAR(30) NULL',
  transaction_id: 'VARCHAR(100) NULL',
  // schema_v20_entity_linkage.sql / schema_v46_general_drift_repair.sql
  receipt_id: 'VARCHAR(50) NULL',
  property_code: 'VARCHAR(50) NULL',
  invoice_number: 'VARCHAR(50) NULL',
  estimate_number: 'VARCHAR(50) NULL'
};

// Members each ENUM must carry for the values the routes write. Existing members are kept;
// the ALTER only runs when one of these is absent.
const ENUM_MEMBERS = {
  payment_method: ['cheque'],
  status: ['verification_pending', 'paid', 'partially_paid']
};

const enumMembers = columnType => {
  const members = [];
  const re = /'((?:[^']|'')*)'/g;
  let match;
  while ((match = re.exec(String(columnType)))) members.push(match[1].replace(/''/g, "'"));
  return members;
};

const ensureEnumMembers = async column => {
  const required = ENUM_MEMBERS[column];
  const [rows] = await pool.execute(
    `SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = ?`,
    [column]
  );
  const type = rows[0]?.type ? String(rows[0].type) : null;
  if (!type || !type.toLowerCase().startsWith('enum')) return;
  const members = enumMembers(type);
  const missing = required.filter(member => !members.includes(member));
  if (missing.length === 0) return;
  const widened = [...members, ...missing];
  const nullable = String(rows[0].nullable).toUpperCase() === 'NO' ? ' NOT NULL' : ' NULL';
  const defaultValue = rows[0].defaultValue != null
    ? ` DEFAULT '${String(rows[0].defaultValue).replace(/'/g, "''")}'` : '';
  const ddl = `ALTER TABLE payments MODIFY COLUMN ${column} ENUM(${widened.map(member => `'${member.replace(/'/g, "''")}'`).join(', ')})${nullable}${defaultValue}`;
  await pool.execute(ddl);
  console.log(`[payments] ${column} widened to include ${missing.join(', ')}; schema_v20/schema_v25 had not been applied`);
};

let ensured = null;

const ensurePaymentColumns = () => {
  if (!ensured) {
    ensured = (async () => {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'`
      );
      const existing = new Set(rows.map(row => row.name));
      for (const [column, definition] of Object.entries(COLUMNS)) {
        if (existing.has(column)) continue;
        try {
          await pool.execute(`ALTER TABLE payments ADD COLUMN ${column} ${definition}`);
          console.log(`[payments] added ${column}; schema_v31/schema_v46 had not been applied`);
        } catch (error) {
          console.warn(`[payments] could not add ${column} (${error.message})`);
        }
      }
      try {
        await ensureEnumMembers('payment_method');
        await ensureEnumMembers('status');
      } catch (error) {
        console.warn(`[payments] could not widen payment ENUMs (${error.message})`);
      }
    })().catch(error => {
      // Do not cache a failed pass: the next write tries again rather than staying broken
      ensured = null;
      console.warn(`[payments] column check failed (${error.message})`);
    });
  }
  return ensured;
};

// Tests need to forget what we learned about the table
const resetPaymentColumnsCache = () => { ensured = null; };

module.exports = { ensurePaymentColumns, resetPaymentColumnsCache };
