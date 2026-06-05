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
  MapPin,
  AlertCircle
} from 'lucide-react';

const CoordinatorDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Check if this is an FP-created Coordinator (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/coordinator/dashboard', {
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
    { label: 'Properties', value: stats?.properties || 0, icon: Building2, color: 'blue', bgColor: 'bg-blue-50', textColor: 'text-blue-600', path: '/coordinator/properties' },
    { label: 'Vendors', value: stats?.vendors || 0, icon: Store, color: 'purple', bgColor: 'bg-purple-50', textColor: 'text-purple-600', path: '/coordinator/vendors' },
    { label: 'Customers', value: stats?.customers || 0, icon: Users, color: 'green', bgColor: 'bg-green-50', textColor: 'text-green-600', path: '/coordinator/customers' },
    { label: 'Employees', value: stats?.employees || 0, icon: Users, color: 'orange', bgColor: 'bg-orange-50', textColor: 'text-orange-600', path: '/coordinator/employees/zones' },
    { label: 'Total Work Orders', value: stats?.workOrders || 0, icon: ClipboardList, color: 'indigo', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', path: '/coordinator/work-orders' },
    { label: 'Pending Work Orders', value: stats?.pendingWorkOrders || 0, icon: Clock, color: 'amber', bgColor: 'bg-amber-50', textColor: 'text-amber-600', path: '/coordinator/work-orders' },
    { label: 'Completed Work Orders', value: stats?.completedWorkOrders || 0, icon: CheckCircle, color: 'green', bgColor: 'bg-green-50', textColor: 'text-green-600', path: '/coordinator/work-orders' },
    { label: 'Estimates', value: stats?.estimates || 0, icon: FileText, color: 'teal', bgColor: 'bg-teal-50', textColor: 'text-teal-600', path: '/coordinator/estimates' }
  ];

  const getColorClasses = (color) => {
    const colors = {
      teal: 'bg-teal-50 text-teal-600 border-teal-100',
      purple: 'bg-purple-50 text-purple-600 border-purple-100',
      green: 'bg-green-50 text-green-600 border-green-100',
      orange: 'bg-orange-50 text-orange-600 border-orange-100',
      cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
      pink: 'bg-pink-50 text-pink-600 border-pink-100'
    };
    return colors[color] || colors.teal;
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

  // Quick actions - same as Manager dashboard
  const quickActions = [
    { label: 'Create Work Order', icon: ClipboardList, path: '/coordinator/work-orders/create', color: 'blue', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
    { label: 'Create Estimate', icon: FileText, path: '/coordinator/estimates/create', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-600' },
    { label: 'View Properties', icon: Building2, path: '/coordinator/properties', color: 'purple', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
    { label: 'Manage Zones', icon: MapPin, path: '/coordinator/employees/zones', color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-600' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Coordinator'}!
          </h1>
          <p className="text-gray-500 mt-1">Here's your dashboard overview</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Grid - 4 columns like Manager */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <button
            key={index}
            onClick={() => navigate(stat.path)}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/coordinator/work-orders')}
            className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ClipboardList className="w-8 h-8 text-indigo-600 mb-2" />
            <span className="text-sm font-medium text-indigo-700">Create Work Order</span>
          </button>
          <button
            onClick={() => navigate('/coordinator/estimates/create')}
            className="flex flex-col items-center p-4 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <FileText className="w-8 h-8 text-teal-600 mb-2" />
            <span className="text-sm font-medium text-teal-700">Create Estimate</span>
          </button>
          <button
            onClick={() => navigate('/coordinator/properties')}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Building2 className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-700">View Properties</span>
          </button>
          <button
            onClick={() => navigate('/coordinator/employees/zones')}
            className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <MapPin className="w-8 h-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-orange-700">Manage Zones</span>
          </button>
        </div>
      </div>

      {/* Recent Work Orders Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2>
          <button
            onClick={() => navigate('/coordinator/work-orders')}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {recentWorkOrders.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No work orders yet</p>
            <button
              onClick={() => navigate('/coordinator/work-orders')}
              className="mt-3 text-sm text-teal-600 hover:text-teal-700"
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

export default CoordinatorDashboard;
