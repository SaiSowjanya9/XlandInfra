// Partial-payment splits, as the payment screens state them. The rules are in
// backend/utils/halfPayment.js — this is its mirror, because the server computes every amount it
// is actually asked to charge and a browser cannot require a CommonJS module.
// halfPayment.test.js compares the two against each other.
const SERVICE_PERIOD_MONTHS = 6;
const SECOND_HALF_LEAD_DAYS = 30;
const MIN_INSTALMENT = 1;

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// A 'YYYY-MM-DD' is the day it says, not `new Date(...)`'s local reading of it — west of UTC that
// lands on the evening before and moves the whole plan back a day
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
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

// Clamped to the end of the shorter month: 31 Aug + 6 months is 28 Feb, never 3 March
const addMonths = (date, months) => {
  const day = date.getUTCDate();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  shifted.setUTCDate(Math.min(day, lastDay));
  return shifted;
};

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const isoDate = date => date.toISOString().slice(0, 10);

export const splitPaymentPlan = (balance, firstAmount, from = new Date()) => {
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
    nextPeriodStart: isoDate(nextPeriodStart),
    secondDueDate: isoDate(addDays(nextPeriodStart, -SECOND_HALF_LEAD_DAYS))
  };
};

export const halfPaymentPlan = (balance, from = new Date()) =>
  splitPaymentPlan(balance, round2(balance) / 2, from);

// "02 Mar 2027", the way the payment screens write every other date
export const formatPlanDate = value => {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
};

// What a part payment says about itself, so the remainder is traceable from the payment record
// rather than only from the screen that took it. The server writes its own version of this
// sentence (in ISO dates) for the history; this one is read by people, so it carries the dates as
// they are shown on screen.
export const halfPaymentRemark = plan => plan
  ? `Part payment of ₹${plan.firstAmount.toLocaleString('en-IN')}. The remaining ₹${plan.secondAmount.toLocaleString('en-IN')} is due by ${formatPlanDate(plan.secondDueDate)}, before the next 6-month service period starts on ${formatPlanDate(plan.nextPeriodStart)}.`
  : '';

export { SERVICE_PERIOD_MONTHS, SECOND_HALF_LEAD_DAYS, MIN_INSTALMENT };
