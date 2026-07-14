import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { getAuthToken } from '../utils/safeStorage';
import { 
  X, Users, Check, AlertCircle, Building2, MapPin, 
  ChevronDown, Save, Loader2, UserCheck, Package, UserX
} from 'lucide-react';
import { getVendors } from '../utils/vendorStore';
import { getEstimatesByPropertyId, seedTestEstimateForProperty } from '../utils/estimateStore';
import { 
  saveServiceVendorAssignmentsWithSync, 
  getServiceVendorAssignmentsByEstimate 
} from '../utils/assignmentStore';

// Debug logger - only logs in development
const isDev = import.meta.env.DEV;
const debug = (...args) => isDev && console.log(...args);

// Zone mapping: Maps area/community names to directional zones
// This is needed because properties may have zones like "Amaravathi" while vendors have "East", "North", etc.
const ZONE_MAPPING = {
  // Area names → Directional zones
  'amaravathi': 'east',
  'kondapur': 'north',
  'gachibowli': 'north',
  'madhapur': 'north',
  'hitech city': 'north',
  'hi-tech city': 'north',
  'kukatpally': 'west',
  'miyapur': 'west',
  'bachupally': 'west',
  'pragathi nagar': 'west',
  'jubilee hills': 'south',
  'banjara hills': 'south',
  'film nagar': 'south',
  'road no 10': 'south',
  'somajiguda': 'south',
  'begumpet': 'south',
  'secunderabad': 'east',
  'uppal': 'east',
  'lb nagar': 'east',
  'dilsukhnagar': 'east',
  'nagole': 'east',
  'habsiguda': 'east',
  'tarnaka': 'east',
  'nacharam': 'east',
  'malakpet': 'east',
  'charminar': 'south',
  'mehdipatnam': 'south',
  'tolichowki': 'south',
  'attapur': 'south',
  'rajendra nagar': 'south',
  'shamshabad': 'south',
  'kokapet': 'west',
  'narsingi': 'west',
  'gandipet': 'west',
  'manikonda': 'west',
  'puppalguda': 'west',
  'lingampally': 'west',
  'patancheru': 'west',
  'kompally': 'north',
  'alwal': 'north',
  'bowenpally': 'north',
  'malkajgiri': 'east',
  'kapra': 'east',
  'sainikpuri': 'east',
  'ecil': 'east',
  'moula ali': 'east',
  // Directional zone aliases (normalize these too)
  'north zone': 'north',
  'south zone': 'south',
  'east zone': 'east',
  'west zone': 'west',
  'northern zone': 'north',
  'southern zone': 'south',
  'eastern zone': 'east',
  'western zone': 'west',
  'zone north': 'north',
  'zone south': 'south',
  'zone east': 'east',
  'zone west': 'west',
};

// Service type normalization map for flexible matching
// Maps various service name variations to a canonical category
const SERVICE_TYPE_MAP = {
  'hvac': ['hvac', 'hvac maintenance', 'hvac services', 'air conditioning', 'ac maintenance', 'heating', 'ventilation', 'ac', 'air conditioner'],
  'electrical': ['electrical', 'electrical maintenance', 'electrical services', 'electrician', 'electric', 'wiring'],
  'plumbing': ['plumbing', 'plumbing services', 'plumber', 'pipe', 'drainage', 'pipes', 'water pipes'],
  'cleaning': ['cleaning', 'housekeeping', 'deep cleaning', 'house cleaning', 'janitorial', 'sanitation', 'house keeping', 'maid service'],
  'security': ['security', 'security services', '24/7 security', 'security guard', 'surveillance', 'guard services', '24x7 security', 'watchman', 'guards'],
  'landscaping': ['landscaping', 'lawn mowing', 'gardening', 'lawn', 'garden maintenance', 'lawn care', 'greenery', 'garden', 'lawn service'],
  'pest control': ['pest control', 'pest', 'pest management', 'extermination', 'fumigation', 'termite', 'rodent control'],
  'pool': ['pool', 'pool maintenance', 'swimming pool', 'pool cleaning', 'pool services', 'swimming'],
  'painting': ['painting', 'touch-up painting', 'wall painting', 'paint services', 'paint', 'repainting'],
  'carpentry': ['carpentry', 'woodwork', 'wood work', 'furniture repair', 'wood', 'carpenter'],
  'full maintenance': ['full maintenance', 'general maintenance', 'maintenance', 'general services', 'facility maintenance', 'complete maintenance', 'total maintenance', 'all maintenance'],
  'fire safety': ['fire safety', 'fire', 'fire services', 'fire equipment', 'fire extinguisher'],
  'elevator': ['elevator', 'elevator maintenance', 'lift', 'lift maintenance', 'lifts'],
  'water tank': ['water tank', 'water tank cleaning', 'tank cleaning', 'overhead tank', 'sump cleaning'],
  'garbage': ['garbage', 'garbage collection', 'waste', 'waste management', 'trash', 'refuse'],
};

