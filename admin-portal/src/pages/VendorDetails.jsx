import { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Eye, 
  Trash2, 
  Download, 
  X, 
  Bell, 
  CheckCircle, 
  Filter,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  Calendar,
  User,
  Users,
  FileCheck,
  RefreshCw
} from 'lucide-react';
import { 
  getVendors, 
  deleteVendor, 
  getVendorNotifications, 
  markAllVendorNotificationsRead 
} from '../utils/vendorStore';
import * as XLSX from 'xlsx';

const VendorDetails = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [viewVendor, setViewVendor] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    fetchVendors();
    setNotifications(getVendorNotifications());
  }, [statusFilter]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const data = await getVendors(statusFilter);
      setVendors(data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const success = await deleteVendor(deleteConfirm.id);
    if (success) {
      setVendors(prev => prev.filter(v => v.id !== deleteConfirm.id));
    }
    setDeleteConfirm(null);
  };

  const handleMarkAllRead = () => {
    markAllVendorNotificationsRead();
    setNotifications(getVendorNotifications());
  };

  const handleExportVendor = (vendor) => {
    const exportData = [{
      'Vendor ID': vendor.vendorId,
      'Service Type': vendor.serviceType,
      'Verified': vendor.serviceVerified ? 'Yes' : 'No',
      'Zone': vendor.zone,
      'Area': vendor.areaName,
      'Division': vendor.division,
      'Owner Name': vendor.ownerName,
      'Owner Mobile': `${vendor.ownerCountryCode} ${vendor.ownerMobile}`,
      'Owner Email': vendor.ownerEmail,
      'Owner Aadhar': vendor.ownerAadhar,
      'Manager Name': vendor.managerName || '-',
      'Manager Mobile': vendor.managerMobile ? `${vendor.managerCountryCode} ${vendor.managerMobile}` : '-',
      'Manager Email': vendor.managerEmail || '-',
      'POC Name': vendor.pocName || '-',
      'POC Mobile': vendor.pocMobile ? `${vendor.pocCountryCode} ${vendor.pocMobile}` : '-',
      'POC Email': vendor.pocEmail || '-',
      'Rate Per Visit': `₹${vendor.ratePerVisit}`,
      'Coverage Per Day': vendor.coveragePerDay,
      'Created': new Date(vendor.createdAt).toLocaleDateString()
    }];
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor');
    XLSX.writeFile(wb, `Vendor_${vendor.vendorId}.xlsx`);
  };

  const handleExportAll = () => {
    const exportData = filteredVendors.map(v => ({
      'Vendor ID': v.vendorId,
      'Service Type': v.serviceType,
      'Zone': v.zone,
      'Area': v.areaName,
      'Division': v.division,
      'Owner Name': v.ownerName,
      'Owner Mobile': `${v.ownerCountryCode} ${v.ownerMobile}`,
      'Owner Email': v.ownerEmail,
      'Rate Per Visit': v.ratePerVisit,
      'Coverage Per Day': v.coveragePerDay,
      'Created': new Date(v.createdAt).toLocaleDateString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    XLSX.writeFile(wb, `Vendors_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get unique service types and zones for filters
  const serviceTypes = [...new Set(vendors.map(v => v.serviceType).filter(Boolean))];
  const zones = [...new Set(vendors.map(v => v.zone).filter(Boolean))];

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    const matchesSearch = !searchTerm || 
      v.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.vendorId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.serviceType?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesService = !serviceFilter || v.serviceType === serviceFilter;
    const matchesZone = !zoneFilter || v.zone === zoneFilter;
    return matchesSearch && matchesService && matchesZone;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Vendor Details</h1>
          <p className="text-gray-500 text-sm mt-1">Manage registered service vendors</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchVendors}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-medium text-gray-900">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-amber-600 hover:text-amber-700">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">No notifications</p>
                  ) : (
                    notifications.slice(0, 5).map(n => (
                      <div key={n.id} className={`p-3 border-b border-gray-50 ${!n.read ? 'bg-amber-50' : ''}`}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {filteredVendors.length > 0 && (
            <button
              onClick={handleExportAll}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export All
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, or service..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="">All Services</option>
            {serviceTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:outline-none"
          >
            <option value="">All Zones</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-500 focus:outline-none ${
              statusFilter === 'deleted' ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300'
            }`}
          >
            <option value="active">Active Vendors</option>
            <option value="deleted">Deleted Vendors</option>
            <option value="all">All Vendors</option>
          </select>
          {(searchTerm || serviceFilter || zoneFilter || statusFilter !== 'active') && (
            <button
              onClick={() => { setSearchTerm(''); setServiceFilter(''); setZoneFilter(''); setStatusFilter('active'); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Vendors Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredVendors.length === 0 ? (
          <div className="py-16 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vendors found</p>
            <p className="text-gray-400 text-sm mt-1">
              {vendors.length === 0 ? 'Add vendors using the Add Vendor page.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Vendor ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Service Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Zone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Area</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Division</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rate/Visit</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Coverage/Day</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{vendor.vendorId}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {vendor.serviceType}
                        {vendor.serviceVerified && <FileCheck className="w-3 h-3 text-emerald-500" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{vendor.ownerName}</td>
                    <td className="px-4 py-3 text-gray-700">{vendor.zone || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{vendor.areaName || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{vendor.division || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">₹{vendor.ratePerVisit}</td>
                    <td className="px-4 py-3 text-gray-700 text-center">{vendor.coveragePerDay}</td>
                    <td className="px-4 py-3 text-gray-700">{vendor.createdBy || 'Manager'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(vendor.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        vendor.status === 'deleted' 
                          ? 'bg-red-100 text-red-700' 
                          : vendor.status === 'inactive'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {vendor.status === 'deleted' ? 'Deleted' : vendor.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewVendor(vendor)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportVendor(vendor)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Export"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(vendor)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredVendors.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Showing {filteredVendors.length} of {vendors.length} vendors
          </div>
        )}
      </div>

      {/* View Vendor Modal */}
      {viewVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewVendor(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{viewVendor.ownerName}</h2>
                <p className="text-xs font-mono text-gray-500">{viewVendor.vendorId}</p>
              </div>
              <button onClick={() => setViewVendor(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Service Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  Service Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Service Type</label>
                    <p className="text-sm font-medium text-gray-900">{viewVendor.serviceType}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Verification Status</label>
                    <p className="text-sm font-medium text-gray-900">
                      {viewVendor.serviceVerified ? (
                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Verified</span>
                      ) : 'Not Verified'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Location & Division
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Zone</label>
                    <p className="text-sm text-gray-900">{viewVendor.zone || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Area</label>
                    <p className="text-sm text-gray-900">{viewVendor.areaName || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Division</label>
                    <p className="text-sm text-gray-900">{viewVendor.division || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Owner Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-600" />
                  Owner Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Full Name</label>
                    <p className="text-sm text-gray-900">{viewVendor.ownerName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Mobile</label>
                    <p className="text-sm text-gray-900">{viewVendor.ownerCountryCode} {viewVendor.ownerMobile}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="text-sm text-gray-900">{viewVendor.ownerEmail}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Aadhar</label>
                    <p className="text-sm text-gray-900 font-mono">{viewVendor.ownerAadhar}</p>
                  </div>
                </div>
              </div>

              {/* Manager Contact */}
              {viewVendor.managerName && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    Manager Contact
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <p className="text-sm text-gray-900">{viewVendor.managerName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Mobile</label>
                      <p className="text-sm text-gray-900">{viewVendor.managerCountryCode} {viewVendor.managerMobile || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Email</label>
                      <p className="text-sm text-gray-900">{viewVendor.managerEmail || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Point of Contact */}
              {viewVendor.pocName && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-rose-600" />
                    Point of Contact
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Name</label>
                      <p className="text-sm text-gray-900">{viewVendor.pocName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Mobile</label>
                      <p className="text-sm text-gray-900">{viewVendor.pocCountryCode} {viewVendor.pocMobile || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Email</label>
                      <p className="text-sm text-gray-900">{viewVendor.pocEmail || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate & Coverage */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-indigo-600" />
                  Rate & Coverage
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <label className="text-xs text-indigo-600 font-medium">Rate Per Visit</label>
                    <p className="text-2xl font-bold text-indigo-700">₹{viewVendor.ratePerVisit}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <label className="text-xs text-emerald-600 font-medium">Coverage Per Day</label>
                    <p className="text-2xl font-bold text-emerald-700">{viewVendor.coveragePerDay} visits</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => { setDeleteConfirm(viewVendor); setViewVendor(null); }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportVendor(viewVendor)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
                <button
                  onClick={() => setViewVendor(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Delete Vendor?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              This will permanently remove <strong>{deleteConfirm.ownerName}</strong> ({deleteConfirm.vendorId}).
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDetails;
