/**
 * Staff alerts for a customer's offline payment (cash, cheque, bank transfer).
 *
 * The customer portal records such a payment as `verification_pending`, and nothing settles it
 * until the franchise partner verifies it on Billing > Payments -- so the partner is told, by
 * email and by an in-portal notification. Both are sent after the payment row is written and never
 * throw: a mail server being down must not turn a recorded intent into an error for the customer.
 */
const { pool } = require('../config/database');
const { sendEmail } = require('./emailService');
const { decodeEntities } = require('../utils/htmlEntities');

const GOLD = '#B5812A';
const METHOD_LABELS = { cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer' };

const formatAmount = (value) =>
  `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const generateNotificationId = () =>
  `NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

const offlinePaymentEmailHtml = ({ rows }) => {
  const detail = rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding: 8px 12px; color: #6B7280; font-size: 13px; white-space: nowrap;">${label}</td>
        <td style="padding: 8px 12px; color: #111827; font-size: 13px; font-weight: 600;">${value}</td>
      </tr>`)
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <body style="margin: 0; padding: 0; background: #F6F3EC; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: ${GOLD}; height: 6px; border-radius: 10px 10px 0 0;"></div>
        <div style="background: #ffffff; border: 1px solid #E8DFC9; border-top: none; padding: 28px;">
          <p style="margin: 0 0 4px 0; color: ${GOLD}; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">XLAND INFRA</p>
          <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 20px;">A customer payment is awaiting verification</h2>
          <p style="margin: 0 0 20px 0; color: #4B5563; font-size: 14px; line-height: 1.6;">
            A customer has told us they are paying offline from the Customer Portal. Nothing is settled
            on the invoice until you verify the payment.
          </p>
          <table style="width: 100%; border-collapse: collapse; background: #FFFAF0; border: 1px solid #F1E3C6; border-radius: 10px;">
            ${detail}
          </table>
          <p style="margin: 24px 0 0 0; color: #4B5563; font-size: 13px; line-height: 1.6;">
            Open <strong>Billing &rsaquo; Payments</strong> in your portal to verify it once the money has been received.
          </p>
        </div>
        <div style="background: #FFFAF0; border: 1px solid #E8DFC9; border-top: none; border-radius: 0 0 10px 10px; padding: 16px; text-align: center;">
          <p style="margin: 0; color: #9CA3AF; font-size: 11px;">
            &copy; ${new Date().getFullYear()} XLAND INFRA Private Limited &middot; this is an automated notification
          </p>
        </div>
      </div>
    </body>
  </html>`;
};

/**
 * @param {object} params
 * @param {object} params.invoice   the invoice row
 * @param {number} params.paymentId payments.id of the new intent
 * @param {string} params.method    cash | cheque | bank_transfer
 * @param {number} params.amount    what the customer said they are paying
 * @param {string} params.referenceId the OFF- reference shown to the customer
 * @param {string} params.customerName
 */
const notifyOfflinePaymentSubmitted = async ({ invoice, paymentId, method, amount, referenceId, customerName }) => {
  const fpId = invoice?.franchise_partner_id;
  if (!fpId) return;

  const methodLabel = METHOD_LABELS[method] || method;
  const invoiceCode = invoice.invoice_id || `#${invoice.id}`;
  const property = invoice.property_code || invoice.property_id || '';

  try {
    const [rows] = await pool.execute('SELECT email FROM franchise_partners WHERE id = ? LIMIT 1', [fpId]);
    const to = rows[0]?.email;
    if (to) {
      // Stored text is already HTML-escaped (middleware/security.js), so it goes into the email as is
      const html = offlinePaymentEmailHtml({
        rows: [
          ['Customer', customerName],
          ['Invoice', invoiceCode],
          ['Property', property],
          ['Method', methodLabel],
          ['Amount', formatAmount(amount)],
          ['Reference', referenceId]
        ]
      });
      const result = await sendEmail({
        to,
        subject: `Payment awaiting verification - ${decodeEntities(invoiceCode)} (${methodLabel})`,
        html
      });
      if (result && result.success === false) {
        console.error(`Offline payment alert: email to ${to} failed:`, result.error || 'unknown error');
      }
    }
  } catch (e) {
    console.error('Offline payment alert: email failed:', e.message);
  }

  try {
    await pool.execute(
      `INSERT INTO portal_notifications
         (notification_id, user_id, franchise_partner_id, role_type, type, title, message,
          reference_type, reference_id, action_url, action_label, priority)
       VALUES (?, NULL, ?, 'fp', 'payment', ?, ?, 'payment', ?, '/fp/billing/payments', 'Verify Payment', 'high')`,
      [
        generateNotificationId(), fpId,
        'Customer payment awaiting verification',
        `${decodeEntities(customerName || 'A customer')} is paying ${formatAmount(amount)} by ${methodLabel} for ${decodeEntities(invoiceCode)}\nRef: ${referenceId}`,
        paymentId
      ]
    );
  } catch (e) {
    console.error('Offline payment alert: in-portal notification failed:', e.message);
  }
};

module.exports = { notifyOfflinePaymentSubmitted };
