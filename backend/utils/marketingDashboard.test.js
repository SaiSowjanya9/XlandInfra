const test = require('node:test');
const assert = require('node:assert');

const {
  LEAD_SOURCES, PRIORITIES, CUSTOMER_DECISIONS, TRACKER_STATUSES, FOLLOW_UP_STAGES,
  buildMarketingDashboard
} = require('./marketingDashboard');

const row = (overrides = {}) => ({
  tracker_status: 'Not Started',
  follow_up_stage: '',
  lead_source: '',
  priority: '',
  customer_decision: '',
  coordinator_reviewed: '',
  property_type: 'apartment',
  total_amount: 0,
  created_at: '2026-08-10T00:00:00Z',
  ...overrides
});

const find = (list, name) => list.find((entry) => entry.name === name);

test('an FP with no tracked estimates reads zero, never NaN', () => {
  const d = buildMarketingDashboard([]);
  assert.strictEqual(d.totals.totalLeads, 0);
  assert.strictEqual(d.totals.winRate, 0);
  assert.strictEqual(d.totals.openValue, 0);
  // Every funnel step past the first divides by the step above it.
  for (const step of d.funnel) {
    assert.ok(Number.isFinite(step.value), 'funnel value is a number');
    assert.ok(step.ofPrevious === null || Number.isFinite(step.ofPrevious), 'no NaN share');
  }
});

test('buildMarketingDashboard tolerates a missing or non-array argument', () => {
  for (const input of [undefined, null, 'nonsense', 42]) {
    const d = buildMarketingDashboard(input);
    assert.strictEqual(d.totals.totalLeads, 0);
  }
});

test('estimates sent is cumulative -- an approved lead still had its estimate shared', () => {
  const d = buildMarketingDashboard([
    row({ tracker_status: 'Approved' }),
    row({ tracker_status: 'Revised Estimate Sent' }),
    row({ tracker_status: 'Rejected' }),
    row({ tracker_status: 'Not Started' }),
    row({ tracker_status: 'Pending Coordinator Review' })
  ]);
  assert.strictEqual(d.totals.totalLeads, 5);
  assert.strictEqual(d.totals.estimatesSent, 3, 'Approved, Revised Estimate Sent and Rejected all count');
  assert.strictEqual(d.totals.approved, 1);
  assert.strictEqual(d.totals.winRate, 20);
});

test('a lost lead counts whether it was rejected or the customer declined', () => {
  const d = buildMarketingDashboard([
    row({ tracker_status: 'Rejected' }),
    row({ customer_decision: 'Not Interested' }),
    row({ customer_decision: 'Competitor Selected' }),
    row({ customer_decision: 'Interested' })
  ]);
  assert.strictEqual(d.totals.notInterested, 3);
});

test('a rejected lead whose decision is also Not Interested is counted once', () => {
  const d = buildMarketingDashboard([
    row({ tracker_status: 'Rejected', customer_decision: 'Not Interested' })
  ]);
  assert.strictEqual(d.totals.notInterested, 1, 'the two conditions must not double count');
});

test('coordinator review backlog counts anything not positively marked Yes', () => {
  const d = buildMarketingDashboard([
    row({ coordinator_reviewed: 'Yes' }),
    row({ coordinator_reviewed: 'No' }),
    row({ coordinator_reviewed: '' }),
    row({ coordinator_reviewed: null })
  ]);
  assert.strictEqual(d.totals.pendingReview, 3);
});

test('escaped stored text still matches its own option', () => {
  // middleware/security.js escapes every request string, so the database can hold entity codes.
  const d = buildMarketingDashboard([
    row({ lead_source: 'Referral', coordinator_reviewed: '&#x59;es' }),
    row({ lead_source: '&#x52;eferral' })
  ]);
  assert.strictEqual(d.totals.referralLeads, 2, 'both spellings of Referral count');
  assert.strictEqual(d.totals.pendingReview, 1, 'an escaped Yes is still reviewed');
  assert.strictEqual(find(d.byLeadSource, 'Referral').value, 2, 'and they land in one bucket');
});

