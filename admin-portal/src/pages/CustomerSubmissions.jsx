import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Trash2, X, Check, Building2, Home, TreePine, Map,
  Eye, ChevronDown, AlertCircle, Bell, Clock, Hammer, Lock, 
  ArrowLeft, Download, ExternalLink, Layers, LayoutGrid, UserPlus, Users,
  FileText, Store, Package, Shield, RefreshCw, Edit2, Truck
} from 'lucide-react';
import { getProperties, deleteProperty, getNotifications, markAllNotificationsRead } from '../utils/propertyStore';
import { getZoneNames, createZone } from '../utils/zoneStore';
import { getVendors } from '../utils/vendorStore';
import { getEmployees, getEmployeesByZone } from '../utils/employeeStore';
import { 
  assignVendorToProperty, 
  assignEmployeeToProperty,
  getPropertyAssignments 
} from '../utils/assignmentStore';
import { getEstimatesByPropertyId, getAMCPackageByPropertyId } from '../utils/estimateStore';
import VendorAssignmentModal from '../components/VendorAssignmentModal';
import * as XLSX from 'xlsx';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Category options for Customer Submissions (same as Create Customer)
const CUSTOMER_CATEGORIES = [
  {
    id: 'residential',
    name: 'Residential',
    icon: Home,
    color: 'bg-emerald-500',
    locked: false
  },
  {
    id: 'commercial',
    name: 'Commercial',
    icon: Store,
    color: 'bg-blue-500',
    locked: true
  }
];

