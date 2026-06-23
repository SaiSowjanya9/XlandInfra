/**
 * Franchise Partner API Routes
 * All routes are scoped to the logged-in FP's data only
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { ROLES, ROLE_NAMES, isFranchisePartner } = require('../config/roles');
const { 
  attachFPScope, 
  requireFPScope, 
  getFPIdForInsert,
  validateOwnership,
  buildScopedQuery 
} = require('../middleware/fpScope');
const { sendFPEmployeeWelcomeEmail, sendVendorAssignmentEmail, sendCustomerActivationEmail } = require('../services/emailService');

// Constants for customer activation
const ACTIVATION_EXPIRY_HOURS = 72;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://xlandinfra.com';

// Generate secure temporary password for customer activation (8 chars, alphanumeric)
const generateCustomerTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Generate secure activation token
const generateActivationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ============================================
// FP AUTHENTICATION (Public - No Auth Required)
// ============================================

// FP Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check franchise_partners table
    const [fps] = await pool.execute(
      `SELECT * FROM franchise_partners WHERE (username = ? OR email = ?) AND is_active = 1`,
      [username, username]
    );

    if (fps.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const fp = fps[0];
    const isValidPassword = await bcrypt.compare(password, fp.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.execute(
      `UPDATE franchise_partners SET last_login = NOW() WHERE id = ?`,
      [fp.id]
    );

    // Handle owner_name safely (might be null)
    const ownerName = fp.owner_name || fp.contact_person || fp.company_name || 'Franchise Partner';
    const nameParts = ownerName.split(' ');
    const firstName = nameParts[0] || 'Franchise';
    const lastName = nameParts.slice(1).join(' ') || 'Partner';

    // Generate token with FP info
    const token = generateToken({
      id: fp.id,
      fpId: fp.id,
      username: fp.username,
      email: fp.email,
      role: ROLES.FRANCHISE_PARTNER,
      firstName: firstName,
      lastName: lastName,
      franchisePartnerId: fp.id,
      companyName: fp.company_name
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: fp.id,
          fpId: fp.id,
          username: fp.username,
          email: fp.email,
          firstName: firstName,
          lastName: lastName,
          companyName: fp.company_name,
          role: ROLES.FRANCHISE_PARTNER,
          roleName: ROLE_NAMES[ROLES.FRANCHISE_PARTNER],
          franchisePartnerId: fp.id
        }
      }
    });
  } catch (error) {
    console.error('FP Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachFPScope);

// ============================================
// FP DASHBOARD
// ============================================

router.get('/dashboard', requireFPScope, async (req, res) => {
  try {
    const fpId = req.fpId;

    // Helper function to safely get count (handles missing tables)
    const safeCount = (query, params) => {
      return pool.execute(query, params)
        .then(([result]) => result[0]?.count || 0)
        .catch((e) => {
          console.log(`Dashboard query skipped (table may not exist): ${e.message}`);
          return 0;
        });
    };

    // Run all queries in parallel for faster response
    const [
      properties,
      vendors,
      customers,
      workOrderStats,
      estimates,
      employeeStats,
      workOrdersByRole,
      recentWorkOrders
    ] = await Promise.all([
      // Properties count
      safeCount('SELECT COUNT(*) as count FROM properties WHERE franchise_partner_id = ? AND (status IS NULL OR status != \'deleted\')', [fpId]),
      
      // Vendors count - only this FP's vendors
      safeCount('SELECT COUNT(*) as count FROM onboarded_vendors WHERE franchise_partner_id = ? AND vendor_id NOT LIKE \'%SEED%\'', [fpId]),
      
      // Customers count
      safeCount('SELECT COUNT(*) as count FROM clients WHERE franchise_partner_id = ?', [fpId]),
      
      // Work orders - combined query
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
        FROM work_orders WHERE franchise_partner_id = ?
      `, [fpId]).then(([[r]]) => ({ total: r.total || 0, pending: r.pending || 0, completed: r.completed || 0 }))
        .catch(() => ({ total: 0, pending: 0, completed: 0 })),
      
      // Estimates count (only non-archived)
      safeCount('SELECT COUNT(*) as count FROM fp_estimates WHERE franchise_partner_id = ? AND (is_archived = 0 OR is_archived IS NULL)', [fpId]),
      
      // Employee stats - combined query
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN role = 'manager' AND is_active = 1 THEN 1 ELSE 0 END) as managers,
          SUM(CASE WHEN role = 'coordinator' AND is_active = 1 THEN 1 ELSE 0 END) as coordinators,
          SUM(CASE WHEN role = 'supervisor' AND is_active = 1 THEN 1 ELSE 0 END) as supervisors,
          SUM(CASE WHEN role = 'executive' AND is_active = 1 THEN 1 ELSE 0 END) as executives
        FROM fp_employees WHERE franchise_partner_id = ?
      `, [fpId]).then(([[r]]) => ({
        total: r.total || 0,
        managers: r.managers || 0,
        coordinators: r.coordinators || 0,
        supervisors: r.supervisors || 0,
        executives: r.executives || 0
      })).catch(() => ({ total: 0, managers: 0, coordinators: 0, supervisors: 0, executives: 0 })),
      
      // Work orders by role - simplified without JOIN
      Promise.resolve({ managers: 0, coordinators: 0, supervisors: 0, executives: 0 }),
      
      // Recent work orders - simplified without fp_employees JOIN
      pool.execute(
        `SELECT wo.*, p.name as property_name, c.name as category_name,
                wo.created_by as created_by_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         WHERE wo.franchise_partner_id = ?
         ORDER BY wo.created_at DESC LIMIT 5`,
        [fpId]
      ).then(([rows]) => rows).catch(() => [])
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          properties,
          vendors,
          customers,
          workOrders: {
            total: workOrderStats.total,
            pending: workOrderStats.pending,
            completed: workOrderStats.completed,
            byRole: workOrdersByRole
          },
          estimates,
          employees: employeeStats.total,
          employeeRoles: {
            managers: employeeStats.managers,
            coordinators: employeeStats.coordinators,
            supervisors: employeeStats.supervisors,
            executives: employeeStats.executives
          }
        },
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data',
      error: error.message
    });
  }
});

// ============================================
// PROPERTY MANAGEMENT
// ============================================

// Get all FP properties
router.get('/properties', requireFPScope, async (req, res) => {
  try {
    // Fetch from properties table with creator name
    const [regularProperties] = await pool.execute(
      `SELECT p.*,
        COALESCE(z.name, zn.name, p.zone_id) as zone_name,
        COALESCE(fd.name, p.division_id) as division_name,
        p.division_id as division,
        p.area_name as area,
        COALESCE(p.number_of_units, p.number_of_blocks, 1) as units,
        COALESCE(
          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
          p.created_by, 'System'
        ) as created_by_name,
        'properties' as source_table
       FROM properties p
       LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
       LEFT JOIN zones zn ON p.zone_id = zn.name
       LEFT JOIN fp_divisions fd ON (CAST(p.division_id AS UNSIGNED) = fd.id OR p.division_id = fd.name) AND fd.franchise_partner_id = p.franchise_partner_id
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username OR CAST(p.created_by AS UNSIGNED) = fpe.id
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.username OR p.created_by = u.user_id OR p.created_by = u.id
       WHERE p.franchise_partner_id = ? AND (p.status IS NULL OR p.status != 'deleted')
       ORDER BY p.created_at DESC`,
      [req.fpId]
    );

    // Also fetch from onboarded_properties with creator name and division name
    let onboardedProperties = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type, op.entry_type,
                op.zone as zone_name, op.area_name as area, 
                COALESCE(fd.name, op.division) as division, COALESCE(fd.name, op.division) as division_name,
                op.total_units as units, op.number_of_units,
                op.address, op.city, op.state, op.postal_code as zip_code,
                op.landmark, op.latitude, op.longitude,
                op.association_contacts,
                op.number_of_blocks, op.block_names, op.units_per_block,
                op.block_info, op.block_na, op.flat_block_info, op.flat_block_na,
                op.villa_plot_number, op.plot_na,
                op.watchman_name, op.watchman_contact,
                op.notes,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                  op.created_by, 'System'
                ) as created_by_name,
                op.created_at, op.status,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN fp_divisions fd ON (CAST(op.division AS UNSIGNED) = fd.id OR op.division = fd.name) AND fd.franchise_partner_id = op.franchise_partner_id
         LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR op.created_by = fpe.username OR CAST(op.created_by AS UNSIGNED) = fpe.id
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.username OR op.created_by = u.user_id OR op.created_by = u.id
         WHERE op.franchise_partner_id = ? AND op.status = 'active'
         ORDER BY op.created_at DESC`,
        [req.fpId]
      );
      onboardedProperties = rows;
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    const allProperties = [...regularProperties, ...onboardedProperties];

    res.json({
      success: true,
      data: allProperties
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message
    });
  }
});

// Create property
router.post('/properties', requireFPScope, async (req, res) => {
  try {
    const {
      name, propertyType, address, city, state, zipCode,
      contactPerson, contactPhone, contactEmail, zoneId, divisionId
    } = req.body;

    const propertyId = `PROP-${Date.now()}`;
    
    // Get actual user name from database (check both users and fp_employees tables)
    let creatorName = req.user?.username || req.user?.email || 'System';
    try {
      const [userRows] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ? OR email = ? OR username = ?',
        [req.user?.id || 0, req.user?.email || '', req.user?.username || '']
      );
      if (userRows.length > 0 && (userRows[0].first_name || userRows[0].last_name)) {
        creatorName = `${userRows[0].first_name || ''} ${userRows[0].last_name || ''}`.trim();
      } else {
        const [fpRows] = await pool.execute(
          'SELECT first_name, last_name FROM fp_employees WHERE id = ? OR email = ? OR username = ?',
          [req.user?.id || 0, req.user?.email || '', req.user?.username || '']
        );
        if (fpRows.length > 0 && (fpRows[0].first_name || fpRows[0].last_name)) {
          creatorName = `${fpRows[0].first_name || ''} ${fpRows[0].last_name || ''}`.trim();
        }
      }
    } catch (e) {
      console.log('Could not fetch creator name:', e.message);
    }

    const [result] = await pool.execute(
      `INSERT INTO properties (
        property_id, name, property_type, address, city, state, zip_code,
        contact_person, contact_phone, contact_email, zone_id, division_id,
        franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId, name, propertyType || 'residential', address, city, state, zipCode,
        contactPerson, contactPhone, contactEmail, zoneId || null, divisionId || null,
        req.fpId, creatorName
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: { id: result.insertId, propertyId }
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: error.message
    });
  }
});

// Get single property by ID (for auto-populate in work orders)
router.get('/properties/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try properties table first
    const [properties] = await pool.execute(
      `SELECT p.*, p.contact_person, p.contact_phone, p.contact_email
       FROM properties p
       WHERE (p.id = ? OR p.property_id = ?) AND p.franchise_partner_id = ?`,
      [id, id, req.fpId]
    );
    
    if (properties.length > 0) {
      return res.json({ success: true, data: properties[0] });
    }
    
    // Try onboarded_properties table
    const [onboarded] = await pool.execute(
      `SELECT op.*, op.community_name as name, NULL as contact_person, NULL as contact_phone, NULL as contact_email
       FROM onboarded_properties op
       WHERE (op.id = ? OR op.property_id = ?) AND op.franchise_partner_id = ?`,
      [id, id, req.fpId]
    );
    
    if (onboarded.length > 0) {
      return res.json({ success: true, data: onboarded[0] });
    }
    
    res.status(404).json({ success: false, message: 'Property not found' });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch property' });
  }
});

// Update property (handles both properties and onboarded_properties tables)
router.put('/properties/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sourceTable = updates.sourceTable || updates.source_table;

    // Check which table the property belongs to
    let tableName = 'properties';
    let ownerColumn = 'franchise_partner_id';
    
    if (sourceTable === 'onboarded_properties') {
      tableName = 'onboarded_properties';
    } else {
      // Check if property exists in properties table
      const [propCheck] = await pool.execute(
        'SELECT id FROM properties WHERE id = ? AND franchise_partner_id = ?',
        [id, req.fpId]
      );
      
      if (propCheck.length === 0) {
        // Check onboarded_properties table
        const [onboardedCheck] = await pool.execute(
          'SELECT id FROM onboarded_properties WHERE id = ? AND franchise_partner_id = ?',
          [id, req.fpId]
        );
        
        if (onboardedCheck.length > 0) {
          tableName = 'onboarded_properties';
        } else {
          return res.status(404).json({
            success: false,
            message: 'Property not found or access denied'
          });
        }
      }
    }

    // Define allowed fields for each table - expanded to include all editable fields
    const allowedFieldsMap = {
      properties: [
        'name', 'property_type', 'address', 'city', 'state', 'zip_code',
        'contact_person', 'contact_phone', 'contact_email', 'zone_id', 'division_id', 'area_name', 'is_active',
        // Additional fields for full edit support
        'notes', 'landmark', 'latitude', 'longitude',
        'number_of_blocks', 'block_names', 'units_per_block', 'block_unit_types',
        'number_of_units', 'villa_plot_number', 'block_info', 'block_na',
        'flat_block_info', 'flat_block_na', 'plot_na',
        'watchman_name', 'watchman_contact', 'association_contacts', 'total_units'
      ],
      onboarded_properties: [
        'community_name', 'property_type', 'address', 'city', 'state', 'postal_code',
        'zone', 'division', 'area_name', 'status', 'number_of_units', 'total_units',
        // Additional fields for full edit support
        'notes', 'landmark', 'map_lat', 'map_lng', 'map_address',
        'number_of_blocks', 'block_names', 'units_per_block', 'block_unit_types',
        'villa_plot_number', 'block_info', 'block_na',
        'flat_block_info', 'flat_block_na', 'plot_na',
        'watchman_name', 'watchman_contact', 'association_contacts'
      ]
    };

    // Field mapping for onboarded_properties (camelCase/frontend -> snake_case/db)
    const fieldMapping = {
      name: tableName === 'onboarded_properties' ? 'community_name' : 'name',
      zipCode: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zip_code: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zoneId: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      zone_id: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      divisionId: tableName === 'onboarded_properties' ? 'division' : 'division_id',
      division_id: tableName === 'onboarded_properties' ? 'division' : 'division_id',
      isActive: 'status',
      is_active: 'status',
      // Latitude/longitude mapping for onboarded_properties
      latitude: tableName === 'onboarded_properties' ? 'map_lat' : 'latitude',
      longitude: tableName === 'onboarded_properties' ? 'map_lng' : 'longitude',
      // Consistent field mappings
      numberOfBlocks: 'number_of_blocks',
      blockNames: 'block_names',
      unitsPerBlock: 'units_per_block',
      blockUnitTypes: 'block_unit_types',
      numberOfUnits: 'number_of_units',
      villaPlotNumber: 'villa_plot_number',
      blockInfo: 'block_info',
      blockNA: 'block_na',
      flatBlockInfo: 'flat_block_info',
      flatBlockNA: 'flat_block_na',
      plotNA: 'plot_na',
      watchmanName: 'watchman_name',
      watchmanContact: 'watchman_contact',
      associationContacts: 'association_contacts',
      totalUnits: 'total_units',
      areaName: 'area_name',
      contactPerson: 'contact_person',
      contactPhone: 'contact_phone',
      contactEmail: 'contact_email'
    };

    // Fields that need JSON serialization
    const jsonFields = ['block_names', 'units_per_block', 'block_unit_types', 'association_contacts'];

    const allowedFields = allowedFieldsMap[tableName];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'sourceTable' || key === 'source_table') continue;
      if (value === undefined) continue; // Skip undefined values
      
      // Convert camelCase to snake_case
      let dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      
      // Apply field mapping if exists
      if (fieldMapping[key]) {
        dbKey = fieldMapping[key];
      } else if (fieldMapping[dbKey]) {
        dbKey = fieldMapping[dbKey];
      }
      
      // Handle is_active -> status conversion for onboarded_properties
      let finalValue = value;
      if (tableName === 'onboarded_properties' && (key === 'isActive' || key === 'is_active')) {
        dbKey = 'status';
        finalValue = value ? 'active' : 'inactive';
      }
      
      // Handle boolean fields - convert to 0/1 for MySQL
      if (typeof finalValue === 'boolean') {
        finalValue = finalValue ? 1 : 0;
      }
      
      // Handle JSON fields - serialize if needed
      if (jsonFields.includes(dbKey) && typeof finalValue === 'object' && finalValue !== null) {
        finalValue = JSON.stringify(finalValue);
      }
      
      // Handle null values for optional fields
      if (finalValue === null || finalValue === '') {
        if (['latitude', 'longitude', 'number_of_units', 'number_of_blocks'].includes(dbKey)) {
          finalValue = null;
        }
      }
      
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        values.push(finalValue);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    values.push(id, req.fpId);

    const sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ? AND franchise_partner_id = ?`;
    console.log('📋 [FP] Update property SQL:', sql);
    console.log('📋 [FP] Update property values:', values);
    
    await pool.execute(sql, values);

    res.json({
      success: true,
      message: 'Property updated successfully'
    });
  } catch (error) {
    console.error('❌ [FP] Update property error:', error);
    console.error('❌ [FP] Error details:', error.message, error.sql || '');
    res.status(500).json({
      success: false,
      message: 'Failed to update property: ' + error.message,
      error: error.message
    });
  }
});

// Delete property - cascades to clients and customer_accounts
// Handles both 'properties' and 'onboarded_properties' tables
router.delete('/properties/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const sourceTable = req.query.source || 'properties';
    
    // Validate ownership - check both tables
    let hasOwnership = false;
    let tableName = 'properties';
    let contactEmail = null;
    
    // Check properties table first
    const [propRows] = await pool.execute(
      'SELECT id, contact_email FROM properties WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );
    if (propRows.length > 0) {
      hasOwnership = true;
      tableName = 'properties';
      contactEmail = propRows[0].contact_email;
    }
    
    // Check onboarded_properties table if not found
    if (!hasOwnership) {
      const [onboardedRows] = await pool.execute(
        'SELECT id FROM onboarded_properties WHERE id = ? AND franchise_partner_id = ?',
        [id, req.fpId]
      );
      if (onboardedRows.length > 0) {
        hasOwnership = true;
        tableName = 'onboarded_properties';
      }
    }
    
    if (!hasOwnership) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own properties.'
      });
    }

    // Delete customer_accounts by email (so email can be reused)
    if (contactEmail) {
      try {
        await pool.execute('DELETE FROM customer_accounts WHERE email = ?', [contactEmail.toLowerCase()]);
        console.log('📋 [FP] Deleted customer_account for email:', contactEmail);
      } catch (e) {}
    }
    // Also delete by property_id
    try {
      await pool.execute('DELETE FROM customer_accounts WHERE property_id = ?', [id]);
    } catch (e) {}

    // Delete related clients
    try {
      await pool.execute('DELETE FROM clients WHERE property_id = ?', [id]);
      console.log('📋 [FP] Deleted clients for property_id:', id);
    } catch (e) {}

    // Delete the property from the correct table
    if (tableName === 'onboarded_properties') {
      await pool.execute(
        `DELETE FROM onboarded_properties WHERE id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );
    } else {
      await pool.execute(
        `DELETE FROM properties WHERE id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );
    }
    
    res.json({ success: true, message: 'Property and associated customer accounts deleted. Email can now be reused.' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign vendor to property
router.post('/properties/:id/assign-vendor', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    // Verify property belongs to this FP - check both properties and onboarded_properties
    let property = [];
    let propertySource = 'properties';
    
    // First check properties table
    [property] = await pool.execute(
      `SELECT id, property_id, name, property_type, address, city, state, zip_code as zipcode, zone_id, 
              contact_person, contact_phone, contact_email 
       FROM properties WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    // If not found, check onboarded_properties table
    if (property.length === 0) {
      [property] = await pool.execute(
        `SELECT id, property_id, community_name as name, property_type, address, city, state, pincode as zipcode, zone as zone_id,
                contact_person, contact_phone, contact_email 
         FROM onboarded_properties WHERE id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );
      propertySource = 'onboarded_properties';
    }

    if (property.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    console.log('[Assign Vendor] Property found in:', propertySource, 'ID:', id);

    // Verify vendor belongs to this FP (check onboarded_vendors table)
    const [vendor] = await pool.execute(
      `SELECT id, owner_name, owner_email, owner_mobile, service_type FROM onboarded_vendors 
       WHERE (id = ? OR vendor_id = ?) AND franchise_partner_id = ?`,
      [vendorId, vendorId, req.fpId]
    );

    if (vendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    
    // Use numeric id for assignment
    const numericVendorId = vendor[0].id;

    // Check if same vendor assignment already exists and is active
    const [existingSame] = await pool.execute(
      `SELECT id FROM property_vendor_assignments WHERE property_id = ? AND vendor_id = ? AND is_active = 1`,
      [id, numericVendorId]
    );

    if (existingSame.length > 0) {
      return res.status(400).json({ success: false, message: 'This vendor is already assigned to this property' });
    }

    // Deactivate any existing vendor assignments for this property (allow only one vendor per property)
    await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 0 WHERE property_id = ? AND is_active = 1`,
      [id]
    );

    // Create new assignment
    await pool.execute(
      `INSERT INTO property_vendor_assignments (property_id, vendor_id, assigned_by, assigned_at, is_active)
       VALUES (?, ?, ?, NOW(), TRUE)`,
      [id, numericVendorId, req.user.id]
    );

    // Send email notification to vendor
    if (vendor[0].owner_email) {
      sendVendorAssignmentEmail(vendor[0].owner_email, vendor[0].owner_name, property[0])
        .catch(err => console.error('Failed to send vendor assignment email:', err));
    }

    res.json({
      success: true,
      message: 'Vendor assigned successfully',
      data: { vendorName: vendor[0].owner_name, serviceType: vendor[0].service_type }
    });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign vendor', error: error.message });
  }
});

// Assign employee to property
router.post('/properties/:id/assign-employee', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    // Verify property belongs to this FP
    const [property] = await pool.execute(
      `SELECT id FROM properties WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (property.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Verify employee belongs to this FP
    const [employee] = await pool.execute(
      `SELECT id, first_name, last_name FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
      [employeeId, req.fpId]
    );

    if (employee.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Create assignment
    await pool.execute(
      `INSERT INTO property_employee_assignments (property_id, employee_id, assigned_by, assigned_at, is_active)
       VALUES (?, ?, ?, NOW(), TRUE)
       ON DUPLICATE KEY UPDATE is_active = 1, assigned_at = NOW()`,
      [id, employeeId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Employee assigned successfully',
      data: { employeeName: `${employee[0].first_name} ${employee[0].last_name}` }
    });
  } catch (error) {
    console.error('Assign employee error:', error);
    res.status(500).json({ success: false, message: 'Failed to assign employee', error: error.message });
  }
});

// ============================================
// WORK ORDERS
// ============================================

// Get all FP work orders (shows ALL work orders for FP visibility)
router.get('/work-orders', requireFPScope, async (req, res) => {
  try {
    const { status, priority } = req.query;
    console.log('[FP Work Orders GET] fpId:', req.fpId, 'status filter:', status);

    let query = `
      SELECT wo.*, 
        COALESCE(p.name, op.community_name, wo.property_name) as property_name,
        COALESCE(p.property_id, op.property_id, wo.property_id) as actual_property_id,
        COALESCE(p.property_id, op.property_id, wo.property_id) as property_code,
        COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
        COALESCE(p.zone_id, op.zone) as zone,
        COALESCE(p.division_id, op.division) as division,
        COALESCE(p.address, op.address) as address,
        COALESCE(p.city, op.city) as city,
        COALESCE(p.state, op.state) as state,
        COALESCE(p.zip_code, op.postal_code) as property_pincode,
        COALESCE(p.contact_person, op.contact_person) as contact_person,
        COALESCE(p.contact_phone, op.contact_phone) as contact_phone,
        COALESCE(p.contact_email, op.contact_email) as contact_email,
        op.total_units,
        op.number_of_blocks as total_blocks,
        op.entry_type,
        COALESCE(c.name, wo.category_name) as category_name,
        wo.subcategory_name,
        v.company_name as vendor_name,
        wo.customer_name,
        wo.customer_email,
        wo.customer_phone,
        COALESCE(
          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
          wo.created_by, 'System'
        ) as created_by_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username OR CAST(wo.created_by AS UNSIGNED) = fpe.id
      LEFT JOIN users u ON wo.created_by = u.email OR wo.created_by = u.username OR wo.created_by = u.user_id OR CAST(wo.created_by AS UNSIGNED) = u.id
      WHERE wo.franchise_partner_id = ?
    `;
    const params = [req.fpId];

    if (status) {
      if (status === 'pending') {
        query += ` AND wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`;
      } else if (status === 'completed') {
        query += ` AND wo.status IN ('completed', 'closed')`;
      } else {
        query += ' AND wo.status = ?';
        params.push(status);
      }
    }

    if (priority) {
      query += ' AND wo.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY wo.created_at DESC LIMIT 500';

    const [workOrders] = await pool.execute(query, params);
    console.log('[FP Work Orders GET] Found:', workOrders.length, 'work orders');

    res.json({
      success: true,
      data: workOrders
    });
  } catch (error) {
    console.error('Get work orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch work orders',
      error: error.message
    });
  }
});

// Create work order (with file upload support)
router.post('/work-orders', requireFPScope, upload.array('attachments', 5), async (req, res) => {
  try {
    const {
      propertyId, categoryId, subcategoryId, description, priority,
      permissionToEnter, hasPet, entryNotes, customerName, customerEmail, customerPhone,
      categoryName: reqCategoryName, subcategoryName: reqSubcategoryName
    } = req.body;

    // Validate property belongs to FP - check both tables (include property_id, property_type, and zone for email)
    let property = [];
    
    // Check properties table first
    const [regularProp] = await pool.execute(
      'SELECT id, name, property_id, property_type, zone_id as zone FROM properties WHERE (id = ? OR property_id = ?) AND franchise_partner_id = ?',
      [propertyId, propertyId, req.fpId]
    );
    
    if (regularProp.length > 0) {
      property = regularProp;
    } else {
      // Check onboarded_properties table
      const [onboardedProp] = await pool.execute(
        'SELECT id, community_name as name, property_id, property_type, zone FROM onboarded_properties WHERE (id = ? OR property_id = ?) AND franchise_partner_id = ?',
        [propertyId, propertyId, req.fpId]
      );
      property = onboardedProp;
    }

    if (property.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid property selection'
      });
    }

    const workOrderId = `WO-${Date.now()}`;
    const title = `Service Request - ${property[0].name || 'Property'}`;

    // Get category and subcategory names - use request body values or fetch from config
    const categoriesConfig = require('../config/categories');
    let categoryName = reqCategoryName || null;
    let subcategoryName = reqSubcategoryName || null;
    
    if (categoryId && !categoryName) {
      const category = categoriesConfig.find(c => c.id === parseInt(categoryId));
      if (category) categoryName = category.name;
    }
    
    if (subcategoryId && !subcategoryName) {
      // Find subcategory in the category's embedded subcategories
      for (const category of categoriesConfig) {
        const subcategory = category.subcategories?.find(s => s.id === parseInt(subcategoryId));
        if (subcategory) {
          subcategoryName = subcategory.name;
          break;
        }
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO work_orders (
        work_order_id, property_id, category_id, subcategory_id, category_name, subcategory_name, 
        title, description, priority, permission_to_enter, has_pet, entry_notes, 
        customer_name, customer_email, customer_phone, status, franchise_partner_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        workOrderId, propertyId, categoryId || null, subcategoryId || null, categoryName, subcategoryName,
        title, description || '', priority || 'medium', permissionToEnter || 'no', hasPet || 'no', 
        entryNotes || null, customerName || null, customerEmail || null, customerPhone || null,
        req.fpId, req.user?.id || null
      ]
    );

    // Save attachments if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.execute(
          `INSERT INTO work_order_attachments (work_order_id, file_name, file_path, file_type, file_size)
           VALUES (?, ?, ?, ?, ?)`,
          [result.insertId, file.originalname, file.filename, file.mimetype, file.size]
        );
      }
    }

    // Send email notification for new work order
    // Sends to: FP email + zone-centric employees + customer
    const { sendWorkOrderCreatedNotification } = require('../services/emailService');
    sendWorkOrderCreatedNotification({
      orderId: result.insertId,
      orderNumber: workOrderId,
      title,
      propertyName: property[0]?.name,
      propertyId: property[0]?.property_id || propertyId,
      propertyType: property[0]?.property_type,
      customerName,
      customerEmail,
      customerPhone,
      categoryName,
      subcategoryName,
      priority,
      description,
      createdBy: req.user?.username || req.user?.email || 'FP Admin',
      createdByRole: 'Franchise Partner',
      franchisePartnerId: req.fpId,
      propertyZone: property[0]?.zone || null
    }).catch(err => console.error('Email notification error:', err));

    res.status(201).json({
      success: true,
      message: 'Work order created successfully',
      data: { id: result.insertId, workOrderId }
    });
  } catch (error) {
    console.error('Create work order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create work order',
      error: error.message
    });
  }
});

// Update work order status
router.patch('/work-orders/:id/status', requireFPScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    await pool.execute(
      `UPDATE work_orders SET status = ?, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [status, id, req.fpId]
    );

    // Log status change
    await pool.execute(
      `INSERT INTO work_order_status_history (work_order_id, to_status, changed_by, changed_by_role, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, status, req.user.id, req.user.role, notes || null]
    );

    // Send completion email if status is completed
    if (status === 'completed') {
      const [workOrder] = await pool.execute(
        `SELECT work_order_id, title, property_name, property_id, customer_name, customer_email, customer_phone, category_name, subcategory_name 
         FROM work_orders WHERE id = ?`, [id]
      );
      if (workOrder.length > 0) {
        const { sendWorkOrderCompletedNotification } = require('../services/emailService');
        sendWorkOrderCompletedNotification({
          orderId: id,
          orderNumber: workOrder[0].work_order_id,
          title: workOrder[0].title,
          propertyName: workOrder[0].property_name,
          propertyId: workOrder[0].property_id,
          customerName: workOrder[0].customer_name,
          customerEmail: workOrder[0].customer_email,
          customerPhone: workOrder[0].customer_phone,
          categoryName: workOrder[0].category_name,
          subcategoryName: workOrder[0].subcategory_name,
          completedBy: req.user?.username || req.user?.email || 'FP Admin',
          completedByRole: 'Franchise Partner'
        }).catch(err => console.error('Completion email error:', err));
      }
    }

    res.json({
      success: true,
      message: 'Work order status updated'
    });
  } catch (error) {
    console.error('Update work order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update work order status',
      error: error.message
    });
  }
});

// Assign vendor to work order
router.patch('/work-orders/:id/assign-vendor', requireFPScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId } = req.body;

    // Validate vendor belongs to FP (check onboarded_vendors table)
    const [vendor] = await pool.execute(
      `SELECT id FROM onboarded_vendors WHERE (id = ? OR vendor_id = ?) AND franchise_partner_id = ?`,
      [vendorId, vendorId, req.fpId]
    );

    if (vendor.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Invalid vendor selection'
      });
    }

    await pool.execute(
      `UPDATE work_orders 
       SET assigned_vendor_id = ?, assigned_at = NOW(), assigned_by = ?, status = 'assigned'
       WHERE id = ? AND franchise_partner_id = ?`,
      [vendorId, req.user.id, id, req.fpId]
    );

    res.json({
      success: true,
      message: 'Vendor assigned successfully'
    });
  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign vendor',
      error: error.message
    });
  }
});

// Update work order (full edit)
router.put('/work-orders/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      category_id, subcategory_id, description, 
      permission_to_enter, has_pet, entry_notes, priority, status,
      customer_name, customer_email, customer_phone, block, flat_number
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id || null); }
    if (subcategory_id !== undefined) { updates.push('subcategory_id = ?'); params.push(subcategory_id || null); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (permission_to_enter !== undefined) { updates.push('permission_to_enter = ?'); params.push(permission_to_enter); }
    if (has_pet !== undefined) { updates.push('has_pet = ?'); params.push(has_pet); }
    if (entry_notes !== undefined) { updates.push('entry_notes = ?'); params.push(entry_notes); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (customer_name !== undefined) { updates.push('customer_name = ?'); params.push(customer_name); }
    if (customer_email !== undefined) { updates.push('customer_email = ?'); params.push(customer_email); }
    if (customer_phone !== undefined) { updates.push('customer_phone = ?'); params.push(customer_phone); }
    if (block !== undefined) { updates.push('block = ?'); params.push(block); }
    if (flat_number !== undefined) { updates.push('flat_number = ?'); params.push(flat_number); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id, req.fpId);

    await pool.execute(
      `UPDATE work_orders SET ${updates.join(', ')} WHERE id = ? AND franchise_partner_id = ?`,
      params
    );

    // Update category and subcategory names using config (subcategories table is empty)
    const categoriesConfig = require('../config/categories');
    if (category_id) {
      const category = categoriesConfig.find(c => c.id === parseInt(category_id));
      if (category) {
        await pool.execute('UPDATE work_orders SET category_name = ? WHERE id = ?', [category.name, id]);
        
        // Also update subcategory name if subcategory_id is provided
        if (subcategory_id) {
          const subcategory = category.subcategories?.find(s => s.id === parseInt(subcategory_id));
          if (subcategory) {
            await pool.execute('UPDATE work_orders SET subcategory_name = ? WHERE id = ?', [subcategory.name, id]);
          }
        }
      }
    } else if (subcategory_id) {
      // If only subcategory_id is provided, find it across all categories
      for (const category of categoriesConfig) {
        const subcategory = category.subcategories?.find(s => s.id === parseInt(subcategory_id));
        if (subcategory) {
          await pool.execute('UPDATE work_orders SET subcategory_name = ? WHERE id = ?', [subcategory.name, id]);
          break;
        }
      }
    }

    res.json({ success: true, message: 'Work order updated successfully' });
  } catch (error) {
    console.error('Update work order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update work order status (PUT)
router.put('/work-orders/:id/status', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.execute(
      `UPDATE work_orders SET status = ?, updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [status, id, req.fpId]
    );

    // Log status change
    try {
      await pool.execute(
        `INSERT INTO work_order_status_history (work_order_id, to_status, changed_by, changed_by_role)
         VALUES (?, ?, ?, ?)`,
        [id, status, req.user.id, req.user.role]
      );
    } catch (e) {
      // Ignore if history table doesn't exist
    }

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete work order
router.delete('/work-orders/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete work orders that belong to this FP or have no FP assigned
    const [result] = await pool.execute(
      `DELETE FROM work_orders WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Work order not found or access denied' });
    }

    res.json({ success: true, message: 'Work order deleted' });
  } catch (error) {
    console.error('Delete work order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// Get all FP customers
// Combines data from both clients table (legacy) and customer_accounts + properties (new form)
router.get('/customers', requireFPScope, async (req, res) => {
  try {
    // Get legacy clients
    const [legacyClients] = await pool.execute(
      `SELECT c.*, p.name as property_name, 'client' as source_type
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.franchise_partner_id = ?`,
      [req.fpId]
    );

    // Get customers from customer_accounts linked to FP properties
    const [accountCustomers] = await pool.execute(
      `SELECT 
         ca.id, ca.customer_id as client_id, 
         COALESCE(ca.name, CONCAT(ca.first_name, ' ', ca.last_name)) as name,
         ca.email, ca.phone, ca.country_code,
         p.name as property_name, p.property_id as property_code,
         p.address, p.city, p.state, p.zip_code as postalCode,
         ca.is_activated, ca.is_active,
         ca.created_at, ca.updated_at,
         'customer_account' as source_type
       FROM customer_accounts ca
       INNER JOIN properties p ON ca.property_id = p.id
       WHERE ca.franchise_partner_id = ?`,
      [req.fpId]
    );

    // Get customers from customer_accounts linked to onboarded_properties (admin-created)
    const [adminCustomers] = await pool.execute(
      `SELECT 
         ca.id, ca.customer_id as client_id, 
         COALESCE(ca.name, CONCAT(ca.first_name, ' ', ca.last_name)) as name,
         ca.email, ca.phone, ca.country_code,
         op.community_name as property_name, op.property_id as property_code,
         op.address, op.city, op.state, op.postal_code as postalCode,
         ca.is_activated, ca.is_active,
         ca.created_at, ca.updated_at,
         'admin_created' as source_type
       FROM customer_accounts ca
       INNER JOIN onboarded_properties op ON ca.property_id = op.id
       WHERE ca.franchise_partner_id IS NULL`
    );

    // Combine and sort by created_at
    const allCustomers = [...legacyClients, ...accountCustomers, ...adminCustomers]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: allCustomers
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
});

// Create customer with property
router.post('/customers', requireFPScope, async (req, res) => {
  try {
    const {
      // Property form data
      zone, areaName, division, propertyType, communityName,
      associationContacts, numberOfBlocks, unitsPerBlock, blockNames, blockUnitTypes,
      numberOfUnits, villaPlotNumber, blockInfo, blockNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      // Simple customer data (for backward compatibility)
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    // Check if this is a property form submission (has zone/communityName)
    if (zone && communityName) {
      // Generate IDs with correct prefix based on entry type
      const prefixMap = { GC: 'GC', APT: 'APT', VILLA: 'V', PLOT: 'PL', FLAT: 'FL' };
      const prefix = prefixMap[entryType] || 'PROP';
      const propertyIdGen = `${prefix}-${Date.now()}`;
      const clientId = `CLT-${Date.now()}`;
      
      // Get contact info
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';
      
      // Extract watchman info from request body
      const { watchmanName, watchmanContact } = req.body;

      // Create property first (zone_id and division_id store names as VARCHAR)
      const [propertyResult] = await pool.execute(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, block_unit_types, number_of_units, villa_plot_number, block_info,
          watchman_name, watchman_contact, association_contacts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          req.fpId, req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), JSON.stringify(blockUnitTypes || {}),
          numberOfUnits || null, villaPlotNumber || '', blockInfo || '',
          watchmanName || null, watchmanContact || null, 
          associationContacts ? JSON.stringify(associationContacts) : null
        ]
      );

      // Create customer account if email provided
      let customerResult = null;
      let emailSent = false;
      if (contactEmail) {
        const tempPassword = generateCustomerTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        // Check if customer already exists
        const [existing] = await pool.execute(
          'SELECT id, is_activated FROM customer_accounts WHERE email = ?', [contactEmail.toLowerCase()]
        );
        
        if (existing.length === 0) {
          [customerResult] = await pool.execute(
            `INSERT INTO customer_accounts (
              customer_id, first_name, last_name, email, phone, temp_password_hash, property_id, property_code,
              activation_token, activation_expires, is_activated, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientId, contactName, '', contactEmail.toLowerCase(), `${contactCountryCode}${contactPhone}`,
              tempPasswordHash, propertyResult.insertId, propertyIdGen, activationToken, activationExpires, 0, 'franchise_partner'
            ]
          );
          
          // Send activation email
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          const emailResult = await sendCustomerActivationEmail({
            email: contactEmail.toLowerCase(),
            firstName: contactName,
            tempPassword,
            activationLink,
            propertyName: communityName,
            propertyId: propertyIdGen
          });
          emailSent = emailResult.success;
        } else if (!existing[0].is_activated) {
          // Resend activation email for inactive account
          await pool.execute(
            `UPDATE customer_accounts 
             SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW()
             WHERE id = ?`,
            [tempPasswordHash, activationToken, activationExpires, existing[0].id]
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          const emailResult = await sendCustomerActivationEmail({
            email: contactEmail.toLowerCase(),
            firstName: contactName,
            tempPassword,
            activationLink,
            propertyName: communityName,
            propertyId: propertyIdGen
          });
          emailSent = emailResult.success;
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully' + (emailSent ? ', activation email sent' : ''),
        data: { 
          propertyId: propertyIdGen,
          clientId,
          customerId: customerResult?.insertId || null,
          emailSent
        }
      });
    } else {
      // Simple customer creation (backward compatibility)
      const clientId = `CLT-${Date.now()}`;

      const [result] = await pool.execute(
        `INSERT INTO clients (
          client_id, name, email, phone, alternate_phone, address, city, state, zip_code,
          client_type, company_name, property_id, gst_number, franchise_partner_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
          clientType || 'individual', companyName, propertyId || null, gstNumber,
          req.fpId, req.user.id
        ]
      );

      // Create customer account and send activation email if email provided
      let emailSent = false;
      if (email) {
        const tempPassword = generateCustomerTempPassword();
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
        const activationToken = generateActivationToken();
        const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);
        
        const [existing] = await pool.execute(
          'SELECT id, is_activated FROM customer_accounts WHERE email = ?', [email.toLowerCase()]
        );
        
        if (existing.length === 0) {
          await pool.execute(
            `INSERT INTO customer_accounts (customer_id, first_name, last_name, email, phone, temp_password_hash,
              activation_token, activation_expires, is_activated, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [clientId, name, '', email.toLowerCase(), phone || '', tempPasswordHash, activationToken, activationExpires, 0, 'franchise_partner']
          );
          
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          console.log('📧 Sending activation email (FP simple create) to:', email.toLowerCase());
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: email.toLowerCase(), firstName: name, tempPassword, activationLink, propertyName: companyName || 'XLAND INFRA', propertyId: propertyId || clientId
            });
            emailSent = emailResult.success;
          } catch (emailError) {
            console.error('📧 Email sending failed:', emailError);
          }
        } else if (!existing[0].is_activated) {
          await pool.execute(
            `UPDATE customer_accounts SET temp_password_hash = ?, activation_token = ?, activation_expires = ?, updated_at = NOW() WHERE id = ?`,
            [tempPasswordHash, activationToken, activationExpires, existing[0].id]
          );
          const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
          try {
            const emailResult = await sendCustomerActivationEmail({
              email: email.toLowerCase(), firstName: name, tempPassword, activationLink, propertyName: companyName || 'XLAND INFRA', propertyId: propertyId || clientId
            });
            emailSent = emailResult.success;
          } catch (emailError) {
            console.error('📧 Email resend failed:', emailError);
          }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Customer created' + (emailSent ? ', activation email sent' : ''),
        data: { id: result.insertId, clientId, emailSent }
      });
    }
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
});

// Get customer accounts for FP - only this FP's customers
router.get('/customer-accounts', requireFPScope, async (req, res) => {
  try {
    const [accounts] = await pool.execute(
      `SELECT ca.*, 
              p.name as property_name, 
              p.property_id as property_code,
              'fp' as created_source
       FROM customer_accounts ca
       LEFT JOIN properties p ON ca.property_id = p.id
       WHERE ca.franchise_partner_id = ?
       ORDER BY ca.created_at DESC`,
      [req.fpId]
    );
    
    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Get customer accounts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Activate customer account
router.post('/customer-accounts/:id/activate', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate new temp password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await pool.execute(
      `UPDATE customer_accounts 
       SET is_activated = 1, password_hash = ?, temp_password = ?, updated_at = NOW()
       WHERE id = ? AND franchise_partner_id = ?`,
      [hashedPassword, tempPassword, id, req.fpId]
    );
    
    // Get customer details for email
    const [[customer]] = await pool.execute(
      'SELECT name, email FROM customer_accounts WHERE id = ?', [id]
    );
    
    // TODO: Send activation email with temp password
    
    res.json({ 
      success: true, 
      message: 'Customer account activated',
      data: { tempPassword } // Return temp password for manual sharing if needed
    });
  } catch (error) {
    console.error('Activate customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Deactivate customer account
router.post('/customer-accounts/:id/deactivate', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      `UPDATE customer_accounts SET is_activated = 0, updated_at = NOW()
       WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );
    
    res.json({ success: true, message: 'Customer account deactivated' });
  } catch (error) {
    console.error('Deactivate customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Resend activation email
router.post('/customer-accounts/:id/resend-activation', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Generate new temp password
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    await pool.execute(
      `UPDATE customer_accounts SET password_hash = ?, temp_password = ?, updated_at = NOW()
       WHERE id = ? AND franchise_partner_id = ?`,
      [hashedPassword, tempPassword, id, req.fpId]
    );
    
    // Get customer email
    const [[customer]] = await pool.execute(
      'SELECT name, email FROM customer_accounts WHERE id = ?', [id]
    );
    
    // TODO: Send email with new temp password
    
    res.json({ 
      success: true, 
      message: 'New activation credentials generated',
      data: { tempPassword, email: customer?.email }
    });
  } catch (error) {
    console.error('Resend activation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get all FP vendors (own + assigned) - fetch from onboarded_vendors
router.get('/vendors', requireFPScope, async (req, res) => {
  try {
    console.log('[FP Vendors] Fetching vendors for FP ID:', req.fpId);
    // Fetch vendors for this FP only
    const [vendors] = await pool.execute(
      `SELECT ov.id, ov.vendor_id, ov.service_type, ov.service_verified,
              ov.zone, ov.zone as zone_name, ov.area_name, ov.area_name as area, ov.division,
              ov.owner_name, ov.owner_name as company_name, ov.owner_name as contact_person,
              ov.owner_mobile, ov.owner_mobile as phone, ov.owner_email, ov.owner_email as email,
              ov.owner_aadhar, ov.owner_country_code,
              ov.manager_name, ov.manager_mobile, ov.manager_email, ov.manager_country_code,
              ov.poc_name, ov.poc_mobile, ov.poc_email, ov.poc_country_code,
              ov.rate_per_visit, ov.coverage_per_day,
              ov.created_by, ov.created_by_id,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                ov.created_by, 'System'
              ) as created_by_name,
              ov.status,
              ov.created_at, ov.updated_at,
              CASE WHEN ov.status = 'active' THEN 1 ELSE 0 END as is_active,
              'own' as vendor_type
       FROM onboarded_vendors ov
       LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id OR ov.created_by = fpe.email OR ov.created_by = fpe.username
       WHERE ov.franchise_partner_id = ?
         AND ov.vendor_id NOT LIKE '%SEED%'
       ORDER BY ov.created_at DESC`,
      [req.fpId]
    );

    console.log('[FP Vendors] Found', vendors.length, 'vendors for FP ID:', req.fpId);

    res.json({
      success: true,
      data: {
        own: vendors,
        assigned: [],
        all: vendors
      }
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors',
      error: error.message
    });
  }
});

// Get vendor assignments (property-vendor assignments)
router.get('/vendors/assignments', requireFPScope, async (req, res) => {
  try {
    console.log('[Vendor Assignments] FP ID:', req.fpId, 'User:', req.user?.email);
    
    // Get property-vendor assignments for this FP's properties with full vendor details
    // Join with both properties and onboarded_properties to handle both cases
    const [propertyAssignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        COALESCE(p.name, op.community_name) as property_name, 
        COALESCE(p.property_type, op.property_type) as property_type, 
        COALESCE(p.address, op.address) as address, 
        COALESCE(p.city, op.city) as city, 
        COALESCE(p.zone_id, op.zone) as property_zone,
        v.owner_name as vendor_name, v.vendor_id as vendor_code, v.service_type,
        v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
        v.zone as zone_name, v.area_name as area, v.rate_per_visit, v.coverage_per_day
       FROM property_vendor_assignments pva
       LEFT JOIN properties p ON pva.property_id = p.id
       LEFT JOIN onboarded_properties op ON pva.property_id = op.id
       JOIN onboarded_vendors v ON pva.vendor_id = v.id
       WHERE (p.franchise_partner_id = ? OR op.franchise_partner_id = ?) AND pva.is_active = 1
       ORDER BY pva.assigned_at DESC`,
      [req.fpId, req.fpId]
    );

    // Map property assignments to service assignments format (flat list for table display)
    const serviceAssignments = propertyAssignments.map(a => ({
      id: a.id,
      vendorId: a.vendor_code,
      vendorName: a.vendor_name,
      serviceType: a.service_type,
      propertyId: a.property_id,
      propertyName: a.property_name,
      propertyType: a.property_type,
      propertyZone: a.property_zone,
      zone_name: a.zone_name,
      area: a.area,
      rate_per_visit: a.rate_per_visit,
      coverage_per_day: a.coverage_per_day,
      vendor_phone: a.vendor_phone,
      vendor_email: a.vendor_email,
      city: a.city,
      address: a.address,
      assignedDate: a.assigned_at,
      status: a.is_active ? 'active' : 'removed'
    }));

    console.log('[Vendor Assignments] Found:', propertyAssignments.length, 'assignments');
    
    res.json({
      success: true,
      data: {
        propertyAssignments,
        serviceAssignments
      }
    });
  } catch (error) {
    console.error('Get vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

// Update vendor assignment (change vendor)
router.put('/vendors/assignments/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, vendor_id } = req.body;
    const newVendorId = vendorId || vendor_id;

    if (!newVendorId) {
      return res.status(400).json({ success: false, message: 'Vendor ID is required' });
    }

    // Verify assignment belongs to FP's property
    const [assignment] = await pool.execute(
      `SELECT pva.id, pva.property_id FROM property_vendor_assignments pva
       JOIN properties p ON pva.property_id = p.id
       WHERE pva.id = ? AND p.franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (assignment.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Verify new vendor belongs to this FP
    const [vendor] = await pool.execute(
      `SELECT id FROM onboarded_vendors WHERE id = ? AND franchise_partner_id = ?`,
      [newVendorId, req.fpId]
    );

    if (vendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Update the assignment
    await pool.execute(
      `UPDATE property_vendor_assignments SET vendor_id = ?, assigned_at = NOW() WHERE id = ?`,
      [newVendorId, id]
    );

    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update assignment', error: error.message });
  }
});

// Remove vendor assignment
router.delete('/vendors/assignments/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify assignment belongs to FP's property
    const [assignment] = await pool.execute(
      `SELECT pva.id FROM property_vendor_assignments pva
       JOIN properties p ON pva.property_id = p.id
       WHERE pva.id = ? AND p.franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (assignment.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 0 WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove assignment', error: error.message });
  }
});

// Create vendor (uses onboarded_vendors table)
router.post('/vendors', requireFPScope, async (req, res) => {
  try {
    const {
      serviceType, serviceVerified, zone, areaName, division,
      ownerName, ownerMobile, ownerEmail, ownerAadhar, ownerCountryCode,
      managerName, managerMobile, managerEmail, managerCountryCode,
      pocName, pocMobile, pocEmail, pocCountryCode,
      ratePerVisit, coveragePerDay,
      gstNumber, panNumber, licenseNumber
    } = req.body;

    const vendorId = `VND-${Date.now()}`;
    const username = ownerEmail ? ownerEmail.split('@')[0] + '_' + Date.now() : `vendor_${Date.now()}`;
    const tempPassword = await bcrypt.hash('temp123', 10);

    const creatorName = req.user.name || req.user.username || req.user.full_name || 'Franchise Partner';
    
    const [result] = await pool.execute(
      `INSERT INTO onboarded_vendors (
        vendor_id, username, password_hash,
        service_type, service_verified, zone, area_name, division,
        owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
        manager_name, manager_mobile, manager_email, manager_country_code,
        poc_name, poc_mobile, poc_email, poc_country_code,
        gst_number, pan_number, license_number,
        rate_per_visit, coverage_per_day,
        franchise_partner_id, created_by, created_by_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        vendorId, username, tempPassword,
        serviceType || '', serviceVerified ? 1 : 0, zone || '', areaName || '', division || '',
        ownerName || '', ownerMobile || '', ownerEmail || '', ownerAadhar || '', ownerCountryCode || '+91',
        managerName || '', managerMobile || '', managerEmail || '', managerCountryCode || '+91',
        pocName || '', pocMobile || '', pocEmail || '', pocCountryCode || '+91',
        gstNumber || '', panNumber || '', licenseNumber || '',
        parseFloat(ratePerVisit) || 0, parseInt(coveragePerDay) || 0,
        req.fpId, creatorName, req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: { id: result.insertId, vendorId }
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create vendor',
      error: error.message
    });
  }
});

// Update/Modify vendor (uses onboarded_vendors table)
router.put('/vendors/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Verify vendor exists in onboarded_vendors
    const [existing] = await pool.execute(
      'SELECT id FROM onboarded_vendors WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or access denied'
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];

    const fields = {
      service_type: body.service_type || body.serviceType,
      service_verified: body.service_verified !== undefined ? body.service_verified : body.serviceVerified,
      zone: body.zone || body.zone_name,
      area_name: body.area_name || body.areaName || body.area,
      division: body.division,
      rate_per_visit: body.rate_per_visit || body.ratePerVisit,
      coverage_per_day: body.coverage_per_day || body.coveragePerDay,
      owner_name: body.owner_name || body.ownerName,
      owner_mobile: body.owner_mobile || body.ownerMobile,
      owner_email: body.owner_email || body.ownerEmail,
      owner_aadhar: body.owner_aadhar || body.ownerAadhar,
      manager_name: body.manager_name || body.managerName,
      manager_mobile: body.manager_mobile || body.managerMobile,
      manager_email: body.manager_email || body.managerEmail,
      poc_name: body.poc_name || body.pocName,
      poc_mobile: body.poc_mobile || body.pocMobile,
      poc_email: body.poc_email || body.pocEmail,
      gst_number: body.gst_number || body.gstNumber,
      pan_number: body.pan_number || body.panNumber,
      license_number: body.license_number || body.licenseNumber
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE onboarded_vendors SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Vendor updated successfully'
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vendor',
      error: error.message
    });
  }
});

// Delete vendor (soft delete)
router.delete('/vendors/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify vendor belongs to this FP
    const [existing] = await pool.execute(
      'SELECT id FROM onboarded_vendors WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or access denied'
      });
    }

    // Soft delete - set is_active to 0
    await pool.execute(
      `UPDATE onboarded_vendors SET is_active = 0, status = 'inactive', updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vendor',
      error: error.message
    });
  }
});

// Restore vendor (set is_active back to 1)
router.put('/vendors/:id/restore', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify vendor belongs to this FP
    const [existing] = await pool.execute(
      'SELECT id FROM onboarded_vendors WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found or access denied'
      });
    }

    await pool.execute(
      `UPDATE onboarded_vendors SET is_active = 1, status = 'active', updated_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    res.json({
      success: true,
      message: 'Vendor restored successfully'
    });
  } catch (error) {
    console.error('Restore vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore vendor',
      error: error.message
    });
  }
});

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

// Get all FP employees
router.get('/employees', requireFPScope, async (req, res) => {
  try {
    console.log('Fetching FP employees for FP ID:', req.fpId);
    
    // Get employees first
    const [employees] = await pool.execute(
      `SELECT e.*, CONCAT(e.first_name, ' ', e.last_name) as name
       FROM fp_employees e
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       ORDER BY e.created_at DESC`,
      [req.fpId]
    );

    // Get zone assignments separately
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?`,
      [req.fpId]
    );

    // Build a map of employee zones
    const employeeZonesMap = {};
    zoneAssignments.forEach(za => {
      if (!employeeZonesMap[za.fp_employee_id]) {
        employeeZonesMap[za.fp_employee_id] = [];
      }
      if (za.zone_name) {
        employeeZonesMap[za.fp_employee_id].push(za.zone_name);
      }
    });

    // Transform employees with their zones
    const transformedEmployees = employees.map(emp => ({
      ...emp,
      assigned_zones: employeeZonesMap[emp.id] || []
    }));

    console.log('Employees found:', transformedEmployees.length);

    res.json({
      success: true,
      data: transformedEmployees
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// Helper function to generate temporary password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper function to generate GLOBAL SEQUENTIAL user ID
// All FP-created staff share the same sequence as Admin-created staff (001, 002, 003...)
const generateUserId = async (role) => {
  const employeeRoles = ['manager', 'coordinator', 'supervisor', 'executive'];
  const isEmployee = employeeRoles.includes(role);
  
  try {
    if (isEmployee) {
      // For employees: Generate numeric-only ID (001, 002, 003...) - GLOBAL sequence
      const [rows] = await pool.execute(
        `SELECT user_id FROM users 
         WHERE role IN ('manager', 'coordinator', 'supervisor', 'executive') 
         AND user_id REGEXP '^[0-9]+$'
         ORDER BY CAST(user_id AS UNSIGNED) DESC LIMIT 1`
      );
      
      let nextSequence = 1;
      if (rows.length > 0) {
        const existingId = rows[0].user_id;
        const numericPart = parseInt(existingId, 10);
        if (!isNaN(numericPart)) {
          nextSequence = numericPart + 1;
        }
      }
      
      // Format with leading zeros (3 digits minimum)
      return String(nextSequence).padStart(3, '0');
    }
    
    // For non-employees: Use FPE prefix
    const prefix = 'FPE';
    const [rows] = await pool.execute(
      `SELECT user_id FROM users WHERE user_id LIKE ? ORDER BY user_id DESC LIMIT 1`,
      [`${prefix}%`]
    );
    
    let nextSequence = 1;
    if (rows.length > 0) {
      const existingId = rows[0].user_id;
      const numericPart = parseInt(existingId.replace(prefix, ''), 10);
      if (!isNaN(numericPart)) {
        nextSequence = numericPart + 1;
      }
    }
    
    return `${prefix}${String(nextSequence).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating user ID:', error);
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return isEmployee ? `${Date.now() % 100000}` : `FPE-${timestamp}${random}`;
  }
};

// Create employee with full onboarding (user account + email)
router.post('/employees', requireFPScope, async (req, res) => {
  try {
    const {
      name, email, phone, countryCode, aadhaar, role, assignedZones, username: providedUsername
    } = req.body;

    // Validate required email field
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required for employee account creation',
        field: 'email'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        field: 'email'
      });
    }

    // Check if email already exists in users table
    const [existingUser] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
        field: 'email'
      });
    }

    // Check if email exists in fp_employees table
    const [existingEmployee] = await pool.execute(
      'SELECT id FROM fp_employees WHERE email = ? AND franchise_partner_id = ?',
      [email.trim().toLowerCase(), req.fpId]
    );

    if (existingEmployee.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An employee with this email already exists',
        field: 'email'
      });
    }

    // Parse name into first and last name
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate sequential employee code (EMP-001, EMP-002, EMP-003...)
    const [maxEmpCode] = await pool.execute(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ?`,
      [req.fpId]
    );
    const nextSeq = (maxEmpCode[0].count || 0) + 1;
    const employeeCode = `EMP-${String(nextSeq).padStart(3, '0')}`;
    
    const userId = await generateUserId(role || 'executive');  // Global sequential ID
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Use provided username or generate from email (part before @)
    const username = providedUsername?.trim() || (email.trim().toLowerCase().split('@')[0] + '_' + Date.now().toString(36));

    // Get FP company name for email
    const [fpData] = await pool.execute(
      'SELECT company_name FROM franchise_partners WHERE id = ?',
      [req.fpId]
    );
    const companyName = fpData.length > 0 ? fpData[0].company_name : 'Franchise Partner';

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Map FP role to user role
      const userRole = role === 'manager' ? 'manager' :
                       role === 'supervisor' ? 'supervisor' : 
                       role === 'coordinator' ? 'coordinator' : 
                       role === 'executive' ? 'executive' : 'fp_executive';

      // 1. Create user account in users table with must_change_password flag
      const [userResult] = await connection.execute(
        `INSERT INTO users (
          user_id, username, email, password_hash, first_name, last_name, phone, 
          role, franchise_partner_id, must_change_password, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?)`,
        [
          userId, 
          username, 
          email.trim().toLowerCase(), 
          passwordHash, 
          firstName, 
          lastName, 
          phone || null,
          userRole,
          req.fpId,
          req.user.id
        ]
      );

      // 2. Create fp_employees record
      const [empResult] = await connection.execute(
        `INSERT INTO fp_employees (
          franchise_partner_id, employee_code, first_name, last_name, email, phone, 
          country_code, aadhaar, role, username, password_hash, user_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          req.fpId, 
          employeeCode, 
          firstName, 
          lastName, 
          email.trim().toLowerCase(), 
          phone || null,
          countryCode || '+91',
          aadhaar || null,
          role || 'fp_executive',
          username,
          passwordHash,
          userResult.insertId
        ]
      );

      // 3. Assign zones if provided (store zone names directly)
      if (assignedZones && assignedZones.length > 0) {
        for (const zoneName of assignedZones) {
          await connection.execute(
            `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name)
             VALUES (?, ?, ?)`,
            [req.fpId, empResult.insertId, zoneName]
          );
        }
      }

      await connection.commit();
      connection.release();

      // 4. Send welcome email with temporary password and login instructions
      const portalUrl = process.env.ADMIN_PORTAL_URL || 'http://localhost:5174';
      const emailResult = await sendFPEmployeeWelcomeEmail({
        email: email.trim().toLowerCase(),
        firstName,
        lastName,
        username,
        userId,
        tempPassword,
        companyName,
        role: role || 'fp_executive',
        loginUrl: portalUrl
      });

      res.status(201).json({
        success: true,
        message: 'Employee account created successfully. Login credentials have been sent to the employee\'s email.',
        data: { 
          id: empResult.insertId, 
          employeeId: employeeCode,
          userId: userId,
          email: email.trim().toLowerCase(),
          emailSent: emailResult.success,
          emailMessage: emailResult.success 
            ? 'Welcome email sent successfully with login instructions'
            : 'Account created but email delivery failed. Please share credentials manually.'
        }
      });
    } catch (dbError) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Create employee error:', error);
    
    // Handle duplicate entry errors
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.message.includes('email')) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists',
          field: 'email'
        });
      }
      if (error.message.includes('username')) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists. Please try again.',
          field: 'email'
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create employee account',
      error: error.message
    });
  }
});

// Get single employee for editing
router.get('/employees/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const [employees] = await pool.execute(
      `SELECT e.*, CONCAT(e.first_name, ' ', e.last_name) as name
       FROM fp_employees e
       WHERE e.id = ? AND e.franchise_partner_id = ?`,
      [id, req.fpId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    res.json({ success: true, data: employees[0] });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee details
router.put('/employees/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phone, countryCode, aadhaar, role } = req.body;
    
    // Verify employee belongs to this FP and get current details
    const [existing] = await pool.execute(
      'SELECT id, user_id, email as current_email, first_name, last_name, employee_code, username FROM fp_employees WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    const currentEmployee = existing[0];
    const isEmailChanged = email && email.toLowerCase() !== (currentEmployee.current_email || '').toLowerCase();
    let tempPassword = null;
    
    // If email is changed, generate new temp password
    if (isEmailChanged) {
      tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      
      // Update fp_employees table with new email and password
      await pool.execute(
        `UPDATE fp_employees SET 
          first_name = ?, last_name = ?, email = ?, phone = ?, 
          country_code = ?, aadhaar = ?, role = ?, password_hash = ?, 
          visible_password = ?, must_change_password = TRUE, updated_at = NOW()
         WHERE id = ? AND franchise_partner_id = ?`,
        [firstName, lastName, email, phone, countryCode || '+91', aadhaar || null, role || 'field_staff', passwordHash, tempPassword, id, req.fpId]
      );
      
      // Also update linked user account if exists
      if (currentEmployee.user_id) {
        await pool.execute(
          `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, 
           password_hash = ?, visible_password = ?, must_change_password = TRUE,
           username = ? WHERE id = ?`,
          [firstName, lastName, email, phone, passwordHash, tempPassword, email, currentEmployee.user_id]
        );
      }
      
      // Send activation email to NEW email
      try {
        await sendFPEmployeeWelcomeEmail({
          email: email,
          firstName: firstName || currentEmployee.first_name,
          lastName: lastName || currentEmployee.last_name || '',
          employeeCode: currentEmployee.employee_code,
          username: email,
          tempPassword: tempPassword,
          role: role || 'field_staff'
        });
        console.log(`📧 Account activation email sent to new email: ${email} (changed from ${currentEmployee.current_email})`);
      } catch (emailError) {
        console.error('Failed to send activation email to new email:', emailError);
      }
      
      res.json({ 
        success: true, 
        message: `Email changed successfully. Activation email sent to ${email}. The old email no longer has access.` 
      });
      return;
    }
    
    // Normal update without email change
    await pool.execute(
      `UPDATE fp_employees SET 
        first_name = ?, last_name = ?, email = ?, phone = ?, 
        country_code = ?, aadhaar = ?, role = ?, updated_at = NOW()
       WHERE id = ? AND franchise_partner_id = ?`,
      [firstName, lastName, email, phone, countryCode || '+91', aadhaar || null, role || 'field_staff', id, req.fpId]
    );
    
    // Also update linked user account if exists
    if (currentEmployee.user_id) {
      await pool.execute(
        `UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?`,
        [firstName, lastName, email, phone, currentEmployee.user_id]
      );
    }
    
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee status (activate/deactivate)
router.put('/employees/:id/status', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isActive = status === 'active' ? 1 : 0;
    
    // Get employee to find linked user_id
    const [employees] = await pool.execute(
      `SELECT user_id FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Update fp_employees table
    await pool.execute(
      `UPDATE fp_employees SET status = ?, is_active = ? WHERE id = ? AND franchise_partner_id = ?`,
      [status, isActive, id, req.fpId]
    );

    // Also update linked user account if exists
    if (employees[0].user_id) {
      await pool.execute(
        `UPDATE users SET is_active = ? WHERE id = ?`,
        [isActive, employees[0].user_id]
      );
    }
    
    res.json({ 
      success: true, 
      message: status === 'active' ? 'Employee account activated' : 'Employee account deactivated'
    });
  } catch (error) {
    console.error('Update employee status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete employee
router.delete('/employees/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get employee to find linked user_id
    const [employees] = await pool.execute(
      `SELECT user_id, first_name, last_name FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (employees.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = employees[0];
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete zone assignments first
      await connection.execute(
        `DELETE FROM fp_employee_zones WHERE fp_employee_id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );

      // Delete from fp_employees table
      await connection.execute(
        `DELETE FROM fp_employees WHERE id = ? AND franchise_partner_id = ?`,
        [id, req.fpId]
      );

      // Also delete linked user account if exists
      if (employee.user_id) {
        await connection.execute(
          `DELETE FROM users WHERE id = ?`,
          [employee.user_id]
        );
      }

      await connection.commit();
      connection.release();

      res.json({ 
        success: true, 
        message: `Employee ${employee.first_name} ${employee.last_name} has been permanently deleted`
      });
    } catch (dbError) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee zones
router.put('/employees/:id/zones', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { zones } = req.body;
    
    console.log('Updating zones for employee:', id, 'FP:', req.fpId, 'Zones:', zones);
    
    // Delete existing zone assignments
    await pool.execute(
      `DELETE FROM fp_employee_zones WHERE fp_employee_id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );
    
    // Insert new zone assignments - store zone names directly since zones can come from multiple sources
    if (zones && zones.length > 0) {
      for (const zoneName of zones) {
        // Store zone name directly in the assignment table
        await pool.execute(
          `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name) VALUES (?, ?, ?)`,
          [req.fpId, id, zoneName]
        );
        console.log('Inserted zone assignment:', { fpId: req.fpId, empId: id, zoneName });
      }
    }
    
    res.json({ success: true, message: 'Employee zones updated' });
  } catch (error) {
    console.error('Update employee zones error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// STAFF MANAGEMENT (FP Portal Staff - Manager, Coordinator, Supervisor, Executive)
// ============================================

// FP Staff Roles (allowed roles for FP to create)
const FP_STAFF_ROLES = {
  manager: {
    label: 'Manager',
    description: 'Manages work orders, vendors, estimates, and schedules'
  },
  coordinator: {
    label: 'Coordinator',
    description: 'Manages assigned properties, work orders, and field operations'
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Creates work order requests and tracks progress'
  },
  executive: {
    label: 'Executive',
    description: 'Basic data collection - Adds client and vendor details'
  }
};

// Helper function to generate staff user ID - uses global sequential IDs
// Reuses generateUserId for consistency
const generateStaffUserId = async (role) => {
  return await generateUserId(role);
};

// Helper function to generate staff temp password
const generateStaffTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Get all FP staff members
router.get('/staff', requireFPScope, async (req, res) => {
  try {
    const { role, isActive } = req.query;
    
    let query = `
      SELECT u.id, u.user_id, u.username, u.email, u.first_name, u.last_name, 
             u.phone, u.role, u.is_active, u.created_at, u.last_login,
             u.must_change_password,
             CONCAT(c.first_name, ' ', c.last_name) as created_by_name
      FROM users u
      LEFT JOIN users c ON u.created_by = c.id
      WHERE u.franchise_partner_id = ?
      AND u.role IN ('manager', 'coordinator', 'supervisor', 'executive')
    `;
    const params = [req.fpId];

    if (role && FP_STAFF_ROLES[role]) {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ` AND u.is_active = ?`;
      params.push(isActive === 'true');
    }

    query += ` ORDER BY u.created_at DESC`;

    const [staff] = await pool.execute(query, params);

    // Format the response similar to admin UserManagement
    const formattedStaff = staff.map(s => ({
      id: s.id,
      userId: s.user_id,
      username: s.username,
      email: s.email,
      firstName: s.first_name,
      lastName: s.last_name,
      phone: s.phone,
      role: s.role,
      roleName: FP_STAFF_ROLES[s.role]?.label || s.role,
      isActive: s.is_active === 1 || s.is_active === true,
      lastLogin: s.last_login,
      createdBy: s.created_by_name,
      createdAt: s.created_at,
      mustChangePassword: s.must_change_password
    }));

    res.json({
      success: true,
      data: formattedStaff
    });
  } catch (error) {
    console.error('Get FP staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members',
      error: error.message
    });
  }
});

// Get single FP staff member
router.get('/staff/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    const [staff] = await pool.execute(
      `SELECT u.*, CONCAT(c.first_name, ' ', c.last_name) as created_by_name
       FROM users u
       LEFT JOIN users c ON u.created_by = c.id
       WHERE u.id = ? AND u.franchise_partner_id = ?
       AND u.role IN ('manager', 'coordinator', 'supervisor', 'executive')`,
      [id, req.fpId]
    );

    if (staff.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const s = staff[0];
    res.json({
      success: true,
      data: {
        id: s.id,
        userId: s.user_id,
        username: s.username,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        phone: s.phone,
        role: s.role,
        roleName: FP_STAFF_ROLES[s.role]?.label || s.role,
        isActive: s.is_active === 1 || s.is_active === true,
        lastLogin: s.last_login,
        createdBy: s.created_by_name,
        createdAt: s.created_at
      }
    });
  } catch (error) {
    console.error('Get FP staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff member',
      error: error.message
    });
  }
});

// Create FP staff member with auto-generated password and email notification
router.post('/staff', requireFPScope, async (req, res) => {
  try {
    const { username, email, firstName, lastName, phone, role, sendEmail = true } = req.body;

    // Validation
    if (!username || !email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, first name, last name, and role are required'
      });
    }

    // Validate role - only allow FP staff roles
    if (!FP_STAFF_ROLES[role]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: manager, coordinator, supervisor, executive'
      });
    }

    // Check if username or email already exists
    const [existing] = await pool.execute(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username, email.toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Generate unique User ID (global sequential) and temporary password
    const userId = await generateStaffUserId(role);
    const tempPassword = generateStaffTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Insert new staff member
    const [result] = await pool.execute(
      `INSERT INTO users (
        user_id, username, email, password_hash, first_name, last_name, phone, role,
        franchise_partner_id, must_change_password, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?)`,
      [
        userId, username, email.toLowerCase(), passwordHash, 
        firstName, lastName, phone || null, role,
        req.fpId, req.user.id
      ]
    );

    // Get FP company name for email
    let companyName = 'Franchise Partner';
    try {
      const [fpData] = await pool.execute(
        'SELECT company_name FROM franchise_partners WHERE id = ?',
        [req.fpId]
      );
      if (fpData.length > 0) {
        companyName = fpData[0].company_name;
      }
    } catch (e) {
      console.log('Could not fetch FP company name');
    }

    // Send welcome email with temporary password
    let emailSent = false;
    if (sendEmail) {
      try {
        const emailResult = await sendFPEmployeeWelcomeEmail({
          email: email.toLowerCase(),
          firstName,
          lastName,
          username,
          userId,
          tempPassword,
          companyName,
          role,
          loginUrl: process.env.ADMIN_PORTAL_URL || 'http://localhost:5174'
        });
        emailSent = emailResult.success;
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Staff member created successfully. Welcome email sent with login credentials.' 
        : 'Staff member created successfully. Email notification could not be sent.',
      data: {
        id: result.insertId,
        userId,
        username,
        email: email.toLowerCase(),
        role,
        roleName: FP_STAFF_ROLES[role].label,
        emailSent
      }
    });
  } catch (error) {
    console.error('Create FP staff error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create staff member',
      error: error.message
    });
  }
});

// Update FP staff member
router.put('/staff/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, firstName, lastName, phone, role, isActive } = req.body;

    // Check if staff exists and belongs to this FP
    const [existing] = await pool.execute(
      `SELECT id, role FROM users WHERE id = ? AND franchise_partner_id = ?
       AND role IN ('manager', 'coordinator', 'supervisor', 'executive')`,
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Check for duplicate username/email
    if (username || email) {
      const [duplicates] = await pool.execute(
        `SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?`,
        [username || '', email || '', id]
      );

      if (duplicates.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists'
        });
      }
    }

    // Validate role if changing
    if (role && !FP_STAFF_ROLES[role]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: manager, coordinator, supervisor, executive'
      });
    }

    // Build update query
    let updateFields = [];
    let params = [];

    if (username) { updateFields.push('username = ?'); params.push(username); }
    if (email) { updateFields.push('email = ?'); params.push(email.toLowerCase()); }
    if (firstName) { updateFields.push('first_name = ?'); params.push(firstName); }
    if (lastName) { updateFields.push('last_name = ?'); params.push(lastName); }
    if (phone !== undefined) { updateFields.push('phone = ?'); params.push(phone); }
    if (role) { updateFields.push('role = ?'); params.push(role); }
    if (isActive !== undefined) { updateFields.push('is_active = ?'); params.push(isActive); }

    // Update password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
      updateFields.push('must_change_password = FALSE');
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateFields.push('updated_at = NOW()');
    params.push(id, req.fpId);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND franchise_partner_id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Staff member updated successfully'
    });
  } catch (error) {
    console.error('Update FP staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member',
      error: error.message
    });
  }
});

// Delete FP staff member
router.delete('/staff/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if staff exists and belongs to this FP
    const [existing] = await pool.execute(
      `SELECT id, email, role FROM users WHERE id = ? AND franchise_partner_id = ?
       AND role IN ('manager', 'coordinator', 'supervisor', 'executive')`,
      [id, req.fpId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Permanently delete the staff member
    const [result] = await pool.execute(
      `DELETE FROM users WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    console.log(`🗑️ FP Staff permanently deleted: ID ${id}, Email: ${existing[0].email}, FP: ${req.fpId}`);

    res.json({
      success: true,
      message: 'Staff member permanently deleted successfully'
    });
  } catch (error) {
    console.error('Delete FP staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member',
      error: error.message
    });
  }
});

// Get FP staff roles list
router.get('/staff-roles', requireFPScope, async (req, res) => {
  try {
    const roles = Object.entries(FP_STAFF_ROLES).map(([key, value]) => ({
      value: key,
      label: value.label,
      description: value.description
    }));

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching roles',
      error: error.message
    });
  }
});

// ============================================
// LEGACY USER MANAGEMENT (FP Portal Users - fp_users table)
// ============================================

// Get all FP users (legacy)
router.get('/users', requireFPScope, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, username, email, first_name, last_name, phone, role, is_active, created_at, last_login
       FROM fp_users
       WHERE franchise_partner_id = ?
       ORDER BY created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Create FP user (legacy)
router.post('/users', requireFPScope, async (req, res) => {
  try {
    const {
      username, email, password, firstName, lastName, phone, role
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO fp_users (
        franchise_partner_id, username, email, password_hash, first_name, last_name, phone, role, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.fpId, username, email, hashedPassword, firstName, lastName, phone, role || 'fp_executive', req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
});

// ============================================
// ESTIMATES & AMC MANAGEMENT
// ============================================

// Get all FP estimates
router.get('/estimates', requireFPScope, async (req, res) => {
  try {
    const { status, archived } = req.query;

    // First ensure the fp_estimates table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS fp_estimates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        estimate_id VARCHAR(50) UNIQUE NOT NULL,
        franchise_partner_id INT NOT NULL,
        property_id INT,
        estimate_type VARCHAR(50) DEFAULT 'property_based',
        client_name VARCHAR(255),
        client_phone VARCHAR(50),
        client_email VARCHAR(255),
        property_name VARCHAR(255),
        property_code VARCHAR(50),
        property_type VARCHAR(50),
        zone VARCHAR(100),
        division VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        number_of_blocks INT DEFAULT 1,
        units_per_block JSON,
        block_names JSON,
        total_units INT DEFAULT 0,
        tower_name VARCHAR(255),
        block_number VARCHAR(100),
        villa_plot_number VARCHAR(100),
        package_id INT,
        package_name VARCHAR(255),
        package_price DECIMAL(12,2) DEFAULT 0.00,
        amc_package_description TEXT,
        package_services TEXT,
        subtotal DECIMAL(12,2) DEFAULT 0.00,
        discount_percent DECIMAL(5,2) DEFAULT 0.00,
        discount_amount DECIMAL(12,2) DEFAULT 0.00,
        gst_percent DECIMAL(5,2) DEFAULT 0.00,
        gst_amount DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        addons_data JSON,
        description TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        valid_until DATE,
        action_token VARCHAR(100),
        sent_at TIMESTAMP NULL,
        created_by_id INT,
        created_by_name VARCHAR(255),
        created_by_role VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMP NULL
      )
    `);

    // Add missing columns if they don't exist (MySQL compatible)
    const columnsToAdd = [
      { name: 'action_token', def: 'VARCHAR(100)' },
      { name: 'sent_at', def: 'TIMESTAMP NULL' },
      { name: 'division', def: 'VARCHAR(100)' },
      { name: 'number_of_blocks', def: 'INT DEFAULT 1' },
      { name: 'units_per_block', def: 'JSON' },
      { name: 'block_names', def: 'JSON' },
      { name: 'total_units', def: 'INT DEFAULT 0' },
      { name: 'tower_name', def: 'VARCHAR(255)' },
      { name: 'block_number', def: 'VARCHAR(100)' },
      { name: 'villa_plot_number', def: 'VARCHAR(100)' },
      { name: 'amc_package_description', def: 'TEXT' },
      { name: 'package_services', def: 'TEXT' }
    ];
    for (const col of columnsToAdd) {
      try {
        const [cols] = await pool.execute(`SHOW COLUMNS FROM fp_estimates LIKE ?`, [col.name]);
        if (cols.length === 0) {
          await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN ${col.name} ${col.def}`);
        }
      } catch (e) { /* ignore */ }
    }

    let query = `SELECT fe.*, 
                        COALESCE(fpamc.services) as packageServices,
                        COALESCE(fe.amc_package_description, fpamc.description) as amc_package_description
                 FROM fp_estimates fe 
                 LEFT JOIN fp_amc_packages fpamc ON fe.package_id = fpamc.id
                 WHERE fe.franchise_partner_id = ?`;
    const params = [req.fpId];

    if (status) {
      query += ' AND fe.status = ?';
      params.push(status);
    }

    if (archived === 'true') {
      query += ' AND fe.is_archived = 1';
    } else {
      query += ' AND (fe.is_archived = 0 OR fe.is_archived IS NULL)';
    }

    query += ' ORDER BY fe.created_at DESC';

    const [estimates] = await pool.execute(query, params);

    // Get FP's name to use for estimates with email as creator name
    let fpContactName = 'Franchise Partner';
    try {
      const [[fpInfo]] = await pool.execute(
        'SELECT owner_name, company_name, username FROM franchise_partners WHERE id = ?',
        [req.fpId]
      );
      if (fpInfo) {
        fpContactName = fpInfo.owner_name || fpInfo.company_name || fpInfo.username || 'Franchise Partner';
      }
    } catch (e) {}

    // Get all FP addons for description lookup
    let fpAddons = [];
    try {
      const [addonResults] = await pool.execute(
        `SELECT id, service_name, description FROM fp_addons WHERE franchise_partner_id = ?`,
        [req.fpId]
      );
      fpAddons = addonResults;
    } catch (e) {}

    // Parse addons_data JSON and fix creator name if it's an email
    const enrichedEstimates = await Promise.all(estimates.map(async (est) => {
      let addons = [];
      console.log('Estimate', est.estimate_id, 'addons_data:', est.addons_data);
      if (est.addons_data) {
        try {
          addons = typeof est.addons_data === 'string' ? JSON.parse(est.addons_data) : est.addons_data;
          console.log('Parsed addons for', est.estimate_id, ':', addons);
          // Enrich addons with descriptions from fp_addons if not already present
          addons = addons.map(addon => {
            if (!addon.description) {
              const addonName = addon.name || addon.serviceName || addon.service_name || '';
              const addonId = addon.id || addon.addon_id;
              const foundAddon = fpAddons.find(a => 
                a.id == addonId || 
                a.service_name === addonName ||
                a.service_name.toLowerCase() === addonName.toLowerCase()
              );
              if (foundAddon && foundAddon.description) {
                addon.description = foundAddon.description;
                console.log('Enriched addon', addonName, 'with description:', foundAddon.description);
              }
            }
            return addon;
          });
        } catch (e) { console.log('Error parsing addons:', e.message); }
      }
      // If created_by_name looks like an email, replace with FP contact name
      let creatorName = est.created_by_name;
      if (creatorName && creatorName.includes('@')) {
        creatorName = fpContactName;
      }
      
      // If division or property_code is missing, try to fetch from property tables
      let division = est.division;
      let property_code = est.property_code;
      const propName = est.property_name || '';
      
      if ((!division || !property_code) && propName) {
        try {
          // Try properties table first
          let [props] = await pool.execute(
            `SELECT property_id as property_code, division_id as division FROM properties 
             WHERE name = ? AND franchise_partner_id = ? LIMIT 1`,
            [propName, req.fpId]
          );
          if (props.length > 0) {
            if (!division && props[0].division) division = props[0].division;
            if (!property_code && props[0].property_code) property_code = props[0].property_code;
          }
          
          // If still not found, try onboarded_properties
          if (!division || !property_code) {
            [props] = await pool.execute(
              `SELECT property_id as property_code, division FROM onboarded_properties 
               WHERE community_name = ? AND franchise_partner_id = ? LIMIT 1`,
              [propName, req.fpId]
            );
            if (props.length > 0) {
              if (!division && props[0].division) division = props[0].division;
              if (!property_code && props[0].property_code) property_code = props[0].property_code;
            }
          }
        } catch (e) { 
          console.log('Property lookup error:', e.message);
        }
      }
      
      return { ...est, addons, created_by_name: creatorName, division, property_code };
    }));

    res.json({ success: true, data: enrichedEstimates });
  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates', error: error.message });
  }
});

