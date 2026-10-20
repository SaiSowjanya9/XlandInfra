/**
 * Which customer a complaint belongs to.
 *
 * A complaint filed from the customer portal knows: the login is the complainant. One a franchise
 * partner files on a resident's behalf knows only the property and a contact phone, so the account
 * has to be found — and getting it wrong means telling the wrong resident that *their* complaint is
 * being worked on, which is worse than telling nobody. The match is therefore deliberately narrow:
 *
 *   1. the property's accounts whose phone is the one on the complaint
 *   2. failing that, the property's single account — a property with several residents has no
 *      obvious owner for a complaint, so none of them is told
 *
 * A property code and a 10-digit phone survive HTML escaping unchanged, but the stored text is
 * escaped (middleware/security.js) and `customer_accounts` is written by the same middleware, so
 * both sides are decoded before they are compared rather than relying on that.
 *
 * Regression test: `node --test backend/utils/complaintCustomer.test.js`.
 */

const { decodeEntities } = require('./htmlEntities');

/** The last ten digits, which is how a phone is stored on a complaint. */
const phoneDigits = (value) => {
  const digits = decodeEntities(String(value || '')).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const accountName = (account) => {
  const parts = [account?.first_name, account?.last_name].filter(Boolean).join(' ').trim();
  return parts || account?.name || account?.email || '';
};

/**
 * @param {object} pool  mysql2 pool
 * @param {object} complaint  { property_id (the code), phone_number }
 * @returns {Promise<{id: number, email: string, name: string}|null>}
 */
const resolveComplaintCustomer = async (pool, complaint = {}) => {
  const propertyCode = decodeEntities(String(complaint.property_id || '')).trim();
  if (!propertyCode) return null;
  try {
    const [accounts] = await pool.execute(
      `SELECT id, email, first_name, last_name, name, phone, property_code
       FROM customer_accounts
       WHERE is_active = 1 AND email IS NOT NULL AND email <> '' AND property_code = ?`,
      [propertyCode]
    );
    if (!accounts.length) return null;

    const wanted = phoneDigits(complaint.phone_number);
    const byPhone = wanted ? accounts.filter((account) => phoneDigits(account.phone) === wanted) : [];
    // Exactly one match either way, or nobody: a complaint must never be reported to a resident it
    // has nothing to do with.
    const match = byPhone.length === 1 ? byPhone[0] : (accounts.length === 1 ? accounts[0] : null);
    if (!match) return null;
    return { id: match.id, email: match.email, name: accountName(match) };
  } catch (e) {
    // The complaint itself is worth more than the notification: a lookup that fails leaves the
    // customer columns empty rather than failing the save.
    console.error('Complaint customer lookup failed:', e.message);
    return null;
  }
};

module.exports = { resolveComplaintCustomer, phoneDigits, accountName };
