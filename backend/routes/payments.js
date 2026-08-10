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

// Generate unique receipt ID (format: RCP-00001)
const generateReceiptId = async (fpId = null) => {
  const prefix = 'RCP';
  
  try {
    // Get max receipt number across all receipts (global sequence)
    const [existing] = await pool.execute(
      'SELECT MAX(current_number) as max_number FROM receipt_sequence WHERE franchise_partner_id <=> ?',
      [fpId]
    );
    
    let nextNumber;
    if (existing.length > 0 && existing[0].max_number) {
      nextNumber = existing[0].max_number + 1;
      await pool.execute(
        'UPDATE receipt_sequence SET current_number = ? WHERE franchise_partner_id <=> ?',
        [nextNumber, fpId]
      );
    } else {
      // Check if sequence record exists
      const [seqExists] = await pool.execute(
        'SELECT id FROM receipt_sequence WHERE franchise_partner_id <=> ?',
        [fpId]
      );
      
      nextNumber = 1;
      if (seqExists.length > 0) {
        await pool.execute(
          'UPDATE receipt_sequence SET current_number = ? WHERE franchise_partner_id <=> ?',
          [nextNumber, fpId]
        );
      } else {
        await pool.execute(
          'INSERT INTO receipt_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
          [fpId, new Date().getFullYear(), nextNumber, prefix]
        );
      }
    }
    
    // Format: RCP-00001
    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    console.error('Error generating receipt ID:', error);
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}-${timestamp}`;
  }
};

// ============================================
// PROPERTY LOOKUP BY CODE
// ============================================

// Get property details by property code (for auto-fill in invoice creation)
router.get('/properties/by-code/:code', authenticate, canViewPayments, async (req, res) => {
  try {
    const { code } = req.params;
    const fpId = getFPScope(req);
    
    // Try onboarded_properties first
    let query = `
      SELECT op.id, op.property_id, op.community_name as name,
             op.contact_person as customer_name,
             op.contact_email as customer_email,
             op.contact_phone as customer_phone,
             op.property_type, op.zone, op.division
      FROM onboarded_properties op
      WHERE op.property_id = ?
    `;
    const params = [code];
    
    if (fpId) {
      query += ' AND op.franchise_partner_id = ?';
      params.push(fpId);
    }
    
    let [properties] = await pool.execute(query, params);
    
    // If not found, try properties table
    if (properties.length === 0) {
      let query2 = `
        SELECT p.id, p.property_id, p.name,
               p.contact_person as customer_name,
               p.contact_email as customer_email,
               p.contact_phone as customer_phone,
               p.property_type, p.zone_id as zone
        FROM properties p
        WHERE p.property_id = ?
      `;
      const params2 = [code];
      
      if (fpId) {
        query2 += ' AND p.franchise_partner_id = ?';
        params2.push(fpId);
      }
      
      [properties] = await pool.execute(query2, params2);
    }
    
    // Also check customer_accounts for customer info
    if (properties.length > 0) {
      const propId = properties[0].id;
      const [customers] = await pool.execute(
        `SELECT name, email, phone FROM customer_accounts WHERE property_id = ? LIMIT 1`,
        [propId]
      );
      
      if (customers.length > 0) {
        properties[0].customer_name = customers[0].name || properties[0].customer_name;
        properties[0].customer_email = customers[0].email || properties[0].customer_email;
        properties[0].customer_phone = customers[0].phone || properties[0].customer_phone;
      }
    }
    
    if (properties.length === 0) {
      return res.json({ success: false, message: 'Property not found' });
    }
    
    res.json({ success: true, data: properties[0] });
  } catch (error) {
    console.error('Error fetching property by code:', error);
    res.status(500).json({ success: false, message: 'Error fetching property' });
  }
});

// Get approved estimates by property code (for invoice creation)
router.get('/estimates/by-property/:code', authenticate, canViewPayments, async (req, res) => {
  try {
    const { code } = req.params;
    const { status } = req.query;
    const fpId = getFPScope(req);
    
    // Search in fp_estimates table
    let query = `
      SELECT fe.id, fe.estimate_id, fe.property_id, fe.property_name, fe.property_code,
             fe.customer_name, fe.customer_email, fe.customer_phone,
             fe.service_type, fe.subtotal, fe.discount, fe.tax, fe.total,
             fe.line_items, fe.status, fe.created_at
      FROM fp_estimates fe
      WHERE (fe.property_code = ? OR fe.property_id = ?)
    `;
    const params = [code, code];
    
    if (status) {
      query += ' AND fe.status = ?';
      params.push(status);
    }
    
    if (fpId) {
      query += ' AND fe.franchise_partner_id = ?';
      params.push(fpId);
    }
    
    // Exclude estimates that already have invoices
    query += ` AND fe.id NOT IN (
      SELECT COALESCE(source_estimate_id, 0) FROM invoices WHERE source_estimate_id IS NOT NULL
    )`;
    
    query += ' ORDER BY fe.created_at DESC';
    
    const [estimates] = await pool.execute(query, params);
    
    // Also check regular estimates table
    let query2 = `
      SELECT e.id, e.estimate_id, e.property_id, p.name as property_name, p.property_id as property_code,
             e.customer_name, e.customer_email, e.customer_phone,
             e.service_type, e.subtotal, e.discount_amount as discount, e.tax_amount as tax, e.total,
             e.line_items, e.status, e.created_at
      FROM estimates e
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE (p.property_id = ? OR e.property_id = ?)
    `;
    const params2 = [code, code];
    
    if (status) {
      query2 += ' AND e.status = ?';
      params2.push(status);
    }
    
    if (fpId) {
      query2 += ' AND e.franchise_partner_id = ?';
      params2.push(fpId);
    }
    
    query2 += ` AND e.id NOT IN (
      SELECT COALESCE(estimate_id, 0) FROM invoices WHERE estimate_id IS NOT NULL
    )`;
    
    query2 += ' ORDER BY e.created_at DESC';
    
    const [regularEstimates] = await pool.execute(query2, params2);
    
    // Combine and return
    const allEstimates = [...estimates, ...regularEstimates];
    
    res.json({ success: true, data: allEstimates });
  } catch (error) {
    console.error('Error fetching estimates by property:', error);
    res.status(500).json({ success: false, message: 'Error fetching estimates' });
  }
});

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
    const { status, paymentStatus, search, propertyId, customerId, archived, invoiceType } = req.query;
    
    let query = `
      SELECT i.*, 
             COALESCE(p.community_name, fe.property_name) as property_name, 
             COALESCE(p.property_id, fe.property_code) as property_code,
             c.name as client_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN fp_estimates fe ON i.source_estimate_id = fe.estimate_id
      LEFT JOIN clients c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (fpId) {
      query += ' AND i.franchise_partner_id = ?';
      params.push(fpId);
    }

    // Filter by archived status
    if (archived === 'true') {
      query += ' AND i.archived = 1';
    } else if (archived === 'false') {
      query += ' AND (i.archived = 0 OR i.archived IS NULL)';
    }

    // Filter by invoice type
    if (invoiceType && invoiceType !== 'all') {
      query += ' AND i.invoice_type = ?';
      params.push(invoiceType);
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
        invoiceType: i.invoice_type || 'manual',
        propertyId: i.property_id,
        propertyName: i.property_name || i.customer_name,
        propertyCode: i.property_code,
        estimateId: i.estimate_id,
        sourceEstimateId: i.source_estimate_id,
        sourceWorkOrderId: i.source_work_order_id,
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
        lineItems: i.line_items,
        notes: i.notes,
        autoGenerated: i.auto_generated,
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
             p.community_name as property_name, p.property_id as property_code,
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

// Archive invoice (soft delete)
router.put('/invoices/:id/archive', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    
    // Ensure archived column exists
    try {
      await pool.execute(`ALTER TABLE invoices ADD COLUMN archived TINYINT(1) DEFAULT 0`);
      await pool.execute(`ALTER TABLE invoices ADD COLUMN archived_at TIMESTAMP NULL`);
    } catch (e) { /* Column might already exist */ }
    
    let query = 'UPDATE invoices SET archived = 1, archived_at = NOW() WHERE id = ?';
    const params = [id];
    
    if (fpId) {
      query = 'UPDATE invoices SET archived = 1, archived_at = NOW() WHERE id = ? AND franchise_partner_id = ?';
      params.push(fpId);
    }
    
    await pool.execute(query, params);
    res.json({ success: true, message: 'Invoice archived successfully' });
  } catch (error) {
    console.error('Error archiving invoice:', error);
    res.status(500).json({ success: false, message: 'Error archiving invoice', error: error.message });
  }
});

