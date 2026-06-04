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
  ArrowRight,
  UserCog,
  UserCheck,
  Briefcase,
  Shield
} from 'lucide-react';
import { Link } from 'react-router-dom';

const FPDashboard = ({ user }) => {
  // Check if user is FP Manager (restricted access)
  const isFPManager = user?.role === 'manager';
  
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
      color: 'bg-softslate-500',
      bgColor: 'bg-softslate-50',
      textColor: 'text-softslate-600',
      link: '/fp/properties'
    },
    {
      title: 'Vendors',
      value: stats?.vendors || 0,
      icon: Store,
      color: 'bg-dustyrose-400',
      bgColor: 'bg-dustyrose-50',
      textColor: 'text-dustyrose-500',
      link: '/fp/vendors'
    },
    {
      title: 'Customers',
      value: stats?.customers || 0,
      icon: Users,
      color: 'bg-sage-500',
      bgColor: 'bg-sage-50',
      textColor: 'text-sage-600',
      link: '/fp/customers'
    },
    {
      title: 'Employees',
      value: stats?.employees || 0,
      icon: Users,
      color: 'bg-warmstone-400',
      bgColor: 'bg-warmstone-50',
      textColor: 'text-warmstone-600',
      link: '/fp/employees'
    },
    {
      title: 'Total Work Orders',
      value: stats?.workOrders?.total || 0,
      icon: ClipboardList,
      color: 'bg-softgold-500',
      bgColor: 'bg-softgold-50',
      textColor: 'text-softgold-600',
      link: '/fp/work-orders'
    },
    {
      title: 'Pending Work Orders',
      value: stats?.workOrders?.pending || 0,
      icon: Clock,
      color: 'bg-softgold-400',
      bgColor: 'bg-cream-200',
      textColor: 'text-softgold-600',
      link: '/fp/work-orders?status=pending'
    },
    {
      title: 'Completed Work Orders',
      value: stats?.workOrders?.completed || 0,
      icon: CheckCircle,
      color: 'bg-sage-400',
      bgColor: 'bg-sage-50',
      textColor: 'text-sage-600',
      link: '/fp/work-orders?status=completed'
    },
    {
      title: 'Estimates',
      value: stats?.estimates || 0,
      icon: FileText,
      color: 'bg-warmstone-500',
      bgColor: 'bg-warmstone-50',
      textColor: 'text-warmstone-600',
      link: '/fp/estimates'
    }
  ];

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-warmstone-100 text-warmstone-600',
      requested: 'bg-softslate-100 text-softslate-600',
      under_review: 'bg-softgold-100 text-softgold-700',
      assigned: 'bg-dustyrose-100 text-dustyrose-500',
      accepted: 'bg-sage-100 text-sage-600',
      in_progress: 'bg-softgold-200 text-softgold-700',
      completed: 'bg-sage-100 text-sage-600',
      verified: 'bg-sage-200 text-sage-600',
      closed: 'bg-warmstone-100 text-warmstone-600',
      cancelled: 'bg-dustyrose-200 text-dustyrose-500'
    };
    return colors[status] || 'bg-warmstone-100 text-warmstone-600';
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
          <RefreshCw className="w-8 h-8 text-softgold-500 animate-spin mx-auto mb-4" />
          <p className="text-warmstone-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-warmstone-700">
            Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Partner'}!
          </h1>
          {user?.companyName && (
            <p className="text-warmstone-500 mt-1">{user.companyName}</p>
          )}
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 px-4 py-2 bg-cream-100 border border-warmstone-200 rounded-lg hover:bg-cream-200 transition-colors text-warmstone-600"
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
            className="bg-gradient-to-br from-cream-50 to-warmstone-50 rounded-xl border border-warmstone-200/50 p-5 hover:shadow-lg hover:border-softgold-300 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-warmstone-500">{card.title}</p>
                <p className="text-2xl font-bold text-warmstone-700 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Employee Team Overview */}
      <div className="bg-gradient-to-br from-cream-50 to-warmstone-50 rounded-xl border border-warmstone-200/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-warmstone-700">Your Team</h2>
          <Link
            to="/fp/employees"
            className="text-sm text-softgold-600 hover:text-softgold-700 font-medium flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-softslate-50 rounded-xl p-4 border border-softslate-200/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-softslate-100 rounded-lg flex items-center justify-center">
                <UserCog className="w-5 h-5 text-softslate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-softslate-600">{stats?.employeeRoles?.managers || 0}</p>
                <p className="text-sm text-softslate-500">Managers</p>
              </div>
            </div>
            <div className="text-xs text-softslate-500 bg-softslate-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.managers || 0} Work Orders
            </div>
          </div>
          <div className="bg-dustyrose-50 rounded-xl p-4 border border-dustyrose-200/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-dustyrose-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-dustyrose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-dustyrose-500">{stats?.employeeRoles?.coordinators || 0}</p>
                <p className="text-sm text-dustyrose-400">Coordinators</p>
              </div>
            </div>
            <div className="text-xs text-dustyrose-400 bg-dustyrose-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.coordinators || 0} Work Orders
            </div>
          </div>
          <div className="bg-softgold-50 rounded-xl p-4 border border-softgold-200/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-softgold-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-softgold-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-softgold-600">{stats?.employeeRoles?.supervisors || 0}</p>
                <p className="text-sm text-softgold-500">Supervisors</p>
              </div>
            </div>
            <div className="text-xs text-softgold-500 bg-softgold-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.supervisors || 0} Work Orders
            </div>
          </div>
          <div className="bg-sage-50 rounded-xl p-4 border border-sage-200/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-sage-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-sage-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-sage-600">{stats?.employeeRoles?.executives || 0}</p>
                <p className="text-sm text-sage-500">Executives</p>
              </div>
            </div>
            <div className="text-xs text-sage-500 bg-sage-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.executives || 0} Work Orders
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-cream-50 to-warmstone-50 rounded-xl border border-warmstone-200/50 p-6">
        <h2 className="text-lg font-semibold text-warmstone-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Add Property - Hidden for FP Manager */}
          {!isFPManager && (
            <Link
              to="/fp/properties"
              className="flex flex-col items-center p-4 bg-softslate-50 rounded-xl hover:bg-softslate-100 transition-colors border border-softslate-200/50"
            >
              <Building2 className="w-8 h-8 text-softslate-500 mb-2" />
              <span className="text-sm font-medium text-softslate-600">Add Property</span>
            </Link>
          )}
          <Link
            to="/fp/work-orders"
            className="flex flex-col items-center p-4 bg-softgold-50 rounded-xl hover:bg-softgold-100 transition-colors border border-softgold-200/50"
          >
            <ClipboardList className="w-8 h-8 text-softgold-500 mb-2" />
            <span className="text-sm font-medium text-softgold-600">Create Work Order</span>
          </Link>
          {/* Add Employee */}
          {!isFPManager && (
            <Link
              to="/fp/employees/add"
              className="flex flex-col items-center p-4 bg-sage-50 rounded-xl hover:bg-sage-100 transition-colors border border-sage-200/50"
            >
              <Users className="w-8 h-8 text-sage-500 mb-2" />
              <span className="text-sm font-medium text-sage-600">Add Employee</span>
            </Link>
          )}
          <Link
            to="/fp/estimates/create"
            className="flex flex-col items-center p-4 bg-warmstone-50 rounded-xl hover:bg-warmstone-100 transition-colors border border-warmstone-200/50"
          >
            <FileText className="w-8 h-8 text-warmstone-500 mb-2" />
            <span className="text-sm font-medium text-warmstone-600">Create Estimate</span>
          </Link>
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="bg-gradient-to-br from-cream-50 to-warmstone-50 rounded-xl border border-warmstone-200/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-warmstone-700">Recent Work Orders</h2>
          <Link
            to="/fp/work-orders"
            className="text-sm text-softgold-600 hover:text-softgold-700 font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {recentWorkOrders.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="w-12 h-12 text-warmstone-300 mx-auto mb-3" />
            <p className="text-warmstone-500">No work orders yet</p>
            <Link
              to="/fp/work-orders"
              className="text-softgold-600 hover:text-softgold-700 text-sm font-medium mt-2 inline-block"
            >
              Create your first work order
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-warmstone-200/50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-warmstone-600">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-warmstone-600">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-warmstone-600">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-warmstone-600">Created By</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-warmstone-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-warmstone-600">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-b border-warmstone-100/50 hover:bg-cream-100/50">
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-warmstone-700">{wo.work_order_id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-warmstone-600">{wo.property_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-warmstone-600">{wo.category_name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="text-sm text-warmstone-700">{wo.created_by_name || 'System'}</span>
                        {wo.created_by_role && (
                          <span className="block text-xs text-warmstone-400 capitalize">{wo.created_by_role}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-warmstone-500">{formatDate(wo.created_at)}</span>
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
