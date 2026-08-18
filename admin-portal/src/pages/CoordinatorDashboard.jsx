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
  const [properties, setProperties] = useState([]);
  const [propertyChartFilter, setPropertyChartFilter] = useState('all');
  const lastFetchRef = useRef(0);

  const isFPCoordinator = !!user?.franchisePartnerId;

  const fetchDashboard = useCallback(async (isInitialLoad = false) => {
    const now = Date.now();
    if (!isInitialLoad && now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;

    if (isInitialLoad) setLoading(true);
    try {
      const token = getAuthToken();
      const [dashRes, estRes, propRes] = await Promise.all([
        fetch(`${API_BASE}/api/coordinator/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/estimates`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/properties`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [dashResult, estResult, propResult] = await Promise.all([dashRes.json(), estRes.json(), propRes.json()]);
      if (dashResult.success) setStats(dashResult.data.stats);
      if (estResult.success && Array.isArray(estResult.data)) setEstimates(estResult.data);
      if (propResult.success && Array.isArray(propResult.data)) setProperties(propResult.data);
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

  // Use actual API total as primary source
  const totalWorkOrders = stats?.totalWorkOrders || pieTotal || 0;
  const totalForPercentage = totalWorkOrders || 1;

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

  // Properties by Type data with time filter
  const getFilteredProperties = () => {
    if (propertyChartFilter === 'all') return properties;
    const now = new Date();
    let startDate = new Date();
    switch (propertyChartFilter) {
      case 'week': startDate.setDate(now.getDate() - 7); break;
      case 'month': startDate.setMonth(now.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(now.getMonth() - 3); break;
      case 'sixmonths': startDate.setMonth(now.getMonth() - 6); break;
      case 'year': startDate.setFullYear(now.getFullYear() - 1); break;
      default: return properties;
    }
    return properties.filter(p => new Date(p.created_at || p.createdAt) >= startDate);
  };

  const filteredProperties = getFilteredProperties();
  const normalizePropertyType = (type) => {
    if (!type) return 'Other';
    const t = type.toLowerCase().trim();
    if (t.includes('gated') || t === 'gc') return 'Gated Community';
    if (t.includes('apartment') || t === 'apt') return 'Apartment';
    if (t.includes('villa')) return 'Villa';
    if (t.includes('flat')) return 'Flat';
    if (t.includes('plot')) return 'Plot';
    return type;
  };

  const propertyTypeData = (() => {
    const typeCounts = {};
    filteredProperties.forEach(p => {
      const type = normalizePropertyType(p.property_type || p.propertyType || p.type);
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    const colors = { 'Gated Community': '#3B82F6', 'Apartment': '#8B5CF6', 'Villa': '#10B981', 'Flat': '#F59E0B', 'Plot': '#EF4444', 'Other': '#6B7280' };
    return Object.entries(typeCounts).map(([name, value]) => ({ name, value, color: colors[name] || '#6B7280' })).sort((a, b) => b.value - a.value);
  })();
  const totalPropertiesCount = filteredProperties.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats Cards - Single Row Layout */}
      <div className="flex items-center justify-between gap-4 flex-nowrap overflow-x-auto">
        <div className="flex items-center gap-6 flex-nowrap">
          <div className="shrink-0 min-w-max">
            <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">
              Welcome, {user?.firstName || user?.name?.split(' ')[0] || 'Coordinator'}!
            </h1>
            <p className="text-gray-500 mt-1 whitespace-nowrap">Here's what's happening with your coordinated areas today.</p>
          </div>
          <div className="flex items-center gap-3 flex-nowrap">
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

      {/* Properties Overview Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Properties Overview</h2>
            <p className="text-sm text-gray-500 mt-1">Distribution by property type</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={propertyChartFilter} onChange={(e) => setPropertyChartFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none">
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="sixmonths">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
            <button onClick={() => navigate('/coordinator/properties')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyTypeData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} stroke="#9CA3AF" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }} stroke="#9CA3AF" width={100} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} properties`, 'Count']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {propertyTypeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Properties</p>
                  <p className="text-3xl font-bold text-blue-700">{totalPropertiesCount}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {propertyTypeData.slice(0, 4).map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{item.value}</p>
                  <p className="text-xs text-gray-500">{totalPropertiesCount ? ((item.value / totalPropertiesCount) * 100).toFixed(1) : 0}% of total</p>
                </div>
              ))}
            </div>
          </div>
        </div>
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
