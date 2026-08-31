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

// Payment Security Middleware
const {
  paymentCreationLimiter,
  validatePaymentAmountMiddleware,
  fraudDetectionMiddleware,
  logSecurityEvent
} = require('../middleware/paymentSecurity');
const {
  validatePaymentAmount,
  getClientIP,
  hashIP
} = require('../utils/paymentSecurity');
const { generateInvoicePDF } = require('../services/pdfService');

// Secure file upload configuration for payment proofs
// SECURITY: Whitelist both MIME types AND file extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MIME_TO_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 
  'image/webp': '.webp', 'application/pdf': '.pdf'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'payments')),
  filename: (req, file, cb) => {
    const safeExt = MIME_TO_EXT[file.mimetype] || '.bin';
    cb(null, `payment-${Date.now()}-${uuidv4()}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
    if (isValidMime && isValidExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs allowed.'), false);
    }
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

// Generate unique invoice ID (Format: INV-00001)
const generateInvoiceId = async (fpId = null) => {
  const prefix = 'INV';
  
  try {
    // Get the max invoice number across all invoices (global sequence)
    const [existing] = await pool.execute(
      `SELECT MAX(CAST(SUBSTRING(invoice_id, 5) AS UNSIGNED)) as max_num 
       FROM invoices 
       WHERE invoice_id LIKE 'INV-%' AND invoice_id REGEXP '^INV-[0-9]+$'`
    );
    
    let nextNumber = 1;
    if (existing.length > 0 && existing[0].max_num) {
      nextNumber = existing[0].max_num + 1;
    }
    
    // Format: INV-00001
    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    console.error('Error generating invoice ID:', error);
    // Fallback: get count + 1
    const [countResult] = await pool.execute('SELECT COUNT(*) as cnt FROM invoices');
    const nextNumber = (countResult[0]?.cnt || 0) + 1;
    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
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
             fe.client_name as customer_name, fe.client_email as customer_email, fe.client_phone as customer_phone,
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
    
    // Exclude estimates that already have invoices (check both id and estimate_id string)
    query += ` AND fe.id NOT IN (
      SELECT COALESCE(estimate_id, 0) FROM invoices WHERE estimate_id IS NOT NULL
    ) AND fe.estimate_id NOT IN (
      SELECT COALESCE(source_estimate_id, '') FROM invoices WHERE source_estimate_id IS NOT NULL
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

// Get approved estimate by estimate ID (for invoice creation)
router.get('/estimates/by-id/:estimateId', authenticate, canViewPayments, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const { status } = req.query;
    const fpId = getFPScope(req);
    
    console.log(`🔍 Searching estimate by ID: ${estimateId}, status: ${status}, fpId: ${fpId}`);
    
    // First, check if estimate exists at all (without filters)
    const [existCheck] = await pool.execute(
      'SELECT id, estimate_id, status FROM fp_estimates WHERE estimate_id = ?',
      [estimateId]
    );
    console.log(`📋 Estimate existence check:`, existCheck.length > 0 ? existCheck[0] : 'NOT FOUND');
    
    // Check if invoice already exists for this estimate
    const [invoiceCheck] = await pool.execute(
      'SELECT id, invoice_id, source_estimate_id FROM invoices WHERE source_estimate_id = ?',
      [estimateId]
    );
    console.log(`🧾 Invoice check for estimate:`, invoiceCheck.length > 0 ? invoiceCheck[0] : 'NO INVOICE');
    
    // Search in fp_estimates table first
    let query = `
      SELECT fe.id, fe.estimate_id, fe.property_id, fe.property_name, fe.property_code,
             fe.client_name as customer_name, fe.client_email as customer_email, fe.client_phone as customer_phone,
             fe.subtotal, fe.discount_amount as discount, fe.gst_amount as tax, fe.total_amount as total,
             fe.package_services, fe.addons_data, fe.status, fe.created_at,
             fe.package_name, fe.package_price, fe.billing_duration
      FROM fp_estimates fe
      WHERE fe.estimate_id = ?
    `;
    const params = [estimateId];
    
    if (status) {
      query += ' AND LOWER(fe.status) = LOWER(?)';
      params.push(status);
    }
    
    if (fpId) {
      query += ' AND fe.franchise_partner_id = ?';
      params.push(fpId);
    }
    
    // Exclude estimates that already have invoices
    query += ` AND fe.estimate_id NOT IN (
      SELECT COALESCE(source_estimate_id, '') FROM invoices WHERE source_estimate_id IS NOT NULL
    )`;
    
    console.log(`📝 Query params:`, params);
    const [estimates] = await pool.execute(query, params);
    console.log(`📊 Query result:`, estimates.length, 'estimates found');
    
    if (estimates.length > 0) {
      return res.json({ success: true, data: estimates[0] });
    }
    
    // Also check regular estimates table
    let query2 = `
      SELECT e.id, e.estimate_id, e.property_id, p.name as property_name, p.property_id as property_code,
             e.customer_name, e.customer_email, e.customer_phone,
             e.service_type, e.subtotal, e.discount_amount as discount, e.tax_amount as tax, e.total,
             e.line_items, e.status, e.created_at
      FROM estimates e
      LEFT JOIN properties p ON e.property_id = p.id
      WHERE e.estimate_id = ?
    `;
    const params2 = [estimateId];
    
    if (status) {
      query2 += ' AND e.status = ?';
      params2.push(status);
    }
    
    if (fpId) {
      query2 += ' AND e.franchise_partner_id = ?';
      params2.push(fpId);
    }
    
    query2 += ` AND e.estimate_id NOT IN (
      SELECT COALESCE(source_estimate_id, '') FROM invoices WHERE source_estimate_id IS NOT NULL
    )`;
    
    const [regularEstimates] = await pool.execute(query2, params2);
    
    if (regularEstimates.length > 0) {
      return res.json({ success: true, data: regularEstimates[0] });
    }
    
    res.json({ success: false, message: 'No approved estimate found with this ID, or an invoice has already been generated for this estimate.' });
  } catch (error) {
    console.error('Error fetching estimate by ID:', error);
    res.status(500).json({ success: false, message: 'Error fetching estimate' });
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
    // For admins, allow fpId from query params; for FP users, use their scope
    const { status, paymentStatus, search, propertyId, customerId, archived, invoiceType, fpId: queryFpId } = req.query;
    const fpId = getFPScope(req) || (req.user.role === 'admin' || req.user.role === 'super_admin' ? queryFpId : null);
    
    let query = `
      SELECT i.*, 
             COALESCE(p.community_name, p2.community_name, fe.property_name) as property_name, 
             COALESCE(p.property_id, p2.property_id, fe.property_code, i.property_code) as property_code,
             COALESCE(p.property_type, p2.property_type, fe.property_type) as property_type,
             COALESCE(p.zone, p2.zone, fe.zone) as zone,
             COALESCE(p.city, p2.city, fe.city) as city,
             c.name as client_name
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN onboarded_properties p2 ON i.property_code = p2.property_id
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
      query += ' AND (i.invoice_id LIKE ? OR i.customer_name LIKE ? OR i.customer_email LIKE ? OR i.property_code LIKE ? OR COALESCE(p.property_id, p2.property_id, fe.property_code) LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
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
        propertyType: i.property_type,
        zone: i.zone,
        city: i.city,
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
        paymentLinkStatus: i.payment_link_status,
        paymentLinkCreatedAt: i.payment_link_created_at,
        paymentLinkExpiresAt: i.payment_link_expires_at,
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
             COALESCE(p.community_name, p2.community_name, fe.property_name) as property_name, 
             COALESCE(p.property_id, p2.property_id, i.property_code, fe.property_code) as property_code,
             COALESCE(p.property_type, p2.property_type, fe.property_type) as property_type,
             COALESCE(p.zone, p2.zone, fe.zone) as zone,
             COALESCE(p.city, p2.city, fe.city) as city,
             c.name as client_name,
             wo.category_name as work_order_category,
             wo.subcategory_name as work_order_subcategory,
             wo.description as work_order_description
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN onboarded_properties p2 ON i.property_code = p2.property_id
      LEFT JOIN fp_estimates fe ON i.source_estimate_id = fe.estimate_id
      LEFT JOIN clients c ON i.customer_id = c.id
      LEFT JOIN work_orders wo ON i.source_work_order_id = wo.work_order_id
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
    
    // Parse existing line items
    let lineItems = i.line_items ? (typeof i.line_items === 'string' ? JSON.parse(i.line_items) : i.line_items) : [];
    
    // If we have a source estimate, try to enrich line items with full descriptions
    if (i.source_estimate_id) {
      try {
        // Fetch estimate with AMC package services AND the original AMC package for full descriptions
        const [estimates] = await pool.execute(
          `SELECT fe.package_services, fe.addons_data, fe.package_id, fe.package_name,
                  fpamc_id.services as amcPackageServices,
                  fpamc_name.services as amcPackageServicesByName
           FROM fp_estimates fe
           LEFT JOIN fp_amc_packages fpamc_id ON fe.package_id = fpamc_id.id
           LEFT JOIN fp_amc_packages fpamc_name ON fe.package_name = fpamc_name.name AND fe.franchise_partner_id = fpamc_name.franchise_partner_id
           WHERE fe.estimate_id = ?`,
          [i.source_estimate_id]
        );
        
        if (estimates.length > 0) {
          const estimate = estimates[0];
          
          console.log('[Invoice Enrichment] Found estimate:', estimate.package_id, estimate.package_name);
          console.log('[Invoice Enrichment] AMC services from ID:', estimate.amcPackageServices ? 'YES (length: ' + (estimate.amcPackageServices?.length || 'N/A') + ')' : 'NO');
          console.log('[Invoice Enrichment] AMC services from Name:', estimate.amcPackageServicesByName ? 'YES (length: ' + (estimate.amcPackageServicesByName?.length || 'N/A') + ')' : 'NO');
          
          // Parse the AMC package services (these have the full descriptions)
          let amcServices = [];
          const amcServicesRaw = estimate.amcPackageServices || estimate.amcPackageServicesByName;
          console.log('[Invoice Enrichment] Raw AMC services type:', typeof amcServicesRaw);
          if (amcServicesRaw) {
            try {
              const parsed = typeof amcServicesRaw === 'string' ? JSON.parse(amcServicesRaw) : amcServicesRaw;
              console.log('[Invoice Enrichment] Parsed AMC services structure:', JSON.stringify(Object.keys(parsed || {})));
              console.log('[Invoice Enrichment] Has serviceRows:', !!parsed?.serviceRows, 'Has services:', !!parsed?.services, 'IsArray:', Array.isArray(parsed));
              amcServices = parsed?.serviceRows || parsed?.services || (Array.isArray(parsed) ? parsed : []);
              console.log('[Invoice Enrichment] Extracted services count:', amcServices.length);
              if (amcServices.length > 0) {
                console.log('[Invoice Enrichment] First service FULL structure:', JSON.stringify(amcServices[0]));
                console.log('[Invoice Enrichment] First service description:', amcServices[0]?.description || '(empty)');
              }
            } catch (e) { console.log('Error parsing AMC services:', e); }
          } else {
            console.log('[Invoice Enrichment] No AMC services raw data found!');
          }
          
          // Parse estimate's package_services
          let estimateServices = [];
          console.log('[Invoice Enrichment] Estimate package_services:', estimate.package_services ? 'EXISTS' : 'MISSING');
          if (estimate.package_services) {
            try {
              const rawEstServices = typeof estimate.package_services === 'string' 
                ? JSON.parse(estimate.package_services) 
                : estimate.package_services;
              // Handle both array format and object with serviceRows
              if (Array.isArray(rawEstServices)) {
                estimateServices = rawEstServices;
              } else if (rawEstServices?.serviceRows) {
                estimateServices = rawEstServices.serviceRows;
              } else if (rawEstServices?.services) {
                estimateServices = rawEstServices.services;
              }
              console.log('[Invoice Enrichment] Estimate services count:', estimateServices.length);
              if (estimateServices.length > 0) {
                console.log('[Invoice Enrichment] First estimate service:', JSON.stringify(estimateServices[0]));
              }
            } catch (e) { 
              console.log('[Invoice Enrichment] Error parsing estimate services:', e.message);
              estimateServices = []; 
            }
          }
          
          // Build enriched line items - ALWAYS use AMC package descriptions as primary source
          // The AMC package has full descriptions; estimate/invoice may have truncated versions
          const originalLineItems = [...lineItems]; // Keep original for matching
          
          // Determine the primary source of services (AMC package or estimate)
          const primaryServices = amcServices.length > 0 ? amcServices : estimateServices;
          const sourceType = amcServices.length > 0 ? 'AMC' : 'estimate';
          
          console.log(`[Invoice Enrichment] Using ${sourceType} services as primary source, count: ${primaryServices.length}`);
          console.log('[Invoice Enrichment] Original line items count:', originalLineItems.length);
          
          if (primaryServices.length > 0) {
            // Build a name lookup map for matching existing items
            const existingByName = {};
            originalLineItems.forEach((item, idx) => {
              const name = (item.name || item.description?.split(' - ')[0] || '').toLowerCase().trim();
              if (name) existingByName[name] = { item, idx };
            });
            
            // Use ALL services from the primary source (AMC/estimate), not just matching existing ones
            lineItems = primaryServices.map((service, idx) => {
              const serviceName = service.service || service.name || service.serviceName || 'Service';
              const fullDescription = service.description || service.service_description || service.details || '';
              
              // Try to find matching existing line item for price info
              const existingName = serviceName.toLowerCase().trim();
              const existing = existingByName[existingName]?.item || originalLineItems[idx] || {};
              
              console.log(`[Invoice Enrichment] Service ${idx + 1}: "${serviceName}" - Desc: "${fullDescription?.substring(0, 80)}..."`);
              
              return {
                ...existing,
                name: serviceName,
                description: fullDescription ? `${serviceName} - ${fullDescription}` : serviceName,
                details: fullDescription,
                service_description: fullDescription,
                frequency: service.frequency_type || service.frequencyType || service.frequency || existing.frequency || 'Other',
                visits: service.frequency_count || service.frequencyCount || service.visits || existing.visits || 1,
                totalPrice: parseFloat(existing.totalPrice || existing.total_price || service.totalPrice || service.price || 0),
                type: existing.type || 'service'
              };
            });
            
            console.log(`[Invoice Enrichment] Final line items count: ${lineItems.length}`);
          } else {
            console.log('[Invoice Enrichment] No AMC services or estimate services found - keeping original line items');
          }
          
          // Also enrich addons if present - fetch full descriptions from fp_addons table
          if (estimate.addons_data) {
            const addons = typeof estimate.addons_data === 'string' 
              ? JSON.parse(estimate.addons_data) 
              : estimate.addons_data;
            
            if (Array.isArray(addons)) {
              // Fetch all FP addons for full descriptions
              let fpAddons = [];
              try {
                const [addonsResult] = await pool.execute(
                  `SELECT id, service_name, description FROM fp_addons WHERE franchise_partner_id = ?`,
                  [i.franchise_partner_id]
                );
                fpAddons = addonsResult || [];
              } catch (e) { console.log('Error fetching fp_addons:', e); }
              
              addons.forEach(addon => {
                const addonName = addon.name || addon.serviceName || addon.service_name || 'Add-on';
                let addonDesc = addon.description || addon.service_description || '';
                
                // Try to find full description from fp_addons table
                if (fpAddons.length > 0) {
                  const matchingAddon = fpAddons.find(fa => 
                    (fa.service_name || '').toLowerCase() === addonName.toLowerCase()
                  );
                  if (matchingAddon && matchingAddon.description) {
                    addonDesc = matchingAddon.description;
                  }
                }
                
                // Check if addon already exists in lineItems
                const exists = lineItems.some(item => 
                  item.name?.toLowerCase() === addonName.toLowerCase() || 
                  item.description?.toLowerCase().includes(addonName.toLowerCase())
                );
                
                if (!exists) {
                  lineItems.push({
                    name: addonName,
                    description: addonDesc ? `${addonName} - ${addonDesc}` : addonName,
                    details: addonDesc,
                    frequency: addon.frequency || addon.frequencyType || 'Other',
                    visits: addon.visits || addon.frequencyCount || 1,
                    totalPrice: parseFloat(addon.totalPrice || addon.price || 0),
                    type: 'addon'
                  });
                }
              });
            }
          }
        }
      } catch (e) {
        console.error('Error enriching line items from estimate:', e);
      }
    }
    
    res.json({
      success: true,
      data: {
        id: i.id,
        invoiceId: i.invoice_id,
        invoiceType: i.invoice_type,
        propertyId: i.property_id,
        propertyName: i.property_name,
        propertyCode: i.property_code,
        propertyType: i.property_type,
        zone: i.zone,
        city: i.city,
        estimateId: i.estimate_id,
        sourceEstimateId: i.source_estimate_id,
        sourceWorkOrderId: i.source_work_order_id,
        category: i.work_order_category || null,
        subcategory: i.work_order_subcategory || null,
        workOrderDescription: i.work_order_description || null,
        customerId: i.customer_id,
        customerName: i.customer_name || i.client_name,
        customerEmail: i.customer_email,
        customerPhone: i.customer_phone,
        invoiceDate: i.invoice_date,
        dueDate: i.due_date,
        lineItems: lineItems,
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
        paymentLinkStatus: i.payment_link_status,
        paymentLinkCreatedAt: i.payment_link_created_at,
        paymentLinkExpiresAt: i.payment_link_expires_at,
        paymentLinkSentAt: i.payment_link_sent_at,
        razorpayPaymentLinkId: i.razorpay_payment_link_id,
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

// Download invoice as PDF (HTML response for now - client will print to PDF)
router.get('/invoices/:id/pdf', authenticate, canViewPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = `
      SELECT i.*, 
             COALESCE(p.community_name, p2.community_name, p3.community_name, fe.property_name) as property_name, 
             COALESCE(p.property_id, p2.property_id, i.property_code, fe.property_code) as property_code,
             COALESCE(p.property_type, p2.property_type, p3.property_type, fe.property_type) as property_type,
             COALESCE(p.zone, p2.zone, p3.zone, fe.zone) as zone, 
             COALESCE(p.city, p2.city, p3.city, fe.city) as city,
             COALESCE(p.contact_person, p2.contact_person, p3.contact_person) as contact_person, 
             COALESCE(p.contact_phone, p2.contact_phone, p3.contact_phone) as contact_phone, 
             COALESCE(p.contact_email, p2.contact_email, p3.contact_email) as contact_email,
             fe.work_order_id as est_work_order_id,
             fe.work_order_category,
             fe.work_order_subcategory,
             fe.work_order_description
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN onboarded_properties p2 ON i.property_code = p2.property_id
      LEFT JOIN fp_estimates fe ON i.source_estimate_id = fe.estimate_id
      LEFT JOIN onboarded_properties p3 ON fe.property_id = p3.id
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

    const invoice = invoices[0];
    
    // Parse existing line items
    let lineItems = invoice.line_items ? (typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items) : [];
    
    // Enrich line items from estimate if available (same logic as single invoice endpoint)
    if (invoice.source_estimate_id) {
      try {
        const [estimates] = await pool.execute(
          `SELECT fe.package_services, fe.addons_data, fe.package_id, fe.package_name,
                  fpamc_id.services as amcPackageServices,
                  fpamc_name.services as amcPackageServicesByName
           FROM fp_estimates fe
           LEFT JOIN fp_amc_packages fpamc_id ON fe.package_id = fpamc_id.id
           LEFT JOIN fp_amc_packages fpamc_name ON fe.package_name = fpamc_name.name AND fe.franchise_partner_id = fpamc_name.franchise_partner_id
           WHERE fe.estimate_id = ?`,
          [invoice.source_estimate_id]
        );
        
        if (estimates.length > 0) {
          const estimate = estimates[0];
          
          // Parse AMC services
          let amcServices = [];
          const amcServicesRaw = estimate.amcPackageServices || estimate.amcPackageServicesByName;
          if (amcServicesRaw) {
            try {
              const parsed = typeof amcServicesRaw === 'string' ? JSON.parse(amcServicesRaw) : amcServicesRaw;
              amcServices = parsed?.serviceRows || parsed?.services || (Array.isArray(parsed) ? parsed : []);
            } catch (e) { }
          }
          
          // Parse estimate services
          let estimateServices = [];
          if (estimate.package_services) {
            try {
              const rawEstServices = typeof estimate.package_services === 'string' 
                ? JSON.parse(estimate.package_services) 
                : estimate.package_services;
              if (Array.isArray(rawEstServices)) {
                estimateServices = rawEstServices;
              } else if (rawEstServices?.serviceRows) {
                estimateServices = rawEstServices.serviceRows;
              } else if (rawEstServices?.services) {
                estimateServices = rawEstServices.services;
              }
            } catch (e) { }
          }
          
          // Use ALL services from primary source
          const primaryServices = amcServices.length > 0 ? amcServices : estimateServices;
          const originalLineItems = [...lineItems];
          
          if (primaryServices.length > 0) {
            console.log(`[PDF Enrichment] Using ${primaryServices.length} services from estimate/AMC (original: ${originalLineItems.length})`);
            
            lineItems = primaryServices.map((service, idx) => {
              const serviceName = service.service || service.name || service.serviceName || 'Service';
              const fullDescription = service.description || service.service_description || service.details || '';
              const existing = originalLineItems[idx] || {};
              
              return {
                ...existing,
                name: serviceName,
                description: fullDescription ? `${serviceName} - ${fullDescription}` : serviceName,
                details: fullDescription,
                service_description: fullDescription,
                frequency: service.frequency_type || service.frequencyType || service.frequency || existing.frequency || 'Other',
                visits: service.frequency_count || service.frequencyCount || service.visits || existing.visits || 1,
                totalPrice: parseFloat(existing.totalPrice || existing.total_price || service.totalPrice || service.price || 0),
                type: existing.type || 'service'
              };
            });
          }
          
          // Add addons
          if (estimate.addons_data) {
            const addons = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
            if (Array.isArray(addons)) {
              addons.forEach(addon => {
                const addonName = addon.name || addon.serviceName || 'Add-on';
                const addonDesc = addon.description || addon.service_description || '';
                const exists = lineItems.some(item => item.name?.toLowerCase() === addonName.toLowerCase());
                if (!exists) {
                  lineItems.push({
                    name: addonName,
                    description: addonDesc ? `${addonName} - ${addonDesc}` : addonName,
                    details: addonDesc,
                    frequency: addon.frequency || 'Other',
                    visits: addon.visits || 1,
                    type: 'addon'
                  });
                }
              });
            }
          }
        }
      } catch (e) {
        console.error('[PDF] Error enriching line items:', e);
      }
    }
    
    console.log(`[PDF] Final line items count: ${lineItems.length}`);
    
    // Generate PDF using pdfService
    const pdfData = {
      invoiceId: invoice.invoice_id,
      estimateId: invoice.source_estimate_id,
      invoiceType: invoice.invoice_type,
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email,
      customerPhone: invoice.customer_phone,
      propertyName: invoice.property_name,
      propertyCode: invoice.property_code,
      propertyType: invoice.property_type,
      zone: invoice.zone,
      city: invoice.city,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      billingDuration: invoice.billing_duration,
      lineItems: JSON.stringify(lineItems), // Use enriched line items
      subtotal: invoice.subtotal,
      discountAmount: invoice.discount_amount,
      discountPercentage: invoice.discount_percentage,
      taxAmount: invoice.tax_amount,
      taxPercentage: invoice.tax_percentage,
      totalAmount: invoice.total_amount,
      balanceAmount: invoice.balance_amount,
      workOrderId: invoice.work_order_id || invoice.est_work_order_id,
      workOrderCategory: invoice.work_order_category,
      workOrderSubcategory: invoice.work_order_subcategory,
      workOrderDescription: invoice.work_order_description
    };
    
    console.log('[PDF] Invoice Data:', { 
      invoiceId: pdfData.invoiceId,
      lineItemsCount: lineItems.length,
      lineItems: lineItems.map((item, idx) => ({
        index: idx + 1,
        name: item.name || item.serviceName,
        hasDescription: !!(item.description || item.details || item.service_description)
      })),
      workOrderId: pdfData.workOrderId
    });
    
    const pdfBuffer = await generateInvoicePDF(pdfData);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${invoice.invoice_id}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ success: false, message: 'Error generating invoice PDF', error: error.message });
  }
});

