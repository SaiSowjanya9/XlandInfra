import React, { useState } from 'react';
import useChartTooltip from './ChartTooltip';

/**
 * Pure SVG Donut Chart Component with Hover Tooltip
 * @param {Array} data - Array of { name, value, color } objects
 * @param {number} size - Size of the chart in pixels (default: 144)
 * @param {number} strokeWidth - Width of the donut ring (default: 20)
 * @param {string|number} centerValue - Value to show in center
 * @param {string} centerLabel - Label below the center value (default: 'Total')
 * @param {string} valueLabel - What the figure is, in the tooltip (default: 'Count')
 * @param {Function} formatValue - Formats that figure; counts are shown as they are
 *
 * The tooltip is drawn through `useChartTooltip`, which renders it into the body. It used to be an
 * absolutely positioned card 60px above the chart, which put it outside the `overflow-hidden` cards
 * on the Work Orders and Schedules dashboards -- hovering a segment there displayed nothing at all.
 */
const DonutChart = ({ 
  data = [], 
  size = 144, 
  strokeWidth = 20, 
  centerValue = 0, 
  centerLabel = 'Total',
  valueLabel = 'Count',
  formatValue = value => `${value}`
}) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const chart = useChartTooltip();
  
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
        {/* Colored segments. The segment thickens under the pointer and the tooltip names it. */}
        {segments.map((seg, idx) => {
          const readout = chart.hover({
            title: seg.name,
            rows: [{ label: valueLabel, value: formatValue(seg.value), color: seg.color }],
            footer: `${seg.percentage}% of total`
          });
          return (
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
              onMouseMove={readout.onMouseMove}
              onMouseEnter={event => { setHoveredSegment(idx); readout.onMouseEnter(event); }}
              onMouseLeave={event => { setHoveredSegment(null); readout.onMouseLeave(event); }}
            />
          );
        })}
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
          fontSize="11" 
          fontWeight="500"
          fill="#374151"
        >
          {centerLabel}
        </text>
      </svg>
      {chart.node}
    </div>
  );
};

export default DonutChart;
