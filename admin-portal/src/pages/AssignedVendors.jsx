import { useState, useEffect } from 'react';
import {
  Search,
  X,
  Check,
  Eye,
  ChevronDown,
  AlertCircle,
  Truck,
  Building2,
  Phone,
  Mail,
  Calendar,
  MapPin,
  RefreshCw,
  Trash2,
  ExternalLink,
  Edit,
  Package,
  Users,
  Layers,
  Save,
  UserCheck,
  Filter,
} from 'lucide-react';
const AssignedVendors = ({ user }) => {
  // Check if user is FP Manager (view-only mode)
  const isFPManager = user?.role === 'manager';
  const isFPUser = user?.role === 'franchise_partner' || user?.role === 'manager' || user?.role === 'fp_coordinator';
  // Manager uses /api/manager, FP uses /api/fp
  const apiPrefix = isFPManager ? '/api/manager' : (isFPUser ? '/api/fp' : '/api');
  
  const [activeTab, setActiveTab] = useState('service'); // 'service' or 'property'
  const [assignments, setAssignments] = useState([]);
  const [serviceAssignments, setServiceAssignments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewAssignment, setViewAssignment] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [editAssignment, setEditAssignment] = useState(null);
  const [editModalData, setEditModalData] = useState(null);

  const token = sessionStorage.getItem('pm_auth_token');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Refresh data when page becomes visible (handles navigation back to this page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [statusFilter]);

  const loadData = async () => {
    try {
      // Load vendor assignments from API
      const [assignResponse, vendorResponse] = await Promise.all([
        fetch(`${apiPrefix}/vendors/assignments?status=${statusFilter}`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        }),
        fetch(`${apiPrefix}/vendors?status=active`, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        })
      ]);
      
      const assignResult = await assignResponse.json();
      const vendorResult = await vendorResponse.json();
      
      if (assignResult.success) {
        setAssignments(assignResult.data?.propertyAssignments || []);
        setServiceAssignments(assignResult.data?.serviceAssignments || []);
      }
      
      if (vendorResult.success) {
        // Handle FP vendor data structure
        const vendorData = vendorResult.data?.all || vendorResult.data || [];
        setVendors(vendorData);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRemoveAssignment = async (assignment) => {
    try {
      const response = await fetch(`${apiPrefix}/vendors/assignments/${assignment.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Vendor assignment removed successfully');
        setRemoveConfirm(null);
        loadData();
      } else {
        showToast(result.message || 'Failed to remove assignment', 'error');
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      showToast('Failed to remove assignment', 'error');
    }
  };

  const handleRemoveServiceAssignment = async (assignment) => {
    try {
      const response = await fetch(`/api/vendors/service-assignments/${assignment.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Service vendor assignment removed successfully');
        setRemoveConfirm(null);
        loadData();
      } else {
        showToast(result.message || 'Failed to remove assignment', 'error');
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      showToast('Failed to remove assignment', 'error');
    }
  };

  const handleUpdateServiceVendor = async (assignment, newVendorId) => {
    // Find vendor - newVendorId could be numeric id or string vendor_id
    const vendor = vendors.find(v => 
      String(v.id) === String(newVendorId) || 
      v.vendorId === newVendorId || 
      v.vendor_id === newVendorId
    );
    
    if (!vendor) {
      showToast('Please select a valid vendor', 'error');
      return;
    }

    try {
      // For property assignments, update the vendor
      const response = await fetch(`${apiPrefix}/vendors/assignments/${assignment.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: vendor.id,
          vendor_id: vendor.id
        })
      });
      const result = await response.json();
      
      if (result.success) {
        showToast('Vendor assigned successfully');
        setEditAssignment(null);
        setEditModalData(null);
        loadData();
      } else {
        showToast(result.message || 'Failed to update', 'error');
      }
    } catch (error) {
      console.error('Error updating vendor:', error);
      showToast('Failed to update vendor', 'error');
    }
  };

  // Get vendors that match a service type
  const getMatchingVendors = (serviceType) => {
    if (!serviceType) return vendors;
    const normalizedService = serviceType.toLowerCase().trim();
    return vendors.filter(v => {
      const vendorService = (v.serviceType || '').toLowerCase().trim();
      return vendorService.includes(normalizedService) || normalizedService.includes(vendorService);
    });
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get unique zones and service types from all assignments
  const allZones = [...new Set([
    ...assignments.map(a => a.propertyZone),
    ...serviceAssignments.map(a => a.propertyZone)
  ].filter(Boolean))];

  const allServiceTypes = [...new Set(serviceAssignments.map(a => a.serviceType).filter(Boolean))];

  // Filter property assignments
  const filteredAssignments = assignments.filter(a => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        a.vendorName?.toLowerCase().includes(q) ||
        a.vendorId?.toLowerCase().includes(q) ||
        a.propertyName?.toLowerCase().includes(q) ||
        a.propertyId?.toLowerCase().includes(q) ||
        a.serviceType?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (zoneFilter && a.propertyZone !== zoneFilter) return false;
    return true;
  });

  // Filter service assignments
  const filteredServiceAssignments = serviceAssignments.filter(a => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        a.vendorName?.toLowerCase().includes(q) ||
        a.vendorId?.toLowerCase().includes(q) ||
        a.propertyName?.toLowerCase().includes(q) ||
        a.propertyId?.toLowerCase().includes(q) ||
        a.serviceType?.toLowerCase().includes(q) ||
        a.estimateId?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (zoneFilter && a.propertyZone !== zoneFilter) return false;
    if (serviceTypeFilter && a.serviceType !== serviceTypeFilter) return false;
    return true;
  });

  // Group service assignments by property for card-based display
  const groupedByProperty = filteredServiceAssignments.reduce((acc, assignment) => {
    const key = assignment.propertyId;
    if (!acc[key]) {
      acc[key] = {
        propertyId: assignment.propertyId,
        propertyName: assignment.propertyName,
        propertyZone: assignment.propertyZone,
        assignments: []
      };
    }
    acc[key].assignments.push(assignment);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Toast */}
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
          <h1 className="text-2xl font-semibold text-gray-900">Assigned Vendors</h1>
          <p className="text-gray-500 text-sm mt-1">
            {serviceAssignments.length + assignments.length} total assignments • Manage vendors assigned to properties and services
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vendor name, ID, property, or service type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none"
            >
              <option value="">All Zones</option>
              {allZones.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none"
            >
              <option value="">All Services</option>
              {allServiceTypes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none"
            >
              <option value="active">Active Assignments</option>
              <option value="removed">Removed Assignments</option>
              <option value="all">All Assignments</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          {(searchTerm || zoneFilter || serviceTypeFilter || statusFilter !== 'active') && (
            <button
              onClick={() => { setSearchTerm(''); setZoneFilter(''); setServiceTypeFilter(''); setStatusFilter('active'); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Vendor Assignments Table - Same style as Vendor Details */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredServiceAssignments.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No service vendor assignments found</p>
            <p className="text-gray-400 text-sm mt-1">
              {serviceAssignments.length === 0
                ? 'Assign vendors to services from Property Management → Assign Vendors.'
                : 'Try adjusting your search or filters.'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor ID</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Service Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Owner</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zone</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Area</th>
                    {!isFPManager && <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Rate/Visit</th>}
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Coverage/Day</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Assigned</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredServiceAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="text-sm font-mono text-blue-600">{assignment.vendorId || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {assignment.serviceType || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-gray-900">{assignment.vendorName || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{assignment.zone_name || assignment.propertyZone || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{assignment.area || '-'}</span>
                      </td>
                      {!isFPManager && <td className="py-4 px-4">
                        <span className="text-sm text-gray-900">₹{assignment.rate_per_visit || '0.00'}</span>
                      </td>}
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-900">{assignment.coverage_per_day || '0'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{assignment.propertyName || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          assignment.status === 'active' ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {assignment.status === 'active' ? 'Active' : 'Removed'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => setViewAssignment(assignment)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
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
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              Showing {filteredServiceAssignments.length} of {serviceAssignments.length} assignments
            </div>
          </>
        )}
      </div>

      {/* View Assignment Modal */}
      {viewAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewAssignment(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Assignment Details</h2>
              <button onClick={() => setViewAssignment(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Service & Location */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Service & Location</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Service Type</p>
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                      {viewAssignment.serviceType || viewAssignment.service_type || '-'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Zone</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.zone_name || viewAssignment.zone || viewAssignment.propertyZone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Area</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.area || viewAssignment.areaName || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Rate & Coverage */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Rate & Coverage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Rate Per Visit</p>
                    <p className="text-sm font-medium text-gray-900">₹{viewAssignment.rate_per_visit || viewAssignment.ratePerVisit || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Coverage Per Day</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.coverage_per_day || viewAssignment.coveragePerDay || 0}</p>
                  </div>
                </div>
              </div>

              {/* Owner Details */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Owner Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Name</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.vendor_name || viewAssignment.vendorName || viewAssignment.owner_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Mobile</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.vendor_phone || viewAssignment.vendorPhone || viewAssignment.owner_mobile || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.vendor_email || viewAssignment.vendorEmail || viewAssignment.owner_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Vendor ID</p>
                    <p className="text-sm font-mono text-gray-600">{viewAssignment.vendor_code || viewAssignment.vendorId || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Assigned Property */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assigned Property</h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">{viewAssignment.property_name || viewAssignment.propertyName || '-'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <p className="text-xs text-gray-400">Type</p>
                      <p className="text-sm text-gray-700">{viewAssignment.property_type || viewAssignment.propertyType || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">City</p>
                      <p className="text-sm text-gray-700">{viewAssignment.city || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment Info */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">Assigned Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(viewAssignment.assigned_at || viewAssignment.assignedDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    viewAssignment.is_active !== false && viewAssignment.status !== 'removed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {viewAssignment.is_active !== false && viewAssignment.status !== 'removed' ? 'Active' : 'Removed'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setRemoveConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Assignment?</h3>
              <p className="text-sm text-gray-500 mb-6">
                {removeConfirm.type === 'service' 
                  ? `Are you sure you want to remove ${removeConfirm.vendorName || 'this vendor'} from ${removeConfirm.serviceType} service?`
                  : `Are you sure you want to remove ${removeConfirm.vendorName} from ${removeConfirm.propertyName}?`
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRemoveConfirm(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeConfirm.type === 'service' 
                    ? handleRemoveServiceAssignment(removeConfirm) 
                    : handleRemoveAssignment(removeConfirm)
                  }
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal - Individual Vendor Modification */}
      {editModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModalData(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Modify Assignment</h2>
                  <p className="text-xs text-gray-500">Change vendor for this service</p>
                </div>
              </div>
              <button onClick={() => setEditModalData(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Property Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900">{editModalData.property_name || editModalData.propertyName}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">Service: <span className="font-medium">{editModalData.service_type || editModalData.serviceType || '-'}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Zone: {editModalData.zone_name || editModalData.propertyZone || '-'}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Type: {editModalData.property_type || editModalData.propertyType || '-'} | City: {editModalData.city || '-'}
                </div>
              </div>

              {/* Current Vendor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Current Vendor</label>
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Truck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{editModalData.vendor_name || editModalData.vendorName || 'Unassigned'}</p>
                    <p className="text-xs text-gray-500 font-mono">{editModalData.vendor_code || editModalData.vendorId || '-'}</p>
                  </div>
                  {(editModalData.vendor_phone || editModalData.vendorPhone) && (
                    <div className="text-right text-xs text-gray-500">
                      <p>{editModalData.vendor_phone || editModalData.vendorPhone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* New Vendor Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Select New Vendor</label>
                <div className="relative">
                  <select
                    id="newVendorSelect"
                    defaultValue=""
                    className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none pr-10"
                  >
                    <option value="">-- Select a Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id || v.vendorId} value={v.id || v.vendorId}>
                        {v.owner_name || v.ownerName || v.company_name} - {v.service_type || v.serviceType} ({v.zone_name || v.zone || '-'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Changes will automatically sync to Property Management
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditModalData(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const select = document.getElementById('newVendorSelect');
                  if (select.value) {
                    handleUpdateServiceVendor(editModalData, select.value);
                  } else {
                    showToast('Please select a vendor', 'error');
                  }
                }}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignedVendors;