// Create estimate
router.post('/estimates', requireFPScope, async (req, res) => {
  try {
    const {
      estimate_type, property_id, property_code, client_name, client_phone, client_email,
      property_type, property_name, zone, division, city, address,
      number_of_blocks, units_per_block, block_names, total_units,
      tower_name, block_number, villa_plot_number,
      package_id, package_name, package_price, amc_package_description, package_services,
      addons, subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
      description
    } = req.body;
    
    console.log('Creating estimate with division:', division, 'property_code:', property_code);

    // Ensure fp_estimates table exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS fp_estimates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        estimate_id VARCHAR(50) UNIQUE NOT NULL,
        franchise_partner_id INT NOT NULL,
        property_id INT,
        estimate_type VARCHAR(50) DEFAULT 'property_based',
        client_name VARCHAR(255),
        client_phone VARCHAR(50),
        client_email VARCHAR(255),
        property_name VARCHAR(255),
        property_code VARCHAR(50),
        property_type VARCHAR(50),
        zone VARCHAR(100),
        division VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        number_of_blocks INT DEFAULT 1,
        units_per_block JSON,
        block_names JSON,
        total_units INT DEFAULT 0,
        tower_name VARCHAR(255),
        block_number VARCHAR(100),
        villa_plot_number VARCHAR(100),
        package_id INT,
        package_name VARCHAR(255),
        package_price DECIMAL(12,2) DEFAULT 0.00,
        subtotal DECIMAL(12,2) DEFAULT 0.00,
        discount_percent DECIMAL(5,2) DEFAULT 0.00,
        discount_amount DECIMAL(12,2) DEFAULT 0.00,
        gst_percent DECIMAL(5,2) DEFAULT 0.00,
        gst_amount DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        addons_data JSON,
        description TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        valid_until DATE,
        action_token VARCHAR(100),
        sent_at TIMESTAMP NULL,
        created_by_id INT,
        created_by_name VARCHAR(255),
        created_by_role VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE,
        archived_at TIMESTAMP NULL
      )
    `);

    const estimateId = `EST-${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Get creator info - fetch FP name from database
    let creatorName = 'Franchise Partner';
    let creatorRole = req.user?.role || 'franchise_partner';
    let creatorId = req.user?.id || null;
    
    // Try to get the FP's name from the database
    try {
      const [[fpInfo]] = await pool.execute(
        'SELECT owner_name, company_name, username FROM franchise_partners WHERE id = ?',
        [req.fpId]
      );
      if (fpInfo) {
        creatorName = fpInfo.owner_name || fpInfo.company_name || fpInfo.username || 'Franchise Partner';
      }
    } catch (e) {
      console.log('Could not fetch FP name:', e.message);
    }
    
    // For FP employees (manager, coordinator, etc), use their name
    if (req.user?.first_name || req.user?.name) {
      creatorName = req.user?.first_name && req.user?.last_name 
        ? `${req.user.first_name} ${req.user.last_name}`.trim()
        : req.user?.name || creatorName;
    }
    
    // Helper to safely parse numbers (handles NaN, null, undefined, empty string)
    const safeNum = (val, def = 0) => {
      if (val === undefined || val === null || val === '') return def;
      const num = parseFloat(val);
      return isNaN(num) ? def : num;
    };
    
    // Calculate amounts - use safeNum to handle all edge cases
    const finalSubtotal = safeNum(subtotal, 0);
    const finalGstPercent = safeNum(gst_percent, 0);
    const finalGstAmount = safeNum(gst_amount, finalSubtotal * finalGstPercent / 100);
    const finalDiscountPercent = safeNum(discount_percent, 0);
    const finalDiscountAmount = safeNum(discount_amount, finalSubtotal * finalDiscountPercent / 100);
    const finalTotal = safeNum(total_amount, finalSubtotal - finalDiscountAmount + finalGstAmount);

    // Stringify addons for storage
    console.log('Received addons:', addons);
    const addonsJson = addons && addons.length > 0 ? JSON.stringify(addons) : null;
    console.log('Stringified addons:', addonsJson);
    
    // Stringify block data for storage
    const unitsPerBlockJson = units_per_block ? JSON.stringify(units_per_block) : null;
    const blockNamesJson = block_names ? JSON.stringify(block_names) : null;
    
    console.log('Creating FP estimate:', { estimateId, client_name, package_name, creatorName, fpId: req.fpId });

    // Add new columns if they don't exist
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN tower_name VARCHAR(255)`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN block_number VARCHAR(100)`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN villa_plot_number VARCHAR(100)`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN amc_package_description TEXT`);
    } catch (e) { /* Column exists */ }
    try {
      await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN package_services TEXT`);
    } catch (e) { /* Column exists */ }

    // Stringify package_services for storage
    const packageServicesJson = package_services ? JSON.stringify(package_services) : null;

    // Insert into fp_estimates table (no FK constraints)
    const [result] = await pool.execute(
      `INSERT INTO fp_estimates (
        estimate_id, franchise_partner_id, property_id, estimate_type,
        client_name, client_phone, client_email,
        property_name, property_code, property_type, zone, division, city, address,
        number_of_blocks, units_per_block, block_names, total_units,
        tower_name, block_number, villa_plot_number,
        package_id, package_name, package_price, amc_package_description, package_services,
        subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
        addons_data, description, status,
        created_by_id, created_by_name, created_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [
        estimateId, req.fpId, property_id || null, estimate_type || 'property_based',
        client_name || '', client_phone || '', client_email || '',
        property_name || '', property_code || '', property_type || '', zone || '', division || '', city || '', address || '',
        safeNum(number_of_blocks, 1), unitsPerBlockJson, blockNamesJson, safeNum(total_units, 0),
        tower_name || '', block_number || '', villa_plot_number || '',
        package_id || null, package_name || '', safeNum(package_price, 0), amc_package_description || '', packageServicesJson,
        finalSubtotal, finalDiscountPercent, finalDiscountAmount, finalGstPercent, finalGstAmount, finalTotal,
        addonsJson, description || '', 
        creatorId, creatorName, creatorRole
      ]
    );

    console.log('Estimate created successfully:', result.insertId);
    
    res.status(201).json({
      success: true,
      message: 'Estimate created successfully',
      data: { id: result.insertId, estimateId }
    });
  } catch (error) {
    console.error('Create estimate error:', error.message, error.code, error.sqlMessage);
    res.status(500).json({
      success: false,
      message: `Failed to create estimate: ${error.sqlMessage || error.message}`,
      error: error.message,
      code: error.code
    });
  }
});

