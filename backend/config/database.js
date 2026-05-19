const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'customer_portal',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isDbConnected = false;

// Initialize pool with error handling
const initPool = () => {
  try {
    pool = mysql.createPool(dbConfig);
    return pool;
  } catch (error) {
    console.error('❌ Failed to create database pool:', error.message);
    return null;
  }
};

// Initialize on load
initPool();

// Ensure database exists and create it if not
const ensureDatabase = async () => {
  try {
    // Connect without specifying database first
    const tempConn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });
    
    // Create database if not exists
    await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await tempConn.end();
    
    // Recreate pool with database
    pool = mysql.createPool(dbConfig);
    console.log('✅ Database ensured:', dbConfig.database);
    return true;
  } catch (error) {
    console.error('❌ Failed to ensure database:', error.message);
    return false;
  }
};

const testConnection = async () => {
  try {
    if (!pool) {
      console.log('⚠️ Database pool not initialized - running in demo mode');
      isDbConnected = false;
      return false;
    }
    
    // First ensure the database exists
    const dbExists = await ensureDatabase();
    if (!dbExists) {
      console.log('⚠️ Database not available - running in demo mode');
      isDbConnected = false;
      return false;
    }
    
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    isDbConnected = true;
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('⚠️ Server will continue in demo mode without database');
    isDbConnected = false;
    return false;
  }
};