test('every fixed option is charted even when nobody has reached it', () => {
  const d = buildMarketingDashboard([row({ follow_up_stage: 'Closed' })]);
  assert.strictEqual(d.byFollowUpStage.length, FOLLOW_UP_STAGES.length);
  assert.strictEqual(d.byTrackerStatus.length, TRACKER_STATUSES.length);
  assert.strictEqual(d.byLeadSource.length, LEAD_SOURCES.length);
  assert.strictEqual(d.byPriority.length, PRIORITIES.length);
  assert.strictEqual(d.byDecision.length, CUSTOMER_DECISIONS.length);
  assert.strictEqual(find(d.byFollowUpStage, 'Closed').value, 1);
  assert.strictEqual(find(d.byFollowUpStage, 'Step 1 - Thank You').value, 0);
});

test('rows with no follow-up step are reported rather than silently dropped', () => {
  const d = buildMarketingDashboard([row({ follow_up_stage: '' }), row({ follow_up_stage: 'Closed' })]);
  assert.strictEqual(d.totals.missingStage, 1);
  const charted = d.byFollowUpStage.reduce((sum, entry) => sum + entry.value, 0);
  assert.strictEqual(charted, 1, 'the blank row is not charted as a stage');
});

test('open pipeline value excludes approved and rejected rows; won value is separate', () => {
  const d = buildMarketingDashboard([
    row({ tracker_status: 'Estimate Sent', total_amount: 100000 }),
    row({ tracker_status: 'Customer Review', total_amount: 50000 }),
    row({ tracker_status: 'Approved', total_amount: 900000 }),
    row({ tracker_status: 'Rejected', total_amount: 700000 })
  ]);
  assert.strictEqual(d.totals.openValue, 150000);
  assert.strictEqual(d.totals.wonValue, 900000);
});

test('a non-numeric amount is treated as zero, not NaN', () => {
  const d = buildMarketingDashboard([
    row({ tracker_status: 'Estimate Sent', total_amount: null }),
    row({ tracker_status: 'Estimate Sent', total_amount: 'abc' }),
    row({ tracker_status: 'Estimate Sent', total_amount: '2500.50' })
  ]);
  assert.strictEqual(d.totals.openValue, 2500.5);
});

test('the money chart drops empty buckets instead of drawing nine zero bars', () => {
  const d = buildMarketingDashboard([row({ tracker_status: 'Approved', total_amount: 1000 })]);
  assert.strictEqual(d.valueByStatus.length, 1);
  assert.deepStrictEqual(d.valueByStatus[0], { name: 'Approved', value: 1000 });
});

test('funnel reports each step as a share of the one above it', () => {
  const rows = [];
  for (let i = 0; i < 10; i += 1) rows.push(row({ tracker_status: 'Not Started' }));
  for (let i = 0; i < 4; i += 1) rows.push(row({ tracker_status: 'Estimate Sent' }));
  for (let i = 0; i < 2; i += 1) rows.push(row({ tracker_status: 'Approved' }));

  const d = buildMarketingDashboard(rows);
  assert.strictEqual(d.funnel[0].value, 16);
  assert.strictEqual(d.funnel[0].ofPrevious, null, 'the first step is the baseline');
  assert.strictEqual(d.funnel[1].value, 6, 'Estimate Sent plus Approved');
  assert.strictEqual(d.funnel[1].ofPrevious, 38);
  assert.strictEqual(d.funnel[2].value, 2);
  assert.strictEqual(d.funnel[2].ofPrevious, 33);
  assert.strictEqual(d.funnel[2].ofTotal, 13);
});