// Create invoice
router.post('/invoices', authenticate, canEditPayments, paymentCreationLimiter, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const {
      propertyId, estimateId, customerId, customerName, customerEmail, customerPhone,
      invoiceDate, dueDate, lineItems, subtotal, discountPercentage, taxPercentage,
      notes, termsAndConditions, workOrderId
    } = req.body;

    // Validate subtotal amount for security
    const subtotalValidation = validatePaymentAmount(subtotal, { minAmount: 0, allowZero: true });
    if (!subtotalValidation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subtotal: ' + subtotalValidation.error
      });
    }

    // Calculate amounts
    const sub = subtotalValidation.sanitizedAmount;
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

// Create invoice from approved estimate
router.post('/invoices/create-from-estimate', authenticate, canEditPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { estimateId, customerDetails, discountPercent, gstPercent, dueDate, notes } = req.body;

    if (!estimateId) {
      return res.status(400).json({ success: false, message: 'Estimate ID is required' });
    }

    // Fetch estimate details
    let estimate = null;
    
    // Try fp_estimates first
    const [fpEstimates] = await pool.execute(`
      SELECT fe.*, 
             fe.client_name as customerName, fe.client_email as customerEmail, fe.client_phone as customerPhone,
             fe.property_name as propertyName, fe.property_code as propertyCode,
             fe.total_amount as total, fe.subtotal
      FROM fp_estimates fe
      WHERE fe.estimate_id = ? AND LOWER(fe.status) = 'approved'
    `, [estimateId]);

    if (fpEstimates.length > 0) {
      estimate = fpEstimates[0];
    } else {
      // Try regular estimates
      const [regularEstimates] = await pool.execute(`
        SELECT e.*, 
               e.customer_name as customerName, e.customer_email as customerEmail, e.customer_phone as customerPhone,
               p.name as propertyName, p.property_id as propertyCode,
               e.total, e.subtotal
        FROM estimates e
        LEFT JOIN properties p ON e.property_id = p.id
        WHERE e.estimate_id = ? AND LOWER(e.status) = 'approved'
      `, [estimateId]);
      
      if (regularEstimates.length > 0) {
        estimate = regularEstimates[0];
      }
    }

    if (!estimate) {
      return res.status(404).json({ success: false, message: 'Approved estimate not found' });
    }

    // Check if invoice already exists
    const [existingInvoice] = await pool.execute(
      'SELECT id, invoice_id FROM invoices WHERE source_estimate_id = ?',
      [estimateId]
    );
    
    if (existingInvoice.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Invoice ${existingInvoice[0].invoice_id} already exists for this estimate` 
      });
    }

    // Calculate amounts
    const subtotal = parseFloat(estimate.total) || parseFloat(estimate.subtotal) || 0;
    const discPct = parseFloat(discountPercent) || 0;
    const taxPct = parseFloat(gstPercent) || 18;
    const discountAmount = subtotal * (discPct / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (taxPct / 100);
    const totalAmount = taxableAmount + taxAmount;

    // Parse line items from estimate - capture full service details
    let lineItems = [];
    try {
      if (estimate.package_services) {
        const rawServices = typeof estimate.package_services === 'string' ? JSON.parse(estimate.package_services) : estimate.package_services;
        
        // Handle different formats: array, object with serviceRows, or object with services
        let services = [];
        if (Array.isArray(rawServices)) {
          services = rawServices;
        } else if (rawServices?.serviceRows) {
          services = rawServices.serviceRows;
        } else if (rawServices?.services) {
          services = rawServices.services;
        }
        
        console.log('[Invoice Creation] Parsed services count:', services.length);
        
        if (Array.isArray(services)) {
          lineItems = services.map((s, idx) => {
            // Build full description: name + description if both exist
            const serviceName = s.name || s.serviceName || s.service_name || 'Service';
            const serviceDesc = s.description || s.service_description || s.details || '';
            const fullDescription = serviceDesc ? `${serviceName} - ${serviceDesc}` : serviceName;
            
            console.log(`[Invoice Creation] Service ${idx + 1}: name="${serviceName}", desc="${serviceDesc.substring(0, 50)}..."`);
            
            return {
              description: fullDescription,
              name: serviceName,
              details: serviceDesc,
              service_description: serviceDesc,
              quantity: s.quantity || s.visits || s.frequencyCount || s.frequency_count || 1,
              frequency: s.frequency || s.frequencyType || s.frequency_type || 'Other',
              visits: s.visits || s.frequencyCount || s.frequency_count || 1,
              unitPrice: parseFloat(s.price || s.unitPrice || s.unit_price || 0),
              totalPrice: parseFloat(s.totalPrice || s.total_price || s.price || 0),
              type: 'service'
            };
          });
        }
      }
      
      // Also include addons if present
      if (estimate.addons_data) {
        const rawAddons = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
        
        // Handle different formats
        let addons = [];
        if (Array.isArray(rawAddons)) {
          addons = rawAddons;
        } else if (rawAddons?.serviceRows) {
          addons = rawAddons.serviceRows;
        } else if (rawAddons?.addons) {
          addons = rawAddons.addons;
        }
        
        console.log('[Invoice Creation] Parsed addons count:', addons.length);
        
        if (Array.isArray(addons)) {
          addons.forEach((addon, idx) => {
            const addonName = addon.name || addon.serviceName || addon.service_name || 'Add-on';
            const addonDesc = addon.description || addon.service_description || addon.details || '';
            const fullDescription = addonDesc ? `${addonName} - ${addonDesc}` : addonName;
            
            console.log(`[Invoice Creation] Addon ${idx + 1}: name="${addonName}", desc="${addonDesc.substring(0, 50)}..."`);
            
            lineItems.push({
              description: fullDescription,
              name: addonName,
              details: addonDesc,
              service_description: addonDesc,
              quantity: addon.quantity || addon.visits || 1,
              frequency: addon.frequency || addon.frequencyType || 'Other',
              visits: addon.visits || addon.frequencyCount || 1,
              unitPrice: parseFloat(addon.price || addon.unitPrice || 0),
              totalPrice: parseFloat(addon.totalPrice || addon.price || 0),
              type: 'addon'
            });
          });
        }
      }
      
      console.log('[Invoice Creation] Total line items:', lineItems.length);
    } catch (e) { 
      console.error('Error parsing estimate services:', e);
    }

    // Generate invoice ID
    const invoiceId = await generateInvoiceId(fpId);
    const invoiceDate = new Date();
    const dueDateValue = dueDate || new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Use customer details from request or estimate
    const finalCustomerName = customerDetails?.name || estimate.customerName;
    const finalCustomerEmail = customerDetails?.email || estimate.customerEmail;
    const finalCustomerPhone = customerDetails?.phone || estimate.customerPhone;

    const [result] = await pool.execute(`
      INSERT INTO invoices (
        invoice_id, invoice_type, property_id, property_code, estimate_id, source_estimate_id,
        customer_id, franchise_partner_id, customer_name, customer_email, customer_phone,
        invoice_date, due_date, line_items, 
        subtotal, discount_percentage, discount_amount, 
        tax_percentage, tax_amount, total_amount, 
        amount_paid, balance_amount, status, payment_status,
        created_by, created_by_role, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId,
      'estimate',
      estimate.property_id || null,
      estimate.propertyCode || estimate.property_code || null,
      estimate.id,
      estimateId,
      estimate.customer_id || null,
      fpId || estimate.franchise_partner_id,
      finalCustomerName,
      finalCustomerEmail,
      finalCustomerPhone,
      invoiceDate.toISOString().split('T')[0],
      dueDateValue,
      JSON.stringify(lineItems),
      subtotal,
      discPct,
      discountAmount,
      taxPct,
      taxAmount,
      totalAmount,
      0,
      totalAmount,
      'draft',
      'pending',
      req.user.id,
      req.user.role,
      notes || `Created from Estimate ${estimateId}`
    ]);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully from estimate',
      data: { 
        id: result.insertId, 
        invoiceId,
        totalAmount,
        customerEmail: finalCustomerEmail
      }
    });
  } catch (error) {
    console.error('Error creating invoice from estimate:', error);
    res.status(500).json({ success: false, message: 'Error creating invoice', error: error.message });
  }
});

