import { capacityForSlab } from './rangeMatch.js';

// The service rows of an AMC package form, shared by every portal that builds a package.
//
// Every change returns new row objects. The forms used to assign into the row they were holding
// (`rows[i][field] = value`), which edited React state in place and, combined with the debounced
// re-pricing below, could put back a value that had just been typed.

// What a row is priced from. A quote is only applied to a row that still has these values.
export const rowPricingKey = row => JSON.stringify([row?.catalogServiceId ?? null, row?.inputValue ?? '',
  row?.frequencyType ?? '', row?.frequencyCount ?? '']);

export const updatePackageRow = (rows, index, field, value, countMap = {}) => rows.map((row, i) => {
  if (i !== index) return row;
  if (field === 'frequencyType') {
    // Custom has no count of its own, so whatever is already typed stays to be edited
    const auto = countMap[value];
    return { ...row, frequencyType: value, frequencyCount: auto != null ? auto : row.frequencyCount };
  }
  if (field === 'frequencyCount') {
    const parsed = parseInt(value, 10);
    return { ...row, frequencyCount: value === '' || Number.isNaN(parsed) ? 0 : parsed };
  }
  // A price typed here stands until the field is cleared, at which point the quote takes over again
  if (field === 'price') return { ...row, price: value === '' ? undefined : Number(value), priceOverridden: value !== '' };
  return { ...row, [field]: value };
});

// Applies the figures a quote returned to the rows as they are now, not as they were when the
// quote was asked for. `snapshot` is the rows the quotes were computed from and `patches` the
// fields each quote sets (null for none). A row whose pricing inputs changed in the meantime is
// left alone -- its own quote is already on the way -- and every other field of every row keeps
// whatever was typed while the quote was in flight. A price typed over the quote stands.
export const applyRowPatches = (current, snapshot, patches) => {
  let changed = false;
  const rows = current.map((row, index) => {
    const patch = patches[index];
    if (!patch || !snapshot[index] || rowPricingKey(row) !== rowPricingKey(snapshot[index])) return row;
    const next = { ...row, ...patch, ...(row.priceOverridden ? { price: row.price } : {}) };
    if (!Object.keys(patch).some(key => !Object.is(next[key], row[key]))) return row;
    changed = true;
    return next;
  });
  return changed ? rows : current;
};

// A row typed in with Add Row states what the vendor charges. That figure is its price as well as
// its vendor cost: without it the row added nothing to the package unless a markup was set, so a
// package of hand-typed rows could not be saved at all.
export const packageRowFromDialog = values => {
  const vendorPrice = Number(values.price) || 0;
  return {
    service: String(values.name || '').trim(),
    description: String(values.description || '').trim(),
    category: String(values.category || '').trim(),
    frequencyType: values.frequency_type,
    frequencyCount: Number(values.frequency_count) || 0,
    pricingMethod: '',
    inputValue: values.quantity === '' || values.quantity == null ? '' : Number(values.quantity),
    vendorRequired: values.vendorRequired,
    vendorCost: vendorPrice,
    price: vendorPrice
  };
};

// A configured service picked into a package. The row keeps what it was picked from, so the
// package can price it: which service, how it is priced, the unit its amount is measured in.
//
// A package row is a template, so it opens already priceable -- one unit, area, capacity or person,
// or a slab already chosen -- rather than at ₹0 until something is typed. For a slab service that is
// the first slab with a price: a custom-quote slab cannot be quoted, so opening on one put the row
// in error before anything was typed. The slab's own schedule comes with it, as when a slab is
// picked by hand, because a service that forbids a frequency change refuses any other.
const DEFAULT_AMOUNT = { quantity_based: 1, area_based: 1, capacity_based: 1, manpower: 1 };
export const packageRowFromCatalog = (service, countMap = {}) => {
  const frequencyType = service.default_frequency || 'Monthly';
  const slabs = service.capacity_slabs || [];
  const isSlab = service.pricing_method === 'capacity_slab';
  const slab = isSlab ? slabs.find(s => s?.capacityFrom != null && String(s.capacityFrom).trim() !== '' && !s.isCustomQuote) : null;
  const rowFrequency = slab?.defaultFrequency || frequencyType;
  return {
    service: service.service_name, description: service.description || '',
    frequencyType: rowFrequency,
    frequencyCount: slab?.defaultVisitsPerYear ?? service.default_visits_per_year ?? countMap[rowFrequency] ?? 0,
    catalogServiceId: service.id, category: service.category || '',
    pricingMethod: service.pricing_method, unit: service.unit || '',
    inputValue: isSlab ? (slab ? capacityForSlab(slabs, slab) : '') : (DEFAULT_AMOUNT[service.pricing_method] ?? ''),
    // The quote refuses a property type the service does not cover, so the row remembers which
    // ones it does: that is what it is priced against until the package has a type of its own
    applicablePropertyTypes: service.applicable_property_types || [],
    allowFrequencyOverride: Boolean(service.allow_frequency_override),
    defaultFrequency: frequencyType,
    defaultVisitsPerYear: service.default_visits_per_year ?? countMap[frequencyType] ?? 0,
    // Capacity Slab prices from a table, so the row carries the table: the form lists every slab
    // and the capacity in the row decides which one applies
    ...(isSlab ? { capacitySlabs: slabs, defaultMarkupPercentage: service.default_markup_percentage } : {})
  };
};

