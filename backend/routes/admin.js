const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { authenticate, generateToken } = require('../middleware/auth');
// Rate limiting disabled
// const { loginRateLimiter } = require('../middleware/security');
const { 
  adminOnly, 
  managerOrAdmin, 
  supervisorOrAbove,
  dataEntryRoles,
  requireMasterDataAccess,
  canDoDataEntry,
  canAddClient,
  canSeeReports,
  ROLES 
} = require('../middleware/rbac');

// ============================================
// ADMIN AUTH
// ============================================

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const [admins] = await pool.execute(
      `SELECT * FROM admin_users WHERE (username = ? OR email = ?) AND is_active = 1`,
      [username, username]
    );

    if (admins.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const admin = admins[0];

    // Verify password against stored hash
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await pool.execute(
      `UPDATE admin_users SET last_login = NOW() WHERE id = ?`,
      [admin.id]
    );

    // Generate JWT token for admin
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      first_name: admin.first_name,
      last_name: admin.last_name
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// ============================================
// RESIDENTS MANAGEMENT
// ============================================

// Get all residents (Admin, Manager, Supervisor, Executive can view)
router.get('/residents', authenticate, dataEntryRoles, async (req, res) => {
  try {
    // Simplified query - units/residents tables may not exist in Railway
    let residents = [];
    try {
      const [rows] = await pool.execute(
        `SELECT r.*, r.created_by as created_by_name
         FROM residents r 
         ORDER BY r.created_at DESC`
      );
      residents = rows;
    } catch (tableErr) {
      console.log('Residents table may not exist:', tableErr.message);
    }

    res.json({
      success: true,
      data: residents.map(r => ({
        id: r.id,
        residentId: r.resident_id,
        unitId: r.unit_id,
        unitNumber: r.unit_number,
        propertyName: r.property_name,
        propertyCode: r.property_code,
        email: r.email,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        isPrimaryResident: r.is_primary_resident,
        leaseStartDate: r.lease_start_date,
        leaseEndDate: r.lease_end_date,
        isRegistered: r.is_registered,
        registrationDate: r.registration_date,
        isActive: r.is_active,
        createdBy: r.created_by_name,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching residents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching residents',
      error: error.message
    });
  }
});

// Create new resident (Admin, Manager, Supervisor, Executive can add)
router.post('/residents', authenticate, canAddClient, async (req, res) => {
  try {
    const { unitId, email, firstName, lastName, phone, leaseStartDate, leaseEndDate, adminId } = req.body;

    if (!unitId || !email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Unit, email, first name, and last name are required'
      });
    }

    // Check if email already exists
    const [existing] = await pool.execute(
      `SELECT id FROM residents WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A resident with this email already exists'
      });
    }

    // Generate unique resident ID
    const residentId = `RES-${Date.now().toString(36).toUpperCase()}`;

    const [result] = await pool.execute(
      `INSERT INTO residents (resident_id, unit_id, email, first_name, last_name, phone, lease_start_date, lease_end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [residentId, unitId, email, firstName, lastName, phone || null, leaseStartDate || null, leaseEndDate || null, adminId || null]
    );

    // Mark unit as occupied
    await pool.execute(
      `UPDATE units SET is_occupied = TRUE WHERE id = ?`,
      [unitId]
    );

    res.status(201).json({
      success: true,
      message: 'Resident created successfully',
      data: {
        id: result.insertId,
        residentId
      }
    });
  } catch (error) {
    console.error('Error creating resident:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating resident',
      error: error.message
    });
  }
});

// Update resident (Admin, Manager, Supervisor, Executive can edit contact details)
router.put('/residents/:id', authenticate, dataEntryRoles, async (req, res) => {
  try {
    const { id } = req.params;
    const { unitId, email, firstName, lastName, phone, leaseStartDate, leaseEndDate, isActive } = req.body;

    const [result] = await pool.execute(
      `UPDATE residents SET 
        unit_id = COALESCE(?, unit_id),
        email = COALESCE(?, email),
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        phone = ?,
        lease_start_date = ?,
        lease_end_date = ?,
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [unitId, email, firstName, lastName, phone, leaseStartDate, leaseEndDate, isActive, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    res.json({
      success: true,
      message: 'Resident updated successfully'
    });
  } catch (error) {
    console.error('Error updating resident:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating resident',
      error: error.message
    });
  }
});

// Delete resident (Admin only)
router.delete('/residents/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Get resident email before deleting
    const [residents] = await pool.execute(
      `SELECT email FROM residents WHERE id = ?`,
      [id]
    );

    if (residents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    const residentEmail = residents[0].email;

    // Soft delete resident
    await pool.execute(
      `UPDATE residents SET is_active = 0 WHERE id = ?`,
      [id]
    );

    // Also deactivate customer account if exists (so they can't login)
    try {
      await pool.execute(
        `UPDATE customer_accounts SET is_active = 0 WHERE email = ?`,
        [residentEmail]
      );
    } catch (e) {
      // customer_accounts table might not exist or no matching record - continue
    }

    res.json({
      success: true,
      message: 'Resident deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resident:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting resident',
      error: error.message
    });
  }
});

// ============================================
// PROPERTIES MANAGEMENT
// ============================================

// Get all properties (Admin, Manager can manage; Supervisor, Executive can view)
router.get('/properties', authenticate, dataEntryRoles, async (req, res) => {
  try {
    // Fetch from both properties and onboarded_properties tables with creator name
    const [regularProperties] = await pool.execute(
      `SELECT p.*, 
              COALESCE(p.total_units, p.number_of_units, 1) as total_units,
              0 as occupied_units,
              COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), p.created_by, 'System') as created_by_name,
              'properties' as source_table
       FROM properties p 
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.user_id OR p.created_by = u.id
       ORDER BY p.created_at DESC`
    );

    let onboardedProperties = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, 
                COALESCE(op.entry_type, op.property_type) as property_type, op.entry_type,
                op.zone as zone, op.division, op.area_name as area, op.total_units, op.number_of_units, 0 as occupied_units,
                op.address, op.city, op.state, op.postal_code as zip_code,
                op.landmark, COALESCE(op.latitude, op.map_lat) as latitude, COALESCE(op.longitude, op.map_lng) as longitude, op.map_address,
                op.association_contacts,
                op.number_of_blocks, op.block_names, op.units_per_block, op.block_unit_types,
                op.block_info, op.block_na, op.flat_block_info, op.flat_block_na,
                op.villa_plot_number, op.plot_na,
                op.watchman_name, op.watchman_contact,
                op.notes,
                op.contact_person, op.contact_phone, op.contact_email as email,
                COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                op.created_at, op.status, op.franchise_partner_id,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
         WHERE op.status = 'active'
         ORDER BY op.created_at DESC`
      );
      onboardedProperties = rows;
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    // Combine both sources and sort by created_at DESC
    const allProperties = [...regularProperties, ...onboardedProperties]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(prop => {
        // Extract Contact 1 from association_contacts JSON as primary contact
        let contact_person = prop.contact_person || '';
        let contact_phone = prop.contact_phone || '';
        let contact_email = prop.contact_email || prop.email || '';
        
        if (prop.association_contacts) {
          try {
            const contacts = typeof prop.association_contacts === 'string' 
              ? JSON.parse(prop.association_contacts) 
              : prop.association_contacts;
            if (Array.isArray(contacts) && contacts.length > 0) {
              // Contact 1 is the primary contact
              contact_person = contacts[0].name || contact_person;
              contact_phone = contacts[0].phone || contact_phone;
              contact_email = contacts[0].email || contact_email;
            }
          } catch (e) { /* ignore parse errors */ }
        }
        
        return {
          ...prop,
          contact_person,
          contact_phone,
          contact_email
        };
      });

    res.json({
      success: true,
      data: allProperties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// Create property (Admin, Manager only)
router.post('/properties', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { name, address, city, state, zipCode, country } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: 'Name and address are required'
      });
    }

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
      `INSERT INTO properties (property_id, name, address, city, state, zip_code, country, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, address, city || null, state || null, zipCode || null, country || 'USA', creatorName]
    );

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: {
        id: result.insertId,
        propertyId
      }
    });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating property',
      error: error.message
    });
  }
});

// Update property (Admin, Manager only) - handles both properties and onboarded_properties
router.put('/properties/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sourceTable = updates.sourceTable || updates.source_table;

    // Check which table the property belongs to
    let tableName = 'properties';
    
    if (sourceTable === 'onboarded_properties') {
      tableName = 'onboarded_properties';
    } else {
      // Check if property exists in properties table
      const [propCheck] = await pool.execute('SELECT id FROM properties WHERE id = ?', [id]);
      
      if (propCheck.length === 0) {
        // Check onboarded_properties table
        const [onboardedCheck] = await pool.execute('SELECT id FROM onboarded_properties WHERE id = ?', [id]);
        
        if (onboardedCheck.length > 0) {
          tableName = 'onboarded_properties';
        } else {
          return res.status(404).json({
            success: false,
            message: 'Property not found'
          });
        }
      }
    }

    // Define allowed fields for each table
    const allowedFieldsMap = {
      properties: [
        'name', 'property_type', 'address', 'city', 'state', 'zip_code', 'country',
        'contact_person', 'contact_phone', 'contact_email', 'zone_id', 'division_id', 'area_name', 'is_active'
      ],
      onboarded_properties: [
        'community_name', 'property_type', 'address', 'city', 'state', 'postal_code',
        'zone', 'division', 'area_name', 'status', 'number_of_units', 'total_units'
      ]
    };

    // Field mapping for onboarded_properties
    const fieldMapping = {
      name: tableName === 'onboarded_properties' ? 'community_name' : 'name',
      zipCode: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zip_code: tableName === 'onboarded_properties' ? 'postal_code' : 'zip_code',
      zoneId: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      zone_id: tableName === 'onboarded_properties' ? 'zone' : 'zone_id',
      divisionId: tableName === 'onboarded_properties' ? 'division' : 'division_id',
      division_id: tableName === 'onboarded_properties' ? 'division' : 'division_id'
    };

    const allowedFields = allowedFieldsMap[tableName];
    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'sourceTable' || key === 'source_table') continue;
      
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

    values.push(id);

    const [result] = await pool.execute(
      `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      message: 'Property updated successfully'
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating property',
      error: error.message
    });
  }
});

// Delete property (Admin only) - soft delete by setting status to 'inactive'
router.delete('/properties/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    let updated = false;
    let contactEmail = null;

    // Get contact email before soft-deleting (for customer account deactivation)
    try {
      const [props] = await pool.execute(
        `SELECT contact_email FROM properties WHERE id = ?`,
        [id]
      );
      if (props.length > 0) contactEmail = props[0].contact_email;
    } catch (e) {}
    
    if (!contactEmail) {
      try {
        const [props] = await pool.execute(
          `SELECT contact_email FROM onboarded_properties WHERE id = ?`,
          [id]
        );
        if (props.length > 0) contactEmail = props[0].contact_email;
      } catch (e) {}
    }

    // Try to soft-delete from properties table first (set status to 'inactive')
    try {
      const [result1] = await pool.execute(
        `UPDATE properties SET status = 'inactive' WHERE id = ?`,
        [id]
      );
      if (result1.affectedRows > 0) updated = true;
    } catch (e) { console.log('Properties table update skipped:', e.message); }

    // Also try to soft-delete from onboarded_properties table
    try {
      const [result2] = await pool.execute(
        `UPDATE onboarded_properties SET status = 'inactive' WHERE id = ?`,
        [id]
      );
      if (result2.affectedRows > 0) updated = true;
    } catch (e) { console.log('Onboarded_properties table update skipped:', e.message); }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Deactivate customer account if email exists
    if (contactEmail) {
      try {
        await pool.execute(
          `UPDATE customer_accounts SET is_active = 0, updated_at = NOW() WHERE email = ?`,
          [contactEmail.toLowerCase()]
        );
        console.log('👤 [Admin] Deactivated customer account for:', contactEmail);
      } catch (e) { console.log('Customer account deactivation skipped:', e.message); }
    }

    console.log('📋 [Admin] Soft-deleted (set inactive) property:', id);

    res.json({
      success: true,
      message: 'Customer moved to inactive. Can be restored from Inactive Customers.'
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property',
      error: error.message
    });
  }
});

// Restore property (Admin only) - set status back to 'active'
router.put('/properties/:id/restore', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    let restored = false;
    let contactEmail = null;

    // Get contact email before restoring (for customer account reactivation)
    try {
      const [props] = await pool.execute(
        `SELECT contact_email FROM properties WHERE id = ?`,
        [id]
      );
      if (props.length > 0) contactEmail = props[0].contact_email;
    } catch (e) {}
    
    if (!contactEmail) {
      try {
        const [props] = await pool.execute(
          `SELECT contact_email FROM onboarded_properties WHERE id = ?`,
          [id]
        );
        if (props.length > 0) contactEmail = props[0].contact_email;
      } catch (e) {}
    }

    // Try to restore from properties table first
    try {
      const [result1] = await pool.execute(
        `UPDATE properties SET status = 'active' WHERE id = ? AND status = 'inactive'`,
        [id]
      );
      if (result1.affectedRows > 0) restored = true;
    } catch (e) { console.log('Properties table restore skipped:', e.message); }

    // Also try to restore from onboarded_properties table
    try {
      const [result2] = await pool.execute(
        `UPDATE onboarded_properties SET status = 'active' WHERE id = ? AND status = 'inactive'`,
        [id]
      );
      if (result2.affectedRows > 0) restored = true;
    } catch (e) { console.log('Onboarded_properties table restore skipped:', e.message); }

    if (!restored) {
      return res.status(404).json({
        success: false,
        message: 'Property not found or already active'
      });
    }

    // Reactivate customer account if email exists
    if (contactEmail) {
      try {
        await pool.execute(
          `UPDATE customer_accounts SET is_active = 1, updated_at = NOW() WHERE email = ?`,
          [contactEmail.toLowerCase()]
        );
        console.log('👤 [Admin] Reactivated customer account for:', contactEmail);
      } catch (e) { console.log('Customer account reactivation skipped:', e.message); }
    }

    console.log('📋 [Admin] Restored property:', id);

    res.json({
      success: true,
      message: 'Customer restored to active successfully.'
    });
  } catch (error) {
    console.error('Error restoring property:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring property',
      error: error.message
    });
  }
});

// Permanently delete property (Admin only) - hard delete from database
router.delete('/properties/:id/permanent', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = false;
    let contactEmail = null;

    // Get contact email before deleting (for customer_accounts cleanup)
    try {
      const [prop] = await pool.query('SELECT contact_email FROM properties WHERE id = ?', [id]);
      if (prop.length > 0) contactEmail = prop[0].contact_email;
    } catch (e) {}
    if (!contactEmail) {
      try {
        const [prop] = await pool.query('SELECT poc_email as contact_email FROM onboarded_properties WHERE id = ?', [id]);
        if (prop.length > 0) contactEmail = prop[0].contact_email;
      } catch (e) {}
    }

    // Try to delete from properties table first
    try {
      const [result1] = await pool.execute(
        `DELETE FROM properties WHERE id = ?`,
        [id]
      );
      if (result1.affectedRows > 0) deleted = true;
    } catch (e) { console.log('Properties table delete skipped:', e.message); }

    // Also try to delete from onboarded_properties table
    try {
      const [result2] = await pool.execute(
        `DELETE FROM onboarded_properties WHERE id = ?`,
        [id]
      );
      if (result2.affectedRows > 0) deleted = true;
    } catch (e) { console.log('Onboarded_properties table delete skipped:', e.message); }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Delete customer_accounts by email (so email can be reused for new customer)
    if (contactEmail) {
      try {
        await pool.execute('DELETE FROM customer_accounts WHERE email = ?', [contactEmail.toLowerCase()]);
        console.log('📋 [Admin] Deleted customer_account for email:', contactEmail);
      } catch (e) {}
    }
    // Also delete by property_id
    try {
      await pool.execute('DELETE FROM customer_accounts WHERE property_id = ?', [id]);
    } catch (e) {}

    // Delete related clients
    try {
      await pool.execute('DELETE FROM clients WHERE property_id = ?', [id]);
      console.log('📋 [Admin] Deleted clients for property_id:', id);
    } catch (e) {}

    // Archive related estimates in fp_estimates (not delete - move to archived)
    try {
      const [estResult] = await pool.execute(
        'UPDATE fp_estimates SET is_archived = 1, archived_at = NOW() WHERE property_id = ?',
        [id]
      );
      if (estResult.affectedRows > 0) {
        console.log('📋 [Admin] Archived', estResult.affectedRows, 'estimates for property_id:', id);
      }
    } catch (e) { console.log('fp_estimates archive skipped:', e.message); }

    console.log('📋 [Admin] Permanently deleted property:', id);

    res.json({
      success: true,
      message: 'Customer permanently deleted. This action cannot be undone.'
    });
  } catch (error) {
    console.error('Error permanently deleting property:', error);
    res.status(500).json({
      success: false,
      message: 'Error permanently deleting property',
      error: error.message
    });
  }
});

