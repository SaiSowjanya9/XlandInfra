/**
 * Migration: Remove duplicate work orders
 * Run with: node database/migrations/remove_duplicate_work_orders.js
 */

const { pool } = require('../../config/database');

async function removeDuplicateWorkOrders() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Starting duplicate work orders cleanup...\n');
    
    // Find duplicates
    const [duplicates] = await connection.execute(`
      SELECT work_order_id, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM work_orders 
      GROUP BY work_order_id 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length === 0) {
      console.log('✓ No duplicate work orders found. Database is clean.');
      return;
    }
    
    console.log(`Found ${duplicates.length} work_order_ids with duplicates:\n`);
    duplicates.forEach(d => {
      console.log(`  - ${d.work_order_id}: ${d.count} records (IDs: ${d.ids})`);
    });
    
    // Delete duplicates, keeping lowest id for each work_order_id
    const [result] = await connection.execute(`
      DELETE wo1 FROM work_orders wo1
      INNER JOIN work_orders wo2
      WHERE wo1.work_order_id = wo2.work_order_id
      AND wo1.id > wo2.id
    `);
    
    console.log(`\n✓ Removed ${result.affectedRows} duplicate records.\n`);
    
    // Verify cleanup
    const [remaining] = await connection.execute(`
      SELECT work_order_id, COUNT(*) as count 
      FROM work_orders 
      GROUP BY work_order_id 
      HAVING COUNT(*) > 1
    `);
    
    if (remaining.length === 0) {
      console.log('✓ Verification passed: No duplicates remain.');
    } else {
      console.log('⚠ Warning: Some duplicates may still exist:', remaining);
    }
    
    // Check if unique index exists
    const [indexes] = await connection.execute(`
      SHOW INDEX FROM work_orders WHERE Column_name = 'work_order_id' AND Non_unique = 0
    `);
    
    if (indexes.length === 0) {
      console.log('\n⚠ Note: Consider adding a unique constraint to prevent future duplicates:');
      console.log('   ALTER TABLE work_orders ADD UNIQUE INDEX idx_work_order_id_unique (work_order_id);');
    } else {
      console.log('\n✓ Unique constraint already exists on work_order_id.');
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  removeDuplicateWorkOrders()
    .then(() => {
      console.log('\nMigration completed successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('\nMigration failed:', err);
      process.exit(1);
    });
}

module.exports = { removeDuplicateWorkOrders };
