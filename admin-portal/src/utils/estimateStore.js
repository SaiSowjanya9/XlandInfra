// Estimate store – manages estimates, AMC packages, and add-ons
// Uses localStorage for persistence (similar pattern to other stores)

const ESTIMATES_KEY = 'xland_estimates';
const AMC_PACKAGES_KEY = 'xland_amc_packages';
const ADDONS_KEY = 'xland_addons';
const SERVICES_KEY = 'xland_services';
const ESTIMATE_COUNTER_KEY = 'xland_estimate_counter';
const GST_CONFIG_KEY = 'xland_gst_config';
const ADDONS_VERSION_KEY = 'xland_addons_version';
const CURRENT_ADDONS_VERSION = 2; // Increment this to force re-migration

// Auto-migrate addons on load - clears old data and regenerates with correct frequency counts
(function migrateAddonsData() {
  try {
    const storedVersion = parseInt(localStorage.getItem(ADDONS_VERSION_KEY) || '0', 10);
    if (storedVersion < CURRENT_ADDONS_VERSION) {
      // Clear old addons data
      localStorage.removeItem(ADDONS_KEY);
      // Set new version
      localStorage.setItem(ADDONS_VERSION_KEY, CURRENT_ADDONS_VERSION.toString());
      console.log('[EstimateStore] Migrated addons data to version', CURRENT_ADDONS_VERSION);
    }
  } catch (e) {
    console.error('[EstimateStore] Migration error:', e);
  }
})();

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
export const FREQUENCY_TYPES = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Custom Months'];

// Auto-calculate frequency count based on frequency type
export const FREQUENCY_COUNT_MAP = {
  'Monthly': 1,
  'Quarterly': 3,
  'Half-yearly': 6,
  'Yearly': 12,
  'Custom Months': null // User enters manually
};

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

// Get AMC package by property type (IC, Villa, Apt, Plot, Flat)
export const getAMCPackageByPropertyType = (propertyType) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  // Map various property type formats to standardized types
  const typeMapping = {
    'IC': 'IC',
    'Independent House': 'IC',
    'Villa': 'Villa',
    'Villas': 'Villa',
    'Apt': 'Apt',
    'APT': 'Apt',
    'Apartment': 'Apt',
    'Plot': 'Plot',
    'Plots': 'Plot',
    'Flat': 'Flat',
    'Flats': 'Flat',
    'GC': 'Apt', // Gated Community maps to Apartment
    'Commercial': 'Commercial'
  };
  
  const normalizedType = typeMapping[propertyType] || propertyType;
  return packages.find(pkg => pkg.propertyType === normalizedType);
};

// Get all AMC packages for a specific property type
export const getAMCPackagesByPropertyType = (propertyType) => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  const typeMapping = {
    'IC': 'IC',
    'Independent House': 'IC',
    'Villa': 'Villa',
    'Villas': 'Villa',
    'Apt': 'Apt',
    'APT': 'Apt',
    'Apartment': 'Apt',
    'Plot': 'Plot',
    'Plots': 'Plot',
    'Flat': 'Flat',
    'Flats': 'Flat',
    'GC': 'Apt',
    'Commercial': 'Commercial'
  };
  
  const normalizedType = typeMapping[propertyType] || propertyType;
  return packages.filter(pkg => pkg.propertyType === normalizedType);
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
// Add-ons CRUD (API-based for sync across devices)
// ============================================

// API base URL
const API_URL = import.meta.env.VITE_API_URL || '';

// Cache for addons (reduces API calls)
let addonsCache = null;
let addonsCacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds

export const getAddons = () => {
  // Return cached data if still valid
  if (addonsCache && Date.now() - addonsCacheTime < CACHE_DURATION) {
    return addonsCache;
  }
  // Return empty array, caller should use fetchAddons() for fresh data
  return addonsCache || [];
};

// Async function to fetch addons from API
export const fetchAddons = async () => {
  try {
    const response = await fetch(`${API_URL}/api/addons`);
    const result = await response.json();
    if (result.success) {
      addonsCache = result.data || [];
      addonsCacheTime = Date.now();
      return addonsCache;
    }
    return [];
  } catch (error) {
    console.error('Fetch addons error:', error);
    return addonsCache || [];
  }
};

export const getAddonById = (addonId) => {
  const addons = getAddons();
  return addons.find(addon => addon.addonId === addonId);
};

