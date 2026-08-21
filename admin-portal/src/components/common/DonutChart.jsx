import React, { useState } from 'react';

/**
 * Pure SVG Donut Chart Component with Hover Tooltip
 * @param {Array} data - Array of { name, value, color } objects
 * @param {number} size - Size of the chart in pixels (default: 144)
 * @param {number} strokeWidth - Width of the donut ring (default: 20)
 * @param {string|number} centerValue - Value to show in center
 * @param {string} centerLabel - Label below the center value (default: 'Total')
 */
const DonutChart = ({ 
  data = [], 
  size = 144, 
  strokeWidth = 20, 
  centerValue = 0, 
  centerLabel = 'Total' 
}) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  // Filter out zero values and calculate total
  const validData = data.filter(item => item.value > 0);
  const total = validData.reduce((sum, item) => sum + item.value, 0) || 1;
  
  // Pre-calculate all segments with their offsets
  const segments = [];
  let runningOffset = 0;
  
  validData.forEach((item, idx) => {
    const length = (item.value / total) * circumference;
    segments.push({
      name: item.name,
      value: item.value,
      color: item.color,
      length,
      offset: runningOffset,
      percentage: ((item.value / total) * 100).toFixed(1)
    });
    runningOffset += length;
  });
  
  return (
    <div className="relative inline-block">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background gray ring - always visible */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {/* Colored segments */}
        {segments.map((seg, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hoveredSegment === idx ? strokeWidth + 4 : strokeWidth}
            strokeDasharray={`${seg.length} ${circumference}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ 
              transition: 'stroke-dasharray 0.3s ease, stroke-width 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={() => setHoveredSegment(idx)}
            onMouseLeave={() => setHoveredSegment(null)}
          />
        ))}
        {/* Center text */}
        <text 
          x={center} 
          y={center - 5} 
          textAnchor="middle" 
          fontSize="18" 
          fontWeight="bold" 
          fill="#111827"
        >
          {centerValue}
        </text>
        <text 
          x={center} 
          y={center + 12} 
          textAnchor="middle" 
          fontSize="10" 
          fill="#6B7280"
        >
          {centerLabel}
        </text>
      </svg>
      {/* Tooltip */}
      {hoveredSegment !== null && segments[hoveredSegment] && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap pointer-events-none"
          style={{ top: '-60px' }}
        >
          <p className="font-semibold text-gray-900 text-sm mb-1">{segments[hoveredSegment].name}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: segments[hoveredSegment].color, minWidth: '12px', minHeight: '12px' }}></span>
            <span className="text-gray-600">Count:</span>
            <span className="font-bold text-gray-900">{segments[hoveredSegment].value}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{segments[hoveredSegment].percentage}% of total</p>
        </div>
      )}
    </div>
  );
};

export default DonutChart;
