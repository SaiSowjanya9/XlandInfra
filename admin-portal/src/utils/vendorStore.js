// Vendor store – localStorage based (works offline without backend)
// Uses localStorage for vendor data persistence

const VENDOR_KEY = 'xland_vendors';
const NOTIFICATION_KEY = 'xland_vendor_notifications';

// Helper to get data from localStorage
const getStorageData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Helper to save data to localStorage
const setStorageData = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Generate unique vendor ID
const generateVendorId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VND-${timestamp}-${random}`;
};

// ============================================
// Vendors – localStorage Storage
// ============================================

// Get all onboarded vendors from localStorage
export const getVendors = async (status = 'active') => {
  const vendors = getStorageData(VENDOR_KEY);
  if (status === 'all') return vendors;
  return vendors.filter(v => v.status === status);
};

// Save a new vendor to localStorage
export const saveVendor = async (formData) => {
  const vendors = getStorageData(VENDOR_KEY);
  
  const newVendor = {
    vendorId: generateVendorId(),
    serviceType: formData.serviceType,
    serviceVerified: formData.serviceVerified || false,
    zone: formData.zone,
    areaName: formData.areaName,
    division: formData.division,
    // Owner details
    ownerName: formData.ownerName,
    ownerMobile: formData.ownerMobile,
    ownerEmail: formData.ownerEmail,
    ownerAadhar: formData.ownerAadhar,
    ownerCountryCode: formData.ownerCountryCode || '+91',
    // Manager contact
    managerName: formData.managerName,
    managerMobile: formData.managerMobile,
    managerEmail: formData.managerEmail,
    managerCountryCode: formData.managerCountryCode || '+91',
    // Point of contact
    pocName: formData.pocName,
    pocMobile: formData.pocMobile,
    pocEmail: formData.pocEmail,
    pocCountryCode: formData.pocCountryCode || '+91',
    // Rate & Coverage
    ratePerVisit: parseFloat(formData.ratePerVisit) || 0,
    coveragePerDay: parseInt(formData.coveragePerDay) || 0,
    createdBy: formData.createdBy || 'admin',
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  
  vendors.push(newVendor);
  setStorageData(VENDOR_KEY, vendors);
  
  // Add notification for UI
  addVendorNotification({
    id: Date.now().toString(),
    type: 'vendor_created',
    title: 'New Vendor Added',
    message: `${formData.ownerName} (${newVendor.vendorId}) - ${formData.serviceType} vendor added.`,
    vendorId: newVendor.vendorId,
    timestamp: new Date().toISOString(),
    read: false,
  });
  
  return newVendor;
};

// Update an existing vendor
export const updateVendor = async (vendorId, updates) => {
  const vendors = getStorageData(VENDOR_KEY);
  const index = vendors.findIndex(v => v.vendorId === vendorId);
  
  if (index === -1) {
    throw new Error('Vendor not found');
  }
  
  vendors[index] = { ...vendors[index], ...updates, updatedAt: new Date().toISOString() };
  setStorageData(VENDOR_KEY, vendors);
  
  return vendors[index];
};

// Delete a vendor (soft delete - change status to inactive)
export const deleteVendor = async (vendorId) => {
  const vendors = getStorageData(VENDOR_KEY);
  const index = vendors.findIndex(v => v.vendorId === vendorId);
  
  if (index === -1) {
    throw new Error('Vendor not found');
  }
  
  vendors[index].status = 'inactive';
  vendors[index].deletedAt = new Date().toISOString();
  setStorageData(VENDOR_KEY, vendors);
  
  return true;
};

// Get vendor by ID
export const getVendorById = (vendorId) => {
  const vendors = getStorageData(VENDOR_KEY);
  return vendors.find(v => v.vendorId === vendorId);
};

// Get vendors by service type
export const getVendorsByServiceType = (serviceType) => {
  const vendors = getStorageData(VENDOR_KEY);
  return vendors.filter(v => v.serviceType === serviceType && v.status === 'active');
};

// Get vendors by zone
export const getVendorsByZone = (zone) => {
  const vendors = getStorageData(VENDOR_KEY);
  return vendors.filter(v => v.zone === zone && v.status === 'active');
};

// Seed sample vendors for testing
export const seedSampleVendors = () => {
  const existingVendors = getStorageData(VENDOR_KEY);
  if (existingVendors.length > 0) return; // Don't seed if data exists
  
  const sampleVendors = [
    {
      vendorId: 'VND-001',
      serviceType: 'Plumbing',
      serviceVerified: true,
      zone: 'North',
      areaName: 'Gurgaon Sector 45',
      division: 'Residential',
      ownerName: 'Rajesh Kumar',
      ownerMobile: '9876543210',
      ownerEmail: 'rajesh@plumbpro.com',
      ownerAadhar: '1234-5678-9012',
      ownerCountryCode: '+91',
      managerName: 'Suresh Singh',
      managerMobile: '9876543211',
      managerEmail: 'suresh@plumbpro.com',
      managerCountryCode: '+91',
      pocName: 'Amit Sharma',
      pocMobile: '9876543212',
      pocEmail: 'amit@plumbpro.com',
      pocCountryCode: '+91',
      ratePerVisit: 500,
      coveragePerDay: 5,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    {
      vendorId: 'VND-002',
      serviceType: 'Electrical',
      serviceVerified: true,
      zone: 'South',
      areaName: 'Noida Sector 62',
      division: 'Commercial',
      ownerName: 'Vikram Electricals',
      ownerMobile: '9988776655',
      ownerEmail: 'vikram@electricpro.com',
      ownerAadhar: '2345-6789-0123',
      ownerCountryCode: '+91',
      managerName: 'Deepak Verma',
      managerMobile: '9988776656',
      managerEmail: 'deepak@electricpro.com',
      managerCountryCode: '+91',
      pocName: 'Rohit Kumar',
      pocMobile: '9988776657',
      pocEmail: 'rohit@electricpro.com',
      pocCountryCode: '+91',
      ratePerVisit: 600,
      coveragePerDay: 4,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    {
      vendorId: 'VND-003',
      serviceType: 'Cleaning',
      serviceVerified: true,
      zone: 'East',
      areaName: 'Greater Noida',
      division: 'Residential',
      ownerName: 'CleanPro Services',
      ownerMobile: '9112233445',
      ownerEmail: 'info@cleanpro.com',
      ownerAadhar: '3456-7890-1234',
      ownerCountryCode: '+91',
      managerName: 'Priya Gupta',
      managerMobile: '9112233446',
      managerEmail: 'priya@cleanpro.com',
      managerCountryCode: '+91',
      pocName: 'Anita Sharma',
      pocMobile: '9112233447',
      pocEmail: 'anita@cleanpro.com',
      pocCountryCode: '+91',
      ratePerVisit: 350,
      coveragePerDay: 8,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    {
      vendorId: 'VND-004',
      serviceType: 'HVAC',
      serviceVerified: true,
      zone: 'West',
      areaName: 'Dwarka',
      division: 'Commercial',
      ownerName: 'CoolAir Solutions',
      ownerMobile: '9556677889',
      ownerEmail: 'contact@coolair.com',
      ownerAadhar: '4567-8901-2345',
      ownerCountryCode: '+91',
      managerName: 'Manoj Kumar',
      managerMobile: '9556677880',
      managerEmail: 'manoj@coolair.com',
      managerCountryCode: '+91',
      pocName: 'Sanjay Patel',
      pocMobile: '9556677881',
      pocEmail: 'sanjay@coolair.com',
      pocCountryCode: '+91',
      ratePerVisit: 800,
      coveragePerDay: 3,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      status: 'active'
    },
    {
      vendorId: 'VND-005',
      serviceType: 'Security',
      serviceVerified: true,
      zone: 'North',
      areaName: 'Rohini',
      division: 'Residential',
      ownerName: 'SecureGuard Agency',
      ownerMobile: '9223344556',
      ownerEmail: 'info@secureguard.com',
      ownerAadhar: '5678-9012-3456',
      ownerCountryCode: '+91',
      managerName: 'Ram Singh',
      managerMobile: '9223344557',
      managerEmail: 'ram@secureguard.com',
      managerCountryCode: '+91',
      pocName: 'Vijay Kumar',
      pocMobile: '9223344558',
      pocEmail: 'vijay@secureguard.com',
      pocCountryCode: '+91',
      ratePerVisit: 450,
      coveragePerDay: 6,
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      status: 'active'
    }
  ];
  
  setStorageData(VENDOR_KEY, sampleVendors);
  console.log('[VendorStore] Seeded sample vendors');
};

// Auto-clear sample vendors on store load (one-time cleanup)
const autoCleanupSampleVendors = () => {
  const vendors = getStorageData(VENDOR_KEY);
  const sampleIds = ['VND-001', 'VND-002', 'VND-003', 'VND-004', 'VND-005'];
  const hasSampleData = vendors.some(v => sampleIds.includes(v.vendorId));
  if (hasSampleData) {
    const filtered = vendors.filter(v => !sampleIds.includes(v.vendorId));
    setStorageData(VENDOR_KEY, filtered);
    console.log('[VendorStore] Auto-cleared sample vendors');
  }
};

// Run cleanup on load
autoCleanupSampleVendors();

// ============================================
// Notifications – localStorage (UI-only)
// ============================================

export const getVendorNotifications = () => {
  try {
    const data = localStorage.getItem(NOTIFICATION_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addVendorNotification = (notification) => {
  const notifications = getVendorNotifications();
  notifications.unshift(notification);
  if (notifications.length > 50) notifications.length = 50;
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const markVendorNotificationRead = (id) => {
  const notifications = getVendorNotifications().map(n =>
    n.id === id ? { ...n, read: true } : n
  );
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const markAllVendorNotificationsRead = () => {
  const notifications = getVendorNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const getVendorUnreadCount = () => {
  return getVendorNotifications().filter(n => !n.read).length;
};
