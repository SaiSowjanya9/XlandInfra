import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFP } from '../../contexts/FPContext';
import {
  Calendar, CalendarDays, Clock, CheckCircle, XCircle, RefreshCw, Plus,
  ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Filter, Bell,
  Building2, ArrowRight, TrendingUp, RotateCcw
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DonutChart from '../../components/common/DonutChart';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Status colors
const STATUS_COLORS = {
  pending: '#6B7280',
  scheduled: '#3B82F6',
  upcoming: '#3B82F6',
  in_progress: '#F59E0B',
  completed: '#10B981',
  rescheduled: '#8B5CF6',
  cancelled: '#EF4444'
};

// Priority colors
const PRIORITY_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981'
};

// Property Type colors
const PROPERTY_TYPE_COLORS = {
  'Apartment': '#3B82F6',
  'Villa': '#F59E0B',
  'Commercial': '#8B5CF6',
  'Gated Community': '#10B981',
  'Others': '#6B7280'
};

// Service colors
const SERVICE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#6B7280'];

const getApiPath = (portalType) => {
  const map = { 'franchise': 'fp', 'manager': 'manager', 'admin': 'admin', 'coordinator': 'coordinator', 'supervisor': 'supervisor' };
  return map[portalType] || 'fp';
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const SchedulesDashboard = ({ user, portalType = 'franchise' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const { selectedFp } = useFP();
  
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [pendingProperties, setPendingProperties] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Chart filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  
  // Table filter states
  const [trendFilter, setTrendFilter] = useState('all');
  const [upcomingFilter, setUpcomingFilter] = useState('all');
  const [recentFilter, setRecentFilter] = useState('all');
  const [rescheduleFilter, setRescheduleFilter] = useState('all');
  const [overdueFilter, setOverdueFilter] = useState('all');
  const [pendingFilter, setPendingFilter] = useState('all');
  
  // UI states for header buttons
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Period filter helper function
  const applyPeriodFilter = (data, period) => {
    if (period === 'all') return data;
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (period) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        filterDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case '6months':
        filterDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'year':
        filterDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return data;
    }
    
    return data.filter(item => {
      const itemDate = new Date(item.startDate || item.start_date || item.createdAt);
      return itemDate >= filterDate && itemDate <= now;
    });
  };

  // Period Filter Dropdown Component
  const PeriodFilter = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">All Time</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="quarter">This Quarter</option>
      <option value="6months">Last 6 Months</option>
      <option value="year">This Year</option>
    </select>
  );

  const getBasePath = () => {
    const map = { 'franchise': '/fp', 'manager': '/manager', 'admin': '/admin', 'coordinator': '/coordinator', 'supervisor': '/supervisor' };
    return map[portalType] || '/fp';
  };

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFp && selectedFp.id !== 'all') params.append('fpId', selectedFp.id);
      
      const response = await fetch(`${API_BASE}/api/schedules${params.toString() ? '?' + params : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        setSchedules(result.data || []);
      } else {
        setSchedules(getMockSchedules());
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setSchedules(getMockSchedules());
    } finally {
      setLoading(false);
    }
  }, [token, selectedFp]);

  // Fetch pending properties
  const fetchPendingProperties = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/schedules/pending-properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        setPendingProperties(result.data || []);
      }
    } catch (err) {
      console.error('Pending properties error:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchSchedules();
    fetchPendingProperties();
    const interval = setInterval(fetchSchedules, 30000);
    return () => clearInterval(interval);
  }, [fetchSchedules, fetchPendingProperties]);

  // Mock data
  const getMockSchedules = () => [
    { id: 1, title: 'Water Tank Cleaning', property_name: 'Green Valley Apartments', vendor: 'ABC Services', startDate: new Date().toISOString(), status: 'scheduled', priority: 'high', service: 'Cleaning', property_type: 'Apartment' },
    { id: 2, title: 'Pest Control Service', property_name: 'Sunrise Villas', vendor: 'PestFree Services', startDate: new Date(Date.now() + 86400000).toISOString(), status: 'scheduled', priority: 'medium', service: 'Pest Control', property_type: 'Villa' },
    { id: 3, title: 'Electrical Repair', property_name: 'Palm Meadows', vendor: 'PowerFix', startDate: new Date(Date.now() + 172800000).toISOString(), status: 'in_progress', priority: 'high', service: 'Electrical', property_type: 'Apartment' },
    { id: 4, title: 'Drainage Cleaning', property_name: 'Skyline Towers', vendor: 'DrainPro', startDate: new Date(Date.now() - 86400000).toISOString(), status: 'completed', priority: 'low', service: 'Plumbing', property_type: 'Commercial' }
  ];

  // Calculate stats
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next7Days = new Date(today); next7Days.setDate(today.getDate() + 7);
  
  const getStatus = (s) => (s.status || '').toLowerCase();
  
  const todaysSchedules = schedules.filter(s => {
    const d = new Date(s.startDate || s.start_date); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });
  
  const upcoming7Days = schedules.filter(s => {
    const d = new Date(s.startDate || s.start_date); d.setHours(0, 0, 0, 0);
    return d > today && d <= next7Days;
  });
  
  const rescheduleRequests = schedules.filter(s => getStatus(s) === 'rescheduled');
  const cancelledSchedules = schedules.filter(s => getStatus(s) === 'cancelled');
  const overdueSchedules = schedules.filter(s => {
    const d = new Date(s.startDate || s.start_date); d.setHours(0, 0, 0, 0);
    return d < today && !['completed', 'cancelled'].includes(getStatus(s));
  });

  // Chart data - Status (with filter)
  const statusFilteredData = applyPeriodFilter(schedules, statusFilter);
  const statusData = [
    { name: 'Scheduled', value: statusFilteredData.filter(s => ['scheduled', 'upcoming'].includes(getStatus(s))).length, color: STATUS_COLORS.scheduled },
    { name: 'In Progress', value: statusFilteredData.filter(s => getStatus(s) === 'in_progress').length, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: statusFilteredData.filter(s => getStatus(s) === 'completed').length, color: STATUS_COLORS.completed },
    { name: 'Cancelled', value: statusFilteredData.filter(s => getStatus(s) === 'cancelled').length, color: STATUS_COLORS.cancelled },
    { name: 'Pending', value: statusFilteredData.filter(s => getStatus(s) === 'pending').length, color: STATUS_COLORS.pending }
  ].filter(d => d.value > 0);
  const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);

  // Chart data - Service (with filter)
  const serviceFilteredData = applyPeriodFilter(schedules, serviceFilter);
  const serviceCounts = {};
  serviceFilteredData.forEach(s => {
    const svc = s.service || s.serviceCategory || 'General';
    serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;
  });
  const serviceData = Object.entries(serviceCounts)
    .map(([name, value], i) => ({ name, value, color: SERVICE_COLORS[i % SERVICE_COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  // Chart data - Priority (with filter)
  const priorityFilteredData = applyPeriodFilter(schedules, priorityFilter);
  const priorityData = [
    { name: 'High', value: priorityFilteredData.filter(s => (s.priority || '').toLowerCase() === 'high').length, color: PRIORITY_COLORS.high },
    { name: 'Medium', value: priorityFilteredData.filter(s => (s.priority || '').toLowerCase() === 'medium').length, color: PRIORITY_COLORS.medium },
    { name: 'Low', value: priorityFilteredData.filter(s => (s.priority || '').toLowerCase() === 'low').length, color: PRIORITY_COLORS.low }
  ].filter(d => d.value > 0);
  const priorityTotal = priorityData.reduce((sum, d) => sum + d.value, 0);

  // Chart data - Property Type (with filter)
  const propertyTypeFilteredData = applyPeriodFilter(schedules, propertyTypeFilter);
  const propTypeCounts = {};
  propertyTypeFilteredData.forEach(s => {
    const pt = s.property_type || s.propertyType || 'Others';
    propTypeCounts[pt] = (propTypeCounts[pt] || 0) + 1;
  });
  const propertyTypeData = Object.entries(propTypeCounts)
    .map(([name, value]) => ({ name, value, color: PROPERTY_TYPE_COLORS[name] || '#6B7280' }))
    .sort((a, b) => b.value - a.value);
  const propertyTypeTotal = propertyTypeData.reduce((sum, d) => sum + d.value, 0);

  // Trend data (filtered)
  const trendFilteredData = applyPeriodFilter(schedules, trendFilter);
  const generateTrendData = () => {
    const days = trendFilter === 'week' ? 7 : trendFilter === 'month' ? 30 : 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const daySchedules = trendFilteredData.filter(s => {
        const sDate = new Date(s.startDate || s.start_date || s.createdAt);
        return sDate.toDateString() === date.toDateString();
      });
      data.push({
        date: dateStr,
        created: daySchedules.length,
        completed: daySchedules.filter(s => getStatus(s) === 'completed').length,
        cancelled: daySchedules.filter(s => getStatus(s) === 'cancelled').length
      });
    }
    return data;
  };
  const trendData = generateTrendData();

  // Upcoming schedules (filtered)
  const upcomingFilteredData = applyPeriodFilter(todaysSchedules.concat(upcoming7Days), upcomingFilter);

  // Recently created (filtered)
  const recentFilteredData = applyPeriodFilter(schedules, recentFilter);
  const recentSchedules = [...recentFilteredData].sort((a, b) => 
    new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
  ).slice(0, 5);

  // Reschedule requests (filtered)
  const rescheduleFilteredData = applyPeriodFilter(rescheduleRequests, rescheduleFilter);

  // Overdue schedules (filtered)
  const overdueFilteredData = applyPeriodFilter(overdueSchedules, overdueFilter);

  // Pending properties (filtered)
  const pendingFilteredData = applyPeriodFilter(pendingProperties, pendingFilter);

  const StatusBadge = ({ status }) => {
    const colors = {
      scheduled: 'bg-blue-100 text-blue-700',
      upcoming: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      pending: 'bg-gray-100 text-gray-700',
      rescheduled: 'bg-purple-100 text-purple-700'
    };
    const s = (status || '').toLowerCase().replace(/\s+/g, '_');
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || colors.pending}`}>{status || 'Pending'}</span>;
  };

  const PriorityBadge = ({ priority }) => {
    const colors = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-green-100 text-green-700' };
    const p = (priority || 'medium').toLowerCase();
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[p] || colors.medium}`}>{priority || 'Medium'}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Scheduling Dashboard</h1>
          <p className="text-sm text-gray-500">Home &gt; Scheduling &gt; Dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            onRefresh={fetchSchedules}
          />
          {/* Filter Button */}
          <div className="relative">
            <button 
              onClick={() => { setShowFilterPanel(!showFilterPanel); setShowNotifications(false); }}
              className={`p-2 border rounded-lg hover:bg-gray-50 bg-white ${showFilterPanel ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              <Filter className={`w-5 h-5 ${showFilterPanel ? 'text-blue-600' : 'text-gray-600'}`} />
            </button>
            {/* Filter Dropdown */}
            {showFilterPanel && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Filters</h4>
                  <button onClick={() => setShowFilterPanel(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Status</label>
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label>
                    <select 
                      value={priorityFilter} 
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="all">All Priority</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Property Type</label>
                    <select 
                      value={propertyTypeFilter} 
                      onChange={(e) => setPropertyTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="all">All Types</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Villa">Villa</option>
                      <option value="Commercial">Commercial</option>
                      <option value="Gated Community">Gated Community</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setPropertyTypeFilter('all'); }}
                      className="flex-1 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <button 
                      onClick={() => { setShowFilterPanel(false); fetchSchedules(); }}
                      className="flex-1 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Notifications Button */}
          <div className="relative">
            <button 
              onClick={() => { setShowNotifications(!showNotifications); setShowFilterPanel(false); }}
              className={`relative p-2 border rounded-lg hover:bg-gray-50 bg-white ${showNotifications ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
            >
              <Bell className={`w-5 h-5 ${showNotifications ? 'text-blue-600' : 'text-gray-600'}`} />
              {(overdueSchedules.length + rescheduleRequests.length) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {overdueSchedules.length + rescheduleRequests.length}
                </span>
              )}
            </button>
            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-96 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Notifications</h4>
                  <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {overdueSchedules.length === 0 && rescheduleRequests.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      No notifications
                    </div>
                  ) : (
                    <>
                      {overdueSchedules.slice(0, 3).map((s, i) => (
                        <div key={`overdue-${i}`} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`${getBasePath()}/schedules/all`)}>
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-red-100 rounded-lg mt-0.5">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{s.propertyName || s.property_name || 'Property'}</p>
                              <p className="text-xs text-red-600">Overdue: {s.serviceName || s.service_name || 'Service'}</p>
                              <p className="text-xs text-gray-400">{formatDate(s.scheduled_date)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {rescheduleRequests.slice(0, 3).map((s, i) => (
                        <div key={`reschedule-${i}`} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`${getBasePath()}/schedules/reschedule-requests`)}>
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-pink-100 rounded-lg mt-0.5">
                              <RotateCcw className="w-4 h-4 text-pink-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{s.propertyName || s.property_name || 'Property'}</p>
                              <p className="text-xs text-pink-600">Reschedule Request</p>
                              <p className="text-xs text-gray-400">{s.serviceName || s.service_name || 'Service'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {(overdueSchedules.length > 3 || rescheduleRequests.length > 3) && (
                  <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                    <button 
                      onClick={() => navigate(`${getBasePath()}/schedules/all`)}
                      className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View All Notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => navigate(`${getBasePath()}/schedules/pending`)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Schedule</span>
            <span className="sm:hidden">New</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stat Cards - Responsive grid with consistent heights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Today's", sublabel: "Schedules", value: todaysSchedules.length, icon: CalendarDays, color: '#3B82F6', bg: '#DBEAFE', link: 'View Today', path: '/schedules/calendar' },
          { label: 'Upcoming', sublabel: '(7 Days)', value: upcoming7Days.length, icon: Clock, color: '#F59E0B', bg: '#FEF3C7', link: 'View Upcoming', path: '/schedules/calendar' },
          { label: 'Pending', sublabel: 'Schedules', value: pendingProperties.length, icon: Building2, color: '#8B5CF6', bg: '#EDE9FE', link: 'View Pending', path: '/schedules/pending' },
          { label: 'Reschedule', sublabel: 'Requests', value: rescheduleRequests.length, icon: RotateCcw, color: '#EC4899', bg: '#FCE7F3', link: 'View Requests', path: '/schedules/reschedule-requests' },
          { label: 'Cancelled', sublabel: 'Schedules', value: cancelledSchedules.length, icon: XCircle, color: '#EF4444', bg: '#FEE2E2', link: 'View Cancelled', path: '/schedules/cancelled' },
          { label: 'Overdue', sublabel: 'Schedules', value: overdueSchedules.length, icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2', link: 'View Overdue', path: '/schedules/all' }
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow flex flex-col min-h-[120px] sm:min-h-[140px]">
            <div className="flex items-start gap-2 mb-auto">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg }}>
                <card.icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: card.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-700 font-semibold leading-tight truncate">{card.label}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 leading-tight truncate">{card.sublabel}</p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</p>
              <button 
                onClick={() => navigate(`${getBasePath()}${card.path}`)}
                className="text-xs text-blue-600 hover:underline font-medium mt-1"
              >
                {card.link}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row - Responsive grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Status Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Status</h3>
            <PeriodFilter value={statusFilter} onChange={setStatusFilter} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <DonutChart data={statusData} size={90} strokeWidth={16} centerValue={statusTotal} centerLabel="Total" />
            </div>
            <div className="space-y-1.5 text-xs min-w-0 flex-1">
              {statusData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 truncate flex-1">{d.name}</span>
                  <span className="font-medium text-gray-900 text-[10px] flex-shrink-0">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Service</h3>
            <PeriodFilter value={serviceFilter} onChange={setServiceFilter} />
          </div>
          <div className="space-y-2">
            {serviceData.length > 0 ? serviceData.slice(0, 5).map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-[10px] text-gray-600 truncate flex-shrink-0">{d.name}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden min-w-0">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / Math.max(...serviceData.map(x => x.value), 1)) * 100}%`, backgroundColor: d.color }} />
                </div>
                <span className="text-[10px] font-medium w-4 text-right flex-shrink-0">{d.value}</span>
              </div>
            )) : (
              <p className="text-xs text-gray-400 text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Priority Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Priority</h3>
            <PeriodFilter value={priorityFilter} onChange={setPriorityFilter} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <DonutChart data={priorityData} size={90} strokeWidth={16} centerValue={priorityTotal} centerLabel="Total" />
            </div>
            <div className="space-y-1.5 text-xs min-w-0 flex-1">
              {priorityData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 truncate">{d.name}</span>
                  <span className="font-medium text-gray-900 text-[10px] flex-shrink-0 ml-auto">{d.value} ({priorityTotal ? Math.round((d.value / priorityTotal) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Property Type Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Property Type</h3>
            <PeriodFilter value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <DonutChart data={propertyTypeData} size={90} strokeWidth={16} centerValue={propertyTypeTotal} centerLabel="Total" />
            </div>
            <div className="space-y-1.5 text-xs min-w-0 flex-1">
              {propertyTypeData.slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 truncate flex-1">{d.name}</span>
                  <span className="font-medium text-gray-900 text-[10px] flex-shrink-0">{d.value} ({propertyTypeTotal ? Math.round((d.value / propertyTypeTotal) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Trend + Tables Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Schedule Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Schedule Trend</h3>
            <PeriodFilter value={trendFilter} onChange={setTrendFilter} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs mb-3">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Created</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Cancelled</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={30} />
              <Tooltip />
              <Line type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cancelled" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Upcoming Schedules</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={upcomingFilter} onChange={setUpcomingFilter} />
              <button onClick={() => navigate(`${getBasePath()}/schedules/calendar`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {upcomingFilteredData.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 w-16 flex-shrink-0">{formatTime(s.startDate || s.start_date) || '09:00 AM'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 truncate">{s.property_name || s.propertyName}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {upcomingFilteredData.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No upcoming schedules</p>
            )}
          </div>
        </div>

        {/* Pending Property Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Pending Property Schedules</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={pendingFilter} onChange={setPendingFilter} />
              <button onClick={() => navigate(`${getBasePath()}/schedules/pending`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Property ID / Name</th>
                  <th className="pb-2 px-2 text-center">Services</th>
                  <th className="pb-2 px-2 text-center">Vendors</th>
                  <th className="pb-2 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingFilteredData.slice(0, 4).map((p, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">
                      <p className="font-medium text-gray-900">{p.property_id || `PROP-${100 + i}`}</p>
                      <p className="text-gray-500 truncate max-w-[120px]">{p.property_name}</p>
                    </td>
                    <td className="py-2 px-2 text-center">{p.total_services || 0}</td>
                    <td className="py-2 px-2 text-center">{p.vendors_assigned || 0}/{p.total_services || 0}</td>
                    <td className="py-2 pl-2 text-right">
                      <button onClick={() => navigate(`${getBasePath()}/schedules/pending`)} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100 font-medium">Schedule</button>
                    </td>
                  </tr>
                ))}
                {pendingFilteredData.length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-gray-400">No pending properties</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Tables Row - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Recently Created */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recently Created</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={recentFilter} onChange={setRecentFilter} />
              <button className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Schedule ID</th>
                  <th className="pb-2 px-2">Property</th>
                  <th className="pb-2 px-2">Service</th>
                  <th className="pb-2 px-2">Status</th>
                  <th className="pb-2 pl-2">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSchedules.map((s, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">SCH-{2100 + i}</td>
                    <td className="py-2.5 px-2 text-gray-600 truncate max-w-[80px]">{s.property_name || s.propertyName}</td>
                    <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{s.service || 'General'}</td>
                    <td className="py-2.5 px-2"><StatusBadge status={s.status} /></td>
                    <td className="py-2.5 pl-2"><PriorityBadge priority={s.priority} /></td>
                  </tr>
                ))}
                {recentSchedules.length === 0 && (
                  <tr><td colSpan="5" className="py-6 text-center text-gray-400">No recent schedules</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reschedule Requests */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Reschedule Requests</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={rescheduleFilter} onChange={setRescheduleFilter} />
              <button onClick={() => navigate(`${getBasePath()}/schedules/reschedule-requests`)} className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">REQ ID</th>
                  <th className="pb-2 px-2">Property</th>
                  <th className="pb-2 px-2">Requested On</th>
                  <th className="pb-2 pl-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rescheduleFilteredData.slice(0, 4).map((s, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">REQ-{100 + i}</td>
                    <td className="py-2.5 px-2">
                      <p className="text-gray-900 truncate max-w-[100px]">{s.property_name || s.propertyName}</p>
                      <p className="text-gray-500 truncate max-w-[100px]">{s.service || 'Service'}</p>
                    </td>
                    <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{formatDate(s.updatedAt || s.updated_at)}</td>
                    <td className="py-2.5 pl-2"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium whitespace-nowrap">Pending</span></td>
                  </tr>
                ))}
                {rescheduleFilteredData.length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-gray-400">No reschedule requests</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overdue Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Overdue Schedules</h3>
            <div className="flex items-center gap-2">
              <PeriodFilter value={overdueFilter} onChange={setOverdueFilter} />
              <button className="text-xs text-blue-600 hover:underline whitespace-nowrap">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[280px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-2">Schedule ID</th>
                  <th className="pb-2 px-2">Property</th>
                  <th className="pb-2 px-2">Due Date</th>
                  <th className="pb-2 pl-2 text-right">Overdue By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {overdueFilteredData.slice(0, 4).map((s, i) => {
                  const dueDate = new Date(s.startDate || s.start_date);
                  const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={i}>
                      <td className="py-2.5 pr-2 font-medium text-gray-900 whitespace-nowrap">SCH-{2000 + i}</td>
                      <td className="py-2.5 px-2">
                        <p className="text-gray-900 truncate max-w-[100px]">{s.property_name || s.propertyName}</p>
                        <p className="text-gray-500 truncate max-w-[100px]">{s.service || s.title}</p>
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 whitespace-nowrap">{formatDate(s.startDate || s.start_date)}</td>
                      <td className="py-2.5 pl-2 text-red-600 font-medium text-right whitespace-nowrap">{daysOverdue} Days</td>
                    </tr>
                  );
                })}
                {overdueFilteredData.length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-gray-400">No overdue schedules</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulesDashboard;
