const FREQUENCIES = { 'On Request': 0, Monthly: 12, 'Every 2 Months': 6, Quarterly: 4, 'Every 4 Months': 3,
  'Half Yearly': 2, Yearly: 1, Weekly: 52, 'Bi-Weekly': 26 };
// Labels no longer offered, kept so services and estimate snapshots saved earlier still validate and price
const LEGACY_FREQUENCIES = { 'Half-Yearly': 2, 'One-time': 1 };
const ALL_FREQUENCIES = { ...FREQUENCIES, ...LEGACY_FREQUENCIES };
// Only a frequency with no scheduled visits may carry a zero annual count
const visitsFor = (frequency, value, label) => {
  const visits = number(value, label, 0, 366, true);
  if (visits === 0 && ALL_FREQUENCIES[frequency] !== 0) fail(`${label} must be at least 1 for ${frequency}.`);
  return visits;
};
/**
 * The unit master. Every unit belongs to exactly one unit type, and a pricing method offers the
 * types it actually measures, so Area Based lists only area units and Manpower only headcount and
 * billing units. Add a unit here and it appears in the Add Service unit dropdown for every method
 * its type applies to.
 *
 * Mirrored by UNIT_TYPES in admin-portal/src/utils/estimatePackageUtils.js; a test compares them.
 */
const UNIT_TYPES = [
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
const unitsOfType = type => UNIT_TYPES.find(item => item.type === type)?.units ?? [];
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
const unitOptionsFor = pricingMethod => METHOD_UNITS[pricingMethod] ?? [];
// Plural labels withdrawn from the dropdown, still accepted so a service saved earlier stays
// editable and keeps pricing, the same way retired frequencies and methods do
const LEGACY_UNITS = { quantity_based: ['Units', 'Lifts', 'Pumps', 'Tanks'], area_based: ['Acres', 'Linear Feet'],
  capacity_based: ['Liters', 'KW'], capacity_slab: ['Liters', 'KW'], manpower: ['Persons', 'Guards', 'Personnel'] };
const unitIsValid = (pricingMethod, unit) =>
  unitOptionsFor(pricingMethod).includes(unit) || (LEGACY_UNITS[pricingMethod] ?? []).includes(unit);
const PROPERTY_TYPES = ['APT', 'GC', 'FLAT', 'VILLA', 'IH', 'PLOT'];
const PROPERTY_TYPE_LABELS = { GC: 'Gated Community', APT: 'Apartment', FLAT: 'Flat', VILLA: 'Villa', PLOT: 'Plot', IH: 'Independent House' };
const propertyTypeLabel = type => PROPERTY_TYPE_LABELS[String(type ?? '').toUpperCase()] || String(type ?? '');

// What each pricing method measures. Retired methods stay listed so estimates saved
// earlier still describe themselves.
const INPUT_DIMENSIONS = { fixed_price: 'Visit', quantity_based: 'Quantity', area_based: 'Area',
  capacity_based: 'Capacity', capacity_slab: 'Capacity', manpower: 'Headcount',
  fixed_visit_custom: 'Visit', custom_quote: 'Quote' };
// 'Capacity' and 'Quantity' do not say what is being measured, so the service name qualifies
// them; 'Area' and 'Headcount' already do.
const QUALIFIED_DIMENSIONS = ['Capacity', 'Quantity'];

/**
 * The Primary Input is derived, never stored or typed in: the pricing method says what is
 * measured and the service says what it belongs to. "Generator" priced by capacity reads
 * "Generator Capacity"; "Landscape" priced by area reads "Area"; a fixed price measures
 * nothing, so its billing unit is the input.
 *
 * Mirrored by primaryInputLabel in admin-portal/src/utils/estimatePackageUtils.js.
 */
const primaryInputLabel = (serviceName, pricingMethod, unit) => {
  const dimension = INPUT_DIMENSIONS[pricingMethod];
  if (!dimension) return '';
  if (dimension === 'Visit') return String(unit ?? '').trim() || 'Visit';
  const name = String(serviceName ?? '').trim();
  if (!name || !QUALIFIED_DIMENSIONS.includes(dimension)) return dimension;
  // "Generator Capacity", but never "Generator Capacity Capacity"
  return new RegExp(`\\b${dimension}\\b`, 'i').test(name) ? name : `${name} ${dimension}`;
};
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const number = (value, label, min = 0, max = 1e9, integer = false) => {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) fail(`${label} must be a valid number.`);
  const result = Number(value);
  if (result < min || result > max) fail(`${label} must be between ${min} and ${max}.`);
  if (integer && !Number.isInteger(result)) fail(`${label} must be a whole number.`);
  return result;
};
const text = (value, label, max, required = true) => {
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) fail(`${label} is required and must not exceed ${max} characters.`);
  return value.trim();
};
const boolean = (value, label) => {
  if (typeof value !== 'boolean') fail(`${label} must be true or false.`);
  return value;
};
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizePropertyType = value => {
  const type = String(value || '').toUpperCase().replace(/[\s_-]/g, '');
  return ({ APARTMENT: 'APT', APARTMENTS: 'APT', GATEDCOMMUNITY: 'GC', FLATS: 'FLAT', VILLAS: 'VILLA', PLOTS: 'PLOT', INDEPENDENTHOUSE: 'IH' })[type] || type;
};