// Archive estimate
router.put('/estimates/:id/archive', requireFPScope, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE fp_estimates SET is_archived = 1, archived_at = NOW() WHERE id = ? AND franchise_partner_id = ?`,
      [req.params.id, req.fpId]
    );
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    console.error('Archive estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send estimate via email
router.post('/estimates/send-email', requireFPScope, async (req, res) => {
  try {
    const { estimateId, email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    
    // Get estimate details
    const [[estimate]] = await pool.execute(
      'SELECT * FROM fp_estimates WHERE id = ? AND franchise_partner_id = ?',
      [estimateId, req.fpId]
    );
    
    if (!estimate) {
      return res.status(404).json({ success: false, message: 'Estimate not found' });
    }
    
    // Ensure columns exist (for existing tables) - MySQL compatible
    try {
      // Check if action_token column exists
      const [cols] = await pool.execute(`SHOW COLUMNS FROM fp_estimates LIKE 'action_token'`);
      if (cols.length === 0) {
        await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN action_token VARCHAR(100)`);
      }
    } catch (e) { console.log('action_token column check:', e.message); }
    
    try {
      const [cols2] = await pool.execute(`SHOW COLUMNS FROM fp_estimates LIKE 'sent_at'`);
      if (cols2.length === 0) {
        await pool.execute(`ALTER TABLE fp_estimates ADD COLUMN sent_at TIMESTAMP NULL`);
      }
    } catch (e) { console.log('sent_at column check:', e.message); }
    
    // Generate action token for approve/reject links
    const crypto = require('crypto');
    const actionToken = crypto.randomBytes(32).toString('hex');
    
    // Update estimate with action token and status
    try {
      await pool.execute(
        'UPDATE fp_estimates SET status = ?, action_token = ?, sent_at = NOW() WHERE id = ?',
        ['sent', actionToken, estimateId]
      );
    } catch (updateErr) {
      // If action_token column doesn't exist, just update status
      console.log('Update with token failed, trying without:', updateErr.message);
      await pool.execute(
        'UPDATE fp_estimates SET status = ? WHERE id = ?',
        ['sent', estimateId]
      );
    }
    
    // Try to send email using the email service
    try {
      const { sendEstimateEmail } = require('../services/emailService');
      
      // Parse addons and enrich with descriptions
      let addons = [];
      if (estimate.addons_data) {
        try {
          addons = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
          // Fetch addon descriptions from fp_addons table
          const [fpAddons] = await pool.execute(
            `SELECT id, service_name, description FROM fp_addons WHERE franchise_partner_id = ?`,
            [req.fpId]
          );
          // Enrich addons with descriptions
          addons = addons.map(addon => {
            if (!addon.description) {
              const foundAddon = fpAddons.find(a => a.id == addon.id || a.id == addon.addon_id || a.service_name === (addon.name || addon.serviceName || addon.service_name));
              if (foundAddon && foundAddon.description) {
                addon.description = foundAddon.description;
              }
            }
            return addon;
          });
          console.log('[Email] Enriched addons with descriptions:', addons.map(a => ({ name: a.name || a.serviceName, desc: a.description })));
        } catch (e) { console.log('Addon parse error:', e); }
      }
      
      // Parse block data for GC
      let blockNames = {};
      let unitsPerBlock = {};
      try {
        if (estimate.block_names) blockNames = typeof estimate.block_names === 'string' ? JSON.parse(estimate.block_names) : estimate.block_names;
        if (estimate.units_per_block) unitsPerBlock = typeof estimate.units_per_block === 'string' ? JSON.parse(estimate.units_per_block) : estimate.units_per_block;
      } catch (e) {}

      // Parse package services with descriptions
      let packageServices = [];
      try {
        if (estimate.package_services) {
          packageServices = typeof estimate.package_services === 'string' ? JSON.parse(estimate.package_services) : estimate.package_services;
          console.log('Found package_services in estimate:', packageServices.length);
        }
        // If no package_services stored, fetch from FP AMC package by ID or name
        if (packageServices.length === 0 && (estimate.package_id || estimate.package_name)) {
          let pkgRows = [];
          // First try fp_amc_packages table (FP-specific packages)
          if (estimate.package_id) {
            [pkgRows] = await pool.execute('SELECT services FROM fp_amc_packages WHERE id = ?', [estimate.package_id]);
            console.log('Searched fp_amc_packages by ID:', estimate.package_id, '- found:', pkgRows.length);
          }
          // Fallback to search by name
          if (pkgRows.length === 0 && estimate.package_name) {
            [pkgRows] = await pool.execute('SELECT services FROM fp_amc_packages WHERE name = ? AND franchise_partner_id = ?', [estimate.package_name, req.fpId]);
            console.log('Searched fp_amc_packages by name:', estimate.package_name, '- found:', pkgRows.length);
          }
          if (pkgRows.length > 0 && pkgRows[0].services) {
            const svcData = typeof pkgRows[0].services === 'string' ? JSON.parse(pkgRows[0].services) : pkgRows[0].services;
            console.log('Raw services data structure:', typeof svcData, Array.isArray(svcData) ? 'array' : Object.keys(svcData || {}));
            packageServices = svcData?.serviceRows || svcData?.services || (Array.isArray(svcData) ? svcData : []);
            console.log('Parsed package services:', packageServices.length, 'services');
          }
        }
      } catch (e) { console.log('Package services parse error:', e); }

      const estimateData = {
        estimateId: estimate.estimate_id,
        customerName: estimate.client_name,
        customerEmail: email,
        customerPhone: estimate.client_phone || '',
        propertyName: estimate.property_name,
        propertyType: estimate.property_type,
        propertyCode: estimate.property_code || '',
        zone: estimate.zone,
        division: estimate.division,
        city: estimate.city,
        address: estimate.address,
        // GC-specific
        numberOfBlocks: estimate.number_of_blocks,
        blockNames: blockNames,
        unitsPerBlock: unitsPerBlock,
        totalUnits: estimate.total_units,
        // Apartment-specific
        towerName: estimate.tower_name,
        blockNumber: estimate.block_number,
        // Villa/Plot-specific
        villaPlotNumber: estimate.villa_plot_number,
        // Package info with description
        packageName: estimate.package_name,
        packagePrice: parseFloat(estimate.package_price) || 0,
        amcPackageDescription: estimate.amc_package_description || '',
        description: estimate.description || '',
        // Services with descriptions (no fallback to package name)
        services: packageServices,
        addons: addons,
        subtotal: parseFloat(estimate.subtotal) || 0,
        discount: parseFloat(estimate.discount_percent) || 0,
        discountAmount: parseFloat(estimate.discount_amount) || 0,
        tax: parseFloat(estimate.gst_amount) || 0,
        gstPercent: parseFloat(estimate.gst_percent) || 0,
        total: parseFloat(estimate.total_amount) || 0,
        validUntil: estimate.valid_until,
        createdAt: estimate.created_at
      };
      
      // Debug log price summary values
      console.log('[Email PDF] Price Summary values from DB:', {
        subtotal: estimate.subtotal,
        discount_percent: estimate.discount_percent,
        discount_amount: estimate.discount_amount,
        gst_percent: estimate.gst_percent,
        gst_amount: estimate.gst_amount,
        total_amount: estimate.total_amount
      });
      console.log('[Email PDF] Parsed values for PDF:', {
        subtotal: estimateData.subtotal,
        discount: estimateData.discount,
        discountAmount: estimateData.discountAmount,
        gstPercent: estimateData.gstPercent,
        tax: estimateData.tax,
        total: estimateData.total
      });
      
      const emailResult = await sendEstimateEmail(estimateData, actionToken);
      
      if (emailResult.success) {
        res.json({ 
          success: true, 
          message: `Estimate sent to ${email}` 
        });
      } else {
        res.json({ 
          success: true, 
          message: `Estimate marked as sent. Email delivery: ${emailResult.error || 'pending'}` 
        });
      }
    } catch (emailErr) {
      console.log('Email service not available:', emailErr.message);
      res.json({ 
        success: true, 
        message: `Estimate marked as sent to ${email}` 
      });
    }
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Restore estimate
router.put('/estimates/:id/restore', requireFPScope, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE fp_estimates SET is_archived = 0, archived_at = NULL WHERE id = ? AND franchise_partner_id = ?`,
      [req.params.id, req.fpId]
    );
    res.json({ success: true, message: 'Estimate restored' });
  } catch (error) {
    console.error('Restore estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all archived estimates (must be before :id route)
router.delete('/estimates/archived/delete-all', requireFPScope, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `DELETE FROM fp_estimates WHERE franchise_partner_id = ? AND is_archived = 1`,
      [req.fpId]
    );
    res.json({ success: true, message: `${result.affectedRows} archived estimates deleted`, deletedCount: result.affectedRows });
  } catch (error) {
    console.error('Delete all archived error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Permanently delete a single archived estimate
router.delete('/estimates/:id/permanent', requireFPScope, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `DELETE FROM fp_estimates WHERE id = ? AND franchise_partner_id = ? AND is_archived = 1`,
      [req.params.id, req.fpId]
    );
    if (result.affectedRows > 0) {
      res.json({ success: true, message: 'Estimate permanently deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Archived estimate not found' });
    }
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete estimate - Archives instead of hard delete (for active estimates)
router.delete('/estimates/:id', requireFPScope, async (req, res) => {
  try {
    await pool.execute(
      `UPDATE fp_estimates SET is_archived = 1, archived_at = NOW(), status = 'Archived' WHERE id = ? AND franchise_partner_id = ?`,
      [req.params.id, req.fpId]
    );
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Transform AMC package to frontend format
const transformPackage = (pkg) => ({
  id: pkg.id,
  packageId: pkg.package_code || `PKG-${pkg.id}`,
  packageName: pkg.name || pkg.package_name,
  name: pkg.name || pkg.package_name,
  description: pkg.description || '',
  propertyType: pkg.property_type === 'AP' ? 'APT' : pkg.property_type === 'VL' ? 'VILLA' : pkg.property_type === 'FL' ? 'FLAT' : pkg.property_type === 'PL' ? 'PLOT' : pkg.property_type || 'GC',
  price: parseFloat(pkg.base_price || pkg.price) || 0,
  rate: parseFloat(pkg.base_price || pkg.price) || 0,
  services: pkg.services ? (typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services) : [],
  serviceRows: pkg.service_rows ? (typeof pkg.service_rows === 'string' ? JSON.parse(pkg.service_rows) : pkg.service_rows) : [],
  durationMonths: pkg.duration_months || 12,
  billingCycle: pkg.billing_duration || 'Annual',
  createdAt: pkg.created_at,
  createdBy: pkg.created_by,
  createdByName: pkg.created_by_name
});

// Get FP AMC packages - Scoped to each FP
router.get('/amc-packages', requireFPScope, async (req, res) => {
  try {
    const [packages] = await pool.execute(
      `SELECT p.id, p.franchise_partner_id, p.package_code, p.name, p.description, 
              p.duration_months, p.base_price as price, p.services, p.terms_conditions,
              p.created_at, p.updated_at,
              fp.company_name as created_by_name
       FROM fp_amc_packages p
       LEFT JOIN franchise_partners fp ON p.franchise_partner_id = fp.id
       WHERE p.franchise_partner_id = ? ORDER BY p.created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: packages.map(transformPackage)
    });
  } catch (error) {
    console.error('Get AMC packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AMC packages',
      error: error.message
    });
  }
});

