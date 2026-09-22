export const formatCurrency = (amt) => {
  const num = parseFloat(amt);
  const value = isNaN(num) ? 0 : num;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value);
};

export const parsePackageServicesData = (pkg) => {
  let servicesData = pkg?.services || pkg?.services_data || pkg?.serviceRows;
  if (typeof servicesData === 'string') {
    try { servicesData = JSON.parse(servicesData); } catch (e) { return {}; }
  }
  return servicesData || {};
};

export const getPackageId = (pkg) => (pkg?.id ?? pkg?.packageId ?? pkg?.package_id)?.toString();

export const getPackageName = (pkg) => pkg?.name || pkg?.packageName || pkg?.package_name || 'AMC Package';

export const getPackagePrice = (pkg) => parseFloat(pkg?.price ?? pkg?.base_price ?? pkg?.totalPrice ?? pkg?.total_price ?? pkg?.rate ?? pkg?.total_rate) || 0;

export const getPackageServices = (pkg) => {
  const servicesData = parsePackageServicesData(pkg);
  return servicesData?.serviceRows || servicesData?.services || (Array.isArray(servicesData) ? servicesData : []);
};

export const getPackageBillingDuration = (pkg) => {
  const servicesData = parsePackageServicesData(pkg);
  return servicesData?.billing_duration || pkg?.billing_duration || pkg?.billingDuration || 'monthly';
};

// Kept local so this module stays dependency-free; mirrors estimateStore's normalizePropertyType
const normalizeType = (type) => {
  if (!type) return '';
  const upper = String(type).toUpperCase().replace(/[_\s-]/g, '');
  if (upper.includes('GATED') || upper === 'GC') return 'GC';
  if (upper.includes('APARTMENT') || upper === 'APT') return 'APT';
  if (upper.includes('VILLA')) return 'VILLA';
  if (upper.includes('FLAT')) return 'FLAT';
  if (upper.includes('PLOT')) return 'PLOT';
  return upper;
};

// A package may apply to several property types. Older packages carry a single one, so both shapes
// resolve to the same list and nothing needs migrating.
export const getPackagePropertyTypes = (pkg) => {
  const servicesData = parsePackageServicesData(pkg);
  const list = servicesData?.property_types || pkg?.property_types || pkg?.propertyTypes;
  if (Array.isArray(list) && list.length) return [...new Set(list.map(normalizeType).filter(Boolean))];
  const single = normalizeType(servicesData?.property_type || pkg?.property_type || pkg?.propertyType);
  return single ? [single] : [];
};

// The first type, for the places that display one value
export const getPackagePropertyType = (pkg) => getPackagePropertyTypes(pkg)[0] || '';

export const packageMatchesPropertyType = (pkg, type) => {
  const wanted = normalizeType(type);
  return Boolean(wanted) && getPackagePropertyTypes(pkg).includes(wanted);
};

export const getAddonId = (addon) => (addon?.id ?? addon?.addonId ?? addon?.addon_id)?.toString();

export const getAddonName = (addon) => addon?.service_name || addon?.name || addon?.serviceName || addon?.services?.[0]?.name || 'Add-on Service';

export const getAddonPrice = (addon) => {
  if (typeof addon === 'number') return addon;
  const nestedTotal = addon?.services?.reduce((sum, service) => sum + (Number(service.price) || 0) * (Number(service.frequencyCount ?? service.frequency_count ?? service.frequency ?? 1) || 0), 0);
  const price = addon?.catalogServiceId ? addon.totalPrice ?? addon.pricingSnapshot?.totalPrice ?? addon.price : addon?.price ?? addon?.totalPrice ?? addon?.total_price;
  return Number(price ?? addon?.calculatedPrice ?? nestedTotal ?? 0) || 0;
};

/**
 * The unit master. Every unit belongs to exactly one unit type, and a pricing method offers the
 * types it actually measures, so Area Based lists only area units and Manpower only headcount and
 * billing units. Mirrors UNIT_TYPES and METHOD_UNITS in backend/utils/servicePricing.js, which
 * validates the unit on save, so a unit added on one side must be added on the other.
 */
