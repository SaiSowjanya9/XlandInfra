// Marketing Dashboard aggregation.
//
// The FP portal's Marketing > Dashboard screen reports on the same rows Marketing > Tracker edits:
// tracked, non-archived direct estimates. Every figure is derived here from those rows rather than
// in SQL, so one query feeds the whole page and the counting rules are unit-testable
// (`node --test backend/utils/marketingDashboard.test.js`).
//
// The option lists below are the single source of truth for the tracker's fixed answers --
// backend/routes/franchisePartner.js composes its TRACKER_OPTIONS from them, so a stage added here
// is accepted by the PUT and charted by the dashboard in the same change. The chart draws every
// option, including the ones nobody has reached yet, so the pipeline keeps its shape at low volume.

const { decodeEntities } = require('./htmlEntities');
const {
  LEAD_STATUSES, NEXT_ACTIONS, DUE_STATUSES, istToday, dueStatus, isOpenLead, toDateOnly
} = require('./marketingFollowUp');

const LEAD_SOURCES = ['Field Visit', 'Referral', 'WhatsApp', 'Phone Call', 'Website', 'Social Media', 'Existing Customer', 'Walk-in', 'Office Visit', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const CUSTOMER_DECISIONS = ['Interested', 'Interested Need Follow-up', 'Not Interested', 'Need Follow-up', 'Competitor Selected', 'Other'];
const TRACKER_STATUSES = ['Not Started', 'Created by Executive', 'Pending Coordinator Review', 'Reviewed by Coordinator', 'Estimate Sent', 'Revision Required', 'Revised Estimate Sent', 'Approved', 'Rejected'];
// The only statuses anybody picks by hand. Every other entry in TRACKER_STATUSES is derived --
// by the estimate's own status (sent/approved/rejected), by Coordinator Reviewed, or by the time
// since the estimate was created -- so the tracker dropdown locks them and the PUT stores NULL
// for them, which leaves the automatic progression in charge.
const MANUAL_TRACKER_STATUSES = ['Revision Required', 'Revised Estimate Sent'];
const FOLLOW_UP_STAGES = ['Step 1 - Thank You', 'Step 2 - Estimate Shared', 'Step 3 - Follow-Up 1', 'Step 4 - Follow-Up 2', 'Step 5A - Executive Call', 'Step 5B - Customer Visit', 'Closed'];

// A lead counts as "estimate shared" once it reaches any of these -- the figure is cumulative, so
// a row that has since been approved still counts as having had its estimate sent.
const SENT_STATUSES = ['Estimate Sent', 'Revision Required', 'Revised Estimate Sent', 'Approved', 'Rejected'];
// Rows that are finished either way; everything else is still open pipeline.
const CLOSED_STATUSES = ['Approved', 'Rejected'];
const LOST_DECISIONS = ['Not Interested', 'Competitor Selected'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Tracker text arrives HTML-escaped (middleware/security.js escapes every request string), so a
// saved 'Walk-in' is fine but anything with punctuation would not match its own option. Decode
// before comparing or grouping -- see the "Stored Text Is HTML-Escaped" note in AGENTS.md.
const clean = (value) => decodeEntities((value == null ? '' : String(value))).trim();

const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

// Count `rows` by the value `pick` returns, always emitting every option in `options` (zeros
// included) and appending anything unexpected the database happens to hold.
const distribution = (rows, pick, options) => {
  const counts = new Map(options.map((option) => [option, 0]));
  for (const row of rows) {
    const key = pick(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts, ([name, value]) => ({ name, value }));
};

// Same, but summing estimate value instead of counting rows, and dropping the empty buckets --
// a money chart with nine zero bars reads as broken rather than empty.
const valueDistribution = (rows, pick, options) => {
  const totals = new Map(options.map((option) => [option, 0]));
  for (const row of rows) {
    const key = pick(row);
    if (!key) continue;
    totals.set(key, (totals.get(key) || 0) + toAmount(row.total_amount));
  }
  return Array.from(totals, ([name, value]) => ({ name, value })).filter((entry) => entry.value > 0);
};

// Leads, estimates shared and approvals by the month the lead was created, oldest first. The
// window is the last `months` calendar months including the current one, so an empty month still
// draws a point and the line does not jump across a gap.
const buildTrend = (rows, now, months = 6) => {
  const buckets = [];
  const index = new Map();
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = { month: MONTHS[date.getMonth()], year: date.getFullYear(), leads: 0, estimates: 0, approved: 0 };
    index.set(key, bucket);
    buckets.push(bucket);
  }

  for (const row of rows) {
    if (!row.created_at) continue;
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const bucket = index.get(`${created.getFullYear()}-${created.getMonth()}`);
    if (!bucket) continue;
    const status = clean(row.tracker_status);
    bucket.leads += 1;
    if (SENT_STATUSES.includes(status)) bucket.estimates += 1;
    if (status === 'Approved') bucket.approved += 1;
  }
  return buckets;
};

/**
 * Shape the tracker rows into everything the dashboard draws.
 *
 * @param {Array<object>} rows  Tracked direct estimates, each already carrying the resolved
 *                              `tracker_status` the tracker list shows (effectiveTrackerStatus).
 * @param {object} [options]
 * @param {Date}   [options.now]        Reference date for the trend window; defaults to today.
 * @param {number} [options.trendMonths] How many months the trend covers.
 */
const buildMarketingDashboard = (rows, options = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  const now = options.now instanceof Date ? options.now : new Date();

  const statusOf = (row) => clean(row.tracker_status);
  const decisionOf = (row) => clean(row.customer_decision);

  // The workbook counts Overdue / Due Today / Upcoming off the Due Status column, which is itself
  // derived -- so derive it here too, against one "today" for the whole page rather than letting
  // each row read the clock separately.
  const today = istToday(now);
  const dueOf = (row) => dueStatus(row.next_follow_up_date, clean(row.lead_status), today);

  const totalLeads = list.length;
  const estimatesSent = list.filter((row) => SENT_STATUSES.includes(statusOf(row))).length;
  const approved = list.filter((row) => statusOf(row) === 'Approved').length;
  // Lost covers both the explicit rejection and the customer saying no on a row nobody rejected.
  const notInterested = list.filter(
    (row) => statusOf(row) === 'Rejected' || LOST_DECISIONS.includes(decisionOf(row))
  ).length;
  // The Excel sheet's "Pending Coordinator Review": anything not positively marked reviewed.
  const pendingReview = list.filter((row) => clean(row.coordinator_reviewed) !== 'Yes').length;
  const referralLeads = list.filter((row) => clean(row.lead_source) === 'Referral').length;
  // Rows carrying no follow-up step at all -- they fall out of the pipeline silently otherwise.
  const missingStage = list.filter((row) => !clean(row.follow_up_stage)).length;
  // The workbook's "Missing Next Follow-Up Date": a lead still being chased that nobody has
  // scheduled. A finished lead is meant to have no next date, so it is not a gap.
  const missingNextDate = list.filter(
    (row) => isOpenLead(clean(row.lead_status)) && !toDateOnly(row.next_follow_up_date)
  ).length;

  const overdue = list.filter((row) => dueOf(row) === 'Overdue').length;
  const dueToday = list.filter((row) => dueOf(row) === 'Due Today').length;
  const upcoming = list.filter((row) => dueOf(row) === 'Upcoming').length;
  // Counted off Lead Status, which is what the workbook's Service Started figure reads.
  const serviceStarted = list.filter((row) => clean(row.lead_status) === 'Service Started').length;

  const openRows = list.filter((row) => !CLOSED_STATUSES.includes(statusOf(row)));
  const openValue = openRows.reduce((sum, row) => sum + toAmount(row.total_amount), 0);
  const wonValue = list
    .filter((row) => statusOf(row) === 'Approved')
    .reduce((sum, row) => sum + toAmount(row.total_amount), 0);

  // Each step as a share of the step above it, which is where leads actually leak.
  const steps = [
    { name: 'Total Leads', value: totalLeads },
    { name: 'Estimates Sent', value: estimatesSent },
    { name: 'Approved', value: approved }
  ];
  const funnel = steps.map((step, i) => {
    const previous = i === 0 ? null : steps[i - 1].value;
    return {
      name: step.name,
      value: step.value,
      ofPrevious: previous === null ? null : (previous > 0 ? Math.round((step.value / previous) * 100) : 0),
      ofTotal: totalLeads > 0 ? Math.round((step.value / totalLeads) * 100) : 0
    };
  });

  return {
    totals: {
      totalLeads,
      estimatesSent,
      approved,
      notInterested,
      pendingReview,
      referralLeads,
      missingStage,
      missingNextDate,
      overdue,
      dueToday,
      upcoming,
      serviceStarted,
      openValue,
      wonValue,
      // Guarded: an FP with no tracked estimates must read 0%, not NaN%.
      winRate: totalLeads > 0 ? Math.round((approved / totalLeads) * 100) : 0
    },
    funnel,
    byFollowUpStage: distribution(list, (row) => clean(row.follow_up_stage), FOLLOW_UP_STAGES),
    // The workbook's two headline breakdowns, now that the tracker records them.
    byLeadStatus: distribution(list, (row) => clean(row.lead_status), LEAD_STATUSES),
    byNextAction: distribution(list, (row) => clean(row.next_action), NEXT_ACTIONS),
    byDueStatus: distribution(list, dueOf, DUE_STATUSES),
    byTrackerStatus: distribution(list, statusOf, TRACKER_STATUSES),
    byLeadSource: distribution(list, (row) => clean(row.lead_source), LEAD_SOURCES),
    byPriority: distribution(list, (row) => clean(row.priority), PRIORITIES),
    byDecision: distribution(list, decisionOf, CUSTOMER_DECISIONS),
    // Property type is a stored code (apartment, gated_community ...); the portal labels it.
    byPropertyType: distribution(list, (row) => clean(row.property_type), []),
    valueByStatus: valueDistribution(list, statusOf, TRACKER_STATUSES),
    trend: buildTrend(list, now, options.trendMonths)
  };
};

module.exports = {
  LEAD_SOURCES,
  PRIORITIES,
  CUSTOMER_DECISIONS,
  TRACKER_STATUSES,
  MANUAL_TRACKER_STATUSES,
  FOLLOW_UP_STAGES,
  SENT_STATUSES,
  CLOSED_STATUSES,
  buildMarketingDashboard
};