// Create AMC package
router.post('/amc-packages', requireFPScope, async (req, res) => {
  try {
    const {
      name, description, property_type, services, price, billing_duration
    } = req.body;

    const packageCode = `FP${req.fpId}-AMC-${Date.now()}`;

    // Check if table has required columns, use appropriate insert
    const [result] = await pool.execute(
      `INSERT INTO fp_amc_packages (
        franchise_partner_id, package_code, name, description, 
        base_price, services
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.fpId, packageCode, name, description || '',
        price || 0, JSON.stringify({ 
          property_type, 
          billing_duration,
          serviceRows: services || [] 
        })
      ]
    );

    res.status(201).json({
      success: true,
      message: 'AMC package created successfully',
      data: { id: result.insertId, packageCode }
    });
  } catch (error) {
    console.error('Create AMC package error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create AMC package',
      error: error.message
    });
  }
});

// Update AMC package
router.put('/amc-packages/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, property_type, services, price, billing_duration } = req.body;

    const [result] = await pool.execute(
      `UPDATE fp_amc_packages 
       SET name = ?, description = ?, base_price = ?, 
           services = ?, updated_at = NOW()
       WHERE id = ? AND franchise_partner_id = ?`,
      [
        name, description || '',
        price || 0, JSON.stringify({ property_type, billing_duration, serviceRows: services || [] }),
        id, req.fpId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    res.json({ success: true, message: 'AMC package updated successfully' });
  } catch (error) {
    console.error('Update AMC package error:', error);
    res.status(500).json({ success: false, message: 'Failed to update AMC package', error: error.message });
  }
});

// Delete AMC package
router.delete('/amc-packages/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      `DELETE FROM fp_amc_packages WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Package not found' });
    }

    res.json({ success: true, message: 'AMC package deleted successfully' });
  } catch (error) {
    console.error('Delete AMC package error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete AMC package', error: error.message });
  }
});

