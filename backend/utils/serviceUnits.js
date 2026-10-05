// Unit suggestions for the service form's Unit / Capacity Unit box, the same way serviceCategories.js
// answers for its Category box: the built-in unit master, any unit a saved service already uses, and
// the units typed into the box and saved with its "Save" row.
//
// A saved unit belongs to a unit type (capacity, area, count ...), not to one pricing method, so a
// capacity unit added on a Capacity Slab service is offered on Capacity Based as well.
const { unitOptionsFor, unitTypeFor, CUSTOM_UNIT_TYPES } = require('./servicePricing');
const { decodeEntities } = require('./htmlEntities');

const MAX_NAME_LENGTH = 40;
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const key = name => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// CREATE TABLE IF NOT EXISTS is valid on MySQL 8 (only ADD COLUMN / CREATE INDEX IF NOT EXISTS are
// not), so the table is made the first time it is needed rather than waiting on a manual migration.
// See database/migrations/schema_v41_service_units.sql for the same statement.
const ensured = new WeakSet();
const ensureTable = async pool => {
  if (ensured.has(pool)) return;
  await pool.execute(`CREATE TABLE IF NOT EXISTS service_units (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    scope_id INT UNSIGNED NOT NULL DEFAULT 0,
    unit_type VARCHAR(20) NOT NULL,
    name VARCHAR(40) NOT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_units_name_type_scope (name, unit_type, scope_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  ensured.add(pool);
};

// A missing table or column must not cost the whole dropdown, so a failing source is skipped
const read = async (pool, sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.log('Unit source skipped:', error.message);
    return [];
  }
};

const methodsOfType = type => Object.keys(CUSTOM_UNIT_TYPES).filter(method => CUSTOM_UNIT_TYPES[method] === type);

// Units saved services of the same unit type already carry. They are in use, so never removable.
const usedUnits = async (pool, scopeId, type) => {
  const scope = Number(scopeId) || 0;
  const rows = await read(pool, scope
    ? `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.unit')) AS name, JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.pricing_method')) AS method FROM service_catalog WHERE scope_id IN (0, ?)`
    : `SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.unit')) AS name, JSON_UNQUOTE(JSON_EXTRACT(configuration, '$.pricing_method')) AS method FROM service_catalog`,
  scope ? [scope] : []);
  const methods = methodsOfType(type);
  return rows.filter(row => methods.includes(row.method) && typeof row.name === 'string' && row.name.trim())
    .map(row => decodeEntities(row.name).trim());
};

const savedRows = async (pool, scopeId, type) => {
  const scope = Number(scopeId) || 0;
  const rows = await read(pool, scope
    ? 'SELECT id, name FROM service_units WHERE unit_type = ? AND scope_id IN (0, ?) ORDER BY name'
    : 'SELECT id, name FROM service_units WHERE unit_type = ? ORDER BY name', scope ? [type, scope] : [type]);
  return rows.map(row => ({ id: row.id, name: decodeEntities(row.name).trim() }));
};

const requireMethod = pricingMethod => {
  const type = unitTypeFor(pricingMethod);
  if (!type) fail('Select a pricing method first.');
  return type;
};

// Built-in units first, in the master's own order, then everything else alphabetically
const unitOptions = async (pool, scopeId, pricingMethod) => {
  const type = requireMethod(pricingMethod);
  const builtIn = unitOptionsFor(pricingMethod);
  const [used, saved] = await Promise.all([usedUnits(pool, scopeId, type), savedRows(pool, scopeId, type)]);
  const inUse = new Set([...builtIn, ...used].map(key));
  const options = [];
  const seen = new Set();
  const push = (name, extra) => {
    const identity = key(name);
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    options.push({ name, id: null, removable: false, builtIn: false, ...extra });
  };
  builtIn.forEach(name => push(name, { builtIn: true }));
  [...used].sort((a, b) => a.localeCompare(b)).forEach(name => push(name));
  saved.forEach(row => push(row.name, { id: row.id, removable: !inUse.has(key(row.name)) }));
  return options;
};

// What validateService may accept beyond the master list for this method
const customUnitNames = async (pool, scopeId, pricingMethod) => {
  if (!unitTypeFor(pricingMethod)) return [];
  return (await unitOptions(pool, scopeId, pricingMethod)).filter(option => !option.builtIn).map(option => option.name);
};

// Saving a unit the list already offers is not an error and inserts nothing: the box ends up holding
// the existing spelling, which is how the same unit is never listed twice.
const addUnit = async (pool, scopeId, pricingMethod, rawName, userId = null) => {
  const type = requireMethod(pricingMethod);
  const name = decodeEntities(String(rawName ?? '')).trim().replace(/\s+/g, ' ');
  if (!name) fail('Enter a unit name.');
  if (name.length > MAX_NAME_LENGTH) fail(`A unit name can be at most ${MAX_NAME_LENGTH} characters.`);
  const existing = (await unitOptions(pool, scopeId, pricingMethod)).find(option => key(option.name) === key(name));
  if (existing) return existing;
  const scope = Number(scopeId) || 0;
  await ensureTable(pool);
  try {
    const [result] = await pool.execute('INSERT INTO service_units (scope_id, unit_type, name, created_by) VALUES (?, ?, ?, ?)',
      [scope, type, name, userId ?? null]);
    return { name, id: result.insertId, removable: true, builtIn: false };
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') throw error;
    const [[row]] = await pool.execute('SELECT id, name FROM service_units WHERE name = ? AND unit_type = ? AND scope_id = ?', [name, type, scope]);
    return { name: row?.name || name, id: row?.id ?? null, removable: true, builtIn: false };
  }
};

// Only a unit this table holds, and only while no saved service uses it
const removeUnit = async (pool, scopeId, rawId) => {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) fail('Select a unit to delete.');
  await ensureTable(pool);
  const [[row]] = await pool.execute('SELECT id, scope_id, unit_type, name FROM service_units WHERE id = ?', [id]);
  if (!row) fail('Unit not found.', 404);
  const scope = Number(scopeId) || 0;
  if (scope && Number(row.scope_id) !== scope) fail('Only units added for your franchise can be deleted.', 403);
  const method = methodsOfType(row.unit_type)[0];
  const option = method && (await unitOptions(pool, scope, method)).find(item => Number(item.id) === id);
  if (!option?.removable) fail('This unit is used by a saved service, so it cannot be deleted.', 409);
  await pool.execute('DELETE FROM service_units WHERE id = ?', [id]);
  return { id, name: row.name };
};

module.exports = { unitOptions, customUnitNames, addUnit, removeUnit, ensureTable };
