// Vendor store – talks to backend API (/api/vendors/onboarding)
// Notifications remain in localStorage (UI-only concern)

const API_BASE = '/api/vendors/onboarding';
const NOTIFICATION_KEY = 'xland_vendor_notifications';

// ============================================
// Vendors – Backend API
// ============================================

// Get all onboarded vendors from the database
// status: 'active' (default), 'deleted', or 'all'
export const getVendors = async (status = 'active') => {
  try {
    const res = await fetch(`${API_BASE}?status=${status}`);
    const json = await res.json();
    if (json.success) return json.data;
    console.error('getVendors failed:', json.message);
    return [];
  } catch (err) {
    console.error('getVendors error:', err);
    return [];
  }
};

// Save a new vendor via backend API
export const saveVendor = async (formData) => {
  try {
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
    const json = await res.json();
    if (json.success) {
      // Add local notification
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
    console.error('saveVendor failed:', json.message);
    return null;
  } catch (err) {
    console.error('saveVendor error:', err);
    return null;
  }
};

// Delete an onboarded vendor via backend API
export const deleteVendor = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error('deleteVendor error:', err);
    return false;
  }
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
