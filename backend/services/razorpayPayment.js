/**
 * Writing a paid Razorpay invoice into the payments module.
 *
 * Three things can tell us a payment link was paid: the `payment_link.paid` webhook, the
 * `payment.captured` webhook, and the customer landing back on /payment/success. Any of
 * them can arrive first, arrive twice, or not arrive at all, so the work lives here once
 * and is keyed on razorpay_payment_id. Callers may fire it as often as they like; only the
 * first one for a given Razorpay payment writes a row.
 *
 * This replaces three hand-written copies of the same INSERT, two of which referenced
 * columns (`invoices.balance_due`, `invoices.paid_amount`, `payments.notes`,
 * `payments.created_by`) that do not exist and so could never record a payment.
 */

const { pool } = require('../config/database');
const { generatePaymentId, generateReceiptId } = require('../utils/paymentIds');
const { markPaymentCompleted } = require('./schedulingWorkflow');

// The action every Razorpay payment writes to payment_history. The Razorpay tab filters on it.
const RAZORPAY_HISTORY_ACTION = 'razorpay_payment';

/**
 * How the customer actually paid, for the receipt line. Razorpay reports card, netbanking,
 * upi, wallet and emi; anything else is shown as-is rather than guessed at.
 */
const describePaymentMethod = (paymentEntity) => {
  const method = paymentEntity?.method;
  if (method === 'card') {
    const network = paymentEntity?.card?.network || 'Card';
    return paymentEntity?.card?.last4 ? `${network} ****${paymentEntity.card.last4}` : network;
  }
  if (method === 'netbanking') return paymentEntity?.bank ? `Net Banking - ${paymentEntity.bank}` : 'Net Banking';
  if (method === 'upi') return 'UPI';
  if (method === 'wallet') return paymentEntity?.wallet ? `Wallet - ${paymentEntity.wallet}` : 'Wallet';
  return method || 'Online';
};

/**
 * The payment we already hold for a Razorpay payment ID, or null. Shaped like the payload
 * the success page renders, so a duplicate callback still gets a useful answer.
 */
const findRecordedPayment = async (razorpayPaymentId) => {
  if (!razorpayPaymentId) return null;

  const [rows] = await pool.execute(`
    SELECT p.id, p.payment_id, p.amount, p.status, p.payment_date,
           i.invoice_id, i.customer_name, prop.community_name AS property_name
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    LEFT JOIN onboarded_properties prop ON i.property_id = prop.id
    WHERE p.razorpay_payment_id = ?
    LIMIT 1
  `, [razorpayPaymentId]);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    paymentId: row.payment_id,
    amount: parseFloat(row.amount),
    status: row.status,
    invoiceId: row.invoice_id,
    customerName: row.customer_name,
    propertyName: row.property_name
  };
};

/**
 * Record a captured Razorpay payment against an invoice.
 *
 * @param {number|string} invoiceId  The internal invoices.id (not the INV-xxxxx string).
 * @param {number} amountPaid        This payment's amount in rupees — never the link's
 *                                   cumulative amount_paid, which double-counts a second
 *                                   partial payment.
 * @param {object} paymentEntity     The Razorpay payment entity, when we have one.
 * @param {string} paymentLinkId     The Razorpay payment link, for the audit trail.
 * @param {string} source            Who is recording, for the log line.
 * @returns {{recorded: boolean, alreadyRecorded: boolean, payment: object}}
 */
