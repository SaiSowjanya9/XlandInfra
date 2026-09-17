// Category suggestions for the service form. A service may carry a custom category typed by the
// user, so the saved services themselves are a source of options: that is what makes a new
// category reappear in the dropdown afterwards, without a table of its own.
const categoryOptions = async (pool, scopeId) => {
  const names = require('../config/categories').map(category => category.name);
  const queries = [
    ['SELECT name FROM admin_categories WHERE is_active = 1 ORDER BY name', []],
    scopeId
      ? [`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.category')) AS name FROM service_catalog WHERE scope_id IN (0, ?)`, [Number(scopeId)]]
      : [`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.category')) AS name FROM service_catalog`, []]
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