// ============================================
// UNITS MANAGEMENT
// ============================================

// Get all units (Admin, Manager, Supervisor, Executive can view)
router.get('/units', authenticate, dataEntryRoles, async (req, res) => {
  try {
    // Units table may not exist in Railway - return empty if not found
    let units = [];
    try {
      const [rows] = await pool.execute(
        `SELECT u.*, p.name as property_name, p.property_id as property_code
         FROM units u 
         JOIN properties p ON u.property_id = p.id
         ORDER BY p.name, u.unit_number`
      );
      units = rows;
    } catch (tableErr) {
      console.log('Units table may not exist:', tableErr.message);
    }

    res.json({
      success: true,
      data: units
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching units',
      error: error.message
    });
  }
});

// Create unit (Admin, Manager only)
router.post('/units', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { propertyId, unitNumber, floor, bedrooms, bathrooms, squareFeet } = req.body;

    if (!propertyId || !unitNumber) {
      return res.status(400).json({
        success: false,
        message: 'Property ID and unit number are required'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO units (property_id, unit_number, floor, bedrooms, bathrooms, square_feet)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [propertyId, unitNumber, floor || null, bedrooms || 1, bathrooms || 1, squareFeet || null]
    );

    res.status(201).json({
      success: true,
      message: 'Unit created successfully',
      data: {
        id: result.insertId
      }
    });
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating unit',
      error: error.message
    });
  }
});

// Update unit (Admin, Manager only)
router.put('/units/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { unitNumber, floor, bedrooms, bathrooms, squareFeet, isOccupied, isActive } = req.body;

    const [result] = await pool.execute(
      `UPDATE units SET 
        unit_number = COALESCE(?, unit_number),
        floor = ?,
        bedrooms = COALESCE(?, bedrooms),
        bathrooms = COALESCE(?, bathrooms),
        square_feet = ?,
        is_occupied = COALESCE(?, is_occupied),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [unitNumber, floor, bedrooms, bathrooms, squareFeet, isOccupied, isActive, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unit not found'
      });
    }

    res.json({
      success: true,
      message: 'Unit updated successfully'
    });
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating unit',
      error: error.message
    });
  }
});

// Delete unit (Admin only)
router.delete('/units/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `UPDATE units SET is_active = 0 WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unit not found'
      });
    }

    res.json({
      success: true,
      message: 'Unit deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting unit',
      error: error.message
    });
  }
});

// ============================================
// WORK ORDERS MANAGEMENT
// ============================================

// Get all work orders (Public for admin portal)
router.get('/work-orders', async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let query = `
      SELECT wo.*,
             wo.customer_name,
             wo.customer_email,
             wo.customer_phone,
             COALESCE(p.name, op.community_name, wo.property_name) as property_name,
             COALESCE(p.property_id, op.property_id) as property_code,
             COALESCE(c.name, wo.category_name) as category_name,
             wo.subcategory_name,
             v.company_name as vendor_name,
             r.first_name as resident_first_name,
             r.last_name as resident_last_name,
             r.phone as resident_phone,
             r.email as resident_email,
             COALESCE(p.zone_id, op.zone) as zone,
             COALESCE(p.division_id, op.division) as division,
             COALESCE(p.address, op.address) as address,
             COALESCE(p.city, op.city) as city,
             COALESCE(p.state, op.state) as state,
             COALESCE(p.contact_person, op.contact_person) as contact_person,
             COALESCE(p.contact_phone, op.contact_phone) as contact_phone,
             COALESCE(p.contact_email, op.contact_email) as contact_email,
             COALESCE(p.property_type, op.property_type, wo.property_type) as property_type
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id OR wo.property_name = p.name
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id OR wo.property_name = op.community_name
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN residents r ON wo.resident_id = r.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (status && status !== 'all') {
      if (status === 'pending') {
        conditions.push(`wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`);
      } else if (status === 'completed' || status === 'completed,closed') {
        conditions.push(`wo.status IN ('completed', 'closed')`);
      } else if (status.includes(',')) {
        // Handle comma-separated statuses
        const statuses = status.split(',').map(s => `'${s.trim()}'`).join(',');
        conditions.push(`wo.status IN (${statuses})`);
      } else {
        conditions.push(`wo.status = ?`);
        params.push(status);
      }
    }
    
    if (search && search.trim()) {
      conditions.push(`(wo.work_order_id LIKE ? OR wo.customer_name LIKE ? OR wo.category_name LIKE ? OR wo.property_name LIKE ?)`);
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY wo.created_at DESC LIMIT 500`;

    const [workOrders] = await pool.execute(query, params);

    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }

    res.json({
      success: true,
      data: workOrders
    });
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching work orders',
      error: error.message
    });
  }
});

