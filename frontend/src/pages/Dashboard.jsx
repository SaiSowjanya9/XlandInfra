import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Calendar, CreditCard, HelpCircle, ArrowRight, Building2, Home, Lock, Clock, CheckCircle, AlertCircle, Loader2, Eye, ChevronRight, Wrench, User, Phone, Mail, MapPin } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const Dashboard = ({ user }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);

  // Fetch dashboard data on mount
  useEffect(() => {
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
        console.log('[Dashboard] API response:', result);
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

    fetchDashboard();
  }, []);

  const menuItems = [
    {
      path: '/dashboard/work-order',
      icon: ClipboardList,
      title: 'Work Order',
      description: 'Submit a new maintenance or repair request',
    },
    {
      path: '/dashboard/schedule',
      icon: Calendar,
      title: 'Schedules',
      description: 'View and manage your appointments',
      locked: true,
    },
    {
      path: '/dashboard/payment',
      icon: CreditCard,
      title: 'Payment',
      description: 'Make payments and view billing history',
      locked: true,
    },
    {
      path: '/dashboard/contact',
      icon: HelpCircle,
      title: 'Contact / Help',
      description: 'Get support and contact information',
    },
  ];

  // Status badge colors
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Pending' },
      assigned: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Assigned' },
      in_progress: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: 'In Progress' },
      under_review: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Under Review' },
      completed: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Completed' },
      closed: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Closed' },
      cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'Cancelled' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        {config.label}
      </span>
    );
  };

  // Priority badge
  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { bg: 'bg-green-500/20', text: 'text-green-400' },
      medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      high: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
      urgent: { bg: 'bg-red-500/20', text: 'text-red-400' }
    };
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text} capitalize`}>
        {priority}
      </span>
    );
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const recentWorkOrders = dashboardData?.recentWorkOrders || [];
  const stats = dashboardData?.stats || { pending: 0, completed: 0, total: 0 };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Welcome, <span className="text-gold-gradient">{user?.firstName}!</span>
        </h1>
        <p className="text-dark-300">
          Manage your work orders, schedule appointments, and more.
        </p>
      </div>

      {/* Property Info Card */}
      {user && (
        <div className="mb-8 bg-gradient-to-r from-gold-600/20 to-gold-700/20 border border-gold-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-gold-500/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
                <Building2 className="w-7 h-7 text-gold-400" />
              </div>
              <div>
                <p className="text-gold-400/80 text-sm">Your Property</p>
                <h2 className="text-xl font-bold text-white">{user.propertyName || 'Property'}</h2>
                {(user.propertyCode || user.propertyId) && (
                  <div className="flex items-center space-x-2 mt-1">
                    <Home className="w-4 h-4 text-gold-500/70" />
                    <span className="text-dark-300 font-mono">{user.propertyCode || user.propertyId}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                <p className="text-xs text-dark-400">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
                <p className="text-xs text-dark-400">Completed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-400">{stats.total}</p>
                <p className="text-xs text-dark-400">Total</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          
          if (item.locked) {
            return (
              <div
                key={item.path}
                className="relative bg-dark-800/50 rounded-2xl shadow-lg border border-dark-600/30 overflow-hidden opacity-60 cursor-not-allowed"
              >
                <div className="absolute top-3 right-3 z-10">
                  <div className="bg-dark-700 border border-dark-500 rounded-full p-1.5">
                    <Lock className="w-4 h-4 text-dark-400" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-dark-700/50 to-dark-800/50 p-6 border-b border-dark-600/30">
                  <Icon className="w-12 h-12 text-dark-500" />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-dark-400">
                      {item.title}
                    </h2>
                  </div>
                  <p className="text-sm text-dark-500">
                    {item.description}
                  </p>
                  <p className="text-xs text-dark-500 mt-2 italic">Coming Soon</p>
                </div>
              </div>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className="group bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-gold-500/40 gold-glow-hover"
            >
              <div className="bg-gradient-to-br from-gold-600/20 to-gold-700/20 p-6 border-b border-gold-600/20">
                <Icon className="w-12 h-12 text-gold-400" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-white">
                    {item.title}
                  </h2>
                  <ArrowRight className="w-5 h-5 text-dark-400 group-hover:text-gold-400 group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <p className="text-sm text-dark-300">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="mt-10 bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          {recentWorkOrders.length > 0 && (
            <span className="text-sm text-dark-400">{recentWorkOrders.length} work order(s)</span>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto mb-3 text-gold-400 animate-spin" />
            <p className="text-dark-400">Loading recent activity...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <p>{error}</p>
          </div>
        ) : recentWorkOrders.length === 0 ? (
          <div className="text-center py-8 text-dark-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-dark-500" />
            <p>No recent work orders</p>
            <Link
              to="/dashboard/work-order"
              className="inline-block mt-4 text-gold-400 font-medium hover:text-gold-300 transition-colors"
            >
              Create your first work order →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentWorkOrders.map((wo) => (
              <div
                key={wo.id}
                onClick={() => setSelectedWorkOrder(wo)}
                className="bg-dark-700/50 border border-dark-600/50 rounded-xl p-4 hover:border-gold-500/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-gold-400 font-mono text-sm">{wo.work_order_id}</span>
                      {getStatusBadge(wo.status)}
                      {getPriorityBadge(wo.priority)}
                    </div>
                    <h3 className="text-white font-medium truncate">
                      {wo.category_name} {wo.subcategory_name && `- ${wo.subcategory_name}`}
                    </h3>
                    {wo.description && (
                      <p className="text-dark-400 text-sm mt-1 line-clamp-2">{wo.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-dark-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(wo.created_at)}
                      </span>
                      {wo.block && wo.flat_number && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          Block {wo.block}, Flat {wo.flat_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-dark-500 group-hover:text-gold-400 flex-shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedWorkOrder(null)}>
          <div 
            className="bg-dark-800 rounded-2xl border border-gold-600/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-dark-800 border-b border-dark-600 p-5 flex items-center justify-between">
              <div>
                <p className="text-gold-400 font-mono text-sm">{selectedWorkOrder.work_order_id}</p>
                <h3 className="text-xl font-bold text-white mt-1">Work Order Details</h3>
              </div>
              <button 
                onClick={() => setSelectedWorkOrder(null)}
                className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-6">
              {/* Status & Priority */}
              <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(selectedWorkOrder.status)}
                {getPriorityBadge(selectedWorkOrder.priority)}
                <span className="text-dark-400 text-sm">
                  Source: <span className="text-dark-200 capitalize">{selectedWorkOrder.source || 'Customer'}</span>
                </span>
              </div>

              {/* Service Details */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600/50">
                <h4 className="text-gold-400 font-medium mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Service Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-dark-400">Category</p>
                    <p className="text-white font-medium">{selectedWorkOrder.category_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-dark-400">Subcategory</p>
                    <p className="text-white font-medium">{selectedWorkOrder.subcategory_name || '-'}</p>
                  </div>
                </div>
                {selectedWorkOrder.description && (
                  <div className="mt-4">
                    <p className="text-dark-400 text-sm">Description</p>
                    <p className="text-white mt-1">{selectedWorkOrder.description}</p>
                  </div>
                )}
              </div>

              {/* Property & Location */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600/50">
                <h4 className="text-gold-400 font-medium mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Property & Location
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-dark-400">Property</p>
                    <p className="text-white font-medium">{selectedWorkOrder.wo_property_name || selectedWorkOrder.property_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-dark-400">Property Type</p>
                    <p className="text-white font-medium capitalize">{selectedWorkOrder.property_type || '-'}</p>
                  </div>
                  {selectedWorkOrder.block && (
                    <div>
                      <p className="text-dark-400">Block</p>
                      <p className="text-white font-medium">{selectedWorkOrder.block}</p>
                    </div>
                  )}
                  {selectedWorkOrder.flat_number && (
                    <div>
                      <p className="text-dark-400">Flat Number</p>
                      <p className="text-white font-medium">{selectedWorkOrder.flat_number}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600/50">
                <h4 className="text-gold-400 font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-dark-400" />
                    <span className="text-white">{selectedWorkOrder.customer_name || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-dark-400" />
                    <span className="text-white">{selectedWorkOrder.customer_phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-dark-400" />
                    <span className="text-white truncate">{selectedWorkOrder.customer_email || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Entry & Pet Info */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600/50">
                <h4 className="text-gold-400 font-medium mb-3">Entry & Additional Info</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-dark-400">Permission to Enter</p>
                    <p className={`font-medium ${selectedWorkOrder.permission_to_enter === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedWorkOrder.permission_to_enter === 'yes' ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-dark-400">Has Pet</p>
                    <p className={`font-medium ${selectedWorkOrder.has_pet === 'yes' ? 'text-yellow-400' : 'text-dark-200'}`}>
                      {selectedWorkOrder.has_pet === 'yes' ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
                {selectedWorkOrder.entry_notes && (
                  <div className="mt-4">
                    <p className="text-dark-400 text-sm">Entry Notes</p>
                    <p className="text-white mt-1">{selectedWorkOrder.entry_notes}</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600/50">
                <h4 className="text-gold-400 font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timeline
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-dark-400">Created At</p>
                    <p className="text-white font-medium">{formatDate(selectedWorkOrder.created_at)}</p>
                  </div>
                  {selectedWorkOrder.scheduled_date && (
                    <div>
                      <p className="text-dark-400">Scheduled Date</p>
                      <p className="text-white font-medium">{formatDate(selectedWorkOrder.scheduled_date)}</p>
                    </div>
                  )}
                  {selectedWorkOrder.completed_at && (
                    <div>
                      <p className="text-dark-400">Completed At</p>
                      <p className="text-green-400 font-medium">{formatDate(selectedWorkOrder.completed_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
