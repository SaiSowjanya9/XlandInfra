// Migration script to add missing columns to work_orders table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'customer_portal',
    port: parseInt(process.env.DB_PORT) || 3306
  });

  try {
    console.log('🔄 Running migration...');
    
    // Check if columns exist
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_orders'`,
      [process.env.DB_NAME || 'customer_portal']
    );
    
    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    if (!existingColumns.includes('property_name')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN property_name VARCHAR(255) AFTER customer_phone`
      );
      console.log('✅ Added property_name column');
    } else {
      console.log('ℹ️ property_name column already exists');
    }
    
    if (!existingColumns.includes('property_type')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN property_type VARCHAR(50) AFTER property_name`
      );
      console.log('✅ Added property_type column');
    } else {
      console.log('ℹ️ property_type column already exists');
    }
    
    if (!existingColumns.includes('created_by')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN created_by VARCHAR(50) DEFAULT NULL AFTER source`
      );
      console.log('✅ Added created_by column');
    } else {
      // Change column type from INT to VARCHAR if it exists
      await connection.execute(
        `ALTER TABLE work_orders MODIFY COLUMN created_by VARCHAR(50) DEFAULT NULL`
      );
      console.log('✅ Modified created_by column to VARCHAR(50)');
    }
    
    console.log('✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await connection.end();
  }
}

runMigration();