// Create generic invoice (for walk-in customers or ad-hoc services)
router.post('/invoices/create-generic', authenticate, canEditPayments, async (req, res) => {
  try {
    const fpId = getFPScope(req);
    const { customerDetails, lineItems, discountPercent, gstPercent, invoiceDate, dueDate, notes, sendEmail } = req.body;

    // Validate required fields
    if (!customerDetails?.name || !customerDetails?.email) {
      return res.status(400).json({ success: false, message: 'Customer name and email are required' });
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required' });
    }

    // Filter valid line items
    const validItems = lineItems.filter(item => item.description && item.totalPrice > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one valid line item is required' });
    }

    // Calculate amounts
    const subtotal = validItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
    const discPct = parseFloat(discountPercent) || 0;
    const taxPct = parseFloat(gstPercent) || 18;
    const discountAmount = subtotal * (discPct / 100);
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (taxPct / 100);
    const totalAmount = taxableAmount + taxAmount;

    // Generate invoice ID
    const invoiceIdGen = await generateInvoiceId(fpId);
    
    // Use provided invoiceDate or current date in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const invoiceDateValue = invoiceDate || istNow.toISOString().split('T')[0];
    
    // Calculate due date (14 days from invoice date)
    const invoiceDateObj = new Date(invoiceDateValue);
    const dueDateValue = dueDate || new Date(invoiceDateObj.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Format line items for storage
    const formattedLineItems = validItems.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      totalPrice: parseFloat(item.totalPrice) || 0,
      type: 'service'
    }));

    const [result] = await pool.execute(`
      INSERT INTO invoices (
        invoice_id, invoice_type, franchise_partner_id,
        customer_name, customer_email, customer_phone, customer_address,
        invoice_date, due_date, line_items, 
        subtotal, discount_percentage, discount_amount, 
        tax_percentage, tax_amount, total_amount, 
        amount_paid, balance_amount, status, payment_status,
        created_by, created_by_role, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceIdGen,
      'generic',
      fpId,
      customerDetails.name,
      customerDetails.email,
      customerDetails.phone || null,
      customerDetails.address || null,
      invoiceDateValue,
      dueDateValue,
      JSON.stringify(formattedLineItems),
      subtotal,
      discPct,
      discountAmount,
      taxPct,
      taxAmount,
      totalAmount,
      0,
      totalAmount,
      'sent', // Generic invoices are marked as sent since we email them
      'pending',
      req.user.id,
      req.user.role,
      notes || 'Generic invoice'
    ]);

    const insertedId = result.insertId;

    // Create payment link for the invoice
    let paymentLinkUrl = null;
    try {
      const { createPaymentLinkForInvoice } = require('../services/invoiceService');
      paymentLinkUrl = await createPaymentLinkForInvoice(insertedId, {
        invoice_id: invoiceIdGen,
        customer_name: customerDetails.name,
        customer_email: customerDetails.email,
        customer_phone: customerDetails.phone,
        total_amount: totalAmount,
        balance_amount: totalAmount
      });
    } catch (plErr) {
      console.error('Failed to create payment link:', plErr.message);
    }

    // Send email automatically if requested
    if (sendEmail && customerDetails.email) {
      try {
        const { sendEmail: sendEmailService } = require('../services/emailService');
        
        // Format amounts for email
        const formatAmount = (amt) => `₹${(parseFloat(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        // Generate line items HTML - Table: # | Service | Description | Frequency | Visits (Gold Theme)
        const lineItemsHtml = formattedLineItems.map((item, idx) => {
          const name = item.name || item.description || 'Service';
          const details = item.details || '';
          const freq = item.frequency || item.frequencyType || '-';
          const freqDisplay = freq && freq !== '-' ? freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase() : '-';
          const visits = item.visits || item.quantity || 1;
          return `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fffbeb'};">
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">
              <span style="display: inline-block; width: 22px; height: 22px; background: #d97706; color: #ffffff; border-radius: 50%; font-size: 11px; font-weight: 600; line-height: 22px; text-align: center;">${idx + 1}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #78350f;">${name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 12px;">${details || '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #d97706; font-weight: 500;">${freqDisplay}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #78350f;">${visits}</td>
          </tr>
        `;
        }).join('');

        await sendEmailService({
          to: customerDetails.email,
          subject: `Invoice ${invoiceIdGen} from XLand Infra`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #C9A227; height: 6px; border-radius: 10px 10px 0 0; }
                .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
                .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
                .grand-total { font-size: 18px; font-weight: bold; color: #C9A227; border-top: 2px solid #C9A227; padding-top: 12px; margin-top: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header"></div>
                
                <div class="content">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 24px; color: #1a1a1a; font-weight: bold;">Invoice</h1>
                    <p style="margin: 5px 0 0; color: #666; font-size: 14px;">${invoiceIdGen}</p>
                  </div>
                  <p>Dear <strong>${customerDetails.name}</strong>,</p>
                  <p>Please find below the details of your invoice from XLand Infra.</p>
                  
                  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <table style="width: 100%; margin-bottom: 15px;">
                      <tr>
                        <td><strong>Invoice Date:</strong></td>
                        <td style="text-align: right;">${formatDate(invoiceDate)}</td>
                      </tr>
                      <tr>
                        <td><strong>Due Date:</strong></td>
                        <td style="text-align: right;">${formatDate(dueDateValue)}</td>
                      </tr>
                    </table>

                    <table style="width: 100%; border-collapse: collapse;">
                      <thead>
                        <tr style="background: #fef3c7;">
                          <th style="padding: 10px; text-align: center; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 40px;">#</th>
                          <th style="padding: 10px; text-align: left; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 100px;">Service</th>
                          <th style="padding: 10px; text-align: center; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase;">Description</th>
                          <th style="padding: 10px; text-align: center; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 80px;">Frequency</th>
                          <th style="padding: 10px; text-align: right; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 50px;">Visits</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${lineItemsHtml}
                      </tbody>
                    </table>

                    <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 10px 0; text-align: left; color: #374151;">Subtotal</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #374151;">${formatAmount(subtotal)}</td>
                      </tr>
                      ${discountAmount > 0 ? `
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 10px 0; text-align: left; color: #374151;">Discount (${discPct}%)</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #dc2626;">-${formatAmount(discountAmount)}</td>
                      </tr>
                      ` : ''}
                      <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 10px 0; text-align: left; color: #374151;">GST (${taxPct}%)</td>
                        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #374151;">${formatAmount(taxAmount)}</td>
                      </tr>
                      <tr style="border-top: 2px solid #10b981;">
                        <td style="padding: 14px 0; text-align: left; font-size: 18px; font-weight: bold; color: #10b981;">Grand Total</td>
                        <td style="padding: 14px 0; text-align: right; font-size: 18px; font-weight: bold; color: #10b981;">${formatAmount(totalAmount)}</td>
                      </tr>
                    </table>
                  </div>

                  ${notes ? `
                  <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <strong>Notes:</strong><br/>
                    ${notes}
                  </div>
                  ` : ''}

                  ${paymentLinkUrl ? `
                  <div style="text-align: center; margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 12px; border: 1px solid #86efac;">
                    <p style="margin: 0 0 15px; color: #166534; font-size: 16px; font-weight: 600;">Ready to pay? Click below to complete your payment securely.</p>
                    <a href="${paymentLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);">
                      Pay Now - ${formatAmount(totalAmount)}
                    </a>
                    <p style="margin: 15px 0 0; color: #6b7280; font-size: 12px;">Secure payment powered by Razorpay</p>
                  </div>
                  ` : `
                  <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                    A payment link will be sent to you shortly. If you have any questions, please contact us.
                  </p>
                  `}
                </div>
                
                <div class="footer">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">Thank you for your business!</p>
                  <p style="margin: 5px 0 0; color: #9ca3af; font-size: 12px;">XLand Infra - Property Management Services</p>
                </div>
              </div>
            </body>
            </html>
          `
        });

        // Update invoice to mark email as sent
        await pool.execute(
          'UPDATE invoices SET email_sent_at = NOW(), sent_at = NOW() WHERE id = ?',
          [insertedId]
        );

        console.log(`📧 Generic invoice ${invoiceIdGen} sent to ${customerDetails.email}`);
      } catch (emailError) {
        console.error('Failed to send invoice email:', emailError);
        // Don't fail the request, just log the error
      }
    }

    res.status(201).json({
      success: true,
      message: sendEmail ? `Invoice created and sent to ${customerDetails.email}` : 'Invoice created successfully',
      data: { 
        id: insertedId, 
        invoiceId: invoiceIdGen,
        totalAmount,
        customerEmail: customerDetails.email,
        emailSent: sendEmail,
        paymentLink: paymentLinkUrl
      }
    });
  } catch (error) {
    console.error('Error creating generic invoice:', error);
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

// Update invoice status manually (for admin tracking when customer doesn't respond via email)
router.put('/invoices/:id/status', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const fpId = getFPScope(req);
    
    // Validate status (exclude 'draft' - invoices start as sent when created)
    const validStatuses = ['sent', 'paid', 'partially_paid', 'overdue', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    // Build query with FP scope if applicable
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
    
    // Update status
    let updateQuery = 'UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ?';
    const updateParams = [status, id];
    
    if (fpId) {
      updateQuery = 'UPDATE invoices SET status = ?, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?';
      updateParams.push(fpId);
    }
    
    await pool.execute(updateQuery, updateParams);
    
    res.json({ 
      success: true, 
      message: 'Invoice status updated successfully',
      newStatus: status
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ success: false, message: 'Error updating invoice status', error: error.message });
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

// Send invoice (mark as sent, send email to customer)
router.post('/invoices/:id/send', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    // Get invoice with all details including work order data from fp_estimates
    let query = `
      SELECT i.*, 
             COALESCE(p.community_name, p2.community_name, p3.community_name, fe.property_name) as property_name, 
             COALESCE(p.property_id, p2.property_id, i.property_code, fe.property_code) as property_code,
             COALESCE(p.property_type, p2.property_type, p3.property_type, fe.property_type) as property_type,
             COALESCE(p.zone, p2.zone, p3.zone, fe.zone) as zone, 
             COALESCE(p.city, p2.city, p3.city, fe.city) as city,
             COALESCE(p.division, p2.division, p3.division) as division,
             fe.work_order_id as est_work_order_id,
             fe.work_order_category,
             fe.work_order_subcategory,
             fe.work_order_description
      FROM invoices i
      LEFT JOIN onboarded_properties p ON i.property_id = p.id
      LEFT JOIN onboarded_properties p2 ON i.property_code = p2.property_id
      LEFT JOIN fp_estimates fe ON i.source_estimate_id = fe.estimate_id
      LEFT JOIN onboarded_properties p3 ON fe.property_id = p3.id
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

    const invoice = invoices[0];
    
    if (!invoice.customer_email) {
      return res.status(400).json({ success: false, message: 'Customer email not found. Please update the invoice with customer email.' });
    }
    
    // Create actual Razorpay payment link (or use existing one if valid)
    let paymentLink = invoice.razorpay_short_url;
    if (!paymentLink || invoice.payment_link_status === 'expired' || invoice.payment_link_status === 'cancelled') {
      try {
        const { createPaymentLinkForInvoice } = require('../services/invoiceService');
        paymentLink = await createPaymentLinkForInvoice(id, invoice);
      } catch (plErr) {
        console.error('Failed to create Razorpay payment link:', plErr.message);
        // Fallback to frontend URL if Razorpay fails
        paymentLink = `${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/pay/${invoice.invoice_id}`;
      }
    }

    // Update invoice status to 'sent' and track email sending
    await pool.execute(`
      UPDATE invoices SET 
        status = 'sent',
        sent_at = NOW(),
        sent_by = ?,
        email_sent_at = NOW()
      WHERE id = ?
    `, [req.user.id, id]);

    // Generate PDF attachment
    const { generateInvoicePDF } = require('../services/pdfService');
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF({
        invoiceId: invoice.invoice_id,
        estimateId: invoice.source_estimate_id,
        invoiceType: invoice.invoice_type,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email,
        customerPhone: invoice.customer_phone,
        propertyName: invoice.property_name,
        propertyCode: invoice.property_code,
        propertyType: invoice.property_type,
        zone: invoice.zone,
        city: invoice.city,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        billingDuration: invoice.billing_duration,
        lineItems: invoice.line_items,
        subtotal: invoice.subtotal,
        discountAmount: invoice.discount_amount,
        taxAmount: invoice.tax_amount,
        taxPercentage: invoice.tax_percent,
        totalAmount: invoice.total_amount,
        balanceAmount: invoice.balance_amount,
        workOrderId: invoice.work_order_id || invoice.est_work_order_id,
        workOrderCategory: invoice.work_order_category,
        workOrderSubcategory: invoice.work_order_subcategory,
        workOrderDescription: invoice.work_order_description
      });
      console.log(`📄 PDF generated for invoice ${invoice.invoice_id}`);
    } catch (pdfError) {
      console.error('Failed to generate invoice PDF:', pdfError.message);
    }

    // Parse line items for email - Table: # | Service | Description | Frequency | Visits (no Amount)
    let lineItemsHtml = '';
    let lineItems = [];
    try {
      lineItems = invoice.line_items ? (typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items) : [];
      if (lineItems.length > 0) {
        lineItemsHtml = lineItems.map((item, idx) => {
          const name = item.name || 'Service';
          const details = item.details || '';
          const freq = item.frequency || item.frequencyType || item.frequency_type || '-';
          const freqDisplay = freq && freq !== '-' ? freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase() : '-';
          const visits = item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1;
          return `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fffbeb'};">
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: middle;">
              <span style="display: inline-block; width: 22px; height: 22px; background: #d97706; color: #ffffff; border-radius: 50%; font-size: 11px; font-weight: 600; line-height: 22px; text-align: center;">${idx + 1}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #78350f;">${name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 12px;">${details || '-'}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #d97706; font-weight: 500;">${freqDisplay}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: #78350f;">${visits}</td>
          </tr>
        `;
        }).join('');
      }
    } catch (e) {
      console.log('Error parsing line items:', e);
    }

    // Format amounts
    const formatAmount = (amt) => `₹${(parseFloat(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    // Send email to customer with PDF attachment
    const { sendEmail } = require('../services/emailService');
    await sendEmail({
      to: invoice.customer_email,
      subject: `Invoice ${invoice.invoice_id} from XLAND INFRA - Payment Due`,
      attachments: pdfBuffer ? [{
        filename: `Invoice_${invoice.invoice_id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }] : [],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #C9A227; height: 6px; border-radius: 10px 10px 0 0; }
            .content { background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; }
            .invoice-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .amount-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .total-row { font-size: 18px; font-weight: bold; color: #C9A227; border-top: 2px solid #C9A227; padding-top: 12px; margin-top: 12px; }
            .pay-btn { display: inline-block; background: #C9A227; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"></div>
            
            <div class="content">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Hello ${invoice.customer_name || 'Valued Customer'},</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">Please find below the details of your invoice from XLand Infra.</p>
              
              <div class="invoice-box">
                <table style="width: 100%; margin-bottom: 15px;">
                  <tr>
                    <td><strong>Invoice Date:</strong></td>
                    <td style="text-align: right;">${formatDate(invoice.invoice_date)}</td>
                  </tr>
                  <tr>
                    <td><strong>Due Date:</strong></td>
                    <td style="text-align: right;">${formatDate(invoice.due_date)}</td>
                  </tr>
                  <tr>
                    <td><strong>Property:</strong></td>
                    <td style="text-align: right;">${invoice.property_name || invoice.property_code || '-'}</td>
                  </tr>
                </table>

                ${lineItems.length > 0 ? `
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                  <thead>
                    <tr style="background: #fef3c7;">
                      <th style="padding: 10px; text-align: center; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 40px;">#</th>
                      <th style="padding: 10px; text-align: left; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 100px;">Service</th>
                      <th style="padding: 10px; text-align: center; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase;">Description</th>
                      <th style="padding: 10px; text-align: center; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 80px;">Frequency</th>
                      <th style="padding: 10px; text-align: right; color: #92400e; font-size: 11px; font-weight: 600; text-transform: uppercase; width: 50px;">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lineItemsHtml}
                  </tbody>
                </table>
                ` : ''}

                <div style="margin-top: 20px;">
                  <div class="amount-row">
                    <span>Subtotal</span>
                    <span>${formatAmount(invoice.subtotal)}</span>
                  </div>
                  ${invoice.discount_amount > 0 ? `
                  <div class="amount-row">
                    <span>Discount</span>
                    <span style="color: #dc2626;">-${formatAmount(invoice.discount_amount)}</span>
                  </div>
                  ` : ''}
                  <div class="amount-row">
                    <span>GST (${invoice.tax_percent || 18}%)</span>
                    <span>${formatAmount(invoice.tax_amount)}</span>
                  </div>
                  <div class="amount-row total-row">
                    <span>Grand Total</span>
                    <span>${formatAmount(invoice.total_amount)}</span>
                  </div>
                  ${invoice.amount_paid > 0 ? `
                  <div class="amount-row">
                    <span>Amount Paid</span>
                    <span style="color: #16a34a;">${formatAmount(invoice.amount_paid)}</span>
                  </div>
                  <div class="amount-row" style="font-weight: bold;">
                    <span>Balance Due</span>
                    <span style="color: #dc2626;">${formatAmount(invoice.balance_amount)}</span>
                  </div>
                  ` : ''}
                </div>
              </div>

              <div style="text-align: center; margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 12px; border: 1px solid #86efac;">
                <p style="margin: 0 0 15px; color: #166534; font-size: 16px; font-weight: 600;">Ready to pay? Click below to complete your payment securely.</p>
                <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #16a34a, #22c55e); color: white; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4);">
                  PAY NOW
                </a>
                <p style="margin: 15px 0 0; color: #6b7280; font-size: 12px;">Secure payment powered by Razorpay</p>
                <p style="margin: 5px 0 0; color: #9ca3af; font-size: 11px;">UPI • Cards • Net Banking • Wallets</p>
              </div>

              ${invoice.notes ? `
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <strong>Notes:</strong><br/>
                ${invoice.notes}
              </div>
              ` : ''}
            </div>
            
            <div class="footer">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Thank you for your business!</p>
              <p style="margin: 5px 0 0; color: #9ca3af; font-size: 12px;">XLand Infra - Property Management Services</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`📧 Invoice ${invoice.invoice_id} sent to ${invoice.customer_email}`);

    res.json({
      success: true,
      message: `Invoice sent successfully to ${invoice.customer_email}`,
      data: { paymentLink, emailSentTo: invoice.customer_email }
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
    // For admins, allow fpId from query params; for FP users, use their scope
    const { invoiceId, status, paymentMethod, startDate, endDate, search, fpId: queryFpId } = req.query;
    const fpId = getFPScope(req) || (req.user.role === 'admin' || req.user.role === 'super_admin' ? queryFpId : null);

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
      query += ' AND (p.payment_id LIKE ? OR p.customer_name LIKE ? OR p.transaction_reference LIKE ? OR prop.property_id LIKE ? OR i.invoice_id LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
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

    // Determine payment status - use verification_pending for offline payments, or whatever was sent
    const finalPaymentStatus = paymentStatus || 'completed';
    const isVerificationPending = finalPaymentStatus === 'verification_pending';

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
      finalPaymentStatus, // Use the requested status (verification_pending for offline payments)
      req.user.id,
      receivedByName,
      req.user.role,
      remarks || null
    ]);

    // Only update invoice amounts if payment is NOT verification_pending
    // For verification_pending payments, invoice will be updated when payment is verified
    if (!isVerificationPending) {
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
    } // End of !isVerificationPending block

    // Record in payment history
    const historyDescription = isVerificationPending 
      ? `Payment recorded via ${paymentMethod} - Awaiting verification${transactionReference ? ` (Ref: ${transactionReference})` : ''}`
      : `Manual payment recorded via ${paymentMethod}${transactionReference ? ` (Ref: ${transactionReference})` : ''}`;
    
    await connection.execute(`
      INSERT INTO payment_history (
        payment_id, invoice_id, action, new_status, amount,
        description, performed_by, performed_by_name, performed_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      result.insertId,
      invoiceId,
      'created',
      finalPaymentStatus,
      paymentAmount,
      historyDescription,
      req.user.id,
      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      req.user.role
    ]);

    await connection.commit();

    // Calculate response values
    const responseBalance = isVerificationPending 
      ? parseFloat(invoice.balance_amount) // No change for pending
      : Math.max(0, parseFloat(invoice.total_amount) - (parseFloat(invoice.amount_paid) + paymentAmount));
    
    const responseStatus = isVerificationPending ? 'verification_pending' : 
      (responseBalance <= 0 ? 'paid' : (parseFloat(invoice.amount_paid) + paymentAmount > 0 ? 'partially_paid' : 'pending'));

    res.status(201).json({
      success: true,
      message: isVerificationPending 
        ? 'Payment recorded successfully. It will be verified shortly.' 
        : 'Payment recorded successfully',
      data: {
        id: result.insertId,
        paymentId,
        newBalance: responseBalance,
        paymentStatus: responseStatus
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
router.post('/record', authenticate, canEditPayments, paymentCreationLimiter, upload.single('paymentProof'), async (req, res) => {
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

    // Validate payment amount for security
    const amountValidation = validatePaymentAmount(amount);
    if (!amountValidation.valid) {
      await connection.rollback();
      // Log suspicious amount attempt
      try {
        await pool.execute(`
          INSERT INTO payment_security_logs (event_type, severity, ip_hash, user_id, user_role, request_path, details)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['INVALID_PAYMENT_AMOUNT', 'WARNING', hashIP(getClientIP(req)), req.user?.id, req.user?.role, '/api/payments/record', JSON.stringify({ attemptedAmount: amount, error: amountValidation.error })]);
      } catch (logErr) {
        console.error('Failed to log security event:', logErr.message);
      }
      return res.status(400).json({
        success: false,
        message: amountValidation.error
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
// Verify payment (update status and send receipt if paid)
router.put('/payments/:id/verify', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);
    const { 
      status, 
      verificationNotes, 
      rejectionReason,
      // Additional fields for cash/cheque/bank transfer payment verification
      amountReceived,
      receivedDate,
      receivedById,
      receivedBy,
      paymentLocation,
      receiptNumber,
      // Cheque-specific fields
      paymentMethod,
      checkNumber,
      checkDate,
      bankName,
      branchName,
      payeeName,
      // Bank transfer-specific fields
      utrNumber,
      senderBankName,
      senderAccountNumber,
      referenceNumber,
      paymentProof
    } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Admin';
    
    // Validate status
    if (!['paid', 'failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be "paid" or "failed".' });
    }

    // Get payment details
    let selectQuery = `
      SELECT p.*, 
             i.invoice_id as invoice_code, i.total_amount as invoice_amount,
             prop.community_name as property_name, prop.property_id as property_code,
             prop.customer_email, prop.customer_phone
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON p.property_id = prop.id
      WHERE p.id = ?
    `;
    const selectParams = [id];
    if (fpId) {
      selectQuery += ' AND p.franchise_partner_id = ?';
      selectParams.push(fpId);
    }

    const [payments] = await pool.execute(selectQuery, selectParams);

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const p = payments[0];

    // Update payment status with additional cash/cheque/bank transfer fields
    const remarks = status === 'paid' ? verificationNotes : rejectionReason;
    const verifierName = receivedBy || userName;
    const verifierId = receivedById || userId;
    const finalAmount = amountReceived ? parseFloat(amountReceived) : p.amount;
    const paymentDateValue = receivedDate || checkDate || p.payment_date;
    
    // Build the transaction reference based on payment type
    // Priority: UTR number (bank transfer) > Check number (cheque) > Receipt number (cash)
    const transactionRef = utrNumber || checkNumber || receiptNumber || referenceNumber;
    
    // Build remarks with payment details
    let fullRemarks = remarks || '';
    
    // Cheque details
    if (checkNumber || (bankName && !utrNumber)) {
      const chequeDetails = [];
      if (checkNumber) chequeDetails.push(`Cheque No: ${checkNumber}`);
      if (bankName) chequeDetails.push(`Bank: ${bankName}`);
      if (branchName) chequeDetails.push(`Branch: ${branchName}`);
      if (payeeName) chequeDetails.push(`Payee: ${payeeName}`);
      if (chequeDetails.length > 0) {
        fullRemarks = fullRemarks ? `${fullRemarks} | ${chequeDetails.join(', ')}` : chequeDetails.join(', ');
      }
    }
    
    // Bank transfer details
    if (utrNumber || senderBankName) {
      const bankDetails = [];
      if (utrNumber) bankDetails.push(`UTR: ${utrNumber}`);
      if (senderBankName) bankDetails.push(`Sender Bank: ${senderBankName}`);
      if (senderAccountNumber) bankDetails.push(`Account: XXXX${senderAccountNumber}`);
      if (referenceNumber) bankDetails.push(`Ref: ${referenceNumber}`);
      if (bankDetails.length > 0) {
        fullRemarks = fullRemarks ? `${fullRemarks} | ${bankDetails.join(', ')}` : bankDetails.join(', ');
      }
    }
    
    await pool.execute(`
      UPDATE payments SET 
        status = ?,
        amount = ?,
        payment_date = ?,
        verified_by = ?,
        verified_by_id = ?,
        verified_at = NOW(),
        transaction_id = COALESCE(?, transaction_id),
        payment_location = ?,
        payment_proof = COALESCE(?, payment_proof),
        remarks = COALESCE(?, remarks),
        updated_at = NOW()
      WHERE id = ?
    `, [status, finalAmount, paymentDateValue, verifierName, verifierId, transactionRef, paymentLocation, paymentProof, fullRemarks, id]);

    // If payment is marked as paid, update invoice and send receipt
    if (status === 'paid') {
      // Update invoice balance and status
      if (p.invoice_id) {
        const invoiceAmount = parseFloat(p.invoice_amount) || 0;
        const paymentAmount = parseFloat(p.amount) || 0;
        
        // Get total paid for this invoice
        const [paidPayments] = await pool.execute(
          'SELECT SUM(amount) as total_paid FROM payments WHERE invoice_id = ? AND status = ?',
          [p.invoice_id, 'paid']
        );
        const totalPaid = parseFloat(paidPayments[0]?.total_paid || 0) + paymentAmount;
        const newBalance = Math.max(0, invoiceAmount - totalPaid);
        const invoiceStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

        await pool.execute(`
          UPDATE invoices SET 
            amount_paid = ?,
            balance_amount = ?,
            payment_status = ?,
            status = ?,
            updated_at = NOW()
          WHERE id = ?
        `, [totalPaid, newBalance, invoiceStatus, invoiceStatus, p.invoice_id]);
      }

      // Send receipt email automatically
      const customerEmail = p.customer_email || p.email;
      if (customerEmail) {
        try {
          const amountPaid = parseFloat(p.amount) || 0;
          const invoiceTotal = parseFloat(p.invoice_amount) || amountPaid;
          const currentBalance = parseFloat(newBalance) || 0;

          const paymentData = {
            paymentId: p.payment_id || `PAY-${String(p.id).padStart(4, '0')}`,
            invoiceId: p.invoice_code,
            customerName: p.customer_name,
            customerEmail,
            propertyName: p.property_name,
            amount: amountPaid,
            invoiceAmount: invoiceTotal,
            balanceAmount: currentBalance,
            paymentMethod: p.payment_method,
            paymentDate: p.payment_date,
            transactionReference: p.transaction_reference,
            referenceNumber: p.reference_number,
            status: 'paid'
          };

          // Generate PDF
          const { generateReceiptPDF } = require('../services/pdfService');
          const pdfBuffer = await generateReceiptPDF(paymentData);

          // Send email - Simple clean design
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          });

          const paymentDateFormatted = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

          const balanceText = currentBalance <= 0 ? '₹0' : `₹${currentBalance.toLocaleString('en-IN')}`;
          const statusText = currentBalance <= 0 ? 'Fully Paid' : 'Partially Paid';
          const methodLabel = paymentData.paymentMethod === 'razorpay' ? 'Card/Net Banking' : paymentData.paymentMethod === 'upi' ? 'UPI' : paymentData.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentData.paymentMethod === 'cash' ? 'Cash' : paymentData.paymentMethod === 'check' ? 'Cheque' : paymentData.paymentMethod || '-';

          await transporter.sendMail({
            from: `"XLAND INFRA" <${process.env.SMTP_USER || 'noreply@xlandinfra.com'}>`,
            to: customerEmail,
            subject: `Payment Receipt - ₹${amountPaid.toLocaleString('en-IN')} | XLAND INFRA`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <!-- Header with checkmark -->
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                  <div style="width: 40px; height: 40px; background-color: #22c55e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px;">
                    <span style="color: white; font-size: 20px;">✓</span>
                  </div>
                  <div style="display: inline-block; vertical-align: middle;">
                    <h1 style="margin: 0; font-size: 22px; color: #1f2937;">You paid ₹${amountPaid.toLocaleString('en-IN')}</h1>
                  </div>
                </div>
                <p style="color: #6b7280; margin: 0 0 25px 55px; font-size: 14px;">to XLAND INFRA on ${paymentDateFormatted}</p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                
                <!-- Payment Details -->
                <h2 style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">Payment details</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Invoice no.</td>
                    <td style="padding: 10px 0; text-align: right; color: #3b82f6; font-size: 14px;">${paymentData.invoiceId || paymentData.paymentId}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Invoice amount</td>
                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">₹${invoiceTotal.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Amount paid</td>
                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: bold;">₹${amountPaid.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Remaining balance</td>
                    <td style="padding: 10px 0; text-align: right; color: ${currentBalance <= 0 ? '#22c55e' : '#ef4444'}; font-size: 14px; font-weight: bold;">${balanceText}</td>
                  </tr>
                </table>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Status</td>
                    <td style="padding: 10px 0; text-align: right; color: ${currentBalance <= 0 ? '#22c55e' : '#f59e0b'}; font-size: 14px; font-weight: bold;">${statusText}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Payment method</td>
                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">${methodLabel}</td>
                  </tr>
                  ${paymentData.transactionReference || paymentData.referenceNumber ? `<tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Reference ID</td>
                    <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">${paymentData.transactionReference || paymentData.referenceNumber}</td>
                  </tr>` : ''}
                </table>
                
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px; line-height: 1.5;">
                  Please don't reply to this email, if you need any help regarding this message, please contact the business directly.
                </p>
                
                <p style="color: #1f2937; font-size: 14px; margin-top: 25px;">Thank you,</p>
                <p style="color: #1f2937; font-size: 14px; font-weight: bold; margin-top: 5px;">XLAND INFRA PM SERVICES PVT LTD</p>
              </div>
            `,
            attachments: [{
              filename: `Receipt_${paymentData.paymentId}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            }]
          });

          // Mark receipt as sent
          await pool.execute(
            'UPDATE payments SET receipt_sent = 1, receipt_sent_at = NOW() WHERE id = ?',
            [id]
          );

          console.log(`Receipt sent to ${customerEmail} for payment ${paymentData.paymentId}`);
        } catch (emailError) {
          console.error('Error sending receipt email:', emailError);
          // Don't fail the verification if email fails
        }
      }
    }

    res.json({ 
      success: true, 
      message: status === 'paid' ? 'Payment verified and receipt sent to customer' : 'Payment rejected'
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
  }
});

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
    const { invoiceId, paymentId, startDate, endDate, type } = req.query;

    let query = `
      SELECT ph.*, p.payment_id as payment_code, i.invoice_id as invoice_code,
             i.customer_name, i.total_amount as invoice_total,
             prop.community_name as property_name
      FROM payment_history ph
      LEFT JOIN payments p ON ph.payment_id = p.id
      LEFT JOIN invoices i ON ph.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON i.property_id = prop.id
      WHERE 1=1
    `;
    const params = [];

    if (fpId) {
      query += ' AND (p.franchise_partner_id = ? OR i.franchise_partner_id = ?)';
      params.push(fpId, fpId);
    }

    // Filter for Razorpay transactions only
    if (type === 'razorpay') {
      query += " AND ph.action = 'razorpay_payment'";
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
      data: history.map(h => {
        // Parse payment method details if available
        let methodDetails = null;
        try {
          if (h.payment_method_details) {
            methodDetails = JSON.parse(h.payment_method_details);
          }
        } catch (e) {}

        return {
          id: h.id,
          paymentId: h.payment_id,
          paymentCode: h.payment_code,
          invoiceId: h.invoice_id,
          invoiceCode: h.invoice_code,
          customerName: h.customer_name,
          propertyName: h.property_name,
          invoiceTotal: h.invoice_total ? parseFloat(h.invoice_total) : null,
          action: h.action,
          oldStatus: h.old_status,
          newStatus: h.new_status,
          amount: h.amount ? parseFloat(h.amount) : null,
          description: h.description,
          performedBy: h.performed_by_name,
          performedByRole: h.performed_by_role,
          createdAt: h.created_at,
          // Razorpay specific fields
          isRazorpay: h.action === 'razorpay_payment',
          razorpayPaymentId: h.razorpay_payment_id || null,
          razorpayReceiptId: h.razorpay_receipt_id || null,
          methodDetails: methodDetails
        };
      })
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment history', error: error.message });
  }
});

