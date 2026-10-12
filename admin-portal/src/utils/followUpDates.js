// Marketing tracker follow-up fields, as the tracker screen states them. The rules are in
// backend/utils/marketingFollowUp.js — this is its mirror, because the server validates and
// derives everything it is actually asked to store and a browser cannot require a CommonJS
// module. followUpDates.test.js compares the two against each other.
//
// The option lists are the workbook's Dropdown Lists sheet verbatim and the Due Status rule is its
// column U formula; the blank test comes before the completed test, so a finished lead with no
// next date still reads "No Date".

export const LEAD_STATUSES = [
  'New Visit Completed', 'Thank You Sent', 'Estimate Sent', 'Follow-Up 1 Sent', 'Follow-Up 2 Sent',
  'No Response - Call', 'No Response - Visit', 'Customer Review', 'Changes Requested',
  'Revised Estimate Sent', 'Customer Approved', 'Agreement Pending', 'Payment Pending',
  'Onboarding Pending', 'Service Started', 'Follow-Up Later', 'Not Interested', 'Closed'
];

export const CONTACT_METHODS = ['WhatsApp', 'SMS/Text', 'Email', 'Phone Call', 'Field Visit', 'Portal Message', 'Other'];

export const CUSTOMER_RESPONSES = [
  'Received - Reviewing', 'Interested', 'Need Changes', 'Need Call Back', 'Need More Details',
  'Approved', 'Not Ready Now', 'No Response', 'Not Interested'
];

export const NEXT_ACTIONS = [
  'Coordinator Review', 'Send Thank You Message', 'Share Estimate', 'Send Follow-Up 1',
  'Send Follow-Up 2', 'Executive Call', 'Executive Visit', 'Revise Estimate', 'Send Agreement',
  'Collect Payment', 'Onboard Property', 'Start Service', 'Follow-Up Later', 'Close Lead'
];

export const DUE_STATUSES = ['No Date', 'Overdue', 'Due Today', 'Upcoming', 'Completed'];

export const COMPLETED_LEAD_STATUSES = ['Closed', 'Service Started', 'Not Interested'];

export const FOLLOW_UP_INTERVAL_DAYS = 4;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

// Today in India. The person using the tracker is in IST whatever the browser's clock is set to,
// so a laptop left on another timezone must not stamp a contact with the wrong day.
export const istToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);

// Normalise to 'YYYY-MM-DD', or '' when there is no date. A Date is read by its local components:
// the API sends a date-only string, but a Date that reached here from JSON must not be shifted by
// toISOString() the way it would be east of UTC.
export const toDateOnly = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const text = String(value).trim();
  if (!text) return '';
  if (ISO_DATE.test(text)) return text;
  if (ISO_DATE.test(text.slice(0, 10))) return text.slice(0, 10);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

// Whole-day arithmetic in UTC, so no zone can shift the result across a boundary.
export const addDays = (date, days) => {
  const base = toDateOnly(date);
  if (!base) return '';
  const [y, m, d] = base.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

export const nextFollowUpFrom = (lastContactDate) => addDays(lastContactDate, FOLLOW_UP_INTERVAL_DAYS);

export const dueStatus = (nextFollowUpDate, leadStatus, today = istToday()) => {
  const next = toDateOnly(nextFollowUpDate);
  if (!next) return 'No Date';
  if (COMPLETED_LEAD_STATUSES.includes(String(leadStatus || '').trim())) return 'Completed';
  if (next < today) return 'Overdue';
  if (next === today) return 'Due Today';
  return 'Upcoming';
};

export const isOpenLead = (leadStatus) => !COMPLETED_LEAD_STATUSES.includes(String(leadStatus || '').trim());

// Picking a follow-up stage is a contact: it stamps today and schedules the next one four days
// out. Returned as a patch so the caller can merge it into whatever else the row is saving.
export const contactStamp = (now = new Date()) => {
  const last = istToday(now);
  return { last_contact_date: last, next_follow_up_date: nextFollowUpFrom(last) };
};

// How a due status is drawn. Overdue has to be the loud one — it is the only state that means
// somebody is late.
export const DUE_STATUS_STYLES = {
  'Overdue': 'bg-red-50 text-red-700 border-red-200',
  'Due Today': 'bg-warm-warning text-amber-700 border-[#F3E2B3]',
  'Upcoming': 'bg-warm-info text-blue-700 border-[#D5E3FA]',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'No Date': 'bg-gray-50 text-gray-500 border-gray-200'
};
