/**
 * One date format for the whole portal: dd/mm/yyyy, in IST.
 *
 * `formatDate` had been redefined in fifty separate files, and they disagreed -- 33 rendered
 * "05 Aug 2026", 43 used the en-US locale and so put the month first ("Aug 5, 2026"), nine were
 * already dd/mm/yyyy and nine were the bare locale default. The same record therefore read
 * differently depending on which screen you opened it from.
 *
 * Timezone matters as much as order here, and the old helpers got it wrong in a way that only
 * shows up away from India: `new Date('2026-08-05')` is parsed as **UTC** midnight, and
 * `toLocaleDateString` then renders it in the browser's timezone -- which is the previous day
 * anywhere west of UTC. A date-only value has no time to convert, so it is formatted from its own
 * digits and never goes through a Date at all; a real timestamp is rendered in Asia/Kolkata
 * explicitly, rather than in whatever zone the viewer's laptop is set to.
 *
 * This mirrors the server-side rule in backend/utils/marketingFollowUp.js (`toDateOnly`,
 * `istToday`), which exists for the same reason.
 *
 * Regression test: node --test admin-portal/src/utils/dateFormat.test.js
 */

const IST_TIME_ZONE = 'Asia/Kolkata';

// 'YYYY-MM-DD' or 'YYYY-MM-DDT...' -- the shapes MySQL and our own APIs return for a DATE column.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/;

const pad = (n) => String(n).padStart(2, '0');

/**
 * The calendar day of a value, as { year, month, day } -- or null if there isn't one.
 * A date-only string is read from its digits. Everything else is resolved in IST.
 */
const istParts = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'string') {
    const match = value.match(DATE_ONLY);
    // A bare date, or a timestamp at midnight, is a calendar day: no conversion, no day-shift.
    if (match && (value.length === 10 || /T00:00:00/.test(value))) {
      return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  // Intl is the only way to ask "what day is it in India" without hand-rolling the offset.
  const [{ value: d }, , { value: m }, , { value: y }] = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(date);
  return { year: Number(y), month: Number(m), day: Number(d) };
};

/**
 * dd/mm/yyyy, the portal's one display format.
 * Empty and unparseable values answer the fallback, which is what the fifty local copies did.
 */
export const formatDate = (value, fallback = '-') => {
  const parts = istParts(value);
  if (!parts) return fallback;
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "May 2026" -- the label of a month on every chart axis and tooltip.
 * A Date is read in local time, because the charts build their month buckets with
 * `new Date(year, month, 1)`; a string goes through the same IST rule as `formatDate`.
 */
export const formatMonthYear = (value, fallback = '-') => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : `${MONTHS_SHORT[value.getMonth()]} ${value.getFullYear()}`;
  }
  const parts = istParts(value);
  return parts ? `${MONTHS_SHORT[parts.month - 1]} ${parts.year}` : fallback;
};

/**
 * dd/mm/yyyy, h:mm am/pm -- for the screens that show a time as well. Always IST.
 *
 * The clock stays 12-hour because that is what those screens already showed; only the date part
 * of their output changes. Switching them to 24-hour at the same time would be a second change
 * nobody asked for.
 */
export const formatDateTime = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(date);
  return `${formatDate(value, fallback)}, ${time}`;
};

/**
 * h:mm am/pm, in IST -- for a screen that puts the time on its own line under the date, rather
 * than in one `dd/mm/yyyy, h:mm am` string. Same clock as `formatDateTime`, same timezone.
 */
export const formatTime = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(date);
};

/**
 * 'yyyy-mm-dd' for a date field's value and for the API.
 * This is the wire format everywhere -- the server stores DATE columns and every existing change
 * handler already expects it.
 */
export const toDateInputValue = (value) => {
  const parts = istParts(value);
  if (!parts) return '';
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

/**
 * What to show in a text box as the user types: digits only, with the slashes inserted for them,
 * never more than dd/mm/yyyy. Returning the typed text unchanged would let '5-8-26' through.
 */
export const maskTypedDate = (text) => {
  const digits = String(text ?? '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/**
 * 'dd/mm/yyyy' typed by hand -> 'yyyy-mm-dd', or '' when it is not a real calendar day.
 * 31/02 is rejected rather than rolled forward to 3 March, which `new Date` would do silently.
 */
export const parseTypedDate = (text) => {
  const match = String(text ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return '';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** dd/mm/yyyy for a value held as yyyy-mm-dd -- the text a date field displays. */
export const toTypedDate = (value) => {
  const parts = istParts(value);
  if (!parts) return '';
  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}`;
};

/** Today in IST, as yyyy-mm-dd -- for `min`/`max` and for defaulting a field. */
export const istTodayValue = () => toDateInputValue(new Date());

export const DATE_PLACEHOLDER = 'dd/mm/yyyy';