const validateService = input => {
  if (!input || typeof input !== 'object') fail('Service configuration is required.');
  const config = {
    service_name: text(input.service_name, 'Service name', 150), category: text(input.category, 'Category', 100),
    pricing_method: input.pricing_method, unit: input.unit,
    description: text(input.description ?? '', 'Description', 500, false),
    default_frequency: input.default_frequency,
    allow_frequency_override: boolean(input.allow_frequency_override, 'Allow frequency override'),
    allow_manual_visits: boolean(input.allow_manual_visits, 'Allow manual visits'),
    // On means this service is arranged without a vendor: no vendor is assigned to it and no
    // visits are scheduled for it. The service itself is unchanged - it is still listed,
    // quoted and priced exactly as before. Absent on services saved before the toggle, which
    // is the same as off, so their vendor scheduling continues.
    skip_vendor_assignment: boolean(input.skip_vendor_assignment ?? false, 'Do not assign vendor'),
    default_markup_percentage: number(input.default_markup_percentage, 'Default markup percentage', 0, 1000),
    // XLAND's own annual cost of running the service; an estimate may still override it
    default_operating_cost: number(input.default_operating_cost ?? 0, 'Default XLAND operating cost', 0, 1e9)
  };
  if (!Object.hasOwn(METHOD_UNITS, config.pricing_method) || !unitIsValid(config.pricing_method, config.unit)) fail('Select a valid pricing method and unit.');
  if (!Object.hasOwn(ALL_FREQUENCIES, config.default_frequency)) fail('Select a valid default frequency.');
  config.default_visits_per_year = visitsFor(config.default_frequency, input.default_visits_per_year, 'Default visits per year');
  if (!config.allow_manual_visits && config.default_visits_per_year !== ALL_FREQUENCIES[config.default_frequency]) fail('Default visits must match the selected frequency when manual visits are disabled.');
  if (!Array.isArray(input.applicable_property_types) || !input.applicable_property_types.length || input.applicable_property_types.some(type => !PROPERTY_TYPES.includes(type))) fail('Select at least one valid property type.');
  config.applicable_property_types = [...new Set(input.applicable_property_types)];
  const rateField = { fixed_price: 'fixed_price', quantity_based: 'rate_per_quantity', area_based: 'rate_per_unit', capacity_based: 'rate_per_capacity' }[config.pricing_method];
  if (rateField) config[rateField] = number(input[rateField], 'Vendor rate');
  if (config.pricing_method === 'manpower') {
    config.manpower_basis = input.manpower_basis ?? 'monthly';
    if (!['monthly', 'per_visit'].includes(config.manpower_basis)) fail('Select a valid manpower pricing basis.');
    if (config.manpower_basis === 'monthly') {
      config.monthly_rate = number(input.monthly_rate, 'Monthly vendor rate');
      config.period_months = number(input.period_months, 'Period months', 1, 12, true);
      if (!['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'].includes(input.billing_period)) fail('Select a valid billing period.');
      config.billing_period = input.billing_period;
    } else {
      config.rate_per_person = number(input.rate_per_person, 'Rate per person per visit');
      config.role_designation = text(input.role_designation ?? '', 'Role / designation', 150, false);
      config.working_hours_per_visit = number(input.working_hours_per_visit, 'Working hours per visit', 0.01, 24);
      config.overtime_rate_per_hour = input.overtime_rate_per_hour == null || input.overtime_rate_per_hour === '' ? null : number(input.overtime_rate_per_hour, 'Overtime rate per person per hour');
      config.minimum_manpower = number(input.minimum_manpower, 'Minimum manpower', 1, 1e6, true);
      const ranges = input.manpower_ranges ?? [];
      if (!Array.isArray(ranges) || ranges.length > 100) fail('Configure at most 100 manpower ranges.');
      config.manpower_ranges = ranges.map((range, index) => ({
        areaFrom: number(range?.areaFrom, `Range ${index + 1} area from`, 0, 1e9, true),
        areaTo: range?.areaTo === null ? null : number(range?.areaTo, `Range ${index + 1} area to`, 1, 1e9, true),
        recommendedMin: number(range?.recommendedMin, `Range ${index + 1} recommended minimum`, 1, 1e6, true),
        recommendedMax: number(range?.recommendedMax, `Range ${index + 1} recommended maximum`, config.minimum_manpower, 1e6, true),
        ratePerPerson: number(range?.ratePerPerson, `Range ${index + 1} rate per person`)
      }));
      config.manpower_ranges.forEach((range, index, rows) => {
        if (!index && range.areaFrom > 1) fail('The first manpower range must begin at 0 or 1 Sq Ft.');
        if (range.areaTo !== null && range.areaTo < range.areaFrom) fail(`Range ${index + 1} upper area must not be less than its lower area.`);
        if (range.areaTo === null && index !== rows.length - 1) fail('Only the last manpower range can have no upper limit.');
        if (index && range.areaFrom !== rows[index - 1].areaTo + 1) fail('Manpower ranges must be consecutive whole-number areas without gaps or overlaps.');
        if (range.recommendedMax < range.recommendedMin) fail(`Range ${index + 1} recommended maximum must not be below its minimum.`);
      });
    }
  }
  if (config.pricing_method === 'capacity_slab') {
    if (!Array.isArray(input.capacity_slabs) || !input.capacity_slabs.length || input.capacity_slabs.length > 100) fail('Configure between 1 and 100 capacity slabs.');
    config.capacity_slabs = input.capacity_slabs.map((slab, index) => {
      const defaultFrequency = slab?.defaultFrequency ?? config.default_frequency;
      if (!Object.hasOwn(ALL_FREQUENCIES, defaultFrequency)) fail(`Slab ${index + 1} must have a valid default frequency.`);
      const defaultVisitsPerYear = visitsFor(defaultFrequency, slab?.defaultVisitsPerYear ?? (defaultFrequency === config.default_frequency ? config.default_visits_per_year : ALL_FREQUENCIES[defaultFrequency]), `Slab ${index + 1} default visits per year`);
      if (!config.allow_manual_visits && defaultVisitsPerYear !== ALL_FREQUENCIES[defaultFrequency]) fail(`Slab ${index + 1} visits must match its frequency when manual visits are disabled.`);
      return {
        capacityFrom: number(slab?.capacityFrom, `Slab ${index + 1} capacity from`, 0, 1e9, true),
        capacityTo: slab?.capacityTo === null ? null : number(slab?.capacityTo, `Slab ${index + 1} capacity to`, 0, 1e9, true),
        isCustomQuote: boolean(slab?.isCustomQuote ?? false, 'Custom quote'),
        vendorRate: slab?.isCustomQuote === true ? null : number(slab?.vendorRate, `Slab ${index + 1} vendor rate`),
        defaultFrequency, defaultVisitsPerYear
      };
    });
    config.capacity_slabs.forEach((slab, index, slabs) => {
      if (slab.capacityTo !== null && slab.capacityTo < slab.capacityFrom) fail(`Slab ${index + 1} upper capacity must not be less than its lower capacity.`);
      if (slab.capacityTo === null && index !== slabs.length - 1) fail('Only the last slab can have no upper limit.');
      if (index && slab.capacityFrom !== slabs[index - 1].capacityTo + 1) fail('Slabs must have consecutive whole-number ranges without gaps or overlaps.');
    });
  }
  return config;
};

