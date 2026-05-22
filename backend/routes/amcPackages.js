const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all AMC packages
router.get('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.json({ success: true, data: [] });
    }
    
    const pool = db.pool;
    const [packages] = await pool.execute(
      `SELECT * FROM amc_packages WHERE is_active = TRUE ORDER BY created_at DESC`
    );
    
    // Transform to match frontend format
    const formattedPackages = packages.map(pkg => ({
      packageId: pkg.package_id,
      packageName: pkg.package_name,
      propertyType: pkg.property_type,
      services: pkg.services,
      serviceRows: pkg.service_rows ? JSON.parse(pkg.service_rows) : [],
      rate: parseFloat(pkg.rate),
      billingDuration: pkg.billing_duration,
      status: pkg.status,
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at
    }));
    
    res.json({ success: true, data: formattedPackages });
  } catch (error) {
    console.error('Get AMC packages error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE AMC package
router.post('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { packageName, propertyType, services, serviceRows, rate, billingDuration, status } = req.body;
    
    if (!packageName) {
      return res.status(400).json({ success: false, message: 'Package name required' });
    }
    
    const packageId = `AMC-${Date.now()}`;
    
    const pool = db.pool;
    await pool.execute(
      `INSERT INTO amc_packages (package_id, package_name, property_type, services, service_rows, rate, billing_duration, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        packageId,
        packageName,
        propertyType || null,
        services || null,
        serviceRows ? JSON.stringify(serviceRows) : null,
        rate || 0,
        billingDuration || 'yearly',
        status || 'active'
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'AMC Package created',
      data: { packageId }
    });
  } catch (error) {
    console.error('Create AMC package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE AMC package
router.put('/:packageId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { packageId } = req.params;
    const { packageName, propertyType, services, serviceRows, rate, billingDuration, status } = req.body;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE amc_packages SET 
        package_name = COALESCE(?, package_name),
        property_type = COALESCE(?, property_type),
        services = COALESCE(?, services),
        service_rows = COALESCE(?, service_rows),
        rate = COALESCE(?, rate),
        billing_duration = COALESCE(?, billing_duration),
        status = COALESCE(?, status)
       WHERE package_id = ?`,
      [
        packageName,
        propertyType,
        services,
        serviceRows ? JSON.stringify(serviceRows) : null,
        rate,
        billingDuration,
        status,
        packageId
      ]
    );
    
    res.json({ success: true, message: 'AMC Package updated' });
  } catch (error) {
    console.error('Update AMC package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE AMC package (soft delete)
router.delete('/:packageId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { packageId } = req.params;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE amc_packages SET is_active = FALSE WHERE package_id = ?`,
      [packageId]
    );
    
    res.json({ success: true, message: 'AMC Package deleted' });
  } catch (error) {
    console.error('Delete AMC package error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
