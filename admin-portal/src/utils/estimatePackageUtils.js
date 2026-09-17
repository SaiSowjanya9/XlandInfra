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

export const getPackagePropertyType = (pkg) => {
  const servicesData = parsePackageServicesData(pkg);
  return servicesData?.property_type || pkg?.property_type || pkg?.propertyType || '';
};

export const getAddonId = (addon) => (addon?.id ?? addon?.addonId ?? addon?.addon_id)?.toString();

export const getAddonName = (addon) => addon?.service_name || addon?.name || addon?.serviceName || addon?.services?.[0]?.name || 'Add-on Service';

export const getAddonPrice = (addon) => {
  if (typeof addon === 'number') return addon;
  const nestedTotal = addon?.services?.reduce((sum, service) => sum + (Number(service.price) || 0) * (Number(service.frequencyCount ?? service.frequency_count ?? service.frequency ?? 1) || 0), 0);
  const price = addon?.catalogServiceId ? addon.totalPrice ?? addon.pricingSnapshot?.totalPrice ?? addon.price : addon?.price ?? addon?.totalPrice ?? addon?.total_price;
  return Number(price ?? addon?.calculatedPrice ?? nestedTotal ?? 0) || 0;
};

export const getServiceDescription = (service) => {
  if (service?.details) return service.details;
  const snapshot = service?.pricingSnapshot || {};
  const inputs = service?.pricingInputs || service?.inputs || snapshot.inputs || {};
  const method = service?.pricing_method || snapshot.pricing_method;
  const labels = { fixed_price: 'Fixed Price', quantity_based: 'Quantity Based', area_based: 'Area Based', capacity_based: 'Capacity Based', capacity_slab: 'Capacity Slab', manpower: 'Manpower', fixed_visit_custom: 'Fixed Visit + Custom Work', custom_quote: 'Custom Quote' };
  const field = { quantity_based: ['quantity', 'Quantity'], area_based: ['area', 'Area'], capacity_based: ['capacity', 'Capacity'], capacity_slab: ['capacity', 'Capacity'], manpower: ['personnel', 'Personnel'] }[method];
  const unit = service?.unit || snapshot.unit || '';
  const details = [labels[method]];
  if (field && inputs[field[0]] != null && Number.isFinite(Number(inputs[field[0]]))) details.push(`${field[1]}: ${Number(inputs[field[0]])}${unit ? ` ${unit}` : ''}`);
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
  return [service?.description || service?.services?.[0]?.description || snapshot.description, details.filter(Boolean).join(' | ')].filter(Boolean).join('\n');
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
