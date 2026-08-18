import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

// Work order status colors - modern, vibrant palette
const STATUS_COLORS = {
  pending: '#F59E0B',      // Amber
  under_review: '#F97316', // Orange
  assigned: '#3B82F6',     // Blue
  in_progress: '#8B5CF6',  // Purple
  completed: '#10B981',    // Emerald
  cancelled: '#EF4444',    // Red
  closed: '#6B7280',       // Gray
};

const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

// Custom tooltip component
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-900 mb-1">{data.name}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.fill }}></div>
          <span className="text-gray-600">Count:</span>
          <span className="font-bold text-gray-900">{data.value} orders</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {data.percentage}% of total
        </p>
      </div>
    );
  }
  return null;
};

// Custom legend component
const CustomLegend = ({ payload, onClickLegend }) => {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {payload.map((entry, index) => (
        <button
          key={index}
          onClick={() => onClickLegend && onClickLegend(entry.payload.status)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <span 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-gray-600 dark:text-slate-300">
            {entry.value}
          </span>
          <span className="text-xs font-bold text-gray-900 dark:text-white">
            ({entry.payload.value})
          </span>
        </button>
      ))}
    </div>
  );
};

const WorkOrderPieChart = ({ 
  data = {}, 
  title = "Work Orders Overview",
  basePath = "/work-orders",
  onStatusClick,
  size = "default", // "small", "default", "large"
  showLegend = true,
  showTotal = true,
  className = ""
}) => {
  const navigate = useNavigate();

  // Convert data object to array format for recharts
  const chartData = Object.entries(data)
    .filter(([_, value]) => value > 0)
    .map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      value: value,
      status: status,
      fill: STATUS_COLORS[status] || '#6B7280',
    }));

  // Calculate total and add percentage
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  chartData.forEach(item => {
    item.percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
  });

  // Handle click on pie segment or legend
  const handleClick = (data) => {
    if (onStatusClick) {
      onStatusClick(data.status);
    } else if (basePath) {
      navigate(`${basePath}?status=${data.status}`);
    }
  };

  // Size configurations
  const sizeConfig = {
    small: { outer: 60, inner: 40, height: 200 },
    default: { outer: 90, inner: 60, height: 280 },
    large: { outer: 110, inner: 75, height: 340 },
  };

  const config = sizeConfig[size] || sizeConfig.default;

  // If no data, show empty state
  if (chartData.length === 0 || total === 0) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-24 h-24 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-slate-400 text-sm">No work orders yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {showTotal && (
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Total Orders</p>
          </div>
        )}
      </div>
      
      <div style={{ height: config.height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={config.inner}
              outerRadius={config.outer}
              paddingAngle={3}
              dataKey="value"
              onClick={handleClick}
              cursor="pointer"
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill}
                  stroke="white"
                  strokeWidth={2}
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && (
              <Legend 
                content={<CustomLegend onClickLegend={handleClick} />}
                verticalAlign="bottom"
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WorkOrderPieChart;
