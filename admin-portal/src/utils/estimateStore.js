// Estimate store – manages estimates, AMC packages, and add-ons
// Uses localStorage for persistence (similar pattern to other stores)

const ESTIMATES_KEY = 'xland_estimates';
const AMC_PACKAGES_KEY = 'xland_amc_packages';
const ADDONS_KEY = 'xland_addons';
const SERVICES_KEY = 'xland_services';
const ESTIMATE_COUNTER_KEY = 'xland_estimate_counter';

// Default services list
const DEFAULT_SERVICES = [
  'Lawn Mowing',
  'Pool Maintenance',
  'Cleaning',
  'Plumbing',
  'Electrical',
  'Pest Control',
  'Security',
  'Housekeeping',
  'General Maintenance',
  'Landscaping',
  'HVAC Maintenance',
  'Painting',
  'Carpentry',
  'Window Cleaning',
  'Garbage Collection'
];

// Property types for AMC packages
export const PROPERTY_TYPES = ['APT', 'Flats', 'GC', 'Villas', 'Plots', 'Commercial'];

// Frequency types
export const FREQUENCY_TYPES = ['Monthly', 'Months', 'Half-yearly', 'Quarterly', 'Yearly'];

// Billing duration options with multipliers
export const BILLING_DURATIONS = [
  { value: 'monthly', label: 'Monthly', multiplier: 1 },
  { value: 'quarterly', label: 'Quarterly', multiplier: 3 },
  { value: 'half-yearly', label: 'Half-Yearly', multiplier: 6 },
  { value: 'yearly', label: 'Yearly', multiplier: 12 }
];

// AMC Templates storage key
const AMC_TEMPLATES_KEY = 'xland_amc_templates';

// Estimate statuses
export const ESTIMATE_STATUSES = ['Draft', 'Sent', 'Approved', 'Rejected', 'Expired', 'Archived'];

// ============================================
// Helper functions
// ============================================

const generateEstimateId = () => {
  const counter = parseInt(localStorage.getItem(ESTIMATE_COUNTER_KEY) || '0', 10) + 1;
  localStorage.setItem(ESTIMATE_COUNTER_KEY, counter.toString());
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `EST-${dateStr}-${String(counter).padStart(3, '0')}`;
};

const getStorageData = (key, defaultValue = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStorageData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ============================================
// Services Management
// ============================================

export const getServices = () => {
  const stored = getStorageData(SERVICES_KEY, null);
  if (stored === null) {
    setStorageData(SERVICES_KEY, DEFAULT_SERVICES);
    return DEFAULT_SERVICES;
  }
  return stored;
};

export const addService = (serviceName) => {
  const services = getServices();
  if (!services.includes(serviceName)) {
    services.push(serviceName);
    setStorageData(SERVICES_KEY, services);
    return { success: true, services };
  }
  return { success: true, services };
};

// ============================================
// Estimates CRUD
// ============================================

export const getEstimates = (status = 'all', includeArchived = false) => {
  let estimates = getStorageData(ESTIMATES_KEY);
  
  // Auto-archive direct estimates older than 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  estimates = estimates.map(est => {
    if (
      est.estimateType === 'direct' &&
      est.status !== 'Archived' &&
      new Date(est.createdAt) < thirtyDaysAgo
    ) {
      return {
        ...est,
        status: 'Archived',
        archivedAt: now.toISOString(),
        autoArchived: true
      };
    }
    return est;
  });
  
  setStorageData(ESTIMATES_KEY, estimates);
  
  // Filter by archived status
  if (!includeArchived) {
    estimates = estimates.filter(est => est.status !== 'Archived');
  }
  
  // Filter by status
  if (status !== 'all') {
    estimates = estimates.filter(est => est.status === status);
  }
  
  return estimates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getArchivedEstimates = () => {
  const estimates = getStorageData(ESTIMATES_KEY);
  return estimates
    .filter(est => est.status === 'Archived')
    .sort((a, b) => new Date(b.archivedAt || b.createdAt) - new Date(a.archivedAt || a.createdAt));
};

export const getEstimateById = (estimateId) => {
  const estimates = getStorageData(ESTIMATES_KEY);
  return estimates.find(est => est.estimateId === estimateId);
};