async function recordRazorpayPayment({ invoiceId, amountPaid, paymentEntity = null, paymentLinkId = null, source = 'webhook' }) {
  const razorpayPaymentId = paymentEntity?.id || null;

  const already = await findRecordedPayment(razorpayPaymentId);
  if (already) {
    console.log(`[Razorpay ${source}] Payment ${razorpayPaymentId} already recorded as ${already.paymentId}`);
    return { recorded: false, alreadyRecorded: true, payment: already };
  }

  const amount = Number(amountPaid);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Refusing to record a Razorpay payment of "${amountPaid}" for invoice ${invoiceId}`);
  }

  const [invoices] = await pool.execute(`
    SELECT i.*, prop.property_id AS prop_code, prop.community_name AS prop_name
    FROM invoices i
    LEFT JOIN onboarded_properties prop ON i.property_id = prop.id
    WHERE i.id = ?
  `, [invoiceId]);

  if (invoices.length === 0) throw new Error(`Invoice ${invoiceId} not found`);
  const invoice = invoices[0];

  const fpId = invoice.franchise_partner_id || null;
  const paymentCode = await generatePaymentId(fpId);
  const receiptCode = await generateReceiptId(fpId);

  const newAmountPaid = parseFloat(invoice.amount_paid || 0) + amount;
  const newBalance = parseFloat(invoice.total_amount || 0) - newAmountPaid;
  const fullyPaid = newBalance <= 0;
  const newPaymentStatus = fullyPaid ? 'paid' : 'partially_paid';

  const methodLabel = describePaymentMethod(paymentEntity);
  const reference = razorpayPaymentId || paymentLinkId;
  const description = `Razorpay payment received - ₹${amount.toLocaleString('en-IN')} | ${methodLabel} | Txn: ${reference}`;

  const connection = await pool.getConnection();
  let paymentDbId;
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(`
      INSERT INTO payments (
        payment_id, receipt_id, invoice_id, invoice_number, property_id, property_code,
        estimate_id, customer_id, franchise_partner_id, customer_name,
        amount, payment_method, payment_type, transaction_reference, payment_date,
        status, razorpay_payment_id, razorpay_order_id,
        received_by_name, received_by_role, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'razorpay', 'online', ?, CURDATE(), 'completed', ?, ?, ?, 'system', ?)
    `, [
      paymentCode,
      receiptCode,
      invoice.id,
      invoice.invoice_id || null,
      invoice.property_id || null,
      invoice.property_code || invoice.prop_code || null,
      invoice.estimate_id || null,
      invoice.customer_id || null,
      fpId,
      invoice.customer_name || null,
      amount,
      reference,
      razorpayPaymentId,
      paymentEntity?.order_id || null,
      'Razorpay Online Payment',
      `Online payment via Razorpay (${methodLabel})`
    ]);
    paymentDbId = result.insertId;

    await connection.execute(`
      UPDATE invoices SET
        amount_paid = ?,
        balance_amount = ?,
        payment_status = ?,
        status = ?,
        payment_link_status = 'paid'
      WHERE id = ?
    `, [newAmountPaid, Math.max(0, newBalance), newPaymentStatus, newPaymentStatus, invoice.id]);

    // Property ID is the primary link between an invoice and its estimate
    if (invoice.property_id) {
      await connection.execute(`
        UPDATE fp_estimates SET payment_status = ?, updated_at = NOW()
        WHERE property_id = ? AND status = 'approved'
      `, [newPaymentStatus, invoice.property_id]);
    }

    if (fullyPaid && invoice.work_order_id) {
      await connection.execute(`
        UPDATE work_orders SET
          status = 'closed',
          admin_notes = CONCAT(IFNULL(admin_notes, ''), '\nPayment verified (online) and closed on ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')),
          updated_at = NOW()
        WHERE id = ? AND status = 'completed'
      `, [invoice.work_order_id]);
    }

    await connection.execute(`
      INSERT INTO payment_history (
        invoice_id, payment_id, action, new_status, amount, description,
        performed_by_name, performed_by_role,
        razorpay_payment_id, razorpay_receipt_id, payment_method_details
      ) VALUES (?, ?, ?, 'completed', ?, ?, 'Razorpay', 'system', ?, ?, ?)
    `, [
      invoice.id,
      paymentDbId,
      RAZORPAY_HISTORY_ACTION,
      amount,
      description,
      razorpayPaymentId,
      paymentEntity?.receipt || null,
      JSON.stringify({
        method: paymentEntity?.method || null,
        card_last4: paymentEntity?.card?.last4 || null,
        card_network: paymentEntity?.card?.network || null,
        bank: paymentEntity?.bank || null,
        wallet: paymentEntity?.wallet || null,
        email: paymentEntity?.email || invoice.customer_email || null,
        contact: paymentEntity?.contact || invoice.customer_phone || null,
        invoice_id: invoice.invoice_id,
        invoice_amount: parseFloat(invoice.total_amount || 0),
        amount_paid: amount,
        balance_remaining: Math.max(0, newBalance),
        payment_date: new Date().toISOString(),
        razorpay_payment_link_id: paymentLinkId,
        recorded_by: source
      })
    ]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    // The unique index on razorpay_payment_id is what makes two webhooks racing each other
    // safe; losing that race is not a failure, the payment is recorded either way.
    if (error.code === 'ER_DUP_ENTRY') {
      const winner = await findRecordedPayment(razorpayPaymentId);
      if (winner) return { recorded: false, alreadyRecorded: true, payment: winner };
    }
    throw error;
  } finally {
    connection.release();
  }

  console.log(`[Razorpay ${source}] Recorded ${paymentCode} for invoice ${invoice.invoice_id}: ₹${amount} (balance ₹${Math.max(0, newBalance)})`);

  // Scheduling reads the committed invoice, so it runs after the commit. It must never be
  // able to roll back money that is already banked.
  if (fullyPaid && invoice.property_id) {
    try {
      await markPaymentCompleted({
        propertyId: invoice.property_id,
        estimateId: invoice.estimate_id || null,
        invoiceId: invoice.id,
        paidAmount: newAmountPaid,
        paidBy: 'Razorpay Online Payment'
      });
    } catch (error) {
      console.error(`[Razorpay ${source}] Scheduling workflow failed for property ${invoice.property_id}:`, error);
    }
  }

  return {
    recorded: true,
    alreadyRecorded: false,
    payment: {
      id: paymentDbId,
      paymentId: paymentCode,
      receiptId: receiptCode,
      amount,
      status: 'completed',
      invoiceId: invoice.invoice_id,
      customerName: invoice.customer_name,
      propertyName: invoice.prop_name,
      balanceRemaining: Math.max(0, newBalance)
    }
  };
}

module.exports = { recordRazorpayPayment, findRecordedPayment, RAZORPAY_HISTORY_ACTION };
