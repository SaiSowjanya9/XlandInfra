const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendCustomerActivationEmail, sendPasswordResetConfirmation, sendPasswordResetEmail, sendPasswordResetSuccess } = require('../services/emailService');

// Constants
const ACTIVATION_EXPIRY_HOURS = 72; // 72 hours
const PASSWORD_RESET_EXPIRY_HOURS = 48; // 48 hours for password reset
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

// Initialize database tables and columns
const initializeDatabase = async () => {
  try {
    // Create customer_accounts table if not exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        temp_password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        country_code VARCHAR(10) DEFAULT '+91',
        property_id INT,
        property_contact_id INT,
        property_name VARCHAR(255),
        property_code VARCHAR(50),
        activation_token VARCHAR(255),
        activation_expires DATETIME,
        is_activated BOOLEAN DEFAULT FALSE,
        activated_at DATETIME,
        is_active BOOLEAN DEFAULT TRUE,
        login_attempts INT DEFAULT 0,
        locked_until DATETIME,
        last_login DATETIME,
        reset_token VARCHAR(255),
        reset_token_expires DATETIME,
        reset_temp_password_hash VARCHAR(255),
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Create customer_activity_log table if not exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customer_activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Customer database tables initialized');
  } catch (e) {
    console.log('Database init note:', e.message);
  }
};

// Run initialization on module load
initializeDatabase();

// ============================================
// POST /api/customers/create - Create customer account (called by admin)
// ============================================
router.post('/create', async (req, res) => {
  console.log('📧 /api/customers/create endpoint hit');
  console.log('📧 Request body:', req.body);
  
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
        propertyName,
        propertyId: propertyCode || propertyId
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
      propertyName,
      propertyId: propertyCode || propertyId
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
       WHERE activation_token = ? AND is_active = 1`,
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
  // Ensure customer_activity_log table exists BEFORE getting connection
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS customer_activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSON,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) { /* ignore */ }
  
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
       WHERE activation_token = ? AND is_active = 1`,
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

    // Log activity (non-critical)
    try {
      await conn.execute(
        `INSERT INTO customer_activity_log (customer_id, action, details)
         VALUES (?, 'account_activated', ?)`,
        [customer.id, JSON.stringify({ method: 'email_activation' })]
      );
    } catch (logErr) {
      console.log('Activity log insert failed:', logErr.message);
    }

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
    // Ensure customer_activity_log table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS customer_activity_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          details JSON,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) { /* ignore */ }
    
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find customer - fetch property details from both properties and onboarded_properties tables
    // Try joining by both id (numeric) and property_id (string) in case either was stored
    const [customers] = await pool.execute(
      `SELECT ca.*, 
              COALESCE(p.name, op1.community_name, op2.community_name) as op_property_name,
              COALESCE(p.property_id, op1.property_id, op2.property_id) as op_property_id,
              COALESCE(p.zone_id, op1.zone, op2.zone) as op_zone, 
              COALESCE(p.division, op1.division, op2.division) as op_division, 
              COALESCE(op1.entry_type, op2.entry_type) as entry_type,
              COALESCE(p.address, op1.address, op2.address) as op_address, 
              COALESCE(p.city, op1.city, op2.city) as op_city, 
              COALESCE(p.state, op1.state, op2.state) as op_state,
              COALESCE(p.property_type, op1.property_type, op2.property_type) as op_property_type
       FROM customer_accounts ca
       LEFT JOIN properties p ON CAST(ca.property_id AS UNSIGNED) = p.id
       LEFT JOIN onboarded_properties op1 ON CAST(ca.property_id AS UNSIGNED) = op1.id
       LEFT JOIN onboarded_properties op2 ON ca.property_id = op2.property_id
       WHERE ca.email = ? AND ca.is_active = 1`,
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

    // Reset login attempts on successful login (non-critical)
    try {
      await pool.execute(
        `UPDATE customer_accounts 
         SET login_attempts = 0, locked_until = NULL, last_login = NOW()
         WHERE id = ?`,
        [customer.id]
      );
    } catch (updateErr) {
      console.log('Login attempts reset failed:', updateErr.message);
    }

    // Log activity (non-critical - don't fail login if this fails)
    try {
      await pool.execute(
        `INSERT INTO customer_activity_log (customer_id, action, ip_address)
         VALUES (?, 'login', ?)`,
        [customer.id, req.ip]
      );
    } catch (logErr) {
      console.log('Activity log insert failed (table may not exist):', logErr.message);
    }

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

    // Determine the actual property code - only use real property codes
    const actualPropertyCode = customer.op_property_id || customer.property_code || null;

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
          propertyId: actualPropertyCode,
          propertyName: customer.op_property_name || customer.property_name || null,
          propertyCode: actualPropertyCode,
          propertyType: customer.op_property_type || null,
          zone: customer.op_zone || customer.zone || null,
          division: customer.op_division || customer.division || null,
          address: customer.op_address || customer.address || null,
          city: customer.op_city || customer.city || null,
          state: customer.op_state || customer.state || null
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
// POST /api/customers/verify-session - Verify if customer still exists and is active
// Called on page refresh to validate session
// ============================================
router.post('/verify-session', async (req, res) => {
  try {
    const { customerId, email } = req.body;

    if (!customerId || !email) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Customer ID and email are required'
      });
    }

    // Check if customer exists and is active
    const [customers] = await pool.execute(
      `SELECT id, customer_id, email, is_active, is_activated 
       FROM customer_accounts 
       WHERE customer_id = ? AND email = ?`,
      [customerId, email.toLowerCase()]
    );

    if (customers.length === 0) {
      return res.json({
        success: true,
        valid: false,
        message: 'Customer account not found'
      });
    }

    const customer = customers[0];

    // Check if account is active and activated
    if (!customer.is_active) {
      return res.json({
        success: true,
        valid: false,
        message: 'Customer account has been deactivated'
      });
    }

    if (!customer.is_activated) {
      return res.json({
        success: true,
        valid: false,
        message: 'Customer account is not activated'
      });
    }

    // Session is valid
    res.json({
      success: true,
      valid: true,
      message: 'Session is valid'
    });

  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Error verifying session',
      error: error.message
    });
  }
});

