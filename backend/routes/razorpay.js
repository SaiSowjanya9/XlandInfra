const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Payment Security Middleware
const {
  paymentLinkLimiter,
  webhookLimiter,
  validatePaymentAmountMiddleware,
  fraudDetectionMiddleware,
  logSecurityEvent,
  ipBlacklistMiddleware,
  getFailedAttemptCount
} = require('../middleware/paymentSecurity');
const {
  verifyRazorpayWebhookSignature,
  generatePaymentToken,
  getClientIP,
  hashIP
} = require('../utils/paymentSecurity');

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
router.post('/create-payment-link', authenticate, canManagePayments, paymentLinkLimiter, fraudDetectionMiddleware, async (req, res) => {
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

    // Get invoice details - check both numeric id and string invoice_id
    const isNumericId = !isNaN(parseInt(invoiceId)) && String(parseInt(invoiceId)) === String(invoiceId);
    const [invoices] = await pool.execute(`
      SELECT i.*, 
             p.community_name as property_name, p.property_id as property_code,
             c.name as client_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN clients c ON i.customer_id = c.id
      WHERE ${isNumericId ? 'i.id = ?' : 'i.invoice_id = ?'}
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
    // NOTE: Status stays unchanged - invoice remains in "Generated Invoices" until payment is received
    await pool.execute(`
      UPDATE invoices SET
        payment_link = ?,
        razorpay_payment_link_id = ?,
        razorpay_short_url = ?,
        payment_link_created_at = NOW(),
        payment_link_expires_at = ?,
        payment_link_status = 'created'
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
router.post('/send-payment-link', authenticate, canManagePayments, paymentLinkLimiter, async (req, res) => {
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

    // Generate unique payment token for this invoice
    const tokenData = generatePaymentToken({
      invoiceId: invoice.invoice_id,
      amount: invoice.balance_amount,
      customerId: invoice.customer_id,
      propertyId: invoice.property_id
    });
    
    // Store token hash in database for validation
    const tokenHash = crypto.createHash('sha256').update(tokenData.token).digest('hex');
    
    // Update invoice with token hash (token expiry is encoded in the token itself)
    await pool.execute(`
      UPDATE invoices SET 
        payment_token_hash = ?
      WHERE id = ?
    `, [tokenHash, invoiceId]);

    // Build custom payment page URL with unique token (invoice ID hidden in token)
    const frontendUrl = process.env.FRONTEND_URL || 'https://admin.xlandinfra.com';
    const customPaymentUrl = `${frontendUrl}/pay?token=${encodeURIComponent(tokenData.token)}`;

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
      // Default email body with custom payment page link
      emailBody = `
Dear ${invoice.customer_name || 'Customer'},

Please find below the payment details for your invoice:

Invoice Number: ${invoice.invoice_id}
Property: ${invoice.property_name || 'N/A'}
Amount Due: ₹${invoice.balance_amount.toLocaleString('en-IN')}
Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-IN')}

Click the link below to choose your preferred payment method:
${customPaymentUrl}

Payment Options Available:
• UPI (GPay, PhonePe, Paytm, BHIM)
• Debit Card / Credit Card
• Net Banking
• Bank Transfer (NEFT/IMPS/RTGS)
• Cash at Office
• Cheque

${customMessage ? `\nMessage: ${customMessage}\n` : ''}

Thank you for your business!

Best regards,
XLAND INFRA PVT LTD

Note: This payment link is unique and expires in 7 days. Do not share this link with others.
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
// LIST ALL PAYMENT LINKS
// ============================================
router.get('/payment-links', authenticate, canManagePayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // First check if payment link columns exist
    let hasPaymentLinkColumns = true;
    try {
      await pool.execute('SELECT razorpay_payment_link_id FROM invoices LIMIT 1');
    } catch (colErr) {
      hasPaymentLinkColumns = false;
    }

    if (!hasPaymentLinkColumns) {
      // Return empty result if columns don't exist
      return res.json({
        success: true,
        data: {
          paymentLinks: [],
          counts: { all: 0, created: 0, sent: 0, paid: 0, expired: 0, cancelled: 0 },
          pagination: { page: parseInt(page), limit: parseInt(limit), total: 0 }
        }
      });
    }

    let query = `
      SELECT 
        i.id as invoice_db_id,
        i.invoice_id,
        i.customer_name,
        i.customer_email,
        i.customer_phone,
        i.balance_amount,
        i.total_amount,
        i.payment_link,
        i.razorpay_payment_link_id,
        i.razorpay_short_url,
        i.payment_link_status,
        i.payment_link_created_at,
        i.payment_link_sent_at,
        i.payment_link_sent_via,
        i.payment_link_expires_at,
        i.source_estimate_id,
        p.community_name as property_name,
        p.property_id as property_code
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      WHERE i.razorpay_payment_link_id IS NOT NULL
    `;
    const params = [];

    // Filter by FP
    if (fpId) {
      query += ' AND i.franchise_partner_id = ?';
      params.push(fpId);
    }

    // Filter by status
    if (status && status !== 'all') {
      query += ' AND i.payment_link_status = ?';
      params.push(status);
    }

    // Search
    if (search) {
      query += ' AND (i.invoice_id LIKE ? OR i.customer_name LIKE ? OR i.customer_email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Order and pagination - embed LIMIT/OFFSET directly to avoid MySQL prepared statement issues
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 50));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    query += ` ORDER BY i.payment_link_created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const [links] = await pool.execute(query, params);

    // Get counts by status
    let statusCounts = [];
    try {
      const countQuery = `
        SELECT 
          payment_link_status as status,
          COUNT(*) as count
        FROM invoices
        WHERE razorpay_payment_link_id IS NOT NULL
        ${fpId ? 'AND franchise_partner_id = ?' : ''}
        GROUP BY payment_link_status
      `;
      [statusCounts] = await pool.execute(countQuery, fpId ? [fpId] : []);
    } catch (countErr) {
      console.error('Error getting status counts:', countErr.message);
    }

    const counts = {
      all: 0,
      created: 0,
      sent: 0,
      paid: 0,
      expired: 0,
      cancelled: 0
    };
    statusCounts.forEach(row => {
      if (row.status && counts.hasOwnProperty(row.status)) {
        counts[row.status] = parseInt(row.count) || 0;
      }
      counts.all += parseInt(row.count) || 0;
    });

    res.json({
      success: true,
      data: {
        paymentLinks: links,
        counts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: counts.all
        }
      }
    });

  } catch (error) {
    console.error('Error listing payment links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list payment links',
      error: error.message
    });
  }
});

