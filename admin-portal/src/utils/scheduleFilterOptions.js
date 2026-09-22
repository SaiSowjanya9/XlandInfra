/**
 * Filter options for the schedules sections.
 *
 * Every dropdown in a schedules section offers only the values that appear in that section's own
 * rows: the Cancelled list offers the vendors of cancelled visits, Rescheduled Requests the vendors
 * of reschedule requests, and so on. Fetching the master vendor, service or zone list instead
 * offered values that match nothing in the section, and hardcoded lists ("Basic AMC", "Zone A")
 * offered values that may not exist at all.
 *
 * The schedules endpoints name the same field differently (serviceName, service, service_name), a
 * zone arrives as a string or as an object, and a property carries several vendors, so reading a
 * field goes through here rather than being repeated per page.
 */

const FIELD_KEYS = {
  service: ['serviceName', 'service', 'service_name', 'serviceCategory', 'title'],
  vendor: ['vendorNames', 'vendorName', 'vendor', 'vendor_name', 'companyName', 'company_name'],
  zone: ['zone', 'zoneName', 'zone_name'],
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

export function scheduleFieldValues(row, field) {
  const keys = FIELD_KEYS[field];
  if (!row || !keys) return [];
  for (const key of keys) {
    const values = readValues(row[key]);
    if (values.length) return values;
  }
  return [];
}

export function scheduleFieldValue(row, field) {
  return scheduleFieldValues(row, field)[0] || '';
}

// Options stay in sync with the section's full row set, and deliberately do not shrink as other
// filters are applied: a selection should never make the remaining dropdowns collapse.
export function scheduleFilterOptions(rows, field) {
  const values = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const value of scheduleFieldValues(row, field)) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function matchesScheduleFilter(row, field, value, allValue = 'all') {
  if (value === undefined || value === null || value === '' || value === allValue) return true;
  return scheduleFieldValues(row, field).includes(value);
}
