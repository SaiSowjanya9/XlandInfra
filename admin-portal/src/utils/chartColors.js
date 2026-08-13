/**
 * Chart Colors - Single source of truth for all chart colors across the application.
 * This ensures consistent colors for statuses, estimate types, and other chart data
 * regardless of where they are displayed.
 */

// Status colors - used for Draft, Sent, Approved, Rejected in all status charts
export const STATUS_COLORS = {
  Draft: '#5B8DEF',     // Blue
  Sent: '#FBBF24',      // Yellow/Amber
  Approved: '#14B8A6',  // Teal
  Rejected: '#EF4444'   // Red
};

// Estimate type colors - used in "Estimates by Estimate Type" charts
export const ESTIMATE_TYPE_COLORS = {
  'Direct Estimates': '#8B5CF6',  // Purple
  'Property-Based': '#06B6D4',    // Cyan
  'Work Order': '#F97316'         // Orange
};

// Bar chart colors - used for horizontal bar charts (property types, categories)
export const BAR_CHART_COLORS = ['#5B8DEF', '#22C55E', '#14B8A6', '#FBBF24', '#EF4444'];

/**
 * Helper function to create status data array with consistent colors
 * @param {Object} counts - Object with Draft, Sent, Approved, Rejected counts
 * @returns {Array} Array of { name, value, color } objects for chart consumption
 */
export const createStatusDataArray = (counts) => [
  { name: 'Draft', value: counts.Draft || 0, color: STATUS_COLORS.Draft },
  { name: 'Sent', value: counts.Sent || 0, color: STATUS_COLORS.Sent },
  { name: 'Approved', value: counts.Approved || 0, color: STATUS_COLORS.Approved },
  { name: 'Rejected', value: counts.Rejected || 0, color: STATUS_COLORS.Rejected }
];

/**
 * Helper function to create estimate type data array with consistent colors
 * @param {Object} counts - Object with Direct, PropertyBased, WorkOrder counts
 * @returns {Array} Array of { name, value, color } objects for chart consumption
 */
export const createEstimateTypeDataArray = (counts) => [
  { name: 'Direct Estimates', value: counts.Direct || 0, color: ESTIMATE_TYPE_COLORS['Direct Estimates'] },
  { name: 'Property-Based', value: counts.PropertyBased || 0, color: ESTIMATE_TYPE_COLORS['Property-Based'] },
  { name: 'Work Order', value: counts.WorkOrder || 0, color: ESTIMATE_TYPE_COLORS['Work Order'] }
];

export default {
  STATUS_COLORS,
  ESTIMATE_TYPE_COLORS,
  BAR_CHART_COLORS,
  createStatusDataArray,
  createEstimateTypeDataArray
};