// Create work order (Admin)
router.post('/work-orders', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const {
      propertyId, categoryId, subcategoryId, customSubcategory, description, priority,
      permissionToEnter, hasPet, entryNotes, scheduledDate,
      propertyName, categoryName, subcategoryName, customerName, customerEmail, customerPhone,
      franchisePartnerId
    } = req.body;

    if (!propertyId || !categoryId) {
      return res.status(400).json({ success: false, message: 'Property and category are required' });
    }

    // Generate work order ID
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const workOrderId = `WO-${timestamp}${random}`;

    // Get franchise partner ID from property if not provided
    let fpId = franchisePartnerId;
    if (!fpId) {
      const [propRows] = await pool.execute(
        `SELECT franchise_partner_id FROM onboarded_properties WHERE id = ? OR property_id = ?
         UNION
         SELECT franchise_partner_id FROM properties WHERE id = ? OR property_id = ?`,
        [propertyId, propertyId, propertyId, propertyId]
      );
      if (propRows.length > 0) {
        fpId = propRows[0].franchise_partner_id;
      }
    }

    // Get category and subcategory names from config
    const categoriesConfig = require('../config/categories');
    let catName = categoryName;
    let subCatName = subcategoryName || customSubcategory;
    
    if (!catName && categoryId) {
      const category = categoriesConfig.find(c => c.id === parseInt(categoryId));
      if (category) {
        catName = category.name;
        if (subcategoryId && category.subcategories) {
          const subcategory = category.subcategories.find(s => s.id === parseInt(subcategoryId));
          if (subcategory) subCatName = subcategory.name;
        }
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO work_orders (
        work_order_id, property_id, category_id, subcategory_id, custom_subcategory,
        description, priority, status, permission_to_enter, has_pet, entry_notes,
        scheduled_date, property_name, category_name, subcategory_name,
        customer_name, customer_email, customer_phone, franchise_partner_id,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        workOrderId, propertyId, categoryId || null, subcategoryId || null, customSubcategory || null,
        description || '', priority || 'medium', permissionToEnter || false, hasPet || false, entryNotes || '',
        scheduledDate || null, propertyName || '', catName || '', subCatName || '',
        customerName || '', customerEmail || '', customerPhone || '', fpId || null,
        req.user?.email || 'admin'
      ]
    );

    res.json({
      success: true,
      message: 'Work order created successfully',
      data: { id: result.insertId, workOrderId }
    });
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update work order (Admin, Manager only)
router.put('/work-orders/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, priority, assignedTo, scheduledDate, notes,
      category_id, subcategory_id, description,
      permission_to_enter, has_pet, entry_notes,
      customer_name, customer_email, customer_phone, block, flat_number
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (assignedTo !== undefined) { updates.push('assigned_to = ?'); params.push(assignedTo); }
    if (scheduledDate !== undefined) { updates.push('scheduled_date = ?'); params.push(scheduledDate); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id || null); }
    if (subcategory_id !== undefined) { updates.push('subcategory_id = ?'); params.push(subcategory_id || null); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (permission_to_enter !== undefined) { updates.push('permission_to_enter = ?'); params.push(permission_to_enter); }
    if (has_pet !== undefined) { updates.push('has_pet = ?'); params.push(has_pet); }
    if (entry_notes !== undefined) { updates.push('entry_notes = ?'); params.push(entry_notes); }
    if (customer_name !== undefined) { updates.push('customer_name = ?'); params.push(customer_name); }
    if (customer_email !== undefined) { updates.push('customer_email = ?'); params.push(customer_email); }
    if (customer_phone !== undefined) { updates.push('customer_phone = ?'); params.push(customer_phone); }
    if (block !== undefined) { updates.push('block = ?'); params.push(block); }
    if (flat_number !== undefined) { updates.push('flat_number = ?'); params.push(flat_number); }

    if (status === 'completed') {
      updates.push('completed_date = NOW()');
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const [result] = await pool.execute(
      `UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`,
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

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    res.json({
      success: true,
      message: 'Work order updated successfully'
    });
  } catch (error) {
    console.error('Error updating work order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating work order',
      error: error.message
    });
  }
});

// Get vendors list for admin
router.get('/vendors', async (req, res) => {
  try {
    const [vendors] = await pool.execute(
      `SELECT id, vendor_id, company_name, owner_name, service_type, phone, email, status 
       FROM onboarded_vendors WHERE status = 'active' OR is_active = 1 ORDER BY company_name`
    );
    res.json({ success: true, vendors });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get employees list for admin
router.get('/employees', async (req, res) => {
  try {
    const [employees] = await pool.execute(
      `SELECT id, first_name, last_name, email, phone, role FROM admins WHERE is_active = 1 ORDER BY first_name`
    );
    res.json({ success: true, employees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get vendor assignments for admin
router.get('/vendors/assignments', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        COALESCE(p.name, op.community_name) as property_name, 
        COALESCE(p.property_type, op.property_type) as property_type, 
        COALESCE(p.address, op.address) as address, 
        COALESCE(p.city, op.city) as city,
        v.owner_name as vendor_name, v.vendor_id as vendor_code, COALESCE(pva.service_type, v.service_type) as service_type,
        v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
        v.zone as zone_name, v.area_name as area, v.rate_per_visit
      FROM property_vendor_assignments pva
      LEFT JOIN properties p ON pva.property_id = p.id
      LEFT JOIN onboarded_properties op ON pva.property_id = op.id
      JOIN onboarded_vendors v ON pva.vendor_id = v.id
    `;
    
    if (status === 'active') {
      query += ` WHERE pva.is_active = 1`;
    } else if (status === 'removed') {
      query += ` WHERE pva.is_active = 0`;
    }
    
    query += ` ORDER BY pva.assigned_at DESC`;
    
    const [assignments] = await pool.execute(query);
    
    // IMPORTANT: propertyId must be the NUMERIC ID for filtering to work
    res.json({
      success: true,
      data: assignments.map(a => ({
        id: a.id,
        propertyId: a.property_id,
        property_id: a.property_id,
        propertyName: a.property_name || 'Unknown Property',
        propertyType: a.property_type,
        address: a.address,
        city: a.city,
        vendorId: a.vendor_id,
        vendorCode: a.vendor_code,
        vendorName: a.vendor_name,
        vendor_name: a.vendor_name,
        serviceType: a.service_type,
        service_type: a.service_type,
        vendorPhone: a.vendor_phone,
        vendor_phone: a.vendor_phone,
        vendorEmail: a.vendor_email,
        zoneName: a.zone_name,
        zone_name: a.zone_name,
        area: a.area,
        ratePerVisit: a.rate_per_visit,
        assignedAt: a.assigned_at,
        status: a.is_active ? 'active' : 'removed'
      }))
    });
  } catch (error) {
    console.error('Get vendor assignments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: error.message });
  }
});

// Delete work order (Admin only)
router.delete('/work-orders/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Delete work order request - ID:', id, 'User:', req.user?.role, req.user?.email);
    
    // First check if work order exists
    const [existing] = await pool.execute('SELECT id, work_order_id FROM work_orders WHERE id = ?', [id]);
    if (existing.length === 0) {
      console.log('Work order not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }
    
    const [result] = await pool.execute(
      `DELETE FROM work_orders WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Work order not found'
      });
    }

    console.log('Work order deleted successfully:', id);
    res.json({
      success: true,
      message: 'Work order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting work order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting work order: ' + error.message,
      error: error.message
    });
  }
});

// ============================================
// DASHBOARD STATS (Public - no auth required)
// ============================================

router.get('/dashboard/stats', async (req, res) => {
  try {
    // Run all queries in parallel for faster response
    const [
      propertiesResult,
      vendorsResult,
      customersResult,
      workOrdersResult,
      estimatesResult,
      zonesResult
    ] = await Promise.all([
      // Properties count
      pool.execute(`SELECT COUNT(*) as count FROM onboarded_properties WHERE status = 'active'`)
        .then(([[r]]) => r.count)
        .catch(() => pool.execute(`SELECT COUNT(*) as count FROM properties WHERE (status IS NULL OR status != 'deleted')`)
          .then(([[r]]) => r.count)
          .catch(() => 0)),
      
      // Vendors count
      pool.execute(`SELECT COUNT(*) as count FROM onboarded_vendors WHERE status = 'active'`)
        .then(([[r]]) => r.count)
        .catch(() => pool.execute(`SELECT COUNT(*) as count FROM onboarded_vendors WHERE is_active = 1`)
          .then(([[r]]) => r.count)
          .catch(() => 0)),
      
      // Customers count
      pool.execute(`SELECT COUNT(*) as count FROM residents WHERE is_active = 1`)
        .then(([[r]]) => r.count)
        .catch(() => 0),
      
      // Work orders - single query with conditional counts
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('pending', 'open', 'in_progress', 'under_review', 'assigned') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed', 'verified') THEN 1 ELSE 0 END) as completed
        FROM work_orders
      `).then(([[r]]) => ({ total: r.total || 0, pending: r.pending || 0, completed: r.completed || 0 }))
        .catch(() => ({ total: 0, pending: 0, completed: 0 })),
      
      // Estimates count (non-archived only)
      pool.execute(`SELECT COUNT(*) as count FROM estimates WHERE (is_archived = 0 OR is_archived IS NULL)`)
        .then(([[r]]) => r.count)
        .catch(() => 0),
      
      // Zones count
      pool.execute(`SELECT COUNT(DISTINCT zone) as count FROM onboarded_properties WHERE zone IS NOT NULL AND zone != '' AND status = 'active'`)
        .then(([[r]]) => r.count)
        .catch(() => 0)
    ]);

    res.json({
      success: true,
      data: {
        properties: propertiesResult,
        vendors: vendorsResult,
        customers: customersResult,
        workOrders: workOrdersResult.total,
        pendingWorkOrders: workOrdersResult.pending,
        completedWorkOrders: workOrdersResult.completed,
        totalEstimates: estimatesResult,
        totalZones: zonesResult,
        activeWorkOrders: workOrdersResult.pending
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
});

// ============================================
// RECENT ACTIVITIES (Public)
// ============================================

router.get('/dashboard/recent-activities', async (req, res) => {
  try {
    // Run all queries in parallel for faster response
    const [workOrders, props, vends] = await Promise.all([
      // Recent work orders
      pool.execute(`
        SELECT id, work_order_id, title, status, created_at 
        FROM work_orders 
        ORDER BY created_at DESC 
        LIMIT 5
      `).then(([rows]) => rows).catch(() => []),
      
      // Recent properties
      pool.execute(`
        SELECT id, property_id, community_name, created_at 
        FROM onboarded_properties 
        WHERE status = 'active'
        ORDER BY created_at DESC 
        LIMIT 3
      `).then(([rows]) => rows).catch(() => []),
      
      // Recent vendors
      pool.execute(`
        SELECT id, vendor_id, company_name, created_at 
        FROM onboarded_vendors 
        WHERE status = 'active'
        ORDER BY created_at DESC 
        LIMIT 3
      `).then(([rows]) => rows).catch(() => [])
    ]);

    // Build activities array
    const activities = [
      ...workOrders.map(wo => ({
        id: `wo-${wo.id}`,
        type: 'workorder',
        message: `Work order ${wo.work_order_id || '#' + wo.id}: ${wo.title || 'New work order'} - ${wo.status}`,
        time: formatTimeAgo(wo.created_at),
        timestamp: wo.created_at
      })),
      ...props.map(p => ({
        id: `prop-${p.id}`,
        type: 'property',
        message: `Property ${p.community_name || p.property_id} was added`,
        time: formatTimeAgo(p.created_at),
        timestamp: p.created_at
      })),
      ...vends.map(v => ({
        id: `vend-${v.id}`,
        type: 'vendor',
        message: `Vendor ${v.company_name || v.vendor_id} was onboarded`,
        time: formatTimeAgo(v.created_at),
        timestamp: v.created_at
      }))
    ];

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: activities.slice(0, 10)
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.json({ success: true, data: [] });
  }
});

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return past.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ============================================
// NOTIFICATIONS
// ============================================

router.get('/notifications', async (req, res) => {
  try {
    // Return system notifications based on recent activities
    const notifications = [];
    
    // Check for pending work orders
    try {
      const [[pendingCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status IN ('pending', 'open', 'assigned', 'in_progress', 'under_review', 'accepted')`);
      if (pendingCount.count > 0) {
        notifications.push({
          id: 'pending-wo',
          type: 'warning',
          message: `${pendingCount.count} work order${pendingCount.count > 1 ? 's' : ''} pending action`,
          time: 'Now',
          read: false
        });
      }
    } catch (e) {}

    // Check for recent properties
    try {
      const [[recentProps]] = await pool.execute(`SELECT COUNT(*) as count FROM onboarded_properties WHERE status = 'active' AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
      if (recentProps.count > 0) {
        notifications.push({
          id: 'new-props',
          type: 'success',
          message: `${recentProps.count} new propert${recentProps.count > 1 ? 'ies' : 'y'} added today`,
          time: 'Today',
          read: false
        });
      }
    } catch (e) {}

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.json({ success: true, data: [] });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  res.json({ success: true, message: 'Notification marked as read' });
});

router.put('/notifications/read-all', async (req, res) => {
  res.json({ success: true, message: 'All notifications marked as read' });
});

// ============================================
// FP VIEW MODE - Admin views FP data (READ-ONLY)
// ============================================

// Helper to validate and parse FP ID
const validateFpId = (fpId) => {
  if (!fpId || isNaN(parseInt(fpId))) return null;
  return parseInt(fpId);
};

// Get aggregated dashboard stats for Admin (all data from all FPs)
router.get('/dashboard-stats', authenticate, adminOnly, async (req, res) => {
  try {
    // Helper function to safely get count (handles missing tables)
    const safeCount = (query, params = []) => {
      return pool.execute(query, params)
        .then(([result]) => result[0]?.count || 0)
        .catch((e) => {
          console.log(`Admin dashboard query skipped: ${e.message}`);
          return 0;
        });
    };

    // Run all queries in parallel - count ALL data from FP tables
    const [
      properties,
      onboardedVendors,
      fpEmployees,
      workOrderStats,
      directEstimates,
      propertyEstimates,
      estimatesByPropertyType,
      recentWorkOrders
    ] = await Promise.all([
      // ALL properties (exclude deleted)
      safeCount('SELECT COUNT(*) as count FROM properties WHERE status IS NULL OR status != \'deleted\''),
      // Onboarded vendors (FP vendors - active only)
      safeCount('SELECT COUNT(*) as count FROM onboarded_vendors WHERE status = \'active\''),
      // FP employees
      safeCount('SELECT COUNT(*) as count FROM fp_employees WHERE is_active = 1'),
      // Work orders - combined query for all work orders with detailed status breakdown
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) as under_review,
          SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
        FROM work_orders
      `).then(([[r]]) => ({ 
        total: Number(r.total) || 0, 
        pending: Number(r.pending) || 0,
        under_review: Number(r.under_review) || 0,
        assigned: Number(r.assigned) || 0,
        in_progress: Number(r.in_progress) || 0,
        completed: Number(r.completed) || 0,
        cancelled: Number(r.cancelled) || 0,
        closed: Number(r.closed) || 0
      })).catch(() => ({ total: 0, pending: 0, under_review: 0, assigned: 0, in_progress: 0, completed: 0, cancelled: 0, closed: 0 })),
      // Direct Estimates (non-archived, active only)
      safeCount(`SELECT COUNT(*) as count FROM fp_estimates 
        WHERE (is_archived = 0 OR is_archived IS NULL) 
        AND status NOT IN ('archived', 'rejected', 'deleted')
        AND estimate_type = 'direct'`),
      // Property-based Estimates (non-archived, active only)
      safeCount(`SELECT COUNT(*) as count FROM fp_estimates 
        WHERE (is_archived = 0 OR is_archived IS NULL) 
        AND status NOT IN ('archived', 'rejected', 'deleted')
        AND (estimate_type = 'property_based' OR estimate_type = 'property-based')`),
      // Estimates breakdown - Direct and Property-based by property type (codes: GC, APT, AP, VILLA, VL, FLAT, FL, PLOT, PL)
      pool.execute(`
        SELECT 
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) = 'GC' OR LOWER(property_type) LIKE '%gated%') THEN 1 ELSE 0 END) as direct_gc,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('APT', 'AP') OR LOWER(property_type) LIKE '%apartment%') THEN 1 ELSE 0 END) as direct_apt,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('VILLA', 'VL') OR LOWER(property_type) LIKE '%villa%') THEN 1 ELSE 0 END) as direct_villa,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('FLAT', 'FL') OR LOWER(property_type) LIKE '%flat%') THEN 1 ELSE 0 END) as direct_flat,
          SUM(CASE WHEN estimate_type = 'direct' AND (UPPER(property_type) IN ('PLOT', 'PL') OR LOWER(property_type) LIKE '%plot%') THEN 1 ELSE 0 END) as direct_plot,
          SUM(CASE WHEN estimate_type = 'direct' AND (property_type IS NULL OR property_type = '' OR (UPPER(property_type) NOT IN ('GC', 'APT', 'AP', 'VILLA', 'VL', 'FLAT', 'FL', 'PLOT', 'PL') AND LOWER(property_type) NOT LIKE '%gated%' AND LOWER(property_type) NOT LIKE '%apartment%' AND LOWER(property_type) NOT LIKE '%villa%' AND LOWER(property_type) NOT LIKE '%flat%' AND LOWER(property_type) NOT LIKE '%plot%')) THEN 1 ELSE 0 END) as direct_other,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) = 'GC' OR LOWER(property_type) LIKE '%gated%') THEN 1 ELSE 0 END) as prop_gc,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('APT', 'AP') OR LOWER(property_type) LIKE '%apartment%') THEN 1 ELSE 0 END) as prop_apt,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('VILLA', 'VL') OR LOWER(property_type) LIKE '%villa%') THEN 1 ELSE 0 END) as prop_villa,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('FLAT', 'FL') OR LOWER(property_type) LIKE '%flat%') THEN 1 ELSE 0 END) as prop_flat,
          SUM(CASE WHEN (estimate_type = 'property_based' OR estimate_type = 'property-based') AND (UPPER(property_type) IN ('PLOT', 'PL') OR LOWER(property_type) LIKE '%plot%') THEN 1 ELSE 0 END) as prop_plot
        FROM fp_estimates WHERE (is_archived = 0 OR is_archived IS NULL) AND status NOT IN ('archived', 'rejected', 'deleted')
      `).then(([[r]]) => ({
        direct_gc: Number(r?.direct_gc) || 0, direct_apt: Number(r?.direct_apt) || 0, direct_villa: Number(r?.direct_villa) || 0, direct_flat: Number(r?.direct_flat) || 0, direct_plot: Number(r?.direct_plot) || 0, direct_other: Number(r?.direct_other) || 0,
        prop_gc: Number(r?.prop_gc) || 0, prop_apt: Number(r?.prop_apt) || 0, prop_villa: Number(r?.prop_villa) || 0, prop_flat: Number(r?.prop_flat) || 0, prop_plot: Number(r?.prop_plot) || 0
      })).catch(() => ({ direct_gc: 0, direct_apt: 0, direct_villa: 0, direct_flat: 0, direct_plot: 0, direct_other: 0, prop_gc: 0, prop_apt: 0, prop_villa: 0, prop_flat: 0, prop_plot: 0 })),
      // Recent work orders
      pool.execute(
        `SELECT wo.id, wo.work_order_id, wo.title, wo.status, wo.priority, wo.created_at,
                COALESCE(p.name, wo.property_name) as property_name, fp.company_name as fp_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN franchise_partners fp ON wo.franchise_partner_id = fp.id
         ORDER BY wo.created_at DESC
         LIMIT 10`
      ).then(([rows]) => rows).catch(() => [])
    ]);
    
    console.log('Admin Dashboard Stats:', { properties, onboardedVendors, fpEmployees, workOrderStats, directEstimates, propertyEstimates });
    
    res.json({
      success: true,
      data: {
        totalProperties: properties,
        totalVendors: onboardedVendors,
        totalEmployees: fpEmployees,
        pendingWorkOrders: workOrderStats.pending,
        completedWorkOrders: workOrderStats.completed + workOrderStats.closed,
        directEstimates: directEstimates,
        propertyEstimates: propertyEstimates,
        estimatesByPropertyType,
        recentWorkOrders: recentWorkOrders,
        workOrdersByStatus: {
          pending: workOrderStats.pending,
          under_review: workOrderStats.under_review,
          assigned: workOrderStats.assigned,
          in_progress: workOrderStats.in_progress,
          completed: workOrderStats.completed,
          cancelled: workOrderStats.cancelled,
          closed: workOrderStats.closed
        }
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get list of all FPs for dropdown selection
router.get('/fp-list', authenticate, adminOnly, async (req, res) => {
  try {
    const [fps] = await pool.execute(
      `SELECT id, fp_code, company_name, owner_name, city, state, is_active 
       FROM franchise_partners 
       WHERE is_active = 1 OR is_active = 1 OR is_active IS NULL
       ORDER BY company_name ASC`
    );
    
    res.json({ 
      success: true, 
      data: fps.map(fp => ({
        id: fp.id,
        fpId: fp.fp_code,
        companyName: fp.company_name,
        ownerName: fp.owner_name,
        city: fp.city,
        state: fp.state,
        displayName: `${fp.fp_code} - ${fp.company_name}`
      }))
    });
  } catch (error) {
    console.error('Error fetching FP list:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get ALL properties from ALL FPs (Admin mode)
router.get('/all-properties', authenticate, adminOnly, async (req, res) => {
  try {
    const { status } = req.query; // 'active', 'inactive', or 'all'
    
    // Build status filter clause
    let statusClause;
    if (status === 'inactive') {
      statusClause = `AND p.status = 'inactive'`;
    } else if (status === 'all') {
      statusClause = `AND (p.status IS NULL OR p.status IN ('active', 'inactive'))`;
    } else {
      // Default: active only (exclude inactive and deleted)
      statusClause = `AND (p.status IS NULL OR p.status = 'active')`;
    }
    
    // Regular properties from all FPs - all fields with creator name
    const [properties] = await pool.execute(
      `SELECT p.id, p.property_id, p.name, p.property_type,
              p.zone_id as zone_name, p.area_name as area,
              p.division_id as division,
              p.address, p.city, p.state, p.zip_code,
              p.contact_person, p.contact_phone, p.contact_email,
              p.created_at, p.status,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                p.created_by, 'System'
              ) as created_by,
              'properties' as source_table,
              p.franchise_partner_id as fp_id, fp.fp_code, fp.company_name as fp_name,
              COALESCE(p.category, 'residential') as category
       FROM properties p
       LEFT JOIN franchise_partners fp ON p.franchise_partner_id = fp.id
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
       LEFT JOIN users u ON p.created_by = u.email OR p.created_by = u.username OR CAST(p.created_by AS CHAR) = CAST(u.id AS CHAR) OR p.created_by = u.user_id
       WHERE 1=1 ${statusClause}
       ORDER BY p.created_at DESC`
    );
    
    console.log('Admin all-properties: Found', properties.length, 'regular properties');
    
    // Onboarded properties from all FPs - build status clause for onboarded_properties
    let onboardedStatusClause;
    if (status === 'inactive') {
      onboardedStatusClause = `AND op.status = 'inactive'`;
    } else if (status === 'all') {
      onboardedStatusClause = `AND (op.status IS NULL OR op.status IN ('active', 'inactive'))`;
    } else {
      // Default: active only
      onboardedStatusClause = `AND (op.status IS NULL OR op.status = 'active')`;
    }
    
    let onboardedProps = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, 
                COALESCE(op.entry_type, op.property_type) as property_type,
                op.entry_type,
                op.zone as zone_name, op.area_name as area, op.division,
                op.address, op.city, op.state, op.postal_code as zip_code,
                op.number_of_units as total_units, op.total_units as units_count,
                op.number_of_blocks, op.block_names, op.units_per_block, op.block_unit_types,
                op.watchman_name, op.watchman_contact,
                NULL as contact_person, NULL as contact_phone, NULL as contact_email,
                op.created_at, op.status,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                  op.created_by, 'System'
                ) as created_by,
                'onboarded_properties' as source_table,
                op.franchise_partner_id as fp_id, fp.fp_code, fp.company_name as fp_name,
                COALESCE(op.category, 'residential') as category
         FROM onboarded_properties op
         LEFT JOIN franchise_partners fp ON op.franchise_partner_id = fp.id
         LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR op.created_by = fpe.username OR CAST(op.created_by AS CHAR) = CAST(fpe.id AS CHAR)
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.username OR CAST(op.created_by AS CHAR) = CAST(u.id AS CHAR) OR op.created_by = u.user_id
         WHERE 1=1 ${onboardedStatusClause}
         ORDER BY op.created_at DESC`
      );
      onboardedProps = rows;
      console.log('Admin all-properties: Found', onboardedProps.length, 'onboarded properties');
    } catch (e) {
      console.log('onboarded_properties query skipped:', e.message);
    }
    
    const allProps = [...properties, ...onboardedProps];
    console.log('Admin all-properties: Total', allProps.length, 'properties');
    
    res.json({ success: true, data: allProps });
  } catch (error) {
    console.error('Error fetching all properties:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
});

// Get ALL work orders from ALL FPs (Admin mode)
router.get('/all-work-orders', authenticate, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    
    // Match FP endpoint query structure for consistency
    let query = `
      SELECT wo.*, 
             COALESCE(p.name, op.community_name, wo.property_name) as property_name,
             COALESCE(p.property_id, op.property_id, wo.property_id) as property_code,
             COALESCE(p.property_type, op.property_type, wo.property_type) as property_type,
             COALESCE(p.zone_id, op.zone) as zone,
             COALESCE(p.division_id, op.division) as division,
             COALESCE(p.address, op.address) as address,
             COALESCE(p.city, op.city) as city,
             COALESCE(p.state, op.state) as state,
             COALESCE(p.contact_person, op.contact_person) as contact_person,
             COALESCE(p.contact_phone, op.contact_phone) as contact_phone,
             COALESCE(p.contact_email, op.contact_email) as contact_email,
             COALESCE(c.name, wo.category_name) as category_name,
             wo.subcategory_name,
             fp.fp_code, fp.company_name as fp_name,
             v.company_name as vendor_name,
             COALESCE(
               CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
               CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
               wo.created_by, 'System'
             ) as created_by_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN franchise_partners fp ON wo.franchise_partner_id = fp.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username OR CAST(wo.created_by AS UNSIGNED) = fpe.id
      LEFT JOIN users u ON wo.created_by = u.email OR wo.created_by = u.username OR wo.created_by = u.user_id OR CAST(wo.created_by AS UNSIGNED) = u.id
      WHERE 1=1
    `;
    
    if (status === 'pending') {
      query += ` AND wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`;
    } else if (status === 'completed') {
      query += ` AND wo.status IN ('completed', 'closed')`;
    }
    
    query += ` ORDER BY wo.created_at DESC LIMIT 500`;
    
    const [workOrders] = await pool.execute(query);
    
    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }
    
    console.log('Admin all-work-orders: Found', workOrders.length, 'work orders');
    res.json({ success: true, data: workOrders || [] });
  } catch (error) {
    console.error('Error fetching all work orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work orders' });
  }
});

// Get ALL estimates from ALL FPs (Admin mode)
router.get('/all-estimates', authenticate, adminOnly, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true' ? 1 : 0;
    
    console.log('Fetching all estimates, archived:', isArchived);
    
    // Get from main estimates table with AMC package services
    // Note: estimates table uses customer_name, total (not total_amount), and may not have franchise_partner_id
    let mainEstimates = [];
    try {
      let query;
      if (isArchived) {
        query = `SELECT e.*, 'estimates' as source_table, NULL as fp_code, NULL as fp_name,
                        e.estimate_id as estimateId, 
                        COALESCE(e.customer_name, e.property_name, 'Direct Estimate') as clientName, 
                        COALESCE(e.customer_name, e.property_name, 'Direct Estimate') as customerName,
                        COALESCE(e.estimate_type, 'direct') as estimateType, 
                        e.property_type as propertyType,
                        COALESCE(e.total, e.total_amount, 0) as totalPrice, 
                        e.archived_at as archivedAt, 
                        e.created_at as createdAt,
                        e.amc_package_description
                 FROM estimates e
                 WHERE e.is_archived = 1 ORDER BY e.created_at DESC`;
      } else {
        query = `SELECT e.*, 'estimates' as source_table, NULL as fp_code, NULL as fp_name,
                        e.estimate_id as estimateId, 
                        COALESCE(e.customer_name, e.property_name, 'Direct Estimate') as clientName, 
                        COALESCE(e.customer_name, e.property_name, 'Direct Estimate') as customerName,
                        COALESCE(e.estimate_type, 'direct') as estimateType, 
                        e.property_type as propertyType,
                        COALESCE(e.total, e.total_amount, 0) as totalPrice, 
                        e.archived_at as archivedAt, 
                        e.created_at as createdAt,
                        e.amc_package_description
                 FROM estimates e
                 WHERE (e.is_archived = 0 OR e.is_archived IS NULL) 
                   AND (e.is_active = 1 OR e.is_active IS NULL)
                 ORDER BY e.created_at DESC`;
      }
      const [results] = await pool.execute(query);
      mainEstimates = results;
      console.log('Main estimates found:', mainEstimates.length);
    } catch (e) {
      console.log('Main estimates query error:', e.message);
    }
    
    // Get from fp_estimates table with AMC package services
    let fpEstimates = [];
    try {
      let query;
      if (isArchived) {
        query = `SELECT fe.*, 'fp_estimates' as source_table, fp.fp_code, fp.company_name as fp_name,
                        fe.estimate_id as estimateId, fe.client_name as clientName, fe.client_name as customerName,
                        fe.estimate_type as estimateType, fe.property_type as propertyType,
                        fe.total_amount as totalPrice, fe.archived_at as archivedAt, fe.created_at as createdAt,
                        fpamc.services as packageServices,
                        COALESCE(fe.amc_package_description, fpamc.description) as amc_package_description
                 FROM fp_estimates fe
                 LEFT JOIN franchise_partners fp ON fe.franchise_partner_id = fp.id
                 LEFT JOIN fp_amc_packages fpamc ON fe.package_id = fpamc.id
                 WHERE fe.is_archived = 1 ORDER BY fe.created_at DESC`;
      } else {
        query = `SELECT fe.*, 'fp_estimates' as source_table, fp.fp_code, fp.company_name as fp_name,
                        fe.estimate_id as estimateId, fe.client_name as clientName, fe.client_name as customerName,
                        fe.estimate_type as estimateType, fe.property_type as propertyType,
                        fe.total_amount as totalPrice, fe.archived_at as archivedAt, fe.created_at as createdAt,
                        fpamc.services as packageServices,
                        COALESCE(fe.amc_package_description, fpamc.description) as amc_package_description
                 FROM fp_estimates fe
                 LEFT JOIN franchise_partners fp ON fe.franchise_partner_id = fp.id
                 LEFT JOIN fp_amc_packages fpamc ON fe.package_id = fpamc.id
                 WHERE (fe.is_archived = 0 OR fe.is_archived IS NULL) ORDER BY fe.created_at DESC`;
      }
      const [results] = await pool.execute(query);
      fpEstimates = results;
      console.log('FP estimates found:', fpEstimates.length);
    } catch (e) {
      console.log('FP estimates query error:', e.message);
    }
    
    // Combine and sort by created_at
    let allEstimates = [...mainEstimates, ...fpEstimates].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    // Enrich estimates with missing division and addon descriptions
    allEstimates = await Promise.all(allEstimates.map(async (est) => {
      // Enrich division
      if (!est.division && (est.property_name || est.property_code || est.property_id)) {
        try {
          let [props] = await pool.execute(
            `SELECT division, division_id FROM properties WHERE 
             (name = ? OR property_id = ? OR id = ?) AND franchise_partner_id = ? LIMIT 1`,
            [est.property_name || '', est.property_code || '', est.property_id || 0, est.franchise_partner_id || 0]
          );
          if (props.length > 0 && (props[0].division || props[0].division_id)) {
            est.division = props[0].division || props[0].division_id;
          }
          if (!est.division) {
            [props] = await pool.execute(
              `SELECT division FROM onboarded_properties WHERE 
               (community_name = ? OR property_id = ?) AND franchise_partner_id = ? LIMIT 1`,
              [est.property_name || '', est.property_code || '', est.franchise_partner_id || 0]
            );
            if (props.length > 0 && props[0].division) {
              est.division = props[0].division;
            }
          }
        } catch (e) { /* ignore lookup errors */ }
      }
      
      // Enrich addons with descriptions - match by property_type
      if (est.addons_data && est.franchise_partner_id) {
        try {
          let addons = typeof est.addons_data === 'string' ? JSON.parse(est.addons_data) : est.addons_data;
          const [fpAddons] = await pool.execute(
            `SELECT id, service_name, description, property_type FROM fp_addons WHERE franchise_partner_id = ?`,
            [est.franchise_partner_id]
          );
          const estPropertyType = est.property_type?.toUpperCase();
          addons = addons.map(addon => {
            if (!addon.description) {
              const addonName = addon.name || addon.service_name || '';
              const addonId = addon.id || addon.addon_id;
              let foundAddon = fpAddons.find(a => a.id == addonId);
              if (!foundAddon || !foundAddon.description) {
                foundAddon = fpAddons.find(a => 
                  (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                  a.property_type?.toUpperCase() === estPropertyType
                );
              }
              if (foundAddon && foundAddon.description) {
                addon.description = foundAddon.description;
              }
            }
            return addon;
          });
          est.addons = addons;
        } catch (e) { /* ignore addon parse errors */ }
      }
      return est;
    }));
    
    console.log('Admin all-estimates: Total', allEstimates.length, 'estimates');
    res.json({ success: true, data: allEstimates || [] });
  } catch (error) {
    console.error('Error fetching all estimates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
  }
});

// Get FP-specific estimates
router.get('/fp-view/:fpId/estimates', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const { archived } = req.query;
    const isArchived = archived === 'true' ? 1 : 0;
    
    console.log('Fetching estimates for FP:', fpIdNum, 'archived:', isArchived);
    
    // Get from main estimates table with AMC package services
    let mainEstimates = [];
    try {
      let query;
      if (isArchived) {
        query = `SELECT e.*, 'estimates' as source_table,
                        e.estimate_id as estimateId, e.customer_name as clientName, e.customer_name as customerName,
                        e.estimate_type as estimateType, e.property_type as propertyType,
                        e.total_amount as totalPrice, e.archived_at as archivedAt, e.created_at as createdAt,
                        fpamc.services as packageServices
                 FROM estimates e
                 LEFT JOIN fp_amc_packages fpamc ON e.package_id = fpamc.id
                 WHERE e.franchise_partner_id = ? AND e.is_archived = 1 ORDER BY e.created_at DESC`;
      } else {
        query = `SELECT e.*, 'estimates' as source_table,
                        e.estimate_id as estimateId, e.customer_name as clientName, e.customer_name as customerName,
                        e.estimate_type as estimateType, e.property_type as propertyType,
                        e.total_amount as totalPrice, e.archived_at as archivedAt, e.created_at as createdAt,
                        fpamc.services as packageServices
                 FROM estimates e
                 LEFT JOIN fp_amc_packages fpamc ON e.package_id = fpamc.id
                 WHERE e.franchise_partner_id = ? AND (e.is_archived = 0 OR e.is_archived IS NULL) ORDER BY e.created_at DESC`;
      }
      const [results] = await pool.execute(query, [fpIdNum]);
      mainEstimates = results;
      console.log('Main estimates found:', mainEstimates.length);
    } catch (e) {
      console.log('Main estimates query error:', e.message);
    }
    
    // Get from fp_estimates table with AMC package services
    let fpEstimates = [];
    try {
      let query;
      if (isArchived) {
        query = `SELECT fe.*, 'fp_estimates' as source_table,
                        fe.estimate_id as estimateId, fe.client_name as clientName, fe.client_name as customerName,
                        fe.estimate_type as estimateType, fe.property_type as propertyType,
                        fe.total_amount as totalPrice, fe.archived_at as archivedAt, fe.created_at as createdAt,
                        fpamc.services as packageServices
                 FROM fp_estimates fe
                 LEFT JOIN fp_amc_packages fpamc ON fe.package_id = fpamc.id
                 WHERE fe.franchise_partner_id = ? AND fe.is_archived = 1 ORDER BY fe.created_at DESC`;
      } else {
        query = `SELECT fe.*, 'fp_estimates' as source_table,
                        fe.estimate_id as estimateId, fe.client_name as clientName, fe.client_name as customerName,
                        fe.estimate_type as estimateType, fe.property_type as propertyType,
                        fe.total_amount as totalPrice, fe.archived_at as archivedAt, fe.created_at as createdAt,
                        fpamc.services as packageServices
                 FROM fp_estimates fe
                 LEFT JOIN fp_amc_packages fpamc ON fe.package_id = fpamc.id
                 WHERE fe.franchise_partner_id = ? AND (fe.is_archived = 0 OR fe.is_archived IS NULL) ORDER BY fe.created_at DESC`;
      }
      const [results] = await pool.execute(query, [fpIdNum]);
      fpEstimates = results;
      console.log('FP estimates found:', fpEstimates.length);
    } catch (e) {
      console.log('FP estimates query error:', e.message);
    }
    
    // Combine and sort by created_at
    let allEstimates = [...mainEstimates, ...fpEstimates].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
    
    // Enrich addons with descriptions - match by property_type
    const [fpAddons] = await pool.execute(
      `SELECT id, service_name, description, property_type FROM fp_addons WHERE franchise_partner_id = ?`,
      [fpIdNum]
    );
    allEstimates = allEstimates.map(est => {
      if (est.addons_data) {
        try {
          let addons = typeof est.addons_data === 'string' ? JSON.parse(est.addons_data) : est.addons_data;
          const estPropertyType = est.property_type?.toUpperCase();
          addons = addons.map(addon => {
            if (!addon.description) {
              const addonName = addon.name || addon.service_name || '';
              const addonId = addon.id || addon.addon_id;
              let foundAddon = fpAddons.find(a => a.id == addonId);
              if (!foundAddon || !foundAddon.description) {
                foundAddon = fpAddons.find(a => 
                  (a.service_name === addonName || a.service_name?.toLowerCase() === addonName?.toLowerCase()) &&
                  a.property_type?.toUpperCase() === estPropertyType
                );
              }
              if (foundAddon && foundAddon.description) {
                addon.description = foundAddon.description;
              }
            }
            return addon;
          });
          est.addons = addons;
        } catch (e) { /* ignore */ }
      }
      return est;
    });
    
    console.log('Admin fp-view estimates: Total', allEstimates.length, 'for FP', fpIdNum);
    res.json({ success: true, data: allEstimates || [] });
  } catch (error) {
    console.error('Error fetching FP estimates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
  }
});

// Bulk archive estimates (Admin)
router.put('/estimates/bulk-archive', authenticate, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No estimate IDs provided' });
    }
    
    // Create placeholders for SQL IN clause
    const placeholders = ids.map(() => '?').join(',');
    
    const [result] = await pool.execute(
      `UPDATE fp_estimates SET is_archived = 1, archived_at = NOW() WHERE id IN (${placeholders})`,
      ids
    );
    
    res.json({ success: true, message: `${result.affectedRows} estimate(s) archived`, archivedCount: result.affectedRows });
  } catch (error) {
    console.error('Bulk archive estimates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update estimate details (full update for property-based estimates)
router.put('/estimates/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const estimateId = req.params.id;
    
    // Verify estimate exists
    const [[existing]] = await pool.execute(
      'SELECT * FROM fp_estimates WHERE id = ?',
      [estimateId]
    );
    
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Estimate not found' });
    }
    
    const {
      client_name, client_phone, client_email,
      property_name, property_code, property_type, zone, division, city, address,
      number_of_blocks, units_per_block, block_names, block_unit_types, total_units,
      tower_name, block_number, villa_plot_number,
      package_id, package_name, package_price, amc_package_description, package_services, billing_duration,
      subtotal, discount_percent, discount_amount, gst_percent, gst_amount, total_amount,
      addons_data, description
    } = req.body;
    
    // Convert JSON objects to strings
    const safeNum = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
    const unitsPerBlockJson = units_per_block ? JSON.stringify(units_per_block) : null;
    const blockNamesJson = block_names ? JSON.stringify(block_names) : null;
    const blockUnitTypesJson = block_unit_types ? JSON.stringify(block_unit_types) : null;
    const packageServicesJson = package_services ? JSON.stringify(package_services) : null;
    const addonsJson = addons_data ? JSON.stringify(addons_data) : null;
    
    // Calculate amounts
    const finalSubtotal = safeNum(subtotal, 0);
    const finalDiscountPercent = safeNum(discount_percent, 0);
    const finalDiscountAmount = safeNum(discount_amount, 0);
    const finalGstPercent = safeNum(gst_percent, 0);
    const finalGstAmount = safeNum(gst_amount, 0);
    const finalTotal = safeNum(total_amount, 0);
    
    await pool.execute(
      `UPDATE fp_estimates SET
        client_name = ?, client_phone = ?, client_email = ?,
        property_name = ?, property_code = ?, property_type = ?, zone = ?, division = ?, city = ?, address = ?,
        number_of_blocks = ?, units_per_block = ?, block_names = ?, block_unit_types = ?, total_units = ?,
        tower_name = ?, block_number = ?, villa_plot_number = ?,
        package_id = ?, package_name = ?, package_price = ?, amc_package_description = ?, package_services = ?, billing_duration = ?,
        subtotal = ?, discount_percent = ?, discount_amount = ?, gst_percent = ?, gst_amount = ?, total_amount = ?,
        addons_data = ?, description = ?, updated_at = NOW()
      WHERE id = ?`,
      [
        client_name || existing.client_name, client_phone || existing.client_phone, client_email || existing.client_email,
        property_name || existing.property_name, property_code || existing.property_code, property_type || existing.property_type,
        zone || existing.zone, division || existing.division, city || existing.city, address || existing.address,
        safeNum(number_of_blocks, existing.number_of_blocks), unitsPerBlockJson || existing.units_per_block,
        blockNamesJson || existing.block_names, blockUnitTypesJson || existing.block_unit_types, safeNum(total_units, existing.total_units),
        tower_name || existing.tower_name, block_number || existing.block_number, villa_plot_number || existing.villa_plot_number,
        package_id || existing.package_id, package_name || existing.package_name, safeNum(package_price, existing.package_price),
        amc_package_description || existing.amc_package_description, packageServicesJson || existing.package_services, billing_duration || existing.billing_duration,
        finalSubtotal, finalDiscountPercent, finalDiscountAmount, finalGstPercent, finalGstAmount, finalTotal,
        addonsJson || existing.addons_data, description !== undefined ? description : existing.description,
        estimateId
      ]
    );
    
    res.json({ success: true, message: 'Estimate updated successfully' });
  } catch (error) {
    console.error('Update estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get ALL employee zones from ALL FPs (Admin mode)
router.get('/all-employee-zones', authenticate, adminOnly, async (req, res) => {
  try {
    // Get employees first
    const [employees] = await pool.execute(
      `SELECT e.*, e.employee_code as employee_id,
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name,
              CASE WHEN e.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
              fp.fp_code, fp.company_name as fp_name
       FROM fp_employees e
       LEFT JOIN franchise_partners fp ON e.franchise_partner_id = fp.id
       ORDER BY e.first_name, e.last_name`
    );

    // Get all zone assignments
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones`
    );

    // Get all zones from multiple sources: zones table, fp_zones table, and property zone_id
    const allZoneNames = new Set();
    const combinedZones = [];
    
    // 1. Get global zones from zones table
    try {
      const [globalZones] = await pool.execute(
        'SELECT id, name FROM zones WHERE is_active = 1'
      );
      console.log('[Admin] Global zones from zones table:', globalZones.length, globalZones.map(z => z.name));
      globalZones.forEach(z => {
        if (z.name && !allZoneNames.has(z.name)) {
          allZoneNames.add(z.name);
          combinedZones.push({ id: z.id, name: z.name });
        }
      });
    } catch (e) {
      console.log('[Admin] Error fetching zones table:', e.message);
    }
    
    // 2. Get zones from fp_zones table (FP-created zones) - table may not exist
    try {
      const [fpZones] = await pool.execute(
        'SELECT id, name FROM fp_zones WHERE is_active = 1'
      );
      console.log('[Admin] FP zones from fp_zones table:', fpZones.length, fpZones.map(z => z.name));
      fpZones.forEach(z => {
        if (z.name && !allZoneNames.has(z.name)) {
          allZoneNames.add(z.name);
          combinedZones.push({ id: `fp-${z.id}`, name: z.name });
        }
      });
    } catch (e) {
      console.log('[Admin] fp_zones table may not exist:', e.message);
    }
    
    // 3. Get zones from properties table (zone_id column - may be string zone name)
    try {
      const [propertyZones] = await pool.execute(
        `SELECT DISTINCT zone_id FROM properties WHERE zone_id IS NOT NULL AND zone_id != ''
         AND (status = 'active' OR status IS NULL)`
      );
      console.log('[Admin] Property zones:', propertyZones.length, propertyZones.map(z => z.zone_id));
      propertyZones.forEach(z => {
        const zoneName = String(z.zone_id);
        if (zoneName && !allZoneNames.has(zoneName)) {
          allZoneNames.add(zoneName);
          combinedZones.push({ id: `prop-${zoneName}`, name: zoneName });
        }
      });
    } catch (e) {
      console.log('[Admin] Error fetching property zones:', e.message);
    }
    
    // 3b. Get zones from onboarded_properties table (customer zones)
    try {
      const [onboardedZones] = await pool.execute(
        `SELECT DISTINCT zone FROM onboarded_properties WHERE zone IS NOT NULL AND zone != ''
         AND (status = 'active' OR status IS NULL)`
      );
      console.log('[Admin] Onboarded property zones:', onboardedZones.length, onboardedZones.map(z => z.zone));
      onboardedZones.forEach(z => {
        const zoneName = String(z.zone);
        if (zoneName && !allZoneNames.has(zoneName)) {
          allZoneNames.add(zoneName);
          combinedZones.push({ id: `onboarded-${zoneName}`, name: zoneName });
        }
      });
    } catch (e) {
      console.log('[Admin] Error fetching onboarded property zones:', e.message);
    }
    
    // 4. MOST IMPORTANT: Get zones from fp_employee_zones (where zones are actually stored)
    try {
      const [assignedZones] = await pool.execute(
        `SELECT DISTINCT zone_name FROM fp_employee_zones WHERE zone_name IS NOT NULL AND zone_name != 'all'`
      );
      console.log('[Admin] Assigned zones from fp_employee_zones:', assignedZones.length, assignedZones.map(z => z.zone_name));
      assignedZones.forEach(z => {
        if (z.zone_name && !allZoneNames.has(z.zone_name)) {
          allZoneNames.add(z.zone_name);
          combinedZones.push({ id: `assigned-${z.zone_name}`, name: z.zone_name });
        }
      });
    } catch (e) {
      console.log('[Admin] Error fetching fp_employee_zones:', e.message);
    }
    
    // Sort combined zones by name
    combinedZones.sort((a, b) => a.name.localeCompare(b.name));
    const zones = combinedZones;
    console.log('[Admin] Final combined zones:', zones.length, zones.map(z => z.name));

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
      employeeId: emp.employee_code,
      assignedZones: employeeZonesMap[emp.id] || [],
      zone_names: (employeeZonesMap[emp.id] || []).join(', ') || 'No zones assigned',
      zone_count: (employeeZonesMap[emp.id] || []).length
    }));
    
    console.log('Admin all-employee-zones: Found', transformedEmployees.length, 'employees');
    res.json({ 
      success: true, 
      data: { 
        employees: transformedEmployees, 
        zones: zones 
      } 
    });
  } catch (error) {
    console.error('Error fetching all employee zones:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee zones' });
  }
});

// Get ALL employees from ALL sources (Admin mode)
router.get('/all-employees', authenticate, adminOnly, async (req, res) => {
  try {
    // Get employees from fp_employees table (FP-created employees)
    const [fpEmployees] = await pool.execute(
      `SELECT e.*, e.employee_code as employee_id, 
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name,
              CASE WHEN e.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
              fp.fp_code, fp.company_name as fp_name,
              'fp_employees' as source
       FROM fp_employees e
       LEFT JOIN franchise_partners fp ON e.franchise_partner_id = fp.id
       ORDER BY e.created_at DESC`
    );

    // Get employees from users table (Admin-created employees: manager, coordinator, supervisor, executive)
    // EXCLUDE those already in fp_employees to avoid duplicates
    const [userEmployees] = await pool.execute(
      `SELECT u.id, u.user_id as employee_id, u.user_id as employee_code,
              u.username, u.email, u.phone, u.first_name, u.last_name,
              CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as name,
              u.role, u.is_active,
              CASE WHEN u.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
              u.visible_password, u.created_at, u.updated_at,
              NULL as fp_code, 'Admin Portal' as fp_name,
              NULL as franchise_partner_id, NULL as aadhaar, NULL as country_code,
              'users' as source
       FROM users u
       WHERE u.role IN ('manager', 'coordinator', 'supervisor', 'executive')
         AND u.email NOT IN (SELECT email FROM fp_employees WHERE email IS NOT NULL)
       ORDER BY u.created_at DESC`
    );

    // Combine both lists
    const allEmployees = [...fpEmployees, ...userEmployees];

    // Get all zone assignments for fp_employees
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones`
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
    const transformedEmployees = allEmployees.map(emp => ({
      ...emp,
      assigned_zones: emp.source === 'fp_employees' ? (employeeZonesMap[emp.id] || []) : [],
      zone_names: emp.source === 'fp_employees' ? (employeeZonesMap[emp.id] || []).join(', ') : '',
      zone_count: emp.source === 'fp_employees' ? (employeeZonesMap[emp.id] || []).length : 0
    }));
    
    console.log('Admin all-employees: Found', transformedEmployees.length, 'employees (FP:', fpEmployees.length, '+ Admin:', userEmployees.length, ')');
    res.json({ success: true, data: transformedEmployees || [] });
  } catch (error) {
    console.error('Error fetching all employees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

// Get ALL vendor assignments from ALL FPs (Admin mode)
router.get('/all-vendor-assignments', authenticate, adminOnly, async (req, res) => {
  try {
    const [assignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at as assigned_date, pva.is_active,
              ov.vendor_id as vendor_code, ov.owner_name as vendor_name, COALESCE(pva.service_type, ov.service_type) as service_type, 
              ov.zone as vendor_zone, ov.zone as zone_name, ov.area_name as area, 
              ov.rate_per_visit, ov.coverage_per_day, ov.status as vendor_status,
              ov.owner_mobile as vendor_phone, ov.owner_email as vendor_email,
              ov.owner_aadhar, ov.manager_name, ov.manager_mobile, ov.manager_email,
              ov.poc_name, ov.poc_mobile, ov.poc_email, ov.service_verified,
              COALESCE(p.name, op.community_name) as property_name, 
              COALESCE(p.property_id, op.property_id) as propertyId,
              COALESCE(p.property_id, op.property_id) as property_code,
              COALESCE(p.property_type, op.property_type) as property_type, 
              COALESCE(p.zone_id, op.zone) as property_zone,
              COALESCE(p.franchise_partner_id, op.franchise_partner_id) as fp_id,
              fp.fp_code, fp.company_name as fp_name
       FROM property_vendor_assignments pva
       JOIN onboarded_vendors ov ON pva.vendor_id = ov.id
       LEFT JOIN properties p ON pva.property_id = p.id
       LEFT JOIN onboarded_properties op ON pva.property_id = op.id
       LEFT JOIN franchise_partners fp ON COALESCE(p.franchise_partner_id, op.franchise_partner_id) = fp.id
       ORDER BY pva.assigned_at DESC`
    );
    
    console.log('Admin all-vendor-assignments: Found', assignments.length, 'assignments');
    res.json({ success: true, data: assignments || [] });
  } catch (error) {
    console.error('Error fetching all vendor assignments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendor assignments' });
  }
});

// Get ALL vendors from ALL FPs (Admin mode)
router.get('/all-vendors', authenticate, adminOnly, async (req, res) => {
  try {
    const includeDeleted = req.query.include_deleted === 'true';
    const statusCondition = includeDeleted ? "(ov.status IN ('active', 'deleted', 'inactive') OR ov.is_active = 0)" : "(ov.status = 'active' OR ov.status IS NULL)";
    
    const [vendors] = await pool.execute(
      `SELECT ov.*, ov.owner_name as vendor_name, ov.owner_mobile as phone, ov.owner_email as email,
              ov.franchise_partner_id as fp_id, fp.fp_code, fp.company_name as fp_name,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                ov.created_by, 'System'
              ) as created_by_name
       FROM onboarded_vendors ov
       LEFT JOIN franchise_partners fp ON ov.franchise_partner_id = fp.id
       LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id OR ov.created_by = fpe.email OR ov.created_by = fpe.username
       WHERE ${statusCondition} AND ov.vendor_id NOT LIKE '%SEED%'
       ORDER BY ov.created_at DESC`
    );
    
    console.log('Admin all-vendors: Found', vendors.length, 'vendors (include_deleted:', includeDeleted, ')');
    res.json({ success: true, data: vendors || [] });
  } catch (error) {
    console.error('Error fetching all vendors:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
  }
});

// Get FP Dashboard data
router.get('/fp-view/:fpId/dashboard', authenticate, adminOnly, async (req, res) => {
  try {
    const { fpId } = req.params;
    
    // Validate fpId is a number
    if (!fpId || isNaN(parseInt(fpId))) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const fpIdNum = parseInt(fpId);
    
    // Get FP info
    const [[fpInfo]] = await pool.execute(
      `SELECT id, fp_code as fpId, company_name, owner_name, city, state FROM franchise_partners WHERE id = ?`,
      [fpIdNum]
    );
    
    if (!fpInfo) {
      return res.status(404).json({ success: false, message: 'FP not found' });
    }
    
    // Helper for safe count queries
    const safeCount = async (query, params = []) => {
      try {
        const [[result]] = await pool.execute(query, params);
        return result?.count || 0;
      } catch (e) {
        console.log('Query error:', e.message);
        return 0;
      }
    };
    
    // Properties count (exclude deleted)
    const propCount = await safeCount(
      `SELECT COUNT(*) as count FROM properties WHERE franchise_partner_id = ? AND (status IS NULL OR status != 'deleted')`,
      [fpIdNum]
    );
    
    // Vendors count (active only)
    const vendorCount = await safeCount(
      `SELECT COUNT(*) as count FROM onboarded_vendors WHERE franchise_partner_id = ? AND status = 'active'`,
      [fpIdNum]
    );
    
    // Work orders - combined query
    const [[workOrderStats]] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
      FROM work_orders WHERE franchise_partner_id = ?
    `, [fpIdNum]);
    
    // Direct Estimates count (from fp_estimates, non-archived, active only)
    const directEstimates = await safeCount(
      `SELECT COUNT(*) as count FROM fp_estimates 
       WHERE franchise_partner_id = ? AND (is_archived = 0 OR is_archived IS NULL) 
       AND status NOT IN ('archived', 'rejected', 'deleted')
       AND estimate_type = 'direct'`,
      [fpIdNum]
    );
    
    // Property-based Estimates count (from fp_estimates, non-archived, active only)
    const propertyEstimates = await safeCount(
      `SELECT COUNT(*) as count FROM fp_estimates 
       WHERE franchise_partner_id = ? AND (is_archived = 0 OR is_archived IS NULL) 
       AND status NOT IN ('archived', 'rejected', 'deleted')
       AND (estimate_type = 'property_based' OR estimate_type = 'property-based')`,
      [fpIdNum]
    );
    
    // Employee count (active only)
    const employeeCount = await safeCount(
      `SELECT COUNT(*) as count FROM fp_employees WHERE franchise_partner_id = ? AND is_active = 1`,
      [fpIdNum]
    );
    
    // Recent work orders
    const [recentWorkOrders] = await pool.execute(
      `SELECT wo.id, wo.work_order_id, wo.title, wo.status, wo.priority, wo.created_at,
              COALESCE(p.name, wo.property_name) as property_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       WHERE wo.franchise_partner_id = ?
       ORDER BY wo.created_at DESC LIMIT 5`,
      [fpIdNum]
    );
    
    console.log('Admin FP Dashboard:', { fpIdNum, propCount, vendorCount, employeeCount, directEstimates, propertyEstimates });
    
    res.json({
      success: true,
      data: {
        fpInfo,
        totalProperties: propCount,
        totalVendors: vendorCount,
        totalEmployees: employeeCount,
        pendingWorkOrders: Number(workOrderStats?.pending) || 0,
        completedWorkOrders: Number(workOrderStats?.completed) || 0,
        directEstimates: directEstimates,
        propertyEstimates: propertyEstimates,
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Error fetching FP dashboard:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get FP Properties
router.get('/fp-view/:fpId/properties', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const { status } = req.query; // 'active', 'inactive', or 'all'
    
    console.log('Admin fp-view properties: Fetching for FP ID:', fpIdNum, 'status:', status || 'active');
    
    // Build status filter clause for properties
    let statusClause;
    if (status === 'inactive') {
      statusClause = `AND p.status = 'inactive'`;
    } else if (status === 'all') {
      statusClause = `AND (p.status IS NULL OR p.status IN ('active', 'inactive'))`;
    } else {
      // Default: active only
      statusClause = `AND (p.status IS NULL OR p.status = 'active')`;
    }
    
    // Regular properties - use SELECT * to avoid column name issues
    let properties = [];
    try {
      const [rows] = await pool.execute(
        `SELECT p.*, 'properties' as source_table
         FROM properties p
         WHERE p.franchise_partner_id = ? ${statusClause}
         ORDER BY p.created_at DESC`,
        [fpIdNum]
      );
      properties = rows.map(p => ({
        ...p,
        zone_name: p.zone_id || p.zone_name || p.zone,
        area: p.area_name || p.area,
        division: p.division_id || p.division,
        category: p.category || 'residential'
      }));
    } catch (e) {
      console.log('Properties query error:', e.message);
    }
    
    console.log('Admin fp-view properties: Found', properties.length, 'regular properties');
    
    // Build status filter clause for onboarded_properties
    let onboardedStatusClause;
    if (status === 'inactive') {
      onboardedStatusClause = `AND op.status = 'inactive'`;
    } else if (status === 'all') {
      onboardedStatusClause = `AND (op.status IS NULL OR op.status IN ('active', 'inactive'))`;
    } else {
      // Default: active only
      onboardedStatusClause = `AND (op.status IS NULL OR op.status = 'active')`;
    }
    
    // Onboarded properties
    let onboardedProps = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.*, 'onboarded_properties' as source_table
         FROM onboarded_properties op
         WHERE op.franchise_partner_id = ? ${onboardedStatusClause}
         ORDER BY op.created_at DESC`,
        [fpIdNum]
      );
      onboardedProps = rows.map(op => ({
        ...op,
        name: op.community_name || op.name,
        zone_name: op.zone || op.zone_name,
        area: op.area_name || op.area,
        zip_code: op.postal_code || op.zip_code,
        category: op.category || 'residential'
      }));
      console.log('Admin fp-view properties: Found', onboardedProps.length, 'onboarded properties');
    } catch (e) {
      console.log('onboarded_properties query skipped:', e.message);
    }
    
    const allProps = [...properties, ...onboardedProps];
    console.log('Admin fp-view properties: Total', allProps.length, 'properties for FP', fpIdNum);
    
    res.json({ success: true, data: allProps });
  } catch (error) {
    console.error('Error fetching FP properties:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch properties' });
  }
});

// Get FP Work Orders
router.get('/fp-view/:fpId/work-orders', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const { status } = req.query;
    
    let query = `
      SELECT wo.*,
             COALESCE(p.name, op.community_name, wo.property_name) as property_name,
             COALESCE(c.name, wo.category_name) as category_name,
             CASE WHEN p.id IS NOT NULL THEN p.zone_id ELSE op.zone END as zone,
             CASE WHEN p.id IS NOT NULL THEN p.division_id ELSE op.division END as division,
             CASE WHEN p.id IS NOT NULL THEN p.address ELSE NULL END as address,
             CASE WHEN p.id IS NOT NULL THEN p.city ELSE NULL END as city,
             CASE WHEN p.id IS NOT NULL THEN p.state ELSE NULL END as state,
             CASE WHEN p.id IS NOT NULL THEN p.contact_person ELSE NULL END as contact_person,
             CASE WHEN p.id IS NOT NULL THEN p.contact_phone ELSE NULL END as property_contact_phone,
             CASE WHEN p.id IS NOT NULL THEN p.contact_email ELSE NULL END as property_contact_email,
             v.company_name as vendor_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id AND p.name = wo.property_name
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id AND op.community_name = wo.property_name
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      WHERE wo.franchise_partner_id = ?
    `;
    const params = [fpIdNum];
    
    if (status === 'pending') {
      query += ` AND wo.status IN ('pending', 'under_review', 'assigned', 'accepted', 'in_progress')`;
    } else if (status === 'completed') {
      query += ` AND wo.status IN ('completed', 'closed')`;
    }
    
    query += ` ORDER BY wo.created_at DESC`;
    
    const [workOrders] = await pool.execute(query, params);
    
    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }
    
    console.log('Admin fp-view work-orders: Found', workOrders.length, 'for FP', fpIdNum);
    res.json({ success: true, data: workOrders || [] });
  } catch (error) {
    console.error('Error fetching FP work orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work orders' });
  }
});

