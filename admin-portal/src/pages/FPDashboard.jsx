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
import { getAuthToken } from '../utils/safeStorage';

const FPDashboard = ({ user }) => {
  // Check if user is FP Manager (restricted access)
  const isFPManager = user?.role === 'manager';
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = getAuthToken();
      const response = await fetch('/api/fp/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data.stats);
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
    fetchDashboardData(true); // Initial load with loading spinner
    
    // Auto-refresh every 30 seconds (silent, no loading spinner)
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000);
    
    return () => clearInterval(interval);
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
      title: 'Direct Estimates',
      value: stats?.directEstimates || 0,
      icon: FileText,
      color: 'bg-teal-500',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600',
      link: '/fp/estimates'
    },
    {
      title: 'Property Estimates',
      value: stats?.propertyEstimates || 0,
      icon: FileText,
      color: 'bg-cyan-500',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-600',
      link: '/fp/estimates'
    }
  ];


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

      {/* Employee Team Overview */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Team</h2>
          <Link
            to="/fp/employees"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <UserCog className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-700">{stats?.employeeRoles?.managers || 0}</p>
                <p className="text-sm text-indigo-600">Managers</p>
              </div>
            </div>
            <div className="text-xs text-indigo-500 bg-indigo-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.managers || 0} Work Orders
            </div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats?.employeeRoles?.coordinators || 0}</p>
                <p className="text-sm text-purple-600">Coordinators</p>
              </div>
            </div>
            <div className="text-xs text-purple-500 bg-purple-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.coordinators || 0} Work Orders
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats?.employeeRoles?.supervisors || 0}</p>
                <p className="text-sm text-amber-600">Supervisors</p>
              </div>
            </div>
            <div className="text-xs text-amber-500 bg-amber-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.supervisors || 0} Work Orders
            </div>
          </div>
          <div className="bg-teal-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-700">{stats?.employeeRoles?.executives || 0}</p>
                <p className="text-sm text-teal-600">Executives</p>
              </div>
            </div>
            <div className="text-xs text-teal-500 bg-teal-100 rounded-lg px-2 py-1 inline-flex items-center gap-1">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.executives || 0} Work Orders
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Add Property - Hidden for FP Manager */}
          {!isFPManager && (
            <Link
              to="/fp/properties"
              className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Building2 className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-blue-700">Add Property</span>
            </Link>
          )}
          <Link
            to="/fp/work-orders"
            className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ClipboardList className="w-8 h-8 text-indigo-600 mb-2" />
            <span className="text-sm font-medium text-indigo-700">Create Work Order</span>
          </Link>
          {/* Add Employee */}
          {!isFPManager && (
            <Link
              to="/fp/employees/add"
              className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Users className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-green-700">Add Employee</span>
            </Link>
          )}
          <Link
            to="/fp/estimates/create"
            className="flex flex-col items-center p-4 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <FileText className="w-8 h-8 text-teal-600 mb-2" />
            <span className="text-sm font-medium text-teal-700">Create Estimate</span>
          </Link>
        </div>
      </div>

    </div>
  );
};

export default FPDashboard;