// Normalize zone value for comparison
// Handles:
//   - Area names → directional zones (e.g., "Amaravathi" → "east")
//   - Directional zone variants (e.g., "North Zone" → "north")
//   - Numbered zones (e.g., "Zone 3" → "zone 3", "Zone 1" → "zone 1")
const normalizeZone = (zone) => {
  if (!zone) return '';
  
  // Step 1: Basic normalization (lowercase, trim, clean spaces)
  let normalized = zone
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Step 2: Check if this is a numbered zone (e.g., "Zone 3", "zone 1", "Zone-2")
  // Keep numbered zones as-is for exact matching
  const numberedZoneMatch = normalized.match(/^zone[\s\-]*(\d+)$/i);
  if (numberedZoneMatch) {
    return `zone ${numberedZoneMatch[1]}`; // Normalize to "zone X" format
  }
  
  // Step 3: Check if this is a known zone/area in our mapping
  if (ZONE_MAPPING[normalized]) {
    return ZONE_MAPPING[normalized];
  }
  
  // Step 4: Try removing "zone" suffix and check again
  const withoutZone = normalized.replace(/\s*zone$/i, '').trim();
  if (ZONE_MAPPING[withoutZone]) {
    return ZONE_MAPPING[withoutZone];
  }
  
  // Step 5: If it's already a directional zone name, return it
  const directionalZones = ['north', 'south', 'east', 'west'];
  if (directionalZones.includes(withoutZone)) {
    return withoutZone;
  }
  
  // Step 6: Return cleaned value (for unrecognized zones)
  return normalized;
};

// Get the directional zone for display/debugging
const getZoneDebugInfo = (zone) => {
  const original = zone || '(empty)';
  const normalized = normalizeZone(zone);
  const wasMapping = ZONE_MAPPING[zone?.toLowerCase()?.trim()];
  return {
    original,
    normalized,
    wasMapped: !!wasMapping,
    mappedFrom: wasMapping ? zone : null
  };
};

// Normalize service type for flexible matching (module-level for use in debug logging)
const normalizeServiceType = (serviceType) => {
  if (!serviceType) return null;
  const lower = serviceType.toLowerCase().trim();
  
  for (const [category, aliases] of Object.entries(SERVICE_TYPE_MAP)) {
    if (aliases.some(alias => lower === alias || lower.includes(alias) || alias.includes(lower))) {
      return category;
    }
  }
  return lower;
};

