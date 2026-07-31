import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2,
  Users,
  ClipboardList,
  Store,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  UserCog,
  UserCheck,
  Briefcase,
  Shield,
  Plus,
  UserPlus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const FPDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isFPManager = user?.role === 'manager';
  
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    // Prevent duplicate fetches within 2 seconds
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) {
      return;
    }
    lastFetchRef.current = now;

    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/fp/dashboard`, {
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
  }, []);

  // Initial load and auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Refresh when navigating back to dashboard
  useEffect(() => {
    // This runs when location changes and we're on the dashboard
    if (location.pathname === '/fp/dashboard' || location.pathname === '/fp') {
      fetchDashboardData(false);
    }
  }, [location.pathname, fetchDashboardData]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData(false);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchDashboardData]);

  // Pie chart data
  const workOrdersByStatus = stats?.workOrders?.byStatus || {};
  const pieData = [
    { name: 'Pending', value: workOrdersByStatus.pending || 0, color: '#F59E0B' },
    { name: 'In Progress', value: workOrdersByStatus.in_progress || 0, color: '#3B82F6' },
    { name: 'Completed', value: (workOrdersByStatus.completed || 0) + (workOrdersByStatus.closed || 0), color: '#10B981' },
  ].filter(item => item.value > 0);

  const totalWorkOrders = stats?.workOrders?.total || 0;
  const totalForPercentage = pieData.reduce((sum, item) => sum + item.value, 0) || 1;

  // Stacked bar chart data - Property types with Direct vs Property-based breakdown
  const est = stats?.estimatesByPropertyType || {};
  const directCount = stats?.directEstimates || 0;
  const propertyCount = stats?.propertyEstimates || 0;
  
  // Data for stacked bar: Each property type shows Direct + Property-based counts
  const stackedBarData = [
    { name: 'GC', direct: est.direct_gc || 0, property: est.prop_gc || 0 },
    { name: 'Apartment', direct: est.direct_apt || 0, property: est.prop_apt || 0 },
    { name: 'Villa', direct: est.direct_villa || 0, property: est.prop_villa || 0 },
    { name: 'Flat', direct: est.direct_flat || 0, property: est.prop_flat || 0 },
    { name: 'Plot', direct: est.direct_plot || 0, property: est.prop_plot || 0 },
  ].filter(item => item.direct > 0 || item.property > 0); // Only show property types with data
  
  // Add "Other" category for direct estimates without property type
  if ((est.direct_other || 0) > 0) {
    stackedBarData.unshift({ name: 'Other', direct: est.direct_other || 0, property: 0 });
  }
  
  const totalEstimates = directCount + propertyCount;

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
          <p className="text-gray-500 mt-1">Here's what's happening with your business today.</p>
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
        <Link to="/fp/properties" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group">
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
        </Link>

        <Link to="/fp/vendors" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all duration-200 group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Store className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.vendors || 0}</p>
              <p className="text-xs text-gray-400">Total Vendors</p>
            </div>
          </div>
        </Link>

        <Link to="/fp/employees" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-orange-200 transition-all duration-200 group">
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
        </Link>

        <Link to="/fp/work-orders" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-200 group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.workOrders?.total || 0}</p>
              <p className="text-xs text-gray-400">All Work Orders</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Second Stats Row - 2 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/fp/work-orders?status=pending" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-amber-200 transition-all duration-200 group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.workOrders?.pending || 0}</p>
              <p className="text-xs text-gray-400">Awaiting Action</p>
            </div>
          </div>
        </Link>

        <Link to="/fp/work-orders?status=completed" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:border-green-200 transition-all duration-200 group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.workOrders?.completed || 0}</p>
              <p className="text-xs text-gray-400">Successfully Completed</p>
            </div>
          </div>
        </Link>


      </div>

      {/* Estimates Overview + Work Orders Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estimates Overview - Vertical Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Estimates Overview</h2>
            <Link to="/fp/estimates" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Total Count */}
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{totalEstimates}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>

            {/* Stacked Bar Chart - Property types with Direct vs Property-based */}
            <div className="flex-1" style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedBarData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 600 }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={24}
                    iconSize={10}
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => value === 'Direct' ? `Direct (${directCount})` : `Property (${propertyCount})`}
                  />
                  <Bar dataKey="direct" name="Direct" stackId="a" fill="#06B6D4" barSize={40} />
                  <Bar dataKey="property" name="Property" stackId="a" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Work Orders Overview - Pie Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
            <Link to="/fp/work-orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="flex items-center justify-center gap-8">
            {/* Pie Chart - Using SVG directly for reliability */}
            {(() => {
              // Use top-level stats for consistency with stat cards
              const pending = Number(stats?.workOrders?.pending) || 0;
              const inProgress = Number(stats?.workOrders?.byStatus?.in_progress) || 0;
              const completed = Number(stats?.workOrders?.completed) || 0; // Already includes closed
              const pieTotal = pending + inProgress + completed;
              const circumference = 2 * Math.PI * 70; // ~440
              
              // Calculate segment lengths
              const pendingLen = pieTotal > 0 ? (pending / pieTotal) * circumference : 0;
              const inProgressLen = pieTotal > 0 ? (inProgress / pieTotal) * circumference : 0;
              const completedLen = pieTotal > 0 ? (completed / pieTotal) * circumference : 0;
              
              return (
                <div style={{ width: 180, height: 180 }}>
                  <svg viewBox="0 0 180 180" width="180" height="180">
                    {/* Completed segment (green) - drawn first as background */}
                    {completed > 0 && (
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#10B981" strokeWidth="20"
                        strokeDasharray={`${completedLen} ${circumference}`}
                        strokeDashoffset={-(pendingLen + inProgressLen)}
                        transform="rotate(-90 90 90)"
                      />
                    )}
                    {/* In Progress segment (blue) */}
                    {inProgress > 0 && (
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#3B82F6" strokeWidth="20"
                        strokeDasharray={`${inProgressLen} ${circumference}`}
                        strokeDashoffset={-pendingLen}
                        transform="rotate(-90 90 90)"
                      />
                    )}
                    {/* Pending segment (amber) - drawn on top */}
                    {pending > 0 && (
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#F59E0B" strokeWidth="20"
                        strokeDasharray={`${pendingLen} ${circumference}`}
                        strokeDashoffset={0}
                        transform="rotate(-90 90 90)"
                      />
                    )}
                    {/* Gray background if no data */}
                    {pieTotal === 0 && (
                      <circle cx="90" cy="90" r="70" fill="none" stroke="#E5E7EB" strokeWidth="20" />
                    )}
                    {/* Center text */}
                    <text x="90" y="85" textAnchor="middle" fill="#111827" style={{ fontSize: '28px', fontWeight: 700 }}>{pieTotal}</text>
                    <text x="90" y="105" textAnchor="middle" fill="#6B7280" style={{ fontSize: '12px' }}>Total</text>
                  </svg>
                </div>
              );
            })()}

            {/* Legend - using same values as pie chart */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-500"></span>
                  <span className="text-sm text-gray-600">Pending</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.workOrders?.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                  <span className="text-sm text-gray-600">In Progress</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.workOrders?.byStatus?.in_progress || 0}</span>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500"></span>
                  <span className="text-sm text-gray-600">Completed</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{stats?.workOrders?.completed || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Your Team Section - Horizontal Strip */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Team</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <UserCog className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-700">{stats?.employeeRoles?.managers || 0}</p>
                <p className="text-sm text-indigo-600">Managers</p>
              </div>
            </div>
            <div className="text-xs text-indigo-500 bg-indigo-100 rounded-lg px-2 py-1 inline-flex items-center gap-1 mt-2">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.managers || 0} Work Orders
            </div>
          </div>

          <div className="bg-purple-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats?.employeeRoles?.coordinators || 0}</p>
                <p className="text-sm text-purple-600">Coordinators</p>
              </div>
            </div>
            <div className="text-xs text-purple-500 bg-purple-100 rounded-lg px-2 py-1 inline-flex items-center gap-1 mt-2">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.coordinators || 0} Work Orders
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats?.employeeRoles?.supervisors || 0}</p>
                <p className="text-sm text-amber-600">Supervisors</p>
              </div>
            </div>
            <div className="text-xs text-amber-500 bg-amber-100 rounded-lg px-2 py-1 inline-flex items-center gap-1 mt-2">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.supervisors || 0} Work Orders
            </div>
          </div>

          <div className="bg-teal-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-700">{stats?.employeeRoles?.executives || 0}</p>
                <p className="text-sm text-teal-600">Executives</p>
              </div>
            </div>
            <div className="text-xs text-teal-500 bg-teal-100 rounded-lg px-2 py-1 inline-flex items-center gap-1 mt-2">
              <ClipboardList className="w-3 h-3" />
              {stats?.workOrders?.byRole?.executives || 0} Work Orders
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/fp/add-customer')}
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
            onClick={() => navigate('/fp/work-orders')}
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
            onClick={() => navigate('/fp/employees/add')}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Add Employee</p>
                <p className="text-xs text-gray-500">Add new team member</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/fp/estimates/create')}
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

export default FPDashboard;
