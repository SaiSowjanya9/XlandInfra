import { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  ClipboardList,
  Store,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const FPDashboard = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [recentWorkOrders, setRecentWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = sessionStorage.getItem('pm_auth_token');
      const response = await fetch('/api/fp/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data.stats);
        setRecentWorkOrders(result.data.recentWorkOrders || []);
      } else {
        setError(result.message || 'Failed to load dashboard');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Unable to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: 'Properties',
      value: stats?.properties || 0,
      icon: Building2,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      link: '/fp/properties'
    },
    {
      title: 'Vendors',
      value: stats?.vendors || 0,
      icon: Store,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      link: '/fp/vendors'
    },
    {
      title: 'Customers',
      value: stats?.customers || 0,
      icon: Users,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-blue-600',
      link: '/fp/customers'
    },
    {
      title: 'Employees',
      value: stats?.employees || 0,
      icon: Users,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      link: '/fp/employees'
    },
    {
      title: 'Total Work Orders',
      value: stats?.workOrders?.total || 0,
      icon: ClipboardList,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-600',
      link: '/fp/work-orders'
    },
    {
      title: 'Pending Work Orders',
      value: stats?.workOrders?.pending || 0,
      icon: Clock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      link: '/fp/work-orders?status=pending'
    },
    {
      title: 'Completed Work Orders',
      value: stats?.workOrders?.completed || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      link: '/fp/work-orders?status=completed'
    },
    {
      title: 'Estimates',
      value: stats?.estimates || 0,
      icon: FileText,
      color: 'bg-teal-500',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600',
      link: '/fp/estimates'
    }
  ];

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      requested: 'bg-blue-100 text-blue-700',
      under_review: 'bg-yellow-100 text-yellow-700',
      assigned: 'bg-purple-100 text-purple-700',
      accepted: 'bg-indigo-100 text-indigo-700',
      in_progress: 'bg-orange-100 text-orange-700',
      completed: 'bg-green-100 text-green-700',
      verified: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Partner'}!
          </h1>
          {user?.companyName && (
            <p className="text-gray-500 mt-1">{user.companyName}</p>
          )}
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <Link
            key={index}
            to={card.link}
            className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link
            to="/fp/properties"
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Building2 className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-700">Add Property</span>
          </Link>
          <Link
            to="/fp/work-orders"
            className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ClipboardList className="w-8 h-8 text-indigo-600 mb-2" />
            <span className="text-sm font-medium text-indigo-700">Create Work Order</span>
          </Link>
          <Link
            to="/fp/customers"
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Users className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-700">Add Customer</span>
          </Link>
          <Link
            to="/fp/estimates/create"
            className="flex flex-col items-center p-4 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <FileText className="w-8 h-8 text-teal-600 mb-2" />
            <span className="text-sm font-medium text-teal-700">Create Estimate</span>
          </Link>
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2>
          <Link
            to="/fp/work-orders"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {recentWorkOrders.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No work orders yet</p>
            <Link
              to="/fp/work-orders"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block"
            >
              Create your first work order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-gray-900">{wo.work_order_id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{wo.property_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-600">{wo.category_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500">{formatDate(wo.created_at)}</span>
                    </td>
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

export default FPDashboard;
