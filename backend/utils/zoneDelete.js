// The zone pickers merge several sources into one list and stamp each row with a
// prefixed id: a bare number is a global `zones` row, 'fp-<id>' an `fp_zones` row, and
// 'onboarded-'/'prop-'/'schedule-'/'custom-' ids are names that only exist as text on a
// property. Deleting therefore means resolving the name behind the id and removing it
// from every source -- a row deleted from only one table resurfaces on the next fetch.

const { pool } = require('../config/database');

// fp_zones lets each employee portal record who created a zone; the columns differ per
// portal, so the owner column is passed in and whitelisted here rather than interpolated
// from a request.
const FP_ZONE_OWNER_COLUMNS = new Set(['manager_id', 'coordinator_id', 'supervisor_id', 'executive_id']);

const resolveZoneName = async (rawId, { franchisePartnerId = null, ownerColumn = null, ownerId = null } = {}) => {
  const id = String(rawId);
  if (/^\d+$/.test(id)) {
    const [rows] = await pool.execute('SELECT name FROM zones WHERE id = ?', [parseInt(id, 10)]);
    return rows[0]?.name || null;
  }
  if (id.startsWith('fp-')) {
    const fpZoneId = id.slice(3);
    if (!/^\d+$/.test(fpZoneId)) return null;
    const owners = [];
    const params = [parseInt(fpZoneId, 10)];
    if (franchisePartnerId) { owners.push('franchise_partner_id = ?'); params.push(franchisePartnerId); }
    if (ownerId && FP_ZONE_OWNER_COLUMNS.has(ownerColumn)) { owners.push(`${ownerColumn} = ?`); params.push(ownerId); }
    const where = owners.length ? `id = ? AND (${owners.join(' OR ')})` : 'id = ?';
    try {
      const [rows] = await pool.execute(`SELECT name FROM fp_zones WHERE ${where}`, params);
      return rows[0]?.name || null;
    } catch (_) {
      return null;
    }
  }
  for (const prefix of ['onboarded-', 'prop-', 'schedule-', 'custom-']) {
    if (id.startsWith(prefix)) return id.slice(prefix.length) || null;
  }
  return null;
};

// Removes a zone name everywhere it can appear. `franchisePartnerId` limits the cleanup
// to one franchise's data (portal deletes); `includeGlobal` additionally deactivates the
// company-wide `zones` row and drops the FP scope, which is what an admin delete uses.
// `ownerColumn`/`ownerId` let an employee with no FP still remove an fp_zones row they
// created themselves. Tables that may not exist on a deployment are tried and skipped.
const deleteZoneByName = async (zoneName, { includeGlobal = false, franchisePartnerId = null, ownerColumn = null, ownerId = null } = {}) => {
  if (includeGlobal) {
    await pool.execute('UPDATE zones SET is_active = 0 WHERE name = ?', [zoneName]);
  }

  try {
    if (includeGlobal) {
      await pool.execute('UPDATE fp_zones SET is_active = 0 WHERE name = ?', [zoneName]);
    } else {
      const owners = [];
      const params = [zoneName];
      if (franchisePartnerId) { owners.push('franchise_partner_id = ?'); params.push(franchisePartnerId); }
      if (ownerId && FP_ZONE_OWNER_COLUMNS.has(ownerColumn)) { owners.push(`${ownerColumn} = ?`); params.push(ownerId); }
      if (owners.length) {
        await pool.execute(`UPDATE fp_zones SET is_active = 0 WHERE name = ? AND (${owners.join(' OR ')})`, params);
      }
    }
  } catch (_) {}

  // Everything below is per-franchise data; an employee with no FP scope may only touch
  // their own fp_zones rows above.
  const scope = franchisePartnerId && !includeGlobal ? ' AND franchise_partner_id = ?' : '';
  if (!includeGlobal && !franchisePartnerId) return;
  const params = franchisePartnerId && !includeGlobal ? [zoneName, franchisePartnerId] : [zoneName];

  // onboarded_properties.zone is NOT NULL, so detach with '' -- the zone lists filter out
  // both NULL and ''. properties.zone_id stores the name as a VARCHAR and takes NULL.
  try { await pool.execute(`UPDATE onboarded_properties SET zone = '' WHERE zone = ?${scope}`, params); } catch (_) {}
  try { await pool.execute(`UPDATE properties SET zone_id = NULL WHERE zone_id = ?${scope}`, params); } catch (_) {}
  try { await pool.execute(`DELETE FROM fp_employee_zones WHERE zone_name = ?${scope}`, params); } catch (_) {}
};

module.exports = { resolveZoneName, deleteZoneByName };
