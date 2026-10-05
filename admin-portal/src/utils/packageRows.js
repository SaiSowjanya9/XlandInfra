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
