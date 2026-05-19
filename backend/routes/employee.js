/**
 * Unified Employee Login Route
 * Handles authentication for all employee roles with auto role detection
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'xland-infra-secret-key-2024';

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
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

    // Search for user in users table (all roles)
    const [users] = await pool.query(
      `SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
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

    // Check if user role is valid for employee portal
    const validRoles = ['admin', 'operations_manager', 'franchise_partner', 'franchise', 'manager', 'coordinator', 'supervisor', 'executive', 'fp_admin', 'fp_manager', 'fp_supervisor', 'fp_executive'];
    if (!validRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Please use the appropriate portal for your account type.'
      });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Check if user must change password
    const mustChangePassword = user.must_change_password === 1 || user.must_change_password === true;

    // Generate token
    const token = generateToken(user);

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
          franchisePartnerId: user.franchise_partner_id || null,
          permissions: ['all']
        }
      }
    });
  } catch (error) {
    console.error('Employee login error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.'
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

    // Find user
    const [users] = await pool.query(
      `SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = TRUE`,
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

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
    await pool.query(
      `UPDATE users SET password_hash = ?, must_change_password = FALSE WHERE id = ?`,
      [newPasswordHash, user.id]
    );

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
      error: error.message
    });
  }
});

module.exports = router;
