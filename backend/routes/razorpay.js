const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// Environment variables for Razorpay
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// Initialize Razorpay instance
let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
}

// Email transporter
const getEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Permission middleware
const canManagePayments = async (req, res, next) => {
  const allowedRoles = ['admin', 'operations_manager', 'franchise_partner', 'manager'];
  if (!allowedRoles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to manage payments' });
  }
  next();
};

// Get FP scope for queries
const getFPScope = (req) => {
  if (['admin', 'operations_manager'].includes(req.user?.role)) {
    return req.query.franchisePartnerId || null;
  }
  return req.user?.franchisePartnerId || req.fpId || null;
};

// ============================================
// CREATE PAYMENT LINK
// ============================================
router.post('/create-payment-link', authenticate, canManagePayments, async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables.'
      });
    }

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required' });
    }

    // Get invoice details
    const [invoices] = await pool.execute(`
      SELECT i.*, 
             p.community_name as property_name, p.property_id as property_code,
             c.name as client_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN clients c ON i.customer_id = c.id
      WHERE i.id = ?
    `, [invoiceId]);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];

    // Check if invoice has balance
    if (invoice.balance_amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice is already fully paid' });
    }

    // Check if payment link already exists and is not expired
    if (invoice.razorpay_payment_link_id && invoice.payment_link_status === 'created') {
      const expiresAt = new Date(invoice.payment_link_expires_at);
      if (expiresAt > new Date()) {
        return res.json({
          success: true,
          message: 'Payment link already exists',
          data: {
            paymentLink: invoice.payment_link,
            shortUrl: invoice.razorpay_short_url,
            expiresAt: invoice.payment_link_expires_at,
            status: invoice.payment_link_status
          }
        });
      }
    }

    // Calculate expiry (7 days from now)
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    const expiresAtDate = new Date(expiresAt * 1000);

    // Create Razorpay payment link
    const paymentLinkOptions = {
      amount: Math.round(invoice.balance_amount * 100), // Amount in paise
      currency: 'INR',
      accept_partial: true,
      first_min_partial_amount: 100, // Minimum ₹1 partial payment
      description: `Payment for Invoice: ${invoice.invoice_id}`,
      customer: {
        name: invoice.customer_name || 'Customer',
        email: invoice.customer_email || undefined,
        contact: invoice.customer_phone || undefined
      },
      notify: {
        sms: false,
        email: false // We'll send our own email
      },
      reminder_enable: true,
      notes: {
        invoice_id: invoice.invoice_id,
        internal_invoice_id: invoice.id.toString(),
        property_id: invoice.property_id?.toString() || '',
        property_name: invoice.property_name || '',
        customer_name: invoice.customer_name || ''
      },
      callback_url: `${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/payment/success`,
      callback_method: 'get',
      expire_by: expiresAt
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

    // Update invoice with payment link details
    await pool.execute(`
      UPDATE invoices SET
        payment_link = ?,
        razorpay_payment_link_id = ?,
        razorpay_short_url = ?,
        payment_link_created_at = NOW(),
        payment_link_expires_at = ?,
        payment_link_status = 'created',
        status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END
      WHERE id = ?
    `, [
      paymentLink.short_url,
      paymentLink.id,
      paymentLink.short_url,
      expiresAtDate,
      invoiceId
    ]);

    // Log the action
    await pool.execute(`
      INSERT INTO payment_history (invoice_id, action, new_status, description, performed_by, performed_by_name, performed_by_role)
      VALUES (?, 'created', 'created', ?, ?, ?, ?)
    `, [
      invoiceId,
      `Payment link created: ${paymentLink.short_url}`,
      req.user.id,
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      req.user.role
    ]);

    res.json({
      success: true,
      message: 'Payment link created successfully',
      data: {
        paymentLinkId: paymentLink.id,
        paymentLink: paymentLink.short_url,
        shortUrl: paymentLink.short_url,
        amount: invoice.balance_amount,
        expiresAt: expiresAtDate,
        status: 'created'
      }
    });

  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment link',
      error: error.message
    });
  }
});