// ============================================
// RAZORPAY WEBHOOK
// ============================================
router.post('/webhook', webhookLimiter, express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const ip = getClientIP(req);
    
    // Verify webhook signature using timing-safe comparison
    if (RAZORPAY_WEBHOOK_SECRET && signature) {
      const isValid = verifyRazorpayWebhookSignature(
        req.body.toString(),
        signature,
        RAZORPAY_WEBHOOK_SECRET
      );

      if (!isValid) {
        console.error('Webhook signature verification failed');
        // Log security event for invalid signature
        try {
          await pool.execute(`
            INSERT INTO payment_security_logs (event_type, severity, ip_hash, request_path, request_method, details)
            VALUES (?, ?, ?, ?, ?, ?)
          `, ['WEBHOOK_INVALID_SIGNATURE', 'WARNING', hashIP(ip), '/api/razorpay/webhook', 'POST', JSON.stringify({ signaturePrefix: signature?.substring(0, 10) })]);
        } catch (logErr) {
          console.error('Failed to log security event:', logErr.message);
        }
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    } else if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn('RAZORPAY_WEBHOOK_SECRET not configured - webhook signature not verified');
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

      case 'payment.failed':
        await handlePaymentFailed(payload, webhookId);
        break;

      case 'payment_link.cancelled':
        await handlePaymentLinkCancelled(payload, webhookId);
        break;

      case 'refund.created':
      case 'refund.processed':
        await handleRefund(payload, webhookId);
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

    // Extract Razorpay payment details for receipt
    const paymentMethod = paymentEntity?.method || 'card'; // card, netbanking, upi, wallet
    const cardLast4 = paymentEntity?.card?.last4 || null;
    const cardNetwork = paymentEntity?.card?.network || null; // Visa, Mastercard, etc
    const bankName = paymentEntity?.bank || null;
    const razorpayReceiptId = paymentEntity?.receipt || paymentLinkEntity.receipt || null;
    
    // Build receipt description with payment method details
    let receiptDescription = `Razorpay Payment Successful - ₹${amountPaid.toLocaleString('en-IN')}`;
    if (paymentMethod === 'card' && cardLast4) {
      receiptDescription += ` | ${cardNetwork || 'Card'}****${cardLast4}`;
    } else if (paymentMethod === 'netbanking' && bankName) {
      receiptDescription += ` | Net Banking - ${bankName}`;
    } else if (paymentMethod === 'upi') {
      receiptDescription += ` | UPI`;
    }
    receiptDescription += ` | Txn: ${paymentEntity?.id || paymentLinkId}`;

    // Log in payment history with Razorpay receipt details
    await connection.execute(`
      INSERT INTO payment_history (
        invoice_id, payment_id, action, new_status, amount, description, 
        performed_by_name, performed_by_role,
        razorpay_payment_id, razorpay_receipt_id, payment_method_details
      )
      VALUES (?, ?, 'razorpay_payment', 'completed', ?, ?, 'Razorpay', 'system', ?, ?, ?)
    `, [
      invoice.id, 
      paymentId,
      amountPaid, 
      receiptDescription,
      paymentEntity?.id || null,
      razorpayReceiptId,
      JSON.stringify({
        method: paymentMethod,
        card_last4: cardLast4,
        card_network: cardNetwork,
        bank: bankName,
        email: paymentEntity?.email || invoice.customer_email,
        contact: paymentEntity?.contact || invoice.customer_phone,
        invoice_id: invoice.invoice_id,
        invoice_amount: parseFloat(invoice.total_amount),
        amount_paid: amountPaid,
        balance_remaining: Math.max(0, newBalance),
        payment_date: new Date().toISOString(),
        razorpay_payment_link_id: paymentLinkId
      })
    ]);

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

// Handle payment failed
async function handlePaymentFailed(payload, webhookId) {
  const paymentEntity = payload.payload.payment?.entity;
  
  if (!paymentEntity) {
    console.log('[Webhook] Payment failed but no payment entity');
    return;
  }

  const notes = paymentEntity.notes || {};
  const internalInvoiceId = notes.internal_invoice_id;
  const errorCode = paymentEntity.error_code;
  const errorDescription = paymentEntity.error_description;

  console.log(`[Webhook] Payment failed: ${errorCode} - ${errorDescription}`);

  // Log the failure for audit
  if (internalInvoiceId) {
    try {
      await pool.execute(`
        INSERT INTO payment_history (invoice_id, action, new_status, description, performed_by_name, performed_by_role)
        VALUES (?, 'failed', 'failed', ?, 'Razorpay', 'system')
      `, [internalInvoiceId, `Payment failed: ${errorCode} - ${errorDescription}`]);

      // Update webhook record
      await pool.execute(
        'UPDATE razorpay_webhooks SET invoice_id = ?, razorpay_payment_id = ?, error_message = ? WHERE id = ?',
        [internalInvoiceId, paymentEntity.id, `${errorCode}: ${errorDescription}`, webhookId]
      );
    } catch (err) {
      console.error('[Webhook] Error logging payment failure:', err.message);
    }
  }
}

// Handle payment link cancelled
async function handlePaymentLinkCancelled(payload, webhookId) {
  const paymentLinkEntity = payload.payload.payment_link?.entity;
  
  if (!paymentLinkEntity) return;

  const internalInvoiceId = paymentLinkEntity.notes?.internal_invoice_id;

  if (!internalInvoiceId) return;

  await pool.execute(`
    UPDATE invoices SET payment_link_status = 'cancelled' WHERE id = ?
  `, [internalInvoiceId]);

  await pool.execute(
    'UPDATE razorpay_webhooks SET invoice_id = ?, razorpay_payment_link_id = ? WHERE id = ?',
    [internalInvoiceId, paymentLinkEntity.id, webhookId]
  );

  console.log(`[Webhook] Payment link cancelled for invoice ${internalInvoiceId}`);
}

// Handle refund events
async function handleRefund(payload, webhookId) {
  const refundEntity = payload.payload.refund?.entity;
  const paymentEntity = payload.payload.payment?.entity;
  
  if (!refundEntity) {
    console.log('[Webhook] Refund event but no refund entity');
    return;
  }

  const paymentId = refundEntity.payment_id;
  const refundAmount = refundEntity.amount / 100; // Convert from paise
  const refundStatus = refundEntity.status;

  console.log(`[Webhook] Refund ${refundStatus}: ₹${refundAmount} for payment ${paymentId}`);

  // Find the payment in our database
  try {
    const [payments] = await pool.execute(`
      SELECT p.*, i.id as invoice_db_id, i.invoice_id
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE p.razorpay_payment_id = ?
    `, [paymentId]);

    if (payments.length > 0) {
      const payment = payments[0];

      // Log the refund
      await pool.execute(`
        INSERT INTO payment_history (invoice_id, action, new_status, amount, description, performed_by_name, performed_by_role)
        VALUES (?, 'refund', ?, ?, ?, 'Razorpay', 'system')
      `, [
        payment.invoice_db_id,
        refundStatus,
        refundAmount,
        `Refund ${refundStatus}: ₹${refundAmount} (Refund ID: ${refundEntity.id})`
      ]);

      // Update invoice balance if refund is processed
      if (refundStatus === 'processed') {
        await pool.execute(`
          UPDATE invoices SET
            amount_paid = amount_paid - ?,
            balance_amount = balance_amount + ?,
            payment_status = CASE 
              WHEN balance_amount + ? >= total_amount THEN 'unpaid'
              WHEN balance_amount + ? > 0 THEN 'partially_paid'
              ELSE payment_status
            END,
            status = CASE 
              WHEN balance_amount + ? >= total_amount THEN 'sent'
              WHEN balance_amount + ? > 0 THEN 'partially_paid'
              ELSE status
            END
          WHERE id = ?
        `, [refundAmount, refundAmount, refundAmount, refundAmount, refundAmount, refundAmount, payment.invoice_db_id]);
      }

      // Update webhook record
      await pool.execute(
        'UPDATE razorpay_webhooks SET invoice_id = ?, razorpay_payment_id = ? WHERE id = ?',
        [payment.invoice_db_id, paymentId, webhookId]
      );
    }
  } catch (err) {
    console.error('[Webhook] Error processing refund:', err.message);
  }
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

// ============================================
// GENERATE SECURE PAYMENT QR TOKEN
// Creates a cryptographically signed, time-limited token for QR code payments
// ============================================
router.post('/generate-qr-token', authenticate, canManagePayments, paymentLinkLimiter, async (req, res) => {
  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ success: false, message: 'Invoice ID is required' });
    }

    // Get invoice details
    const [invoices] = await pool.execute(`
      SELECT i.*, p.property_id as property_code, p.community_name as property_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
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

    // Generate secure QR payment token
    const { generateQRPaymentToken } = require('../utils/paymentSecurity');
    const tokenData = generateQRPaymentToken({
      invoiceId: invoice.invoice_id,
      amount: invoice.balance_amount,
      propertyCode: invoice.property_code,
      customerEmail: invoice.customer_email
    });

    // Store token hash in database for validation
    const tokenHash = crypto.createHash('sha256').update(tokenData.token).digest('hex');
    
    await pool.execute(`
      UPDATE invoices SET 
        payment_token_hash = ?,
        qr_token_generated_at = NOW()
      WHERE id = ?
    `, [tokenHash, invoiceId]);

    // Log the action
    try {
      await pool.execute(`
        INSERT INTO payment_security_logs (event_type, severity, ip_hash, user_id, user_role, request_path, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        'QR_TOKEN_GENERATED',
        'INFO',
        hashIP(getClientIP(req)),
        req.user.id,
        req.user.role,
        '/api/razorpay/generate-qr-token',
        JSON.stringify({ invoiceId: invoice.invoice_id, amount: invoice.balance_amount })
      ]);
    } catch (logErr) {
      console.error('Failed to log security event:', logErr.message);
    }

    res.json({
      success: true,
      message: 'QR payment token generated successfully',
      data: {
        token: tokenData.token,
        expiresAt: tokenData.expiresAt,
        expiresIn: tokenData.expiresIn,
        invoiceId: invoice.invoice_id,
        amount: invoice.balance_amount,
        propertyCode: invoice.property_code,
        customerName: invoice.customer_name
      }
    });

  } catch (error) {
    console.error('Error generating QR token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR payment token',
      error: error.message
    });
  }
});

