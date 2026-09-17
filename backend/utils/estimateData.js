const { normalizePropertyType } = require('./servicePricing');
const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const parse = value => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};
const list = value => {
  const parsed = parse(value);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.serviceRows) ? parsed.serviceRows : Array.isArray(parsed?.services) ? parsed.services : [];
};
const firstList = (...values) => values.map(list).find(items => Array.isArray(items) && items.length) || [];
const METHODS = { fixed_price: 'Fixed Price', quantity_based: 'Quantity Based', area_based: 'Area Based', capacity_based: 'Capacity Based', capacity_slab: 'Capacity Slab', manpower: 'Manpower', fixed_visit_custom: 'Fixed Visit + Custom Work', custom_quote: 'Custom Quote' };

const normalizeEstimateService = value => {
  const row = value && typeof value === 'object' ? value : { price: typeof value === 'number' ? value : 0, name: typeof value === 'string' ? value : 'Service' };
  const snapshot = parse(row.pricingSnapshot) || {};
  const inputs = parse(row.pricingInputs) || row.inputs || snapshot.inputs || {};
  const inner = list(row.services)[0] || {};
  const method = first(row.pricing_method, row.pricingMethod, snapshot.pricing_method);
  const unit = first(row.unit, snapshot.unit, '');
  const rawFrequency = first(row.frequencyType, row.frequency_type, inputs.frequency, snapshot.frequency, inner.frequencyType, inner.frequency_type,
    typeof row.frequency === 'string' && !Number.isFinite(Number(row.frequency)) ? row.frequency : undefined, 'One-time');
  const prefixCount = String(rawFrequency).match(/^(\d+)x\s*/i)?.[1];
  const frequencyType = String(rawFrequency).replace(/^\d+x\s*/i, '');
  const frequencyCount = amount(first(row.frequencyCount, row.frequency_count, row.visits, row.noOfVisits, row.no_of_visits, inputs.visits, snapshot.visits,
    Number.isFinite(Number(row.frequency)) ? row.frequency : undefined, inner.frequencyCount, inner.frequency_count, inner.frequency, prefixCount, 1));
  const catalog = !!(row.catalogServiceId || snapshot.pricing_method || method);
  const nestedTotal = list(row.services).reduce((sum, service) => sum + amount(service.price) * amount(first(service.frequencyCount, service.frequency_count, service.frequency, 1)), 0);
  const price = amount(catalog ? first(row.totalPrice, row.total_price, snapshot.totalPrice, row.price, nestedTotal)
    : first(row.price, row.totalPrice, row.total_price, row.calculatedPrice, nestedTotal));
  const description = String(first(row.description, inner.description, snapshot.description) ?? '');
  const parts = [];
  if (METHODS[method]) parts.push(METHODS[method]);
  const inputField = { quantity_based: ['quantity', 'Quantity'], area_based: ['area', 'Area'], capacity_based: ['capacity', 'Capacity'], capacity_slab: ['capacity', 'Capacity'], manpower: ['personnel', 'Personnel'] }[method];
  if (inputField && inputs[inputField[0]] != null && Number.isFinite(Number(inputs[inputField[0]]))) parts.push(`${inputField[1]}: ${Number(inputs[inputField[0]])}${unit ? ` ${unit}` : ''}`);
  if (method === 'capacity_slab') {
    const slab = firstList(snapshot.capacity_slabs, row.capacity_slabs).find(item => Number(inputs.capacity) >= item.capacityFrom && (item.capacityTo === null || Number(inputs.capacity) <= item.capacityTo));
    if (slab) parts.push(`Slab: ${slab.capacityFrom}${slab.capacityTo === null ? '+' : `–${slab.capacityTo}`}${unit ? ` ${unit}` : ''}`);
  }
  if (method === 'manpower') {
    const basis = first(row.manpower_basis, snapshot.manpower_basis) || 'monthly';
    parts.push(basis === 'per_visit' ? 'Per Visit' : 'Monthly');
    const designation = first(row.role_designation, snapshot.role_designation);
    if (designation) parts.push(`Role: ${designation}`);
    if (basis === 'per_visit') {
      if (inputs.area != null) parts.push(`Area: ${inputs.area} Sq Ft`);
      const range = inputs.manpower_range;
      if (range) parts.push(`Area Range: ${range.areaFrom}${range.areaTo === null ? '+' : `–${range.areaTo}`} Sq Ft`);
      if (inputs.working_hours_per_visit != null) parts.push(`Included Hours: ${inputs.working_hours_per_visit} per person / visit`);
      if (Number(inputs.overtime_hours_per_visit) > 0) parts.push(`Overtime Hours: ${inputs.overtime_hours_per_visit} per person / visit`);
    } else {
      const months = first(row.period_months, snapshot.period_months);
      if (months) parts.push(`Period: ${months} months`);
    }
  }
  const serviceDetails = parts.join(' | ');
  const details = row.details && row.serviceDetails === serviceDetails ? row.details : [row.serviceDetails ? description : row.details || description, serviceDetails].filter(Boolean).join('\n');
  return { ...row, name: first(row.name, row.service_name, row.serviceName, row.service, inner.name, snapshot.service_name, 'Service'),
    description, details, serviceDetails, pricing_method: method, unit, frequencyType, frequency_type: frequencyType,
    frequencyCount, frequency_count: frequencyCount, price, totalPrice: price };
};

