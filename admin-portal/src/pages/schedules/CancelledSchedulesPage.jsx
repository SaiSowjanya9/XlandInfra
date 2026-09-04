import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, ChevronLeft, ChevronRight, Eye, RefreshCw, 
  XCircle, RotateCcw, X, Calendar, Clock, User, Building2, Download
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Role-based permissions for scheduling
const getSchedulePermissions = (portalType) => {
  const permissions = {
    admin: { canView: true, canRestore: true, canExport: true, fullAccess: true },
    operations_manager: { canView: true, canRestore: true, canExport: true, fullAccess: false },
    franchise: { canView: true, canRestore: true, canExport: true, fullAccess: false },
    manager: { canView: true, canRestore: true, canExport: true, fullAccess: false },
    coordinator: { canView: true, canRestore: false, canExport: false, fullAccess: false },
    supervisor: { canView: true, canRestore: false, canExport: false, fullAccess: false },
    executive: { canView: true, canRestore: false, canExport: false, fullAccess: false }
  };
  return permissions[portalType] || permissions.executive;
};

// Get API path based on portal type
const getApiPath = (portalType) => {
  const pathMap = {
    'admin': 'admin',
    'franchise': 'fp',
    'manager': 'manager',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor'
  };
  return pathMap[portalType] || 'admin';
};

