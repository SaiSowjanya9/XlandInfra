// Property store – talks to backend API (/api/onboarding)
// Notifications remain in localStorage (UI-only concern)

const API_BASE = '/api/onboarding';
const NOTIFICATION_KEY = 'xland_notifications';

// ============================================
// Properties – Backend API
// ============================================

// Get all onboarded properties from the database
export const getProperties = async () => {
  try {
    const res = await fetch(API_BASE);
    const json = await res.json();
    if (json.success) return json.data;
    console.error('getProperties failed:', json.message);
    return [];
  } catch (err) {
    console.error('getProperties error:', err);
    return [];
  }
};

// Save a new property via backend API
export const saveProperty = async (formData, entryType, category) => {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryType,
        category: category || 'residential',
        zone: formData.zone,
        areaName: formData.areaName,
        division: formData.division,
        propertyType: formData.propertyType,
        communityName: formData.communityName,
        numberOfBlocks: formData.numberOfBlocks,
        blockNames: formData.blockNames,
        unitsPerBlock: formData.unitsPerBlock,
        blockInfo: formData.blockInfo,
        blockNA: formData.blockNA,
        numberOfUnits: formData.numberOfUnits,
        villaPlotNumber: formData.villaPlotNumber,
        // Address fields
        address: formData.address,
        addressLine1: formData.addressLine1,
        aptSuiteUnit: formData.aptSuiteUnit,
        aptSuiteNA: formData.aptSuiteNA,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        landmark: formData.landmark,
        mapLocation: formData.mapLocation,
        notes: formData.notes,
        associationContacts: formData.associationContacts,
      }),
    });
    const json = await res.json();
    if (json.success) {
      // Add local notification
      addNotification({
        id: Date.now().toString(),
        type: 'property_created',
        title: 'New Property Added',
        message: `${formData.communityName} (${json.data.propertyId}) has been onboarded as ${entryType}.`,
        propertyId: json.data.propertyId,
        timestamp: new Date().toISOString(),
        read: false,
      });
      return json.data;
    }
    console.error('saveProperty failed:', json.message);
    return null;
  } catch (err) {
    console.error('saveProperty error:', err);
    return null;
  }
};

// Delete an onboarded property via backend API
export const deleteProperty = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error('deleteProperty error:', err);
    return false;
  }
};

// ============================================
// Notifications – localStorage (UI-only)
// ============================================

export const getNotifications = () => {
  try {
    const data = localStorage.getItem(NOTIFICATION_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addNotification = (notification) => {
  const notifications = getNotifications();
  notifications.unshift(notification);
  if (notifications.length > 50) notifications.length = 50;
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const markNotificationRead = (id) => {
  const notifications = getNotifications().map(n =>
    n.id === id ? { ...n, read: true } : n
  );
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const markAllNotificationsRead = () => {
  const notifications = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
};

export const getUnreadCount = () => {
  return getNotifications().filter(n => !n.read).length;
};
