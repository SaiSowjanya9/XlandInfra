// Property store – talks to backend API (/api/onboarding)
// Notifications remain in localStorage (UI-only concern)

const API_BASE = '/api/onboarding';
const NOTIFICATION_KEY = 'xland_notifications';

// ============================================
// Properties – Backend API
// ============================================

// Get all onboarded properties from the database
// status: 'active' (default), 'deleted', or 'all'
export const getProperties = async (status = 'active') => {
  try {
    const res = await fetch(`${API_BASE}?status=${status}`);
    const json = await res.json();
    if (json.success) return json.data;
    console.error('getProperties failed:', json.message);
    return [];
  } catch (err) {
    console.error('getProperties error:', err);
    return [];
  }
};

// Get a single property by Property ID
export const getPropertyById = async (propertyId) => {
  try {
    const res = await fetch(`${API_BASE}/lookup/${encodeURIComponent(propertyId)}`);
    const json = await res.json();
    if (json.success) return json.data;
    console.error('getPropertyById failed:', json.message);
    return null;
  } catch (err) {
    console.error('getPropertyById error:', err);
    return null;
  }
};

// Helper: Extract block names from property based on entry type
export const extractBlockNames = (property) => {
  if (!property) return '';
  
  const entryType = property.entryType?.toUpperCase();
  
  if (entryType === 'GC') {
    // Gated Community: blockNames is an object like {1: "A", 2: "B"}
    if (property.blockNames && typeof property.blockNames === 'object') {
      const blockValues = Object.values(property.blockNames).filter(Boolean);
      if (blockValues.length > 0) {
        return blockValues.join(', ');
      }
      // If blockNames object exists but values are empty, show block count
      const blockKeys = Object.keys(property.blockNames);
      if (blockKeys.length > 0) {
        return `${blockKeys.length} Block(s)`;
      }
    }
    // Fallback: use numberOfBlocks
    if (property.numberOfBlocks && property.numberOfBlocks > 0) {
      return `${property.numberOfBlocks} Block(s)`;
    }
  } else if (entryType === 'APT' || entryType === 'FLAT') {
    // Apartment/Flat: blockInfo is a string
    if (property.blockInfo && typeof property.blockInfo === 'string') {
      return property.blockInfo.trim();
    }
    if (property.blockNA) {
      return 'N/A';
    }
  }
  
  return '';
};

// Helper: Extract total units from property based on entry type
export const extractTotalUnits = (property) => {
  if (!property) return '';
  
  const entryType = property.entryType?.toUpperCase();
  
  if (entryType === 'GC') {
    // Calculate from unitsPerBlock
    if (property.unitsPerBlock && typeof property.unitsPerBlock === 'object') {
      const total = Object.values(property.unitsPerBlock).reduce(
        (sum, u) => sum + (parseInt(u) || 0), 0
      );
      if (total > 0) return total;
    }
    // Fallback to totalUnits
    if (property.totalUnits) return property.totalUnits;
  } else if (entryType === 'APT') {
    return property.numberOfUnits || property.totalUnits || '';
  } else if (['VILLA', 'FLAT', 'PLOT'].includes(entryType)) {
    return 1; // Single unit
  }
  
  return property.totalUnits || '';
};

// Helper: Extract unit/flat/villa number based on entry type
export const extractUnitNumber = (property) => {
  if (!property) return '';
  
  const entryType = property.entryType?.toUpperCase();
  
  if (['VILLA', 'FLAT', 'PLOT'].includes(entryType)) {
    return property.villaPlotNumber || '';
  }
  
  return '';
};

// Create customer accounts for contacts with valid emails
const createCustomerAccounts = async (contacts, propertyData, createdBy) => {
  const results = [];
  
  console.log('📧 createCustomerAccounts called with contacts:', contacts);
  console.log('📧 Property data:', propertyData);
  
  for (const contact of contacts) {
    console.log('📧 Processing contact:', contact);
    // Only create account if contact has a valid email
    if (contact.email && contact.email.includes('@')) {
      console.log('📧 Valid email found, calling /api/customers/create for:', contact.email);
      try {
        const token = sessionStorage.getItem('pm_auth_token');
        const res = await fetch('/api/customers/create', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            email: contact.email,
            firstName: contact.name?.split(' ')[0] || '',
            lastName: contact.name?.split(' ').slice(1).join(' ') || '',
            phone: contact.phone,
            countryCode: contact.countryCode || '+91',
            propertyId: propertyData.id,
            propertyName: propertyData.name,
            propertyCode: propertyData.propertyId,
            createdBy
          })
        });
        
        const json = await res.json();
        results.push({
          email: contact.email,
          success: json.success,
          message: json.message,
          customerId: json.data?.customerId
        });
        
        if (json.success) {
          console.log(`✅ Customer account created for ${contact.email}`);
        } else {
          console.warn(`⚠️ Customer account creation for ${contact.email}: ${json.message}`);
        }
      } catch (err) {
        console.error(`❌ Error creating customer account for ${contact.email}:`, err);
        results.push({
          email: contact.email,
          success: false,
          message: err.message
        });
      }
    }
  }
  
  return results;
};

// Save a new property via backend API
export const saveProperty = async (formData, entryType, category, createdBy = 'system') => {
  try {
    const token = sessionStorage.getItem('pm_auth_token');
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
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
        blockUnitTypes: formData.blockUnitTypes,
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
        watchmanName: formData.watchmanName,
        watchmanContact: formData.watchmanContact,
        createdBy,
      }),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('saveProperty HTTP error:', res.status, errorText);
      throw new Error(`Server error: ${res.status}`);
    }
    
    const json = await res.json();
    if (json.success) {
      // Create customer accounts for contacts with emails
      const contacts = formData.associationContacts || [];
      const customerResults = await createCustomerAccounts(contacts, json.data, createdBy);
      
      // Count successful email sends
      const emailsSent = customerResults.filter(r => r.success).length;
      
      // Add local notification
      addNotification({
        id: Date.now().toString(),
        type: 'property_created',
        title: 'New Property Added',
        message: `${formData.communityName} (${json.data.propertyId}) has been onboarded as ${entryType}.${emailsSent > 0 ? ` ${emailsSent} activation email(s) sent.` : ''}`,
        propertyId: json.data.propertyId,
        timestamp: new Date().toISOString(),
        read: false,
      });
      
      // Return property data with customer creation results
      return {
        ...json.data,
        customerAccounts: customerResults
      };
    }
    console.error('saveProperty failed:', json.message, json.error);
    throw new Error(json.message || 'Failed to save property');
  } catch (err) {
    console.error('saveProperty error:', err);
    throw err; // Re-throw so the calling code can handle it
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
