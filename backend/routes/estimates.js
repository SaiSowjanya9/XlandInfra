/**
 * Estimates Routes
 * RBAC: Admin - full access, Manager - create/view, Supervisor - view only
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { 
  adminOnly,
  managerOrAdmin,
  canMakeEstimate,
  canSeeEstimate,
  canApprove,
  canSeePricing,
  ROLES
} = require('../middleware/rbac');

// Generate unique estimate ID
const generateEstimateId = () => {
  const prefix = 'EST';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Get all estimates (Admin, Manager full; Supervisor view only)
router.get('/', authenticate, canSeeEstimate, async (req, res) => {
  try {
    const { status, clientId } = req.query;
    const userRole = req.user.role;
    
    let query = `
      SELECT e.*, 
             c.name as client_name, c.client_id as client_code,
             p.name as property_name,
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
             CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
      FROM estimates e
      LEFT JOIN clients c ON e.client_id = c.id
      LEFT JOIN properties p ON e.property_id = p.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN users a ON e.approved_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    }

    if (clientId) {
      query += ` AND e.client_id = ?`;
      params.push(clientId);
    }

    query += ` ORDER BY e.created_at DESC`;

    const [estimates] = await pool.execute(query, params);

    res.json({
      success: true,
      data: estimates.map(e => ({
        id: e.id,
        estimateId: e.estimate_id,
        clientId: e.client_id,
        clientName: e.client_name,
        clientCode: e.client_code,
        propertyId: e.property_id,
        propertyName: e.property_name,
        title: e.title,
        description: e.description,
        subtotal: e.subtotal,
        taxPercentage: e.tax_percentage,
        taxAmount: e.tax_amount,
        discountPercentage: e.discount_percentage,
        discountAmount: e.discount_amount,
        totalAmount: e.total_amount,
        status: e.status,
        validUntil: e.valid_until,
        approvedBy: e.approved_by_name,
        approvedAt: e.approved_at,
        createdBy: e.created_by_name,
        createdAt: e.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching estimates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching estimates',
      error: error.message
    });
  }
});

// Get single estimate (Admin, Manager, Supervisor can view)
router.get('/:id', authenticate, canSeeEstimate, async (req, res) => {
  try {
    const { id } = req.params;

    const [estimates] = await pool.execute(
      `SELECT e.*, 
              c.name as client_name, c.client_id as client_code,
              p.name as property_name,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
              CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
       FROM estimates e
       LEFT JOIN clients c ON e.client_id = c.id
       LEFT JOIN properties p ON e.property_id = p.id
       LEFT JOIN users u ON e.created_by = u.id
       LEFT JOIN users a ON e.approved_by = a.id
       WHERE e.id = ?`,
      [id]
    );

    if (estimates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found'
      });
    }

    // Get estimate line items
    const [items] = await pool.execute(
      `SELECT ei.*, p.name as package_name, c.name as category_name
       FROM estimate_items ei
       LEFT JOIN packages p ON ei.package_id = p.id
       LEFT JOIN categories c ON ei.category_id = c.id
       WHERE ei.estimate_id = ?
       ORDER BY ei.sort_order`,
      [id]
    );

    const e = estimates[0];
    res.json({
      success: true,
      data: {
        id: e.id,
        estimateId: e.estimate_id,
        clientId: e.client_id,
        clientName: e.client_name,
        propertyId: e.property_id,
        propertyName: e.property_name,
        title: e.title,
        description: e.description,
        subtotal: e.subtotal,
        taxPercentage: e.tax_percentage,
        taxAmount: e.tax_amount,
        discountPercentage: e.discount_percentage,
        discountAmount: e.discount_amount,
        totalAmount: e.total_amount,
        status: e.status,
        validUntil: e.valid_until,
        approvedBy: e.approved_by_name,
        approvedAt: e.approved_at,
        rejectionReason: e.rejection_reason,
        createdBy: e.created_by_name,
        createdAt: e.created_at,
        items: items
      }
    });
  } catch (error) {
    console.error('Error fetching estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching estimate',
      error: error.message
    });
  }
});

// Create estimate (Admin, Manager only)
router.post('/', authenticate, canMakeEstimate, async (req, res) => {
  try {
    const { 
      clientId, propertyId, title, description, items,
      taxPercentage, discountPercentage, validUntil
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const estimateId = generateEstimateId();

    // Calculate totals
    let subtotal = 0;
    if (items && items.length > 0) {
      subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }

    const taxPct = taxPercentage || 18;
    const discountPct = discountPercentage || 0;
    const taxAmount = subtotal * (taxPct / 100);
    const discountAmount = subtotal * (discountPct / 100);
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Insert estimate
    const [result] = await pool.execute(
      `INSERT INTO estimates (
        estimate_id, client_id, property_id, title, description,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estimateId, clientId || null, propertyId || null, title, description || null,
        subtotal, taxPct, taxAmount, discountPct, discountAmount, totalAmount,
        validUntil || null, req.user.id
      ]
    );

    const insertedId = result.insertId;

    // Insert estimate items
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await pool.execute(
          `INSERT INTO estimate_items (
            estimate_id, package_id, category_id, description, quantity, unit_price, total_price, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            insertedId, item.packageId || null, item.categoryId || null,
            item.description, item.quantity || 1, item.unitPrice || 0,
            (item.quantity || 1) * (item.unitPrice || 0), i + 1
          ]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Estimate created successfully',
      data: {
        id: insertedId,
        estimateId
      }
    });
  } catch (error) {
    console.error('Error creating estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating estimate',
      error: error.message
    });
  }
});

// Update estimate (Admin, Manager only - if not approved)
router.put('/:id', authenticate, canMakeEstimate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, items, taxPercentage, discountPercentage, validUntil
    } = req.body;

    // Check if estimate exists and is not approved
    const [existing] = await pool.execute(
      `SELECT status FROM estimates WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found'
      });
    }

    if (['approved', 'converted'].includes(existing[0].status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify approved or converted estimates'
      });
    }

    // Calculate totals
    let subtotal = 0;
    if (items && items.length > 0) {
      subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }

    const taxPct = taxPercentage || 18;
    const discountPct = discountPercentage || 0;
    const taxAmount = subtotal * (taxPct / 100);
    const discountAmount = subtotal * (discountPct / 100);
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Update estimate
    await pool.execute(
      `UPDATE estimates SET 
        title = COALESCE(?, title),
        description = ?,
        subtotal = ?,
        tax_percentage = ?,
        tax_amount = ?,
        discount_percentage = ?,
        discount_amount = ?,
        total_amount = ?,
        valid_until = ?
       WHERE id = ?`,
      [title, description, subtotal, taxPct, taxAmount, discountPct, discountAmount, totalAmount, validUntil, id]
    );

    // Update items if provided
    if (items) {
      // Delete existing items
      await pool.execute(`DELETE FROM estimate_items WHERE estimate_id = ?`, [id]);
      
      // Insert new items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await pool.execute(
          `INSERT INTO estimate_items (
            estimate_id, package_id, category_id, description, quantity, unit_price, total_price, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, item.packageId || null, item.categoryId || null,
            item.description, item.quantity || 1, item.unitPrice || 0,
            (item.quantity || 1) * (item.unitPrice || 0), i + 1
          ]
        );
      }
    }

    res.json({
      success: true,
      message: 'Estimate updated successfully'
    });
  } catch (error) {
    console.error('Error updating estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating estimate',
      error: error.message
    });
  }
});

// Submit estimate for approval (Admin, Manager)
router.post('/:id/submit', authenticate, canMakeEstimate, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE estimates SET status = 'pending_approval' WHERE id = ? AND status = 'draft'`,
      [id]
    );

    res.json({
      success: true,
      message: 'Estimate submitted for approval'
    });
  } catch (error) {
    console.error('Error submitting estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting estimate',
      error: error.message
    });
  }
});

// Approve estimate (Admin only)
router.post('/:id/approve', authenticate, canApprove, async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE estimates SET 
        status = 'approved', 
        approved_by = ?, 
        approved_at = NOW() 
       WHERE id = ? AND status = 'pending_approval'`,
      [req.user.id, id]
    );

    res.json({
      success: true,
      message: 'Estimate approved successfully'
    });
  } catch (error) {
    console.error('Error approving estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving estimate',
      error: error.message
    });
  }
});

// Reject estimate (Admin only)
router.post('/:id/reject', authenticate, canApprove, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await pool.execute(
      `UPDATE estimates SET 
        status = 'rejected', 
        rejection_reason = ?
       WHERE id = ? AND status = 'pending_approval'`,
      [reason || null, id]
    );

    res.json({
      success: true,
      message: 'Estimate rejected'
    });
  } catch (error) {
    console.error('Error rejecting estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting estimate',
      error: error.message
    });
  }
});

// Delete estimate (Admin only)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Only delete if draft or rejected
    const [result] = await pool.execute(
      `DELETE FROM estimates WHERE id = ? AND status IN ('draft', 'rejected')`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete approved or converted estimates'
      });
    }

    res.json({
      success: true,
      message: 'Estimate deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting estimate',
      error: error.message
    });
  }
});

module.exports = router;