// Get FP Vendors
router.get('/fp-view/:fpId/vendors', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const includeDeleted = req.query.include_deleted === 'true';
    const statusCondition = includeDeleted ? "(ov.status IN ('active', 'deleted', 'inactive') OR ov.is_active = 0)" : "(ov.status = 'active' OR ov.status IS NULL)";
    
    const [vendors] = await pool.execute(
      `SELECT ov.*, ov.owner_name as vendor_name, ov.owner_mobile as phone, ov.owner_email as email,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                ov.created_by, 'System'
              ) as created_by_name
       FROM onboarded_vendors ov
       LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id OR ov.created_by = fpe.email OR ov.created_by = fpe.username
       WHERE ov.franchise_partner_id = ?
         AND ${statusCondition} AND ov.vendor_id NOT LIKE '%SEED%'
       ORDER BY ov.created_at DESC`,
      [fpIdNum]
    );
    
    console.log('Admin fp-view vendors: Found', vendors.length, 'vendors for FP', fpIdNum);
    res.json({ success: true, data: vendors || [] });
  } catch (error) {
    console.error('Error fetching FP vendors:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendors' });
  }
});

// Bulk archive vendors (Admin)
router.put('/vendors/bulk-archive', authenticate, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No vendor IDs provided' });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    
    const [result] = await pool.execute(
      `UPDATE onboarded_vendors SET is_active = 0, status = 'inactive', updated_at = NOW() WHERE id IN (${placeholders})`,
      ids
    );
    
    res.json({ success: true, message: `${result.affectedRows} vendor(s) archived`, archivedCount: result.affectedRows });
  } catch (error) {
    console.error('Bulk archive vendors error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete all archived/inactive vendors permanently (Admin)
router.delete('/vendors/archived/delete-all', authenticate, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.execute(
      `DELETE FROM onboarded_vendors WHERE (status = 'inactive' OR status = 'deleted' OR is_active = 0)`
    );
    res.json({ success: true, message: `${result.affectedRows} archived vendors deleted`, deletedCount: result.affectedRows });
  } catch (error) {
    console.error('Delete all archived vendors error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get FP Vendor Assignments
router.get('/fp-view/:fpId/vendor-assignments', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [assignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at as assigned_date, pva.is_active,
              COALESCE(p.name, op.community_name) as property_name,
              COALESCE(p.property_id, op.property_id) as propertyId,
              COALESCE(p.property_id, op.property_id) as property_code,
              COALESCE(p.zone_id, op.zone) as property_zone,
              COALESCE(p.property_type, op.property_type) as property_type,
              v.owner_name as vendor_name, v.vendor_id as vendor_code, COALESCE(pva.service_type, v.service_type) as service_type,
              v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
              v.zone as zone_name, v.area_name as area,
              v.rate_per_visit, v.coverage_per_day, v.status as vendor_status,
              v.owner_aadhar, v.manager_name, v.manager_mobile, v.manager_email,
              v.poc_name, v.poc_mobile, v.poc_email, v.service_verified
       FROM property_vendor_assignments pva
       LEFT JOIN properties p ON pva.property_id = p.id
       LEFT JOIN onboarded_properties op ON pva.property_id = op.id
       JOIN onboarded_vendors v ON pva.vendor_id = v.id
       WHERE (p.franchise_partner_id = ? OR op.franchise_partner_id = ?)
       ORDER BY pva.assigned_at DESC`,
      [fpIdNum, fpIdNum]
    );
    
    console.log('Admin fp-view vendor-assignments: Found', assignments.length, 'assignments for FP', fpIdNum);
    res.json({ success: true, data: assignments || [] });
  } catch (error) {
    console.error('Error fetching FP vendor assignments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vendor assignments' });
  }
});

// Get FP Employees
router.get('/fp-view/:fpId/employees', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    // Get employees first (matching FP portal approach) - only active employees
    const [employees] = await pool.execute(
      `SELECT e.*, e.employee_code as employee_id,
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name,
              'active' as status
       FROM fp_employees e
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       ORDER BY e.created_at DESC`,
      [fpIdNum]
    );

    // Get zone assignments for this FP
    const [zoneAssignments] = await pool.execute(
      `SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?`,
      [fpIdNum]
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
      assigned_zones: employeeZonesMap[emp.id] || [],
      zone_names: (employeeZonesMap[emp.id] || []).join(', '),
      zone_count: (employeeZonesMap[emp.id] || []).length
    }));
    
    console.log('Admin fp-view employees: Found', transformedEmployees.length, 'employees for FP', fpIdNum);
    res.json({ success: true, data: transformedEmployees || [] });
  } catch (error) {
    console.error('Error fetching FP employees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

// Get FP Employee Zones
router.get('/fp-view/:fpId/employee-zones', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active,
              GROUP_CONCAT(DISTINCT z.name ORDER BY z.name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       LEFT JOIN zones z ON ez.zone_id = z.id
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      [fpIdNum, fpIdNum]
    );
    
    // Get all zones from multiple sources for this FP
    const allZoneNames = new Set();
    const combinedZones = [];
    
    // 1. Get global zones from zones table
    try {
      const [globalZones] = await pool.execute(
        'SELECT id, name FROM zones WHERE is_active = 1'
      );
      console.log(`[Admin FP ${fpIdNum}] Global zones:`, globalZones.length, globalZones.map(z => z.name));
      globalZones.forEach(z => {
        if (z.name && !allZoneNames.has(z.name)) {
          allZoneNames.add(z.name);
          combinedZones.push({ id: z.id, name: z.name });
        }
      });
    } catch (e) {
      console.log(`[Admin FP ${fpIdNum}] Error fetching zones:`, e.message);
    }
    
    // 2. Get zones from fp_zones table for this FP - table may not exist
    try {
      const [fpZones] = await pool.execute(
        'SELECT id, name FROM fp_zones WHERE franchise_partner_id = ? AND is_active = 1',
        [fpIdNum]
      );
      console.log(`[Admin FP ${fpIdNum}] FP zones:`, fpZones.length, fpZones.map(z => z.name));
      fpZones.forEach(z => {
        if (z.name && !allZoneNames.has(z.name)) {
          allZoneNames.add(z.name);
          combinedZones.push({ id: `fp-${z.id}`, name: z.name });
        }
      });
    } catch (e) {
      console.log(`[Admin FP ${fpIdNum}] fp_zones table may not exist:`, e.message);
    }
    
    // 3. Get zones from properties table for this FP
    try {
      const [propertyZones] = await pool.execute(
        `SELECT DISTINCT zone_id FROM properties WHERE franchise_partner_id = ? AND zone_id IS NOT NULL AND zone_id != ''
         AND (status = 'active' OR status IS NULL)`,
        [fpIdNum]
      );
      console.log(`[Admin FP ${fpIdNum}] Property zones:`, propertyZones.length, propertyZones.map(z => z.zone_id));
      propertyZones.forEach(z => {
        const zoneName = String(z.zone_id);
        if (zoneName && !allZoneNames.has(zoneName)) {
          allZoneNames.add(zoneName);
          combinedZones.push({ id: `prop-${zoneName}`, name: zoneName });
        }
      });
    } catch (e) {
      console.log(`[Admin FP ${fpIdNum}] Error fetching property zones:`, e.message);
    }
    
    // 3b. Get zones from onboarded_properties table for this FP (customer zones)
    try {
      const [onboardedZones] = await pool.execute(
        `SELECT DISTINCT zone FROM onboarded_properties WHERE franchise_partner_id = ? AND zone IS NOT NULL AND zone != ''
         AND (status = 'active' OR status IS NULL)`,
        [fpIdNum]
      );
      console.log(`[Admin FP ${fpIdNum}] Onboarded property zones:`, onboardedZones.length, onboardedZones.map(z => z.zone));
      onboardedZones.forEach(z => {
        const zoneName = String(z.zone);
        if (zoneName && !allZoneNames.has(zoneName)) {
          allZoneNames.add(zoneName);
          combinedZones.push({ id: `onboarded-${zoneName}`, name: zoneName });
        }
      });
    } catch (e) {
      console.log(`[Admin FP ${fpIdNum}] Error fetching onboarded property zones:`, e.message);
    }
    
    // 4. MOST IMPORTANT: Get zones from fp_employee_zones for this FP
    try {
      const [assignedZones] = await pool.execute(
        `SELECT DISTINCT zone_name FROM fp_employee_zones WHERE franchise_partner_id = ? AND zone_name IS NOT NULL AND zone_name != 'all'`,
        [fpIdNum]
      );
      console.log(`[Admin FP ${fpIdNum}] Assigned zones:`, assignedZones.length, assignedZones.map(z => z.zone_name));
      assignedZones.forEach(z => {
        if (z.zone_name && !allZoneNames.has(z.zone_name)) {
          allZoneNames.add(z.zone_name);
          combinedZones.push({ id: `assigned-${z.zone_name}`, name: z.zone_name });
        }
      });
    } catch (e) {
      console.log(`[Admin FP ${fpIdNum}] Error fetching fp_employee_zones:`, e.message);
    }
    
    // Sort combined zones by name
    combinedZones.sort((a, b) => a.name.localeCompare(b.name));
    console.log(`[Admin FP ${fpIdNum}] Final zones:`, combinedZones.length, combinedZones.map(z => z.name));
    
    res.json({ 
      success: true, 
      data: {
        employees: employees.map(emp => ({
          ...emp,
          zone_names: emp.zone_names || 'No zones assigned'
        })),
        zones: combinedZones
      }
    });
  } catch (error) {
    console.error('Error fetching FP employee zones:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update employee zones (Admin)
router.put('/employees/:id/zones', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { zones } = req.body;
    
    console.log('Admin: Updating zones for employee:', id, 'Zones:', zones);
    
    // Get the employee's franchise_partner_id
    const [[employee]] = await pool.execute(
      `SELECT franchise_partner_id FROM fp_employees WHERE id = ?`,
      [id]
    );
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    const fpId = employee.franchise_partner_id;
    
    // Delete existing zone assignments
    await pool.execute(
      `DELETE FROM fp_employee_zones WHERE fp_employee_id = ? AND franchise_partner_id = ?`,
      [id, fpId]
    );
    
    // Insert new zone assignments
    if (zones === 'all') {
      // Store 'all' as a special value to indicate all zones are assigned
      await pool.execute(
        `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name) VALUES (?, ?, ?)`,
        [fpId, id, 'all']
      );
      console.log('Admin: Inserted ALL zones assignment:', { fpId, empId: id });
    } else if (Array.isArray(zones) && zones.length > 0) {
      for (const zoneName of zones) {
        await pool.execute(
          `INSERT INTO fp_employee_zones (franchise_partner_id, fp_employee_id, zone_name) VALUES (?, ?, ?)`,
          [fpId, id, zoneName]
        );
        console.log('Admin: Inserted zone assignment:', { fpId, empId: id, zoneName });
      }
    }
    
    res.json({ success: true, message: 'Employee zones updated' });
  } catch (error) {
    console.error('Admin update employee zones error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Transform AMC package to frontend format
const transformPackage = (pkg) => {
  let servicesString = '';
  let serviceRows = [];
  let propertyType = pkg.property_type || 'GC';
  let billingDuration = pkg.billing_duration || 'yearly';
  
  // Parse the services field - it contains JSON with serviceRows nested inside
  if (pkg.services) {
    try {
      const parsed = typeof pkg.services === 'string' ? JSON.parse(pkg.services) : pkg.services;
      
      // Check if it's the nested structure: {serviceRows: [...], property_type: ..., billing_duration: ...}
      if (parsed.serviceRows && Array.isArray(parsed.serviceRows)) {
        serviceRows = parsed.serviceRows;
        servicesString = serviceRows.map(r => r.name || r.service || '').filter(Boolean).join(', ');
        // Also extract property_type and billing_duration if present
        if (parsed.property_type) propertyType = parsed.property_type;
        if (parsed.billing_duration) billingDuration = parsed.billing_duration;
      } 
      // Or it might be a direct array of services
      else if (Array.isArray(parsed)) {
        serviceRows = parsed;
        servicesString = parsed.map(s => typeof s === 'string' ? s : (s.name || s.service || '')).filter(Boolean).join(', ');
      }
    } catch (e) {
      // If not JSON, treat as comma-separated string
      servicesString = pkg.services;
    }
  }
  
  // Map property type codes
  const propTypeMap = { 'AP': 'APT', 'VL': 'VILLA', 'FL': 'FLAT', 'PL': 'PLOT' };
  const mappedPropertyType = propTypeMap[propertyType] || propertyType || 'GC';
  
  // Normalize billing duration to lowercase
  const normalizedBilling = billingDuration?.toLowerCase() === 'annual' ? 'yearly' : (billingDuration || 'yearly').toLowerCase();
  
  return {
    id: pkg.id,
    packageId: pkg.package_code || `PKG-${pkg.id}`,
    packageName: pkg.name || pkg.package_name,
    name: pkg.name || pkg.package_name,
    description: pkg.description || '',
    propertyType: mappedPropertyType,
    price: parseFloat(pkg.base_price || pkg.price) || 0,
    rate: parseFloat(pkg.base_price || pkg.price) || 0,
    services: servicesString, // String for display
    serviceRows: serviceRows,
    durationMonths: pkg.duration_months || 12,
    billingCycle: normalizedBilling,
    billingDuration: normalizedBilling, // Frontend uses this field
    termsConditions: pkg.terms_conditions || '',
    franchisePartnerId: pkg.franchise_partner_id,
    fpCode: pkg.fp_code,
    fpName: pkg.fp_name,
    createdAt: pkg.created_at,
    updatedAt: pkg.updated_at
  };
};

// Get ALL AMC Packages (Admin mode) - from fp_amc_packages table
router.get('/all-amc-packages', authenticate, adminOnly, async (req, res) => {
  try {
    const [packages] = await pool.execute(
      `SELECT p.*, fp.fp_code, fp.company_name as fp_name
       FROM fp_amc_packages p
       LEFT JOIN franchise_partners fp ON p.franchise_partner_id = fp.id
       ORDER BY p.created_at DESC`
    );
    
    const transformedPackages = packages.map(transformPackage);
    console.log('Admin all-amc-packages: Found', transformedPackages.length, 'packages');
    res.json({ success: true, data: transformedPackages || [] });
  } catch (error) {
    console.error('Error fetching all AMC packages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
  }
});

// DELETE AMC Package (Admin mode) - deletes from fp_amc_packages table
router.delete('/amc-packages/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete from fp_amc_packages table
    const [result] = await pool.execute(
      'DELETE FROM fp_amc_packages WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'AMC Package not found' });
    }
    
    console.log('Admin deleted AMC package:', id);
    res.json({ success: true, message: 'AMC Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting AMC package:', error);
    res.status(500).json({ success: false, message: 'Failed to delete AMC package' });
  }
});

// CREATE AMC Package (Admin mode) - creates in fp_amc_packages table
router.post('/amc-packages', authenticate, adminOnly, async (req, res) => {
  try {
    const { fpId, packageName, propertyType, serviceRows, services, rate, billingDuration, description } = req.body;
    
    if (!fpId) {
      return res.status(400).json({ success: false, message: 'Franchise Partner ID is required' });
    }
    
    if (!packageName) {
      return res.status(400).json({ success: false, message: 'Package name is required' });
    }
    
    const packageCode = `FP${fpId}-AMC-${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO fp_amc_packages (
        franchise_partner_id, package_code, name, description, 
        base_price, services
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fpId, 
        packageCode, 
        packageName, 
        description || '',
        rate || 0, 
        JSON.stringify({ 
          property_type: propertyType, 
          billing_duration: billingDuration || 'yearly',
          serviceRows: serviceRows || [] 
        })
      ]
    );
    
    console.log('Admin created AMC package:', packageCode, 'for FP:', fpId);
    res.status(201).json({ 
      success: true, 
      message: 'AMC Package created successfully',
      data: { id: result.insertId, packageCode }
    });
  } catch (error) {
    console.error('Error creating AMC package:', error);
    res.status(500).json({ success: false, message: 'Failed to create AMC package' });
  }
});

// UPDATE AMC Package (Admin mode) - updates fp_amc_packages table
router.put('/amc-packages/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { packageName, propertyType, serviceRows, rate, billingDuration, description } = req.body;
    
    const [result] = await pool.execute(
      `UPDATE fp_amc_packages 
       SET name = ?, description = ?, base_price = ?, 
           services = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        packageName,
        description || '',
        rate || 0,
        JSON.stringify({ 
          property_type: propertyType, 
          billing_duration: billingDuration || 'yearly',
          serviceRows: serviceRows || [] 
        }),
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'AMC Package not found' });
    }
    
    console.log('Admin updated AMC package:', id);
    res.json({ success: true, message: 'AMC Package updated successfully' });
  } catch (error) {
    console.error('Error updating AMC package:', error);
    res.status(500).json({ success: false, message: 'Failed to update AMC package' });
  }
});

// Get FP AMC Packages
router.get('/fp-view/:fpId/amc-packages', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [packages] = await pool.execute(
      `SELECT * FROM fp_amc_packages WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
      [fpIdNum]
    );
    
    const transformedPackages = packages.map(transformPackage);
    console.log('Admin fp-view amc-packages: Found', transformedPackages.length, 'for FP', fpIdNum);
    res.json({ success: true, data: transformedPackages || [] });
  } catch (error) {
    console.error('Error fetching FP AMC packages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
  }
});

// Map backend property type codes to frontend codes
const mapPropertyType = (dbType) => {
  const mapping = {
    'GC': 'GC',
    'AP': 'APT', 'APT': 'APT', 'Apartment': 'APT',
    'VL': 'VILLA', 'VILLA': 'VILLA', 'Villa': 'VILLA', 'Villas': 'VILLA',
    'FL': 'FLAT', 'FLAT': 'FLAT', 'Flat': 'FLAT', 'Flats': 'FLAT',
    'PL': 'PLOT', 'PLOT': 'PLOT', 'Plot': 'PLOT', 'Plots': 'PLOT'
  };
  return mapping[dbType] || dbType;
};

const getPropertyTypeName = (type) => {
  const names = {
    'GC': 'Gated Community',
    'APT': 'Apartment', 'AP': 'Apartment',
    'VILLA': 'Villa', 'VL': 'Villa',
    'FLAT': 'Flat', 'FL': 'Flat',
    'PLOT': 'Plot', 'PL': 'Plot'
  };
  return names[type] || type;
};

// Transform fp_addons row to frontend format
const transformAddon = (addon) => ({
  id: addon.id,
  addonId: addon.addon_code || `ADDON-${addon.id}`,
  propertyType: mapPropertyType(addon.property_type),
  propertyTypeName: getPropertyTypeName(addon.property_type),
  services: [{
    name: addon.service_name || '',
    frequency: addon.frequency_count || 1,
    frequencyType: addon.frequency_type || 'Monthly',
    price: parseFloat(addon.price) || 0,
    description: addon.description || ''
  }],
  totalPrice: parseFloat(addon.price) || 0,
  billingCycle: addon.billing_cycle || 'Monthly',
  franchisePartnerId: addon.franchise_partner_id,
  fpCode: addon.fp_code,
  fpName: addon.fp_name,
  createdAt: addon.created_at,
  updatedAt: addon.updated_at
});

// Get ALL Add-ons (Admin mode) - from fp_addons table
router.get('/all-addons', authenticate, adminOnly, async (req, res) => {
  try {
    const [addons] = await pool.execute(
      `SELECT a.*, fp.fp_code, fp.company_name as fp_name
       FROM fp_addons a
       LEFT JOIN franchise_partners fp ON a.franchise_partner_id = fp.id
       ORDER BY a.created_at DESC`
    );
    
    const transformedAddons = addons.map(transformAddon);
    console.log('Admin all-addons: Found', transformedAddons.length, 'addons');
    res.json({ success: true, data: transformedAddons || [] });
  } catch (error) {
    console.error('Error fetching all addons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
  }
});

// DELETE Add-on (Admin mode) - deletes from fp_addons table
router.delete('/addons/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete from fp_addons table
    const [result] = await pool.execute(
      'DELETE FROM fp_addons WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Add-on not found' });
    }
    
    console.log('Admin deleted addon:', id);
    res.json({ success: true, message: 'Add-on deleted successfully' });
  } catch (error) {
    console.error('Error deleting addon:', error);
    res.status(500).json({ success: false, message: 'Failed to delete addon' });
  }
});

