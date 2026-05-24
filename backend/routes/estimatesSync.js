const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendEstimateEmail } = require('../services/emailService');

// GET all estimates (supports ?archived=true for archived estimates)
router.get('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.json({ success: true, data: [] });
    }
    
    const { archived } = req.query;
    const isArchived = archived === 'true';
    
    const pool = db.pool;
    const [estimates] = await pool.execute(
      `SELECT * FROM estimates WHERE is_active = TRUE AND is_archived = ? ORDER BY created_at DESC`,
      [isArchived ? 1 : 0]
    );
    
    // Transform to match frontend format
    const formattedEstimates = estimates.map(est => {
      // Handle JSON fields - MySQL may return object or string
      let services = [];
      let addons = [];
      if (est.services) {
        services = typeof est.services === 'string' ? JSON.parse(est.services) : est.services;
      }
      if (est.addons) {
        addons = typeof est.addons === 'string' ? JSON.parse(est.addons) : est.addons;
      }
      return {
        estimateId: est.estimate_id,
        estimateType: est.estimate_type || (est.property_type ? 'property-based' : 'direct'),
        customerName: est.customer_name,
        customerEmail: est.customer_email,
        customerPhone: est.customer_phone,
        propertyType: est.property_type,
        propertyName: est.property_name,
        propertyAddress: est.property_address,
        services: services,
        addons: addons,
        subtotal: parseFloat(est.subtotal || 0),
        discount: parseFloat(est.discount || 0),
        tax: parseFloat(est.tax || 0),
        total: parseFloat(est.total || 0),
        notes: est.notes,
        status: est.status,
        isArchived: est.is_archived,
        archivedAt: est.archived_at,
        validUntil: est.valid_until,
        createdAt: est.created_at,
        updatedAt: est.updated_at
      };
    });
    
    res.json({ success: true, data: formattedEstimates });
  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE estimate
router.post('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { 
      customerName, customerEmail, customerPhone,
      propertyType, propertyName, propertyAddress,
      services, addons, subtotal, discount, tax, total,
      notes, status, validUntil,
      subTotal, gst, totalPrice
    } = req.body;
    
    const estimateId = `EST-${Date.now()}`;
    
    // Use proper field names (frontend sends different names)
    const finalSubtotal = subtotal || subTotal || 0;
    const finalTax = tax || gst || 0;
    const finalTotal = total || totalPrice || 0;
    
    const pool = db.pool;
    await pool.execute(
      `INSERT INTO estimates (
        estimate_id, customer_name, customer_email, customer_phone,
        property_type, property_name, property_address,
        services, addons, subtotal, discount, tax, total,
        notes, status, valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estimateId,
        customerName || null,
        customerEmail || null,
        customerPhone || null,
        propertyType || null,
        propertyName || null,
        propertyAddress || null,
        services ? JSON.stringify(services) : null,
        addons ? JSON.stringify(addons) : null,
        finalSubtotal,
        discount || 0,
        finalTax,
        finalTotal,
        notes || null,
        status || 'Draft',
        validUntil || null
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'Estimate created',
      data: { estimateId }
    });
  } catch (error) {
    console.error('Create estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE estimate
router.put('/:estimateId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const { 
      customerName, customerEmail, customerPhone,
      propertyType, propertyName, propertyAddress,
      services, addons, subtotal, discount, tax, total,
      notes, status, validUntil
    } = req.body;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE estimates SET 
        customer_name = COALESCE(?, customer_name),
        customer_email = COALESCE(?, customer_email),
        customer_phone = COALESCE(?, customer_phone),
        property_type = COALESCE(?, property_type),
        property_name = COALESCE(?, property_name),
        property_address = COALESCE(?, property_address),
        services = COALESCE(?, services),
        addons = COALESCE(?, addons),
        subtotal = COALESCE(?, subtotal),
        discount = COALESCE(?, discount),
        tax = COALESCE(?, tax),
        total = COALESCE(?, total),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        valid_until = COALESCE(?, valid_until)
       WHERE estimate_id = ?`,
      [
        customerName,
        customerEmail,
        customerPhone,
        propertyType,
        propertyName,
        propertyAddress,
        services ? JSON.stringify(services) : null,
        addons ? JSON.stringify(addons) : null,
        subtotal,
        discount,
        tax,
        total,
        notes,
        status,
        validUntil,
        estimateId
      ]
    );
    
    res.json({ success: true, message: 'Estimate updated' });
  } catch (error) {
    console.error('Update estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ARCHIVE estimate
router.put('/:estimateId/archive', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE estimates SET is_archived = TRUE, archived_at = NOW() WHERE estimate_id = ?`,
      [estimateId]
    );
    
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    console.error('Archive estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// RESTORE estimate
router.put('/:estimateId/restore', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE estimates SET is_archived = FALSE, archived_at = NULL WHERE estimate_id = ?`,
      [estimateId]
    );
    
    res.json({ success: true, message: 'Estimate restored' });
  } catch (error) {
    console.error('Restore estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE estimate (soft delete)
router.delete('/:estimateId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE estimates SET is_active = FALSE WHERE estimate_id = ?`,
      [estimateId]
    );
    
    res.json({ success: true, message: 'Estimate deleted' });
  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// SEND estimate email to customer
router.post('/:estimateId/send', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    
    const pool = db.pool;
    const [estimates] = await pool.execute(
      `SELECT * FROM estimates WHERE estimate_id = ? AND is_active = TRUE`,
      [estimateId]
    );
    
    if (estimates.length === 0) {
      return res.status(404).json({ success: false, message: 'Estimate not found' });
    }
    
    const est = estimates[0];
    
    // Parse JSON fields
    let services = [];
    let addons = [];
    if (est.services) {
      services = typeof est.services === 'string' ? JSON.parse(est.services) : est.services;
    }
    if (est.addons) {
      addons = typeof est.addons === 'string' ? JSON.parse(est.addons) : est.addons;
    }
    
    // Prepare estimate data for email
    const estimateData = {
      estimateId: est.estimate_id,
      customerName: est.customer_name,
      customerEmail: est.customer_email,
      propertyName: est.property_name,
      services: services,
      addons: addons,
      subtotal: parseFloat(est.subtotal || 0),
      discount: parseFloat(est.discount || 0),
      tax: parseFloat(est.tax || 0),
      total: parseFloat(est.total || 0),
      validUntil: est.valid_until
    };
    
    if (!estimateData.customerEmail) {
      return res.status(400).json({ success: false, message: 'No customer email found for this estimate' });
    }
    
    // Send the email
    const emailResult = await sendEstimateEmail(estimateData);
    
    if (emailResult.success) {
      // Update estimate status to 'Sent'
      await pool.execute(
        `UPDATE estimates SET status = 'Sent' WHERE estimate_id = ?`,
        [estimateId]
      );
      
      res.json({ 
        success: true, 
        message: `Estimate sent to ${estimateData.customerEmail}`,
        email: estimateData.customerEmail
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: emailResult.error || 'Failed to send email'
      });
    }
  } catch (error) {
    console.error('Send estimate email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
