import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFP } from '../../contexts/FPContext';
import {
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Building2,
  Filter,
  Eye,
  ArrowRight,
  AlertCircle,
  Wrench,
  Home,
  Users,
  X,
  Search,
  MoreHorizontal
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import DonutChart from '../../components/common/DonutChart';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Status colors matching the image
const STATUS_COLORS = {
  upcoming: '#3B82F6',      // Blue
  in_progress: '#F59E0B',   // Amber/Orange
  completed: '#10B981',     // Green
  rescheduled: '#8B5CF6',   // Purple
  cancelled: '#EF4444',     // Red
  draft: '#6B7280',         // Gray
  active: '#3B82F6',        // Blue
  paused: '#F59E0B'         // Amber
};

// Property type colors
const PROPERTY_TYPE_COLORS = {
  'Apartment': '#3B82F6',
  'Gated Community': '#10B981',
  'Villa': '#F59E0B',
  'Flat': '#8B5CF6',
  'Plot': '#EF4444',
  'Other': '#6B7280'
};

// Service category colors
const SERVICE_CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'
];

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'employee': 'admin'
  };
  return portalMap[portalType] || 'fp';
};

// Normalize property type
const normalizePropertyType = (type) => {
  if (!type) return 'Other';
  const upper = type.toUpperCase().replace(/[_\s-]/g, '');
  if (upper === 'GC' || upper.includes('GATED')) return 'Gated Community';
  if (upper === 'APT' || upper.includes('APARTMENT')) return 'Apartment';
  if (upper === 'VILLA' || upper === 'VILLAS') return 'Villa';
  if (upper === 'FLAT' || upper === 'FLATS') return 'Flat';
  if (upper === 'PLOT' || upper === 'PLOTS') return 'Plot';
  return 'Other';
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format time helper
const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const SchedulesDashboard = ({ user, portalType = 'franchise' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  const { selectedFp } = useFP();
  
  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState([]);
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [zones, setZones] = useState([]);
  
  // Chart filters - default to 'all' (All Time)
  const [statusChartFilter, setStatusChartFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');
  const [calendarFilter, setCalendarFilter] = useState('all');
  
  // Calendar states
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('Month');
  const [selectedDate, setSelectedDate] = useState(null);
  
  // Modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  const datePickerRef = useRef(null);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch schedules
  const fetchSchedules = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Build URL with FP filter for admin viewing specific FP
      const params = new URLSearchParams();
      if (selectedFp && selectedFp.id !== 'all') {
        params.append('fpId', selectedFp.id);
      }
      const url = `${API_BASE}/api/schedules${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        // If 404 or no schedules table, just show empty state
        if (response.status === 404 || response.status === 500) {
          console.warn('Schedules API not available, showing empty dashboard');
          setSchedules([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      
      const result = await response.json();
      
      if (result.success) {
        setSchedules(result.data || []);
      } else {
        // Don't show error for empty data or permission issues - just show empty state
        console.warn('Schedules fetch warning:', result.message);
        setSchedules([]);
      }
    } catch (err) {
      console.error('Fetch schedules error:', err);
      // Don't show error, just show empty dashboard
      setSchedules([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, selectedFp]);

  // Fetch zones from onboarded properties
  const fetchZones = useCallback(async () => {
    try {
      // Use the suggestions endpoint which gets zones from onboarded_properties and vendors
      const response = await fetch(`${API_BASE}/api/onboarding/suggestions/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setZones(result.data);
      } else if (Array.isArray(result)) {
        setZones(result);
      }
    } catch (err) {
      console.error('Fetch zones error:', err);
      // Fallback: try portal-specific zones endpoint
      try {
        const fallbackResponse = await fetch(`${API_BASE}/api/${apiPath}/zones`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fallbackResult = await fallbackResponse.json();
        if (fallbackResult.success && Array.isArray(fallbackResult.data)) {
          setZones(fallbackResult.data.map(z => z.name || z));
        }
      } catch (fallbackErr) {
        console.error('Fallback zones fetch error:', fallbackErr);
      }
    }
  }, [token, apiPath]);

  // Initial load
  useEffect(() => {
    // Ensure calendar always starts at current date on mount
    setCalendarDate(new Date());
    fetchSchedules();
    fetchZones();
    const interval = setInterval(() => fetchSchedules(false), 30000);
    return () => clearInterval(interval);
  }, [fetchSchedules, fetchZones]);

  // Apply period filter
  const applyPeriodFilter = (data, periodFilter) => {
    if (periodFilter === 'all') return data;
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (periodFilter) {
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

  // Get main filtered schedules (by date range)
  const getMainFilteredSchedules = () => {
    let filtered = schedules;
    
    if (startDate) {
      filtered = filtered.filter(s => {
        const sDate = new Date(s.startDate || s.start_date);
        return sDate >= new Date(startDate);
      });
    }
    
    if (endDate) {
      filtered = filtered.filter(s => {
        const sDate = new Date(s.startDate || s.start_date);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return sDate <= end;
      });
    }
    
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(s => s.zone === zoneFilter);
    }
    
    return filtered;
  };

  const mainFilteredSchedules = getMainFilteredSchedules();

  // Calculate stats
  const getStatus = (s) => (s.status || '').toString().trim().toLowerCase();
  
  const totalSchedules = mainFilteredSchedules.length;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const upcomingToday = mainFilteredSchedules.filter(s => {
    const sDate = new Date(s.startDate || s.start_date);
    sDate.setHours(0, 0, 0, 0);
    return sDate.getTime() === today.getTime() && ['active', 'upcoming', 'draft'].includes(getStatus(s));
  }).length;

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
  
  const thisWeek = mainFilteredSchedules.filter(s => {
    const sDate = new Date(s.startDate || s.start_date);
    return sDate >= thisWeekStart && sDate <= thisWeekEnd;
  }).length;

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const thisMonth = mainFilteredSchedules.filter(s => {
    const sDate = new Date(s.startDate || s.start_date);
    return sDate >= thisMonthStart && sDate <= thisMonthEnd;
  }).length;

  const completedSchedules = mainFilteredSchedules.filter(s => getStatus(s) === 'completed').length;
  const rescheduledSchedules = mainFilteredSchedules.filter(s => getStatus(s) === 'rescheduled').length;
  const cancelledSchedules = mainFilteredSchedules.filter(s => getStatus(s) === 'cancelled').length;

  // Stat cards configuration
  const statCards = [
    {
      label: 'Total Schedules',
      value: totalSchedules,
      percentage: '100% of all schedules',
      icon: CalendarDays,
      iconBg: '#DBEAFE',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6',
      link: 'View All'
    },
    {
      label: 'Upcoming Today',
      value: upcomingToday,
      percentage: totalSchedules ? `${((upcomingToday / totalSchedules) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Clock,
      iconBg: '#FEF3C7',
      iconColor: '#F59E0B',
      borderColor: '#F59E0B',
      link: 'View Today'
    },
    {
      label: 'This Week',
      value: thisWeek,
      percentage: totalSchedules ? `${((thisWeek / totalSchedules) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Calendar,
      iconBg: '#DBEAFE',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6',
      link: 'View This Week'
    },
    {
      label: 'This Month',
      value: thisMonth,
      percentage: totalSchedules ? `${((thisMonth / totalSchedules) * 100).toFixed(1)}% of total` : '0% of total',
      icon: CalendarDays,
      iconBg: '#DBEAFE',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6',
      link: 'View This Month'
    },
    {
      label: 'Completed',
      value: completedSchedules,
      percentage: totalSchedules ? `${((completedSchedules / totalSchedules) * 100).toFixed(1)}% of total` : '0% of total',
      icon: CheckCircle,
      iconBg: '#D1FAE5',
      iconColor: '#10B981',
      borderColor: '#10B981',
      link: 'View Completed'
    },
    {
      label: 'Rescheduled',
      value: rescheduledSchedules,
      percentage: totalSchedules ? `${((rescheduledSchedules / totalSchedules) * 100).toFixed(1)}% of total` : '0% of total',
      icon: RefreshCw,
      iconBg: '#DBEAFE',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6',
      link: 'View Rescheduled'
    },
    {
      label: 'Cancelled',
      value: cancelledSchedules,
      percentage: totalSchedules ? `${((cancelledSchedules / totalSchedules) * 100).toFixed(1)}% of total` : '0% of total',
      icon: XCircle,
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      borderColor: '#EF4444',
      link: 'View Cancelled'
    }
  ];

  // Chart data - Status distribution
  const statusChartData = applyPeriodFilter(mainFilteredSchedules, statusChartFilter);
  const statusCounts = {
    upcoming: statusChartData.filter(s => ['upcoming', 'active', 'draft'].includes(getStatus(s))).length,
    in_progress: statusChartData.filter(s => getStatus(s) === 'in_progress').length,
    completed: statusChartData.filter(s => getStatus(s) === 'completed').length,
    rescheduled: statusChartData.filter(s => getStatus(s) === 'rescheduled').length,
    cancelled: statusChartData.filter(s => getStatus(s) === 'cancelled').length
  };
  
  const statusDonutData = [
    { name: 'Upcoming', value: statusCounts.upcoming, color: STATUS_COLORS.upcoming },
    { name: 'In Progress', value: statusCounts.in_progress, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: statusCounts.completed, color: STATUS_COLORS.completed },
    { name: 'Rescheduled', value: statusCounts.rescheduled, color: STATUS_COLORS.rescheduled },
    { name: 'Cancelled', value: statusCounts.cancelled, color: STATUS_COLORS.cancelled }
  ].filter(d => d.value > 0);

  const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // Chart data - Property Type
  const propertyTypeChartData = applyPeriodFilter(mainFilteredSchedules, propertyTypeFilter);
  const propertyTypeCounts = {};
  propertyTypeChartData.forEach(s => {
    const pType = normalizePropertyType(s.propertyType || s.property_type);
    propertyTypeCounts[pType] = (propertyTypeCounts[pType] || 0) + 1;
  });
  const propertyTypeBarData = Object.entries(propertyTypeCounts)
    .map(([name, value]) => ({ name, value, color: PROPERTY_TYPE_COLORS[name] || '#6B7280' }))
    .sort((a, b) => b.value - a.value);

  // Chart data - Service Category (mock for now since schedules don't have service category)
  const serviceCategoryChartData = applyPeriodFilter(mainFilteredSchedules, serviceCategoryFilter);
  const serviceCategoryCounts = {};
  serviceCategoryChartData.forEach(s => {
    const category = s.serviceCategory || s.service_category || s.title?.split(' ')[0] || 'General';
    serviceCategoryCounts[category] = (serviceCategoryCounts[category] || 0) + 1;
  });
  const serviceCategoryBarData = Object.entries(serviceCategoryCounts)
    .map(([name, value], idx) => ({ name, value, color: SERVICE_CATEGORY_COLORS[idx % SERVICE_CATEGORY_COLORS.length] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  };

  const getSchedulesForDate = (date) => {
    return mainFilteredSchedules.filter(s => {
      const sDate = new Date(s.startDate || s.start_date);
      return sDate.toDateString() === date.toDateString();
    });
  };

  const calendarDays = getDaysInMonth(calendarDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Today's schedules
  const todaysSchedules = mainFilteredSchedules.filter(s => {
    const sDate = new Date(s.startDate || s.start_date);
    sDate.setHours(0, 0, 0, 0);
    return sDate.getTime() === today.getTime();
  }).sort((a, b) => new Date(a.startDate || a.start_date) - new Date(b.startDate || b.start_date));

  // Upcoming schedules (next 7 days)
  const next7Days = new Date(today);
  next7Days.setDate(today.getDate() + 7);
  
  const upcomingSchedules = mainFilteredSchedules.filter(s => {
    const sDate = new Date(s.startDate || s.start_date);
    sDate.setHours(0, 0, 0, 0);
    return sDate > today && sDate <= next7Days;
  }).sort((a, b) => new Date(a.startDate || a.start_date) - new Date(b.startDate || b.start_date));

  // Group upcoming schedules by date
  const upcomingByDate = {};
  upcomingSchedules.forEach(s => {
    const dateKey = new Date(s.startDate || s.start_date).toDateString();
    if (!upcomingByDate[dateKey]) {
      upcomingByDate[dateKey] = [];
    }
    upcomingByDate[dateKey].push(s);
  });

  // Unscheduled items (drafts without proper dates)
  const unscheduledItems = mainFilteredSchedules.filter(s => {
    const status = getStatus(s);
    return status === 'draft' || !s.startDate;
  });

  // Date format helpers
  const formatDateIST = (dateString) => {
    if (!dateString) return '';
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseISTDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    if (!day || !month || !year || year.length !== 4) return '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const handleDateInput = (value, setter) => {
    let cleaned = value.replace(/[^\d/]/g, '');
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      cleaned += '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      cleaned += '/';
    }
    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
    setter(cleaned);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading schedules...</span>
      </div>
    );
  }

  // Period filter dropdown
  const PeriodFilter = ({ value, onChange, label }) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All Time</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="quarter">This Quarter</option>
        <option value="6months">Last 6 Months</option>
        <option value="year">This Year</option>
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );

  // Status badge
  const StatusBadge = ({ status }) => {
    const statusColors = {
      upcoming: 'bg-blue-100 text-blue-700',
      active: 'bg-blue-100 text-blue-700',
      draft: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      rescheduled: 'bg-purple-100 text-purple-700',
      cancelled: 'bg-red-100 text-red-700',
      paused: 'bg-amber-100 text-amber-700'
    };
    const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '_') || 'draft';
    const statusLabels = {
      upcoming: 'Upcoming',
      active: 'Active',
      draft: 'Draft',
      in_progress: 'In Progress',
      completed: 'Completed',
      rescheduled: 'Rescheduled',
      cancelled: 'Cancelled',
      paused: 'Paused'
    };
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[normalizedStatus] || 'bg-gray-100 text-gray-700'}`}>
        {statusLabels[normalizedStatus] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduling Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of all scheduled services and visits</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Zone Filter */}
          <div className="relative">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones</option>
              {zones.map((zone, idx) => (
                <option key={idx} value={zone.name || zone}>{zone.name || zone}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          {/* Date Range */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setStartDateDisplay(start ? new Date(start + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/') : '');
              setEndDateDisplay(end ? new Date(end + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/') : '');
            }}
            onRefresh={() => fetchSchedules(true)}
            showRefreshButton={true}
          />

          {/* Schedule Service Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Schedule Service
          </button>
        </div>
      </div>

      {/* Stat Cards - Compact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 hover:shadow-md transition-shadow cursor-pointer"
              style={{ borderLeftWidth: '3px', borderLeftColor: card.borderColor }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-medium text-gray-700 leading-tight">{card.label}</p>
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: card.iconBg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: card.iconColor }} />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900 mb-1">{card.value}</p>
              <button 
                className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5"
              >
                {card.link} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedules by Status - Donut Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Schedules by Status</h3>
            <PeriodFilter value={statusChartFilter} onChange={setStatusChartFilter} />
          </div>
          
          <div className="flex items-center gap-6">
            <DonutChart
              data={statusDonutData}
              size={160}
              strokeWidth={24}
              centerValue={statusTotal}
              centerLabel="Total"
            />
            
            <div className="flex-1 space-y-2">
              {statusDonutData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color, minWidth: '12px', minHeight: '12px' }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {item.value} ({statusTotal ? ((item.value / statusTotal) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Schedules by Property Type - Horizontal Bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Schedules by Property Type</h3>
            <PeriodFilter value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
          </div>
          
          <div className="space-y-3">
            {propertyTypeBarData.length > 0 ? (
              propertyTypeBarData.map((item, idx) => {
                const maxValue = Math.max(...propertyTypeBarData.map(d => d.value));
                const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-28 text-sm text-gray-600 truncate">{item.name}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-semibold text-gray-900">{item.value}</div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">No data available</p>
            )}
          </div>
        </div>

        {/* Schedules by Service Category - Horizontal Bar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Schedules by Service Category (Top 5)</h3>
            <PeriodFilter value={serviceCategoryFilter} onChange={setServiceCategoryFilter} />
          </div>
          
          <div className="space-y-3">
            {serviceCategoryBarData.length > 0 ? (
              serviceCategoryBarData.map((item, idx) => {
                const maxValue = Math.max(...serviceCategoryBarData.map(d => d.value));
                const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-gray-600 truncate">{item.name}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-semibold text-gray-900">{item.value}</div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Calendar and Schedules Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule Calendar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Schedule Calendar</h3>
            <PeriodFilter value={calendarFilter} onChange={setCalendarFilter} />
          </div>

          {/* Calendar Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCalendarDate(new Date());
                }}
                className="px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200"
              >
                Today
              </button>
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-sm font-semibold text-gray-900 min-w-[100px] text-center">
                {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
              </span>
              <button
                onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {['Month', 'Week', 'Day'].map(view => (
                <button
                  key={view}
                  onClick={() => setCalendarView(view)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    calendarView === view
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, idx) => {
              const daySchedules = getSchedulesForDate(day.date);
              const isToday = day.date.toDateString() === today.toDateString();
              const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString();
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day.date)}
                  className={`relative p-2 text-center rounded-lg transition-colors ${
                    !day.isCurrentMonth ? 'text-gray-300' :
                    isSelected ? 'bg-blue-600 text-white' :
                    isToday ? 'bg-blue-100 text-blue-700 font-bold' :
                    'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm">{day.date.getDate()}</span>
                  {daySchedules.length > 0 && day.isCurrentMonth && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {daySchedules.slice(0, 3).map((s, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[getStatus(s)] || STATUS_COLORS.upcoming }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Today's Schedule ({formatDate(today)})
            </h3>
            <button className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              View All Today <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {todaysSchedules.length > 0 ? (
              todaysSchedules.map((schedule, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedSchedule(schedule);
                    setShowScheduleModal(true);
                  }}
                >
                  <div className="text-sm font-medium text-gray-500 w-16">
                    {formatTime(schedule.startDate || schedule.start_date) || '09:00 AM'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{schedule.title}</p>
                    <p className="text-sm text-gray-500">{schedule.propertyName || schedule.property_name}</p>
                    {schedule.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{schedule.description}</p>
                    )}
                  </div>
                  <StatusBadge status={schedule.status} />
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No schedules for today</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Schedules (Next 7 Days) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Upcoming Schedules (Next 7 Days)</h3>
            <button className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
              View All Upcoming <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {Object.keys(upcomingByDate).length > 0 ? (
              Object.entries(upcomingByDate).map(([dateKey, daySchedules], idx) => {
                const date = new Date(dateKey);
                return (
                  <div key={idx}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-12 bg-blue-50 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xs text-blue-600 font-medium">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="text-lg font-bold text-blue-700">{date.getDate()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{daySchedules[0]?.title}</p>
                        <p className="text-sm text-gray-500">{daySchedules.length} Schedule(s)</p>
                      </div>
                      <StatusBadge status={daySchedules[0]?.status || 'upcoming'} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No upcoming schedules</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Schedule Service</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Modal Content - Calendar View */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Unscheduled Sidebar */}
                <div className="lg:col-span-1 bg-amber-50 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Unscheduled
                  </h3>
                  <div className="space-y-2">
                    {unscheduledItems.length > 0 ? (
                      unscheduledItems.slice(0, 5).map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-amber-100 rounded-lg p-3 cursor-pointer hover:bg-amber-200 transition-colors"
                        >
                          <p className="font-medium text-amber-900 text-sm">{item.title}</p>
                          <p className="text-xs text-amber-700">No date</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-amber-700">No unscheduled items</p>
                    )}
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="lg:col-span-3">
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-lg font-semibold">
                        {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                      </span>
                      <button
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        {['Month', 'Week', 'Day'].map(view => (
                          <button
                            key={view}
                            onClick={() => setCalendarView(view)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              calendarView === view
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {view}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-3 mb-4">
                    <select className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                      <option>All Types</option>
                      <option>Requests</option>
                      <option>Quotes</option>
                      <option>Jobs</option>
                    </select>
                    <select className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                      <option>All Team</option>
                    </select>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                      <MapPin className="w-4 h-4" />
                      Map View
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-7">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-gray-50 text-center text-sm font-medium text-gray-600 py-3 border-b">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-7">
                      {calendarDays.slice(0, 35).map((day, idx) => {
                        const daySchedules = getSchedulesForDate(day.date);
                        const isToday = day.date.toDateString() === today.toDateString();
                        
                        return (
                          <div
                            key={idx}
                            className={`min-h-[80px] p-2 border-b border-r ${
                              !day.isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                            } hover:bg-blue-50 cursor-pointer transition-colors`}
                          >
                            <span className={`text-sm ${
                              !day.isCurrentMonth ? 'text-gray-300' :
                              isToday ? 'w-6 h-6 bg-blue-600 text-white rounded-full inline-flex items-center justify-center' :
                              'text-gray-700'
                            }`}>
                              {day.date.getDate()}
                            </span>
                            <div className="mt-1 space-y-1">
                              {daySchedules.slice(0, 2).map((s, i) => (
                                <div
                                  key={i}
                                  className="text-xs px-1.5 py-0.5 rounded truncate"
                                  style={{
                                    backgroundColor: `${STATUS_COLORS[getStatus(s)] || STATUS_COLORS.upcoming}20`,
                                    color: STATUS_COLORS[getStatus(s)] || STATUS_COLORS.upcoming
                                  }}
                                >
                                  {s.title}
                                </div>
                              ))}
                              {daySchedules.length > 2 && (
                                <div className="text-xs text-gray-500">
                                  +{daySchedules.length - 2} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Legend */}
                  <div className="flex items-center gap-6 mt-4 text-sm">
                    <span className="text-gray-500">Color Coding:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-gray-600">Requests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="text-gray-600">Quotes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-gray-600">Jobs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Schedule Modal */}
      {showScheduleModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Schedule Details</h2>
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedSchedule(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Title</p>
                <p className="font-semibold text-gray-900">{selectedSchedule.title}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedSchedule.startDate || selectedSchedule.start_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <StatusBadge status={selectedSchedule.status} />
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Property</p>
                <p className="font-medium text-gray-900">{selectedSchedule.propertyName || selectedSchedule.property_name || '-'}</p>
              </div>
              
              {selectedSchedule.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-700">{selectedSchedule.description}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-4 border-t">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Edit Schedule
                </button>
                <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesDashboard;