// ============================================
// SEND PAYMENT LINK VIA EMAIL
// ============================================
router.post('/send-payment-link', authenticate, canManagePayments, async (req, res) => {
  try {
    const { invoiceId, email, customMessage } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required' });
    }

    // Get invoice details
    const [invoices] = await pool.execute(`
      SELECT i.*, 
             p.community_name as property_name, p.property_id as property_code
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      WHERE i.id = ?
    `, [invoiceId]);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];

    if (!invoice.payment_link) {
      return res.status(400).json({ success: false, message: 'Payment link not created yet. Please create a payment link first.' });
    }

    const recipientEmail = email || invoice.customer_email;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'No email address provided' });
    }

    // Get email template
    const [templates] = await pool.execute(`
      SELECT * FROM payment_email_templates 
      WHERE template_type = 'payment_link' AND (franchise_partner_id IS NULL OR franchise_partner_id = ?)
      ORDER BY franchise_partner_id DESC
      LIMIT 1
    `, [invoice.franchise_partner_id]);

    let emailSubject = `Payment Request - Invoice ${invoice.invoice_id} from XLAND INFRA`;
    let emailBody = '';

    if (templates.length > 0) {
      const template = templates[0];
      emailSubject = template.subject
        .replace(/\{\{invoice_id\}\}/g, invoice.invoice_id)
        .replace(/\{\{customer_name\}\}/g, invoice.customer_name || 'Customer')
        .replace(/\{\{amount\}\}/g, invoice.balance_amount.toLocaleString('en-IN'))
        .replace(/\{\{property_name\}\}/g, invoice.property_name || 'N/A');

      emailBody = template.body
        .replace(/\{\{invoice_id\}\}/g, invoice.invoice_id)
        .replace(/\{\{customer_name\}\}/g, invoice.customer_name || 'Customer')
        .replace(/\{\{amount\}\}/g, invoice.balance_amount.toLocaleString('en-IN'))
        .replace(/\{\{due_date\}\}/g, new Date(invoice.due_date).toLocaleDateString('en-IN'))
        .replace(/\{\{payment_link\}\}/g, invoice.payment_link)
        .replace(/\{\{property_name\}\}/g, invoice.property_name || 'N/A');
    } else {
      // Default email body
      emailBody = `
Dear ${invoice.customer_name || 'Customer'},

Please find below the payment details for your invoice:

Invoice Number: ${invoice.invoice_id}
Property: ${invoice.property_name || 'N/A'}
Amount Due: ₹${invoice.balance_amount.toLocaleString('en-IN')}
Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}

Click the link below to make a secure payment:
${invoice.payment_link}

Payment Options Available:
• UPI (GPay, PhonePe, Paytm, etc.)
• Credit Card / Debit Card
• Net Banking
• Digital Wallets

${customMessage ? `\nMessage: ${customMessage}\n` : ''}

Thank you for your business!

Best regards,
XLAND INFRA PVT LTD
      `.trim();
    }

    // Send email
    const transporter = getEmailTransporter();
    
    await transporter.sendMail({
      from: `"XLAND INFRA" <${process.env.SMTP_USER || 'noreply@xlandinfra.com'}>`,
      to: recipientEmail,
      subject: emailSubject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>')
    });

    // Update invoice status
    await pool.execute(`
      UPDATE invoices SET
        payment_link_status = 'sent',
        payment_link_sent_via = 'email',
        payment_link_sent_at = NOW(),
        status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
        sent_at = IFNULL(sent_at, NOW()),
        sent_by = IFNULL(sent_by, ?)
      WHERE id = ?
    `, [req.user.id, invoiceId]);

    // Log the action
    await pool.execute(`
      INSERT INTO payment_history (invoice_id, action, new_status, description, performed_by, performed_by_name, performed_by_role)
      VALUES (?, 'created', 'sent', ?, ?, ?, ?)
    `, [
      invoiceId,
      `Payment link sent to ${recipientEmail}`,
      req.user.id,
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      req.user.role
    ]);

    res.json({
      success: true,
      message: `Payment link sent to ${recipientEmail}`,
      data: {
        sentTo: recipientEmail,
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error sending payment link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send payment link',
      error: error.message
    });
  }
});

// ============================================
// CANCEL PAYMENT LINK
// ============================================
router.post('/cancel-payment-link', authenticate, canManagePayments, async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Razorpay is not configured' });
    }

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required' });
    }

    // Get invoice
    const [invoices] = await pool.execute('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    
    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];

    if (!invoice.razorpay_payment_link_id) {
      return res.status(400).json({ success: false, message: 'No payment link exists for this invoice' });
    }

    // Cancel payment link on Razorpay
    try {
      await razorpay.paymentLink.cancel(invoice.razorpay_payment_link_id);
    } catch (razorpayError) {
      console.log('Razorpay cancel error (might already be cancelled):', razorpayError.message);
    }

    // Update invoice
    await pool.execute(`
      UPDATE invoices SET
        payment_link_status = 'cancelled'
      WHERE id = ?
    `, [invoiceId]);

    res.json({
      success: true,
      message: 'Payment link cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling payment link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel payment link',
      error: error.message
    });
  }
});

