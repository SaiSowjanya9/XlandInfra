/**
 * Staff Management Routes
 * Handles CRUD operations for Admin, Manager, Supervisor, and Executive users
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authenticate, generateToken } = require('../middleware/auth');
const { adminOnly, managerOrAdmin, requireRole, ROLES } = require('../middleware/rbac');
const { ROLE_NAMES } = require('../config/roles');
const { sendEmployeeWelcomeEmail, sendPasswordResetEmail, sendPasswordResetSuccess, sendPasswordUpdatedByAdminEmail } = require('../services/emailService');

// Password reset expiry (48 hours)
const PASSWORD_RESET_EXPIRY_HOURS = 48;
const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL || 'https://admin.xlandinfra.com';

// User ID Prefixes by Role (Employees use numeric-only IDs)
const USER_ID_PREFIXES = {
  admin: 'XAD',
  operations_manager: 'XOM',
  franchise_partner: 'XFP',
  franchise: 'XFP'
  // Employee roles (manager, coordinator, supervisor, executive) use numeric-only IDs
};

// Employee roles that use numeric-only IDs (001, 002, 003...)
const EMPLOYEE_ROLES = ['manager', 'coordinator', 'supervisor', 'executive'];

// Generate sequential unique User ID based on role
const generateUserId = async (role) => {
  const isEmployee = EMPLOYEE_ROLES.includes(role);
  
  try {
    if (isEmployee) {
      // For employees: Generate numeric-only ID (001, 002, 003...)
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
    
    // For non-employees: Use prefix-based ID
    const prefix = USER_ID_PREFIXES[role] || 'XUS';
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
    
    // Format with leading zeros (3 digits minimum, expandable)
    const sequenceStr = String(nextSequence).padStart(3, '0');
    return `${prefix}${sequenceStr}`;
  } catch (error) {
    console.error('Error generating user ID:', error);
    // Fallback to timestamp-based if database query fails
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    return `${prefix}${timestamp}`;
  }
};

// Generate secure temporary password
const generateTempPassword = () => {
  const length = 12;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
};

// ============================================
// STAFF LOGIN
// ============================================

// Demo mode configuration - credentials loaded from environment variables
const DEMO_MODE_ENABLED = process.env.DEMO_MODE === 'true';
const DEMO_PASSWORD_HASH = process.env.DEMO_PASSWORD_HASH || '';

// Demo users for when database is unavailable (role-based, no passwords stored)
// NOTE: Passwords are NOT stored here - they must be set via environment variables
const DEMO_USERS = DEMO_MODE_ENABLED ? [
  { id: 1, username: 'demo_admin', email: 'demo.admin@pmportal.com', firstName: 'Demo', lastName: 'Admin', role: 'admin' },
  { id: 2, username: 'demo_manager', email: 'demo.manager@pmportal.com', firstName: 'Demo', lastName: 'Manager', role: 'manager' },
  { id: 3, username: 'demo_supervisor', email: 'demo.supervisor@pmportal.com', firstName: 'Demo', lastName: 'Supervisor', role: 'supervisor' },
  { id: 4, username: 'demo_executive', email: 'demo.executive@pmportal.com', firstName: 'Demo', lastName: 'Executive', role: 'executive' }
] : [];

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
    let userType = 'user'; // 'user' or 'franchise_partner'

    // Try database first
    try {
      // First check users table
      const [users] = await pool.execute(
        `SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
        [username, username]
      );
      if (users.length > 0) {
        user = users[0];
        userType = 'user';
        
        // Verify password against stored hash
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
          return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
          });
        }

        // Update last login
        await pool.execute(
          `UPDATE users SET last_login = NOW() WHERE id = ?`,
          [user.id]
        );
      }
      
      // If not found in users, check franchise_partners table
      if (!user) {
        const [fpUsers] = await pool.execute(
          `SELECT * FROM franchise_partners WHERE (username = ? OR email = ?) AND is_active = TRUE`,
          [username, username]
        );
        if (fpUsers.length > 0) {
          user = fpUsers[0];
          userType = 'franchise_partner';
          
          // Verify password against stored hash
          const isValidPassword = await bcrypt.compare(password, user.password_hash);
          if (!isValidPassword) {
            return res.status(401).json({
              success: false,
              message: 'Invalid credentials'
            });
          }

          // Update last login
          await pool.execute(
            `UPDATE franchise_partners SET last_login = NOW() WHERE id = ?`,
            [user.id]
          );
        }
      }
    } catch (dbError) {
      console.log('Database not available, using demo mode:', dbError.message);
    }

    // Fallback to demo users (only if demo mode is enabled)
    if (!user && DEMO_MODE_ENABLED) {
      const demoUser = DEMO_USERS.find(u => 
        u.username === username || u.email === username
      );
      
      if (!demoUser || !DEMO_PASSWORD_HASH) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Verify password against environment-stored hash
      const isDemoPasswordValid = await bcrypt.compare(password, DEMO_PASSWORD_HASH);
      if (!isDemoPasswordValid) {
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
            roleName: ROLE_NAMES[demoUser.role],
            isDemo: true
          }
        }
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user must change password
    const mustChangePassword = user.must_change_password === 1 || user.must_change_password === true;
    
    // Handle FP users differently (login from franchise_partners table)
    if (userType === 'franchise_partner') {
      // Check if user must change password
      const fpMustChangePassword = user.must_change_password === 1 || user.must_change_password === true;
      
      const token = generateToken({
        id: user.id,
        fpId: user.id,
        username: user.username,
        email: user.email,
        role: 'franchise_partner',
        first_name: user.contact_person || user.owner_name || user.company_name,
        last_name: ''
      });

      return res.json({
        success: true,
        message: fpMustChangePassword ? 'Login successful. Password change required.' : 'Login successful',
        data: {
          token,
          mustChangePassword: fpMustChangePassword,
          user: {
            id: user.id,
            fpId: user.id,
            username: user.username,
            email: user.email,
            firstName: user.contact_person || user.owner_name || user.company_name,
            lastName: '',
            role: 'franchise_partner',
            roleName: 'Franchise Partner',
            companyName: user.company_name,
            franchisePartnerId: user.id
          }
        }
      });
    }
    
    // Generate token for regular database user (including FP staff with franchise_partner_id)
    const token = generateToken({
      id: user.id,
      userId: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      franchisePartnerId: user.franchise_partner_id || null  // Include FP ID for FP-created staff
    });

    res.json({
      success: true,
      message: mustChangePassword ? 'Login successful. Password change required.' : 'Login successful',
      data: {
        token,
        mustChangePassword,
        user: {
          id: user.id,
          userId: user.user_id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          roleName: ROLE_NAMES[user.role],
          franchisePartnerId: user.franchise_partner_id || null
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
// POST /api/staff/forgot-password - Request password reset for staff/admin users
// ============================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    let user = null;
    let userType = 'user';
    let tableName = 'users';

    // First check users table (admin, ops manager, manager, supervisor, coordinator, executive)
    const [users] = await pool.execute(
      `SELECT id, user_id, email, first_name, last_name, username, role, is_active
       FROM users 
       WHERE email = ?`,
      [email.toLowerCase()]
    );

    if (users.length > 0) {
      user = users[0];
      userType = 'user';
      tableName = 'users';
    }

    // If not found, check franchise_partners table
    if (!user) {
      const [fpUsers] = await pool.execute(
        `SELECT id, partner_id as user_id, email, contact_person as first_name, '' as last_name, 
                username, 'franchise_partner' as role, is_active
         FROM franchise_partners 
         WHERE email = ?`,
        [email.toLowerCase()]
      );
      
      if (fpUsers.length > 0) {
        user = fpUsers[0];
        userType = 'franchise_partner';
        tableName = 'franchise_partners';
      }
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    // Generate temporary password and reset token
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store reset token, temp password, and update visible_password for admin
    if (userType === 'user') {
      await pool.execute(
        `UPDATE users 
         SET reset_token = ?, 
             reset_token_expires = ?,
             reset_temp_password_hash = ?,
             visible_password = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [resetToken, resetExpires, tempPasswordHash, tempPassword, user.id]
      );
    } else {
      await pool.execute(
        `UPDATE franchise_partners 
         SET reset_token = ?, 
             reset_token_expires = ?,
             reset_temp_password_hash = ?,
             visible_password = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [resetToken, resetExpires, tempPasswordHash, tempPassword, user.id]
      );
    }

    // Generate reset link
    const resetLink = `${ADMIN_PORTAL_URL}/reset-password/${resetToken}`;

    // Send password reset email
    await sendPasswordResetEmail({
      email: user.email,
      firstName: user.first_name,
      tempPassword,
      resetLink,
      userType: 'staff',
      expiryHours: PASSWORD_RESET_EXPIRY_HOURS
    });

    console.log(`📧 Password reset requested for ${user.email} (${user.role})`);

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions.'
    });

  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: error.message
    });
  }
});

// ============================================
// GET /api/staff/verify-reset-token/:token - Verify reset token
// ============================================
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Reset token is required'
      });
    }

    let user = null;
    let userType = 'user';

    // Check users table
    const [users] = await pool.execute(
      `SELECT id, email, first_name, reset_token_expires
       FROM users 
       WHERE reset_token = ? AND is_active = TRUE`,
      [token]
    );

    if (users.length > 0) {
      user = users[0];
      userType = 'user';
    }

    // Check franchise_partners table
    if (!user) {
      const [fpUsers] = await pool.execute(
        `SELECT id, email, contact_person as first_name, reset_token_expires
         FROM franchise_partners 
         WHERE reset_token = ? AND is_active = TRUE`,
        [token]
      );
      
      if (fpUsers.length > 0) {
        user = fpUsers[0];
        userType = 'franchise_partner';
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new password reset.'
      });
    }

    // Check if token has expired
    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This password reset link has expired. Please request a new one.',
        expired: true
      });
    }

    res.json({
      success: true,
      message: 'Reset token is valid',
      data: {
        email: user.email,
        firstName: user.first_name
      }
    });

  } catch (error) {
    console.error('Error verifying reset token:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying reset token',
      error: error.message
    });
  }
});

// ============================================
// POST /api/staff/reset-password - Reset password with temp password
// ============================================
router.post('/reset-password', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { token, tempPassword, newPassword } = req.body;

    // Validate required fields
    if (!token || !tempPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Password validation
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    let user = null;
    let userType = 'user';
    let tableName = 'users';

    // Check users table
    const [users] = await conn.execute(
      `SELECT id, user_id, email, first_name, role, reset_token_expires, reset_temp_password_hash
       FROM users 
       WHERE reset_token = ? AND is_active = TRUE`,
      [token]
    );

    if (users.length > 0) {
      user = users[0];
      userType = 'user';
      tableName = 'users';
    }

    // Check franchise_partners table
    if (!user) {
      const [fpUsers] = await conn.execute(
        `SELECT id, partner_id as user_id, email, contact_person as first_name, 'franchise_partner' as role,
                reset_token_expires, reset_temp_password_hash
         FROM franchise_partners 
         WHERE reset_token = ? AND is_active = TRUE`,
        [token]
      );
      
      if (fpUsers.length > 0) {
        user = fpUsers[0];
        userType = 'franchise_partner';
        tableName = 'franchise_partners';
      }
    }

    if (!user) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Invalid reset link'
      });
    }

    // Check if token has expired
    if (new Date(user.reset_token_expires) < new Date()) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Password reset link has expired. Please request a new one.'
      });
    }

    // Verify temporary password
    const isTempPasswordValid = await bcrypt.compare(tempPassword, user.reset_temp_password_hash);
    if (!isTempPasswordValid) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid temporary password'
      });
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await conn.execute(
      `UPDATE ${tableName} 
       SET password_hash = ?,
           reset_token = NULL,
           reset_token_expires = NULL,
           reset_temp_password_hash = NULL,
           must_change_password = FALSE,
           visible_password = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, newPassword, user.id]
    );

    await conn.commit();

    // Send confirmation email
    await sendPasswordResetSuccess({
      email: user.email,
      firstName: user.first_name,
      userType: 'staff'
    });

    console.log(`✅ Password reset completed for ${user.email} (${user.role})`);

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  } finally {
    conn.release();
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
        userId: req.user.userId,
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
// SET NEW PASSWORD (First Login / Password Reset)
// ============================================
router.post('/set-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username, current password, and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    let user = null;
    let userType = 'user';

    // First try to find in users table
    const [users] = await pool.execute(
      `SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
      [username, username]
    );

    if (users.length > 0) {
      user = users[0];
      userType = 'user';
    }

    // If not found, check franchise_partners table
    if (!user) {
      const [fpUsers] = await pool.execute(
        `SELECT * FROM franchise_partners WHERE (username = ? OR email = ?) AND is_active = TRUE`,
        [username, username]
      );
      if (fpUsers.length > 0) {
        user = fpUsers[0];
        userType = 'franchise_partner';
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify current/temporary password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password and update
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    if (userType === 'user') {
      // Store new password in visible_password for admin visibility
      await pool.execute(
        `UPDATE users SET password_hash = ?, must_change_password = FALSE, visible_password = ? WHERE id = ?`,
        [newPasswordHash, newPassword, user.id]
      );
      
      // Also update franchise_partners table if this is an FP user
      if (user.role === 'franchise_partner' || user.role === 'franchise') {
        try {
          await pool.execute(
            `UPDATE franchise_partners SET password_hash = ?, must_change_password = FALSE, visible_password = ? WHERE email = ?`,
            [newPasswordHash, newPassword, user.email]
          );
        } catch (e) {
          // FP record may not exist - ignore
        }
      }

      // Generate token for auto-login
      const token = generateToken({
        id: user.id,
        userId: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      });

      return res.json({
        success: true,
        message: 'Password updated successfully',
        data: {
          token,
          user: {
            id: user.id,
            userId: user.user_id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            roleName: ROLE_NAMES[user.role],
            franchisePartnerId: user.franchise_partner_id || null
          }
        }
      });
    } else {
      // userType === 'franchise_partner' - Store new password for admin visibility
      await pool.execute(
        `UPDATE franchise_partners SET password_hash = ?, must_change_password = FALSE, visible_password = ? WHERE id = ?`,
        [newPasswordHash, newPassword, user.id]
      );
      
      // Also update users table if exists
      try {
        await pool.execute(
          `UPDATE users SET password_hash = ?, must_change_password = FALSE, visible_password = ? WHERE email = ?`,
          [newPasswordHash, newPassword, user.email]
        );
      } catch (e) {
        // User record may not exist - ignore
      }

      // Generate token for auto-login
      const token = generateToken({
        id: user.id,
        fpId: user.id,
        username: user.username,
        email: user.email,
        role: 'franchise_partner',
        first_name: user.contact_person || user.owner_name || user.company_name,
        last_name: ''
      });

      return res.json({
        success: true,
        message: 'Password updated successfully',
        data: {
          token,
          user: {
            id: user.id,
            fpId: user.id,
            username: user.username,
            email: user.email,
            firstName: user.contact_person || user.owner_name || user.company_name,
            lastName: '',
            role: 'franchise_partner',
            roleName: 'Franchise Partner',
            companyName: user.company_name,
            franchisePartnerId: user.id
          }
        }
      });
    }
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
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
             CONCAT(c.first_name, ' ', c.last_name) as created_by_name,
             fp.company_name as franchise_name,
             fp.owner_name,
             fp.gst_number,
             fp.pan_number
      FROM users u
      LEFT JOIN users c ON u.created_by = c.id
      LEFT JOIN franchise_partners fp ON u.email = fp.email
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
        userId: s.user_id,
        username: s.username,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        phone: s.phone,
        role: s.role,
        roleName: ROLE_NAMES[s.role],
        visiblePassword: s.visible_password,
        franchiseName: s.franchise_name || '',
        ownerName: s.owner_name || '',
        companyName: s.franchise_name || '',
        gstNumber: s.gst_number || '',
        panNumber: s.pan_number || '',
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
        mustChangePassword: s.must_change_password,
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
              CONCAT(c.first_name, ' ', c.last_name) as created_by_name,
              fp.company_name as franchise_name,
              fp.owner_name,
              fp.gst_number,
              fp.pan_number
       FROM users u
       LEFT JOIN users c ON u.created_by = c.id
       LEFT JOIN franchise_partners fp ON u.email = fp.email
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
        userId: s.user_id,
        username: s.username,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        phone: s.phone,
        role: s.role,
        roleName: ROLE_NAMES[s.role],
        franchiseName: s.franchise_name || '',
        ownerName: s.owner_name || '',
        companyName: s.franchise_name || '',
        gstNumber: s.gst_number || '',
        panNumber: s.pan_number || '',
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

// Create new staff member with auto-generated temp password and email notification
router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { 
      username, email, firstName, lastName, phone, role,
      canView, canCreate, canEdit, canDelete, canApprove, canAssign, canClose,
      sendEmail = true, // Default to sending email
      // FP-specific fields
      franchiseId, franchiseName, companyName, gstNumber, panNumber,
      address, city, state, pincode, bankName, accountNumber, ifscCode, commissionRate
    } = req.body;

    // Validation - password is NOT required (auto-generated)
    if (!username || !email || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, first name, last name, and role are required'
      });
    }

    // Validate role - allow all 7 roles
    const validRoles = ['admin', 'operations_manager', 'franchise_partner', 'franchise', 'manager', 'coordinator', 'supervisor', 'executive'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: admin, operations_manager, franchise_partner, manager, coordinator, supervisor, executive'
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

    // Generate unique User ID and temporary password
    const userId = await generateUserId(role);
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Insert new user with must_change_password flag and visible_password for admin
    const [result] = await pool.execute(
      `INSERT INTO users (
        user_id, username, email, password_hash, first_name, last_name, phone, role,
        can_view, can_create, can_edit, can_delete, can_approve, can_assign, can_close,
        must_change_password, visible_password, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
      [
        userId, username, email, passwordHash, firstName, lastName, phone || null, role,
        canView ?? null, canCreate ?? null, canEdit ?? null, canDelete ?? null,
        canApprove ?? null, canAssign ?? null, canClose ?? null,
        tempPassword, req.user.id
      ]
    );

    const newUserId = result.insertId;
    let fpRecord = null;

    // If creating a franchise partner, also create a record in franchise_partners table
    if (role === 'franchise_partner' || role === 'franchise') {
      try {
        // Use the same userId as fp_code (no separate franchise ID)
        const fpCode = userId;
        const [fpResult] = await pool.execute(
          `INSERT INTO franchise_partners (
            fp_code, username, email, password_hash, company_name, owner_name, phone,
            address, city, state, zip_code, gst_number, pan_number, visible_password, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fpCode, username, email, passwordHash, 
            companyName || franchiseName || `${firstName} ${lastName}`,
            `${firstName} ${lastName}`, phone || null,
            address || null, city || null, state || null, pincode || null,
            gstNumber || null, panNumber || null, tempPassword, req.user.id
          ]
        );
        
        // Update the user record to link to the franchise partner
        await pool.execute(
          `UPDATE users SET franchise_partner_id = ? WHERE id = ?`,
          [fpResult.insertId, newUserId]
        );
        
        fpRecord = { id: fpResult.insertId, fpCode };
        console.log(`✅ Franchise Partner record created: ${fpCode} (ID: ${fpResult.insertId})`);
      } catch (fpError) {
        console.error('Error creating franchise partner record:', fpError);
        // Continue even if FP record creation fails - user is already created
      }
    }

    // Send welcome email with temporary password
    let emailSent = false;
    if (sendEmail) {
      const emailResult = await sendEmployeeWelcomeEmail({
        email,
        firstName,
        lastName,
        username,
        tempPassword,
        role,
        userId,
        loginUrl: process.env.ADMIN_PORTAL_URL || 'https://admin.xlandinfra.com'
      });
      emailSent = emailResult.success;
    }

    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Staff member created successfully. Welcome email sent with login credentials.' 
        : 'Staff member created successfully. Email notification could not be sent.',
      data: {
        id: newUserId,
        userId,
        username,
        email,
        role,
        roleName: ROLE_NAMES[role],
        emailSent,
        franchisePartner: fpRecord
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

    // Check if user exists and get current details for email
    const [existing] = await pool.execute(
      `SELECT id, email, first_name, role FROM users WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }
    
    const currentUser = existing[0];

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

    // Update password if provided (also store visible_password for admin)
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      params.push(passwordHash);
      updateFields.push('visible_password = ?');
      params.push(password);
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

    // Send email notification if password was updated
    if (password) {
      const userEmail = email || currentUser.email;
      const userFirstName = firstName || currentUser.first_name;
      
      try {
        await sendPasswordUpdatedByAdminEmail({
          email: userEmail,
          firstName: userFirstName,
          newPassword: password,
          portalUrl: ADMIN_PORTAL_URL
        });
        console.log(`📧 Password update email sent to ${userEmail}`);
      } catch (emailError) {
        console.error('Failed to send password update email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: password ? 'Staff member updated successfully. Password notification sent.' : 'Staff member updated successfully'
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

// Delete staff member (permanent delete)
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

    // Check if user exists
    const [existing] = await pool.execute(
      `SELECT id, email, role FROM users WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Permanently delete the user from database
    const [result] = await pool.execute(
      `DELETE FROM users WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    console.log(`🗑️ User permanently deleted: ID ${id}, Email: ${existing[0].email}`);

    res.json({
      success: true,
      message: 'Staff member permanently deleted successfully'
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
