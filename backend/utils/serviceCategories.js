// Category suggestions for the service form. A service may carry a custom category typed by the
// user, so the saved services themselves are a source of options: that is what makes a new
// category reappear in the dropdown afterwards, without a table of its own.
const categoryOptions = async (pool, scopeId) => {
  const names = require('../config/categories').map(category => category.name);
  // A category typed on a hand-entered estimate service is stored on the estimate, not on a
  // service, so the estimates are a source too -- that is what brings such a category back into
  // this list after it is used once, still without a table of its own.
  const manualCategories = scopeId
    ? [`SELECT DISTINCT service.category AS name
          FROM fp_estimates,
               JSON_TABLE(fp_estimates.addons_data, '$[*]' COLUMNS (category VARCHAR(100) PATH '$.category')) AS service
         WHERE service.category IS NOT NULL AND service.category <> '' AND fp_estimates.franchise_partner_id = ?`, [Number(scopeId)]]
    : [`SELECT DISTINCT service.category AS name
          FROM fp_estimates,
               JSON_TABLE(fp_estimates.addons_data, '$[*]' COLUMNS (category VARCHAR(100) PATH '$.category')) AS service
         WHERE service.category IS NOT NULL AND service.category <> ''`, []];
  const queries = [
    ['SELECT name FROM admin_categories WHERE is_active = 1 ORDER BY name', []],
    scopeId
      ? [`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.category')) AS name FROM service_catalog WHERE scope_id IN (0, ?)`, [Number(scopeId)]]
      : [`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.category')) AS name FROM service_catalog`, []],
    manualCategories
  ];
  for (const [sql, params] of queries) {
    try {
      const [rows] = await pool.execute(sql, params);
      names.push(...rows.map(row => row.name).filter(name => typeof name === 'string' && name.trim()));
    } catch (error) {
      console.log('Category source skipped:', error.message);
    }
  }
  const seen = new Set();
  return names.filter(name => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(name => ({ name: name.trim() }));
};

module.exports = { categoryOptions };
