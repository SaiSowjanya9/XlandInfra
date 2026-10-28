import ViewModal from '../components/common/ViewModal';
import PropertyViewBody from '../components/common/PropertyViewBody';
import React, { useState, useEffect, useMemo } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import { shortDivision } from '../utils/fieldOptionsStore';
import CategorySelection from '../components/common/CategorySelection';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Home,
  Building,
  Lock,
  Grid3X3,
  Landmark,
  LayoutGrid,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  UserPlus,
  Truck,
  Trash2,
  User,
  Store,
  Edit2,
  Save,
  ExternalLink,
  FileText,
  MapPin,
  Calendar
} from 'lucide-react';
import PageHeader, { HEADER_GHOST_CLASS } from '../components/common/PageHeader';

const API_BASE = import.meta.env.VITE_API_URL || '';
import * as XLSX from 'xlsx';
import StaticMapView from '../components/common/StaticMapView';

import { formatDate } from '../utils/dateFormat';
import Modal from '../components/common/Modal';

const ITEMS_PER_PAGE = 10;

const SupervisorProperties = ({ user }) => {
  // Check if this is an FP-created Supervisor (has franchisePartnerId)
  const isFPSupervisor = !!user?.franchisePartnerId;
  
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [propertyEstimates, setPropertyEstimates] = useState([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [propertyVendorAssignments, setPropertyVendorAssignments] = useState([]);
  const [loadingVendorAssignments, setLoadingVendorAssignments] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const token = getAuthToken();

  const fetchPropertyEstimates = async (propertyId) => {
    setLoadingEstimates(true);
    try {
      const response = await fetch(`${API_BASE}/api/supervisor/estimates?property_id=${propertyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setPropertyEstimates(result.data || []);
      } else {
        setPropertyEstimates([]);
      }
    } catch (error) {
      console.error('Fetch property estimates error:', error);
      setPropertyEstimates([]);
    } finally {
      setLoadingEstimates(false);
    }
  };

  // Fetch vendor assignments for a property (read-only view)
  const fetchPropertyVendorAssignments = async (propertyId) => {
    setLoadingVendorAssignments(true);
    try {
      const response = await fetch(`${API_BASE}/api/supervisor/vendors/assignments`, {
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

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // Pass status filter to API
      const statusParam = statusFilter ? `?status=${statusFilter}` : '';
      const response = await fetch(`${API_BASE}/api/supervisor/properties${statusParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data);
      }
    } catch (error) {
      console.error('Fetch properties error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/supervisor/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setZones(result.data);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  // Auto-save zone to fp_zones if it doesn't exist
  const autoSaveZone = async (zoneName) => {
    if (!zoneName?.trim()) return;
    const exists = zones.some(z => z.name?.toLowerCase() === zoneName.toLowerCase());
    if (!exists) {
      try { 
        await fetch(`${API_BASE}/api/supervisor/zones`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: zoneName.trim() }) }); 
        fetchZones();
      } catch (e) {}
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/supervisor/vendors`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVendors(result.data?.all || result.data || []);
      }
    } catch (error) {
      console.error('Fetch vendors error:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/supervisor/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setEmployees(result.data || []);
      }
    } catch (error) {
      console.error('Fetch employees error:', error);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchZones();
    fetchVendors();
    fetchEmployees();
  }, []);
  
  // Refetch properties when status filter changes
  useEffect(() => {
    fetchProperties();
  }, [statusFilter]);

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/supervisor/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Property deleted successfully' });
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete property' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete property' });
    }
  };

  const openAssignModal = (property, type) => {
    setSelectedProperty(property);
    setAssignType(type);
    setShowAssignModal(true);
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedProperty) return;

    try {
      // Full API_BASE URL: a relative /api/... resolves against the admin site, not the API
      const endpoint = assignType === 'vendor'
        ? `${API_BASE}/api/supervisor/properties/${selectedProperty.id}/assign-vendor`
        : `${API_BASE}/api/supervisor/properties/${selectedProperty.id}/assign-employee`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignType === 'vendor' ? { vendorId: assigneeId } : { employeeId: assigneeId })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `${assignType === 'vendor' ? 'Vendor' : 'Employee'} assigned successfully!` });
        setShowAssignModal(false);
        setSelectedProperty(null);
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign' });
    }
  };

  const openEditModal = (property) => {
    setEditFormData({
      id: property.id,
      name: property.name || '',
      propertyType: property.property_type || 'residential',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zip_code || '',
      contactPerson: property.contact_person || '',
      contactPhone: property.contact_phone || '',
      contactEmail: property.contact_email || '',
      zone: property.zone_name || property.zone_id || '',
      division: property.division || property.division_id || '',
      area: property.area || property.area_name || '',
      isActive: property.is_active !== false,
      sourceTable: property.source_table || 'properties'
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      // Auto-save zone if it's new
      if (editFormData.zone) await autoSaveZone(editFormData.zone);
      
      const response = await fetch(`${API_BASE}/api/supervisor/properties/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editFormData.name,
          propertyType: editFormData.propertyType,
          address: editFormData.address,
          city: editFormData.city,
          state: editFormData.state,
          zipCode: editFormData.zipCode,
          contactPerson: editFormData.contactPerson,
          contactPhone: editFormData.contactPhone,
          contactEmail: editFormData.contactEmail,
          zoneId: editFormData.zone,
          divisionId: editFormData.division,
          areaName: editFormData.area,
          isActive: editFormData.isActive,
          sourceTable: editFormData.sourceTable
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Property updated successfully!' });
        setShowEditModal(false);
        setEditFormData({});
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Update failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update property' });
    }
  };

  // Export single property to CSV
  const exportSingleProperty = (property) => {
    const headers = ['Property ID', 'Name', 'Type', 'Zone', 'Area', 'Division', 'Units', 'Address', 'City', 'State', 'ZIP', 'Contact', 'Phone', 'Email', 'Created By', 'Created Date', 'Status'];
    const values = [
      property.property_id || '',
      property.name || '',
      property.property_type?.replace(/_/g, ' ') || '',
      property.zone_name || '',
      property.area || property.area_name || '',
      property.division || '',
      property.units || property.number_of_units || '1',
      property.address || '',
      property.city || '',
      property.state || '',
      property.zip_code || '',
      property.contact_person || '',
      property.contact_phone || '',
      property.contact_email || '',
      property.created_by_name || 'System',
      property.created_at ? new Date(property.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      property.status === 'inactive' ? 'Inactive' : 'Active'
    ];
    
    const csvContent = [headers.join(','), values.map(v => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property_${property.property_id || property.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all properties to Excel
  const exportAllProperties = () => {
    if (filteredProperties.length === 0) {
      setMessage({ type: 'error', text: 'No properties to export' });
      return;
    }

    const exportData = filteredProperties.map(property => ({
      'Property ID': property.property_id || '',
      'Community Name': property.name || '',
      'Type': property.property_type?.replace(/_/g, ' ') || '',
      'Zone': property.zone_name || '',
      'Area': property.area || property.area_name || '',
      'Division': shortDivision(property.division),
      'Units': property.units || property.number_of_units || '1',
      'Address': property.address || '',
      'City': property.city || '',
      'State': property.state || '',
      'ZIP Code': property.zip_code || '',
      'Contact Person': property.contact_person || '',
      'Phone': property.contact_phone || '',
      'Email': property.contact_email || '',
      'Created By': property.created_by_name || 'System',
      'Created Date': property.created_at ? new Date(property.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      'Status': property.is_active !== false ? 'Active' : 'Inactive'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Properties');
    XLSX.writeFile(wb, `fp_properties_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: `Exported ${filteredProperties.length} properties` });
  };

  // Property type tabs
  const tabs = [
    { id: 'all', label: 'All Customers', icon: Users },
    { id: 'gated_community', label: 'Gated Communities', icon: Grid3X3 },
    { id: 'apartment', label: 'Apartments', icon: Building },
    { id: 'villa', label: 'Villas', icon: Home },
    { id: 'plot', label: 'Plots', icon: LayoutGrid },
    { id: 'flat', label: 'Flats', icon: Landmark }
  ];

  // Normalize property type for consistent filtering (handles both uppercase and lowercase)
  const normalizePropertyType = (type) => {
    if (!type) return '';
    const lower = type.toLowerCase().replace(/[_\s-]/g, '');
    if (lower === 'gc' || lower.includes('gated')) return 'gated_community';
    if (lower === 'apt' || lower.includes('apartment')) return 'apartment';
    if (lower === 'villa' || lower === 'villas') return 'villa';
    if (lower === 'flat' || lower === 'flats') return 'flat';
    if (lower === 'plot' || lower === 'plots') return 'plot';
    return type.toLowerCase();
  };

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    const normalized = normalizePropertyType(type);
    const colors = {
      'apartment': 'bg-blue-100 text-blue-700',
      'gated_community': 'bg-teal-100 text-teal-700',
      'villa': 'bg-amber-100 text-amber-700',
      'plot': 'bg-purple-100 text-purple-700',
      'flat': 'bg-pink-100 text-pink-700'
    };
    return colors[normalized] || 'bg-gray-100 text-gray-700';
  };

  // Get type display label
  const getTypeLabel = (type) => {
    const normalized = normalizePropertyType(type);
    const labels = {
      'gated_community': 'Gated Community',
      'apartment': 'Apartment',
      'villa': 'Villa',
      'plot': 'Plot',
      'flat': 'Flat'
    };
    return labels[normalized] || type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-';
  };

  // Filter properties
  const filteredProperties = properties.filter(p => {
    // Tab filter - normalize property type for consistent matching
    if (activeTab !== 'all' && normalizePropertyType(p.property_type) !== activeTab) return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!(
        p.name?.toLowerCase().includes(search) ||
        p.property_id?.toLowerCase().includes(search) ||
        p.zone_name?.toLowerCase().includes(search) ||
        p.address?.toLowerCase().includes(search)
      )) return false;
    }
    
    // Zone filter - compare by zone name (case-insensitive)
    if (selectedZone) {
      const zoneMatch = 
        p.zone_name?.toLowerCase() === selectedZone.toLowerCase() ||
        p.zone?.toLowerCase() === selectedZone.toLowerCase();
      if (!zoneMatch) return false;
    }
    
    // Division filter
    if (selectedDivision && p.division !== selectedDivision) return false;
    
    // Status filter is now handled by API, no client-side filtering needed
    
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0);
    const dateB = new Date(b.createdAt || b.created_at || 0);
    return dateB.getTime() - dateA.getTime(); // Sort by latest first
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, selectedZone, selectedDivision, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

  // Count properties by type (filtered by zone if selected)
  const getTypeCount = (type) => {
    // First filter by zone if selected
    let filtered = properties;
    if (selectedZone) {
      filtered = properties.filter(p => 
        p.zone_name?.toLowerCase() === selectedZone.toLowerCase() ||
        p.zone?.toLowerCase() === selectedZone.toLowerCase()
      );
    }
    if (type === 'all') return filtered.length;
    return filtered.filter(p => normalizePropertyType(p.property_type) === type).length;
  };

  // Get unique divisions from properties
  const uniqueDivisions = [...new Set(properties.map(p => p.division).filter(Boolean))];

  // Get available zones from current properties (dynamic based on status filter)
  const availableZones = useMemo(() => {
    const zoneMap = new Map();
    properties.forEach(p => {
      const zoneName = p.zone_name || p.zone;
      const zoneId = p.zone_id;
      if (zoneName && !zoneMap.has(zoneName)) {
        zoneMap.set(zoneName, { id: zoneId || zoneName, name: zoneName });
      }
    });
    return Array.from(zoneMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  // Category Selection View
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        {/* The shared section header, as on Work Orders and Estimates */}
        <PageHeader icon={Building2} title="Property Management" subtitle="View and manage created customers" />

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Selection */}
        {/* Residential Card */}
        {/* Commercial Card - Coming Soon */}
        <CategorySelection onSelect={setSelectedCategory} />
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* The shared section header, as on Work Orders and Estimates */}
      <PageHeader icon={Building2} title="Property Management"
        subtitle={`${properties.length} total customers`}>
        <button onClick={() => setSelectedCategory(null)} className={HEADER_GHOST_CLASS}>
          <ArrowLeft className="w-4 h-4" /> Back to Categories
        </button>
      </PageHeader>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = getTypeCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="">All Zones</option>
            {availableZones.map((zone) => (
              <option key={zone.id || zone.name} value={zone.name}>{zone.name}</option>
            ))}
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
          onClick={fetchProperties}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No properties found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Community Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Zone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Area</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Division</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">City</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contacts</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created By</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProperties.map((property) => (
                    <tr key={`${property.source_table || 'properties'}-${property.id}`} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-900">{property.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">{property.property_id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(property.property_type)}`}>
                          {getTypeLabel(property.property_type)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.zone_name || property.zone || property.area || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.area_name || property.area || property.city || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm text-gray-600">{shortDivision(property.division) || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 max-w-[150px] truncate block">{property.address || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.city || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {(() => {
                            let contactName = property.contact_name || property.contact_person;
                            try {
                              if (property.association_contacts) {
                                const contacts = typeof property.association_contacts === 'string'
                                  ? JSON.parse(property.association_contacts)
                                  : property.association_contacts;
                                if (contacts.length > 0 && contacts[0].name) contactName = contacts[0].name;
                              }
                            } catch {}
                            return contactName || '-';
                          })()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {(() => {
                            try {
                              if (property.association_contacts) {
                                const contacts = typeof property.association_contacts === 'string' 
                                  ? JSON.parse(property.association_contacts) 
                                  : property.association_contacts;
                                if (contacts.length > 0 && contacts[0].phone) {
                                  const phone = contacts[0].phone;
                                  return phone.startsWith('+') ? phone : `+91${phone}`;
                                }
                              }
                            } catch {}
                            return property.contact_phone || '-';
                          })()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.created_by_name || 'System'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">{formatDate(property.created_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          property.status === 'inactive' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {property.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedProperty(property);
                              setShowDetailsModal(true);
                              fetchPropertyEstimates(property.property_id || property.id);
                              fetchPropertyVendorAssignments(property.id);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {!isFPSupervisor && (
                            <>
                              <button
                                onClick={() => openEditModal(property)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Property"
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                              </button>
                              <button
                                onClick={() => openAssignModal(property, 'vendor')}
                                className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Assign Vendor"
                              >
                                <Truck className="w-4 h-4 text-purple-500" />
                              </button>
                              <button
                                onClick={() => openAssignModal(property, 'employee')}
                                className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                                title="Assign Employee"
                              >
                                <UserPlus className="w-4 h-4 text-green-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteProperty(property.id)}
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {filteredProperties.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredProperties.length)} of {filteredProperties.length} properties
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (Math.abs(page - currentPage) <= 1) return true;
                      return false;
                    })
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* View Details Modal */}
      {showDetailsModal && selectedProperty && (
        <ViewModal onClose={() => { setShowDetailsModal(false); setSelectedProperty(null); setPropertyEstimates([]); }}
          maxWidth="max-w-3xl"
          id={selectedProperty.property_id}
          title={selectedProperty.name}
          badge={<span className="px-2.5 py-1 bg-warm-accent-soft text-warm-text border border-warm-border rounded-full text-xs font-medium">
                    {selectedProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Property'}
                  </span>}
        >
          <PropertyViewBody property={selectedProperty} estimates={propertyEstimates} loadingEstimates={loadingEstimates} vendorAssignments={propertyVendorAssignments} loadingVendorAssignments={loadingVendorAssignments} />
        </ViewModal>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedProperty && (
        <Modal className="max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Assign {assignType === 'vendor' ? 'Vendor' : 'Employee'}
                </h2>
                <button onClick={() => { setShowAssignModal(false); setSelectedProperty(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Property: {selectedProperty.name}</p>
            </div>

            <div className="p-6">
              {(() => {
                // Get all vendors/employees (global - no zone filtering)
                const availableItems = assignType === 'vendor' ? vendors : employees;
                
                return availableItems.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">
                      No {assignType === 'vendor' ? 'vendors' : 'employees'} available
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Add {assignType === 'vendor' ? 'vendors' : 'employees'} to assign them to this property</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAssign(item.id)}
                        className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                      >
                        <div className={`w-10 h-10 ${assignType === 'vendor' ? 'bg-purple-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                          {assignType === 'vendor' ? (
                            <Store className="w-5 h-5 text-purple-600" />
                          ) : (
                            <User className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {assignType === 'vendor' 
                              ? (item.ownerName || item.owner_name || item.company_name || 'Unknown Vendor')
                              : (`${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name || 'Unknown Employee')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {assignType === 'vendor' 
                              ? (item.serviceType || item.service_type || item.email || '-')
                              : (item.role || item.email || '-')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </Modal>
      )}

      {/* Edit Property Modal */}
      {showEditModal && (
        <Modal className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Edit Property</h2>
              <button onClick={() => { setShowEditModal(false); setEditFormData({}); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
                  <input type="text" value={editFormData.name || ''} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                  <input type="text" value={editFormData.zone || ''} onChange={(e) => setEditFormData({ ...editFormData, zone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                  <input type="text" value={editFormData.area || ''} onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <input type="text" value={editFormData.division || ''} onChange={(e) => setEditFormData({ ...editFormData, division: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select value={editFormData.propertyType || ''} onChange={(e) => setEditFormData({ ...editFormData, propertyType: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="gated_community">Gated Community</option>
                    <option value="apartment">Apartment</option>
                    <option value="villa">Villa</option>
                    <option value="flat">Flat</option>
                    <option value="plot">Plot</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea value={editFormData.address || ''} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input type="text" value={editFormData.city || ''} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input type="text" value={editFormData.state || ''} onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input type="text" value={editFormData.zipCode || ''} onChange={(e) => setEditFormData({ ...editFormData, zipCode: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input type="text" value={editFormData.contactPerson || ''} onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input type="tel" value={editFormData.contactPhone || ''} onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input type="email" value={editFormData.contactEmail || ''} onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={editFormData.isActive ? 'active' : 'inactive'} onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'active' })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setEditFormData({}); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSaveEdit} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save className="w-4 h-4" />Save Changes</button>
            </div>
          </Modal>
      )}
    </div>
  );
};

export default SupervisorProperties;

