import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Store,
  Users,
  ClipboardList,
  FileText,
  Clock,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Briefcase
} from 'lucide-react';

const ExecutiveDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/executive/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setStats(result.data.stats);
        setRecentWorkOrders(result.data.recentWorkOrders || []);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const statCards = [
    { label: 'Properties', value: stats?.properties || 0, icon: Building2, color: 'indigo', path: '/executive/properties' },
    { label: 'Vendors', value: stats?.vendors || 0, icon: Store, color: 'purple', path: '/executive/vendors' },
    { label: 'Customers', value: stats?.customers || 0, icon: Users, color: 'green', path: '/executive/customers' },
    { label: 'Work Orders', value: stats?.workOrders || 0, icon: ClipboardList, color: 'orange', path: '/executive/work-orders' },
    { label: 'Estimates', value: stats?.estimates || 0, icon: FileText, color: 'pink', path: '/executive/estimates' }
  ];

  const getColorClasses = (color) => {
    const colors = {
      indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      purple: 'bg-purple-50 text-purple-600 border-purple-100',
      green: 'bg-green-50 text-green-600 border-green-100',
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      orange: 'bg-orange-50 text-orange-600 border-orange-100',
      pink: 'bg-pink-50 text-pink-600 border-pink-100'
    };
    return colors[color] || colors.indigo;
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-600',
      requested: 'bg-blue-100 text-blue-700',
      under_review: 'bg-yellow-100 text-yellow-700',
      assigned: 'bg-purple-100 text-purple-700',
      accepted: 'bg-indigo-100 text-indigo-700',
      in_progress: 'bg-orange-100 text-orange-700',
      completed: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-600',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const quickActions = [
    { label: 'Add Vendor', icon: Store, path: '/executive/vendors/add', color: 'purple' },
    { label: 'Create Work Order', icon: ClipboardList, path: '/executive/work-orders', color: 'orange' },
    { label: 'Add Customer', icon: Users, path: '/executive/customers', color: 'green' },
    { label: 'Create Estimate', icon: FileText, path: '/executive/estimates/create', color: 'pink' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName || 'Executive'}!
          </h1>
          <p className="text-gray-500 mt-1">
            Here's your data entry overview for today.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-orange-600">{stats?.pendingWorkOrders || 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats?.completedWorkOrders || 0}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <button
            key={stat.label}
            onClick={() => navigate(stat.path)}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all text-left group"
          >
            <div className={`w-10 h-10 rounded-lg ${getColorClasses(stat.color)} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg bg-${action.color}-100 flex items-center justify-center`}>
                <action.icon className={`w-5 h-5 text-${action.color}-600`} />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Work Orders Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Work Orders */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-gray-900">Pending</h3>
            </div>
            <span className="text-2xl font-bold text-orange-600">{stats?.pendingWorkOrders || 0}</span>
          </div>
          <button
            onClick={() => navigate('/executive/work-orders/pending')}
            className="w-full py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          >
            View All Pending
          </button>
        </div>

        {/* Completed Work Orders */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Completed</h3>
            </div>
            <span className="text-2xl font-bold text-green-600">{stats?.completedWorkOrders || 0}</span>
          </div>
          <button
            onClick={() => navigate('/executive/work-orders/completed')}
            className="w-full py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            View All Completed
          </button>
        </div>

        {/* Total Estimates */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900">Estimates</h3>
            </div>
            <span className="text-2xl font-bold text-purple-600">{stats?.estimates || 0}</span>
          </div>
          <button
            onClick={() => navigate('/executive/estimates')}
            className="w-full py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            Manage Estimates
          </button>
        </div>
      </div>

      {/* Recent Work Orders Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2>
          <button
            onClick={() => navigate('/executive/work-orders')}
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {recentWorkOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No work orders yet</p>
            <button
              onClick={() => navigate('/executive/work-orders')}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
            >
              Create your first work order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Work Order</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkOrders.slice(0, 5).map((wo) => (
                  <tr key={wo.id} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{wo.title || wo.work_order_id}</p>
                      <p className="text-xs text-gray-500">{wo.work_order_id}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{wo.property_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{wo.category_name || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{formatDate(wo.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
