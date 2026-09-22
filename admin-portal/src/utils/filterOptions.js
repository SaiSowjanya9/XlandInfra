/**
 * Filter options derived from the rows of a list.
 *
 * A filter dropdown offers only the values that appear in the list it filters: the Cancelled
 * schedules list offers the vendors of cancelled visits, the Manager vendor list offers the zones
 * its vendors work in. Fetching the master vendor, service or zone list instead offered values
 * that match nothing on the page, and hardcoded lists ("Basic AMC", "Zone A") offered values that
 * may not exist at all. Fixed enumerations - status, payment method, property type - are not this:
 * they stay declared in the page.
 *
 * The endpoints name the same field differently (serviceName, service, service_name), a zone
 * arrives as a string or as an object, and a property carries several vendors, so reading a field
 * goes through here rather than being repeated per page.
 */

const FIELD_KEYS = {
  service: ['serviceName', 'service', 'service_name', 'serviceCategory', 'title'],
  vendor: ['vendorNames', 'vendorName', 'vendor', 'vendor_name', 'companyName', 'company_name'],
  // zone_name first: a vendor row carries the name there and may keep an id under zone.
  // An employee is assigned several zones instead of having one.
  zone: ['zone_name', 'zoneName', 'zone', 'assignedZones', 'assigned_zones'],
  package: ['packageName', 'package', 'package_name'],
  status: ['status'],
  propertyType: ['propertyType', 'property_type']
};

const NAME_KEYS = ['name', 'zone_name', 'zone', 'label', 'company_name', 'companyName', 'owner_name', 'ownerName'];

// A value can arrive as a string, as a { name } object, or as a list of either.
function readValues(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(readValues);
  if (typeof value === 'object') return NAME_KEYS.map(key => value[key]).flatMap(readValues);
  const text = String(value).trim();
  return text ? [text] : [];
}

export function fieldValues(row, field) {
  const keys = FIELD_KEYS[field];
  if (!row || !keys) return [];
  for (const key of keys) {
    const values = readValues(row[key]);
    if (values.length) return values;
  }
  return [];
}

export function fieldValue(row, field) {
  return fieldValues(row, field)[0] || '';
}

// Options stay in sync with the section's full row set, and deliberately do not shrink as other
// filters are applied: a selection should never make the remaining dropdowns collapse.
export function filterOptions(rows, field) {
  const values = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const value of fieldValues(row, field)) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function matchesFilter(row, field, value, allValue = 'all') {
  if (value === undefined || value === null || value === '' || value === allValue) return true;
  return fieldValues(row, field).includes(value);
}