const normalizeEstimateData = row => {
  const addons = firstList(row.addons, row.addons_data, row.selectedAddons, row.selected_addons).map(normalizeEstimateService);
  const services = firstList(row.services, row.services_data).map(normalizeEstimateService);
  const packageServices = firstList(row.package_services, row.packageServices).map(normalizeEstimateService);
  const property = addons[0]?.propertySnapshot || {};
  const isCustom = first(row.estimateType, row.estimate_type) === 'custom';
  const propertyFields = Object.fromEntries(['zone', 'division', 'city', 'number_of_blocks', 'total_units', 'block_names', 'units_per_block', 'tower_name', 'block_number', 'villa_plot_number'].map(key => [key, isCustom ? first(property[key], row[key]) : first(row[key], property[key])]));
  const discountPercent = amount(isCustom ? first(row.discount_percentage, row.discountPercent, row.discount_percent) : first(row.discountPercent, row.discount_percent, row.discount_percentage));
  const discountAmount = amount(first(row.discountAmount, row.discount_amount, row.discount));
  const gstPercent = amount(isCustom ? first(row.tax_percentage, row.gstPercent, row.gst_percent) : first(row.gstPercent, row.gst_percent, row.tax_percentage));
  const gstAmount = amount(isCustom ? first(row.tax_amount, row.gstAmount, row.gst_amount, row.tax) : first(row.gstAmount, row.gst_amount, row.tax_amount, row.tax, row.gst));
  const total = amount(first(row.totalPrice, row.total, row.total_amount, row.total_price));
  return { ...row, ...propertyFields, addons, services, packageServices, package_services: packageServices,
    addonsTotal: addons.reduce((sum, addon) => sum + addon.price, 0), subTotal: amount(first(row.subtotal, row.subTotal, row.sub_total)), gst: gstAmount,
    estimateId: first(row.estimateId, row.estimate_id), estimateType: first(row.estimateType, row.estimate_type),
    customerName: first(row.customerName, row.customer_name, row.client_name, row.clientName),
    customerEmail: first(row.customerEmail, row.customer_email, row.client_email, row.email),
    customerPhone: first(row.customerPhone, row.customer_phone, row.client_phone, row.phone),
    propertyId: first(row.propertyId, row.property_id), propertyCode: first(row.propertyCode, row.property_code, property.property_id), property_code: first(row.property_code, row.propertyCode, property.property_id),
    propertyName: first(row.propertyName, row.property_name, row.community_name), propertyType: first(row.propertyType, row.property_type),
    address: first(row.address, row.propertyAddress, row.property_address), createdAt: first(row.createdAt, row.created_at),
    validUntil: first(row.validUntil, row.valid_until), packagePrice: amount(first(row.packagePrice, row.package_price)),
    subtotal: amount(first(row.subtotal, row.subTotal, row.sub_total)), discountPercent, discount_percent: discountPercent,
    discountAmount, discount_amount: discountAmount, gstPercent, gst_percent: gstPercent, gstAmount, gst_amount: gstAmount,
    tax: gstAmount, total, totalPrice: total };
};

