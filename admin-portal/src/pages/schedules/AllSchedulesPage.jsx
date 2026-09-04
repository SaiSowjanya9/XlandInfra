import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, Download, ChevronLeft, ChevronRight,
  RefreshCw, CheckCircle, AlertCircle, XCircle, Clock3, CalendarDays, 
  Users, Building2, List, MapPin, Eye, Edit2, X, FileText
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor'
  };
  return portalMap[portalType] || 'admin';
};

// Role-based permissions
const getSchedulePermissions = (portalType) => {
  const permissions = {
    admin: { canView: true, canReschedule: true, canCancel: true, fullAccess: true },
    operations_manager: { canView: true, canReschedule: true, canCancel: true, fullAccess: false },
    franchise: { canView: true, canReschedule: true, canCancel: true, fullAccess: false },
    manager: { canView: true, canReschedule: true, canCancel: true, fullAccess: false },
    coordinator: { canView: true, canReschedule: false, canCancel: false, fullAccess: false },
    supervisor: { canView: true, canReschedule: false, canCancel: false, fullAccess: false },
    executive: { canView: true, canReschedule: false, canCancel: false, fullAccess: false }
  };
  return permissions[portalType] || permissions.executive;
};

const AllSchedulesPage = ({ portalType = 'admin' }) => {
  const navigate = useNavigate();
  const permissions = getSchedulePermissions(portalType);
  const apiPath = getApiPath(portalType);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0, scheduled: 0, upcoming: 0, workOrderCreated: 0,
    inProgress: 0, completed: 0, rescheduled: 0, cancelled: 0, overdue: 0
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    service: 'all',
    vendor: 'all',
    zone: 'all',
    propertyType: 'all'
  });
  
  // Dropdown data
  const [services, setServices] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [zones, setZones] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  // Fetch schedules
  const fetchSchedules = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        ...(filters.search && { search: filters.search }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.service !== 'all' && { service: filters.service }),
        ...(filters.vendor !== 'all' && { vendor: filters.vendor }),
        ...(filters.zone !== 'all' && { zone: filters.zone }),
        ...(filters.propertyType !== 'all' && { propertyType: filters.propertyType })
      });
      
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/all?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.data || []);
        setTotalCount(data.total || 0);
        if (data.stats) setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, filters, apiPath, itemsPerPage]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const token = getAuthToken();
      
      // Fetch zones
      const zonesRes = await fetch(`${API_BASE}/api/${apiPath}/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (zonesRes.ok) {
        const data = await zonesRes.json();
        setZones(data.data || []);
      }

      // Fetch vendors
      const vendorsRes = await fetch(`${API_BASE}/api/${apiPath}/vendors?status=active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vendorsRes.ok) {
        const data = await vendorsRes.json();
        setVendors(data.data || data.vendors || []);
      }

      // Fetch services
      const servicesRes = await fetch(`${API_BASE}/api/${apiPath}/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }, [apiPath]);

  useEffect(() => {
    fetchSchedules();
    fetchFilterOptions();
  }, [fetchSchedules, fetchFilterOptions]);

  // Status badge styles based on document Section 12
  const getStatusBadge = (status) => {
    const styles = {
      pending_schedule: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending Schedule' },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
      upcoming: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Upcoming' },
      work_order_created: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Work Order Created' },
      in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      rescheduled: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Rescheduled' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-500', label: 'Cancelled' },
      overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' }
    };
    return styles[status] || styles.scheduled;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
  };

  const formatTime = (time) => {
    if (!time) return '-';
    try {
      if (time.includes('AM') || time.includes('PM')) return time;
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });
    } catch { return time; }
  };

  // Handle reschedule navigation
  const handleReschedule = (schedule) => {
    const basePath = portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '';
    navigate(`${basePath}/schedules/reschedule`, { state: { schedule } });
  };

  // Stats cards based on document Section 12 statuses
  const statsCards = [
    { label: 'Total', value: stats.total || 0, icon: CalendarDays, color: 'bg-blue-500' },
    { label: 'Scheduled', value: stats.scheduled || 0, icon: Calendar, color: 'bg-blue-500' },
    { label: 'Upcoming', value: stats.upcoming || 0, icon: Clock3, color: 'bg-indigo-500' },
    { label: 'Work Order Created', value: stats.workOrderCreated || 0, icon: FileText, color: 'bg-purple-500' },
    { label: 'In Progress', value: stats.inProgress || 0, icon: RefreshCw, color: 'bg-amber-500' },
    { label: 'Completed', value: stats.completed || 0, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Rescheduled', value: stats.rescheduled || 0, icon: RefreshCw, color: 'bg-orange-500' },
    { label: 'Overdue', value: stats.overdue || 0, icon: AlertCircle, color: 'bg-red-500' }
  ];

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Schedules</h1>
            <p className="text-sm text-gray-500 mt-1">
              View all schedule occurrences across properties
            </p>
          </div>
          <button
            onClick={() => fetchSchedules(true)}
            disabled={refreshing}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-8 gap-3 mb-6">
          {statsCards.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.color} bg-opacity-10 flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Property ID, Name, Service..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending_schedule">Pending Schedule</option>
              <option value="scheduled">Scheduled</option>
              <option value="upcoming">Upcoming</option>
              <option value="work_order_created">Work Order Created</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="overdue">Overdue</option>
            </select>

            {/* Service Filter */}
            <select
              value={filters.service}
              onChange={(e) => setFilters({ ...filters, service: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Services</option>
              {services.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            {/* Vendor Filter */}
            <select
              value={filters.vendor}
              onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id || v.name} value={v.name || v.businessName}>{v.name || v.businessName}</option>
              ))}
            </select>

            {/* Zone Filter */}
            <select
              value={filters.zone}
              onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones</option>
              {zones.map(z => (
                <option key={z.id || z.name} value={z.name}>{z.name}</option>
              ))}
            </select>

            {/* Export */}
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Clear Filters */}
            {(filters.search || filters.status !== 'all' || filters.service !== 'all' || 
              filters.vendor !== 'all' || filters.zone !== 'all') && (
              <button
                onClick={() => setFilters({ search: '', status: 'all', service: 'all', vendor: 'all', zone: 'all', propertyType: 'all' })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Visit #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Target Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Scheduled Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Work Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">Loading schedules...</p>
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No schedules found</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  schedules.map((schedule, index) => {
                    const statusStyle = getStatusBadge(schedule.status);
                    return (
                      <tr key={schedule.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-blue-600">{schedule.propertyId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{schedule.propertyName}</p>
                          <p className="text-xs text-gray-500">{schedule.customerName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{schedule.serviceName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{schedule.vendorName || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">
                            {schedule.visitNumber} of {schedule.totalVisits}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(schedule.targetDate)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${schedule.isRescheduled ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                            {formatDate(schedule.scheduledDate)}
                          </span>
                          {schedule.isRescheduled && schedule.originalDate && (
                            <p className="text-xs text-gray-400">Was: {formatDate(schedule.originalDate)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{formatTime(schedule.scheduledTime)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-700">{schedule.zone || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {schedule.workOrderId ? (
                            <span className="text-sm text-blue-600 font-medium">{schedule.workOrderId}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {permissions.canReschedule && schedule.status !== 'completed' && schedule.status !== 'cancelled' && (
                              <button 
                                onClick={() => handleReschedule(schedule)}
                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                title="Reschedule"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {permissions.canCancel && schedule.status !== 'completed' && schedule.status !== 'cancelled' && (
                              <button 
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount.toLocaleString()} schedules
              </p>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 text-sm font-medium rounded ${
                        pageNum === currentPage ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllSchedulesPage;
