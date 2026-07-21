import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '../utils/safeStorage';
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
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const AssignedVendors = ({ user }) => {
  // Check user role for view-only mode and API prefix
  const isAdmin = user?.role === 'admin' || user?.role === 'operations_manager';
  const isOpsManager = user?.role === 'operations_manager';
  const isCoordinator = user?.role === 'coordinator' || user?.role === 'coord_supervisor' || user?.role === 'coord_executive';
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'coord_supervisor';
  const isExecutive = user?.role === 'executive' || user?.role === 'coord_executive';
  const isFPManager = user?.role === 'manager';
  const isFPUser = user?.role === 'franchise_partner' || user?.role === 'manager' || user?.role === 'fp_coordinator';
  
  // Determine API prefix based on role
  const getApiPrefix = () => {
    if (isCoordinator) return '/api/coordinator';
    if (isSupervisor) return '/api/supervisor';
    if (isExecutive) return '/api/executive';
    if (isFPManager) return '/api/manager';
    if (isFPUser) return '/api/fp';
    return '/api';
  };
  const apiPrefix = getApiPrefix();
  
  // Coordinators, Supervisors, Executives, FP Managers, and Ops Manager are view-only
  const isViewOnly = isCoordinator || isSupervisor || isExecutive || isFPManager || isOpsManager;
  
  // Get selected FP from context (for admin users)
  const { selectedFp, fpList, selectFp } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
  };
  
  const [activeTab, setActiveTab] = useState('service'); // 'service' or 'property'
  const [assignments, setAssignments] = useState([]);
  const [serviceAssignments, setServiceAssignments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewAssignment, setViewAssignment] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [editAssignment, setEditAssignment] = useState(null);
  const [editModalData, setEditModalData] = useState(null);

  const token = getAuthToken();

  const loadData = useCallback(async () => {
    // For admin users, use FP-specific or all-FPs endpoint
    if (isAdmin) {
      if (!selectedFp) {
        setAssignments([]);
        setVendors([]);
        return;
      }
      
      try {
        let assignUrl, vendorUrl;
        
        // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
        if (selectedFp.id === 'all') {
          assignUrl = `${API_BASE}/api/admin/all-vendor-assignments`;
          vendorUrl = `${API_BASE}/api/admin/all-vendors`;
        } else {
          assignUrl = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/vendor-assignments`;
          vendorUrl = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/vendors`;
        }
        
        const [assignResponse, vendorResponse] = await Promise.all([
          fetch(assignUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(vendorUrl, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        const assignResult = await assignResponse.json();
        const vendorResult = await vendorResponse.json();
        
        if (assignResult.success) {
          const data = assignResult.data || [];
          // Set both assignments and serviceAssignments for admin view
          setAssignments(data);
          setServiceAssignments(data);
        }
        if (vendorResult.success) {
          setVendors(vendorResult.data || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
      return;
    }
    
    try {
      // Load vendor assignments from API (for non-admin users)
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
  }, [isAdmin, selectedFp, apiPrefix, statusFilter, token]);

  const { loading: fpLoading } = useFP();

  // Auto-select "Admin (All FPs)" if no FP is selected (for admin users)
  useEffect(() => {
    if (isAdmin && !selectedFp && !fpLoading) {
      selectFp({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' });
    }
  }, [isAdmin, selectedFp, fpLoading, selectFp]);

  useEffect(() => {
    if (isAdmin && selectedFp) {
      loadData();
    } else if (!isAdmin) {
      loadData();
    }
  }, [loadData, isAdmin, selectedFp]);

  // Refresh data when page becomes visible (handles navigation back to this page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

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
    ...assignments.map(a => a.propertyZone || a.property_zone || a.zone_name),
    ...serviceAssignments.map(a => a.propertyZone || a.property_zone || a.zone_name)
  ].filter(Boolean))];

  const allServiceTypes = [...new Set(serviceAssignments.map(a => a.serviceType || a.service_type).filter(Boolean))];

  // Get unique properties from all assignments
  const allProperties = [...new Set([
    ...assignments.map(a => a.propertyId || a.property_id),
    ...serviceAssignments.map(a => a.propertyId || a.property_id)
  ].filter(Boolean))].map(propId => {
    const assignment = [...assignments, ...serviceAssignments].find(a => (a.propertyId || a.property_id) === propId);
    return {
      id: propId,
      name: assignment?.propertyName || assignment?.property_name || propId
    };
  });

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
        (a.property_code || a.propertyCode || '').toLowerCase().includes(q) ||
        a.serviceType?.toLowerCase().includes(q) ||
        a.estimateId?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (zoneFilter && a.propertyZone !== zoneFilter && a.property_zone !== zoneFilter) return false;
    if (serviceTypeFilter && a.serviceType !== serviceTypeFilter && a.service_type !== serviceTypeFilter) return false;
    if (propertyFilter && !(a.property_code || a.propertyCode || '').toLowerCase().includes(propertyFilter.toLowerCase())) return false;
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

  // Show FP selection if admin and no FP selected
  if (isAdmin && !selectedFp) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assigned Vendors</h1>
          <p className="text-gray-500 mt-1">Select a Franchise Partner to view vendor assignments</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select Franchise Partner</h2>
          <p className="text-gray-500 mb-6">Choose an FP from the list to view vendor assignments</p>
          <div className="flex flex-wrap justify-center gap-3">
            {fpList.map(fp => (
              <button
                key={fp.id}
                onClick={() => handleFpSelect(fp)}
                className="px-6 py-3 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors"
              >
                {fp.fpId} - {fp.companyName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

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

      {/* Header with FP Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assigned Vendors</h1>
          <p className="text-gray-500 text-sm mt-1">
            {serviceAssignments.length} assignments
            {isAdmin && selectedFp ? (selectedFp.id === 'all' ? ' (All FPs)' : ` for ${selectedFp.companyName}`) : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* FP Switcher (Admin only) */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
                <span className="font-medium text-gray-700">
                  {selectedFp?.id === 'all' ? 'Admin (All FPs)' : selectedFp?.fpId || 'Select FP'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {fpDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' })}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-gray-100 ${
                      selectedFp?.id === 'all' ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="font-medium flex items-center gap-2 text-slate-700">
                      <Package className="w-4 h-4" />
                      Admin (All FPs)
                    </div>
                  </button>
                  {fpList.map(fp => (
                    <button
                      key={fp.id}
                      onClick={() => handleFpSelect(fp)}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                        selectedFp?.id === fp.id ? 'bg-slate-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">{fp.fpId}</span>
                        <span className="text-xs text-gray-500">{fp.ownerName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
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
              onChange={(e) => setSearchTerm(e.target.value.trim())}
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
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-500 outline-none"
            >
              <option value="">All Properties</option>
              {allProperties.map(p => (
                <option key={p.code} value={p.code}>{p.code}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          {(searchTerm || zoneFilter || serviceTypeFilter || propertyFilter) && (
            <button
              onClick={() => { setSearchTerm(''); setZoneFilter(''); setServiceTypeFilter(''); setPropertyFilter(''); }}
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
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Rate</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Coverage/Day</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property Code</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Assigned</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredServiceAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="text-sm font-mono text-blue-600">{assignment.vendor_code || assignment.vendor_id || assignment.vendorId || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {assignment.service_type || assignment.serviceType || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-gray-900">{assignment.vendor_name || assignment.vendorName || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{assignment.zone_name || assignment.property_zone || assignment.vendor_zone || assignment.propertyZone || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{assignment.area || assignment.area_name || '-'}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-gray-900">₹{assignment.rate_per_visit || assignment.rate || '0'}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-gray-900">{assignment.coverage_per_day || assignment.coverage || '0'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-mono text-blue-600">{assignment.property_code || assignment.propertyCode || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">
                          {(assignment.assigned_date || assignment.assignedDate || assignment.created_at) ? new Date(assignment.assigned_date || assignment.assignedDate || assignment.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          (assignment.is_active === true || assignment.is_active === 1 || assignment.vendor_status === 'active' || assignment.status === 'active') ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-100'
                        }`}>
                          {(assignment.is_active === true || assignment.is_active === 1 || assignment.vendor_status === 'active' || assignment.status === 'active') ? 'Active' : 'Removed'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewAssignment(assignment)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!isViewOnly && (
                            <button
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
                                  handleRemoveServiceAssignment(assignment);
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Assignment"
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
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              Showing {filteredServiceAssignments.length} of {serviceAssignments.length} assignments
            </div>
          </>
        )}
      </div>

      {/* View Assignment Modal */}
      {viewAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewAssignment(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-gray-50 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{viewAssignment.vendorName || viewAssignment.vendor_name || 'Vendor Details'}</h2>
                <p className="text-sm text-gray-500 font-mono">{viewAssignment.vendorId || viewAssignment.vendor_code}</p>
              </div>
              <button onClick={() => setViewAssignment(null)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Service & Location */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Service Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Service Type</p>
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                      {viewAssignment.serviceType || viewAssignment.service_type || '-'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Verified</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.service_verified ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h3>
                <div className="grid grid-cols-2 gap-4">
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

              {/* Vendor Details */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vendor Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Name</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.vendorName || viewAssignment.vendor_name || viewAssignment.owner_name || '-'}</p>
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
                    <p className="text-xs text-gray-400">Aadhar</p>
                    <p className="text-sm font-medium text-gray-900">{viewAssignment.owner_aadhar || '-'}</p>
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

              {/* Manager Details */}
              {(viewAssignment.manager_name || viewAssignment.manager_mobile) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Manager / Primary Contact</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Name</p>
                      <p className="text-sm font-medium text-gray-900">{viewAssignment.manager_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Mobile</p>
                      <p className="text-sm font-medium text-gray-900">{viewAssignment.manager_mobile || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-900">{viewAssignment.manager_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* POC Details */}
              {(viewAssignment.poc_name || viewAssignment.poc_mobile) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Point of Contact</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Name</p>
                      <p className="text-sm font-medium text-gray-900">{viewAssignment.poc_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Mobile</p>
                      <p className="text-sm font-medium text-gray-900">{viewAssignment.poc_mobile || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Email</p>
                      <p className="text-sm font-medium text-gray-900">{viewAssignment.poc_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Assigned Property */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assigned Property</h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900">{viewAssignment.property_name || viewAssignment.propertyName || '-'}</span>
                    </div>
                    <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">{viewAssignment.property_id || viewAssignment.propertyId || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <p className="text-xs text-gray-400">Property ID</p>
                      <p className="text-sm font-mono text-gray-700">{viewAssignment.property_id || viewAssignment.propertyId || '-'}</p>
                    </div>
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
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
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
                <div>
                  <p className="text-xs text-gray-400">Vendor ID</p>
                  <p className="text-sm font-mono text-gray-600">{viewAssignment.vendorId || viewAssignment.vendor_code || '-'}</p>
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
