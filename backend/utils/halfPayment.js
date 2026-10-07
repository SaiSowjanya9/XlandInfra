/**
 * The half-yearly payment split.
 *
 * The AMC payment policy offers one split and one only: half of the amount due now, and the other
 * half before the next six-month service period begins — "at least 30 days before", so the second
 * instalment falls due a month ahead of that period, not on the day it starts. There is no 25/75,
 * no free-text instalment and no arbitrary percentage: an amount a customer types is an amount
 * nobody agreed to, and the policy is what the signed agreement states.
 *
 * Everything here is derived from the balance and the date the first half is paid, so no invoice
 * column carries an instalment plan and nothing has to be migrated or kept in step.
 *
 * Mirrored by admin-portal/src/utils/halfPayment.js, which is what the two payment screens use;
 * admin-portal/src/utils/halfPayment.test.js compares the two implementations.
 */
const SERVICE_PERIOD_MONTHS = 6;
// The policy's notice period: the second instalment is due this many days before the next period
const SECOND_HALF_LEAD_DAYS = 30;
// Razorpay refuses anything under ₹1, so an invoice below ₹2 cannot be halved at all
const MIN_INSTALMENT = 1;

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Dates are held as plain calendar days in UTC. A 'YYYY-MM-DD' is read as the day it says and
// never through `new Date(...)`'s local reading of it: west of UTC that lands on the evening
// before, which moved a 01 Oct payment's next period to 30 March instead of 01 April.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const toUTCDate = value => {
  if (typeof value === 'string') {
    const parts = DATE_ONLY.exec(value.trim());
    if (parts) {
      const [, year, month, day] = parts.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // A Date is a moment, so the calendar day it falls on is the local one — "today" for whoever is
  // taking the payment
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

// Six months on, clamped to the end of the shorter month: 31 Aug + 6 months is 28 Feb (29 in a
// leap year), never 3 March, which is what `setMonth` alone would give.
const addMonths = (date, months) => {
  const day = date.getUTCDate();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted;
};

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const isoDate = date => date.toISOString().slice(0, 10);

/**
 * The plan for paying `balance` in two halves, the first of them on `from`.
 *
 * Returns null where the balance cannot be split — nothing owed, or so little that half of it is
 * under Razorpay's floor — so a caller offers the option only when it is actually available.
 *
 * `firstAmount` and `secondAmount` always add back up to the balance exactly: the first takes the
 * rounded half and the second takes whatever is left, so ₹1,000.01 is 500.01 + 500.00 rather than
 * two halves that leave a paisa of debt behind.
 */
const halfPaymentPlan = (balance, from = new Date()) => {
  const total = round2(balance);
  const start = toUTCDate(from);
  if (!Number.isFinite(total) || !start) return null;
  const firstAmount = round2(total / 2);
  const secondAmount = round2(total - firstAmount);
  if (firstAmount < MIN_INSTALMENT || secondAmount < MIN_INSTALMENT) return null;
  const nextPeriodStart = addMonths(start, SERVICE_PERIOD_MONTHS);
  return {
    firstAmount,
    secondAmount,
    // When the service period the second half pays for begins
    nextPeriodStart: isoDate(nextPeriodStart),
    // When the second half has to be paid by: 30 days before that, per the policy
    secondDueDate: isoDate(addDays(nextPeriodStart, -SECOND_HALF_LEAD_DAYS))
  };
};

/**
 * What a request asking to pay in two halves is actually charged.
 *
 * The amount is never taken from the request: a caller asks for 'half' or for nothing at all, and
 * the figure is worked out from the balance the route has just read. A payment screen that could
 * post its own amount is a payment screen that can be asked to charge ₹1 for a ₹20,000 invoice,
 * and the customer's page has no login behind it. Anything other than the exact string 'half' —
 * a number, '50', 'full', a missing field — is the whole balance.
 */
const resolvePaymentPortion = (portion, balance) => {
  if (portion !== 'half') return { amount: Number(balance), plan: null };
  const plan = halfPaymentPlan(balance);
  if (!plan) return { error: 'This balance is too small to split into two payments.' };
  return { amount: plan.firstAmount, plan };
};

// What the payment record and the history row say about an instalment, so the second half is
// traceable from the payment itself rather than only from the screen that took it
const halfPaymentNote = plan => plan
  ? ` First of two half-yearly payments; the remaining ₹${plan.secondAmount.toLocaleString('en-IN')} is due by ${plan.secondDueDate}, before the next 6-month service period begins on ${plan.nextPeriodStart}.`
  : '';

module.exports = {
  halfPaymentPlan, resolvePaymentPortion, halfPaymentNote,
  SERVICE_PERIOD_MONTHS, SECOND_HALF_LEAD_DAYS, MIN_INSTALMENT
};
