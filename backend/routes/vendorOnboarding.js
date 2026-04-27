const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Generate unique vendor ID: PREFIX-XXXX-YYYYMMDD (matching client ID format)
const generateVendorId = (serviceType) => {
  const prefixMap = {
    'Plumbing': 'PLM',
    'Electrical': 'ELC',
    'HVAC': 'HVC',
    'Cleaning': 'CLN',
    'Security': 'SEC',
    'Landscaping': 'LND',
    'Pest Control': 'PST',
    'Painting': 'PNT',
    'Carpentry': 'CRP',
    'General Maintenance': 'GMN',
    'Fire Safety': 'FRS',
    'Elevator Maintenance': 'ELV',
    'Water Tank Cleaning': 'WTC',
    'Garbage Collection': 'GBC',
    'Swimming Pool Maintenance': 'SPM'
  };
  const prefix = prefixMap[serviceType] || 'VND';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${random}-${date}`;
};

// ============================================
// POST /api/vendors/onboarding  — Create a new vendor
// ============================================
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      serviceType,
      serviceVerified,
      zone,
      areaName,
      division,
      // Owner details
      ownerName,
      ownerMobile,
      ownerEmail,
      ownerAadhar,
      ownerCountryCode,
      // Manager contact
      managerName,
      managerMobile,
      managerEmail,
      managerCountryCode,
      // Point of contact
      pocName,
      pocMobile,
      pocEmail,
      pocCountryCode,
      // Rate & Coverage
      ratePerVisit,
      coveragePerDay,
      createdBy
    } = req.body;

    const vendorId = generateVendorId(serviceType);

    const [result] = await conn.execute(
      `INSERT INTO onboarded_vendors
        (vendor_id, service_type, service_verified, zone, area_name, division,
         owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
         manager_name, manager_mobile, manager_email, manager_country_code,
         poc_name, poc_mobile, poc_email, poc_country_code,
         rate_per_visit, coverage_per_day, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendorId,
        serviceType,
        serviceVerified ? 1 : 0,
        zone,
        areaName,
        division,
        ownerName,
        ownerMobile,
        ownerEmail,
        ownerAadhar,
        ownerCountryCode || '+91',
        managerName || null,
        managerMobile || null,
        managerEmail || null,
        managerCountryCode || '+91',
        pocName || null,
        pocMobile || null,
        pocEmail || null,
        pocCountryCode || '+91',
        ratePerVisit || 0,
        coveragePerDay || 0,
        createdBy || 'Manager'
      ]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Vendor added successfully',
      data: {
        id: result.insertId.toString(),
        vendorId,
        serviceType,
        ownerName,
        zone,
        division,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error adding vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding vendor',
      error: error.message
    });
  } finally {
    conn.release();
  }
});

// ============================================
// GET /api/vendors/onboarding  — List all vendors
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT * FROM onboarded_vendors`;
    
    if (status === 'all') {
      query += ` ORDER BY created_at DESC`;
    } else if (status === 'deleted') {
      query += ` WHERE status = 'deleted' ORDER BY created_at DESC`;
    } else {
      query += ` WHERE status = 'active' ORDER BY created_at DESC`;
    }
    
    const [rows] = await pool.execute(query);

    const data = rows.map(row => ({
      id: row.id.toString(),
      vendorId: row.vendor_id,
      serviceType: row.service_type,
      serviceVerified: !!row.service_verified,
      zone: row.zone,
      areaName: row.area_name,
      division: row.division,
      // Owner details
      ownerName: row.owner_name,
      ownerMobile: row.owner_mobile,
      ownerEmail: row.owner_email,
      ownerAadhar: row.owner_aadhar,
      ownerCountryCode: row.owner_country_code,
      // Manager contact
      managerName: row.manager_name,
      managerMobile: row.manager_mobile,
      managerEmail: row.manager_email,
      managerCountryCode: row.manager_country_code,
      // Point of contact
      pocName: row.poc_name,
      pocMobile: row.poc_mobile,
      pocEmail: row.poc_email,
      pocCountryCode: row.poc_country_code,
      // Rate & Coverage
      ratePerVisit: parseFloat(row.rate_per_visit) || 0,
      coveragePerDay: parseInt(row.coverage_per_day) || 0,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vendors',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/vendors/onboarding/:id  — Soft-delete a vendor
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      `UPDATE onboarded_vendors SET status = 'deleted' WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting vendor',
      error: error.message
    });
  }
});

module.exports = router;
