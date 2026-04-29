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
} from 'lucide-react';
import {
  getVendorAssignments,
  removeVendorAssignment,
} from '../utils/assignmentStore';
import { getVendors } from '../utils/vendorStore';

const AssignedVendors = () => {
  const [assignments, setAssignments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [toast, setToast] = useState(null);
  const [viewAssignment, setViewAssignment] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setAssignments(getVendorAssignments(statusFilter));
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

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get unique zones from assignments
  const zones = [...new Set(assignments.map(a => a.propertyZone).filter(Boolean))];

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
            {assignments.length} vendor assignments • View vendors assigned to properties
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Truck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-medium text-amber-800">Vendor Assignments</h3>
            <p className="text-sm text-amber-700 mt-1">
              This page shows all vendors that have been assigned to properties through the Property Management module. 
              To assign a new vendor, go to Property Management, select a property, and use the "Assign Vendor" option.
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
              {zones.map(z => (
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

      {/* Assignments Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredAssignments.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vendor assignments found</p>
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
                            onClick={() => setRemoveConfirm(assignment)}
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
            Showing {filteredAssignments.length} of {assignments.length} assignments
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
                Are you sure you want to remove {removeConfirm.vendorName} from {removeConfirm.propertyName}?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRemoveConfirm(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemoveAssignment(removeConfirm)}
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
