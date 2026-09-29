/**
 * Terms & Conditions carried by an estimate.
 *
 * An estimate records two things: whether the creator chose to include terms, and the text they
 * were shown when they made that choice. Storing the text rather than only a flag keeps a sent
 * estimate readable exactly as the customer received it, even after the default wording changes.
 *
 * The default clauses below are placeholder copy: replace them with the approved wording, and
 * every new estimate picks it up while existing ones keep the text they were created with.
 * `admin-portal/src/utils/estimateTerms.js` is the twin of this file - change both, a test
 * compares them, or the portal would preview one set of terms and the PDF would print another.
 *
 * An estimate created before this feature has no recorded choice (include_terms IS NULL) and is
 * therefore treated as carrying no terms: it was never sent with any.
 *
 * Writing the clauses is an Admin, Operations Manager and Franchise Partner decision. Every other
 * portal's estimate carries the default wording, so `estimateTermsColumns` takes the creator's
 * role and ignores text that arrives from a role that may not author it.
 */

const { ROLES } = require('../config/roles');

const DEFAULT_ESTIMATE_TERMS = [
  'This estimate is valid for 30 days from the date of issue.',
  'Prices are exclusive of GST unless stated otherwise, and taxes are charged at the rate applicable on the invoice date.',
  'Payment terms: 50% advance on confirmation and the balance as per the agreed billing cycle.',
  'Services are delivered on the scheduled visit dates. A visit missed because the site was unavailable is treated as delivered.',
  'Consumables, spares and material costs are billed separately unless they are explicitly included in a service.',
  'Either party may end the contract with 30 days of written notice.',
  'XLAND INFRA is not liable for delays caused by events outside its reasonable control.'
];

const DEFAULT_ESTIMATE_TERMS_TEXT = DEFAULT_ESTIMATE_TERMS.join('\n');

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');

// Accepts what the API, the database and a form each send: true / 1 / '1' / 'true'
const includesTerms = value => value === true || value === 1 || value === '1' || value === 'true';

/**
 * The terms to show for an estimate row, whatever shape it arrives in.
 * @returns {{ includeTerms: boolean, termsConditions: string }}
 */
const resolveEstimateTerms = (row = {}) => {
  if (!includesTerms(first(row.includeTerms, row.include_terms))) return { includeTerms: false, termsConditions: '' };
  const text = String(first(row.termsConditions, row.terms_conditions) ?? '').trim();
  // Included but blank means the creator cleared the box; the default wording still applies
  return { includeTerms: true, termsConditions: text || DEFAULT_ESTIMATE_TERMS_TEXT };
};

/** The lines to print, so a PDF and a modal break the clauses the same way. */
const estimateTermsLines = row => {
  const { includeTerms, termsConditions } = resolveEstimateTerms(row);
  return includeTerms ? termsConditions.split('\n').map(line => line.trim()).filter(Boolean) : [];
};

/**
 * Who may write an estimate's clauses. A Manager, Coordinator, Supervisor or Executive sends the
 * standard terms as they are, so there is nothing for them to choose or edit.
 */
const TERMS_EDITOR_ROLES = [ROLES.ADMIN, ROLES.OPERATIONS_MANAGER, ROLES.FRANCHISE_PARTNER, ROLES.FRANCHISE];
const canEditEstimateTerms = role => TERMS_EDITOR_ROLES.includes(String(role || '').toLowerCase());

/**
 * What a create request should store, from whatever the form submitted, for a creator in `role`.
 *
 * A role that may not author terms gets the default clauses whatever it sent: the create form
 * shows them read-only, but the field being absent from a screen is not what stops a request from
 * supplying its own text. It never yields "no terms" either - a portal that cannot choose is not
 * a portal whose estimates go out bare.
 */
const estimateTermsColumns = (body, role) => {
  if (!canEditEstimateTerms(role)) return { include_terms: 1, terms_conditions: DEFAULT_ESTIMATE_TERMS_TEXT };
  const include = includesTerms(first(body.includeTerms, body.include_terms));
  return { include_terms: include ? 1 : 0, terms_conditions: include ? String(first(body.termsConditions, body.terms_conditions) ?? '').trim() || DEFAULT_ESTIMATE_TERMS_TEXT : null };
};

const COLUMNS = { include_terms: 'TINYINT(1) NULL DEFAULT NULL', terms_conditions: 'TEXT NULL' };

/**
 * Adds the columns where they are missing. MySQL 8 has no ADD COLUMN IF NOT EXISTS, so the
 * check goes through information_schema, and this is safe to run on every boot.
 */
const ensureEstimateTermsColumns = async (pool, table = 'fp_estimates') => {
  const [rows] = await pool.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]
  );
  if (!rows.length) return false;
  const existing = new Set(rows.map(row => row.COLUMN_NAME));
  for (const [name, definition] of Object.entries(COLUMNS)) {
    if (!existing.has(name)) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
  }
  return true;
};

module.exports = {
  DEFAULT_ESTIMATE_TERMS, DEFAULT_ESTIMATE_TERMS_TEXT,
  resolveEstimateTerms, estimateTermsLines, estimateTermsColumns, ensureEstimateTermsColumns,
  canEditEstimateTerms, TERMS_EDITOR_ROLES
};