const CancelledSchedulesPage = ({ portalType = 'admin', user }) => {
  const navigate = useNavigate();
  const permissions = getSchedulePermissions(portalType);
  const apiPath = getApiPath(portalType);
  const [loading, setLoading] = useState(true);
  const [cancelledSchedules, setCancelledSchedules] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    service: 'all',
    cancelledBy: 'all',
    dateRange: 'all',
    zone: 'all'
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchZones();
    fetchCancelledSchedules();
  }, []);

  useEffect(() => {
    fetchCancelledSchedules();
  }, [filters.cancelledBy, filters.service, filters.dateRange, filters.zone]);

  // Fetch zones from API
  const fetchZones = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/${apiPath}/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Handle different response formats
        const zoneList = data.zones || data.data || [];
        const zoneNames = zoneList.map(z => typeof z === 'string' ? z : (z.name || z.zone_name || z.zone)).filter(Boolean);
        setZones([...new Set(zoneNames)].sort());
      }
    } catch (error) {
      console.error('Error fetching zones:', error);
      // Fallback to zones from data
      const uniqueZones = [...new Set(cancelledSchedules.map(s => s.zone).filter(Boolean))];
      setZones(uniqueZones);
    }
  };

  const fetchCancelledSchedules = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams();
      if (filters.cancelledBy !== 'all') queryParams.append('cancelledBy', filters.cancelledBy);
      if (filters.service !== 'all') queryParams.append('service', filters.service);
      if (filters.dateRange !== 'all') queryParams.append('dateRange', filters.dateRange);
      
      const response = await fetch(`${API_BASE}/api/schedules/cancelled?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCancelledSchedules(data.data?.length > 0 ? data.data : getMockData());
      } else {
        setCancelledSchedules(getMockData());
      }
    } catch (error) {
      console.error('Error fetching cancelled schedules:', error);
      setCancelledSchedules(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const getMockData = () => [
    { id: 1, property_id: 'PROP-001', property_name: 'Green Valley Apartments', service: 'HVAC Maintenance', vendor: 'ABC HVAC Services', zone: 'Zone A', scheduled_date: '2026-07-15', scheduled_time: '10:00 AM', cancelled_at: '2026-07-12T14:30:00', cancelled_by: 'John Manager', cancelled_by_role: 'Manager', reason: 'Customer requested to postpone due to personal reasons' },
    { id: 2, property_id: 'PROP-002', property_name: 'Sunrise Towers', service: 'Plumbing Check', vendor: 'Aqua Plumbing', zone: 'Zone B', scheduled_date: '2026-07-18', scheduled_time: '02:00 PM', cancelled_at: '2026-07-15T09:00:00', cancelled_by: 'Vendor', cancelled_by_role: 'Vendor', reason: 'Vendor unavailable - staff shortage' },
    { id: 3, property_id: 'PROP-003', property_name: 'Palm Heights', service: 'Electrical Inspection', vendor: 'PowerFix Electricals', zone: 'Zone A', scheduled_date: '2026-07-20', scheduled_time: '09:00 AM', cancelled_at: '2026-07-19T16:00:00', cancelled_by: 'FP User', cancelled_by_role: 'FP', reason: 'Payment pending - auto-cancelled after 7 days' },
    { id: 4, property_id: 'PROP-004', property_name: 'Blue Sky Complex', service: 'Lift Maintenance', vendor: 'Elevate Engineers', zone: 'Zone C', scheduled_date: '2026-08-01', scheduled_time: '11:00 AM', cancelled_at: '2026-07-28T11:00:00', cancelled_by: 'Customer', cancelled_by_role: 'Customer', reason: 'Building under renovation' },
    { id: 5, property_id: 'PROP-005', property_name: 'Garden View Residency', service: 'Fire Safety Check', vendor: 'SafeGuard Services', zone: 'Zone D', scheduled_date: '2026-08-05', scheduled_time: '03:00 PM', cancelled_at: '2026-08-02T10:30:00', cancelled_by: 'Admin', cancelled_by_role: 'Admin', reason: 'Duplicate schedule entry - consolidated with another visit' }
  ];

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric' 
    });
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const getBasePath = () => {
    const pathMap = {
      'franchise': '/fp',
      'manager': '/manager',
      'admin': '/admin',
      'coordinator': '/coordinator',
      'supervisor': '/supervisor'
    };
    return pathMap[portalType] || '/admin';
  };

  const getCancelledByBadge = (role) => {
    const styles = {
      'Manager': 'bg-blue-100 text-blue-700',
      'Admin': 'bg-purple-100 text-purple-700',
      'Vendor': 'bg-orange-100 text-orange-700',
      'Customer': 'bg-green-100 text-green-700',
      'FP': 'bg-teal-100 text-teal-700'
    };
    return styles[role] || 'bg-gray-100 text-gray-600';
  };

  // Apply filters
  const filteredSchedules = cancelledSchedules.filter(schedule => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        schedule.property_name?.toLowerCase().includes(searchLower) ||
        schedule.property_id?.toLowerCase().includes(searchLower) ||
        schedule.service?.toLowerCase().includes(searchLower) ||
        schedule.vendor?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    if (filters.service !== 'all' && schedule.service !== filters.service) return false;
    if (filters.cancelledBy !== 'all' && schedule.cancelled_by_role !== filters.cancelledBy) return false;
    if (filters.zone !== 'all' && schedule.zone !== filters.zone) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredSchedules.length / itemsPerPage);
  const paginatedSchedules = filteredSchedules.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique values for filters
  const services = [...new Set(cancelledSchedules.map(s => s.service))];
  const cancelledByRoles = [...new Set(cancelledSchedules.map(s => s.cancelled_by_role))];

  const handleViewDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setShowDetailsModal(true);
  };

  const handleRestore = async () => {
    if (!selectedSchedule) return;
    setSubmitting(true);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/${selectedSchedule.id}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        alert('Schedule restored successfully! It has been moved to Pending Schedules.');
        setShowRestoreModal(false);
        setShowDetailsModal(false);
        fetchCancelledSchedules();
      } else {
        alert('Failed to restore schedule');
      }
    } catch (error) {
      console.error('Error restoring:', error);
      alert('Error restoring schedule');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle export to CSV
  const handleExport = () => {
    if (cancelledSchedules.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Property ID',
      'Property Name',
      'Service',
      'Vendor',
      'Scheduled Date',
      'Time',
      'Zone',
      'Cancelled Date',
      'Cancelled By',
      'Reason'
    ];

    const rows = cancelledSchedules.map(schedule => [
      schedule.propertyId || '',
      schedule.propertyName || '',
      schedule.serviceName || '',
      schedule.vendorName || '',
      schedule.scheduledDate || '',
      schedule.scheduledTime || '',
      schedule.zone || '',
      schedule.cancelledAt || schedule.cancelledDate || '',
      schedule.cancelledBy || '',
      schedule.cancelReason || schedule.reason || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cancelled_schedules_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cancelled Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">
            View all cancelled service schedules and their cancellation details
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions.canExport && (
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
              title="Export"
            >
              <Download className="w-4 h-4 text-gray-600" />
              Export
            </button>
          )}
          <button
            onClick={fetchCancelledSchedules}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Cards - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 min-h-[80px] sm:min-h-[90px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{cancelledSchedules.length}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Total Cancelled</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 min-h-[80px] sm:min-h-[90px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {cancelledSchedules.filter(s => s.cancelled_by_role === 'Manager' || s.cancelled_by_role === 'Admin').length}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">By Staff</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 min-h-[80px] sm:min-h-[90px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {cancelledSchedules.filter(s => s.cancelled_by_role === 'Vendor').length}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">By Vendor</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 min-h-[80px] sm:min-h-[90px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {cancelledSchedules.filter(s => s.cancelled_by_role === 'Customer').length}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">By Customer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Responsive */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex-1 min-w-[200px] max-w-[400px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by property, service..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={filters.service}
            onChange={(e) => setFilters({...filters, service: e.target.value})}
            className="min-w-[110px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Services</option>
            {services.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.cancelledBy}
            onChange={(e) => setFilters({...filters, cancelledBy: e.target.value})}
            className="min-w-[130px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Cancelled By: All</option>
            {cancelledByRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
            className="min-w-[100px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Time</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
          </select>
          <select
            value={filters.zone}
            onChange={(e) => setFilters({...filters, zone: e.target.value})}
            className="min-w-[90px] flex-shrink-0 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Zones</option>
            {zones.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <XCircle className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-lg font-medium">No cancelled schedules found</p>
            <p className="text-sm">Cancelled schedules will appear here</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Property ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Scheduled For</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cancelled On</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cancelled By</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-blue-600">{schedule.property_id || `PROP-${String(schedule.id).padStart(3, '0')}`}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{schedule.property_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{schedule.service}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{schedule.vendor}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="text-gray-900">{formatDate(schedule.scheduled_date)}</p>
                        <p className="text-gray-500 text-xs">{schedule.scheduled_time}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{formatDateTime(schedule.cancelled_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCancelledByBadge(schedule.cancelled_by_role)}`}>
                        {schedule.cancelled_by_role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(schedule)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
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

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSchedules.length)} of {filteredSchedules.length} entries
              </p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-sm font-medium rounded ${
                      currentPage === page 
                        ? 'bg-blue-600 text-white' 
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Cancellation Details</h3>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-3">
              {/* Property Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Property ID</p>
                  <p className="text-sm font-medium text-blue-600">{selectedSchedule.property_id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Property Name</p>
                  <p className="text-sm font-medium text-gray-900">{selectedSchedule.property_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Service</p>
                  <p className="text-sm font-medium text-gray-900">{selectedSchedule.service}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Vendor</p>
                  <p className="text-sm font-medium text-gray-900">{selectedSchedule.vendor}</p>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Original Schedule */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide font-semibold">Original Schedule</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium">{formatDate(selectedSchedule.scheduled_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium">{selectedSchedule.scheduled_time}</span>
                  </div>
                </div>
              </div>

              {/* Cancellation Info */}
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <p className="text-[10px] text-red-600 mb-2 uppercase tracking-wide font-semibold">Cancellation Information</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cancelled On</span>
                    <span className="text-gray-900">{formatDateTime(selectedSchedule.cancelled_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cancelled By</span>
                    <span className="font-medium text-gray-900">{selectedSchedule.cancelled_by}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Role</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCancelledByBadge(selectedSchedule.cancelled_by_role)}`}>
                      {selectedSchedule.cancelled_by_role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-xs text-gray-500 mb-1">Cancellation Reason</p>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{selectedSchedule.reason}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              {permissions.canRestore && (
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore Schedule
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Restore Schedule?</h3>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                This will restore the cancelled schedule and move it to <strong>Pending Schedules</strong> where you can assign a new date and time.
              </p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{selectedSchedule.visit_id}</p>
                <p className="text-sm text-gray-600">{selectedSchedule.service} - {selectedSchedule.property_name}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CancelledSchedulesPage;
