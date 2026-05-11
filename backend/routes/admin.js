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

// Demo mode configuration - credentials loaded from environment variables
const DEMO_MODE_ENABLED = process.env.DEMO_MODE === 'true';
const DEMO_PASSWORD_HASH = process.env.DEMO_PASSWORD_HASH || '';

// Demo admin users (fallback when database is not available)
// NOTE: Passwords are NOT stored here - they must be set via environment variables
const DEMO_ADMINS = DEMO_MODE_ENABLED ? [
  { id: 1, username: 'demo_admin', email: 'demo.admin@example.com', firstName: 'Demo', lastName: 'Admin', role: 'admin' },
  { id: 2, username: 'demo_exec', email: 'demo.exec@example.com', firstName: 'Demo', lastName: 'Executive', role: 'executive' }
] : [];

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

    // Fallback to demo users (only if demo mode is enabled)
    if (!admin && DEMO_MODE_ENABLED) {
      const demoAdmin = DEMO_ADMINS.find(a => a.username === username || a.email === username);
      if (demoAdmin && DEMO_PASSWORD_HASH) {
        // Verify password against environment-stored hash
        const isDemoPasswordValid = await bcrypt.compare(password, DEMO_PASSWORD_HASH);
        if (isDemoPasswordValid) {
          return res.json({
            success: true,
            message: 'Login successful (Demo Mode)',
            data: {
              id: demoAdmin.id,
              username: demoAdmin.username,
              email: demoAdmin.email,
              firstName: demoAdmin.firstName,
              lastName: demoAdmin.lastName,
              role: demoAdmin.role,
              isDemo: true
            }
          });
        }
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password against stored hash
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

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
// DASHBOARD STATS (Public - no auth required)
// ============================================

router.get('/dashboard/stats', async (req, res) => {
  try {
    // Properties from onboarded_properties table
    let properties = 0;
    try {
      const [[propCount]] = await pool.execute(`SELECT COUNT(*) as count FROM onboarded_properties WHERE status = 'active'`);
      properties = propCount.count;
    } catch (e) {
      try {
        const [[propCount]] = await pool.execute(`SELECT COUNT(*) as count FROM properties WHERE is_active = TRUE`);
        properties = propCount.count;
      } catch (e2) {}
    }

    // Vendors from onboarded_vendors table
    let vendors = 0;
    try {
      const [[vendorCount]] = await pool.execute(`SELECT COUNT(*) as count FROM onboarded_vendors WHERE status = 'active'`);
      vendors = vendorCount.count;
    } catch (e) {
      try {
        const [[vendorCount]] = await pool.execute(`SELECT COUNT(*) as count FROM vendors WHERE is_active = TRUE`);
        vendors = vendorCount.count;
      } catch (e2) {}
    }

    // Customers/Residents
    let customers = 0;
    try {
      const [[customerCount]] = await pool.execute(`SELECT COUNT(*) as count FROM residents WHERE is_active = TRUE`);
      customers = customerCount.count;
    } catch (e) {}

    // Work Orders
    let workOrders = 0, pendingWorkOrders = 0, completedWorkOrders = 0;
    try {
      const [[woCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders`);
      workOrders = woCount.count;
      const [[pendingCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status IN ('pending', 'open', 'in_progress')`);
      pendingWorkOrders = pendingCount.count;
      const [[completedCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status = 'completed'`);
      completedWorkOrders = completedCount.count;
    } catch (e) {}

    // Estimates
    let totalEstimates = 0;
    try {
      const [[estCount]] = await pool.execute(`SELECT COUNT(*) as count FROM estimates`);
      totalEstimates = estCount.count;
    } catch (e) {}

    // Zones
    let totalZones = 0;
    try {
      const [[zoneCount]] = await pool.execute(`SELECT COUNT(DISTINCT zone) as count FROM onboarded_properties WHERE zone IS NOT NULL AND zone != '' AND status = 'active'`);
      totalZones = zoneCount.count;
    } catch (e) {}

    res.json({
      success: true,
      data: {
        properties,
        vendors,
        customers,
        workOrders,
        pendingWorkOrders,
        completedWorkOrders,
        totalEstimates,
        totalZones,
        activeWorkOrders: pendingWorkOrders
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
    const activities = [];
    
    // Get recent work orders
    try {
      const [workOrders] = await pool.execute(`
        SELECT id, work_order_id, title, status, created_at 
        FROM work_orders 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      workOrders.forEach(wo => {
        activities.push({
          id: `wo-${wo.id}`,
          type: 'workorder',
          message: `Work order ${wo.work_order_id || '#' + wo.id}: ${wo.title || 'New work order'} - ${wo.status}`,
          time: formatTimeAgo(wo.created_at),
          timestamp: wo.created_at
        });
      });
    } catch (e) {}

    // Get recent properties
    try {
      const [props] = await pool.execute(`
        SELECT id, property_id, community_name, created_at 
        FROM onboarded_properties 
        WHERE status = 'active'
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      props.forEach(p => {
        activities.push({
          id: `prop-${p.id}`,
          type: 'property',
          message: `Property ${p.community_name || p.property_id} was added`,
          time: formatTimeAgo(p.created_at),
          timestamp: p.created_at
        });
      });
    } catch (e) {}

    // Get recent vendors
    try {
      const [vends] = await pool.execute(`
        SELECT id, vendor_id, company_name, created_at 
        FROM onboarded_vendors 
        WHERE status = 'active'
        ORDER BY created_at DESC 
        LIMIT 3
      `);
      vends.forEach(v => {
        activities.push({
          id: `vend-${v.id}`,
          type: 'vendor',
          message: `Vendor ${v.company_name || v.vendor_id} was onboarded`,
          time: formatTimeAgo(v.created_at),
          timestamp: v.created_at
        });
      });
    } catch (e) {}

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
      const [[pendingCount]] = await pool.execute(`SELECT COUNT(*) as count FROM work_orders WHERE status IN ('pending', 'open')`);
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

module.exports = router;