// ============================================
// GET PAYMENT LINK STATUS
// ============================================
router.get('/payment-link-status/:invoiceId', authenticate, async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const [invoices] = await pool.execute(`
      SELECT payment_link, razorpay_payment_link_id, razorpay_short_url,
             payment_link_created_at, payment_link_expires_at, payment_link_status,
             payment_link_sent_via, payment_link_sent_at, balance_amount
      FROM invoices WHERE id = ?
    `, [invoiceId]);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];

    // Check if link is expired
    let status = invoice.payment_link_status;
    if (status === 'created' && invoice.payment_link_expires_at) {
      const expiresAt = new Date(invoice.payment_link_expires_at);
      if (expiresAt < new Date()) {
        status = 'expired';
        // Update status in DB
        await pool.execute('UPDATE invoices SET payment_link_status = ? WHERE id = ?', ['expired', invoiceId]);
      }
    }

    res.json({
      success: true,
      data: {
        paymentLink: invoice.payment_link,
        paymentLinkId: invoice.razorpay_payment_link_id,
        shortUrl: invoice.razorpay_short_url,
        createdAt: invoice.payment_link_created_at,
        expiresAt: invoice.payment_link_expires_at,
        status: status,
        sentVia: invoice.payment_link_sent_via,
        sentAt: invoice.payment_link_sent_at,
        balanceAmount: invoice.balance_amount
      }
    });

  } catch (error) {
    console.error('Error getting payment link status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment link status',
      error: error.message
    });
  }
});

