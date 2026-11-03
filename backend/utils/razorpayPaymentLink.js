/**
 * Creating a Razorpay payment link, and the customer block handed to it.
 *
 * Razorpay validates `customer.contact` and refuses the whole request when it does not like it —
 * the live log shows "Error creating payment link: Recurring digits in customer contact are
 * disallowed", its anti-spam check firing on a number like 9000000042. The documented rules
 * reject more: at least 8 digits including the country code, and digits with an optional leading
 * `+` only, so a stored "+91 98765-43210" or the empty string `routes/customers.js` passed when
 * a customer had no phone are refused as well.
 *
 * A refused contact cost the customer the entire payment. The link was never created, so the
 * invoice email went out with no Pay Now target, `/public/payment-link` had nothing to hand the
 * payment page, and card and UPI were simply unavailable on an invoice that was otherwise fine.
 *
 * A contact is a convenience — Razorpay's hosted page asks for one itself — so it is normalised
 * here and dropped when it cannot be made valid, and `createPaymentLink` drops whichever field
 * Razorpay names and retries rather than letting a phone number stop a payment.
 */

// Which of the customer block's fields may be sacrificed to get a link created at all. The name
// is not among them: it is never the reason a request is refused, and it is what the customer
// sees on the hosted page.
const DROPPABLE = ['contact', 'email'];

/**
 * `+91XXXXXXXXXX` for a storable Indian mobile, or null for anything Razorpay would refuse:
 * punctuation and spaces are stripped, a country code or trunk zero is folded away, and a number
 * that is not a mobile — or is the kind of placeholder the anti-spam check rejects — is dropped.
 */
const razorpayContact = (raw) => {
  // A trunk zero can sit on either side of the country code ("091 98765 43210"), and a mobile
  // never begins with one, so leading zeros are stripped before and after folding the 91 away
  let digits = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2).replace(/^0+/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  // Six of the same digit in a row is 9000000042 and its relatives: staff placeholder data that
  // Razorpay refuses outright. Dropping it here saves the round trip the retry below would make.
  if (/(\d)\1{5,}/.test(digits)) return null;
  return `+91${digits}`;
};

const razorpayEmail = (raw) => {
  const email = String(raw ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

/** The `customer` block for a payment link, carrying only what Razorpay will accept. */
const razorpayCustomer = ({ name, email, contact }) => {
  const block = { name: String(name || '').trim() || 'Customer' };
  const cleanEmail = razorpayEmail(email);
  const cleanContact = razorpayContact(contact);
  if (cleanEmail) block.email = cleanEmail;
  if (cleanContact) block.contact = cleanContact;
  return block;
};

const refusalText = (error) =>
  `${error?.error?.field || ''} ${error?.error?.description || error?.message || ''}`;

/**
 * Create the link, and when Razorpay refuses it over a customer field, create it without that
 * field instead. Each pass drops at most one field and the loop ends on a success or on a
 * refusal that naming a field cannot explain, so a genuine error still reaches the caller.
 */
const createPaymentLink = async (razorpay, options) => {
  const dropped = [];
  for (;;) {
    // A fresh object per attempt: the caller's options are never touched, and nothing that kept
    // a reference to one attempt sees the next one's fields disappear from under it
    const customer = { ...(options.customer || {}) };
    for (const field of dropped) delete customer[field];
    try {
      return await razorpay.paymentLink.create({ ...options, customer });
    } catch (error) {
      const text = refusalText(error);
      const field = DROPPABLE.find(f =>
        !dropped.includes(f) && customer[f] && new RegExp(f, 'i').test(text));
      if (!field) throw error;
      dropped.push(field);
      console.warn(`⚠️ Razorpay refused customer.${field} (${text.trim()}) - retrying without it`);
    }
  }
};

module.exports = { razorpayContact, razorpayEmail, razorpayCustomer, createPaymentLink };
