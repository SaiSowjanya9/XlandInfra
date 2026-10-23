/**
 * What has happened on a customer's property, as their home page reads it.
 *
 * Three tables with three shapes -- work orders, invoices and scheduled visits -- are read
 * separately by `GET /api/customers/activity` and merged here, newest first. An activity feed is
 * one list: if the ordering, the status wording or the rule for what counts as activity were
 * re-derived in the browser, the three streams would disagree the first time one of them gained a
 * status, and a customer would read their newest update below an older one.
 *
 * A visit is activity once it has happened; while it is still ahead of today it belongs to the
 * Upcoming Schedules panel instead. `buildCustomerActivity` and `buildUpcomingVisits` split the
 * same rows on that one rule, so no visit can appear in both panels or in neither.
 *
 * Text is decoded here, exactly as `presentCustomerComplaint` decodes in routes/customers.js:
 * middleware/security.js escapes every string a request carries, so a category saved as
 * `Plumbing&#x2F;Major` is stored that way and the customer portal has no `decodeEntities` of its
 * own. This is a display-only projection -- it must never be fed back into a form or an email body,
 * both of which rely on the stored, escaped form.
 */

const { decodeEntities } = require('./htmlEntities');

// A named tone, never a colour. Tailwind is scanned statically, so the portal spells the badge
// classes out against these five names (`ACTIVITY_TONES` in frontend/src/pages/Dashboard.jsx); a
// hex sent from here would render as nothing at all.
const WORK_ORDER_STATUS = {
  pending: ['Pending', 'warning'],
  assigned: ['Assigned', 'info'],
  in_progress: ['In Progress', 'info'],
  under_review: ['Under Review', 'warning'],
  completed: ['Completed', 'success'],
  closed: ['Closed', 'neutral'],
  cancelled: ['Cancelled', 'danger']
};

const INVOICE_STATUS = {
  sent: ['Pending', 'warning'],
  pending: ['Pending', 'warning'],
  partially_paid: ['Partially Paid', 'info'],
  paid: ['Paid', 'success'],
  overdue: ['Overdue', 'danger'],
  cancelled: ['Cancelled', 'danger']
};

const VISIT_STATUS = {
  scheduled: ['Scheduled', 'info'],
  confirmed: ['Confirmed', 'info'],
  // Not in the schema's ENUM but written by the schedulers, and the Schedules page reads it too
  work_order_created: ['Work Order Created', 'info'],
  in_progress: ['In Progress', 'info'],
  completed: ['Completed', 'success'],
  rescheduled: ['Rescheduled', 'warning'],
  cancelled: ['Cancelled', 'danger'],
  missed: ['Missed', 'danger']
};

// A visit that is over, whatever its date says
const CONCLUDED_VISIT = new Set(['completed', 'cancelled', 'missed']);

const titleCase = value => String(value || '')
  .split(/[_\s]+/)
  .filter(Boolean)
  .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
  .join(' ');

// An unknown status still reads as something: these ENUMs have each gained a member before
// (payment_history.action, fp_employees.role), and a blank badge says nothing at all.
const present = (map, status) => {
  const known = map[String(status || '').toLowerCase()];
  return known
    ? { statusLabel: known[0], tone: known[1] }
    : { statusLabel: titleCase(status) || 'Updated', tone: 'neutral' };
};

/**
 * The IST day a value falls on, as `YYYY-MM-DD`, so days compare as plain strings.
 * A DATE column read without `dateStrings` arrives as a Date at the server's local midnight, so its
 * local components are the stored day -- reformatting such a value through a UTC offset is what
 * slides a visit onto the previous date.
 */
const dayOf = value => {
  if (!value) return '';
  if (value instanceof Date) {
    const pad = part => String(part).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};

const istToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);