export const UNIT_TYPES = [
  { type: 'count', label: 'Count / Quantity', units: ['Nos', 'Unit', 'Each', 'Lift', 'Camera', 'Tank', 'Generator', 'AC Unit', 'Motor', 'Pump', 'System', 'Flat', 'Villa', 'Plot', 'Room', 'Floor'] },
  { type: 'area', label: 'Area', units: ['Sq Ft', 'Sq M', 'Sq Yard', 'Acre'] },
  // 'Persons' is a capacity rating, as in a lift rated for 10 persons; a headcount is 'Person'
  { type: 'capacity', label: 'Capacity', units: ['KL', 'Liter', 'LPH', 'KVA', 'kW', 'HP', 'Ton', 'KG', 'Persons'] },
  { type: 'manpower', label: 'Manpower', units: ['Person', 'Staff', 'Guard', 'Worker', 'Technician', 'Housekeeper', 'Supervisor'] },
  { type: 'billing', label: 'Time / Billing', units: ['Visit', 'Hour', 'Day', 'Shift', 'Month', 'Year'] },
  { type: 'general', label: 'General', units: ['Job', 'Service', 'Package', 'Lot', 'Lump Sum'] }
];
const unitsOfType = (type) => UNIT_TYPES.find(item => item.type === type)?.units ?? [];
// Fixed Price bills per visit, service or job, so it takes those three rather than every time and
// general unit: its unit is also its Primary Input, and 'Lot' measures nothing a visit can bill.
const METHOD_UNITS = {
  fixed_price: ['Visit', 'Service', 'Job'],
  quantity_based: unitsOfType('count'),
  area_based: unitsOfType('area'),
  capacity_based: unitsOfType('capacity'),
  capacity_slab: unitsOfType('capacity'),
  manpower: [...unitsOfType('manpower'), ...unitsOfType('billing')]
};
export const unitOptionsFor = (pricingMethod) => METHOD_UNITS[pricingMethod] ?? [];

// The same options grouped by unit type, so the dropdown names what it is offering
export const unitGroupsFor = (pricingMethod) => {
  const options = unitOptionsFor(pricingMethod);
  return UNIT_TYPES.map(({ type, label }) => ({ type, label, units: options.filter(unit => unitsOfType(type).includes(unit)) }))
    .filter(group => group.units.length);
};

// What each pricing method measures, and which dimensions need the service name to say what
// is being measured. Mirrors INPUT_DIMENSIONS in backend/utils/servicePricing.js.
const INPUT_DIMENSIONS = { fixed_price: 'Visit', quantity_based: 'Quantity', area_based: 'Area',
  capacity_based: 'Capacity', capacity_slab: 'Capacity', manpower: 'Headcount',
  fixed_visit_custom: 'Visit', custom_quote: 'Quote' };
const QUALIFIED_DIMENSIONS = ['Capacity', 'Quantity'];

/**
 * The Primary Input is derived, never stored or typed in: the pricing method says what is
 * measured and the service says what it belongs to. "Generator" priced by capacity reads
 * "Generator Capacity"; "Landscape" priced by area reads "Area"; a fixed price measures
 * nothing, so its billing unit is the input.
 */
export const primaryInputLabel = (serviceName, pricingMethod, unit) => {
  const dimension = INPUT_DIMENSIONS[pricingMethod];
  if (!dimension) return '';
  if (dimension === 'Visit') return String(unit ?? '').trim() || 'Visit';
  const name = String(serviceName ?? '').trim();
  if (!name || !QUALIFIED_DIMENSIONS.includes(dimension)) return dimension;
  // "Generator Capacity", but never "Generator Capacity Capacity"
  return new RegExp(`\\b${dimension}\\b`, 'i').test(name) ? name : `${name} ${dimension}`;
};