// Get Razorpay transaction history with receipt details
// Includes: Card, Net Banking, UPI - all processed via Razorpay
router.get('/razorpay-history', authenticate, canViewPayments, async (req, res) => {
  try {
    // For admins, allow fpId from query params; for FP users, use their scope
    const { startDate, endDate, search, fpId: queryFpId } = req.query;
    const fpId = getFPScope(req) || (req.user.role === 'admin' || req.user.role === 'super_admin' ? queryFpId : null);

    // Razorpay handles: Card, Net Banking, UPI
    // XLAND INFRA handles: Cash, Cheque, Bank Transfer
    let query = `
      SELECT ph.*, 
             p.payment_id as payment_code, p.amount as payment_amount, p.payment_method,
             i.invoice_id as invoice_code, i.customer_name, i.total_amount as invoice_total,
             i.balance_amount as invoice_balance,
             prop.community_name as property_name, prop.property_id as property_code
      FROM payment_history ph
      LEFT JOIN payments p ON ph.payment_id = p.id
      LEFT JOIN invoices i ON ph.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON i.property_id = prop.id
      WHERE (ph.action = 'razorpay_payment' OR (p.payment_method = 'razorpay' AND ph.action = 'created'))
    `;
    const params = [];

    if (fpId) {
      query += ' AND i.franchise_partner_id = ?';
      params.push(fpId);
    }

    if (startDate) {
      query += ' AND DATE(ph.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND DATE(ph.created_at) <= ?';
      params.push(endDate);
    }

    if (search) {
      query += ` AND (
        i.invoice_id LIKE ? OR 
        i.customer_name LIKE ? OR 
        p.payment_id LIKE ? OR
        ph.razorpay_payment_id LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY ph.created_at DESC LIMIT 100';

    const [history] = await pool.execute(query, params);

    res.json({
      success: true,
      data: history.map(h => {
        let methodDetails = null;
        try {
          if (h.payment_method_details) {
            methodDetails = JSON.parse(h.payment_method_details);
          }
        } catch (e) {}

        // Determine payment method display
        // Razorpay processes: Card, Net Banking, UPI
        let paymentMethodDisplay = 'Razorpay';
        if (methodDetails) {
          if (methodDetails.method === 'card' && methodDetails.card_last4) {
            paymentMethodDisplay = `${methodDetails.card_network || 'Card'}****${methodDetails.card_last4}`;
          } else if (methodDetails.method === 'netbanking' && methodDetails.bank) {
            paymentMethodDisplay = `Net Banking - ${methodDetails.bank}`;
          } else if (methodDetails.method === 'upi') {
            paymentMethodDisplay = 'UPI (Razorpay)';
          } else if (methodDetails.method === 'wallet') {
            paymentMethodDisplay = `Wallet - ${methodDetails.wallet || 'Razorpay'}`;
          }
        } else if (h.payment_method === 'razorpay') {
          paymentMethodDisplay = 'Card/Net Banking/UPI';
        }

        return {
          id: h.id,
          // Receipt Info
          receiptId: h.razorpay_receipt_id || `RZP-${h.id}`,
          razorpayPaymentId: h.razorpay_payment_id,
          transactionDate: h.created_at,
          // Invoice Info
          invoiceId: h.invoice_code,
          invoiceTotal: h.invoice_total ? parseFloat(h.invoice_total) : null,
          // Payment Info
          paymentId: h.payment_code,
          amountPaid: h.amount ? parseFloat(h.amount) : (h.payment_amount ? parseFloat(h.payment_amount) : null),
          balanceRemaining: methodDetails?.balance_remaining || (h.invoice_balance ? parseFloat(h.invoice_balance) : 0),
          // Customer Info
          customerName: h.customer_name,
          customerEmail: methodDetails?.email || null,
          customerPhone: methodDetails?.contact || null,
          propertyName: h.property_name,
          propertyCode: h.property_code,
          // Payment Method
          paymentMethod: paymentMethodDisplay,
          methodDetails: methodDetails,
          // Status
          status: h.new_status === 'completed' ? 'Successful' : h.new_status,
          description: h.description,
          // Razorpay sends receipt automatically
          receiptSentByRazorpay: true
        };
      })
    });
  } catch (error) {
    console.error('Error fetching Razorpay history:', error);
    res.status(500).json({ success: false, message: 'Error fetching Razorpay history', error: error.message });
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

// ============================================
// PAYMENT RECEIPTS
// ============================================

// Get payment details for receipt
router.get('/payments/:id/receipt', authenticate, canViewPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = `
      SELECT p.*, 
             i.invoice_id as invoice_code, i.total_amount as invoice_amount,
             prop.community_name as property_name, prop.property_id as property_code,
             prop.customer_email, prop.customer_phone
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON p.property_id = prop.id
      WHERE p.id = ?
    `;
    const params = [id];

    if (fpId) {
      query += ' AND p.franchise_partner_id = ?';
      params.push(fpId);
    }

    const [payments] = await pool.execute(query, params);

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const p = payments[0];
    res.json({
      success: true,
      data: {
        id: p.id,
        paymentId: p.payment_id || `PAY-${String(p.id).padStart(4, '0')}`,
        invoiceId: p.invoice_code,
        customerName: p.customer_name,
        customerEmail: p.customer_email || p.email,
        customerPhone: p.customer_phone || p.phone,
        propertyName: p.property_name,
        propertyCode: p.property_code,
        amount: parseFloat(p.amount),
        paymentMethod: p.payment_method,
        paymentDate: p.payment_date,
        transactionReference: p.transaction_reference,
        referenceNumber: p.reference_number,
        status: p.status,
        verifiedBy: p.verified_by,
        verifiedAt: p.verified_at,
        remarks: p.remarks
      }
    });
  } catch (error) {
    console.error('Error fetching payment receipt:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment receipt', error: error.message });
  }
});

// Generate and download receipt PDF
router.get('/payments/:id/receipt/pdf', authenticate, canViewPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = `
      SELECT p.*, 
             i.invoice_id as invoice_code, i.total_amount as invoice_amount, i.balance_amount as invoice_balance,
             prop.community_name as property_name, prop.property_id as property_code,
             prop.customer_email, prop.customer_phone
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON p.property_id = prop.id
      WHERE p.id = ?
    `;
    const params = [id];

    if (fpId) {
      query += ' AND p.franchise_partner_id = ?';
      params.push(fpId);
    }

    const [payments] = await pool.execute(query, params);

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const p = payments[0];
    const amountPaid = parseFloat(p.amount) || 0;
    const invoiceTotal = parseFloat(p.invoice_amount) || amountPaid;
    const currentBalance = parseFloat(p.invoice_balance) || 0;
    
    const paymentData = {
      paymentId: p.payment_id || `PAY-${String(p.id).padStart(4, '0')}`,
      invoiceId: p.invoice_code,
      customerName: p.customer_name,
      customerEmail: p.customer_email || p.email,
      customerPhone: p.customer_phone || p.phone,
      propertyName: p.property_name,
      propertyCode: p.property_code,
      amount: amountPaid,
      invoiceAmount: invoiceTotal,
      balanceAmount: currentBalance,
      paymentMethod: p.payment_method,
      paymentDate: p.payment_date,
      transactionReference: p.transaction_reference,
      referenceNumber: p.reference_number,
      status: p.status
    };

    // Generate PDF
    const { generateReceiptPDF } = require('../services/pdfService');
    const pdfBuffer = await generateReceiptPDF(paymentData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Receipt_${paymentData.paymentId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ success: false, message: 'Error generating receipt PDF', error: error.message });
  }
});

// Send receipt email to customer
router.post('/payments/:id/receipt/send', authenticate, canEditPayments, async (req, res) => {
  try {
    const { id } = req.params;
    const fpId = getFPScope(req);

    let query = `
      SELECT p.*, 
             i.invoice_id as invoice_code, i.total_amount as invoice_amount, i.balance_amount as invoice_balance,
             prop.community_name as property_name, prop.property_id as property_code,
             prop.customer_email, prop.customer_phone
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN onboarded_properties prop ON p.property_id = prop.id
      WHERE p.id = ?
    `;
    const params = [id];

    if (fpId) {
      query += ' AND p.franchise_partner_id = ?';
      params.push(fpId);
    }

    const [payments] = await pool.execute(query, params);

    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    const p = payments[0];
    const customerEmail = p.customer_email || p.email;

    if (!customerEmail) {
      return res.status(400).json({ success: false, message: 'Customer email not found' });
    }

    const amountPaid = parseFloat(p.amount) || 0;
    const invoiceTotal = parseFloat(p.invoice_amount) || amountPaid;
    const currentBalance = parseFloat(p.invoice_balance) || 0;

    const paymentData = {
      paymentId: p.payment_id || `PAY-${String(p.id).padStart(4, '0')}`,
      invoiceId: p.invoice_code,
      customerName: p.customer_name,
      customerEmail,
      propertyName: p.property_name,
      amount: amountPaid,
      invoiceAmount: invoiceTotal,
      balanceAmount: currentBalance,
      paymentMethod: p.payment_method,
      paymentDate: p.payment_date,
      transactionReference: p.transaction_reference,
      referenceNumber: p.reference_number,
      status: p.status
    };

    // Generate PDF
    const { generateReceiptPDF } = require('../services/pdfService');
    const pdfBuffer = await generateReceiptPDF(paymentData);

    // Send email with receipt - Simple clean design like reference image
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const paymentDateFormatted = p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const balanceText = currentBalance <= 0 ? '₹0' : `₹${currentBalance.toLocaleString('en-IN')}`;
    const statusText = currentBalance <= 0 ? 'Fully Paid' : 'Partially Paid';

    const mailOptions = {
      from: `"XLAND INFRA" <${process.env.SMTP_USER || 'noreply@xlandinfra.com'}>`,
      to: customerEmail,
      subject: `Payment Receipt - ₹${amountPaid.toLocaleString('en-IN')} | XLAND INFRA`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <!-- Header with checkmark -->
          <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <div style="width: 40px; height: 40px; background-color: #22c55e; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 15px;">
              <span style="color: white; font-size: 20px;">✓</span>
            </div>
            <div style="display: inline-block; vertical-align: middle;">
              <h1 style="margin: 0; font-size: 22px; color: #1f2937;">You paid ₹${amountPaid.toLocaleString('en-IN')}</h1>
            </div>
          </div>
          <p style="color: #6b7280; margin: 0 0 25px 55px; font-size: 14px;">to XLAND INFRA on ${paymentDateFormatted}</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <!-- Payment Details -->
          <h2 style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">Payment details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Invoice no.</td>
              <td style="padding: 10px 0; text-align: right; color: #3b82f6; font-size: 14px;">${paymentData.invoiceId || paymentData.paymentId}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Invoice amount</td>
              <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">₹${invoiceTotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Amount paid</td>
              <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px; font-weight: bold;">₹${amountPaid.toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Remaining balance</td>
              <td style="padding: 10px 0; text-align: right; color: ${currentBalance <= 0 ? '#22c55e' : '#ef4444'}; font-size: 14px; font-weight: bold;">${balanceText}</td>
            </tr>
          </table>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Status</td>
              <td style="padding: 10px 0; text-align: right; color: ${currentBalance <= 0 ? '#22c55e' : '#f59e0b'}; font-size: 14px; font-weight: bold;">${statusText}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Payment method</td>
              <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">${paymentData.paymentMethod === 'razorpay' ? 'Card/Net Banking' : paymentData.paymentMethod === 'upi' ? 'UPI' : paymentData.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : paymentData.paymentMethod === 'cash' ? 'Cash' : paymentData.paymentMethod === 'check' ? 'Cheque' : paymentData.paymentMethod || '-'}</td>
            </tr>
            ${paymentData.transactionReference || paymentData.referenceNumber ? `<tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Reference ID</td>
              <td style="padding: 10px 0; text-align: right; color: #1f2937; font-size: 14px;">${paymentData.transactionReference || paymentData.referenceNumber}</td>
            </tr>` : ''}
          </table>
          
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px; line-height: 1.5;">
            Please don't reply to this email, if you need any help regarding this message, please contact the business directly.
          </p>
          
          <p style="color: #1f2937; font-size: 14px; margin-top: 25px;">Thank you,</p>
          <p style="color: #1f2937; font-size: 14px; font-weight: bold; margin-top: 5px;">XLAND INFRA PM SERVICES PVT LTD</p>
        </div>
      `,
      attachments: [{
        filename: `Receipt_${paymentData.paymentId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    await transporter.sendMail(mailOptions);

    // Update payment to mark receipt sent
    await pool.execute(
      'UPDATE payments SET receipt_sent = 1, receipt_sent_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({ success: true, message: 'Receipt sent successfully to ' + customerEmail });
  } catch (error) {
    console.error('Error sending receipt email:', error);
    res.status(500).json({ success: false, message: 'Error sending receipt email', error: error.message });
  }
});

module.exports = router;