const TABS = [
  { id: 'all', label: 'All Customers', icon: Building2 },
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

const CustomerSubmissions = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [properties, setProperties] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewProperty, setViewProperty] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  
  // Get FP list and selection from context
  const { fpList, selectedFp, selectFp, selectedPropertyType, setSelectedPropertyType, loading: fpLoading, refreshFpList } = useFP();
  const token = sessionStorage.getItem('pm_auth_token');
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  
  // Assignment states
  const [assignVendorModal, setAssignVendorModal] = useState(null); // property to assign vendor to
  const [assignEmployeeModal, setAssignEmployeeModal] = useState(null); // property to assign employee to
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  
  // Enhanced Assign Vendor Modal states
  const [selectedServiceType, setSelectedServiceType] = useState('');
  const [selectedFrequencyType, setSelectedFrequencyType] = useState('Monthly');
  
  // Service Types for vendor assignment
  const SERVICE_TYPES = ['Plumbing', 'Electrical', 'HVAC', 'Cleaning', 'Security', 'Pest Control', 'Landscaping', 'General Maintenance'];
  const FREQUENCY_TYPES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-yearly', 'Yearly'];
  const [propertyAssignments, setPropertyAssignments] = useState({});
  const [propertyEstimates, setPropertyEstimates] = useState([]);
  const [viewAMCDetails, setViewAMCDetails] = useState(null); // AMC package details modal
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const [propertiesLoading, setPropertiesLoading] = useState(false);

  // Load properties from FP-specific API or all FPs (Admin mode)
  const loadData = useCallback(async () => {
    if (!selectedFp) {
      setProperties([]);
      return;
    }
    
    setPropertiesLoading(true);
    try {
      let endpoint;
      if (selectedFp.id === 'all') {
        // Admin mode - fetch all properties from all FPs
        endpoint = `${API_BASE}/api/admin/all-properties`;
        console.log('Property Management: Fetching ALL properties (Admin mode)');
      } else {
        // Specific FP selected - fetch from that FP only
        endpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/properties`;
        console.log('Property Management: Fetching properties for FP ID:', selectedFp.id);
      }
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      console.log('Property Management: API returned', result.data?.length || 0, 'properties');
      if (result.success) {
        // Map API response to expected format and filter by property type
        let props = result.data.map(p => {
          // Build contacts array from inline fields if not already present
          let contacts = p.contacts || [];
          if (contacts.length === 0 && (p.contact_person || p.contact_email || p.contact_phone)) {
            contacts = [{
              name: p.contact_person || '',
              email: p.contact_email || '',
              phone: p.contact_phone || '',
              countryCode: '+91'
            }];
          }
          
          return {
            id: p.id,
            propertyId: p.property_id,
            name: p.name,
            propertyType: p.property_type,
            category: p.category || 'residential',
            zone: p.zone_name || p.zone,
            area: p.area || p.area_name,
            division: p.division,
            units: p.units || 0,
            address: p.address,
            city: p.city,
            state: p.state,
            zipCode: p.zip_code || p.postal_code,
            contactPerson: p.contact_person,
            contactPhone: p.contact_phone,
            contactEmail: p.contact_email,
            contacts: contacts,
            createdAt: p.created_at,
            createdBy: p.created_by,
            status: p.status || 'active',
            sourceTable: p.source_table,
            fpId: p.fp_id || p.franchise_partner_id,
            fpName: p.fp_name || p.company_name
          };
        });
        
        // For now, only showing residential properties (commercial coming soon)
        props = props.filter(p => {
          const cat = (p.category || 'residential').toLowerCase();
          return cat === 'residential';
        });
        
        setProperties(props);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setPropertiesLoading(false);
    }
    setNotifications(getNotifications());
  }, [selectedFp, token]);

  // Auto-select residential category when FP is selected (for seamless FP switching)
  useEffect(() => {
    if (selectedFp && !selectedCategory) {
      setSelectedCategory('residential');
    }
  }, [selectedFp, selectedCategory]);

  // Reload data when entering main view or when FP/filters change
  useEffect(() => {
    // Only load data when both category and FP are selected (main view)
    if (selectedCategory && selectedFp) {
      console.log('CustomerSubmissions: Loading data for FP:', selectedFp.id, selectedFp.companyName);
      loadData();
    }
    // Poll for new entries every 10 seconds
    const interval = setInterval(() => {
      if (selectedCategory && selectedFp) {
        loadData();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, statusFilter, selectedCategory, selectedFp]);

  // Show toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Handle viewing property with estimates
  const handleViewProperty = (property) => {
    setViewProperty(property);
    const estimates = getEstimatesByPropertyId(property.propertyId);
    setPropertyEstimates(estimates);
  };

  // Delete handler - use admin API endpoint
  const handleDelete = async (property) => {
    try {
      // Determine correct ID and endpoint based on source
      const propertyId = property.id?.toString().startsWith('prop-') 
        ? property.id.replace('prop-', '') 
        : property.id;
      
      const response = await fetch(`${API_BASE}/api/admin/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        await loadData();
        showToast('Property deleted successfully');
      } else {
        showToast(result.message || 'Failed to delete property', 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Failed to delete property', 'error');
    }
    setDeleteConfirm(null);
  };

  // Mark all notifications as read
  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setNotifications(getNotifications());
  };

  // Load vendors for assignment modal
  const openAssignVendorModal = async (property) => {
    setAssignVendorModal(property);
    setSelectedVendor(null);
    setVendorSearchTerm('');
    setSelectedServiceType('');
    setSelectedFrequencyType('Monthly');
    try {
      const vendorList = await getVendors('active');
      setVendors(vendorList);
    } catch (err) {
      console.error('Error loading vendors:', err);
      setVendors([]);
    }
  };

  // Load employees for assignment modal (filtered by zone)
  const openAssignEmployeeModal = (property) => {
    setAssignEmployeeModal(property);
    setSelectedEmployee(null);
    setEmployeeSearchTerm('');
    // Get employees eligible for this property's zone
    const eligibleEmployees = property.zone 
      ? getEmployeesByZone(property.zone)
      : getEmployees('active');
    setEmployees(eligibleEmployees);
  };

  // Handle vendor assignment
  const handleAssignVendor = () => {
    if (!selectedVendor || !assignVendorModal) return;
    if (!selectedServiceType) {
      showToast('Please select a service type', 'error');
      return;
    }
    
    const result = assignVendorToProperty({
      vendorId: selectedVendor.vendorId,
      vendorName: selectedVendor.ownerName,
      vendorPhone: selectedVendor.ownerMobile,
      vendorEmail: selectedVendor.ownerEmail,
      serviceType: selectedServiceType,
      frequencyType: selectedFrequencyType,
      propertyId: assignVendorModal.propertyId,
      propertyName: assignVendorModal.name,
      propertyZone: assignVendorModal.zone,
      assignedBy: 'admin',
    });

    if (result.success) {
      showToast(`${selectedVendor.ownerName} assigned for ${selectedServiceType} (${selectedFrequencyType})`);
      setAssignVendorModal(null);
      setSelectedVendor(null);
      setSelectedServiceType('');
      setSelectedFrequencyType('Monthly');
    } else {
      showToast(result.message, 'error');
    }
  };

  // Handle employee assignment
  const handleAssignEmployee = () => {
    if (!selectedEmployee || !assignEmployeeModal) return;
    
    const result = assignEmployeeToProperty({
      employeeId: selectedEmployee.employeeId,
      employeeName: selectedEmployee.name,
      employeePhone: selectedEmployee.phone,
      employeeEmail: selectedEmployee.email,
      propertyId: assignEmployeeModal.propertyId,
      propertyName: assignEmployeeModal.name,
      propertyZone: assignEmployeeModal.zone,
      assignedBy: 'admin',
    });

    if (result.success) {
      showToast(`${selectedEmployee.name} assigned to ${assignEmployeeModal.name}`);
      setAssignEmployeeModal(null);
      setSelectedEmployee(null);
    } else {
      showToast(result.message, 'error');
    }
  };

  // Filter vendors by search term and selected service type
  const filteredVendors = vendors.filter(v => {
    // Filter by selected service type first
    if (selectedServiceType && v.serviceType !== selectedServiceType) return false;
    // Then filter by search term
    if (!vendorSearchTerm) return true;
    const q = vendorSearchTerm.toLowerCase();
    return (
      v.ownerName?.toLowerCase().includes(q) ||
      v.vendorId?.toLowerCase().includes(q) ||
      v.serviceType?.toLowerCase().includes(q)
    );
  });

  // Filter employees by search term
  const filteredEmployees = employees.filter(e => {
    if (!employeeSearchTerm) return true;
    const q = employeeSearchTerm.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    );
  });

  // Export single property to Excel
  const handleExportProperty = (property) => {
    const p = property;
    
    // Create detailed export data for a single property
    const exportData = [{
      'Property ID': p.propertyId || '',
      'Name': p.name || '',
      'Type': TYPE_LABELS[p.entryType] || '',
      'Zone': p.zone || '',
      'Area Name': p.area || '',
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
      'Postal Code': p.zipCode || p.zip_code || p.postal_code || '',
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
        exportData[0][`Contact ${i + 1} Phone`] = c.phone?.startsWith('+') ? c.phone : `${c.countryCode || '+91'} ${c.phone}` || '';
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
    showToast('Customer exported successfully');
  };

  // Export all filtered properties to Excel
  const handleExportAll = () => {
    const exportData = filteredProperties.map(p => ({
      'Property ID': p.propertyId || '',
      'Name': p.name || '',
      'Type': TYPE_LABELS[p.entryType] || '',
      'Zone': p.zone || '',
      'Area Name': p.area || '',
      'Division': p.division || '',
      'Total Units': p.totalUnits || 0,
      'Address': p.address || '',
      'City': p.city || '',
      'State': p.state || '',
      'Postal Code': p.zipCode || p.zip_code || p.postal_code || '',
      'Contacts': p.contacts?.length || 0,
      'Status': p.status === 'deleted' ? 'Deleted' : 'Active',
      'Created At': p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Properties');
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `All_Properties_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('All properties exported successfully');
  };

  // Derived data
  const divisions = [...new Set(properties.map(p => p.division).filter(Boolean))];
  const zones = [...new Set(properties.map(p => p.zone).filter(Boolean))];
  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredProperties = properties.filter(p => {
    if (activeTab !== 'all' && normalizePropertyType(p.entryType) !== activeTab) return false;
    if (divisionFilter && p.division !== divisionFilter) return false;
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
  });

  // Stats per type
  const statsByType = TABS.filter(t => t.id !== 'all').map(tab => ({
    ...tab,
    count: properties.filter(p => normalizePropertyType(p.entryType) === tab.id).length,
    units: properties.filter(p => normalizePropertyType(p.entryType) === tab.id).reduce((sum, p) => sum + (p.totalUnits || 0), 0)
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

  // Handle FP selection
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
    // Auto-set category to residential when FP is selected
    if (!selectedCategory) {
      setSelectedCategory('residential');
    }
  };

  // Get the viewing label based on selection
  const getViewingLabel = () => {
    if (selectedFp && selectedFp.id !== 'all') {
      return `Viewing properties for ${selectedFp.companyName}`;
    }
    return `Viewing all properties (Admin Mode)`;
  };

  // Step 1: Show Property Type Selection (Residential/Commercial) - Matching Add Customer design
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">View and manage customer properties</p>
        </div>

        {/* Category Selection Card */}
        <div className="bg-gray-50 rounded-2xl p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
            <p className="text-gray-500 mt-2">Choose the customer category to proceed</p>
          </div>

          <div className="flex justify-center gap-8">
            {/* Residential */}
            <button
              onClick={() => setSelectedCategory('residential')}
              className="w-72 h-52 p-8 border-2 border-teal-400 rounded-2xl hover:shadow-xl transition-all duration-200 bg-teal-50/50 group flex flex-col items-start justify-center"
            >
              <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Home className="w-7 h-7 text-white" />
              </div>
              <p className="text-lg font-semibold text-gray-900">Residential</p>
            </button>

            {/* Commercial - Coming Soon */}
            <div className="w-72 h-52 p-8 border border-gray-200 rounded-2xl bg-white relative cursor-not-allowed flex flex-col items-start justify-center">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Coming Soon</span>
              </div>
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-5">
                <Store className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-400">Commercial</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Show FP selection screen after Residential is selected
  if (!selectedFp) {
    return (
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setSelectedCategory(null); setProperties([]); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Property Management - Residential</h1>
            <p className="text-gray-500 mt-1">Select a franchise partner to view properties</p>
          </div>
        </div>

        {/* Selection Card */}
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 rounded-xl p-8">
          <Building2 className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Select Franchise Partner</h2>
          <p className="text-gray-400 text-sm mb-6">Choose an FP to view their residential properties</p>
          
          {/* FP Dropdown */}
          <div className="relative w-80">
            <button
              onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm hover:border-emerald-400 transition-colors shadow-sm"
            >
              <span className="text-gray-600">Select Franchise Partner...</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {fpDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                {/* Admin option */}
                <button
                  onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' })}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-emerald-50 transition-colors border-b border-gray-100"
                >
                  <div className="font-medium flex items-center gap-2 text-emerald-600">
                    <Shield className="w-4 h-4" />
                    Admin (All FPs)
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">View all properties from all FPs</div>
                </button>
                
                {fpLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading franchise partners...
                  </div>
                ) : fpList.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No franchise partners found</div>
                ) : (
                  fpList.map(fp => (
                    <button
                      key={fp.id}
                      onClick={() => handleFpSelect(fp)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">{fp.fpId}</span>
                        <span className="text-xs text-gray-500">{fp.ownerName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Refresh button */}
          <button
            onClick={refreshFpList}
            className="mt-4 flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${fpLoading ? 'animate-spin' : ''}`} />
            Refresh FP List
          </button>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Property Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            {getViewingLabel()} • {properties.length} properties
          </p>
        </div>
        
        {/* FP Switcher - Top Right */}
        <div className="relative">
          <button
            onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
            className="flex items-center gap-3 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
            <span className="font-medium text-gray-700">
              {selectedFp.id === 'all' ? 'Admin (All FPs)' : selectedFp.fpId}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {fpDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
              {/* Admin option */}
              <button
                onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' })}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-gray-100 ${
                  selectedFp.id === 'all' ? 'bg-slate-50' : ''
                }`}
              >
                <div className="font-medium flex items-center gap-2 text-slate-700">
                  <Shield className="w-4 h-4" />
                  Admin (All FPs)
                </div>
                <div className="text-xs text-gray-500 mt-0.5">View all properties</div>
              </button>
              
              {fpLoading ? (
                <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : (
                fpList.map(fp => (
                  <button
                    key={fp.id}
                    onClick={() => handleFpSelect(fp)}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                      selectedFp.id === fp.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{fp.fpId}</span>
                      <span className="text-xs text-gray-500">{fp.ownerName}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Secondary row with action buttons */}
      <div className="flex items-center justify-end gap-2">
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
                  {tab.id === 'all' ? properties.length : properties.filter(p => p.entryType === tab.id).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="p-3 sm:p-4 border-b border-gray-200 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, zone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <div className="relative flex-shrink-0">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 border border-gray-300 rounded-md text-xs sm:text-sm bg-white focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none whitespace-nowrap"
              >
                <option value="">All Divisions</option>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative flex-shrink-0">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 border border-gray-300 rounded-md text-xs sm:text-sm bg-white focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none whitespace-nowrap"
              >
                <option value="">All Zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative flex-shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`appearance-none pl-3 pr-7 py-2 border rounded-md text-xs sm:text-sm focus:ring-1 focus:ring-blue-200 focus:border-blue-400 outline-none whitespace-nowrap ${
                  statusFilter === 'deleted' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                }`}
              >
                <option value="active" className="bg-white text-gray-900">Active</option>
                <option value="deleted" className="bg-white text-gray-900">Deleted</option>
                <option value="all" className="bg-white text-gray-900">All</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            {(divisionFilter || zoneFilter || searchTerm || statusFilter !== 'active') && (
              <button
                onClick={() => { setDivisionFilter(''); setZoneFilter(''); setSearchTerm(''); setStatusFilter('active'); }}
                className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex-shrink-0 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Property Table */}
        {propertiesLoading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-10 h-10 text-primary-500 mx-auto mb-3 animate-spin" />
            <p className="text-gray-500 font-medium">Loading properties...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No properties found</p>
            <p className="text-gray-400 text-sm mt-1">
              {properties.length === 0 
                ? 'Customers created from Add Customer will appear here.' 
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">Zone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Area</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Division</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell">Address</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell">City</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell">Created By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProperties.map((property) => {
                  const typeKey = property.propertyType?.toUpperCase()?.replace(/[^A-Z]/g, '') || 'GC';
                  const style = TYPE_STYLES[typeKey] || TYPE_STYLES.GC;
                  return (
                    <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap text-sm truncate max-w-[120px]">
                        {property.name}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {property.propertyId}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                          {property.propertyType || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden md:table-cell">
                        {property.zone || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden lg:table-cell">
                        {property.area || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden lg:table-cell">
                        {property.division_name || property.division || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap max-w-[150px] truncate hidden xl:table-cell" title={property.address}>
                        {property.address || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden xl:table-cell">
                        {property.city || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-700 whitespace-nowrap hidden xl:table-cell">
                        {property.createdBy || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden md:table-cell">
                        {formatDate(property.createdAt)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap hidden sm:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          property.status === 'deleted' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {property.status === 'deleted' ? 'Deleted' : 'Active'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewProperty(property)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleExportProperty(property)}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Export to CSV"
                          >
                            <Download className="w-4 h-4 text-gray-400 hover:text-emerald-600" />
                          </button>
                          <button
                            onClick={() => handleViewProperty(property)}
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Property"
                          >
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => setAssignVendorModal(property)}
                            className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Assign Vendor"
                          >
                            <Truck className="w-4 h-4 text-purple-500" />
                          </button>
                          <button
                            onClick={() => setAssignEmployeeModal(property)}
                            className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                            title="Assign Employee"
                          >
                            <UserPlus className="w-4 h-4 text-green-500" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(property)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
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


      {/* View Property Modal */}
      {viewProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewProperty(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{viewProperty.name}</h2>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[viewProperty.entryType]?.badge}`}>
                    {TYPE_LABELS[viewProperty.entryType]}
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{viewProperty.propertyId}</p>
              </div>
              <button onClick={() => setViewProperty(null)} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content - Form-like layout */}
            <div className="px-6 py-5 space-y-6">
              {/* Property Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Property Information</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Zone</label>
                    <p className="text-sm text-gray-900">{viewProperty.zone || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Area Name</label>
                    <p className="text-sm text-gray-900">{viewProperty.area || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Division</label>
                    <p className="text-sm text-gray-900">{viewProperty.division_name || viewProperty.division || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Property Type</label>
                    <p className="text-sm text-gray-900">{viewProperty.propertyType || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Units</label>
                    <p className="text-sm text-gray-900">{viewProperty.units || 0}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Created Date</label>
                    <p className="text-sm text-gray-900">{formatDate(viewProperty.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Gated Community Block Details */}
              {viewProperty.entryType === 'GC' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Block Details</h3>
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1">Number of Blocks</label>
                    <p className="text-sm text-gray-900">{viewProperty.numberOfBlocks || 1}</p>
                  </div>
                  {viewProperty.unitsPerBlock && Object.keys(viewProperty.unitsPerBlock).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(viewProperty.unitsPerBlock).map(([blockNum, units]) => (
                        <React.Fragment key={blockNum}>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="block text-xs text-gray-500 mb-1">Block Name</label>
                            <p className="text-sm text-gray-900">{viewProperty.blockNames?.[blockNum] || `Block ${blockNum}`}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <label className="block text-xs text-gray-500 mb-1">Units</label>
                            <p className="text-sm text-gray-900">{units}</p>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Apartment Details */}
              {viewProperty.entryType === 'APT' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Block Information</label>
                      <p className="text-sm text-gray-900">{viewProperty.blockNA ? 'N/A' : (viewProperty.blockInfo || '-')}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Number of Units</label>
                      <p className="text-sm text-gray-900">{viewProperty.numberOfUnits || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Villa Details */}
              {viewProperty.entryType === 'VILLA' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Villa Details</h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Villa Number</label>
                    <p className="text-sm text-gray-900">{viewProperty.villaPlotNumber || '-'}</p>
                  </div>
                </div>
              )}

              {/* Flat Details */}
              {viewProperty.entryType === 'FLAT' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Flat Details</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Flat Number</label>
                      <p className="text-sm text-gray-900">{viewProperty.villaPlotNumber || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Block Information</label>
                      <p className="text-sm text-gray-900">{viewProperty.flatBlockNA ? 'N/A' : (viewProperty.flatBlockInfo || '-')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plot Details */}
              {viewProperty.entryType === 'PLOT' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Plot Details</h3>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Plot Number</label>
                    <p className="text-sm text-gray-900">{viewProperty.plotNA ? 'N/A' : (viewProperty.villaPlotNumber || '-')}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Address</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Street Address</label>
                    <p className="text-sm text-gray-900">{viewProperty.address || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Apt/Suite</label>
                    <p className="text-sm text-gray-900">
                      {viewProperty.aptSuiteNA ? 'N/A' : (viewProperty.aptSuiteUnit || '-')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">City</label>
                    <p className="text-sm text-gray-900">{viewProperty.city || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">State/Province</label>
                    <p className="text-sm text-gray-900">{viewProperty.state || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ZIP/Postal Code</label>
                    <p className="text-sm text-gray-900">{viewProperty.zipCode || viewProperty.zip_code || viewProperty.postal_code || '-'}</p>
                  </div>
                  {viewProperty.landmark && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Landmark</label>
                      <p className="text-sm text-gray-900">{viewProperty.landmark}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Location with clickable link */}
              {viewProperty.mapLocation?.lat && viewProperty.mapLocation?.lng && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Map Location</h3>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
                    {viewProperty.mapLocation.address && (
                      <p className="text-sm text-gray-700 mb-3">{viewProperty.mapLocation.address}</p>
                    )}
                    <a
                      href={`https://www.google.com/maps?q=${viewProperty.mapLocation.lat},${viewProperty.mapLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Maps
                    </a>
                    <p className="text-xs text-gray-500 mt-2 font-mono">
                      {viewProperty.mapLocation.lat.toFixed(6)}, {viewProperty.mapLocation.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}

              {/* Contacts */}
              {viewProperty.contacts && viewProperty.contacts.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Contact Information</h3>
                  <div className="space-y-3">
                    {viewProperty.contacts.map((c, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr] gap-4 p-3 bg-gray-50 rounded-md">
                        <div className="min-w-0">
                          <label className="block text-xs text-gray-500 mb-1">Name</label>
                          <p className="text-sm text-gray-900">{c.name}</p>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-xs text-gray-500 mb-1">Email</label>
                          <p className="text-sm text-gray-900 break-all" title={c.email}>{c.email}</p>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-xs text-gray-500 mb-1">Phone</label>
                          <p className="text-sm text-gray-900 whitespace-nowrap">{c.phone?.startsWith('+') ? c.phone : `${c.countryCode || '+91'} ${c.phone}`}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {viewProperty.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">Notes</h3>
                  <p className="text-sm text-gray-700">{viewProperty.notes}</p>
                </div>
              )}

              {/* Estimates View Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Estimates ({propertyEstimates.length})
                </h3>
                {propertyEstimates.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No estimates for this property</p>
                    <p className="text-xs text-gray-400 mt-1">Create an estimate from the Estimates section</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {propertyEstimates.map((estimate) => (
                      <div key={estimate.estimateId} className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-indigo-700 text-sm">{estimate.estimateId}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            estimate.status === 'Approved' ? 'bg-green-100 text-green-700' :
                            estimate.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                            estimate.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {estimate.status || 'Draft'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Total:</span>
                            <span className="ml-1 font-medium text-gray-700">₹{(estimate.totalPrice || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Services:</span>
                            <span className="ml-1 font-medium text-gray-700">{estimate.services?.length || 0}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Created:</span>
                            <span className="ml-1 text-gray-700">{new Date(estimate.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {estimate.services && estimate.services.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-indigo-200">
                            <div className="flex flex-wrap gap-1">
                              {estimate.services.slice(0, 3).map((service, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-white text-indigo-600 rounded text-xs">
                                  {service.name}
                                </span>
                              ))}
                              {estimate.services.length > 3 && (
                                <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-700 rounded text-xs">
                                  +{estimate.services.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center sticky bottom-0">
              <button
                onClick={() => { setDeleteConfirm(viewProperty); setViewProperty(null); }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportProperty(viewProperty)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
                <button
                  onClick={() => setViewProperty(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
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
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Customer?</h3>
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
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Assignment Modal - Estimate-Based Table Layout */}
      {assignVendorModal && (
        <VendorAssignmentModal
          property={assignVendorModal}
          onClose={() => setAssignVendorModal(null)}
          onSuccess={(message) => {
            showToast(message, 'success');
            setAssignVendorModal(null);
          }}
        />
      )}

      {/* Assign Employee Modal */}
      {assignEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAssignEmployeeModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Assign Employee</h2>
                <p className="text-sm text-gray-500">Select an employee for {assignEmployeeModal.name}</p>
                {assignEmployeeModal.zone && (
                  <p className="text-xs text-indigo-600 mt-1">Showing employees assigned to {assignEmployeeModal.zone} or all zones</p>
                )}
              </div>
              <button onClick={() => setAssignEmployeeModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees by name, ID, or email..."
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[400px] p-4">
              {filteredEmployees.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No eligible employees found</p>
                  <p className="text-gray-400 text-xs mt-1">Add employees from Employee Management</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEmployees.map((employee) => (
                    <button
                      key={employee.employeeId}
                      onClick={() => setSelectedEmployee(employee)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        selectedEmployee?.employeeId === employee.employeeId
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {employee.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{employee.name}</p>
                        <p className="text-xs text-gray-500">{employee.employeeId}</p>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                          employee.assignedZones === 'all'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {employee.assignedZones === 'all' ? 'All Zones' : `${employee.assignedZones?.length || 0} Zones`}
                        </span>
                      </div>
                      {selectedEmployee?.employeeId === employee.employeeId && (
                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setAssignEmployeeModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignEmployee}
                disabled={!selectedEmployee}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Assign Employee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AMC Details Modal */}
      {viewAMCDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">AMC Package Details</h3>
                    <p className="text-sm text-indigo-100">
                      {viewAMCDetails.amcPackage.packageId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewAMCDetails(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Property Info Section */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Property Information
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Property ID</p>
                      <p className="font-medium text-gray-900">{viewAMCDetails.property.propertyId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Property Name</p>
                      <p className="font-medium text-gray-900">{viewAMCDetails.property.name || viewAMCDetails.property.communityName || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Type</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[viewAMCDetails.property.entryType]?.badge || 'bg-gray-100 text-gray-700'}`}>
                        {TYPE_LABELS[viewAMCDetails.property.entryType] || viewAMCDetails.property.entryType}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Zone</p>
                      <p className="font-medium text-gray-900">{viewAMCDetails.property.zone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Division</p>
                      <p className="font-medium text-gray-900">{viewAMCDetails.property.division_name || viewAMCDetails.property.division || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Units</p>
                      <p className="font-medium text-gray-900">{viewAMCDetails.property.totalUnits || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AMC Package Summary */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Package Summary
                </h4>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-indigo-600 mb-1">Package ID</p>
                      <p className="font-mono text-sm font-medium text-indigo-900">{viewAMCDetails.amcPackage.packageId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 mb-1">Billing Duration</p>
                      <p className="font-medium text-indigo-900 capitalize">{viewAMCDetails.amcPackage.billingDuration || 'Monthly'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 mb-1">Status</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        viewAMCDetails.amcPackage.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {viewAMCDetails.amcPackage.status || 'Active'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 mb-1">Created</p>
                      <p className="font-medium text-indigo-900 text-sm">
                        {viewAMCDetails.amcPackage.createdAt 
                          ? new Date(viewAMCDetails.amcPackage.createdAt).toLocaleDateString() 
                          : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Services Table */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Services ({viewAMCDetails.amcPackage.services?.length || 0})
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Service Name</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Frequency</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Type</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Rate (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewAMCDetails.amcPackage.services?.map((service, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{service.name}</td>
                          <td className="px-4 py-3 text-center text-gray-700">
                            {service.frequencyCount || service.frequency || 1}x
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {service.frequencyType || 'Monthly'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            ₹{parseFloat(service.rate || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing Summary */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Pricing Summary</h4>
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Sub Total</span>
                    <span className="font-medium text-gray-900">
                      ₹{(viewAMCDetails.amcPackage.subTotal || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">GST (2%)</span>
                    <span className="font-medium text-gray-900">
                      ₹{(viewAMCDetails.amcPackage.gst || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t border-indigo-200 pt-2 mt-2 flex justify-between items-center">
                    <span className="font-semibold text-indigo-900">Total Amount</span>
                    <span className="text-xl font-bold text-indigo-600">
                      ₹{(viewAMCDetails.amcPackage.totalPrice || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setViewAMCDetails(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSubmissions;