export const getServiceDescription = (service) => {
  if (service?.details) return service.details;
  const snapshot = service?.pricingSnapshot || {};
  const inputs = service?.pricingInputs || service?.inputs || snapshot.inputs || {};
  const method = service?.pricing_method || snapshot.pricing_method;
  const labels = { fixed_price: 'Fixed Price', quantity_based: 'Quantity Based', area_based: 'Area Based', capacity_based: 'Capacity Based', capacity_slab: 'Capacity Slab', manpower: 'Manpower', fixed_visit_custom: 'Fixed Visit + Custom Work', custom_quote: 'Custom Quote' };
  const field = { quantity_based: ['quantity', 'Quantity'], area_based: ['area', 'Area'], capacity_based: ['capacity', 'Capacity'], capacity_slab: ['capacity', 'Capacity'], manpower: ['personnel', 'Personnel'] }[method];
  const unit = service?.unit || snapshot.unit || '';
  // Every configured service describes itself the same way, whatever its pricing method:
  // category, method, derived primary input, measured amount with its unit, and the property
  // types it applies to. Markup and every other internal figure stay out - this is what the
  // customer reads in modals, PDFs and emails.
  const name = getAddonName(service);
  const category = service?.category || snapshot.category || '';
  const propertyTypes = [service?.applicable_property_types, snapshot.applicable_property_types, service?.propertyTypeLabels]
    .find(value => Array.isArray(value) && value.length)?.map(getPropertyTypeLabel).filter(type => type && type !== '-') || [];
  const details = [category, labels[method]];
  const primaryInput = primaryInputLabel(name, method, unit);
  if (primaryInput) details.push(`Primary Input: ${primaryInput}`);
  const hasAmount = !!field && inputs[field[0]] != null && Number.isFinite(Number(inputs[field[0]]));
  if (hasAmount) details.push(`${field[1]}: ${Number(inputs[field[0]])}${unit ? ` ${unit}` : ''}`);
  // The unit rides along with the amount; on its own it still has to be stated
  else if (unit && unit !== primaryInput) details.push(`Unit: ${unit}`);
  if (method === 'capacity_slab') {
    const slabs = snapshot.capacity_slabs || service?.capacity_slabs;
    const slab = Array.isArray(slabs) ? slabs.find(item => Number(inputs.capacity) >= item.capacityFrom && (item.capacityTo === null || Number(inputs.capacity) <= item.capacityTo)) : null;
    if (slab) details.push(`Slab: ${slab.capacityFrom}${slab.capacityTo === null ? '+' : `–${slab.capacityTo}`}${unit ? ` ${unit}` : ''}`);
  }
  if (method === 'manpower') {
    const basis = service?.manpower_basis || snapshot.manpower_basis || 'monthly';
    details.push(basis === 'per_visit' ? 'Per Visit' : 'Monthly');
    const designation = service?.role_designation || snapshot.role_designation;
    if (designation) details.push(`Role: ${designation}`);
    if (basis === 'per_visit') {
      if (inputs.area != null) details.push(`Area: ${inputs.area} Sq Ft`);
      const range = inputs.manpower_range;
      if (range) details.push(`Area Range: ${range.areaFrom}${range.areaTo === null ? '+' : `–${range.areaTo}`} Sq Ft`);
      if (inputs.working_hours_per_visit != null) details.push(`Included Hours: ${inputs.working_hours_per_visit} per person / visit`);
      if (Number(inputs.overtime_hours_per_visit) > 0) details.push(`Overtime Hours: ${inputs.overtime_hours_per_visit} per person / visit`);
    } else if (service?.period_months || snapshot.period_months) details.push(`Period: ${service?.period_months || snapshot.period_months} months`);
  }
  if (propertyTypes.length) details.push(`Property Types: ${propertyTypes.join(', ')}`);
  return [service?.description || service?.services?.[0]?.description || snapshot.description, details.filter(Boolean).join(' | ')].filter(Boolean).join('\n');
};

/**
 * Default markup is internal: the FP, Admin and Manager screens may show it, and it must never
 * reach a customer document, so it is deliberately absent from getServiceDescription.
 */
export const getServiceMarkup = (service) => {
  const snapshot = service?.pricingSnapshot || {};
  const inputs = service?.pricingInputs || service?.inputs || snapshot.inputs || {};
  const markup = [service?.markupPercentage, inputs.markup_percentage, snapshot.default_markup_percentage,
    service?.default_markup_percentage].find(value => value != null && Number.isFinite(Number(value)));
  return markup == null ? null : Number(markup);
};

export const hasCatalogServices = estimate => (estimate?.estimate_type || estimate?.estimateType) === 'custom' || getEstimateAddons(estimate).some(addon => addon?.catalogServiceId || String(addon?.addonId || '').startsWith('CAT-'));

export const getEstimateAddons = (estimate) => {
  for (const value of [estimate?.addons, estimate?.addons_data, estimate?.selectedAddons, estimate?.selected_addons]) {
    try {
      const items = typeof value === 'string' ? JSON.parse(value) : value;
      if (Array.isArray(items) && items.length) return items;
    } catch {}
  }
  return [];
};

// Normalize property type to standard label - handles GC, Apt, gated_community, etc.
export const getPropertyTypeLabel = (type) => {
  if (!type) return '-';
  const upper = type.toUpperCase();
  if (upper.includes('GATED') || upper === 'GC') return 'Gated Community';
  if (upper.includes('APARTMENT') || upper === 'APT') return 'Apartment';
  if (upper.includes('VILLA')) return 'Villa';
  if (upper.includes('FLAT')) return 'Flat';
  if (upper.includes('PLOT')) return 'Plot';
  // Withdrawn for new services, still resolved so older records read correctly
  if (upper.includes('INDEPENDENT') || upper === 'IH') return 'Independent House';
  return type || '-';
};

// Normalize property type to short code - for filtering/matching
export const normalizePropertyTypeCode = (type) => {
  if (!type) return '';
  const upper = type.toUpperCase();
  if (upper.includes('GATED') || upper === 'GC') return 'GC';
  if (upper.includes('APARTMENT') || upper === 'APT') return 'Apt';
  if (upper.includes('VILLA')) return 'Villa';
  if (upper.includes('FLAT')) return 'Flat';
  if (upper.includes('PLOT')) return 'Plot';
  return type;
};