// Restore archived invoice
router.put('/invoices/:id/restore', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    
    let query = 'UPDATE invoices SET archived = 0, archived_at = NULL WHERE id = ?';
    const params = [id];
    
    if (fpId) {
      query = 'UPDATE invoices SET archived = 0, archived_at = NULL WHERE id = ? AND franchise_partner_id = ?';
      params.push(fpId);
    }
    
    await pool.execute(query, params);
    res.json({ success: true, message: 'Invoice restored successfully' });
  } catch (error) {
    console.error('Error restoring invoice:', error);
    res.status(500).json({ success: false, message: 'Error restoring invoice', error: error.message });
  }
});

// Delete invoice permanently
router.delete('/invoices/:id', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    
    let query = 'DELETE FROM invoices WHERE id = ?';
    const params = [id];
    
    if (fpId) {
      query = 'DELETE FROM invoices WHERE id = ? AND franchise_partner_id = ?';
      params.push(fpId);
    }
    
    await pool.execute(query, params);
    res.json({ success: true, message: 'Invoice deleted permanently' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, message: 'Error deleting invoice', error: error.message });
  }
});

// Delete all archived invoices
router.delete('/invoices/archived/delete-all', authenticate, canEditPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    
    let query = 'DELETE FROM invoices WHERE archived = 1';
    const params = [];
    
    if (fpId) {
      query += ' AND franchise_partner_id = ?';
      params.push(fpId);
    }
    
    const [result] = await pool.execute(query, params);
    res.json({ success: true, message: 'All archived invoices deleted', deletedCount: result.affectedRows });
  } catch (error) {
    console.error('Error deleting archived invoices:', error);
    res.status(500).json({ success: false, message: 'Error deleting archived invoices', error: error.message });
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
      SELECT p.*, 
             i.invoice_id as invoice_code, i.estimate_id as invoice_estimate_id,
             i.total_amount as invoice_amount, i.balance_amount as invoice_balance,
             i.customer_name as invoice_customer_name, i.customer_email as invoice_customer_email,
             prop.community_name as property_name, prop.property_id as property_code
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON p.property_id = prop.id
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
        paymentId: p.payment_id || `PYMT-${String(p.id).padStart(4, '0')}`,
        invoiceId: p.invoice_code || p.invoice_id,
        invoiceCode: p.invoice_code,
        propertyId: p.property_id,
        propertyName: p.property_name,
        propertyCode: p.property_code,
        estimateId: p.estimate_id || p.invoice_estimate_id,
        customerId: p.customer_id,
        customerName: p.customer_name || p.invoice_customer_name,
        customerEmail: p.customer_email || p.invoice_customer_email,
        amount: parseFloat(p.amount),
        invoiceAmount: parseFloat(p.invoice_amount) || 0,
        balanceAmount: parseFloat(p.invoice_balance) || 0,
        paymentMethod: p.payment_method,
        paymentType: p.payment_type,
        transactionReference: p.transaction_reference,
        bankName: p.bank_name,
        paymentDate: p.payment_date,
        proofUrl: p.payment_proof_url,
        proofFilename: p.proof_filename,
        status: p.status,
        recordedBy: p.received_by_name,
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
      amount, paymentMethod, transactionReference, paymentDate, remarks,
      receivedBy, paymentStatus
    } = req.body;

    // Validate required fields
    if (!invoiceId || !amount || !paymentMethod || !paymentDate) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invoice ID, amount, payment method, and payment date are required'
      });
    }

    // Transaction reference is optional but recommended for non-cash payments
    // Removed the requirement to make it more flexible

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

    // Generate payment ID and receipt ID
    const paymentId = await generatePaymentId(fpId);
    const receiptId = await generateReceiptId(fpId);

    // Get payment proof URL if uploaded
    const paymentProofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;

    // Determine received by name - use provided value or default to current user
    const receivedByName = receivedBy || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username;

    // Insert payment record with full linkage
    const [result] = await connection.execute(`
      INSERT INTO payments (
        payment_id, receipt_id, invoice_id, invoice_number, property_id, property_code,
        estimate_id, estimate_number, customer_id, franchise_partner_id,
        customer_name, amount, payment_method, payment_type,
        transaction_reference, payment_date, payment_proof_url,
        status, received_by, received_by_name, received_by_role, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      paymentId,
      receiptId,
      invoiceId,
      invoice.invoice_id, // Store invoice number string
      propertyId || invoice.property_id,
      invoice.property_code || null, // Store property code string
      estimateId || invoice.estimate_id,
      invoice.source_estimate_id || null, // Store estimate number string
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
      receivedByName,
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

// Alias for record payment (frontend uses /record)
router.post('/record', authenticate, canEditPayments, upload.single('paymentProof'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const fpId = getFPScope(req);
    const {
      invoiceId, amount, paymentMethod, transactionReference, paymentDate, 
      bankName, remarks
    } = req.body;

    if (!invoiceId || !amount || !paymentMethod || !paymentDate) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invoice ID, amount, payment method, and payment date are required'
      });
    }

    const [invoices] = await connection.execute('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (invoices.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const paymentAmount = parseFloat(amount);

    // Generate payment ID
    const [maxPayment] = await connection.execute('SELECT MAX(id) as maxId FROM payments');
    const nextId = (maxPayment[0]?.maxId || 0) + 1;
    const paymentId = `PYMT-${String(nextId).padStart(4, '0')}`;

    // Ensure bank_name column exists
    try {
      await connection.execute('ALTER TABLE payments ADD COLUMN bank_name VARCHAR(255)');
    } catch (e) { /* Column might exist */ }

    const paymentProofUrl = req.file ? `/uploads/payments/${req.file.filename}` : null;
    const receivedByName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.username;

    const [result] = await connection.execute(`
      INSERT INTO payments (
        payment_id, invoice_id, invoice_number, property_id, property_code,
        estimate_id, customer_id, franchise_partner_id,
        customer_name, amount, payment_method, payment_type,
        transaction_reference, bank_name, payment_date, payment_proof_url,
        status, received_by, received_by_name, received_by_role, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      paymentId,
      invoiceId,
      invoice.invoice_id,
      invoice.property_id,
      invoice.property_code,
      invoice.source_estimate_id,
      invoice.customer_id,
      fpId || invoice.franchise_partner_id,
      invoice.customer_name,
      paymentAmount,
      paymentMethod,
      'manual',
      transactionReference || null,
      bankName || null,
      paymentDate,
      paymentProofUrl,
      'paid',
      req.user.id,
      receivedByName,
      req.user.role,
      remarks || null
    ]);

    // Update invoice
    const newAmountPaid = parseFloat(invoice.amount_paid || 0) + paymentAmount;
    const newBalance = parseFloat(invoice.total_amount) - newAmountPaid;
    const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

    await connection.execute(`
      UPDATE invoices SET amount_paid = ?, balance_amount = ?, payment_status = ?, status = ? WHERE id = ?
    `, [newAmountPaid, Math.max(0, newBalance), newStatus, newStatus, invoiceId]);

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { id: result.insertId, paymentId, newBalance: Math.max(0, newBalance) }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: 'Error recording payment', error: error.message });
  } finally {
    connection.release();
  }
});

