import React from 'react';

/**
 * Pure SVG Donut Chart Component
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
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  // Filter out zero values and calculate total
  const validData = data.filter(item => item.value > 0);
  const total = validData.reduce((sum, item) => sum + item.value, 0) || 1;
  
  // Pre-calculate all segments with their offsets
  const segments = [];
  let runningOffset = 0;
  
  validData.forEach(item => {
    const length = (item.value / total) * circumference;
    segments.push({
      color: item.color,
      length,
      offset: runningOffset
    });
    runningOffset += length;
  });
  
  return (
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
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.length} ${circumference}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dasharray 0.3s ease' }}
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
  );
};

export default DonutChart;
