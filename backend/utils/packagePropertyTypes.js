// An AMC package applies to one or more property types, so the same package is configured once
// instead of being recreated per type. The list lives in the package's services JSON, and the
// single `property_type` is kept as the first entry so older readers and SQL filters still work.
const TYPES = ['GC', 'APT', 'FLAT', 'VILLA', 'PLOT'];

const normalizeType = value => {
  const upper = String(value || '').toUpperCase().replace(/[_\s-]/g, '');
  if (upper.includes('GATED') || upper === 'GC') return 'GC';
  if (upper.includes('APARTMENT') || upper === 'APT') return 'APT';
  if (upper.includes('VILLA')) return 'VILLA';
  if (upper.includes('FLAT')) return 'FLAT';
  if (upper.includes('PLOT')) return 'PLOT';
  return upper;
};

// Accepts either the new list or a single legacy value, in either naming style
const packagePropertyTypes = body => {
  const list = body?.property_types ?? body?.propertyTypes;
  const values = Array.isArray(list) && list.length ? list : [body?.property_type ?? body?.propertyType];
  const normalized = [...new Set(values.map(normalizeType).filter(type => TYPES.includes(type)))];
  if (!normalized.length) {
    throw Object.assign(new Error('Select at least one property type for this package.'), { status: 400 });
  }
  return normalized;
};

// Two packages of one FP are the same package when their names differ only in case or spacing.
// The forms already warn, but a name reaching the API any other way made a second entry nobody
// could tell apart in the estimate's package list. Stored names are HTML-escaped, so both sides
// are compared decoded. Mirrors duplicatePackageName in admin-portal/src/utils/packageRows.js.
const { decodeEntities } = require('./htmlEntities');
const packageNameKey = name => decodeEntities(String(name ?? '')).trim().replace(/\s+/g, ' ').toLowerCase();

const assertUniquePackageName = async (db, fpId, name, exceptId = null) => {
  const key = packageNameKey(name);
  if (!key) throw Object.assign(new Error('Package name is required'), { status: 400 });
  const [rows] = await db.execute('SELECT id, name FROM fp_amc_packages WHERE franchise_partner_id = ?', [fpId]);
  const clash = rows.find(row => packageNameKey(row.name) === key && String(row.id) !== String(exceptId));
  if (clash) throw Object.assign(new Error(`A package named "${decodeEntities(clash.name)}" already exists.`), { status: 409 });
};

module.exports = { packagePropertyTypes, normalizePackagePropertyType: normalizeType, PACKAGE_PROPERTY_TYPES: TYPES,
  assertUniquePackageName, packageNameKey };
