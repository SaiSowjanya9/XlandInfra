const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all add-ons
router.get('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.json({ success: true, data: [] });
    }
    
    const pool = db.pool;
    const [addons] = await pool.execute(
      `SELECT * FROM addons WHERE is_active = 1 ORDER BY created_at DESC`
    );
    
    // Transform to match frontend format
    const formattedAddons = addons.map(addon => ({
      addonId: addon.addon_id,
      propertyType: addon.property_type,
      propertyTypeName: addon.property_type_name,
      services: [{
        name: addon.service_name,
        frequency: addon.frequency_count,
        frequencyType: addon.frequency_type,
        price: parseFloat(addon.price)
      }],
      billingCycle: addon.billing_cycle,
      totalPrice: parseFloat(addon.total_price),
      createdAt: addon.created_at,
      updatedAt: addon.updated_at
    }));
    
    res.json({ success: true, data: formattedAddons });
  } catch (error) {
    console.error('Get addons error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE add-on
router.post('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { propertyType, propertyTypeName, services, billingCycle, totalPrice } = req.body;
    
    if (!propertyType || !services || services.length === 0) {
      return res.status(400).json({ success: false, message: 'Property type and services required' });
    }
    
    const service = services[0];
    const addonId = `ADDON-${Date.now()}`;
    
    const pool = db.pool;
    await pool.execute(
      `INSERT INTO addons (addon_id, property_type, property_type_name, service_name, frequency_count, frequency_type, billing_cycle, price, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        addonId,
        propertyType,
        propertyTypeName || propertyType,
        service.name,
        service.frequency ?? 1,
        service.frequencyType || 'Monthly',
        billingCycle || 'Monthly',
        service.price || 0,
        totalPrice || service.price || 0
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'Add-on created',
      data: { addonId }
    });
  } catch (error) {
    console.error('Create addon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE add-on
router.put('/:addonId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { addonId } = req.params;
    const { propertyType, propertyTypeName, services, billingCycle, totalPrice } = req.body;
    
    const service = services?.[0] || {};
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE addons SET 
        property_type = COALESCE(?, property_type),
        property_type_name = COALESCE(?, property_type_name),
        service_name = COALESCE(?, service_name),
        frequency_count = COALESCE(?, frequency_count),
        frequency_type = COALESCE(?, frequency_type),
        billing_cycle = COALESCE(?, billing_cycle),
        price = COALESCE(?, price),
        total_price = COALESCE(?, total_price)
       WHERE addon_id = ?`,
      [
        propertyType,
        propertyTypeName,
        service.name,
        service.frequency,
        service.frequencyType,
        billingCycle,
        service.price,
        totalPrice,
        addonId
      ]
    );
    
    res.json({ success: true, message: 'Add-on updated' });
  } catch (error) {
    console.error('Update addon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE add-on (soft delete)
router.delete('/:addonId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { addonId } = req.params;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE addons SET is_active = 0 WHERE addon_id = ?`,
      [addonId]
    );
    
    res.json({ success: true, message: 'Add-on deleted' });
  } catch (error) {
    console.error('Delete addon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