// ============================================
// RAZORPAY WEBHOOK
// ============================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    // Verify webhook signature
    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(req.body)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('Webhook signature verification failed');
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    }

    const payload = JSON.parse(req.body.toString());
    const event = payload.event;
    const eventId = payload.payload?.payment?.entity?.id || payload.payload?.payment_link?.entity?.id || Date.now().toString();

    console.log('[Razorpay Webhook] Event received:', event);

    // Log webhook
    const [logResult] = await pool.execute(`
      INSERT INTO razorpay_webhooks (event_id, event_type, payload, status)
      VALUES (?, ?, ?, 'received')
      ON DUPLICATE KEY UPDATE payload = ?, status = 'received'
    `, [eventId, event, JSON.stringify(payload), JSON.stringify(payload)]);

    const webhookId = logResult.insertId || logResult.affectedRows;

    // Process different event types
    switch (event) {
      case 'payment_link.paid':
        await handlePaymentLinkPaid(payload, webhookId);
        break;
      
      case 'payment_link.partially_paid':
        await handlePaymentLinkPartiallyPaid(payload, webhookId);
        break;

      case 'payment_link.expired':
        await handlePaymentLinkExpired(payload, webhookId);
        break;

      case 'payment.captured':
        await handlePaymentCaptured(payload, webhookId);
        break;

      default:
        console.log('[Razorpay Webhook] Unhandled event type:', event);
    }

    // Mark as processed
    await pool.execute(
      'UPDATE razorpay_webhooks SET status = ?, processed_at = NOW() WHERE id = ?',
      ['processed', webhookId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('[Razorpay Webhook] Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Handle payment link paid
async function handlePaymentLinkPaid(payload, webhookId) {
  const paymentLinkEntity = payload.payload.payment_link.entity;
  const paymentEntity = payload.payload.payment?.entity;
  
  const paymentLinkId = paymentLinkEntity.id;
  const internalInvoiceId = paymentLinkEntity.notes?.internal_invoice_id;

  if (!internalInvoiceId) {
    console.log('[Webhook] No internal invoice ID in notes');
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get invoice
    const [invoices] = await connection.execute(
      'SELECT * FROM invoices WHERE id = ?',
      [internalInvoiceId]
    );

    if (invoices.length === 0) {
      throw new Error(`Invoice ${internalInvoiceId} not found`);
    }

    const invoice = invoices[0];
    const amountPaid = paymentLinkEntity.amount_paid / 100; // Convert from paise

    // Generate payment ID
    const paymentId = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Insert payment record
    await connection.execute(`
      INSERT INTO payments (
        payment_id, invoice_id, property_id, estimate_id, customer_id, franchise_partner_id,
        customer_name, amount, payment_method, payment_type,
        transaction_reference, payment_date, status,
        razorpay_payment_id, razorpay_order_id,
        received_by_name, received_by_role, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
    `, [
      paymentId,
      invoice.id,
      invoice.property_id,
      invoice.estimate_id,
      invoice.customer_id,
      invoice.franchise_partner_id,
      invoice.customer_name,
      amountPaid,
      'razorpay',
      'online',
      paymentEntity?.id || paymentLinkId,
      'completed',
      paymentEntity?.id || null,
      paymentEntity?.order_id || null,
      'Razorpay Online Payment',
      'system',
      `Online payment via Razorpay Payment Link`
    ]);

    // Update invoice
    const newAmountPaid = parseFloat(invoice.amount_paid) + amountPaid;
    const newBalance = parseFloat(invoice.total_amount) - newAmountPaid;
    const newPaymentStatus = newBalance <= 0 ? 'paid' : 'partially_paid';
    const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

    await connection.execute(`
      UPDATE invoices SET
        amount_paid = ?,
        balance_amount = ?,
        payment_status = ?,
        status = ?,
        payment_link_status = 'paid'
      WHERE id = ?
    `, [newAmountPaid, Math.max(0, newBalance), newPaymentStatus, newStatus, invoice.id]);

    // If fully paid and linked to work order, close it
    if (newBalance <= 0 && invoice.work_order_id) {
      await connection.execute(`
        UPDATE work_orders SET
          status = 'closed',
          admin_notes = CONCAT(IFNULL(admin_notes, ''), '\nPayment verified (online) and closed on ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')),
          updated_at = NOW()
        WHERE id = ? AND status = 'completed'
      `, [invoice.work_order_id]);
    }

    // Log in payment history
    await connection.execute(`
      INSERT INTO payment_history (invoice_id, action, new_status, amount, description, performed_by_name, performed_by_role)
      VALUES (?, 'created', 'completed', ?, ?, 'Razorpay', 'system')
    `, [invoice.id, amountPaid, `Online payment received via Razorpay (${paymentEntity?.id || paymentLinkId})`]);

    // Update webhook record
    await connection.execute(
      'UPDATE razorpay_webhooks SET invoice_id = ?, razorpay_payment_link_id = ?, razorpay_payment_id = ? WHERE id = ?',
      [invoice.id, paymentLinkId, paymentEntity?.id, webhookId]
    );

    await connection.commit();
    console.log(`[Webhook] Payment recorded for invoice ${invoice.invoice_id}: ₹${amountPaid}`);

  } catch (error) {
    await connection.rollback();
    console.error('[Webhook] Error processing payment:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Handle partial payment
async function handlePaymentLinkPartiallyPaid(payload, webhookId) {
  // Same logic as paid, amount will be partial
  await handlePaymentLinkPaid(payload, webhookId);
}

// Handle payment link expired
async function handlePaymentLinkExpired(payload, webhookId) {
  const paymentLinkEntity = payload.payload.payment_link.entity;
  const internalInvoiceId = paymentLinkEntity.notes?.internal_invoice_id;

  if (!internalInvoiceId) return;

  await pool.execute(`
    UPDATE invoices SET payment_link_status = 'expired' WHERE id = ?
  `, [internalInvoiceId]);

  await pool.execute(
    'UPDATE razorpay_webhooks SET invoice_id = ?, razorpay_payment_link_id = ? WHERE id = ?',
    [internalInvoiceId, paymentLinkEntity.id, webhookId]
  );

  console.log(`[Webhook] Payment link expired for invoice ${internalInvoiceId}`);
}

// Handle direct payment captured (for orders, not payment links)
async function handlePaymentCaptured(payload, webhookId) {
  const paymentEntity = payload.payload.payment.entity;
  
  // Check if this is related to our payment link
  const notes = paymentEntity.notes || {};
  const internalInvoiceId = notes.internal_invoice_id;

  if (!internalInvoiceId) {
    console.log('[Webhook] Payment captured but no internal invoice ID');
    return;
  }

  // The payment link webhook should handle this
  console.log(`[Webhook] Payment captured for invoice ${internalInvoiceId}`);
}

// ============================================
// CHECK RAZORPAY CONFIG
// ============================================
router.get('/config-status', authenticate, canManagePayments, (req, res) => {
  res.json({
    success: true,
    data: {
      configured: !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET),
      hasWebhookSecret: !!RAZORPAY_WEBHOOK_SECRET,
      keyIdPrefix: RAZORPAY_KEY_ID ? RAZORPAY_KEY_ID.substring(0, 8) + '...' : null,
      isTestMode: RAZORPAY_KEY_ID?.startsWith('rzp_test_') || false
    }
  });
});

module.exports = router;
