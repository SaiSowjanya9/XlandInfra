const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_ESTIMATE_TERMS, DEFAULT_ESTIMATE_TERMS_TEXT,
  resolveEstimateTerms, estimateTermsLines, estimateTermsColumns, canEditEstimateTerms
} = require('./estimateTerms');

test('an estimate carries terms only when its creator chose to include them', () => {
  assert.deepEqual(resolveEstimateTerms({ include_terms: 1, terms_conditions: 'Ours apply.' }),
    { includeTerms: true, termsConditions: 'Ours apply.' });
  assert.deepEqual(resolveEstimateTerms({ includeTerms: true, termsConditions: 'Ours apply.' }),
    { includeTerms: true, termsConditions: 'Ours apply.' });
  // Included but blank falls back to the default wording rather than printing an empty section
  assert.equal(resolveEstimateTerms({ include_terms: 1, terms_conditions: '   ' }).termsConditions, DEFAULT_ESTIMATE_TERMS_TEXT);
  for (const row of [{}, { include_terms: 0 }, { include_terms: null }, { includeTerms: false, termsConditions: 'ignored' }]) {
    assert.deepEqual(resolveEstimateTerms(row), { includeTerms: false, termsConditions: '' }, JSON.stringify(row));
  }
  // An estimate saved before the feature records no choice, so it shows no terms
  assert.equal(resolveEstimateTerms({ terms_conditions: 'left over' }).includeTerms, false);
});

test('the lines are the clauses, trimmed and without blanks', () => {
  assert.deepEqual(estimateTermsLines({ include_terms: 1 }), DEFAULT_ESTIMATE_TERMS);
  assert.deepEqual(estimateTermsLines({ include_terms: 1, terms_conditions: ' One \n\n  Two  \n' }), ['One', 'Two']);
  assert.deepEqual(estimateTermsLines({ include_terms: 0, terms_conditions: 'One' }), []);
});

test('a create request stores the choice and the text the creator saw', () => {
  for (const role of ['admin', 'operations_manager', 'franchise_partner', 'franchise']) {
    assert.ok(canEditEstimateTerms(role), role);
    assert.deepEqual(estimateTermsColumns({ includeTerms: true, termsConditions: 'Ours apply.' }, role),
      { include_terms: 1, terms_conditions: 'Ours apply.' }, role);
    assert.deepEqual(estimateTermsColumns({ includeTerms: 'true' }, role),
      { include_terms: 1, terms_conditions: DEFAULT_ESTIMATE_TERMS_TEXT }, role);
    assert.deepEqual(estimateTermsColumns({}, role), { include_terms: 0, terms_conditions: null }, role);
    assert.deepEqual(estimateTermsColumns({ includeTerms: false, termsConditions: 'typed then unticked' }, role),
      { include_terms: 0, terms_conditions: null }, role);
  }
});

test('only Admin, Operations Manager and FP author the clauses', () => {
  // A Manager, Coordinator, Supervisor or Executive estimate carries the default wording: the
  // form shows it read-only, and text posted straight at the API is ignored rather than stored.
  const fixed = { include_terms: 1, terms_conditions: DEFAULT_ESTIMATE_TERMS_TEXT };
  for (const role of ['manager', 'coordinator', 'supervisor', 'executive', 'vendor', '', null, undefined]) {
    assert.equal(canEditEstimateTerms(role), false, String(role));
    assert.deepEqual(estimateTermsColumns({ includeTerms: true, termsConditions: 'Ours, actually.' }, role), fixed, String(role));
    // Nor can such a portal drop the terms: unticking the box it is not shown changes nothing
    assert.deepEqual(estimateTermsColumns({ includeTerms: false }, role), fixed, String(role));
    assert.deepEqual(estimateTermsColumns({}, role), fixed, String(role));
  }
  // The role arrives from a token, so it is matched without regard to case
  assert.ok(canEditEstimateTerms('Admin'));
});

test('the portal previews exactly the clauses the backend prints', async () => {
  const frontend = await import('../../admin-portal/src/utils/estimateTerms.js');
  assert.deepEqual(frontend.DEFAULT_ESTIMATE_TERMS, DEFAULT_ESTIMATE_TERMS);
  assert.equal(frontend.DEFAULT_ESTIMATE_TERMS_TEXT, DEFAULT_ESTIMATE_TERMS_TEXT);
  const rows = [{}, { include_terms: 1 }, { includeTerms: true, termsConditions: 'Custom' }, { include_terms: 0, terms_conditions: 'x' },
    { include_terms: 1, terms_conditions: '  ' }, { includeTerms: '1', terms_conditions: 'One\nTwo' }];
  for (const row of rows) {
    assert.deepEqual(frontend.resolveEstimateTerms(row), resolveEstimateTerms(row), JSON.stringify(row));
    assert.deepEqual(frontend.estimateTermsLines(row), estimateTermsLines(row), JSON.stringify(row));
  }
  // A new estimate includes the terms unless the creator unticks the box
  assert.deepEqual(frontend.newEstimateTerms(), { includeTerms: true, termsConditions: DEFAULT_ESTIMATE_TERMS_TEXT });
  assert.deepEqual(estimateTermsColumns(frontend.newEstimateTerms(), 'admin'), { include_terms: 1, terms_conditions: DEFAULT_ESTIMATE_TERMS_TEXT });
});