// ============================================
// VERIFY QR PAYMENT TOKEN
// Public endpoint for verifying QR tokens (no auth required)
// ============================================
router.post('/verify-qr-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Verify the token
    const { verifyQRPaymentToken } = require('../utils/paymentSecurity');
    const verification = verifyQRPaymentToken(token);

    if (!verification.valid) {
      // Log failed verification attempt
      try {
        await pool.execute(`
          INSERT INTO payment_security_logs (event_type, severity, ip_hash, request_path, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          'QR_TOKEN_INVALID',
          'WARNING',
          hashIP(getClientIP(req)),
          '/api/razorpay/verify-qr-token',
          JSON.stringify({ error: verification.error })
        ]);
      } catch (logErr) {
        console.error('Failed to log security event:', logErr.message);
      }

      return res.status(400).json({
        success: false,
        message: verification.error
      });
    }

    // Check if token hash matches database (optional additional validation)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [invoices] = await pool.execute(`
      SELECT id, invoice_id, balance_amount, customer_name, payment_token_hash, status
      FROM invoices 
      WHERE invoice_id = ? AND payment_token_hash = ?
    `, [verification.data.invoiceId, tokenHash]);

    if (invoices.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token has been revoked or invoice not found'
      });
    }

    const invoice = invoices[0];

    // Check if invoice is still payable
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Invoice is ${invoice.status}`
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        invoiceId: invoice.invoice_id,
        amount: verification.data.amount,
        currentBalance: invoice.balance_amount,
        customerName: invoice.customer_name,
        expiresAt: new Date(verification.data.expiresAt)
      }
    });

  } catch (error) {
    console.error('Error verifying QR token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify token'
    });
  }
});

