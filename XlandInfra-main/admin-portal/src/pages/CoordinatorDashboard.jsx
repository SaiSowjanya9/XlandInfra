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
  ArrowRight,
  UserPlus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import EstimatesOverviewBlocks from '../components/EstimatesOverviewBlocks';

const API_BASE = import.meta.env.VITE_API_URL || '';

const CoordinatorDashboard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState([]);
  const lastFetchRef = useRef(0);

  const isFPCoordinator = !!user?.franchisePartnerId;

  const fetchDashboard = useCallback(async (isInitialLoad = false) => {
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    if (isInitialLoad) setLoading(true);
    try {
      const token = getAuthToken();
      const [dashRes, estRes] = await Promise.all([
        fetch(`${API_BASE}/api/coordinator/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/estimates`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [dashResult, estResult] = await Promise.all([dashRes.json(), estRes.json()]);
      if (dashResult.success) setStats(dashResult.data.stats);
      if (estResult.success && Array.isArray(estResult.data)) setEstimates(estResult.data);
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
    if (location.pathname.includes('coordinator')) fetchDashboard(false);
  }, [location.pathname, fetchDashboard]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboard(false);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboard]);

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
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats Cards */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-fit">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Coordinator'}!
            </h1>
            <p className="text-gray-500 mt-1">Here's what's happening with your coordinated areas today.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => navigate('/coordinator/properties')} className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-blue-200 transition-all duration-200 group text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Properties</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.properties || 0}</p>
                  <p className="text-[10px] text-gray-400">Assigned Properties</p>
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/coordinator/vendors')} className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-purple-200 transition-all duration-200 group text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Vendors</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.vendors || 0}</p>
                  <p className="text-[10px] text-gray-400">Available Vendors</p>
                </div>
              </div>
            </button>
            <button onClick={() => navigate('/coordinator/employees/zones')} className="bg-white rounded-xl border border-gray-100 px-4 py-3 hover:shadow-lg hover:border-orange-200 transition-all duration-200 group text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MapPin className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Zones</p>
                  <p className="text-xl font-bold text-gray-900">{stats?.zones || 0}</p>
                  <p className="text-[10px] text-gray-400">Assigned Zones</p>
                </div>
              </div>
            </button>
          </div>
        </div>
        <button
          onClick={() => fetchDashboard(false)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Combined Estimates + Work Orders Overview Box */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        {/* Estimates Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Estimates Overview</h2>
            <button onClick={() => navigate('/coordinator/estimates')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <EstimatesOverviewBlocks estimates={estimates} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100"></div>

        {/* Work Orders Overview Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Work Orders Overview</h2>
            <button onClick={() => navigate('/coordinator/work-orders')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-8">
            <div className="relative w-56 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: 'No Data', value: 1, color: '#E5E7EB' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
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

            {/* Legend - All 6 statuses in grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
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

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/coordinator/customers/add')}
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
            onClick={() => navigate('/coordinator/work-orders')}
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
            onClick={() => navigate('/coordinator/employees')}
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
            onClick={() => navigate('/coordinator/estimates/create')}
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

export default CoordinatorDashboard;
