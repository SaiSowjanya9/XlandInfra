/**
 * Create Production Admin User
 * Run this on the production server: node database/create_admin.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const ADMIN_USER = {
  username: 'XL_admin',
  email: 'xlandinfra@gmail.com',
  // Password: Password$123 (pre-hashed with bcrypt)
  password_hash: '$2a$10$mNm4vcgibG.g/KcN2eX3guJpXv6fjTNO7.aYkkRwRBW6TiF/j920u',
  first_name: 'XLand',
  last_name: 'Admin',
  phone: '+91 9999999901',
  role: 'admin'
};

async function createAdmin() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });
    
    console.log('✓ Connected to database\n');

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
      [ADMIN_USER.username, ADMIN_USER.email]
    );

    if (existing.length > 0) {
      console.log('User already exists, updating password...');
      await connection.execute(
        'UPDATE users SET password_hash = ?, is_active = TRUE WHERE username = ? OR email = ?',
        [ADMIN_USER.password_hash, ADMIN_USER.username, ADMIN_USER.email]
      );
      console.log('✓ Admin user password updated!');
    } else {
      console.log('Creating new admin user...');
      await connection.execute(`
        INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
      `, [
        ADMIN_USER.username,
        ADMIN_USER.email,
        ADMIN_USER.password_hash,
        ADMIN_USER.first_name,
        ADMIN_USER.last_name,
        ADMIN_USER.phone,
        ADMIN_USER.role
      ]);
      console.log('✓ Admin user created!');
    }

    // Verify
    const [users] = await connection.execute(
      'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE role = "admin"'
    );
    
    console.log('\n=== Admin Users ===');
    console.table(users);
    
    console.log('\n========================================');
    console.log('  PRODUCTION ADMIN LOGIN CREDENTIALS');
    console.log('========================================');
    console.log('  Username: XL_admin');
    console.log('  Password: Password$123');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\nMake sure MySQL is running and .env has correct credentials');
    }
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\nCheck DB_USER and DB_PASSWORD in .env file');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

createAdmin();