const calculateServiceQuote = (config, input = {}, role) => {
  const propertyType = normalizePropertyType(input.property_type);
  if (!config.applicable_property_types.includes(propertyType)) fail('This service is not available for the selected property type.');
  let capacity, slab;
  if (config.pricing_method === 'capacity_slab') {
    capacity = number(input.capacity, 'Capacity', 0, 1e9, true);
    if (capacity < config.capacity_slabs[0].capacityFrom) fail('Capacity is below the first configured slab.');
    slab = config.capacity_slabs.find(item => capacity >= item.capacityFrom && (item.capacityTo === null || capacity <= item.capacityTo));
  }
  const defaultFrequency = slab?.defaultFrequency ?? config.default_frequency;
  const configuredVisits = slab?.defaultVisitsPerYear ?? (defaultFrequency === config.default_frequency ? config.default_visits_per_year : ALL_FREQUENCIES[defaultFrequency]);
  const frequency = input.frequency ?? defaultFrequency;
  if (!Object.hasOwn(ALL_FREQUENCIES, frequency)) fail('Select a valid frequency.');
  if (!config.allow_frequency_override && frequency !== defaultFrequency) fail('Frequency override is disabled for this service.');
  const defaultVisits = frequency === defaultFrequency ? configuredVisits : ALL_FREQUENCIES[frequency];
  const visits = input.visits === undefined ? defaultVisits : visitsFor(frequency, input.visits, 'Visits');
  if (!config.allow_manual_visits && visits !== defaultVisits) fail('Manual visits are disabled for this service.');
  const inputs = { property_type: propertyType, frequency, visits };
  let vendorCost;
  // 'custom_quote' and 'fixed_visit_custom' are retired: no new service can be saved with them,
  // but services and estimate snapshots stored earlier must still price correctly.
  let requiresCustomQuote = config.pricing_method === 'custom_quote';
  switch (config.pricing_method) {
    case 'fixed_price': vendorCost = config.fixed_price * visits; break;
    case 'quantity_based':
      inputs.quantity = number(input.quantity, 'Quantity', 1, 1e6, true);
      vendorCost = inputs.quantity * config.rate_per_quantity * visits; break;
    case 'area_based':
      inputs.area = number(input.area, 'Area', 0.01, 1e9);
      vendorCost = inputs.area * config.rate_per_unit * visits; break;
    case 'capacity_based':
      inputs.capacity = number(input.capacity, 'Capacity', 0.01, 1e9);
      vendorCost = inputs.capacity * config.rate_per_capacity * visits; break;
    case 'capacity_slab': {
      inputs.capacity = capacity;
      requiresCustomQuote = !slab || slab.isCustomQuote;
      if (!requiresCustomQuote) vendorCost = slab.vendorRate * visits;
      break;
    }
    case 'manpower': {
      if (config.manpower_basis !== 'per_visit') {
        inputs.personnel = number(input.personnel, 'Personnel count', 1, 1e6, true);
        vendorCost = inputs.personnel * config.monthly_rate * config.period_months;
        break;
      }
      let range;
      if (config.manpower_ranges?.length) {
        inputs.area = number(input.area, 'Property area', 1, 1e9, true);
        range = config.manpower_ranges.find(item => inputs.area >= item.areaFrom && (item.areaTo === null || inputs.area <= item.areaTo));
        if (!range) fail('Property area is outside the configured manpower ranges.');
        inputs.manpower_range = { areaFrom: range.areaFrom, areaTo: range.areaTo, recommendedMin: range.recommendedMin, recommendedMax: range.recommendedMax };
      }
      inputs.personnel = number(input.personnel ?? Math.max(config.minimum_manpower, range?.recommendedMin ?? 1), 'Personnel count', config.minimum_manpower, 1e6, true);
      inputs.working_hours_per_visit = config.working_hours_per_visit;
      inputs.overtime_hours_per_visit = number(input.overtime_hours_per_visit ?? 0, 'Overtime hours per person per visit', 0, 24 - config.working_hours_per_visit);
      if (inputs.overtime_hours_per_visit > 0 && config.overtime_rate_per_hour == null) fail('Overtime pricing is not configured for this service.');
      const rate = range?.ratePerPerson ?? config.rate_per_person;
      vendorCost = inputs.personnel * (rate + inputs.overtime_hours_per_visit * (config.overtime_rate_per_hour ?? 0)) * visits;
      break;
    }
    case 'fixed_visit_custom':
      inputs.custom_work_cost = number(input.custom_work_cost ?? config.custom_work_rate, 'Custom work cost');
      vendorCost = config.visit_charge * visits + inputs.custom_work_cost; break;
  }
  if (requiresCustomQuote) {
    if (input.custom_quote === undefined || input.custom_quote === '') return { requiresCustomQuote: true, frequency, visits, inputs };
    if (!['admin', 'manager'].includes(role)) fail('Custom quotes must be entered by an admin or manager.');
    inputs.custom_quote = number(input.custom_quote, 'Total vendor quote', 0.01);
    vendorCost = inputs.custom_quote;
  }
  vendorCost = round(vendorCost);
  inputs.operating_cost = number(input.operating_cost ?? config.default_operating_cost ?? 0, 'XLAND operating cost');
  inputs.markup_percentage = number(input.markup_percentage ?? config.default_markup_percentage, 'Markup percentage', 0, 1000);
  const operatingCost = round(inputs.operating_cost);
  const actualCost = round(vendorCost + operatingCost);
  const totalPrice = round(actualCost * (1 + inputs.markup_percentage / 100));
  const profit = round(totalPrice - actualCost);
  const marginPercentage = totalPrice ? round(profit / totalPrice * 100) : 0;
  if (!Number.isFinite(totalPrice) || totalPrice > 999999999.99) fail('Calculated service price exceeds the supported limit.');
  return { requiresCustomQuote: false, isCustomQuote: requiresCustomQuote, frequency, visits, inputs, vendorCost, operatingCost, actualCost, totalPrice, profit, marginPercentage, vendorRatePerVisit: visits ? round(vendorCost / visits) : 0 };
};

