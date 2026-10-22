const { decodeEntities } = require('./htmlEntities');

/**
 * What `payments.payment_method` can actually hold, and what the portals may send for it.
 *
 * The column is an ENUM (schema_v17, widened by schema_v20 for 'cheque' and at runtime by
 * utils/paymentColumns.js for 'check' and 'upi'). `POST /payments` used to check only that a
 * method was *present* and then insert it straight into that column, so a value outside the ENUM
 * raised WARN_DATA_TRUNCATED (errno 1265) -- and because the INSERT sits inside the payment's own
 * transaction, the error rolled the whole payment back. A staff member recorded a payment and
 * nothing was saved, exactly as a truncated `payment_history.action` once lost one (see
 * utils/paymentHistoryAction.js).
 *
 * The admin Invoices screen was offering `debit_credit_card`, which is not an ENUM member and
 * never has been, so every card payment recorded from there hit precisely that.
 *
 * Two methods are *current*: everything taken online is `razorpay` (card, net banking, UPI and
 * wallet alike -- the instrument is in `payment_history.payment_method_details`), and the offline
 * ones are cash, cheque and bank transfer. The rest of the ENUM is kept ACCEPTED, not offered: old
 * rows hold those values and must stay readable, and refusing one would turn a working screen into
 * a 400.
 */

// Everything taken through Razorpay, whatever the customer actually used
const ONLINE_METHODS = ['razorpay'];

// What staff and the customer's own page can record by hand. routes/customers.js whitelists
// exactly these three for an offline payment intent.
const OFFLINE_METHODS = ['cash', 'cheque', 'bank_transfer'];

// The methods a new payment should be recorded as -- what a picker may offer
const CURRENT_METHODS = [...ONLINE_METHODS, ...OFFLINE_METHODS];

// Every member the column holds, including the ones nothing writes any more. Order follows
// schema_v17's ENUM so this list reads against the schema.
const STORABLE_METHODS = [
  'cash', 'upi_manual', 'upi_online', 'bank_transfer', 'card_pos', 'razorpay',
  'credit_card', 'debit_card', 'net_banking', 'wallet', 'cheque',
  // Added by utils/paymentColumns.js on a database that never had them
  'check', 'upi'
];

// UI spellings that mean one of the above. 'check' is storable in its own right (paymentColumns
// widens the ENUM for it) but is normalised to the canonical member so one method is not stored
// under two names on a current database.
const ALIASES = {
  check: 'cheque',
  bank: 'bank_transfer',
  // Both Razorpay radios in MakePayments end at the same place
  upi_razorpay: 'razorpay',
  razorpay_link: 'razorpay'
};

/**
 * A requested payment method as the column can hold it, or null where it cannot.
 *
 * Request text arrives HTML-escaped (middleware/security.js), so it is decoded before comparison
 * exactly as the concern options and complaint statuses are.
 */
const normalizePaymentMethod = (value) => {
  const decoded = decodeEntities(String(value || '')).trim().toLowerCase();
  if (!decoded) return null;
  const canonical = ALIASES[decoded] || decoded;
  return STORABLE_METHODS.includes(canonical) ? canonical : null;
};

/**
 * Validate a requested method. `{ error }` is the message to answer with; `{ method }` is what to
 * write. The message names the current methods rather than the whole ENUM -- a caller sending
 * something unstorable wants to know what to send, not what used to be allowed.
 */
const resolvePaymentMethod = (value) => {
  if (!String(value || '').trim()) return { error: 'Payment method is required' };
  const method = normalizePaymentMethod(value);
  if (!method) {
    return { error: `Unsupported payment method. Use one of: ${CURRENT_METHODS.join(', ')}.` };
  }
  return { error: null, method };
};

module.exports = {
  ONLINE_METHODS,
  OFFLINE_METHODS,
  CURRENT_METHODS,
  STORABLE_METHODS,
  ALIASES,
  normalizePaymentMethod,
  resolvePaymentMethod
};