// ============================================
// POST /api/customers/forgot-password - Request password reset
// ============================================
router.post('/forgot-password', async (req, res) => {
  try {
    // Ensure required columns exist
    const columnsToAdd = [
      { name: 'reset_token', def: 'VARCHAR(255) NULL' },
      { name: 'reset_token_expires', def: 'DATETIME NULL' },
      { name: 'reset_temp_password_hash', def: 'VARCHAR(255) NULL' }
    ];
    for (const col of columnsToAdd) {
      try {
        const [cols] = await pool.execute(`SHOW COLUMNS FROM customer_accounts LIKE ?`, [col.name]);
        if (cols.length === 0) {
          await pool.execute(`ALTER TABLE customer_accounts ADD COLUMN ${col.name} ${col.def}`);
        }
      } catch (e) { /* ignore */ }
    }
    
    // Ensure customer_activity_log table exists
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS customer_activity_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          details JSON,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) { /* ignore */ }
    
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find customer by email
    const [customers] = await pool.execute(
      `SELECT id, customer_id, email, first_name, last_name, is_activated, is_active
       FROM customer_accounts 
       WHERE email = ?`,
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (customers.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    const customer = customers[0];

    // Check if account is active
    if (!customer.is_active) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.'
      });
    }

    // Check if account is activated
    if (!customer.is_activated) {
      return res.status(400).json({
        success: false,
        message: 'Your account has not been activated yet. Please check your email for the activation link or contact support.',
        notActivated: true
      });
    }

    // Generate temporary password and reset token
    const tempPassword = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    // Store reset token and temp password
    await pool.execute(
      `UPDATE customer_accounts 
       SET reset_token = ?, 
           reset_token_expires = ?,
           reset_temp_password_hash = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [resetToken, resetExpires, tempPasswordHash, customer.id]
    );

    // Generate reset link
    const resetLink = `${FRONTEND_URL}/reset-password/${resetToken}`;

    // Send password reset email
    await sendPasswordResetEmail({
      email: customer.email,
      firstName: customer.first_name,
      tempPassword,
      resetLink,
      userType: 'customer',
      expiryHours: PASSWORD_RESET_EXPIRY_HOURS
    });

    // Log activity (non-critical)
    try {
      await pool.execute(
        `INSERT INTO customer_activity_log (customer_id, action, details, ip_address)
         VALUES (?, 'password_reset_requested', ?, ?)`,
        [customer.id, JSON.stringify({ method: 'email' }), req.ip]
      );
    } catch (logErr) {
      console.log('Activity log insert failed:', logErr.message);
    }

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
// GET /api/customers/verify-reset-token/:token - Verify reset token
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

    // Find customer by reset token
    const [customers] = await pool.execute(
      `SELECT id, email, first_name, reset_token_expires
       FROM customer_accounts 
       WHERE reset_token = ? AND is_active = 1`,
      [token]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new password reset.'
      });
    }

    const customer = customers[0];

    // Check if token has expired
    if (new Date(customer.reset_token_expires) < new Date()) {
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
        email: customer.email,
        firstName: customer.first_name
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
// POST /api/customers/reset-password - Reset password with temp password
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

    // Find customer by reset token
    const [customers] = await conn.execute(
      `SELECT id, customer_id, email, first_name, reset_token_expires, reset_temp_password_hash
       FROM customer_accounts 
       WHERE reset_token = ? AND is_active = 1`,
      [token]
    );

    if (customers.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Invalid reset link'
      });
    }

    const customer = customers[0];

    // Check if token has expired
    if (new Date(customer.reset_token_expires) < new Date()) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Password reset link has expired. Please request a new one.'
      });
    }

    // Verify temporary password
    const isTempPasswordValid = await bcrypt.compare(tempPassword, customer.reset_temp_password_hash);
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
      `UPDATE customer_accounts 
       SET password_hash = ?,
           reset_token = NULL,
           reset_token_expires = NULL,
           reset_temp_password_hash = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [newPasswordHash, customer.id]
    );

    // Log activity
    await conn.execute(
      `INSERT INTO customer_activity_log (customer_id, action, details)
       VALUES (?, 'password_reset_completed', ?)`,
      [customer.id, JSON.stringify({ method: 'email_reset' })]
    );

    await conn.commit();

    // Send confirmation email
    await sendPasswordResetSuccess({
      email: customer.email,
      firstName: customer.first_name,
      userType: 'customer'
    });

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

    // Get customer profile - check both onboarded_properties and properties tables
    const [customers] = await pool.execute(
      `SELECT ca.*, 
              COALESCE(op.community_name, p.name) as community_name,
              COALESCE(op.zone, p.zone) as zone, 
              COALESCE(op.division, p.division) as division, 
              op.entry_type,
              COALESCE(op.address, p.address) as prop_address, 
              COALESCE(op.city, p.city) as prop_city, 
              COALESCE(op.state, p.state) as prop_state,
              op.total_units, 
              COALESCE(op.property_id, p.property_id) as actual_property_id
       FROM customer_accounts ca
       LEFT JOIN onboarded_properties op ON ca.property_id = op.id
       LEFT JOIN properties p ON ca.property_id = p.id
       WHERE ca.id = ? AND ca.is_active = 1`,
      [decoded.id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customer = customers[0];

    // Determine actual property code - only use real property codes
    const actualPropCode = customer.actual_property_id || customer.property_code || null;

    res.json({
      success: true,
      data: {
        id: customer.id,
        customerId: customer.customer_id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
        propertyId: actualPropCode,
        propertyName: customer.property_name || customer.community_name,
        propertyCode: actualPropCode,
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
       WHERE email = ? AND is_active = 1`,
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

    const customerId = decoded.id;
    const customerEmail = decoded.email;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Customer ID not found in token' });
    }

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const custEmail = customerEmail || customerData.email;
    const storedPropertyId = customerData.property_id;
    const storedPropertyCode = customerData.property_code; // String like "GC-1781557633834"

    // Resolve property to get both numeric ID and property code
    let numericPropertyId = storedPropertyId; // might already be numeric
    let propertyCode = storedPropertyCode;
    let propertyName = customerData.property_name;

    // Try to resolve from property tables if needed
    const lookupId = storedPropertyId || storedPropertyCode;
    if (lookupId) {
      // Try onboarded_properties first
      const [opData] = await pool.execute(
        `SELECT id, property_id, community_name FROM onboarded_properties 
         WHERE id = ? OR property_id = ?`,
        [lookupId, lookupId]
      );
      if (opData.length > 0) {
        numericPropertyId = opData[0].id;
        propertyCode = propertyCode || opData[0].property_id;
        propertyName = propertyName || opData[0].community_name;
      } else {
        // Try properties table
        const [pData] = await pool.execute(
          `SELECT id, property_id, name FROM properties 
           WHERE id = ? OR property_id = ?`,
          [lookupId, lookupId]
        );
        if (pData.length > 0) {
          numericPropertyId = pData[0].id;
          propertyCode = propertyCode || pData[0].property_id;
          propertyName = propertyName || pData[0].name;
        }
      }
    }

    console.log('[Customer Dashboard] Resolved property:', {
      storedPropertyId, storedPropertyCode, numericPropertyId, propertyCode, propertyName, custEmail, customerId
    });

    // Get work orders for this customer - match by property_id (numeric or code string), property_name, resident_id, or customer_email
    const [workOrders] = await pool.execute(
      `SELECT DISTINCT wo.id, wo.work_order_id, wo.category_id, wo.subcategory_id,
              wo.category_name, wo.subcategory_name, wo.description,
              wo.permission_to_enter, wo.entry_notes, wo.has_pet, wo.priority,
              wo.status, wo.customer_name, wo.customer_email, wo.customer_phone,
              wo.property_name as wo_property_name, 
              COALESCE(wo.property_type, p.property_type, op.property_type) as property_type, 
              wo.block, wo.flat_number,
              wo.assigned_vendor_id, wo.scheduled_date, wo.completed_at,
              wo.created_at, wo.updated_at, wo.source
       FROM work_orders wo
       LEFT JOIN properties p ON (wo.property_id = p.id OR wo.property_id = p.property_id) AND p.status != 'deleted'
       LEFT JOIN onboarded_properties op ON (wo.property_id = op.id OR wo.property_id = op.property_id) AND op.status = 'active'
       WHERE wo.property_id = ? 
          OR wo.property_id = ?
          OR wo.property_name = ?
          OR wo.resident_id = ?
          OR LOWER(wo.customer_email) = LOWER(?)
       ORDER BY wo.created_at DESC
       LIMIT 10`,
      [numericPropertyId, propertyCode, propertyName, customerId, custEmail]
    );

    console.log('[Customer Dashboard] Found work orders:', workOrders.length, 'for property:', propertyName);

    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }

    // Get stats for this customer
    const [[stats]] = await pool.execute(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status IN ('pending', 'under_review', 'assigned', 'in_progress', 'accepted') THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status IN ('completed', 'closed', 'verified') THEN 1 ELSE 0 END) as completed
       FROM work_orders 
       WHERE property_id = ? OR property_id = ? OR property_name = ? OR resident_id = ? OR LOWER(customer_email) = LOWER(?)`,
      [numericPropertyId, propertyCode, propertyName, customerId, custEmail]
    );

    res.json({
      success: true,
      data: {
        customer: {
          id: customerData.id,
          firstName: customerData.first_name,
          lastName: customerData.last_name,
          email: customerData.email,
          propertyName: propertyName,
          propertyId: propertyCode,
          propertyCode: propertyCode
        },
        recentWorkOrders: workOrders,
        stats: {
          pending: stats?.pending || 0,
          completed: stats?.completed || 0,
          total: stats?.total || 0
        }
      }
    });
  } catch (error) {
    console.error('Customer dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard', error: error.message });
  }
});

// ============================================
// GET CUSTOMER WORK ORDERS - Get all work orders for logged-in customer
// ============================================
router.get('/work-orders', async (req, res) => {
  try {
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

    const customerId = decoded.id;
    const customerEmail = decoded.email;

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const custEmail = customerEmail || customerData.email;
    const storedPropertyId = customerData.property_id;
    const storedPropertyCode = customerData.property_code; // String like "GC-1781557633834"
    let propertyName = customerData.property_name; // Store property name for matching

    // Resolve property to get numeric ID
    let numericPropertyId = storedPropertyId;
    let propertyCode = storedPropertyCode;

    const lookupId = storedPropertyId || storedPropertyCode;
    if (lookupId) {
      const [opData] = await pool.execute(
        `SELECT id, property_id, community_name FROM onboarded_properties WHERE id = ? OR property_id = ?`,
        [lookupId, lookupId]
      );
      if (opData.length > 0) {
        numericPropertyId = opData[0].id;
        propertyCode = propertyCode || opData[0].property_id;
        propertyName = propertyName || opData[0].community_name;
      } else {
        const [pData] = await pool.execute(
          `SELECT id, property_id, name FROM properties WHERE id = ? OR property_id = ?`,
          [lookupId, lookupId]
        );
        if (pData.length > 0) {
          numericPropertyId = pData[0].id;
          propertyCode = propertyCode || pData[0].property_id;
          propertyName = propertyName || pData[0].name;
        }
      }
    }

    // Get all work orders with full details - match by property_id (numeric or code string), property_name, resident_id, or customer_email
    const [workOrders] = await pool.execute(
      `SELECT DISTINCT wo.id, wo.work_order_id, wo.category_id, wo.subcategory_id,
              wo.category_name, wo.subcategory_name, wo.description,
              wo.permission_to_enter, wo.entry_notes, wo.has_pet, wo.priority,
              wo.status, wo.customer_name, wo.customer_email, wo.customer_phone,
              wo.property_name, 
              COALESCE(wo.property_type, p.property_type, op.property_type) as property_type, 
              wo.block, wo.flat_number,
              wo.assigned_vendor_id, wo.scheduled_date, wo.completed_at,
              wo.admin_notes, wo.created_at, wo.updated_at, wo.source
       FROM work_orders wo
       LEFT JOIN properties p ON (wo.property_id = p.id OR wo.property_id = p.property_id) AND p.status != 'deleted'
       LEFT JOIN onboarded_properties op ON (wo.property_id = op.id OR wo.property_id = op.property_id) AND op.status = 'active'
       WHERE wo.property_id = ? 
          OR wo.property_id = ?
          OR wo.property_name = ?
          OR wo.resident_id = ?
          OR LOWER(wo.customer_email) = LOWER(?)
       ORDER BY wo.created_at DESC`,
      [numericPropertyId, propertyCode, propertyName, customerId, custEmail]
    );

    // Get attachments for each work order
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
    console.error('Error fetching customer work orders:', error);
    res.status(500).json({ success: false, message: 'Error fetching work orders', error: error.message });
  }
});

module.exports = router;
