const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all estimates
router.get('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.json({ success: true, data: [] });
    }
    
    const pool = db.pool;
    const [estimates] = await pool.execute(
      `SELECT * FROM estimates WHERE is_active = TRUE ORDER BY created_at DESC`
    );
    
    // Transform to match frontend format
    const formattedEstimates = estimates.map(est => ({
      estimateId: est.estimate_id,
      customerName: est.customer_name,
      customerEmail: est.customer_email,
      customerPhone: est.customer_phone,
      propertyType: est.property_type,
      propertyName: est.property_name,
      propertyAddress: est.property_address,
      services: est.services ? JSON.parse(est.services) : [],
      addons: est.addons ? JSON.parse(est.addons) : [],
      subtotal: parseFloat(est.subtotal),
      discount: parseFloat(est.discount),
      tax: parseFloat(est.tax),
      total: parseFloat(est.total),
      notes: est.notes,
      status: est.status,
      validUntil: est.valid_until,
      createdAt: est.created_at,
      updatedAt: est.updated_at
    }));
    
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
      notes, status, validUntil
    } = req.body;
    
    const estimateId = `EST-${Date.now()}`;
    
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
        subtotal || 0,
        discount || 0,
        tax || 0,
        total || 0,
        notes || null,
        status || 'draft',
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

module.exports = router;
