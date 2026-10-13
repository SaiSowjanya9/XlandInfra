/**
 * The franchise partner's display name, built from the columns the database actually has.
 *
 * `franchise_partners` has drifted: `company_name` and `owner_name` are present everywhere,
 * `contact_person` only on some deployments. Naming a column the database has not got fails the
 * whole statement with "Unknown column 'contact_person' in 'field list'", and both places that
 * wanted this name were written against the wider schema:
 *
 *   - the admin Complaints inbox read 500 instead of listing complaints;
 *   - the customer portal's own complaint form (routes/customers.js) threw on the lookup that
 *     fills in `responsible_person`, so the catch answered "Failed to submit complaint" and no
 *     customer complaint was ever stored -- which is also why none of them appeared in any portal.
 *
 * So the column list is resolved from information_schema once and cached for the process.
 *
 * Regression test: node --test backend/utils/franchisePartnerName.test.js
 */

// Preference order, best name first; the fallbacks exist because older rows filled only one.
const PARTNER_NAME_CANDIDATES = ['company_name', 'owner_name', 'contact_person'];

const DEFAULT_PARTNER_NAME = 'Franchise Partner';

let cachedColumns = null;

/**
 * Which of the candidate columns this database has, in preference order.
 * Falls back to `company_name` alone: every deployment of this table has had it, and answering
 * with nothing would turn a drifted column into a missing name everywhere.
 */
const availablePartnerNameColumns = async (pool) => {
  if (cachedColumns) return cachedColumns;
  try {
    const [rows] = await pool.execute(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'franchise_partners'
         AND column_name IN (?, ?, ?)`,
      PARTNER_NAME_CANDIDATES
    );
    // mysql2 cases this key differently across versions, so read the value rather than the name.
    const present = rows.map((row) => String(Object.values(row)[0]));
    const usable = PARTNER_NAME_CANDIDATES.filter((column) => present.includes(column));
    cachedColumns = usable.length ? usable : ['company_name'];
  } catch (error) {
    cachedColumns = ['company_name'];
  }
  return cachedColumns;
};

/**
 * A SQL expression for the name, for a query that already joins the table.
 * @param {object} pool
 * @param {string} alias the join's alias, e.g. 'fpx'
 */
const partnerNameExpression = async (pool, alias = 'fp') => {
  const columns = await availablePartnerNameColumns(pool);
  return columns.length === 1
    ? `${alias}.${columns[0]}`
    : `COALESCE(${columns.map((column) => `${alias}.${column}`).join(', ')})`;
};

/**
 * The name of one partner, for code that just needs the string.
 * Never throws: a partner that cannot be read falls back to the generic label, because the caller
 * is usually filling in a field on a record the user is trying to save.
 */
const fetchPartnerName = async (pool, fpId, fallback = DEFAULT_PARTNER_NAME) => {
  if (!fpId) return fallback;
  try {
    const columns = await availablePartnerNameColumns(pool);
    const [rows] = await pool.execute(
      `SELECT ${columns.join(', ')} FROM franchise_partners WHERE id = ?`,
      [fpId]
    );
    if (!rows.length) return fallback;
    // Preference order again, this time over the values: an empty column is not a name.
    for (const column of columns) {
      const value = (rows[0][column] || '').toString().trim();
      if (value) return value;
    }
    return fallback;
  } catch (error) {
    console.error('Could not read the franchise partner name:', error.message);
    return fallback;
  }
};

// Testing seam: the cache is per-process, so a test that changes the schema has to clear it.
const resetPartnerNameCache = () => { cachedColumns = null; };

module.exports = {
  PARTNER_NAME_CANDIDATES,
  DEFAULT_PARTNER_NAME,
  availablePartnerNameColumns,
  partnerNameExpression,
  fetchPartnerName,
  resetPartnerNameCache
};
