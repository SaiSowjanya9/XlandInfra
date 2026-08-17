/**
 * Work Order Cleanup Utility
 * Auto-deletes closed and cancelled work orders after 30 days
 * Provides API for notifications about approaching deletions
 */

const { pool } = require('../config/database');

// Days before auto-delete
const AUTO_DELETE_DAYS = 30;
// Days before deletion to start warning
const WARNING_DAYS = 7;

/**
 * Delete work orders that are closed/cancelled and older than 30 days
 */
const cleanupOldWorkOrders = async () => {
  try {
    console.log('[Cleanup] Starting work order cleanup...');
    
    // Get work orders to be deleted (for logging)
    const [toDelete] = await pool.execute(`
      SELECT id, work_order_id, status, completed_date, cancelled_at
      FROM work_orders 
      WHERE status IN ('closed', 'cancelled')
      AND (
        (status = 'closed' AND completed_date IS NOT NULL AND completed_date < DATE_SUB(NOW(), INTERVAL ? DAY))
        OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_at < DATE_SUB(NOW(), INTERVAL ? DAY))
      )
    `, [AUTO_DELETE_DAYS, AUTO_DELETE_DAYS]);

    if (toDelete.length === 0) {
      console.log('[Cleanup] No work orders to delete');
      return { deleted: 0, ids: [] };
    }

    const idsToDelete = toDelete.map(wo => wo.id);
    console.log(`[Cleanup] Deleting ${idsToDelete.length} work orders: ${toDelete.map(wo => wo.work_order_id).join(', ')}`);

    // Delete attachments first (foreign key constraint)
    await pool.execute(`
      DELETE FROM work_order_attachments 
      WHERE work_order_id IN (${idsToDelete.map(() => '?').join(',')})
    `, idsToDelete);

    // Delete status history
    await pool.execute(`
      DELETE FROM work_order_status_history 
      WHERE work_order_id IN (${idsToDelete.map(() => '?').join(',')})
    `, idsToDelete);

    // Delete the work orders
    const [result] = await pool.execute(`
      DELETE FROM work_orders 
      WHERE id IN (${idsToDelete.map(() => '?').join(',')})
    `, idsToDelete);

    console.log(`[Cleanup] Successfully deleted ${result.affectedRows} work orders`);
    
    return { 
      deleted: result.affectedRows, 
      ids: toDelete.map(wo => wo.work_order_id) 
    };
  } catch (error) {
    console.error('[Cleanup] Error during work order cleanup:', error);
    throw error;
  }
};

/**
 * Get work orders approaching auto-delete (within WARNING_DAYS days)
 * For notifications in Admin and FP portals
 */
const getWorkOrdersApproachingDeletion = async (franchisePartnerId = null) => {
  try {
    let query = `
      SELECT 
        wo.id, wo.work_order_id, wo.title, wo.status,
        wo.completed_date, wo.cancelled_at,
        wo.franchise_partner_id,
        COALESCE(p.name, op.community_name, wo.property_name) as property_name,
        CASE 
          WHEN wo.status = 'closed' THEN DATEDIFF(DATE_ADD(wo.completed_date, INTERVAL ? DAY), NOW())
          WHEN wo.status = 'cancelled' THEN DATEDIFF(DATE_ADD(wo.cancelled_at, INTERVAL ? DAY), NOW())
        END as days_until_deletion
      FROM work_orders wo
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id
      WHERE wo.status IN ('closed', 'cancelled')
      AND (
        (wo.status = 'closed' AND wo.completed_date IS NOT NULL 
          AND wo.completed_date BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND DATE_SUB(NOW(), INTERVAL ? DAY))
        OR (wo.status = 'cancelled' AND wo.cancelled_at IS NOT NULL 
          AND wo.cancelled_at BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND DATE_SUB(NOW(), INTERVAL ? DAY))
      )
    `;
    
    const params = [
      AUTO_DELETE_DAYS, AUTO_DELETE_DAYS,
      AUTO_DELETE_DAYS, AUTO_DELETE_DAYS - WARNING_DAYS,
      AUTO_DELETE_DAYS, AUTO_DELETE_DAYS - WARNING_DAYS
    ];

    if (franchisePartnerId) {
      query += ` AND wo.franchise_partner_id = ?`;
      params.push(franchisePartnerId);
    }

    query += ` ORDER BY days_until_deletion ASC`;

    const [workOrders] = await pool.execute(query, params);
    
    return workOrders.map(wo => ({
      id: wo.id,
      workOrderId: wo.work_order_id,
      title: wo.title,
      status: wo.status,
      propertyName: wo.property_name,
      daysUntilDeletion: wo.days_until_deletion,
      completedDate: wo.completed_date,
      cancelledAt: wo.cancelled_at
    }));
  } catch (error) {
    console.error('[Cleanup] Error getting work orders approaching deletion:', error);
    throw error;
  }
};

/**
 * Get count of work orders approaching deletion
 */
const getApproachingDeletionCount = async (franchisePartnerId = null) => {
  try {
    let query = `
      SELECT COUNT(*) as count
      FROM work_orders wo
      WHERE wo.status IN ('closed', 'cancelled')
      AND (
        (wo.status = 'closed' AND wo.completed_date IS NOT NULL 
          AND wo.completed_date BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND DATE_SUB(NOW(), INTERVAL ? DAY))
        OR (wo.status = 'cancelled' AND wo.cancelled_at IS NOT NULL 
          AND wo.cancelled_at BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND DATE_SUB(NOW(), INTERVAL ? DAY))
      )
    `;
    
    const params = [
      AUTO_DELETE_DAYS, AUTO_DELETE_DAYS - WARNING_DAYS,
      AUTO_DELETE_DAYS, AUTO_DELETE_DAYS - WARNING_DAYS
    ];

    if (franchisePartnerId) {
      query += ` AND wo.franchise_partner_id = ?`;
      params.push(franchisePartnerId);
    }

    const [[result]] = await pool.execute(query, params);
    return result.count || 0;
  } catch (error) {
    console.error('[Cleanup] Error getting approaching deletion count:', error);
    return 0;
  }
};

// Run cleanup every day at midnight (called from server.js)
const startCleanupScheduler = () => {
  // Run immediately on startup
  setTimeout(() => {
    cleanupOldWorkOrders().catch(console.error);
  }, 5000); // Wait 5 seconds after server start

  // Then run every 24 hours
  setInterval(() => {
    console.log('[Cleanup] Running scheduled cleanup...');
    cleanupOldWorkOrders().catch(console.error);
  }, 24 * 60 * 60 * 1000); // 24 hours

  console.log('✅ Work Order Cleanup Scheduler started (runs daily)');
};

module.exports = {
  cleanupOldWorkOrders,
  getWorkOrdersApproachingDeletion,
  getApproachingDeletionCount,
  startCleanupScheduler,
  AUTO_DELETE_DAYS,
  WARNING_DAYS
};
