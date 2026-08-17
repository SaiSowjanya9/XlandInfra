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

// Known category colors - ensures same category always gets same color
export const CATEGORY_COLORS = {
  // Work Order Categories
  'Building Interior': '#5B8DEF',    // Blue
  'Building Exterior': '#22C55E',    // Green
  'Appliances': '#14B8A6',           // Teal
  'Electrical': '#FBBF24',           // Yellow
  'Plumbing': '#8B5CF6',             // Purple
  'HVAC': '#F97316',                 // Orange
  'Landscaping': '#EC4899',          // Pink
  'Other': '#6B7280',                // Gray
  
  // Property Types
  'Apartment': '#5B8DEF',            // Blue
  'Villa': '#22C55E',                // Green
  'Flat': '#14B8A6',                 // Teal
  'Plot': '#FBBF24',                 // Yellow
  'Gated Community': '#8B5CF6'       // Purple
};

/**
 * Get a consistent color for any category/name.
 * Uses predefined colors for known categories, or generates a deterministic color for unknown ones.
 * @param {string} name - The category or item name
 * @returns {string} Hex color code
 */
export const getConsistentColor = (name) => {
  // Check if we have a predefined color for this category
  if (CATEGORY_COLORS[name]) {
    return CATEGORY_COLORS[name];
  }
  
  // For unknown categories, generate a consistent color based on the name hash
  // This ensures the same name always gets the same color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to pick from our color palette
  const colorIndex = Math.abs(hash) % BAR_CHART_COLORS.length;
  return BAR_CHART_COLORS[colorIndex];
};

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
  CATEGORY_COLORS,
  getConsistentColor,
  createStatusDataArray,
  createEstimateTypeDataArray
};
