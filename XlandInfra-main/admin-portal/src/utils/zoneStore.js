import { safeStorage, getAuthToken } from './safeStorage';
// Zone store – manages zones in localStorage (can be migrated to backend later)

const ZONE_STORAGE_KEY = 'xland_zones';

// Default zones
const DEFAULT_ZONES = [
  { id: 'zone_1', name: 'North Zone', status: 'active', createdAt: new Date().toISOString() },
  { id: 'zone_2', name: 'South Zone', status: 'active', createdAt: new Date().toISOString() },
  { id: 'zone_3', name: 'East Zone', status: 'active', createdAt: new Date().toISOString() },
  { id: 'zone_4', name: 'West Zone', status: 'active', createdAt: new Date().toISOString() },
  { id: 'zone_5', name: 'Central Zone', status: 'active', createdAt: new Date().toISOString() },
];

// Initialize zones if not present
const initializeZones = () => {
  const existing = safeStorage.getItem(ZONE_STORAGE_KEY);
  if (!existing) {
    safeStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(DEFAULT_ZONES));
  }
};

// Get all zones
export const getZones = (status = 'active') => {
  initializeZones();
  try {
    const data = safeStorage.getItem(ZONE_STORAGE_KEY);
    const zones = data ? JSON.parse(data) : [];
    if (status === 'all') return zones;
    return zones.filter(z => z.status === status);
  } catch {
    return [];
  }
};

// Get zone by ID
export const getZoneById = (id) => {
  const zones = getZones('all');
  return zones.find(z => z.id === id);
};

// Create a new zone
export const createZone = (zoneName) => {
  const zones = getZones('all');
  
  // Check for duplicate names
  const exists = zones.some(z => z.name.toLowerCase() === zoneName.toLowerCase() && z.status === 'active');
  if (exists) {
    return { success: false, message: 'Zone with this name already exists' };
  }
  
  const newZone = {
    id: `zone_${Date.now()}`,
    name: zoneName,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  
  zones.push(newZone);
  safeStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(zones));
  
  return { success: true, data: newZone };
};

// Update a zone
export const updateZone = (id, updates) => {
  const zones = getZones('all');
  const index = zones.findIndex(z => z.id === id);
  
  if (index === -1) {
    return { success: false, message: 'Zone not found' };
  }
  
  // Check for duplicate names if name is being updated
  if (updates.name) {
    const exists = zones.some(z => 
      z.id !== id && 
      z.name.toLowerCase() === updates.name.toLowerCase() && 
      z.status === 'active'
    );
    if (exists) {
      return { success: false, message: 'Zone with this name already exists' };
    }
  }
  
  zones[index] = { ...zones[index], ...updates, updatedAt: new Date().toISOString() };
  safeStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(zones));
  
  return { success: true, data: zones[index] };
};

// Deactivate a zone (soft delete)
export const deactivateZone = (id) => {
  return updateZone(id, { status: 'inactive' });
};

// Reactivate a zone
export const reactivateZone = (id) => {
  return updateZone(id, { status: 'active' });
};

// Delete a zone permanently
export const deleteZone = (id) => {
  const zones = getZones('all');
  const filtered = zones.filter(z => z.id !== id);
  safeStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(filtered));
  return { success: true };
};

// Get zone names array (for dropdowns)
export const getZoneNames = () => {
  return getZones('active').map(z => z.name);
};
