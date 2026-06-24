import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Store,
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Phone,
  Mail,
  MapPin,
  Eye,
  Truck,
  Wrench,
  Zap,
  Wind,
  Sparkles,
  Shield,
  EyeOff,
  FileSpreadsheet
} from 'lucide-react';

const CoordinatorVendors = ({ user }) => {
  // Check if this is an FP-created Coordinator (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
  const location = useLocation();
  const [vendors, setVendors] = useState({ own: [], assigned: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [zones, setZones] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    alternatePhone: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  // Service type tabs config
  const serviceTabs = [
    { id: 'all', label: 'All Vendors', icon: Store },
    { id: 'plumbing', label: 'Plumbing', icon: Wrench },
    { id: 'electrical', label: 'Electrical', icon: Zap },
    { id: 'hvac', label: 'HVAC', icon: Wind },
    { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  // Determine view type based on URL
  const viewType = location.pathname.includes('/add') ? 'add' 
                 : location.pathname.includes('/assigned') ? 'assigned' 
                 : 'all';

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/coordinator/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVendors(result.data);
      }
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    if (viewType === 'add') {
      resetForm();
      setShowModal(true);
    }
  }, [viewType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const url = editingVendor 
        ? `/api/coordinator/vendors/${editingVendor.id}`
        : '/api/coordinator/vendors';
      
      const response = await fetch(url, {
        method: editingVendor ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `Vendor ${editingVendor ? 'updated' : 'created'} successfully!` });
        setShowModal(false);
        resetForm();
        fetchVendors();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save vendor' });
    }
  };

  const handleDelete = async (vendor) => {
    if (!vendor.can_delete) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this vendor' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;

    try {
      const response = await fetch(`/api/coordinator/vendors/${vendor.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Vendor deleted successfully!' });
        fetchVendors();
      } else {
        setMessage({ type: 'error', text: result.message || 'Delete failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete vendor' });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/coordinator/export/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'coordinator_vendors_export.json';
      a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const handleExportVendor = (vendor) => {
    const csvContent = [
      ['Vendor ID', 'Company Name', 'Service Type', 'Owner', 'Zone', 'Area', 'Rate/Visit', 'Coverage/Day', 'Email', 'Phone', 'Address', 'City', 'State', 'Status', 'Created'],
      [
        vendor.vendor_id || '',
        vendor.company_name || '',
        vendor.service_type || '',
        vendor.contact_person || '',
        vendor.zone_name || vendor.zone || '',
        vendor.area || '',
        vendor.rate_per_visit || '',
        vendor.coverage_per_day || '',
        vendor.email || '',
        vendor.phone || '',
        vendor.address || '',
        vendor.city || '',
        vendor.state || '',
        vendor.is_active ? 'Active' : 'Inactive',
        vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : ''
      ]
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor_${vendor.vendor_id || vendor.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'Vendor exported successfully!' });
  };

  const openEditModal = (vendor) => {
    // FP Coordinators cannot modify vendors
    if (isFPCoordinator) {
      setMessage({ type: 'error', text: 'Modify vendor not allowed for this role' });
      return;
    }
    if (!vendor.can_modify) {
      setMessage({ type: 'error', text: 'You do not have permission to edit this vendor (View Only)' });
      return;
    }
    setEditingVendor(vendor);
    setFormData({
      companyName: vendor.company_name || '',
      contactPerson: vendor.contact_person || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      alternatePhone: vendor.alternate_phone || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      zipCode: vendor.zip_code || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingVendor(null);
    setFormData({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      alternatePhone: '',
      address: '',
      city: '',
      state: '',
      zipCode: ''
    });
  };

  const getVendorList = () => {
    switch (viewType) {
      case 'assigned': return vendors.assigned || [];
      default: return vendors.all || [];
    }
  };

  // Filter vendors based on search and service type tab
  const filteredVendors = getVendorList().filter(v => {
    const matchesSearch = !searchTerm ||
      v.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.zone_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeTab === 'all' || v.service_type?.toLowerCase() === activeTab;
    const matchesZone = zoneFilter === 'all' || v.zone_id?.toString() === zoneFilter;
    
    return matchesSearch && matchesTab && matchesZone;
  });

  // Get count for each service tab
  const getTabCount = (tabId) => {
    const list = getVendorList();
    if (tabId === 'all') return list.length;
    return list.filter(v => v.service_type?.toLowerCase() === tabId).length;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Details</h1>
          <p className="text-teal-600 text-sm">{getVendorList().length} total vendors</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchVendors}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          {/* Add Vendor - Hidden for FP Coordinator */}
          {!isFPCoordinator && (
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vendor</span>
            </button>
          )}
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

      {/* Search and Filters Row */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, service, or zone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Service Types ({getTabCount('all')})</option>
            {serviceTabs.filter(t => t.id !== 'all').map(tab => (
              <option key={tab.id} value={tab.id}>{tab.label} ({getTabCount(tab.id)})</option>
            ))}
          </select>
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Divisions</option>
            {divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Zones</option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="active">Active Vendors</option>
            <option value="inactive">Inactive Vendors</option>
            <option value="all">All Vendors</option>
          </select>
        </div>
      </div>

      {/* Vendors List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-teal-600 font-medium">No vendors found</p>
            <p className="text-gray-400 text-sm mt-1">Add vendors using the Add Vendor page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Service Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Area</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Coverage/Day</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Created By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-gray-900">{vendor.owner_name || vendor.company_name || '-'}</p>
                        <p className="text-xs text-gray-400">{vendor.vendor_id}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.service_type || '-'}</td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{vendor.zone_name || vendor.zone || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{vendor.area || '-'}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-sm text-gray-600">{vendor.coverage_per_day || '-'}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-sm text-gray-600">{vendor.created_by_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-500">
                        {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        vendor.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details - Only action available for Coordinators */}
                        <button
                          onClick={() => { setSelectedVendor(vendor); setShowViewModal(true); }}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
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
      </div>

      {/* Add/Edit Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
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
                  <span>{editingVendor ? 'Update' : 'Add'} Vendor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Vendor Modal */}
      {showViewModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Vendor Details</h2>
                <button onClick={() => { setShowViewModal(false); setSelectedVendor(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Vendor ID</p>
                  <p className="font-medium text-gray-900">{selectedVendor.vendor_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    selectedVendor.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedVendor.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Company Name</p>
                  <p className="font-medium text-gray-900">{selectedVendor.company_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="font-medium text-gray-900">{selectedVendor.contact_person || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{selectedVendor.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{selectedVendor.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Service Type</p>
                  <p className="font-medium text-gray-900">{selectedVendor.service_type || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Division</p>
                  <p className="font-medium text-gray-900">{selectedVendor.division || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="font-medium text-gray-900">{selectedVendor.zone_name || selectedVendor.zone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Area</p>
                  <p className="font-medium text-gray-900">{selectedVendor.area || selectedVendor.area_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rate/Visit</p>
                  <p className="font-medium text-gray-900">₹{selectedVendor.rate_per_visit || '0'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Coverage/Day</p>
                  <p className="font-medium text-gray-900">{selectedVendor.coverage_per_day || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created By</p>
                  <p className="font-medium text-gray-900">{selectedVendor.created_by_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">
                    {selectedVendor.created_at ? new Date(selectedVendor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                  </p>
                </div>
                </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowViewModal(false); setSelectedVendor(null); }}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoordinatorVendors;