export const createEstimate = (estimateData) => {
  const estimates = getStorageData(ESTIMATES_KEY);
  const estimateId = generateEstimateId();
  
  const newEstimate = {
    ...estimateData,
    estimateId,
    status: estimateData.status || 'Draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  estimates.unshift(newEstimate);
  setStorageData(ESTIMATES_KEY, estimates);
  
  return newEstimate;
};

export const updateEstimate = (estimateId, updates) => {
  const estimates = getStorageData(ESTIMATES_KEY);
  const index = estimates.findIndex(est => est.estimateId === estimateId);
  
  if (index !== -1) {
    estimates[index] = {
      ...estimates[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    setStorageData(ESTIMATES_KEY, estimates);
    return estimates[index];
  }
  
  return null;
};

export const deleteEstimate = (estimateId, permanent = false) => {
  let estimates = getStorageData(ESTIMATES_KEY);
  
  if (permanent) {
    estimates = estimates.filter(est => est.estimateId !== estimateId);
  } else {
    const index = estimates.findIndex(est => est.estimateId === estimateId);
    if (index !== -1) {
      estimates[index] = {
        ...estimates[index],
        status: 'Archived',
        archivedAt: new Date().toISOString()
      };
    }
  }
  
  setStorageData(ESTIMATES_KEY, estimates);
  return true;
};

export const restoreEstimate = (estimateId) => {
  const estimates = getStorageData(ESTIMATES_KEY);
  const index = estimates.findIndex(est => est.estimateId === estimateId);
  
  if (index !== -1) {
    estimates[index] = {
      ...estimates[index],
      status: 'Draft',
      archivedAt: null,
      autoArchived: false,
      updatedAt: new Date().toISOString()
    };
    setStorageData(ESTIMATES_KEY, estimates);
    return estimates[index];
  }
  
  return null;
};

// ============================================
// AMC Packages CRUD
// ============================================

export const getAMCPackages = () => {
  return getStorageData(AMC_PACKAGES_KEY);
};

export const getAMCPackageById = (packageId) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  return packages.find(pkg => pkg.packageId === packageId);
};

export const createAMCPackage = (packageData) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  const packageId = `AMC-${Date.now()}`;
  
  const newPackage = {
    ...packageData,
    packageId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  packages.unshift(newPackage);
  setStorageData(AMC_PACKAGES_KEY, packages);
  
  return newPackage;
};

export const updateAMCPackage = (packageId, updates) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  const index = packages.findIndex(pkg => pkg.packageId === packageId);
  
  if (index !== -1) {
    packages[index] = {
      ...packages[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    setStorageData(AMC_PACKAGES_KEY, packages);
    return packages[index];
  }
  
  return null;
};

export const deleteAMCPackage = (packageId) => {
  let packages = getStorageData(AMC_PACKAGES_KEY);
  packages = packages.filter(pkg => pkg.packageId !== packageId);
  setStorageData(AMC_PACKAGES_KEY, packages);
  return true;
};

// ============================================
// Add-ons CRUD
// ============================================

export const getAddons = () => {
  return getStorageData(ADDONS_KEY);
};

export const getAddonById = (addonId) => {
  const addons = getStorageData(ADDONS_KEY);
  return addons.find(addon => addon.addonId === addonId);
};

export const createAddon = (addonData) => {
  const addons = getStorageData(ADDONS_KEY);
  const addonId = `ADDON-${Date.now()}`;
  
  const newAddon = {
    ...addonData,
    addonId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  addons.unshift(newAddon);
  setStorageData(ADDONS_KEY, addons);
  
  return newAddon;
};

export const updateAddon = (addonId, updates) => {
  const addons = getStorageData(ADDONS_KEY);
  const index = addons.findIndex(addon => addon.addonId === addonId);
  
  if (index !== -1) {
    addons[index] = {
      ...addons[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    setStorageData(ADDONS_KEY, addons);
    return addons[index];
  }
  
  return null;
};

export const deleteAddon = (addonId) => {
  let addons = getStorageData(ADDONS_KEY);
  addons = addons.filter(addon => addon.addonId !== addonId);
  setStorageData(ADDONS_KEY, addons);
  return true;
};

// ============================================
// Search and Filter
// ============================================

export const searchEstimates = (query, filters = {}) => {
  let estimates = getStorageData(ESTIMATES_KEY);
  const searchLower = query.toLowerCase();
  
  // Apply search
  if (query) {
    estimates = estimates.filter(est => 
      est.estimateId?.toLowerCase().includes(searchLower) ||
      est.propertyId?.toLowerCase().includes(searchLower) ||
      est.clientName?.toLowerCase().includes(searchLower) ||
      est.customerName?.toLowerCase().includes(searchLower) ||
      est.propertyType?.toLowerCase().includes(searchLower) ||
      est.services?.some(s => s.name?.toLowerCase().includes(searchLower))
    );
  }
  
  // Apply filters
  if (filters.estimateType && filters.estimateType !== 'all') {
    estimates = estimates.filter(est => est.estimateType === filters.estimateType);
  }
  
  if (filters.status && filters.status !== 'all') {
    estimates = estimates.filter(est => est.status === filters.status);
  }
  
  if (filters.propertyType && filters.propertyType !== 'all') {
    estimates = estimates.filter(est => est.propertyType === filters.propertyType);
  }
  
  if (filters.dateFrom) {
    estimates = estimates.filter(est => new Date(est.createdAt) >= new Date(filters.dateFrom));
  }
  
  if (filters.dateTo) {
    estimates = estimates.filter(est => new Date(est.createdAt) <= new Date(filters.dateTo));
  }
  
  return estimates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// ============================================
// Calculate totals
// ============================================

export const calculateServiceTotal = (services) => {
  if (!services || !Array.isArray(services)) return 0;
  return services.reduce((total, service) => {
    const price = parseFloat(service.price) || 0;
    const frequency = parseInt(service.frequency) || 1;
    return total + (price * frequency);
  }, 0);
};

export const calculateEstimateTotal = (estimate) => {
  let total = 0;
  
  // Add services total
  if (estimate.services) {
    total += calculateServiceTotal(estimate.services);
  }
  
  // Add AMC package price if applicable
  if (estimate.amcPrice) {
    total += parseFloat(estimate.amcPrice) || 0;
  }
  
  // Add add-ons total
  if (estimate.addons) {
    total += calculateServiceTotal(estimate.addons);
  }
  
  return total;
};

// ============================================
// AMC Templates CRUD
// ============================================

export const getAMCTemplates = () => {
  return getStorageData(AMC_TEMPLATES_KEY);
};

export const getAMCTemplateById = (templateId) => {
  const templates = getStorageData(AMC_TEMPLATES_KEY);
  return templates.find(t => t.templateId === templateId);
};

export const getDefaultAMCTemplate = () => {
  const templates = getStorageData(AMC_TEMPLATES_KEY);
  return templates.find(t => t.isDefault === true);
};

export const createAMCTemplate = (templateData) => {
  const templates = getStorageData(AMC_TEMPLATES_KEY);
  const templateId = `AMCT-${Date.now()}`;
  
  // If this is set as default, unset other defaults
  if (templateData.isDefault) {
    templates.forEach(t => t.isDefault = false);
  }
  
  const newTemplate = {
    ...templateData,
    templateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  templates.unshift(newTemplate);
  setStorageData(AMC_TEMPLATES_KEY, templates);
  
  return newTemplate;
};

export const updateAMCTemplate = (templateId, updates) => {
  const templates = getStorageData(AMC_TEMPLATES_KEY);
  const index = templates.findIndex(t => t.templateId === templateId);
  
  if (index !== -1) {
    // If setting as default, unset other defaults
    if (updates.isDefault) {
      templates.forEach(t => t.isDefault = false);
    }
    
    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    setStorageData(AMC_TEMPLATES_KEY, templates);
    return templates[index];
  }
  
  return null;
};

export const deleteAMCTemplate = (templateId) => {
  let templates = getStorageData(AMC_TEMPLATES_KEY);
  templates = templates.filter(t => t.templateId !== templateId);
  setStorageData(AMC_TEMPLATES_KEY, templates);
  return true;
};

// Calculate AMC price based on services, frequency, and billing duration
export const calculateAMCPrice = (services, billingDuration) => {
  if (!services || !Array.isArray(services)) return 0;
  
  const durationInfo = BILLING_DURATIONS.find(d => d.value === billingDuration) || { multiplier: 1 };
  
  return services.reduce((total, service) => {
    const rate = parseFloat(service.rate) || 0;
    const frequency = parseInt(service.frequency) || 1;
    return total + (rate * frequency * durationInfo.multiplier);
  }, 0);
};

// Check if AMC package already exists for a property
export const checkDuplicateAMCPackage = (propertyId, excludePackageId = null) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  return packages.some(pkg => 
    pkg.propertyId === propertyId && 
    pkg.packageId !== excludePackageId &&
    pkg.status !== 'expired'
  );
};

// Get AMC package by property ID
export const getAMCPackageByPropertyId = (propertyId) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  return packages.find(pkg => pkg.propertyId === propertyId && pkg.status !== 'expired');
};

// Get estimates by property ID
export const getEstimatesByPropertyId = (propertyId) => {
  const estimates = getStorageData(ESTIMATES_KEY);
  return estimates.filter(est => est.propertyId === propertyId && est.status !== 'Archived');
};

// Get AMC template by property type (e.g., GC, APT, VILLA)
export const getAMCTemplateByPropertyType = (propertyType) => {
  const templates = getStorageData(AMC_TEMPLATES_KEY);
  // Map entry types to template property types
  const typeMapping = {
    'GC': 'GC',
    'APT': 'APT',
    'VILLA': 'VILLA',
    'FLAT': 'FLAT',
    'PLOT': 'PLOT',
    'Gated Community': 'GC',
    'Apartment': 'APT',
    'Villa': 'VILLA',
    'Flat': 'FLAT',
    'Plot': 'PLOT'
  };
  const mappedType = typeMapping[propertyType] || propertyType;
  return templates.find(t => t.propertyType === mappedType);
};

// Get all AMC packages with their associated property info
export const getAMCPackagesWithPropertyInfo = () => {
  return getStorageData(AMC_PACKAGES_KEY);
};

// Link AMC package to property
export const linkAMCToProperty = (packageId, propertyId) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  const index = packages.findIndex(pkg => pkg.packageId === packageId);
  
  if (index !== -1) {
    packages[index] = {
      ...packages[index],
      propertyId,
      linkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setStorageData(AMC_PACKAGES_KEY, packages);
    return packages[index];
  }
  return null;
};
