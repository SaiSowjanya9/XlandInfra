import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Calendar, CreditCard, HelpCircle, ArrowRight, Building2, Home, Lock, Clock, CheckCircle, AlertCircle, Loader2, Eye, ChevronRight, Wrench, User, Phone, Mail, MapPin, Paperclip, Image, FileText, X, Truck, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const UPLOADS_BASE_URL = '';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const modalRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (selectedWorkOrder) {
      setTimeout(() => {
        if (modalRef.current) modalRef.current.scrollTop = 0;
        if (overlayRef.current) overlayRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }, 10);
    }
  }, [selectedWorkOrder]);

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
  }, []);

  const menuItems = [
    { path: '/dashboard/work-order', icon: ClipboardList, title: 'Work Order', description: 'Submit a new maintenance or repair request' },
    { path: '/dashboard/schedule', icon: Calendar, title: 'Schedules', description: 'View and manage your appointments', locked: true },
    { path: '/dashboard/payment', icon: CreditCard, title: 'Payment', description: 'Make payments and view billing history', locked: true },
    { path: '/dashboard/contact', icon: HelpCircle, title: 'Contact / Help', description: 'Get support and contact information' },
  ];

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
  
  // Pie chart data
  const workOrdersByStatus = stats?.byStatus || {};
  const pieData = [
    { name: 'Pending', value: workOrdersByStatus.pending || 0, color: '#F59E0B' },
    { name: 'In Progress', value: workOrdersByStatus.in_progress || 0, color: '#3B82F6' },
    { name: 'Completed', value: (workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0), color: '#10B981' },
  ].filter(item => item.value > 0);

  const totalWorkOrders = stats?.total || 0;
  const totalForPercentage = pieData.reduce((sum, item) => sum + item.value, 0) || 1;

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
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Welcome, <span className="text-gold-gradient">{user?.firstName}!</span>
          </h1>
          <p className="text-dark-300">Here's what's happening with your property today.</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors text-white"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Row - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button onClick={() => navigate('/dashboard/work-order')} className="bg-dark-800/50 border border-dark-600/50 rounded-2xl p-5 hover:bg-dark-800 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-dark-300">Total Orders</p>
              <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
              <p className="text-xs text-dark-400">All Work Orders</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/dashboard/work-order?status=pending')} className="bg-dark-800/50 border border-dark-600/50 rounded-2xl p-5 hover:bg-dark-800 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-dark-300">Pending</p>
              <p className="text-2xl font-bold text-white">{stats?.pending || 0}</p>
              <p className="text-xs text-dark-400">Awaiting Action</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/dashboard/work-order?status=completed')} className="bg-dark-800/50 border border-dark-600/50 rounded-2xl p-5 hover:bg-dark-800 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-dark-300">Completed</p>
              <p className="text-2xl font-bold text-white">{stats?.completed || 0}</p>
              <p className="text-xs text-dark-400">Successfully Done</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/dashboard/contact')} className="bg-dark-800/50 border border-dark-600/50 rounded-2xl p-5 hover:bg-dark-800 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-dark-300">Property</p>
              <p className="text-lg font-bold text-white truncate max-w-[120px]">{user?.propertyName || 'N/A'}</p>
              <p className="text-xs text-dark-400">Your Home</p>
            </div>
          </div>
        </button>
      </div>

      {/* Work Orders Overview - Full Width */}
      <div className="bg-dark-800/50 border border-dark-600/50 rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Work Orders Overview</h2>
          <button onClick={() => navigate('/dashboard/work-order')} className="text-sm text-gold-400 hover:text-gold-300 font-medium flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center justify-center lg:justify-start gap-12 flex-wrap">
          {/* Pie Chart */}
          <div className="relative w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#374151' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={pieData.length > 1 ? 3 : 0}
                  dataKey="value"
                >
                  {(pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#374151' }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold text-white">{totalWorkOrders}</p>
              <p className="text-sm text-dark-400">Total</p>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-4">
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-sm text-dark-300">Pending</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white">{workOrdersByStatus.pending || 0}</span>
                <span className="text-sm text-dark-400 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round(((workOrdersByStatus.pending || 0) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-dark-300">In Progress</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white">{workOrdersByStatus.in_progress || 0}</span>
                <span className="text-sm text-dark-400 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round(((workOrdersByStatus.in_progress || 0) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-sm text-dark-300">Completed</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white">{(workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0)}</span>
                <span className="text-sm text-dark-400 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round((((workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0)) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            if (item.locked) {
              return (
                <div key={item.path} className="relative bg-dark-800/50 rounded-2xl shadow-lg border border-dark-600/30 overflow-hidden opacity-60 cursor-not-allowed p-5">
                  <div className="absolute top-3 right-3 z-10">
                    <div className="bg-dark-700 border border-dark-500 rounded-full p-1.5">
                      <Lock className="w-4 h-4 text-dark-400" />
                    </div>
                  </div>
                  <div className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-dark-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                  <p className="text-dark-400 text-sm">{item.description}</p>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center justify-between p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl hover:bg-dark-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-gold-600 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-dark-400">{item.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-dark-500 group-hover:text-gold-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Work Orders */}
      {recentWorkOrders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Work Orders</h2>
            <Link to="/dashboard/work-order" className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid gap-4">
            {recentWorkOrders.slice(0, 3).map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedWorkOrder(order)}
                className="w-full text-left bg-dark-800/50 border border-dark-600/50 rounded-xl p-4 hover:bg-dark-800 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gold-400">{order.work_order_id}</span>
                      {getStatusBadge(order.status)}
                      {order.priority && getPriorityBadge(order.priority)}
                    </div>
                    <p className="text-white font-medium mb-1">{order.category_name}</p>
                    <p className="text-dark-400 text-sm line-clamp-1">{order.description}</p>
                    <p className="text-dark-500 text-xs mt-2">{formatDate(order.created_at)}</p>
                  </div>
                  <Eye className="w-5 h-5 text-dark-500 group-hover:text-gold-400 transition-colors mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <div 
          ref={overlayRef}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          onClick={() => setSelectedWorkOrder(null)}
        >
          <div 
            ref={modalRef}
            className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gold-600/20 to-gold-700/20 border-b border-dark-600 p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gold-400 text-sm font-medium">{selectedWorkOrder.work_order_id}</p>
                  <h3 className="text-xl font-bold text-white mt-1">{selectedWorkOrder.category_name}</h3>
                  {selectedWorkOrder.subcategory_name && (
                    <p className="text-dark-300 text-sm mt-0.5">{selectedWorkOrder.subcategory_name}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedWorkOrder(null)}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-dark-400" />
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
                <h4 className="text-sm font-medium text-dark-400 mb-2">Description</h4>
                <p className="text-white">{selectedWorkOrder.description || 'No description provided'}</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-dark-400 text-xs mb-1">Created</p>
                  <p className="text-white text-sm">{formatDate(selectedWorkOrder.created_at)}</p>
                </div>
                {selectedWorkOrder.scheduled_date && (
                  <div>
                    <p className="text-dark-400 text-xs mb-1">Scheduled</p>
                    <p className="text-white text-sm">{formatDate(selectedWorkOrder.scheduled_date)}</p>
                  </div>
                )}
                {selectedWorkOrder.completed_at && (
                  <div>
                    <p className="text-dark-400 text-xs mb-1">Completed</p>
                    <p className="text-white text-sm">{formatDate(selectedWorkOrder.completed_at)}</p>
                  </div>
                )}
                {selectedWorkOrder.property_type && (
                  <div>
                    <p className="text-dark-400 text-xs mb-1">Property Type</p>
                    <p className="text-white text-sm capitalize">{selectedWorkOrder.property_type}</p>
                  </div>
                )}
              </div>

              {/* Location Info */}
              {(selectedWorkOrder.block || selectedWorkOrder.flat_number) && (
                <div>
                  <h4 className="text-sm font-medium text-dark-400 mb-2">Location</h4>
                  <div className="flex items-center gap-2 text-white">
                    <MapPin className="w-4 h-4 text-gold-400" />
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
                  <h4 className="text-sm font-medium text-dark-400 mb-2">Entry Permission</h4>
                  <p className="text-white capitalize">{selectedWorkOrder.permission_to_enter}</p>
                  {selectedWorkOrder.entry_notes && (
                    <p className="text-dark-300 text-sm mt-1">{selectedWorkOrder.entry_notes}</p>
                  )}
                </div>
              )}

              {/* Attachments */}
              {selectedWorkOrder.attachments && selectedWorkOrder.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-dark-400 mb-2 flex items-center gap-1">
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
                          className="bg-dark-700 rounded-lg p-2 hover:bg-dark-600 transition-colors flex items-center gap-2"
                        >
                          {isImage ? (
                            <Image className="w-4 h-4 text-gold-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-gold-400" />
                          )}
                          <span className="text-sm text-white truncate">{att.original_name || att.file_name}</span>
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
