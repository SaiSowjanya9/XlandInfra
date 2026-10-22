const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendCustomerActivationEmail, sendPasswordResetConfirmation, sendPasswordResetEmail, sendPasswordResetSuccess } = require('../services/emailService');
const { issueActivation } = require('../utils/customerActivation');
const { fetchPartnerName } = require('../utils/franchisePartnerName');
// Rate limiting for login and password reset endpoints
const { loginRateLimiter, passwordResetLimiter, sanitizeString } = require('../middleware/security');
const {
  COMPLAINT_TABLE, COMPLAINT_SELECT, ensureMarketingComplaintsTable, parseCustomerComplaintBody
} = require('../utils/marketingComplaints');
const {
  notifyCustomerComplaintStatus, complaintReference
} = require('../services/complaintNotifications');
const { decodeEntities } = require('../utils/htmlEntities');
// What has happened on the property, merged from work orders, invoices and visits -- and the rule
// that keeps a visit in exactly one of the home page's two panels
const { buildCustomerActivity, buildUpcomingVisits } = require('../utils/customerActivity');
// Which notifications are this customer's own -- one rule for the list, its count and both
// mark-read routes, because they have to agree
const { customerNotificationScope } = require('../utils/customerNotificationScope');
// SECURITY: Use verifyToken instead of direct JWT_SECRET access
const { verifyToken, generateToken: authGenerateToken } = require('../middleware/auth');
const { resolvePaymentPortion, halfPaymentNote } = require('../utils/halfPayment');
const { ensurePaymentColumns } = require('../utils/paymentColumns');
const { recordRazorpayPayment } = require('../services/razorpayPayment');
const { generatePaymentId } = require('../utils/paymentIds');
const { paymentHistoryAction } = require('../utils/paymentHistoryAction');

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Constants
const ACTIVATION_EXPIRY_HOURS = 72; // 72 hours
const PASSWORD_RESET_EXPIRY_HOURS = 48; // 48 hours for password reset
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

/**
 * A complaint as its own customer may see it: where it has got to, and what they told us.
 *
 * The staff columns are deliberately left out — the field notes are the assignee's report for the
 * FP and its manager to verify, the assignee's name and the actor stamps are internal, and
 * `status` defaults to Open because rows written before schema_v51 carry none.
 *
 * The text is **decoded here**, unlike every staff list, which decodes in the browser: the customer
 * portal has no `decodeEntities` of its own, and shipping one to it to read a status line is worse
 * than decoding a display-only projection. There is no escaping hole in that — React escapes what
 * it renders — but it does mean this payload must never be fed back into a form or an email body,
 * both of which rely on the stored, escaped form.
 */
const presentCustomerComplaint = (complaint) => ({
  id: complaint.id,
  reference: complaintReference(complaint),
  status: decodeEntities(complaint.status || '') || 'Open',
  property_id: decodeEntities(complaint.property_id || ''),
  zone: decodeEntities(complaint.zone || ''),
  concern_with: decodeEntities(complaint.concern_with || ''),
  concern_with_other: decodeEntities(complaint.concern_with_other || ''),
  contact_person_name: decodeEntities(complaint.contact_person_name || ''),
  phone_number: decodeEntities(complaint.phone_number || ''),
  comments: decodeEntities(complaint.comments || ''),
  created_at: complaint.created_at,
  status_updated_at: complaint.status_updated_at,
  closed_at: complaint.closed_at
});

