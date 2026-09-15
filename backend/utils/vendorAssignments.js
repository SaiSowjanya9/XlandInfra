/**
 * Property vendor assignment writes (Assign Vendor on Pending Property Schedules).
 *
 * Vendors are assigned per service, so property_vendor_assignments needs a
 * service_type column and a uniqueness rule that includes it. The table this
 * repo creates had neither: the column was missing (every assignment query
 * failed with "Unknown column 'service_type'") and UNIQUE(property_id, vendor_id)
 * prevented one vendor from covering two services of the same property.
 *
 * schema_v31 fixes existing databases; ensureVendorAssignmentSchema keeps the
 * feature working on deployments where that migration has not been applied yet.
 */

const { pool } = require('../config/database');

const LEGACY_UNIQUE_KEY = 'unique_property_vendor';
const SERVICE_UNIQUE_KEY = 'unique_property_vendor_service';

let schemaReadyPromise = null;

const columnExists = async (table, column) => {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return (rows[0]?.n || 0) > 0;
};

const indexExists = async (table, indexName) => {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, indexName]
  );
  return (rows[0]?.n || 0) > 0;
};

/**
 * schema_v22 created after_vendor_assignment_insert with a body that reads
 * fp_estimates.service_rows - a column that does not exist (the services live in
 * package_services). The trigger aborted every INSERT into
 * property_vendor_assignments, so it has to go.
 *
 * It is dropped rather than rebuilt: CREATE TRIGGER on a server with binary
 * logging enabled needs SUPER (ER_BINLOG_CREATE_ROUTINE_NEED_SUPER), which an
 * application user does not have. syncPendingPropertySchedule below keeps
 * pending_property_schedules up to date from the application instead, so no
 * database-side trigger is required.
 */
const dropBrokenAssignmentTriggers = async () => {
  const [triggers] = await pool.execute(
    `SELECT trigger_name, action_statement FROM information_schema.triggers
     WHERE trigger_schema = DATABASE()
       AND event_object_table = 'property_vendor_assignments'`
  );

  const broken = triggers.filter(t =>
    (t.ACTION_STATEMENT || t.action_statement || '').includes('service_rows')
  );
  if (broken.length === 0) return;

  for (const trigger of broken) {
    const name = trigger.TRIGGER_NAME || trigger.trigger_name;
    await pool.query(`DROP TRIGGER IF EXISTS \`${name}\``);
    console.log(`  ✅ Dropped broken trigger ${name} (referenced fp_estimates.service_rows)`);
  }
};

/**
 * Keep pending_property_schedules in step with the assignments of one property.
 * This is what the dropped triggers used to do; doing it here needs no special
 * database privileges. Mirrors the status rules in services/schedulingService.js.
 */
