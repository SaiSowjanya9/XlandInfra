import { useState, useEffect, useRef } from 'react';
import { 
  Building2, ClipboardList, Clock, CheckCircle2, FileText, Users, 
  Package, MapPin, Wrench, UserPlus, IndianRupee, Activity,
  RefreshCw, Bell, Settings, UserCheck, Home, X, AlertCircle, Info,
  QrCode, Download, ChevronDown, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const navigate = useNavigate();
  
  // Get FP list and selected FP from context
  const { fpList, selectedFp, selectFp, loading: fpLoading, refreshFpList } = useFP();
  const token = sessionStorage.getItem('pm_auth_token');
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);

  useEffect(() => {
    if (selectedFp) {
      fetchDashboardData();
      fetchNotifications();
    }
    const interval = setInterval(() => {
      if (selectedFp) fetchDashboardData();
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedFp]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDashboardData = async () => {
    if (!selectedFp) {
      setLoading(false);
      return;
    }
    
    try {
      // Fetch FP-specific dashboard data
      const response = await fetch(`${API_BASE}/api/admin/fp-view/${selectedFp.id}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        // Map FP dashboard data to stats format
        setStats({
          totalProperties: result.data.stats.totalProperties || 0,
          pendingWorkOrders: result.data.stats.pendingWorkOrders || 0,
          completedWorkOrders: result.data.stats.completedWorkOrders || 0,
          totalVendors: result.data.stats.totalVendors || 0,
          totalEmployees: result.data.stats.totalEmployees || 0,
          totalEstimates: result.data.stats.totalEstimates || 0,
          fpInfo: result.data.fpInfo
        });
        setRecentActivities(result.data.recentWorkOrders || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/admin/notifications');
      const result = await response.json();
      if (result.success && result.data) {
        setNotifications(result.data);
        setUnreadCount(result.data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

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
      await fetch('/api/admin/notifications/read-all', { method: 'PUT' });
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
  const hasRevenue = stats?.revenue || stats?.amcCollection || stats?.pendingCollection;

  // KPI Cards - show 0 if no data, not dash
  const kpiCards = [
    { 
      title: 'Properties',
      value: stats?.totalProperties ?? stats?.properties ?? 0,
      icon: Building2,
      path: '/employee/customer-submissions'
    },
    { 
      title: 'Vendors',
      value: stats?.totalVendors ?? stats?.vendors ?? 0,
      icon: Wrench,
      path: '/employee/assigned-vendors'
    },
    { 
      title: 'Employees',
      value: stats?.totalEmployees ?? stats?.customers ?? 0,
      icon: Users,
      path: '/employee/employee-details'
    },
    { 
      title: 'Pending Orders',
      value: stats?.pendingWorkOrders ?? 0,
      icon: Clock,
      path: '/employee/work-orders'
    },
    { 
      title: 'Completed',
      value: stats?.completedWorkOrders ?? 0,
      icon: CheckCircle2,
      path: '/employee/work-orders'
    },
    { 
      title: 'Estimates',
      value: stats?.totalEstimates ?? stats?.totalZones ?? 0,
      icon: FileText,
      path: '/employee/estimates/list'
    },
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

  const formatCurrency = (value) => {
    if (!value) return null;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Math.round(value));
  };

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
                    <div className="font-medium text-gray-800">{fp.fpId}</div>
                    <div className="text-xs text-gray-500">{fp.companyName}</div>
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
        {/* FP Info Banner */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-xs uppercase tracking-wider">Viewing Data For</p>
              <h2 className="text-xl font-bold">{selectedFp.displayName}</h2>
              <p className="text-indigo-200 text-sm">{stats?.fpInfo?.city}, {stats?.fpInfo?.state}</p>
            </div>
            <Building2 className="w-12 h-12 text-white/30" />
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Operations Dashboard</h1>
            <p className="text-gray-500 text-sm">Real-time overview for {selectedFp.companyName}</p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div 
                key={index}
                onClick={() => navigate(card.path)}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-gray-50">
                    <Icon className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
                <p className="text-2xl font-semibold text-gray-800">
                  {card.value.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{card.title}</p>
              </div>
            );
          })}
        </div>

        {/* Revenue Overview - Only show if data exists */}
        {hasRevenue && (
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">Revenue Overview</h3>
              <IndianRupee className="w-4 h-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats?.revenue && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
                  <p className="text-xl font-semibold text-gray-800">{formatCurrency(stats.revenue)}</p>
                </div>
              )}
              {stats?.amcCollection && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">AMC Collection</p>
                  <p className="text-xl font-semibold text-gray-800">{formatCurrency(stats.amcCollection)}</p>
                </div>
              )}
              {stats?.pendingCollection && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Pending Collection</p>
                  <p className="text-xl font-semibold text-gray-800">{formatCurrency(stats.pendingCollection)}</p>
                </div>
              )}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          {/* System Overview */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">System Overview</h3>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-gray-800">{stats?.totalEstimates ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Estimates</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-gray-800">{stats?.totalZones ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Zones</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-semibold text-gray-800">{stats?.activeWorkOrders ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Active Orders</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Quick Actions & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">Quick Actions</h3>
              <Settings className="w-4 h-4 text-gray-400" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col items-center justify-center p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-gray-500 mb-2" />
                    <span className="text-xs text-gray-600 text-center">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-800">Recent Activities</h3>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            {recentActivities.length > 0 ? (
              <div className="space-y-3 max-h-52 overflow-y-auto custom-scrollbar">
                {recentActivities.slice(0, 6).map((activity, index) => (
                  <div key={activity.id || index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 line-clamp-2">{activity.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No recent activities</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
