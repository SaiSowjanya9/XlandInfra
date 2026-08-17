/**
 * Script to delete all employees from Charan FP portal
 * This deletes from: fp_employee_zones, fp_employees, and linked users
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '147.79.65.186',
  user: process.env.DB_USER || 'xland_user',
  password: process.env.DB_PASSWORD || 'YourStrongPassword123!',
  database: process.env.DB_NAME || 'xland_pm',
  port: process.env.DB_PORT || 3306
};

async function deleteCharanEmployees() {
  let connection;
  
  try {
    console.log('📦 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // Find Charan FP ID
    const [fps] = await connection.execute(
      `SELECT id, company_name, username FROM franchise_partners 
       WHERE company_name LIKE '%charan%' OR username LIKE '%charan%'`
    );

    if (fps.length === 0) {
      console.log('❌ No franchise partner found with "charan" in name or username');
      
      // List all FPs for reference
      const [allFps] = await connection.execute(
        `SELECT id, company_name, username FROM franchise_partners`
      );
      console.log('\n📋 Available Franchise Partners:');
      allFps.forEach(fp => {
        console.log(`  - ID: ${fp.id}, Company: ${fp.company_name}, Username: ${fp.username}`);
      });
      return;
    }

    const charanFp = fps[0];
    console.log(`\n🎯 Found Charan FP: ID=${charanFp.id}, Company=${charanFp.company_name}`);

    // Get all employees for this FP
    const [employees] = await connection.execute(
      `SELECT id, first_name, last_name, email, user_id FROM fp_employees WHERE franchise_partner_id = ?`,
      [charanFp.id]
    );

    console.log(`\n📋 Found ${employees.length} employees to delete:`);
    employees.forEach(emp => {
      console.log(`  - ${emp.first_name} ${emp.last_name} (${emp.email}) - User ID: ${emp.user_id || 'none'}`);
    });

    if (employees.length === 0) {
      console.log('\n✅ No employees to delete - already clean!');
      return;
    }

    // Start transaction
    await connection.beginTransaction();
    console.log('\n🔄 Starting deletion transaction...');

    try {
      // 1. Delete from fp_employee_zones
      const [zoneResult] = await connection.execute(
        `DELETE FROM fp_employee_zones WHERE franchise_partner_id = ?`,
        [charanFp.id]
      );
      console.log(`  ✓ Deleted ${zoneResult.affectedRows} zone assignments`);

      // 2. Get user_ids to delete from users table
      const userIds = employees.map(emp => emp.user_id).filter(id => id != null);
      
      // 3. Delete from fp_employees
      const [empResult] = await connection.execute(
        `DELETE FROM fp_employees WHERE franchise_partner_id = ?`,
        [charanFp.id]
      );
      console.log(`  ✓ Deleted ${empResult.affectedRows} employees from fp_employees`);

      // 4. Delete linked user accounts
      if (userIds.length > 0) {
        const [userResult] = await connection.execute(
          `DELETE FROM users WHERE id IN (${userIds.join(',')}) AND franchise_partner_id = ?`,
          [charanFp.id]
        );
        console.log(`  ✓ Deleted ${userResult.affectedRows} user accounts`);
      }

      await connection.commit();
      console.log('\n✅ All employees deleted successfully!');
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Transaction failed, rolled back:', error.message);
      throw error;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📦 Database connection closed');
    }
  }
}

deleteCharanEmployees();