// Customer authentication middleware
const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const customerId = decoded.id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Customer ID not found in token' });
    }

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT id, customer_id, email, first_name, last_name, property_id, property_code, property_name, is_active
       FROM customer_accounts WHERE id = ? AND is_active = 1`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(401).json({ success: false, message: 'Customer not found or inactive' });
    }

    // Attach customer info to request
    req.customer = {
      id: customer[0].id,
      customerId: customer[0].customer_id,
      email: customer[0].email,
      firstName: customer[0].first_name,
      lastName: customer[0].last_name,
      propertyId: customer[0].property_id,
      propertyCode: customer[0].property_code,
      propertyName: customer[0].property_name
    };

    next();
  } catch (error) {
    console.error('Customer authentication error:', error);
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
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
// POST /api/customers/login - Customer login (rate limited)
// ============================================
router.post('/login', loginRateLimiter, async (req, res) => {
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

    // Generate JWT token using shared auth function
    const token = authGenerateToken({
      id: customer.id,
      username: customer.customer_id, // Use customer_id as username
      email: customer.email,
      role: 'customer', // Set role as customer
      customerId: customer.customer_id
    });

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
        // SHOW ... LIKE ? cannot bind its pattern in a prepared statement, so the existence
        // check goes through information_schema instead
        const [cols] = await pool.execute(
          `SELECT COUNT(*) AS n FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = 'customer_accounts' AND column_name = ?`,
          [col.name]
        );
        if (cols[0].n === 0) {
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
      decoded = verifyToken(token);
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
              op.zone as zone, 
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

    // One implementation of "issue a token, hash the temporary password, email the link", shared
    // with the admin portal's Customers list -- utils/customerActivation.js.
    const { emailSent } = await issueActivation(pool, customer);

    res.json({
      success: true,
      message: 'Activation email has been resent',
      data: {
        emailSent
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

/**
 * Which property a customer's records hang off.
 *
 * `customer_accounts` stores either the numeric property id or the property code (a string like
 * "GC-1781557633834"), and rows elsewhere carry whichever of the two the screen that wrote them
 * had, so both are resolved once here and every list matches on either. Only an all-digit value can
 * be an id; the code is compared against `property_id` -- that guard is why a code lookup no longer
 * asks MySQL to compare `id = 'GC-1781557633834'`.
 */
const resolveCustomerProperty = async (storedPropertyId, storedPropertyCode, storedPropertyName) => {
  let numericPropertyId = storedPropertyId; // might already be numeric
  let propertyCode = storedPropertyCode;
  let propertyName = storedPropertyName;

  const lookupId = storedPropertyId || storedPropertyCode;
  if (lookupId) {
    const numericLookup = /^\d+$/.test(String(lookupId)) ? Number(lookupId) : 0;

    // Onboarded properties first, then the legacy table the employee portals write
    const [opData] = await pool.execute(
      `SELECT id, property_id, community_name FROM onboarded_properties
       WHERE id = ? OR property_id = ?`,
      [numericLookup, String(lookupId)]
    );
    if (opData.length > 0) {
      numericPropertyId = opData[0].id;
      propertyCode = propertyCode || opData[0].property_id;
      propertyName = propertyName || opData[0].community_name;
    } else {
      const [pData] = await pool.execute(
        `SELECT id, property_id, name FROM properties
         WHERE id = ? OR property_id = ?`,
        [numericLookup, String(lookupId)]
      );
      if (pData.length > 0) {
        numericPropertyId = pData[0].id;
        propertyCode = propertyCode || pData[0].property_id;
        propertyName = propertyName || pData[0].name;
      }
    }
  }

  return { numericPropertyId, propertyCode, propertyName };
};

/**
 * The work orders that are this customer's own, as a condition for the `wo` alias.
 *
 * Property name is deliberately NOT one of them: names are not unique (several communities are
 * called "OHSS"), and matching on one leaked another household's requests.
 */
const customerWorkOrderScope = ({ numericPropertyId, propertyCode, customerId, email }) => {
  const conditions = [];
  const params = [];

  if (numericPropertyId) {
    conditions.push('wo.property_id = ?');
    params.push(numericPropertyId);
  }
  if (propertyCode && propertyCode !== numericPropertyId) {
    conditions.push('wo.property_id = ?');
    params.push(propertyCode);
  }
  if (customerId) {
    conditions.push('wo.resident_id = ?');
    params.push(customerId);
  }
  if (email) {
    conditions.push('LOWER(wo.customer_email) = LOWER(?)');
    params.push(email);
  }

  // No identifier at all must return nothing, never everything
  return { sql: conditions.length > 0 ? `(${conditions.join(' OR ')})` : '1=0', params };
};

/**
 * The invoices raised against this customer's property, as a condition for the `i` alias. Email is
 * a fallback only: an invoice carries the property, and the address on an account can change.
 */
const customerInvoiceScope = ({ numericPropertyId, propertyCode, email }) => {
  const conditions = [];
  const params = [];

  if (numericPropertyId) {
    conditions.push('i.property_id = ?');
    params.push(numericPropertyId);
  }
  if (propertyCode) {
    conditions.push('i.property_code = ?');
    params.push(propertyCode);
    // Some writers put the code in property_id, so cross-match it
    conditions.push('i.property_id = ?');
    params.push(propertyCode);
  }
  if (conditions.length === 0 && email) {
    conditions.push('LOWER(i.customer_email) = LOWER(?)');
    params.push(email);
  }

  return { sql: conditions.length > 0 ? `(${conditions.join(' OR ')})` : '1=0', params };
};

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
      decoded = verifyToken(token);
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

    const { numericPropertyId, propertyCode, propertyName } = await resolveCustomerProperty(
      customerData.property_id, customerData.property_code, customerData.property_name
    );

    console.log('[Customer Dashboard] Resolved property:', {
      storedPropertyId: customerData.property_id,
      storedPropertyCode: customerData.property_code,
      numericPropertyId, propertyCode, propertyName, custEmail, customerId
    });

    const scope = customerWorkOrderScope({ numericPropertyId, propertyCode, customerId, email: custEmail });
    const whereClause = `WHERE ${scope.sql}`;
    const whereParams = scope.params;

    // Get work orders for this customer
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
       ${whereClause}
       ORDER BY wo.created_at DESC
       LIMIT 10`,
      whereParams
    );

    console.log('[Customer Dashboard] Found work orders:', workOrders.length, 'for property:', propertyName, 'with conditions:', whereParams.length);

    // Fetch attachments for each work order
    for (const wo of workOrders) {
      const [attachments] = await pool.execute(
        `SELECT id, file_name, original_name, file_path, file_type, file_size, created_at 
         FROM work_order_attachments WHERE work_order_id = ?`,
        [wo.id]
      );
      wo.attachments = attachments;
    }

    // Get stats for this customer with detailed status breakdown
    // Use the same WHERE conditions to ensure consistency
    const [[stats]] = await pool.execute(
      `SELECT 
         COUNT(DISTINCT id) as total,
         COUNT(DISTINCT CASE WHEN status = 'pending' THEN id END) as pending,
         COUNT(DISTINCT CASE WHEN status = 'under_review' THEN id END) as under_review,
         COUNT(DISTINCT CASE WHEN status = 'assigned' THEN id END) as assigned,
         COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN id END) as in_progress,
         COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) as completed,
         COUNT(DISTINCT CASE WHEN status = 'cancelled' THEN id END) as cancelled,
         COUNT(DISTINCT CASE WHEN status = 'closed' THEN id END) as closed
       FROM work_orders wo
       ${whereClause}`,
      whereParams
    );

    const pendingCount = (stats?.pending || 0) + (stats?.under_review || 0) + (stats?.assigned || 0) + (stats?.in_progress || 0);
    const completedCount = (stats?.completed || 0) + (stats?.closed || 0);
    // The home page shows Pending and In Progress as two tiles, so it needs "raised but not
    // started" on its own -- `pending` above counts in_progress inside it, which would report the
    // same work order twice across the row. Grouped here rather than in the browser so the rule
    // has one home, like every other count this route answers.
    const awaitingStartCount = (stats?.pending || 0) + (stats?.under_review || 0) + (stats?.assigned || 0);

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
          pending: pendingCount,
          completed: completedCount,
          total: stats?.total || 0,
          // Raised but not yet being worked on, and being worked on -- the home page's own two
          // tiles. `pending` keeps its old meaning (everything unfinished) for existing callers.
          awaitingStart: awaitingStartCount,
          inProgress: stats?.in_progress || 0,
          byStatus: {
            pending: stats?.pending || 0,
            under_review: stats?.under_review || 0,
            assigned: stats?.assigned || 0,
            in_progress: stats?.in_progress || 0,
            completed: stats?.completed || 0,
            cancelled: stats?.cancelled || 0,
            closed: stats?.closed || 0
          }
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
      decoded = verifyToken(token);
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

    // Build WHERE conditions - prioritize unique identifiers, AVOID property_name as it's not unique
    // Match by: property_id (numeric), property_code (unique string), resident_id (customer account), or customer_email
    const whereConditions = [];
    const whereParams = [];
    
    if (numericPropertyId) {
      whereConditions.push('wo.property_id = ?');
      whereParams.push(numericPropertyId);
    }
    if (propertyCode && propertyCode !== numericPropertyId) {
      whereConditions.push('wo.property_id = ?');
      whereParams.push(propertyCode);
    }
    if (customerId) {
      whereConditions.push('wo.resident_id = ?');
      whereParams.push(customerId);
    }
    if (custEmail) {
      whereConditions.push('LOWER(wo.customer_email) = LOWER(?)');
      whereParams.push(custEmail);
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE (${whereConditions.join(' OR ')})` 
      : 'WHERE 1=0';

    // Get all work orders with full details
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
       ${whereClause}
       ORDER BY wo.created_at DESC`,
      whereParams
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

// ============================================
// GET CUSTOMER INVOICES - Get all invoices for logged-in customer's property
// ============================================
router.get('/invoices', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const customerId = decoded.id;

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const customerEmail = customerData.email;

    const { numericPropertyId, propertyCode } = await resolveCustomerProperty(
      customerData.property_id, customerData.property_code
    );

    const scope = customerInvoiceScope({ numericPropertyId, propertyCode, email: customerEmail });
    const whereParams = scope.params;

    // Draft invoices still sit in Generated Invoices awaiting review; the customer only ever
    // sees an invoice once it has been sent and moved into the Invoices section.
    const whereClause = `WHERE ${scope.sql} AND i.status IS NOT NULL AND LOWER(i.status) <> 'draft'`;

    console.log('[Customer Invoices] Query conditions:', { numericPropertyId, propertyCode, customerEmail, conditionsCount: whereParams.length });

    // Get all invoices for this property
    const [invoices] = await pool.execute(
      `SELECT i.*,
              COALESCE(
                (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id AND status IN ('completed', 'paid')),
                0
              ) as amount_paid
       FROM invoices i
       ${whereClause}
       ORDER BY i.created_at DESC`,
      whereParams
    );

    // Parse line items and calculate balance
    const formattedInvoices = invoices.map(inv => {
      let lineItems = [];
      try {
        lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || []);
      } catch (e) { lineItems = []; }

      const amountPaid = parseFloat(inv.amount_paid) || 0;
      const totalAmount = parseFloat(inv.total_amount) || 0;
      const balanceAmount = totalAmount - amountPaid;

      return {
        id: inv.id,
        invoiceId: inv.invoice_id,
        invoiceType: inv.invoice_type,
        estimateId: inv.source_estimate_id,
        propertyCode: inv.property_code,
        propertyName: inv.property_name,
        propertyType: inv.property_type,
        customerName: inv.customer_name,
        customerEmail: inv.customer_email,
        customerPhone: inv.customer_phone,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        billingDuration: inv.billing_duration,
        lineItems: lineItems,
        subtotal: parseFloat(inv.subtotal) || 0,
        discountAmount: parseFloat(inv.discount_amount) || 0,
        discountPercentage: parseFloat(inv.discount_percentage) || 0,
        taxAmount: parseFloat(inv.tax_amount) || 0,
        taxPercentage: parseFloat(inv.tax_percent) || 0,
        totalAmount: totalAmount,
        amountPaid: amountPaid,
        balanceAmount: balanceAmount,
        status: inv.status,
        paymentLinkId: inv.razorpay_payment_link_id,
        paymentLinkUrl: inv.razorpay_short_url,
        paymentLinkStatus: inv.payment_link_status,
        sentAt: inv.sent_at,
        paidAt: inv.paid_at,
        createdAt: inv.created_at,
        // Work order specific fields
        workOrderId: inv.work_order_id,
        workOrderCategory: inv.work_order_category,
        workOrderSubcategory: inv.work_order_subcategory,
        workOrderDescription: inv.work_order_description,
        zone: inv.zone,
        city: inv.city
      };
    });

    res.json({
      success: true,
      data: formattedInvoices
    });
  } catch (error) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({ success: false, message: 'Error fetching invoices', error: error.message });
  }
});

