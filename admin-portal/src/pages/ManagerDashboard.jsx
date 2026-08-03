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
  AlertCircle,
  MapPin,
  ArrowRight,
  UserCog,
  UserCheck,
  Briefcase,
  Shield,
  UserPlus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ManagerDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    if (isInitialLoad) setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/manager/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => fetchDashboardData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  useEffect(() => {
    if (location.pathname.includes('manager')) fetchDashboardData(false);
  }, [location.pathname, fetchDashboardData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboardData(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboardData]);

  // Pie chart data - All 6 statuses
  const workOrdersByStatus = stats?.workOrdersByStatus || {};
  const pendingWO = Number(workOrdersByStatus.pending) || 0;
  const assignedWO = Number(workOrdersByStatus.assigned) || 0;
  const inProgressWO = Number(workOrdersByStatus.in_progress) || 0;
  const completedWO = Number(workOrdersByStatus.completed) || 0;
  const closedWO = Number(workOrdersByStatus.closed) || 0;
  const cancelledWO = Number(workOrdersByStatus.cancelled) || 0;
  const pieTotal = pendingWO + assignedWO + inProgressWO + completedWO + closedWO + cancelledWO;
  
  const pieData = [
    { name: 'Pending', value: pendingWO, color: '#F59E0B' },
    { name: 'Assigned', value: assignedWO, color: '#3B82F6' },
    { name: 'In Progress', value: inProgressWO, color: '#8B5CF6' },
    { name: 'Completed', value: completedWO, color: '#10B981' },
    { name: 'Closed', value: closedWO, color: '#6B7280' },
    { name: 'Cancelled', value: cancelledWO, color: '#EF4444' },
  ].filter(item => item.value > 0);

  const totalWorkOrders = pieTotal || stats?.totalWorkOrders || 0;
  const totalForPercentage = pieTotal || 1;

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

  // Estimates by status data
  const estStatus = stats?.estimatesByStatus || {};
  const statusData = [
    { name: 'Draft', direct: estStatus.direct_draft || 0, property: estStatus.prop_draft || 0, color: '#6B7280' },
    { name: 'Sent', direct: estStatus.direct_sent || 0, property: estStatus.prop_sent || 0, color: '#3B82F6' },
    { name: 'Approved', direct: estStatus.direct_approved || 0, property: estStatus.prop_approved || 0, color: '#10B981' },
    { name: 'Rejected', direct: estStatus.direct_rejected || 0, property: estStatus.prop_rejected || 0, color: '#EF4444' },
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
            Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Manager'}!
          </h1>
          <p className="text-gray-500 mt-1">Here's what's happening with your managed areas today.</p>
        </div>
        <button
          onClick={() => fetchDashboardData(false)}
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

      {/* First Stats Row - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => navigate('/manager/properties')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Properties</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.properties || 0}</p>
              <p className="text-xs text-gray-400">Total Properties</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/manager/vendors')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-purple-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Store className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.vendors || 0}</p>
              <p className="text-xs text-gray-400">Total Vendors</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/manager/employees/zones')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-orange-200 transition-all duration-200 group text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Employees</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.employees || 0}</p>
              <p className="text-xs text-gray-400">Total Employees</p>
            </div>
          </div>
        </button>

        <button onClick={() => navigate('/manager/work-orders')} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 group text-left">
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

      {/* Combined Estimates + Work Orders Overview Box */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        {/* Estimates Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Estimates Overview</h2>
            <button onClick={() => navigate('/manager/estimates')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Half - Property Type Bar Chart */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{totalEstimates}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className="flex-1 h-44">
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

            {/* Right Half - Status Breakdown Bar Chart */}
            <div className="flex-1 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="direct" name="Direct" fill="#06B6D4" barSize={20} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="property" name="Property" fill="#8B5CF6" barSize={20} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100"></div>

        {/* Work Orders Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
            <button onClick={() => navigate('/manager/work-orders')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-8">
            <div className="relative w-44 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
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
                <p className="text-2xl font-bold text-gray-900">{totalWorkOrders}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>

            {/* Legend - All 6 statuses in grid */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span className="text-xs text-gray-600">Pending</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{pendingWO}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-xs text-gray-600">Assigned</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{assignedWO}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  <span className="text-xs text-gray-600">In Progress</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{inProgressWO}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span className="text-xs text-gray-600">Completed</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{completedWO}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                  <span className="text-xs text-gray-600">Closed</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{closedWO}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-xs text-gray-600">Cancelled</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{cancelledWO}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Your Team */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Team</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats?.teamRoles?.coordinators || 0}</p>
                <p className="text-sm text-purple-600">Coordinators</p>
              </div>
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats?.teamRoles?.supervisors || 0}</p>
                <p className="text-sm text-amber-600">Supervisors</p>
              </div>
            </div>
          </div>
          <div className="bg-teal-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-700">{stats?.teamRoles?.executives || 0}</p>
                <p className="text-sm text-teal-600">Executives</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/manager/customers/add')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Add Customer</p>
                <p className="text-xs text-gray-500">Register new customer</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/manager/work-orders')}
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
            onClick={() => navigate('/manager/employees')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Add Employee</p>
                <p className="text-xs text-gray-500">Add new team member</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/manager/estimates/create')}
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
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