const customerEstimateData = source => {
  const row = normalizeEstimateData(source);
  const service = item => ({ name: item.name, description: item.details, frequencyType: item.frequencyType,
    frequencyCount: item.frequencyCount, frequency_type: item.frequencyType, frequency_count: item.frequencyCount, price: item.price, totalPrice: item.totalPrice });
  const result = Object.fromEntries(['estimateId', 'estimateType', 'customerName', 'customerEmail', 'customerPhone', 'propertyName', 'propertyType', 'propertyCode',
    'zone', 'division', 'city', 'address', 'subtotal', 'total', 'validUntil', 'createdAt', 'description', 'packagePrice', 'gstPercent', 'discountAmount',
    'isWorkOrderEstimate', 'workOrderId', 'workOrderCategory', 'workOrderSubcategory', 'workOrderDescription', 'workOrderPriority', 'workOrderStatus'].map(key => [key, row[key]]));
  for (const [camel, snake] of [['numberOfBlocks', 'number_of_blocks'], ['totalUnits', 'total_units'], ['towerName', 'tower_name'], ['blockNumber', 'block_number'],
    ['villaPlotNumber', 'villa_plot_number'], ['blockNames', 'block_names'], ['unitsPerBlock', 'units_per_block'], ['packageName', 'package_name'], ['amcPackageDescription', 'amc_package_description'], ['billingDuration', 'billing_duration']]) result[camel] = first(row[camel], row[snake]);
  return { ...result, services: (row.packageServices.length ? row.packageServices : row.services).map(service), addons: row.addons.map(service),
    discount: amount(first(source.discountPercent, source.discount_percent, source.discount_percentage, source.discount)), tax: row.gstAmount };
};

const canEmailEstimate = (estimate, scope) => !!estimate && !!scope.fpId && Number(estimate.franchise_partner_id) === Number(scope.fpId) &&
  (scope.zones.includes('__ALL__') || scope.zones.includes(estimate.zone) || scope.creatorNames.filter(Boolean).includes(estimate.created_by_name) ||
    (Number(estimate.created_by_id) === Number(scope.creatorId) && estimate.created_by_role === scope.role));

const enrichLegacyEstimateAddon = (addon, candidates, propertyType) => {
  if (addon.catalogServiceId || String(addon.addonId || '').startsWith('CAT-')) return addon;
  const id = first(addon.id, addon.addon_id, addon.addonId);
  const name = String(first(addon.name, addon.service_name, addon.serviceName) ?? '').toLowerCase();
  const source = candidates.find(item => id != null && String(item.id) === String(id)) || candidates.find(item =>
    String(item.service_name || '').toLowerCase() === name && normalizePropertyType(item.property_type) === normalizePropertyType(propertyType));
  const inner = list(addon.services)[0] || {};
  return { ...addon, description: first(addon.description, inner.description, source?.description, ''),
    frequency_type: first(addon.frequency_type, addon.frequencyType, inner.frequencyType, inner.frequency_type, source?.frequency_type),
    frequency_count: first(addon.frequency_count, addon.frequencyCount, addon.visits, inner.frequencyCount, inner.frequency_count, inner.frequency, source?.frequency_count) };
};

const hasCatalogServices = estimate => (estimate.estimate_type || estimate.estimateType) === 'custom' || firstList(estimate.addons, estimate.addons_data).some(addon => addon?.catalogServiceId || String(addon?.addonId || '').startsWith('CAT-'));

module.exports = { normalizeEstimateService, normalizeEstimateData, customerEstimateData, canEmailEstimate, enrichLegacyEstimateAddon, hasCatalogServices };