// Archive payment (soft delete)
router.put('/payments/:id/archive', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    
    // Ensure archived column exists
    try {
      await pool.execute('ALTER TABLE payments ADD COLUMN archived TINYINT(1) DEFAULT 0');
      await pool.execute('ALTER TABLE payments ADD COLUMN archived_at TIMESTAMP NULL');
    } catch (e) { /* Column might exist */ }
    
    let query = 'UPDATE payments SET archived = 1, archived_at = NOW() WHERE id = ?';
    const params = [id];
    
    if (fpId) {
      query = 'UPDATE payments SET archived = 1, archived_at = NOW() WHERE id = ? AND franchise_partner_id = ?';
      params.push(fpId);
    }
    
    await pool.execute(query, params);
    res.json({ success: true, message: 'Payment archived successfully' });
  } catch (error) {
    console.error('Error archiving payment:', error);
    res.status(500).json({ success: false, message: 'Error archiving payment', error: error.message });
  }
});

// Update payment
router.put('/payments/:id', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    const { amount, transactionReference, remarks, bankName, status } = req.body;
    
    let query = `UPDATE payments SET 
      amount = COALESCE(?, amount),
      transaction_reference = COALESCE(?, transaction_reference),
      remarks = COALESCE(?, remarks),
      bank_name = COALESCE(?, bank_name),
      status = COALESCE(?, status),
      updated_at = NOW()
      WHERE id = ?`;
    const params = [amount, transactionReference, remarks, bankName, status, id];
    
    if (fpId) {
      query = `UPDATE payments SET 
        amount = COALESCE(?, amount),
        transaction_reference = COALESCE(?, transaction_reference),
        remarks = COALESCE(?, remarks),
        bank_name = COALESCE(?, bank_name),
        status = COALESCE(?, status),
        updated_at = NOW()
        WHERE id = ? AND franchise_partner_id = ?`;
      params.push(fpId);
    }
    
    await pool.execute(query, params);
    res.json({ success: true, message: 'Payment updated successfully' });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ success: false, message: 'Error updating payment', error: error.message });
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
