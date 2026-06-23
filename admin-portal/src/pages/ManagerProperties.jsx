import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  MapPin,
  Phone,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  User,
  Store,
  Home,
  Building,
  Lock,
  ArrowLeft,
  FileText,
  Eye,
  Users,
  ExternalLink
} from 'lucide-react';

const ManagerProperties = ({ user }) => {
  // Check if this is an FP-created Manager (has franchisePartnerId)
  const isFPManager = !!user?.franchisePartnerId;

  const [selectedCategory, setSelectedCategory] = useState(null); // 'residential' or 'commercial'
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'gated', 'apartment', 'villa', 'plot', 'flat'
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingProperty, setViewingProperty] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Property type tabs config
  const propertyTabs = [
    { id: 'all', label: 'All Customers', icon: User },
    { id: 'gated_community', label: 'Gated Communities', icon: Building2 },
    { id: 'apartment', label: 'Apartments', icon: Building },
    { id: 'villa', label: 'Villas', icon: Home },
    { id: 'plot', label: 'Plots', icon: MapPin },
    { id: 'flat', label: 'Flats', icon: Building }
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

  const [formData, setFormData] = useState({
    name: '',
    propertyType: 'residential',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    zoneId: ''
  });

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propRes, zoneRes, divRes, vendRes, empRes] = await Promise.all([
        fetch('/api/manager/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/zones', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/divisions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/vendors', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/employees', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [propData, zoneData, divData, vendData, empData] = await Promise.all([
        propRes.json(), zoneRes.json(), divRes.json(), vendRes.json(), empRes.json()
      ]);

      if (propData.success) setProperties(propData.data);
      if (zoneData.success) setZones(zoneData.data);
      if (divData.success) setDivisions(divData.data);
      if (vendData.success) setVendors(vendData.data.all || []);
      if (empData.success) setEmployees(empData.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const url = editingProperty 
        ? `/api/manager/properties/${editingProperty.id}`
        : '/api/manager/properties';
      
      const response = await fetch(url, {
        method: editingProperty ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `Property ${editingProperty ? 'updated' : 'created'} successfully!` });
        setShowModal(false);
        resetForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save property' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      const response = await fetch(`/api/manager/properties/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Property deleted successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Delete failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete property' });
    }
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedProperty) return;

    try {
      const endpoint = assignType === 'vendor' 
        ? `/api/manager/properties/${selectedProperty.id}/assign-vendor`
        : `/api/manager/properties/${selectedProperty.id}/assign-employee`;

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
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign' });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/manager/export/properties', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manager_properties_export.json';
      a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const openEditModal = (property) => {
    setEditingProperty(property);
    setFormData({
      name: property.name || '',
      propertyType: property.property_type || 'residential',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zip_code || '',
      contactPerson: property.contact_person || '',
      contactPhone: property.contact_phone || '',
      contactEmail: property.contact_email || '',
      zoneId: property.zone_id || '',
      sourceTable: property.source_table || 'properties',
      watchmanName: property.watchman_name || property.watchmanName || '',
      watchmanContact: property.watchman_contact || property.watchmanContact || ''
    });
    setShowModal(true);
  };

  const openAssignModal = (property, type) => {
    setSelectedProperty(property);
    setAssignType(type);
    setShowAssignModal(true);
  };

  const resetForm = () => {
    setEditingProperty(null);
    setFormData({
      name: '',
      propertyType: 'residential',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      contactPerson: '',
      contactPhone: '',
      contactEmail: '',
      zoneId: '',
      sourceTable: '',
      watchmanName: '',
      watchmanContact: ''
    });
  };

  // Filter properties based on search, tab, and filters
  const filteredProperties = properties.filter(p => {
    // Search filter
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.property_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.zone_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tab filter (property type) - normalize for consistent matching
    const matchesTab = activeTab === 'all' || normalizePropertyType(p.property_type) === activeTab;
    
    // Zone filter
    const matchesZone = zoneFilter === 'all' || p.zone_id?.toString() === zoneFilter;
    
    // Division filter
    const matchesDivision = divisionFilter === 'all' || p.division_id?.toString() === divisionFilter;
    
    return matchesSearch && matchesTab && matchesZone && matchesDivision;
  }).sort((a, b) => {
    const dateA = new Date(a.createdAt || a.created_at || 0);
    const dateB = new Date(b.createdAt || b.created_at || 0);
    return dateB.getTime() - dateA.getTime(); // Sort by latest first
  });

  // Get counts for each tab
  const getTabCount = (tabId) => {
    if (tabId === 'all') return properties.length;
    return properties.filter(p => normalizePropertyType(p.property_type) === tabId).length;
  };

  // Category Selection Screen
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

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Property Management</h1>
          <p className="text-blue-600 text-sm">{properties.length} total customers</p>
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

      {/* Property Type Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {propertyTabs.map((tab) => {
          const Icon = tab.icon;
          const count = getTabCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters Row */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, zone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Zones</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active Customers</option>
            <option value="inactive">Inactive Customers</option>
            <option value="all">All Customers</option>
          </select>
        </div>
      </div>

      {/* Properties List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-blue-600 font-medium">No properties found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{property.name}</p>
                        <p className="text-sm text-gray-500">{property.property_id}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(property.property_type)}`}>
                        {getTypeLabel(property.property_type)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">{property.city}, {property.state}</p>
                          <p className="text-xs text-gray-400">{property.zone_name || 'No zone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        {(() => {
                          // Try to get contact from association_contacts first
                          let contactName = property.contact_person;
                          let contactPhone = property.contact_phone;
                          try {
                            if (property.association_contacts) {
                              const contacts = typeof property.association_contacts === 'string' 
                                ? JSON.parse(property.association_contacts) 
                                : property.association_contacts;
                              if (contacts.length > 0) {
                                contactName = contacts[0].name || contactName;
                                contactPhone = contacts[0].phone || contactPhone;
                              }
                            }
                          } catch {}
                          return (
                            <>
                              {contactName && <p className="text-sm text-gray-600">{contactName}</p>}
                              {contactPhone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3" /> {contactPhone.startsWith('+') ? contactPhone : `+91${contactPhone}`}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">
                        {property.created_at ? new Date(property.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{property.created_by_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details - always visible */}
                        <button
                          onClick={() => { setViewingProperty(property); setShowViewModal(true); }}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Assign Vendor */}
                        <button
                          onClick={() => openAssignModal(property, 'vendor')}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg"
                          title="Assign Vendor"
                        >
                          <Store className="w-4 h-4" />
                        </button>
                        {/* Assign Employee */}
                        <button
                          onClick={() => openAssignModal(property, 'employee')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Assign Employee"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingProperty ? 'Edit Property' : 'Add New Property'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select
                    value={formData.propertyType}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                  <select
                    value={formData.zoneId}
                    onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Zone</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Watchman Fields - Only for GC and APT */}
              {(['gc', 'apt', 'gated_community', 'apartment'].includes((formData.propertyType || '').toLowerCase())) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Watchman Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Name</label>
                      <input
                        type="text"
                        value={formData.watchmanName || ''}
                        onChange={(e) => setFormData({ ...formData, watchmanName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter watchman name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Contact</label>
                      <div className="flex gap-2">
                        <span className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={formData.watchmanContact || ''}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormData({ ...formData, watchmanContact: digits });
                          }}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="10-digit number"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingProperty ? 'Update' : 'Create'} Property</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Property Modal */}
      {showViewModal && viewingProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{viewingProperty.name}</h2>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {viewingProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Property'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{viewingProperty.property_id}</p>
              </div>
              <button onClick={() => { setShowViewModal(false); setViewingProperty(null); }} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
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
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.zone_name || zones.find(z => z.id == viewingProperty.zone_id)?.name || viewingProperty.zone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Area Name</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.area || viewingProperty.area_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Division</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.division_name || divisions.find(d => d.id == viewingProperty.division_id)?.name || viewingProperty.division || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Property Type</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Units</p>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        if (viewingProperty.units_per_block) {
                          try {
                            const unitsPerBlock = typeof viewingProperty.units_per_block === 'string' 
                              ? JSON.parse(viewingProperty.units_per_block) 
                              : viewingProperty.units_per_block;
                            const total = Object.values(unitsPerBlock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                            if (total > 0) return total;
                          } catch {}
                        }
                        return viewingProperty.total_units || viewingProperty.units || viewingProperty.number_of_units || '-';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {viewingProperty.created_at ? new Date(viewingProperty.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Gated Community Block Details */}
              {(['gated_community', 'GC', 'Gated Community'].some(t => 
                viewingProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                viewingProperty.entry_type === 'GC'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Block Details</h3>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Number of Blocks</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.number_of_blocks || 1}</p>
                  </div>
                  {(() => {
                    try {
                      const blockNames = typeof viewingProperty.block_names === 'string' ? JSON.parse(viewingProperty.block_names) : viewingProperty.block_names || {};
                      const unitsPerBlock = typeof viewingProperty.units_per_block === 'string' ? JSON.parse(viewingProperty.units_per_block) : viewingProperty.units_per_block || {};
                      const blockUnitTypes = typeof viewingProperty.block_unit_types === 'string' ? JSON.parse(viewingProperty.block_unit_types) : viewingProperty.block_unit_types || {};
                      const numBlocks = viewingProperty.number_of_blocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || 1;
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
                viewingProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                viewingProperty.entry_type === 'APT'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{viewingProperty.block_na ? 'N/A' : (viewingProperty.block_info || '-')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Number of Units</p>
                      <p className="text-sm font-medium text-gray-900">{viewingProperty.number_of_units || '-'}</p>
                    </div>
                  </div>
                  {(() => {
                    try {
                      const blockUnitTypes = typeof viewingProperty.block_unit_types === 'string' ? JSON.parse(viewingProperty.block_unit_types) : viewingProperty.block_unit_types || {};
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
              {(['villa', 'VILLA', 'Villa'].some(t => 
                viewingProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                viewingProperty.entry_type === 'VILLA'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Villa Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Villa Number</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.villa_plot_number || '-'}</p>
                  </div>
                </div>
              )}

              {/* Flat Details */}
              {(['flat', 'FLAT', 'Flat'].some(t => 
                viewingProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                viewingProperty.entry_type === 'FLAT'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Flat Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Flat Number</p>
                      <p className="text-sm font-medium text-gray-900">{viewingProperty.villa_plot_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{viewingProperty.flat_block_na ? 'N/A' : (viewingProperty.flat_block_info || '-')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plot Details */}
              {(['plot', 'PLOT', 'Plot'].some(t => 
                viewingProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                viewingProperty.entry_type === 'PLOT'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Plot Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Plot Number</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.plot_na ? 'N/A' : (viewingProperty.villa_plot_number || '-')}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Street Address</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">City</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">State/Province</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ZIP/Postal Code</p>
                    <p className="text-sm font-medium text-gray-900">{viewingProperty.zip_code || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Map Location */}
              {(viewingProperty.latitude || viewingProperty.longitude || viewingProperty.landmark) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Map Location</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-3">
                      {viewingProperty.landmark || `${viewingProperty.address || ''}, ${viewingProperty.city || ''}, ${viewingProperty.state || ''}, ${viewingProperty.zip_code || ''}`}
                    </p>
                    {(viewingProperty.latitude && viewingProperty.longitude) && (
                      <>
                        <a
                          href={`https://www.google.com/maps?q=${viewingProperty.latitude},${viewingProperty.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Maps
                        </a>
                        <p className="text-xs text-blue-600 mt-3 font-mono">
                          {viewingProperty.latitude}, {viewingProperty.longitude}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {(() => {
                let contacts = [];
                try {
                  if (viewingProperty.association_contacts) {
                    contacts = typeof viewingProperty.association_contacts === 'string' 
                      ? JSON.parse(viewingProperty.association_contacts) 
                      : viewingProperty.association_contacts;
                  }
                } catch { contacts = []; }
                
                if (contacts.length === 0 && (viewingProperty.contact_person || viewingProperty.contact_email || viewingProperty.contact_phone)) {
                  contacts = [{
                    name: viewingProperty.contact_person,
                    email: viewingProperty.contact_email,
                    phone: viewingProperty.contact_phone
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
              {(['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes((viewingProperty.property_type || '').toLowerCase()) ||
               ['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes((viewingProperty.entry_type || '').toLowerCase())) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Watchman Information</h3>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Name</p>
                        <p className="text-sm font-medium text-gray-900">{viewingProperty.watchman_name || viewingProperty.watchmanName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Contact</p>
                        <p className="text-sm font-medium text-gray-900">
                          {(() => {
                            const contact = viewingProperty.watchman_contact || viewingProperty.watchmanContact;
                            if (!contact) return 'N/A';
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
              {(assignType === 'vendor' ? vendors : employees).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No {assignType === 'vendor' ? 'vendors' : 'employees'} available
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(assignType === 'vendor' ? vendors : employees).map((item) => (
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
                          {assignType === 'vendor' ? item.company_name : `${item.first_name} ${item.last_name}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {assignType === 'vendor' ? (item.contact_person || item.email) : item.role}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerProperties;