// Transform addon to frontend format - include both transformed and raw fields
const transformAddon = (addon) => ({
  id: addon.id,
  addonId: addon.addon_code || `ADDON-${addon.id}`,
  // Raw fields for frontend compatibility
  service_name: addon.service_name || '',
  property_type: addon.property_type,
  frequency_type: addon.frequency_type || 'Monthly',
  frequency_count: addon.frequency_count || 1,
  price: parseFloat(addon.price) || 0,
  description: addon.description || '',
  billing_cycle: addon.billing_cycle || 'Monthly',
  // Transformed fields
  propertyType: addon.property_type === 'AP' ? 'APT' : addon.property_type === 'VL' ? 'VILLA' : addon.property_type === 'FL' ? 'FLAT' : addon.property_type === 'PL' ? 'PLOT' : addon.property_type,
  propertyTypeName: addon.property_type === 'GC' ? 'Gated Community' : addon.property_type === 'AP' || addon.property_type === 'APT' ? 'Apartment' : addon.property_type === 'VL' || addon.property_type === 'VILLA' ? 'Villa' : addon.property_type === 'FL' || addon.property_type === 'FLAT' ? 'Flat' : addon.property_type === 'PL' || addon.property_type === 'PLOT' ? 'Plot' : addon.property_type,
  services: [{ name: addon.service_name || '', frequency: addon.frequency_count || 1, frequencyType: addon.frequency_type || 'Monthly', price: parseFloat(addon.price) || 0, description: addon.description || '' }],
  totalPrice: parseFloat(addon.price) || 0,
  billingCycle: addon.billing_cycle || 'Monthly',
  createdAt: addon.created_at
});

