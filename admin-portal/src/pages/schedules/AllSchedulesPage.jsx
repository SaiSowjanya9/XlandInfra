import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, Download, ChevronLeft, ChevronRight,
  Plus, MoreHorizontal, Eye, Edit2, Trash2, RefreshCw, CheckCircle,
  AlertCircle, XCircle, Clock3, CalendarDays, Users, Building2, List,
  LayoutGrid, MapPin, Settings, X
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const AllSchedulesPage = ({ portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [stats, setStats] = useState({
    total: 0, scheduled: 0, inProgress: 0, completed: 0,
    rescheduled: 0, cancelled: 0, overdue: 0, verificationPending: 0
  });
  const [filters, setFilters] = useState({
    search: '', status: 'all', service: 'all', vendor: 'all',
    zone: 'all', propertyType: 'all', dateRange: null
  });
  const [activeView, setActiveView] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState([]);

  useEffect(() => {
    fetchSchedules();
    fetchStats();
  }, [filters, currentPage]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v && v !== 'all'))
      });
      
      const response = await fetch(`${API_BASE}/api/schedules?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/status-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.data || stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      rescheduled: 'bg-orange-100 text-orange-700',
      verification_pending: 'bg-purple-100 text-purple-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500'
    };
    return styles[status] || styles.scheduled;
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-green-100 text-green-700'
    };
    return styles[priority] || styles.medium;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
  };

  const formatTime = (time) => {
    if (!time) return '';
    try {
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });
    } catch { return time; }
  };

  // Stats cards data
  const statsCards = [
    { label: 'Total Schedules', value: stats.total || 1248, subtext: 'All time', icon: CalendarDays, color: 'blue' },
    { label: 'Scheduled', value: stats.scheduled || 542, percent: '43.4%', icon: Calendar, color: 'indigo' },
    { label: 'In Progress', value: stats.inProgress || 186, percent: '14.9%', icon: Clock3, color: 'amber' },
    { label: 'Completed', value: stats.completed || 392, percent: '31.4%', icon: CheckCircle, color: 'green' },
    { label: 'Rescheduled', value: stats.rescheduled || 68, percent: '5.4%', icon: RefreshCw, color: 'orange' },
    { label: 'Cancelled', value: stats.cancelled || 32, percent: '2.6%', icon: XCircle, color: 'gray' },
    { label: 'Overdue', value: stats.overdue || 28, percent: '2.2%', icon: AlertCircle, color: 'red' }
  ];

  const upcomingThisWeek = [
    { day: 'Today, May 20', count: 12 },
    { day: 'Wed, May 21', count: 18 },
    { day: 'Thu, May 22', count: 15 },
    { day: 'Fri, May 23', count: 22 },
    { day: 'Sat, May 24', count: 8 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Schedules</h1>
            <p className="text-sm text-gray-500 mt-1">
              Home &gt; Scheduling &gt; All Schedules
            </p>
          </div>
          <button
            onClick={() => navigate('/schedules/new')}
            className="px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Schedule
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Stats Cards */}
            <div className="grid grid-cols-7 gap-4 mb-6">
              {statsCards.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}>
                      <stat.icon className={`w-4 h-4 text-${stat.color}-600`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  {stat.percent && (
                    <p className={`text-xs text-${stat.color}-600 mt-1`}>{stat.percent}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search schedules..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {['status', 'service', 'vendor', 'zone', 'propertyType'].map((filterKey) => (
                  <select
                    key={filterKey}
                    value={filters[filterKey]}
                    onChange={(e) => setFilters({ ...filters, [filterKey]: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">{filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}</option>
                    <option value="option1">Option 1</option>
                  </select>
                ))}

                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>May 18 - May 24, 2025</span>
                </div>

                <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
              </div>
            </div>

            {/* View Tabs & Actions */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[
                    { id: 'list', label: 'List View', icon: List },
                    { id: 'calendar', label: 'Calendar View', icon: Calendar },
                    { id: 'vendor', label: 'Vendor View', icon: Users },
                    { id: 'property', label: 'Property View', icon: Building2 }
                  ].map((view) => (
                    <button
                      key={view.id}
                      onClick={() => setActiveView(view.id)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                        activeView === view.id 
                          ? 'bg-blue-50 text-blue-600' 
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <view.icon className="w-4 h-4" />
                      {view.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button
                    onClick={() => setShowBulkActions(!showBulkActions)}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    Bulk Actions
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Schedule ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Work Order ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Property / Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Frequency</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Zone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Schedule Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Next Visit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Priority</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-12 text-center">
                          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : schedules.length === 0 ? (
                      // Demo data
                      [...Array(10)].map((_, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-blue-600 font-medium">SCH-2025-{1248 - i}</td>
                          <td className="px-4 py-3 text-sm text-blue-600">WO-2025-{1187 - i}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">Green Heights Apartments</p>
                            <p className="text-xs text-gray-500">Rahul Mehta</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">Water Tank Cleaning</td>
                          <td className="px-4 py-3 text-sm text-gray-700">Monthly</td>
                          <td className="px-4 py-3 text-sm text-gray-700">Aqua Pure Services</td>
                          <td className="px-4 py-3 text-sm text-gray-700">North Zone</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">May 20, 2025</p>
                            <p className="text-xs text-gray-500">09:00 AM</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">Jun 20, 2025</p>
                            <p className="text-xs text-gray-500">09:00 AM</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              i === 0 ? 'bg-blue-100 text-blue-700' :
                              i === 1 ? 'bg-amber-100 text-amber-700' :
                              i === 2 ? 'bg-green-100 text-green-700' :
                              i === 3 ? 'bg-orange-100 text-orange-700' :
                              i === 4 ? 'bg-purple-100 text-purple-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {i === 0 ? 'Scheduled' : i === 1 ? 'In Progress' : i === 2 ? 'Completed' : 
                               i === 3 ? 'Rescheduled' : i === 4 ? 'Verification Pending' : 'Scheduled'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              i % 3 === 0 ? 'bg-red-100 text-red-700' :
                              i % 3 === 1 ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {i % 3 === 0 ? 'High' : i % 3 === 1 ? 'Medium' : 'Low'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      schedules.map((schedule, i) => (
                        <tr key={schedule.id || i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-blue-600 font-medium">{schedule.scheduleId}</td>
                          <td className="px-4 py-3 text-sm text-blue-600">{schedule.workOrderId || '-'}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{schedule.propertyName}</p>
                            <p className="text-xs text-gray-500">{schedule.customerName}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{schedule.serviceName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{schedule.frequency}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{schedule.vendorName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{schedule.zone}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">{formatDate(schedule.scheduledDate)}</p>
                            <p className="text-xs text-gray-500">{formatTime(schedule.scheduledTime)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-900">{formatDate(schedule.nextVisit)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(schedule.status)}`}>
                              {schedule.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadge(schedule.priority)}`}>
                              {schedule.priority?.charAt(0).toUpperCase() + schedule.priority?.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                <Eye className="w-4 h-4" />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded">
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">Showing 1 to 10 of 1,248 entries</p>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 border border-gray-300 rounded hover:bg-gray-50">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {[1, 2, 3, 4, 5].map((page) => (
                    <button
                      key={page}
                      className={`w-8 h-8 text-sm font-medium rounded ${
                        page === 1 ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button className="p-1.5 border border-gray-300 rounded hover:bg-gray-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            {/* Quick Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Summary</h3>
              <div className="space-y-2">
                {[
                  { label: 'Scheduled', count: 542, color: 'blue' },
                  { label: 'In Progress', count: 186, color: 'amber' },
                  { label: 'Completed', count: 392, color: 'green' },
                  { label: 'Rescheduled', count: 68, color: 'orange' },
                  { label: 'Verification Pending', count: 18, color: 'purple' },
                  { label: 'Overdue', count: 28, color: 'red' },
                  { label: 'Cancelled', count: 32, color: 'gray' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-${item.color}-500`} />
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{item.count}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Total</span>
                  <span className="text-sm font-bold text-gray-900">1,266</span>
                </div>
              </div>
            </div>

            {/* Upcoming This Week */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Upcoming This Week</h3>
              <div className="space-y-2">
                {upcomingThisWeek.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.day}</span>
                    <span className="text-sm font-medium text-blue-600">{item.count}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Total</span>
                  <span className="text-sm font-bold text-gray-900">75</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'New Schedule', icon: Plus, action: () => navigate('/schedules/new') },
                  { label: 'Bulk Schedule', icon: LayoutGrid, action: () => {} },
                  { label: 'Reschedule', icon: RefreshCw, action: () => navigate('/schedules/reschedule') },
                  { label: 'Cancel Schedule', icon: XCircle, action: () => {} },
                  { label: 'Schedule Settings', icon: Settings, action: () => {} }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2"
                  >
                    <item.icon className="w-4 h-4 text-gray-400" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mini Calendar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">May 2025</h3>
                <div className="flex items-center gap-1">
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="py-1 text-gray-500 font-medium">{day}</div>
                ))}
                {[...Array(31)].map((_, i) => (
                  <button
                    key={i}
                    className={`py-1 rounded ${
                      i + 1 === 20 ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllSchedulesPage;