// The fields a saved row reopens with. Older packages stored snake_case keys, so both are read.
export const packageRowFromSaved = (row, decode = value => value) => ({
  service: decode(row.service || row.name) || '',
  description: decode(row.description) || '',
  frequencyCount: row.frequency_count ?? row.frequencyCount ?? 1,
  frequencyType: row.frequency_type || row.frequencyType || 'Monthly',
  catalogServiceId: row.catalogServiceId ?? row.catalog_service_id,
  pricingMethod: row.pricingMethod || row.pricing_method || '',
  unit: decode(row.unit) || '', category: decode(row.category) || '',
  capacitySlabs: row.capacitySlabs || row.capacity_slabs,
  applicablePropertyTypes: row.applicablePropertyTypes || row.applicable_property_types,
  allowFrequencyOverride: row.allowFrequencyOverride, defaultFrequency: row.defaultFrequency,
  defaultMarkupPercentage: row.defaultMarkupPercentage, defaultVisitsPerYear: row.defaultVisitsPerYear,
  inputValue: row.inputValue ?? row.input_value ?? '',
  price: row.price, vendorCost: row.vendorCost, operatingCost: row.operatingCost,
  marginPercentage: row.marginPercentage,
  // Both were saved but not read back, so reopening a package lost a typed-over price (it was
  // re-quoted) and a "no vendor" answer
  ...(row.priceOverridden ? { priceOverridden: true } : {}),
  ...(row.vendorRequired !== undefined ? { vendorRequired: row.vendorRequired } : {})
});

// What a row is saved as. One shape for every portal, so a package reads back the same wherever it
// was made.
export const packageRowForSave = row => {
  const parsed = parseInt(row.frequencyCount, 10);
  return {
    service: String(row.service || '').trim(),
    description: String(row.description || '').trim(),
    frequencyCount: typeof row.frequencyCount === 'number' ? row.frequencyCount : (Number.isNaN(parsed) ? 0 : parsed),
    frequencyType: row.frequencyType,
    category: row.category || '', pricingMethod: row.pricingMethod || '', inputValue: row.inputValue,
    price: row.price, priceOverridden: row.priceOverridden, vendorCost: row.vendorCost,
    vendorRequired: row.vendorRequired,
    ...(row.catalogServiceId ? {
      catalogServiceId: row.catalogServiceId, unit: row.unit, applicablePropertyTypes: row.applicablePropertyTypes,
      allowFrequencyOverride: row.allowFrequencyOverride, defaultFrequency: row.defaultFrequency,
      capacitySlabs: row.capacitySlabs, defaultMarkupPercentage: row.defaultMarkupPercentage,
      defaultVisitsPerYear: row.defaultVisitsPerYear,
      operatingCost: row.operatingCost, marginPercentage: row.marginPercentage
    } : {})
  };
};

// Two packages are the same package when their names differ only in case or spacing
export const duplicatePackageName = (packages, name, exceptId) => {
  const key = String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return null;
  return (packages || []).find(pkg => {
    const id = pkg.id ?? pkg.packageId;
    if (exceptId != null && String(id) === String(exceptId)) return false;
    return String(pkg.packageName ?? pkg.name ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === key;
  }) || null;
};