const syncPendingPropertySchedule = async (propertyId) => {
  try {
    const [[property]] = await pool.execute(
      `SELECT op.id, op.franchise_partner_id,
              fe.id as estimate_id,
              JSON_LENGTH(COALESCE(fe.package_services, '[]')) as total_services
       FROM onboarded_properties op
       LEFT JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
       WHERE op.id = ?
       ORDER BY fe.id DESC
       LIMIT 1`,
      [propertyId]
    );

    // Only onboarded properties are tracked in this table
    if (!property) return;

    const [[counts]] = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM property_vendor_assignments
           WHERE property_id = ? AND is_active = 1) as assigned,
         (SELECT COUNT(*) FROM property_service_schedules
           WHERE property_id = ? AND scheduling_status IN ('scheduled', 'completed')) as scheduled`,
      [propertyId, propertyId]
    );

    const totalServices = parseInt(property.total_services) || 0;
    const assigned = parseInt(counts?.assigned) || 0;
    const scheduled = parseInt(counts?.scheduled) || 0;

    let schedulingStatus = 'pending_vendor';
    if (totalServices > 0 && assigned >= totalServices) {
      schedulingStatus = scheduled >= totalServices ? 'fully_scheduled'
        : scheduled > 0 ? 'partially_scheduled'
        : 'pending_schedule';
    }

    await pool.execute(
      `INSERT INTO pending_property_schedules
         (property_id, estimate_id, total_services, vendors_assigned, services_scheduled,
          scheduling_status, franchise_partner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         estimate_id = VALUES(estimate_id),
         total_services = VALUES(total_services),
         vendors_assigned = VALUES(vendors_assigned),
         services_scheduled = VALUES(services_scheduled),
         scheduling_status = VALUES(scheduling_status),
         updated_at = NOW()`,
      [propertyId, property.estimate_id || null, totalServices, assigned, scheduled,
        schedulingStatus, property.franchise_partner_id || null]
    );
  } catch (err) {
    // Never fail an assignment because this summary table could not be updated
    console.log('[Vendor Assignments] Could not sync pending_property_schedules:', err.message);
  }
};

const ensureVendorAssignmentSchema = () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      try {
        if (!(await columnExists('property_vendor_assignments', 'service_type'))) {
          await pool.query(
            `ALTER TABLE property_vendor_assignments ADD COLUMN service_type VARCHAR(255) NULL AFTER vendor_id`
          );
          console.log('  ✅ Added property_vendor_assignments.service_type');
        }

        // One vendor can serve several services of the same property
        if (await indexExists('property_vendor_assignments', LEGACY_UNIQUE_KEY)) {
          await pool.query(`ALTER TABLE property_vendor_assignments DROP INDEX ${LEGACY_UNIQUE_KEY}`);
          console.log(`  ✅ Dropped ${LEGACY_UNIQUE_KEY} (blocked per-service assignments)`);
        }

        if (!(await indexExists('property_vendor_assignments', SERVICE_UNIQUE_KEY))) {
          await pool.query(
            `ALTER TABLE property_vendor_assignments
             ADD UNIQUE KEY ${SERVICE_UNIQUE_KEY} (property_id, vendor_id, service_type)`
          );
          console.log(`  ✅ Added ${SERVICE_UNIQUE_KEY}`);
        }

        await dropBrokenAssignmentTriggers();
      } catch (err) {
        // Repairing needs ALTER/TRIGGER rights, which a production DB user may not
        // have. Never block the assignment on it - the write below reports the real
        // problem if the schema is genuinely unusable.
        console.log('[Vendor Assignments] Schema check could not complete:', err.message);
        console.log('[Vendor Assignments] Apply backend/database/migrations/schema_v31_vendor_assignment_service.sql as a privileged user.');
        // Let the next request retry rather than caching the failure
        schemaReadyPromise = null;
      }
    })();
  }
  return schemaReadyPromise;
};

/**
 * Resolve a vendor from either its numeric id or its VND-xxx code.
 * @returns {Promise<Object|null>} { id, company_name, owner_name }
 */
const resolveVendor = async (vendorId, { activeOnly = false } = {}) => {
  const [vendors] = await pool.execute(
    `SELECT id, company_name, owner_name FROM onboarded_vendors
     WHERE (id = ? OR vendor_id = ?)${activeOnly ? " AND status = 'active'" : ''}
     LIMIT 1`,
    [vendorId, vendorId]
  );
  return vendors[0] || null;
};

/**
 * Create or reactivate the assignment of one vendor to one service of a property.
 * Any other vendor previously covering that service is deactivated.
 *
 * @returns {Promise<{ created: boolean, alreadyActive: boolean }>}
 */
const upsertPropertyVendorAssignment = async ({ propertyId, vendorId, serviceType, assignedBy }) => {
  await ensureVendorAssignmentSchema().catch(() => {});

  const [existing] = await pool.execute(
    `SELECT id, is_active FROM property_vendor_assignments
     WHERE property_id = ? AND vendor_id = ? AND ${serviceType ? 'service_type = ?' : 'service_type IS NULL'}`,
    serviceType ? [propertyId, vendorId, serviceType] : [propertyId, vendorId]
  );

  if (existing.length > 0) {
    if (existing[0].is_active) return { created: false, alreadyActive: true };
    await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 1, assigned_at = NOW(), assigned_by = ? WHERE id = ?`,
      [assignedBy || null, existing[0].id]
    );
    await syncPendingPropertySchedule(propertyId);
    return { created: false, alreadyActive: false };
  }

  // Only one vendor per service stays active
  if (serviceType) {
    await pool.execute(
      `UPDATE property_vendor_assignments SET is_active = 0
       WHERE property_id = ? AND service_type = ? AND is_active = 1`,
      [propertyId, serviceType]
    );
  }

  await pool.execute(
    `INSERT INTO property_vendor_assignments (property_id, vendor_id, service_type, assigned_by, assigned_at, is_active)
     VALUES (?, ?, ?, ?, NOW(), 1)`,
    [propertyId, vendorId, serviceType || null, assignedBy || null]
  );

  // Keep the service schedule in step so the schedule rows show the vendor too
  if (serviceType) {
    try {
      await pool.execute(
        `UPDATE property_service_schedules
         SET vendor_id = ?, vendor_assigned_at = NOW(), vendor_assigned_by = ?
         WHERE property_id = ? AND LOWER(service_name) = LOWER(?)`,
        [vendorId, assignedBy || null, propertyId, serviceType]
      );
    } catch (err) {
      console.log('[Vendor Assignments] Could not sync property_service_schedules:', err.message);
    }
  }

  await syncPendingPropertySchedule(propertyId);

  return { created: true, alreadyActive: false };
};

module.exports = {
  ensureVendorAssignmentSchema,
  resolveVendor,
  upsertPropertyVendorAssignment,
  syncPendingPropertySchedule
};
