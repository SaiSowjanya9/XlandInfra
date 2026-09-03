import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2,
  Users,
  ClipboardList,
  Store,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  UserCog,
  UserCheck,
  Briefcase,
  Shield,
  Plus,
  UserPlus,
  Bell,
  X,
  AlertTriangle,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import EstimatesOverviewBlocks from '../components/EstimatesOverviewBlocks';
import DonutChart from '../components/common/DonutChart';
import DateRangeFilter from '../components/common/DateRangeFilter';
import { PendingSchedulesBadge, usePendingSchedulesCount } from '../components/scheduling/PropertyScheduleNotificationCard';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const FPDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isFPManager = user?.role === 'manager';
  
  // Pending schedules count
  const { count: pendingSchedulesCount } = usePendingSchedulesCount('franchise');
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [propertyChartFilter, setPropertyChartFilter] = useState('all');
  const [woStatusFilter, setWoStatusFilter] = useState('all');
  const [woPriorityFilter, setWoPriorityFilter] = useState('all');
  const [woPropertyTypeFilter, setWoPropertyTypeFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const lastFetchRef = useRef(0);

  // Main date filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef(null);

  // Notification states
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  // Get read/dismissed notification IDs from localStorage
  const getReadNotifications = () => {
    try {
      return JSON.parse(localStorage.getItem('fp_read_notifications') || '[]');
    } catch { return []; }
  };

  const getDismissedNotifications = () => {
    try {
      return JSON.parse(localStorage.getItem('fp_dismissed_notifications') || '[]');
    } catch { return []; }
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/fp/work-orders/approaching-deletion`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        const readIds = getReadNotifications();
        const dismissedIds = getDismissedNotifications();
        
        const woNotifications = result.data
          .filter(wo => !dismissedIds.includes(`wo-delete-${wo.id}`))
          .map(wo => ({
            id: `wo-delete-${wo.id}`,
            type: 'warning',
            workOrderId: wo.workOrderId,
            daysRemaining: wo.daysUntilDeletion,
            read: readIds.includes(`wo-delete-${wo.id}`)
          }));
        setNotifications(woNotifications);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    }
  }, []);

  // Mark notification as read
  const markAsRead = (id) => {
    const readIds = getReadNotifications();
    if (!readIds.includes(id)) {
      localStorage.setItem('fp_read_notifications', JSON.stringify([...readIds, id]));
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Mark all as read
  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('fp_read_notifications', JSON.stringify(allIds));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Dismiss notification
  const dismissNotification = (id) => {
    const dismissedIds = getDismissedNotifications();
    localStorage.setItem('fp_dismissed_notifications', JSON.stringify([...dismissedIds, id]));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    // Prevent duplicate fetches within 2 seconds
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) {
      return;
    }
    lastFetchRef.current = now;

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = getAuthToken();
      const [dashboardRes, estimatesRes, workOrdersRes, propertiesRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE}/api/fp/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE}/api/fp/estimates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/fp/work-orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/fp/properties`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/api/payments/invoices`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => ({ ok: false }))
      ]);
      
      const [dashResult, estResult, woResult, propResult, invResult] = await Promise.all([
        dashboardRes.json(), 
        estimatesRes.json(), 
        workOrdersRes.json(), 
        propertiesRes.json(),
        invoicesRes.ok ? invoicesRes.json() : { success: false, data: [] }
      ]);
      
      if (dashResult.success) {
        setStats(dashResult.data.stats);
      } else {
        setError(dashResult.message || 'Failed to load dashboard');
      }
      
      if (estResult.success && Array.isArray(estResult.data)) {
        setEstimates(estResult.data);
      }
      
      if (woResult.success && Array.isArray(woResult.data)) {
        setWorkOrders(woResult.data);
      }
      
      if (propResult.success && Array.isArray(propResult.data)) {
        setProperties(propResult.data);
      }
      
      if (invResult.success && Array.isArray(invResult.data)) {
        setInvoices(invResult.data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardData(true);
  }, []);
  
  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh when navigating back to dashboard
  useEffect(() => {
    if (location.pathname === '/fp/dashboard' || location.pathname === '/fp') {
      fetchDashboardData(false);
    }
  }, [location.pathname]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(false);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboardData]);

  // Date formatting helpers
  const formatDateIST = (dateStr) => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month, day] = dateStr.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateStr + 'T00:00:00');
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const parseISTDate = (displayStr) => {
    if (!displayStr || displayStr.length < 10) return null;
    const parts = displayStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  };

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

  // Filter data by main date range
  const dateFilteredWorkOrders = startDate && endDate ? workOrders.filter(wo => {
    const woDate = new Date(wo.created_at || wo.createdAt);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return woDate >= start && woDate <= end;
  }) : workOrders;

  const dateFilteredEstimates = startDate && endDate ? estimates.filter(est => {
    const estDate = new Date(est.created_at || est.createdAt);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return estDate >= start && estDate <= end;
  }) : estimates;

  const dateFilteredProperties = startDate && endDate ? properties.filter(p => {
    const pDate = new Date(p.created_at || p.createdAt);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return pDate >= start && pDate <= end;
  }) : properties;

  // Helper function to normalize status
  const getWOStatus = (wo) => (wo.status || '').toString().trim().toLowerCase().replace(/[_\s-]/g, '');

  // Period filter helper
  const applyPeriodFilter = (data, period) => {
    if (period === 'all') return data;
    const now = new Date();
    const startDate = new Date();
    switch (period) {
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'sixmonths': startDate.setMonth(now.getMonth() - 6); break;
      case 'year': startDate.setMonth(0, 1); startDate.setHours(0,0,0,0); break; // Jan 1 of current year
      default: return data;
    }
    return data.filter(item => {
      const date = new Date(item.created_at || item.createdAt);
      return date >= startDate && date <= now;
    });
  };

  // Period dropdown component
  const PeriodDropdown = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="all">All Time</option>
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="quarter">This Quarter</option>
      <option value="sixmonths">Last 6 Months</option>
      <option value="year">This Year</option>
    </select>
  );

  // Filtered work orders for each chart (use dateFilteredWorkOrders as base)
  const statusFilteredWO = applyPeriodFilter(dateFilteredWorkOrders, woStatusFilter);
  const priorityFilteredWO = applyPeriodFilter(dateFilteredWorkOrders, woPriorityFilter);
  const propertyTypeFilteredWO = applyPeriodFilter(dateFilteredWorkOrders, woPropertyTypeFilter);

  // Work Orders by Status data - computed from filtered workOrders
  const pendingWO = statusFilteredWO.filter(wo => getWOStatus(wo) === 'pending').length;
  const assignedWO = statusFilteredWO.filter(wo => getWOStatus(wo) === 'assigned').length;
  const inProgressWO = statusFilteredWO.filter(wo => getWOStatus(wo) === 'inprogress').length;
  const completedWO = statusFilteredWO.filter(wo => getWOStatus(wo) === 'completed').length;
  const closedWO = statusFilteredWO.filter(wo => getWOStatus(wo) === 'closed').length;
  const cancelledWO = statusFilteredWO.filter(wo => getWOStatus(wo) === 'cancelled').length;
  
  // Use filtered count as total for status chart
  const totalWorkOrders = statusFilteredWO.length;
  
  // Work Order Status data for chart
  const woStatusData = [
    { name: 'Pending', value: pendingWO, color: '#F59E0B' },
    { name: 'Assigned', value: assignedWO, color: '#3B82F6' },
    { name: 'In Progress', value: inProgressWO, color: '#8B5CF6' },
    { name: 'Completed', value: completedWO, color: '#10B981' },
    { name: 'Closed', value: closedWO, color: '#6B7280' },
    { name: 'Cancelled', value: cancelledWO, color: '#EF4444' },
  ];
  
  // Keep backward compatibility
  const workOrdersByStatus = {
    pending: pendingWO,
    assigned: assignedWO,
    in_progress: inProgressWO,
    completed: completedWO,
    closed: closedWO,
    cancelled: cancelledWO
  };

  // Work Orders by Priority data (using priority filtered data)
  const lowPriorityWO = priorityFilteredWO.filter(wo => (wo.priority || '').toLowerCase() === 'low').length;
  const mediumPriorityWO = priorityFilteredWO.filter(wo => (wo.priority || '').toLowerCase() === 'medium').length;
  const highPriorityWO = priorityFilteredWO.filter(wo => (wo.priority || '').toLowerCase() === 'high').length;
  const urgentPriorityWO = priorityFilteredWO.filter(wo => (wo.priority || '').toLowerCase() === 'urgent').length;
  const unassignedPriorityWO = priorityFilteredWO.filter(wo => {
    const p = (wo.priority || '').toLowerCase();
    return p !== 'low' && p !== 'medium' && p !== 'high' && p !== 'urgent' && p !== '';
  }).length;
  const priorityTotal = priorityFilteredWO.length;
  
  const priorityData = [
    { name: 'Low', value: lowPriorityWO, color: '#10B981' },
    { name: 'Medium', value: mediumPriorityWO, color: '#F59E0B' },
    { name: 'High', value: highPriorityWO, color: '#EF4444' },
    ...(urgentPriorityWO > 0 ? [{ name: 'Urgent', value: urgentPriorityWO, color: '#7C3AED' }] : []),
    ...(unassignedPriorityWO > 0 ? [{ name: 'Unassigned', value: unassignedPriorityWO, color: '#9CA3AF' }] : []),
  ];

  // Work Orders by Property Type data (using property type filtered data)
  const propertyTypeColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
  const propertyTypeCounts = propertyTypeFilteredWO.reduce((acc, wo) => {
    const type = wo.property_type || wo.propertyType || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const woPropertyTypeData = Object.entries(propertyTypeCounts)
    .map(([name, value], index) => ({ name, value, color: propertyTypeColors[index % propertyTypeColors.length] }))
    .sort((a, b) => b.value - a.value);

  // Stacked bar chart data - Property types with Direct vs Property-based breakdown
  const est = stats?.estimatesByPropertyType || {};
  const directCount = stats?.directEstimates || 0;
  const propertyCount = stats?.propertyEstimates || 0;
  
  // Data for stacked bar: Each property type shows Direct + Property-based counts
  const stackedBarData = [
    { name: 'GC', direct: est.direct_gc || 0, property: est.prop_gc || 0 },
    { name: 'Apartment', direct: est.direct_apt || 0, property: est.prop_apt || 0 },
    { name: 'Villa', direct: est.direct_villa || 0, property: est.prop_villa || 0 },
    { name: 'Flat', direct: est.direct_flat || 0, property: est.prop_flat || 0 },
    { name: 'Plot', direct: est.direct_plot || 0, property: est.prop_plot || 0 },
  ].filter(item => item.direct > 0 || item.property > 0); // Only show property types with data
  
  // Add "Other" category for direct estimates without property type
  if ((est.direct_other || 0) > 0) {
    stackedBarData.unshift({ name: 'Other', direct: est.direct_other || 0, property: 0 });
  }
  
  const totalEstimates = directCount + propertyCount;

  // Estimates by status data
  const estStatus = stats?.estimatesByStatus || {};
  const statusData = [
    { name: 'Draft', direct: estStatus.direct_draft || 0, property: estStatus.prop_draft || 0, color: '#6B7280' },
    { name: 'Sent', direct: estStatus.direct_sent || 0, property: estStatus.prop_sent || 0, color: '#3B82F6' },
    { name: 'Approved', direct: estStatus.direct_approved || 0, property: estStatus.prop_approved || 0, color: '#10B981' },
    { name: 'Rejected', direct: estStatus.direct_rejected || 0, property: estStatus.prop_rejected || 0, color: '#EF4444' },
  ];

  // Properties by Type data with time filter
  const getFilteredProperties = () => {
    // Use dateFilteredProperties as base
    if (propertyChartFilter === 'all') return dateFilteredProperties;
    
    const now = new Date();
    let filterStart = new Date();
    
    switch (propertyChartFilter) {
      case 'week':
        filterStart.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterStart.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        filterStart.setMonth(now.getMonth() - 3);
        break;
      case 'sixmonths':
        filterStart.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        filterStart.setMonth(0, 1); filterStart.setHours(0,0,0,0); // Jan 1 of current year
        break;
      default:
        return dateFilteredProperties;
    }
    
    return dateFilteredProperties.filter(p => {
      const createdAt = new Date(p.created_at || p.createdAt);
      return createdAt >= filterStart;
    });
  };

  const filteredProperties = getFilteredProperties();
  
  // Normalize property type names
  const normalizePropertyType = (type) => {
    if (!type) return 'Other';
    const t = type.toLowerCase().trim();
    if (t.includes('gated') || t === 'gc') return 'Gated Community';
    if (t.includes('apartment') || t === 'apt') return 'Apartment';
    if (t.includes('villa')) return 'Villa';
    if (t.includes('flat')) return 'Flat';
    if (t.includes('plot')) return 'Plot';
    return type;
  };

  const propertyTypeData = (() => {
    const colors = {
      'Gated Community': '#3B82F6',
      'Apartment': '#8B5CF6',
      'Villa': '#10B981',
      'Flat': '#F59E0B',
      'Plot': '#EF4444',
      'Other': '#6B7280'
    };
    
    // Initialize all default types with 0
    const typeCounts = {
      'Gated Community': 0,
      'Apartment': 0,
      'Villa': 0,
      'Flat': 0,
      'Plot': 0
    };
    
    filteredProperties.forEach(p => {
      const type = normalizePropertyType(p.property_type || p.propertyType || p.type);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    return Object.entries(typeCounts)
      .map(([name, value]) => ({ 
        name, 
        value, 
        color: colors[name] || '#6B7280' 
      }))
      .sort((a, b) => b.value - a.value);
  })();

  const totalPropertiesCount = filteredProperties.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats Cards - Single Row Layout */}
      <div className="flex items-center justify-between gap-4 flex-nowrap overflow-visible">
        <div className="flex items-center gap-6 flex-nowrap">
          <div className="shrink-0 min-w-max">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">
              Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Partner'}!
            </h1>
            <p className="text-gray-500 mt-1 whitespace-nowrap">Here's what's happening with your business today.</p>
          </div>
          <div className="flex items-center gap-2 flex-nowrap">
            <Link to="/fp/properties" className="bg-white rounded-lg border border-gray-100 px-3 py-2 hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Properties</p>
                  <p className="text-lg font-bold text-gray-900">{stats?.properties || 0}</p>
                </div>
              </div>
            </Link>
            <Link to="/fp/vendors" className="bg-white rounded-lg border border-gray-100 px-3 py-2 hover:shadow-md hover:border-amber-200 transition-all duration-200 group">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Vendors</p>
                  <p className="text-lg font-bold text-gray-900">{stats?.vendors || 0}</p>
                </div>
              </div>
            </Link>
            <Link to="/fp/employees" className="bg-white rounded-lg border border-gray-100 px-3 py-2 hover:shadow-md hover:border-orange-200 transition-all duration-200 group">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Employees</p>
                  <p className="text-lg font-bold text-gray-900">{stats?.employees || 0}</p>
                </div>
              </div>
            </Link>
            {/* Pending Schedules Card */}
            {pendingSchedulesCount > 0 && (
              <Link to="/fp/schedules/pending" className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200 px-3 py-2 hover:shadow-md hover:border-orange-300 transition-all duration-200 group relative">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-orange-600 font-medium">Pending Schedules</p>
                    <p className="text-lg font-bold text-orange-700">{pendingSchedulesCount}</p>
                  </div>
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                </span>
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Main Date Range Picker */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              setStartDateDisplay(start ? new Date(start + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/') : '');
              setEndDateDisplay(end ? new Date(end + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/') : '');
            }}
            onRefresh={() => fetchDashboardData(false)}
            showRefreshButton={true}
          />
          
          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Mark All Read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center">
                      <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">No notifications</p>
                    </div>
                  ) : (
                    <div>
                      {notifications.some(n => n.type === 'warning') && (
                        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                          <div className="flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-xs font-medium">Work Orders Approaching Auto-Delete</span>
                          </div>
                        </div>
                      )}
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => !notification.read && markAsRead(notification.id)}
                          className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                            !notification.read ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className="relative">
                                <div className="p-1.5 rounded-lg bg-amber-100">
                                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                                </div>
                                {!notification.read && (
                                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
                                )}
                              </div>
                              <div>
                                <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                                  {notification.workOrderId}
                                </p>
                                <p className="text-xs text-amber-600 mt-0.5">
                                  {notification.daysRemaining} days until auto-delete
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissNotification(notification.id); }}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDashboardData(false)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Properties Overview Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Properties Overview</h2>
            <p className="text-sm text-gray-500 mt-1">Distribution by property type</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={propertyChartFilter}
              onChange={(e) => setPropertyChartFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="sixmonths">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
            <Link to="/fp/properties" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart - Vertical bars with softer look */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyTypeData} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: '#1f2937', fontWeight: 500 }} 
                  stroke="#E5E7EB" 
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickLine={false}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                  interval={0}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#1f2937', fontWeight: 500 }} 
                  stroke="#E5E7EB" 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                    fontSize: '12px'
                  }}
                  formatter={(value) => [`${value} properties`, 'Count']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32} fillOpacity={0.85}>
                  {propertyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Summary - Compact */}
          <div className="space-y-2">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Total Properties</p>
                  <p className="text-2xl font-bold text-blue-700">{totalPropertiesCount}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {propertyTypeData.slice(0, 4).map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="text-xs font-medium text-gray-700 truncate">{item.name}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{item.value}</p>
                  <p className="text-[10px] text-gray-500">
                    {totalPropertiesCount ? ((item.value / totalPropertiesCount) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Combined Work Orders + Estimates Overview Box */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        {/* Work Orders Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
            <Link to="/fp/work-orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Three Chart Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Work Orders by Status */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 min-w-0">
              <div className="flex justify-between items-center mb-4 gap-2">
                <h3 className="text-sm font-semibold text-gray-900 whitespace-nowrap">Work Orders by Status</h3>
                <PeriodDropdown value={woStatusFilter} onChange={setWoStatusFilter} />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 flex-shrink-0">
                  <DonutChart
                    data={woStatusData}
                    centerValue={totalWorkOrders}
                    size={112}
                    strokeWidth={16}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {woStatusData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color, minWidth: '8px', minHeight: '8px' }}></span>
                      <span className="text-gray-600 truncate">{item.name}</span>
                      <span className="font-medium text-gray-900 whitespace-nowrap ml-auto">{item.value} ({totalWorkOrders ? ((item.value / totalWorkOrders) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Work Orders by Priority */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 min-w-0">
              <div className="flex justify-between items-center mb-4 gap-2">
                <h3 className="text-sm font-semibold text-gray-900 whitespace-nowrap">Work Orders by Priority</h3>
                <PeriodDropdown value={woPriorityFilter} onChange={setWoPriorityFilter} />
              </div>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 flex-shrink-0">
                  <DonutChart
                    data={priorityData}
                    centerValue={priorityTotal || totalWorkOrders}
                    size={112}
                    strokeWidth={16}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {priorityData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color, minWidth: '8px', minHeight: '8px' }}></span>
                      <span className="text-gray-600 truncate">{item.name}</span>
                      <span className="font-medium text-gray-900 whitespace-nowrap ml-auto">{item.value} ({(priorityTotal || totalWorkOrders) ? ((item.value / (priorityTotal || totalWorkOrders)) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Work Orders by Property Type */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 min-w-0">
              <div className="flex justify-between items-center mb-4 gap-2">
                <h3 className="text-sm font-semibold text-gray-900 whitespace-nowrap">Work Orders by Property Type</h3>
                <PeriodDropdown value={woPropertyTypeFilter} onChange={setWoPropertyTypeFilter} />
              </div>
              <div className="space-y-3">
                {(() => {
                  // Default property types to always show
                  const defaultTypes = [
                    { name: 'Gated Community', color: '#3B82F6' },
                    { name: 'Apartment', color: '#8B5CF6' },
                    { name: 'Villa', color: '#10B981' },
                    { name: 'Plot', color: '#F59E0B' },
                    { name: 'Flat', color: '#EF4444' },
                  ];
                  
                  // Merge with actual data
                  const mergedData = defaultTypes.map(dt => {
                    const found = woPropertyTypeData.find(p => p.name.toLowerCase() === dt.name.toLowerCase());
                    return { ...dt, value: found?.value || 0 };
                  });
                  
                  // Add any property types from data that aren't in defaults
                  woPropertyTypeData.forEach(p => {
                    if (!mergedData.find(m => m.name.toLowerCase() === p.name.toLowerCase())) {
                      mergedData.push(p);
                    }
                  });
                  
                  const maxValue = Math.max(...mergedData.map(d => d.value), 1);
                  const total = mergedData.reduce((sum, d) => sum + d.value, 0);
                  
                  return mergedData.slice(0, 5).map((item, index) => (
                    <div key={index} className="space-y-1 group relative cursor-pointer">
                      <div className="flex justify-between items-center gap-2 text-xs">
                        <span className="text-gray-600 truncate flex-1 min-w-0">{item.name}</span>
                        <span className="font-medium text-gray-900 flex-shrink-0">{item.value}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        {item.value > 0 && (
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${Math.max(5, (item.value / maxValue) * 100)}%`,
                              backgroundColor: item.color
                            }}
                          ></div>
                        )}
                      </div>
                      {/* Tooltip */}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                        <p className="font-semibold text-gray-900 text-sm mb-1">{item.name}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color, minWidth: '12px', minHeight: '12px' }}></span>
                          <span className="text-gray-600">Count:</span>
                          <span className="font-bold text-gray-900">{item.value} work orders</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}% of total</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100"></div>

        {/* Estimates Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Estimates Overview</h2>
            <Link to="/fp/estimates" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <EstimatesOverviewBlocks estimates={dateFilteredEstimates} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100"></div>

        {/* Payments Overview Section - Centered and Large */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Payments Overview</h2>
            <Link to="/fp/billing/payments" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Invoices by Payment Status Chart - Centered and Large */}
          <div className="flex justify-center">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 w-full max-w-2xl">
              <div className="flex justify-between items-center mb-6 gap-4">
                <h3 className="text-lg font-semibold text-gray-900">Invoices by Payment Status</h3>
                <div className="relative">
                  <select 
                    value={invoiceStatusFilter} 
                    onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                    className="appearance-none text-sm text-gray-700 border border-gray-200 rounded-lg pl-4 pr-10 py-2 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">All Time</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="sixmonths">Last 6 Months</option>
                    <option value="year">This Year</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-12">
                {(() => {
                  // Calculate invoice status data
                  const statusCounts = {
                    paid: invoices.filter(inv => inv.status === 'paid').length,
                    partially_paid: invoices.filter(inv => inv.status === 'partially_paid').length,
                    unpaid: invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'pending' || inv.status === 'sent').length,
                    overdue: invoices.filter(inv => inv.status === 'overdue').length,
                  };
                  const total = invoices.length;
                  
                  const invoiceStatusData = [
                    { name: 'Paid', value: statusCounts.paid, color: '#22C55E' },
                    { name: 'Partially Paid', value: statusCounts.partially_paid, color: '#3B82F6' },
                    { name: 'Unpaid', value: statusCounts.unpaid, color: '#F59E0B' },
                    { name: 'Overdue', value: statusCounts.overdue, color: '#EF4444' },
                  ];

                  return (
                    <>
                      <div className="w-48 h-48 flex-shrink-0">
                        <DonutChart
                          data={invoiceStatusData}
                          centerValue={total}
                          size={192}
                          strokeWidth={24}
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-4 max-w-xs">
                        {invoiceStatusData.map((item, index) => (
                          <div key={index} className="flex items-center gap-3 text-base">
                            <span className="inline-block w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                            <span className="text-gray-600">{item.name}</span>
                            <span className="font-bold text-gray-900 ml-auto text-lg">{item.value}</span>
                            <span className="text-gray-400 text-sm">({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Your Team Section - Horizontal Strip */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Team</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <UserCog className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-700">{stats?.employeeRoles?.managers || 0}</p>
                <p className="text-sm text-indigo-600">Managers</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats?.employeeRoles?.coordinators || 0}</p>
                <p className="text-sm text-purple-600">Coordinators</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats?.employeeRoles?.supervisors || 0}</p>
                <p className="text-sm text-amber-600">Supervisors</p>
              </div>
            </div>
          </div>

          <div className="bg-teal-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-700">{stats?.employeeRoles?.executives || 0}</p>
                <p className="text-sm text-teal-600">Executives</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/fp/customers/add')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Add Customer</p>
                <p className="text-xs text-gray-500">Register new customer</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/fp/work-orders')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Create Work Order</p>
                <p className="text-xs text-gray-500">Create a new work order</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/fp/employees/add')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Add Employee</p>
                <p className="text-xs text-gray-500">Add new team member</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/fp/estimates/create')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-teal-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Create Estimate</p>
                <p className="text-xs text-gray-500">Create new estimate</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FPDashboard;
