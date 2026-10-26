/**
 * Alerts around a customer's offline payment (cash, cheque, bank transfer).
 *
 * Submitted: the customer portal records the payment as `verification_pending`, and nothing
 * settles it until staff verify it on Billing > Payments. The associated people are emailed -- the
 * invoice's franchise partner, and that partner's managers who cover the property's zone (a
 * manager with the `all` zone marker covers every zone). The in-portal alert in the Admin,
 * Operations Manager, Franchise Partner and Manager bells is read live from the payments rows
 * (GET /api/payments/pending-offline-alerts), so it clears itself once the payment is verified.
 *
 * Verified or rejected: the customer is told in their own portal bell, scoped to their account
 * (customerNotificationScope's payment branch) -- the receipt email is sent by the verify route.
 *
 * Everything here runs after the payment is written and never throws: a mail server being down
 * must not turn recorded money into an error.
 */
const { pool } = require('../config/database');
const { sendEmail } = require('./emailService');
const { decodeEntities } = require('../utils/htmlEntities');
const { fetchEmployeeZones, coversZone } = require('../utils/fpEmployeeDirectory');

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
            on the invoice until the payment is verified.
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

/** The property's zone, from whichever property table holds it. */
const propertyZone = async (invoice) => {
  const key = invoice.property_id || invoice.property_code;
  if (!key) return null;
  try {
    const [[op]] = await pool.execute(
      'SELECT zone FROM onboarded_properties WHERE id = ? OR property_id = ? LIMIT 1',
      [key, invoice.property_code || key]
    );
    if (op?.zone) return op.zone;
  } catch (e) { /* fall through to properties */ }
  try {
    const [[prop]] = await pool.execute(
      'SELECT zone_id AS zone FROM properties WHERE id = ? OR property_id = ? LIMIT 1',
      [key, invoice.property_code || key]
    );
    return prop?.zone || null;
  } catch (e) {
    return null;
  }
};

/**
 * Who is emailed: the franchise partner, and its managers covering the property's zone. Strictly
 * zone-centric -- a manager of another zone is not "associated" with this property. Deduplicated.
 */
const offlinePaymentRecipients = async (invoice) => {
  const fpId = invoice?.franchise_partner_id;
  if (!fpId) return [];
  const emails = new Set();
  try {
    const [rows] = await pool.execute('SELECT email FROM franchise_partners WHERE id = ? LIMIT 1', [fpId]);
    if (rows[0]?.email) emails.add(String(rows[0].email).toLowerCase());
  } catch (e) {
    console.error('Offline payment alert: partner lookup failed:', e.message);
  }
  try {
    const [managers] = await pool.execute(
      `SELECT id, email, role FROM fp_employees
       WHERE franchise_partner_id = ? AND is_active = 1 AND email IS NOT NULL`,
      [fpId]
    );
    const onlyManagers = managers.filter((m) => String(m.role || '').replace(/^fp_/, '') === 'manager');
    if (onlyManagers.length) {
      const zone = await propertyZone(invoice);
      const zoneMap = await fetchEmployeeZones(pool, fpId);
      for (const manager of onlyManagers) {
        if (coversZone(zoneMap.get(manager.id) || [], zone, decodeEntities)) {
          emails.add(String(manager.email).toLowerCase());
        }
      }
    }
  } catch (e) {
    console.error('Offline payment alert: manager lookup failed:', e.message);
  }
  return [...emails];
};

/**
 * @param {object} params
 * @param {object} params.invoice   the invoice row
 * @param {string} params.method    cash | cheque | bank_transfer
 * @param {number} params.amount    what the customer said they are paying
 * @param {string} params.referenceId the OFF- reference shown to the customer
 * @param {string} params.customerName
 */
const notifyOfflinePaymentSubmitted = async ({ invoice, method, amount, referenceId, customerName }) => {
  try {
    const recipients = await offlinePaymentRecipients(invoice);
    if (!recipients.length) return;
    const methodLabel = METHOD_LABELS[method] || method;
    const invoiceCode = invoice.invoice_id || `#${invoice.id}`;
    // Stored text is already HTML-escaped (middleware/security.js), so it goes into the email as is
    const html = offlinePaymentEmailHtml({
      rows: [
        ['Customer', customerName],
        ['Invoice', invoiceCode],
        ['Property', invoice.property_code || invoice.property_id || ''],
        ['Method', methodLabel],
        ['Amount', formatAmount(amount)],
        ['Reference', referenceId]
      ]
    });
    const subject = `Payment awaiting verification - ${decodeEntities(invoiceCode)} (${methodLabel})`;
    for (const to of recipients) {
      try {
        const result = await sendEmail({ to, subject, html });
        if (result && result.success === false) {
          console.error(`Offline payment alert: email to ${to} failed:`, result.error || 'unknown error');
        }
      } catch (e) {
        console.error(`Offline payment alert: email to ${to} failed:`, e.message);
      }
    }
  } catch (e) {
    console.error('Offline payment alert failed:', e.message);
  }
};

/**
 * Staff have verified (or rejected) a customer's payment: put it in that customer's own bell.
 * @param {object} payment the payments row as the verify route read it
 * @param {'paid'|'failed'|string} status the status it was moved to
 */
const notifyCustomerPaymentVerified = async (payment, status) => {
  try {
    const email = payment.customer_email || payment.invoice_email || payment.email;
    if (!email) return;
    const [[account]] = await pool.execute(
      'SELECT id FROM customer_accounts WHERE email = ? LIMIT 1',
      [String(email).toLowerCase()]
    );
    if (!account) return;
    const paid = status === 'paid';
    const invoiceCode = decodeEntities(payment.invoice_code || '');
    await pool.execute(
      `INSERT INTO portal_notifications
         (notification_id, user_id, franchise_partner_id, role_type, type, title, message,
          reference_type, reference_id, action_url, action_label, priority)
       VALUES (?, ?, ?, 'customer', 'payment', ?, ?, 'payment', ?, '/dashboard/payment', 'View Payments', ?)`,
      [
        generateNotificationId(), account.id, payment.franchise_partner_id || null,
        paid ? 'Payment received' : 'Payment could not be verified',
        paid
          ? `Your payment of ${formatAmount(payment.amount)}${invoiceCode ? ` for ${invoiceCode}` : ''} has been verified. Thank you!`
          : `We could not verify your payment of ${formatAmount(payment.amount)}${invoiceCode ? ` for ${invoiceCode}` : ''}. Please contact us.`,
        payment.id,
        paid ? 'normal' : 'high'
      ]
    );
  } catch (e) {
    console.error('Customer payment notification failed:', e.message);
  }
};

module.exports = { notifyOfflinePaymentSubmitted, notifyCustomerPaymentVerified, offlinePaymentRecipients };
