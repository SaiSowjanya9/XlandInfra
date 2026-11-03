/**
 * A customer's phone number must never be the reason an invoice has no payment link.
 *
 * Production log: "Error creating payment link: Recurring digits in customer contact are
 * disallowed" — Razorpay refusing a stored number like 9000000042 and, with it, the entire
 * request. No link was created, so the invoice email went out with no Pay Now target and card
 * and UPI were unavailable on an otherwise payable invoice.
 *
 * Run: node --test backend/utils/razorpayPaymentLink.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { razorpayContact, razorpayCustomer, createPaymentLink } = require('./razorpayPaymentLink');

test('a contact is normalised to what Razorpay accepts, or dropped', () => {
  // Stored the way staff and importers write them
  assert.equal(razorpayContact('9876543210'), '+919876543210');
  assert.equal(razorpayContact('+91 98765-43210'), '+919876543210');
  assert.equal(razorpayContact('091 9876543210'), '+919876543210');
  assert.equal(razorpayContact('09876543210'), '+919876543210');

  // Refused outright: the empty string routes/customers.js used to send for a customer with no
  // phone, a landline or truncated number, and the placeholder digits Razorpay's check rejects
  for (const bad of ['', null, undefined, '  ', '12345', '5551234567', '9000000042', '9999999999']) {
    assert.equal(razorpayContact(bad), null, `kept ${JSON.stringify(bad)}`);
  }
  // A run short of the threshold is a real number and stays
  assert.equal(razorpayContact('9000004242'), '+919000004242');
});

test('the customer block carries only what Razorpay will accept', () => {
  assert.deepEqual(
    razorpayCustomer({ name: 'Gaurav Kumar', email: 'g@example.com', contact: '98765 43210' }),
    { name: 'Gaurav Kumar', email: 'g@example.com', contact: '+919876543210' }
  );
  // A refused contact or a malformed email leaves the field off rather than the link uncreated
  assert.deepEqual(
    razorpayCustomer({ name: '', email: 'not-an-email', contact: '9000000042' }),
    { name: 'Customer' }
  );
});

const refusal = (description, field) => {
  const error = new Error(description);
  error.error = { code: 'BAD_REQUEST_ERROR', description, field };
  return error;
};

const fakeRazorpay = (refuseOn) => {
  const attempts = [];
  return {
    attempts,
    paymentLink: {
      create: async (options) => {
        attempts.push(options);
        const offending = refuseOn.find(f => options.customer?.[f] !== undefined);
        if (offending) throw refusal(`Recurring digits in customer ${offending} are disallowed`, offending);
        return { id: 'plink_test', short_url: 'https://rzp.io/i/test' };
      }
    }
  };
};

const options = () => ({
  amount: 102898,
  customer: { name: 'KKR Buildings', email: 'kkr@example.com', contact: '+919000000042' },
  notify: { sms: false, email: false }
});

test('a refused contact is dropped and the link is created without it', async () => {
  const razorpay = fakeRazorpay(['contact']);
  const link = await createPaymentLink(razorpay, options());

  assert.equal(link.short_url, 'https://rzp.io/i/test');
  assert.equal(razorpay.attempts.length, 2);
  assert.equal(razorpay.attempts[1].customer.contact, undefined);
  // Everything else survives: the email, the name, and the notification decision
  assert.equal(razorpay.attempts[1].customer.email, 'kkr@example.com');
  assert.equal(razorpay.attempts[1].customer.name, 'KKR Buildings');
  assert.deepEqual(razorpay.attempts[1].notify, { sms: false, email: false });
  // The caller's own options object is not mutated
  assert.equal(razorpay.attempts[0].customer.contact, '+919000000042');
});

test('both fields can go before the link is given up on', async () => {
  const razorpay = fakeRazorpay(['contact', 'email']);
  const link = await createPaymentLink(razorpay, options());
  assert.equal(link.id, 'plink_test');
  assert.equal(razorpay.attempts.length, 3);
  assert.deepEqual(razorpay.attempts[2].customer, { name: 'KKR Buildings' });
});

test('a refusal that no customer field explains still reaches the caller', async () => {
  const razorpay = {
    attempts: 0,
    paymentLink: {
      create: async () => {
        razorpay.attempts++;
        throw refusal('The amount must be at least INR 1.00', 'amount');
      }
    }
  };
  await assert.rejects(() => createPaymentLink(razorpay, options()), /at least INR 1.00/);
  assert.equal(razorpay.attempts, 1, 'retried an error it could not fix');
});
