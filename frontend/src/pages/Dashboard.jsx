import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Calendar, CreditCard, HelpCircle, ArrowRight, Building2, Home, Lock, Clock, CheckCircle, AlertCircle, Loader2, Eye, ChevronRight, Wrench, User, Phone, Mail, MapPin, Paperclip, Image, FileText, X, Truck, RefreshCw, Bell, BellRing, CheckCheck, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const UPLOADS_BASE_URL = '';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [renewals, setRenewals] = useState([]);
  const [renewalsLoading, setRenewalsLoading] = useState(false);
  const [processingRenewal, setProcessingRenewal] = useState(null);
  const modalRef = useRef(null);
  const overlayRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    if (selectedWorkOrder) {
      setTimeout(() => {
        if (modalRef.current) modalRef.current.scrollTop = 0;
        if (overlayRef.current) overlayRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 10);
    }
  }, [selectedWorkOrder]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/customers/notifications?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        setNotifications(result.data.notifications || []);
        setUnreadCount(result.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('customerToken');
      await fetch(`${API_BASE_URL}/api/customers/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      await fetch(`${API_BASE_URL}/api/customers/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const fetchRenewals = async () => {
    try {
      setRenewalsLoading(true);
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/customers/renewals?status=pending_approval`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        setRenewals(result.data || []);
      }
    } catch (err) {
      console.error('Renewals fetch error:', err);
    } finally {
      setRenewalsLoading(false);
    }
  };

  const handleApproveRenewal = async (renewalId) => {
    try {
      setProcessingRenewal(renewalId);
      const token = localStorage.getItem('customerToken');
      const response = await fetch(`${API_BASE_URL}/api/customers/renewals/${renewalId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        setRenewals(prev => prev.filter(r => r.id !== renewalId));
        alert('Renewal approved successfully!');
      } else {
        alert(result.message || 'Failed to approve renewal');
      }
    } catch (err) {
      console.error('Error approving renewal:', err);
      alert('Error approving renewal');
    } finally {
      setProcessingRenewal(null);
    }
  };

  const handleDeclineRenewal = async (renewalId) => {
    const reason = prompt('Please provide a reason for declining (optional):');
    try {
      setProcessingRenewal(renewalId);
      const token = localStorage.getItem('customerToken');
      const response = await fetch(`${API_BASE_URL}/api/customers/renewals/${renewalId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || 'Customer declined' })
      });

      const result = await response.json();
      if (result.success) {
        setRenewals(prev => prev.filter(r => r.id !== renewalId));
        alert('Renewal declined.');
      } else {
        alert(result.message || 'Failed to decline renewal');
      }
    } catch (err) {
      console.error('Error declining renewal:', err);
      alert('Error declining renewal');
    } finally {
      setProcessingRenewal(null);
    }
  };

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/customers/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchNotifications();
    fetchRenewals();
  }, []);

  const menuItems = [
    { path: '/dashboard/work-order', icon: ClipboardList, title: 'Work Order', description: 'Submit a new maintenance or repair request' },
    { path: '/dashboard/schedule', icon: Calendar, title: 'Schedules', description: 'View your scheduled service visits' },
    { path: '/dashboard/payment', icon: CreditCard, title: 'Payment', description: 'Make payments and view billing history' },
    { path: '/dashboard/contact', icon: HelpCircle, title: 'Contact / Help', description: 'Get support and contact information' },
  ];

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200', label: 'Pending' },
      assigned: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', label: 'Assigned' },
      in_progress: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', label: 'In Progress' },
      under_review: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', label: 'Under Review' },
      completed: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200', label: 'Completed' },
      closed: { bg: 'bg-gold-500/20', text: 'text-gray-500', border: 'border-gold-500/30', label: 'Closed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', label: 'Cancelled' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { bg: 'bg-green-100', text: 'text-green-600' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
      high: { bg: 'bg-orange-100', text: 'text-orange-600' },
      urgent: { bg: 'bg-red-100', text: 'text-red-600' }
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text} capitalize`}>
        {priority}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });
  };

  const recentWorkOrders = dashboardData?.recentWorkOrders || [];
  const stats = dashboardData?.stats || { pending: 0, completed: 0, total: 0, byStatus: {} };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Welcome, <span className="text-gold-600">{user?.firstName}!</span>
          </h1>
          <p className="text-gray-500">Here's what's happening with your property today.</p>
          {user?.propertyCode && (
            <p className="text-gray-500 text-sm mt-1">Property ID: <span className="text-gold-600 font-medium">{user.propertyCode}</span></p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Notifications Bell */}
          <div ref={notificationRef} className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) fetchNotifications();
              }}
              className="relative flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-900"
            >
              {unreadCount > 0 ? (
                <BellRing className="w-5 h-5 text-gold-600" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gold-600" />
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-gold-600 hover:text-gold-500 flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => {
                          if (!notification.isRead) {
                            markNotificationAsRead(notification.id);
                          }
                          if (notification.actionUrl) {
                            navigate(notification.actionUrl);
                          }
                          setShowNotifications(false);
                        }}
                        className={`w-full text-left p-4 border-b border-gray-200 hover:bg-gray-100 transition-colors ${
                          !notification.isRead ? 'bg-gold-600/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            !notification.isRead ? 'bg-gold-500' : 'bg-gray-200'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(notification.createdAt).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true
                              })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchDashboard();
              fetchNotifications();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-gray-900"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Access comes first and the stats after it, at every screen size, and every card
          is its icon and its name, with no summary lines (a stat keeps its figure). */}
      <div className="flex flex-col">
      {/* Stats Row - 4 cards */}
      <div className="order-2 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <button onClick={() => navigate('/dashboard/work-order')} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5 hover:bg-gray-100 transition-all duration-200 group text-left min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6 text-gray-900" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/dashboard/work-order?status=pending')} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5 hover:bg-gray-100 transition-all duration-200 group text-left min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-gray-900" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{Number(stats?.pending) || 0}</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/dashboard/work-order?status=completed')} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5 hover:bg-gray-100 transition-all duration-200 group text-left min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-gray-900" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.completed || 0}</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/dashboard/contact')} className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-5 hover:bg-gray-100 transition-all duration-200 group text-left min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-gray-900" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Property</p>
              <p className="text-base sm:text-lg font-bold text-gray-900 truncate lg:max-w-[120px]">{user?.propertyName || 'N/A'}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Quick Access Cards */}
      <div className="order-1 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            if (item.locked) {
              return (
                <div key={item.path} className="relative bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden opacity-60 cursor-not-allowed p-3 sm:p-5">
                  <div className="absolute top-3 right-3 z-10">
                    <div className="bg-gray-100 border border-gray-200 rounded-full p-1.5">
                      <Lock className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-1">{item.title}</h3>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-900" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-medium text-gray-900 text-sm sm:text-base leading-snug">{item.title}</p>
                  </div>
                </div>
                <ArrowRight className="hidden sm:block w-4 h-4 shrink-0 text-gray-500 group-hover:text-gold-600 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
      </div>

      {/* Recent Work Orders */}
      {recentWorkOrders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2>
            <Link to="/dashboard/work-order" className="text-sm text-gold-600 hover:text-gold-500 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid gap-4">
            {recentWorkOrders.slice(0, 3).map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedWorkOrder(order)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-100 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gold-600">{order.work_order_id}</span>
                      {getStatusBadge(order.status)}
                      {order.priority && getPriorityBadge(order.priority)}
                    </div>
                    <p className="text-gray-900 font-medium mb-1">{order.category_name}</p>
                    <p className="text-gray-500 text-sm line-clamp-1">{order.description}</p>
                    <p className="text-gray-500 text-xs mt-2">{formatDate(order.created_at)}</p>
                  </div>
                  <Eye className="w-5 h-5 text-gray-500 group-hover:text-gold-600 transition-colors mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Renewals Section */}
      {renewals.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-gold-600" />
              Service Renewals
            </h2>
            <span className="px-2 py-1 bg-gold-600/20 text-gold-600 text-xs font-medium rounded-full">
              {renewals.length} Pending
            </span>
          </div>
          <div className="grid gap-4">
            {renewals.map((renewal) => (
              <div
                key={renewal.id}
                className="bg-gradient-to-r from-gold-500/10 to-gold-600/5 border border-gold-500/30 rounded-xl p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gold-600">{renewal.serviceName}</span>
                      {renewal.daysUntilExpiry !== null && renewal.daysUntilExpiry <= 7 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                          Expires in {renewal.daysUntilExpiry} days
                        </span>
                      )}
                    </div>
                    <p className="text-gray-900 font-medium text-sm mb-1">
                      Renewal Period: {new Date(renewal.renewalStartDate).toLocaleDateString('en-IN')} - {new Date(renewal.renewalEndDate).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {renewal.totalVisits} visits ({renewal.frequency}) | Vendor: {renewal.vendorCompany || renewal.vendorName || 'TBA'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveRenewal(renewal.id)}
                      disabled={processingRenewal === renewal.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {processingRenewal === renewal.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDeclineRenewal(renewal.id)}
                      disabled={processingRenewal === renewal.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div 
          ref={overlayRef}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          onClick={() => setSelectedWorkOrder(null)}
        >
          <div 
            ref={modalRef}
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-600/20 to-gold-600/20 border-b border-gray-200 p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gold-600 text-sm font-medium">{selectedWorkOrder.work_order_id}</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-1">{selectedWorkOrder.category_name}</h3>
                  {selectedWorkOrder.subcategory_name && (
                    <p className="text-gray-500 text-sm mt-0.5">{selectedWorkOrder.subcategory_name}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedWorkOrder(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {getStatusBadge(selectedWorkOrder.status)}
                {selectedWorkOrder.priority && getPriorityBadge(selectedWorkOrder.priority)}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
                <p className="text-gray-900">{selectedWorkOrder.description || 'No description provided'}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Created</p>
                  <p className="text-gray-900 text-sm">{formatDate(selectedWorkOrder.created_at)}</p>
                </div>
                {selectedWorkOrder.scheduled_date && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Scheduled</p>
                    <p className="text-gray-900 text-sm">{formatDate(selectedWorkOrder.scheduled_date)}</p>
                  </div>
                )}
                {selectedWorkOrder.completed_at && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Completed</p>
                    <p className="text-gray-900 text-sm">{formatDate(selectedWorkOrder.completed_at)}</p>
                  </div>
                )}
                {selectedWorkOrder.property_type && (
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Property Type</p>
                    <p className="text-gray-900 text-sm capitalize">{selectedWorkOrder.property_type}</p>
                  </div>
                )}
              </div>

              {/* Location Info */}
              {(selectedWorkOrder.block || selectedWorkOrder.flat_number) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Location</h4>
                  <div className="flex items-center gap-2 text-gray-900">
                    <MapPin className="w-4 h-4 text-gold-600" />
                    <span>
                      {selectedWorkOrder.block && `Block ${selectedWorkOrder.block}`}
                      {selectedWorkOrder.block && selectedWorkOrder.flat_number && ', '}
                      {selectedWorkOrder.flat_number && `Flat ${selectedWorkOrder.flat_number}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Entry Permission */}
              {selectedWorkOrder.permission_to_enter && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Entry Permission</h4>
                  <p className="text-gray-900 capitalize">{selectedWorkOrder.permission_to_enter}</p>
                  {selectedWorkOrder.entry_notes && (
                    <p className="text-gray-500 text-sm mt-1">{selectedWorkOrder.entry_notes}</p>
                  )}
                </div>
              )}

              {/* Attachments */}
              {selectedWorkOrder.attachments && selectedWorkOrder.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({selectedWorkOrder.attachments.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedWorkOrder.attachments.map((att) => {
                      const isImage = att.file_type?.startsWith('image/');
                      const fileUrl = att.file_path?.startsWith('http') 
                        ? att.file_path 
                        : `${UPLOADS_BASE_URL}${att.file_path}`;
                      
                      return (
                        <a
                          key={att.id}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-100 rounded-lg p-2 hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                          {isImage ? (
                            <Image className="w-4 h-4 text-gold-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-gold-600" />
                          )}
                          <span className="text-sm text-gray-900 truncate">{att.original_name || att.file_name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
