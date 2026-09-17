/**
 * Work Order Scheduler Service
 * 
 * Automatically creates work orders 7 days before scheduled service dates.
 * Runs twice daily at 6:00 AM and 6:00 PM for reliability.
 * 
 * Notifications sent to:
 * - Customer (email reminder + portal notification)
 * - FP (Franchise Partner) portal notification
 * - Admin portal notification
 * - Vendor notification
 */

const cron = require('node-cron');
const { pool } = require('../config/database');
const { initSchedulingSchema } = require('../config/schedulingSchema');
const { sendEmail, getWorkOrderNotificationRecipients } = require('./emailService');
const { processRenewals, getRenewalStats } = require('./autoRenewalService');

// ID Generators
const generateId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Format date for MySQL
const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// Format date for display
const formatDisplayDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Scheduler state
let isSchedulerRunning = false;
let lastRunTime = null;
let schedulerStats = {
  totalRuns: 0,
  totalWorkOrdersCreated: 0,
  lastRunWorkOrders: 0,
  errors: []
};

/**
 * Generate work orders for visits scheduled 7 days from now
 * Also catches any missed visits (today to 7 days ahead)
 */
async function generateScheduledWorkOrders() {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('🔄 SCHEDULED WORK ORDER GENERATION STARTED');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log('========================================\n');

  const connection = await pool.getConnection();
  const results = {
    success: true,
    workOrdersCreated: [],
    notificationsSent: [],
    errors: []
  };

  try {
    await connection.beginTransaction();

    // Find all schedule occurrences from today to 7 days ahead without work orders
    // This catches any missed visits if the scheduler was down
    const [upcomingVisits] = await connection.execute(`
      SELECT 
        so.id as occurrence_id,
        so.occurrence_id as occurrence_code,
        so.series_id,
        so.visit_number,
        so.scheduled_date,
        so.scheduled_time_start,
        so.scheduled_time_end,
        so.vendor_id,
        so.vendor_name,
        so.zone_name,
        ss.service_name,
        ss.service_category,
        ss.property_id,
        ss.total_visits,
        ss.frequency,
        ss.franchise_partner_id,
        ss.estimate_id,
        op.community_name as property_name,
        op.property_id as property_code,
        op.address_line1,
        op.apt_suite_unit as address_line2,
        op.city,
        op.state,
        op.postal_code as pincode,
        op.zone as property_zone,
        pc.name as customer_name,
        pc.phone as customer_phone,
        pc.email as customer_email,
        ov.owner_name as vendor_contact_name,
        ov.owner_mobile as vendor_phone,
        ov.company_name as vendor_company,
        ov.owner_email as vendor_email
      FROM schedule_occurrences so
      JOIN schedule_series ss ON so.series_id = ss.id
      LEFT JOIN onboarded_properties op ON ss.property_id = op.id
      LEFT JOIN property_contacts pc ON pc.id = (SELECT pc2.id FROM property_contacts pc2 WHERE pc2.property_id = op.id ORDER BY pc2.id LIMIT 1)
      LEFT JOIN onboarded_vendors ov ON so.vendor_id = ov.id
      WHERE so.work_order_id IS NULL
        AND so.status IN ('scheduled', 'confirmed')
        AND so.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        AND so.scheduled_date >= CURDATE()
      ORDER BY so.scheduled_date ASC
    `);

    console.log(`📋 Found ${upcomingVisits.length} visits requiring work orders`);

    for (const visit of upcomingVisits) {
      try {
        // Generate unique work order ID
        const workOrderId = generateId('WO');
        
        // Build comprehensive work order description
        const description = `
Scheduled Service Visit - Auto-Generated

Service: ${visit.service_name}
Category: ${visit.service_category || 'General'}
Visit: ${visit.visit_number} of ${visit.total_visits}
Frequency: ${visit.frequency || 'As Scheduled'}

Property: ${visit.property_name} (${visit.property_code || 'N/A'})
Location: ${[visit.address_line1, visit.address_line2, visit.city, visit.state, visit.pincode].filter(Boolean).join(', ')}
Zone: ${visit.zone_name || visit.property_zone || 'N/A'}

Customer: ${visit.customer_name || 'N/A'} | ${visit.customer_phone || 'N/A'}

Vendor: ${visit.vendor_company || visit.vendor_name || 'N/A'}
Vendor Contact: ${visit.vendor_contact_name || 'N/A'} | ${visit.vendor_phone || 'N/A'}

Schedule Reference: ${visit.occurrence_code || 'N/A'}
        `.trim();

        // Determine priority based on visit number
        let priority = 'medium';
        if (visit.visit_number === 1) priority = 'high'; // First visit is high priority
        if (visit.visit_number === visit.total_visits) priority = 'high'; // Last visit is high priority
        
        // Create work order
        const [woResult] = await connection.execute(`
          INSERT INTO work_orders (
            work_order_id, property_id, category_name, subcategory_name,
            title, description, scheduled_date, assigned_vendor_id,
            priority, status, source, franchise_partner_id,
            customer_name, customer_email, customer_phone,
            property_name, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', 'scheduled_service', ?, ?, ?, ?, ?, 'system', NOW())
        `, [
          workOrderId,
          visit.property_id,
          visit.service_category || visit.service_name,
          visit.service_name,
          `Visit ${visit.visit_number} - ${visit.service_name}`,
          description,
          visit.scheduled_date,
          visit.vendor_id,
          priority,
          visit.franchise_partner_id,
          visit.customer_name,
          visit.customer_email,
          visit.customer_phone,
          visit.property_name
        ]);

        const insertedWorkOrderId = woResult.insertId;

        // Update schedule occurrence with work order reference
        await connection.execute(`
          UPDATE schedule_occurrences 
          SET work_order_id = ?,
              work_order_generated_at = NOW(),
              status = 'work_order_created'
          WHERE id = ?
        `, [insertedWorkOrderId, visit.occurrence_id]);

        // Add to work order history
        await connection.execute(`
          INSERT INTO work_order_history (work_order_id, to_status, changed_by_type, notes)
          VALUES (?, 'assigned', 'system', 'Auto-generated 7 days before scheduled service date')
        `, [insertedWorkOrderId]);

        console.log(`✅ Created Work Order: ${workOrderId} for ${visit.service_name} on ${formatDisplayDate(visit.scheduled_date)}`);

        results.workOrdersCreated.push({
          workOrderId,
          serviceName: visit.service_name,
          scheduledDate: visit.scheduled_date,
          propertyName: visit.property_name,
          vendorName: visit.vendor_name
        });

        // ========================================
        // SEND NOTIFICATIONS
        // ========================================

        // 1. Create portal notification for CUSTOMER
        if (visit.customer_email || visit.customer_phone) {
          const customerNotifId = generateId('NTF');
          await connection.execute(`
            INSERT INTO portal_notifications (
              notification_id, type, title, message, 
              reference_type, reference_id,
              franchise_partner_id, role_type, priority,
              action_url, created_at
            ) VALUES (?, 'scheduling', ?, ?, 'work_order', ?, ?, 'customer', 'high', ?, NOW())
          `, [
            customerNotifId,
            `Upcoming Service Reminder`,
            `Your ${visit.service_name} service is scheduled for ${formatDisplayDate(visit.scheduled_date)}. Work Order: ${workOrderId}`,
            insertedWorkOrderId,
            visit.franchise_partner_id,
            `/dashboard?tab=services`
          ]);
          results.notificationsSent.push({ type: 'portal', recipient: 'customer', workOrderId });
        }

        // 2. Create portal notification for FP (Franchise Partner)
        if (visit.franchise_partner_id) {
          const fpNotifId = generateId('NTF');
          await connection.execute(`
            INSERT INTO portal_notifications (
              notification_id, type, title, message,
              reference_type, reference_id,
              franchise_partner_id, role_type, priority,
              action_url, created_at
            ) VALUES (?, 'work_order', ?, ?, 'work_order', ?, ?, 'fp', 'normal', ?, NOW())
          `, [
            fpNotifId,
            `Work Order Auto-Created`,
            `Work Order ${workOrderId} created for ${visit.property_name} - ${visit.service_name} on ${formatDisplayDate(visit.scheduled_date)}`,
            insertedWorkOrderId,
            visit.franchise_partner_id,
            `/work-orders/${insertedWorkOrderId}`
          ]);
          results.notificationsSent.push({ type: 'portal', recipient: 'fp', workOrderId });
        }

        // 3. Create portal notification for ADMIN
        const adminNotifId = generateId('NTF');
        await connection.execute(`
          INSERT INTO portal_notifications (
            notification_id, type, title, message,
            reference_type, reference_id,
            franchise_partner_id, role_type, priority,
            action_url, created_at
          ) VALUES (?, 'work_order', ?, ?, 'work_order', ?, ?, 'admin', 'normal', ?, NOW())
        `, [
          adminNotifId,
          `Scheduled Work Order Created`,
          `Auto-generated Work Order ${workOrderId} for ${visit.property_name} - ${visit.service_name} (Visit ${visit.visit_number}/${visit.total_visits})`,
          insertedWorkOrderId,
          visit.franchise_partner_id,
          `/admin/work-orders/${insertedWorkOrderId}`
        ]);
        results.notificationsSent.push({ type: 'portal', recipient: 'admin', workOrderId });

        // 4. Create portal notification for VENDOR
        if (visit.vendor_id) {
          const vendorNotifId = generateId('NTF');
          await connection.execute(`
            INSERT INTO portal_notifications (
              notification_id, type, title, message,
              reference_type, reference_id,
              vendor_id, role_type, priority,
              action_url, created_at
            ) VALUES (?, 'work_order', ?, ?, 'work_order', ?, ?, 'vendor', 'high', ?, NOW())
          `, [
            vendorNotifId,
            `New Work Order Assigned`,
            `Work Order ${workOrderId} assigned to you: ${visit.service_name} at ${visit.property_name} on ${formatDisplayDate(visit.scheduled_date)}`,
            insertedWorkOrderId,
            visit.vendor_id,
            `/vendor/work-orders/${insertedWorkOrderId}`
          ]);
          results.notificationsSent.push({ type: 'portal', recipient: 'vendor', workOrderId });
        }

        // 5. Send EMAIL to CUSTOMER (Service Reminder)
        if (visit.customer_email) {
          await sendServiceReminderEmail({
            customerEmail: visit.customer_email,
            customerName: visit.customer_name,
            serviceName: visit.service_name,
            serviceCategory: visit.service_category,
            scheduledDate: visit.scheduled_date,
            scheduledTime: visit.scheduled_time_start,
            propertyName: visit.property_name,
            propertyAddress: [visit.address_line1, visit.city, visit.state].filter(Boolean).join(', '),
            vendorName: visit.vendor_company || visit.vendor_name,
            vendorPhone: visit.vendor_phone,
            visitNumber: visit.visit_number,
            totalVisits: visit.total_visits,
            workOrderId
          });
          results.notificationsSent.push({ type: 'email', recipient: 'customer', workOrderId });
          console.log(`📧 Sent reminder email to customer: ${visit.customer_email}`);
        }

      } catch (visitError) {
        console.error(`❌ Error processing visit ${visit.occurrence_id}:`, visitError.message);
        results.errors.push({
          occurrenceId: visit.occurrence_id,
          error: visitError.message
        });
      }
    }

    await connection.commit();

    // Update scheduler stats
    schedulerStats.totalRuns++;
    schedulerStats.totalWorkOrdersCreated += results.workOrdersCreated.length;
    schedulerStats.lastRunWorkOrders = results.workOrdersCreated.length;
    lastRunTime = new Date();

    const duration = Date.now() - startTime;
    console.log('\n========================================');
    console.log('✅ SCHEDULED WORK ORDER GENERATION COMPLETED');
    console.log(`📊 Work Orders Created: ${results.workOrdersCreated.length}`);
    console.log(`📬 Notifications Sent: ${results.notificationsSent.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log('========================================\n');

    return results;

  } catch (error) {
    await connection.rollback();
    console.error('❌ Fatal error in work order generation:', error);
    schedulerStats.errors.push({
      time: new Date().toISOString(),
      error: error.message
    });
    results.success = false;
    results.errors.push({ fatal: true, error: error.message });
    return results;
  } finally {
    connection.release();
  }
}

/**
 * Send service reminder email to customer
 */
async function sendServiceReminderEmail({
  customerEmail,
  customerName,
  serviceName,
  serviceCategory,
  scheduledDate,
  scheduledTime,
  propertyName,
  propertyAddress,
  vendorName,
  vendorPhone,
  visitNumber,
  totalVisits,
  workOrderId
}) {
  const formattedDate = formatDisplayDate(scheduledDate);
  const formattedTime = scheduledTime ? new Date(`2000-01-01T${scheduledTime}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'As per schedule';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Service Reminder</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f3f4f6;">
        <tr>
          <td style="padding: 20px 10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #334155 0%, #1e293b 100%); padding: 30px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #c9a227; font-size: 24px; font-weight: 600;">Service Reminder</h1>
                  <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 14px;">Your upcoming scheduled service</p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 25px 20px 15px 20px;">
                  <p style="margin: 0; color: #1e293b; font-size: 16px;">Dear <strong>${customerName || 'Valued Customer'}</strong>,</p>
                  <p style="margin: 15px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                    This is a friendly reminder that your scheduled service is coming up in <strong style="color: #c9a227;">7 days</strong>.
                  </p>
                </td>
              </tr>
              
              <!-- Service Details Card -->
              <tr>
                <td style="padding: 0 20px 20px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #c9a227;">
                    <tr>
                      <td style="padding: 20px;">
                        <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                          📅 ${serviceName}
                        </h2>
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 100px;">Date:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${formattedDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Time:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${formattedTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Visit:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${visitNumber} of ${totalVisits}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Work Order:</td>
                            <td style="padding: 8px 0; color: #c9a227; font-weight: 600; font-size: 14px;">${workOrderId}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Property Details -->
              <tr>
                <td style="padding: 0 20px 20px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f8fafc; border-radius: 12px; border-left: 4px solid #3b82f6;">
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; font-weight: 600;">🏢 Property Details</h3>
                        <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">${propertyName || 'Your Property'}</p>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 13px;">${propertyAddress || ''}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Vendor Details -->
              ${vendorName ? `
              <tr>
                <td style="padding: 0 20px 20px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f0fdf4; border-radius: 12px; border-left: 4px solid #22c55e;">
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; font-weight: 600;">👷 Service Provider</h3>
                        <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">${vendorName}</p>
                        ${vendorPhone ? `<p style="margin: 5px 0 0 0; color: #64748b; font-size: 13px;">📞 ${vendorPhone}</p>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ` : ''}
              
              <!-- Important Note -->
              <tr>
                <td style="padding: 0 20px 25px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0; color: #1e40af; font-size: 13px; line-height: 1.5;">
                          <strong>💡 Important:</strong> Please ensure someone is available at the property on the scheduled date. 
                          If you need to reschedule, please contact us at least 48 hours in advance.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CTA Button -->
              <tr>
                <td style="padding: 0 20px 25px 20px; text-align: center;">
                  <a href="${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/dashboard" 
                     style="display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #c9a227 0%, #b8941f 100%); color: #1e293b; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    View in Portal
                  </a>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #1e293b; padding: 20px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #c9a227; font-size: 14px; font-weight: 600;">XLAND INFRA</p>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">Property Management Excellence</p>
                  <p style="margin: 10px 0 0 0; color: #64748b; font-size: 11px;">
                    This is an automated reminder. Please do not reply to this email.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail(
      customerEmail,
      `Service Reminder: ${serviceName} on ${formattedDate} | XLAND INFRA`,
      emailHtml
    );
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send reminder email to ${customerEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the scheduler
 * Runs at 6:00 AM and 6:00 PM daily
 */
async function initScheduler() {
  if (isSchedulerRunning) {
    console.log('⚠️ Work Order Scheduler already running');
    return;
  }

  try {
    await initSchedulingSchema(pool);
  } catch (error) {
    console.error('Scheduling schema initialization failed; work-order and renewal jobs were not started. Check database CREATE/ALTER permissions and prerequisite tables, then restart the backend:', error.message);
    return false;
  }

  console.log('\n🚀 Initializing Work Order Scheduler...');
  console.log('📅 Schedule: 6:00 AM and 6:00 PM daily');
  console.log('📋 Task: Auto-create work orders 7 days before scheduled services\n');

  // Schedule for 6:00 AM daily
  cron.schedule('0 6 * * *', async () => {
    console.log('⏰ [6:00 AM] Running scheduled tasks...');
    await generateScheduledWorkOrders();
    await processRenewals(); // Auto-renewal processing
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // Indian Standard Time
  });

  // Schedule for 6:00 PM daily
  cron.schedule('0 18 * * *', async () => {
    console.log('⏰ [6:00 PM] Running scheduled tasks...');
    await generateScheduledWorkOrders();
    await processRenewals(); // Auto-renewal processing
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata' // Indian Standard Time
  });

  isSchedulerRunning = true;
  console.log('✅ Work Order Scheduler initialized successfully');
  console.log('✅ Auto-Renewal Processor initialized');
  console.log('🕐 Next runs: 6:00 AM and 6:00 PM IST\n');
  return true;
}

/**
 * Run the scheduler manually (for testing or on-demand)
 */
async function runManually() {
  console.log('🔧 Manual work order generation triggered...');
  return await generateScheduledWorkOrders();
}

/**
 * Get scheduler status and statistics
 */
function getSchedulerStatus() {
  return {
    isRunning: isSchedulerRunning,
    lastRunTime: lastRunTime ? lastRunTime.toISOString() : null,
    stats: schedulerStats,
    renewalStats: getRenewalStats(),
    schedule: {
      times: ['6:00 AM IST', '6:00 PM IST'],
      timezone: 'Asia/Kolkata',
      description: 'Creates work orders 7 days before scheduled services & processes auto-renewals'
    }
  };
}

/**
 * Stop the scheduler (for graceful shutdown)
 */
function stopScheduler() {
  // node-cron doesn't have a direct stop all method
  // but we can track the state
  isSchedulerRunning = false;
  console.log('🛑 Work Order Scheduler stopped');
}

module.exports = {
  initScheduler,
  runManually,
  generateScheduledWorkOrders,
  getSchedulerStatus,
  stopScheduler,
  sendServiceReminderEmail
};
