/**
 * Scope the customer_accounts (and clients) changes a property delete/restore makes
 * to the rows that actually live on that property.
 *
 * The routes used to match `email = <contact email>` or a bare `property_id = <row
 * id>`. Both overreach:
 *
 *  - One contact email can serve accounts on several properties. A bulk delete of a
 *    duplicate property ran `DELETE FROM customer_accounts WHERE email = ?` and
 *    wiped the login of a surviving property (account 51, APT-1793641686695).
 *  - `properties.id` and `onboarded_properties.id` number rows independently, so a
 *    bare `property_id = 62` matches accounts on either table's row 62.
 *
 * `property_code` (GC-/APT-/V-/PL-/FL-) is unique across both tables, so it carries
 * the scope; rows older than that column are matched by the row number *and* the
 * deleted property's contact email, which ties them to this property's contact
 * rather than to any account sharing the number.
 */

/**
 * @param {Array<{code: ?string, email: ?string}>} rows  identifier info for the
 *   property rows being deleted/restored (one entry per source-table row)
 * @param {string|number} id  the route's :id
 * @param {{codeColumn?: boolean}} [opts]  pass `codeColumn: false` when the target
 *   table may not have `property_code` yet (clients on a deployment missing
 *   schema_v63); the clause then falls back to the number+email match alone
 * @returns {{sql: string, params: Array}} WHERE clause selecting only accounts that
 *   belong to those rows. Assumes the target table has property_id and email
 *   columns (true of customer_accounts and clients).
 */
const propertyAccountScope = (rows, id, { codeColumn = true } = {}) => {
  const codes = codeColumn ? [...new Set(rows.map((r) => r.code).filter(Boolean))] : [];
  const emails = [...new Set(rows.map((r) => (r.email || '').toLowerCase()).filter(Boolean))];
  const clauses = [];
  const params = [];

  if (codes.length) {
    clauses.push(`property_code IN (${codes.map(() => '?').join(', ')})`);
    params.push(...codes);
  }
  for (const email of emails) {
    clauses.push('(property_id = ? AND email = ?)');
    params.push(id, email);
  }

  return { sql: clauses.length ? `(${clauses.join(' OR ')})` : '(0)', params };
};

module.exports = { propertyAccountScope };
