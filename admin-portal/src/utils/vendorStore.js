// Vendor store – Backend API only (no localStorage for vendor data)
// Notifications remain in localStorage (UI-only concern)

const API_BASE = '/api/vendors/onboarding';
const NOTIFICATION_KEY = 'xland_vendor_notifications';

// ============================================
// Vendors – Backend API Only
// ============================================

// Get all onboarded vendors from the database
export const getVendors = async (status = 'active') => {
  const res = await fetch(`${API_BASE}?status=${status}`);
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();
  if (json.success) return json.data;
  throw new Error(json.message || 'Failed to fetch vendors');
};

// Save a new vendor via backend API
export const saveVendor = async (formData) => {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: formData.serviceType,
      serviceVerified: formData.serviceVerified,
      zone: formData.zone,
      areaName: formData.areaName,
      division: formData.division,
      // Owner details
      ownerName: formData.ownerName,
      ownerMobile: formData.ownerMobile,
      ownerEmail: formData.ownerEmail,
      ownerAadhar: formData.ownerAadhar,
      ownerCountryCode: formData.ownerCountryCode,
      // Manager contact
      managerName: formData.managerName,
      managerMobile: formData.managerMobile,
      managerEmail: formData.managerEmail,
      managerCountryCode: formData.managerCountryCode,
      // Point of contact
      pocName: formData.pocName,
      pocMobile: formData.pocMobile,
      pocEmail: formData.pocEmail,
      pocCountryCode: formData.pocCountryCode,
      // Rate & Coverage
      ratePerVisit: parseFloat(formData.ratePerVisit) || 0,
      coveragePerDay: parseInt(formData.coveragePerDay) || 0,
      createdBy: formData.createdBy,
    }),
  });
  
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}: ${res.statusText}`);
  }
  
  const json = await res.json();
  if (json.success) {
    // Add notification for UI
    addVendorNotification({
      id: Date.now().toString(),
      type: 'vendor_created',
      title: 'New Vendor Added',
      message: `${formData.ownerName} (${json.data.vendorId}) - ${formData.serviceType} vendor added.`,
      vendorId: json.data.vendorId,
      timestamp: new Date().toISOString(),
      read: false,
    });
    return json.data;
  }
  throw new Error(json.message || 'Failed to save vendor');
};

// Delete an onboarded vendor via backend API
export const deleteVendor = async (id) => {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Server returned ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();
  if (json.success) return true;
  throw new Error(json.message || 'Failed to delete vendor');
};

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
