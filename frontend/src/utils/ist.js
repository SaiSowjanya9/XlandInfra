/**
 * "Today", as the business means it.
 *
 * XLAND runs on IST and the stored day is an IST day, so a browser in another zone -- or a phone
 * whose clock is simply wrong about its region -- must not shift a visit onto the previous date or
 * report an invoice as overdue a day early. `backend/utils/scheduleStats.js` applies the same rule
 * to the counts, so a page and its figures always agree.
 */
const IST_OFFSET_MINUTES = 330;

/** The current IST date as `YYYY-MM-DD`, so days compare as plain strings. */
export const istToday = () => new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000)
  .toISOString()
  .slice(0, 10);

/** The IST day a timestamp or date string falls on, as `YYYY-MM-DD`. */
export const istDay = (value) => {
  if (!value) return '';
  const text = String(value);
  // A bare `YYYY-MM-DD` is already the stored IST day; converting it through a zone is what moves it
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
