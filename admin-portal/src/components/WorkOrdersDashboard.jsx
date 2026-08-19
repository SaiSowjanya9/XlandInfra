// WorkOrdersDashboard - Updated with Category Trend Chart
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  XCircle, 
  UserCheck,
  Play,
  Archive,
  Plus,
  RefreshCw,
  ChevronDown,
  Calendar,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Building2
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import DonutChart from './common/DonutChart';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor',
    'executive': 'executive',
    'admin': 'admin',
    'employee': 'admin'
  };
  return portalMap[portalType] || 'fp';
};

const WorkOrdersDashboard = ({ user, portalType = 'franchise' }) => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [statusChartFilter, setStatusChartFilter] = useState('all');
  const [priorityChartFilter, setPriorityChartFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState('all');
  const [trendGranularity, setTrendGranularity] = useState('monthly');
  const [completionTimeFilter, setCompletionTimeFilter] = useState('all');
  const [categoryTrendFilter, setCategoryTrendFilter] = useState('all');
  const [categoryTrendGranularity, setCategoryTrendGranularity] = useState('monthly');
  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  const datePickerRef = useRef(null);

  // IST date formatting helpers
  const formatDateIST = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const parseISTDate = (displayStr) => {
    if (!displayStr || displayStr.length < 10) return null;
    const parts = displayStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (day && month && year && year.length === 4) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return null;
  };

  const handleDateInput = (value, setter) => {
    const cleaned = value.replace(/[^\d/]/g, '');
    if (cleaned.length <= 10) {
      let formatted = cleaned;
      if (cleaned.length === 2 && !cleaned.includes('/')) {
        formatted = cleaned + '/';
      } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
        formatted = cleaned + '/';
      }
      setter(formatted);
    }
  };

  // Close date picker on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get navigation base path
  const getBasePath = () => {
    if (portalType === 'franchise') return '/fp';
    if (portalType === 'employee' || portalType === 'admin') return '/employee';
    return `/${portalType}`;
  };

  // Fetch work orders
  const fetchWorkOrders = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/${apiPath}/work-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success || result.data || Array.isArray(result)) {
        const data = result.data || result.workOrders || result || [];
        const workOrdersArray = Array.isArray(data) ? data : [];
        console.log('[WorkOrdersDashboard] Fetched', workOrdersArray.length, 'work orders');
        setWorkOrders(workOrdersArray);
      } else {
        console.error('[WorkOrdersDashboard] Failed to load:', result.message);
        setError(result.message || 'Failed to load work orders');
      }
    } catch (err) {
      console.error('Fetch work orders error:', err);
      setError('Unable to load work orders data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiPath]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Filter work orders by date range first
  const dateFilteredWorkOrders = useMemo(() => {
    if (!startDate && !endDate) return workOrders;
    
    return workOrders.filter(wo => {
      const woDate = new Date(wo.created_at || wo.createdAt);
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end day
        return woDate >= start && woDate <= end;
      } else if (startDate) {
        return woDate >= new Date(startDate);
      } else if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return woDate <= end;
      }
      return true;
    });
  }, [workOrders, startDate, endDate]);

  // Filter helpers
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
      case 'sixmonths':
        filterDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'year':
        filterDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return data;
    }
    
    return data.filter(wo => {
      const woDate = new Date(wo.created_at || wo.createdAt);
      return woDate >= filterDate && woDate <= now;
    });
  };

  // Calculate stats - use dateFilteredWorkOrders
  const getStats = () => {
    const total = dateFilteredWorkOrders.length;
    const normalizeStatus = (status) => status?.toLowerCase().replace('-', '_').replace(' ', '_');
    const pending = dateFilteredWorkOrders.filter(wo => normalizeStatus(wo.status) === 'pending').length;
    const assigned = dateFilteredWorkOrders.filter(wo => normalizeStatus(wo.status) === 'assigned').length;
    const inProgress = dateFilteredWorkOrders.filter(wo => normalizeStatus(wo.status) === 'in_progress').length;
    const completed = dateFilteredWorkOrders.filter(wo => normalizeStatus(wo.status) === 'completed').length;
    const closed = dateFilteredWorkOrders.filter(wo => normalizeStatus(wo.status) === 'closed').length;
    const cancelled = dateFilteredWorkOrders.filter(wo => normalizeStatus(wo.status) === 'cancelled').length;
    
    return { total, pending, assigned, inProgress, completed, closed, cancelled };
  };

  const stats = getStats();

  // Status chart data
  const getStatusChartData = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, statusChartFilter);
    const statusCounts = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      closed: 0,
      cancelled: 0
    };
    
    filtered.forEach(wo => {
      const status = wo.status?.toLowerCase().replace(/-/g, '_').replace(/\s/g, '_');
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
    });

    return [
      { name: 'Pending', value: statusCounts.pending, color: '#F59E0B' },
      { name: 'Assigned', value: statusCounts.assigned, color: '#3B82F6' },
      { name: 'In Progress', value: statusCounts.in_progress, color: '#8B5CF6' },
      { name: 'Completed', value: statusCounts.completed, color: '#10B981' },
      { name: 'Closed', value: statusCounts.closed, color: '#6B7280' },
      { name: 'Cancelled', value: statusCounts.cancelled, color: '#EF4444' }
    ];
  };

  // Priority chart data
  const getPriorityChartData = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, priorityChartFilter);
    const priorityCounts = { low: 0, medium: 0, high: 0 };
    
    filtered.forEach(wo => {
      const priority = wo.priority?.toLowerCase();
      if (priorityCounts.hasOwnProperty(priority)) {
        priorityCounts[priority]++;
      }
    });

    return [
      { name: 'Low', value: priorityCounts.low, color: '#10B981' },
      { name: 'Medium', value: priorityCounts.medium, color: '#F59E0B' },
      { name: 'High', value: priorityCounts.high, color: '#EF4444' }
    ];
  };

  // Property type chart data
  const getPropertyTypeData = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, propertyTypeFilter);
    const typeCounts = {};
    
    filtered.forEach(wo => {
      const type = normalizePropertyType(wo.property_type || wo.propertyType);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const colors = {
      'Gated Community': '#3B82F6',
      'Apartment': '#8B5CF6',
      'Villa': '#10B981',
      'Flat': '#F59E0B',
      'Plot': '#EF4444',
      'Other': '#6B7280'
    };

    return Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value, color: colors[name] || '#6B7280' }))
      .sort((a, b) => b.value - a.value);
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

  // Trend data with granularity support
  const getTrendData = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, trendPeriod);
    const now = new Date();
    const timePoints = [];
    
    if (trendGranularity === 'daily') {
      // Show last 14 days
      let dayCount = 14;
      if (trendPeriod === 'week') dayCount = 7;
      else if (trendPeriod === 'month') dayCount = 30;
      else if (trendPeriod === 'quarter') dayCount = 14;
      
      for (let i = dayCount - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        timePoints.push({
          label: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
          startDate: date,
          endDate: endDate
        });
      }
    } else if (trendGranularity === 'weekly') {
      // Show last 8 weeks
      let weekCount = 8;
      if (trendPeriod === 'week') weekCount = 1;
      else if (trendPeriod === 'month') weekCount = 4;
      else if (trendPeriod === 'quarter') weekCount = 12;
      
      for (let i = weekCount - 1; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(now.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        timePoints.push({
          label: `Week ${weekCount - i}`,
          startDate: startDate,
          endDate: endDate
        });
      }
    } else {
      // Monthly (default)
      let monthCount = 6;
      if (trendPeriod === 'week') monthCount = 1;
      else if (trendPeriod === 'month') monthCount = 1;
      else if (trendPeriod === 'quarter') monthCount = 3;
      else if (trendPeriod === 'sixmonths') monthCount = 6;
      else if (trendPeriod === 'year') monthCount = 12;
      
      for (let i = monthCount - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        timePoints.push({
          label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          startDate: date,
          endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0)
        });
      }
    }

    return timePoints.map(({ label, startDate: tStart, endDate: tEnd }) => {
      const periodWOs = filtered.filter(wo => {
        const woDate = new Date(wo.created_at || wo.createdAt);
        return woDate >= tStart && woDate <= tEnd;
      });

      return {
        name: label,
        Created: periodWOs.length,
        Completed: periodWOs.filter(wo => wo.status === 'completed').length,
        Cancelled: periodWOs.filter(wo => wo.status === 'cancelled').length
      };
    });
  };

  // Service Category trend data (Plumbing, Electrical, HVAC, etc.)
  const getCategoryTrendData = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, categoryTrendFilter);
    
    // Get all unique service categories (Plumbing, Electrical, etc.)
    const categorySet = new Set();
    filtered.forEach(wo => {
      const category = wo.category_name || wo.category || wo.service_category || wo.serviceCategory || 'Other';
      if (category && category !== 'Other') {
        categorySet.add(category);
      }
    });
    const categories = Array.from(categorySet).slice(0, 6); // Limit to top 6
    
    const now = new Date();
    const timePoints = [];
    
    if (categoryTrendGranularity === 'daily') {
      // Show last 14 days
      let dayCount = 14;
      if (categoryTrendFilter === 'week') dayCount = 7;
      else if (categoryTrendFilter === 'month') dayCount = 30;
      else if (categoryTrendFilter === 'quarter') dayCount = 14;
      
      for (let i = dayCount - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        timePoints.push({
          label: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
          startDate: date,
          endDate: endDate
        });
      }
    } else if (categoryTrendGranularity === 'weekly') {
      // Show last 8 weeks
      let weekCount = 8;
      if (categoryTrendFilter === 'week') weekCount = 1;
      else if (categoryTrendFilter === 'month') weekCount = 4;
      else if (categoryTrendFilter === 'quarter') weekCount = 12;
      
      for (let i = weekCount - 1; i >= 0; i--) {
        const endDate = new Date(now);
        endDate.setDate(now.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        timePoints.push({
          label: `Week ${weekCount - i}`,
          startDate: startDate,
          endDate: endDate
        });
      }
    } else {
      // Monthly (default)
      let monthCount = 6;
      if (categoryTrendFilter === 'week') monthCount = 1;
      else if (categoryTrendFilter === 'month') monthCount = 1;
      else if (categoryTrendFilter === 'quarter') monthCount = 3;
      else if (categoryTrendFilter === 'sixmonths') monthCount = 6;
      else if (categoryTrendFilter === 'year') monthCount = 12;
      
      for (let i = monthCount - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        timePoints.push({
          label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          startDate: date,
          endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0)
        });
      }
    }

    // Build data structure
    const trendData = timePoints.map(({ label, startDate: tStart, endDate: tEnd }) => {
      const periodWOs = filtered.filter(wo => {
        const woDate = new Date(wo.created_at || wo.createdAt);
        return woDate >= tStart && woDate <= tEnd;
      });

      const dataPoint = { name: label };
      categories.forEach(cat => {
        dataPoint[cat] = periodWOs.filter(wo => {
          const woCategory = wo.category_name || wo.category || wo.service_category || wo.serviceCategory || 'Other';
          return woCategory === cat;
        }).length;
      });
      return dataPoint;
    });
    
    return { data: trendData, categories };
  };

  // Category colors for trend chart
  const categoryColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#8B5CF6', // purple
    '#EF4444', // red
    '#06B6D4', // cyan
    '#EC4899', // pink
    '#84CC16'  // lime
  ];

  // Average completion time data
  const getCompletionTimeData = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, completionTimeFilter);
    const completedWOs = filtered.filter(wo => wo.status === 'completed' && wo.completed_at);
    
    const priorityTimes = { high: [], medium: [], low: [] };
    
    completedWOs.forEach(wo => {
      const priority = wo.priority?.toLowerCase();
      if (priorityTimes.hasOwnProperty(priority)) {
        const created = new Date(wo.created_at || wo.createdAt);
        const completed = new Date(wo.completed_at || wo.completedAt);
        const days = (completed - created) / (1000 * 60 * 60 * 24);
        priorityTimes[priority].push(days);
      }
    });

    const avgDays = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
    const totalAvg = completedWOs.length > 0 
      ? (Object.values(priorityTimes).flat().reduce((a, b) => a + b, 0) / completedWOs.length).toFixed(1) 
      : 0;

    return {
      average: totalAvg,
      byPriority: [
        { name: 'High', days: parseFloat(avgDays(priorityTimes.high)), color: '#EF4444' },
        { name: 'Medium', days: parseFloat(avgDays(priorityTimes.medium)), color: '#F59E0B' },
        { name: 'Low', days: parseFloat(avgDays(priorityTimes.low)), color: '#10B981' }
      ]
    };
  };

  // SLA Compliance
  const getSLACompliance = () => {
    const filtered = applyPeriodFilter(dateFilteredWorkOrders, completionTimeFilter);
    const completedWOs = filtered.filter(wo => wo.status === 'completed');
    
    // Assume SLA thresholds: High = 2 days, Medium = 5 days, Low = 10 days
    const slaThresholds = { high: 2, medium: 5, low: 10 };
    let metSLA = 0;
    
    completedWOs.forEach(wo => {
      const priority = wo.priority?.toLowerCase() || 'medium';
      const threshold = slaThresholds[priority] || 5;
      const created = new Date(wo.created_at || wo.createdAt);
      const completed = new Date(wo.completed_at || wo.completedAt);
      const days = (completed - created) / (1000 * 60 * 60 * 24);
      
      if (days <= threshold) metSLA++;
    });

    const percentage = completedWOs.length > 0 ? Math.round((metSLA / completedWOs.length) * 100) : 0;
    const missed = completedWOs.length - metSLA;
    
    return { 
      percentage, 
      met: metSLA, 
      missed,
      data: [
        { name: 'Met SLA', value: metSLA, color: '#10B981' },
        { name: 'Missed SLA', value: missed, color: '#EF4444' }
      ]
    };
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
      assigned: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Assigned' },
      in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
      'in-progress': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      closed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Closed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' }
    };
    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  // Priority badge
  const getPriorityBadge = (priority) => {
    const config = {
      low: { bg: 'bg-green-100', text: 'text-green-700' },
      medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
      high: { bg: 'bg-red-100', text: 'text-red-700' },
      urgent: { bg: 'bg-red-200', text: 'text-red-800' }
    };
    const c = config[priority?.toLowerCase()] || config.medium;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text} capitalize`}>
        {priority || 'Medium'}
      </span>
    );
  };

  // Period filter dropdown
  const PeriodDropdown = ({ value, onChange, className = '' }) => (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="all">All Time</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="quarter">This Quarter</option>
      <option value="sixmonths">Last 6 Months</option>
      <option value="year">This Year</option>
    </select>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statusData = getStatusChartData();
  const priorityData = getPriorityChartData();
  const propertyTypeData = getPropertyTypeData();
  const trendData = getTrendData();
  const completionData = getCompletionTimeData();
  const slaData = getSLACompliance();
  const totalFiltered = applyPeriodFilter(dateFilteredWorkOrders, statusChartFilter).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of all work orders</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="relative" ref={datePickerRef}>
            <button 
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700 font-medium">
                {startDate && endDate 
                  ? `${formatDateIST(startDate)} - ${formatDateIST(endDate)}`
                  : startDate 
                    ? `From ${formatDateIST(startDate)}`
                    : endDate
                      ? `Until ${formatDateIST(endDate)}`
                      : 'All Time'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>

            {showDatePicker && (
              <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-5 z-50 min-w-[300px]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy"
                        value={startDateDisplay}
                        onChange={(e) => {
                          handleDateInput(e.target.value, setStartDateDisplay);
                          const parsed = parseISTDate(e.target.value);
                          if (parsed) setStartDate(parsed);
                        }}
                        onBlur={() => {
                          const parsed = parseISTDate(startDateDisplay);
                          if (parsed) setStartDate(parsed);
                          else if (startDateDisplay && startDateDisplay.length < 10) setStartDateDisplay('');
                        }}
                        className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
                      />
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                        <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setStartDate(e.target.value); setStartDateDisplay(formatDateIST(e.target.value)); }}} />
                        <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy"
                        value={endDateDisplay}
                        onChange={(e) => {
                          handleDateInput(e.target.value, setEndDateDisplay);
                          const parsed = parseISTDate(e.target.value);
                          if (parsed) setEndDate(parsed);
                        }}
                        onBlur={() => {
                          const parsed = parseISTDate(endDateDisplay);
                          if (parsed) setEndDate(parsed);
                          else if (endDateDisplay && endDateDisplay.length < 10) setEndDateDisplay('');
                        }}
                        className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400"
                      />
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                        <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setEndDate(e.target.value); setEndDateDisplay(formatDateIST(e.target.value)); }}} />
                        <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(start.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(start.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(start.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Last 3 Months
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(start.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Last Year
                    </button>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setStartDateDisplay('');
                        setEndDateDisplay('');
                      }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Refresh */}
          <button 
            onClick={() => fetchWorkOrders(true)}
            disabled={refreshing}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Create Work Order */}
          <button 
            onClick={() => navigate(`${getBasePath()}/work-orders`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        <StatCard 
          title="Total Work Orders" 
          value={stats.total} 
          percentage="100% of all work orders"
          icon={ClipboardList}
          color="blue"
          linkText="View All"
        />
        <StatCard 
          title="Pending" 
          value={stats.pending} 
          percentage={`${stats.total ? ((stats.pending / stats.total) * 100).toFixed(1) : 0}% of total`}
          icon={Clock}
          color="amber"
          linkText="View All"
        />
        <StatCard 
          title="Assigned" 
          value={stats.assigned} 
          percentage={`${stats.total ? ((stats.assigned / stats.total) * 100).toFixed(1) : 0}% of total`}
          icon={UserCheck}
          color="blue"
          linkText="View All"
        />
        <StatCard 
          title="In Progress" 
          value={stats.inProgress} 
          percentage={`${stats.total ? ((stats.inProgress / stats.total) * 100).toFixed(1) : 0}% of total`}
          icon={Play}
          color="purple"
          linkText="View All"
        />
        <StatCard 
          title="Completed" 
          value={stats.completed} 
          percentage={`${stats.total ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}% of total`}
          icon={CheckCircle}
          color="green"
          linkText="View All"
        />
        <StatCard 
          title="Closed" 
          value={stats.closed} 
          percentage={`${stats.total ? ((stats.closed / stats.total) * 100).toFixed(1) : 0}% of total`}
          icon={Archive}
          color="gray"
          linkText="View All"
        />
        <StatCard 
          title="Cancelled" 
          value={stats.cancelled} 
          percentage={`${stats.total ? ((stats.cancelled / stats.total) * 100).toFixed(1) : 0}% of total`}
          icon={XCircle}
          color="red"
          linkText="View All"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Work Orders by Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Work Orders by Status</h3>
            <PeriodDropdown value={statusChartFilter} onChange={setStatusChartFilter} />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 lg:w-36 lg:h-36 flex-shrink-0">
              <DonutChart data={statusData} centerValue={totalFiltered} />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600 truncate flex-1 min-w-0">{item.name}</span>
                  <span className="font-medium text-gray-900 flex-shrink-0">{item.value} ({totalFiltered ? ((item.value / totalFiltered) * 100).toFixed(0) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Work Orders by Priority */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Work Orders by Priority</h3>
            <PeriodDropdown value={priorityChartFilter} onChange={setPriorityChartFilter} />
          </div>
          {(() => {
            const priorityTotal = applyPeriodFilter(dateFilteredWorkOrders, priorityChartFilter).length;
            return (
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 lg:w-36 lg:h-36 flex-shrink-0">
                  <DonutChart data={priorityData} centerValue={priorityTotal} />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  {priorityData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 truncate flex-1 min-w-0">{item.name}</span>
                      <span className="font-medium text-gray-900 flex-shrink-0">{item.value} ({priorityTotal ? ((item.value / priorityTotal) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Work Orders by Property Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Work Orders by Property Type</h3>
            <PeriodDropdown value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
          </div>
          <div className="space-y-3">
            {propertyTypeData.length > 0 ? (
              (() => {
                const total = propertyTypeData.reduce((sum, d) => sum + d.value, 0);
                const maxValue = propertyTypeData[0]?.value || 1;
                return propertyTypeData.slice(0, 5).map((item, index) => (
                  <div key={index} className="space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between items-center gap-2 text-xs">
                      <span className="text-gray-600 truncate flex-1 min-w-0">{item.name}</span>
                      <span className="font-medium text-gray-900 flex-shrink-0">{item.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.max(5, (item.value / maxValue) * 100)}%`,
                          backgroundColor: item.color
                        }}
                      ></div>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <p className="font-semibold text-gray-900 text-sm mb-1">{item.name}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-600">Count:</span>
                        <span className="font-bold text-gray-900">{item.value} work orders</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}% of total</p>
                    </div>
                  </div>
                ));
              })()
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="text-xs">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Work Orders by Category Trend</h3>
          <PeriodDropdown value={categoryTrendFilter} onChange={setCategoryTrendFilter} />
        </div>
        {(() => {
          const categoryTrend = getCategoryTrendData();
          return (
            <>
              <div className="flex flex-wrap items-center gap-4 mb-4">
                {categoryTrend.categories.map((cat, index) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryColors[index % categoryColors.length] }}></div>
                    <span className="text-xs text-gray-600">{cat}</span>
                  </div>
                ))}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={categoryTrend.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                      }}
                    />
                    {categoryTrend.categories.map((cat, index) => (
                      <Line 
                        key={cat}
                        type="monotone" 
                        dataKey={cat} 
                        stroke={categoryColors[index % categoryColors.length]} 
                        strokeWidth={2} 
                        dot={{ fill: categoryColors[index % categoryColors.length], strokeWidth: 0, r: 4 }} 
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          );
        })()}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Work Orders Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Work Orders Trend</h3>
            <PeriodDropdown value={trendPeriod} onChange={setTrendPeriod} />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
              <span className="text-xs text-gray-600">Created</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span className="text-xs text-gray-600">Cancelled</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}
                />
                <Line type="monotone" dataKey="Created" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', strokeWidth: 0, r: 4 }} />
                <Line type="monotone" dataKey="Completed" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', strokeWidth: 0, r: 4 }} />
                <Line type="monotone" dataKey="Cancelled" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', strokeWidth: 0, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Completion Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Average Completion Time</h3>
            <PeriodDropdown value={completionTimeFilter} onChange={setCompletionTimeFilter} />
          </div>
          <div className="flex gap-6">
            {/* Left side - Average and Priority bars */}
            <div className="flex-1">
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900">{completionData.average}</div>
                <div className="text-xs text-gray-500">Days</div>
              </div>
              <div className="text-xs font-medium text-gray-700 mb-3">By Priority (Days)</div>
              <div className="space-y-3">
                {completionData.byPriority.map((item, index) => (
                  <div key={index} className="space-y-1 group relative cursor-pointer">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-medium text-gray-900">{item.days} Days</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${Math.max(10, (item.days / 5) * 100)}%`,
                          backgroundColor: item.color
                        }}
                      ></div>
                    </div>
                    {/* Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      <p className="font-semibold text-gray-900 text-sm mb-1">{item.name} Priority</p>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-600">Avg Completion:</span>
                        <span className="font-bold text-gray-900">{item.days} days</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right side - SLA Compliance */}
            <div className="w-48 border-l border-gray-200 pl-6">
              <div className="text-xs font-medium text-gray-700 mb-3">SLA Compliance</div>
              <div className="relative w-28 h-28 mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slaData.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={48}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {slaData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
                              <p className="font-semibold text-gray-900 text-sm mb-1">{data.name}</p>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
                                <span className="text-gray-600">Count:</span>
                                <span className="font-bold text-gray-900">{data.value}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                      <tspan x="50%" dy="-2" className="text-lg font-bold fill-gray-900">{slaData.percentage}%</tspan>
                      <tspan x="50%" dy="14" className="text-[9px] fill-gray-500">Met</tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">Met SLA</span>
                  </div>
                  <span className="font-medium">{slaData.met} ({slaData.percentage}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-gray-600">Missed SLA</span>
                  </div>
                  <span className="font-medium">{slaData.missed} ({100 - slaData.percentage}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, percentage, icon: Icon, color, linkText }) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', text: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-600' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', text: 'text-purple-600' },
    green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', text: 'text-green-600' },
    gray: { bg: 'bg-gray-50', icon: 'bg-gray-100 text-gray-600', text: 'text-gray-600' },
    red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', text: 'text-red-600' }
  };
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`${colors.bg} rounded-xl p-4 border border-gray-100`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colors.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-gray-500 whitespace-nowrap">{percentage}</p>
      <button className={`text-xs ${colors.text} font-medium mt-2 flex items-center gap-1 hover:underline`}>
        {linkText} <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
};

export default WorkOrdersDashboard;