const calculateEstimateSummary = (quotes, discountPercentage = 0, gstPercentage = 18) => {
  const discountPercent = number(discountPercentage, 'Discount percentage', 0, 100);
  const gstPercent = number(gstPercentage, 'GST percentage', 0, 100);
  const vendorCost = round(quotes.reduce((sum, quote) => sum + quote.vendorCost, 0));
  const operatingCost = round(quotes.reduce((sum, quote) => sum + quote.operatingCost, 0));
  const actualCost = round(vendorCost + operatingCost);
  const subtotal = round(quotes.reduce((sum, quote) => sum + quote.totalPrice, 0));
  const discount = round(subtotal * discountPercent / 100);
  const netSubtotal = round(subtotal - discount);
  const gst = Math.round(netSubtotal * gstPercent / 100);
  const total = round(netSubtotal + gst);
  const profit = round(netSubtotal - actualCost);
  if (total > 999999999.99) fail('Estimate total exceeds the supported limit.');
  return { subtotal, discountPercent, discount, netSubtotal, gstPercent, gst, total, vendorCost, operatingCost, actualCost, profit, marginPercentage: netSubtotal ? round(profit / netSubtotal * 100) : 0 };
};

module.exports = { validateService, calculateServiceQuote, calculateEstimateSummary, normalizePropertyType,
  primaryInputLabel, propertyTypeLabel, UNIT_TYPES, unitOptionsFor };
