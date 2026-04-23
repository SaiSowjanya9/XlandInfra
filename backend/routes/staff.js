/**
 * Staff Management Routes
 * Handles CRUD operations for Admin, Manager, Supervisor, and Executive users
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { adminOnly, managerOrAdmin, requireRole, ROLES } = require('../middleware/rbac');
const { ROLE_NAMES } = require('../config/roles');

// ============================================
// STAFF LOGIN
// ============================================

// Demo users for when database is unavailable
const DEMO_USERS = [
  { id: 1, username: 'admin', email: 'admin@pmportal.com', firstName: 'System', lastName: 'Admin', role: 'admin', password: 'admin123' },
  { id: 2, username: 'manager1', email: 'manager@pmportal.com', firstName: 'John', lastName: 'Manager', role: 'manager', password: 'manager123' },
  { id: 3, username: 'supervisor1', email: 'supervisor@pmportal.com', firstName: 'Jane', lastName: 'Supervisor', role: 'supervisor', password: 'supervisor123' },
  { id: 4, username: 'executive1', email: 'executive@pmportal.com', firstName: 'Bob', lastName: 'Executive', role: 'executive', password: 'executive123' }
];

// Staff Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    let user = null;

    // Try database first
    try {
      const [users] = await pool.execute(
        `SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
        [username, username]
      );
      if (users.length > 0) {
        user = users[0];
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          // For demo, also accept simple passwords
          const demoUser = DEMO_USERS.find(u => u.username === username || u.email === username);
          if (!demoUser || demoUser.password !== password) {
            return res.status(401).json({
              success: false,
              message: 'Invalid credentials'
            });
          }
        }

        // Update last login
        await pool.execute(
          `UPDATE users SET last_login = NOW() WHERE id = ?`,
          [user.id]
        );
      }
    } catch (dbError) {
      console.log('Database not available, using demo mode');
    }

    // Fallback to demo users
    if (!user) {
      const demoUser = DEMO_USERS.find(u => 
        (u.username === username || u.email === username) && u.password === password
      );
      
      if (!demoUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const token = generateToken(demoUser);
      
      return res.json({
        success: true,
        message: 'Login successful (Demo Mode)',
        data: {
          token,
          user: {
            id: demoUser.id,
            username: demoUser.username,
            email: demoUser.email,
            firstName: demoUser.firstName,
            lastName: demoUser.lastName,
            role: demoUser.role,
            roleName: ROLE_NAMES[demoUser.role]
          }
        }
      });
    }

    // Generate token for database user
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    });

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
          roleName: ROLE_NAMES[user.role]
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// ============================================
// GET CURRENT USER
// ============================================
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        roleName: ROLE_NAMES[req.user.role]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
});

// ============================================
// STAFF CRUD (Admin Only)
// ============================================

// Get all staff members
router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { role, isActive } = req.query;
    
    let query = `
      SELECT u.*, 
             CONCAT(c.first_name, ' ', c.last_name) as created_by_name
      FROM users u
      LEFT JOIN users c ON u.created_by = c.id
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    if (isActive !== undefined) {
      query += ` AND u.is_active = ?`;
      params.push(isActive === 'true');
    }

    query += ` ORDER BY u.created_at DESC`;

    const [staff] = await pool.execute(query, params);

    res.json({
      success: true,
      data: staff.map(s => ({
        id: s.id,
        username: s.username,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        phone: s.phone,
        role: s.role,
        roleName: ROLE_NAMES[s.role],
        permissions: {
          canView: s.can_view,
          canCreate: s.can_create,
          canEdit: s.can_edit,
          canDelete: s.can_delete,
          canApprove: s.can_approve,
          canAssign: s.can_assign,
          canClose: s.can_close
        },
        isActive: s.is_active,
        lastLogin: s.last_login,
        createdBy: s.created_by_name,
        createdAt: s.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff members',
      error: error.message
    });
  }
});

// Get single staff member
router.get('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const [staff] = await pool.execute(
      `SELECT u.*, 
              CONCAT(c.first_name, ' ', c.last_name) as created_by_name
       FROM users u
       LEFT JOIN users c ON u.created_by = c.id
       WHERE u.id = ?`,
      [id]
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
        username: s.username,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        phone: s.phone,
        role: s.role,
        roleName: ROLE_NAMES[s.role],
        permissions: {
          canView: s.can_view,
          canCreate: s.can_create,
          canEdit: s.can_edit,
          canDelete: s.can_delete,
          canApprove: s.can_approve,
          canAssign: s.can_assign,
          canClose: s.can_close
        },
        isActive: s.is_active,
        lastLogin: s.last_login,
        createdBy: s.created_by_name,
        createdAt: s.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff member',
      error: error.message
    });
  }
});

// Create new staff member
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { 
      username, email, password, firstName, lastName, phone, role,
      canView, canCreate, canEdit, canDelete, canApprove, canAssign, canClose 
    } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, password, first name, last name, and role are required'
      });
    }

    // Validate role
    if (!Object.values(ROLES).includes(role) || role === ROLES.VENDOR) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, manager, supervisor, or executive'
      });
    }

    // Check if username or email already exists
    const [existing] = await pool.execute(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await pool.execute(
      `INSERT INTO users (
        username, email, password_hash, first_name, last_name, phone, role,
        can_view, can_create, can_edit, can_delete, can_approve, can_assign, can_close,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username, email, passwordHash, firstName, lastName, phone || null, role,
        canView ?? null, canCreate ?? null, canEdit ?? null, canDelete ?? null,
        canApprove ?? null, canAssign ?? null, canClose ?? null,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: {
        id: result.insertId,
        username,
        email,
        role,
        roleName: ROLE_NAMES[role]
      }
    });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating staff member',
      error: error.message
    });
  }
});

// Update staff member
router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      username, email, password, firstName, lastName, phone, role, isActive,
      canView, canCreate, canEdit, canDelete, canApprove, canAssign, canClose 
    } = req.body;

    // Check if user exists
    const [existing] = await pool.execute(
      `SELECT id FROM users WHERE id = ?`,
      [id]
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
        [username, email, id]
      );

      if (duplicates.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already exists'
        });
      }
    }

    // Build update query
    let updateFields = [];
    let params = [];

    if (username) { updateFields.push('username = ?'); params.push(username); }
    if (email) { updateFields.push('email = ?'); params.push(email); }
    if (firstName) { updateFields.push('first_name = ?'); params.push(firstName); }
    if (lastName) { updateFields.push('last_name = ?'); params.push(lastName); }
    if (phone !== undefined) { updateFields.push('phone = ?'); params.push(phone); }
    if (role) { updateFields.push('role = ?'); params.push(role); }
    if (isActive !== undefined) { updateFields.push('is_active = ?'); params.push(isActive); }
    if (canView !== undefined) { updateFields.push('can_view = ?'); params.push(canView); }
    if (canCreate !== undefined) { updateFields.push('can_create = ?'); params.push(canCreate); }
    if (canEdit !== undefined) { updateFields.push('can_edit = ?'); params.push(canEdit); }
    if (canDelete !== undefined) { updateFields.push('can_delete = ?'); params.push(canDelete); }
    if (canApprove !== undefined) { updateFields.push('can_approve = ?'); params.push(canApprove); }
    if (canAssign !== undefined) { updateFields.push('can_assign = ?'); params.push(canAssign); }
    if (canClose !== undefined) { updateFields.push('can_close = ?'); params.push(canClose); }

    // Update password if provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(id);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: 'Staff member updated successfully'
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating staff member',
      error: error.message
    });
  }
});

// Delete staff member (soft delete)
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    const [result] = await pool.execute(
      `UPDATE users SET is_active = FALSE WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting staff member',
      error: error.message
    });
  }
});

// ============================================
// ROLE INFO
// ============================================

// Get all roles
router.get('/roles/list', authenticate, async (req, res) => {
  try {
    const roles = Object.entries(ROLE_NAMES)
      .filter(([key]) => key !== ROLES.VENDOR)
      .map(([key, name]) => ({
        value: key,
        label: name
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

module.exports = router;
