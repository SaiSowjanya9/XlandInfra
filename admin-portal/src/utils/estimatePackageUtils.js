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

export const getAddonName = (addon) => addon?.service_name || addon?.name || addon?.serviceName || addon?.services?.[0]?.name || 'Service';

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
  // 'Sq Ft' stays first because the first option is what a new Area Based service selects.
  // 'Linear Foot' measures length, not area, but an area-priced service is what bills it.
  { type: 'area', label: 'Area', units: ['Sq Ft', 'Sq In', 'Sq Yard', 'Sq M', 'Sq Cm', 'Sq Km', 'Acre', 'Hectare', 'Cent', 'Guntha', 'Ground', 'Sq Link', 'Sq Chain', 'Linear Foot'] },
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

// Retired methods stay listed so an estimate saved under one still names itself. Mirrors METHODS in
// backend/utils/estimateData.js.
const METHOD_LABELS = { fixed_price: 'Fixed Price', quantity_based: 'Quantity Based', area_based: 'Area Based', capacity_based: 'Capacity Based', capacity_slab: 'Capacity Slab', manpower: 'Manpower', fixed_visit_custom: 'Fixed Visit + Custom Work', custom_quote: 'Custom Quote' };
const INPUT_FIELDS = { quantity_based: ['quantity', 'Quantity'], area_based: ['area', 'Area'], capacity_based: ['capacity', 'Capacity'], capacity_slab: ['capacity', 'Capacity'], manpower: ['personnel', 'Personnel'] };
const serviceMethod = (service) => service?.pricing_method || service?.pricingMethod || service?.pricingSnapshot?.pricing_method;

// How a saved service was priced, for a column of its own. Empty for a hand-entered row, which has
// no configured method behind it.
export const getServiceMethodLabel = (service) => METHOD_LABELS[serviceMethod(service)] || '';

// `Property Types` is catalog configuration -- which kinds of property a service is set up for --
// not something a customer document states. It is stripped where a document is drawn rather than
// where the estimate is saved, because estimates already stored carry the segment inside
// `details` and `description`. Mirrors stripPropertyTypes in backend/utils/estimateData.js.
const PROPERTY_TYPES_SEGMENT = /^Property Types\s*:/i;
export const stripPropertyTypes = (text) => String(text ?? '').split('\n')
  .map(line => line.split(' | ').filter(part => !PROPERTY_TYPES_SEGMENT.test(part.trim())).join(' | '))
  .join('\n');

/**
 * What was measured at this property -- "4 Lift", "15,000 Sq Ft", "125 KVA", "4 Guards" -- taken
 * from the inputs the estimate was priced from.
 *
 * The rate behind it is a vendor cost, so it is not part of this: a view modal states what was
 * measured and what the customer pays, never what XLAND spends. A method that measures nothing
 * (Fixed Price) returns '', and a hand-entered row falls back to the quantity it was given.
 */
