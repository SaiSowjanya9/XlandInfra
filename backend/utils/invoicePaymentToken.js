/**
 * The token on a customer's payment link, and the one place the link itself is built.
 *
 * The invoice email's Pay Now button goes to `<FRONTEND_URL>/pay/<invoice_id>`, and the public
 * endpoints behind that page have no login to authorise against: the link's own token is the
 * authorisation. Three things made that unworkable, and every offline payment started from an
 * invoice email was lost to them:
 *
 *  - the emailed URL carried no token at all, so `POST /public/record-payment-intent` answered
 *    400 ("Invoice ID, token, and payment method are required") and the page swallowed it — the
 *    customer read the bank details while staff were shown no pending payment to verify;
 *  - the token the other flows mint, `generatePaymentToken`, expires after 30 minutes, which is
 *    no use in a message about an invoice due in 14 days;
 *  - its hash lands in the single `invoices.payment_token_hash` column that `/generate-qr-token`
 *    also writes, so whichever ran last silently killed the other's link.
 *
 * This token is derived from the invoice instead — HMAC(secret, 'invoice-pay:v1:<id>:<code>').
 * It is stable, so a re-send mails a link identical to the first and neither message goes dead;
 * it is never stored, so nothing can overwrite it; and it carries no expiry, because what it
 * grants — read this invoice, start a payment against it — is exactly what the emailed link
 * already grants to whoever holds the message. `authorizeInvoiceToken` also still accepts a
 * `payment_token_hash` match, so the QR and send-payment-link flows keep working unchanged.
 */

const crypto = require('crypto');

const PREFIX = 'invoice-pay:v1';

// Resolved per call rather than at require time: the env is loaded before the first request but
// not necessarily before this module is first pulled in by another util's require chain.
const secret = () => process.env.PAYMENT_TOKEN_SECRET || process.env.JWT_SECRET || null;

/**
 * The link token for an invoice, or null when no secret is configured — production exits at boot
 * without PAYMENT_TOKEN_SECRET, so that case is a development environment, and a missing token
 * must degrade to the tokenless link we sent before rather than fail the invoice email.
 */
const invoicePaymentToken = (invoice) => {
  const key = secret();
  const id = invoice?.id ?? invoice?.invoiceDbId;
  const code = invoice?.invoice_id ?? invoice?.invoiceId;
  if (!key || !id || !code) {
    if (!key) console.warn('⚠️ PAYMENT_TOKEN_SECRET/JWT_SECRET not set - payment links will carry no token');
    return null;
  }
  return crypto.createHmac('sha256', key).update(`${PREFIX}:${id}:${code}`).digest('base64url');
};

// Constant-time where it can be: a length mismatch is answered before the compare, which only
// tells a caller that its guess was the wrong size.
const sameToken = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * Is `token` allowed to act on this invoice? Either it is the invoice's own derived link token,
 * or it is one of the stored-hash tokens (`/send-payment-link`, `/generate-qr-token`) whose
 * sha256 the invoice row carries.
 */
const authorizeInvoiceToken = (invoice, token) => {
  if (!invoice || typeof token !== 'string' || !token) return false;
  if (sameToken(token, invoicePaymentToken(invoice))) return true;
  if (!invoice.payment_token_hash) return false;
  return sameToken(crypto.createHash('sha256').update(token).digest('hex'), invoice.payment_token_hash);
};

/**
 * The customer's payment page for an invoice. Every invoice email builds its Pay Now button from
 * here so that no message can go out with a link the public endpoints will refuse.
 */
const paymentPageUrl = (invoice) => {
  const base = process.env.FRONTEND_URL || 'https://xlandinfra.com';
  const code = invoice?.invoice_id ?? invoice?.invoiceId;
  const token = invoicePaymentToken(invoice);
  return `${base}/pay/${code}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
};

module.exports = { invoicePaymentToken, authorizeInvoiceToken, paymentPageUrl };
