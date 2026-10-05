// Category suggestions for the service form. A service may carry a custom category typed by the
// user, so the saved services themselves are a source of options: that is what makes a new
// category reappear in the dropdown afterwards, without a table of its own.
//
// `service_categories` is the one exception, and the only source a category can be deleted from
// again: a name saved with the tick in the Category box is stored there straight away, before any
// service, estimate or package carries it. Everything else here is a name already in use, which is
// why only a `service_categories` row that nothing else offers comes back as `removable`.
//
// Every name is stored HTML-escaped (middleware/security.js escapes each request) and handed back
// decoded, so "Lift/Elevator" reads as typed rather than "Lift&#x2F;Elevator", and is one entry
// whether it was saved once or saved again after being loaded into a form.
const { decodeEntities } = require('./htmlEntities');
const { sanitizeString } = require('../middleware/security');

const MAX_NAME_LENGTH = 100;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const key = name => decodeEntities(String(name ?? '')).trim().replace(/\s+/g, ' ').toLowerCase();

// A missing table or column must not cost the whole dropdown, so a failing source is skipped.
// Adding and deleting use pool.execute directly: there the error is the answer.
const read = async (pool, sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.log('Category source skipped:', error.message);
    return [];
  }
};

// Every source other than service_categories: a name here is either built in or already saved on
// something, so it is offered but cannot be deleted.
const inheritedNames = async (pool, scopeId) => {
  const scope = Number(scopeId) || 0;
  const names = require('../config/categories').map(category => category.name);
  // A category typed on a hand-entered estimate service is stored on the estimate, not on a
  // service, so the estimates are a source too -- that is what brings such a category back into
  // this list after it is used once, still without a table of its own.
  const manualCategories = scope
    ? [`SELECT DISTINCT service.category AS name
          FROM fp_estimates,
               JSON_TABLE(fp_estimates.addons_data, '$[*]' COLUMNS (category VARCHAR(100) PATH '$.category')) AS service
         WHERE service.category IS NOT NULL AND service.category <> '' AND fp_estimates.franchise_partner_id = ?`, [scope]]
    : [`SELECT DISTINCT service.category AS name
          FROM fp_estimates,
               JSON_TABLE(fp_estimates.addons_data, '$[*]' COLUMNS (category VARCHAR(100) PATH '$.category')) AS service
         WHERE service.category IS NOT NULL AND service.category <> ''`, []];
  // A category typed on an AMC package's service row is stored on the package, which was not a
  // source -- so such a category was accepted, saved, and then never offered again. The packages
  // are read the same way the estimates are.
  const packageCategories = scope
    ? [`SELECT DISTINCT service.category AS name
          FROM fp_amc_packages,
               JSON_TABLE(fp_amc_packages.services, '$[*]' COLUMNS (category VARCHAR(100) PATH '$.category')) AS service
         WHERE service.category IS NOT NULL AND service.category <> '' AND fp_amc_packages.franchise_partner_id = ?`, [scope]]
    : [`SELECT DISTINCT service.category AS name
          FROM fp_amc_packages,
               JSON_TABLE(fp_amc_packages.services, '$[*]' COLUMNS (category VARCHAR(100) PATH '$.category')) AS service
         WHERE service.category IS NOT NULL AND service.category <> ''`, []];
  const queries = [
    ['SELECT name FROM admin_categories WHERE is_active = 1 ORDER BY name', []],
    packageCategories,
    scope
      ? [`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.category')) AS name FROM service_catalog WHERE scope_id IN (0, ?)`, [scope]]
      : [`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.category')) AS name FROM service_catalog`, []],
    manualCategories
  ];
  for (const [sql, params] of queries) {
    names.push(...(await read(pool, sql, params)).map(row => row.name));
  }
  return names.filter(name => typeof name === 'string' && name.trim());
};

// An FP sees the shared categories and its own; the admin scope (0) sees every one of them, the
// same way it lists every service.
const savedRows = (pool, scopeId) => Number(scopeId)
  ? read(pool, 'SELECT id, name FROM service_categories WHERE scope_id IN (0, ?) ORDER BY name', [Number(scopeId)])
  : read(pool, 'SELECT id, name FROM service_categories ORDER BY name', []);

const categoryOptions = async (pool, scopeId) => {
  const [inherited, saved] = await Promise.all([inheritedNames(pool, scopeId), savedRows(pool, scopeId)]);
  const inUse = new Set(inherited.map(key));
  const options = [];
  const seen = new Set();
  const push = (name, { id = null, removable = false } = {}) => {
    const identity = key(name);
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    options.push({ name: decodeEntities(String(name)).trim(), id, removable });
  };
  inherited.forEach(name => push(name));
  // A name this table holds that something else already offers keeps that first entry, so it stays
  // in the list without a cross: deleting the row would not take the name out of the dropdown.
  saved.forEach(row => push(row.name, { id: row.id, removable: !inUse.has(key(row.name)) }));
  return options;
};

// Saving a name the list already offers is not an error: the box ends up holding what was typed,
// which is all the tick promises. Nothing is inserted in that case.
const addCategory = async (pool, scopeId, rawName, userId = null) => {
  const name = decodeEntities(String(rawName ?? '')).trim().replace(/\s+/g, ' ');
  if (!name) fail('Enter a category name.');
  if (name.length > MAX_NAME_LENGTH) fail(`A category name can be at most ${MAX_NAME_LENGTH} characters.`);
  const existing = (await categoryOptions(pool, scopeId)).find(option => key(option.name) === key(name));
  if (existing) return existing;
  const scope = Number(scopeId) || 0;
  // Stored escaped, the way every other name the list reads from is stored
  const storedName = sanitizeString(name);
  try {
    const [result] = await pool.execute('INSERT INTO service_categories (scope_id, name, created_by) VALUES (?, ?, ?)',
      [scope, storedName, userId ?? null]);
    return { name, id: result.insertId, removable: true };
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
    // Two people typed the same new category at once; the one already stored is the answer
    const [[row]] = await pool.execute('SELECT id, name FROM service_categories WHERE name = ? AND scope_id = ?', [storedName, scope]);
    return { name: row?.name ? decodeEntities(row.name) : name, id: row?.id ?? null, removable: true };
  }
};

// Only a row of this table can be deleted, and only while nothing uses the name: a category a
// saved service, package or estimate carries would simply reappear in the list, so refusing is
// honest where a silent no-op is not.
const removeCategory = async (pool, scopeId, rawId) => {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('Select a category to delete.');
  const [[row]] = await pool.execute('SELECT id, scope_id, name FROM service_categories WHERE id = ?', [id]);
  if (!row) fail('Category not found.', 404);
  const scope = Number(scopeId) || 0;
  if (scope && Number(row.scope_id) !== scope) fail('Only categories added for your franchise can be deleted.', 403);
  const option = (await categoryOptions(pool, scope)).find(item => Number(item.id) === id);
  if (!option?.removable) fail('This category is used by a saved service, package or estimate, so it cannot be deleted.', 409);
  await pool.execute('DELETE FROM service_categories WHERE id = ?', [id]);
  return { id, name: row.name };
};

module.exports = { categoryOptions, addCategory, removeCategory };
