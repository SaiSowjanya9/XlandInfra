const mysql = require('mysql2/promise');
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

let pool = mysql.createPool(dbConfig);

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
    // First ensure the database exists
    await ensureDatabase();
    
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Initialize onboarding tables if they don't exist
const initOnboardingTables = async () => {
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
        block VARCHAR(50),
        flat_number VARCHAR(50),
        status ENUM('pending', 'assigned', 'in_progress', 'completed', 'closed') DEFAULT 'pending',
        source ENUM('customer', 'admin', 'system') DEFAULT 'customer',
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

    conn.release();
    console.log('✅ Onboarding tables initialized (properties & vendors)');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize onboarding tables:', error.message);
    return false;
  }
};

// Export pool getter to ensure we always get the current pool instance
module.exports = { 
  get pool() { return pool; }, 
  testConnection, 
  initOnboardingTables 
};