// Get FP add-ons - Scoped to each FP
router.get('/addons', requireFPScope, async (req, res) => {
  try {
    const [addons] = await pool.execute(
      `SELECT id, franchise_partner_id, property_type, service_name, frequency_count, frequency_type, billing_cycle, price, description, created_at
       FROM fp_addons
       WHERE franchise_partner_id = ?
       ORDER BY created_at DESC`,
      [req.fpId]
    );

    res.json({
      success: true,
      data: addons.map(transformAddon)
    });
  } catch (error) {
    console.error('Get addons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch addons',
      error: error.message
    });
  }
});

// Create addon
router.post('/addons', requireFPScope, async (req, res) => {
  try {
    const { property_type, service_name, frequency_count, frequency_type, billing_cycle, price, description } = req.body;

    if (!service_name || !property_type) {
      return res.status(400).json({ success: false, message: 'Service name and property type are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO fp_addons (
        franchise_partner_id, property_type, service_name, frequency_count, frequency_type, billing_cycle, price, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.fpId, property_type, service_name, frequency_count || 1, frequency_type || 'Monthly', billing_cycle || 'Monthly', price || 0, description || '']
    );

    res.status(201).json({
      success: true,
      message: 'Add-on created successfully',
      data: { id: result.insertId, service_name, property_type }
    });
  } catch (error) {
    console.error('Create addon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create add-on',
      error: error.message
    });
  }
});