// ============================================
// GET SINGLE INVOICE DETAILS - Get detailed invoice for logged-in customer
// ============================================
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const customerId = decoded.id;

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const customerEmail = customerData.email;
    const storedPropertyId = customerData.property_id;
    const storedPropertyCode = customerData.property_code;

    // Resolve property to get numeric ID
    let numericPropertyId = storedPropertyId;
    let propertyCode = storedPropertyCode;

    const lookupId = storedPropertyId || storedPropertyCode;
    if (lookupId) {
      const [opData] = await pool.execute(
        `SELECT id, property_id FROM onboarded_properties WHERE id = ? OR property_id = ?`,
        [lookupId, lookupId]
      );
      if (opData.length > 0) {
        numericPropertyId = opData[0].id;
        propertyCode = propertyCode || opData[0].property_id;
      } else {
        const [pData] = await pool.execute(
          `SELECT id, property_id FROM properties WHERE id = ? OR property_id = ?`,
          [lookupId, lookupId]
        );
        if (pData.length > 0) {
          numericPropertyId = pData[0].id;
          propertyCode = propertyCode || pData[0].property_id;
        }
      }
    }

    // Get invoice
    const [invoices] = await pool.execute(
      `SELECT i.*,
              COALESCE(
                (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id AND status IN ('completed', 'paid')),
                0
              ) as amount_paid
       FROM invoices i
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const inv = invoices[0];

    // A draft invoice has not been sent yet, so to the customer it does not exist
    if (!inv.status || String(inv.status).toLowerCase() === 'draft') {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Simplified access check - allow if ANY of these match:
    // 1. Property ID matches (any form)
    // 2. Property code matches
    // 3. Customer email matches invoice email
    const invoicePropertyId = String(inv.property_id || '');
    const invoicePropertyCode = String(inv.property_code || '');
    const invoiceEmail = String(inv.customer_email || '').toLowerCase();
    const custPropertyId = String(numericPropertyId || '');
    const custPropertyCode = String(propertyCode || '');
    const custEmail = String(customerEmail || '').toLowerCase();

    const hasAccess = 
      (custPropertyId && invoicePropertyId && custPropertyId === invoicePropertyId) ||
      (custPropertyId && invoicePropertyCode && custPropertyId === invoicePropertyCode) ||
      (custPropertyCode && invoicePropertyId && custPropertyCode === invoicePropertyId) ||
      (custPropertyCode && invoicePropertyCode && custPropertyCode === invoicePropertyCode) ||
      (custEmail && invoiceEmail && custEmail === invoiceEmail);

    console.log('[Invoice Access Check]', { 
      invoiceId: id,
      custPropertyId, custPropertyCode, custEmail,
      invoicePropertyId, invoicePropertyCode, invoiceEmail,
      hasAccess
    });

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this invoice' });
    }

    // Parse line items
    let lineItems = [];
    try {
      lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || []);
    } catch (e) { lineItems = []; }

    const amountPaid = parseFloat(inv.amount_paid) || 0;
    const totalAmount = parseFloat(inv.total_amount) || 0;
    const balanceAmount = totalAmount - amountPaid;

    // Get payment history for this invoice
    const [payments] = await pool.execute(
      `SELECT id, amount, payment_method, payment_date, transaction_reference, status, remarks, created_at
       FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: inv.id,
        invoiceId: inv.invoice_id,
        invoiceType: inv.invoice_type,
        estimateId: inv.source_estimate_id,
        propertyCode: inv.property_code,
        propertyName: inv.property_name,
        propertyType: inv.property_type,
        customerName: inv.customer_name,
        customerEmail: inv.customer_email,
        customerPhone: inv.customer_phone,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        billingDuration: inv.billing_duration,
        lineItems: lineItems,
        subtotal: parseFloat(inv.subtotal) || 0,
        discountAmount: parseFloat(inv.discount_amount) || 0,
        discountPercentage: parseFloat(inv.discount_percentage) || 0,
        taxAmount: parseFloat(inv.tax_amount) || 0,
        taxPercentage: parseFloat(inv.tax_percent) || 0,
        totalAmount: totalAmount,
        amountPaid: amountPaid,
        balanceAmount: balanceAmount,
        status: inv.status,
        notes: inv.notes,
        paymentLinkId: inv.razorpay_payment_link_id,
        paymentLinkUrl: inv.razorpay_short_url,
        paymentLinkStatus: inv.payment_link_status,
        sentAt: inv.sent_at,
        paidAt: inv.paid_at,
        createdAt: inv.created_at,
        // Work order specific fields
        workOrderId: inv.work_order_id,
        workOrderCategory: inv.work_order_category,
        workOrderSubcategory: inv.work_order_subcategory,
        workOrderDescription: inv.work_order_description,
        zone: inv.zone,
        city: inv.city,
        // Payment history — 'completed' and 'paid' are the same settled state, shown as 'paid'
        payments: payments.map(p => ({ ...p, status: p.status === 'completed' ? 'paid' : p.status }))
      }
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ success: false, message: 'Error fetching invoice details', error: error.message });
  }
});