// Sort key. A bare `YYYY-MM-DD` is the stored IST day, anchored at midday so neither a UTC parse
// nor a timestamp later the same day can reorder it past a neighbouring date.
const timeValue = value => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const text = String(value);
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00+05:30` : text);
  return Number.isFinite(ms) ? ms : 0;
};

const workOrderActivity = row => ({
  key: `work_order-${row.id}`,
  type: 'work_order',
  refId: row.id,
  reference: decodeEntities(row.work_order_id || ''),
  title: 'Work Order',
  subtitle: decodeEntities(row.category_name || row.description || '') || 'Service request',
  status: String(row.status || '').toLowerCase(),
  ...present(WORK_ORDER_STATUS, row.status),
  at: row.completed_at || row.updated_at || row.created_at || null
});

// `paid_at` is read defensively: it is created by schema_v53 and was missing from every deployment
// before it (see AGENTS.md), so where the column is absent the row simply has no such key and the
// invoice is dated by when it was sent.
const invoiceActivity = row => {
  const reference = decodeEntities(row.invoice_id || '');
  return {
    key: `invoice-${row.id}`,
    type: 'payment',
    refId: row.id,
    reference,
    title: 'Payment',
    subtitle: reference ? `Invoice ${reference}` : 'Invoice',
    status: String(row.status || '').toLowerCase(),
    ...present(INVOICE_STATUS, row.status),
    at: row.paid_at || row.sent_at || row.created_at || null
  };
};

const visitActivity = row => ({
  key: `visit-${row.id}`,
  type: 'schedule',
  refId: row.id,
  reference: decodeEntities(row.visit_id || ''),
  title: 'Schedule',
  subtitle: decodeEntities(row.service_name || '') || 'Scheduled visit',
  status: String(row.status || '').toLowerCase(),
  ...present(VISIT_STATUS, row.status),
  at: dayOf(row.scheduled_date) || null
});

const isConcluded = row => CONCLUDED_VISIT.has(String(row.status || '').toLowerCase());

const buildCustomerActivity = (
  { workOrders = [], invoices = [], visits = [] } = {},
  { limit = 8, today = istToday(), type = null } = {}
) => {
  const items = [
    ...workOrders.map(workOrderActivity),
    // A draft invoice sits in Generated Invoices awaiting review; the customer has never seen it.
    ...invoices.filter(row => String(row.status || '').toLowerCase() !== 'draft').map(invoiceActivity),
    ...visits.filter(row => isConcluded(row) || dayOf(row.scheduled_date) < today).map(visitActivity)
  ];

  // `type` narrows the merged feed to one stream (the Work Orders panel's Activity tab reads work
  // orders only). It filters before the slice: a limited mixed feed would otherwise hold so few of
  // the asked-for kind that the tab could come back empty while the order exists.
  return items
    .filter(item => !type || item.type === type)
    .sort((a, b) => timeValue(b.at) - timeValue(a.at))
    .slice(0, Math.max(0, limit));
};

const buildUpcomingVisits = (visits = [], { limit = 5, today = istToday() } = {}) => visits
  .filter(row => !isConcluded(row) && dayOf(row.scheduled_date) >= today)
  .map(row => ({
    id: row.id,
    visitId: decodeEntities(row.visit_id || ''),
    serviceName: decodeEntities(row.service_name || '') || 'Scheduled visit',
    vendorName: decodeEntities(row.vendor_name || ''),
    scheduledDate: dayOf(row.scheduled_date),
    scheduledTimeStart: row.scheduled_time_start || null,
    scheduledTimeEnd: row.scheduled_time_end || null,
    status: String(row.status || '').toLowerCase(),
    ...present(VISIT_STATUS, row.status)
  }))
  .sort((a, b) => (
    a.scheduledDate.localeCompare(b.scheduledDate)
    || String(a.scheduledTimeStart || '').localeCompare(String(b.scheduledTimeStart || ''))
  ))
  .slice(0, Math.max(0, limit));

module.exports = {
  buildCustomerActivity,
  buildUpcomingVisits,
  workOrderActivity,
  invoiceActivity,
  visitActivity,
  istToday
};
