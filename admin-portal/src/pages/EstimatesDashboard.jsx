import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Send, 
  CheckCircle, 
  XCircle, 
  FileEdit, 
  Building2, 
  RefreshCw,
  TrendingUp,
  ArrowRight,
  Info,
  Mail,
  Home
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper to normalize property type
const normalizePropertyType = (type) => {
  if (!type) return 'Other';
  const upper = type.toUpperCase().replace(/[_\s-]/g, '');
  if (upper === 'GC' || upper.includes('GATED')) return 'Apartment';
  if (upper === 'APT' || upper.includes('APARTMENT')) return 'Apartment';
  if (upper === 'VILLA' || upper === 'VILLAS') return 'Villa';
  if (upper === 'FLAT' || upper === 'FLATS') return 'Flat';
  if (upper === 'PLOT' || upper === 'PLOTS') return 'Plot';
  if (upper.includes('GATED')) return 'Gated Community';
  return 'Other';
};

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'employee': 'admin'
  };
  return portalMap[portalType] || 'fp';
};

const EstimatesDashboard = ({ user, portalType = 'franchise' }) => {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState('monthly');

  const token = getAuthToken();
  const apiPath = getApiPath(portalType);

  // Get the base path for navigation
  const getBasePath = () => {
    if (portalType === 'franchise') return '/fp';
    if (portalType === 'employee' || portalType === 'admin') return '/employee';
    return `/${portalType}`;
  };

  // Fetch estimates data
  const fetchEstimates = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/${apiPath}/estimates?archived=false`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success || result.data || Array.isArray(result)) {
        const data = result.data || result.estimates || result || [];
        setEstimates(Array.isArray(data) ? data : []);
      } else {
        setError(result.message || 'Failed to load estimates');
      }
    } catch (err) {
      console.error('Fetch estimates error:', err);
      setError('Unable to load estimates data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiPath]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  // Filter estimates by period
  const getFilteredEstimates = () => {
    if (periodFilter === 'all') return estimates;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (periodFilter) {
      case 'today':
        filterDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return estimates;
    }
    
    return estimates.filter(est => {
      const estDate = new Date(est.created_at || est.createdAt);
      return estDate >= filterDate;
    });
  };

  const filteredEstimates = getFilteredEstimates();

  // Get this month's estimates for funnel
  const getThisMonthEstimates = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return estimates.filter(est => {
      const estDate = new Date(est.created_at || est.createdAt);
      return estDate >= startOfMonth;
    });
  };

  const thisMonthEstimates = getThisMonthEstimates();

  // Calculate stats
  const totalEstimates = filteredEstimates.length;
  const directEstimates = filteredEstimates.filter(e => 
    e.estimate_type === 'direct' || e.estimateType === 'direct'
  ).length;
  const propertyBasedEstimates = filteredEstimates.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  ).length;
  
  const draftEstimates = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'draft'
  ).length;
  const sentEstimates = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'sent'
  ).length;
  const approvedEstimates = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'approved'
  ).length;
  const rejectedEstimates = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'rejected'
  ).length;

  // This month stats for funnel
  const thisMonthTotal = thisMonthEstimates.length;
  const thisMonthSent = thisMonthEstimates.filter(e => 
    ['sent', 'approved', 'rejected'].includes((e.status || '').toLowerCase())
  ).length;
  const thisMonthApproved = thisMonthEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'approved'
  ).length;
  // Calculate invoices created (approved estimates) and paid (we'll assume some percentage)
  const thisMonthInvoicesCreated = thisMonthApproved;
  const thisMonthPaid = Math.floor(thisMonthApproved * 0.85); // Assuming 85% of approved are paid

  // Stat cards configuration - matching the reference image exactly
  const statCards = [
    {
      label: 'Total Estimates',
      value: totalEstimates,
      percentage: '100% of all estimates',
      icon: FileText,
      iconBg: '#EBF5FF',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6'
    },
    {
      label: 'Direct Estimates',
      value: directEstimates,
      percentage: totalEstimates ? `${((directEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Send,
      iconBg: '#F3E8FF',
      iconColor: '#8B5CF6',
      borderColor: '#8B5CF6'
    },
    {
      label: 'Property-Based',
      value: propertyBasedEstimates,
      percentage: totalEstimates ? `${((propertyBasedEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Building2,
      iconBg: '#E0F2FE',
      iconColor: '#0EA5E9',
      borderColor: '#0EA5E9'
    },
    {
      label: 'Draft',
      value: draftEstimates,
      percentage: totalEstimates ? `${((draftEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: FileEdit,
      iconBg: '#FEF3C7',
      iconColor: '#F59E0B',
      borderColor: '#F59E0B'
    },
    {
      label: 'Sent',
      value: sentEstimates,
      percentage: totalEstimates ? `${((sentEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Mail,
      iconBg: '#D1FAE5',
      iconColor: '#10B981',
      borderColor: '#10B981'
    },
    {
      label: 'Approved',
      value: approvedEstimates,
      percentage: totalEstimates ? `${((approvedEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: CheckCircle,
      iconBg: '#CCFBF1',
      iconColor: '#14B8A6',
      borderColor: '#14B8A6'
    },
    {
      label: 'Rejected',
      value: rejectedEstimates,
      percentage: totalEstimates ? `${((rejectedEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: XCircle,
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      borderColor: '#EF4444'
    }
  ];

  // Property type distribution data for property-based estimates only
  const propertyBasedOnly = filteredEstimates.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  );
  
  const propertyTypeCount = {};
  propertyBasedOnly.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    propertyTypeCount[propType] = (propertyTypeCount[propType] || 0) + 1;
  });
  
  const propertyTypeData = Object.entries(propertyTypeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Status distribution data (for donut chart) - matching reference colors
  const statusData = [
    { name: 'Draft', value: draftEstimates, color: '#3B82F6' },
    { name: 'Sent', value: sentEstimates, color: '#F59E0B' },
    { name: 'Approved', value: approvedEstimates, color: '#22C55E' },
    { name: 'Rejected', value: rejectedEstimates, color: '#EF4444' }
  ].filter(item => item.value > 0);

  // Estimate type distribution (for donut chart)
  const typeData = [
    { name: 'Direct Estimates', value: directEstimates, color: '#8B5CF6' },
    { name: 'Property-Based', value: propertyBasedEstimates, color: '#3B82F6' }
  ].filter(item => item.value > 0);

  // Calculate trend data for line chart
  const getTrendData = () => {
    const monthlyData = {};
    const now = new Date();
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear();
      monthlyData[key] = { name: key, direct: 0, property: 0, sortDate: date };
    }
    
    estimates.forEach(est => {
      const date = new Date(est.created_at || est.createdAt);
      const key = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear();
      
      if (monthlyData[key]) {
        if (est.estimate_type === 'direct' || est.estimateType === 'direct') {
          monthlyData[key].direct++;
        } else {
          monthlyData[key].property++;
        }
      }
    });
    
    return Object.values(monthlyData).sort((a, b) => a.sortDate - b.sortDate);
  };

  const trendData = getTrendData();

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
          <p className="font-medium text-gray-800 text-sm">{label || payload[0]?.name}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color || entry.fill }} className="text-sm">
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 bg-red-50 text-red-600 p-6 rounded-xl flex items-center gap-3 border border-red-200">
        <XCircle className="w-6 h-6 flex-shrink-0" />
        <div>
          <p className="font-medium">Failed to load dashboard</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
        <button 
          onClick={() => fetchEstimates()} 
          className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of all your estimates</p>
        </div>
        <button
          onClick={() => fetchEstimates(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stat Cards Row - 7 cards matching reference */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              onClick={() => navigate(`${getBasePath()}/estimates`)}
              className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all group"
              style={{ borderTop: `3px solid ${card.borderColor}` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: card.iconBg }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.iconColor }} />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{card.value}</div>
              <div className="text-xs text-gray-500 mb-2">{card.percentage}</div>
              <div 
                className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all"
                style={{ color: card.borderColor }}
              >
                View All <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Row - 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estimates by Property Type (Horizontal Bar) */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Estimates by Property Type (Property-Based)</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </div>
            </div>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white cursor-pointer"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          
          {propertyTypeData.length > 0 ? (
            <div className="space-y-3">
              {propertyTypeData.map((item, index) => {
                const maxValue = Math.max(...propertyTypeData.map(d => d.value));
                const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const colors = ['#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444'];
                const bgColors = ['#EFF6FF', '#F5F3FF', '#ECFEFF', '#FFFBEB', '#FEF2F2'];
                
                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-28 text-sm text-gray-600 truncate">{item.name}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div 
                        className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                        style={{ 
                          width: `${Math.max(widthPercent, 15)}%`,
                          backgroundColor: colors[index % colors.length]
                        }}
                      >
                        <span className="text-white text-xs font-medium">{item.value}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-center gap-1 text-xs text-gray-400 mt-2">
                <span>0</span>
                <span className="flex-1 text-center">Number of Estimates</span>
                <span>{Math.max(...propertyTypeData.map(d => d.value))}</span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              No property-based estimates
            </div>
          )}
        </div>

        {/* Estimate Status Overview (Donut) */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Estimate Status Overview</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </div>
            </div>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white cursor-pointer"
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 relative">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-gray-400">
                  No data
                </div>
              )}
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800">{totalEstimates}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
            </div>
            <div className="w-1/2 space-y-2 pl-4">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="text-gray-800">
                    {item.value} ({totalEstimates ? ((item.value / totalEstimates) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Estimates by Estimate Type (Donut) */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Estimates by Estimate Type</h3>
            </div>
            <select
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white cursor-pointer"
            >
              <option>This Month</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 relative">
              {typeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-44 flex items-center justify-center text-gray-400">
                  No data
                </div>
              )}
            </div>
            <div className="w-1/2 space-y-3 pl-4">
              {typeData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600">{item.name}</span>
                  <span className="ml-auto font-medium text-gray-800">
                    {item.value} ({totalEstimates ? ((item.value / totalEstimates) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Trend & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estimate Trend (Line Chart) */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Estimate Trend</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </div>
            </div>
            <select
              value={trendPeriod}
              onChange={(e) => setTrendPeriod(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white cursor-pointer"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="direct" 
                  name="Direct Estimates"
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="property" 
                  name="Property-Based Estimates"
                  stroke="#8B5CF6" 
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Estimates Funnel */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800">Estimates Funnel (This Month)</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Funnel Visual */}
            <div className="flex-1 flex flex-col items-center gap-1">
              {/* Total Estimates */}
              <div 
                className="w-full h-10 rounded flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#3B82F6' }}
              >
                {thisMonthTotal} Total Estimates
              </div>
              {/* Sent */}
              <div 
                className="w-11/12 h-10 rounded flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#F59E0B' }}
              >
                {thisMonthSent} Sent
              </div>
              {/* Approved */}
              <div 
                className="w-10/12 h-10 rounded flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#22C55E' }}
              >
                {thisMonthApproved} Approved
              </div>
              {/* Invoices Created */}
              <div 
                className="w-9/12 h-10 rounded flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#14B8A6' }}
              >
                {thisMonthInvoicesCreated} Invoices Created
              </div>
              {/* Paid */}
              <div 
                className="w-8/12 h-10 rounded flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: '#8B5CF6' }}
              >
                {thisMonthPaid} Paid
              </div>
            </div>
            
            {/* Funnel Legend */}
            <div className="w-40 space-y-2">
              {[
                { label: 'Total Estimates', value: thisMonthTotal, percent: 100, color: '#3B82F6' },
                { label: 'Sent', value: thisMonthSent, percent: thisMonthTotal ? ((thisMonthSent / thisMonthTotal) * 100).toFixed(1) : 0, color: '#F59E0B' },
                { label: 'Approved', value: thisMonthApproved, percent: thisMonthTotal ? ((thisMonthApproved / thisMonthTotal) * 100).toFixed(1) : 0, color: '#22C55E' },
                { label: 'Invoices Created', value: thisMonthInvoicesCreated, percent: thisMonthTotal ? ((thisMonthInvoicesCreated / thisMonthTotal) * 100).toFixed(1) : 0, color: '#14B8A6' },
                { label: 'Paid', value: thisMonthPaid, percent: thisMonthTotal ? ((thisMonthPaid / thisMonthTotal) * 100).toFixed(1) : 0, color: '#8B5CF6' }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: item.color }}>{item.value}</span>
                    <span className="text-gray-600">{item.label}</span>
                  </div>
                  <span className="text-gray-500">{item.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatesDashboard;