const VendorAssignmentModal = ({ property, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [serviceAssignments, setServiceAssignments] = useState([]);
  const [error, setError] = useState(null);

  // Load vendors and estimates on mount
  useEffect(() => {
    loadData();
  }, [property]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    // DEBUG: Log property info with enhanced zone debugging
    const propertyZone = property?.zone_name || property?.zone || property?.zone_id || '';
    const propZoneDebug = getZoneDebugInfo(propertyZone);
    debug('═══════════════════════════════════════════════════════════════════════════');
    debug('[DEBUG] ASSIGN VENDORS - DATA LOAD');
    debug('═══════════════════════════════════════════════════════════════════════════');
    debug('[DEBUG] Property ID:', property?.propertyId);
    debug('[DEBUG] Property Name:', property?.name || property?.communityName);
    debug('[DEBUG] Property Zone (original):', propZoneDebug.original);
    debug('[DEBUG] Property Zone (normalized):', propZoneDebug.normalized);
    debug('[DEBUG] Zone was mapped:', propZoneDebug.wasMapped ? `YES (${propZoneDebug.original} → ${propZoneDebug.normalized})` : 'NO (direct match or unknown)');
    
    try {
      // Load vendors from API only (test vendors only used as fallback if API fails)
      let vendorData = [];
      try {
        const apiVendors = await getVendors();
        debug('[DEBUG] Vendors loaded from API:', apiVendors?.length || 0);
        
        // Use only API vendors - no merging with test data
        vendorData = apiVendors || [];
        
        if (vendorData.length === 0) {
          console.warn('[DEBUG] No vendors from API, falling back to test vendors');
          vendorData = getTestVendors();
        }
      } catch (vendorErr) {
        console.warn('[DEBUG] API failed, using test vendors as fallback:', vendorErr);
        vendorData = getTestVendors();
      }
      
      // DEBUG: Log all vendors with normalized values and service types
      debug('[DEBUG] All Vendors (' + (vendorData?.length || 0) + ' total):');
      const allVendorZones = new Set();
      const allVendorServiceTypes = new Set();
      vendorData?.forEach((v, i) => {
        const vZone = v.zone_name || v.zone || v.zone_id || '';
        const vendorZoneDebug = getZoneDebugInfo(vZone);
        allVendorZones.add(vZone);
        allVendorServiceTypes.add(v.serviceType || v.service_type);
        debug(`  ${i + 1}. ${v.ownerName || v.owner_name}`);
        debug(`      Service: "${v.serviceType || v.service_type}" → normalized: "${normalizeServiceType(v.serviceType || v.service_type)}"`);
        debug(`      Zone: "${vZone}" → normalized: "${vendorZoneDebug.normalized}"${vendorZoneDebug.wasMapped ? ' (mapped)' : ''}`);
      });
      debug('[DEBUG] All unique Vendor Zones:', Array.from(allVendorZones).join(', '));
      debug('[DEBUG] All unique Vendor Service Types:', Array.from(allVendorServiceTypes).join(', '));
      debug('═══════════════════════════════════════════════════════════════════════════');
      
      setVendors(vendorData || []);
      
      // Load estimates for this property
      const propertyEstimates = getEstimatesByPropertyId(property.propertyId);
      debug('[DEBUG] Estimates for property:', propertyEstimates?.length || 0);
      if (propertyEstimates?.length > 0) {
        debug('[DEBUG] First Estimate ID:', propertyEstimates[0]?.estimateId);
      }
      setEstimates(propertyEstimates || []);
      
      // Auto-select first estimate if available
      // If no estimate exists, do NOT show default services - user must create estimate first
      if (propertyEstimates && propertyEstimates.length > 0) {
        handleEstimateSelect(propertyEstimates[0], vendorData);
      } else {
        // No estimate exists - keep serviceAssignments empty
        // Vendor assignment is only enabled after estimate is created and linked
        setServiceAssignments([]);
        debug('[DEBUG] No estimate found - vendor assignment disabled until estimate is created');
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Test vendors for when API is unavailable - covers all zones and common service types
  const getTestVendors = () => [
    // NORTH ZONE vendors
    { vendorId: 'VND-TEST-001', ownerName: 'Green Gardens Ltd', serviceType: 'Landscaping', zone: 'North', areaName: 'Gachibowli' },
    { vendorId: 'VND-TEST-002', ownerName: 'CleanPro Services', serviceType: 'Cleaning', zone: 'North Zone', areaName: 'Madhapur' },
    { vendorId: 'VND-TEST-004', ownerName: 'AquaCare Pool Services', serviceType: 'Pool Maintenance', zone: 'North', areaName: 'Kondapur' },
    { vendorId: 'VND-TEST-007', ownerName: 'SparkleClean Windows', serviceType: 'Window Cleaning', zone: 'North', areaName: 'Hitech City' },
    { vendorId: 'VND-TEST-013', ownerName: 'NorthAir HVAC', serviceType: 'HVAC', zone: 'North', areaName: 'Kompally' },
    { vendorId: 'VND-TEST-014', ownerName: 'North Shield Security', serviceType: 'Security', zone: 'North Zone', areaName: 'Alwal' },
    { vendorId: 'VND-TEST-015', ownerName: 'TotalCare North', serviceType: 'Full Maintenance', zone: 'North', areaName: 'Bowenpally' },
    // SOUTH ZONE vendors
    { vendorId: 'VND-TEST-003', ownerName: 'SecureGuard Inc', serviceType: 'Security', zone: 'South', areaName: 'Jubilee Hills' },
    { vendorId: 'VND-TEST-008', ownerName: 'LawnMasters', serviceType: 'Lawn Mowing', zone: 'South Zone', areaName: 'Banjara Hills' },
    { vendorId: 'VND-TEST-012', ownerName: 'South Guard Services', serviceType: 'Security', zone: 'South Zone', areaName: 'Mehdipatnam' },
    { vendorId: 'VND-TEST-016', ownerName: 'SouthCool HVAC', serviceType: 'HVAC', zone: 'South', areaName: 'Tolichowki' },
    { vendorId: 'VND-TEST-017', ownerName: 'South Pool Care', serviceType: 'Pool Maintenance', zone: 'South Zone', areaName: 'Attapur' },
    { vendorId: 'VND-TEST-018', ownerName: 'Complete South Maintenance', serviceType: 'Full Maintenance', zone: 'South', areaName: 'Rajendra Nagar' },
    { vendorId: 'VND-TEST-019', ownerName: 'Garden South', serviceType: 'Landscaping', zone: 'South Zone', areaName: 'Film Nagar' },
    // EAST ZONE vendors - comprehensive coverage for all service types
    { vendorId: 'VND-TEST-005', ownerName: 'PestAway Solutions', serviceType: 'Pest Control', zone: 'East', areaName: 'Uppal' },
    { vendorId: 'VND-TEST-009', ownerName: 'EastSide Cleaners', serviceType: 'Cleaning', zone: 'East Zone', areaName: 'Dilsukhnagar' },
    { vendorId: 'VND-TEST-010', ownerName: 'Eastern Landscapers', serviceType: 'Landscaping', zone: 'East', areaName: 'Secunderabad' },
    { vendorId: 'VND-TEST-020', ownerName: 'SecureGuard 24/7', serviceType: 'Security', zone: 'East', areaName: 'LB Nagar' },
    { vendorId: 'VND-TEST-021', ownerName: 'CoolBreeze HVAC East', serviceType: 'HVAC', zone: 'East Zone', areaName: 'Nacharam' },
    { vendorId: 'VND-TEST-022', ownerName: 'BlueLagoon Pool Services', serviceType: 'Pool', zone: 'East', areaName: 'Habsiguda' },
    { vendorId: 'VND-TEST-023', ownerName: 'TotalCare East', serviceType: 'Full Maintenance', zone: 'East Zone', areaName: 'Tarnaka' },
    { vendorId: 'VND-TEST-024', ownerName: 'East Lawn Care', serviceType: 'Lawn Mowing', zone: 'East', areaName: 'Malkajgiri' },
    { vendorId: 'VND-TEST-030', ownerName: 'SparkleHome East', serviceType: 'Housekeeping', zone: 'East', areaName: 'Nagole' },
    { vendorId: 'VND-TEST-031', ownerName: 'PowerGrid Electrical', serviceType: 'Electrical', zone: 'East Zone', areaName: 'ECIL' },
    { vendorId: 'VND-TEST-032', ownerName: 'PlumbRight East', serviceType: 'Plumbing', zone: 'East', areaName: 'Kapra' },
    // WEST ZONE vendors
    { vendorId: 'VND-TEST-006', ownerName: 'CoolAir HVAC', serviceType: 'HVAC', zone: 'West Zone', areaName: 'Kukatpally' },
    { vendorId: 'VND-TEST-011', ownerName: 'West Side Security', serviceType: 'Security', zone: 'West', areaName: 'Miyapur' },
    { vendorId: 'VND-TEST-025', ownerName: 'WestClean Services', serviceType: 'Cleaning', zone: 'West', areaName: 'Lingampally' },
    { vendorId: 'VND-TEST-026', ownerName: 'West Pool Masters', serviceType: 'Pool Maintenance', zone: 'West Zone', areaName: 'Manikonda' },
    { vendorId: 'VND-TEST-027', ownerName: 'GreenWest Landscaping', serviceType: 'Landscaping', zone: 'West', areaName: 'Kokapet' },
    { vendorId: 'VND-TEST-028', ownerName: 'AllCare West Maintenance', serviceType: 'Full Maintenance', zone: 'West Zone', areaName: 'Narsingi' },
    { vendorId: 'VND-TEST-029', ownerName: 'WestPest Control', serviceType: 'Pest Control', zone: 'West', areaName: 'Patancheru' },
    
    // ZONE 1 vendors (numbered zones)
    { vendorId: 'VND-Z1-001', ownerName: 'Zone1 HVAC Services', serviceType: 'HVAC', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-002', ownerName: 'Zone1 Security Pro', serviceType: 'Security', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-003', ownerName: 'Zone1 CleanPro', serviceType: 'Cleaning', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-004', ownerName: 'Zone1 Pool Care', serviceType: 'Pool', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-005', ownerName: 'Zone1 Landscapers', serviceType: 'Landscaping', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-006', ownerName: 'Zone1 Full Care', serviceType: 'Full Maintenance', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-007', ownerName: 'Zone1 Housekeeping', serviceType: 'Housekeeping', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-008', ownerName: 'Zone1 Electricians', serviceType: 'Electrical', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    { vendorId: 'VND-Z1-009', ownerName: 'Zone1 Plumbers', serviceType: 'Plumbing', zone: 'Zone 1', areaName: 'Zone 1 Area' },
    
    // ZONE 2 vendors
    { vendorId: 'VND-Z2-001', ownerName: 'Zone2 HVAC Experts', serviceType: 'HVAC', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-002', ownerName: 'Zone2 Guard Services', serviceType: 'Security', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-003', ownerName: 'Zone2 Cleaners', serviceType: 'Cleaning', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-004', ownerName: 'Zone2 Pool Masters', serviceType: 'Pool', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-005', ownerName: 'Zone2 Green Gardens', serviceType: 'Landscaping', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-006', ownerName: 'Zone2 Complete Care', serviceType: 'Full Maintenance', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-007', ownerName: 'Zone2 Home Services', serviceType: 'Housekeeping', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-008', ownerName: 'Zone2 Power Works', serviceType: 'Electrical', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    { vendorId: 'VND-Z2-009', ownerName: 'Zone2 Pipe Fixers', serviceType: 'Plumbing', zone: 'Zone 2', areaName: 'Zone 2 Area' },
    
    // ZONE 3 vendors
    { vendorId: 'VND-Z3-001', ownerName: 'Zone3 CoolAir HVAC', serviceType: 'HVAC', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-002', ownerName: 'Zone3 SecureGuard', serviceType: 'Security', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-003', ownerName: 'Zone3 SpotlessClean', serviceType: 'Cleaning', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-004', ownerName: 'Zone3 AquaPool', serviceType: 'Pool', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-005', ownerName: 'Zone3 GreenScape', serviceType: 'Landscaping', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-006', ownerName: 'Zone3 TotalCare', serviceType: 'Full Maintenance', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-007', ownerName: 'Zone3 HomeKeepers', serviceType: 'Housekeeping', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-008', ownerName: 'Zone3 ElectroPro', serviceType: 'Electrical', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    { vendorId: 'VND-Z3-009', ownerName: 'Zone3 PlumbMasters', serviceType: 'Plumbing', zone: 'Zone 3', areaName: 'Zone 3 Area' },
    
    // ZONE 4 vendors
    { vendorId: 'VND-Z4-001', ownerName: 'Zone4 AirCool HVAC', serviceType: 'HVAC', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-002', ownerName: 'Zone4 SafeGuard', serviceType: 'Security', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-003', ownerName: 'Zone4 CleanSweep', serviceType: 'Cleaning', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-004', ownerName: 'Zone4 BluePool', serviceType: 'Pool', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-005', ownerName: 'Zone4 LawnPro', serviceType: 'Landscaping', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-006', ownerName: 'Zone4 AllServices', serviceType: 'Full Maintenance', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-007', ownerName: 'Zone4 HouseHelp', serviceType: 'Housekeeping', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-008', ownerName: 'Zone4 WireWorks', serviceType: 'Electrical', zone: 'Zone 4', areaName: 'Zone 4 Area' },
    { vendorId: 'VND-Z4-009', ownerName: 'Zone4 PipePro', serviceType: 'Plumbing', zone: 'Zone 4', areaName: 'Zone 4 Area' },
  ];

  // Handle estimate selection - auto-assign matching vendors based on AMC package services
  const handleEstimateSelect = (estimate, vendorList = vendors) => {
    setSelectedEstimate(estimate);
    
    // Extract services from estimate
    const services = extractServicesFromEstimate(estimate);
    
    // Load existing assignments for this estimate
    const existingAssignments = getServiceVendorAssignmentsByEstimate(
      property.propertyId, 
      estimate.estimateId
    );
    
    // Get property zone for filtering (normalized for exact match)
    const propZone = property?.zone_name || property?.zone || property?.zone_id || '';
    const propZoneNormalized = normalizeZone(propZone);
    
    debug(`[EstimateSelect] Property: ${property?.propertyId}, Zone: "${propZone}"`);
    debug(`[EstimateSelect] Available vendors:`, vendorList.map(v => `${v.ownerName || v.owner_name} (${v.serviceType || v.service_type}, ${v.zone_name || v.zone})`));
    
    // Map services with auto-matched vendors (by BOTH service type AND zone - exact match)
    const mappedServices = services.map(service => {
      // Check for existing assignment first
      const existing = existingAssignments.find(
        a => a.serviceType === service.serviceType
      );
      
      if (existing?.vendorId) {
        return {
          ...service,
          vendorId: existing.vendorId,
          vendorName: existing.vendorName,
          vendorZone: existing.vendorZone,
          vendorServiceType: existing.vendorServiceType
        };
      }
      
      // Auto-match vendor by BOTH service type AND zone (exact match)
      const normalizedService = normalizeServiceType(service.serviceType);
      const matchingVendor = vendorList.find(v => {
        const vendorServiceNormalized = normalizeServiceType(v.serviceType || v.service_type);
        const vendorZone = v.zone_name || v.zone || v.zone_id || '';
        const vendorZoneNormalized = normalizeZone(vendorZone);
        
        const matchesService = vendorServiceNormalized === normalizedService;
        const matchesZone = vendorZoneNormalized === propZoneNormalized;
        
        return matchesService && matchesZone;
      });
      
      debug(`[EstimateSelect] Service "${service.serviceType}" → Matched: ${matchingVendor?.ownerName || matchingVendor?.owner_name || 'None (no vendor for this service in ' + propZone + ' zone)'}`);
      
      return {
        ...service,
        vendorId: matchingVendor?.vendorId || matchingVendor?.vendor_id || '',
        vendorName: matchingVendor?.ownerName || matchingVendor?.owner_name || '',
        vendorZone: matchingVendor?.zone_name || matchingVendor?.zone || '',
        vendorServiceType: matchingVendor?.serviceType || matchingVendor?.service_type || ''
      };
    });
    
    setServiceAssignments(mappedServices);
  };

  // Extract services from estimate (handles different estimate structures)
  // Priority: estimate.serviceRows > package.serviceRows > estimate.services
  const extractServicesFromEstimate = (estimate) => {
    const services = [];
    let packageData = null;
    
    // DEBUG: Log estimate structure
    debug('[ExtractServices] Estimate ID:', estimate.estimateId);
    debug('[ExtractServices] Package ID:', estimate.packageId);
    debug('[ExtractServices] Has serviceRows:', !!estimate.serviceRows);
    debug('[ExtractServices] Has services array:', !!estimate.services);
    
    // Load linked package data if available
    if (estimate.packageId) {
      packageData = JSON.parse(safeStorage.getItem('xland_amc_packages') || '[]')
        .find(p => p.packageId === estimate.packageId);
      debug('[ExtractServices] Package found:', packageData?.packageName);
      debug('[ExtractServices] Package serviceRows:', packageData?.serviceRows);
    }
    
    // PRIORITY 1: Use estimate's own serviceRows if available
    if (estimate.serviceRows && Array.isArray(estimate.serviceRows) && estimate.serviceRows.length > 0) {
      debug('[ExtractServices] Using estimate.serviceRows');
      estimate.serviceRows.forEach(sr => {
        services.push({
          serviceType: sr.service || sr.name || sr.serviceType,
          frequencyCount: sr.frequencyCount || sr.frequency || 1,
          frequencyType: sr.frequencyType || 'Monthly'
        });
      });
    }
    // PRIORITY 2: Use package serviceRows if estimate is linked to a package
    else if (packageData?.serviceRows && Array.isArray(packageData.serviceRows) && packageData.serviceRows.length > 0) {
      debug('[ExtractServices] Using package.serviceRows');
      packageData.serviceRows.forEach(sr => {
        services.push({
          serviceType: sr.service || sr.name || sr.serviceType,
          frequencyCount: sr.frequencyCount || sr.frequency || 1,
          frequencyType: sr.frequencyType || 'Monthly'
        });
      });
    }
    // PRIORITY 3: Use estimate's services array
    else if (estimate.services && Array.isArray(estimate.services)) {
      debug('[ExtractServices] Using estimate.services array');
      
      // Check for package-based services (older format)
      if (estimate.services[0]?.type === 'package' && estimate.services[0]?.services) {
        const pkgServices = estimate.services[0].services;
        if (typeof pkgServices === 'string') {
          pkgServices.split(',').forEach(s => {
            services.push({
              serviceType: s.trim(),
              frequencyCount: 1,
              frequencyType: 'Monthly'
            });
          });
        }
      } else {
        // Direct services array - extract with proper frequency mapping
        estimate.services.forEach(s => {
          const serviceName = s.name || s.serviceType || s.service;
          if (serviceName) {
            services.push({
              serviceType: serviceName,
              frequencyCount: s.frequencyCount || s.frequency || 1,
              frequencyType: s.frequencyType || 'Monthly'
            });
          }
        });
      }
    }
    
    // Add add-on services (always check, add if not duplicate)
    if (estimate.addons && Array.isArray(estimate.addons)) {
      estimate.addons.forEach(addon => {
        if (addon.services && Array.isArray(addon.services)) {
          addon.services.forEach(s => {
            const addonServiceName = s.name || s.serviceType || s.service;
            if (addonServiceName && !services.find(svc => svc.serviceType === addonServiceName)) {
              services.push({
                serviceType: addonServiceName,
                frequencyCount: s.frequencyCount || s.frequency || 1,
                frequencyType: s.frequencyType || 'Monthly'
              });
            }
          });
        }
      });
    }
    
    debug('[ExtractServices] Final services:', services);
    return services;
  };

  // Get the property's zone (normalized for comparison)
  const propertyZoneNormalized = normalizeZone(property?.zone);

  // Get all vendors filtered by property zone only (all vendors in zone available for any service)
  const getZoneVendors = () => {
    if (!vendors.length) {
      debug('[FILTER] No vendors loaded!');
      return [];
    }
    
    debug('───────────────────────────────────────────');
    debug(`[FILTER] Property Zone: "${property?.zone}" → "${propertyZoneNormalized}"`);
    debug(`[FILTER] Total vendors to check: ${vendors.length}`);
    
    // Filter vendors by zone ONLY - all zone vendors available for any service
    const filtered = vendors.filter(v => {
      const vendorZoneNormalized = normalizeZone(v.zone);
      const matchesZone = vendorZoneNormalized === propertyZoneNormalized;
      
      // Log each vendor check
      const zoneMatch = matchesZone ? '✓' : '✗';
      debug(`[FILTER]   → ${v.ownerName} | Service: "${v.serviceType}" | Zone: "${vendorZoneNormalized}" ${zoneMatch}`);
      
      return matchesZone;
    });
    
    debug(`[FILTER] ═══ RESULT: ${filtered.length} vendors in zone "${property?.zone}" ═══`);
    return filtered;
  };

  // Memoize zone vendors to avoid recalculating on every render
  const zoneVendors = getZoneVendors();

  // Get vendors filtered by matching service type (only show matching vendors)
  const getFilteredVendors = (serviceType) => {
    if (!serviceType) return zoneVendors;
    const normalizedService = serviceType.toLowerCase().trim();
    
    return zoneVendors.filter(v => {
      const vendorService = (v.serviceType || v.service_type || '').toLowerCase().trim();
      return vendorService.includes(normalizedService) || normalizedService.includes(vendorService);
    });
  };

  // Handle vendor selection for a service
  const handleVendorSelect = (serviceIndex, vendorId) => {
    const vendor = vendors.find(v => v.vendorId === vendorId);
    
    setServiceAssignments(prev => {
      const updated = [...prev];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        vendorId: vendor?.vendorId || '',
        vendorName: vendor?.ownerName || '',
        vendorZone: vendor?.zone || '',
        vendorServiceType: vendor?.serviceType || ''
      };
      return updated;
    });
  };

  // Save all assignments - uses production database API
  const handleSave = async () => {
    if (assignedCount === 0) {
      setError('Please assign at least one vendor');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    const token = getAuthToken();
    
    try {
      // Get assignments with vendors
      const assignmentsToSave = serviceAssignments.filter(s => s.vendorId);
      
      debug('[VendorAssignmentModal] Saving to database:', {
        propertyId: property.id,
        assignments: assignmentsToSave
      });
      
      // Save each vendor assignment to database
      let successCount = 0;
      let errorMessages = [];
      
      for (const assignment of assignmentsToSave) {
        try {
          const response = await fetch('/api/vendors/assignments', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              propertyId: property.id,
              vendorId: assignment.vendorId
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            successCount++;
          } else {
            errorMessages.push(result.message || 'Failed to assign vendor');
          }
        } catch (err) {
          errorMessages.push(err.message);
        }
      }
      
      if (successCount > 0) {
        onSuccess?.(`${successCount} vendor(s) assigned successfully!`);
        onClose();
      } else {
        setError(errorMessages.join(', ') || 'Failed to save assignments');
      }
    } catch (err) {
      console.error('Error saving assignments:', err);
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  // Count assigned services
  const assignedCount = serviceAssignments.filter(s => s.vendorId).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Soft Purple */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-purple-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Assign Vendors</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-200" />
                  <span className="text-sm text-purple-100">{property.name || property.communityName}</span>
                  <span className="text-xs text-purple-200 font-mono">({property.propertyId})</span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              <span className="ml-3 text-gray-600">Loading data...</span>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Linked Estimate Info - show if estimate exists */}
              {/* Show estimate info only when estimate exists */}
              {selectedEstimate && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{selectedEstimate.packageName || 'Custom Package'}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                      <span className="font-mono text-xs">{selectedEstimate.estimateId}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-700">₹{(selectedEstimate.totalPrice || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Services Table - Vendor Selection Dropdown (All Zone Vendors Available) */}
              {serviceAssignments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      Assign Vendors to Services
                    </h3>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {zoneVendors.length} vendor(s) in {property?.zone || 'zone'}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-700 w-1/3">Service Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-700">Select Vendor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {serviceAssignments.map((service, idx) => {
                          // Get vendors filtered by matching service type
                          const filteredVendors = getFilteredVendors(service.serviceType);
                          const hasVendors = filteredVendors.length > 0;
                          const hasSelection = !!service.vendorId;
                          
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">{service.serviceType}</span>
                                  <span className="text-xs text-gray-500">
                                    {service.frequencyType} - {service.frequencyCount} visits
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 pb-16">
                                <div className="relative">
                                  <select
                                    value={service.vendorId || ''}
                                    onChange={(e) => handleVendorSelect(idx, e.target.value)}
                                    className={`w-full appearance-none px-3 py-2 border rounded-lg text-sm pr-8 outline-none transition-colors cursor-pointer ${
                                      hasSelection 
                                        ? 'border-green-400 bg-green-50 text-green-800 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                                        : 'border-gray-300 bg-white text-gray-700 focus:border-purple-400 focus:ring-2 focus:ring-purple-100'
                                    }`}
                                  >
                                    {hasVendors ? (
                                      <>
                                        <option value="">-- Select Vendor --</option>
                                        {filteredVendors.map(v => (
                                          <option key={v.vendorId} value={v.vendorId}>
                                            {v.ownerName || v.owner_name} ({v.serviceType || v.service_type})
                                          </option>
                                        ))}
                                      </>
                                    ) : (
                                      <option value="">No {service.serviceType} vendors in zone</option>
                                    )}
                                  </select>
                                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Assignment Summary */}
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-slate-600" />
                        <span className="text-sm font-medium text-slate-700">
                          {assignedCount} of {serviceAssignments.length} services assigned
                        </span>
                      </div>
                      {assignedCount === serviceAssignments.length ? (
                        <span className="flex items-center gap-1 text-xs text-slate-700 bg-slate-200 px-2.5 py-1 rounded-full font-medium">
                          <Check className="w-3 h-3" />
                          All Assigned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-600 bg-slate-200 px-2.5 py-1 rounded-full font-medium">
                          <AlertCircle className="w-3 h-3" />
                          {serviceAssignments.length - assignedCount} pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* No Estimate Disclaimer - Show when no estimate is linked */}
              {!selectedEstimate && serviceAssignments.length === 0 && (
                <div className="py-10">
                  <div className="flex flex-col items-center text-center max-w-md mx-auto">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                      <Package className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Estimate Linked</h3>
                    <p className="text-gray-600 leading-relaxed">
                      No estimate is linked to this property yet. Please create an estimate first to assign vendors based on AMC package services.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {selectedEstimate 
              ? 'All vendors in this zone are available for any service. Same vendor can be assigned to multiple services.'
              : 'Create an estimate first to enable vendor assignments'
            }
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              {selectedEstimate ? 'Cancel' : 'Close'}
            </button>
            {/* Only show Save button when estimate exists and services are available */}
            {selectedEstimate && serviceAssignments.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saving || assignedCount === 0}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  saving || assignedCount === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Assignments
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorAssignmentModal;
