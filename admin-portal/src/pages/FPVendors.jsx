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
  Save,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Service Type Icons mapping
const SERVICE_ICONS = {
  'Plumbing': Wrench,
  'Electrical': Zap,
  'HVAC': Wind,
  'Cleaning': Sparkles,
  'Security': Shield,
};

const FPVendors = ({ user }) => {
  const navigate = useNavigate();
  
  // Check if user is FP Manager (restricted access - view only)
  const isFPManager = user?.role === 'manager';
  
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewVendor, setViewVendor] = useState(null);
  const [editVendor, setEditVendor] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  // Fetch vendors from API
  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fp/vendors?include_deleted=true', {
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
  }, []);

  const showToastMessage = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };


  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Get unique service types, divisions and zones from vendors
  const serviceTypes = [...new Set(vendors.map(v => v.serviceType || v.service_type).filter(Boolean))].sort();
  const divisions = [...new Set(vendors.map(v => v.division).filter(Boolean))];
  const zones = [...new Set(vendors.map(v => v.zone_name || v.zone).filter(Boolean))];

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    // Status filter
    const isInactive = v.status === 'deleted' || v.is_active === 0 || v.is_active === false;
    if (statusFilter === 'active' && isInactive) return false;
    if (statusFilter === 'inactive' && !isInactive) return false;
    
    // Service type filter
    if (selectedServiceType !== 'all' && (v.serviceType || v.service_type) !== selectedServiceType) return false;
    
    // Division filter
    if (divisionFilter && v.division !== divisionFilter) return false;
    
    // Zone filter
    if (zoneFilter && (v.zone_name || v.zone) !== zoneFilter) return false;
    
    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        (v.vendorId || v.vendor_id || '').toLowerCase().includes(q) ||
        (v.ownerName || v.owner_name || '').toLowerCase().includes(q) ||
        (v.serviceType || v.service_type || '').toLowerCase().includes(q) ||
        (v.zone_name || v.zone || '').toLowerCase().includes(q) ||
        (v.area || v.areaName || v.area_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });
  
  // Get count for each service type
  const getServiceTypeCount = (serviceType) => {
    if (serviceType === 'all') return vendors.length;
    return vendors.filter(v => (v.serviceType || v.service_type) === serviceType).length;
  };

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

      {/* Main Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <select
                    value={selectedServiceType}
                    onChange={(e) => setSelectedServiceType(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-1 focus:ring-amber-200 focus:border-amber-400 outline-none"
                  >
                    <option value="all">All Service Types ({getServiceTypeCount('all')})</option>
                    {serviceTypes.map(st => <option key={st} value={st}>{st} ({getServiceTypeCount(st)})</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
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
                      statusFilter === 'inactive' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white'
                    }`}
                  >
                    <option value="active">Active Vendors</option>
                    <option value="inactive">Inactive Vendors</option>
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
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Zone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Area</th>
                  {/* Rate/Coverage columns - Hidden for FP Manager */}
                  {!isFPManager && (
                    <>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Rate/Visit</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Coverage/Day</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id || vendor.vendorId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{vendor.ownerName || vendor.owner_name || '-'}</p>
                      <p className="text-xs text-gray-400">{vendor.vendorId || vendor.vendor_id}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{vendor.serviceType || vendor.service_type || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {vendor.zone_name || vendor.zone || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {vendor.area || vendor.areaName || vendor.area_name || '-'}
                    </td>
                    {/* Rate/Coverage data - Hidden for FP Manager */}
                    {!isFPManager && (
                      <>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-center">
                          ₹{vendor.ratePerVisit || vendor.rate_per_visit || 0}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-center">
                          {vendor.coveragePerDay || vendor.coverage_per_day || 0}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {vendor.created_by_name || vendor.createdBy || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(vendor.createdAt || vendor.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        (vendor.status === 'deleted' || vendor.is_active === 0 || vendor.is_active === false)
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {(vendor.status === 'deleted' || vendor.is_active === 0 || vendor.is_active === false) ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewVendor(vendor)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {!isFPManager && (vendor.status === 'deleted' || vendor.is_active === 0) ? (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/fp/vendors/${vendor.id}/restore`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  const result = await response.json();
                                  if (result.success) {
                                    showToastMessage('Vendor restored successfully');
                                    fetchVendors();
                                  } else {
                                    showToastMessage(result.message || 'Failed to restore vendor', 'error');
                                  }
                                } catch (error) {
                                  showToastMessage('Failed to restore vendor', 'error');
                                }
                              }}
                              className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                              title="Restore Vendor"
                            >
                              <RefreshCw className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => setPermanentDeleteConfirm(vendor)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        ) : !isFPManager && (
                          <>
                            <button
                              onClick={() => setEditVendor(vendor)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Modify Vendor"
                            >
                              <Edit2 className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(vendor)}
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
            <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </div>
          </div>
        )}
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {permanentDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPermanentDeleteConfirm(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-600 mb-2">⚠️ Permanently Delete Vendor</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to <strong className="text-red-600">permanently delete</strong> <strong>{permanentDeleteConfirm.ownerName || permanentDeleteConfirm.owner_name}</strong>?
              <br /><br />
              <span className="text-red-500 text-sm">This action is irreversible and all vendor data will be lost forever.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPermanentDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/fp/vendors/${permanentDeleteConfirm.id}/permanent`, {
                      method: 'DELETE',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (result.success) {
                      showToastMessage('Vendor permanently deleted');
                      fetchVendors();
                    } else {
                      showToastMessage(result.message || 'Failed to delete vendor', 'error');
                    }
                  } catch (error) {
                    showToastMessage('Failed to delete vendor', 'error');
                  }
                  setPermanentDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Vendor</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.ownerName || deleteConfirm.owner_name}</strong>? The vendor will be moved to inactive.
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
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gray-50 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Modify Vendor</h2>
                <p className="text-sm text-gray-500">{editVendor.vendor_id || editVendor.vendorId}</p>
              </div>
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
                      service_type: formData.get('serviceType'),
                      zone_name: formData.get('zone'),
                      area: formData.get('area'),
                      rate_per_visit: parseFloat(formData.get('ratePerVisit')) || 0,
                      coverage_per_day: parseInt(formData.get('coveragePerDay')) || 0,
                      owner_name: formData.get('ownerName'),
                      owner_mobile: formData.get('ownerMobile'),
                      owner_email: formData.get('ownerEmail'),
                      owner_aadhar: formData.get('ownerAadhar'),
                      manager_name: formData.get('managerName'),
                      manager_mobile: formData.get('managerMobile'),
                      manager_email: formData.get('managerEmail'),
                      poc_name: formData.get('pocName'),
                      poc_mobile: formData.get('pocMobile'),
                      poc_email: formData.get('pocEmail')
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
              className="p-6 space-y-6"
            >
              {/* Service & Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Service & Location</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Service Type</label>
                    <input name="serviceType" defaultValue={editVendor.service_type || editVendor.serviceType} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Zone</label>
                    <input name="zone" defaultValue={editVendor.zone_name || editVendor.zone} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Area</label>
                    <input name="area" defaultValue={editVendor.area || editVendor.areaName || editVendor.area_name} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                </div>
              </div>

              {/* Rate & Coverage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Rate & Coverage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rate Per Visit (₹)</label>
                    <input name="ratePerVisit" type="number" defaultValue={editVendor.rate_per_visit || editVendor.ratePerVisit || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Coverage Per Day</label>
                    <input name="coveragePerDay" type="number" defaultValue={editVendor.coverage_per_day || editVendor.coveragePerDay || 0} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                </div>
              </div>

              {/* Owner Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Owner Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input name="ownerName" defaultValue={editVendor.owner_name || editVendor.ownerName || editVendor.company_name} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mobile</label>
                    <input name="ownerMobile" defaultValue={editVendor.owner_mobile || editVendor.ownerMobile || editVendor.phone} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input name="ownerEmail" type="email" defaultValue={editVendor.owner_email || editVendor.ownerEmail || editVendor.email} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Aadhar</label>
                    <input name="ownerAadhar" defaultValue={editVendor.owner_aadhar || editVendor.ownerAadhar} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                </div>
              </div>

              {/* Manager Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Manager / Primary Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input name="managerName" defaultValue={editVendor.manager_name || editVendor.managerName} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mobile</label>
                    <input name="managerMobile" defaultValue={editVendor.manager_mobile || editVendor.managerMobile} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input name="managerEmail" type="email" defaultValue={editVendor.manager_email || editVendor.managerEmail} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                </div>
              </div>

              {/* POC Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Point of Contact</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input name="pocName" defaultValue={editVendor.poc_name || editVendor.pocName} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mobile</label>
                    <input name="pocMobile" defaultValue={editVendor.poc_mobile || editVendor.pocMobile} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                    <input name="pocEmail" type="email" defaultValue={editVendor.poc_email || editVendor.pocEmail} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setEditVendor(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-gray-50 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{viewVendor.ownerName || viewVendor.owner_name}</h2>
                <p className="text-sm text-gray-500 font-mono">{viewVendor.vendorId || viewVendor.vendor_id}</p>
              </div>
              <button onClick={() => setViewVendor(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                    <p className="font-medium">{viewVendor.zone_name || viewVendor.zone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Area</p>
                    <p className="font-medium">{viewVendor.area || viewVendor.areaName || viewVendor.area_name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Rate & Coverage - Hidden for FP Manager */}
              {!isFPManager && (
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
              )}

              {/* Owner Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Owner Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium">{viewVendor.ownerName || viewVendor.owner_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Mobile</p>
                    <p className="font-medium">{viewVendor.owner_country_code || '+91'} {viewVendor.ownerMobile || viewVendor.owner_mobile || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium">{viewVendor.ownerEmail || viewVendor.owner_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Aadhar</p>
                    <p className="font-medium">{viewVendor.ownerAadhar || viewVendor.owner_aadhar || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Manager Details */}
              {(viewVendor.managerName || viewVendor.manager_name || viewVendor.managerMobile || viewVendor.manager_mobile) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Manager / Primary Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium">{viewVendor.managerName || viewVendor.manager_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="font-medium">{viewVendor.manager_country_code || '+91'} {viewVendor.managerMobile || viewVendor.manager_mobile || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{viewVendor.managerEmail || viewVendor.manager_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* POC Details */}
              {(viewVendor.pocName || viewVendor.poc_name || viewVendor.pocMobile || viewVendor.poc_mobile) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Point of Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium">{viewVendor.pocName || viewVendor.poc_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Mobile</p>
                      <p className="font-medium">{viewVendor.poc_country_code || '+91'} {viewVendor.pocMobile || viewVendor.poc_mobile || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{viewVendor.pocEmail || viewVendor.poc_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Created Info */}
              <div className="pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Created By</p>
                    <p className="text-gray-600">{viewVendor.created_by_name || viewVendor.createdBy || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Created At</p>
                    <p className="text-gray-600">{viewVendor.created_at ? new Date(viewVendor.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</p>
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
