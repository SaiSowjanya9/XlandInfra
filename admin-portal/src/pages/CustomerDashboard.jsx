import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { Link, useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import {
  ClipboardList,
  CreditCard,
  Calendar,
  Phone,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  PartyPopper,
  MapPin,
  TrendingUp,
  ArrowUpRight,
  ArrowRight,
  Building2,
  RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const API_BASE = '/api';

const CustomerDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, completed: 0, total: 0, byStatus: {} });
  const [customerData, setCustomerData] = useState(null);

  const fetchCustomerDashboard = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const token = safeStorage.getItem('customer_token') || getAuthToken();
      const response = await fetch(`${API_BASE}/customers/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setCustomerData(result.data.customer);
        setRecentOrders(result.data.recentWorkOrders?.slice(0, 3) || []);
        setStats(result.data.stats || { pending: 0, completed: 0, total: 0, byStatus: {} });
      }
    } catch (error) {
      console.error('Error fetching customer dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDashboard(true);
    const interval = setInterval(() => {
      fetchCustomerDashboard(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Pie chart data
  const workOrdersByStatus = stats?.byStatus || {};
  const pieData = [
    { name: 'Pending', value: workOrdersByStatus.pending || 0, color: '#F59E0B' },
    { name: 'In Progress', value: workOrdersByStatus.in_progress || 0, color: '#3B82F6' },
    { name: 'Completed', value: (workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0), color: '#10B981' },
  ].filter(item => item.value > 0);

  const totalWorkOrders = stats?.total || 0;
  const totalForPercentage = pieData.reduce((sum, item) => sum + item.value, 0) || 1;

  const quickAccess = [
    { title: 'Work Orders', icon: ClipboardList, path: '/customer/work-order', gradient: 'from-blue-500 to-indigo-600' },
    { title: 'Payments', icon: CreditCard, path: '/customer/payment', gradient: 'from-teal-500 to-cyan-600' },
    { title: 'Schedule', icon: Calendar, path: '/customer/schedule', gradient: 'from-violet-500 to-purple-600' },
    { title: 'Contact', icon: Phone, path: '/customer/contact', gradient: 'from-amber-500 to-orange-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative overflow-hidden flex-1">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-2xl" />
          <div className="relative p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                <span className="text-white font-bold text-lg">
                  {(customerData?.firstName || user?.firstName)?.[0]}{(customerData?.lastName || user?.lastName)?.[0] || 'R'}
                </span>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Welcome back</p>
                <h1 className="text-2xl font-bold text-white">
                  {customerData?.firstName || user?.firstName || 'Resident'} {customerData?.lastName || user?.lastName || ''}!
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  {customerData?.propertyName || 'Resident Portal'} • Here's what's happening today.
                </p>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchCustomerDashboard(false)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors text-white"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Row - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => navigate('/customer/work-order')} className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:bg-slate-900 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Orders</p>
              <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
              <p className="text-xs text-slate-500">All Work Orders</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/customer/work-order?status=pending')} className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:bg-slate-900 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Pending</p>
              <p className="text-2xl font-bold text-white">{stats?.pending || 0}</p>
              <p className="text-xs text-slate-500">Awaiting Action</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/customer/work-order?status=completed')} className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:bg-slate-900 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Completed</p>
              <p className="text-2xl font-bold text-white">{stats?.completed || 0}</p>
              <p className="text-xs text-slate-500">Successfully Done</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/customer/contact')} className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:bg-slate-900 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Property</p>
              <p className="text-lg font-bold text-white truncate max-w-[120px]">{customerData?.propertyName || 'N/A'}</p>
              <p className="text-xs text-slate-500">Your Home</p>
            </div>
          </div>
        </button>
      </div>

      {/* Work Orders Overview - Full Width */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Work Orders Overview</h2>
          <button onClick={() => navigate('/customer/work-order')} className="text-sm text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1">
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
              <p className="text-sm text-slate-400">Total</p>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-4">
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-sm text-slate-300">Pending</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white">{workOrdersByStatus.pending || 0}</span>
                <span className="text-sm text-slate-400 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round(((workOrdersByStatus.pending || 0) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-slate-300">In Progress</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white">{workOrdersByStatus.in_progress || 0}</span>
                <span className="text-sm text-slate-400 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round(((workOrdersByStatus.in_progress || 0) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-sm text-slate-300">Completed</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-white">{(workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0)}</span>
                <span className="text-sm text-slate-400 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round((((workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0)) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-900 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${item.gradient} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">{item.title}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
