// Marketing tracker follow-up fields.
//
// The columns after Follow-Up Stage on the tracker -- Lead Status, Last Contact Date / Method,
// Customer Response, Next Follow-Up Date, Next Action and the derived Due Status -- come from the
// "Xland PM - Marketing Follow-Up Tracker" workbook. The option lists are its Dropdown Lists sheet
// verbatim and the Due Status rule is its column U formula, reproduced exactly:
//
//   =IF(S="","No Date",
//      IF(OR(O="Closed",O="Service Started",O="Not Interested"),"Completed",
//         IF(S<TODAY(),"Overdue",IF(S=TODAY(),"Due Today","Upcoming"))))
//
// Note the order: a row with no next date reads "No Date" even when the lead is closed, because
// the blank test comes first. Getting that backwards would quietly reclassify every finished lead.
//
// Due Status is never stored -- it is derived on read, so it cannot go stale the day after it was
// written. admin-portal/src/utils/followUpDates.js mirrors this file for the tracker screen and
// its test compares the two, the same arrangement utils/halfPayment.js uses.

const LEAD_STATUSES = [
  'New Visit Completed', 'Thank You Sent', 'Estimate Sent', 'Follow-Up 1 Sent', 'Follow-Up 2 Sent',
  'No Response - Call', 'No Response - Visit', 'Customer Review', 'Changes Requested',
  'Revised Estimate Sent', 'Customer Approved', 'Agreement Pending', 'Payment Pending',
  'Onboarding Pending', 'Service Started', 'Follow-Up Later', 'Not Interested', 'Closed'
];

const CONTACT_METHODS = ['WhatsApp', 'SMS/Text', 'Email', 'Phone Call', 'Field Visit', 'Portal Message', 'Other'];

// The workbook's list, plus 'Rejected'. The sheet had only 'Approved' because a rejection was
// recorded as 'Not Interested', but the two ends of the estimate's own lifecycle now drive this
// column directly, and "the customer rejected the estimate" is not the same answer as "the
// customer was never interested".
const CUSTOMER_RESPONSES = [
  'Received - Reviewing', 'Interested', 'Need Changes', 'Need Call Back', 'Need More Details',
  'Approved', 'Rejected', 'Not Ready Now', 'No Response', 'Not Interested'
];

// An approved or rejected estimate answers the Customer Response column itself; the FP cannot
// have told us the customer approved while the estimate says rejected. Keyed by fp_estimates.status.
const ESTIMATE_DRIVEN_RESPONSES = { approved: 'Approved', rejected: 'Rejected' };

const NEXT_ACTIONS = [
  'Coordinator Review', 'Send Thank You Message', 'Share Estimate', 'Send Follow-Up 1',
  'Send Follow-Up 2', 'Executive Call', 'Executive Visit', 'Revise Estimate', 'Send Agreement',
  'Collect Payment', 'Onboard Property', 'Start Service', 'Follow-Up Later', 'Close Lead'
];

const DUE_STATUSES = ['No Date', 'Overdue', 'Due Today', 'Upcoming', 'Completed'];

// A lead at one of these is finished; it is not chased and not counted as missing a next date.
const COMPLETED_LEAD_STATUSES = ['Closed', 'Service Started', 'Not Interested'];

// Picking a follow-up stage stamps today and schedules the next contact this many days out.
const FOLLOW_UP_INTERVAL_DAYS = 4;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n) => String(n).padStart(2, '0');

/**
 * Today's calendar date in India, as `YYYY-MM-DD`.
 *
 * The server may run in UTC while the people using the tracker are in IST, and for 5.5 hours
 * either side of midnight those are different dates -- stamping "last contacted" with the server's
 * own date would file an evening visit under yesterday. India has no DST, but the zone is applied
 * through Intl rather than a fixed offset so this stays correct regardless.
 */
const istToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);

/**
 * Normalise anything the database or a form hands us to `YYYY-MM-DD`, or '' when there is no date.
 *
 * mysql2 returns a DATE column as a Date at *local* midnight, so `toISOString()` would roll it
 * back a day for any positive offset -- the whole tracker would read one day early in IST. The
 * local components are the calendar date MySQL stored, so those are what we read.
 */
const toDateOnly = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const text = String(value).trim();
  if (!text) return '';
  if (ISO_DATE.test(text)) return text;
  // An ISO timestamp ('2026-08-05T00:00:00.000Z') carries the date in its first ten characters.
  if (ISO_DATE.test(text.slice(0, 10))) return text.slice(0, 10);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

/** Add whole days to a `YYYY-MM-DD` date. Arithmetic runs in UTC so no zone can shift the result. */
const addDays = (date, days) => {
  const base = toDateOnly(date);
  if (!base) return '';
  const [y, m, d] = base.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

/** The next follow-up a contact on `lastContactDate` schedules. */
const nextFollowUpFrom = (lastContactDate) => addDays(lastContactDate, FOLLOW_UP_INTERVAL_DAYS);

/**
 * The workbook's Due Status, derived rather than stored.
 * @param {*} nextFollowUpDate When the lead is next due to be contacted.
 * @param {string} leadStatus  Where the lead stands; the three finished ones read "Completed".
 * @param {string} [today]     `YYYY-MM-DD`; defaults to today in IST.
 */
const dueStatus = (nextFollowUpDate, leadStatus, today = istToday()) => {
  const next = toDateOnly(nextFollowUpDate);
  if (!next) return 'No Date';
  if (COMPLETED_LEAD_STATUSES.includes(String(leadStatus || '').trim())) return 'Completed';
  // Both sides are zero-padded YYYY-MM-DD, so a string compare is a date compare.
  if (next < today) return 'Overdue';
  if (next === today) return 'Due Today';
  return 'Upcoming';
};

/** An open lead is one still being chased -- the workbook's "Missing Next Follow-Up Date" check. */
const isOpenLead = (leadStatus) => !COMPLETED_LEAD_STATUSES.includes(String(leadStatus || '').trim());

/**
 * Is the Customer Response answered by the estimate rather than by the FP? True once the estimate
 * is approved or rejected, which is when the tracker stops being allowed to disagree with it.
 */
const isCustomerResponseLocked = (estimateStatus) =>
  Object.prototype.hasOwnProperty.call(ESTIMATE_DRIVEN_RESPONSES, String(estimateStatus || '').trim().toLowerCase());

/**
 * The Customer Response the row should show. Derived rather than stored, exactly as the tracker
 * status is: approving an estimate in All Estimates has to move the tracker with it, and a stored
 * copy would only be right until the next time somebody changed the estimate.
 *
 * @param {string} estimateStatus  fp_estimates.status
 * @param {string} storedResponse  what the FP last chose, used while the estimate is still open
 */
const effectiveCustomerResponse = (estimateStatus, storedResponse) => {
  const key = String(estimateStatus || '').trim().toLowerCase();
  return ESTIMATE_DRIVEN_RESPONSES[key] || storedResponse || '';
};

module.exports = {
  LEAD_STATUSES,
  CONTACT_METHODS,
  CUSTOMER_RESPONSES,
  NEXT_ACTIONS,
  DUE_STATUSES,
  COMPLETED_LEAD_STATUSES,
  ESTIMATE_DRIVEN_RESPONSES,
  FOLLOW_UP_INTERVAL_DAYS,
  isCustomerResponseLocked,
  effectiveCustomerResponse,
  istToday,
  toDateOnly,
  addDays,
  nextFollowUpFrom,
  dueStatus,
  isOpenLead
};