// ============================================
// INITIATE PAYMENT - Create or get Razorpay payment link for an invoice
// ============================================
router.post('/invoices/:id/initiate-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const customerId = decoded.id;

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const customerEmail = customerData.email;
    const storedPropertyCode = customerData.property_code;

    // Get invoice
    const [invoices] = await pool.execute(
      `SELECT i.*,
              COALESCE(
                (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id AND status IN ('completed', 'paid')),
                0
              ) as amount_paid
       FROM invoices i
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const inv = invoices[0];

    // A draft invoice has not been sent yet, so to the customer it does not exist
    if (!inv.status || String(inv.status).toLowerCase() === 'draft') {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Verify the invoice belongs to this customer
    const invoicePropertyCode = inv.property_code;
    const invoiceCustomerEmail = inv.customer_email?.toLowerCase();
    const custPropertyCode = storedPropertyCode;
    const custEmail = customerEmail?.toLowerCase();

    const hasAccess = (invoicePropertyCode && custPropertyCode && invoicePropertyCode === custPropertyCode) ||
                      (invoiceCustomerEmail && custEmail && invoiceCustomerEmail === custEmail);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this invoice' });
    }

    // Calculate balance
    const amountPaid = parseFloat(inv.amount_paid) || 0;
    const totalAmount = parseFloat(inv.total_amount) || 0;
    const balanceAmount = totalAmount - amountPaid;

    if (balanceAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice is already fully paid' });
    }

    // Check if there's an existing valid payment link. The columns are the ones schema_v18
    // created: payment_link_url / payment_link_id were never columns at all, so this check
    // always missed and a fresh Razorpay link was created on every request.
    if (inv.razorpay_short_url && inv.payment_link_status !== 'expired' && inv.payment_link_status !== 'cancelled') {
      return res.json({
        success: true,
        message: 'Existing payment link found',
        data: {
          paymentLinkUrl: inv.razorpay_short_url,
          paymentLinkId: inv.razorpay_payment_link_id,
          amount: balanceAmount,
          invoiceId: inv.invoice_id
        }
      });
    }

    // Create new Razorpay payment link
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const paymentLinkOptions = {
      amount: Math.round(balanceAmount * 100), // Razorpay expects amount in paise
      currency: 'INR',
      accept_partial: false,
      description: `Payment for Invoice ${inv.invoice_id}`,
      customer: {
        name: inv.customer_name || customerData.first_name + ' ' + customerData.last_name,
        email: inv.customer_email || customerEmail,
        contact: inv.customer_phone || customerData.phone || ''
      },
      notify: {
        sms: true,
        email: true
      },
      reminder_enable: true,
      // internal_invoice_id is what the payment_link.paid and payment.captured webhooks
      // resolve the invoice from; the key this used to carry was read by nothing
      notes: {
        invoice_id: inv.invoice_id,
        internal_invoice_id: inv.id.toString(),
        property_code: inv.property_code || '',
        customer_id: customerId.toString()
      },
      callback_url: `${FRONTEND_URL}/payment/success?invoice_id=${inv.invoice_id}`,
      callback_method: 'get'
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);

    // Update invoice with payment link details. This wrote payment_link_id / payment_link_url,
    // which no schema file creates, so it raised "Unknown column 'payment_link_id' in 'field
    // list'" -- after the link had already been created at Razorpay, leaving it unrecorded.
    await pool.execute(
      `UPDATE invoices 
       SET razorpay_payment_link_id = ?, razorpay_short_url = ?, payment_link = ?,
           payment_link_created_at = NOW(), payment_link_status = 'created', updated_at = NOW()
       WHERE id = ?`,
      [paymentLink.id, paymentLink.short_url, paymentLink.short_url, id]
    );

    res.json({
      success: true,
      message: 'Payment link created successfully',
      data: {
        paymentLinkUrl: paymentLink.short_url,
        paymentLinkId: paymentLink.id,
        amount: balanceAmount,
        invoiceId: inv.invoice_id
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ success: false, message: 'Error initiating payment', error: error.message });
  }
});

// ============================================
// CREATE RAZORPAY ORDER - For Checkout SDK integration
// ============================================
router.post('/invoices/:id/create-order', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const customerId = decoded.id;

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const customerEmail = customerData.email;
    const storedPropertyId = customerData.property_id;
    const storedPropertyCode = customerData.property_code;

    // Resolve property to get numeric ID
    let numericPropertyId = storedPropertyId;
    let propertyCode = storedPropertyCode;

    const lookupId = storedPropertyId || storedPropertyCode;
    if (lookupId) {
      const [opData] = await pool.execute(
        `SELECT id, property_id FROM onboarded_properties WHERE id = ? OR property_id = ?`,
        [lookupId, lookupId]
      );
      if (opData.length > 0) {
        numericPropertyId = opData[0].id;
        propertyCode = propertyCode || opData[0].property_id;
      } else {
        const [pData] = await pool.execute(
          `SELECT id, property_id FROM properties WHERE id = ? OR property_id = ?`,
          [lookupId, lookupId]
        );
        if (pData.length > 0) {
          numericPropertyId = pData[0].id;
          propertyCode = propertyCode || pData[0].property_id;
        }
      }
    }

    // Get invoice
    const [invoices] = await pool.execute(
      `SELECT i.*,
              COALESCE(
                (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id AND status IN ('completed', 'paid')),
                0
              ) as amount_paid
       FROM invoices i
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const inv = invoices[0];

    // A draft invoice has not been sent yet, so to the customer it does not exist
    if (!inv.status || String(inv.status).toLowerCase() === 'draft') {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Simplified access check
    const invoicePropertyId = String(inv.property_id || '');
    const invoicePropertyCode = String(inv.property_code || '');
    const invoiceEmail = String(inv.customer_email || '').toLowerCase();
    const custPropertyId = String(numericPropertyId || '');
    const custPropertyCode = String(propertyCode || '');
    const custEmail = String(customerEmail || '').toLowerCase();

    const hasAccess = 
      (custPropertyId && invoicePropertyId && custPropertyId === invoicePropertyId) ||
      (custPropertyId && invoicePropertyCode && custPropertyId === invoicePropertyCode) ||
      (custPropertyCode && invoicePropertyId && custPropertyCode === invoicePropertyId) ||
      (custPropertyCode && invoicePropertyCode && custPropertyCode === invoicePropertyCode) ||
      (custEmail && invoiceEmail && custEmail === invoiceEmail);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this invoice' });
    }

    // Calculate balance
    const amountPaid = parseFloat(inv.amount_paid) || 0;
    const totalAmount = parseFloat(inv.total_amount) || 0;
    const balanceAmount = totalAmount - amountPaid;

    if (balanceAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice is already fully paid' });
    }

    // The customer may pay the whole balance or half of it — the server owns the arithmetic;
    // the request only names the share, never an amount.
    const charge = resolvePaymentPortion(req.body.portion || 'full', balanceAmount);
    if (charge.error) {
      return res.status(400).json({ success: false, message: charge.error });
    }

    // Create Razorpay Order
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const orderOptions = {
      amount: Math.round(charge.amount * 100), // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `inv_${inv.invoice_id}_${Date.now()}`,
      // internal_invoice_id is the key every consumer reads -- handlePaymentCaptured and
      // resolveInvoiceIdForPayment both look it up and give up without it. This said
      // invoice_db_id, which nothing reads, so when the browser never reached
      // /verify-payment (tab closed, network dropped) the payment.captured webhook logged
      // "no internal invoice ID" and the payment was lost.
      notes: {
        invoice_id: inv.invoice_id,
        internal_invoice_id: inv.id.toString(),
        property_code: inv.property_code || '',
        customer_id: customerId.toString()
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    res.json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.id,
        amount: charge.amount,
        amountInPaise: order.amount,
        currency: order.currency,
        invoiceId: inv.invoice_id,
        invoiceDbId: inv.id,
        customerName: inv.customer_name || customerData.first_name + ' ' + customerData.last_name,
        customerEmail: inv.customer_email || customerEmail,
        customerPhone: inv.customer_phone || customerData.phone || '',
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        // Present only on a part payment: the remainder and when it falls due
        plan: charge.plan
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Error creating order', error: error.message });
  }
});

// ============================================
// VERIFY RAZORPAY PAYMENT - Verify payment signature and update invoice
// ============================================
router.post('/invoices/:id/verify-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Verify signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Get invoice details
    const [invoices] = await pool.execute(
      `SELECT i.*,
              COALESCE(
                (SELECT SUM(amount) FROM payments WHERE invoice_id = i.id AND status IN ('completed', 'paid')),
                0
              ) as amount_paid
       FROM invoices i
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const inv = invoices[0];
    const amountPaid = parseFloat(inv.amount_paid) || 0;
    const totalAmount = parseFloat(inv.total_amount) || 0;

    // Record what Razorpay actually captured — with a part payment this is less than the
    // balance, and writing the balance here would mark a half-paid invoice fully paid.
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    const rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    const paidAmount = round2(((rzpPayment.amount || 0) / 100));
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Could not confirm the paid amount' });
    }

    // Record through the shared Razorpay writer so the row is identical to the one the
    // webhook creates: FP scope, PAY-/RCP- ids, payment_status on the invoice, a
    // payment_history row, and the work order / scheduling follow-through. The hand
    // written insert it replaces left every one of those unset, so a portal payment
    // showed "Pending" in the Payments screens and nothing in Payment History.
    const recordResult = await recordRazorpayPayment({
      invoiceId: inv.id,
      amountPaid: paidAmount,
      paymentEntity: rzpPayment,
      paymentLinkId: inv.razorpay_payment_link_id || null,
      source: 'customer-portal'
    });

    const [[updatedInvoice]] = await pool.execute(
      'SELECT status, balance_amount FROM invoices WHERE id = ?',
      [inv.id]
    );

    res.json({
      success: true,
      message: 'Payment verified and recorded successfully',
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: paidAmount,
        invoiceId: inv.invoice_id,
        invoiceStatus: updatedInvoice?.status || (recordResult.alreadyRecorded ? 'paid' : 'partially_paid')
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Error verifying payment', error: error.message });
  }
});

// ============================================
// RECORD OFFLINE PAYMENT INTENT - For Cash, Cheque, Bank Transfer
// ============================================
router.post('/invoices/:id/offline-payment-intent', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const customerId = decoded.id;

    // Get customer details
    const [customer] = await pool.execute(
      `SELECT * FROM customer_accounts WHERE id = ?`,
      [customerId]
    );

    if (customer.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customerData = customer[0];
    const storedPropertyId = customerData.property_id;
    const storedPropertyCode = customerData.property_code;

    // Resolve property to get numeric ID
    let numericPropertyId = storedPropertyId;
    let propertyCode = storedPropertyCode;

    const lookupId = storedPropertyId || storedPropertyCode;
    if (lookupId) {
      const [opData] = await pool.execute(
        `SELECT id, property_id FROM onboarded_properties WHERE id = ? OR property_id = ?`,
        [lookupId, lookupId]
      );
      if (opData.length > 0) {
        numericPropertyId = opData[0].id;
        propertyCode = propertyCode || opData[0].property_id;
      } else {
        const [pData] = await pool.execute(
          `SELECT id, property_id FROM properties WHERE id = ? OR property_id = ?`,
          [lookupId, lookupId]
        );
        if (pData.length > 0) {
          numericPropertyId = pData[0].id;
          propertyCode = propertyCode || pData[0].property_id;
        }
      }
    }

    // Get invoice
    const [invoices] = await pool.execute(
      `SELECT * FROM invoices WHERE id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const inv = invoices[0];

    // A draft invoice has not been sent yet, so to the customer it does not exist
    if (!inv.status || String(inv.status).toLowerCase() === 'draft') {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Simplified access check
    const invoicePropertyId = String(inv.property_id || '');
    const invoicePropertyCode = String(inv.property_code || '');
    const invoiceEmail = String(inv.customer_email || '').toLowerCase();
    const custPropertyId = String(numericPropertyId || '');
    const custPropertyCode = String(propertyCode || '');
    const custEmail = String(customerData.email || '').toLowerCase();

    const hasAccess =
      (custPropertyId && invoicePropertyId && custPropertyId === invoicePropertyId) ||
      (custPropertyId && invoicePropertyCode && custPropertyId === invoicePropertyCode) ||
      (custPropertyCode && invoicePropertyId && custPropertyCode === invoicePropertyId) ||
      (custPropertyCode && invoicePropertyCode && custPropertyCode === invoicePropertyCode) ||
      (custEmail && invoiceEmail && custEmail === invoiceEmail);

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this invoice' });
    }

    // The request names a share ('full' or 'half'), never an amount — the posted `amount` is
    // not trusted; the server derives the figure from the invoice's own balance.
    const balanceAmount = parseFloat(inv.balance_amount) ||
      (parseFloat(inv.total_amount) || 0) - (parseFloat(inv.amount_paid) || 0);
    if (balanceAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invoice is already fully paid' });
    }
    const charge = resolvePaymentPortion(req.body.portion || 'full', balanceAmount);
    if (charge.error) {
      return res.status(400).json({ success: false, message: charge.error });
    }

    // 'check'/'bank' are UI spellings of the ENUM members
    let normalizedMethod = String(paymentMethod || '').toLowerCase();
    if (normalizedMethod === 'check') normalizedMethod = 'cheque';
    if (normalizedMethod === 'bank') normalizedMethod = 'bank_transfer';
    if (!['cash', 'cheque', 'bank_transfer'].includes(normalizedMethod)) {
      return res.status(400).json({ success: false, message: 'Unsupported offline payment method' });
    }

    // A pending intent already covers this invoice -- return it rather than stack another
    // row staff could also verify (two verified intents would over-pay the invoice).
    const [existingIntents] = await pool.execute(
      `SELECT id, transaction_id, amount, payment_method FROM payments
       WHERE invoice_id = ? AND status = 'verification_pending' ORDER BY id DESC LIMIT 1`,
      [inv.id]
    );
    if (existingIntents.length > 0) {
      const existing = existingIntents[0];
      return res.json({
        success: true,
        message: 'A payment for this invoice is already awaiting verification',
        data: {
          referenceId: existing.transaction_id,
          paymentId: existing.id,
          amount: parseFloat(existing.amount),
          invoiceId: inv.invoice_id,
          paymentMethod: existing.payment_method,
          plan: charge.plan,
          alreadyPending: true
        }
      });
    }

    // Generate reference ID
    const referenceId = `OFF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Record the payment intent as verification_pending (for Cash, Cheque, Bank Transfer).
    // franchise_partner_id, customer and the PAY- id are what the staff Payments screens
    // scope and list on -- the bare insert used to leave them NULL, which hid the intent
    // from the FP portal that is meant to verify it.
    await ensurePaymentColumns();
    const fpId = inv.franchise_partner_id || null;
    const customerName = [customerData.first_name, customerData.last_name].filter(Boolean).join(' ') || 'Customer';
    const paymentCode = await generatePaymentId(fpId);
    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        payment_id, invoice_id, invoice_number, property_id, property_code,
        estimate_id, customer_id, customer_name, customer_email, franchise_partner_id,
        amount, payment_method, payment_type, payment_date,
        transaction_id, transaction_reference, status,
        received_by_name, received_by_role, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NOW(), ?, ?, 'verification_pending', ?, 'customer', ?, NOW())`,
      [paymentCode, inv.id, inv.invoice_id || null, inv.property_id, inv.property_code || null,
       inv.estimate_id || null, inv.customer_id || customerId, inv.customer_name || customerName,
       inv.customer_email || customerData.email || null, fpId,
       charge.amount, normalizedMethod, referenceId, referenceId,
       customerName,
       `Offline payment intent from Customer Portal - Awaiting verification.${halfPaymentNote(charge.plan)}`]
    );

    // Same audit row the staff record route writes, so the intent is visible in Payment
    // History from the moment it is created.
    await pool.execute(
      `INSERT INTO payment_history (invoice_id, payment_id, action, new_status, amount, description, performed_by_name, performed_by_role)
       VALUES (?, ?, ?, 'verification_pending', ?, ?, ?, 'customer')`,
      [inv.id, paymentResult.insertId, await paymentHistoryAction('created'), charge.amount,
       `Offline payment intent recorded via Customer Portal (${normalizedMethod}) - Ref: ${referenceId}`,
       customerName]
    );

    res.json({
      success: true,
      message: 'Payment intent recorded successfully',
      data: {
        referenceId: referenceId,
        paymentId: paymentResult.insertId,
        amount: charge.amount,
        invoiceId: inv.invoice_id,
        paymentMethod: normalizedMethod,
        plan: charge.plan
      }
    });
  } catch (error) {
    console.error('Error recording offline payment intent:', error);
    res.status(500).json({ success: false, message: 'Error recording payment intent', error: error.message });
  }
});