test('trend covers the last six months including the current one, oldest first', () => {
  const now = new Date(2026, 7, 15); // Aug 2026
  const d = buildMarketingDashboard([], { now });
  assert.strictEqual(d.trend.length, 6);
  assert.deepStrictEqual(d.trend.map((t) => t.month), ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']);
});

test('trend buckets a lead by its creation month and counts its stage', () => {
  const now = new Date(2026, 7, 15);
  const d = buildMarketingDashboard([
    row({ created_at: '2026-08-02T10:00:00Z', tracker_status: 'Approved' }),
    row({ created_at: '2026-07-20T10:00:00Z', tracker_status: 'Estimate Sent' }),
    row({ created_at: '2026-07-21T10:00:00Z', tracker_status: 'Not Started' })
  ], { now });

  const july = d.trend.find((t) => t.month === 'Jul');
  const august = d.trend.find((t) => t.month === 'Aug');
  assert.strictEqual(july.leads, 2);
  assert.strictEqual(july.estimates, 1);
  assert.strictEqual(july.approved, 0);
  assert.strictEqual(august.leads, 1);
  assert.strictEqual(august.approved, 1);
});

test('the trend window crosses a year boundary correctly', () => {
  const now = new Date(2026, 1, 10); // Feb 2026
  const d = buildMarketingDashboard([row({ created_at: '2025-12-05T00:00:00Z' })], { now });
  assert.deepStrictEqual(d.trend.map((t) => t.month), ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']);
  const december = d.trend.find((t) => t.month === 'Dec');
  assert.strictEqual(december.year, 2025);
  assert.strictEqual(december.leads, 1, 'a December 2025 lead lands in the 2025 bucket');
});

test('a lead outside the trend window is left out of the chart but still counted overall', () => {
  const now = new Date(2026, 7, 15);
  const d = buildMarketingDashboard([row({ created_at: '2020-01-01T00:00:00Z' })], { now });
  assert.strictEqual(d.totals.totalLeads, 1);
  assert.strictEqual(d.trend.reduce((sum, t) => sum + t.leads, 0), 0);
});

test('an unparseable or missing created_at does not break the trend', () => {
  const now = new Date(2026, 7, 15);
  const d = buildMarketingDashboard([
    row({ created_at: null }),
    row({ created_at: 'not a date' })
  ], { now });
  assert.strictEqual(d.totals.totalLeads, 2);
  assert.strictEqual(d.trend.reduce((sum, t) => sum + t.leads, 0), 0);
});

test('property type keeps whatever codes the rows hold, for the portal to label', () => {
  const d = buildMarketingDashboard([
    row({ property_type: 'apartment' }),
    row({ property_type: 'apartment' }),
    row({ property_type: 'gated_community' })
  ]);
  assert.strictEqual(find(d.byPropertyType, 'apartment').value, 2);
  assert.strictEqual(find(d.byPropertyType, 'gated_community').value, 1);
});

test('the route and the dashboard share one set of tracker options', () => {
  // franchisePartner.js composes TRACKER_OPTIONS from these exports; if a stage is added to the
  // route by hand instead, the dashboard stops charting it. Read the file rather than requiring
  // it, which would pull in the database pool.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'franchisePartner.js'), 'utf8');

  assert.match(source, /require\('\.\.\/utils\/marketingDashboard'\)/,
    'franchisePartner.js must import the shared option lists');
  for (const [name, list] of Object.entries({
    LEAD_SOURCES, PRIORITIES, CUSTOMER_DECISIONS, TRACKER_STATUSES, FOLLOW_UP_STAGES
  })) {
    assert.ok(source.includes(name), `TRACKER_OPTIONS must use the shared ${name}`);
    assert.ok(Array.isArray(list) && list.length > 0, `${name} is a non-empty list`);
  }
  // And the literal lists must be gone, so there is nothing left to drift.
  assert.ok(!source.includes("'Step 5A - Executive Call', 'Step 5B - Customer Visit'"),
    'the follow-up stages must not be re-declared in the route');
});
