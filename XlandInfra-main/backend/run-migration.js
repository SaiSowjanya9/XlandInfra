// Migration script to add missing columns to work_orders table
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

// Debug: show which DB we're connecting to
console.log('📍 Connecting to database:', process.env.DB_HOST || 'localhost', '/', process.env.DB_NAME || 'customer_portal');

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

    if (!existingColumns.includes('category_name')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN category_name VARCHAR(100) DEFAULT NULL AFTER subcategory_id`
      );
      console.log('✅ Added category_name column');
    }

    if (!existingColumns.includes('subcategory_name')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN subcategory_name VARCHAR(100) DEFAULT NULL AFTER category_name`
      );
      console.log('✅ Added subcategory_name column');
    }

    if (!existingColumns.includes('title')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN title VARCHAR(255) DEFAULT NULL AFTER subcategory_name`
      );
      console.log('✅ Added title column');
    }

    if (!existingColumns.includes('block')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN block VARCHAR(50) DEFAULT NULL AFTER property_type`
      );
      console.log('✅ Added block column');
    }
    
    // Update status ENUM to include all values
    try {
      await connection.execute(
        `ALTER TABLE work_orders MODIFY COLUMN status ENUM('pending', 'requested', 'assigned', 'in_progress', 'completed', 'closed', 'cancelled') DEFAULT 'pending'`
      );
      console.log('✅ Updated status ENUM to include requested and cancelled');
    } catch (e) {
      console.log('ℹ️ Status column already has correct ENUM values');
    }

    if (!existingColumns.includes('flat_number')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN flat_number VARCHAR(50) DEFAULT NULL AFTER block`
      );
      console.log('✅ Added flat_number column');
    }

    if (!existingColumns.includes('franchise_partner_id')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN franchise_partner_id INT DEFAULT NULL AFTER created_by`
      );
      // Add index for better query performance
      try {
        await connection.execute(
          `CREATE INDEX idx_franchise_partner ON work_orders(franchise_partner_id)`
        );
      } catch (e) { /* Index may already exist */ }
      console.log('✅ Added franchise_partner_id column with index');
    }

    if (!existingColumns.includes('assigned_by')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN assigned_by VARCHAR(50) DEFAULT NULL AFTER assigned_vendor_id`
      );
      console.log('✅ Added assigned_by column');
    }

    if (!existingColumns.includes('scheduled_date')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN scheduled_date DATE DEFAULT NULL AFTER assigned_at`
      );
      console.log('✅ Added scheduled_date column');
    }

    if (!existingColumns.includes('completed_date')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN completed_date TIMESTAMP NULL AFTER completed_at`
      );
      console.log('✅ Added completed_date column');
    }

    if (!existingColumns.includes('admin_notes')) {
      await connection.execute(
        `ALTER TABLE work_orders ADD COLUMN admin_notes TEXT AFTER completed_date`
      );
      console.log('✅ Added admin_notes column');
    }

    // Ensure work_order_history table has correct columns
    const [historyColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'work_order_history'`,
      [process.env.DB_NAME || 'customer_portal']
    );
    
    const existingHistoryColumns = historyColumns.map(c => c.COLUMN_NAME);
    
    // Rename changed_by to changed_by_id if it exists
    if (existingHistoryColumns.includes('changed_by') && !existingHistoryColumns.includes('changed_by_id')) {
      await connection.execute(
        `ALTER TABLE work_order_history CHANGE COLUMN changed_by changed_by_id INT DEFAULT NULL`
      );
      console.log('✅ Renamed changed_by to changed_by_id in work_order_history');
    } else if (!existingHistoryColumns.includes('changed_by_id')) {
      await connection.execute(
        `ALTER TABLE work_order_history ADD COLUMN changed_by_id INT DEFAULT NULL AFTER to_status`
      );
      console.log('✅ Added changed_by_id column to work_order_history');
    } else {
      console.log('ℹ️ changed_by_id column already exists in work_order_history');
    }
    
    console.log('✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await connection.end();
  }
}

runMigration();
