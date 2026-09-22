/**
 * Terms & Conditions carried by an estimate (portal side).
 *
 * Twin of `backend/utils/estimateTerms.js`: the create form previews these clauses, the view
 * modal and the exported PDF print them, and the backend stores and prints the same text, so the
 * two files must agree. A test in `backend/utils/estimateTerms.test.js` compares them.
 *
 * The clauses are placeholder copy until the approved wording is supplied.
 */

export const DEFAULT_ESTIMATE_TERMS = [
  'This estimate is valid for 30 days from the date of issue.',
  'Prices are exclusive of GST unless stated otherwise, and taxes are charged at the rate applicable on the invoice date.',
  'Payment terms: 50% advance on confirmation and the balance as per the agreed billing cycle.',
  'Services are delivered on the scheduled visit dates. A visit missed because the site was unavailable is treated as delivered.',
  'Consumables, spares and material costs are billed separately unless they are explicitly included in a service.',
  'Either party may end the contract with 30 days of written notice.',
  'XLAND INFRA is not liable for delays caused by events outside its reasonable control.'
];

export const DEFAULT_ESTIMATE_TERMS_TEXT = DEFAULT_ESTIMATE_TERMS.join('\n');

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');

const includesTerms = value => value === true || value === 1 || value === '1' || value === 'true';

/**
 * The terms to show for an estimate row, whatever shape it arrives in. An estimate created
 * before this feature records no choice and therefore carries no terms.
 */
export function resolveEstimateTerms(row = {}) {
  if (!includesTerms(first(row.includeTerms, row.include_terms))) return { includeTerms: false, termsConditions: '' };
  const text = String(first(row.termsConditions, row.terms_conditions) ?? '').trim();
  return { includeTerms: true, termsConditions: text || DEFAULT_ESTIMATE_TERMS_TEXT };
}

/** The lines to render, so a modal and a PDF break the clauses the same way. */
export function estimateTermsLines(row) {
  const { includeTerms, termsConditions } = resolveEstimateTerms(row);
  return includeTerms ? termsConditions.split('\n').map(line => line.trim()).filter(Boolean) : [];
}

/** What a create form submits: terms are included by default on a new estimate. */
export function newEstimateTerms() {
  return { includeTerms: true, termsConditions: DEFAULT_ESTIMATE_TERMS_TEXT };
}
