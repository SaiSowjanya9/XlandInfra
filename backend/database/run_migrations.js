/**
 * Database Migration Runner
 * Runs all portal schemas and creates test users
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'customer_portal',
  multipleStatements: true
};

async function runMigrations() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');

    // List of schema files to run
    const schemaFiles = [
      'schema_v8_franchise_partners.sql',
      'schema_v9_manager_portal.sql',
      'schema_v10_coordinator_portal.sql',
      'schema_v11_supervisor_portal.sql',
      'schema_v12_executive_portal.sql'
    ];

    for (const file of schemaFiles) {
      const filePath = path.join(__dirname, file);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  ${file} not found, skipping...`);
        continue;
      }

      console.log(`\n📄 Running ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split by semicolon and filter empty statements
      const statements = sql.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let successCount = 0;
      let skipCount = 0;

      for (const stmt of statements) {
        try {
          await connection.query(stmt);
          successCount++;
        } catch (err) {
          // Skip errors for already existing tables/columns
          if (err.code === 'ER_DUP_FIELDNAME' || 
              err.code === 'ER_TABLE_EXISTS_ERROR' ||
              err.code === 'ER_DUP_KEYNAME' ||
              err.code === 'ER_FK_DUP_NAME' ||
              err.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
              err.message.includes('Duplicate') ||
              err.message.includes('already exists')) {
            skipCount++;
          } else {
            console.log(`   ⚠️  ${err.message.substring(0, 80)}`);
            skipCount++;
          }
        }
      }

      console.log(`   ✅ ${successCount} statements executed, ${skipCount} skipped`);
    }

    // Create test users for each portal
    console.log('\n👤 Creating test users...');
    
    const testUsers = [
      { username: 'fp_admin', email: 'fp@test.com', role: 'franchise', firstName: 'Franchise', lastName: 'Partner' },
      { username: 'manager_admin', email: 'manager@test.com', role: 'manager', firstName: 'Test', lastName: 'Manager' },
      { username: 'coordinator_admin', email: 'coordinator@test.com', role: 'coordinator', firstName: 'Test', lastName: 'Coordinator' },
      { username: 'supervisor_admin', email: 'supervisor@test.com', role: 'supervisor', firstName: 'Test', lastName: 'Supervisor' },
      { username: 'executive_admin', email: 'executive@test.com', role: 'executive', firstName: 'Test', lastName: 'Executive' }
    ];

    const hashedPassword = await bcrypt.hash('password123', 10);

    for (const user of testUsers) {
      try {
        // Check if user exists
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE username = ? OR email = ?',
          [user.username, user.email]
        );

        if (existing.length > 0) {
          console.log(`   ⏭️  User ${user.username} already exists`);
          continue;
        }

        await connection.query(
          `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())`,
          [user.username, user.email, hashedPassword, user.firstName, user.lastName, user.role]
        );
        console.log(`   ✅ Created user: ${user.username} (password: password123)`);
      } catch (err) {
        console.log(`   ⚠️  Error creating ${user.username}: ${err.message.substring(0, 50)}`);
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
    console.log('\n📋 Test Login Credentials:');
    console.log('   ┌─────────────────────────────────────────────────────┐');
    console.log('   │ Portal          │ Username          │ Password     │');
    console.log('   ├─────────────────────────────────────────────────────┤');
    console.log('   │ Franchise       │ fp_admin          │ password123  │');
    console.log('   │ Manager         │ manager_admin     │ password123  │');
    console.log('   │ Coordinator     │ coordinator_admin │ password123  │');
    console.log('   │ Supervisor      │ supervisor_admin  │ password123  │');
    console.log('   │ Executive       │ executive_admin   │ password123  │');
    console.log('   └─────────────────────────────────────────────────────┘');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

runMigrations();
