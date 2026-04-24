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
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Add new address columns if they don't exist (for existing tables)
    const columnsToAdd = [
      { name: 'address_line1', def: "VARCHAR(255) DEFAULT NULL" },
      { name: 'apt_suite_unit', def: "VARCHAR(100) DEFAULT NULL" },
      { name: 'apt_suite_na', def: "BOOLEAN DEFAULT FALSE" },
      { name: 'city', def: "VARCHAR(100) DEFAULT NULL" },
      { name: 'state', def: "VARCHAR(100) DEFAULT NULL" },
      { name: 'postal_code', def: "VARCHAR(20) DEFAULT NULL" }
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

    conn.release();
    console.log('✅ Onboarding tables initialized');
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