// Update addon
router.put('/addons/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, frequency_type, frequency_count, property_type, price, description } = req.body;

    await pool.execute(
      `UPDATE fp_addons SET 
        service_name = ?, frequency_type = ?, frequency_count = ?, property_type = ?, price = ?, description = ?
       WHERE id = ? AND franchise_partner_id = ?`,
      [service_name, frequency_type, frequency_count || 1, property_type, price || 0, description || '', id, req.fpId]
    );

    res.json({ success: true, message: 'Add-on updated successfully' });
  } catch (error) {
    console.error('Update addon error:', error);
    res.status(500).json({ success: false, message: 'Failed to update add-on', error: error.message });
  }
});

// Delete addon
router.delete('/addons/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM fp_addons WHERE id = ? AND franchise_partner_id = ?', [id, req.fpId]);
    res.json({ success: true, message: 'Add-on deleted successfully' });
  } catch (error) {
    console.error('Delete addon error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete add-on', error: error.message });
  }
});

// ============================================
// EXPORT DATA
// ============================================

router.get('/export/:type', requireFPScope, async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let filename = '';

    // Block export for properties and vendors (role restriction)
    if (type === 'properties' || type === 'vendors') {
      return res.status(403).json({
        success: false,
        message: 'Export not allowed for this resource type'
      });
    }

    switch (type) {
      case 'customers':
        [data] = await pool.execute(
          'SELECT * FROM clients WHERE franchise_partner_id = ?',
          [req.fpId]
        );
        filename = 'customers_export.json';
        break;
      case 'work-orders':
        [data] = await pool.execute(
          'SELECT * FROM work_orders WHERE franchise_partner_id = ?',
          [req.fpId]
        );
        filename = 'work_orders_export.json';
        break;
      case 'employees':
        [data] = await pool.execute(
          'SELECT * FROM fp_employees WHERE franchise_partner_id = ?',
          [req.fpId]
        );
        filename = 'employees_export.json';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message
    });
  }
});

