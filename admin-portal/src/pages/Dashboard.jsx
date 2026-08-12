import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Building2, ClipboardList, Clock, CheckCircle2, FileText, Users, 
  Package, MapPin, Wrench, UserPlus, Activity,
  RefreshCw, Bell, Settings, UserCheck, Home, X, AlertCircle, Info,
  QrCode, Download, ChevronDown, Shield, ArrowLeft, ArrowRight
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import { useFP } from '../contexts/FPContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import EstimatesOverviewBlocks from '../components/EstimatesOverviewBlocks';
import DonutChart from '../components/common/DonutChart';

const API_BASE = import.meta.env.VITE_API_URL || '';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [estimates, setEstimates] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const notificationRef = useRef(null);
  const lastFetchRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get FP list and selected FP from context
  const { fpList, selectedFp, selectFp, loading: fpLoading, refreshFpList } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    if (!selectedFp) {
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches within 2 seconds
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) {
      return;
    }
    lastFetchRef.current = now;
    
    // Get fresh token for each request
    const token = getAuthToken();
    if (!token) {
      console.warn('No auth token available');
      return;
    }
    
    // Only show loading spinner on initial load, not on background refresh
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      let endpoint;
      let estimatesEndpoint;
      let workOrdersEndpoint;
      if (selectedFp.id === 'all') {
        // Admin mode - fetch aggregated data from all sources
        endpoint = `${API_BASE}/api/admin/dashboard-stats`;
        estimatesEndpoint = `${API_BASE}/api/admin/estimates`;
        workOrdersEndpoint = `${API_BASE}/api/admin/work-orders`;
      } else {
        // Specific FP selected
        endpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/dashboard`;
        estimatesEndpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/estimates`;
        workOrdersEndpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/work-orders`;
      }
      
      const [dashRes, estRes, woRes] = await Promise.all([
        fetch(endpoint, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(estimatesEndpoint, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(workOrdersEndpoint, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (!dashRes.ok) {
        throw new Error(`HTTP ${dashRes.status}`);
      }
      
      const [result, estResult, woResult] = await Promise.all([dashRes.json(), estRes.json(), woRes.json()]);
      if (result.success && result.data) {
        const data = result.data;
        // Map dashboard data to stats format with safe defaults
        setStats({
          totalProperties: data.stats?.totalProperties ?? data.totalProperties ?? 0,
          pendingWorkOrders: data.stats?.pendingWorkOrders ?? data.pendingWorkOrders ?? 0,
          completedWorkOrders: data.stats?.completedWorkOrders ?? data.completedWorkOrders ?? 0,
          totalVendors: data.stats?.totalVendors ?? data.totalVendors ?? 0,
          totalEmployees: data.stats?.totalEmployees ?? data.totalEmployees ?? 0,
          totalEstimates: data.stats?.totalEstimates ?? data.totalEstimates ?? 0,
          directEstimates: data.stats?.directEstimates ?? data.directEstimates ?? 0,
          propertyEstimates: data.stats?.propertyEstimates ?? data.propertyEstimates ?? 0,
          fpInfo: data.fpInfo || null,
          workOrdersByStatus: data.stats?.workOrdersByStatus ?? data.workOrdersByStatus ?? null
        });
        setRecentActivities(Array.isArray(data.recentWorkOrders) ? data.recentWorkOrders : []);
      } else {
        // Set empty defaults if no data
        setStats(null);
        setRecentActivities([]);
      }
      if (estResult.success && Array.isArray(estResult.data)) {
        setEstimates(estResult.data);
      }
      if (woResult.success && Array.isArray(woResult.data)) {
        setWorkOrders(woResult.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats(null);
      setRecentActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFp]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/notifications`);
      const result = await response.json();
      if (result.success && result.data) {
        setNotifications(result.data);
        setUnreadCount(result.data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Auto-select "Admin (All FPs)" if no FP is selected - skip the selection page
  useEffect(() => {
    if (!selectedFp && !fpLoading) {
      selectFp({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' });
    }
  }, [selectedFp, fpLoading, selectFp]);

  // Load dashboard data when FP changes
  useEffect(() => {
    if (selectedFp) {
      fetchDashboardData(true); // Initial load - show loading spinner
      fetchNotifications();
    }
    // Background refresh every 30 seconds - no loading spinner
    const interval = setInterval(() => {
      if (selectedFp) fetchDashboardData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData, selectedFp]);

  // Refresh when navigating back to dashboard
  useEffect(() => {
    if (location.pathname === '/admin/dashboard' || location.pathname === '/admin' || location.pathname === '/dashboard') {
      if (selectedFp) fetchDashboardData(false);
    }
  }, [location.pathname, fetchDashboardData, selectedFp]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedFp) {
        fetchDashboardData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboardData, selectedFp]);

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

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`/api/admin/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_BASE}/api/admin/notifications/read-all`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
    fetchNotifications();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return CheckCircle2;
      case 'warning': return AlertCircle;
      case 'error': return X;
      default: return Info;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'text-emerald-500 bg-emerald-50';
      case 'warning': return 'text-amber-500 bg-amber-50';
      case 'error': return 'text-red-500 bg-red-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  // Check if we have real data
  const hasData = stats !== null;

  // Work Orders by Status data - computed from workOrders array directly
  const pendingWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'pending').length;
  const assignedWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'assigned').length;
  const inProgressWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'in_progress' || (wo.status || '').toLowerCase() === 'in progress').length;
  const completedWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'completed').length;
  const closedWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'closed').length;
  const cancelledWO = workOrders.filter(wo => (wo.status || '').toLowerCase() === 'cancelled').length;
  const pieTotal = pendingWO + assignedWO + inProgressWO + completedWO + closedWO + cancelledWO;
  
  const woStatusData = [
    { name: 'Pending', value: pendingWO, color: '#F59E0B' },
    { name: 'Assigned', value: assignedWO, color: '#3B82F6' },
    { name: 'In Progress', value: inProgressWO, color: '#8B5CF6' },
    { name: 'Completed', value: completedWO, color: '#10B981' },
    { name: 'Closed', value: closedWO, color: '#6B7280' },
    { name: 'Cancelled', value: cancelledWO, color: '#EF4444' },
  ];

  const totalWorkOrders = workOrders.length;

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
  const propertyTypeData = Object.entries(propertyTypeCounts)
    .map(([name, value], index) => ({ name, value, color: propertyTypeColors[index % propertyTypeColors.length] }))
    .sort((a, b) => b.value - a.value);

  // Stacked bar chart data - Property types with Direct vs Property-based breakdown
  const est = stats?.estimatesByPropertyType || {};
  const directCount = stats?.directEstimates || 0;
  const propertyCount = stats?.propertyEstimates || 0;
  
  const stackedBarData = [
    { name: 'GC', direct: est.direct_gc || 0, property: est.prop_gc || 0 },
    { name: 'Apartment', direct: est.direct_apt || 0, property: est.prop_apt || 0 },
    { name: 'Villa', direct: est.direct_villa || 0, property: est.prop_villa || 0 },
    { name: 'Flat', direct: est.direct_flat || 0, property: est.prop_flat || 0 },
    { name: 'Plot', direct: est.direct_plot || 0, property: est.prop_plot || 0 },
  ].filter(item => item.direct > 0 || item.property > 0);
  if ((est.direct_other || 0) > 0) stackedBarData.unshift({ name: 'Other', direct: est.direct_other || 0, property: 0 });
  const totalEstimates = (stats?.directEstimates || 0) + (stats?.propertyEstimates || 0);

  // Estimates by status data
  const estStatus = stats?.estimatesByStatus || {};
  const statusData = [
    { name: 'Draft', direct: estStatus.direct_draft || 0, property: estStatus.prop_draft || 0, color: '#6B7280' },
    { name: 'Sent', direct: estStatus.direct_sent || 0, property: estStatus.prop_sent || 0, color: '#3B82F6' },
    { name: 'Approved', direct: estStatus.direct_approved || 0, property: estStatus.prop_approved || 0, color: '#10B981' },
    { name: 'Rejected', direct: estStatus.direct_rejected || 0, property: estStatus.prop_rejected || 0, color: '#EF4444' },
  ];

  // Quick Actions
  const quickActions = [
    { label: 'Create Estimate', icon: FileText, path: '/employee/estimates' },
    { label: 'Work Order', icon: ClipboardList, path: '/work-orders' },
    { label: 'Add Customer', icon: UserPlus, path: '/employee/create-customer' },
    { label: 'Assign Vendor', icon: UserCheck, path: '/employee/assigned-vendors' },
    { label: 'Manage AMC', icon: Package, path: '/employee/estimates' },
    { label: 'Properties', icon: Home, path: '/employee/customer-submissions' },
  ];

  // Show FP selection dropdown if no FP selected
  if (!selectedFp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-gray-50 rounded-xl p-8">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Select a Franchise Partner</h2>
        <p className="text-gray-400 text-sm mb-6">Choose an FP to view their dashboard</p>
        
        {/* FP Dropdown */}
        <div className="relative w-80">
          <button
            onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm hover:border-indigo-400 transition-colors shadow-sm"
          >
            <span className="text-gray-600">Select Franchise Partner...</span>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {fpDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
              {/* Admin option */}
              <button
                onClick={() => {
                  selectFp({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' });
                  setFpDropdownOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-100"
              >
                <div className="font-medium flex items-center gap-2 text-indigo-600">
                  <Shield className="w-4 h-4" />
                  Admin (All FPs)
                </div>
                <div className="text-xs text-gray-500 mt-0.5">View aggregated data from all FPs</div>
              </button>
              
              {fpLoading ? (
                <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading franchise partners...
                </div>
              ) : fpList.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">No franchise partners found</div>
              ) : (
                fpList.map(fp => (
                  <button
                    key={fp.id}
                    onClick={() => {
                      selectFp(fp);
                      setFpDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{fp.fpId}</span>
                      <span className="text-xs text-gray-500">{fp.ownerName}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Refresh button */}
        <button
          onClick={refreshFpList}
          className="mt-4 flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${fpLoading ? 'animate-spin' : ''}`} />
          Refresh FP List
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="w-10 h-10 border-3 border-gray-200 rounded-full animate-spin border-t-slate-600"></div>
        <p className="mt-3 text-gray-500 text-sm">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-6 space-y-5">
        {/* FP Info Banner - Light Theme */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Back/Switch Button */}
              <button
                onClick={() => selectFp(null)}
                className="p-2 hover:bg-white rounded-lg border border-gray-200 transition-colors group"
                title="Switch Franchise Partner"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
              </button>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider font-medium">Viewing Data For</p>
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedFp.id === 'all' ? 'Admin (All FPs)' : `${selectedFp.fpId} - ${selectedFp.companyName}`}
                </h2>
                {selectedFp.id !== 'all' && (
                  <p className="text-gray-500 text-sm">
                    {selectedFp.ownerName || `${stats?.fpInfo?.city || ''}, ${stats?.fpInfo?.state || ''}`}
                  </p>
                )}
              </div>
            </div>
            <Building2 className="w-12 h-12 text-gray-200" />
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Operations Dashboard</h1>
            <p className="text-gray-500 text-sm">Real-time overview for {selectedFp.companyName || 'All FPs'}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* FP Switcher - Top Right */}
            <div className="relative">
              <button
                onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                <span className="font-medium text-gray-700">
                  {selectedFp.id === 'all' ? 'Admin (All FPs)' : selectedFp.fpId}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {fpDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                  {/* Admin option */}
                  <button
                    onClick={() => {
                      selectFp({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' });
                      setFpDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-gray-100 ${
                      selectedFp.id === 'all' ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="font-medium flex items-center gap-2 text-slate-700">
                      <Shield className="w-4 h-4" />
                      Admin (All FPs)
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">View aggregated data</div>
                  </button>
                  
                  {fpLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Loading...
                    </div>
                  ) : (
                    fpList.map(fp => (
                      <button
                        key={fp.id}
                        onClick={() => {
                          selectFp(fp);
                          setFpDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                          selectedFp.id === fp.id ? 'bg-slate-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-gray-800">{fp.fpId}</span>
                          <span className="text-xs text-gray-500">{fp.ownerName}</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500">Live</span>
            </div>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs text-gray-500">Refresh</span>
            </button>
            
            {/* Notification Button */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Bell className="w-4 h-4 text-gray-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-medium text-gray-800 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-slate-600 hover:text-slate-700 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-gray-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => {
                        const Icon = getNotificationIcon(notification.type);
                        return (
                          <div 
                            key={notification.id}
                            onClick={() => markAsRead(notification.id)}
                            className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.read ? 'bg-slate-50/50' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className={`p-1.5 rounded-lg ${getNotificationColor(notification.type)}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${!notification.read ? 'text-gray-800 font-medium' : 'text-gray-600'}`}>
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">{notification.time}</p>
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-slate-500 rounded-full mt-1.5"></div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* First Stats Row - 3 KPI Cards */}
        <div className="flex flex-wrap gap-3">
          <div 
            onClick={() => navigate('/employee/customer-submissions')}
            className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Properties</p>
                <p className="text-xl font-bold text-gray-900">{stats?.totalProperties ?? 0}</p>
                <p className="text-[10px] text-gray-400">Total Properties</p>
              </div>
            </div>
          </div>

          <div 
            onClick={() => navigate('/employee/assigned-vendors')}
            className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-emerald-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wrench className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Vendors</p>
                <p className="text-xl font-bold text-gray-900">{stats?.totalVendors ?? 0}</p>
                <p className="text-[10px] text-gray-400">Total Vendors</p>
              </div>
            </div>
          </div>

          <div 
            onClick={() => navigate('/employee/employee-details')}
            className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-amber-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Employees</p>
                <p className="text-xl font-bold text-gray-900">{stats?.totalEmployees ?? 0}</p>
                <p className="text-[10px] text-gray-400">Total Employees</p>
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
              <button onClick={() => navigate('/employee/estimates/list')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <EstimatesOverviewBlocks estimates={estimates} />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100"></div>

          {/* Work Orders Overview Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
              <button onClick={() => navigate('/employee/work-orders')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Three Chart Boxes */}
            <div className="grid grid-cols-3 gap-6">
              {/* Work Orders by Status */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Orders by Status</h3>
                <div className="flex items-center">
                  <div className="w-36 h-36 relative">
                    <DonutChart
                      data={woStatusData}
                      centerValue={totalWorkOrders}
                    />
                  </div>
                  <div className="flex-1 ml-4 space-y-1.5">
                    {woStatusData.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-600 w-16 flex-shrink-0">{item.name}</span>
                        <span className="font-medium text-gray-900 whitespace-nowrap">{item.value} ({totalWorkOrders ? ((item.value / totalWorkOrders) * 100).toFixed(1) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Work Orders by Priority */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Work Orders by Priority</h3>
                <div className="flex items-center">
                  <div className="w-36 h-36 relative">
                    <DonutChart
                      data={priorityData}
                      centerValue={priorityTotal || totalWorkOrders}
                    />
                  </div>
                  <div className="flex-1 ml-4 space-y-3">
                    {priorityData.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-600 w-14 flex-shrink-0">{item.name}</span>
                        <span className="font-medium text-gray-900 whitespace-nowrap">{item.value} ({(priorityTotal || totalWorkOrders) ? ((item.value / (priorityTotal || totalWorkOrders)) * 100).toFixed(1) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Work Orders by Property Type */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
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
                      const found = propertyTypeData.find(p => p.name.toLowerCase() === dt.name.toLowerCase());
                      return { ...dt, value: found?.value || 0 };
                    });
                    
                    // Add any property types from data that aren't in defaults
                    propertyTypeData.forEach(p => {
                      if (!mergedData.find(m => m.name.toLowerCase() === p.name.toLowerCase())) {
                        mergedData.push(p);
                      }
                    });
                    
                    const maxValue = Math.max(...mergedData.map(d => d.value), 1);
                    
                    return mergedData.slice(0, 5).map((item, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">{item.name}</span>
                          <span className="font-medium text-gray-900">{item.value}</span>
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

        {/* Franchise Partners Section - Only show in Admin (All FPs) mode */}
        {selectedFp.id === 'all' && fpList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Franchise Partners</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {fpList.slice(0, 4).map((fp, index) => {
                const colors = [
                  { bg: 'bg-indigo-50', text: 'text-indigo-700', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
                  { bg: 'bg-purple-50', text: 'text-purple-700', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
                  { bg: 'bg-amber-50', text: 'text-amber-700', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
                  { bg: 'bg-teal-50', text: 'text-teal-700', iconBg: 'bg-teal-100', iconText: 'text-teal-600' },
                ];
                const color = colors[index % 4];
                return (
                  <div 
                    key={fp.id}
                    onClick={() => selectFp(fp)}
                    className={`${color.bg} rounded-xl p-4 cursor-pointer hover:shadow-md transition-all`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${color.iconBg} rounded-lg flex items-center justify-center`}>
                        <Building2 className={`w-5 h-5 ${color.iconText}`} />
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${color.text}`}>{fp.fpId}</p>
                        <p className={`text-sm ${color.text} opacity-80`}>{fp.companyName?.substring(0, 15) || 'Franchise Partner'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Access QR Codes */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-500" />
              <h3 className="font-medium text-gray-800">Quick Access QR Codes</h3>
            </div>
            <span className="text-xs text-gray-400">Scan to access</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Website QR */}
            <div className="flex flex-col items-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
              <div className="bg-white p-3 rounded-xl shadow-sm mb-3">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://www.xlandinfra.com')}`}
                  alt="XLAND INFRA Website QR Code" 
                  className="w-32 h-32 object-contain"
                />
              </div>
              <h4 className="font-semibold text-gray-800 mb-1">Main Website</h4>
              <p className="text-xs text-gray-500 mb-3">xlandinfra.com</p>
              <a 
                href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent('https://www.xlandinfra.com')}`}
                download="XLAND_INFRA_Website_QR.png"
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            </div>
            
            {/* Customer Portal QR */}
            <div className="flex flex-col items-center p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
              <div className="bg-white p-3 rounded-xl shadow-sm mb-3">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://xlandinfra.com/login')}`}
                  alt="XLAND INFRA Customer Portal QR Code" 
                  className="w-32 h-32 object-contain"
                />
              </div>
              <h4 className="font-semibold text-gray-800 mb-1">Customer Portal</h4>
              <p className="text-xs text-gray-500 mb-3">xlandinfra.com/login</p>
              <a 
                href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent('https://xlandinfra.com/login')}`}
                download="XLAND_INFRA_Customer_Portal_QR.png"
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-200 text-amber-800 rounded-lg text-xs hover:bg-amber-300 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            </div>
          </div>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Work Orders Summary */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">Work Orders Summary</h3>
              <ClipboardList className="w-4 h-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-gray-800">{stats?.workOrders ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Total</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-semibold text-amber-600">{stats?.pendingWorkOrders ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Pending</p>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-semibold text-emerald-600">{stats?.completedWorkOrders ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Completed</p>
              </div>
            </div>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/employee/work-orders')}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Work Orders</p>
                  <p className="text-xs text-gray-500">Manage all work orders</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/employee/estimates/list')}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Estimates</p>
                  <p className="text-xs text-gray-500">Manage all estimates</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/employee/customer-submissions')}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Properties</p>
                  <p className="text-xs text-gray-500">Manage all properties</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/employee/assigned-vendors')}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Vendors</p>
                  <p className="text-xs text-gray-500">Manage all vendors</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
