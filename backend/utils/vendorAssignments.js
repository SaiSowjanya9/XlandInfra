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
 * package_services). The trigger therefore aborted every INSERT into
 * property_vendor_assignments. Recreate it with the correct column.
 */
const repairAssignmentTriggers = async () => {
  const [triggers] = await pool.execute(
    `SELECT trigger_name, action_statement FROM information_schema.triggers
     WHERE trigger_schema = DATABASE()
       AND event_object_table = 'property_vendor_assignments'`
  );

  const broken = triggers.some(t => (t.ACTION_STATEMENT || t.action_statement || '').includes('service_rows'));
  const insertTriggerMissing = !triggers.some(
    t => (t.TRIGGER_NAME || t.trigger_name) === 'after_vendor_assignment_insert'
  );
  if (!broken && !insertTriggerMissing) return;

  await pool.query(`DROP TRIGGER IF EXISTS after_vendor_assignment_insert`);
  await pool.query(`DROP TRIGGER IF EXISTS after_vendor_assignment_update`);

  await pool.query(`
    CREATE TRIGGER after_vendor_assignment_insert
    AFTER INSERT ON property_vendor_assignments
    FOR EACH ROW
    BEGIN
      DECLARE prop_fp_id INT;
      DECLARE est_id INT;
      DECLARE total_svc INT;
      DECLARE assigned_cnt INT;

      SELECT op.franchise_partner_id, fe.id INTO prop_fp_id, est_id
      FROM onboarded_properties op
      LEFT JOIN fp_estimates fe ON fe.property_id = op.id AND fe.status = 'approved'
      WHERE op.id = NEW.property_id
      LIMIT 1;

      SELECT JSON_LENGTH(COALESCE(package_services, '[]')) INTO total_svc
      FROM fp_estimates WHERE property_id = NEW.property_id AND status = 'approved'
      LIMIT 1;

      SELECT COUNT(*) INTO assigned_cnt
      FROM property_vendor_assignments
      WHERE property_id = NEW.property_id AND is_active = 1;

      IF prop_fp_id IS NOT NULL THEN
        INSERT INTO pending_property_schedules (property_id, estimate_id, total_services, vendors_assigned, franchise_partner_id, scheduling_status)
        VALUES (NEW.property_id, est_id, COALESCE(total_svc, 0), assigned_cnt, prop_fp_id,
          CASE WHEN assigned_cnt >= COALESCE(total_svc, 0) THEN 'pending_schedule' ELSE 'pending_vendor' END
        )
        ON DUPLICATE KEY UPDATE
          vendors_assigned = assigned_cnt,
          scheduling_status = CASE WHEN assigned_cnt >= total_services THEN 'pending_schedule' ELSE 'pending_vendor' END,
          updated_at = NOW();
      END IF;
    END
  `);

  await pool.query(`
    CREATE TRIGGER after_vendor_assignment_update
    AFTER UPDATE ON property_vendor_assignments
    FOR EACH ROW
    BEGIN
      DECLARE assigned_cnt INT;
      DECLARE total_svc INT;

      SELECT COUNT(*) INTO assigned_cnt
      FROM property_vendor_assignments
      WHERE property_id = NEW.property_id AND is_active = 1;

      SELECT total_services INTO total_svc
      FROM pending_property_schedules
      WHERE property_id = NEW.property_id;

      UPDATE pending_property_schedules SET
        vendors_assigned = assigned_cnt,
        scheduling_status = CASE WHEN assigned_cnt >= COALESCE(total_svc, 0) THEN 'pending_schedule' ELSE 'pending_vendor' END,
        updated_at = NOW()
      WHERE property_id = NEW.property_id;
    END
  `);

  console.log('  ✅ Rebuilt property_vendor_assignments triggers (service_rows -> package_services)');
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

        await repairAssignmentTriggers();
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

  return { created: true, alreadyActive: false };
};

module.exports = {
  ensureVendorAssignmentSchema,
  resolveVendor,
  upsertPropertyVendorAssignment
};
