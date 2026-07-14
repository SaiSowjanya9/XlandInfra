import { useState, useEffect } from 'react';
import { Store, Search, RefreshCw, X, AlertCircle, CheckCircle, Eye, Wrench, Zap, Wind, Sparkles, Shield } from 'lucide-react';

const SERVICE_TYPES = [
  { id: 'all', label: 'All Vendors', icon: Store },
  { id: 'Plumbing', label: 'Plumbing', icon: Wrench },
  { id: 'Electrical', label: 'Electrical', icon: Zap },
  { id: 'HVAC', label: 'HVAC', icon: Wind },
  { id: 'Cleaning', label: 'Cleaning', icon: Sparkles },
  { id: 'Security', label: 'Security', icon: Shield },
];

const ExecutiveVendors = ({ user }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const token = getAuthToken();

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/executive/vendors', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) setVendors(result.data.all || result.data || []);
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const viewVendorDetails = (vendor) => { setSelectedVendor(vendor); setShowDetailModal(true); };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Derived data - based on current status filter for dynamic counts
  const getStatusFilteredVendors = () => {
    return vendors.filter(v => {
      const isActive = v.status === 'active' || v.is_active;
      if (statusFilter === 'active') return isActive;
      if (statusFilter === 'inactive') return !isActive;
      return true;
    });
  };
  
  const statusFilteredVendors = getStatusFilteredVendors();
  const zones = [...new Set(statusFilteredVendors.map(v => v.zone || v.zone_name).filter(Boolean))].sort();
  
  // Get count for each service type (based on status + zone filters)
  const getServiceCount = (type) => {
    let filtered = statusFilteredVendors;
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(v => (v.zone || v.zone_name) === zoneFilter);
    }
    if (type === 'all') return filtered.length;
    return filtered.filter(v => v.service_type?.toLowerCase() === type.toLowerCase()).length;
  };
  
  // Get count for each zone (based on status + service type filters)
  const getZoneCount = (zone) => {
    let filtered = statusFilteredVendors;
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(v => v.service_type?.toLowerCase() === serviceFilter.toLowerCase());
    }
    if (zone === 'all') return filtered.length;
    return filtered.filter(v => (v.zone || v.zone_name) === zone).length;
  };
  
  // Get count for each status (based on service type + zone filters)
  const getStatusCount = (status) => {
    let filtered = vendors.filter(v => {
      const isActive = v.status === 'active' || v.is_active;
      if (status === 'active') return isActive;
      if (status === 'inactive') return !isActive;
      return true;
    });
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(v => v.service_type?.toLowerCase() === serviceFilter.toLowerCase());
    }
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(v => (v.zone || v.zone_name) === zoneFilter);
    }
    return filtered.length;
  };

  const filteredVendors = vendors.filter(v => {
    const matchSearch = !searchTerm || 
      v.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.zone?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchService = serviceFilter === 'all' || v.service_type?.toLowerCase() === serviceFilter.toLowerCase();
    const matchZone = zoneFilter === 'all' || v.zone === zoneFilter || v.zone_name === zoneFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? (v.status === 'active' || v.is_active) : v.status !== 'active');
    return matchSearch && matchService && matchZone && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendor Details</h1>
          <p className="text-indigo-600 text-sm">{statusFilteredVendors.length} total vendors</p>
        </div>
        <button onClick={fetchVendors} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
          <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {message.text && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, service, or zone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.trim())}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Service Types ({getServiceCount('all')})</option>
          {SERVICE_TYPES.filter(t => t.id !== 'all').map(type => (
            <option key={type.id} value={type.id}>{type.label} ({getServiceCount(type.id)})</option>
          ))}
        </select>
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="all">All Zones ({getZoneCount('all')})</option>
          {zones.map(z => <option key={z} value={z}>{z} ({getZoneCount(z)})</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="active">Active Vendors ({getStatusCount('active')})</option>
          <option value="all">All Status ({getStatusCount('all')})</option>
          <option value="inactive">Inactive ({getStatusCount('inactive')})</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12"><Store className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No vendors found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Service Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zone</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Area</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Coverage/Day</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-900">{vendor.owner_name || vendor.company_name || '-'}</p>
                      <p className="text-xs text-gray-400">{vendor.vendor_id}</p>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.service_type || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.zone || vendor.zone_name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.area || vendor.area_name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.coverage_per_day || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-700">{vendor.created_by_name || '-'}</td>
                    <td className="py-4 px-4 text-sm text-gray-500">{formatDate(vendor.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${vendor.status === 'active' || vendor.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {vendor.status === 'active' || vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => viewVendorDetails(vendor)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View"
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

      {/* View Details Modal */}
      {showDetailModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Vendor Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Vendor ID</p>
                    <p className="font-medium text-gray-900">{selectedVendor.vendor_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${selectedVendor.is_active || selectedVendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedVendor.is_active || selectedVendor.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Service Type</p>
                    <p className="font-medium text-gray-900">{selectedVendor.service_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Vendor Type</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${selectedVendor.vendor_type === 'own' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {selectedVendor.vendor_type === 'own' ? 'My Vendor' : 'Assigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Zone</p>
                    <p className="font-medium text-gray-900">{selectedVendor.zone_name || selectedVendor.zone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Area</p>
                    <p className="font-medium text-gray-900">{selectedVendor.area || selectedVendor.area_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Coverage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Coverage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Coverage Per Day</p>
                    <p className="font-medium text-gray-900">{selectedVendor.coverage_per_day || 0}</p>
                  </div>
                </div>
              </div>

              {/* Vendor Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Vendor Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">{selectedVendor.owner_name || selectedVendor.company_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Mobile</p>
                    <p className="font-medium text-gray-900">{(() => { const mobile = selectedVendor.owner_mobile || selectedVendor.phone || '-'; return mobile.startsWith('+') ? mobile : `${selectedVendor.owner_country_code || '+91'} ${mobile}`; })()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{selectedVendor.owner_email || selectedVendor.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Aadhar</p>
                    <p className="font-medium text-gray-900">{selectedVendor.owner_aadhar || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Manager Details */}
              {(selectedVendor.manager_name || selectedVendor.manager_mobile) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Manager / Primary Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{selectedVendor.manager_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="font-medium text-gray-900">{selectedVendor.manager_country_code || '+91'} {selectedVendor.manager_mobile || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{selectedVendor.manager_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* POC Details */}
              {(selectedVendor.poc_name || selectedVendor.poc_mobile) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Point of Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{selectedVendor.poc_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="font-medium text-gray-900">{selectedVendor.poc_country_code || '+91'} {selectedVendor.poc_mobile || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{selectedVendor.poc_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Created Info */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Created By</p>
                    <p className="text-gray-600">{selectedVendor.created_by_name || selectedVendor.created_by || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Created At</p>
                    <p className="text-gray-600">{formatDate(selectedVendor.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
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

export default ExecutiveVendors;
