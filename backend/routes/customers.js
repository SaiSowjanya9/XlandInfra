const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendCustomerActivationEmail, sendPasswordResetConfirmation } = require('../services/emailService');

// Constants
const ACTIVATION_EXPIRY_HOURS = 72; // 72 hours
const JWT_SECRET = process.env.JWT_SECRET || 'xlandinfra-customer-portal-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://xlandinfra.com';

// Generate unique customer ID: CUST-XXXX-YYYYMMDD
const generateCustomerId = () => {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CUST-${random}-${date}`;
};

// Generate secure temporary password (8 chars, alphanumeric)
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0, O, 1, I
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

// ============================================
// POST /api/customers/create - Create customer account (called by admin)
// ============================================
router.post('/create', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      email,
      firstName,
      lastName,
      phone,
      countryCode,
      propertyId,
      propertyContactId,
      propertyName,
      propertyCode,
      createdBy
    } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if customer already exists
    const [existing] = await conn.execute(
      'SELECT id, is_activated FROM customer_accounts WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existing.length > 0) {
      // If already exists and activated, return error
      if (existing[0].is_activated) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: 'A customer account with this email already exists and is active.'
        });
      }
      
      // If exists but not activated, resend activation email
      const tempPassword = generateTempPassword();
      const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
      const activationToken = generateActivationToken();
      const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);

      await conn.execute(
        `UPDATE customer_accounts 
         SET temp_password_hash = ?, 
             activation_token = ?, 
             activation_expires = ?,
             first_name = COALESCE(?, first_name),
             last_name = COALESCE(?, last_name),
             phone = COALESCE(?, phone),
             updated_at = NOW()
         WHERE id = ?`,
        [tempPasswordHash, activationToken, activationExpires, firstName, lastName, phone, existing[0].id]
      );

      await conn.commit();

      // Send activation email
      const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
      await sendCustomerActivationEmail({
        email: email.toLowerCase(),
        firstName,
        tempPassword,
        activationLink,
        propertyName
      });

      return res.json({
        success: true,
        message: 'Activation email resent successfully',
        data: {
          customerId: existing[0].customer_id,
          email: email.toLowerCase(),
          emailSent: true
        }
      });
    }

    // Generate credentials
    const customerId = generateCustomerId();
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const activationToken = generateActivationToken();
    const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Insert new customer account
    const [result] = await conn.execute(
      `INSERT INTO customer_accounts 
       (customer_id, email, temp_password_hash, activation_token, activation_expires,
        first_name, last_name, phone, country_code, 
        property_id, property_contact_id, property_name, property_code, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        email.toLowerCase(),
        tempPasswordHash,
        activationToken,
        activationExpires,
        firstName || null,
        lastName || null,
        phone || null,
        countryCode || '+91',
        propertyId || null,
        propertyContactId || null,
        propertyName || null,
        propertyCode || null,
        createdBy || 'admin'
      ]
    );

    await conn.commit();

    // Send activation email
    const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
    const emailResult = await sendCustomerActivationEmail({
      email: email.toLowerCase(),
      firstName,
      tempPassword,
      activationLink,
      propertyName
    });

    res.status(201).json({
      success: true,
      message: 'Customer account created and activation email sent',
      data: {
        id: result.insertId,
        customerId,
        email: email.toLowerCase(),
        emailSent: emailResult.success,
        activationExpires: activationExpires.toISOString()
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error creating customer account:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating customer account',
      error: error.message
    });
  } finally {
    conn.release();
  }
});

// ============================================
// GET /api/customers/activate/:token - Validate activation link
// ============================================
router.get('/activate/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const [customers] = await pool.execute(
      `SELECT id, customer_id, email, first_name, last_name, property_name,
              activation_expires, is_activated
       FROM customer_accounts 
       WHERE activation_token = ? AND is_active = TRUE`,
      [token]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid activation link. Please contact support.'
      });
    }

    const customer = customers[0];

    if (customer.is_activated) {
      return res.status(400).json({
        success: false,
        message: 'This account has already been activated. Please login.',
        alreadyActivated: true
      });
    }

    if (new Date(customer.activation_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This activation link has expired. Please contact support for a new link.',
        expired: true
      });
    }

    res.json({
      success: true,
      message: 'Activation link is valid',
      data: {
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        propertyName: customer.property_name
      }
    });

  } catch (error) {
    console.error('Error validating activation link:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating activation link',
      error: error.message
    });
  }
});

