/**
 * Database Export Script
 * Run this on the PC that has the latest data
 * Usage: node scripts/export-data.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const tables = [
  'users',
  'franchise_partners',
  'managers',
  'coordinators',
  'vendors',
  'employees',
  'customers',
  'clients',
  'properties',
  'onboarded_properties',
  'work_orders',
  'categories',
  'subcategories',
  'service_categories',
  'zones',
  'cities',
  'packages',
  'amc_packages',
  'addons',
  'estimates',
  'estimate_items',
  'pricing',
  'qr_codes',
  'notifications'
];

async function exportData() {
  console.log('🔄 Starting database export...\n');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'customer_portal',
    port: process.env.DB_PORT || 3306
  });

  const exportData = {};
  const exportDir = path.join(__dirname, '../exports');
  
  // Create exports directory if not exists
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  try {
    for (const table of tables) {
      try {
        const [rows] = await pool.execute(`SELECT * FROM ${table}`);
        exportData[table] = rows;
        console.log(`✅ Exported ${table}: ${rows.length} records`);
      } catch (err) {
        console.log(`⚠️  Table ${table} not found or empty, skipping...`);
        exportData[table] = [];
      }
    }

    // Save to JSON file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `database_export_${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`\n✅ Export complete!`);
    console.log(`📁 File saved: ${filepath}`);
    console.log(`\n📋 Copy this file to the other PC and run: node scripts/import-data.js`);
    
    // Also save as latest.json for easy import
    const latestPath = path.join(exportDir, 'latest_export.json');
    fs.writeFileSync(latestPath, JSON.stringify(exportData, null, 2));
    console.log(`📁 Also saved as: ${latestPath}`);

  } catch (error) {
    console.error('❌ Export failed:', error.message);
  } finally {
    await pool.end();
  }
}

exportData();
