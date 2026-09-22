/**
 * Auto Renewal Service
 * 
 * Automatically handles renewal of schedule series when:
 * 1. All visits are completed (completed_visits >= total_visits)
 * 2. Contract end date is approaching (within renewal_notice_days)
 * 
 * Workflow:
 * 1. Detect series due for renewal
 * 2. Create renewal request
 * 3. Send notifications to Customer, FP, Admin
 * 4. On approval: Create new series with same settings
 * 5. Generate occurrences for the new period
 */

const { pool } = require('../config/database');
const { sendEmail } = require('./emailService');

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

// Frequency to days mapping
const FREQUENCY_DAYS = {
  'daily': 1,
  'weekly': 7,
  'bi_weekly': 14,
  'monthly': 30,
  'every_2_months': 60,
  'quarterly': 90,
  'half_yearly': 180,
  'yearly': 365,
  'one_time': 0
};

// Service statistics
let renewalStats = {
  totalProcessed: 0,
  renewalsCreated: 0,
  notificationsSent: 0,
  errors: [],
  lastRunTime: null
};

/**
 * Process all series due for renewal
 * Should be called daily by the scheduler
 */
async function processRenewals() {
  const startTime = Date.now();
  console.log('\n========================================');
  console.log('🔄 AUTO-RENEWAL PROCESSING STARTED');
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log('========================================\n');

  const connection = await pool.getConnection();
  const results = {
    success: true,
    renewalsCreated: [],
    notificationsSent: [],
    errors: []
  };

  try {
    // Find all series due for renewal
    const [seriesDueForRenewal] = await connection.execute(`
      SELECT 
        ss.*,
        op.community_name as property_name,
        op.property_id as property_code,
        op.zone,
        op.city,
        op.franchise_partner_id,
        ov.company_name as vendor_company,
        ov.owner_name as vendor_contact,
        ov.owner_mobile as vendor_phone,
        ov.owner_email as vendor_email,
        pc.name as customer_name,
        pc.email as customer_email,
        pc.phone as customer_phone,
        DATEDIFF(ss.contract_end_date, CURDATE()) as days_until_expiry,
        COALESCE(prs.auto_approve_renewals, FALSE) as auto_approve,
        COALESCE(prs.renewal_contact_email, pc.email) as renewal_email
      FROM schedule_series ss
      LEFT JOIN onboarded_properties op ON ss.property_id = op.id
      LEFT JOIN onboarded_vendors ov ON ss.vendor_id = ov.id
      LEFT JOIN property_contacts pc ON pc.id = (SELECT pc2.id FROM property_contacts pc2 WHERE pc2.property_id = op.id ORDER BY pc2.id LIMIT 1)
      LEFT JOIN property_renewal_settings prs ON prs.property_id = op.id
      WHERE ss.status = 'active'
        AND COALESCE(ss.auto_renewal_enabled, TRUE) = TRUE
        AND ss.renewal_status IN ('not_applicable', 'pending')
        AND ss.renewed_to_series_id IS NULL
        AND (
          -- All visits completed
          ss.completed_visits >= ss.total_visits
          OR
          -- Contract end date approaching (within notice period, default 30 days)
          DATEDIFF(ss.contract_end_date, CURDATE()) <= COALESCE(ss.renewal_notice_days, 30)
        )
        -- Don't process same series twice (check if renewal already exists)
        AND NOT EXISTS (
          SELECT 1 FROM schedule_renewals sr 
          WHERE sr.original_series_id = ss.id 
          AND sr.status IN ('pending_approval', 'approved', 'auto_approved')
        )
      ORDER BY ss.contract_end_date ASC
      LIMIT 100
    `);

    console.log(`📋 Found ${seriesDueForRenewal.length} series due for renewal`);

    for (const series of seriesDueForRenewal) {
      await connection.beginTransaction();
      try {
        // Determine trigger type
        const triggerType = series.completed_visits >= series.total_visits 
          ? 'visits_completed' 
          : 'contract_expiry';

        // Calculate renewal period
        const frequencyDays = FREQUENCY_DAYS[series.frequency] || 30;
        const renewalStartDate = new Date(series.contract_end_date);
        renewalStartDate.setDate(renewalStartDate.getDate() + 1); // Start day after current contract ends
        
        const renewalEndDate = new Date(renewalStartDate);
        renewalEndDate.setDate(renewalEndDate.getDate() + (frequencyDays * series.total_visits));

        // Create renewal request
        const renewalId = generateId('RNW');
        
        await connection.execute(`
          INSERT INTO schedule_renewals (
            renewal_id, original_series_id, original_series_code,
            property_id, service_name, service_category,
            vendor_id, vendor_name, frequency, total_visits,
            renewal_start_date, renewal_end_date,
            status, trigger_type, franchise_partner_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
          renewalId,
          series.id,
          series.series_id,
          series.property_id,
          series.service_name,
          series.service_category,
          series.vendor_id,
          series.vendor_name,
          series.frequency,
          series.total_visits,
          formatDate(renewalStartDate),
          formatDate(renewalEndDate),
          series.auto_approve ? 'auto_approved' : 'pending_approval',
          triggerType,
          series.franchise_partner_id
        ]);

        // Get the inserted renewal ID
        const [[{ insertId: renewalDbId }]] = await connection.execute('SELECT LAST_INSERT_ID() as insertId');

        // Update series renewal status
        await connection.execute(`
          UPDATE schedule_series 
          SET renewal_status = ?, renewal_notice_sent_at = NOW()
          WHERE id = ?
        `, [series.auto_approve ? 'renewed' : 'pending', series.id]);

        // Log history
        await connection.execute(`
          INSERT INTO schedule_renewal_history (renewal_id, action, new_status, notes, changed_by_type)
          VALUES (?, 'created', ?, ?, 'system')
        `, [
          renewalDbId,
          series.auto_approve ? 'auto_approved' : 'pending_approval',
          `Renewal triggered: ${triggerType === 'visits_completed' ? 'All visits completed' : `Contract expires in ${series.days_until_expiry} days`}`
        ]);

        console.log(`✅ Created renewal ${renewalId} for ${series.service_name} at ${series.property_name}`);

        results.renewalsCreated.push({
          renewalId,
          serviceName: series.service_name,
          propertyName: series.property_name,
          triggerType,
          autoApproved: series.auto_approve
        });

        // If auto-approved, create the new series immediately
        if (series.auto_approve) {
          await createRenewalSeries(connection, renewalDbId, series, renewalStartDate, renewalEndDate);
        }

        // Send notifications
        await sendRenewalNotifications(connection, {
          renewalId,
          renewalDbId,
          series,
          triggerType,
          renewalStartDate,
          renewalEndDate,
          autoApproved: series.auto_approve
        });

        results.notificationsSent.push({
          renewalId,
          recipients: ['customer', 'fp', 'admin']
        });

        await connection.commit();

      } catch (seriesError) {
        await connection.rollback();
        console.error(`❌ Error processing series ${series.id}:`, seriesError.message);
        results.errors.push({
          seriesId: series.id,
          error: seriesError.message
        });
      }
    }

    // Update stats
    renewalStats.totalProcessed += seriesDueForRenewal.length;
    renewalStats.renewalsCreated += results.renewalsCreated.length;
    renewalStats.notificationsSent += results.notificationsSent.length;
    renewalStats.lastRunTime = new Date();

    const duration = Date.now() - startTime;
    console.log('\n========================================');
    console.log('✅ AUTO-RENEWAL PROCESSING COMPLETED');
    console.log(`📊 Renewals Created: ${results.renewalsCreated.length}`);
    console.log(`📬 Notifications Sent: ${results.notificationsSent.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log('========================================\n');

    return results;

  } catch (error) {
    console.error('❌ Fatal error in renewal processing:', error);
    results.success = false;
    results.errors.push({ fatal: true, error: error.message });
    return results;
  } finally {
    connection.release();
  }
}

/**
 * Create a new schedule series from a renewal
 */
async function createRenewalSeries(connection, renewalDbId, originalSeries, startDate, endDate) {
  const newSeriesId = generateId('SER');

  // Create new series
  const [result] = await connection.execute(`
    INSERT INTO schedule_series (
      series_id, property_id, estimate_id, service_id,
      service_name, service_category, vendor_id, vendor_name,
      vendor_assigned_at, frequency, total_visits,
      contract_start_date, contract_end_date,
      preferred_day_of_week, preferred_time_slot, schedule_notes,
      zone_id, zone_name, status, auto_renewal_enabled,
      renewed_from_series_id, franchise_partner_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_schedule', TRUE, ?, ?, 1)
  `, [
    newSeriesId,
    originalSeries.property_id,
    originalSeries.estimate_id,
    originalSeries.service_id,
    originalSeries.service_name,
    originalSeries.service_category,
    originalSeries.vendor_id,
    originalSeries.vendor_name,
    originalSeries.frequency,
    originalSeries.total_visits,
    formatDate(startDate),
    formatDate(endDate),
    originalSeries.preferred_day_of_week,
    originalSeries.preferred_time_slot,
    `Renewal of ${originalSeries.series_id}. ${originalSeries.schedule_notes || ''}`,
    originalSeries.zone_id,
    originalSeries.zone_name,
    originalSeries.id,
    originalSeries.franchise_partner_id
  ]);

  const newSeriesDbId = result.insertId;

  // Update original series with renewal reference
  await connection.execute(`
    UPDATE schedule_series 
    SET renewed_to_series_id = ?, renewal_status = 'renewed'
    WHERE id = ?
  `, [newSeriesDbId, originalSeries.id]);

  // Update renewal record with new series
  await connection.execute(`
    UPDATE schedule_renewals 
    SET new_series_id = ?, new_series_code = ?, status = 'approved'
    WHERE id = ?
  `, [newSeriesDbId, newSeriesId, renewalDbId]);

  // Log history
  await connection.execute(`
    INSERT INTO schedule_renewal_history (renewal_id, action, new_status, notes, changed_by_type)
    VALUES (?, 'series_created', 'approved', ?, 'system')
  `, [renewalDbId, `New series created: ${newSeriesId}`]);

  console.log(`   📦 Created renewal series: ${newSeriesId}`);

  return { seriesId: newSeriesId, dbId: newSeriesDbId };
}

/**
 * Send renewal notifications to all parties
 */
async function sendRenewalNotifications(connection, {
  renewalId,
  renewalDbId,
  series,
  triggerType,
  renewalStartDate,
  renewalEndDate,
  autoApproved
}) {
  // 1. Portal notification for Customer
  if (series.customer_email) {
    const customerNotifId = generateId('NTF');
    await connection.execute(`
      INSERT INTO portal_notifications (
        notification_id, type, title, message,
        reference_type, reference_id,
        franchise_partner_id, role_type, priority,
        action_url, created_at
      ) VALUES (?, 'scheduling', ?, ?, 'renewal', ?, ?, 'customer', 'high', ?, NOW())
    `, [
      customerNotifId,
      autoApproved ? 'Service Renewed' : 'Service Renewal Notice',
      autoApproved 
        ? `Your ${series.service_name} service has been automatically renewed for another period starting ${formatDisplayDate(renewalStartDate)}.`
        : `Your ${series.service_name} service is ${triggerType === 'visits_completed' ? 'completed' : `expiring on ${formatDisplayDate(series.contract_end_date)}`}. Please review and approve the renewal.`,
      renewalDbId,
      series.franchise_partner_id,
      `/dashboard?tab=renewals`
    ]);
  }

  // 2. Portal notification for FP
  if (series.franchise_partner_id) {
    const fpNotifId = generateId('NTF');
    await connection.execute(`
      INSERT INTO portal_notifications (
        notification_id, type, title, message,
        reference_type, reference_id,
        franchise_partner_id, role_type, priority,
        action_url, created_at
      ) VALUES (?, 'scheduling', ?, ?, 'renewal', ?, ?, 'fp', 'normal', ?, NOW())
    `, [
      fpNotifId,
      'Service Renewal',
      `${series.service_name} at ${series.property_name} is due for renewal. ${autoApproved ? 'Auto-approved.' : 'Pending customer approval.'}`,
      renewalDbId,
      series.franchise_partner_id,
      `/renewals/${renewalDbId}`
    ]);
  }

  // 3. Portal notification for Admin
  const adminNotifId = generateId('NTF');
  await connection.execute(`
    INSERT INTO portal_notifications (
      notification_id, type, title, message,
      reference_type, reference_id,
      franchise_partner_id, role_type, priority,
      action_url, created_at
    ) VALUES (?, 'scheduling', ?, ?, 'renewal', ?, ?, 'admin', 'normal', ?, NOW())
  `, [
    adminNotifId,
    'Service Renewal',
    `${series.service_name} at ${series.property_name} - Renewal ${autoApproved ? 'auto-approved' : 'pending approval'}. Trigger: ${triggerType === 'visits_completed' ? 'All visits completed' : 'Contract expiring'}`,
    renewalDbId,
    series.franchise_partner_id,
    `/admin/renewals/${renewalDbId}`
  ]);

  // 4. Send email to customer
  if (series.customer_email && !autoApproved) {
    await sendRenewalEmail({
      customerEmail: series.customer_email,
      customerName: series.customer_name,
      serviceName: series.service_name,
      serviceCategory: series.service_category,
      propertyName: series.property_name,
      vendorName: series.vendor_company || series.vendor_name,
      currentEndDate: series.contract_end_date,
      renewalStartDate,
      renewalEndDate,
      totalVisits: series.total_visits,
      frequency: series.frequency,
      triggerType,
      renewalId
    });
  }

  // Log notification sent
  await connection.execute(`
    INSERT INTO schedule_renewal_history (renewal_id, action, notes, changed_by_type)
    VALUES (?, 'customer_notified', 'Notifications sent to customer, FP, and admin', 'system')
  `, [renewalDbId]);
}

/**
 * Send renewal email to customer
 */
async function sendRenewalEmail({
  customerEmail,
  customerName,
  serviceName,
  serviceCategory,
  propertyName,
  vendorName,
  currentEndDate,
  renewalStartDate,
  renewalEndDate,
  totalVisits,
  frequency,
  triggerType,
  renewalId
}) {
  const formattedCurrentEnd = formatDisplayDate(currentEndDate);
  const formattedRenewalStart = formatDisplayDate(renewalStartDate);
  const formattedRenewalEnd = formatDisplayDate(renewalEndDate);

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Service Renewal Notice</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f3f4f6;">
        <tr>
          <td style="padding: 20px 10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #334155 0%, #1e293b 100%); padding: 30px 20px; text-align: center;">
                  <h1 style="margin: 0; color: #c9a227; font-size: 24px; font-weight: 600;">Service Renewal Notice</h1>
                  <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 14px;">Your service is ready for renewal</p>
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 25px 20px 15px 20px;">
                  <p style="margin: 0; color: #1e293b; font-size: 16px;">Dear <strong>${customerName || 'Valued Customer'}</strong>,</p>
                  <p style="margin: 15px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                    ${triggerType === 'visits_completed' 
                      ? `All scheduled visits for your <strong>${serviceName}</strong> service have been completed.`
                      : `Your <strong>${serviceName}</strong> service contract is expiring on <strong>${formattedCurrentEnd}</strong>.`
                    }
                    We would like to offer you a seamless renewal.
                  </p>
                </td>
              </tr>
              
              <!-- Current Service Summary -->
              <tr>
                <td style="padding: 0 20px 20px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f8fafc; border-radius: 12px; border-left: 4px solid #64748b;">
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="margin: 0 0 12px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Current Service</h3>
                        <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${serviceName}</p>
                        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 13px;">Contract ends: ${formattedCurrentEnd}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Renewal Offer -->
              <tr>
                <td style="padding: 0 20px 20px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #c9a227;">
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px; font-weight: 600;">
                          🔄 Renewal Offer
                        </h3>
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 120px;">Service:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${serviceName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Property:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 500; font-size: 14px;">${propertyName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Vendor:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 500; font-size: 14px;">${vendorName || 'To be assigned'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Period:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${formattedRenewalStart} - ${formattedRenewalEnd}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Visits:</td>
                            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${totalVisits} visits (${frequency})</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CTA Buttons -->
              <tr>
                <td style="padding: 0 20px 25px 20px; text-align: center;">
                  <a href="${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/dashboard?tab=renewals&id=${renewalId}" 
                     style="display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-right: 10px;">
                    Approve Renewal
                  </a>
                  <a href="${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/dashboard?tab=renewals" 
                     style="display: inline-block; padding: 14px 30px; background: #e2e8f0; color: #475569; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    View Details
                  </a>
                </td>
              </tr>
              
              <!-- Note -->
              <tr>
                <td style="padding: 0 20px 25px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0; color: #1e40af; font-size: 13px; line-height: 1.5;">
                          <strong>💡 Note:</strong> To ensure uninterrupted service, please approve the renewal before your current contract expires. 
                          If you have any questions, please contact us.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #1e293b; padding: 20px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #c9a227; font-size: 14px; font-weight: 600;">XLAND INFRA</p>
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">Property Management Excellence</p>
                  <p style="margin: 10px 0 0 0; color: #64748b; font-size: 11px;">
                    Renewal ID: ${renewalId}
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
      `Service Renewal Notice: ${serviceName} | XLAND INFRA`,
      emailHtml
    );
    console.log(`   📧 Sent renewal email to ${customerEmail}`);
    return { success: true };
  } catch (error) {
    console.error(`   ❌ Failed to send renewal email to ${customerEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Approve a renewal request
 */
async function approveRenewal(renewalId, approvedBy, approverType = 'customer') {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get renewal details
    const [renewals] = await connection.execute(`
      SELECT sr.*, ss.* 
      FROM schedule_renewals sr
      JOIN schedule_series ss ON sr.original_series_id = ss.id
      WHERE sr.id = ? OR sr.renewal_id = ?
    `, [renewalId, renewalId]);

    if (renewals.length === 0) {
      throw new Error('Renewal not found');
    }

    const renewal = renewals[0];
    
    if (renewal.status !== 'pending_approval') {
      throw new Error(`Renewal is already ${renewal.status}`);
    }

    // Update renewal status based on approver type
    if (approverType === 'customer') {
      await connection.execute(`
        UPDATE schedule_renewals 
        SET customer_response = 'approved', customer_response_at = NOW()
        WHERE id = ?
      `, [renewal.id]);
    }

    // Create the new series
    const renewalStartDate = new Date(renewal.renewal_start_date);
    const renewalEndDate = new Date(renewal.renewal_end_date);
    
    await createRenewalSeries(connection, renewal.id, renewal, renewalStartDate, renewalEndDate);

    // Log history
    await connection.execute(`
      INSERT INTO schedule_renewal_history (renewal_id, action, old_status, new_status, notes, changed_by, changed_by_type)
      VALUES (?, ?, 'pending_approval', 'approved', 'Renewal approved', ?, ?)
    `, [
      renewal.id,
      approverType === 'customer' ? 'customer_approved' : 'admin_approved',
      approvedBy,
      approverType
    ]);

    await connection.commit();
    
    console.log(`✅ Renewal ${renewal.renewal_id} approved by ${approverType}`);
    return { success: true, renewalId: renewal.renewal_id };

  } catch (error) {
    await connection.rollback();
    console.error('Error approving renewal:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Decline a renewal request
 */
async function declineRenewal(renewalId, declinedBy, declineReason, declinerType = 'customer') {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get renewal details
    const [renewals] = await connection.execute(`
      SELECT * FROM schedule_renewals WHERE id = ? OR renewal_id = ?
    `, [renewalId, renewalId]);

    if (renewals.length === 0) {
      throw new Error('Renewal not found');
    }

    const renewal = renewals[0];

    // Update renewal status
    await connection.execute(`
      UPDATE schedule_renewals 
      SET status = 'declined', 
          decline_reason = ?,
          ${declinerType === 'customer' ? 'customer_response = \'declined\', customer_response_at = NOW()' : 'admin_response = \'declined\', admin_response_at = NOW(), admin_response_by = ?'}
      WHERE id = ?
    `, declinerType === 'customer' 
      ? [declineReason, renewal.id]
      : [declineReason, declinedBy, renewal.id]
    );

    // Update original series
    await connection.execute(`
      UPDATE schedule_series 
      SET renewal_status = 'declined', renewal_declined_reason = ?
      WHERE id = ?
    `, [declineReason, renewal.original_series_id]);

    // Log history
    await connection.execute(`
      INSERT INTO schedule_renewal_history (renewal_id, action, old_status, new_status, notes, changed_by, changed_by_type)
      VALUES (?, ?, 'pending_approval', 'declined', ?, ?, ?)
    `, [
      renewal.id,
      declinerType === 'customer' ? 'customer_declined' : 'admin_declined',
      declineReason,
      declinedBy,
      declinerType
    ]);

    await connection.commit();
    
    console.log(`❌ Renewal ${renewal.renewal_id} declined by ${declinerType}`);
    return { success: true, renewalId: renewal.renewal_id };

  } catch (error) {
    await connection.rollback();
    console.error('Error declining renewal:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get pending renewals for a property/FP/admin
 */
async function getPendingRenewals(filters = {}) {
  const { propertyId, franchisePartnerId, status = 'pending_approval', limit = 50 } = filters;

  let query = `
    SELECT 
      sr.*,
      ss.series_id as original_series_code,
      ss.contract_start_date as original_start_date,
      ss.contract_end_date as original_end_date,
      ss.completed_visits,
      ss.total_visits as original_total_visits,
      op.community_name as property_name,
      op.property_id as property_code,
      op.zone,
      ov.company_name as vendor_company,
      ov.owner_name as vendor_contact,
      pc.name as customer_name,
      pc.email as customer_email,
      DATEDIFF(ss.contract_end_date, CURDATE()) as days_until_expiry
    FROM schedule_renewals sr
    JOIN schedule_series ss ON sr.original_series_id = ss.id
    LEFT JOIN onboarded_properties op ON sr.property_id = op.id
    LEFT JOIN onboarded_vendors ov ON sr.vendor_id = ov.id
    LEFT JOIN property_contacts pc ON pc.id = (SELECT pc2.id FROM property_contacts pc2 WHERE pc2.property_id = op.id ORDER BY pc2.id LIMIT 1)
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND sr.status = ?`;
    params.push(status);
  }

  if (propertyId) {
    query += ` AND sr.property_id = ?`;
    params.push(propertyId);
  }

  if (franchisePartnerId) {
    query += ` AND sr.franchise_partner_id = ?`;
    params.push(franchisePartnerId);
  }

  // A prepared statement cannot bind LIMIT, so the clamped integer is inlined instead
  query += ` ORDER BY sr.created_at DESC LIMIT ${Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)}`;

  const [renewals] = await pool.execute(query, params);
  return renewals;
}

/**
 * Get renewal statistics
 */
function getRenewalStats() {
  return renewalStats;
}

module.exports = {
  processRenewals,
  approveRenewal,
  declineRenewal,
  getPendingRenewals,
  getRenewalStats,
  sendRenewalEmail
};