// ============================================
// POST /api/customers/set-password - Set password after activation
// ============================================
router.post('/set-password', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { token, email, tempPassword, newPassword } = req.body;

    // Validate required fields
    if (!token || !email || !tempPassword || !newPassword) {
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

    // Find customer by token
    const [customers] = await conn.execute(
      `SELECT id, customer_id, email, first_name, temp_password_hash, 
              activation_expires, is_activated
       FROM customer_accounts 
       WHERE activation_token = ? AND is_active = TRUE`,
      [token]
    );

    if (customers.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Invalid activation link'
      });
    }

    const customer = customers[0];

    // Check if already activated
    if (customer.is_activated) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'This account has already been activated'
      });
    }

    // Check expiry
    if (new Date(customer.activation_expires) < new Date()) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Activation link has expired'
      });
    }

    // Verify email matches
    if (customer.email.toLowerCase() !== email.toLowerCase()) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Email does not match the registered email'
      });
    }

    // Verify temporary password
    const isTempPasswordValid = await bcrypt.compare(tempPassword, customer.temp_password_hash);
    if (!isTempPasswordValid) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid temporary password'
      });
    }

    // Hash new password and activate account
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await conn.execute(
      `UPDATE customer_accounts 
       SET password_hash = ?,
           temp_password_hash = NULL,
           activation_token = NULL,
           activation_expires = NULL,
           is_activated = TRUE,
           activated_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, customer.id]
    );

    // Log activity
    await conn.execute(
      `INSERT INTO customer_activity_log (customer_id, action, details)
       VALUES (?, 'account_activated', ?)`,
      [customer.id, JSON.stringify({ method: 'email_activation' })]
    );

    await conn.commit();

    // Send confirmation email
    await sendPasswordResetConfirmation({
      email: customer.email,
      firstName: customer.first_name
    });

    res.json({
      success: true,
      message: 'Account activated successfully. You can now login.',
      data: {
        customerId: customer.customer_id,
        email: customer.email
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      message: 'Error activating account',
      error: error.message
    });
  } finally {
    conn.release();
  }
});

// ============================================
// POST /api/customers/login - Customer login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find customer
    const [customers] = await pool.execute(
      `SELECT ca.*, op.community_name, op.zone, op.division, op.entry_type,
              op.address, op.city, op.state
       FROM customer_accounts ca
       LEFT JOIN onboarded_properties op ON ca.property_id = op.id
       WHERE ca.email = ? AND ca.is_active = TRUE`,
      [email.toLowerCase()]
    );

    if (customers.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const customer = customers[0];

    // Check if account is activated
    if (!customer.is_activated) {
      return res.status(401).json({
        success: false,
        message: 'Your account has not been activated yet. Please check your email for the activation link.',
        notActivated: true
      });
    }

    // Check if account is locked
    if (customer.locked_until && new Date(customer.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(customer.locked_until) - new Date()) / 60000);
      return res.status(401).json({
        success: false,
        message: `Account is temporarily locked. Please try again in ${minutesLeft} minutes.`,
        locked: true
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, customer.password_hash);
    
    if (!isPasswordValid) {
      // Increment login attempts
      const attempts = (customer.login_attempts || 0) + 1;
      let lockUntil = null;
      
      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 minutes
      }

      await pool.execute(
        `UPDATE customer_accounts 
         SET login_attempts = ?, locked_until = ?
         WHERE id = ?`,
        [attempts, lockUntil, customer.id]
      );

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        attemptsRemaining: Math.max(0, 5 - attempts)
      });
    }

    // Reset login attempts on successful login
    await pool.execute(
      `UPDATE customer_accounts 
       SET login_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = ?`,
      [customer.id]
    );

    // Log activity
    await pool.execute(
      `INSERT INTO customer_activity_log (customer_id, action, ip_address)
       VALUES (?, 'login', ?)`,
      [customer.id, req.ip]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: customer.id,
        customerId: customer.customer_id,
        email: customer.email,
        type: 'customer'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        customer: {
          id: customer.id,
          customerId: customer.customer_id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          phone: customer.phone,
          propertyId: customer.property_id,
          propertyName: customer.property_name || customer.community_name,
          propertyCode: customer.property_code,
          zone: customer.zone,
          division: customer.division,
          address: customer.address,
          city: customer.city,
          state: customer.state
        }
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
});

// ============================================
// GET /api/customers/profile - Get customer profile (authenticated)
// ============================================
router.get('/profile', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Get customer profile
    const [customers] = await pool.execute(
      `SELECT ca.*, op.community_name, op.zone, op.division, op.entry_type,
              op.address as prop_address, op.city as prop_city, op.state as prop_state,
              op.total_units
       FROM customer_accounts ca
       LEFT JOIN onboarded_properties op ON ca.property_id = op.id
       WHERE ca.id = ? AND ca.is_active = TRUE`,
      [decoded.id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customer = customers[0];

    res.json({
      success: true,
      data: {
        id: customer.id,
        customerId: customer.customer_id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        propertyId: customer.property_id,
        propertyName: customer.property_name || customer.community_name,
        propertyCode: customer.property_code,
        zone: customer.zone,
        division: customer.division,
        address: customer.prop_address,
        city: customer.prop_city,
        state: customer.prop_state,
        totalUnits: customer.total_units,
        lastLogin: customer.last_login,
        activatedAt: customer.activated_at
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

// ============================================
// POST /api/customers/resend-activation - Resend activation email
// ============================================
router.post('/resend-activation', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const [customers] = await pool.execute(
      `SELECT id, customer_id, email, first_name, property_name, is_activated
       FROM customer_accounts 
       WHERE email = ? AND is_active = TRUE`,
      [email.toLowerCase()]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    const customer = customers[0];

    if (customer.is_activated) {
      return res.status(400).json({
        success: false,
        message: 'This account is already activated. Please login.'
      });
    }

    // Generate new credentials
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const activationToken = generateActivationToken();
    const activationExpires = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);

    await pool.execute(
      `UPDATE customer_accounts 
       SET temp_password_hash = ?, 
           activation_token = ?, 
           activation_expires = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [tempPasswordHash, activationToken, activationExpires, customer.id]
    );

    // Send activation email
    const activationLink = `${FRONTEND_URL}/activate/${activationToken}`;
    const emailResult = await sendCustomerActivationEmail({
      email: customer.email,
      firstName: customer.first_name,
      tempPassword,
      activationLink,
      propertyName: customer.property_name
    });

    res.json({
      success: true,
      message: 'Activation email has been resent',
      data: {
        emailSent: emailResult.success
      }
    });

  } catch (error) {
    console.error('Error resending activation:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending activation email',
      error: error.message
    });
  }
});

