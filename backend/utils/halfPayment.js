/**
 * Partial-payment splits.
 *
 * A part payment against an invoice always means the same thing: some amount now, the rest before
 * the next six-month service period begins — "at least 30 days before", so the remainder falls due
 * a month ahead of that period, not on the day it starts. The amount due now is either a share of
 * the balance ('25', '50'/'half', '75' — '100' is simply a full payment) or a custom amount the
 * caller names.
 *
 * Every figure is derived from the balance read from the invoice and the date the first part is
 * paid, so no invoice column carries an instalment plan and nothing has to be migrated or kept in
 * step. A custom amount is validated against that same balance — it can never exceed what is owed,
 * so the worst a caller can do is underpay, not name a bigger charge.
 *
 * Mirrored by admin-portal/src/utils/halfPayment.js, which is what the two payment screens use;
 * admin-portal/src/utils/halfPayment.test.js compares the two implementations.
 */
const SERVICE_PERIOD_MONTHS = 6;
// The policy's notice period: the remainder is due this many days before the next period
const SECOND_HALF_LEAD_DAYS = 30;
// Razorpay refuses anything under ₹1, so neither side of a split can fall below it
const MIN_INSTALMENT = 1;
// The shares offered as percentages, keyed by the exact portion string a request may send
const PORTION_SHARES = { '25': 0.25, '50': 0.5, '75': 0.75, half: 0.5 };

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
 * The plan for paying `firstAmount` of `balance` now and the rest later.
 *
 * Returns null where the split cannot stand — nothing owed, a first payment under Razorpay's ₹1
 * floor, or a remainder under it — so a caller offers the option only when it is actually
 * available.
 *
 * `firstAmount` and `secondAmount` always add back up to the balance exactly: the first takes the
 * rounded figure and the second takes whatever is left, so ₹1,000.01 split at 500.01 is
 * 500.01 + 500.00 rather than two parts that leave a paisa of debt behind.
 */
const splitPaymentPlan = (balance, firstAmount, from = new Date()) => {
  const total = round2(balance);
  const first = round2(firstAmount);
  const start = toUTCDate(from);
  if (!Number.isFinite(total) || !Number.isFinite(first) || !start) return null;
  const secondAmount = round2(total - first);
  if (first < MIN_INSTALMENT || secondAmount < MIN_INSTALMENT) return null;
  const nextPeriodStart = addMonths(start, SERVICE_PERIOD_MONTHS);
  return {
    firstAmount: first,
    secondAmount,
    // When the service period the remainder pays for begins
    nextPeriodStart: isoDate(nextPeriodStart),
    // When the remainder has to be paid by: 30 days before that, per the policy
    secondDueDate: isoDate(addDays(nextPeriodStart, -SECOND_HALF_LEAD_DAYS))
  };
};

// The original fixed split: half now, half later. Kept as the named entry point every caller and
// the mirrored test already use.
const halfPaymentPlan = (balance, from = new Date()) =>
  splitPaymentPlan(balance, round2(balance) / 2, from);

/**
 * What a request asking for a part payment is actually charged.
 *
 * `portion` is one of the strings in PORTION_SHARES ('25', '50', 'half', '75') or 'custom' with a
 * `customAmount`. A percentage is worked out from the balance the route has just read — it is a
 * share, not an amount, so nothing typed can inflate it. A custom amount is taken from the request
 * but never trusted: it must be a number, at least ₹1, and leave either nothing (a full payment)
 * or at least ₹1 behind. Anything unrecognised — a stray number, '50%', 'HALF', a missing field —
 * is the whole balance.
 */
const resolvePaymentPortion = (portion, balance, customAmount) => {
  const total = Number(balance);
  if (portion === 'custom') {
    const amount = round2(customAmount);
    if (!Number.isFinite(amount) || amount < MIN_INSTALMENT) {
      return { error: 'A custom amount must be at least ₹1.' };
    }
    // Meeting or exceeding the balance is a full payment wearing a different label
    if (amount >= total) return { amount: total, plan: null };
    const plan = splitPaymentPlan(total, amount);
    if (!plan) {
      return { error: `That amount leaves less than ₹${MIN_INSTALMENT} unpaid — pay a little less, or the full balance.` };
    }
    return { amount: plan.firstAmount, plan };
  }
  const share = PORTION_SHARES[portion];
  if (share) {
    const plan = splitPaymentPlan(total, total * share);
    if (!plan) return { error: 'This balance is too small to split into two payments.' };
    return { amount: plan.firstAmount, plan };
  }
  return { amount: total, plan: null };
};

// What the payment record and the history row say about a part payment, so the remainder is
// traceable from the payment itself rather than only from the screen that took it
const halfPaymentNote = plan => plan
  ? ` Part payment of ₹${plan.firstAmount.toLocaleString('en-IN')}; the remaining ₹${plan.secondAmount.toLocaleString('en-IN')} is due by ${plan.secondDueDate}, before the next 6-month service period begins on ${plan.nextPeriodStart}.`
  : '';

module.exports = {
  halfPaymentPlan, splitPaymentPlan, resolvePaymentPortion, halfPaymentNote,
  SERVICE_PERIOD_MONTHS, SECOND_HALF_LEAD_DAYS, MIN_INSTALMENT
};