// ============================================
// CUSTOMER NOTIFICATIONS
// ============================================

// Get notifications for customer
router.get('/notifications', authenticateCustomer, async (req, res) => {
  try {
    const customerId = req.customer.id;
    const propertyId = req.customer.propertyId;
    const { limit = 20, unreadOnly = false } = req.query;
    const mine = customerNotificationScope(req.customer);

    // Get notifications for this customer's property
    // Also include notifications targeted at 'customer' role for this franchise partner
    const [notifications] = await pool.execute(`
      SELECT 
        pn.id,
        pn.notification_id,
        pn.type,
        pn.title,
        pn.message,
        pn.reference_type,
        pn.reference_id,
        pn.action_url,
        pn.is_read,
        pn.read_at,
        pn.priority,
        pn.created_at
      FROM portal_notifications pn
      WHERE ${mine.sql}
      ${unreadOnly === 'true' ? 'AND pn.is_read = FALSE' : ''}
      ORDER BY pn.created_at DESC
      LIMIT ${Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)}
    `, mine.params);

    // Get unread count
    const [[{ unreadCount }]] = await pool.execute(`
      SELECT COUNT(*) as unreadCount
      FROM portal_notifications pn
      WHERE ${mine.sql}
      AND pn.is_read = FALSE
    `, mine.params);

    res.json({
      success: true,
      data: {
        notifications: notifications.map(n => ({
          id: n.id,
          notificationId: n.notification_id,
          type: n.type,
          title: n.title,
          message: n.message,
          referenceType: n.reference_type,
          referenceId: n.reference_id,
          actionUrl: n.action_url,
          isRead: !!n.is_read,
          readAt: n.read_at,
          priority: n.priority,
          createdAt: n.created_at
        })),
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching customer notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: error.message });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const mine = customerNotificationScope(req.customer);

    // Verify the notification is this customer's -- the same rule the list itself applies, or a row
    // they can see would be one they cannot dismiss
    const [notification] = await pool.execute(`
      SELECT pn.id FROM portal_notifications pn
      WHERE pn.id = ? AND ${mine.sql}
    `, [id, ...mine.params]);

    if (notification.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await pool.execute(
      `UPDATE portal_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Error updating notification', error: error.message });
  }
});

// Mark all notifications as read
router.put('/notifications/mark-all-read', authenticateCustomer, async (req, res) => {
  try {
    const mine = customerNotificationScope(req.customer);

    // Mark this customer's own notifications as read -- the same rule the list applies
    await pool.execute(`
      UPDATE portal_notifications pn
      SET pn.is_read = TRUE, pn.read_at = NOW()
      WHERE pn.is_read = FALSE AND ${mine.sql}
    `, mine.params);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Error updating notifications', error: error.message });
  }
});

// ============================================
// CUSTOMER RENEWALS
// ============================================

const { approveRenewal, declineRenewal } = require('../services/autoRenewalService');

// Get pending renewals for customer's property
router.get('/renewals', authenticateCustomer, async (req, res) => {
  try {
    const propertyId = req.customer.propertyId;
    const { status } = req.query;

    let statusFilter = '';
    if (status) {
      statusFilter = `AND sr.status = '${status}'`;
    }

    const [renewals] = await pool.execute(`
      SELECT 
        sr.*,
        ss.series_id as original_series_code,
        ss.contract_end_date as original_end_date,
        ss.completed_visits,
        ss.total_visits as original_total_visits,
        ov.company_name as vendor_company,
        ov.owner_name as vendor_contact,
        DATEDIFF(ss.contract_end_date, CURDATE()) as days_until_expiry
      FROM schedule_renewals sr
      JOIN schedule_series ss ON sr.original_series_id = ss.id
      LEFT JOIN onboarded_vendors ov ON sr.vendor_id = ov.id
      WHERE sr.property_id = ? ${statusFilter}
      ORDER BY sr.created_at DESC
      LIMIT 20
    `, [propertyId]);

    res.json({
      success: true,
      data: renewals.map(r => ({
        id: r.id,
        renewalId: r.renewal_id,
        serviceName: r.service_name,
        serviceCategory: r.service_category,
        vendorName: r.vendor_name,
        vendorCompany: r.vendor_company,
        frequency: r.frequency,
        totalVisits: r.total_visits,
        renewalStartDate: r.renewal_start_date,
        renewalEndDate: r.renewal_end_date,
        status: r.status,
        triggerType: r.trigger_type,
        customerResponse: r.customer_response,
        daysUntilExpiry: r.days_until_expiry,
        originalEndDate: r.original_end_date,
        completedVisits: r.completed_visits,
        originalTotalVisits: r.original_total_visits,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching customer renewals:', error);
    res.status(500).json({ success: false, message: 'Error fetching renewals', error: error.message });
  }
});

// Approve renewal (Customer)
router.post('/renewals/:id/approve', authenticateCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const propertyId = req.customer.propertyId;

    // Verify renewal belongs to this customer's property
    const [renewal] = await pool.execute(
      `SELECT id FROM schedule_renewals WHERE (id = ? OR renewal_id = ?) AND property_id = ?`,
      [id, id, propertyId]
    );

    if (renewal.length === 0) {
      return res.status(404).json({ success: false, message: 'Renewal not found' });
    }

    const result = await approveRenewal(renewal[0].id, req.customer.id, 'customer');

    res.json({
      success: true,
      message: 'Renewal approved successfully! Your service will continue seamlessly.',
      data: result
    });
  } catch (error) {
    console.error('Error approving renewal:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error approving renewal'
    });
  }
});

// Decline renewal (Customer)
router.post('/renewals/:id/decline', authenticateCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const propertyId = req.customer.propertyId;

    // Verify renewal belongs to this customer's property
    const [renewal] = await pool.execute(
      `SELECT id FROM schedule_renewals WHERE (id = ? OR renewal_id = ?) AND property_id = ?`,
      [id, id, propertyId]
    );

    if (renewal.length === 0) {
      return res.status(404).json({ success: false, message: 'Renewal not found' });
    }

    const result = await declineRenewal(renewal[0].id, req.customer.id, reason || 'Customer declined', 'customer');

    res.json({
      success: true,
      message: 'Renewal declined. Your current service will end as scheduled.',
      data: result
    });
  } catch (error) {
    console.error('Error declining renewal:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error declining renewal'
    });
  }
});

// ============================================
// CUSTOMER SCHEDULES (read-only)
// ============================================

const { emptyScheduleStats, fetchScheduleStats } = require('../utils/scheduleStats');

const MAX_CUSTOMER_VISITS = 1000;

/**
 * scheduled_visits.property_id is always onboarded_properties.id, while
 * customer_accounts stores either that id or the property code, so resolve it the
 * same way /dashboard does before any schedule is queried. Returns null when the
 * property is not onboarded - such a customer simply has no visits yet.
 */
const resolveOnboardedPropertyId = async (customer) => {
  for (const lookup of [customer.propertyId, customer.propertyCode].filter(Boolean)) {
    // Only an all-digit value can be an id; the code goes to property_id
    const numericId = /^\d+$/.test(String(lookup)) ? Number(lookup) : 0;
    const [[property]] = await pool.execute(
      `SELECT id FROM onboarded_properties WHERE id = ? OR property_id = ? LIMIT 1`,
      [numericId, String(lookup)]
    );
    if (property) return property.id;
  }
  return null;
};

// Get the scheduled visits for the logged-in customer's property.
// Customers never schedule, reschedule or cancel from the portal - the employee
// portals own those actions - so this is the only schedule route they have.
router.get('/schedules', authenticateCustomer, async (req, res) => {
  try {
    const propertyId = await resolveOnboardedPropertyId(req.customer);

    if (!propertyId) {
      return res.json({ success: true, data: { visits: [], stats: emptyScheduleStats() } });
    }

    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Math.min(requestedLimit > 0 ? requestedLimit : 500, MAX_CUSTOMER_VISITS);

    // Dates and times are formatted in SQL so the portal receives the stored IST
    // day, not a UTC timestamp that shifts the visit to the previous date.
    // The vendor comes from the service schedule, with the visit as fallback,
    // matching how the employee portals resolve it.
    const [visits] = await pool.execute(
      `SELECT
         sv.id,
         sv.visit_id,
         sv.visit_number,
         sv.total_visits,
         DATE_FORMAT(sv.scheduled_date, '%Y-%m-%d') as scheduled_date,
         TIME_FORMAT(sv.scheduled_time_start, '%H:%i') as scheduled_time_start,
         TIME_FORMAT(sv.scheduled_time_end, '%H:%i') as scheduled_time_end,
         sv.status,
         DATE_FORMAT(sv.original_date, '%Y-%m-%d') as original_date,
         pss.service_name,
         COALESCE(ov.company_name, ov.owner_name) as vendor_name
       FROM scheduled_visits sv
       JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
       LEFT JOIN onboarded_vendors ov ON ov.id = COALESCE(pss.vendor_id, sv.vendor_id)
       WHERE sv.property_id = ?
       ORDER BY sv.scheduled_date DESC, sv.scheduled_time_start ASC
       LIMIT ${limit}`,
      [propertyId]
    );

    // Same counts the employee portals show, scoped to this one property
    const stats = await fetchScheduleStats({
      whereClause: 'WHERE sv.property_id = ?',
      params: [propertyId],
      label: 'Customer Schedules'
    });

    res.json({
      success: true,
      data: {
        visits: visits.map(v => ({
          id: v.id,
          visitId: v.visit_id,
          serviceName: v.service_name,
          vendorName: v.vendor_name,
          scheduledDate: v.scheduled_date,
          scheduledTimeStart: v.scheduled_time_start,
          scheduledTimeEnd: v.scheduled_time_end,
          status: v.status,
          visitNumber: v.visit_number,
          totalVisits: v.total_visits,
          originalDate: v.original_date
        })),
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching customer schedules:', error);
    res.status(500).json({ success: false, message: 'Error fetching schedules', error: error.message });
  }
});

// ============================================
// GET /api/customers/activity - the home page's Recent Activity and Upcoming Schedules
// ============================================
// Three tables with three shapes answer one question -- "what has happened on my property?" -- so
// they are read here and merged by `utils/customerActivity.js`, which also owns the one rule that
// separates the two panels: a visit is activity once it is over, and upcoming until then. Both
// panels come back from a single request because they are one screen; splitting them would have the
// home page fetch the same visits twice.
router.get('/activity', authenticateCustomer, async (req, res) => {
  try {
    // LIMIT cannot be bound in a prepared statement, so it is clamped and inlined. The ceiling is
    // 100 because the home page's "View All" shows the whole history in place -- there is no
    // activity page to page through -- and at 25 it was cutting a long-standing property's history
    // off without saying so.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 100);
    const customer = req.customer;

    const property = await resolveCustomerProperty(customer.propertyId, customer.propertyCode, customer.propertyName);
    const workOrderScope = customerWorkOrderScope({ ...property, customerId: customer.id, email: customer.email });
    const invoiceScope = customerInvoiceScope({ ...property, email: customer.email });

    // Each stream is dated by its own best column, which is not always the one it can be ordered by
    // in SQL, so a little more is read than is shown and the merge decides.
    const streamLimit = limit * 3;

    const [workOrders] = await pool.execute(
      `SELECT DISTINCT wo.id, wo.work_order_id, wo.category_name, wo.description, wo.status,
              wo.created_at, wo.updated_at, wo.completed_at
       FROM work_orders wo
       WHERE ${workOrderScope.sql}
       ORDER BY COALESCE(wo.completed_at, wo.updated_at, wo.created_at) DESC
       LIMIT ${streamLimit}`,
      workOrderScope.params
    );

    // `i.*`, never a column list: `paid_at` is created by schema_v53 and is missing from older
    // deployments, so naming it would fail the whole statement and empty the feed. The merge reads
    // it if it is there and dates the invoice by `sent_at` if it is not -- which is also why the
    // ordering here stays off it.
    const [invoices] = await pool.execute(
      `SELECT i.* FROM invoices i
       WHERE ${invoiceScope.sql} AND i.status IS NOT NULL AND LOWER(i.status) <> 'draft'
       ORDER BY COALESCE(i.sent_at, i.created_at) DESC
       LIMIT ${streamLimit}`,
      invoiceScope.params
    );

    // Visits are narrowed to those nearest today in *either* direction. Ordering one way and taking
    // the first n would hand back either the oldest history or the farthest-future visit and miss
    // the next appointment entirely -- which is the one thing this panel exists to show.
    const onboardedPropertyId = await resolveOnboardedPropertyId(customer);
    const visitWindow = (limit + 5) * 2;
    const [visits] = onboardedPropertyId
      ? await pool.execute(
        `SELECT sv.id, sv.visit_id, sv.status,
                DATE_FORMAT(sv.scheduled_date, '%Y-%m-%d') as scheduled_date,
                TIME_FORMAT(sv.scheduled_time_start, '%H:%i') as scheduled_time_start,
                TIME_FORMAT(sv.scheduled_time_end, '%H:%i') as scheduled_time_end,
                pss.service_name
         FROM scheduled_visits sv
         JOIN property_service_schedules pss ON pss.id = sv.service_schedule_id
         WHERE sv.property_id = ?
         ORDER BY ABS(DATEDIFF(sv.scheduled_date, CURDATE())) ASC
         LIMIT ${visitWindow}`,
        [onboardedPropertyId]
      )
      : [[]];

    // What the home page's Payments panel states. Counted over *every* invoice in scope, not the
    // recent slice read above -- an outstanding total that only added up the latest few would
    // under-report what the customer owes, which is worse than showing nothing. Settled invoices
    // carry no balance, so the sum is the outstanding amount by definition.
    const [[owed]] = await pool.execute(
      `SELECT
         COUNT(*) AS pendingCount,
         COALESCE(SUM(COALESCE(i.balance_amount, i.total_amount)), 0) AS outstanding
       FROM invoices i
       WHERE ${invoiceScope.sql}
         AND i.status IS NOT NULL AND LOWER(i.status) <> 'draft'
         AND COALESCE(i.balance_amount, i.total_amount) > 0`,
      invoiceScope.params
    );

    res.json({
      success: true,
      data: {
        activity: buildCustomerActivity({ workOrders, invoices, visits }, { limit }),
        upcomingVisits: buildUpcomingVisits(visits, { limit: 4 }),
        payments: {
          outstanding: parseFloat(owed?.outstanding) || 0,
          pendingCount: Number(owed?.pendingCount) || 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching customer activity:', error);
    res.status(500).json({ success: false, message: 'Error fetching activity', error: error.message });
  }
});

// ============================================
// POST /api/customers/complaints - File a complaint from the Contact page
// ============================================
// The customer picks only the concern and writes the comments; every other column of the
// FP complaint row is derived from their account: the property supplies Property ID, zone and the
// owning franchise partner, the profile supplies contact name and phone, and the responsible
// person is the FP's owner/contact. Server-derived text is escaped with the same sanitizeString
// the request middleware applies, so stored text stays consistent with FP-entered complaints.
router.post('/complaints', authenticateCustomer, async (req, res) => {
  try {
    await ensureMarketingComplaintsTable();
    const { errors, complaint } = parseCustomerComplaintBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    const [accounts] = await pool.execute(
      `SELECT ca.first_name, ca.last_name, ca.phone, ca.property_code,
              op.property_id AS op_code, op.zone AS op_zone, op.franchise_partner_id AS op_fp,
              -- properties keeps this as division_id, a VARCHAR holding the name, the same way
              -- zone_id holds a zone name; only onboarded_properties has a division column.
              -- Naming p.division failed the whole statement, so the catch below answered
              -- "Failed to submit complaint" for every customer.
              p.property_id AS p_code, p.division_id AS p_division, p.franchise_partner_id AS p_fp,
              COALESCE(z.name, zn.name, p.zone_id) AS p_zone
       FROM customer_accounts ca
       LEFT JOIN onboarded_properties op ON ca.property_id = op.id
       LEFT JOIN properties p ON ca.property_id = p.id
       LEFT JOIN zones z ON CAST(p.zone_id AS UNSIGNED) = z.id
       LEFT JOIN zones zn ON p.zone_id = zn.name
       WHERE ca.id = ? AND ca.is_active = 1`,
      [req.customer.id]
    );
    const account = accounts[0];
    if (!account) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    const fpId = account.op_fp || account.p_fp;
    const propertyCode = account.op_code || account.p_code || account.property_code;
    const zone = account.op_zone || account.p_zone || account.p_division;
    if (!fpId || !propertyCode || !zone) {
      return res.status(400).json({
        success: false,
        message: 'Your property is not linked to a service partner yet, so complaints cannot be filed. Please call or email us instead.'
      });
    }

    // This named contact_person directly, which does not exist on every deployment of
    // franchise_partners: the statement threw, the catch below answered "Failed to submit
    // complaint", and no customer complaint was ever stored. utils/franchisePartnerName.js reads
    // only the columns the database has, and never throws.
    const responsible = await fetchPartnerName(pool, fpId);

    const contactName = `${account.first_name || ''} ${account.last_name || ''}`.trim() || req.customer.email;
    const phoneDigits = (account.phone || '').replace(/\D/g, '');
    const phone = phoneDigits.length > 10 ? phoneDigits.slice(-10) : phoneDigits;
    if (phone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Your profile has no 10-digit phone number. Please call or email us instead.'
      });
    }

    // Stamped with who filed it, which is what every later update is addressed by: the status
    // emails, and the in-portal notification that must reach this customer and no other.
    const [result] = await pool.execute(
      `INSERT INTO ${COMPLAINT_TABLE}
         (franchise_partner_id, property_id, zone, responsible_person,
          concern_with, concern_with_other, contact_person_name, phone_number, comments,
          customer_account_id, customer_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fpId, sanitizeString(propertyCode), sanitizeString(zone), sanitizeString(responsible),
        complaint.concern_with, complaint.concern_with_other,
        sanitizeString(contactName), sanitizeString(phone), complaint.comments,
        req.customer.id, req.customer.email
      ]
    );
    const [rows] = await pool.execute(
      `SELECT ${COMPLAINT_SELECT} FROM ${COMPLAINT_TABLE} WHERE id = ?`,
      [result.insertId]
    );
    // The acknowledgement, sent after the row is safely stored and never awaited into the response:
    // a complaint that was saved must not answer 500 because a mail server was slow.
    notifyCustomerComplaintStatus(rows[0], { status: 'Open' });
    res.json({ success: true, message: 'Complaint submitted', data: presentCustomerComplaint(rows[0]) });
  } catch (error) {
    console.error('Customer complaint create error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit complaint', error: error.message });
  }
});

// ============================================
// GET /api/customers/complaints - the customer's own complaints, newest first
// ============================================
// Scoped to the account that filed them, not to the property: several residents can share a
// property code, and a complaint is personal to whoever raised it. Archived rows are returned too —
// closing a complaint archives it, so filtering them out would hide exactly the outcome the
// customer is waiting for.
router.get('/complaints', authenticateCustomer, async (req, res) => {
  try {
    await ensureMarketingComplaintsTable();
    const [rows] = await pool.execute(
      `SELECT ${COMPLAINT_SELECT} FROM ${COMPLAINT_TABLE}
       WHERE customer_account_id = ?
       ORDER BY created_at DESC`,
      [req.customer.id]
    );
    res.json({ success: true, data: rows.map(presentCustomerComplaint) });
  } catch (error) {
    console.error('Customer complaints fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints', error: error.message });
  }
});

module.exports = router;
