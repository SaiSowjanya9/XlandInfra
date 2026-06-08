/**
 * Seed Users Script
 * Creates default users for Employee Portal login
 * 
 * Run: node seedUsers.js
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const DEFAULT_PASSWORD = 'Password@123';

const USERS = [
  {
    username: 'admin',
    email: 'xlandinfra@gmail.com',
    firstName: 'System',
    lastName: 'Admin',
    phone: '+91 9999999901',
    role: 'admin'
  },
  {
    username: 'opsmanager',
    email: 'opsmanager@xlandinfra.com',
    firstName: 'Operations',
    lastName: 'Manager',
    phone: '+91 9999999902',
    role: 'operations_manager'
  },
  {
    username: 'franchise',
    email: 'franchise@xlandinfra.com',
    firstName: 'Franchise',
    lastName: 'Partner',
    phone: '+91 9999999903',
    role: 'franchise_partner'
  },
  {
    username: 'manager',
    email: 'manager@xlandinfra.com',
    firstName: 'Branch',
    lastName: 'Manager',
    phone: '+91 9999999904',
    role: 'manager'
  },
  {
    username: 'coordinator',
    email: 'coordinator@xlandinfra.com',
    firstName: 'Field',
    lastName: 'Coordinator',
    phone: '+91 9999999905',
    role: 'coordinator'
  },
  {
    username: 'supervisor',
    email: 'supervisor@xlandinfra.com',
    firstName: 'Site',
    lastName: 'Supervisor',
    phone: '+91 9999999906',
    role: 'supervisor'
  },
  {
    username: 'executive',
    email: 'executive@xlandinfra.com',
    firstName: 'Data',
    lastName: 'Executive',
    phone: '+91 9999999907',
    role: 'executive'
  }
];

async function seedUsers() {
  let connection;
  
  try {
    // Connect to database (without specifying database first)
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    console.log('Connected to MySQL server');

    // Create database if not exists
    const dbName = process.env.DB_NAME || 'customer_portal';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);
    console.log(`✓ Using database: ${dbName}`);

    // Create users table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        role ENUM('admin', 'operations_manager', 'franchise_partner', 'manager', 'coordinator', 'supervisor', 'executive') NOT NULL DEFAULT 'executive',
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Users table ready');

    // Update role ENUM to include all roles (in case table existed with old ENUM)
    try {
      await connection.query(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('admin', 'operations_manager', 'franchise_partner', 'manager', 'coordinator', 'supervisor', 'executive') 
        NOT NULL DEFAULT 'executive'
      `);
      console.log('✓ Updated role ENUM to include all roles');
    } catch (err) {
      // Ignore if already correct
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    console.log(`Password hash generated for: ${DEFAULT_PASSWORD}`);

    // Insert users
    for (const user of USERS) {
      try {
        await connection.execute(`
          INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE 
            password_hash = VALUES(password_hash),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            role = VALUES(role),
            is_active = TRUE
        `, [user.username, user.email, passwordHash, user.firstName, user.lastName, user.phone, user.role]);
        
        console.log(`✓ Created/Updated user: ${user.username} (${user.role})`);
      } catch (err) {
        console.error(`✗ Failed to create user ${user.username}:`, err.message);
      }
    }

    // Display created users
    const [rows] = await connection.execute(
      'SELECT id, username, email, first_name, last_name, role, is_active FROM users'
    );
    
    console.log('\n========================================');
    console.log('USERS IN DATABASE:');
    console.log('========================================');
    console.table(rows);
    
    console.log('\n========================================');
    console.log('LOGIN CREDENTIALS:');
    console.log('========================================');
    console.log('Password for all users:', DEFAULT_PASSWORD);
    console.log('');
    USERS.forEach(u => {
      console.log(`${u.role.toUpperCase().padEnd(12)} | Username: ${u.username.padEnd(12)} | Email: ${u.email}`);
    });
    console.log('========================================\n');

  } catch (error) {
    console.error('Error seeding users:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

seedUsers();
