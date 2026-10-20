/**
 * Looking an FP employee up -- by who is calling, by id, or by the zone they cover.
 *
 * Two tables describe the same people: `users` carries the login (and is what a token's `id` is),
 * `fp_employees` carries the employment record and is the only one zones hang off
 * (`fp_employee_zones`). Zone-centric anything therefore starts here, exactly as the work-order
 * notification recipients in services/emailService.js do.
 *
 * The caller's own row is resolved by `user_id` first and only then by email/username -- never by
 * treating the token's `id` as an `fp_employees.id`. Both are auto-increment sequences, so they
 * collide constantly, and a wrong match here would hand one employee another's assigned
 * complaints.
 *
 * Regression test: `node --test backend/utils/fpEmployeeDirectory.test.js`.
 */

const { isAssignableRole, normalizeEmployeeRole } = require('./marketingComplaints');

// 'all' is the "every zone" assignment the FP's Employee Zone screen writes (one row holding the
// literal word), the same marker middleware/zoneHelper.js reads as '__ALL__'.
const ALL_ZONES = 'all';

/**
 * Bring the two employee tables up to the shape the code has long been writing. Both were found by
 * the complaint assignment picker, and both break features far older than it:
 *
 * `fp_employees.role` was declared `ENUM('fp_manager','fp_supervisor','fp_executive')` by
 * schema_v8, while the FP's Add Employee form sends 'manager', 'coordinator', 'supervisor' and
 * 'executive'. MySQL answers WARN_DATA_TRUNCATED (errno 1265) for every one of them, so where the
 * original column survives **no employee can be created at all**, and a coordinator cannot exist
 * even in principle. The same shape of bug as `payment_history.action` (see AGENTS.md). A VARCHAR
 * holds every value the ENUM did.
 *
 * `fp_employee_zones.zone_id` is `INT NOT NULL` with no default, but the zone routes insert
 * `(franchise_partner_id, fp_employee_id, zone_name)` only -- a zone is a *name* merged from
 * several sources, so there is no id to put there. Every assignment therefore failed with
 * ER_NO_DEFAULT_FOR_FIELD (errno 1364), which silently left zone-centric access inert: an employee
 * with no rows in this table falls back to "own records only" everywhere. schema_v29 added
 * `zone_name` but left `zone_id` as it was. A nullable column still satisfies its foreign key.
 *
 * Checked against information_schema because MySQL 8 has no "MODIFY COLUMN IF", and safe to re-run.
 *
 * @returns {Promise<string[]>} what this call changed, for the boot log
 */