// ============================================
// CHECK IF CAPTCHA IS REQUIRED FOR THIS IP
// ============================================
router.get('/public/captcha-status', ipBlacklistMiddleware, (req, res) => {
  const ip = getClientIP(req);
  const failedCount = getFailedAttemptCount(ip);
  
  res.json({
    success: true,
    requireCaptcha: failedCount >= 3,
    failedAttempts: failedCount
  });
});

// ============================================
// VERIFY GOOGLE reCAPTCHA TOKEN
// ============================================
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';

router.post('/verify-recaptcha', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA token is required'
      });
    }

    if (!RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        message: 'reCAPTCHA not configured on server'
      });
    }

    // Verify with Google
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify`;
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`
    });

    const result = await response.json();

    if (result.success) {
      res.json({
        success: true,
        message: 'reCAPTCHA verified successfully'
      });
    } else {
      console.error('reCAPTCHA verification failed:', result['error-codes']);
      res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification failed',
        errors: result['error-codes']
      });
    }

  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify reCAPTCHA'
    });
  }
});

// ============================================
// PUBLIC: GET INVOICE DETAILS FOR PAYMENT PAGE
// Token-only URL - invoice ID extracted from token
// Protected by IP blacklisting
// ============================================
router.get('/public/pay', ipBlacklistMiddleware, async (req, res) => {
  try {
    const { token } = req.query;
    const ip = getClientIP(req);

    if (!token) {
      // Record failed attempt for missing token
      req.ipBlacklist.recordFailed();
      return res.status(400).json({
        success: false,
        message: 'Payment token is required',
        requireCaptcha: getFailedAttemptCount(ip) >= 3
      });
    }

    // Verify and decode the token
    const { verifyPaymentToken } = require('../utils/paymentSecurity');
    const verification = verifyPaymentToken(token);

    if (!verification.valid) {
      // Record failed attempt for invalid token
      const blockResult = req.ipBlacklist.recordFailed();
      
      logSecurityEvent(req, 'INVALID_PAYMENT_TOKEN', {
        error: verification.error,
        remainingAttempts: blockResult.remainingAttempts
      });
      
      return res.status(400).json({
        success: false,
        message: verification.error || 'Invalid or expired payment link',
        requireCaptcha: getFailedAttemptCount(ip) >= 3,
        blocked: blockResult.blocked
      });
    }

    // Extract invoice ID from token payload
    const invoiceId = verification.data.invoiceId;

    // Verify token hash matches database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Get invoice with token verification
    const [invoices] = await pool.execute(`
      SELECT 
        i.id,
        i.invoice_id,
        i.property_id,
        i.property_code,
        i.property_name,
        i.customer_name,
        i.customer_email,
        i.customer_phone,
        i.invoice_date,
        i.due_date,
        i.subtotal,
        i.discount_amount,
        i.tax_amount,
        i.total_amount,
        i.balance_amount,
        i.status,
        i.payment_link,
        i.payment_link_status
      FROM invoices i
      WHERE i.invoice_id = ? AND i.payment_token_hash = ?
    `, [invoiceId, tokenHash]);

    if (invoices.length === 0) {
      // Record failed attempt for invalid token hash
      req.ipBlacklist.recordFailed();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or payment link has expired',
        requireCaptcha: getFailedAttemptCount(ip) >= 3
      });
    }

    const invoice = invoices[0];

    // Check invoice status
    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This invoice has been cancelled'
      });
    }

    // Clear failed attempts on successful access
    req.ipBlacklist.clearFailed();

    // Return invoice data (frontend will handle "paid" status display)
    res.json({
      success: true,
      data: {
        invoiceId: invoice.invoice_id,
        propertyCode: invoice.property_code,
        propertyName: invoice.property_name,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        customerPhone: invoice.customer_phone,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        subtotal: parseFloat(invoice.subtotal) || 0,
        discountAmount: parseFloat(invoice.discount_amount) || 0,
        taxAmount: parseFloat(invoice.tax_amount) || 0,
        totalAmount: parseFloat(invoice.total_amount) || 0,
        balanceAmount: parseFloat(invoice.balance_amount) || parseFloat(invoice.total_amount) || 0,
        status: invoice.status, // 'sent', 'partially_paid', 'paid', etc.
        paymentLink: invoice.payment_link,
        paymentLinkStatus: invoice.payment_link_status
      }
    });

  } catch (error) {
    console.error('Error fetching public invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load invoice details'
    });
  }
});

