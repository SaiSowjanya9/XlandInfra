const FREQUENCIES = { Monthly: 12, 'Every 2 Months': 6, Quarterly: 4, 'Half-Yearly': 2, Yearly: 1, 'One-time': 1 };
const UNITS = {
  fixed_price: ['Visit', 'Service', 'Job'], quantity_based: ['Nos', 'Units', 'Lifts', 'Pumps', 'Tanks'],
  area_based: ['Sq Ft', 'Sq M', 'Acres'], capacity_based: ['KL', 'Liters', 'KVA', 'KW'],
  capacity_slab: ['Persons', 'KVA', 'KW', 'HP', 'KL', 'Liters'], manpower: ['Guards', 'Staff', 'Personnel'],
  fixed_visit_custom: ['Visit', 'Job'], custom_quote: ['Quote', 'Project']
};
const PROPERTY_TYPES = ['APT', 'GC', 'FLAT', 'VILLA', 'IH', 'PLOT'];
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
    default_visits_per_year: number(input.default_visits_per_year, 'Default visits per year', 1, 366, true),
    default_markup_percentage: number(input.default_markup_percentage, 'Default markup percentage', 0, 1000)
  };
  if (!Object.hasOwn(UNITS, config.pricing_method) || !UNITS[config.pricing_method].includes(config.unit)) fail('Select a valid pricing method and unit.');
  if (!Object.hasOwn(FREQUENCIES, config.default_frequency)) fail('Select a valid default frequency.');
  if (!config.allow_manual_visits && config.default_visits_per_year !== FREQUENCIES[config.default_frequency]) fail('Default visits must match the selected frequency when manual visits are disabled.');
  if (!Array.isArray(input.applicable_property_types) || !input.applicable_property_types.length || input.applicable_property_types.some(type => !PROPERTY_TYPES.includes(type))) fail('Select at least one valid property type.');
  config.applicable_property_types = [...new Set(input.applicable_property_types)];
  const rateField = { fixed_price: 'fixed_price', quantity_based: 'rate_per_quantity', area_based: 'rate_per_unit', capacity_based: 'rate_per_capacity', manpower: 'monthly_rate', fixed_visit_custom: 'visit_charge' }[config.pricing_method];
  if (rateField) config[rateField] = number(input[rateField], 'Vendor rate');
  if (config.pricing_method === 'fixed_visit_custom') config.custom_work_rate = number(input.custom_work_rate, 'Custom work cost');
  if (config.pricing_method === 'manpower') {
    config.period_months = number(input.period_months, 'Period months', 1, 12, true);
    if (!['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'].includes(input.billing_period)) fail('Select a valid billing period.');
    config.billing_period = input.billing_period;
  }
  if (config.pricing_method === 'capacity_slab') {
    if (!Array.isArray(input.capacity_slabs) || !input.capacity_slabs.length || input.capacity_slabs.length > 100) fail('Configure between 1 and 100 capacity slabs.');
    config.capacity_slabs = input.capacity_slabs.map((slab, index) => {
      const defaultFrequency = slab?.defaultFrequency ?? config.default_frequency;
      if (!Object.hasOwn(FREQUENCIES, defaultFrequency)) fail(`Slab ${index + 1} must have a valid default frequency.`);
      const defaultVisitsPerYear = number(slab?.defaultVisitsPerYear ?? (defaultFrequency === config.default_frequency ? config.default_visits_per_year : FREQUENCIES[defaultFrequency]), `Slab ${index + 1} default visits per year`, 1, 366, true);
      if (!config.allow_manual_visits && defaultVisitsPerYear !== FREQUENCIES[defaultFrequency]) fail(`Slab ${index + 1} visits must match its frequency when manual visits are disabled.`);
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
  const configuredVisits = slab?.defaultVisitsPerYear ?? (defaultFrequency === config.default_frequency ? config.default_visits_per_year : FREQUENCIES[defaultFrequency]);
  const frequency = input.frequency ?? defaultFrequency;
  if (!Object.hasOwn(FREQUENCIES, frequency)) fail('Select a valid frequency.');
  if (!config.allow_frequency_override && frequency !== defaultFrequency) fail('Frequency override is disabled for this service.');
  const defaultVisits = frequency === defaultFrequency ? configuredVisits : FREQUENCIES[frequency];
  const visits = input.visits === undefined ? defaultVisits : number(input.visits, 'Visits', 1, 366, true);
  if (!config.allow_manual_visits && visits !== defaultVisits) fail('Manual visits are disabled for this service.');
  const inputs = { property_type: propertyType, frequency, visits };
  let vendorCost;
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
    case 'manpower':
      inputs.personnel = number(input.personnel, 'Personnel count', 1, 1e6, true);
      vendorCost = inputs.personnel * config.monthly_rate * config.period_months; break;
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
  inputs.operating_cost = number(input.operating_cost ?? 0, 'XLAND operating cost');
  inputs.markup_percentage = number(input.markup_percentage ?? config.default_markup_percentage, 'Markup percentage', 0, 1000);
  const operatingCost = round(inputs.operating_cost);
  const actualCost = round(vendorCost + operatingCost);
  const totalPrice = round(actualCost * (1 + inputs.markup_percentage / 100));
  const profit = round(totalPrice - actualCost);
  const marginPercentage = totalPrice ? round(profit / totalPrice * 100) : 0;
  if (!Number.isFinite(totalPrice) || totalPrice > 999999999.99) fail('Calculated service price exceeds the supported limit.');
  return { requiresCustomQuote: false, isCustomQuote: requiresCustomQuote, frequency, visits, inputs, vendorCost, operatingCost, actualCost, totalPrice, profit, marginPercentage, vendorRatePerVisit: round(vendorCost / visits) };
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

module.exports = { validateService, calculateServiceQuote, calculateEstimateSummary, normalizePropertyType };
