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

// Demo admin users (fallback when database is not available)
const DEMO_ADMINS = [
  { id: 1, username: 'admin', email: 'admin@example.com', firstName: 'System', lastName: 'Admin', role: 'admin', password: 'admin123' },
  { id: 2, username: 'exec', email: 'exec@example.com', firstName: 'Property', lastName: 'Manager', role: 'executive', password: 'exec123' }
];

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

    // Try database first, fallback to demo users
    let admin = null;
    let useDemo = false;

    try {
      const [admins] = await pool.execute(
        `SELECT * FROM admin_users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
        [username, username]
      );
      if (admins.length > 0) {
        admin = admins[0];
      }
    } catch (dbError) {
      console.log('Database not available, using demo mode');
      useDemo = true;
    }

    // Fallback to demo users
    if (!admin) {
      const demoAdmin = DEMO_ADMINS.find(a => a.username === username || a.email === username);
      if (demoAdmin && demoAdmin.password === password) {
        return res.json({
          success: true,
          message: 'Login successful (Demo Mode)',
          data: {
            id: demoAdmin.id,
            username: demoAdmin.username,
            email: demoAdmin.email,
            firstName: demoAdmin.firstName,
            lastName: demoAdmin.lastName,
            role: demoAdmin.role
          }
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // For demo, accept 'admin123' as password
    const isValidPassword = password === 'admin123' || await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    try {
      await pool.execute(
        `UPDATE admin_users SET last_login = NOW() WHERE id = ?`,
        [admin.id]
      );
    } catch (e) {}

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
    const [residents] = await pool.execute(
      `SELECT r.*, u.unit_number, p.name as property_name, p.property_id as property_code,
              CONCAT(a.first_name, ' ', a.last_name) as created_by_name
       FROM residents r 
       JOIN units u ON r.unit_id = u.id 
       JOIN properties p ON u.property_id = p.id
       LEFT JOIN admin_users a ON r.created_by = a.id
       ORDER BY r.created_at DESC`
    );

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
    const [properties] = await pool.execute(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM units WHERE property_id = p.id AND is_active = TRUE) as total_units,
              (SELECT COUNT(*) FROM units WHERE property_id = p.id AND is_occupied = TRUE AND is_active = TRUE) as occupied_units
       FROM properties p 
       ORDER BY p.name`
    );

    res.json({
      success: true,
      data: properties
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

    const [result] = await pool.execute(
      `INSERT INTO properties (property_id, name, address, city, state, zip_code, country)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, name, address, city || null, state || null, zipCode || null, country || 'USA']
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
    const [units] = await pool.execute(
      `SELECT u.*, p.name as property_name, p.property_id as property_code,
              r.first_name as resident_first_name, r.last_name as resident_last_name
       FROM units u 
       JOIN properties p ON u.property_id = p.id
       LEFT JOIN residents r ON r.unit_id = u.id AND r.is_primary_resident = TRUE AND r.is_active = TRUE
       ORDER BY p.name, u.unit_number`
    );

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

// Get all work orders (Admin, Manager full access; Supervisor view only)
router.get('/work-orders', authenticate, supervisorOrAbove, async (req, res) => {
  try {
    const [workOrders] = await pool.execute(
      `SELECT wo.*, 
              r.first_name, r.last_name, r.email, r.phone,
              u.unit_number, p.name as property_name, p.property_id as property_code,
              c.name as category_name, sc.name as subcategory_name
       FROM work_orders wo
       JOIN residents r ON wo.resident_id = r.id
       JOIN units u ON wo.unit_id = u.id
       JOIN properties p ON wo.property_id = p.id
       JOIN categories c ON wo.category_id = c.id
       JOIN subcategories sc ON wo.subcategory_id = sc.id
       ORDER BY wo.created_at DESC`
    );

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
    const { status, priority, assignedTo, scheduledDate, notes } = req.body;

    let completedDate = null;
    if (status === 'completed') {
      completedDate = new Date();
    }

    const [result] = await pool.execute(
      `UPDATE work_orders SET 
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        assigned_to = ?,
        scheduled_date = ?,
        completed_date = ?,
        notes = ?
       WHERE id = ?`,
      [status, priority, assignedTo, scheduledDate, completedDate, notes, id]
    );

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

// ============================================
// DASHBOARD STATS
// ============================================

router.get('/dashboard/stats', authenticate, supervisorOrAbove, async (req, res) => {
  try {
    const [[propertyCount]] = await pool.execute(`SELECT COUNT(*) as count FROM properties WHERE is_active = TRUE`);
    const [[unitCount]] = await pool.execute(`SELECT COUNT(*) as count FROM units WHERE is_active = TRUE`);
    const [[residentCount]] = await pool.execute(`SELECT COUNT(*) as count FROM residents WHERE is_active = TRUE`);
    const [[workOrderCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders`);
    const [[pendingCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status = 'pending'`);
    const [[completedCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status = 'completed'`);

    res.json({
      success: true,
      data: {
        properties: propertyCount.count,
        units: unitCount.count,
        residents: residentCount.count,
        workOrders: workOrderCount.count,
        pendingWorkOrders: pendingCount.count,
        completedWorkOrders: completedCount.count
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

module.exports = router;
