import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import { safeStorage } from '../utils/safeStorage';
import { 
  Search, Trash2, X, Check, Building2, Home, TreePine, Map,
  Eye, ChevronDown, AlertCircle, Bell, Clock, Briefcase, Lock, 
  ArrowLeft, Download, ExternalLink, Layers, LayoutGrid, FileText,
  Package, Plus, Calendar, DollarSign, Receipt, Tag, Users, UserCheck, RefreshCw,
  Edit2, Save, Truck, UserPlus
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import VendorAssignmentModal from '../components/VendorAssignmentModal';
import StaticMapView from '../components/common/StaticMapView';
import PropertyLocationDisplay from '../components/common/PropertyLocationDisplay';
import { useFP } from '../contexts/FPContext';
import * as XLSX from 'xlsx';

// Category options for Properties (same as Onboarding)
const PROPERTY_CATEGORIES = [
  {
    id: 'residential',
    name: 'Residential',
    icon: Home,
    color: 'bg-emerald-500',
    description: 'View residential properties including gated communities, apartments, and villas',
    locked: false
  },
  {
    id: 'commercial',
    name: 'Commercial',
    icon: Briefcase,
    color: 'bg-blue-500',
    description: 'View commercial properties and office spaces',
    locked: true
  }
];

const TABS = [
  { id: 'all', label: 'All Properties', icon: Building2 },
  { id: 'GC', label: 'Gated Communities', icon: Layers },
  { id: 'APT', label: 'Apartments', icon: Home },
  { id: 'VILLA', label: 'Villas', icon: TreePine },
  { id: 'PLOT', label: 'Plots', icon: Map },
  { id: 'FLAT', label: 'Flats', icon: LayoutGrid },
];

const TYPE_STYLES = {
  GC: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', accent: 'bg-blue-500' },
  APT: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', accent: 'bg-emerald-500' },
  VILLA: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', accent: 'bg-amber-500' },
  PLOT: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', accent: 'bg-rose-500' },
  FLAT: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700', accent: 'bg-cyan-500' },
};

const TYPE_LABELS = { GC: 'Gated Community', APT: 'Apartment', VILLA: 'Villa', PLOT: 'Plot', FLAT: 'Flat' };

// Helper to get display label for property type (always returns proper label)
const getTypeLabel = (type) => {
  const normalized = normalizePropertyType(type);
  return TYPE_LABELS[normalized] || type || '-';
};

// Unit types for block breakdown
const UNIT_TYPES = [
  { key: 'studio', label: 'Studio' },
  { key: 'oneBed', label: '1 Bed' },
  { key: 'twoBed', label: '2 Bed' },
  { key: 'threeBed', label: '3 Bed' },
  { key: 'fourBed', label: '4 Bed' }
];

// Helper to normalize property type for consistent filtering
const normalizePropertyType = (type) => {
  if (!type) return '';
  const upper = type.toUpperCase().replace(/[_\s-]/g, '');
  if (upper === 'GC' || upper.includes('GATED')) return 'GC';
  if (upper === 'APT' || upper.includes('APARTMENT')) return 'APT';
  if (upper === 'VILLA' || upper === 'VILLAS') return 'VILLA';
  if (upper === 'FLAT' || upper === 'FLATS') return 'FLAT';
  if (upper === 'PLOT' || upper === 'PLOTS') return 'PLOT';
  return upper;
};

const Properties = () => {
  // Get FP selection from context
  const { selectedFp } = useFP();
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [properties, setProperties] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [toast, setToast] = useState(null);
  const [viewProperty, setViewProperty] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  
  // Property detail view state
  const [detailTab, setDetailTab] = useState('details'); // 'details' or 'estimates'
  const [propertyEstimates, setPropertyEstimates] = useState([]);
  const [selectedEstimate, setSelectedEstimate] = useState(null); // For viewing estimate details
  
  // Vendor assignment modal state
  const [vendorAssignmentProperty, setVendorAssignmentProperty] = useState(null);
  const [propertyVendorAssignments, setPropertyVendorAssignments] = useState([]);
  const [loadingVendorAssignments, setLoadingVendorAssignments] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  
  // Assigned employees modal state
  const [showAssignedEmployeesModal, setShowAssignedEmployeesModal] = useState(false);
  const [assignedEmployeesProperty, setAssignedEmployeesProperty] = useState(null);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [loadingAssignedEmployees, setLoadingAssignedEmployees] = useState(false);

  const token = getAuthToken();
  
  // Check if user is Operations Manager (view-only access)
  const currentUser = JSON.parse(safeStorage.getItem('pm_current_user') || '{}');
  const isOpsManager = currentUser?.role === 'operations_manager';
  // Admin and super_admin should always have full access
  const hasFullAccess = !isOpsManager || currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Load properties from backend API based on selected FP
  const loadData = async (showLoading = false) => {
    // Only show loading spinner on initial load or manual refresh
    if (showLoading) setLoading(true);
    try {
      // Use FP-specific endpoint if an FP is selected, otherwise get all
      const baseEndpoint = selectedFp && selectedFp.id !== 'all' 
        ? `/api/admin/fp-view/${selectedFp.id}/properties`
        : '/api/onboarding';
      // Add status filter parameter
      const statusParam = statusFilter ? `?status=${statusFilter}` : '';
      const endpoint = `${baseEndpoint}${statusParam}`;
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        // Map properties - backend already sends contacts array
        const mappedProps = (result.data || []).map(p => {
          // Use contacts from backend (already parsed) or parse association_contacts
          let contacts = p.contacts || [];
          if (contacts.length === 0) {
            try {
              if (p.association_contacts) {
                contacts = typeof p.association_contacts === 'string' 
                  ? JSON.parse(p.association_contacts) 
                  : p.association_contacts;
              }
            } catch {}
          }
          if (contacts.length === 0 && (p.contact_person || p.contact_email || p.contact_phone)) {
            contacts = [{
              name: p.contact_person || '',
              email: p.contact_email || '',
              phone: p.contact_phone || '',
              countryCode: '+91'
            }];
          }
          return { ...p, contacts };
        });
        setProperties(mappedProps);
      }
      setNotifications([]);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      if (showLoading) setLoading(false);
      if (!initialLoadDone) {
        setLoading(false);
        setInitialLoadDone(true);
      }
    }
  };

  // Reset filters and reload data when FP selection changes
  useEffect(() => {
    // Reset filters when FP changes
    setZoneFilter('');
    setStatusFilter('active');
    setSearchTerm('');
    setActiveTab('all');
    
    loadData(true); // Load with spinner when FP changes
    // Poll for new entries every 30 seconds (silent background refresh)
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [selectedFp?.id, statusFilter]);

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Delete handler
  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/onboarding/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        await loadData(false); // Silent refresh after delete
        showToast('Property deleted successfully');
      } else {
        showToast(result.message || 'Failed to delete property', 'error');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      showToast('Failed to delete property', 'error');
    }
    setDeleteConfirm(null);
  };

  // Open edit modal - comprehensive like FP portal
  const openEditModal = (property) => {
    // Close view modal if open to prevent overlap
    setViewProperty(null);
    setPropertyEstimates([]);
    
    // Parse association_contacts JSON if available
    let contacts = [];
    try {
      if (property.associationContacts || property.association_contacts) {
        const rawContacts = property.associationContacts || property.association_contacts;
        contacts = typeof rawContacts === 'string' ? JSON.parse(rawContacts) : rawContacts;
      }
    } catch (e) { contacts = []; }
    
    // Fallback to single contact if no association_contacts
    if (contacts.length === 0 && (property.contactPerson || property.contact_person || property.contactEmail || property.contact_email || property.contactPhone || property.contact_phone)) {
      contacts = [{
        name: property.contactPerson || property.contact_person || '',
        email: property.contactEmail || property.contact_email || '',
        phone: (property.contactPhone || property.contact_phone || '').replace(/^\+91\s?/, ''),
        countryCode: '+91'
      }];
    }
    if (contacts.length === 0) {
      contacts = [{ name: '', email: '', phone: '', countryCode: '+91' }];
    }
    
    // Parse block_names, units_per_block and block_unit_types JSON
    let blockNames = {};
    let unitsPerBlock = {};
    let blockUnitTypes = {};
    try {
      if (property.blockNames || property.block_names) {
        const raw = property.blockNames || property.block_names;
        blockNames = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      if (property.unitsPerBlock || property.units_per_block) {
        const raw = property.unitsPerBlock || property.units_per_block;
        unitsPerBlock = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
      if (property.blockUnitTypes || property.block_unit_types) {
        const raw = property.blockUnitTypes || property.block_unit_types;
        blockUnitTypes = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch (e) {}
    
    setEditFormData({
      id: property.id,
      name: property.name || property.communityName || property.community_name || '',
      propertyType: property.propertyType || property.property_type || property.entryType || property.entry_type || '',
      entryType: property.entryType || property.entry_type || '',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zipCode || property.zip_code || property.postalCode || property.postal_code || '',
      zone: property.zone || property.zoneName || property.zone_name || property.zoneId || property.zone_id || '',
      division: property.division || property.divisionName || property.division_name || property.divisionId || property.division_id || '',
      area: property.area || property.areaName || property.area_name || '',
      isActive: property.isActive !== false && property.is_active !== false && property.status !== 'inactive',
      sourceTable: property.sourceTable || property.source_table || 'onboarded_properties',
      // Contact information
      contacts: contacts,
      // Block Details (for GC)
      numberOfBlocks: property.numberOfBlocks || property.number_of_blocks || 1,
      blockNames: blockNames,
      unitsPerBlock: unitsPerBlock,
      blockUnitTypes: blockUnitTypes,
      // APT specific
      blockInfo: property.blockInfo || property.block_info || '',
      blockNA: property.blockNA || property.block_na || false,
      numberOfUnits: property.numberOfUnits || property.number_of_units || 0,
      // Villa/Plot/Flat specific
      villaPlotNumber: property.villaPlotNumber || property.villa_plot_number || '',
      flatBlockInfo: property.flatBlockInfo || property.flat_block_info || '',
      flatBlockNA: property.flatBlockNA || property.flat_block_na || false,
      plotNA: property.plotNA || property.plot_na || false,
      // Location
      latitude: property.latitude || property.mapLat || property.map_lat || '',
      longitude: property.longitude || property.mapLng || property.map_lng || '',
      landmark: property.landmark || '',
      // Watchman Info
      watchmanName: property.watchmanName || property.watchman_name || '',
      watchmanContact: (property.watchmanContact || property.watchman_contact || '').replace(/^\+91\s?/, ''),
      // Notes
      notes: property.notes || ''
    });
    setShowEditModal(true);
  };
  
  // Helper functions for edit form contacts
  const addEditContact = () => {
    setEditFormData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), { name: '', email: '', phone: '', countryCode: '+91' }]
    }));
  };

  const removeEditContact = (index) => {
    if (editFormData.contacts?.length > 1) {
      setEditFormData(prev => ({
        ...prev,
        contacts: prev.contacts.filter((_, i) => i !== index)
      }));
    }
  };

  const updateEditContact = (index, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };

  // Helper functions for block editing
  const updateEditBlockName = (blockNum, value) => {
    setEditFormData(prev => ({
      ...prev,
      blockNames: { ...prev.blockNames, [blockNum]: value }
    }));
  };

  const updateEditBlockUnitType = (blockNum, unitType, value) => {
    const val = parseInt(value) || 0;
    setEditFormData(prev => {
      const currentBlockUnits = prev.blockUnitTypes?.[blockNum] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
      const updatedBlockUnits = { ...currentBlockUnits, [unitType]: val };
      const totalUnits = Object.values(updatedBlockUnits).reduce((sum, v) => sum + v, 0);
      return {
        ...prev,
        blockUnitTypes: { ...prev.blockUnitTypes, [blockNum]: updatedBlockUnits },
        unitsPerBlock: { ...prev.unitsPerBlock, [blockNum]: totalUnits }
      };
    });
  };

  const getEditBlockUnitTypeValue = (blockNum, unitType) => {
    const val = editFormData.blockUnitTypes?.[blockNum]?.[unitType];
    return val === undefined || val === null || val === 0 ? '' : val;
  };

  // Save edit
  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/onboarding/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });
      const result = await response.json();
      if (result.success) {
        showToast('Property updated successfully');
        setShowEditModal(false);
        setEditFormData({});
        loadData(false); // Silent refresh after edit
      } else {
        showToast(result.message || 'Failed to update property', 'error');
      }
    } catch (error) {
      console.error('Error updating property:', error);
      showToast('Failed to update property', 'error');
    }
  };

  // Handle viewing a property - load its estimates
  const handleViewProperty = async (property) => {
    setViewProperty(property);
    setDetailTab('details');
    setSelectedEstimate(null);
    // Load estimates for this property from API
    try {
      const response = await fetch(`/api/estimates?propertyId=${property.propertyId || property.property_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      setPropertyEstimates(result.success ? (result.data || []) : []);
    } catch (error) {
      console.error('Error loading estimates:', error);
      setPropertyEstimates([]);
    }
    // Load vendor assignments
    fetchPropertyVendorAssignments(property.id || property.propertyId);
  };

  // Handle closing property view
  const handleClosePropertyView = () => {
    setViewProperty(null);
    setDetailTab('details');
    setPropertyEstimates([]);
    setSelectedEstimate(null);
    setPropertyVendorAssignments([]);
  };

  // Fetch vendor assignments for a property (read-only view)
  const fetchPropertyVendorAssignments = async (propertyId) => {
    setLoadingVendorAssignments(true);
    try {
      const response = await fetch(`${API_BASE}/api/vendors/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        // Extract assignments from either serviceAssignments or propertyAssignments
        const allAssignments = Array.isArray(result.data?.serviceAssignments) 
          ? result.data.serviceAssignments 
          : (Array.isArray(result.data?.propertyAssignments) 
            ? result.data.propertyAssignments 
            : (Array.isArray(result.data) ? result.data : []));
        
        // Filter to only this property's assignments
        const propertyAssignments = allAssignments.filter(a => {
          const assignmentPropId = String(a.propertyId || a.property_id || '');
          const targetPropId = String(propertyId);
          return assignmentPropId === targetPropId;
        });
        
        setPropertyVendorAssignments(propertyAssignments);
      } else {
        setPropertyVendorAssignments([]);
      }
    } catch (error) {
      console.error('Fetch vendor assignments error:', error);
      setPropertyVendorAssignments([]);
    } finally {
      setLoadingVendorAssignments(false);
    }
  };

  // Fetch employees assigned to a specific zone (from Employee Zone Management)
  const fetchAssignedEmployeesForZone = async (zoneName, franchisePartnerId) => {
    setLoadingAssignedEmployees(true);
    try {
      // For admin, we need to get employees from the property's franchise partner
      const url = franchisePartnerId 
        ? `/api/admin/fp-view/${franchisePartnerId}/employees?status=active` 
        : '/api/employees?status=active';
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        const employeesWithZone = (result.data || []).filter(emp => {
          const empZones = emp.assigned_zones || emp.assignedZones || emp.zones || emp.zone_names || [];
          if (!zoneName || !Array.isArray(empZones) || empZones.length === 0) return false;
          return empZones.some(z => 
            z?.toLowerCase() === zoneName?.toLowerCase() || 
            z?.toLowerCase() === '__all__' ||
            z?.toLowerCase() === 'all'
          );
        });
        setAssignedEmployees(employeesWithZone);
      } else {
        setAssignedEmployees([]);
      }
    } catch (error) {
      console.error('Fetch assigned employees error:', error);
      setAssignedEmployees([]);
    } finally {
      setLoadingAssignedEmployees(false);
    }
  };

  // Open assigned employees modal
  const openAssignedEmployeesModal = (property) => {
    setAssignedEmployeesProperty(property);
    setShowAssignedEmployeesModal(true);
    fetchAssignedEmployeesForZone(property.zone || property.zone_name, property.franchise_partner_id);
  };

  // Mark all notifications as read
  const handleMarkAllRead = () => {
    setNotifications([]);
  };
  
  // Helper to check if property has vendor assignments
  const hasVendorAssignments = (propertyId) => {
    const property = properties.find(p => p.propertyId === propertyId || p.property_id === propertyId);
    return property?.hasVendorAssignments || property?.vendor_assignments_count > 0;
  };


  // Export single property to Excel
  const handleExportProperty = (property) => {
    const p = property;
    
    // Create detailed export data for a single property
    const exportData = [{
      'Property ID': p.propertyId || '',
      'Name': p.name || '',
      'Type': getTypeLabel(p.entryType),
      'Zone': p.zone || '',
      'Area Name': p.areaName || '',
      'Division': p.division || '',
      'Total Units': p.totalUnits || 0,
      'Number of Blocks': p.numberOfBlocks || '',
      'Block Info': p.blockNA ? 'N/A' : (p.blockInfo || ''),
      'Villa/Plot Number': p.villaPlotNumber || '',
      'Address': p.address || '',
      'Address Line 1': p.addressLine1 || '',
      'Apt/Suite/Unit': p.aptSuiteNA ? 'N/A' : (p.aptSuiteUnit || ''),
      'City': p.city || '',
      'State': p.state || '',
      'Postal Code': p.zip_code || p.postal_code || '',
      'Landmark': p.landmark || '',
      'Map Coordinates': p.mapLocation?.lat && p.mapLocation?.lng 
        ? `${p.mapLocation.lat}, ${p.mapLocation.lng}` 
        : '',
      'Map Address': p.mapLocation?.address || '',
      'Map Link': p.mapLocation?.lat && p.mapLocation?.lng 
        ? `https://www.google.com/maps?q=${p.mapLocation.lat},${p.mapLocation.lng}` 
        : '',
      'Notes': p.notes || '',
      'Created At': p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : ''
    }];

    // Add contacts as separate rows if present
    if (p.contacts && p.contacts.length > 0) {
      p.contacts.forEach((c, i) => {
        exportData[0][`Contact ${i + 1} Name`] = c.name || '';
        exportData[0][`Contact ${i + 1} Email`] = c.email || '';
        exportData[0][`Contact ${i + 1} Phone`] = c.phone ? (c.phone.toString().startsWith('+') ? c.phone : `${c.countryCode || '+91'} ${c.phone}`) : '';
      });
    }

    // Add blocks info for GC
    if (p.entryType === 'GC' && p.unitsPerBlock) {
      Object.entries(p.unitsPerBlock).forEach(([blockNum, units]) => {
        const blockName = p.blockNames?.[blockNum] || `Block ${blockNum}`;
        exportData[0][`${blockName} Units`] = units;
      });
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Property Details');
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 20)
    }));
    ws['!cols'] = colWidths;

    const fileName = `${p.propertyId || p.name || 'Property'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Property exported successfully');
  };

  // Export all properties to Excel
  const exportAllProperties = () => {
    if (filteredProperties.length === 0) {
      showToast('No properties to export');
      return;
    }

    const exportData = filteredProperties.map(property => ({
      'Property ID': property.propertyId || '',
      'Name': property.name || '',
      'Type': getTypeLabel(property.entryType),
      'Zone': property.zone || '',
      'Division': property.division || '',
      'Area Name': property.areaName || '',
      'Address': property.address || '',
      'City': property.city || '',
      'State': property.state || '',
      'Postal Code': property.zip_code || property.postal_code || '',
      'Total Units': property.totalUnits || 0,
      'Status': property.status || 'Active',
      'Created By': property.createdBy || '',
      'Created At': property.createdAt ? new Date(property.createdAt).toLocaleDateString('en-IN') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Properties');
    XLSX.writeFile(wb, `all_properties_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`Exported ${filteredProperties.length} properties`);
  };

  // Derived data - only from ACTIVE properties for filter dropdowns
  const activeProperties = properties.filter(p => p.isActive !== false && p.status !== 'inactive' && p.status !== 'deleted');
  const divisions = [...new Set(activeProperties.map(p => p.division).filter(Boolean))];
  const zones = [...new Set(activeProperties.map(p => p.zone).filter(Boolean))];
  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredProperties = properties.filter(p => {
    if (activeTab !== 'all' && normalizePropertyType(p.property_type || p.entryType || p.propertyType) !== activeTab) return false;
    if (zoneFilter && p.zone !== zoneFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.propertyId?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q) ||
        p.zone?.toLowerCase().includes(q) ||
        p.area?.toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0);
    const dateB = new Date(b.createdAt || b.created_at || 0);
    return dateB.getTime() - dateA.getTime(); // Sort by latest first
  });

  // Stats per type (filtered by zone if selected)
  const zoneFilteredProperties = zoneFilter 
    ? properties.filter(p => p.zone === zoneFilter)
    : properties;
  const statsByType = TABS.filter(t => t.id !== 'all').map(tab => ({
    ...tab,
    count: zoneFilteredProperties.filter(p => normalizePropertyType(p.property_type || p.entryType || p.propertyType) === tab.id).length,
    units: zoneFilteredProperties.filter(p => normalizePropertyType(p.property_type || p.entryType || p.propertyType) === tab.id).reduce((sum, p) => sum + (p.totalUnits || p.total_units || 0), 0)
  }));

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Category Selection Screen (shown first)
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-600 mt-1">View and manage onboarded properties</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
            <p className="text-gray-500 mt-2">Choose the customer category to proceed</p>
          </div>

          <div className="flex justify-center gap-8">
            {PROPERTY_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return category.locked ? (
                <div
                  key={category.id}
                  className="w-72 h-52 p-8 border border-gray-200 rounded-2xl bg-white relative cursor-not-allowed flex flex-col items-start justify-center"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">Coming Soon</span>
                  </div>
                  <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-5">
                    <Icon className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-400">{category.name}</p>
                </div>
              ) : (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="w-72 h-52 p-8 border-2 border-teal-400 rounded-2xl hover:shadow-xl transition-all duration-200 bg-teal-50/50 group flex flex-col items-start justify-center"
                >
                  <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900">{category.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Residential Properties View (main content)
  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border animate-slide-in ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Categories"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Properties</h1>
            <p className="text-gray-500 text-sm mt-1">
              {properties.length} total properties
            </p>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          {/* Export All Button */}
          <button
            onClick={exportAllProperties}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
            title="Export All Properties"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No notifications yet</div>
                  ) : (
                    notifications.slice(0, 15).map(n => (
                      <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Tabs + Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-gray-200 px-4 flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tab.id === 'all' ? properties.length : properties.filter(p => normalizePropertyType(p.property_type || p.entryType || p.propertyType) === tab.id).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search and Filters - Same row layout as FP Portal */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-200">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, zone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.trim())}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="">All Zones</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
            >
              <option value="active">Active Customers</option>
              <option value="all">All Customers</option>
              <option value="inactive">Inactive Customers</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={() => loadData(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Property Table */}
        {filteredProperties.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No properties found</p>
            <p className="text-gray-400 text-sm mt-1">
              {properties.length === 0 
                ? 'Properties created from Onboarding will appear here.' 
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Zone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Area</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Division</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Units</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Address</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">City</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Contacts</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProperties.map((property) => {
                  const propType = property.property_type || property.entryType || property.propertyType;
                  const style = TYPE_STYLES[normalizePropertyType(propType)] || TYPE_STYLES.GC;
                  return (
                    <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {property.name || property.community_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {property.property_id || property.propertyId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                          {getTypeLabel(propType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.zone || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.area || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.division_name || property.division || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-center">
                        {property.total_units || property.totalUnits || 0}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap max-w-[200px] truncate" title={property.address}>
                        {property.address || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.city || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {(() => {
                          const contacts = property.contacts || [];
                          if (contacts.length > 0 && contacts[0].phone) {
                            const phone = contacts[0].phone;
                            return phone.startsWith('+') ? phone : `+91${phone}`;
                          }
                          return property.contact_phone || '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {property.createdBy || 'System'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(property.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewProperty(property)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {hasFullAccess && (
                            <>
                              <button
                                onClick={() => handleExportProperty(property)}
                                className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Export to CSV"
                              >
                                <Download className="w-4 h-4 text-gray-400 hover:text-emerald-600" />
                              </button>
                              <button
                                onClick={() => openEditModal(property)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Property"
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                              </button>
                              <button
                                onClick={() => setVendorAssignmentProperty(property)}
                                className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Assign Vendor"
                              >
                                <Truck className="w-4 h-4 text-purple-500" />
                              </button>
                              <button
                                onClick={() => openAssignedEmployeesModal(property)}
                                className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                                title="Assigned Employees"
                              >
                                <Users className="w-4 h-4 text-green-500" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(property)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {filteredProperties.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Showing {filteredProperties.length} of {properties.length} properties
          </div>
        )}
      </div>

      {/* View Property Modal - Clean Single View (FP Style) */}
      {viewProperty && !selectedEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClosePropertyView}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{viewProperty.name || viewProperty.community_name || 'Property'}</h2>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {getTypeLabel(viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{viewProperty.property_id || viewProperty.propertyId}</p>
              </div>
              <button onClick={handleClosePropertyView} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Property Information */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Zone</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.zone_name || viewProperty.zone || viewProperty.zoneId || viewProperty.zone_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Area Name</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.area || viewProperty.area_name || viewProperty.areaName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Division</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.division_name || viewProperty.division || viewProperty.division_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Property Type</p>
                    <p className="text-sm font-medium text-gray-900">{getTypeLabel(viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Units</p>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        // First check direct total_units fields
                        const directTotal = viewProperty.total_units || viewProperty.totalUnits || viewProperty.number_of_units || viewProperty.numberOfUnits;
                        if (directTotal && parseInt(directTotal) > 0) return parseInt(directTotal);
                        
                        // Fallback to calculating from units_per_block (for GC)
                        let unitsPerBlock = viewProperty.units_per_block || viewProperty.unitsPerBlock;
                        if (typeof unitsPerBlock === 'string') {
                          try { unitsPerBlock = JSON.parse(unitsPerBlock); } catch { unitsPerBlock = null; }
                        }
                        if (unitsPerBlock && typeof unitsPerBlock === 'object') {
                          const total = Object.values(unitsPerBlock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                          if (total > 0) return total;
                        }
                        return '-';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(viewProperty.created_at || viewProperty.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Block Details - For GC */}
              {(['gated_community', 'GC', 'Gated Community', 'gated community'].some(t => 
                (viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type || '').toLowerCase() === t.toLowerCase()
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Block Details</h3>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Number of Blocks</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.number_of_blocks || viewProperty.numberOfBlocks || 1}</p>
                  </div>
                  {(() => {
                    try {
                      const blockNames = typeof viewProperty.block_names === 'string' ? JSON.parse(viewProperty.block_names) : (viewProperty.block_names || viewProperty.blockNames || {});
                      const unitsPerBlock = typeof viewProperty.units_per_block === 'string' ? JSON.parse(viewProperty.units_per_block) : (viewProperty.units_per_block || viewProperty.unitsPerBlock || {});
                      const blockUnitTypes = typeof viewProperty.block_unit_types === 'string' ? JSON.parse(viewProperty.block_unit_types) : (viewProperty.block_unit_types || viewProperty.blockUnitTypes || {});
                      const numBlocks = viewProperty.number_of_blocks || viewProperty.numberOfBlocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || 1;
                      const unitTypeLabels = { studio: 'Studio', oneBed: '1 BHK', twoBed: '2 BHK', threeBed: '3 BHK', fourBed: '4 BHK' };
                      if (Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0) {
                        return (
                          <div className="space-y-4">
                            {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                              const blockName = blockNames[blockNum] || blockNames[String(blockNum)] || `Block ${blockNum}`;
                              const unitTypes = blockUnitTypes[blockNum] || blockUnitTypes[String(blockNum)] || blockUnitTypes[blockName] || {};
                              const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                              return (
                                <div key={blockNum} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex gap-4 mb-3">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Block Name</p>
                                      <p className="text-sm font-medium text-gray-900">{blockName}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Total Units</p>
                                      <p className="text-sm font-medium text-gray-900">{unitsPerBlock[blockNum] || unitsPerBlock[String(blockNum)] || 0}</p>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 mb-2 font-medium">Unit Type Breakdown</p>
                                    {hasUnitTypes ? (
                                      <div className="flex flex-wrap gap-2">
                                        {unitTypes.studio > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">Studio: {unitTypes.studio}</span>}
                                        {unitTypes.oneBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">1 BHK: {unitTypes.oneBed}</span>}
                                        {unitTypes.twoBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">2 BHK: {unitTypes.twoBed}</span>}
                                        {unitTypes.threeBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">3 BHK: {unitTypes.threeBed}</span>}
                                        {unitTypes.fourBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">4 BHK: {unitTypes.fourBed}</span>}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400 italic">Not specified</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    } catch { return null; }
                  })()}
                </div>
              )}

              {/* Apartment Details */}
              {(['apartment', 'APT', 'Apartment'].some(t => 
                (viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type || '').toLowerCase() === t.toLowerCase()
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{viewProperty.block_na ? 'N/A' : (viewProperty.block_info || viewProperty.blockInfo || '-')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Number of Units</p>
                      <p className="text-sm font-medium text-gray-900">{viewProperty.number_of_units || viewProperty.numberOfUnits || '-'}</p>
                    </div>
                  </div>
                  {(() => {
                    try {
                      const blockUnitTypes = typeof viewProperty.block_unit_types === 'string' ? JSON.parse(viewProperty.block_unit_types) : (viewProperty.block_unit_types || viewProperty.blockUnitTypes || {});
                      const unitTypes = blockUnitTypes['apt'] || blockUnitTypes['1'] || blockUnitTypes[1] || {};
                      const hasUnitTypes = Object.values(unitTypes).some(v => v > 0);
                      return (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-500 mb-2 font-medium">Unit Type Breakdown</p>
                          {hasUnitTypes ? (
                            <div className="flex flex-wrap gap-2">
                              {unitTypes.studio > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">Studio: {unitTypes.studio}</span>}
                              {unitTypes.oneBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">1 BHK: {unitTypes.oneBed}</span>}
                              {unitTypes.twoBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">2 BHK: {unitTypes.twoBed}</span>}
                              {unitTypes.threeBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">3 BHK: {unitTypes.threeBed}</span>}
                              {unitTypes.fourBed > 0 && <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">4 BHK: {unitTypes.fourBed}</span>}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Not specified</p>
                          )}
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              )}

              {/* Villa Details */}
              {(['villa', 'VILLA', 'Villa'].some(t => 
                (viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type || '').toLowerCase() === t.toLowerCase()
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Villa Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Villa Number</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.villa_plot_number || viewProperty.villaPlotNumber || '-'}</p>
                  </div>
                </div>
              )}

              {/* Flat Details */}
              {(['flat', 'FLAT', 'Flat'].some(t => 
                (viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type || '').toLowerCase() === t.toLowerCase()
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Flat Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Flat Number</p>
                      <p className="text-sm font-medium text-gray-900">{viewProperty.villa_plot_number || viewProperty.villaPlotNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{viewProperty.flat_block_na ? 'N/A' : (viewProperty.flat_block_info || viewProperty.flatBlockInfo || '-')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plot Details */}
              {(['plot', 'PLOT', 'Plot'].some(t => 
                (viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type || '').toLowerCase() === t.toLowerCase()
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Plot Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Plot Number</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.plot_na ? 'N/A' : (viewProperty.villa_plot_number || viewProperty.villaPlotNumber || '-')}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Street Address</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">City</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">State/Province</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ZIP/Postal Code</p>
                    <p className="text-sm font-medium text-gray-900">{viewProperty.postalCode || viewProperty.zip_code || viewProperty.postal_code || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Property Location */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Location</h3>
                <PropertyLocationDisplay 
                  location={{
                    lat: viewProperty.mapLocation?.lat || viewProperty.latitude,
                    lng: viewProperty.mapLocation?.lng || viewProperty.longitude,
                    address: viewProperty.mapLocation?.address || viewProperty.landmark || `${viewProperty.address || ''}, ${viewProperty.city || ''}, ${viewProperty.state || ''}, ${viewProperty.postalCode || viewProperty.zip_code || ''}`
                  }}
                  propertyName={viewProperty.name || viewProperty.community_name || 'Property'}
                />
              </div>

              {/* Contact Information */}
              {(() => {
                // Parse association_contacts if available (like FP portal)
                let contacts = [];
                try {
                  if (viewProperty.association_contacts) {
                    contacts = typeof viewProperty.association_contacts === 'string' 
                      ? JSON.parse(viewProperty.association_contacts) 
                      : viewProperty.association_contacts;
                  }
                } catch { contacts = []; }
                
                // Fallback to single contact if no association_contacts
                if (contacts.length === 0 && (viewProperty.contact_person || viewProperty.contact_email || viewProperty.contact_phone)) {
                  contacts = [{
                    name: viewProperty.contact_person,
                    email: viewProperty.contact_email,
                    phone: viewProperty.contact_phone
                  }];
                }
                
                // Also check contacts array directly
                if (contacts.length === 0 && viewProperty.contacts && viewProperty.contacts.length > 0) {
                  contacts = viewProperty.contacts;
                }
                
                if (contacts.length === 0) return null;
                
                return (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Information</h3>
                    <div className="space-y-3">
                      {contacts.map((contact, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                            </div>
                            <span className="text-xs text-gray-500">Contact {index + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2.5fr_1fr] gap-4">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Name</p>
                              <p className="text-sm font-medium text-gray-900">{contact.name || '-'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Email</p>
                              <p className="text-sm font-medium text-gray-900 break-all">{contact.email || '-'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Phone</p>
                              <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                                {(() => {
                                  if (!contact.phone) return '-';
                                  const phone = contact.phone.toString().trim();
                                  if (phone.startsWith('+')) return phone;
                                  return `+91 ${phone}`;
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Watchman Information - For GC and APT */}
              {(['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes(
                (viewProperty.property_type || viewProperty.entryType || viewProperty.propertyType || viewProperty.entry_type || '').toLowerCase()
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Watchman Information</h3>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Name</p>
                        <p className="text-sm font-medium text-gray-900">{viewProperty.watchman_name || viewProperty.watchmanName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Contact</p>
                        <p className="text-sm font-medium text-gray-900">
                          {(() => {
                            const contact = viewProperty.watchman_contact || viewProperty.watchmanContact;
                            if (!contact) return 'N/A';
                            // Format: +91 followed by space and number
                            if (contact.startsWith('+91') && !contact.startsWith('+91 ')) {
                              return `+91 ${contact.slice(3)}`;
                            }
                            return contact.startsWith('+') ? contact : `+91 ${contact}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {viewProperty.notes && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Additional Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewProperty.notes}</p>
                  </div>
                </div>
              )}

              {/* Estimates Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h3 className="text-base font-semibold text-gray-900">Estimates ({propertyEstimates.length})</h3>
                </div>
                {propertyEstimates.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No estimates for this property</p>
                    <p className="text-xs text-gray-400 mt-1">Create an estimate from the Estimates section</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {propertyEstimates.map((estimate) => (
                      <div key={estimate.estimateId || estimate.estimate_id || estimate.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm text-gray-700">{estimate.estimateId || estimate.estimate_id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            estimate.status === 'approved' ? 'bg-green-100 text-green-700' :
                            estimate.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            estimate.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{estimate.status || 'draft'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Package:</span>
                            <span className="ml-1 font-medium">{estimate.packageName || estimate.package_name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total:</span>
                            <span className="ml-1 font-semibold text-green-600">₹{Number(estimate.totalPrice || estimate.total_amount || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <span className="ml-1">{formatDate(estimate.createdAt || estimate.created_at)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">By:</span>
                            <span className="ml-1">{estimate.createdByName || estimate.created_by_name || estimate.createdBy || '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Vendors Section - Read Only */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-4 h-4 text-purple-500" />
                  <h3 className="text-base font-semibold text-gray-900">Assigned Vendors</h3>
                </div>
                {loadingVendorAssignments ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <RefreshCw className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
                    <p className="text-sm text-gray-500">Loading vendor assignments...</p>
                  </div>
                ) : propertyVendorAssignments.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No vendors assigned to this property</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-purple-50 border-b border-purple-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-purple-800">Service Type</th>
                          <th className="px-4 py-3 text-left font-medium text-purple-800">Vendor Name</th>
                          <th className="px-4 py-3 text-left font-medium text-purple-800">Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {propertyVendorAssignments.map((assignment, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-900">
                                {assignment.serviceType || assignment.service_type || 'General'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-800">
                                {assignment.vendorName || assignment.vendor_name || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-gray-600 text-xs">
                                {assignment.vendorPhone || assignment.vendor_phone || '-'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              {hasFullAccess ? (
                <button
                  onClick={() => { setDeleteConfirm(viewProperty); handleClosePropertyView(); }}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                {hasFullAccess && (
                  <button
                    onClick={() => handleExportProperty(viewProperty)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                )}
                {hasFullAccess && (
                  <button
                    onClick={() => openEditModal(viewProperty)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> Modify
                  </button>
                )}
                <button
                  onClick={handleClosePropertyView}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estimate Detail View Modal (Read-Only) */}
      {selectedEstimate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEstimate(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Estimate Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedEstimate(null)}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-white/70" />
                      <h2 className="text-lg font-semibold text-white">
                        {selectedEstimate.packageName || 'Estimate Details'}
                      </h2>
                    </div>
                    <p className="text-xs text-white/70 font-mono mt-0.5">{selectedEstimate.estimateId}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                  selectedEstimate.status === 'Draft' ? 'bg-white/20 text-white' :
                  selectedEstimate.status === 'Sent' ? 'bg-blue-200 text-blue-800' :
                  selectedEstimate.status === 'Accepted' ? 'bg-green-200 text-green-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {selectedEstimate.status}
                </span>
              </div>
            </div>

            {/* Estimate Content - Read Only */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Metadata */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Created</label>
                  <p className="text-sm text-gray-900 font-medium">{formatDate(selectedEstimate.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Property ID</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedEstimate.propertyId}</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Estimate Type</label>
                  <p className="text-sm text-gray-900">{selectedEstimate.estimateType || 'Property-Based'}</p>
                </div>
              </div>

              
              {/* Add-ons */}
              {selectedEstimate.addons && selectedEstimate.addons.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-green-600" />
                    Add-ons ({selectedEstimate.addons.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedEstimate.addons.map((addon, idx) => (
                      <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm font-medium text-gray-800">
                          {addon.services?.map(s => s.name).join(', ') || `Add-on ${idx + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {addon.services?.map(s => s.frequencyType).join(', ')}
                        </p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-green-100 border border-green-300 rounded-lg">
                      <p className="text-sm font-semibold text-green-800">Total Add-ons Price</p>
                      <p className="font-bold text-green-700">₹{(selectedEstimate.addonsTotal || selectedEstimate.addons.reduce((sum, a) => sum + (a.totalPrice || 0), 0)).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  Pricing Breakdown
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Package Price</span>
                    <span className="font-medium text-gray-800">₹{(selectedEstimate.packageRate || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Add-ons Total</span>
                    <span className="font-medium text-gray-800">₹{(selectedEstimate.addonsTotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="text-gray-600">Sub Total</span>
                    <span className="font-medium text-gray-800">₹{(selectedEstimate.subTotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (2%)</span>
                    <span className="font-medium text-gray-800">₹{(selectedEstimate.gst || 0).toLocaleString()}</span>
                  </div>
                  {selectedEstimate.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="font-medium text-red-600">-₹{(selectedEstimate.discount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-3 mt-2">
                    <span className="text-gray-800">Final Total</span>
                    <span className="text-blue-700">₹{(selectedEstimate.totalPrice || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Customer Info if available */}
              {(selectedEstimate.customerName || selectedEstimate.customerEmail || selectedEstimate.customerPhone) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedEstimate.customerName && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Name</label>
                        <p className="text-sm text-gray-900">{selectedEstimate.customerName}</p>
                      </div>
                    )}
                    {selectedEstimate.customerEmail && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                        <p className="text-sm text-gray-900">{selectedEstimate.customerEmail}</p>
                      </div>
                    )}
                    {selectedEstimate.customerPhone && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Phone</label>
                        <p className="text-sm text-gray-900">{selectedEstimate.customerPhone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedEstimate.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">{selectedEstimate.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Lock className="w-3.5 h-3.5" />
                <span>Read-only view</span>
              </div>
              <button
                onClick={() => setSelectedEstimate(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Property?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              This will permanently remove <strong>{deleteConfirm.name}</strong> ({deleteConfirm.propertyId}). This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Property Modal - Comprehensive like FP Portal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Property</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editFormData.propertyType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || editFormData.entryType || 'Property'}
                </p>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditFormData({}); }} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Property Information */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property/Community Name *</label>
                    <input type="text" value={editFormData.name || ''} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                    <input type="text" value={editFormData.zone || ''} onChange={(e) => setEditFormData({ ...editFormData, zone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area Name</label>
                    <input type="text" value={editFormData.area || ''} onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                    <input type="text" value={editFormData.division || ''} onChange={(e) => setEditFormData({ ...editFormData, division: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                      {editFormData.propertyType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || editFormData.entryType || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information - Multiple Contacts */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Contact Information</h3>
                  <button type="button" onClick={addEditContact} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Add Contact
                  </button>
                </div>
                <div className="space-y-4">
                  {(editFormData.contacts || []).map((contact, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                        </div>
                        <span className="text-sm text-gray-600">Contact {index + 1}</span>
                        {editFormData.contacts.length > 1 && (
                          <button type="button" onClick={() => removeEditContact(index)} className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Name *</label>
                          <input type="text" value={contact.name || ''} onChange={(e) => updateEditContact(index, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Contact name" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email *</label>
                          <input type="email" value={contact.email || ''} onChange={(e) => updateEditContact(index, 'email', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="email@example.com" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Phone *</label>
                          <div className="flex gap-1">
                            <div className="w-12 flex-shrink-0 px-2 py-2 border border-gray-200 rounded-lg text-xs bg-gray-100 text-gray-600 flex items-center justify-center">+91</div>
                            <input type="tel" inputMode="numeric" maxLength={10} value={contact.phone || ''} onChange={(e) => updateEditContact(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="10-digit" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watchman Information - Only for GC and APT */}
              {(['gated_community', 'apartment', 'GC', 'APT', 'Gated Community', 'Apartment'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType === 'GC' || editFormData.entryType === 'APT'
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Watchman Information <span className="text-gray-400 text-sm font-normal">(Optional)</span></h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Name</label>
                      <input type="text" value={editFormData.watchmanName || ''} onChange={(e) => setEditFormData({ ...editFormData, watchmanName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter watchman name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Contact</label>
                      <div className="flex gap-2">
                        <div className="w-14 flex-shrink-0 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 flex items-center justify-center">+91</div>
                        <input type="tel" inputMode="numeric" maxLength={10} value={editFormData.watchmanContact || ''} onChange={(e) => setEditFormData({ ...editFormData, watchmanContact: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="10-digit number" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Block Details - Only for GC */}
              {(['gated_community', 'GC', 'Gated Community'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType === 'GC'
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Block Details</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Blocks</label>
                    <input type="number" min="1" max="50" value={editFormData.numberOfBlocks || 1} onChange={(e) => setEditFormData({ ...editFormData, numberOfBlocks: parseInt(e.target.value) || 1 })} className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {editFormData.numberOfBlocks > 0 && (
                    <div className="space-y-4">
                      {Array.from({ length: editFormData.numberOfBlocks }, (_, i) => i + 1).map(blockNum => (
                        <div key={blockNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">Block {blockNum} Name</label>
                              <input type="text" value={editFormData.blockNames?.[blockNum] || ''} onChange={(e) => updateEditBlockName(blockNum, e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder={`Block ${blockNum}`} />
                            </div>
                            <div className="w-20">
                              <label className="block text-xs text-gray-500 mb-1">Units</label>
                              <input type="number" min="0" value={editFormData.unitsPerBlock?.[blockNum] || 0} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 cursor-not-allowed" />
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {UNIT_TYPES.map(ut => (
                              <div key={ut.key}>
                                <label className="block text-xs text-gray-500 mb-1">{ut.label}</label>
                                <input type="number" min="0" value={getEditBlockUnitTypeValue(blockNum, ut.key)} onChange={(e) => updateEditBlockUnitType(blockNum, ut.key, e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Apartment Details */}
              {(['apartment', 'APT', 'Apartment'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType === 'APT'
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Block Information</label>
                      <div className="flex items-center gap-3">
                        <input type="text" value={editFormData.blockInfo || ''} disabled={editFormData.blockNA} onChange={(e) => setEditFormData({ ...editFormData, blockInfo: e.target.value })} className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 ${editFormData.blockNA ? 'bg-gray-100' : ''}`} placeholder="Enter block info" />
                        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                          <input type="checkbox" checked={editFormData.blockNA || false} onChange={(e) => setEditFormData({ ...editFormData, blockNA: e.target.checked, blockInfo: e.target.checked ? '' : editFormData.blockInfo })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          N/A
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Units</label>
                      <input type="number" min="0" value={editFormData.numberOfUnits || 0} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed" />
                    </div>
                  </div>
                  {/* Unit Types for Apartment */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Unit Types</label>
                    <div className="grid grid-cols-5 gap-2">
                      {UNIT_TYPES.map(ut => {
                        const aptUnitTypes = editFormData.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                        return (
                          <div key={ut.key}>
                            <label className="block text-xs text-gray-500 mb-1">{ut.label}</label>
                            <input type="number" min="0" value={aptUnitTypes[ut.key] || ''} onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const currentAptTypes = editFormData.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                              const newAptTypes = { ...currentAptTypes, [ut.key]: val };
                              const newTotal = Object.values(newAptTypes).reduce((sum, v) => sum + v, 0);
                              setEditFormData({ ...editFormData, blockUnitTypes: { ...editFormData.blockUnitTypes, apt: newAptTypes }, numberOfUnits: newTotal });
                            }} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              {/* Flat Details - Only for FLAT type */}
              {(['flat', 'FLAT', 'Flat'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType === 'FLAT'
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Flat Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
                      <input type="text" value={editFormData.villaPlotNumber || ''} onChange={(e) => setEditFormData({ ...editFormData, villaPlotNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter flat number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Block Information</label>
                      <div className="flex items-center gap-3">
                        <input type="text" value={editFormData.flatBlockInfo || ''} disabled={editFormData.flatBlockNA} onChange={(e) => setEditFormData({ ...editFormData, flatBlockInfo: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter block info" />
                        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                          <input type="checkbox" checked={editFormData.flatBlockNA || false} onChange={(e) => setEditFormData({ ...editFormData, flatBlockNA: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          N/A
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                    <textarea value={editFormData.address || ''} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Enter street address" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input type="text" value={editFormData.city || ''} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter city" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input type="text" value={editFormData.state || ''} onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter state" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP/Postal Code</label>
                      <input type="text" value={editFormData.zipCode || ''} onChange={(e) => setEditFormData({ ...editFormData, zipCode: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter ZIP code" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                      <input type="text" value={editFormData.landmark || ''} onChange={(e) => setEditFormData({ ...editFormData, landmark: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Near landmark" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Additional Notes <span className="text-gray-400 text-sm font-normal">(Optional)</span></h3>
                <textarea value={editFormData.notes || ''} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Enter any additional notes or comments..." />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => { setShowEditModal(false); setEditFormData({}); }} className="px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Assignment Modal */}
      {vendorAssignmentProperty && (
        <VendorAssignmentModal
          property={vendorAssignmentProperty}
          onClose={() => setVendorAssignmentProperty(null)}
          onSuccess={(message) => {
            showToast(message, 'success');
            setVendorAssignmentProperty(null);
          }}
        />
      )}

      {/* Assigned Employees Modal - View Only */}
      {showAssignedEmployeesModal && assignedEmployeesProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowAssignedEmployeesModal(false); setAssignedEmployeesProperty(null); }}>
          <div className="bg-white rounded-xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-600 to-emerald-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Assigned Employees</h2>
                    <p className="text-sm text-teal-100">Zone: {assignedEmployeesProperty.zone || assignedEmployeesProperty.zone_name || 'N/A'}</p>
                  </div>
                </div>
                <button onClick={() => { setShowAssignedEmployeesModal(false); setAssignedEmployeesProperty(null); }} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-600">Property: <span className="font-semibold text-gray-900">{assignedEmployeesProperty.community_name || assignedEmployeesProperty.name}</span></p>
              </div>
              {loadingAssignedEmployees ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
                  <p className="text-gray-500">Loading assigned employees...</p>
                </div>
              ) : assignedEmployees.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Employees Assigned</h3>
                  <p className="text-gray-600 text-sm">No employees are assigned to this zone.</p>
                  <p className="text-gray-500 text-xs mt-2">Zone assignments are managed in Employee Zone Management.</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-4"><span className="font-medium text-teal-700">{assignedEmployees.length}</span> employee(s) assigned to this zone</p>
                  <div className="grid grid-cols-2 gap-3">
                    {assignedEmployees.map((emp) => (
                      <div key={emp.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center">
                            <UserCheck className="w-5 h-5 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{emp.first_name} {emp.last_name || ''}</p>
                            <span className={`inline-block capitalize px-2 py-0.5 rounded text-xs font-medium ${
                              emp.role === 'manager' ? 'bg-purple-100 text-purple-700' :
                              emp.role === 'coordinator' ? 'bg-blue-100 text-blue-700' :
                              emp.role === 'supervisor' ? 'bg-amber-100 text-amber-700' :
                              emp.role === 'executive' ? 'bg-rose-100 text-rose-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{emp.role}</span>
                          </div>
                        </div>
                        {emp.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                            <Mail className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                        )}
                        {emp.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            <span>{emp.phone}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-3 bg-white border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">Employee zone assignments are managed in the Employee Zone Management section</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;
