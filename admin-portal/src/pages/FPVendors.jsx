import { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Search,
  Eye,
  RefreshCw,
  X,
  Bell,
  Truck,
  Wrench,
  Zap,
  Wind,
  Sparkles,
  Shield,
  ChevronDown,
  FileCheck,
  Edit2,
  Trash2,
  Save
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Service Type Tabs
const TABS = [
  { id: 'all', label: 'All Vendors', icon: Truck },
  { id: 'Plumbing', label: 'Plumbing', icon: Wrench },
  { id: 'Electrical', label: 'Electrical', icon: Zap },
  { id: 'HVAC', label: 'HVAC', icon: Wind },
  { id: 'Cleaning', label: 'Cleaning', icon: Sparkles },
  { id: 'Security', label: 'Security', icon: Shield },
];

const FPVendors = ({ user }) => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewVendor, setViewVendor] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  // Fetch vendors from API
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fp/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        // Handle both array and object response
        const vendorData = Array.isArray(result.data) ? result.data : (result.data?.all || []);
        setVendors(vendorData);
      }
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [statusFilter]);

  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };


  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get unique divisions and zones for filters
  const divisions = [...new Set(vendors.map(v => v.division).filter(Boolean))];
  const zones = [...new Set(vendors.map(v => v.zone).filter(Boolean))];

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    // Service type filter
    if (activeTab !== 'all' && (v.serviceType || v.service_type) !== activeTab) return false;
    
    // Division filter
    if (divisionFilter && v.division !== divisionFilter) return false;
    
    // Zone filter
    if (zoneFilter && v.zone !== zoneFilter) return false;
    
    // Status filter
    if (statusFilter === 'active' && v.status === 'deleted') return false;
    if (statusFilter === 'deleted' && v.status !== 'deleted') return false;
    
    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (v.vendorId || v.vendor_id || '').toLowerCase().includes(q) ||
        (v.ownerName || v.owner_name || '').toLowerCase().includes(q) ||
        (v.serviceType || v.service_type || '').toLowerCase().includes(q) ||
        (v.zone || '').toLowerCase().includes(q) ||
        (v.areaName || v.area_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Details</h1>
          <p className="text-gray-500 text-sm mt-1">{vendors.length} total vendors</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchVendors}
            className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/fp/vendors/add')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Tabs + Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Service Type Tab bar */}
        <div className="border-b border-gray-200 px-4 flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'all' ? vendors.length : vendors.filter(v => (v.serviceType || v.service_type) === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-amber-600 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                {tab.label}
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Filters */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, service, or zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
              >
                <option value="">All Divisions</option>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
              >
                <option value="">All Zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`appearance-none pl-3 pr-8 py-2 border rounded-md text-sm focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none ${
                  statusFilter === 'deleted' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                }`}
              >
                <option value="active">Active Vendors</option>
                <option value="deleted">Deleted Vendors</option>
                <option value="all">All Vendors</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Vendor Table */}
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vendors found</p>
            <p className="text-gray-400 text-sm mt-1">
              {vendors.length === 0 
                ? 'Add vendors using the Add Vendor page.' 
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Vendor ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Service Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Zone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Area</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Rate/Visit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Coverage/Day</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id || vendor.vendorId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {vendor.vendorId || vendor.vendor_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        {vendor.serviceType || vendor.service_type}
                        {vendor.serviceVerified && <FileCheck className="w-3 h-3 text-emerald-500" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {vendor.ownerName || vendor.owner_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {vendor.zone || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {vendor.areaName || vendor.area_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      ₹{vendor.ratePerVisit || vendor.rate_per_visit || 0}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-center">
                      {vendor.coveragePerDay || vendor.coverage_per_day || 0}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {vendor.createdBy || 'Manager'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(vendor.createdAt || vendor.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        vendor.status === 'deleted' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {vendor.status === 'deleted' ? 'Deleted' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewVendor(vendor)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {vendor.status !== 'deleted' && (
                          <>
                            <button
                              onClick={() => setEditVendor(vendor)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="Modify vendor"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(vendor)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete vendor"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Vendor</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.ownerName || deleteConfirm.owner_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/fp/vendors/${deleteConfirm.id}`, {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (result.success) {
                      showToastMessage('Vendor deleted successfully');
                      fetchVendors();
                    } else {
                      showToastMessage(result.message || 'Failed to delete vendor', 'error');
                    }
                  } catch (error) {
                    showToastMessage('Failed to delete vendor', 'error');
                  }
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vendor Modal */}
      {editVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditVendor(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Modify Vendor</h2>
              <button onClick={() => setEditVendor(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                  const response = await fetch(`/api/fp/vendors/${editVendor.id}`, {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      companyName: formData.get('companyName'),
                      contactPerson: formData.get('contactPerson'),
                      email: formData.get('email'),
                      phone: formData.get('phone')
                    })
                  });
                  const result = await response.json();
                  if (result.success) {
                    showToastMessage('Vendor updated successfully');
                    fetchVendors();
                    setEditVendor(null);
                  } else {
                    showToastMessage(result.message || 'Failed to update vendor', 'error');
                  }
                } catch (error) {
                  showToastMessage('Failed to update vendor', 'error');
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    name="companyName"
                    defaultValue={editVendor.company_name || editVendor.companyName}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input
                    name="contactPerson"
                    defaultValue={editVendor.contact_person || editVendor.contactPerson || editVendor.ownerName || editVendor.owner_name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editVendor.email || editVendor.ownerEmail || editVendor.owner_email}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    name="phone"
                    defaultValue={editVendor.phone || editVendor.ownerMobile || editVendor.owner_mobile}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditVendor(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Vendor Modal */}
      {viewVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewVendor(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{viewVendor.ownerName || viewVendor.owner_name}</h2>
                <p className="text-sm text-gray-500 font-mono">{viewVendor.vendorId || viewVendor.vendor_id}</p>
              </div>
              <button onClick={() => setViewVendor(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Service Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Service Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Service Type</p>
                    <p className="font-medium">{viewVendor.serviceType || viewVendor.service_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Verified</p>
                    <p className="font-medium">{viewVendor.serviceVerified ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Location Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Zone</p>
                    <p className="font-medium">{viewVendor.zone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Area</p>
                    <p className="font-medium">{viewVendor.areaName || viewVendor.area_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Rate & Coverage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Rate & Coverage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Rate Per Visit</p>
                    <p className="font-medium">₹{viewVendor.ratePerVisit || viewVendor.rate_per_visit || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Coverage Per Day</p>
                    <p className="font-medium">{viewVendor.coveragePerDay || viewVendor.coverage_per_day || 0}</p>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Owner Email</p>
                    <p className="font-medium">{viewVendor.ownerEmail || viewVendor.owner_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Owner Mobile</p>
                    <p className="font-medium">{viewVendor.ownerMobile || viewVendor.owner_mobile || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPVendors;
