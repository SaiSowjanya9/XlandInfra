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
} from 'lucide-react';
import {
  getVendorAssignments,
  removeVendorAssignment,
  getServiceVendorAssignments,
  removeServiceVendorAssignment,
  updateServiceVendorAssignment,
} from '../utils/assignmentStore';
import { getVendors } from '../utils/vendorStore';

const AssignedVendors = () => {
  const [activeTab, setActiveTab] = useState('service'); // 'service' or 'property'
  const [assignments, setAssignments] = useState([]);
  const [serviceAssignments, setServiceAssignments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewAssignment, setViewAssignment] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [editAssignment, setEditAssignment] = useState(null);

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
    const result = removeServiceVendorAssignment(assignment.id);
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

    // Update just this single assignment
    const result = updateServiceVendorAssignment(assignment.id, {
      vendorId: vendor.vendorId,
      vendorName: vendor.ownerName,
      vendorZone: vendor.zone,
      vendorServiceType: vendor.serviceType
    });

    if (result.success) {
      showToast('Vendor updated successfully');
      setEditAssignment(null);
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

  // Get unique zones from all assignments
  const allZones = [
    ...new Set([
      ...assignments.map(a => a.propertyZone),
      ...serviceAssignments.map(a => a.propertyZone)
    ].filter(Boolean))
  ];

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

    return true;
  });

  // Group service assignments by property and estimate for better display
  const groupedServiceAssignments = filteredServiceAssignments.reduce((acc, assignment) => {
    const key = `${assignment.propertyId}-${assignment.estimateId}`;
    if (!acc[key]) {
      acc[key] = {
        propertyId: assignment.propertyId,
        propertyName: assignment.propertyName,
        propertyZone: assignment.propertyZone,
        estimateId: assignment.estimateId,
        services: []
      };
    }
    acc[key].services.push(assignment);
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('service')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'service'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4" />
          Service Assignments
          {serviceAssignments.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'service' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {serviceAssignments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('property')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'property'
              ? 'bg-white text-amber-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Property Assignments
          {assignments.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === 'property' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {assignments.length}
            </span>
          )}
        </button>
      </div>

      {/* Info Card - Contextual based on active tab */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            {activeTab === 'service' ? <Package className="w-5 h-5 text-amber-600" /> : <Truck className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <h3 className="font-medium text-amber-800">
              {activeTab === 'service' ? 'Service-wise Vendor Assignments' : 'Property Vendor Assignments'}
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              {activeTab === 'service' 
                ? 'These are vendors assigned to specific AMC services for properties. You can modify vendor assignments here or from Property Management → Assign Vendors.'
                : 'These are general vendor assignments to properties. To assign vendors to specific services, go to Property Management and use the "Assign Vendors" option.'
              }
            </p>
          </div>
        </div>
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
          {(searchTerm || zoneFilter || statusFilter !== 'active') && (
            <button
              onClick={() => { setSearchTerm(''); setZoneFilter(''); setStatusFilter('active'); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Service Assignments Tab Content */}
      {activeTab === 'service' && (
        <div className="space-y-4">
          {Object.keys(groupedServiceAssignments).length === 0 ? (
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
            Object.values(groupedServiceAssignments).map((group) => (
              <div key={`${group.propertyId}-${group.estimateId}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Property Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.propertyName || 'Property'}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span className="font-mono">{group.propertyId}</span>
                          <span>•</span>
                          <span>Zone: {group.propertyZone || '-'}</span>
                          <span>•</span>
                          <span className="text-amber-600 font-medium">Estimate: {group.estimateId}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                      {group.services.length} service(s)
                    </span>
                  </div>
                </div>

                {/* Services Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase">Service Type</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600 text-xs uppercase w-20">Freq.</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600 text-xs uppercase w-24">Type</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-600 text-xs uppercase">Assigned Vendor</th>
                        <th className="px-4 py-2.5 text-center font-medium text-gray-600 text-xs uppercase w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.services.map((service) => (
                        <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{service.serviceType}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                              {service.frequencyCount || 1}x
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600 text-xs">
                            {service.frequencyType || 'Monthly'}
                          </td>
                          <td className="px-4 py-3">
                            {editAssignment?.id === service.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  defaultValue={service.vendorId}
                                  onChange={(e) => handleUpdateServiceVendor(service, e.target.value)}
                                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500"
                                >
                                  <option value="">-- Select Vendor --</option>
                                  {getMatchingVendors(service.serviceType).map(v => (
                                    <option key={v.vendorId} value={v.vendorId}>{v.ownerName}</option>
                                  ))}
                                  {vendors.filter(v => !getMatchingVendors(service.serviceType).find(mv => mv.vendorId === v.vendorId)).length > 0 && (
                                    <optgroup label="Other Vendors">
                                      {vendors.filter(v => !getMatchingVendors(service.serviceType).find(mv => mv.vendorId === v.vendorId)).map(v => (
                                        <option key={v.vendorId} value={v.vendorId}>{v.ownerName} ({v.serviceType})</option>
                                      ))}
                                    </optgroup>
                                  )}
                                </select>
                                <button
                                  onClick={() => setEditAssignment(null)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                                </div>
                                <div>
                                  <span className="font-medium text-gray-900">{service.vendorName || '-'}</span>
                                  {service.vendorId && (
                                    <span className="text-xs text-gray-400 ml-2 font-mono">{service.vendorId}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {service.status === 'active' && editAssignment?.id !== service.id && (
                                <>
                                  <button
                                    onClick={() => setEditAssignment(service)}
                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                    title="Change vendor"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setRemoveConfirm({ ...service, type: 'service' })}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Remove assignment"
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
                </div>
              </div>
            ))
          )}

          {filteredServiceAssignments.length > 0 && (
            <div className="text-xs text-gray-500 text-center">
              Showing {filteredServiceAssignments.length} service assignments across {Object.keys(groupedServiceAssignments).length} properties
            </div>
          )}
        </div>
      )}

      {/* Property Assignments Tab Content */}
      {activeTab === 'property' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredAssignments.length === 0 ? (
            <div className="py-16 text-center">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No property vendor assignments found</p>
              <p className="text-gray-400 text-sm mt-1">
                {assignments.length === 0
                  ? 'Assign vendors to properties from Property Management.'
                  : 'Try adjusting your search or filters.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Vendor</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Vendor ID</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Phone</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Service Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Assigned Property</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Zone</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Assigned Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
                            <Truck className="w-4 h-4 text-amber-600" />
                          </div>
                          <span className="font-medium text-gray-900">{assignment.vendorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {assignment.vendorId}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {assignment.vendorPhone || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {assignment.vendorEmail || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {assignment.serviceType || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{assignment.propertyName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {assignment.propertyZone || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(assignment.assignedDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          assignment.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {assignment.status === 'active' ? 'Active' : 'Removed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewAssignment(assignment)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {assignment.status === 'active' && (
                            <button
                              onClick={() => setRemoveConfirm({ ...assignment, type: 'property' })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Remove assignment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAssignments.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              Showing {filteredAssignments.length} of {assignments.length} property assignments
            </div>
          )}
        </div>
      )}

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
    </div>
  );
};

export default AssignedVendors;
