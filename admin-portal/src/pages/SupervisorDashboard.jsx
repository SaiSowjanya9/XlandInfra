import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import {
  Building2,
  Store,
  Users,
  ClipboardList,
  FileText,
  Clock,
  CheckCircle,
  RefreshCw,
  MapPin
} from 'lucide-react';

const SupervisorDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = getAuthToken();

  const fetchDashboard = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const response = await fetch('/api/supervisor/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(true); // Initial load with loading spinner
    
    // Auto-refresh every 30 seconds (silent, no loading spinner)
    const interval = setInterval(() => {
      fetchDashboard(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: 'Properties', value: stats?.properties || 0, icon: Building2, bgColor: 'bg-blue-50', textColor: 'text-blue-600', path: '/supervisor/properties' },
    { label: 'Vendors', value: stats?.vendors || 0, icon: Store, bgColor: 'bg-purple-50', textColor: 'text-purple-600', path: '/supervisor/vendors' },
    { label: 'Total Work Orders', value: stats?.workOrders || 0, icon: ClipboardList, bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', path: '/supervisor/work-orders' },
    { label: 'Pending Work Orders', value: stats?.pendingWorkOrders || 0, icon: Clock, bgColor: 'bg-amber-50', textColor: 'text-amber-600', path: '/supervisor/work-orders' },
    { label: 'Completed Work Orders', value: stats?.completedWorkOrders || 0, icon: CheckCircle, bgColor: 'bg-green-50', textColor: 'text-green-600', path: '/supervisor/work-orders' },
    { label: 'Direct Estimates', value: stats?.directEstimates || 0, icon: FileText, bgColor: 'bg-teal-50', textColor: 'text-teal-600', path: '/supervisor/estimates' },
    { label: 'Property Estimates', value: stats?.propertyEstimates || 0, icon: FileText, bgColor: 'bg-cyan-50', textColor: 'text-cyan-600', path: '/supervisor/estimates' }
  ];

  const getColorClasses = (color) => {
    const colors = {
      amber: 'bg-amber-50 text-amber-600 border-amber-100',
      purple: 'bg-purple-50 text-purple-600 border-purple-100',
      green: 'bg-green-50 text-green-600 border-green-100',
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      orange: 'bg-orange-50 text-orange-600 border-orange-100',
      pink: 'bg-pink-50 text-pink-600 border-pink-100'
    };
    return colors[color] || colors.amber;
  };


  // Quick actions - same as Manager dashboard
  const quickActions = [
    { label: 'Create Work Order', icon: ClipboardList, path: '/supervisor/work-orders/create', bgColor: 'bg-blue-100', textColor: 'text-blue-600' },
    { label: 'Create Estimate', icon: FileText, path: '/supervisor/estimates/create', bgColor: 'bg-green-100', textColor: 'text-green-600' },
    { label: 'View Properties', icon: Building2, path: '/supervisor/properties', bgColor: 'bg-purple-100', textColor: 'text-purple-600' },
    { label: 'Manage Zones', icon: MapPin, path: '/supervisor/employees/zones', bgColor: 'bg-orange-100', textColor: 'text-orange-600' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Supervisor'}!
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
            onClick={() => navigate('/supervisor/work-orders')}
            className="flex flex-col items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <ClipboardList className="w-8 h-8 text-indigo-600 mb-2" />
            <span className="text-sm font-medium text-indigo-700">Create Work Order</span>
          </button>
          <button
            onClick={() => navigate('/supervisor/estimates/create')}
            className="flex flex-col items-center p-4 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            <FileText className="w-8 h-8 text-teal-600 mb-2" />
            <span className="text-sm font-medium text-teal-700">Create Estimate</span>
          </button>
          <button
            onClick={() => navigate('/supervisor/properties')}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Building2 className="w-8 h-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-blue-700">View Properties</span>
          </button>
          <button
            onClick={() => navigate('/supervisor/employees/zones')}
            className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            <MapPin className="w-8 h-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-orange-700">Manage Zones</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
