import { useState, useEffect } from 'react';
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
  Eye,
  Lock,
  Users,
  FileSpreadsheet,
  Calendar,
  Home,
  Grid3X3
} from 'lucide-react';

const CoordinatorProperties = ({ user }) => {
  // Check if this is an FP-created Coordinator (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewProperty, setViewProperty] = useState(null);
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
      const [propRes, zoneRes, vendRes, empRes] = await Promise.all([
        fetch('/api/coordinator/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/zones', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/vendors', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/employees', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [propData, zoneData, vendData, empData] = await Promise.all([
        propRes.json(), zoneRes.json(), vendRes.json(), empRes.json()
      ]);

      if (propData.success) setProperties(propData.data);
      if (zoneData.success) setZones(zoneData.data);
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
        ? `/api/coordinator/properties/${editingProperty.id}`
        : '/api/coordinator/properties';
      
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

  const handleDelete = async (property) => {
    if (!property.can_delete) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this property' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      const response = await fetch(`/api/coordinator/properties/${property.id}`, {
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
        ? `/api/coordinator/properties/${selectedProperty.id}/assign-vendor`
        : `/api/coordinator/properties/${selectedProperty.id}/assign-employee`;

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
      const response = await fetch('/api/coordinator/export/properties', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'coordinator_properties_export.json';
      a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const handleExportSingle = (property) => {
    try {
      // Create CSV content for single property export
      const headers = ['Name', 'ID', 'Type', 'Zone', 'Area', 'Division', 'Units', 'Address', 'City', 'State', 'Contacts', 'Created By', 'Created', 'Status'];
      const values = [
        property.name,
        property.property_id,
        property.property_type,
        property.zone_name || '',
        property.area || property.city || '',
        property.division || '',
        property.units || property.total_units || 1,
        property.address || '',
        property.city || '',
        property.state || '',
        property.contacts || property.contact_person || '',
        property.created_by_name || 'System',
        property.created_at ? new Date(property.created_at).toLocaleDateString() : '',
        property.status || 'active'
      ];
      
      const csvContent = [headers.join(','), values.map(v => `"${v}"`).join(',')].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `property_${property.property_id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Property exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const openEditModal = (property) => {
    if (!property.can_modify) {
      setMessage({ type: 'error', text: 'You do not have permission to edit this property' });
      return;
    }
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
      zoneId: property.zone_id || ''
    });
    setShowModal(true);
  };

  const openAssignModal = (property, type) => {
    const canAssign = type === 'vendor' ? property.can_assign_vendor : property.can_assign_employee;
    if (!canAssign) {
      setMessage({ type: 'error', text: `You do not have permission to assign ${type}s to this property` });
      return;
    }
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
      zoneId: ''
    });
  };

  // Property type tabs config
  const propertyTabs = [
    { id: 'all', label: 'All Customers' },
    { id: 'gated_community', label: 'Gated Communities' },
    { id: 'apartment', label: 'Apartments' },
    { id: 'villa', label: 'Villas' },
    { id: 'plot', label: 'Plots' },
    { id: 'flat', label: 'Flats' }
  ];

  // Get unique divisions from properties
  const divisions = [...new Set(properties.map(p => p.division).filter(Boolean))];

  const filteredProperties = properties.filter(p => {
    // Search filter
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.property_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.zone_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tab filter (property type)
    const matchesTab = activeTab === 'all' || 
      p.property_type?.toLowerCase().replace(/\s+/g, '_') === activeTab ||
      p.entry_type?.toLowerCase() === activeTab.replace('_', '');
    
    // Division filter
    const matchesDivision = divisionFilter === 'all' || p.division === divisionFilter;
    
    // Zone filter
    const matchesZone = zoneFilter === 'all' || p.zone_id === zoneFilter || p.zone_name === zoneFilter;
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || (p.status || 'active') === statusFilter;
    
    return matchesSearch && matchesTab && matchesDivision && matchesZone && matchesStatus;
  }
  );

  // Category Selection Screen
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
            <p className="text-gray-500 mt-1">View and manage created customers</p>
          </div>
        </div>

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
                <Store className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-400">Commercial</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">Back to Categories</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">{properties.length} total customers</p>
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

      {/* Tabs and Filters */}
      <div className="bg-white rounded-xl border border-gray-100">
        {/* Property Type Tabs */}
        <div className="flex items-center gap-1 px-4 pt-4 border-b border-gray-100 overflow-x-auto">
          {propertyTabs.map((tab) => {
            const count = tab.id === 'all' 
              ? properties.length 
              : properties.filter(p => 
                  p.property_type?.toLowerCase().replace(/\s+/g, '_') === tab.id ||
                  p.entry_type?.toLowerCase() === tab.id.replace('_', '')
                ).length;
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
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, zone, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap gap-3">
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Divisions</option>
              {divisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>

            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.name}>{zone.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Properties List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No properties found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Created By</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-900">{property.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{property.property_id}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        property.property_type === 'gated_community' || property.entry_type === 'GC' ? 'bg-blue-100 text-blue-700' :
                        property.property_type === 'apartment' || property.entry_type === 'APT' ? 'bg-purple-100 text-purple-700' :
                        property.property_type === 'villa' || property.entry_type === 'VILLA' ? 'bg-green-100 text-green-700' :
                        property.property_type === 'flat' || property.entry_type === 'FLAT' ? 'bg-orange-100 text-orange-700' :
                        property.property_type === 'plot' || property.entry_type === 'PLOT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {property.entry_type === 'GC' ? 'Gated Community' : 
                         property.entry_type === 'APT' ? 'Apartment' :
                         property.entry_type === 'VILLA' ? 'Villa' :
                         property.entry_type === 'FLAT' ? 'Flat' :
                         property.entry_type === 'PLOT' ? 'Plot' :
                         property.property_type?.replace('_', ' ') || 'Residential'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-700">{property.city}{property.state ? `, ${property.state}` : ''}</p>
                          <p className="text-xs text-gray-400">{property.zone_name || 'No zone'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-700">{property.contact_person || '-'}</p>
                      {property.contact_phone && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {property.contact_phone}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-600">{property.created_by_name || 'System'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => { setViewProperty(property); setShowViewModal(true); }}
                          className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Footer */}
        {!loading && filteredProperties.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            Showing {filteredProperties.length} of {properties.length} properties
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select
                    value={formData.propertyType}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                  <input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

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
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingProperty ? 'Update' : 'Create'} Property</span>
                </button>
              </div>
            </form>
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
                      className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors text-left"
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

      {/* View Details Modal */}
      {showViewModal && viewProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Property Details</h2>
                <button onClick={() => { setShowViewModal(false); setViewProperty(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Property Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{viewProperty.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ID</p>
                  <p className="font-mono text-gray-900">{viewProperty.property_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <span className="inline-block px-2 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium capitalize">
                    {viewProperty.property_type}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="text-gray-900">{viewProperty.zone_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Area</p>
                  <p className="text-gray-900">{viewProperty.area || viewProperty.city || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Division</p>
                  <p className="text-gray-900">{viewProperty.division || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Units</p>
                  <p className="text-gray-900">{viewProperty.units || viewProperty.total_units || 1}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="text-gray-900">{viewProperty.address || `${viewProperty.city}, ${viewProperty.state}`}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contacts</p>
                  <p className="text-gray-900">{viewProperty.contacts || viewProperty.contact_person || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created By</p>
                  <p className="text-gray-900">{viewProperty.created_by_name || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-gray-900">
                    {viewProperty.created_at ? new Date(viewProperty.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${
                    viewProperty.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {viewProperty.status || 'active'}
                  </span>
                </div>
              </div>

              {/* Contact Details */}
              {(viewProperty.contact_person || viewProperty.contact_phone || viewProperty.contact_email) && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {viewProperty.contact_person && (
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">Contact Person</p>
                        <p className="text-gray-900">{viewProperty.contact_person}</p>
                      </div>
                    )}
                    {viewProperty.contact_email && (
                      <div className="min-w-0 md:col-span-2">
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="text-gray-900 break-all">{viewProperty.contact_email}</p>
                      </div>
                    )}
                    {viewProperty.contact_phone && (
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="text-gray-900 whitespace-nowrap">{viewProperty.contact_phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => { setShowViewModal(false); setViewProperty(null); }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
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

export default CoordinatorProperties;
