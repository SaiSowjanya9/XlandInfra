/**
 * One email, one customer account -- and a second entry is refused, never merged.
 *
 * `customer_accounts.email` is UNIQUE, so a contact email owns exactly one portal login
 * system-wide. Every Add Customer / onboarding route used to triage an email it had seen
 * before: an unactivated row had its token and temporary password re-issued, and an
 * activated row was re-pointed at the property just added (`is_active = 1`, a
 * "you've been added" email) -- which silently moved the login off whatever property it
 * held before. The customer kept their password but lost sight of the earlier property's
 * invoices and visits, and nothing recorded the move.
 *
 * The rule now: if the email is already in `customer_accounts` the submission is refused
 * and **nothing is written** -- no property, no client row, no account, no email. Staff
 * read CUSTOMER_EMAIL_EXISTS_MESSAGE and take it to an admin, who can restore the
 * customer from Inactive Customers (lossless) or permanently delete them, which frees
 * the email for reuse.
 *
 * `is_active` and `is_activated` are deliberately NOT part of the test: a soft-deleted
 * customer still owns its row, and reviving it by retyping the customer is exactly the
 * silent relink this guard exists to stop.
 *
 * Call it before the first INSERT of the request -- the portal routes write the property
 * and client rows before they ever look at the email, so a late check cannot keep its
 * promise. Where the caller has already opened a transaction, roll back before
 * answering.
 *
 * Regression test: node --test backend/utils/customerEmailGuard.test.js
 */

const CUSTOMER_EMAIL_EXISTS_MESSAGE =
  'This user already exists. Please check with the admin to know more.';

const normalizeCustomerEmail = (email) => String(email ?? '').trim().toLowerCase();

/**
 * The first of these emails that is already a customer login, or null.
 *
 * Takes a list because a property can be onboarded with several contacts and each one
 * that has an email gets its own account -- checking only the primary would let the
 * admin portal save the property and then fail on contact two, after the fact.
 *
 * @param {object} executor  mysql2 pool, or a connection inside a transaction
 * @param {string|string[]} emails
 * @returns {Promise<string|null>} null when none are taken. A blank email is not a
 *   conflict -- a contact without one simply gets no portal account.
 */
const firstTakenCustomerEmail = async (executor, emails) => {
  const candidates = [...new Set(
    (Array.isArray(emails) ? emails : [emails]).map(normalizeCustomerEmail).filter(Boolean)
  )];
  if (candidates.length === 0) return null;

  // LOWER() on both sides: every writer stores the address lower-cased, but rows created
  // before that was true must still be found -- missing one would let a duplicate login
  // through, which is the one thing this check is for.
  const [rows] = await executor.execute(
    `SELECT LOWER(email) AS email FROM customer_accounts
      WHERE LOWER(email) IN (${candidates.map(() => '?').join(', ')}) LIMIT 1`,
    candidates
  );
  return rows.length > 0 ? rows[0].email : null;
};

/** Is any of these emails already a customer login? */
const customerEmailExists = async (executor, emails) =>
  (await firstTakenCustomerEmail(executor, emails)) !== null;

/**
 * The 409 body every route answers with, so the message reads the same in all seven
 * portals. The portals render `result.message` directly; `code` is for callers that
 * need to tell this apart from a validation failure.
 */
const customerEmailExistsResponse = () => ({
  success: false,
  code: 'CUSTOMER_EMAIL_EXISTS',
  message: CUSTOMER_EMAIL_EXISTS_MESSAGE
});

module.exports = {
  CUSTOMER_EMAIL_EXISTS_MESSAGE,
  normalizeCustomerEmail,
  firstTakenCustomerEmail,
  customerEmailExists,
  customerEmailExistsResponse
};
