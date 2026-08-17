/**
 * Update User Passwords Script
 * Updates all existing user passwords to Password@123
 * Run this if users already exist in the database with old passwords
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

const NEW_PASSWORD = 'Password@123';

async function updatePasswords() {
  try {
    console.log('Generating password hash for:', NEW_PASSWORD);
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
    console.log('Password hash generated');

    // Update users table
    console.log('\nUpdating users table...');
    const [usersResult] = await pool.execute(
      'UPDATE users SET password_hash = ?',
      [passwordHash]
    );
    console.log(`✓ Updated ${usersResult.affectedRows} users`);

    // Update admin_users table
    console.log('\nUpdating admin_users table...');
    const [adminResult] = await pool.execute(
      'UPDATE admin_users SET password_hash = ?',
      [passwordHash]
    );
    console.log(`✓ Updated ${adminResult.affectedRows} admin users`);

    // Verify users
    console.log('\nVerifying users...');
    const [users] = await pool.execute('SELECT id, username, email, role, is_active FROM users');
    console.table(users);

    const [admins] = await pool.execute('SELECT id, username, email, role, is_active FROM admin_users');
    console.table(admins);

    console.log('\n✓ All passwords updated to: Password@123');
    process.exit(0);
  } catch (error) {
    console.error('Error updating passwords:', error);
    process.exit(1);
  }
}

updatePasswords();