const ensureFpEmployeeSchema = async (pool) => {
  const changed = [];
  // Aliased, because MySQL 8 reports information_schema's own columns as DATA_TYPE / IS_NULLABLE
  // whatever case the SELECT is written in -- read as `row.data_type` they come back undefined and
  // every check below quietly decides there is nothing to do. An alias is returned exactly as
  // written, so it is the one spelling both sides agree on.
  const columnType = async (table, column) => {
    const [rows] = await pool.execute(
      `SELECT DATA_TYPE AS dataType, IS_NULLABLE AS isNullable
       FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      [table, column]
    );
    return rows[0] || null;
  };

  try {
    const role = await columnType('fp_employees', 'role');
    if (role && String(role.dataType).toLowerCase() === 'enum') {
      await pool.query("ALTER TABLE fp_employees MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'executive'");
      changed.push('fp_employees.role widened to VARCHAR(50)');
    }
  } catch (e) {
    console.error('Could not widen fp_employees.role:', e.message);
  }

  try {
    if (!(await columnType('fp_employee_zones', 'zone_name'))) {
      await pool.query('ALTER TABLE fp_employee_zones ADD COLUMN zone_name VARCHAR(150) NULL');
      changed.push('fp_employee_zones.zone_name added');
    }
    const zoneId = await columnType('fp_employee_zones', 'zone_id');
    if (zoneId && String(zoneId.isNullable).toUpperCase() === 'NO') {
      await pool.query('ALTER TABLE fp_employee_zones MODIFY COLUMN zone_id INT NULL');
      changed.push('fp_employee_zones.zone_id made nullable');
    }
  } catch (e) {
    console.error('Could not bring fp_employee_zones up to date:', e.message);
  }

  return changed;
};

const EMPLOYEE_FIELDS =
  'id, franchise_partner_id, user_id, employee_code, first_name, last_name, email, username, phone, role, is_active';

const employeeName = (employee) => {
  if (!employee) return '';
  const parts = [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim();
  return parts || employee.username || employee.email || '';
};

// What a portal needs to show an employee: never the password hash, and the role in the one
// spelling the rest of the code compares against.
const presentEmployee = (employee, zones = []) => ({
  id: employee.id,
  user_id: employee.user_id || null,
  employee_code: employee.employee_code || null,
  name: employeeName(employee),
  email: employee.email || null,
  phone: employee.phone || null,
  role: normalizeEmployeeRole(employee.role),
  zones
});

/**
 * The fp_employees row for whoever is making this request, or null.
 *
 * @param {object} pool  mysql2 pool
 * @param {object} who   { franchisePartnerId, userId, email, username }
 */
const resolveFpEmployee = async (pool, { franchisePartnerId, userId, email, username } = {}) => {
  if (!franchisePartnerId) return null;
  try {
    if (userId) {
      const [rows] = await pool.execute(
        `SELECT ${EMPLOYEE_FIELDS} FROM fp_employees
         WHERE franchise_partner_id = ? AND user_id = ? AND is_active = 1 LIMIT 1`,
        [franchisePartnerId, userId]
      );
      if (rows.length) return rows[0];
    }
    const identifier = email || username;
    if (identifier) {
      const [rows] = await pool.execute(
        `SELECT ${EMPLOYEE_FIELDS} FROM fp_employees
         WHERE franchise_partner_id = ? AND (email = ? OR username = ?) AND is_active = 1 LIMIT 1`,
        [franchisePartnerId, identifier, identifier]
      );
      if (rows.length) return rows[0];
    }
  } catch (e) {
    // An employee who cannot be resolved simply has no assignments of their own; the zone and
    // partner filters still decide everything else they can see.
    console.error('FP employee lookup failed:', e.message);
  }
  return null;
};

/** One employee by id, within a partner. Null when the id belongs to another partner. */
const fetchFpEmployee = async (pool, employeeId, franchisePartnerId) => {
  const id = parseInt(employeeId, 10);
  if (!Number.isInteger(id) || !franchisePartnerId) return null;
  const [rows] = await pool.execute(
    `SELECT ${EMPLOYEE_FIELDS} FROM fp_employees
     WHERE id = ? AND franchise_partner_id = ? AND is_active = 1 LIMIT 1`,
    [id, franchisePartnerId]
  );
  return rows[0] || null;
};

/** zone names per fp_employee_id, for one partner. */
const fetchEmployeeZones = async (pool, franchisePartnerId) => {
  const map = new Map();
  try {
    const [rows] = await pool.execute(
      'SELECT fp_employee_id, zone_name FROM fp_employee_zones WHERE franchise_partner_id = ?',
      [franchisePartnerId]
    );
    for (const row of rows) {
      if (!row.zone_name) continue;
      if (!map.has(row.fp_employee_id)) map.set(row.fp_employee_id, []);
      map.get(row.fp_employee_id).push(row.zone_name);
    }
  } catch (e) {
    // No zone table or no assignments: every employee is then simply "not recommended" rather
    // than the list being empty, which would leave the FP unable to assign at all.
    console.error('FP employee zone lookup failed:', e.message);
  }
  return map;
};

/**
 * Whether an employee holding `zones` covers `zone`. Compared on the decoded, case-folded name,
 * because a zone is a name merged from several sources (see utils/zoneDelete.js) and arrives
 * HTML-escaped on the complaint.
 */
const coversZone = (zones, zone, decode = (value) => value) => {
  if (!zone) return false;
  const wanted = decode(String(zone)).trim().toLowerCase();
  if (!wanted) return false;
  return zones.some((name) => {
    const held = decode(String(name || '')).trim().toLowerCase();
    return held === ALL_ZONES || held === wanted;
  });
};

/**
 * The employees an FP may hand a complaint to, the ones covering the complaint's zone first.
 *
 * Every assignable employee is returned, not only the zone's own: a zone with nobody assigned to
 * it would otherwise be an empty picker, and the FP would have no way to act on the complaint at
 * all. `recommended` is what the picker groups by.
 */
const listAssignableEmployees = async (pool, { franchisePartnerId, zone, decode } = {}) => {
  if (!franchisePartnerId) return [];
  const [employees] = await pool.execute(
    `SELECT ${EMPLOYEE_FIELDS} FROM fp_employees
     WHERE franchise_partner_id = ? AND is_active = 1
     ORDER BY first_name, last_name`,
    [franchisePartnerId]
  );
  const zoneMap = await fetchEmployeeZones(pool, franchisePartnerId);
  return employees
    .filter((employee) => isAssignableRole(employee.role))
    .map((employee) => {
      const zones = zoneMap.get(employee.id) || [];
      return { ...presentEmployee(employee, zones), recommended: coversZone(zones, zone, decode) };
    })
    .sort((a, b) => (b.recommended === a.recommended ? 0 : b.recommended ? 1 : -1));
};

module.exports = {
  ALL_ZONES,
  ensureFpEmployeeSchema,
  employeeName,
  presentEmployee,
  resolveFpEmployee,
  fetchFpEmployee,
  fetchEmployeeZones,
  coversZone,
  listAssignableEmployees
};
