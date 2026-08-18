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
  AlertTriangle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import EstimatesOverviewBlocks from '../components/EstimatesOverviewBlocks';
import DonutChart from '../components/common/DonutChart';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const FPDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isFPManager = user?.role === 'manager';
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyChartFilter, setPropertyChartFilter] = useState('all');
  const lastFetchRef = useRef(0);

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
      const [dashboardRes, estimatesRes, workOrdersRes, propertiesRes] = await Promise.all([
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
        })
      ]);
      
      const [dashResult, estResult, woResult, propResult] = await Promise.all([dashboardRes.json(), estimatesRes.json(), workOrdersRes.json(), propertiesRes.json()]);
      
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
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Refresh when navigating back to dashboard
  useEffect(() => {
    // This runs when location changes and we're on the dashboard
    if (location.pathname === '/fp/dashboard' || location.pathname === '/fp') {
      fetchDashboardData(false);
    }
  }, [location.pathname, fetchDashboardData]);

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

  // Work Orders by Status data - computed from workOrders array directly
  const pendingWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'pending').length;
  const assignedWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'assigned').length;
  const inProgressWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'in_progress' || (wo.status || '').toLowerCase() === 'in progress').length;
  const completedWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'completed').length;
  const closedWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'closed').length;
  const cancelledWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'cancelled').length;
  const totalWorkOrders = workOrders.length;
  
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

  // Work Orders by Priority data
  const lowPriorityWO = workOrders.filter(wo => (wo.priority || '').toLowerCase() === 'low').length;
  const mediumPriorityWO = workOrders.filter(wo => (wo.priority || '').toLowerCase() === 'medium').length;
  const highPriorityWO = workOrders.filter(wo => (wo.priority || '').toLowerCase() === 'high').length;
  const priorityTotal = lowPriorityWO + mediumPriorityWO + highPriorityWO;
  
  const priorityData = [
    { name: 'Low', value: lowPriorityWO, color: '#10B981' },
    { name: 'Medium', value: mediumPriorityWO, color: '#F59E0B' },
    { name: 'High', value: highPriorityWO, color: '#EF4444' },
  ];

  // Work Orders by Property Type data
  const propertyTypeColors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
  const propertyTypeCounts = workOrders.reduce((acc, wo) => {
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
    if (propertyChartFilter === 'all') return properties;
    
    const now = new Date();
    let startDate = new Date();
    
    switch (propertyChartFilter) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'sixmonths':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return properties;
    }
    
    return properties.filter(p => {
      const createdAt = new Date(p.created_at || p.createdAt);
      return createdAt >= startDate;
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
    const typeCounts = {};
    filteredProperties.forEach(p => {
      const type = normalizePropertyType(p.property_type || p.propertyType || p.type);
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
      <div className="flex items-center justify-between gap-4 flex-nowrap overflow-x-auto">
        <div className="flex items-center gap-6 flex-nowrap">
          <div className="shrink-0 min-w-max">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">
              Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Partner'}!
            </h1>
            <p className="text-gray-500 mt-1 whitespace-nowrap">Here's what's happening with your business today.</p>
          </div>
          <div className="flex items-center gap-3 flex-nowrap">
            <Link to="/fp/properties" className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Properties</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.properties || 0}</p>
                  <p className="text-[10px] text-gray-400">Total Properties</p>
                </div>
              </div>
            </Link>
            <Link to="/fp/vendors" className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-amber-200 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Vendors</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.vendors || 0}</p>
                  <p className="text-[10px] text-gray-400">Total Vendors</p>
                </div>
              </div>
            </Link>
            <Link to="/fp/employees" className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-orange-200 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Employees</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.employees || 0}</p>
                  <p className="text-[10px] text-gray-400">Total Employees</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
          {/* Bar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyTypeData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#9CA3AF" width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value) => [`${value} properties`, 'Count']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {propertyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Summary */}
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Properties</p>
                  <p className="text-3xl font-bold text-blue-700">{totalPropertiesCount}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {propertyTypeData.slice(0, 4).map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs text-gray-500">{item.name}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{item.value}</p>
                  <p className="text-xs text-gray-400">
                    {totalPropertiesCount ? ((item.value / totalPropertiesCount) * 100).toFixed(1) : 0}% of total
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Combined Estimates + Work Orders Overview Box */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        {/* Estimates Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Estimates Overview</h2>
            <Link to="/fp/estimates" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <EstimatesOverviewBlocks estimates={estimates} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100"></div>

        {/* Work Orders Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
            <Link to="/fp/work-orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {/* Three Chart Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Work Orders by Status */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 lg:p-6 overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Orders by Status</h3>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 lg:w-36 lg:h-36 flex-shrink-0">
                  <DonutChart
                    data={woStatusData}
                    centerValue={totalWorkOrders}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {woStatusData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 truncate flex-1 min-w-0">{item.name}</span>
                      <span className="font-medium text-gray-900 flex-shrink-0">{item.value} ({totalWorkOrders ? ((item.value / totalWorkOrders) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Work Orders by Priority */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 lg:p-6 overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Orders by Priority</h3>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 lg:w-36 lg:h-36 flex-shrink-0">
                  <DonutChart
                    data={priorityData}
                    centerValue={priorityTotal || totalWorkOrders}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  {priorityData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 truncate flex-1 min-w-0">{item.name}</span>
                      <span className="font-medium text-gray-900 flex-shrink-0">{item.value} ({(priorityTotal || totalWorkOrders) ? ((item.value / (priorityTotal || totalWorkOrders)) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Work Orders by Property Type */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 lg:p-6 overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Orders by Property Type</h3>
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
                  
                  return mergedData.slice(0, 5).map((item, index) => (
                    <div key={index} className="space-y-1">
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
                    </div>
                  ));
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
