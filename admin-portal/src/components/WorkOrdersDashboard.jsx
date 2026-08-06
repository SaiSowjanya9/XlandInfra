import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [statusChartFilter, setStatusChartFilter] = useState('all');
  const [priorityChartFilter, setPriorityChartFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const [completionTimeFilter, setCompletionTimeFilter] = useState('all');
  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  const datePickerRef = useRef(null);

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

  // Calculate stats
  const getStats = () => {
    const total = workOrders.length;
    const normalizeStatus = (status) => status?.toLowerCase().replace('-', '_').replace(' ', '_');
    const pending = workOrders.filter(wo => normalizeStatus(wo.status) === 'pending').length;
    const assigned = workOrders.filter(wo => normalizeStatus(wo.status) === 'assigned').length;
    const inProgress = workOrders.filter(wo => normalizeStatus(wo.status) === 'in_progress').length;
    const completed = workOrders.filter(wo => normalizeStatus(wo.status) === 'completed').length;
    const closed = workOrders.filter(wo => normalizeStatus(wo.status) === 'closed').length;
    const cancelled = workOrders.filter(wo => normalizeStatus(wo.status) === 'cancelled').length;
    
    return { total, pending, assigned, inProgress, completed, closed, cancelled };
  };

  const stats = getStats();

  // Status chart data
  const getStatusChartData = () => {
    const filtered = applyPeriodFilter(workOrders, statusChartFilter);
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
    const filtered = applyPeriodFilter(workOrders, priorityChartFilter);
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
    const filtered = applyPeriodFilter(workOrders, propertyTypeFilter);
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

  // Trend data
  const getTrendData = () => {
    const now = new Date();
    const months = [];
    const monthCount = trendPeriod === 'monthly' ? 6 : 12;
    
    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        startDate: date,
        endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0)
      });
    }

    return months.map(({ month, startDate, endDate }) => {
      const monthWOs = workOrders.filter(wo => {
        const woDate = new Date(wo.created_at || wo.createdAt);
        return woDate >= startDate && woDate <= endDate;
      });

      return {
        name: month,
        Created: monthWOs.length,
        Completed: monthWOs.filter(wo => wo.status === 'completed').length,
        Cancelled: monthWOs.filter(wo => wo.status === 'cancelled').length
      };
    });
  };

  // Average completion time data
  const getCompletionTimeData = () => {
    const filtered = applyPeriodFilter(workOrders, completionTimeFilter);
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
    const filtered = applyPeriodFilter(workOrders, completionTimeFilter);
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
      className={`text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
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
  const totalFiltered = applyPeriodFilter(workOrders, statusChartFilter).length;

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
              <span>{dateRange.start || dateRange.end ? `${dateRange.start || '...'} - ${dateRange.end || '...'}` : 'Select Date Range'}</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Work Orders by Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Work Orders by Status</h3>
            <PeriodDropdown value={statusChartFilter} onChange={setStatusChartFilter} />
          </div>
          <div className="flex items-center">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={totalFiltered > 0 ? statusData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {(totalFiltered > 0 ? statusData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                    <tspan x="50%" dy="-5" className="text-2xl font-bold fill-gray-900">{totalFiltered}</tspan>
                    <tspan x="50%" dy="18" className="text-xs fill-gray-500">Total</tspan>
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 ml-4 space-y-2">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600 w-20 flex-shrink-0">{item.name}</span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">{item.value} ({totalFiltered ? ((item.value / totalFiltered) * 100).toFixed(1) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Work Orders by Priority */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Work Orders by Priority</h3>
            <PeriodDropdown value={priorityChartFilter} onChange={setPriorityChartFilter} />
          </div>
          {(() => {
            const priorityTotal = applyPeriodFilter(workOrders, priorityChartFilter).length;
            const chartData = priorityTotal > 0 ? priorityData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }];
            return (
              <div className="flex items-center">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-5" className="text-2xl font-bold fill-gray-900">{priorityTotal}</tspan>
                        <tspan x="50%" dy="18" className="text-xs fill-gray-500">Total</tspan>
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 ml-4 space-y-3">
                  {priorityData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 w-16 flex-shrink-0">{item.name}</span>
                      <span className="font-medium text-gray-900 whitespace-nowrap">{item.value} ({priorityTotal ? ((item.value / priorityTotal) * 100).toFixed(1) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Work Orders by Property Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Work Orders by Property Type</h3>
            <PeriodDropdown value={propertyTypeFilter} onChange={setPropertyTypeFilter} />
          </div>
          <div className="space-y-3">
            {propertyTypeData.length > 0 ? (
              propertyTypeData.slice(0, 5).map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name}</span>
                    <span className="font-medium text-gray-900">{item.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${Math.max(5, (item.value / (propertyTypeData[0]?.value || 1)) * 100)}%`,
                        backgroundColor: item.color
                      }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Orders Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Work Orders Trend</h3>
            <select 
              value={trendPeriod} 
              onChange={(e) => setTrendPeriod(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">Created</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-600">Cancelled</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
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
            <h3 className="font-semibold text-gray-900">Average Completion Time</h3>
            <PeriodDropdown value={completionTimeFilter} onChange={setCompletionTimeFilter} />
          </div>
          <div className="flex gap-6">
            {/* Left side - Average and Priority bars */}
            <div className="flex-1">
              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900">{completionData.average}</div>
                <div className="text-sm text-gray-500">Days</div>
              </div>
              <div className="text-sm font-medium text-gray-700 mb-3">By Priority (Days)</div>
              <div className="space-y-3">
                {completionData.byPriority.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
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
                  </div>
                ))}
              </div>
            </div>
            
            {/* Right side - SLA Compliance */}
            <div className="w-48 border-l border-gray-200 pl-6">
              <div className="text-sm font-medium text-gray-700 mb-3">SLA Compliance</div>
              <div className="relative w-32 h-32 mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slaData.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {slaData.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                      <tspan x="50%" dy="-2" className="text-xl font-bold fill-gray-900">{slaData.percentage}%</tspan>
                      <tspan x="50%" dy="14" className="text-[10px] fill-gray-500">Met</tspan>
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