export const getServiceInput = (service) => {
  const snapshot = service?.pricingSnapshot || {};
  const inputs = service?.pricingInputs || service?.inputs || snapshot.inputs || {};
  const field = INPUT_FIELDS[serviceMethod(service)];
  const unit = service?.unit || snapshot.unit || '';
  const amount = field ? inputs[field[0]] : undefined;
  if (amount != null && Number.isFinite(Number(amount))) return `${Number(amount).toLocaleString('en-IN')}${unit ? ` ${unit}` : ''}`;
  const quantity = Number(service?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? `Qty ${quantity.toLocaleString('en-IN')}` : '';
};

/**
 * The rate the service was priced at, as the second line of Input / Details: "₹1,800 / Lift / Visit"
 * under "4 Lift". It is the configured per-unit rate from the pricing snapshot, not the per-visit
 * total, so it reads as the rate card it came from.
 *
 * This is a vendor rate, so it belongs to the internal table only -- the customer-facing one states
 * the measured amount alone. A Capacity Slab names the slab that applied instead of a rate, since
 * that is what decided the price. Returns '' when the snapshot carries no rate, which is the case
 * for a hand-entered service.
 */
const rateAmount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR',
    minimumFractionDigits: number % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(number);
};
export const getServiceRate = (service) => {
  const snapshot = snapshotOf(service);
  const inputs = service?.pricingInputs || service?.inputs || snapshot.inputs || {};
  const method = serviceMethod(service);
  const unit = service?.unit || snapshot.unit || '';
  const rate = (value, ...parts) => (value == null || value === '' || !Number.isFinite(Number(value))
    ? '' : [rateAmount(value), ...parts].filter(Boolean).join(' / '));
  if (method === 'capacity_slab') {
    const slabs = snapshot.capacity_slabs || service?.capacity_slabs || [];
    const slab = Array.isArray(slabs) ? slabs.find(item => Number(inputs.capacity) >= item.capacityFrom
      && (item.capacityTo === null || Number(inputs.capacity) <= item.capacityTo)) : null;
    if (slab) return `${String(slab.name || '').trim() || 'Slab'}: ${slab.capacityFrom} - ${slab.capacityTo === null ? 'above' : slab.capacityTo}${unit ? ` ${unit}` : ''}`;
  }
  if (method === 'manpower') {
    const basis = service?.manpower_basis || snapshot.manpower_basis || 'monthly';
    return basis === 'per_visit' ? rate(snapshot.rate_per_person ?? service?.rate_per_person, 'Person', 'Visit')
      : rate(snapshot.monthly_rate ?? service?.monthly_rate, 'Month');
  }
  const perUnit = { quantity_based: 'rate_per_quantity', area_based: 'rate_per_unit', capacity_based: 'rate_per_capacity' }[method];
  if (perUnit) return rate(snapshot[perUnit] ?? service?.[perUnit], unit, 'Visit');
  if (method === 'fixed_price' || method === 'fixed_visit_custom') return rate(snapshot.fixed_price ?? service?.fixed_price, 'Visit');
  // An older row, or a method without a rate card of its own: the per-visit vendor rate still says it
  return rate(snapshot.vendorRatePerVisit, 'Visit');
};