// Initialize onboarding tables if they don't exist
const initOnboardingTables = async () => {
  if (!pool || !isDbConnected) {
    console.log('⚠️ Skipping table initialization - database not connected');
    return false;
  }
  
  try {
    const conn = await pool.getConnection();
    
    // Create onboarded_properties table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS onboarded_properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_id VARCHAR(50) UNIQUE NOT NULL,
        entry_type ENUM('GC','APT','VILLA','PLOT') NOT NULL,
        category VARCHAR(50) DEFAULT 'residential',
        zone VARCHAR(100) NOT NULL,
        area_name VARCHAR(255) NOT NULL,
        division VARCHAR(100) NOT NULL,
        property_type VARCHAR(255) NOT NULL,
        community_name VARCHAR(255) NOT NULL,
        number_of_blocks INT DEFAULT NULL,
        block_names JSON DEFAULT NULL,
        units_per_block JSON DEFAULT NULL,
        block_info VARCHAR(255) DEFAULT NULL,
        block_na BOOLEAN DEFAULT FALSE,
        number_of_units INT DEFAULT NULL,
        villa_plot_number VARCHAR(100) DEFAULT NULL,
        total_units INT DEFAULT 0,
        address TEXT,
        address_line1 VARCHAR(255) DEFAULT NULL,
        apt_suite_unit VARCHAR(100) DEFAULT NULL,
        apt_suite_na BOOLEAN DEFAULT FALSE,
        city VARCHAR(100) DEFAULT NULL,
        state VARCHAR(100) DEFAULT NULL,
        postal_code VARCHAR(20) DEFAULT NULL,
        landmark VARCHAR(255),
        map_lat DECIMAL(10,8) DEFAULT NULL,
        map_lng DECIMAL(11,8) DEFAULT NULL,
        map_address TEXT,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_by VARCHAR(100) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add new columns if they don't exist (for existing tables)
    const columnsToAdd = [
      { name: 'address_line1', def: "VARCHAR(255) DEFAULT NULL" },
      { name: 'apt_suite_unit', def: "VARCHAR(100) DEFAULT NULL" },
      { name: 'apt_suite_na', def: "BOOLEAN DEFAULT FALSE" },
      { name: 'city', def: "VARCHAR(100) DEFAULT NULL" },
      { name: 'state', def: "VARCHAR(100) DEFAULT NULL" },
      { name: 'postal_code', def: "VARCHAR(20) DEFAULT NULL" },
      { name: 'created_by', def: "VARCHAR(100) DEFAULT 'system'" }
    ];
    
    for (const col of columnsToAdd) {
      try {
        // Check if column exists
        const [rows] = await conn.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'onboarded_properties' AND COLUMN_NAME = ?`,
          [dbConfig.database, col.name]
        );
        if (rows.length === 0) {
          await conn.execute(`ALTER TABLE onboarded_properties ADD COLUMN ${col.name} ${col.def}`);
          console.log(`  ✓ Added column: ${col.name}`);
        }
      } catch (e) {
        console.log(`  - Column ${col.name} may already exist`);
      }
    }

    // Ensure status column exists and has correct values
    try {
      const [statusCol] = await conn.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'onboarded_properties' AND COLUMN_NAME = 'status'`,
        [dbConfig.database]
      );
      if (statusCol.length === 0) {
        await conn.execute(`ALTER TABLE onboarded_properties ADD COLUMN status VARCHAR(20) DEFAULT 'active'`);
        console.log(`  ✓ Added column: status`);
      }
    } catch (e) {
      console.log(`  - Status column check failed`);
    }

    // Fix created_by column type if it's INT (should be VARCHAR)
    try {
      const [colType] = await conn.execute(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'onboarded_properties' AND COLUMN_NAME = 'created_by'`,
        [dbConfig.database]
      );
      if (colType.length > 0 && colType[0].DATA_TYPE === 'int') {
        await conn.execute(`ALTER TABLE onboarded_properties MODIFY COLUMN created_by VARCHAR(100) DEFAULT 'system'`);
        console.log(`  ✓ Fixed created_by column type to VARCHAR`);
      }
    } catch (e) {
      console.log(`  - created_by column type check failed:`, e.message);
    }

    // Create property_contacts table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS property_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        property_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        country_code VARCHAR(10) DEFAULT '+91',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES onboarded_properties(id) ON DELETE CASCADE
      )
    `);

    // Create onboarded_vendors table (new vendor-specific schema)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS onboarded_vendors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id VARCHAR(50) UNIQUE NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        service_verified TINYINT(1) DEFAULT 0,
        zone VARCHAR(100),
        area_name VARCHAR(255),
        division VARCHAR(100),
        owner_name VARCHAR(255) NOT NULL,
        owner_mobile VARCHAR(20),
        owner_email VARCHAR(255),
        owner_aadhar VARCHAR(20),
        owner_country_code VARCHAR(10) DEFAULT '+91',
        manager_name VARCHAR(255),
        manager_mobile VARCHAR(20),
        manager_email VARCHAR(255),
        manager_country_code VARCHAR(10) DEFAULT '+91',
        poc_name VARCHAR(255),
        poc_mobile VARCHAR(20),
        poc_email VARCHAR(255),
        poc_country_code VARCHAR(10) DEFAULT '+91',
        rate_per_visit DECIMAL(10,2) DEFAULT 0,
        coverage_per_day INT DEFAULT 0,
        created_by VARCHAR(100) DEFAULT 'Manager',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vendor_id (vendor_id),
        INDEX idx_service_type (service_type),
        INDEX idx_zone (zone),
        INDEX idx_division (division),
        INDEX idx_status (status)
      )
    `);

    // Seed sample vendor data if table is empty
    const [vendorRows] = await conn.execute(`SELECT COUNT(*) as cnt FROM onboarded_vendors WHERE status = 'active'`);
    if (vendorRows[0].cnt === 0) {
      console.log('  ⏳ Seeding sample vendor data...');
      const sampleVendors = [
        ['PLM-SEED-20260401', 'Plumbing', 1, 'North Zone', 'Jubilee Hills', 'Division A', 'Rajesh Kumar', '9876543210', 'rajesh@plumbpro.com', '123456789012', '+91', 'Suresh M', '9876543211', 'suresh@plumbpro.com', '+91', 'Anil K', '9876543212', 'anil@plumbpro.com', '+91', 750.00, 8, 'Manager'],
        ['ELC-SEED-20260402', 'Electrical', 1, 'South Zone', 'Banjara Hills', 'Division B', 'Vikram Singh', '9123456780', 'vikram@sparkelectric.com', '234567890123', '+91', 'Mohan R', '9123456781', 'mohan@sparkelectric.com', '+91', null, null, null, '+91', 1200.00, 5, 'Manager'],
        ['HVC-SEED-20260403', 'HVAC', 0, 'East Zone', 'Madhapur', 'Division C', 'Priya Sharma', '9234567890', 'priya@coolairservices.com', '345678901234', '+91', null, null, null, '+91', 'Deepa T', '9234567891', 'deepa@coolairservices.com', '+91', 2000.00, 4, 'Manager'],
        ['CLN-SEED-20260404', 'Cleaning', 1, 'West Zone', 'Gachibowli', 'Division A', 'Mohammed Ali', '9345678901', 'ali@cleanshine.com', '456789012345', '+91', 'Fatima B', '9345678902', 'fatima@cleanshine.com', '+91', null, null, null, '+91', 500.00, 12, 'Manager'],
        ['SEC-SEED-20260405', 'Security', 1, 'Central Zone', 'Hitech City', 'Division D', 'Sunil Reddy', '9456789012', 'sunil@safeguard.com', '567890123456', '+91', null, null, null, '+91', 'Kiran P', '9456789013', 'kiran@safeguard.com', '+91', 1500.00, 6, 'Manager'],
        ['LND-SEED-20260406', 'Landscaping', 0, 'North Zone', 'Kukatpally', 'Division B', 'Lakshmi Devi', '9567890123', 'lakshmi@greenscapes.com', '678901234567', '+91', 'Ravi N', '9567890124', 'ravi@greenscapes.com', '+91', null, null, null, '+91', 800.00, 10, 'Manager'],
      ];

      for (const v of sampleVendors) {
        await conn.execute(
          `INSERT INTO onboarded_vendors
            (vendor_id, service_type, service_verified, zone, area_name, division,
             owner_name, owner_mobile, owner_email, owner_aadhar, owner_country_code,
             manager_name, manager_mobile, manager_email, manager_country_code,
             poc_name, poc_mobile, poc_email, poc_country_code,
             rate_per_visit, coverage_per_day, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          v
        );
      }
      console.log('  ✅ Seeded 6 sample vendors');
    }

    // Create work_orders table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_order_id VARCHAR(50) UNIQUE NOT NULL,
        resident_id INT DEFAULT NULL,
        property_id VARCHAR(50) DEFAULT NULL,
        unit_id INT DEFAULT NULL,
        category_id INT NOT NULL,
        subcategory_id INT NOT NULL,
        category_name VARCHAR(100),
        subcategory_name VARCHAR(100),
        description TEXT,
        permission_to_enter ENUM('yes', 'no') DEFAULT 'no',
        entry_notes TEXT,
        has_pet ENUM('yes', 'no') DEFAULT 'no',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        customer_name VARCHAR(200),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(20),
        property_name VARCHAR(255),
        property_type VARCHAR(50),
        block VARCHAR(50),
        flat_number VARCHAR(50),
        status ENUM('pending', 'assigned', 'in_progress', 'completed', 'closed') DEFAULT 'pending',
        source ENUM('customer', 'admin', 'system') DEFAULT 'customer',
        created_by VARCHAR(50) DEFAULT NULL,
        assigned_vendor_id INT DEFAULT NULL,
        assigned_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_property (property_id),
        INDEX idx_created (created_at)
      )
    `);
    console.log('  ✅ Work orders table initialized');

    // Create work_order_attachments table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS work_order_attachments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_order_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size INT,
        file_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      )
    `);

    // Create work_order_history table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS work_order_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_order_id INT NOT NULL,
        from_status VARCHAR(50),
        to_status VARCHAR(50) NOT NULL,
        changed_by_id INT DEFAULT NULL,
        changed_by_type ENUM('admin', 'vendor', 'customer', 'system') DEFAULT 'system',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✅ Work order attachments & history tables initialized');

    // Create customer_accounts table for customer portal
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id VARCHAR(50) UNIQUE NOT NULL,
        property_contact_id INT,
        property_id INT,
        email VARCHAR(255) UNIQUE NOT NULL,
        temp_password_hash VARCHAR(255),
        password_hash VARCHAR(255),
        activation_token VARCHAR(255) UNIQUE,
        activation_expires TIMESTAMP NULL,
        is_activated BOOLEAN DEFAULT FALSE,
        activated_at TIMESTAMP NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        country_code VARCHAR(10) DEFAULT '+91',
        property_name VARCHAR(255),
        property_code VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP NULL,
        created_by VARCHAR(100) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_customer_accounts_email (email),
        INDEX idx_customer_accounts_token (activation_token),
        INDEX idx_customer_accounts_active (is_active),
        INDEX idx_customer_accounts_activated (is_activated),
        INDEX idx_customer_accounts_property (property_id)
      )
    `);
    console.log('  ✅ Customer accounts table initialized');

    // Create users table for employee portal
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) UNIQUE,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        role ENUM('admin', 'operations_manager', 'manager', 'coordinator', 'supervisor', 'executive', 'franchise', 'franchise_partner') NOT NULL DEFAULT 'executive',
        can_view BOOLEAN DEFAULT TRUE,
        can_create BOOLEAN DEFAULT FALSE,
        can_edit BOOLEAN DEFAULT FALSE,
        can_delete BOOLEAN DEFAULT FALSE,
        can_approve BOOLEAN DEFAULT FALSE,
        can_assign BOOLEAN DEFAULT FALSE,
        can_close BOOLEAN DEFAULT FALSE,
        must_change_password BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add missing columns if table already exists (for existing deployments)
    const userColumnsToAdd = [
      { name: 'user_id', definition: 'VARCHAR(20) UNIQUE AFTER id' },
      { name: 'can_view', definition: 'BOOLEAN DEFAULT TRUE AFTER role' },
      { name: 'can_create', definition: 'BOOLEAN DEFAULT FALSE AFTER can_view' },
      { name: 'can_edit', definition: 'BOOLEAN DEFAULT FALSE AFTER can_create' },
      { name: 'can_delete', definition: 'BOOLEAN DEFAULT FALSE AFTER can_edit' },
      { name: 'can_approve', definition: 'BOOLEAN DEFAULT FALSE AFTER can_delete' },
      { name: 'can_assign', definition: 'BOOLEAN DEFAULT FALSE AFTER can_approve' },
      { name: 'can_close', definition: 'BOOLEAN DEFAULT FALSE AFTER can_assign' },
      { name: 'must_change_password', definition: 'BOOLEAN DEFAULT FALSE AFTER can_close' }
    ];
    
    for (const col of userColumnsToAdd) {
      try {
        await conn.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`  ✅ Added column ${col.name} to users table`);
      } catch (e) {
        // Column already exists - ignore
      }
    }
    console.log('  ✅ Users table initialized');

    // Seed default users if table is empty (Password: Password@123)
    const [userCount] = await conn.execute('SELECT COUNT(*) as cnt FROM users');
    if (userCount[0].cnt === 0) {
      console.log('  ⏳ Seeding default users...');
      // Generate Password@123 bcrypt hash
      const passwordHash = await bcrypt.hash('Password@123', 10);
      
      const defaultUsers = [
        ['admin', 'admin@pmportal.com', 'System', 'Admin', '+91 9999999901', 'admin'],
        ['ops_manager', 'ops@pmportal.com', 'Operations', 'Manager', '+91 9999999907', 'operations_manager'],
        ['manager_admin', 'manager@pmportal.com', 'Operations', 'Manager', '+91 9999999902', 'manager'],
        ['coordinator_admin', 'coordinator@pmportal.com', 'Field', 'Coordinator', '+91 9999999903', 'coordinator'],
        ['supervisor_admin', 'supervisor@pmportal.com', 'Site', 'Supervisor', '+91 9999999904', 'supervisor'],
        ['executive_admin', 'executive@pmportal.com', 'Data Entry', 'Executive', '+91 9999999905', 'executive'],
        ['franchise', 'franchise@pmportal.com', 'Franchise', 'Partner', '+91 9999999906', 'franchise_partner']
      ];

      for (const [username, email, firstName, lastName, phone, role] of defaultUsers) {
        try {
          await conn.execute(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [username, email, passwordHash, firstName, lastName, phone, role]
          );
        } catch (e) {
          // User may already exist
        }
      }
      console.log('  ✅ Default users seeded (Password: Password@123)');
    }

    // Create admin_users table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Admin users table initialized');

    // Seed admin user if table is empty
    const [adminCount] = await conn.execute('SELECT COUNT(*) as cnt FROM admin_users');
    if (adminCount[0].cnt === 0) {
      const adminPasswordHash = await bcrypt.hash('Password@123', 10);
      await conn.execute(
        `INSERT INTO admin_users (username, email, password_hash, first_name, last_name, role, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        ['admin', 'admin@pmportal.com', adminPasswordHash, 'System', 'Admin', 'admin']
      );
      console.log('  ✅ Default admin user seeded (Password: Password@123)');
    }

    // Create franchise_partners table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS franchise_partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        contact_person VARCHAR(200),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        gst_number VARCHAR(20),
        pan_number VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Franchise partners table initialized');

    // Create fp_users table (Portal users under FP)
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS fp_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        franchise_partner_id INT NOT NULL,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        role ENUM('fp_admin', 'fp_manager', 'fp_supervisor', 'fp_executive') NOT NULL DEFAULT 'fp_executive',
        can_view BOOLEAN DEFAULT TRUE,
        can_create BOOLEAN DEFAULT NULL,
        can_edit BOOLEAN DEFAULT NULL,
        can_delete BOOLEAN DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (franchise_partner_id) REFERENCES franchise_partners(id) ON DELETE CASCADE,
        UNIQUE KEY unique_fp_username (franchise_partner_id, username),
        UNIQUE KEY unique_fp_email (franchise_partner_id, email)
      )
    `);
    console.log('  ✅ FP users table initialized');

    // Initialize QR Management tables
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        qr_id VARCHAR(50) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        description TEXT,
        current_url VARCHAR(2048) NOT NULL,
        original_url VARCHAR(2048) NOT NULL,
        qr_type ENUM('website', 'admin', 'campaign', 'event', 'custom') DEFAULT 'custom',
        is_active BOOLEAN DEFAULT TRUE,
        foreground_color VARCHAR(7) DEFAULT '#000000',
        background_color VARCHAR(7) DEFAULT '#FFFFFF',
        error_correction ENUM('L', 'M', 'Q', 'H') DEFAULT 'H',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        INDEX idx_qr_slug (slug),
        INDEX idx_qr_active (is_active)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_redirect_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        qr_id INT NOT NULL,
        previous_url VARCHAR(2048),
        new_url VARCHAR(2048) NOT NULL,
        changed_by INT,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_reason VARCHAR(500),
        INDEX idx_redirect_qr (qr_id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_scans (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        qr_id INT NOT NULL,
        scan_id VARCHAR(64) UNIQUE NOT NULL,
        visitor_id VARCHAR(64),
        session_id VARCHAR(64),
        ip_address VARCHAR(45),
        ip_hash VARCHAR(64),
        is_unique_user BOOLEAN DEFAULT TRUE,
        is_repeat_scan BOOLEAN DEFAULT FALSE,
        user_agent TEXT,
        device_type ENUM('mobile', 'tablet', 'desktop', 'unknown') DEFAULT 'unknown',
        device_brand VARCHAR(100),
        device_model VARCHAR(100),
        os_name VARCHAR(50),
        os_version VARCHAR(50),
        browser_name VARCHAR(50),
        browser_version VARCHAR(50),
        country VARCHAR(100),
        country_code VARCHAR(3),
        state VARCHAR(100),
        city VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        timezone VARCHAR(50),
        referrer_url VARCHAR(2048),
        referrer_domain VARCHAR(255),
        language VARCHAR(10),
        redirect_url VARCHAR(2048),
        redirect_success BOOLEAN DEFAULT TRUE,
        redirect_latency_ms INT,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_end TIMESTAMP NULL,
        session_duration INT DEFAULT 0,
        INDEX idx_scan_qr (qr_id),
        INDEX idx_scan_date (scanned_at),
        INDEX idx_scan_device (device_type)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_analytics_daily (
        id INT PRIMARY KEY AUTO_INCREMENT,
        qr_id INT NOT NULL,
        date DATE NOT NULL,
        total_scans INT DEFAULT 0,
        unique_users INT DEFAULT 0,
        repeat_users INT DEFAULT 0,
        mobile_scans INT DEFAULT 0,
        tablet_scans INT DEFAULT 0,
        desktop_scans INT DEFAULT 0,
        UNIQUE KEY unique_qr_date (qr_id, date),
        INDEX idx_analytics_date (date)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_analytics_hourly (
        id INT PRIMARY KEY AUTO_INCREMENT,
        qr_id INT NOT NULL,
        hour_timestamp TIMESTAMP NOT NULL,
        total_scans INT DEFAULT 0,
        unique_users INT DEFAULT 0,
        UNIQUE KEY unique_qr_hour (qr_id, hour_timestamp)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_active_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        qr_id INT NOT NULL,
        session_id VARCHAR(64) UNIQUE NOT NULL,
        visitor_id VARCHAR(64),
        ip_address VARCHAR(45),
        device_type VARCHAR(20),
        browser VARCHAR(50),
        os VARCHAR(50),
        country VARCHAR(100),
        city VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX idx_active_qr (qr_id),
        INDEX idx_active_session (session_id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_rate_limits (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ip_address VARCHAR(45) NOT NULL,
        qr_id INT,
        request_count INT DEFAULT 1,
        window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_blocked BOOLEAN DEFAULT FALSE,
        blocked_until TIMESTAMP NULL,
        UNIQUE KEY unique_ip_qr (ip_address, qr_id)
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS qr_bot_detections (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        detection_type ENUM('bot', 'spam', 'suspicious', 'blocked') NOT NULL,
        confidence_score DECIMAL(5, 2),
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default XLAND INFRA QR codes
    const [qrCount] = await conn.execute('SELECT COUNT(*) as cnt FROM qr_codes');
    if (qrCount[0].cnt === 0) {
      await conn.execute(`
        INSERT INTO qr_codes (qr_id, slug, label, description, current_url, original_url, qr_type, error_correction)
        VALUES 
          ('XLAND-MAIN-001', 'main', 'XLAND INFRA Website', 'Official XLAND INFRA main website QR code', 'https://www.xlandinfra.com', 'https://www.xlandinfra.com', 'website', 'H'),
          ('XLAND-ADMIN-001', 'admin', 'XLAND INFRA Admin Portal', 'Admin portal access QR code', 'https://admin.xlandinfra.com', 'https://admin.xlandinfra.com', 'admin', 'H')
      `);
      console.log('  ✅ Default QR codes seeded');
    }
    console.log('  ✅ QR Management tables initialized');

    conn.release();
    console.log('✅ All tables initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize tables:', error.message);
    return false;
  }
};

// Export pool getter to ensure we always get the current pool instance
module.exports = { 
  get pool() { return pool; },
  get isDbConnected() { return isDbConnected; },
  testConnection, 
  initOnboardingTables 
};
