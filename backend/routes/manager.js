/**
 * Manager Portal API Routes
 * All routes are scoped to the logged-in Manager
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { ROLES, ROLE_NAMES, isManager } = require('../config/roles');
const { 
  attachManagerScope, 
  requireManagerScope, 
  getManagerIdForInsert,
  validateOwnership,
  buildScopedQuery,
  filterPricing,
  getScopeId,
  getScopeColumn
} = require('../middleware/managerScope');

// ============================================
// MANAGER AUTHENTICATION (Public - No Auth Required)
// ============================================

// Manager Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find manager user - include franchise_partner_id for FP-created managers
    const [users] = await pool.execute(
      `SELECT id, username, email, password_hash, first_name, last_name, role, is_active, franchise_partner_id 
       FROM users 
       WHERE (username = ? OR email = ?) AND role = ? AND is_active = 1`,
      [username, username, ROLES.MANAGER]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or not a Manager account'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token - include franchisePartnerId for FP-created managers
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      managerId: user.id,
      franchisePartnerId: user.franchise_partner_id || null
    });

    // Update last login
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          roleName: ROLE_NAMES[user.role],
          managerId: user.id,
          franchisePartnerId: user.franchise_partner_id || null,
          portal: 'manager'
        }
      }
    });
  } catch (error) {
    console.error('Manager Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Apply authentication middleware to all routes below
router.use(authenticate);
router.use(attachManagerScope);

// ============================================
// MANAGER DASHBOARD
// ============================================

router.get('/dashboard', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    const employeeTable = req.isFPManager ? 'fp_employees' : 'manager_employees';
    const employeeScopeCol = req.isFPManager ? 'franchise_partner_id' : 'manager_id';

    // Run all queries in parallel for faster response
    const [
      propertiesCount,
      vendorsCount,
      customersCount,
      employeesCount,
      workOrderStats,
      estimatesCount,
      recentWorkOrders
    ] = await Promise.all([
      // Properties count
      pool.execute(`SELECT COUNT(*) as count FROM properties WHERE ${scopeColumn} = ?`, [scopeId])
        .then(([r]) => r[0].count).catch(() => 0),
      
      // Vendors count
      pool.execute(`SELECT COUNT(*) as count FROM vendors WHERE ${scopeColumn} = ?`, [scopeId])
        .then(([r]) => r[0].count).catch(() => 0),
      
      // Customers count
      pool.execute(`SELECT COUNT(*) as count FROM clients WHERE ${scopeColumn} = ?`, [scopeId])
        .then(([r]) => r[0].count).catch(() => 0),
      
      // Employees count
      pool.execute(`SELECT COUNT(*) as count FROM ${employeeTable} WHERE ${employeeScopeCol} = ? AND is_active = 1`, [scopeId])
        .then(([r]) => r[0].count).catch(() => 0),
      
      // Work orders - combined query (FP managers see FP work orders)
      pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status NOT IN ('completed', 'closed', 'cancelled') THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('completed', 'closed') THEN 1 ELSE 0 END) as completed
        FROM work_orders WHERE ${franchisePartnerId ? 'franchise_partner_id = ?' : '1=0'}
      `, franchisePartnerId ? [franchisePartnerId] : []).then(([[r]]) => ({ 
        total: r.total || 0, 
        pending: r.pending || 0, 
        completed: r.completed || 0 
      })).catch(() => ({ total: 0, pending: 0, completed: 0 })),
      
      // Estimates count
      pool.execute(`SELECT COUNT(*) as count FROM estimates WHERE ${scopeColumn} = ?`, [scopeId])
        .then(([r]) => r[0].count).catch(() => 0),
      
      // Recent work orders - FP managers see FP work orders
      pool.execute(
        `SELECT wo.*, p.name as property_name, c.name as category_name, 
                v.company_name as vendor_name, cl.name as client_name
         FROM work_orders wo
         LEFT JOIN properties p ON wo.property_id = p.id
         LEFT JOIN categories c ON wo.category_id = c.id
         LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
         LEFT JOIN clients cl ON wo.client_id = cl.id
         WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : '1=0'}
         ORDER BY wo.created_at DESC
         LIMIT 10`,
        franchisePartnerId ? [franchisePartnerId] : []
      ).then(([rows]) => rows).catch(() => [])
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          properties: propertiesCount,
          vendors: vendorsCount,
          customers: customersCount,
          employees: employeesCount,
          workOrders: workOrderStats.total,
          pendingWorkOrders: workOrderStats.pending,
          completedWorkOrders: workOrderStats.completed,
          estimates: estimatesCount
        },
        recentWorkOrders
      }
    });
  } catch (error) {
    console.error('Manager Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard',
      error: error.message
    });
  }
});

// ============================================
// PROPERTY MANAGEMENT
// ============================================

// Get all manager properties - Manager sees their own + linked FP properties
router.get('/properties', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    
    console.log('[Manager Properties] managerId:', managerId, 'franchisePartnerId:', franchisePartnerId);
    
    // Fetch from properties table with creator name - filter by FP for FP employees
    const propQuery = `SELECT p.*, 
        COALESCE(p.area_name, p.city) as area,
        COALESCE(p.division, 'General') as division,
        COALESCE(p.number_of_units, 1) as units,
        COALESCE(
          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
          CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
          p.created_by, 'System'
        ) as created_by_name,
        'properties' as source_table
       FROM properties p 
       LEFT JOIN fp_employees fpe ON p.created_by = fpe.email OR p.created_by = fpe.username
       LEFT JOIN users u ON p.created_by = u.email OR CAST(p.created_by AS UNSIGNED) = u.id
       WHERE ${franchisePartnerId ? 'p.franchise_partner_id = ?' : 'p.manager_id = ?'}
       ORDER BY p.created_at DESC`;
    const propParams = franchisePartnerId ? [franchisePartnerId] : [managerId];
    console.log('[Manager Properties] Params:', propParams);
    const [regularProperties] = await pool.execute(propQuery, propParams);
    console.log('[Manager Properties] Found:', regularProperties.length, 'properties');

    // Also fetch from onboarded_properties with creator name
    let onboardedProperties = [];
    try {
      const onbQuery = `SELECT op.id, op.property_id, op.community_name as name, op.property_type as type,
                op.zone_id as zone_name, op.division, op.total_units as units,
                op.address, op.city, op.state, op.pincode as zip_code,
                op.contact_person, op.contact_phone, op.contact_email as email,
                COALESCE(
                  CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                  CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')),
                  op.created_by, 'System'
                ) as created_by_name,
                op.created_at, op.status,
                'onboarded_properties' as source_table
         FROM onboarded_properties op
         LEFT JOIN fp_employees fpe ON op.created_by = fpe.email OR op.created_by = fpe.username
         LEFT JOIN users u ON op.created_by = u.email OR op.created_by = u.user_id OR op.created_by = u.id
         WHERE ${franchisePartnerId ? 'op.franchise_partner_id = ?' : 'op.manager_id = ?'} AND op.status = 'active'
         ORDER BY op.created_at DESC`;
      const onbParams = franchisePartnerId ? [franchisePartnerId] : [managerId];
      const [rows] = await pool.execute(onbQuery, onbParams);
      onboardedProperties = rows;
    } catch (e) {
      console.log('onboarded_properties fetch error:', e.message);
    }

    const allProperties = [...regularProperties, ...onboardedProperties];

    res.json({ success: true, data: allProperties });
  } catch (error) {
    console.error('[Manager Properties ERROR]', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create property - dual-tag with manager_id AND franchise_partner_id
router.post('/properties', requireManagerScope, async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;
    
    const propertyId = `PROP-MGR-${Date.now()}`;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
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
      `INSERT INTO properties (property_id, name, property_type, address, city, state, zip_code, 
        contact_person, contact_phone, contact_email, zone_id, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [propertyId, name, propertyType || 'residential', address, city, state, zipCode, 
       contactPerson, contactPhone, contactEmail, zoneId || null, managerId, franchisePartnerId, creatorName]
    );

    res.json({ success: true, message: 'Property created', data: { id: result.insertId, propertyId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single property by ID (for auto-populate in work orders)
router.get('/properties/:id', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    // Try properties table first
    const [properties] = await pool.execute(
      `SELECT p.*, p.contact_person, p.contact_phone, p.contact_email
       FROM properties p
       WHERE (p.id = ? OR p.property_id = ?) AND p.${scopeColumn} = ?`,
      [id, id, scopeId]
    );
    
    if (properties.length > 0) {
      return res.json({ success: true, data: properties[0] });
    }
    
    // Try onboarded_properties table
    const [onboarded] = await pool.execute(
      `SELECT op.*, op.community_name as name, op.contact_person, op.contact_phone, op.contact_email
       FROM onboarded_properties op
       WHERE (op.id = ? OR op.property_id = ?) AND op.${scopeColumn} = ?`,
      [id, id, scopeId]
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

// Update property
router.put('/properties/:id', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  try {
    const { name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, zoneId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE properties SET name = ?, property_type = ?, address = ?, city = ?, state = ?, 
        zip_code = ?, contact_person = ?, contact_phone = ?, contact_email = ?, zone_id = ?, updated_at = NOW()
       WHERE id = ? AND ${scopeColumn} = ?`,
      [name, propertyType, address, city, state, zipCode, contactPerson, contactPhone, contactEmail, 
       zoneId || null, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Property updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete property - DISABLED for Manager role
router.delete('/properties/:id', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// Assign vendor to property - DISABLED for FP Manager
router.post('/properties/:id/assign-vendor', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  // FP Managers cannot assign vendors
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Assign vendor not allowed for this role' });
  }
  try {
    const { vendorId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE properties SET assigned_vendor_id = ?, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      [vendorId, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Vendor assigned to property' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign employee to property - DISABLED for FP Manager
router.post('/properties/:id/assign-employee', requireManagerScope, validateOwnership('properties'), async (req, res) => {
  // FP Managers cannot assign employees
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Assign employee not allowed for this role' });
  }
  try {
    const { employeeId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE properties SET assigned_employee_id = ?, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      [employeeId, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Employee assigned to property' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// WORK ORDERS
// ============================================

// Get all manager work orders - Manager sees their own + linked FP work orders
router.get('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { status } = req.query;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    
    console.log('[Manager Work Orders] managerId:', managerId, 'franchisePartnerId:', franchisePartnerId);
    
    // FP employees see FP work orders, standalone managers see their created work orders
    let query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
                        v.company_name as vendor_name, cl.name as client_name,
                        COALESCE(
                          CONCAT(fpe.first_name, ' ', COALESCE(fpe.last_name, '')),
                          wo.created_by, 'System'
                        ) as created_by_name
                 FROM work_orders wo
                 LEFT JOIN properties p ON wo.property_id = p.id
                 LEFT JOIN categories c ON wo.category_id = c.id
                 LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
                 LEFT JOIN clients cl ON wo.client_id = cl.id
                 LEFT JOIN fp_employees fpe ON wo.created_by = fpe.email OR wo.created_by = fpe.username
                 WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'}`;
    
    const params = franchisePartnerId ? [franchisePartnerId] : [req.user?.username || req.user?.email];
    
    if (status) {
      query += ' AND wo.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY wo.created_at DESC';
    
    console.log('[Manager Work Orders] Query:', query);
    console.log('[Manager Work Orders] Params:', params);
    
    const [workOrders] = await pool.execute(query, params);
    console.log('[Manager Work Orders] Results count:', workOrders.length);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pending work orders - Manager sees their own + linked FP work orders
router.get('/work-orders/pending', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    
    const query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status NOT IN ('completed', 'closed', 'cancelled')
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId] : [req.user?.username || req.user?.email];
    
    const [workOrders] = await pool.execute(query, params);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get completed work orders - Manager sees their own + linked FP work orders
router.get('/work-orders/completed', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    
    const query = `SELECT wo.*, p.name as property_name, c.name as category_name, 
              v.company_name as vendor_name, cl.name as client_name
       FROM work_orders wo
       LEFT JOIN properties p ON wo.property_id = p.id
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN vendors v ON wo.assigned_vendor_id = v.id
       LEFT JOIN clients cl ON wo.client_id = cl.id
       WHERE ${franchisePartnerId ? 'wo.franchise_partner_id = ?' : 'wo.created_by = ?'} AND wo.status IN ('completed', 'closed')
       ORDER BY wo.created_at DESC`;
    const params = franchisePartnerId ? [franchisePartnerId] : [req.user?.username || req.user?.email];
    
    const [workOrders] = await pool.execute(query, params);
    res.json({ success: true, data: workOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create work order
router.post('/work-orders', requireManagerScope, async (req, res) => {
  try {
    const { propertyId, categoryId, clientId, title, description, priority, permissionToEnter, hasPet, scheduledDate } = req.body;
    
    const workOrderId = `WO-MGR-${Date.now()}`;
    
    // For FP-created managers: store BOTH franchise_partner_id AND manager_id
    // So work order shows in both FP dashboard and Manager dashboard
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
    const [result] = await pool.execute(
      `INSERT INTO work_orders (work_order_id, property_id, category_id, client_id, title, description, 
        priority, permission_to_enter, has_pet, scheduled_date, status, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, NOW())`,
      [workOrderId, propertyId, categoryId || null, clientId || null, title, description,
       priority || 'medium', permissionToEnter || 'no', hasPet || 'no', scheduledDate || null,
       managerId, franchisePartnerId, req.user.id]
    );

    res.json({ success: true, message: 'Work order created', data: { id: result.insertId, workOrderId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update work order status - Manager can only update their own work orders
router.patch('/work-orders/:id/status', requireManagerScope, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const managerId = req.managerId;
    
    // Build update query - include notes if cancelling
    let updateQuery = `UPDATE work_orders SET status = ?, updated_at = NOW()`;
    const params = [status];
    
    if (status === 'cancelled' && notes) {
      updateQuery += `, cancellation_notes = ?`;
      params.push(notes);
    }
    
    updateQuery += ` WHERE id = ? AND manager_id = ?`;
    params.push(req.params.id, managerId);
    
    await pool.execute(updateQuery, params);

    res.json({ success: true, message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign vendor to work order
router.patch('/work-orders/:id/assign-vendor', requireManagerScope, validateOwnership('work_orders'), async (req, res) => {
  try {
    const { vendorId } = req.body;
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE work_orders SET assigned_vendor_id = ?, status = 'assigned', updated_at = NOW() 
       WHERE id = ? AND ${scopeColumn} = ?`,
      [vendorId, req.params.id, scopeId]
    );

    res.json({ success: true, message: 'Vendor assigned' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

// Get all manager customers - Manager sees their own + linked FP customers
router.get('/customers', requireManagerScope, async (req, res) => {
  try {
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    
    const query = `SELECT c.*, p.name as property_name 
       FROM clients c 
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE (c.manager_id = ?${franchisePartnerId ? ' OR c.franchise_partner_id = ?' : ''})
       ORDER BY c.created_at DESC`;
    const params = franchisePartnerId ? [managerId, franchisePartnerId] : [managerId];
    
    const [customers] = await pool.execute(query, params);
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create customer with property - full form support
router.post('/customers', requireManagerScope, async (req, res) => {
  try {
    const {
      // Property form data
      zone, areaName, division, propertyType, communityName,
      associationContacts, numberOfBlocks, unitsPerBlock, blockNames,
      numberOfUnits, villaPlotNumber, blockInfo, blockNA,
      address, city, state, postalCode, landmark, mapLocation, notes,
      entryType, category,
      // Simple customer data (for backward compatibility)
      name, email, phone, alternatePhone, zipCode,
      clientType, companyName, propertyId, gstNumber
    } = req.body;

    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;

    // Check if this is a property form submission (has zone/communityName)
    if (zone && communityName) {
      // Generate IDs
      const propertyIdGen = `MGR-${entryType || 'GC'}-${Date.now()}`;
      const clientId = `MGR-CLT-${Date.now()}`;
      
      // Get contact info
      const contact = associationContacts?.[0] || {};
      const contactName = contact.name || '';
      const contactEmail = contact.email || '';
      const contactPhone = contact.phone || '';
      const contactCountryCode = contact.countryCode || '+91';

      // Create property first
      const [propertyResult] = await pool.execute(
        `INSERT INTO properties (
          property_id, name, property_type, address, city, state, zip_code,
          contact_person, contact_phone, contact_email, zone_id, division_id,
          manager_id, franchise_partner_id, created_by, latitude, longitude, landmark, notes,
          entry_type, category, area_name, number_of_blocks, units_per_block,
          block_names, number_of_units, villa_plot_number, block_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propertyIdGen, communityName, propertyType || 'residential', address, city, state, postalCode || '',
          contactName, `${contactCountryCode}${contactPhone}`, contactEmail, 
          zone || null, division || null,
          managerId, franchisePartnerId, req.user.id, 
          mapLocation?.lat || null, mapLocation?.lng || null, landmark || '', notes || '',
          entryType || null, category || null, areaName || '',
          numberOfBlocks || 1, JSON.stringify(unitsPerBlock || {}),
          JSON.stringify(blockNames || {}), numberOfUnits || null, villaPlotNumber || '', blockInfo || ''
        ]
      );

      // Create customer account if email provided
      let customerResult = null;
      if (contactEmail) {
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        const [existing] = await pool.execute(
          'SELECT id FROM customer_accounts WHERE email = ?', [contactEmail]
        );
        
        if (existing.length === 0) {
          [customerResult] = await pool.execute(
            `INSERT INTO customer_accounts (
              customer_id, name, email, phone, password_hash, property_id,
              manager_id, franchise_partner_id, is_activated, temp_password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              clientId, contactName, contactEmail, `${contactCountryCode}${contactPhone}`,
              hashedPassword, propertyResult.insertId, managerId, franchisePartnerId, 0, tempPassword
            ]
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Property and customer created successfully',
        data: { 
          propertyId: propertyIdGen,
          clientId,
          customerId: customerResult?.insertId || null
        }
      });
    } else {
      // Simple customer creation (backward compatibility)
      const clientId = `CLT-MGR-${Date.now()}`;
      
      const [result] = await pool.execute(
        `INSERT INTO clients (client_id, name, email, phone, alternate_phone, address, city, state, 
          zip_code, client_type, company_name, property_id, gst_number, manager_id, franchise_partner_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [clientId, name, email, phone, alternatePhone, address, city, state, zipCode,
         clientType || 'individual', companyName, propertyId || null, gstNumber, managerId, franchisePartnerId]
      );

      res.json({ success: true, message: 'Customer created', data: { id: result.insertId, clientId } });
    }
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get all manager vendors (ZONE-CENTRIC - employees see data from their assigned zones)
router.get('/vendors', requireManagerScope, async (req, res) => {
  try {
    const employeeId = req.user?.id || req.managerId;
    
    // Get employee's assigned zones
    let assignedZones = [];
    try {
      const [zones] = await pool.execute(
        `SELECT zone_name FROM fp_employee_zones WHERE fp_employee_id = ?`,
        [employeeId]
      );
      assignedZones = zones.map(z => z.zone_name);
    } catch (e) {
      console.log('Zone fetch error:', e.message);
    }

    // Fetch vendors filtered by assigned zones
    let query = `SELECT ov.id, ov.vendor_id, ov.service_type, ov.service_verified,
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
       WHERE ov.franchise_partner_id = ?`;
    
    let params = [req.franchisePartnerId];
    
    // Filter by assigned zones - if zones assigned, filter by them; if none assigned (all access), show all
    if (assignedZones.length > 0) {
      query += ` AND ov.zone IN (${assignedZones.map(() => '?').join(',')})`;
      params.push(...assignedZones);
    }
    // If no zones assigned, employee has access to all zones (all FP data)
    
    query += ` ORDER BY ov.created_at DESC`;
    
    const [vendors] = await pool.execute(query, params);

    res.json({
      success: true,
      data: {
        own: vendors,
        assigned: [],
        all: vendors
      }
    });
  } catch (error) {
    console.error('Manager vendors fetch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get vendor assignments for Manager portal (view-only)
router.get('/vendors/assignments', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    console.log('Manager Vendor Assignments Query:', { scopeId, scopeColumn });
    
    // Get property-vendor assignments for this FP's properties with full vendor details
    const [propertyAssignments] = await pool.execute(
      `SELECT pva.id, pva.property_id, pva.vendor_id, pva.assigned_at, pva.is_active,
        p.name as property_name, p.property_id as propertyId, p.property_type, p.address, p.city,
        v.owner_name as vendor_name, v.vendor_id as vendor_code, v.service_type,
        v.owner_mobile as vendor_phone, v.owner_email as vendor_email,
        v.zone_name, v.area, v.rate_per_visit, v.coverage_per_day,
        v.owner_aadhar, v.manager_name, v.manager_mobile, v.manager_email,
        v.poc_name, v.poc_mobile, v.poc_email
       FROM property_vendor_assignments pva
       JOIN properties p ON pva.property_id = p.id
       JOIN vendors v ON pva.vendor_id = v.id
       WHERE p.${scopeColumn} = ? AND pva.is_active = TRUE
       ORDER BY pva.assigned_at DESC`,
      [scopeId]
    );

    console.log('Vendor assignments found:', propertyAssignments.length);

    // Convert to service assignments format for frontend
    const serviceAssignments = propertyAssignments.map(a => ({
      id: a.id,
      propertyId: a.propertyId || a.property_id,
      propertyName: a.property_name,
      propertyType: a.property_type,
      propertyZone: a.zone_name || '',
      city: a.city || '',
      address: a.address || '',
      vendorId: a.vendor_code,
      vendorName: a.vendor_name,
      vendorPhone: a.vendor_phone,
      vendorEmail: a.vendor_email,
      owner_aadhar: a.owner_aadhar,
      serviceType: a.service_type,
      zone_name: a.zone_name,
      area: a.area,
      rate_per_visit: a.rate_per_visit,
      coverage_per_day: a.coverage_per_day,
      manager_name: a.manager_name,
      manager_mobile: a.manager_mobile,
      manager_email: a.manager_email,
      poc_name: a.poc_name,
      poc_mobile: a.poc_mobile,
      poc_email: a.poc_email,
      assignedDate: a.assigned_at,
      status: a.is_active ? 'active' : 'removed'
    }));

    res.json({
      success: true,
      data: {
        propertyAssignments: [],
        serviceAssignments
      }
    });
  } catch (error) {
    console.error('Manager vendor assignments fetch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create vendor - dual-tag with manager_id AND franchise_partner_id
router.post('/vendors', requireManagerScope, async (req, res) => {
  try {
    const { 
      serviceType, serviceVerified, zone, areaName,
      ownerName, ownerMobile, ownerEmail, ownerAadhar, ownerCountryCode,
      managerName, managerMobile, managerEmail, managerCountryCode,
      pocName, pocMobile, pocEmail, pocCountryCode,
      ratePerVisit, coveragePerDay, createdBy
    } = req.body;
    
    const vendorId = `MGR-${serviceType?.substring(0, 3).toUpperCase() || 'VND'}-${Date.now()}`;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
    // Get employee ID for proper creator tracking
    const employeeId = req.user?.id || managerId;
    const employeeUsername = req.user?.username || '';
    
    const [result] = await pool.execute(
      `INSERT INTO onboarded_vendors (
        vendor_id, service_type, service_verified, zone, area_name,
        owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
        manager_name, manager_mobile, manager_email, manager_country_code,
        poc_name, poc_mobile, poc_email, poc_country_code,
        rate_per_visit, coverage_per_day, franchise_partner_id, manager_id, created_by, created_by_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        vendorId, serviceType || '', serviceVerified ? 1 : 0, zone || '', areaName || '',
        ownerName || '', ownerMobile || '', ownerEmail || '', ownerAadhar || '', ownerCountryCode || '+91',
        managerName || '', managerMobile || '', managerEmail || '', managerCountryCode || '+91',
        pocName || '', pocMobile || '', pocEmail || '', pocCountryCode || '+91',
        parseFloat(ratePerVisit) || 0, parseInt(coveragePerDay) || 0,
        franchisePartnerId, managerId,
        employeeUsername, employeeId
      ]
    );

    res.json({ success: true, message: 'Vendor created', data: { id: result.insertId, vendorId } });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update vendor - DISABLED for Manager role
router.put('/vendors/:id', requireManagerScope, validateOwnership('vendors'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Modify vendor not allowed for this role' });
});

// Delete vendor - DISABLED for Manager role
router.delete('/vendors/:id', requireManagerScope, validateOwnership('vendors'), async (req, res) => {
  return res.status(403).json({ success: false, message: 'Delete operation not allowed for this role' });
});

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

// Get all manager employees - DISABLED for Manager role
router.get('/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// Create employee - DISABLED for Manager role
router.post('/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// Update employee - DISABLED for Manager role
router.put('/employees/:id', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// Delete employee - DISABLED for Manager role
router.delete('/employees/:id', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Employee management not allowed for this role' });
});

// View FP employee zone assignments (READ-ONLY for managers under FP)
router.get('/fp-employee-zones', requireManagerScope, async (req, res) => {
  try {
    // Only available for managers under FP
    if (!req.isFPManager || !req.franchisePartnerId) {
      return res.status(403).json({ success: false, message: 'This feature is only available for FP managers' });
    }

    const [employees] = await pool.execute(
      `SELECT e.id, e.first_name, e.last_name, CONCAT(e.first_name, ' ', e.last_name) as name,
              e.email, e.phone, e.role, e.is_active,
              GROUP_CONCAT(DISTINCT ez.zone_name ORDER BY ez.zone_name) as zone_names
       FROM fp_employees e
       LEFT JOIN fp_employee_zones ez ON e.id = ez.fp_employee_id AND ez.franchise_partner_id = ?
       WHERE e.franchise_partner_id = ? AND e.is_active = 1
       GROUP BY e.id
       ORDER BY e.first_name, e.last_name`,
      [req.franchisePartnerId, req.franchisePartnerId]
    );

    // Get all zones for reference (from multiple sources)
    const [zones] = await pool.execute(
      `SELECT DISTINCT ez.zone_name as name FROM fp_employee_zones ez 
       WHERE ez.franchise_partner_id = ? ORDER BY ez.zone_name`,
      [req.franchisePartnerId]
    );

    res.json({ 
      success: true, 
      data: {
        employees: employees.map(emp => ({
          ...emp,
          zone_ids: emp.zone_ids ? emp.zone_ids.split(',').map(Number) : [],
          zone_names: emp.zone_names || 'No zones assigned'
        })),
        zones
      }
    });
  } catch (error) {
    console.error('Get FP employee zones error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ESTIMATES MANAGEMENT
// ============================================

// Get all manager estimates - Manager sees FP estimates from fp_estimates table
router.get('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { archived } = req.query;
    const isArchived = archived === 'true';
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId;
    
    let estimates = [];
    
    // If manager is linked to an FP, fetch from fp_estimates table
    if (franchisePartnerId) {
      const [fpEstimates] = await pool.execute(
        `SELECT * FROM fp_estimates 
         WHERE franchise_partner_id = ? AND (is_archived = ? OR is_archived IS NULL OR is_archived = 0)
         ORDER BY created_at DESC`,
        [franchisePartnerId, isArchived ? 1 : 0]
      );
      
      // Enrich estimates with property_code and parse addons
      estimates = await Promise.all(fpEstimates.map(async (est) => {
        // Parse addons JSON
        let addons = [];
        if (est.addons_data) {
          try { addons = JSON.parse(est.addons_data); } catch(e) {}
        }
        
        // Get original property_code from onboarded_properties or properties table
        let property_code = est.property_code;
        const propId = est.property_id;
        const propName = est.property_name || '';
        
        // Always try to fetch the original property_id from the property tables
        if (propId || propName) {
          try {
            // Try onboarded_properties first (admin-created properties visible to FP)
            let [props] = await pool.execute(
              `SELECT property_id as orig_code FROM onboarded_properties 
               WHERE (id = ? OR community_name = ?) LIMIT 1`,
              [propId || 0, propName]
            );
            if (props.length > 0 && props[0].orig_code) {
              property_code = props[0].orig_code;
            } else {
              // Try properties table (FP-created properties)
              [props] = await pool.execute(
                `SELECT property_id as orig_code FROM properties 
                 WHERE (id = ? OR name = ?) AND franchise_partner_id = ? LIMIT 1`,
                [propId || 0, propName, franchisePartnerId]
              );
              if (props.length > 0 && props[0].orig_code) property_code = props[0].orig_code;
            }
          } catch (e) { console.log('Property lookup error:', e.message); }
        }
        
        return { ...est, addons, property_code, created_by_name: est.created_by_name || 'Franchise Partner' };
      }));
      
      console.log(`Manager ${managerId} (FP: ${franchisePartnerId}) - Found ${estimates.length} FP estimates`);
    }
    
    res.json({ success: true, data: estimates });
  } catch (error) {
    console.error('Error fetching manager estimates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create estimate - dual-tag with manager_id AND franchise_partner_id
router.post('/estimates', requireManagerScope, async (req, res) => {
  try {
    const { clientId, propertyId, title, description, estimateType, items, subtotal, taxPercentage, discountPercentage, validUntil } = req.body;
    
    const estimateId = `EST-MGR-${Date.now()}`;
    const tax = (subtotal * (taxPercentage || 0)) / 100;
    const discount = (subtotal * (discountPercentage || 0)) / 100;
    const total = subtotal + tax - discount;
    const managerId = req.managerId;
    const franchisePartnerId = req.franchisePartnerId || null;
    
    const [result] = await pool.execute(
      `INSERT INTO estimates (estimate_id, client_id, property_id, title, description, estimate_type,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount, total_amount,
        valid_until, status, manager_id, franchise_partner_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NOW())`,
      [estimateId, clientId || null, propertyId || null, title, description, estimateType || 'property_based',
       subtotal, taxPercentage || 0, tax, discountPercentage || 0, discount, total,
       validUntil || null, managerId, franchisePartnerId, req.user.id]
    );

    // Insert line items
    if (items && items.length > 0) {
      for (const item of items) {
        await pool.execute(
          `INSERT INTO estimate_items (estimate_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [result.insertId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice]
        );
      }
    }

    res.json({ success: true, message: 'Estimate created', data: { id: result.insertId, estimateId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Archive estimate
router.patch('/estimates/:id/archive', requireManagerScope, validateOwnership('estimates'), async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    const scopeColumn = getScopeColumn(req);
    
    await pool.execute(
      `UPDATE estimates SET is_archived = 1, updated_at = NOW() WHERE id = ? AND ${scopeColumn} = ?`,
      [req.params.id, scopeId]
    );
    res.json({ success: true, message: 'Estimate archived' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AMC PACKAGES - FP Managers use FP packages (read-only), standalone use manager packages
// ============================================

// Get AMC packages - FP Managers see FP packages, standalone see their own
router.get('/amc-packages', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers read from fp_amc_packages, standalone from manager_amc_packages
    const table = req.isFPManager ? 'fp_amc_packages' : 'manager_amc_packages';
    const scopeColumn = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    
    const [packages] = await pool.execute(
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? ORDER BY created_at DESC`,
      [scopeId]
    );
    
    res.json({ success: true, data: packages });
  } catch (error) {
    console.error('AMC packages fetch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create AMC package - DISABLED for FP Managers
router.post('/amc-packages', requireManagerScope, async (req, res) => {
  // FP Managers cannot create packages
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Create package not allowed for this role' });
  }
  try {
    const { name, description, durationMonths, basePrice, services, termsConditions, hidePricing } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO manager_amc_packages (manager_id, name, description, duration_months, base_price, 
        services, terms_conditions, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.managerId, name, description, durationMonths || 12, basePrice || 0,
       JSON.stringify(services || []), termsConditions, hidePricing || false]
    );

    res.json({ success: true, message: 'AMC package created', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADD-ONS - FP Managers use FP addons (read-only), standalone use manager addons
// ============================================

// Get add-ons - FP Managers see FP add-ons, standalone see their own
router.get('/addons', requireManagerScope, async (req, res) => {
  try {
    const scopeId = getScopeId(req);
    
    // FP Managers read from fp_addons, standalone from manager_addons
    const table = req.isFPManager ? 'fp_addons' : 'manager_addons';
    const scopeColumn = req.isFPManager ? 'franchise_partner_id' : 'manager_id';
    
    const [addons] = await pool.execute(
      `SELECT * FROM ${table} WHERE ${scopeColumn} = ? ORDER BY created_at DESC`,
      [scopeId]
    );
    
    res.json({ success: true, data: addons });
  } catch (error) {
    console.error('Addons fetch error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create add-on - DISABLED for FP Managers
router.post('/addons', requireManagerScope, async (req, res) => {
  // FP Managers cannot create add-ons
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Create add-on not allowed for this role' });
  }
  try {
    const { name, description, price, unit, categoryId, hidePricing } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO manager_addons (manager_id, category_id, name, description, price, unit, hide_pricing)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.managerId, categoryId || null, name, description, price || 0, unit || 'per_service', hidePricing || false]
    );

    res.json({ success: true, message: 'Add-on created', data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ZONES & CATEGORIES - FP Managers use FP zones, standalone use global zones
// ============================================

router.get('/zones', requireManagerScope, async (req, res) => {
  try {
    // Get global zones
    const [globalZones] = await pool.execute('SELECT id, name FROM zones WHERE is_active = 1');
    
    // Get zones from properties (FP-scoped or manager-scoped)
    const scopeColumn = req.franchisePartnerId ? 'franchise_partner_id' : 'manager_id';
    const scopeId = req.franchisePartnerId || req.managerId;
    const [propertyZones] = await pool.execute(
      `SELECT DISTINCT zone_id as name FROM properties 
       WHERE ${scopeColumn} = ? AND zone_id IS NOT NULL AND zone_id != ''`,
      [scopeId]
    );

    // Get FP zones (from FP or manager-created)
    let fpZones = [];
    try {
      const [fz] = await pool.execute(
        `SELECT id, name FROM fp_zones WHERE 
         (franchise_partner_id = ? OR manager_id = ?) AND is_active = 1`,
        [req.franchisePartnerId || 0, req.managerId]
      );
      fpZones = fz;
    } catch (_) {}

    // Combine and deduplicate
    const allZoneNames = new Set();
    const combinedZones = [];

    globalZones.forEach(z => {
      if (!allZoneNames.has(z.name)) {
        allZoneNames.add(z.name);
        combinedZones.push({ id: z.id, name: z.name });
      }
    });

    fpZones.forEach(z => {
      if (!allZoneNames.has(z.name)) {
        allZoneNames.add(z.name);
        combinedZones.push({ id: z.id, name: z.name });
      }
    });

    propertyZones.forEach(z => {
      if (z.name && !allZoneNames.has(z.name)) {
        allZoneNames.add(z.name);
        combinedZones.push({ id: `custom-${z.name}`, name: z.name });
      }
    });

    combinedZones.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, data: combinedZones });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create zone - saves to fp_zones table
router.post('/zones', requireManagerScope, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Zone name is required' });
    }
    
    const franchisePartnerId = req.franchisePartnerId || null;
    const managerId = req.managerId;
    
    // Check if zone already exists
    const [existing] = await pool.execute(
      'SELECT id FROM fp_zones WHERE name = ? AND (franchise_partner_id = ? OR manager_id = ?)',
      [name, franchisePartnerId, managerId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Zone already exists' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fp_zones (name, franchise_partner_id, manager_id, created_by, is_active) VALUES (?, ?, ?, ?, 1)',
      [name, franchisePartnerId, managerId, req.user?.email || req.user?.id]
    );
    
    res.json({ success: true, message: 'Zone created', data: { id: result.insertId, name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete/disable zone
router.delete('/zones/:id', requireManagerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const franchisePartnerId = req.franchisePartnerId || null;
    const managerId = req.managerId;
    
    // Only allow deleting zones created by this manager or their FP
    await pool.execute(
      'UPDATE fp_zones SET is_active = 0 WHERE id = ? AND (franchise_partner_id = ? OR manager_id = ?)',
      [id, franchisePartnerId, managerId]
    );
    
    res.json({ success: true, message: 'Zone deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', requireManagerScope, async (req, res) => {
  try {
    const categoriesConfig = require('../config/categories');
    return res.json({ success: true, data: categoriesConfig });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get subcategories by category ID
router.get('/categories/:categoryId/subcategories', requireManagerScope, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const [subcategories] = await pool.execute(
      'SELECT * FROM subcategories WHERE category_id = ? AND (is_active = TRUE OR is_active = 1) ORDER BY sort_order, name',
      [categoryId]
    );
    res.json({ success: true, data: subcategories });
  } catch (error) {
    console.error('Subcategories fetch error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// EXPORT ENDPOINTS - All DISABLED for FP Manager role
// ============================================

// Export properties - DISABLED for Manager role
router.get('/export/properties', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

// Export vendors - DISABLED for Manager role
router.get('/export/vendors', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

// Export employees - DISABLED for Manager role
router.get('/export/employees', requireManagerScope, async (req, res) => {
  return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
});

router.get('/export/work-orders', requireManagerScope, async (req, res) => {
  // Disabled for FP Managers
  if (req.isFPManager) {
    return res.status(403).json({ success: false, message: 'Export not allowed for this role' });
  }
  try {
    const [data] = await pool.execute(
      'SELECT * FROM work_orders WHERE manager_id = ?',
      [req.managerId]
    );
    res.json({ success: true, data, exportedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
