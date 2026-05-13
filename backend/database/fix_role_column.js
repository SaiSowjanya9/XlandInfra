/**
 * Fix role column to support all portal roles
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function fixRoles() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'customer_portal'
  });

  try {
    console.log('🔧 Updating role column to support all roles...');
    
    // Change role column to VARCHAR to support all roles
    await conn.query(`
      ALTER TABLE users 
      MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'executive'
    `);
    console.log('✅ Role column updated to VARCHAR(50)');

    // Now create the coordinator user
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    // Check if coordinator exists
    const [existing] = await conn.query(
      "SELECT id FROM users WHERE username = 'coordinator_admin'"
    );

    if (existing.length === 0) {
      await conn.query(`
        INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active, created_at)
        VALUES ('coordinator_admin', 'coordinator@test.com', ?, 'Test', 'Coordinator', 'coordinator', TRUE, NOW())
      `, [hashedPassword]);
      console.log('✅ Created coordinator_admin user');
    } else {
      // Update the role if user exists
      await conn.query(`
        UPDATE users SET role = 'coordinator' WHERE username = 'coordinator_admin'
      `);
      console.log('✅ Updated coordinator_admin role');
    }

    // List all test users
    const [users] = await conn.query(`
      SELECT username, email, role, is_active FROM users 
      WHERE role IN ('franchise', 'manager', 'coordinator', 'supervisor', 'admin')
    `);
    
    console.log('\n📋 Portal Users:');
    console.log('┌────────────────────┬──────────────────────────┬─────────────┐');
    console.log('│ Username           │ Email                    │ Role        │');
    console.log('├────────────────────┼──────────────────────────┼─────────────┤');
    users.forEach(u => {
      console.log(`│ ${u.username.padEnd(18)} │ ${u.email.padEnd(24)} │ ${u.role.padEnd(11)} │`);
    });
    console.log('└────────────────────┴──────────────────────────┴─────────────┘');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await conn.end();
  }
}

fixRoles();
