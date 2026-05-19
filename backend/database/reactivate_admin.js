/**
 * Reactivate Admin User in BOTH tables
 * Run this script: node database/reactivate_admin.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const PASSWORD_HASH = '$2a$10$mNm4vcgibG.g/KcN2eX3guJpXv6fjTNO7.aYkkRwRBW6TiF/j920u';

async function reactivateAdmin() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'customer_portal',
      port: process.env.DB_PORT || 3306
    });
    
    console.log('✓ Connected to database\n');

    // ========== FIX USERS TABLE (Employee Portal) ==========
    console.log('--- Fixing USERS table (Employee Portal) ---');
    const [usersResult] = await connection.execute(
      `UPDATE users SET is_active = TRUE WHERE username = 'XL_admin' OR email = 'admin@xlandinfra.com'`
    );

    if (usersResult.affectedRows > 0) {
      console.log('✅ XL_admin REACTIVATED in users table!');
    } else {
      console.log('User not found in users table, creating...');
      await connection.execute(`
        INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active)
        VALUES ('XL_admin', 'admin@xlandinfra.com', ?, 'XLand', 'Admin', '+91 9999999901', 'admin', TRUE)
      `, [PASSWORD_HASH]);
      console.log('✅ XL_admin CREATED in users table!');
    }

    // ========== FIX ADMIN_USERS TABLE (Admin Portal) ==========
    console.log('\n--- Fixing ADMIN_USERS table (Admin Portal) ---');
    const [adminResult] = await connection.execute(
      `UPDATE admin_users SET is_active = TRUE WHERE username = 'XL_admin' OR email = 'admin@xlandinfra.com'`
    );

    if (adminResult.affectedRows > 0) {
      console.log('✅ XL_admin REACTIVATED in admin_users table!');
    } else {
      console.log('User not found in admin_users table, creating...');
      await connection.execute(`
        INSERT INTO admin_users (username, email, password_hash, first_name, last_name, role, is_active)
        VALUES ('XL_admin', 'admin@xlandinfra.com', ?, 'XLand', 'Admin', 'admin', TRUE)
      `, [PASSWORD_HASH]);
      console.log('✅ XL_admin CREATED in admin_users table!');
    }

    // Verify
    const [users] = await connection.execute(
      'SELECT id, username, email, is_active, role FROM users WHERE username = ? OR email = ?',
      ['XL_admin', 'admin@xlandinfra.com']
    );
    console.log('\n=== Users Table ===');
    console.table(users);

    const [admins] = await connection.execute(
      'SELECT id, username, email, is_active, role FROM admin_users WHERE username = ? OR email = ?',
      ['XL_admin', 'admin@xlandinfra.com']
    );
    console.log('\n=== Admin_Users Table ===');
    console.table(admins);
    
    console.log('\n========================================');
    console.log('  LOGIN CREDENTIALS');
    console.log('========================================');
    console.log('  Username: XL_admin');
    console.log('  Password: Password$123');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

reactivateAdmin();
