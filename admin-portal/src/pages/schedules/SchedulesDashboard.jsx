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

  // Trend data (mock)
  const trendData = [
    { date: '1 Aug', created: 25, completed: 20, cancelled: 2 },
    { date: '2 Aug', created: 30, completed: 22, cancelled: 3 },
    { date: '3 Aug', created: 35, completed: 28, cancelled: 2 },
    { date: '4 Aug', created: 28, completed: 25, cancelled: 4 },
    { date: '5 Aug', created: 40, completed: 30, cancelled: 3 },
    { date: '6 Aug', created: 38, completed: 32, cancelled: 2 },
    { date: '7 Aug', created: 45, completed: 35, cancelled: 5 }
  ];

  // Recently created
  const recentSchedules = [...schedules].sort((a, b) => 
    new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
  ).slice(0, 5);

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
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduling Dashboard</h1>
          <p className="text-sm text-gray-500">Home &gt; Scheduling &gt; Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            onRefresh={fetchSchedules}
          />
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Filter className="w-5 h-5 text-gray-600" />
          </button>
          <button className="relative p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
          </button>
          <button
            onClick={() => navigate(`${getBasePath()}/schedules/pending`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            New Schedule
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: "Today's Schedules", value: todaysSchedules.length, icon: CalendarDays, color: '#3B82F6', bg: '#DBEAFE', link: 'View Today', path: '/schedules/calendar' },
          { label: 'Upcoming (7 Days)', value: upcoming7Days.length, icon: Clock, color: '#F59E0B', bg: '#FEF3C7', link: 'View Upcoming', path: '/schedules/calendar' },
          { label: 'Pending Property Schedules', value: pendingProperties.length, icon: Building2, color: '#8B5CF6', bg: '#EDE9FE', link: 'View Pending', path: '/schedules/pending' },
          { label: 'Reschedule Requests', value: rescheduleRequests.length, icon: RotateCcw, color: '#EC4899', bg: '#FCE7F3', link: 'View Requests', path: '/schedules/reschedule-requests' },
          { label: 'Cancelled Schedules', value: cancelledSchedules.length, icon: XCircle, color: '#EF4444', bg: '#FEE2E2', link: 'View Cancelled', path: '/schedules/cancelled' },
          { label: 'Overdue Schedules', value: overdueSchedules.length, icon: AlertTriangle, color: '#DC2626', bg: '#FEE2E2', link: 'View Overdue', path: '/schedules/all' }
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <p className="text-sm text-gray-600 font-medium">{card.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{card.value}</p>
            <button 
              onClick={() => navigate(`${getBasePath()}${card.path}`)}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              {card.link}
            </button>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Status Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Status</h3>
            <PeriodFilter value={statusFilter} onChange={setStatusFilter} />
          </div>
          <div className="flex items-center gap-4">
            <DonutChart data={statusData} size={120} strokeWidth={20} centerValue={statusTotal} centerLabel="Total" />
            <div className="space-y-1.5 text-xs">
              {statusData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-medium text-gray-900">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Service Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Service</h3>
            <PeriodFilter value={serviceFilter} onChange={setServiceFilter} />
          </div>
          <div className="space-y-2">
            {serviceData.length > 0 ? serviceData.slice(0, 6).map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 text-xs text-gray-600 truncate">{d.name}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(d.value / Math.max(...serviceData.map(x => x.value), 1)) * 100}%`, backgroundColor: d.color }} />
                </div>
                <span className="text-xs font-medium w-6 text-right">{d.value}</span>
              </div>
            )) : (
              <p className="text-xs text-gray-400 text-center py-4">No data</p>
            )}
          </div>
        </div>

        {/* Priority Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Priority</h3>
            <PeriodFilter value={priorityFilter} onChange={setPriorityFilter} />
          </div>
          <div className="flex items-center gap-4">
            <DonutChart data={priorityData} size={120} strokeWidth={20} centerValue={priorityTotal} centerLabel="Total" />
            <div className="space-y-1.5 text-xs">
              {priorityData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-medium text-gray-900">{d.value} ({priorityTotal ? Math.round((d.value / priorityTotal) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Property Type Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Schedules by Property Type</h3>
            <PeriodFilter value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
          </div>
          <div className="flex items-center gap-4">
            <DonutChart data={propertyTypeData} size={120} strokeWidth={20} centerValue={propertyTypeTotal} centerLabel="Total" />
            <div className="space-y-1.5 text-xs">
              {propertyTypeData.slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-medium text-gray-900">{d.value} ({propertyTypeTotal ? Math.round((d.value / propertyTypeTotal) * 100) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Trend + Tables Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Schedule Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Schedule Trend</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Created</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Cancelled</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
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
            <button onClick={() => navigate(`${getBasePath()}/schedules/calendar`)} className="text-xs text-blue-600 hover:underline">View All</button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {todaysSchedules.concat(upcoming7Days).slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 w-16">{formatTime(s.startDate || s.start_date) || '09:00 AM'}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 truncate">{s.property_name || s.propertyName}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {todaysSchedules.length + upcoming7Days.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No upcoming schedules</p>
            )}
          </div>
        </div>

        {/* Pending Property Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Pending Property Schedules</h3>
            <button onClick={() => navigate(`${getBasePath()}/schedules/pending`)} className="text-xs text-blue-600 hover:underline">View All</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2">Property ID / Name</th>
                <th className="pb-2">Services</th>
                <th className="pb-2">Vendors</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingProperties.slice(0, 5).map((p, i) => (
                <tr key={i}>
                  <td className="py-2">
                    <p className="font-medium text-gray-900">{p.property_id || `PROP-${100 + i}`}</p>
                    <p className="text-gray-500 truncate max-w-[100px]">{p.property_name}</p>
                  </td>
                  <td className="py-2">{p.total_services || 0}</td>
                  <td className="py-2">{p.vendors_assigned || 0}/{p.total_services || 0}</td>
                  <td className="py-2">
                    <button onClick={() => navigate(`${getBasePath()}/schedules/pending`)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100">Schedule</button>
                  </td>
                </tr>
              ))}
              {pendingProperties.length === 0 && (
                <tr><td colSpan="4" className="py-4 text-center text-gray-400">No pending properties</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Tables Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recently Created */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recently Created Schedules</h3>
            <button className="text-xs text-blue-600 hover:underline">View All</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2">Schedule ID</th>
                <th className="pb-2">Property</th>
                <th className="pb-2">Service</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentSchedules.map((s, i) => (
                <tr key={i}>
                  <td className="py-2 font-medium text-gray-900">SCH-{2100 + i}</td>
                  <td className="py-2 text-gray-600 truncate max-w-[80px]">{s.property_name || s.propertyName}</td>
                  <td className="py-2 text-gray-600">{s.service || 'General'}</td>
                  <td className="py-2"><StatusBadge status={s.status} /></td>
                  <td className="py-2"><PriorityBadge priority={s.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reschedule Requests */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Reschedule Requests</h3>
            <button onClick={() => navigate(`${getBasePath()}/schedules/reschedule-requests`)} className="text-xs text-blue-600 hover:underline">View All</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2">REQ ID</th>
                <th className="pb-2">Property</th>
                <th className="pb-2">Requested On</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rescheduleRequests.slice(0, 4).map((s, i) => (
                <tr key={i}>
                  <td className="py-2 font-medium text-gray-900">REQ-{100 + i}</td>
                  <td className="py-2">
                    <p className="text-gray-900 truncate max-w-[100px]">{s.property_name || s.propertyName}</p>
                    <p className="text-gray-500">{s.service || 'Service'}</p>
                  </td>
                  <td className="py-2 text-gray-600">{formatDate(s.updatedAt || s.updated_at)}</td>
                  <td className="py-2"><span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">Pending</span></td>
                </tr>
              ))}
              {rescheduleRequests.length === 0 && (
                <tr><td colSpan="4" className="py-4 text-center text-gray-400">No reschedule requests</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Overdue Schedules */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Overdue Schedules</h3>
            <button className="text-xs text-blue-600 hover:underline">View All</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2">Schedule ID</th>
                <th className="pb-2">Property</th>
                <th className="pb-2">Due Date</th>
                <th className="pb-2">Overdue By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {overdueSchedules.slice(0, 4).map((s, i) => {
                const dueDate = new Date(s.startDate || s.start_date);
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={i}>
                    <td className="py-2 font-medium text-gray-900">SCH-{2000 + i}</td>
                    <td className="py-2">
                      <p className="text-gray-900 truncate max-w-[100px]">{s.property_name || s.propertyName}</p>
                      <p className="text-gray-500">{s.service || s.title}</p>
                    </td>
                    <td className="py-2 text-gray-600">{formatDate(s.startDate || s.start_date)}</td>
                    <td className="py-2 text-red-600 font-medium">{daysOverdue} Days</td>
                  </tr>
                );
              })}
              {overdueSchedules.length === 0 && (
                <tr><td colSpan="4" className="py-4 text-center text-gray-400">No overdue schedules</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SchedulesDashboard;