export const createAddon = async (addonData) => {
  try {
    const response = await fetch(`${API_URL}/api/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addonData)
    });
    const result = await response.json();
    if (result.success) {
      // Invalidate cache to force refresh
      addonsCache = null;
      return { ...addonData, addonId: result.data?.addonId };
    }
    throw new Error(result.message);
  } catch (error) {
    console.error('Create addon error:', error);
    throw error;
  }
};

export const updateAddon = async (addonId, updates) => {
  try {
    const response = await fetch(`${API_URL}/api/addons/${addonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const result = await response.json();
    if (result.success) {
      addonsCache = null;
      return { addonId, ...updates };
    }
    throw new Error(result.message);
  } catch (error) {
    console.error('Update addon error:', error);
    throw error;
  }
};

export const deleteAddon = async (addonId) => {
  try {
    const response = await fetch(`${API_URL}/api/addons/${addonId}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (result.success) {
      addonsCache = null;
      return true;
    }
    throw new Error(result.message);
  } catch (error) {
    console.error('Delete addon error:', error);
    throw error;
  }
};

// Clear all addons data
export const clearAllAddons = () => {
  addonsCache = null;
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

// ============================================
// GST Configuration
// ============================================

// Default GST rate is 2%
const DEFAULT_GST_RATE = 2;

export const getGSTConfig = () => {
  try {
    const stored = localStorage.getItem(GST_CONFIG_KEY);
    return stored ? parseFloat(stored) : DEFAULT_GST_RATE;
  } catch {
    return DEFAULT_GST_RATE;
  }
};

export const setGSTConfig = (rate) => {
  try {
    localStorage.setItem(GST_CONFIG_KEY, rate.toString());
    return true;
  } catch {
    return false;
  }
};

// ============================================
// Migrate existing packages to add serviceRows
// ============================================

export const migratePackagesToServiceRows = () => {
  const packages = getStorageData(AMC_PACKAGES_KEY);
  let migrated = false;
  
  const updatedPackages = packages.map(pkg => {
    // Skip if already has serviceRows
    if (pkg.serviceRows && pkg.serviceRows.length > 0) {
      return pkg;
    }
    
    // Parse services string and create serviceRows with default frequency
    if (pkg.services && typeof pkg.services === 'string') {
      migrated = true;
      const serviceNames = pkg.services.split(',').map(s => s.trim()).filter(s => s);
      return {
        ...pkg,
        serviceRows: serviceNames.map(name => ({
          service: name,
          frequencyCount: 1,
          frequencyType: 'Monthly'
        })),
        updatedAt: new Date().toISOString()
      };
    }
    
    return pkg;
  });
  
  if (migrated) {
    setStorageData(AMC_PACKAGES_KEY, updatedPackages);
  }
  
  return migrated;
};

// ============================================
// Seed Test Data
// ============================================

// Seed test estimate for a property (for testing vendor assignments)
// Uses Platinum Package configuration with proper frequency values
export const seedTestEstimateForProperty = (propertyId, propertyName, zone) => {
  const estimates = getStorageData(ESTIMATES_KEY);
  
  // Check if estimate already exists for this property
  const existing = estimates.find(e => e.propertyId === propertyId);
  if (existing) {
    return existing;
  }
  
  // Create a test estimate matching the Platinum Package structure
  // with accurate frequency counts and types as configured
  const estimateId = generateEstimateId();
  
  // Service rows with proper frequency configuration (matches AMC Package)
  const serviceRows = [
    { service: 'HVAC', frequencyCount: 1, frequencyType: 'Quarterly', price: 8000 },
    { service: 'Pool', frequencyCount: 2, frequencyType: 'Monthly', price: 6000 },
    { service: 'Full Maintenance', frequencyCount: 1, frequencyType: 'Monthly', price: 15000 },
    { service: 'Housekeeping', frequencyCount: 4, frequencyType: 'Monthly', price: 3000 },
    { service: 'Security', frequencyCount: 1, frequencyType: 'Monthly', price: 20000 },
    { service: 'Electrical', frequencyCount: 1, frequencyType: 'Quarterly', price: 4000 },
    { service: 'Plumbing', frequencyCount: 1, frequencyType: 'Quarterly', price: 4000 },
    { service: 'Landscaping', frequencyCount: 2, frequencyType: 'Monthly', price: 5000 }
  ];
  
  const testEstimate = {
    estimateId,
    propertyId,
    propertyName: propertyName || 'Test Property',
    estimateType: 'property-based',
    packageId: 'AMC-PLATINUM-003',
    packageName: 'Platinum Package',
    packageRate: 96849,
    status: 'Draft',
    // Include serviceRows for direct access (primary source)
    serviceRows: serviceRows,
    // Also include services array for backward compatibility
    services: serviceRows.map(sr => ({
      name: sr.service,
      frequency: sr.frequencyCount,
      frequencyCount: sr.frequencyCount,
      frequencyType: sr.frequencyType,
      price: sr.price
    })),
    addons: [],
    subTotal: serviceRows.reduce((sum, sr) => sum + sr.price, 0),
    gst: Math.round(serviceRows.reduce((sum, sr) => sum + sr.price, 0) * 0.18),
    discount: 0,
    totalPrice: 96849,
    addonsTotal: 0,
    zone: zone || 'North',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  
  estimates.unshift(testEstimate);
  setStorageData(ESTIMATES_KEY, estimates);
  
  return testEstimate;
};

// Seed multiple test estimates for testing
export const seedMultipleTestEstimates = () => {
  const estimates = getStorageData(ESTIMATES_KEY);
  const properties = JSON.parse(localStorage.getItem('xland_properties') || '[]');
  
  if (properties.length === 0) {
    console.warn('No properties found to create estimates for');
    return [];
  }
  
  const createdEstimates = [];
  
  // Create estimates for up to 4 properties
  const propsToUse = properties.slice(0, 4);
  
  // Package configs with serviceRows for proper frequency data
  const packageConfigs = [
    {
      packageName: 'Platinum Package',
      packageId: 'AMC-PLATINUM-003',
      packageRate: 96849,
      serviceRows: [
        { service: 'HVAC', frequencyCount: 1, frequencyType: 'Quarterly', price: 15000 },
        { service: 'Plumbing', frequencyCount: 1, frequencyType: 'Quarterly', price: 8000 },
        { service: 'Security', frequencyCount: 1, frequencyType: 'Monthly', price: 25000 },
        { service: 'Housekeeping', frequencyCount: 4, frequencyType: 'Monthly', price: 12000 },
        { service: 'Landscaping', frequencyCount: 2, frequencyType: 'Monthly', price: 8000 },
        { service: 'Pool', frequencyCount: 2, frequencyType: 'Monthly', price: 6000 }
      ]
    },
    {
      packageName: 'Gold Package',
      packageId: 'AMC-GOLD-001',
      packageRate: 65000,
      serviceRows: [
        { service: 'HVAC', frequencyCount: 1, frequencyType: 'Quarterly', price: 10000 },
        { service: 'Security', frequencyCount: 1, frequencyType: 'Monthly', price: 20000 },
        { service: 'Cleaning', frequencyCount: 2, frequencyType: 'Monthly', price: 8000 },
        { service: 'Landscaping', frequencyCount: 2, frequencyType: 'Monthly', price: 10000 }
      ]
    },
    {
      packageName: 'Silver Package',
      packageId: 'AMC-SILVER-002',
      packageRate: 45000,
      serviceRows: [
        { service: 'Plumbing', frequencyCount: 1, frequencyType: 'Quarterly', price: 6000 },
        { service: 'Cleaning', frequencyCount: 1, frequencyType: 'Monthly', price: 7000 },
        { service: 'Security', frequencyCount: 1, frequencyType: 'Monthly', price: 15000 },
        { service: 'Electrical', frequencyCount: 1, frequencyType: 'Half-yearly', price: 5000 }
      ]
    },
    {
      packageName: 'Basic Package',
      packageId: 'AMC-BASIC-004',
      packageRate: 30000,
      serviceRows: [
        { service: 'Cleaning', frequencyCount: 2, frequencyType: 'Monthly', price: 5000 },
        { service: 'Landscaping', frequencyCount: 1, frequencyType: 'Monthly', price: 5000 }
      ]
    }
  ];
  
  propsToUse.forEach((prop, idx) => {
    // Skip if estimate already exists for this property
    if (estimates.find(e => e.propertyId === prop.propertyId)) {
      return;
    }
    
    const config = packageConfigs[idx % packageConfigs.length];
    const estimateId = generateEstimateId();
    const totalPrice = config.serviceRows.reduce((sum, sr) => sum + sr.price, 0);
    
    const newEstimate = {
      estimateId,
      propertyId: prop.propertyId,
      propertyName: prop.name || prop.communityName || 'Property',
      estimateType: 'property-based',
      packageId: config.packageId,
      packageName: config.packageName,
      packageRate: config.packageRate,
      status: 'Draft',
      // Include serviceRows for direct frequency access
      serviceRows: config.serviceRows,
      // Include services array for backward compatibility
      services: config.serviceRows.map(sr => ({
        name: sr.service,
        frequency: sr.frequencyCount,
        frequencyCount: sr.frequencyCount,
        frequencyType: sr.frequencyType,
        price: sr.price
      })),
      addons: [],
      subTotal: totalPrice,
      gst: Math.round(totalPrice * 0.18),
      discount: 0,
      totalPrice: totalPrice + Math.round(totalPrice * 0.18),
      addonsTotal: 0,
      zone: prop.zone || 'North',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    estimates.unshift(newEstimate);
    createdEstimates.push(newEstimate);
  });
  
  setStorageData(ESTIMATES_KEY, estimates);
  return createdEstimates;
};

export const seedTestData = () => {
  // Check if data already exists
  const existingPackages = getStorageData(AMC_PACKAGES_KEY);
  const existingAddons = getStorageData(ADDONS_KEY);
  
  // Only seed if no packages exist
  if (existingPackages.length === 0) {
    // Create sample AMC Packages with serviceRows including frequency data
    const samplePackages = [
      {
        packageId: 'AMC-GOLD-001',
        packageName: 'Gold Package',
        propertyType: 'GC',
        serviceRows: [
          { service: 'Lawn Mowing', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'Pool Maintenance', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'Cleaning', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'Security', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'HVAC Maintenance', frequencyCount: 1, frequencyType: 'Monthly' }
        ],
        services: 'Lawn Mowing, Pool Maintenance, Cleaning, Security, HVAC Maintenance',
        rate: 50000,
        billingDuration: 'yearly',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        packageId: 'AMC-SILVER-002',
        packageName: 'Silver Package',
        propertyType: 'APT',
        serviceRows: [
          { service: 'Lawn Mowing', frequencyCount: 2, frequencyType: 'Monthly' },
          { service: 'Cleaning', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'Pest Control', frequencyCount: 1, frequencyType: 'Quarterly' },
          { service: 'General Maintenance', frequencyCount: 1, frequencyType: 'Monthly' }
        ],
        services: 'Lawn Mowing, Cleaning, Pest Control, General Maintenance',
        rate: 25000,
        billingDuration: 'half-yearly',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        packageId: 'AMC-PLATINUM-003',
        packageName: 'Platinum Package',
        propertyType: 'Villa',
        serviceRows: [
          { service: 'Full Maintenance', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: '24/7 Security', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'HVAC', frequencyCount: 1, frequencyType: 'Quarterly' },
          { service: 'Pool', frequencyCount: 2, frequencyType: 'Monthly' },
          { service: 'Landscaping', frequencyCount: 1, frequencyType: 'Monthly' },
          { service: 'Housekeeping', frequencyCount: 4, frequencyType: 'Monthly' },
          { service: 'Electrical', frequencyCount: 1, frequencyType: 'Quarterly' },
          { service: 'Plumbing', frequencyCount: 1, frequencyType: 'Quarterly' }
        ],
        services: 'Full Maintenance, 24/7 Security, HVAC, Pool, Landscaping, Housekeeping, Electrical, Plumbing',
        rate: 100000,
        billingDuration: 'yearly',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        packageId: 'AMC-BASIC-004',
        packageName: 'Basic Package',
        propertyType: 'Flat',
        serviceRows: [
          { service: 'Cleaning', frequencyCount: 2, frequencyType: 'Monthly' },
          { service: 'General Maintenance', frequencyCount: 1, frequencyType: 'Monthly' }
        ],
        services: 'Cleaning, General Maintenance',
        rate: 10000,
        billingDuration: 'monthly',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    setStorageData(AMC_PACKAGES_KEY, samplePackages);
  }
  
  // Only seed addons if none exist
  if (existingAddons.length === 0) {
    // Create sample Add-ons with correct frequency counts based on frequency type
    const sampleAddons = [
      {
        addonId: 'ADDON-SEC-001',
        propertyType: 'GC',
        services: [
          { name: 'Security Service', frequency: 1, frequencyType: 'Monthly', price: 5000 }
        ],
        billingCycle: 'Monthly',
        totalPrice: 5000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        addonId: 'ADDON-PEST-002',
        propertyType: 'Apt',
        services: [
          { name: 'Pest Control', frequency: 3, frequencyType: 'Quarterly', price: 2500 }
        ],
        billingCycle: 'Quarterly',
        totalPrice: 2500,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        addonId: 'ADDON-WIN-003',
        propertyType: 'Villa',
        services: [
          { name: 'Window Cleaning', frequency: 1, frequencyType: 'Monthly', price: 3000 }
        ],
        billingCycle: 'Monthly',
        totalPrice: 3000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        addonId: 'ADDON-HVAC-004',
        propertyType: 'Apt',
        services: [
          { name: 'HVAC Deep Cleaning', frequency: 3, frequencyType: 'Quarterly', price: 8000 }
        ],
        billingCycle: 'Quarterly',
        totalPrice: 8000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        addonId: 'ADDON-PAINT-005',
        propertyType: 'Villa',
        services: [
          { name: 'Touch-up Painting', frequency: 12, frequencyType: 'Yearly', price: 15000 }
        ],
        billingCycle: 'Yearly',
        totalPrice: 15000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    setStorageData(ADDONS_KEY, sampleAddons);
  }
  
  return {
    packages: getStorageData(AMC_PACKAGES_KEY),
    addons: getStorageData(ADDONS_KEY)
  };
};