export const getServiceDescription = (service) => {
  if (service?.details) return service.details;
  const snapshot = service?.pricingSnapshot || {};
  const inputs = service?.pricingInputs || service?.inputs || snapshot.inputs || {};
  const method = service?.pricing_method || snapshot.pricing_method;
  const labels = METHOD_LABELS;
  const field = INPUT_FIELDS[method];
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
 * What a saved service cost XLAND, as opposed to what the customer pays for it. Every figure comes
 * from the pricing snapshot the server wrote when the service was priced, so an estimate reports
 * what it was actually costed at rather than what today's catalog would say.
 *
 * These belong to the Admin, Ops Manager, FP and Manager screens only, under an Internal heading,
 * and must never reach a customer document. A hand-entered service has no vendor behind it, so its
 * vendor and XLAND costs are null rather than zero -- nothing was quoted, which is not the same as
 * costing nothing.
 */
const snapshotOf = (service) => service?.pricingSnapshot || {};
const figure = (...values) => {
  const found = values.find(value => value != null && value !== '' && Number.isFinite(Number(value)));
  return found == null ? null : Number(found);
};
export const getServiceVendorCost = (service) =>
  service?.customService ? null : figure(service?.vendorCost, snapshotOf(service).vendorCost);
export const getServiceOperatingCost = (service) =>
  service?.customService ? null : figure(service?.operatingCost, snapshotOf(service).operatingCost, snapshotOf(service).default_operating_cost);
export const getServiceActualCost = (service) => {
  const actual = service?.customService ? null : figure(service?.actualCost, snapshotOf(service).actualCost);
  if (actual != null) return actual;
  const vendor = getServiceVendorCost(service);
  const operating = getServiceOperatingCost(service);
  return vendor == null && operating == null ? null : (vendor || 0) + (operating || 0);
};
/**
 * What XLAND makes on the service: the markup in rupees, which is what the service form's preview
 * has always called XLAND Cost -- ₹4,000 of vendor cost at 30% earns ₹1,200 and the customer pays
 * ₹5,200. It is derived from the price and the cost, never stored, and it is not
 * `getServiceOperatingCost`: that is a separate overhead the service form hardcodes to 0, which is
 * what had this figure reading as nothing beside a real margin.
 *
 * A hand-entered row has no vendor behind it, so there is no margin to state and this is null --
 * a dash, not a zero, the same rule the other cost cells follow.
 */
export const getServiceXlandCost = (service) => {
  const actual = getServiceActualCost(service);
  const price = getAddonPrice(service);
  return actual == null || price == null ? null : round2(price - actual);
};
export const getServiceMarginPercent = (service) => {
  const margin = figure(service?.marginPercentage, snapshotOf(service).marginPercentage);
  if (margin != null) return margin;
  const price = getAddonPrice(service);
  const actual = getServiceActualCost(service);
  return actual == null || !price ? null : round2((price - actual) / price * 100);
};
const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * The internal cost and profit of a whole estimate: what its services cost to arrange, what it
 * sells for, and the difference. The selling price is the estimate's own subtotal where it has one
 * -- that is the figure the customer was quoted, package included -- and falls back to the sum of
 * the service prices for an estimate that carries no package.
 */
export const estimateInternalCosts = (estimate, rows) => {
  const services = Array.isArray(rows) ? rows : getEstimateAddons(estimate);
  const sum = (getter) => services.reduce((total, service) => total + (getter(service) || 0), 0);
  const vendorCost = round2(sum(getServiceVendorCost));
  const operatingCost = round2(sum(getServiceOperatingCost));
  const actualCost = round2(vendorCost + operatingCost);
  const servicesPrice = round2(sum(getAddonPrice));
  const packagePrice = figure(estimate?.package_price, estimate?.packagePrice, estimate?.packageRate) || 0;
  const subtotal = figure(estimate?.subtotal, estimate?.subTotal);
  const sellingPrice = round2(subtotal != null && subtotal > 0 ? subtotal : servicesPrice + packagePrice);
  // What XLAND makes on top of the cost -- the markup in rupees, the figure the service form calls
  // XLAND Cost. It is the profit under the name the rest of the pricing UI uses, so vendor cost
  // plus XLAND cost (plus any operating cost) comes to exactly the selling price.
  const xlandCost = round2(sellingPrice - actualCost);
  return { vendorCost, operatingCost, actualCost, servicesPrice, packagePrice, sellingPrice,
    xlandCost, profit: xlandCost,
    marginPercent: sellingPrice ? round2(xlandCost / sellingPrice * 100) : null };
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

const serviceRowsFrom = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.serviceRows)) return parsed.serviceRows;
    if (Array.isArray(parsed?.services)) return parsed.services;
  } catch {}
  return [];
};

/**
 * Every service an estimate covers, for the screens that assign vendors to them: the package's own
 * services **and** the ones added beside it, in one list, deduplicated by name.
 *
 * Both sides matter. An estimate built without a package -- custom or direct -- keeps every service
 * in `addons`/`addons_data`, hand-entered and configured alike, so reading only the package fields
 * found nothing at all and the screen reported an estimate with no services. Reading only the
 * addons would lose a package estimate's own services just as badly.
 *
 * A service the estimate says needs no vendor is left out: it is arranged without one, which is the
 * same rule `serviceRowNeedsVendor` applies to the scheduling feeds on the server.
 */
export const estimateServiceRows = (estimate) => {
  const rows = [
    ...serviceRowsFrom(estimate?.services_data),
    ...serviceRowsFrom(estimate?.package_services),
    ...serviceRowsFrom(estimate?.packageServices),
    ...getEstimateAddons(estimate)
  ];
  const seen = new Set();
  const services = [];
  for (const row of rows) {
    if (row?.skip_vendor_assignment === true) continue;
    const name = String(row?.service || row?.name || row?.serviceName || row?.service_name || row?.serviceType || '').trim();
    const key = name.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    // On Request carries zero visits, so a stated 0 is kept rather than replaced with 1
    const visits = [row.frequencyCount, row.frequency_count, row.visits].find(value => value != null && value !== '');
    services.push({
      serviceType: name,
      frequencyType: row.frequencyType || row.frequency_type || 'Monthly',
      frequencyCount: Number.isFinite(Number(visits)) ? Number(visits) : 1
    });
  }
  return services;
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
