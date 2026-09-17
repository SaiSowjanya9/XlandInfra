// FP properties live in both `properties` and `onboarded_properties`, and the estimate payload
// carries only an id, so ownership is confirmed against either table for the signed-in FP.
// A deployment missing one of the tables must not block estimates: if neither table could be
// queried the check reports true, because it could not establish that the property is foreign.
const propertyBelongsToFp = async (pool, propertyId, fpId) => {
  if (!Number.isSafeInteger(Number(propertyId)) || Number(propertyId) <= 0) return false;
  if (!Number.isSafeInteger(Number(fpId)) || Number(fpId) <= 0) return false;
  let checked = false;
  for (const table of ['properties', 'onboarded_properties']) {
    try {
      const [rows] = await pool.execute(`SELECT id FROM ${table} WHERE id = ? AND franchise_partner_id = ? LIMIT 1`, [Number(propertyId), Number(fpId)]);
      checked = true;
      if (rows.length) return true;
    } catch (error) {
      console.log(`Property ownership check skipped for ${table}:`, error.message);
    }
  }
  return !checked;
};

module.exports = { propertyBelongsToFp };