// ============================================
// CUSTOMER DASHBOARD - Get customer-specific dashboard data
// ============================================
router.get('/dashboard', async (req, res) => {
  try {
    // Get customer ID from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const customerId = decoded.customerId || decoded.id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Customer ID not found in token' });
    }

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT ca.*, p.property_name, p.property_id as property_code
       FROM customer_accounts ca
       LEFT JOIN properties p ON ca.property_id = p.id
       WHERE ca.id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Get work orders for this customer only
    const [workOrders] = await pool.execute(
      `SELECT wo.*, c.name as category_name, sc.name as subcategory_name
       FROM work_orders wo
       LEFT JOIN categories c ON wo.category_id = c.id
       LEFT JOIN subcategories sc ON wo.subcategory_id = sc.id
       WHERE wo.customer_id = ?
       ORDER BY wo.created_at DESC
       LIMIT 10`,
      [customerId]
    );

    // Get stats for this customer
    const [pendingCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM work_orders WHERE customer_id = ? AND status IN ('pending', 'requested', 'under_review', 'assigned', 'in_progress')`,
      [customerId]
    );
    const [completedCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM work_orders WHERE customer_id = ? AND status IN ('completed', 'closed', 'verified')`,
      [customerId]
    );

    res.json({
      success: true,
      data: {
        customer: {
          id: customer[0].id,
          firstName: customer[0].first_name,
          lastName: customer[0].last_name,
          email: customer[0].email,
          propertyName: customer[0].property_name,
          propertyCode: customer[0].property_code
        },
        recentWorkOrders: workOrders,
        stats: {
          pending: pendingCount[0].count,
          completed: completedCount[0].count,
          total: pendingCount[0].count + completedCount[0].count
        }
      }
    });
  } catch (error) {
    console.error('Customer dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard', error: error.message });
  }
});

module.exports = router;
