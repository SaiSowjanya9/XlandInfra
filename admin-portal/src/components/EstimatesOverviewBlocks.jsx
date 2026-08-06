import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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

// Apply time period filter
const applyPeriodFilter = (data, period) => {
  if (period === 'all') return data;
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  return data.filter(item => {
    const createdAt = new Date(item.created_at || item.createdAt);
    switch (period) {
      case 'week': return createdAt >= startOfWeek;
      case 'month': return createdAt >= startOfMonth;
      case 'quarter': return createdAt >= startOfQuarter;
      case 'half': return createdAt >= sixMonthsAgo;
      case 'year': return createdAt >= startOfYear;
      default: return true;
    }
  });
};

// Custom tooltip
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 px-3 py-2 shadow-xl rounded-lg border border-gray-700 z-50">
        <p className="font-semibold text-white text-sm mb-1">{payload[0]?.name}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Filter dropdown component
const FilterSelect = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white cursor-pointer hover:bg-gray-50 transition-all focus:ring-2 focus:ring-blue-400/30"
  >
    <option value="all">All Time</option>
    <option value="week">This Week</option>
    <option value="month">This Month</option>
    <option value="quarter">This Quarter</option>
    <option value="half">Last 6 Months</option>
    <option value="year">This Year</option>
  </select>
);

