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
