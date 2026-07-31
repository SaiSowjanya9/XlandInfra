/**
 * Payments API Routes
 * Handles invoices, manual payments, and payment history
 * RBAC: Super Admin, Operations Manager, Franchise Partner, Manager can record payments
 *       Supervisors and Executives have view-only access
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

// Configure multer for payment proof uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/payments/'),
  filename: (req, file, cb) => cb(null, `payment-${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Roles that can record/edit payments
const PAYMENT_EDIT_ROLES = [
  ROLES.ADMIN,
  ROLES.OPERATIONS_MANAGER,
  ROLES.FRANCHISE_PARTNER,
  ROLES.MANAGER
];

// Roles that can only view payments
const PAYMENT_VIEW_ROLES = [
  ...PAYMENT_EDIT_ROLES,
  ROLES.SUPERVISOR,
  ROLES.EXECUTIVE
];

// Middleware to check if user can edit payments
const canEditPayments = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!PAYMENT_EDIT_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied. You cannot record or edit payments.' });
  }
  next();
};

// Middleware to check if user can view payments
const canViewPayments = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!PAYMENT_VIEW_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied. You cannot view payments.' });
  }
  next();
};

// Get FP scope for queries
const getFPScope = (req) => {
  // If user is FP or Manager under FP, scope to their FP
  if (req.user.franchisePartnerId) {
    return req.user.franchisePartnerId;
  }
  if (req.user.fpId) {
    return req.user.fpId;
  }
  return null;
};

// Generate unique invoice ID
const generateInvoiceId = async (fpId = null) => {
  const year = new Date().getFullYear();
  const prefix = 'INV';
  
  try {
    // Try to get and increment sequence
    const [existing] = await pool.execute(
      'SELECT current_number FROM invoice_sequence WHERE franchise_partner_id <=> ? AND year = ?',
      [fpId, year]
    );
    
    let nextNumber;
    if (existing.length > 0) {
      nextNumber = existing[0].current_number + 1;
      await pool.execute(
        'UPDATE invoice_sequence SET current_number = ? WHERE franchise_partner_id <=> ? AND year = ?',
        [nextNumber, fpId, year]
      );
    } else {
      nextNumber = 1;
      await pool.execute(
        'INSERT INTO invoice_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
        [fpId, year, nextNumber, prefix]
      );
    }
    
    return `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
};

// Generate unique payment ID
const generatePaymentId = async (fpId = null) => {
  const year = new Date().getFullYear();
  const prefix = 'PAY';
  
  try {
    const [existing] = await pool.execute(
      'SELECT current_number FROM payment_sequence WHERE franchise_partner_id <=> ? AND year = ?',
      [fpId, year]
    );
    
    let nextNumber;
    if (existing.length > 0) {
      nextNumber = existing[0].current_number + 1;
      await pool.execute(
        'UPDATE payment_sequence SET current_number = ? WHERE franchise_partner_id <=> ? AND year = ?',
        [nextNumber, fpId, year]
      );
    } else {
      nextNumber = 1;
      await pool.execute(
        'INSERT INTO payment_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
        [fpId, year, nextNumber, prefix]
      );
    }
    
    return `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }
};

// ============================================
// PAYMENT DASHBOARD
// ============================================

router.get('/dashboard', authenticate, canViewPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const fpCondition = fpId ? 'AND i.franchise_partner_id = ?' : '';
    const fpParams = fpId ? [fpId] : [];

    // Get payment statistics
    const [stats] = await pool.execute(`
      SELECT
        COALESCE(SUM(i.total_amount), 0) as total_invoice_amount,
        COALESCE(SUM(i.amount_paid), 0) as total_collected,
        COALESCE(SUM(i.balance_amount), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.balance_amount ELSE 0 END), 0) as overdue_amount,
        COUNT(CASE WHEN i.payment_status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN i.payment_status = 'partially_paid' THEN 1 END) as partially_paid_invoices,
        COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) as overdue_invoices,
        COUNT(*) as total_invoices
      FROM invoices i
      WHERE 1=1 ${fpCondition}
    `, fpParams);

    // Get today's collections
    const today = new Date().toISOString().split('T')[0];
    const [todayStats] = await pool.execute(`
      SELECT COALESCE(SUM(p.amount), 0) as today_collections
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE DATE(p.payment_date) = ? AND p.status = 'completed' ${fpId ? 'AND p.franchise_partner_id = ?' : ''}
    `, fpId ? [today, fpId] : [today]);

    // Get recent payments
    const [recentPayments] = await pool.execute(`
      SELECT 
        p.payment_id, p.amount, p.payment_method, p.payment_date, p.status,
        i.invoice_id, p.customer_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE 1=1 ${fpId ? 'AND p.franchise_partner_id = ?' : ''}
      ORDER BY p.created_at DESC
      LIMIT 5
    `, fpId ? [fpId] : []);

    res.json({
      success: true,
      data: {
        totalInvoiceAmount: parseFloat(stats[0].total_invoice_amount) || 0,
        totalCollected: parseFloat(stats[0].total_collected) || 0,
        pendingAmount: parseFloat(stats[0].pending_amount) || 0,
        overdueAmount: parseFloat(stats[0].overdue_amount) || 0,
        paidInvoices: parseInt(stats[0].paid_invoices) || 0,
        partiallyPaidInvoices: parseInt(stats[0].partially_paid_invoices) || 0,
        overdueInvoices: parseInt(stats[0].overdue_invoices) || 0,
        totalInvoices: parseInt(stats[0].total_invoices) || 0,
        todayCollections: parseFloat(todayStats[0].today_collections) || 0,
        recentPayments: recentPayments.map(p => ({
          paymentId: p.payment_id,
          invoiceId: p.invoice_id,
          customerName: p.customer_name,
          amount: parseFloat(p.amount),
          paymentMethod: p.payment_method,
          paymentDate: p.payment_date,
          status: p.status
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching payment dashboard:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard', error: error.message });
  }
});

// ============================================
// INVOICES
// ============================================

// Get all invoices
router.get('/invoices', authenticate, canViewPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { status, paymentStatus, search, propertyId, customerId } = req.query;
    
    let query = `
      SELECT i.*, 
             p.name as property_name, p.property_id as property_code,
             c.name as client_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN clients c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (fpId) {
      query += ' AND i.franchise_partner_id = ?';
      params.push(fpId);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (paymentStatus) {
      query += ' AND i.payment_status = ?';
      params.push(paymentStatus);
    }

    if (propertyId) {
      query += ' AND i.property_id = ?';
      params.push(propertyId);
    }

    if (customerId) {
      query += ' AND i.customer_id = ?';
      params.push(customerId);
    }

    if (search) {
      query += ' AND (i.invoice_id LIKE ? OR i.customer_name LIKE ? OR i.customer_email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY i.created_at DESC';

    const [invoices] = await pool.execute(query, params);

    res.json({
      success: true,
      data: invoices.map(i => ({
        id: i.id,
        invoiceId: i.invoice_id,
        propertyId: i.property_id,
        propertyName: i.property_name || i.customer_name,
        propertyCode: i.property_code,
        customerId: i.customer_id,
        customerName: i.customer_name || i.client_name,
        customerEmail: i.customer_email,
        customerPhone: i.customer_phone,
        invoiceDate: i.invoice_date,
        dueDate: i.due_date,
        subtotal: parseFloat(i.subtotal),
        discountPercentage: parseFloat(i.discount_percentage),
        discountAmount: parseFloat(i.discount_amount),
        taxPercentage: parseFloat(i.tax_percentage),
        taxAmount: parseFloat(i.tax_amount),
        totalAmount: parseFloat(i.total_amount),
        amountPaid: parseFloat(i.amount_paid),
        balanceAmount: parseFloat(i.balance_amount),
        status: i.status,
        paymentStatus: i.payment_status,
        paymentLink: i.payment_link,
        notes: i.notes,
        createdAt: i.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, message: 'Error fetching invoices', error: error.message });
  }
});

// Get single invoice
router.get('/invoices/:id', authenticate, canViewPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = `
      SELECT i.*, 
             p.name as property_name, p.property_id as property_code,
             c.name as client_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN clients c ON i.customer_id = c.id
      WHERE i.id = ?
    `;
    const params = [id];

    if (fpId) {
      query += ' AND i.franchise_partner_id = ?';
      params.push(fpId);
    }

    const [invoices] = await pool.execute(query, params);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Get payments for this invoice
    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC',
      [id]
    );

    const i = invoices[0];
    res.json({
      success: true,
      data: {
        id: i.id,
        invoiceId: i.invoice_id,
        propertyId: i.property_id,
        propertyName: i.property_name,
        propertyCode: i.property_code,
        estimateId: i.estimate_id,
        customerId: i.customer_id,
        customerName: i.customer_name || i.client_name,
        customerEmail: i.customer_email,
        customerPhone: i.customer_phone,
        invoiceDate: i.invoice_date,
        dueDate: i.due_date,
        lineItems: i.line_items ? JSON.parse(i.line_items) : [],
        subtotal: parseFloat(i.subtotal),
        discountPercentage: parseFloat(i.discount_percentage),
        discountAmount: parseFloat(i.discount_amount),
        taxPercentage: parseFloat(i.tax_percentage),
        taxAmount: parseFloat(i.tax_amount),
        totalAmount: parseFloat(i.total_amount),
        amountPaid: parseFloat(i.amount_paid),
        balanceAmount: parseFloat(i.balance_amount),
        status: i.status,
        paymentStatus: i.payment_status,
        paymentLink: i.payment_link,
        paymentLinkCreatedAt: i.payment_link_created_at,
        notes: i.notes,
        termsAndConditions: i.terms_and_conditions,
        workOrderId: i.work_order_id,
        createdAt: i.created_at,
        payments: payments.map(p => ({
          id: p.id,
          paymentId: p.payment_id,
          amount: parseFloat(p.amount),
          paymentMethod: p.payment_method,
          paymentType: p.payment_type,
          transactionReference: p.transaction_reference,
          paymentDate: p.payment_date,
          status: p.status,
          receivedBy: p.received_by_name,
          remarks: p.remarks,
          createdAt: p.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ success: false, message: 'Error fetching invoice', error: error.message });
  }
});

// Create invoice
router.post('/invoices', authenticate, canEditPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const {
      propertyId, estimateId, customerId, customerName, customerEmail, customerPhone,
      invoiceDate, dueDate, lineItems, subtotal, discountPercentage, taxPercentage,
      notes, termsAndConditions, workOrderId
    } = req.body;

    // Calculate amounts
    const sub = parseFloat(subtotal) || 0;
    const discPct = parseFloat(discountPercentage) || 0;
    const taxPct = parseFloat(taxPercentage) || 18;
    const discountAmount = sub * (discPct / 100);
    const taxableAmount = sub - discountAmount;
    const taxAmount = taxableAmount * (taxPct / 100);
    const totalAmount = taxableAmount + taxAmount;

    const invoiceId = await generateInvoiceId(fpId);

    const [result] = await pool.execute(`
      INSERT INTO invoices (
        invoice_id, property_id, estimate_id, customer_id, franchise_partner_id,
        customer_name, customer_email, customer_phone,
        invoice_date, due_date, line_items,
        subtotal, discount_percentage, discount_amount, tax_percentage, tax_amount, total_amount,
        balance_amount, notes, terms_and_conditions, work_order_id,
        created_by, created_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId, propertyId || null, estimateId || null, customerId || null, fpId,
      customerName, customerEmail || null, customerPhone || null,
      invoiceDate, dueDate, lineItems ? JSON.stringify(lineItems) : null,
      sub, discPct, discountAmount, taxPct, taxAmount, totalAmount,
      totalAmount, notes || null, termsAndConditions || null, workOrderId || null,
      req.user.id, req.user.role
    ]);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: { id: result.insertId, invoiceId }
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, message: 'Error creating invoice', error: error.message });
  }
});

// Update invoice
router.put('/invoices/:id', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    const {
      customerName, customerEmail, customerPhone,
      invoiceDate, dueDate, lineItems, subtotal, discountPercentage, taxPercentage,
      notes, termsAndConditions, status
    } = req.body;

    // Verify invoice exists and user has access
    let checkQuery = 'SELECT * FROM invoices WHERE id = ?';
    const checkParams = [id];
    if (fpId) {
      checkQuery += ' AND franchise_partner_id = ?';
      checkParams.push(fpId);
    }
    const [existing] = await pool.execute(checkQuery, checkParams);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = existing[0];

    // Calculate amounts
    const sub = parseFloat(subtotal) || parseFloat(invoice.subtotal);
    const discPct = discountPercentage !== undefined ? parseFloat(discountPercentage) : parseFloat(invoice.discount_percentage);
    const taxPct = taxPercentage !== undefined ? parseFloat(taxPercentage) : parseFloat(invoice.tax_percentage);
    const discountAmount = sub * (discPct / 100);
    const taxableAmount = sub - discountAmount;
    const taxAmount = taxableAmount * (taxPct / 100);
    const totalAmount = taxableAmount + taxAmount;
    const balanceAmount = totalAmount - parseFloat(invoice.amount_paid);

    // Determine payment status based on amounts
    let paymentStatus = invoice.payment_status;
    if (balanceAmount <= 0) {
      paymentStatus = 'paid';
    } else if (parseFloat(invoice.amount_paid) > 0) {
      paymentStatus = 'partially_paid';
    } else {
      paymentStatus = 'pending';
    }

    await pool.execute(`
      UPDATE invoices SET
        customer_name = COALESCE(?, customer_name),
        customer_email = COALESCE(?, customer_email),
        customer_phone = COALESCE(?, customer_phone),
        invoice_date = COALESCE(?, invoice_date),
        due_date = COALESCE(?, due_date),
        line_items = COALESCE(?, line_items),
        subtotal = ?,
        discount_percentage = ?,
        discount_amount = ?,
        tax_percentage = ?,
        tax_amount = ?,
        total_amount = ?,
        balance_amount = ?,
        payment_status = ?,
        notes = COALESCE(?, notes),
        terms_and_conditions = COALESCE(?, terms_and_conditions),
        status = COALESCE(?, status),
        updated_at = NOW()
      WHERE id = ?
    `, [
      customerName, customerEmail, customerPhone,
      invoiceDate, dueDate, lineItems ? JSON.stringify(lineItems) : null,
      sub, discPct, discountAmount, taxPct, taxAmount, totalAmount, balanceAmount, paymentStatus,
      notes, termsAndConditions, status,
      id
    ]);

    res.json({ success: true, message: 'Invoice updated successfully' });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ success: false, message: 'Error updating invoice', error: error.message });
  }
});

// Send invoice (mark as sent, generate payment link placeholder)
router.post('/invoices/:id/send', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = 'SELECT * FROM invoices WHERE id = ?';
    const params = [id];
    if (fpId) {
      query += ' AND franchise_partner_id = ?';
      params.push(fpId);
    }
    const [invoices] = await pool.execute(query, params);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    
    // For Phase 1, we generate a placeholder payment link (Static QR approach)
    // In future, this will integrate with Razorpay
    const paymentLink = `${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/pay/${invoice.invoice_id}`;

    await pool.execute(`
      UPDATE invoices SET 
        status = 'sent',
        payment_link = ?,
        payment_link_created_at = NOW(),
        sent_at = NOW(),
        sent_by = ?
      WHERE id = ?
    `, [paymentLink, req.user.id, id]);

    // TODO: Send email to customer with payment link

    res.json({
      success: true,
      message: 'Invoice sent successfully',
      data: { paymentLink }
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    res.status(500).json({ success: false, message: 'Error sending invoice', error: error.message });
  }
});

// ============================================
// PAYMENTS (Manual Payment Recording)
// ============================================

// Get all payments
router.get('/payments', authenticate, canViewPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { invoiceId, status, paymentMethod, startDate, endDate, search } = req.query;

    let query = `
      SELECT p.*, i.invoice_id as invoice_code
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (fpId) {
      query += ' AND p.franchise_partner_id = ?';
      params.push(fpId);
    }

    if (invoiceId) {
      query += ' AND p.invoice_id = ?';
      params.push(invoiceId);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (paymentMethod) {
      query += ' AND p.payment_method = ?';
      params.push(paymentMethod);
    }

    if (startDate) {
      query += ' AND p.payment_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND p.payment_date <= ?';
      params.push(endDate);
    }

    if (search) {
      query += ' AND (p.payment_id LIKE ? OR p.customer_name LIKE ? OR p.transaction_reference LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    const [payments] = await pool.execute(query, params);

    res.json({
      success: true,
      data: payments.map(p => ({
        id: p.id,
        paymentId: p.payment_id,
        invoiceId: p.invoice_id,
        invoiceCode: p.invoice_code,
        propertyId: p.property_id,
        estimateId: p.estimate_id,
        customerId: p.customer_id,
        customerName: p.customer_name,
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method,
        paymentType: p.payment_type,
        transactionReference: p.transaction_reference,
        paymentDate: p.payment_date,
        paymentProofUrl: p.payment_proof_url,
        status: p.status,
        receivedBy: p.received_by_name,
        receivedByRole: p.received_by_role,
        remarks: p.remarks,
        createdAt: p.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments', error: error.message });
  }
});

// Record manual payment
router.post('/payments', authenticate, canEditPayments, upload.single('paymentProof'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const fpId = getFPScope(req);
    const {
      invoiceId, propertyId, estimateId, customerId, customerName,
      amount, paymentMethod, transactionReference, paymentDate, remarks
    } = req.body;

    // Validate required fields
    if (!invoiceId || !amount || !paymentMethod || !paymentDate) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invoice ID, amount, payment method, and payment date are required'
      });
    }

    // Validate transaction reference for non-cash payments
    if (paymentMethod !== 'cash' && !transactionReference) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Transaction reference is required for UPI, Bank Transfer, and Card payments'
      });
    }

    // Get invoice details
    const [invoices] = await connection.execute(
      'SELECT * FROM invoices WHERE id = ?',
      [invoiceId]
    );

    if (invoices.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const paymentAmount = parseFloat(amount);

    // Generate payment ID
    const paymentId = await generatePaymentId(fpId);

    // Get payment proof URL if uploaded
    const paymentProofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;

    // Insert payment record
    const [result] = await connection.execute(`
      INSERT INTO payments (
        payment_id, invoice_id, property_id, estimate_id, customer_id, franchise_partner_id,
        customer_name, amount, payment_method, payment_type,
        transaction_reference, payment_date, payment_proof_url,
        status, received_by, received_by_name, received_by_role, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      paymentId,
      invoiceId,
      propertyId || invoice.property_id,
      estimateId || invoice.estimate_id,
      customerId || invoice.customer_id,
      fpId || invoice.franchise_partner_id,
      customerName || invoice.customer_name,
      paymentAmount,
      paymentMethod,
      'manual',
      transactionReference || null,
      paymentDate,
      paymentProofUrl,
      'completed',
      req.user.id,
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username,
      req.user.role,
      remarks || null
    ]);

    // Update invoice amounts
    const newAmountPaid = parseFloat(invoice.amount_paid) + paymentAmount;
    const newBalance = parseFloat(invoice.total_amount) - newAmountPaid;

    // Determine new payment status
    let newPaymentStatus = 'pending';
    let newStatus = invoice.status;
    if (newBalance <= 0) {
      newPaymentStatus = 'paid';
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newPaymentStatus = 'partially_paid';
    }

    await connection.execute(`
      UPDATE invoices SET
        amount_paid = ?,
        balance_amount = ?,
        payment_status = ?,
        status = ?
      WHERE id = ?
    `, [newAmountPaid, Math.max(0, newBalance), newPaymentStatus, newStatus, invoiceId]);

    // If invoice is fully paid and linked to a work order, auto-close the work order
    if (newPaymentStatus === 'paid' && invoice.work_order_id) {
      console.log(`[Payment] Invoice ${invoiceId} fully paid, auto-closing linked work order ${invoice.work_order_id}`);
      
      // Update work order status to 'closed'
      await connection.execute(`
        UPDATE work_orders SET
          status = 'closed',
          admin_notes = CONCAT(IFNULL(admin_notes, ''), '\nPayment verified and closed on ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')),
          updated_at = NOW()
        WHERE id = ? AND status = 'completed'
      `, [invoice.work_order_id]);
      
      // Log the status change in work order history
      try {
        await connection.execute(`
          INSERT INTO work_order_status_history (work_order_id, to_status, changed_by, changed_by_role, notes)
          VALUES (?, 'closed', ?, ?, 'Auto-closed after invoice payment verified')
        `, [invoice.work_order_id, req.user.id, req.user.role]);
      } catch (historyErr) {
        // Ignore if history table doesn't exist
        console.log('[Payment] Work order status history logging skipped:', historyErr.message);
      }
    }

    // Record in payment history
    await connection.execute(`
      INSERT INTO payment_history (
        payment_id, invoice_id, action, new_status, amount,
        description, performed_by, performed_by_name, performed_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      result.insertId,
      invoiceId,
      'created',
      'completed',
      paymentAmount,
      `Manual payment recorded via ${paymentMethod}${transactionReference ? ` (Ref: ${transactionReference})` : ''}`,
      req.user.id,
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      req.user.role
    ]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        id: result.insertId,
        paymentId,
        newBalance: Math.max(0, newBalance),
        paymentStatus: newPaymentStatus
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: 'Error recording payment', error: error.message });
  } finally {
    connection.release();
  }
});

// Get payment history
router.get('/history', authenticate, canViewPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { invoiceId, paymentId, startDate, endDate } = req.query;

    let query = `
      SELECT ph.*, p.payment_id as payment_code, i.invoice_id as invoice_code
      FROM payment_history ph
      LEFT JOIN payments p ON ph.payment_id = p.id
      LEFT JOIN invoices i ON ph.invoice_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (fpId) {
      query += ' AND (p.franchise_partner_id = ? OR i.franchise_partner_id = ?)';
      params.push(fpId, fpId);
    }

    if (invoiceId) {
      query += ' AND ph.invoice_id = ?';
      params.push(invoiceId);
    }

    if (paymentId) {
      query += ' AND ph.payment_id = ?';
      params.push(paymentId);
    }

    if (startDate) {
      query += ' AND DATE(ph.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(ph.created_at) <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY ph.created_at DESC';

    const [history] = await pool.execute(query, params);

    res.json({
      success: true,
      data: history.map(h => ({
        id: h.id,
        paymentId: h.payment_id,
        paymentCode: h.payment_code,
        invoiceId: h.invoice_id,
        invoiceCode: h.invoice_code,
        action: h.action,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        amount: h.amount ? parseFloat(h.amount) : null,
        description: h.description,
        performedBy: h.performed_by_name,
        performedByRole: h.performed_by_role,
        createdAt: h.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment history', error: error.message });
  }
});

// ============================================
// QR CODE MANAGEMENT (Static UPI QR)
// ============================================

// Get QR codes for FP
router.get('/qr-codes', authenticate, canViewPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);

    let query = 'SELECT * FROM payment_qr_codes WHERE 1=1';
    const params = [];

    if (fpId) {
      query += ' AND franchise_partner_id = ?';
      params.push(fpId);
    }

    query += ' ORDER BY created_at DESC';

    const [qrCodes] = await pool.execute(query, params);

    res.json({
      success: true,
      data: qrCodes.map(qr => ({
        id: qr.id,
        upiId: qr.upi_id,
        accountName: qr.account_name,
        bankName: qr.bank_name,
        qrCodeUrl: qr.qr_code_url,
        isActive: qr.is_active,
        createdAt: qr.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ success: false, message: 'Error fetching QR codes', error: error.message });
  }
});

// Add QR code
router.post('/qr-codes', authenticate, canEditPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { upiId, accountName, bankName, qrCodeUrl } = req.body;

    if (!upiId || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'UPI ID and Account Name are required'
      });
    }

    const [result] = await pool.execute(`
      INSERT INTO payment_qr_codes (
        franchise_partner_id, upi_id, account_name, bank_name, qr_code_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [fpId, upiId, accountName, bankName || null, qrCodeUrl || null, req.user.id]);

    res.status(201).json({
      success: true,
      message: 'QR code added successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error adding QR code:', error);
    res.status(500).json({ success: false, message: 'Error adding QR code', error: error.message });
  }
});

// Update QR code
router.put('/qr-codes/:id', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    const { upiId, accountName, bankName, qrCodeUrl, isActive } = req.body;

    let query = 'SELECT * FROM payment_qr_codes WHERE id = ?';
    const params = [id];
    if (fpId) {
      query += ' AND franchise_partner_id = ?';
      params.push(fpId);
    }
    const [existing] = await pool.execute(query, params);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    await pool.execute(`
      UPDATE payment_qr_codes SET
        upi_id = COALESCE(?, upi_id),
        account_name = COALESCE(?, account_name),
        bank_name = COALESCE(?, bank_name),
        qr_code_url = COALESCE(?, qr_code_url),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [upiId, accountName, bankName, qrCodeUrl, isActive, id]);

    res.json({ success: true, message: 'QR code updated successfully' });
  } catch (error) {
    console.error('Error updating QR code:', error);
    res.status(500).json({ success: false, message: 'Error updating QR code', error: error.message });
  }
});

// Delete QR code
router.delete('/qr-codes/:id', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = 'SELECT * FROM payment_qr_codes WHERE id = ?';
    const params = [id];
    if (fpId) {
      query += ' AND franchise_partner_id = ?';
      params.push(fpId);
    }
    const [existing] = await pool.execute(query, params);

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'QR code not found' });
    }

    await pool.execute('DELETE FROM payment_qr_codes WHERE id = ?', [id]);

    res.json({ success: true, message: 'QR code deleted successfully' });
  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({ success: false, message: 'Error deleting QR code', error: error.message });
  }
});

module.exports = router;
