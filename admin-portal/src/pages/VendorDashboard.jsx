import { useState, useEffect } from 'react';
import { Building2, FileText, Users, Briefcase, TrendingUp, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getVendors } from '../utils/vendorStore';

const VendorDashboard = ({ user }) => {
  const [stats, setStats] = useState({ totalVendors: 0, totalUnits: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const vendors = await getVendors();
        const totalUnits = vendors.reduce((sum, v) => sum + (v.totalUnits || 0), 0);
        setStats({ totalVendors: vendors.length, totalUnits });
      } catch (error) {
        console.error('Error fetching vendor stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { 
      label: 'Total Vendors', 
      value: stats.totalVendors, 
      icon: Briefcase, 
      gradient: 'from-amber-500 to-orange-500',
      trend: '+12%',
      trendLabel: 'vs last month'
    },
    { 
      label: 'Total Units', 
      value: stats.totalUnits, 
      icon: Building2, 
      gradient: 'from-blue-500 to-indigo-500',
      trend: '+8%',
      trendLabel: 'vs last month'
    },
    { 
      label: 'Active Orders', 
      value: 24, 
      icon: Clock, 
      gradient: 'from-violet-500 to-purple-500',
      trend: '5 new',
      trendLabel: 'this week'
    },
    { 
      label: 'Completed', 
      value: 156, 
      icon: CheckCircle2, 
      gradient: 'from-emerald-500 to-teal-500',
      trend: '+23%',
      trendLabel: 'completion rate'
    },
  ];

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
                {user?.firstName || 'Partner'} {user?.lastName || ''}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Vendor Portal • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Recent Activity */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { action: 'New order received', time: '2 hours ago', status: 'pending' },
            { action: 'Order #1234 completed', time: '5 hours ago', status: 'completed' },
            { action: 'Client feedback received', time: '1 day ago', status: 'info' },
          ].map((activity, index) => (
            <div key={index} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'pending' ? 'bg-amber-400' :
                    activity.status === 'completed' ? 'bg-emerald-400' : 'bg-blue-400'
                  }`} />
                  <span className="text-white text-sm">{activity.action}</span>
                </div>
                <span className="text-xs text-slate-500">{activity.time}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-900/30 border-t border-white/5">
          <button className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
            View all activity →
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
