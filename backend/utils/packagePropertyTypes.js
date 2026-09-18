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

module.exports = { packagePropertyTypes, normalizePackagePropertyType: normalizeType, PACKAGE_PROPERTY_TYPES: TYPES };
