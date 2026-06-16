/**
 * Seed Employee Users Script
 * Creates default users for all employee roles
 * Production Admin: XL_admin / Xsunrise@69
 * Other users: Password@123
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const DEFAULT_PASSWORD = 'Password@123';
const ADMIN_PASSWORD = 'Xsunrise@69';  // Production admin password

const users = [
  { username: 'XL_admin', email: 'admin.xlandinfra@gmail.com', firstName: 'Super', lastName: 'Admin', phone: '+91 9999999901', role: 'admin', isMainAdmin: true },
  { username: 'ops_manager', email: 'ops@pmportal.com', firstName: 'Operations', lastName: 'Manager', phone: '+91 9999999907', role: 'operations_manager' },
  { username: 'manager_admin', email: 'manager@pmportal.com', firstName: 'Operations', lastName: 'Manager', phone: '+91 9999999902', role: 'manager' },
  { username: 'coordinator_admin', email: 'coordinator@pmportal.com', firstName: 'Field', lastName: 'Coordinator', phone: '+91 9999999903', role: 'coordinator' },
  { username: 'supervisor_admin', email: 'supervisor@pmportal.com', firstName: 'Site', lastName: 'Supervisor', phone: '+91 9999999904', role: 'supervisor' },
  { username: 'executive_admin', email: 'executive@pmportal.com', firstName: 'Data Entry', lastName: 'Executive', phone: '+91 9999999905', role: 'executive' },
  { username: 'franchise', email: 'franchise@pmportal.com', firstName: 'Franchise', lastName: 'Partner', phone: '+91 9999999906', role: 'franchise_partner' }
];

async function seedUsers() {
  try {
    console.log('Generating password hashes...');
    const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('Password hashes generated');

    // First, update the role ENUM to include all roles
    console.log('\nUpdating role ENUM...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('admin', 'operations_manager', 'manager', 'coordinator', 'supervisor', 'executive', 'franchise', 'franchise_partner') NOT NULL DEFAULT 'executive'
      `);
      console.log('Role ENUM updated successfully');
    } catch (enumError) {
      console.log('ENUM update skipped (may already include roles):', enumError.message);
    }

    // Insert users
    console.log('\nInserting users...');
    for (const user of users) {
      try {
        // Use admin password for main admin, default password for others
        const passwordHash = user.isMainAdmin ? adminPasswordHash : defaultPasswordHash;
        
        await pool.execute(`
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
      } catch (userError) {
        console.error(`✗ Error creating ${user.username}:`, userError.message);
      }
    }

    // Verify users
    console.log('\nVerifying users...');
    const [rows] = await pool.execute('SELECT id, username, email, first_name, last_name, role, is_active FROM users');
    console.table(rows);

    console.log('\n✓ Seed completed!');
    console.log('  - Main Admin (XL_admin): Xsunrise@69');
    console.log('  - Other users: Password@123');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seedUsers();
