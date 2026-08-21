import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Activity, Users, Globe, Smartphone, Monitor, Tablet, Clock,
  TrendingUp, TrendingDown, MapPin, Calendar, Zap
} from 'lucide-react';

// XLAND INFRA Color Palette
const COLORS = {
  gold: '#d4af37',
  goldLight: '#f4e5b5',
  black: '#1a1a1a',
  dark: '#2d2d2d',
  white: '#ffffff',
  gray: '#6b7280',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6'
};

const CHART_COLORS = [COLORS.gold, COLORS.info, COLORS.success, COLORS.purple, COLORS.warning];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-lg">
        <p className="text-gray-900 font-semibold text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color, minWidth: '12px', minHeight: '12px' }}></span>
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-bold text-gray-900">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Scan Trend Chart
export const ScanTrendChart = ({ data, period = '7d' }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      scans: item.scans || 0,
      unique: item.unique_users || 0
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No scan data available</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.gold} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.gold} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="uniqueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.info} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
        <XAxis 
          dataKey="date" 
          stroke="#6b7280" 
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="#6b7280" 
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="scans"
          name="Total Scans"
          stroke={COLORS.gold}
          fill="url(#scanGradient)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="unique"
          name="Unique Users"
          stroke={COLORS.info}
          fill="url(#uniqueGradient)"
          strokeWidth={2}
        />
        <Legend 
          wrapperStyle={{ paddingTop: 20 }}
          formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// Device Distribution Chart
export const DeviceChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const total = data.reduce((sum, d) => sum + (d.count || 0), 0);
    return data.map((item, index) => ({
      name: (item.device_type || 'Unknown').charAt(0).toUpperCase() + (item.device_type || 'unknown').slice(1),
      value: item.count || 0,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : 0,
      fill: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [data]);

  const deviceIcons = {
    Mobile: Smartphone,
    Tablet: Tablet,
    Desktop: Monitor,
    Unknown: Monitor
  };

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Smartphone className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No device data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="50%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-3">
        {chartData.map((item, index) => {
          const Icon = deviceIcons[item.name] || Monitor;
          return (
            <div key={index} className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.fill }}
              />
              <Icon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300 text-sm flex-1">{item.name}</span>
              <span className="text-amber-500 font-semibold text-sm">{item.percentage}%</span>
              <span className="text-gray-500 text-xs">({item.value})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Geographic Distribution Chart
export const GeoChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(0, 8).map(item => ({
      country: item.country || 'Unknown',
      code: item.country_code || 'XX',
      count: item.count || 0
    }));
  }, [data]);

  const getCountryFlag = (code) => {
    if (!code || code === 'XX') return '🌍';
    try {
      const codePoints = code.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch {
      return '🌍';
    }
  };

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No geographic data available</p>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="space-y-3">
      {chartData.map((item, index) => (
        <div key={index} className="group">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getCountryFlag(item.code)}</span>
              <span className="text-gray-300 text-sm">{item.country}</span>
            </div>
            <span className="text-amber-500 font-semibold text-sm">{item.count.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500 group-hover:from-amber-400 group-hover:to-amber-300"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Hourly Heatmap
export const HourlyHeatmap = ({ data }) => {
  const heatmapData = useMemo(() => {
    const matrix = Array(7).fill(null).map(() => Array(24).fill(0));
    
    if (data && data.length > 0) {
      data.forEach(item => {
        const day = (item.day_of_week || 1) - 1; // Convert 1-7 to 0-6
        const hour = item.hour || 0;
        if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
          matrix[day][hour] = item.count || 0;
        }
      });
    }
    
    return matrix;
  }, [data]);

  const maxValue = Math.max(...heatmapData.flat(), 1);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getColor = (value) => {
    if (value === 0) return 'rgba(212, 175, 55, 0.05)';
    const intensity = value / maxValue;
    return `rgba(212, 175, 55, ${0.2 + intensity * 0.8})`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1 pl-12">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="flex-1 text-center text-gray-500 text-[10px]">
              {i % 3 === 0 ? `${i}:00` : ''}
            </div>
          ))}
        </div>
        
        {/* Heatmap grid */}
        {heatmapData.map((row, dayIndex) => (
          <div key={dayIndex} className="flex items-center gap-1 mb-1">
            <span className="w-10 text-gray-400 text-xs text-right pr-2">{days[dayIndex]}</span>
            <div className="flex flex-1 gap-0.5">
              {row.map((value, hourIndex) => (
                <div
                  key={hourIndex}
                  className="flex-1 h-6 rounded-sm transition-all duration-200 hover:ring-1 hover:ring-amber-400 cursor-pointer"
                  style={{ backgroundColor: getColor(value) }}
                  title={`${days[dayIndex]} ${hourIndex}:00 - ${value} scans`}
                />
              ))}
            </div>
          </div>
        ))}
        
        {/* Legend */}
        <div className="flex items-center justify-end mt-4 gap-2">
          <span className="text-gray-500 text-xs">Less</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 1].map((intensity, i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: `rgba(212, 175, 55, ${0.2 + intensity * 0.8})` }}
              />
            ))}
          </div>
          <span className="text-gray-500 text-xs">More</span>
        </div>
      </div>
    </div>
  );
};