// Donut chart component with legend
const DonutChart = ({ data, dataAll, total, title }) => (
  <div className="flex items-center">
    <div className="w-1/2 relative">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={55}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-36 flex items-center justify-center">
          <div className="w-[110px] h-[110px] rounded-full border-8 border-gray-200"></div>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center bg-white rounded-full p-1">
          <div className="text-xl font-bold text-gray-800">{total}</div>
          <div className="text-[9px] text-gray-500">Total</div>
        </div>
      </div>
    </div>
    <div className="w-1/2 space-y-1.5 pl-3">
      {dataAll.map((item, index) => (
        <div key={index} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-gray-600">{item.name}</span>
          </div>
          <span className="text-gray-800 font-medium">
            {item.value} ({total ? ((item.value / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Horizontal bar chart component
const HorizontalBarChart = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="h-36 flex flex-col items-center justify-center text-gray-400">
        <div className="text-3xl font-bold text-gray-300 mb-1">0</div>
        <div className="text-xs">No estimates</div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const colors = ['#5B8DEF', '#22C55E', '#14B8A6', '#FBBF24', '#EF4444'];

  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={index} className="flex items-center gap-2">
            <div className="w-20 text-xs text-gray-600 truncate">{item.name}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div 
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                style={{ 
                  width: `${Math.max(widthPercent, 15)}%`,
                  backgroundColor: colors[index % colors.length]
                }}
              >
                <span className="text-white text-[10px] font-medium">{item.value}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
        <span>0</span>
        <span>Number of Estimates</span>
        <span>{maxValue}</span>
      </div>
    </div>
  );
};

const EstimatesOverviewBlocks = ({ estimates = [] }) => {
  // Individual filters for each block
  const [filter1, setFilter1] = useState('all'); // Property-Based Property Type
  const [filter2, setFilter2] = useState('all'); // Status Overview
  const [filter3, setFilter3] = useState('all'); // Estimate Type
  const [filter4, setFilter4] = useState('all'); // Direct Property Type
  const [filter5, setFilter5] = useState('all'); // Direct Status
  const [filter6, setFilter6] = useState('all'); // Property-Based Status

  // Block 1: Estimates by Estimate Type
  const block1Filtered = applyPeriodFilter(estimates, filter3);
  const block1Direct = block1Filtered.filter(e => e.estimate_type === 'direct' || e.estimateType === 'direct').length;
  const block1PropertyBased = block1Filtered.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  ).length;
  const typeDataAll = [
    { name: 'Direct Estimates', value: block1Direct, color: '#8B5CF6' },
    { name: 'Property-Based', value: block1PropertyBased, color: '#06B6D4' }
  ];
  const typeData = typeDataAll.filter(item => item.value > 0);

  // Block 2: Estimates by Property Type (Property-Based)
  const block2Filtered = applyPeriodFilter(estimates, filter1).filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  );
  const propertyTypeCount = {};
  block2Filtered.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    propertyTypeCount[propType] = (propertyTypeCount[propType] || 0) + 1;
  });
  const propertyTypeData = Object.entries(propertyTypeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Block 3: Property-Based Status
  const block3Filtered = applyPeriodFilter(estimates, filter6).filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  );
  const propertyStatusDataAll = [
    { name: 'Draft', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: '#5B8DEF' },
    { name: 'Sent', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: '#FBBF24' },
    { name: 'Approved', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: '#14B8A6' },
    { name: 'Rejected', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: '#EF4444' }
  ];
  const propertyStatusData = propertyStatusDataAll.filter(item => item.value > 0);

  // Block 4: Estimate Status Overview (All)
  const block4Filtered = applyPeriodFilter(estimates, filter2);
  const statusDataAll = [
    { name: 'Draft', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: '#5B8DEF' },
    { name: 'Sent', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: '#FBBF24' },
    { name: 'Approved', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: '#14B8A6' },
    { name: 'Rejected', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: '#EF4444' }
  ];
  const statusData = statusDataAll.filter(item => item.value > 0);

  // Block 5: Estimates by Property Type (Direct)
  const block5Filtered = applyPeriodFilter(estimates, filter4).filter(e => 
    e.estimate_type === 'direct' || e.estimateType === 'direct'
  );
  const directPropertyTypeCount = {};
  block5Filtered.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    directPropertyTypeCount[propType] = (directPropertyTypeCount[propType] || 0) + 1;
  });
  const directPropertyTypeData = Object.entries(directPropertyTypeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Block 6: Direct Estimate Status
  const block6Filtered = applyPeriodFilter(estimates, filter5).filter(e => 
    e.estimate_type === 'direct' || e.estimateType === 'direct'
  );
  const directStatusDataAll = [
    { name: 'Draft', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: '#5B8DEF' },
    { name: 'Sent', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: '#FBBF24' },
    { name: 'Approved', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: '#14B8A6' },
    { name: 'Rejected', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: '#EF4444' }
  ];
  const directStatusData = directStatusDataAll.filter(item => item.value > 0);

  return (
    <div className="space-y-4">
      {/* Row 1: 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Block 1: Estimates by Estimate Type */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Estimate Type</h3>
            <FilterSelect value={filter3} onChange={setFilter3} />
          </div>
          <DonutChart 
            data={typeData} 
            dataAll={typeDataAll}
            total={block1Filtered.length}
          />
        </div>

        {/* Block 2: Estimates by Property Type (Property-Based) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Property Type (Property-Based)</h3>
            <FilterSelect value={filter1} onChange={setFilter1} />
          </div>
          <HorizontalBarChart data={propertyTypeData} />
        </div>

        {/* Block 3: Property-Based Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Property-Based Status</h3>
            <FilterSelect value={filter6} onChange={setFilter6} />
          </div>
          <DonutChart 
            data={propertyStatusData} 
            dataAll={propertyStatusDataAll}
            total={block3Filtered.length}
          />
        </div>
      </div>

      {/* Row 2: 3 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Block 4: Estimate Status Overview */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimate Status Overview</h3>
            <FilterSelect value={filter2} onChange={setFilter2} />
          </div>
          <DonutChart 
            data={statusData} 
            dataAll={statusDataAll}
            total={block4Filtered.length}
          />
        </div>

        {/* Block 5: Estimates by Property Type (Direct) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Property Type (Direct)</h3>
            <FilterSelect value={filter4} onChange={setFilter4} />
          </div>
          <HorizontalBarChart data={directPropertyTypeData} />
        </div>

        {/* Block 6: Direct Estimate Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Direct Estimate Status</h3>
            <FilterSelect value={filter5} onChange={setFilter5} />
          </div>
          <DonutChart 
            data={directStatusData} 
            dataAll={directStatusDataAll}
            total={block6Filtered.length}
          />
        </div>
      </div>
    </div>
  );
};

export default EstimatesOverviewBlocks;
