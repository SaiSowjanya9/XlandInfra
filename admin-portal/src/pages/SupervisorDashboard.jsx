import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  MapPin,
  ArrowRight
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || '';

const SupervisorDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastFetchRef = useRef(0);

  const fetchDashboard = useCallback(async (isInitialLoad = false) => {
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    if (isInitialLoad) setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/supervisor/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) setStats(result.data.stats);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(true);
    const interval = setInterval(() => fetchDashboard(false), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  useEffect(() => {
    if (location.pathname.includes('supervisor')) fetchDashboard(false);
  }, [location.pathname, fetchDashboard]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboard(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboard]);

  // Pie chart data
  const workOrdersByStatus = stats?.workOrdersByStatus || {};
  const pieData = [
    { name: 'Pending', value: workOrdersByStatus.pending || 0, color: '#F59E0B' },
    { name: 'In Progress', value: workOrdersByStatus.in_progress || 0, color: '#3B82F6' },
    { name: 'Completed', value: (workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0), color: '#10B981' },
  ].filter(item => item.value > 0);

  const totalWorkOrders = stats?.totalWorkOrders || 0;
  const totalForPercentage = pieData.reduce((sum, item) => sum + item.value, 0) || 1;

  // Stacked bar chart data - Property types with Direct vs Property-based breakdown
  const est = stats?.estimatesByPropertyType || {};
  const directCount = stats?.directEstimates || 0;
  const propertyCount = stats?.propertyEstimates || 0;
  
  const stackedBarData = [
    { name: 'GC', direct: est.direct_gc || 0, property: est.prop_gc || 0 },
    { name: 'Apartment', direct: est.direct_apt || 0, property: est.prop_apt || 0 },
    { name: 'Villa', direct: est.direct_villa || 0, property: est.prop_villa || 0 },
    { name: 'Flat', direct: est.direct_flat || 0, property: est.prop_flat || 0 },
    { name: 'Plot', direct: est.direct_plot || 0, property: est.prop_plot || 0 },
  ].filter(item => item.direct > 0 || item.property > 0);
  if ((est.direct_other || 0) > 0) stackedBarData.unshift({ name: 'Other', direct: est.direct_other || 0, property: 0 });
  const totalEstimates = directCount + propertyCount;

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
          <p className="text-gray-500 mt-1">Here's what's happening with your supervised areas today.</p>
        </div>
        <button
          onClick={() => fetchDashboard(false)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* First Stats Row - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => navigate('/supervisor/properties')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Properties</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.properties || 0}</p>
              <p className="text-xs text-gray-400">Assigned Properties</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/supervisor/vendors')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-purple-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Store className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.vendors || 0}</p>
              <p className="text-xs text-gray-400">Available Vendors</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/supervisor/employees/zones')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-orange-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <MapPin className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Zones</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.zones || 0}</p>
              <p className="text-xs text-gray-400">Assigned Zones</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/supervisor/work-orders')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalWorkOrders || 0}</p>
              <p className="text-xs text-gray-400">All Work Orders</p>
            </div>
          </div>
        </button>
      </div>

      {/* Second Stats Row - 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => navigate('/supervisor/work-orders?status=pending')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingWorkOrders || 0}</p>
              <p className="text-xs text-gray-400">Awaiting Action</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/supervisor/work-orders?status=completed')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-green-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.completedWorkOrders || 0}</p>
              <p className="text-xs text-gray-400">Successfully Completed</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/supervisor/estimates')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-teal-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Estimates</p>
              <p className="text-2xl font-bold text-gray-900">{(stats?.directEstimates || 0) + (stats?.propertyEstimates || 0)}</p>
              <p className="text-xs text-gray-400">Total Estimates</p>
            </div>
          </div>
        </button>
      </div>

      {/* Work Orders Overview - Full Width */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
          <button onClick={() => navigate('/supervisor/work-orders')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center justify-center lg:justify-start gap-12 flex-wrap">
          {/* Pie Chart */}
          <div className="relative w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={pieData.length > 1 ? 3 : 0}
                  dataKey="value"
                >
                  {(pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-3xl font-bold text-gray-900">{totalWorkOrders}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-4">
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="text-sm text-gray-600">Pending</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900">{workOrdersByStatus.pending || 0}</span>
                <span className="text-sm text-gray-500 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round(((workOrdersByStatus.pending || 0) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-sm text-gray-600">In Progress</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900">{workOrdersByStatus.in_progress || 0}</span>
                <span className="text-sm text-gray-500 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round(((workOrdersByStatus.in_progress || 0) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-sm text-gray-600">Completed</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900">{(workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0)}</span>
                <span className="text-sm text-gray-500 w-12 text-right">
                  {totalForPercentage > 0 ? Math.round((((workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0)) / totalForPercentage) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estimates Overview */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Estimates Overview</h2>
          <button onClick={() => navigate('/supervisor/estimates')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-8 flex-wrap">
          <div className="text-center min-w-[120px]">
            <p className="text-3xl font-bold text-gray-900">{totalEstimates}</p>
            <p className="text-sm text-gray-500">Total Estimates</p>
          </div>
          <div className="flex-1 h-48 min-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedBarData} margin={{ top: 20, right: 10, bottom: 20, left: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }} labelStyle={{ color: '#fff', fontWeight: 600 }} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: '11px' }} formatter={(value) => value === 'Direct' ? `Direct (${directCount})` : `Property (${propertyCount})`} />
                <Bar dataKey="direct" name="Direct" stackId="a" fill="#06B6D4" barSize={40} />
                <Bar dataKey="property" name="Property" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/supervisor/work-orders')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Create Work Order</p>
                <p className="text-xs text-gray-500">Create a new work order</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/supervisor/estimates/create')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-teal-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Create Estimate</p>
                <p className="text-xs text-gray-500">Create new estimate</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/supervisor/properties')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">View Properties</p>
                <p className="text-xs text-gray-500">Manage properties</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/supervisor/employees/zones')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Manage Zones</p>
                <p className="text-xs text-gray-500">View assigned zones</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
