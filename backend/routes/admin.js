const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const { authenticate } = require('../middleware/auth');
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
      `SELECT * FROM admin_users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
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

    res.json({
      success: true,
      message: 'Login successful',
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

    // Soft delete
    const [result] = await pool.execute(
      `UPDATE residents SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
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
       ORDER BY p.name`
    );

    let onboardedProperties = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type as type,
                op.zone_id as zone, op.division, op.total_units, 0 as occupied_units,
                op.address, op.city, op.state, op.pincode as zip_code,
                op.contact_person, op.contact_phone, op.contact_email as email,
                COALESCE(CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')), op.created_by, 'System') as created_by_name,
                op.created_at, op.status,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
         WHERE op.status = 'active'
         ORDER BY op.community_name`
      );
      onboardedProperties = rows;
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    // Combine both sources
    const allProperties = [...regularProperties, ...onboardedProperties];

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

    const propertyId = `PROP-${Date.now().toString(36).toUpperCase()}`;
    
    // Get actual user name from database
    let creatorName = 'System';
    try {
      const [userRows] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ? OR email = ?',
        [req.user?.id, req.user?.email]
      );
      if (userRows.length > 0) {
        creatorName = `${userRows[0].first_name || ''} ${userRows[0].last_name || ''}`.trim() || 'System';
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

// Update property (Admin, Manager only)
router.put('/properties/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, state, zipCode, country, isActive } = req.body;

    const [result] = await pool.execute(
      `UPDATE properties SET 
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        city = ?,
        state = ?,
        zip_code = ?,
        country = COALESCE(?, country),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, address, city, state, zipCode, country, isActive, id]
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

// Delete property (Admin only)
router.delete('/properties/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute(
      `UPDATE properties SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      message: 'Property deleted successfully'
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
      `UPDATE units SET is_active = FALSE WHERE id = ?`,
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
             wo.customer_name as first_name,
             '' as last_name,
             wo.customer_email as email,
             wo.customer_phone as phone,
             COALESCE(p.name, wo.property_name, op.community_name) as property_name,
             COALESCE(p.property_id, wo.property_id) as property_code,
             COALESCE(c.name, wo.category_name) as category_name,
             wo.subcategory_name,
             v.company_name as vendor_name,
             r.first_name as resident_first_name,
             r.last_name as resident_last_name,
             r.phone as resident_phone,
             r.email as resident_email
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.property_id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN residents r ON wo.resident_id = r.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (status && status !== 'all') {
      if (status === 'pending') {
        conditions.push(`wo.status IN ('pending', 'assigned', 'in_progress')`);
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

// Update work order (Admin, Manager only)
router.put('/work-orders/:id', authenticate, managerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, priority, assignedTo, scheduledDate, notes,
      category_id, subcategory_id, description,
      permission_to_enter, has_pet, entry_notes
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

    // Update category and subcategory names
    if (category_id) {
      const [cats] = await pool.execute('SELECT name FROM categories WHERE id = ?', [category_id]);
      if (cats.length > 0) {
        await pool.execute('UPDATE work_orders SET category_name = ? WHERE id = ?', [cats[0].name, id]);
      }
    }
    if (subcategory_id) {
      const [subs] = await pool.execute('SELECT name FROM subcategories WHERE id = ?', [subcategory_id]);
      if (subs.length > 0) {
        await pool.execute('UPDATE work_orders SET subcategory_name = ? WHERE id = ?', [subs[0].name, id]);
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
       FROM onboarded_vendors WHERE status = 'active' OR is_active = TRUE ORDER BY company_name`
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
      `SELECT id, first_name, last_name, email, phone, role FROM admins WHERE is_active = TRUE ORDER BY first_name`
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
        v.owner_name as vendor_name, v.vendor_id as vendor_code, v.service_type,
        v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
        v.zone as zone_name, v.area_name as area, v.rate_per_visit
      FROM property_vendor_assignments pva
      LEFT JOIN properties p ON pva.property_id = p.id
      LEFT JOIN onboarded_properties op ON pva.property_id = op.id
      JOIN onboarded_vendors v ON pva.vendor_id = v.id
    `;
    
    if (status === 'active') {
      query += ` WHERE pva.is_active = TRUE`;
    } else if (status === 'removed') {
      query += ` WHERE pva.is_active = FALSE`;
    }
    
    query += ` ORDER BY pva.assigned_at DESC`;
    
    const [assignments] = await pool.execute(query);
    
    res.json({
      success: true,
      data: assignments.map(a => ({
        id: a.id,
        propertyId: a.property_id,
        propertyName: a.property_name || 'Unknown Property',
        propertyType: a.property_type,
        address: a.address,
        city: a.city,
        vendorId: a.vendor_id,
        vendorCode: a.vendor_code,
        vendorName: a.vendor_name,
        serviceType: a.service_type,
        vendorPhone: a.vendor_phone,
        vendorEmail: a.vendor_email,
        zoneName: a.zone_name,
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

    res.json({
      success: true,
      message: 'Work order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting work order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting work order',
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
        .catch(() => pool.execute(`SELECT COUNT(*) as count FROM properties WHERE is_active = TRUE`)
          .then(([[r]]) => r.count)
          .catch(() => 0)),
      
      // Vendors count
      pool.execute(`SELECT COUNT(*) as count FROM onboarded_vendors WHERE status = 'active'`)
        .then(([[r]]) => r.count)
        .catch(() => pool.execute(`SELECT COUNT(*) as count FROM onboarded_vendors WHERE is_active = TRUE`)
          .then(([[r]]) => r.count)
          .catch(() => 0)),
      
      // Customers count
      pool.execute(`SELECT COUNT(*) as count FROM residents WHERE is_active = TRUE`)
        .then(([[r]]) => r.count)
        .catch(() => 0),
      
      // Work orders - single query with conditional counts
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('pending', 'open', 'in_progress', 'requested', 'under_review', 'assigned') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed', 'verified') THEN 1 ELSE 0 END) as completed
        FROM work_orders
      `).then(([[r]]) => ({ total: r.total || 0, pending: r.pending || 0, completed: r.completed || 0 }))
        .catch(() => ({ total: 0, pending: 0, completed: 0 })),
      
      // Estimates count
      pool.execute(`SELECT COUNT(*) as count FROM estimates`)
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
  return past.toLocaleDateString();
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
      const [[pendingCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status IN ('pending', 'open', 'assigned', 'in_progress', 'requested', 'under_review', 'accepted')`);
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
      estimates,
      recentWorkOrders
    ] = await Promise.all([
      // ALL properties (both with and without franchise_partner_id)
      safeCount('SELECT COUNT(*) as count FROM properties'),
      // Onboarded vendors (FP vendors)
      safeCount('SELECT COUNT(*) as count FROM onboarded_vendors'),
      // FP employees
      safeCount('SELECT COUNT(*) as count FROM fp_employees WHERE is_active = 1'),
      // Work orders - combined query for all work orders
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
        FROM work_orders
      `).then(([[r]]) => ({ 
        total: Number(r.total) || 0, 
        pending: Number(r.pending) || 0, 
        completed: Number(r.completed) || 0 
      })).catch(() => ({ total: 0, pending: 0, completed: 0 })),
      // Estimates (both regular and FP estimates)
      safeCount('SELECT COUNT(*) as count FROM estimates'),
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
    
    console.log('Admin Dashboard Stats:', { properties, onboardedVendors, fpEmployees, workOrderStats, estimates });
    
    res.json({
      success: true,
      data: {
        totalProperties: properties,
        totalVendors: onboardedVendors,
        totalEmployees: fpEmployees,
        pendingWorkOrders: workOrderStats.pending,
        completedWorkOrders: workOrderStats.completed,
        totalEstimates: estimates,
        recentWorkOrders: recentWorkOrders
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
       WHERE is_active = TRUE 
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
                p.created_by, 'System'
              ) as created_by,
              'properties' as source_table,
              p.franchise_partner_id as fp_id, fp.fp_code, fp.company_name as fp_name,
              COALESCE(p.category, 'residential') as category
       FROM properties p
       LEFT JOIN franchise_partners fp ON p.franchise_partner_id = fp.id
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
       ORDER BY p.created_at DESC`
    );
    
    console.log('Admin all-properties: Found', properties.length, 'regular properties');
    
    // Onboarded properties from all FPs
    let onboardedProps = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type,
                op.zone as zone_name, op.area_name as area,
                op.address, op.city, op.state, op.postal_code as zip_code,
                op.contact_person, op.contact_phone, op.contact_email,
                op.created_at, op.status,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  op.created_by, 'System'
                ) as created_by,
                'onboarded_properties' as source_table,
                op.franchise_partner_id as fp_id, fp.fp_code, fp.company_name as fp_name,
                COALESCE(op.category, 'residential') as category
         FROM onboarded_properties op
         LEFT JOIN franchise_partners fp ON op.franchise_partner_id = fp.id
         LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR CAST(op.created_by AS CHAR) = CAST(fpe.id AS CHAR)
         WHERE op.status = 'active'
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
    
    let query = `
      SELECT wo.id, wo.work_order_id, wo.title, wo.description, wo.status, wo.priority,
             wo.created_at, wo.updated_at, wo.property_id, wo.category_id,
             COALESCE(p.name, wo.property_name) as property_name,
             COALESCE(c.name, wo.category_name) as category_name,
             wo.franchise_partner_id,
             fp.fp_code, fp.company_name as fp_name,
             v.company_name as vendor_name,
             COALESCE(
               CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
               wo.created_by, 'System'
             ) as created_by_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN franchise_partners fp ON wo.franchise_partner_id = fp.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR CAST(wo.created_by AS CHAR) = CAST(fpe.id AS CHAR)
      WHERE 1=1
    `;
    
    if (status === 'pending') {
      query += ` AND wo.status IN ('pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress')`;
    } else if (status === 'completed') {
      query += ` AND wo.status IN ('completed', 'closed')`;
    }
    
    query += ` ORDER BY wo.created_at DESC`;
    
    const [workOrders] = await pool.execute(query);
    console.log('Admin all-work-orders: Found', workOrders.length, 'work orders');
    res.json({ success: true, data: workOrders || [] });
  } catch (error) {
    console.error('Error fetching all work orders:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch work orders' });
  }
});

// Get ALL employees from ALL FPs (Admin mode)
router.get('/all-employees', authenticate, adminOnly, async (req, res) => {
  try {
    const [employees] = await pool.execute(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name,
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name,
              e.email, e.phone, e.role, e.is_active,
              CASE WHEN e.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
              e.created_at, e.franchise_partner_id,
              fp.fp_code, fp.company_name as fp_name,
              GROUP_CONCAT(DISTINCT ez.zone_name ORDER BY ez.zone_name) as zone_names,
              COUNT(DISTINCT ez.zone_name) as zone_count
       FROM fp_employees e
       LEFT JOIN franchise_partners fp ON e.franchise_partner_id = fp.id
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`
    );
    
    console.log('Admin all-employees: Found', employees.length, 'employees');
    res.json({ success: true, data: employees || [] });
  } catch (error) {
    console.error('Error fetching all employees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees' });
  }
});

// Get ALL vendor assignments from ALL FPs (Admin mode)
router.get('/all-vendor-assignments', authenticate, adminOnly, async (req, res) => {
  try {
    const [assignments] = await pool.execute(
      `SELECT va.*, 
              ov.owner_name as vendor_name, ov.service_type, ov.zone as vendor_zone,
              p.name as property_name, p.property_type, p.zone_name as property_zone,
              fp.fp_code, fp.company_name as fp_name,
              COALESCE(CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')), va.assigned_by, 'System') as assigned_by_name
       FROM vendor_assignments va
       LEFT JOIN onboarded_vendors ov ON va.vendor_id = ov.id
       LEFT JOIN properties p ON va.property_id = p.id
       LEFT JOIN franchise_partners fp ON va.franchise_partner_id = fp.id
       LEFT JOIN fp_employees fpe ON va.assigned_by = fpe.email OR va.assigned_by = fpe.username
       WHERE va.status = 'active'
       ORDER BY va.created_at DESC`
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
       WHERE ov.status = 'active'
       ORDER BY ov.created_at DESC`
    );
    
    console.log('Admin all-vendors: Found', vendors.length, 'vendors');
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
    
    // Dashboard stats - EXACTLY matching FP dashboard queries
    // Properties count
    const [[propCount]] = await pool.execute(
      `SELECT COUNT(*) as count FROM properties WHERE franchise_partner_id = ?`,
      [fpIdNum]
    );
    
    // Vendors count (same as FP dashboard - no is_active filter)
    const [[vendorCount]] = await pool.execute(
      `SELECT COUNT(*) as count FROM onboarded_vendors WHERE franchise_partner_id = ?`,
      [fpIdNum]
    );
    
    // Work orders - combined query (same as FP dashboard)
    const [[workOrderStats]] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
      FROM work_orders WHERE franchise_partner_id = ?
    `, [fpIdNum]);
    
    // Estimates count (from estimates table, not fp_estimates)
    const [[estimateCount]] = await pool.execute(
      `SELECT COUNT(*) as count FROM estimates WHERE franchise_partner_id = ?`,
      [fpIdNum]
    );
    
    // Employee count (same as FP dashboard)
    const [[employeeStats]] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM fp_employees WHERE franchise_partner_id = ?
    `, [fpIdNum]);
    
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
    
    res.json({
      success: true,
      data: {
        fpInfo,
        stats: {
          totalProperties: propCount?.count || 0,
          totalWorkOrders: Number(workOrderStats?.total) || 0,
          pendingWorkOrders: Number(workOrderStats?.pending) || 0,
          completedWorkOrders: Number(workOrderStats?.completed) || 0,
          totalVendors: vendorCount?.count || 0,
          totalEmployees: Number(employeeStats?.total) || 0,
          totalEstimates: estimateCount?.count || 0
        },
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
    
    console.log('Admin fp-view properties: Fetching for FP ID:', fpIdNum);
    
    // Regular properties - all fields with creator name
    const [properties] = await pool.execute(
      `SELECT p.id, p.property_id, p.name, p.property_type,
              p.zone_id as zone_name, p.area_name as area,
              p.division_id as division,
              p.address, p.city, p.state, p.zip_code,
              p.contact_person, p.contact_phone, p.contact_email,
              p.created_at, p.status,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                p.created_by, 'System'
              ) as created_by,
              'properties' as source_table,
              COALESCE(p.category, 'residential') as category
       FROM properties p
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR CAST(p.created_by AS CHAR) = CAST(fpe.id AS CHAR)
       WHERE p.franchise_partner_id = ?
       ORDER BY p.created_at DESC`,
      [fpIdNum]
    );
    
    console.log('Admin fp-view properties: Found', properties.length, 'regular properties');
    
    // Onboarded properties
    let onboardedProps = [];
    try {
      const [rows] = await pool.execute(
        `SELECT op.id, op.property_id, op.community_name as name, op.property_type,
                op.zone as zone_name, op.area_name as area,
                op.address, op.city, op.state, op.postal_code as zip_code,
                op.contact_person, op.contact_phone, op.contact_email,
                op.created_at, op.status,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  op.created_by, 'System'
                ) as created_by,
                'onboarded_properties' as source_table,
                COALESCE(op.category, 'residential') as category
         FROM onboarded_properties op
         LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR CAST(op.created_by AS CHAR) = CAST(fpe.id AS CHAR)
         WHERE op.franchise_partner_id = ? AND op.status = 'active'
         ORDER BY op.created_at DESC`,
        [fpIdNum]
      );
      onboardedProps = rows;
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
      SELECT wo.id, wo.work_order_id, wo.title, wo.description, wo.status, wo.priority,
             wo.created_at, wo.updated_at, wo.property_id, wo.category_id,
             COALESCE(p.name, wo.property_name) as property_name,
             COALESCE(c.name, wo.category_name) as category_name,
             v.company_name as vendor_name,
             COALESCE(
               CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
               wo.created_by, 'System'
             ) as created_by_name
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN categories c ON wo.category_id = c.id
      LEFT JOIN onboarded_vendors v ON wo.assigned_vendor_id = v.id
      LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR CAST(wo.created_by AS CHAR) = CAST(fpe.id AS CHAR)
      WHERE wo.franchise_partner_id = ?
    `;
    const params = [fpIdNum];
    
    if (status === 'pending') {
      query += ` AND wo.status IN ('pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress')`;
    } else if (status === 'completed') {
      query += ` AND wo.status IN ('completed', 'closed')`;
    }
    
    query += ` ORDER BY wo.created_at DESC`;
    
    const [workOrders] = await pool.execute(query, params);
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
    
    const [vendors] = await pool.execute(
      `SELECT ov.*, ov.owner_name as vendor_name, ov.owner_mobile as phone, ov.owner_email as email,
              COALESCE(
                CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                ov.created_by, 'System'
              ) as created_by_name
       FROM onboarded_vendors ov
       LEFT JOIN fp_employees fpe ON ov.created_by_id = fpe.id OR ov.created_by = fpe.email OR ov.created_by = fpe.username
       WHERE (ov.franchise_partner_id = ? OR ov.franchise_partner_id IS NULL) AND ov.status = 'active'
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

// Get FP Vendor Assignments
router.get('/fp-view/:fpId/vendor-assignments', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const [assignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
              COALESCE(p.name, op.community_name) as property_name,
              COALESCE(p.property_id, op.property_id) as propertyId,
              v.owner_name as vendor_name, v.vendor_id as vendor_code, v.service_type,
              v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
              v.zone as zone_name
       FROM property_vendor_assignments pva
       LEFT JOIN properties p ON pva.property_id = p.id
       LEFT JOIN onboarded_properties op ON pva.property_id = op.id
       JOIN onboarded_vendors v ON pva.vendor_id = v.id
       WHERE (p.franchise_partner_id = ? OR op.franchise_partner_id = ?) AND pva.is_active = TRUE
       ORDER BY pva.assigned_at DESC`,
      [fpIdNum, fpIdNum]
    );
    
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
    
    const [employees] = await pool.execute(
      `SELECT e.id, e.employee_id, e.first_name, e.last_name,
              CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) as name,
              e.email, e.phone, e.role, e.is_active,
              CASE WHEN e.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
              e.created_at,
              GROUP_CONCAT(DISTINCT ez.zone_name ORDER BY ez.zone_name) as zone_names,
              COUNT(DISTINCT ez.zone_name) as zone_count
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       WHERE e.franchise_partner_id = ?
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      [fpIdNum, fpIdNum]
    );
    
    console.log('Admin fp-view employees: Found', employees.length, 'employees for FP', fpIdNum);
    res.json({ success: true, data: employees || [] });
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
              GROUP_CONCAT(DISTINCT ez.zone_name ORDER BY ez.zone_name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       WHERE e.franchise_partner_id = ? AND e.is_active = TRUE
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      [fpIdNum, fpIdNum]
    );
    
    const [zones] = await pool.execute(
      `SELECT DISTINCT ez.zone_name as name FROM fp_employee_zones ez 
       WHERE ez.franchise_partner_id = ? ORDER BY ez.zone_name`,
      [fpIdNum]
    );
    
    res.json({ 
      success: true, 
      data: {
        employees: employees.map(emp => ({
          ...emp,
          zone_names: emp.zone_names || 'No zones assigned'
        })),
        zones
      }
    });
  } catch (error) {
    console.error('Error fetching FP employee zones:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get FP Estimates
router.get('/fp-view/:fpId/estimates', authenticate, adminOnly, async (req, res) => {
  try {
    const fpIdNum = validateFpId(req.params.fpId);
    if (!fpIdNum) {
      return res.status(400).json({ success: false, message: 'Invalid FP ID' });
    }
    
    const { archived } = req.query;
    const isArchived = archived === 'true';
    
    const [estimates] = await pool.execute(
      `SELECT e.*, p.name as property_name, c.name as customer_name
       FROM fp_estimates e
       LEFT JOIN properties p ON e.property_id = p.id
       LEFT JOIN clients c ON e.customer_id = c.id
       WHERE e.franchise_partner_id = ? AND e.is_archived = ?
       ORDER BY e.created_at DESC`,
      [fpIdNum, isArchived]
    );
    
    res.json({ success: true, data: estimates || [] });
  } catch (error) {
    console.error('Error fetching FP estimates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch estimates' });
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
      `SELECT * FROM amc_packages WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
      [fpIdNum]
    );
    
    res.json({ success: true, data: packages || [] });
  } catch (error) {
    console.error('Error fetching FP AMC packages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AMC packages' });
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
      `SELECT * FROM addons WHERE franchise_partner_id = ? ORDER BY created_at DESC`,
      [fpIdNum]
    );
    
    res.json({ success: true, data: addons || [] });
  } catch (error) {
    console.error('Error fetching FP addons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch addons' });
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

module.exports = router;