// ============================================
// PUBLIC: RECORD PAYMENT INTENT (for non-Razorpay methods)
// Protected by IP blacklisting
// ============================================
router.post('/public/record-payment-intent', ipBlacklistMiddleware, async (req, res) => {
  try {
    const { invoiceId, token, paymentMethod } = req.body;
    const ip = getClientIP(req);

    if (!invoiceId || !token || !paymentMethod) {
      req.ipBlacklist.recordFailed();
      return res.status(400).json({
        success: false,
        message: 'Invoice ID, token, and payment method are required',
        requireCaptcha: getFailedAttemptCount(ip) >= 3
      });
    }

    // Verify token
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [invoices] = await pool.execute(
      'SELECT id, invoice_id FROM invoices WHERE invoice_id = ? AND payment_token_hash = ?',
      [invoiceId, tokenHash]
    );

    if (invoices.length === 0) {
      req.ipBlacklist.recordFailed();
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or token invalid',
        requireCaptcha: getFailedAttemptCount(ip) >= 3
      });
    }
    
    // Clear failed attempts on successful access
    req.ipBlacklist.clearFailed();

    const invoice = invoices[0];

    // Log the payment intent
    console.log(`[Payment Intent] Invoice: ${invoiceId}, Method: ${paymentMethod}, Time: ${new Date().toISOString()}`);

    // For offline payments (cash, cheque, bank_transfer), create a payment record with verification_pending status
    const offlineMethods = ['cash', 'cheque', 'check', 'bank_transfer', 'bank'];
    const isOfflinePayment = offlineMethods.includes(paymentMethod?.toLowerCase());
    
    let referenceId = `OFF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    let paymentRecordId = null;

    if (isOfflinePayment) {
      // Get full invoice details for property_id and amount
      const [fullInvoice] = await pool.execute(
        'SELECT id, property_id, total_amount, balance_amount FROM invoices WHERE id = ?',
        [invoice.id]
      );

      if (fullInvoice.length > 0) {
        const inv = fullInvoice[0];
        const paymentAmount = parseFloat(inv.balance_amount) || parseFloat(inv.total_amount) || 0;

        // Normalize payment method name
        let normalizedMethod = paymentMethod.toLowerCase();
        if (normalizedMethod === 'bank') normalizedMethod = 'bank_transfer';
        if (normalizedMethod === 'check') normalizedMethod = 'cheque';

        // Create payment record with verification_pending status
        const [paymentResult] = await pool.execute(
          `INSERT INTO payments (
            invoice_id, property_id, amount, payment_method, payment_date,
            transaction_id, status, remarks, created_at
          ) VALUES (?, ?, ?, ?, NOW(), ?, 'verification_pending', 'Payment intent from Public Payment Link - Awaiting verification', NOW())`,
          [inv.id, inv.property_id, paymentAmount, normalizedMethod, referenceId]
        );
        paymentRecordId = paymentResult.insertId;
        console.log(`[Payment Record Created] ID: ${paymentRecordId}, Invoice: ${invoiceId}, Method: ${normalizedMethod}, Status: verification_pending`);
      }
    }

    res.json({
      success: true,
      message: `Payment intent recorded successfully. Your payment will be verified by our team within 24-48 hours.`,
      data: {
        invoiceId,
        paymentMethod,
        referenceId,
        paymentId: paymentRecordId,
        status: 'verification_pending',
        instructions: paymentMethod === 'bank' || paymentMethod === 'bank_transfer'
          ? 'Please transfer to our bank account using the details provided. Include the reference ID in payment remarks.'
          : paymentMethod === 'upi'
          ? 'Please pay via UPI and share the transaction ID.'
          : paymentMethod === 'cash'
          ? 'Please visit our office to make the cash payment. Carry this reference ID.'
          : 'Please submit the cheque at our office. Write the reference ID on the back of the cheque.'
      }
    });

  } catch (error) {
    console.error('Error recording payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment intent'
    });
  }
});

// ============================================
// PUBLIC: GET PAYMENT DETAILS BY RAZORPAY PAYMENT ID
// Used on success page to show receipt
// ============================================
router.get('/payment-details/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Find payment in our records
    const [payments] = await pool.execute(`
      SELECT 
        ph.id,
        ph.invoice_id,
        ph.amount,
        ph.payment_method,
        ph.transaction_id,
        ph.razorpay_payment_id,
        ph.status,
        ph.created_at,
        i.invoice_id as invoice_number,
        i.property_name,
        i.customer_name,
        i.customer_email,
        i.total_amount
      FROM payment_history ph
      LEFT JOIN invoices i ON ph.invoice_id = i.id
      WHERE ph.razorpay_payment_id = ? OR ph.transaction_id = ?
      LIMIT 1
    `, [paymentId, paymentId]);

    if (payments.length === 0) {
      // Try to fetch from Razorpay directly if we have API keys
      if (razorpay) {
        try {
          const razorpayPayment = await razorpay.payments.fetch(paymentId);
          
          // Find invoice by payment link reference
          const [invoices] = await pool.execute(`
            SELECT * FROM invoices 
            WHERE razorpay_payment_link_id = ?
            LIMIT 1
          `, [razorpayPayment.notes?.payment_link_id || '']);

          const invoice = invoices[0] || {};

          return res.json({
            success: true,
            data: {
              paymentId: razorpayPayment.id,
              amount: razorpayPayment.amount / 100,
              status: razorpayPayment.status,
              method: razorpayPayment.method,
              invoiceId: invoice.invoice_id || razorpayPayment.notes?.invoice_id,
              propertyName: invoice.property_name,
              customerName: invoice.customer_name,
              customerEmail: invoice.customer_email,
              totalAmount: invoice.total_amount,
              paidAt: new Date(razorpayPayment.created_at * 1000)
            }
          });
        } catch (razorpayErr) {
          console.error('Error fetching from Razorpay:', razorpayErr.message);
        }
      }

      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    const payment = payments[0];

    res.json({
      success: true,
      data: {
        paymentId: payment.razorpay_payment_id || payment.transaction_id,
        amount: parseFloat(payment.amount) || 0,
        status: payment.status,
        method: payment.payment_method,
        invoiceId: payment.invoice_number,
        propertyName: payment.property_name,
        customerName: payment.customer_name,
        customerEmail: payment.customer_email,
        totalAmount: parseFloat(payment.total_amount) || 0,
        paidAt: payment.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
});

// ============================================
// VERIFY PAYMENT CALLBACK SIGNATURE
// Public endpoint for verifying payment link callback params
// ============================================
router.post('/verify-payment-callback', async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
      razorpay_signature
    } = req.body;

    // If no signature provided, just return status without verification
    if (!razorpay_signature) {
      return res.json({
        success: true,
        verified: false,
        message: 'No signature provided for verification',
        data: {
          paymentId: razorpay_payment_id,
          paymentLinkId: razorpay_payment_link_id,
          status: razorpay_payment_link_status
        }
      });
    }

    // Verify the signature
    // For payment links, signature is HMAC-SHA256 of: payment_link_id|payment_link_reference_id|payment_link_status|razorpay_payment_id
    const payload = `${razorpay_payment_link_id}|${razorpay_payment_link_reference_id}|${razorpay_payment_link_status}|${razorpay_payment_id}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(razorpay_signature),
        Buffer.from(expectedSignature)
      );
    } catch (compareError) {
      // Lengths don't match - signature is invalid
      isValid = false;
    }

    if (!isValid) {
      // Log security event
      try {
        await pool.execute(`
          INSERT INTO payment_security_logs (event_type, severity, ip_hash, request_path, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          'PAYMENT_CALLBACK_INVALID_SIGNATURE',
          'WARNING',
          hashIP(getClientIP(req)),
          '/api/razorpay/verify-payment-callback',
          JSON.stringify({ paymentId: razorpay_payment_id, paymentLinkId: razorpay_payment_link_id })
        ]);
      } catch (logErr) {
        console.error('Failed to log security event:', logErr.message);
      }

      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Invalid payment signature'
      });
    }

    // Signature is valid - get payment details from database
    let paymentDetails = null;
    try {
      const [payments] = await pool.execute(`
        SELECT p.payment_id, p.amount, p.status, p.payment_date,
               i.invoice_id, i.customer_name
        FROM payments p
        LEFT JOIN invoices i ON p.invoice_id = i.id
        WHERE p.razorpay_payment_id = ?
        ORDER BY p.created_at DESC
        LIMIT 1
      `, [razorpay_payment_id]);

      if (payments.length > 0) {
        paymentDetails = {
          paymentId: payments[0].payment_id,
          amount: payments[0].amount,
          status: payments[0].status,
          invoiceId: payments[0].invoice_id,
          customerName: payments[0].customer_name,
          paymentDate: payments[0].payment_date
        };
      }
    } catch (dbErr) {
      console.error('Error fetching payment details:', dbErr.message);
    }

    res.json({
      success: true,
      verified: true,
      message: 'Payment signature verified successfully',
      data: {
        paymentId: razorpay_payment_id,
        paymentLinkId: razorpay_payment_link_id,
        status: razorpay_payment_link_status,
        referenceId: razorpay_payment_link_reference_id,
        ...paymentDetails
      }
    });

  } catch (error) {
    console.error('Error verifying payment callback:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'Failed to verify payment'
    });
  }
});

module.exports = router;
