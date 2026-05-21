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
import {
  getVendorAssignments,
  removeVendorAssignment,
  getServiceVendorAssignments,
  removeServiceVendorAssignmentWithSync,
  updateServiceVendorAssignmentWithSync,
  subscribeToAssignmentChanges,
  getAssignmentsGroupedByProperty,
  getUniqueServiceTypes,
  getUniqueZones,
} from '../utils/assignmentStore';
import { getVendors } from '../utils/vendorStore';

const AssignedVendors = ({ user }) => {
  // Check if user is FP Manager (view-only mode)
  const isFPManager = user?.role === 'manager';
  
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

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Subscribe to real-time assignment changes from Property Management
  useEffect(() => {
    const unsubscribe = subscribeToAssignmentChanges((change) => {
      console.log('[AssignedVendors] Received sync event:', change);
      loadData(); // Reload data when changes are made from Property Management
    });
    
    return unsubscribe;
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
    // Load property-level assignments
    const propertyAssignments = getVendorAssignments(statusFilter);
    setAssignments(propertyAssignments);
    
    // Load service-wise vendor assignments (from estimates)
    const serviceAssignmentsData = getServiceVendorAssignments(statusFilter);
    setServiceAssignments(serviceAssignmentsData);
    
    // Debug logging
    console.log('[AssignedVendors] Loaded data:', {
      propertyAssignments: propertyAssignments.length,
      serviceAssignments: serviceAssignmentsData.length,
      statusFilter
    });
    
    try {
      const vendorList = await getVendors('active');
      setVendors(vendorList);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRemoveAssignment = (assignment) => {
    const result = removeVendorAssignment(assignment.id);
    if (result.success) {
      showToast('Vendor assignment removed successfully');
      setRemoveConfirm(null);
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleRemoveServiceAssignment = (assignment) => {
    const result = removeServiceVendorAssignmentWithSync(assignment.id);
    if (result.success) {
      showToast('Service vendor assignment removed successfully');
      setRemoveConfirm(null);
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleUpdateServiceVendor = (assignment, newVendorId) => {
    const vendor = vendors.find(v => v.vendorId === newVendorId);
    if (!vendor) {
      showToast('Vendor not found', 'error');
      return;
    }

    // Update just this single assignment with sync
    const result = updateServiceVendorAssignmentWithSync(assignment.id, {
      vendorId: vendor.vendorId,
      vendorName: vendor.ownerName,
      vendorZone: vendor.zone,
      vendorServiceType: vendor.serviceType
    });

    if (result.success) {
      showToast('Vendor updated successfully - changes synced to Property Management');
      setEditAssignment(null);
      setEditModalData(null);
      loadData();
    } else {
      showToast(result.message || 'Failed to update', 'error');
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

      {/* Vendor Assignments - Zone Management Style Card Grid */}
      <div className="space-y-6">
          {Object.keys(groupedByProperty).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(groupedByProperty).map((group) => (
                <div
                  key={group.propertyId}
                  className="bg-white rounded-xl border border-gray-200 p-5 transition-all hover:shadow-md hover:border-amber-200"
                >
                  {/* Property Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 line-clamp-1">{group.propertyName || 'Property'}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{group.propertyZone || 'No Zone'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      Active
                    </span>
                  </div>

                  {/* Property Stats */}
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center justify-between">
                      <span>Services:</span>
                      <span className="font-medium text-amber-600">{group.assignments.length} assigned</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Property ID:</span>
                      <span className="font-mono text-xs text-gray-500">{group.propertyId}</span>
                    </div>
                  </div>

                  {/* Vendor Assignments List */}
                  <div className="border-t border-gray-100 pt-3 mb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Assigned Vendors</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {group.assignments.map((assignment) => (
                        <div 
                          key={assignment.id} 
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group hover:bg-amber-50 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Truck className="w-3 h-3 text-amber-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 truncate">{assignment.vendorName || 'Unassigned'}</p>
                              <p className="text-xs text-gray-500 truncate">{assignment.serviceType}</p>
                            </div>
                          </div>
                          {/* Edit/Remove buttons - Hidden for FP Manager */}
                          {!isFPManager && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditModalData(assignment)}
                                className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded transition-colors"
                                title="Edit assignment"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setRemoveConfirm({ ...assignment, type: 'service' })}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Remove assignment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Actions - Modify hidden for FP Manager */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setViewAssignment(group.assignments[0])}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                    {!isFPManager && (
                      <button
                        onClick={() => setEditModalData(group.assignments[0])}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                        Modify
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredServiceAssignments.length > 0 && (
            <div className="text-xs text-gray-500 text-center">
              Showing {filteredServiceAssignments.length} service assignments across {Object.keys(groupedByProperty).length} properties
            </div>
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
            <div className="p-6 space-y-4">
              {/* Vendor Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Vendor Information</h3>
                <div className="bg-amber-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <Truck className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{viewAssignment.vendorName}</p>
                      <p className="text-xs font-mono text-gray-500">{viewAssignment.vendorId}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{viewAssignment.vendorPhone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 truncate">{viewAssignment.vendorEmail || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Service:</span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                      {viewAssignment.serviceType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Property Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned Property</h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">{viewAssignment.propertyName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>Zone: {viewAssignment.propertyZone || '-'}</span>
                  </div>
                  <p className="text-xs font-mono text-gray-500">{viewAssignment.propertyId}</p>
                </div>
              </div>

              {/* Assignment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Assigned Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(viewAssignment.assignedDate)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    viewAssignment.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {viewAssignment.status === 'active' ? 'Active' : 'Removed'}
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
              {/* Assignment Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{editModalData.propertyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Service: <span className="font-medium">{editModalData.serviceType}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Zone: {editModalData.propertyZone || '-'}</span>
                </div>
              </div>

              {/* Current Vendor */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Current Vendor</label>
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <Truck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{editModalData.vendorName || 'Unassigned'}</p>
                    <p className="text-xs text-gray-500 font-mono">{editModalData.vendorId || '-'}</p>
                  </div>
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
                    <optgroup label="Matching Service Type">
                      {getMatchingVendors(editModalData.serviceType).map(v => (
                        <option key={v.vendorId} value={v.vendorId}>
                          {v.ownerName} ({v.zone})
                        </option>
                      ))}
                    </optgroup>
                    {vendors.filter(v => !getMatchingVendors(editModalData.serviceType).find(mv => mv.vendorId === v.vendorId)).length > 0 && (
                      <optgroup label="Other Vendors">
                        {vendors.filter(v => !getMatchingVendors(editModalData.serviceType).find(mv => mv.vendorId === v.vendorId)).map(v => (
                          <option key={v.vendorId} value={v.vendorId}>
                            {v.ownerName} - {v.serviceType} ({v.zone})
                          </option>
                        ))}
                      </optgroup>
                    )}
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
