export const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amt || 0);

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

export const getAddonPrice = (addon) => parseFloat(addon?.price ?? addon?.totalPrice ?? addon?.total_price ?? addon?.services?.[0]?.price) || 0;

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