// ============================================
// ZONES (FP-specific zones from fp_zones table AND property zones)
// ============================================

router.get('/zones', requireFPScope, async (req, res) => {
  try {
    const allZoneNames = new Set();
    const combinedZones = [];

    // Get zones from fp_zones table
    try {
      const [fpZones] = await pool.execute(
        'SELECT id, name FROM fp_zones WHERE franchise_partner_id = ? AND is_active = 1 ORDER BY name',
        [req.fpId]
      );
      fpZones.forEach(z => {
        if (!allZoneNames.has(z.name)) {
          allZoneNames.add(z.name);
          combinedZones.push({ id: z.id, name: z.name });
        }
      });
    } catch (_) {}

    // Get zones from FP's properties (zone_id column stores zone name)
    try {
      const [propertyZones] = await pool.execute(
        `SELECT DISTINCT zone_id FROM properties WHERE franchise_partner_id = ? AND zone_id IS NOT NULL AND zone_id != ''`,
        [req.fpId]
      );
      propertyZones.forEach(z => {
        if (z.zone_id && !allZoneNames.has(z.zone_id)) {
          allZoneNames.add(z.zone_id);
          combinedZones.push({ id: `prop-${z.zone_id}`, name: z.zone_id });
        }
      });
    } catch (_) {}

    // Sort by name
    combinedZones.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: combinedZones
    });
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch zones',
      error: error.message
    });
  }
});

// Create zone - FP can create zones
router.post('/zones', requireFPScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    // Safety check: Admin users don't have fpId
    if (!req.fpId) {
      return res.status(400).json({ success: false, message: 'Zone creation requires FP scope' });
    }
    
    // Check if zone already exists for this FP
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND franchise_partner_id = ?',
      [name, req.fpId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, created_by, is_active) VALUES (?, ?, ?, 1)',
      [name, req.fpId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    console.error('Create zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone - FP can delete their zones
router.delete('/zones/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND franchise_partner_id = ?',
      [id, req.fpId]
    );
    
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    console.error('Delete zone error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CATEGORIES (Read-only for FP)
// ============================================

router.get('/categories', requireFPScope, async (req, res) => {
  try {
    // Always use config file for categories (most reliable)
    const categoriesConfig = require('../config/categories');
    return res.json({ success: true, data: categoriesConfig });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
});

// Migration: Update existing estimates with created_by_name
router.post('/migrate-estimate-names', requireFPScope, async (req, res) => {
  try {
    // Update estimates where created_by_name is empty but created_by_id exists
    const [result] = await pool.query(`
      UPDATE fp_estimates e
      LEFT JOIN users u ON e.created_by_id = u.id
      SET e.created_by_name = COALESCE(
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')),
        u.name,
        CONCAT(UPPER(SUBSTRING(e.created_by_role, 1, 1)), LOWER(SUBSTRING(e.created_by_role, 2)))
      )
      WHERE (e.created_by_name IS NULL OR e.created_by_name = '' OR e.created_by_name = '-')
        AND e.franchise_partner_id = ?
    `, [req.fpId]);
    
    res.json({ 
      success: true, 
      message: `Updated ${result.affectedRows} estimate records`,
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// FP PORTAL LINKS (Custom links for employees)
// ============================================

// Get all portal links for the FP
router.get('/portal-links', requireFPScope, async (req, res) => {
  try {
    const [links] = await pool.execute(
      `SELECT id, link_slot, heading, url, created_at, updated_at 
       FROM fp_portal_links 
       WHERE franchise_partner_id = ? AND is_active = 1 
       ORDER BY link_slot ASC`,
      [req.fpId]
    );
    
    res.json({ success: true, data: links });
  } catch (error) {
    console.error('Get portal links error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch portal links',
      error: error.message
    });
  }
});

// Create or update a portal link (upsert by slot)
router.post('/portal-links', requireFPScope, async (req, res) => {
  try {
    const { link_slot, heading, url } = req.body;
    
    // Validation
    if (!link_slot || link_slot < 1 || link_slot > 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid link slot. Must be 1 or 2.' 
      });
    }
    
    if (!heading || !heading.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Heading cannot be blank.' 
      });
    }
    
    if (!url || !url.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL cannot be blank.' 
      });
    }
    
    // URL validation - must be a valid URL
    try {
      new URL(url.trim());
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid URL.' 
      });
    }
    
    // Check if link already exists for this slot
    const [existing] = await pool.execute(
      'SELECT id FROM fp_portal_links WHERE franchise_partner_id = ? AND link_slot = ?',
      [req.fpId, link_slot]
    );
    
    if (existing.length > 0) {
      // Update existing link
      await pool.execute(
        `UPDATE fp_portal_links 
         SET heading = ?, url = ?, is_active = 1, updated_at = NOW() 
         WHERE franchise_partner_id = ? AND link_slot = ?`,
        [heading.trim(), url.trim(), req.fpId, link_slot]
      );
      
      res.json({ 
        success: true, 
        message: 'Link updated successfully.',
        data: { id: existing[0].id, link_slot, heading: heading.trim(), url: url.trim() }
      });
    } else {
      // Insert new link
      const [result] = await pool.execute(
        `INSERT INTO fp_portal_links (franchise_partner_id, link_slot, heading, url, is_active) 
         VALUES (?, ?, ?, ?, 1)`,
        [req.fpId, link_slot, heading.trim(), url.trim()]
      );
      
      res.json({ 
        success: true, 
        message: 'Link saved successfully.',
        data: { id: result.insertId, link_slot, heading: heading.trim(), url: url.trim() }
      });
    }
  } catch (error) {
    console.error('Save portal link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save portal link',
      error: error.message
    });
  }
});

// Update a specific portal link
router.put('/portal-links/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { heading, url } = req.body;
    
    // Validation
    if (!heading || !heading.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Heading cannot be blank.' 
      });
    }
    
    if (!url || !url.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL cannot be blank.' 
      });
    }
    
    // URL validation
    try {
      new URL(url.trim());
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid URL.' 
      });
    }
    
    // Verify ownership and update
    const [result] = await pool.execute(
      `UPDATE fp_portal_links 
       SET heading = ?, url = ?, updated_at = NOW() 
       WHERE id = ? AND franchise_partner_id = ?`,
      [heading.trim(), url.trim(), id, req.fpId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Link not found or not authorized.' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Link updated successfully.',
      data: { id: parseInt(id), heading: heading.trim(), url: url.trim() }
    });
  } catch (error) {
    console.error('Update portal link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update portal link',
      error: error.message
    });
  }
});

// Delete a portal link
router.delete('/portal-links/:id', requireFPScope, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete - set is_active to 0
    const [result] = await pool.execute(
      `UPDATE fp_portal_links 
       SET is_active = 0, updated_at = NOW() 
       WHERE id = ? AND franchise_partner_id = ?`,
      [id, req.fpId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Link not found or not authorized.' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Link deleted successfully.' 
    });
  } catch (error) {
    console.error('Delete portal link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete portal link',
      error: error.message
    });
  }
});

module.exports = router;
