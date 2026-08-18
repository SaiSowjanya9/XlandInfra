import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import SVGDonutChart from './common/DonutChart';
import { STATUS_COLORS, ESTIMATE_TYPE_COLORS, getConsistentColor } from '../utils/chartColors';

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
      <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
        <p className="font-semibold text-gray-900 text-sm mb-2">{payload[0]?.name}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-bold text-gray-900">{entry.value}</span>
          </div>
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
const DonutChartWithLegend = ({ data, dataAll, total, title }) => (
  <div className="flex items-center">
    <div className="w-1/2 relative flex items-center justify-center">
      <SVGDonutChart data={dataAll} centerValue={total} size={120} strokeWidth={16} />
    </div>
    <div className="w-1/2 space-y-1.5 pl-3">
      {dataAll.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5 text-xs">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-gray-600 w-20 flex-shrink-0">{item.name}</span>
          <span className="text-gray-800 font-medium whitespace-nowrap">
            {item.value} ({total ? ((item.value / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      ))}
    </div>
  </div>
);

// Horizontal bar chart component with tooltip
const HorizontalBarChart = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (data.length === 0) {
    return (
      <div className="h-36 flex flex-col items-center justify-center text-gray-400">
        <div className="text-3xl font-bold text-gray-300 mb-1">0</div>
        <div className="text-xs">No estimates</div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const barColor = getConsistentColor(item.name);
        return (
          <div 
            key={index} 
            className="flex items-center gap-2 relative group cursor-pointer"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="w-20 text-xs text-gray-600 truncate">{item.name}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
              <div 
                className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                style={{ 
                  width: `${Math.max(widthPercent, 15)}%`,
                  backgroundColor: barColor
                }}
              >
                <span className="text-white text-[10px] font-medium">{item.value}</span>
              </div>
              {/* Tooltip */}
              {hoveredIndex === index && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap">
                  <p className="font-semibold text-gray-900 text-sm mb-1">{item.name}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: barColor }}></div>
                    <span className="text-gray-600">Count:</span>
                    <span className="font-bold text-gray-900">{item.value} estimates</span>
                  </div>
                </div>
              )}
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

// Category colors for grouped chart
const CATEGORY_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'
];

// Grouped bar chart - Categories by Property Type
const GroupedBarChart = ({ data }) => {
  const { propertyTypes, categories, data: groupedData } = data;
  const [hoveredBar, setHoveredBar] = useState(null);
  
  if (propertyTypes.length === 0) {
    return (
      <div className="h-36 flex flex-col items-center justify-center text-gray-400">
        <div className="text-3xl font-bold text-gray-300 mb-1">0</div>
        <div className="text-xs">No work order estimates</div>
      </div>
    );
  }

  // Find max value for scaling
  let maxValue = 0;
  propertyTypes.forEach(pt => {
    categories.forEach(cat => {
      const val = groupedData[pt]?.[cat] || 0;
      if (val > maxValue) maxValue = val;
    });
  });

  return (
    <div className="h-48 flex">
      {/* Chart - Left side */}
      <div className="flex-1 flex items-end justify-center gap-6 h-36">
        {propertyTypes.map((propType) => (
          <div key={propType} className="flex flex-col items-center">
            {/* Bars group */}
            <div className="flex items-end gap-1">
              {categories.map((cat, catIdx) => {
                const value = groupedData[propType]?.[cat] || 0;
                const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                const barColor = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length];
                const barKey = `${propType}-${cat}`;
                return (
                  <div 
                    key={cat} 
                    className="flex flex-col items-center relative"
                    onMouseEnter={() => setHoveredBar(barKey)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {value > 0 && (
                      <span className="text-[9px] font-semibold text-gray-700 mb-1">{value}</span>
                    )}
                    <div 
                      className="w-6 rounded-t-md transition-all duration-500 cursor-pointer"
                      style={{ 
                        height: value > 0 ? `${Math.max(heightPercent, 10)}%` : '0px',
                        backgroundColor: barColor,
                        minHeight: value > 0 ? '16px' : '0px'
                      }}
                    />
                    {/* Tooltip */}
                    {hoveredBar === barKey && value > 0 && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap">
                        <p className="font-semibold text-gray-900 text-sm mb-1">{propType}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: barColor }}></div>
                          <span className="text-gray-600">{cat}:</span>
                          <span className="font-bold text-gray-900">{value}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Property type label */}
            <span className="text-[10px] text-gray-600 font-medium mt-2 text-center truncate w-20" title={propType}>
              {propType}
            </span>
          </div>
        ))}
      </div>
      
      {/* Legend - Right side */}
      <div className="w-36 flex flex-col justify-center gap-1.5 pl-3 border-l border-gray-100">
        {categories.map((cat, idx) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-sm flex-shrink-0" 
              style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
            />
            <span className="text-[9px] text-gray-600 leading-tight" title={cat}>
              {cat}
            </span>
          </div>
        ))}
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
  const [filter7, setFilter7] = useState('all'); // Work Order Status
  const [filter8, setFilter8] = useState('all'); // Work Order Category
  const [filter9, setFilter9] = useState('all'); // Work Order Overview

  // Block 1: Estimates by Estimate Type (includes Work Order)
  const block1Filtered = applyPeriodFilter(estimates, filter3);
  const block1Direct = block1Filtered.filter(e => e.estimate_type === 'direct' || e.estimateType === 'direct').length;
  const block1PropertyBased = block1Filtered.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  ).length;
  const block1WorkOrder = block1Filtered.filter(e => e.estimate_type === 'work_order' || e.estimateType === 'work_order').length;
  const typeDataAll = [
    { name: 'Direct Estimates', value: block1Direct, color: ESTIMATE_TYPE_COLORS['Direct Estimates'] },
    { name: 'Property-Based', value: block1PropertyBased, color: ESTIMATE_TYPE_COLORS['Property-Based'] },
    { name: 'Work Order', value: block1WorkOrder, color: ESTIMATE_TYPE_COLORS['Work Order'] }
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
    { name: 'Draft', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block3Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  const propertyStatusData = propertyStatusDataAll.filter(item => item.value > 0);

  // Block 4: Estimate Status (All)
  const block4Filtered = applyPeriodFilter(estimates, filter2);
  const statusDataAll = [
    { name: 'Draft', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block4Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
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
    { name: 'Draft', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block6Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  const directStatusData = directStatusDataAll.filter(item => item.value > 0);

  // Block 7: Work Order Estimate Overview (count by status)
  const block7Filtered = applyPeriodFilter(estimates, filter9).filter(e => 
    e.estimate_type === 'work_order' || e.estimateType === 'work_order'
  );
  const workOrderOverviewDataAll = [
    { name: 'Draft', value: block7Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Pending', value: block7Filtered.filter(e => (e.status || '').toLowerCase() === 'pending').length, color: '#F59E0B' },
    { name: 'Sent', value: block7Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block7Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block7Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  // Calculate total from breakdown to ensure accuracy
  const workOrderOverviewTotal = workOrderOverviewDataAll.reduce((sum, item) => sum + item.value, 0);
  const workOrderOverviewData = workOrderOverviewDataAll.filter(item => item.value > 0);

  // Block 8: Work Order Estimates by Category grouped by Property Type
  const block8Filtered = applyPeriodFilter(estimates, filter8).filter(e => 
    e.estimate_type === 'work_order' || e.estimateType === 'work_order'
  );
  
  // Group by property type, then by category
  const workOrderByPropertyAndCategory = {};
  const allCategories = new Set();
  
  block8Filtered.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    const category = est.work_order_category || est.workOrderCategory || 'Other';
    
    allCategories.add(category);
    
    if (!workOrderByPropertyAndCategory[propType]) {
      workOrderByPropertyAndCategory[propType] = {};
    }
    workOrderByPropertyAndCategory[propType][category] = 
      (workOrderByPropertyAndCategory[propType][category] || 0) + 1;
  });
  
  // Convert to array format for chart
  const propertyTypes = Object.keys(workOrderByPropertyAndCategory).sort();
  const categories = Array.from(allCategories).sort();
  
  const groupedWorkOrderData = {
    propertyTypes,
    categories,
    data: workOrderByPropertyAndCategory
  };

  // Block 9: Work Order Estimate Status
  const block9Filtered = applyPeriodFilter(estimates, filter7).filter(e => 
    e.estimate_type === 'work_order' || e.estimateType === 'work_order'
  );
  const workOrderStatusDataAll = [
    { name: 'Draft', value: block9Filtered.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block9Filtered.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block9Filtered.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block9Filtered.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  const workOrderStatusData = workOrderStatusDataAll.filter(item => item.value > 0);

  return (
    <div className="space-y-4">
      {/* Row 1: Estimates by Estimate Type | Estimate Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Estimates by Estimate Type */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Estimate Type</h3>
            <FilterSelect value={filter3} onChange={setFilter3} />
          </div>
          <DonutChartWithLegend 
            data={typeData} 
            dataAll={typeDataAll}
            total={block1Filtered.length}
          />
        </div>

        {/* 2. Estimate Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimate Status</h3>
            <FilterSelect value={filter2} onChange={setFilter2} />
          </div>
          <DonutChartWithLegend 
            data={statusData} 
            dataAll={statusDataAll}
            total={block4Filtered.length}
          />
        </div>
      </div>

      {/* Row 2: Property-Based Status | Estimates by Property Type (Property-Based) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 3. Property-Based Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Property-Based Status</h3>
            <FilterSelect value={filter6} onChange={setFilter6} />
          </div>
          <DonutChartWithLegend 
            data={propertyStatusData} 
            dataAll={propertyStatusDataAll}
            total={block3Filtered.length}
          />
        </div>

        {/* 4. Estimates by Property Type (Property-Based) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Property Type (Property-Based)</h3>
            <FilterSelect value={filter1} onChange={setFilter1} />
          </div>
          <HorizontalBarChart data={propertyTypeData} />
        </div>
      </div>

      {/* Row 3: Direct Estimate Status | Estimates by Property Type (Direct) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 5. Direct Estimate Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Direct Estimate Status</h3>
            <FilterSelect value={filter5} onChange={setFilter5} />
          </div>
          <DonutChartWithLegend 
            data={directStatusData} 
            dataAll={directStatusDataAll}
            total={block6Filtered.length}
          />
        </div>

        {/* 6. Estimates by Property Type (Direct) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Property Type (Direct)</h3>
            <FilterSelect value={filter4} onChange={setFilter4} />
          </div>
          <HorizontalBarChart data={directPropertyTypeData} />
        </div>
      </div>

      {/* Row 4: Work Order Estimate Status | Work Order Estimates by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 7. Work Order Estimate Status */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Work Order Estimate Status</h3>
            <FilterSelect value={filter9} onChange={setFilter9} />
          </div>
          <DonutChartWithLegend 
            data={workOrderOverviewData} 
            dataAll={workOrderOverviewDataAll}
            total={workOrderOverviewTotal}
          />
        </div>

        {/* 8. Work Order Estimates by Category (Grouped by Property Type) */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Work Orders: Category by Property Type</h3>
            <FilterSelect value={filter8} onChange={setFilter8} />
          </div>
          <GroupedBarChart data={groupedWorkOrderData} />
        </div>
      </div>
    </div>
  );
};

export default EstimatesOverviewBlocks;