// Real-time Activity Feed
export const ActivityFeed = ({ scans, maxItems = 10 }) => {
  if (!scans || scans.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Zap className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No recent activity</p>
        </div>
      </div>
    );
  }

  const deviceIcons = {
    mobile: Smartphone,
    tablet: Tablet,
    desktop: Monitor
  };

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
      {scans.slice(0, maxItems).map((scan, index) => {
        const Icon = deviceIcons[scan.device_type] || Monitor;
        const time = new Date(scan.scanned_at);
        
        return (
          <div
            key={scan.scan_id || index}
            className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Icon className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white text-sm font-medium">
                  {scan.browser_name || 'Unknown Browser'}
                </span>
                <span className="text-gray-500 text-xs">on</span>
                <span className="text-gray-300 text-sm">
                  {scan.os_name || 'Unknown OS'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                <span>
                  {scan.city && scan.country 
                    ? `${scan.city}, ${scan.country}`
                    : 'Unknown Location'
                  }
                </span>
                <Clock className="w-3 h-3 ml-2" />
                <span>
                  {time.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                scan.device_type === 'mobile' ? 'bg-blue-500/20 text-blue-400' :
                scan.device_type === 'tablet' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {scan.device_type || 'unknown'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Browser Distribution Bar Chart
export const BrowserChart = ({ data }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.slice(0, 5).map(item => ({
      name: item.browser_name || 'Unknown',
      count: item.count || 0
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500">
        <p>No browser data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} horizontal={false} />
        <XAxis type="number" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis 
          type="category" 
          dataKey="name" 
          stroke="#6b7280" 
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="count" 
          name="Scans"
          fill={COLORS.gold}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Stats Card with Trend
export const StatCardWithTrend = ({ 
  icon: Icon, 
  label, 
  value, 
  previousValue, 
  subtext,
  color = 'amber' 
}) => {
  const trend = previousValue > 0 
    ? ((value - previousValue) / previousValue * 100).toFixed(1) 
    : 0;
  const isPositive = trend >= 0;

  const colorClasses = {
    amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-xl border rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl bg-${color}-500/20`}>
          <Icon className={`w-5 h-5 text-${color}-500`} />
        </div>
        {previousValue > 0 && (
          <div className={`flex items-center gap-1 text-xs ${
            isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-white">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className={`text-${color}-500 text-sm mt-1`}>{label}</p>
      {subtext && <p className="text-gray-500 text-xs mt-0.5">{subtext}</p>}
    </div>
  );
};

export default {
  ScanTrendChart,
  DeviceChart,
  GeoChart,
  HourlyHeatmap,
  ActivityFeed,
  BrowserChart,
  StatCardWithTrend
};
