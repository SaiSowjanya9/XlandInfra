import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { Building2, FileText, Users, Briefcase, TrendingUp, ArrowUpRight, Clock, CheckCircle2, ClipboardList } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import WorkOrderPieChart from '../components/WorkOrderPieChart';

const VendorDashboard = ({ user }) => {
  const [stats, setStats] = useState({ pending: 0, completed: 0, total: 0 });
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchVendorDashboard = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const token = getAuthToken() || safeStorage.getItem('pm_auth_token');
      const response = await fetch(`${API_BASE}/api/vendors/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setVendorData(result.data.vendor);
        setStats(result.data.stats || { pending: 0, completed: 0, total: 0 });
      }
    } catch (error) {
      console.error('Error fetching vendor dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorDashboard(true); // Initial load with loading spinner
    
    // Auto-refresh every 30 seconds (silent, no loading spinner)
    const interval = setInterval(() => {
      fetchVendorDashboard(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { 
      label: 'Total Orders', 
      value: stats.total, 
      icon: ClipboardList, 
      gradient: 'from-amber-500 to-orange-500',
      trend: 'All time',
      trendLabel: 'assigned to you'
    },
    { 
      label: 'Rating', 
      value: vendorData?.rating || '-', 
      icon: TrendingUp, 
      gradient: 'from-blue-500 to-indigo-500',
      trend: 'Your score',
      trendLabel: 'based on feedback'
    },
  ];

  // Work order status data for pie chart
  const workOrderStatusData = stats.byStatus || {
    assigned: 0,
    in_progress: stats.pending || 0,
    completed: stats.completed || 0
  };

  const quickActions = [
    { 
      title: 'View Vendor Details', 
      description: 'Manage and view all vendor information',
      icon: Building2, 
      path: '/vendor/vendor-details',
      gradient: 'from-amber-500 to-orange-500'
    },
    { 
      title: 'Add New Vendor', 
      description: 'Register a new vendor partner',
      icon: FileText, 
      path: '/vendor/add-vendor',
      gradient: 'from-emerald-500 to-teal-500'
    },
    { 
      title: 'Client Management', 
      description: 'View and manage client relationships',
      icon: Users, 
      path: '/vendor/clients',
      gradient: 'from-blue-500 to-indigo-500'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl" />
        <div className="relative p-6 lg:p-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Briefcase className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Welcome back</p>
              <h1 className="text-2xl font-bold text-white">
                {vendorData?.contactPerson || user?.firstName || 'Partner'}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {vendorData?.companyName || 'Vendor Portal'} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Stats Cards */}
        <div className="lg:col-span-1 space-y-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div 
                key={index} 
                className="group bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
                onClick={() => navigate('/vendor/vendor-details')}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 bg-gradient-to-br ${stat.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </div>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
                <div className="flex items-center gap-1 mt-3 text-xs text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>{stat.trend}</span>
                  <span className="text-slate-500 ml-1">{stat.trendLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side - Work Order Pie Chart */}
        <div className="lg:col-span-2">
          <WorkOrderPieChart
            data={workOrderStatusData}
            title="Work Orders"
            basePath="/vendor/vendor-details"
            size="default"
            className="!bg-slate-900/50 !border-white/5"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button 
                key={index}
                onClick={() => navigate(action.path)}
                className="group relative bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:bg-slate-900 transition-all duration-300 text-left overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                <div className={`w-12 h-12 bg-gradient-to-br ${action.gradient} rounded-xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">{action.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{action.description}</p>
                <ArrowUpRight className="absolute top-6 right-6 w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