// Get FP Add-ons
router.get('/fp-view/:fpId/addons', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [addons] = await pool.execute(
      `SELECT * FROM fp_addons WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
      [fpIdNum]
    );
    
    const transformedAddons = addons.map(transformAddon);
    console.log('Admin fp-view addons: Found', transformedAddons.length, 'for FP', fpIdNum);
    res.json({ success: true, data: transformedAddons || [] });
  } catch (error) {
    console.error('Error fetching FP addons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
  }
});

// Update FP Add-on (Admin can edit any FP's addon)
router.put('/fp-addons/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, frequency_type, frequency_count, property_type, price, description } = req.body;

    await pool.execute(
      `UPDATE fp_addons SET 
        service_name = COALESCE(?, service_name), 
        frequency_type = COALESCE(?, frequency_type), 
        frequency_count = COALESCE(?, frequency_count), 
        property_type = COALESCE(?, property_type), 
        price = COALESCE(?, price), 
        description = COALESCE(?, description)
       WHERE id = ?`,
      [service_name, frequency_type, frequency_count || 1, property_type, price || 0, description || '', id]
    );

    console.log('Admin updated fp_addon:', id);
    res.json({ success: true, message: 'Add-on updated successfully' });
  } catch (error) {
    console.error('Update FP addon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete FP Add-on (Admin can delete any FP's addon)
router.delete('/fp-addons/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM fp_addons WHERE id = ?', [id]);
    console.log('Admin deleted fp_addon:', id);
    res.json({ success: true, message: 'Add-on deleted successfully' });
  } catch (error) {
    console.error('Delete FP addon error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get FP Portal Links (for Admin to view FP's shared resources)
router.get('/fp-view/:fpId/portal-links', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [links] = await pool.execute(
      `SELECT id, link_slot, heading, url, created_at, updated_at 
       FROM fp_portal_links 
       WHERE franchise_partner_id = ? AND is_active = 1 
       ORDER BY link_slot ASC`,
      [fpIdNum]
    );
    
    res.json({ success: true, data: links || [] });
  } catch (error) {
    console.error('Error fetching FP portal links:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch portal links' });
  }
});

// Get ALL FP Portal Links aggregated (for Admin "All FPs" view)
router.get('/all-fp-portal-links', authenticate, adminOnly, async (req, res) => {
  try {
    const [links] = await pool.execute(
      `SELECT fpl.id, fpl.link_slot, fpl.heading, fpl.url, fpl.created_at, fpl.updated_at,
              fp.id as fp_id, fp.fp_code, fp.company_name as fp_company
       FROM fp_portal_links fpl
       JOIN franchise_partners fp ON fpl.franchise_partner_id = fp.id
       WHERE fpl.is_active = 1 
       ORDER BY fp.fp_code ASC, fpl.link_slot ASC`
    );
    
    // Group by FP
    const grouped = {};
    links.forEach(link => {
      if (!grouped[link.fp_id]) {
        grouped[link.fp_id] = {
          fpId: link.fp_id,
          fpCode: link.fp_code,
          fpCompany: link.fp_company,
          links: []
        };
      }
      grouped[link.fp_id].links.push({
        id: link.id,
        link_slot: link.link_slot,
        heading: link.heading,
        url: link.url
      });
    });
    
    res.json({ success: true, data: Object.values(grouped) });
  } catch (error) {
    console.error('Error fetching all FP portal links:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch portal links' });
  }
});

// Get FP Customers
router.get('/fp-view/:fpId/customers', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [customers] = await pool.execute(
      `SELECT c.*, p.name as property_name
       FROM clients c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.franchise_partner_id = ?
       ORDER BY c.created_at DESC`,
      [fpIdNum]
    );
    
    res.json({ success: true, data: customers || [] });
  } catch (error) {
    console.error('Error fetching FP customers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
});

// Migration: Update all existing estimates with created_by_name
router.post('/migrate-estimate-names', async (req, res) => {
  try {
    // Update estimates where created_by_name is empty - get name from users table
    const [result] = await pool.query(`
      UPDATE fp_estimates e
      LEFT JOIN users u ON e.created_by_id = u.id
      SET e.created_by_name = COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
        u.name,
        u.username,
        CONCAT(UPPER(SUBSTRING(REPLACE(e.created_by_role, '_', ' '), 1, 1)), 
               LOWER(SUBSTRING(REPLACE(e.created_by_role, '_', ' '), 2)))
      )
      WHERE e.created_by_name IS NULL 
         OR e.created_by_name = '' 
         OR e.created_by_name = '-'
         OR TRIM(e.created_by_name) = ''
    `);
    
    res.json({ 
      success: true, 
      message: `Updated ${result.affectedRows} estimate records with created_by_name`,
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Migration: Link existing estimates to AMC packages by matching package_name
router.post('/migrate-estimate-packages', authenticate, adminOnly, async (req, res) => {
  try {
    // Update fp_estimates: match package_name to amc_packages and set package_id
    const [fpResult] = await pool.execute(`
      UPDATE fp_estimates fe
      JOIN amc_packages amc ON fe.package_name = amc.package_name
      SET fe.package_id = amc.id
      WHERE fe.package_name IS NOT NULL 
        AND fe.package_name != ''
        AND (fe.package_id IS NULL OR fe.package_id = 0)
    `);
    
    // Update main estimates table if it has package_name column
    let mainResult = { affectedRows: 0 };
    try {
      const [columns] = await pool.execute(`SHOW COLUMNS FROM estimates LIKE 'package_name'`);
      if (columns.length > 0) {
        [mainResult] = await pool.execute(`
          UPDATE estimates e
          JOIN amc_packages amc ON e.package_name = amc.package_name
          SET e.package_id = amc.id
          WHERE e.package_name IS NOT NULL 
            AND e.package_name != ''
            AND (e.package_id IS NULL OR e.package_id = 0)
        `);
      }
    } catch (e) {
      console.log('Main estimates table update skipped:', e.message);
    }
    
    // Get counts for reporting
    const [fpCount] = await pool.execute(`
      SELECT COUNT(*) as count FROM fp_estimates WHERE package_id IS NOT NULL AND package_id > 0
    `);
    const [amcCount] = await pool.execute(`
      SELECT COUNT(*) as count FROM amc_packages
    `);
    
    res.json({ 
      success: true, 
      message: `Migration complete. Updated ${fpResult.affectedRows} FP estimates and ${mainResult.affectedRows} main estimates.`,
      details: {
        fpEstimatesUpdated: fpResult.affectedRows,
        mainEstimatesUpdated: mainResult.affectedRows,
        totalLinkedFpEstimates: fpCount[0]?.count || 0,
        totalAmcPackages: amcCount[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('Package migration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cleanup duplicate work orders
router.post('/cleanup-duplicate-work-orders', authenticate, adminOnly, async (req, res) => {
  try {
    console.log('Starting duplicate work orders cleanup...');
    
    // Find duplicates first
    const [duplicates] = await pool.execute(`
      SELECT work_order_id, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM work_orders 
      GROUP BY work_order_id 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No duplicate work orders found. Database is clean.',
        duplicatesFound: 0,
        recordsRemoved: 0
      });
    }
    
    console.log(`Found ${duplicates.length} work_order_ids with duplicates`);
    
    // Delete duplicates, keeping lowest id for each work_order_id
    const [result] = await pool.execute(`
      DELETE wo1 FROM work_orders wo1
      INNER JOIN work_orders wo2
      WHERE wo1.work_order_id = wo2.work_order_id
      AND wo1.id > wo2.id
    `);
    
    console.log(`Removed ${result.affectedRows} duplicate work order records`);
    
    res.json({ 
      success: true, 
      message: `Cleanup complete. Removed ${result.affectedRows} duplicate records.`,
      duplicatesFound: duplicates.length,
      recordsRemoved: result.affectedRows,
      details: duplicates.map(d => ({ workOrderId: d.work_order_id, count: d.count }))
    });
  } catch (error) {
    console.error('Error cleaning up duplicate work orders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SERVICE TYPES (for Vendor Management)
// ============================================

// Get all service types (global + FP-specific for employees, ALL for Super Admin)
router.get('/service-types', authenticate, async (req, res) => {
  try {
    // Get user's franchise_partner_id and role
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role;
    let fpId = null;
    let isSuperAdmin = userRole === 'super_admin' || userRole === 'admin';
    
    if (userId && !isSuperAdmin) {
      const [userRows] = await pool.execute(
        'SELECT franchise_partner_id, role FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0) {
        fpId = userRows[0].franchise_partner_id;
        if (userRows[0].role === 'super_admin' || userRows[0].role === 'admin') {
          isSuperAdmin = true;
        }
      }
    }

    let query, params = [];
    
    if (isSuperAdmin) {
      // Super Admin sees ALL service types (global + all FP-specific)
      query = `SELECT id, name, is_global, franchise_partner_id, created_by_user_id, created_at 
         FROM service_types 
         WHERE is_active = 1
         ORDER BY name ASC`;
    } else {
      // Employees see global + their FP-specific service types
      query = `SELECT id, name, is_global, franchise_partner_id, created_by_user_id, created_at 
         FROM service_types 
         WHERE is_active = 1 AND (is_global = 1 OR franchise_partner_id IS NULL`;
      
      if (fpId) {
        query += ` OR franchise_partner_id = ?`;
        params.push(fpId);
      }
      query += `) ORDER BY name ASC`;
    }

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows, currentUserId: userId });
  } catch (error) {
    console.error('Get service types error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new service type (global for admin, FP-scoped for employees)
router.post('/service-types', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Service type name is required' });
    }

    // Capitalize first letter of each word for UI consistency
    const capitalizedName = name.trim().split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    // Get user's franchise_partner_id if they're an employee
    let fpId = null;
    if (!isAdmin && userId) {
      const [userRows] = await pool.execute(
        'SELECT franchise_partner_id FROM users WHERE id = ?',
        [userId]
      );
      if (userRows.length > 0 && userRows[0].franchise_partner_id) {
        fpId = userRows[0].franchise_partner_id;
      }
    }

    // Check if already exists and is active (within same scope)
    let checkQuery = 'SELECT id FROM service_types WHERE LOWER(name) = LOWER(?) AND is_active = 1';
    const checkParams = [capitalizedName];
    
    if (fpId) {
      // For employees, check within their FP's service types
      checkQuery += ' AND (is_global = 1 OR franchise_partner_id = ?)';
      checkParams.push(fpId);
    }

    const [existing] = await pool.execute(checkQuery, checkParams);
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Service type already exists' });
    }

    // Check if there's a soft-deleted service type with the same name - reactivate it
    let deletedCheckQuery = 'SELECT id FROM service_types WHERE LOWER(name) = LOWER(?) AND is_active = 0';
    const deletedCheckParams = [capitalizedName];
    
    if (fpId) {
      deletedCheckQuery += ' AND franchise_partner_id = ?';
      deletedCheckParams.push(fpId);
    } else if (isAdmin) {
      deletedCheckQuery += ' AND is_global = 1';
    }

    const [existingDeleted] = await pool.execute(deletedCheckQuery, deletedCheckParams);

    if (existingDeleted.length > 0) {
      // Reactivate the soft-deleted service type and update the name to capitalized version
      await pool.execute(
        'UPDATE service_types SET is_active = 1, name = ? WHERE id = ?',
        [capitalizedName, existingDeleted[0].id]
      );
      return res.json({ 
        success: true, 
        message: 'Service type reactivated successfully',
        data: { id: existingDeleted[0].id, name: capitalizedName }
      });
    }

    // Admin creates global; employees create FP-scoped (visible to all employees in same FP)
    const [result] = await pool.execute(
      `INSERT INTO service_types (name, is_global, franchise_partner_id, created_by, created_by_user_id) VALUES (?, ?, ?, ?, ?)`,
      [capitalizedName, isAdmin ? 1 : 0, fpId, req.user?.username || req.user?.email || 'User', userId]
    );

    res.json({ 
      success: true, 
      message: 'Service type added successfully',
      data: { id: result.insertId, name: capitalizedName }
    });
  } catch (error) {
    console.error('Add service type error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete service type (admin/FP can delete any, employees can only delete their own created ones)
router.delete('/service-types/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    const isFP = userRole === 'franchise_partner' || userRole === 'fp';

    // Get the service type to check ownership
    const [serviceType] = await pool.execute(
      'SELECT id, is_global, franchise_partner_id, created_by_user_id FROM service_types WHERE id = ? AND is_active = 1',
      [id]
    );

    if (serviceType.length === 0) {
      return res.status(404).json({ success: false, message: 'Service type not found' });
    }

    const st = serviceType[0];

    // Admins can delete any service type
    if (isAdmin) {
      await pool.execute('UPDATE service_types SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Service type deleted' });
    }

    // FP can delete any service type they created or belongs to their FP
    if (isFP) {
      await pool.execute('UPDATE service_types SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Service type deleted' });
    }

    // Employees can ONLY delete service types they themselves created
    if (st.created_by_user_id && st.created_by_user_id === userId) {
      await pool.execute('UPDATE service_types SET is_active = 0 WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Service type deleted' });
    }

    res.status(403).json({ success: false, message: 'You can only delete service types you created' });
  } catch (error) {
    console.error('Delete service type error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN CATEGORIES (Global categories with admin additions)
// ============================================

router.get('/categories', authenticate, async (req, res) => {
  try {
    // Get default categories from config
    const categoriesConfig = require('../config/categories');
    const defaultCategories = categoriesConfig.map(c => ({ ...c, isDefault: true }));
    
    // Get admin-created categories (stored in admin_categories table)
    try {
      const [adminCategories] = await pool.execute(
        'SELECT id, name FROM admin_categories WHERE is_active = 1 ORDER BY name'
      );
      
      for (const cat of adminCategories) {
        const [subs] = await pool.execute(
          'SELECT id, name FROM admin_subcategories WHERE category_id = ? AND is_active = 1 ORDER BY name',
          [cat.id]
        );
        cat.subcategories = [...subs, { id: cat.id * 100 + 99, name: 'Other' }];
        cat.isDefault = false;
      }
      
      const allCategories = [...defaultCategories, ...adminCategories];
      return res.json({ success: true, data: allCategories });
    } catch (tableError) {
      // If admin_categories table doesn't exist, just return default categories
      return res.json({ success: true, data: defaultCategories });
    }
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/categories', authenticate, async (req, res) => {
  try {
    const { name, subcategoryName } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO admin_categories (name) VALUES (?)',
      [name.trim()]
    );
    
    const categoryId = result.insertId;
    
    if (subcategoryName?.trim()) {
      await pool.execute(
        'INSERT INTO admin_subcategories (name, category_id) VALUES (?, ?)',
        [subcategoryName.trim(), categoryId]
      );
    }
    
    res.json({ success: true, message: 'Category added', data: { id: categoryId, name: name.trim() } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/categories/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.execute('UPDATE admin_subcategories SET is_active = 0 WHERE category_id = ?', [id]);
    await pool.execute('UPDATE admin_categories SET is_active = 0 WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/subcategories/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE admin_subcategories SET is_active = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Subcategory deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// MIGRATION: Populate block_unit_types for GC and APT properties
// ============================================
router.post('/migrate/block-unit-types', authenticate, adminOnly, async (req, res) => {
  try {
    const results = {
      onboarded_gc: 0,
      onboarded_apt: 0,
      properties_gc: 0,
      properties_apt: 0,
      estimates_gc: 0,
      estimates_apt: 0
    };

    // 1. Update GC properties in onboarded_properties with proper block_unit_types
    const [gcOnboarded] = await pool.execute(
      `SELECT id, property_id, community_name, number_of_blocks, units_per_block, block_unit_types 
       FROM onboarded_properties 
       WHERE (entry_type = 'GC' OR property_type = 'gated_community') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '')`
    );

    for (const prop of gcOnboarded) {
      try {
        let unitsPerBlock = prop.units_per_block;
        if (typeof unitsPerBlock === 'string') {
          try { unitsPerBlock = JSON.parse(unitsPerBlock); } catch { unitsPerBlock = {}; }
        }
        const blockUnitTypes = {};
        const numBlocks = prop.number_of_blocks || Object.keys(unitsPerBlock || {}).length || 1;
        for (let i = 1; i <= numBlocks; i++) {
          blockUnitTypes[i] = { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
        }
        await pool.execute('UPDATE onboarded_properties SET block_unit_types = ? WHERE id = ?', [JSON.stringify(blockUnitTypes), prop.id]);
        results.onboarded_gc++;
      } catch (e) { console.log('GC onboarded error:', e.message); }
    }

    // 2. Update APT properties in onboarded_properties
    const [aptOnboarded] = await pool.execute(
      `SELECT id, property_id, community_name FROM onboarded_properties 
       WHERE (entry_type = 'APT' OR property_type = 'apartment') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '')`
    );

    for (const prop of aptOnboarded) {
      try {
        const blockUnitTypes = { apt: { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 } };
        await pool.execute('UPDATE onboarded_properties SET block_unit_types = ? WHERE id = ?', [JSON.stringify(blockUnitTypes), prop.id]);
        results.onboarded_apt++;
      } catch (e) { console.log('APT onboarded error:', e.message); }
    }

    // 3. Update GC properties in properties table
    const [gcProperties] = await pool.execute(
      `SELECT id, property_id, name, number_of_blocks, units_per_block FROM properties 
       WHERE (property_type = 'gated_community' OR property_type = 'GC') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '')`
    );

    for (const prop of gcProperties) {
      try {
        let unitsPerBlock = prop.units_per_block;
        if (typeof unitsPerBlock === 'string') {
          try { unitsPerBlock = JSON.parse(unitsPerBlock); } catch { unitsPerBlock = {}; }
        }
        const blockUnitTypes = {};
        const numBlocks = prop.number_of_blocks || Object.keys(unitsPerBlock || {}).length || 1;
        for (let i = 1; i <= numBlocks; i++) {
          blockUnitTypes[i] = { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
        }
        await pool.execute('UPDATE properties SET block_unit_types = ? WHERE id = ?', [JSON.stringify(blockUnitTypes), prop.id]);
        results.properties_gc++;
      } catch (e) { console.log('GC properties error:', e.message); }
    }

    // 4. Update APT properties in properties table
    const [aptProperties] = await pool.execute(
      `SELECT id, property_id, name FROM properties 
       WHERE (property_type = 'apartment' OR property_type = 'APT') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '')`
    );

    for (const prop of aptProperties) {
      try {
        const blockUnitTypes = { apt: { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 } };
        await pool.execute('UPDATE properties SET block_unit_types = ? WHERE id = ?', [JSON.stringify(blockUnitTypes), prop.id]);
        results.properties_apt++;
      } catch (e) { console.log('APT properties error:', e.message); }
    }

    // 5. Update GC estimates in fp_estimates table
    const [gcEstimates] = await pool.execute(
      `SELECT id, estimate_id, number_of_blocks, units_per_block FROM fp_estimates 
       WHERE (property_type = 'gated_community' OR property_type = 'GC')
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '')`
    );

    for (const est of gcEstimates) {
      try {
        let unitsPerBlock = est.units_per_block;
        if (typeof unitsPerBlock === 'string') {
          try { unitsPerBlock = JSON.parse(unitsPerBlock); } catch { unitsPerBlock = {}; }
        }
        const blockUnitTypes = {};
        const numBlocks = est.number_of_blocks || Object.keys(unitsPerBlock || {}).length || 1;
        for (let i = 1; i <= numBlocks; i++) {
          blockUnitTypes[i] = { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
        }
        await pool.execute('UPDATE fp_estimates SET block_unit_types = ? WHERE id = ?', [JSON.stringify(blockUnitTypes), est.id]);
        results.estimates_gc++;
      } catch (e) { console.log('GC estimates error:', e.message); }
    }

    // 6. Update APT estimates in fp_estimates table
    const [aptEstimates] = await pool.execute(
      `SELECT id, estimate_id FROM fp_estimates 
       WHERE (property_type = 'apartment' OR property_type = 'APT')
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null' OR block_unit_types = '')`
    );

    for (const est of aptEstimates) {
      try {
        const blockUnitTypes = { apt: { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 } };
        await pool.execute('UPDATE fp_estimates SET block_unit_types = ? WHERE id = ?', [JSON.stringify(blockUnitTypes), est.id]);
        results.estimates_apt++;
      } catch (e) { console.log('APT estimates error:', e.message); }
    }

    const totalUpdated = Object.values(results).reduce((sum, val) => sum + val, 0);
    res.json({ 
      success: true, 
      message: `Migration completed. Updated ${totalUpdated} records.`,
      data: results
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WORK ORDER AUTO-DELETE NOTIFICATIONS
// ============================================
const { getWorkOrdersApproachingDeletion, getApproachingDeletionCount, AUTO_DELETE_DAYS, WARNING_DAYS } = require('../utils/workOrderCleanup');

// Get work orders approaching auto-delete (Admin)
router.get('/work-orders/approaching-deletion', authenticate, adminOnly, async (req, res) => {
  try {
    const workOrders = await getWorkOrdersApproachingDeletion();
    res.json({
      success: true,
      data: workOrders,
      config: { autoDeleteDays: AUTO_DELETE_DAYS, warningDays: WARNING_DAYS }
    });
  } catch (error) {
    console.error('Error getting approaching deletion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get count of work orders approaching auto-delete (Admin)
router.get('/work-orders/approaching-deletion/count', authenticate, adminOnly, async (req, res) => {
  try {
    const count = await getApproachingDeletionCount();
    res.json({ success: true, count });
  } catch (error) {
    console.error('Error getting approaching deletion count:', error);
    res.status(500).json({ success: false, count: 0 });
  }
});

module.exports = router;
