/**
 * Database Import Script
 * Run this on the PC where you want to import the data
 * Usage: node scripts/import-data.js [path-to-export-file]
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Tables in order of dependencies (parents first)
const tableOrder = [
  'cities',
  'zones',
  'categories',
  'subcategories',
  'service_categories',
  'franchise_partners',
  'users',
  'managers',
  'coordinators',
  'vendors',
  'employees',
  'customers',
  'clients',
  'properties',
  'onboarded_properties',
  'packages',
  'amc_packages',
  'addons',
  'estimates',
  'estimate_items',
  'pricing',
  'work_orders',
  'qr_codes',
  'notifications'
];

async function importData() {
  const exportFile = process.argv[2] || path.join(__dirname, '../exports/latest_export.json');
  
  if (!fs.existsSync(exportFile)) {
    console.error('❌ Export file not found:', exportFile);
    console.log('\nUsage: node scripts/import-data.js [path-to-export-file]');
    console.log('Or place the export file at: backend/exports/latest_export.json');
    process.exit(1);
  }

  console.log('🔄 Starting database import...');
  console.log(`📁 Reading from: ${exportFile}\n`);

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'customer_portal',
    port: process.env.DB_PORT || 3306
  });

  try {
    const data = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    
    // Disable foreign key checks for import
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tableOrder) {
      if (!data[table] || data[table].length === 0) {
        console.log(`⏭️  Skipping ${table}: no data`);
        continue;
      }

      const records = data[table];
      let imported = 0;
      let skipped = 0;

      for (const record of records) {
        try {
          const columns = Object.keys(record);
          const values = Object.values(record);
          const placeholders = columns.map(() => '?').join(', ');
          const updateClause = columns.map(col => `${col} = VALUES(${col})`).join(', ');
          
          const sql = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders})
            ON DUPLICATE KEY UPDATE ${updateClause}
          `;
          
          await pool.execute(sql, values);
          imported++;
        } catch (err) {
          // Try simple insert if ON DUPLICATE KEY fails
          try {
            const columns = Object.keys(record);
            const values = Object.values(record);
            const placeholders = columns.map(() => '?').join(', ');
            
            const sql = `INSERT IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
            await pool.execute(sql, values);
            imported++;
          } catch (innerErr) {
            skipped++;
          }
        }
      }

      console.log(`✅ ${table}: ${imported} imported, ${skipped} skipped`);
    }

    // Re-enable foreign key checks
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ Import complete!');
    console.log('🔄 Restart your backend server to see the changes.');

  } catch (error) {
    console.error('❌ Import failed:', error.message);
  } finally {
    await pool.end();
  }
}

importData();
