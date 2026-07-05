import React, { useState, useEffect, useMemo } from 'react';
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
  Calendar,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import StaticMapView from '../components/common/StaticMapView';
import PropertyLocationDisplay from '../components/common/PropertyLocationDisplay';

const ExecutiveProperties = ({ user }) => {
  // Check if this is an FP-created Executive (has franchisePartnerId)
  const isFPExecutive = !!user?.franchisePartnerId;
  
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

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchPropertyEstimates = async (propertyId) => {
    setLoadingEstimates(true);
    try {
      const response = await fetch(`/api/executive/estimates?property_id=${propertyId}`, {
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

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // Pass status filter to API
      const statusParam = statusFilter ? `?status=${statusFilter}` : '';
      const response = await fetch(`/api/executive/properties${statusParam}`, {
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
      const response = await fetch('/api/executive/zones', {
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

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/executive/vendors', {
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
      const response = await fetch('/api/executive/employees', {
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
      const response = await fetch(`/api/executive/properties/${propertyId}`, {
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
      const endpoint = assignType === 'vendor'
        ? `/api/executive/properties/${selectedProperty.id}/assign-vendor`
        : `/api/executive/properties/${selectedProperty.id}/assign-employee`;

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
      sourceTable: property.source_table || 'properties',
      watchmanName: property.watchman_name || '',
      watchmanContact: property.watchman_contact || ''
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const response = await fetch(`/api/executive/properties/${editFormData.id}`, {
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
          sourceTable: editFormData.sourceTable,
          watchmanName: editFormData.watchmanName,
          watchmanContact: editFormData.watchmanContact
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
      'Name': property.name || '',
      'Type': property.property_type?.replace(/_/g, ' ') || '',
      'Zone': property.zone_name || '',
      'Area': property.area || property.area_name || '',
      'Division': property.division || '',
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
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">View and manage created customers</p>
        </div>

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
        <div className="bg-gray-50 rounded-2xl p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
            <p className="text-gray-500 mt-2">Choose the customer category to proceed</p>
          </div>

          <div className="flex justify-center gap-8">
            {/* Residential Card */}
            <button
              onClick={() => setSelectedCategory('residential')}
              className="w-72 h-52 p-8 border-2 border-teal-400 rounded-2xl hover:shadow-xl transition-all duration-200 bg-teal-50/50 group flex flex-col items-start justify-center"
            >
              <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Home className="w-7 h-7 text-white" />
              </div>
              <p className="text-lg font-semibold text-gray-900">Residential</p>
            </button>

            {/* Commercial Card - Coming Soon */}
            <div className="w-72 h-52 p-8 border border-gray-200 rounded-2xl bg-white relative cursor-not-allowed flex flex-col items-start justify-center">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Coming Soon</span>
              </div>
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-5">
                <Building className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-400">Commercial</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to categories"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500">{properties.length} total customers</p>
        </div>
      </div>

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
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Zone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Area</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Division</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">City</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contacts</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created By</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
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
                        <span className="text-sm text-gray-600">{property.zone_name || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.area || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.division || '-'}</span>
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
                            // Try to get contact from association_contacts first
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
                            // Fallback to contact_phone
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
                            }}
                            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-blue-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {filteredProperties.length} of {properties.length} properties
              </p>
            </div>
          </>
        )}
      </div>

      {/* View Details Modal */}
      {showDetailsModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedProperty.name}</h2>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {selectedProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Property'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{selectedProperty.property_id}</p>
              </div>
              <button
                onClick={() => { setShowDetailsModal(false); setSelectedProperty(null); setPropertyEstimates([]); }}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Property Information */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Zone</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.zone_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Area Name</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.area || selectedProperty.area_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Division</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.division || selectedProperty.division_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Property Type</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Units</p>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        if (selectedProperty.units_per_block) {
                          try {
                            const unitsPerBlock = typeof selectedProperty.units_per_block === 'string' 
                              ? JSON.parse(selectedProperty.units_per_block) 
                              : selectedProperty.units_per_block;
                            const total = Object.values(unitsPerBlock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                            if (total > 0) return total;
                          } catch {}
                        }
                        return selectedProperty.total_units || selectedProperty.units || selectedProperty.number_of_units || '-';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedProperty.created_at ? new Date(selectedProperty.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Gated Community Block Details */}
              {(['gated_community', 'GC', 'Gated Community'].some(t => 
                selectedProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                selectedProperty.entry_type === 'GC'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Block Details</h3>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Number of Blocks</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.number_of_blocks || 1}</p>
                  </div>
                  {(() => {
                    try {
                      const blockNames = typeof selectedProperty.block_names === 'string' ? JSON.parse(selectedProperty.block_names) : selectedProperty.block_names || {};
                      const unitsPerBlock = typeof selectedProperty.units_per_block === 'string' ? JSON.parse(selectedProperty.units_per_block) : selectedProperty.units_per_block || {};
                      const blockUnitTypes = typeof selectedProperty.block_unit_types === 'string' ? JSON.parse(selectedProperty.block_unit_types) : selectedProperty.block_unit_types || {};
                      const numBlocks = selectedProperty.number_of_blocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || 1;
                      if (Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0) {
                        return (
                          <div className="space-y-4">
                            {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                              const unitTypes = blockUnitTypes[blockNum] || {};
                              return (
                                <div key={blockNum} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex gap-4 mb-3">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Block Name</p>
                                      <p className="text-sm font-medium text-gray-900">{blockNames[blockNum] || `Block ${blockNum}`}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Total Units</p>
                                      <p className="text-sm font-medium text-gray-900">{unitsPerBlock[blockNum] || 0}</p>
                                    </div>
                                  </div>
                                  {Object.keys(unitTypes).length > 0 && (
                                    <div className="grid grid-cols-5 gap-2 pt-2 border-t border-gray-200">
                                      <div><p className="text-xs text-gray-500">Studio</p><p className="text-sm font-medium">{unitTypes.studio || 0}</p></div>
                                      <div><p className="text-xs text-gray-500">1 Bed</p><p className="text-sm font-medium">{unitTypes.oneBed || 0}</p></div>
                                      <div><p className="text-xs text-gray-500">2 Bed</p><p className="text-sm font-medium">{unitTypes.twoBed || 0}</p></div>
                                      <div><p className="text-xs text-gray-500">3 Bed</p><p className="text-sm font-medium">{unitTypes.threeBed || 0}</p></div>
                                      <div><p className="text-xs text-gray-500">4 Bed</p><p className="text-sm font-medium">{unitTypes.fourBed || 0}</p></div>
                                    </div>
                                  )}
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
                selectedProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                selectedProperty.entry_type === 'APT'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.block_na ? 'N/A' : (selectedProperty.block_info || '-')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Number of Units</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.number_of_units || '-'}</p>
                    </div>
                  </div>
                  {(() => {
                    try {
                      const blockUnitTypes = typeof selectedProperty.block_unit_types === 'string' ? JSON.parse(selectedProperty.block_unit_types) : selectedProperty.block_unit_types || {};
                      const unitTypes = blockUnitTypes['apt'] || {};
                      if (Object.keys(unitTypes).length > 0 && Object.values(unitTypes).some(v => v > 0)) {
                        return (
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-2 font-medium">Unit Types</p>
                            <div className="grid grid-cols-5 gap-2">
                              <div><p className="text-xs text-gray-500">Studio</p><p className="text-sm font-medium">{unitTypes.studio || 0}</p></div>
                              <div><p className="text-xs text-gray-500">1 Bed</p><p className="text-sm font-medium">{unitTypes.oneBed || 0}</p></div>
                              <div><p className="text-xs text-gray-500">2 Bed</p><p className="text-sm font-medium">{unitTypes.twoBed || 0}</p></div>
                              <div><p className="text-xs text-gray-500">3 Bed</p><p className="text-sm font-medium">{unitTypes.threeBed || 0}</p></div>
                              <div><p className="text-xs text-gray-500">4 Bed</p><p className="text-sm font-medium">{unitTypes.fourBed || 0}</p></div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    } catch { return null; }
                  })()}
                </div>
              )}

              {/* Villa Details */}
              {(selectedProperty.property_type === 'villa' || selectedProperty.property_type === 'VILLA') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Villa Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Villa Number</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_plot_number || '-'}</p>
                  </div>
                </div>
              )}

              {/* Flat Details */}
              {(selectedProperty.property_type === 'flat' || selectedProperty.property_type === 'FLAT') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Flat Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Flat Number</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_plot_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.flat_block_na ? 'N/A' : (selectedProperty.flat_block_info || '-')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plot Details */}
              {(selectedProperty.property_type === 'plot' || selectedProperty.property_type === 'PLOT') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Plot Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Plot Number</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.plot_na ? 'N/A' : (selectedProperty.villa_plot_number || '-')}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Street Address</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Apt/Suite</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_plot_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">City</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">State/Province</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ZIP/Postal Code</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.zip_code || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Property Location */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Location</h3>
                <PropertyLocationDisplay 
                  location={{
                    lat: selectedProperty.mapLocation?.lat || selectedProperty.latitude,
                    lng: selectedProperty.mapLocation?.lng || selectedProperty.longitude,
                    address: selectedProperty.mapLocation?.address || selectedProperty.landmark || `${selectedProperty.address || ''}, ${selectedProperty.city || ''}, ${selectedProperty.state || ''}, ${selectedProperty.zip_code || ''}`
                  }}
                  propertyName={selectedProperty.name || selectedProperty.community_name || 'Property'}
                />
              </div>

              {/* Contact Information */}
              {(() => {
                let contacts = [];
                try {
                  if (selectedProperty.association_contacts) {
                    contacts = typeof selectedProperty.association_contacts === 'string' 
                      ? JSON.parse(selectedProperty.association_contacts) 
                      : selectedProperty.association_contacts;
                  }
                } catch { contacts = []; }
                
                if (contacts.length === 0 && (selectedProperty.contact_person || selectedProperty.contact_email || selectedProperty.contact_phone)) {
                  contacts = [{
                    name: selectedProperty.contact_person,
                    email: selectedProperty.contact_email,
                    phone: selectedProperty.contact_phone
                  }];
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

              {/* Watchman Information - Only for GC and APT */}
              {(['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes((selectedProperty.property_type || '').toLowerCase()) ||
               ['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes((selectedProperty.entry_type || '').toLowerCase())) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Watchman Information</h3>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Name</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProperty.watchman_name || selectedProperty.watchmanName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Contact</p>
                        <p className="text-sm font-medium text-gray-900">
                          {(() => {
                            const contact = selectedProperty.watchman_contact || selectedProperty.watchmanContact;
                            if (!contact) return 'N/A';
                            return contact.startsWith('+') ? contact : `+91 ${contact}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimates Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h3 className="text-base font-semibold text-gray-900">Estimates ({propertyEstimates.length})</h3>
                </div>
                {loadingEstimates ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
                    <p className="text-sm text-gray-500">Loading estimates...</p>
                  </div>
                ) : propertyEstimates.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-8 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No estimates for this property</p>
                    <p className="text-xs text-gray-400 mt-1">Create an estimate from the Estimates section</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {propertyEstimates.map((est) => (
                      <div key={est.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm text-gray-700">{est.estimate_id}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            est.status === 'approved' ? 'bg-green-100 text-green-700' :
                            est.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            est.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>{est.status || 'draft'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Package:</span>
                            <span className="ml-1 font-medium">{est.package_name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Total:</span>
                            <span className="ml-1 font-semibold text-green-600">₹{Number(est.total_amount || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <span className="ml-1">{est.created_at ? new Date(est.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">By:</span>
                            <span className="ml-1">{est.created_by_name || '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
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
                // Filter vendors by property zone - zone is required
                const propertyZone = (selectedProperty?.zone_name || selectedProperty?.zone || selectedProperty?.zone_id || '').toString().toLowerCase().trim();
                
                // If property has NO zone, don't show any vendors
                if (assignType === 'vendor' && !propertyZone) {
                  return (
                    <div className="text-center py-4">
                      <p className="text-gray-500">This property has no zone assigned</p>
                      <p className="text-xs text-gray-400 mt-1">Please assign a zone to this property first to see matching vendors</p>
                    </div>
                  );
                }
                
                // Filter vendors by EXACT zone match only
                const zoneFilteredVendors = assignType === 'vendor' 
                  ? vendors.filter(v => {
                      const vendorZone = (v.zone_name || v.zone || v.zone_id || '').toString().toLowerCase().trim();
                      if (!vendorZone) return false;
                      // Exact zone match - extract numbers for comparison
                      const propZoneNum = propertyZone.replace(/[^0-9]/g, '');
                      const vendorZoneNum = vendorZone.replace(/[^0-9]/g, '');
                      // Match exactly: "Zone 43" === "Zone 43" OR "43" === "43"
                      return vendorZone === propertyZone || (propZoneNum && vendorZoneNum && propZoneNum === vendorZoneNum);
                    })
                  : employees;
                
                return zoneFilteredVendors.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">
                      No {assignType === 'vendor' ? 'vendors' : 'employees'} available for {selectedProperty?.zone_name || selectedProperty?.zone || selectedProperty?.zone_id}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Add vendors with matching zone to assign them to this property</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {zoneFilteredVendors.map((item) => (
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
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                    <option value="residential">Residential</option>
                    <option value="gated_community">Gated Community</option>
                    <option value="apartment">Apartment</option>
                    <option value="villa">Villa</option>
                    <option value="plot">Plot</option>
                    <option value="flat">Flat</option>
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
              
              {/* Watchman Fields - Only for GC and APT */}
              {(editFormData.propertyType === 'gated_community' || editFormData.propertyType === 'apartment') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Watchman Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Name</label>
                      <input type="text" value={editFormData.watchmanName || ''} onChange={(e) => setEditFormData({ ...editFormData, watchmanName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter watchman name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Contact</label>
                      <div className="flex gap-2">
                        <div className="w-14 flex-shrink-0 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 flex items-center justify-center">+91</div>
                        <input type="tel" inputMode="numeric" maxLength={10} value={editFormData.watchmanContact || ''} onChange={(e) => { const digits = e.target.value.replace(/\D/g, '').slice(0, 10); setEditFormData({ ...editFormData, watchmanContact: digits }); }} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="10-digit number" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowEditModal(false); setEditFormData({}); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSaveEdit} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save className="w-4 h-4" />Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveProperties;

