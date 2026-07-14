/**
 * Unified Employee Login Route
 * Handles authentication for all employee roles with auto role detection
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
// Rate limiting disabled
// const { loginRateLimiter } = require('../middleware/security');

// Use JWT_SECRET from auth middleware (secure handling)
const { JWT_SECRET } = require('../middleware/auth');

// Generate JWT token
const generateToken = (user) => {
  const payload = { 
    id: user.id, 
    username: user.username, 
    email: user.email, 
    role: user.role
  };
  
  // Include franchise_partner_id if present
  if (user.franchise_partner_id) {
    payload.franchisePartnerId = user.franchise_partner_id;
    payload.fpId = user.franchise_partner_id;
  }
  
  // Include role-specific IDs
  if (user.role === 'supervisor' || user.role === 'fp_supervisor') {
    payload.supervisorId = user.id;
  }
  if (user.role === 'manager' || user.role === 'fp_manager') {
    payload.managerId = user.id;
  }
  if (user.role === 'coordinator') {
    payload.coordinatorId = user.id;
  }
  if (user.role === 'executive' || user.role === 'fp_executive') {
    payload.executiveId = user.id;
  }
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

// Unified Employee Login - Auto detects role
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Username and password are required'
      });
    }

    // Normalize the username/email input
    const normalizedUsername = username.trim().toLowerCase();
    
    console.log(`[Employee Login] Attempting login for: ${normalizedUsername}`);

    let user = null;
    let userSource = 'users';

    // Search for user in users table (all roles) - case insensitive
    const [users] = await pool.query(
      `SELECT * FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND is_active = 1`,
      [normalizedUsername, normalizedUsername]
    );

    if (users.length > 0) {
      user = users[0];
      userSource = 'users';
      console.log(`[Employee Login] Found user in users table: ${user.email}, role: ${user.role}`);
      
      // Also check fp_employees to get franchise_partner_id if not in users table
      if (!user.franchise_partner_id) {
        const [fpEmpCheck] = await pool.query(
          `SELECT franchise_partner_id FROM fp_employees WHERE user_id = ? OR email = ? OR username = ?`,
          [user.id, user.email, user.username || '']
        );
        if (fpEmpCheck.length > 0 && fpEmpCheck[0].franchise_partner_id) {
          user.franchise_partner_id = fpEmpCheck[0].franchise_partner_id;
          console.log(`[Employee Login] Merged FP ID from fp_employees: ${user.franchise_partner_id}`);
        }
      }
    }

    // If not found in users table, also check fp_employees table as fallback
    if (!user) {
      const [fpEmployees] = await pool.query(
        `SELECT fe.*, fp.company_name as franchise_company_name 
         FROM fp_employees fe
         LEFT JOIN franchise_partners fp ON fe.franchise_partner_id = fp.id
         WHERE (LOWER(fe.email) = ? OR LOWER(fe.username) = ?) AND fe.is_active = 1`,
        [normalizedUsername, normalizedUsername]
      );

      if (fpEmployees.length > 0) {
        const fpEmp = fpEmployees[0];
        // Check if there's a corresponding user record via user_id
        if (fpEmp.user_id) {
          const [linkedUsers] = await pool.query(
            `SELECT * FROM users WHERE id = ? AND is_active = 1`,
            [fpEmp.user_id]
          );
          if (linkedUsers.length > 0) {
            user = linkedUsers[0];
            // IMPORTANT: Merge franchise_partner_id from fp_employees
            user.franchise_partner_id = fpEmp.franchise_partner_id;
            userSource = 'fp_employees_linked';
            console.log(`[Employee Login] Found user via fp_employees link: ${user.email}, FP ID: ${user.franchise_partner_id}`);
          }
        }
        
        // If still no user but fp_employee has password_hash, use that
        if (!user && fpEmp.password_hash) {
          user = {
            id: fpEmp.user_id || fpEmp.id,
            username: fpEmp.username,
            email: fpEmp.email,
            password_hash: fpEmp.password_hash,
            first_name: fpEmp.first_name,
            last_name: fpEmp.last_name,
            role: fpEmp.role || 'fp_executive',
            franchise_partner_id: fpEmp.franchise_partner_id,
            must_change_password: false, // FP employees table doesn't have this
            is_active: fpEmp.is_active
          };
          userSource = 'fp_employees_direct';
          console.log(`[Employee Login] Using fp_employees credentials directly: ${fpEmp.email}`);
        }
      }
    }

    if (!user) {
      console.log(`[Employee Login] No user found for: ${normalizedUsername}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    if (!user.password_hash) {
      console.log(`[Employee Login] No password hash found for user: ${user.email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please contact your administrator.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log(`[Employee Login] Invalid password for user: ${user.email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user role is valid for employee portal
    const validRoles = ['admin', 'operations_manager', 'franchise_partner', 'franchise', 'manager', 'coordinator', 'supervisor', 'executive', 'fp_admin', 'fp_manager', 'fp_supervisor', 'fp_executive'];
    if (!validRoles.includes(user.role)) {
      console.log(`[Employee Login] Invalid role for employee portal: ${user.role}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please use the appropriate portal for your account type.'
      });
    }

    // Update last login in users table if applicable
    if (userSource === 'users' || userSource === 'fp_employees_linked') {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    }

    // Check if user must change password
    const mustChangePassword = user.must_change_password === 1 || user.must_change_password === true;

    // Generate token
    const token = generateToken(user);

    console.log(`[Employee Login] Login successful for: ${user.email}, mustChangePassword: ${mustChangePassword}`);

    // Return user data with role
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
          isSuperAdmin: user.is_super_admin === 1 || user.is_super_admin === true,
          franchisePartnerId: user.franchise_partner_id || null,
          permissions: ['all']
        }
      }
    });
  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Set new password (First login / Password change)
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

    // Normalize the username/email input
    const normalizedUsername = username.trim().toLowerCase();
    
    console.log(`[Employee Set-Password] Attempting for: ${normalizedUsername}`);

    let user = null;
    let updateFpEmployees = false;

    // Find user in users table - case insensitive
    const [users] = await pool.query(
      `SELECT * FROM users WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND is_active = 1`,
      [normalizedUsername, normalizedUsername]
    );

    if (users.length > 0) {
      user = users[0];
      console.log(`[Employee Set-Password] Found user: ${user.email}`);
    }

    // Also check fp_employees table
    if (!user) {
      const [fpEmployees] = await pool.query(
        `SELECT * FROM fp_employees WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = 1`,
        [normalizedUsername, normalizedUsername]
      );

      if (fpEmployees.length > 0) {
        const fpEmp = fpEmployees[0];
        // Try to get linked user
        if (fpEmp.user_id) {
          const [linkedUsers] = await pool.query(
            `SELECT * FROM users WHERE id = ? AND is_active = 1`,
            [fpEmp.user_id]
          );
          if (linkedUsers.length > 0) {
            user = linkedUsers[0];
            updateFpEmployees = true;
            console.log(`[Employee Set-Password] Found user via fp_employees: ${user.email}`);
          }
        }
        
        // If no linked user, use fp_employees directly
        if (!user && fpEmp.password_hash) {
          user = {
            id: fpEmp.user_id || fpEmp.id,
            fp_employee_id: fpEmp.id,
            username: fpEmp.username,
            email: fpEmp.email,
            password_hash: fpEmp.password_hash,
            first_name: fpEmp.first_name,
            last_name: fpEmp.last_name,
            role: fpEmp.role || 'fp_executive',
            franchise_partner_id: fpEmp.franchise_partner_id
          };
          updateFpEmployees = true;
          console.log(`[Employee Set-Password] Using fp_employees directly: ${fpEmp.email}`);
        }
      }
    }

    if (!user) {
      console.log(`[Employee Set-Password] User not found: ${normalizedUsername}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify current/temporary password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      console.log(`[Employee Set-Password] Invalid current password for: ${user.email}`);
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Update password in users table with visible_password for admin visibility
    if (user.id && !user.fp_employee_id) {
      await pool.query(
        `UPDATE users SET password_hash = ?, must_change_password = FALSE, visible_password = ? WHERE id = ?`,
        [newPasswordHash, newPassword, user.id]
      );
      console.log(`[Employee Set-Password] Updated users table for id: ${user.id}`);
    }
    
    // Also update fp_employees table if needed
    if (updateFpEmployees || user.fp_employee_id) {
      const fpEmpId = user.fp_employee_id || user.id;
      await pool.query(
        `UPDATE fp_employees SET password_hash = ? WHERE id = ? OR user_id = ?`,
        [newPasswordHash, fpEmpId, user.id]
      );
      console.log(`[Employee Set-Password] Updated fp_employees table`);
      
      // Also update users table via user_id link with visible_password
      if (user.id) {
        await pool.query(
          `UPDATE users SET password_hash = ?, must_change_password = FALSE, visible_password = ? WHERE id = ?`,
          [newPasswordHash, newPassword, user.id]
        );
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

    console.log(`[Employee Set-Password] Password updated successfully for: ${user.email}`);

    res.json({
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
          franchisePartnerId: user.franchise_partner_id || null
        }
      }
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify user account exists (for debugging - admin only in production)
router.post('/verify-account', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Check users table
    const [users] = await pool.query(
      `SELECT id, user_id, username, email, role, is_active, must_change_password, 
              created_at, last_login, franchise_partner_id
       FROM users WHERE LOWER(email) = ?`,
      [normalizedEmail]
    );

    // Check fp_employees table
    const [fpEmployees] = await pool.query(
      `SELECT id, employee_code, email, role, is_active, user_id, franchise_partner_id, created_at
       FROM fp_employees WHERE LOWER(email) = ?`,
      [normalizedEmail]
    );

    const result = {
      email: normalizedEmail,
      foundInUsers: users.length > 0,
      foundInFpEmployees: fpEmployees.length > 0,
      usersRecord: users.length > 0 ? {
        id: users[0].id,
        userId: users[0].user_id,
        username: users[0].username,
        role: users[0].role,
        isActive: users[0].is_active,
        mustChangePassword: users[0].must_change_password,
        hasPasswordHash: true, // Don't expose actual hash
        franchisePartnerId: users[0].franchise_partner_id,
        createdAt: users[0].created_at,
        lastLogin: users[0].last_login
      } : null,
      fpEmployeesRecord: fpEmployees.length > 0 ? {
        id: fpEmployees[0].id,
        employeeCode: fpEmployees[0].employee_code,
        role: fpEmployees[0].role,
        isActive: fpEmployees[0].is_active,
        linkedUserId: fpEmployees[0].user_id,
        franchisePartnerId: fpEmployees[0].franchise_partner_id,
        createdAt: fpEmployees[0].created_at
      } : null
    };

    // Check for potential issues
    const issues = [];
    if (!result.foundInUsers && !result.foundInFpEmployees) {
      issues.push('Account not found in any table');
    }
    if (result.foundInUsers && !users[0].is_active) {
      issues.push('Account exists but is_active = 0 in users table');
    }
    if (result.foundInFpEmployees && !fpEmployees[0].is_active) {
      issues.push('Account exists but is_active = 0 in fp_employees table');
    }
    if (result.foundInFpEmployees && fpEmployees[0].user_id && !result.foundInUsers) {
      issues.push('fp_employees has user_id but no matching users record found');
    }

    res.json({
      success: true,
      data: result,
      issues: issues.length > 0 ? issues : null,
      canLogin: result.foundInUsers && users[0].is_active
    });
  } catch (error) {
    console.error('Verify account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Resend welcome email / Reset temporary password (for admin use)
router.post('/reset-temp-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Find user in users table
    const [users] = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = ? AND is_active = 1`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User account not found or inactive'
      });
    }

    const user = users[0];

    // Generate new temporary password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let tempPassword = '';
    for (let i = 0; i < 12; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Update password and set must_change_password flag
    await pool.query(
      `UPDATE users SET password_hash = ?, must_change_password = TRUE WHERE id = ?`,
      [passwordHash, user.id]
    );

    // Also update fp_employees if exists
    await pool.query(
      `UPDATE fp_employees SET password_hash = ? WHERE user_id = ? OR LOWER(email) = ?`,
      [passwordHash, user.id, normalizedEmail]
    );

    console.log(`[Reset Temp Password] New password generated for: ${normalizedEmail}`);

    res.json({
      success: true,
      message: 'Temporary password has been reset',
      data: {
        email: normalizedEmail,
        tempPassword: tempPassword, // In production, this should be emailed instead
        mustChangePassword: true,
        note: 'User must change this password on next login'
      }
    });
  } catch (error) {
    console.error('Reset temp password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
