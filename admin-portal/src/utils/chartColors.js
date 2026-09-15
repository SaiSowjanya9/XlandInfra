/**
 * Chart Colors - Single source of truth for all chart colors across the application.
 * 
 * COLOR STRATEGY:
 * - Each domain (status, priority, property type, service) has its own distinct palette
 * - Colors within a domain should NOT conflict with other domains
 * - This ensures semantic meaning: blue = scheduled (not reused for services)
 */

// =============================================================================
// ESTIMATE STATUS COLORS - Used for Draft, Sent, Approved, Rejected
// =============================================================================
export const STATUS_COLORS = {
  Draft: '#5B8DEF',     // Blue
  Sent: '#FBBF24',      // Yellow/Amber
  Approved: '#14B8A6',  // Teal
  Rejected: '#EF4444'   // Red
};

// =============================================================================
// SCHEDULE STATUS COLORS - Used for schedule states
// =============================================================================
export const SCHEDULE_STATUS_COLORS = {
  pending: '#6B7280',      // Gray
  scheduled: '#3B82F6',    // Blue
  upcoming: '#3B82F6',     // Blue
  in_progress: '#F59E0B',  // Amber
  completed: '#10B981',    // Green
  rescheduled: '#8B5CF6',  // Purple
  cancelled: '#EF4444'     // Red
};

// =============================================================================
// WORK ORDER STATUS COLORS - Used for work order states
// =============================================================================
export const WORK_ORDER_STATUS_COLORS = {
  pending: '#F59E0B',      // Amber
  under_review: '#F97316', // Orange
  assigned: '#3B82F6',     // Blue
  in_progress: '#8B5CF6',  // Purple
  completed: '#10B981',    // Emerald
  cancelled: '#EF4444',    // Red
  closed: '#6B7280',       // Gray
};

// =============================================================================
// PRIORITY COLORS - Distinct from status colors (different shades)
// =============================================================================
export const PRIORITY_COLORS = {
  high: '#DC2626',         // Crimson (darker red, distinct from cancelled)
  medium: '#EA580C',       // Deep Orange (distinct from in_progress amber)
  low: '#0D9488'           // Teal (distinct from completed green)
};

// =============================================================================
// PROPERTY TYPE COLORS - Warm/neutral palette (no overlap with status)
// =============================================================================
export const PROPERTY_TYPE_COLORS = {
  'Gated Community': '#0891B2',  // Cyan
  'Apartment': '#7C3AED',        // Violet
  'Villa': '#DB2777',            // Pink
  'Flat': '#059669',             // Emerald
  'Plot': '#CA8A04',             // Yellow-700
  'Commercial': '#9333EA',       // Purple-600
  'Independent House': '#0284C7', // Sky-600
  'Others': '#78716C',           // Stone
  'Other': '#78716C'             // Stone (alternate naming)
};

// =============================================================================
// SERVICE COLORS - Fallback array (use getServiceColor() for consistent hashing)
// =============================================================================
export const SERVICE_COLORS = ['#EA580C', '#DC2626', '#CA8A04', '#9333EA', '#BE185D', '#B45309', '#7C2D12', '#64748B'];

/**
 * Generate a consistent color for any service name using hash-based HSL.
 * Same service name always gets the same color. Avoids status colors (greens/blues).
 * @param {string} serviceName - The service name
 * @returns {string} Hex color code
 */
export const getServiceColor = (serviceName) => {
  if (!serviceName) return '#64748B';
  
  // Hash the service name to get a consistent number
  let hash = 0;
  for (let i = 0; i < serviceName.length; i++) {
    hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use hue ranges that avoid green (90-150) and blue (180-240) which are for status/property
  // Available ranges: 0-89 (reds/oranges/yellows), 260-360 (purples/pinks/reds)
  const hueRanges = [[0, 89], [260, 360]];
  const rangeIndex = Math.abs(hash) % 2;
  const range = hueRanges[rangeIndex];
  const hue = range[0] + (Math.abs(hash >> 8) % (range[1] - range[0]));
  
  // Keep saturation high (60-80%) and lightness medium (45-55%) for vibrant, readable colors
  const saturation = 60 + (Math.abs(hash >> 16) % 20);
  const lightness = 45 + (Math.abs(hash >> 24) % 10);
  
  return hslToHex(hue, saturation, lightness);
};

// Helper to convert HSL to Hex
const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// =============================================================================
// PAYMENT/INVOICE STATUS COLORS - Distinct palette for financial status
// =============================================================================
export const PAYMENT_STATUS_COLORS = {
  paid: '#22C55E',           // Green-500
  partially_paid: '#0EA5E9', // Sky-500 (distinct from blue)
  unpaid: '#EAB308',         // Yellow-500 (distinct from amber)
  overdue: '#DC2626',        // Red-600 (darker red)
  cancelled: '#78716C'       // Stone (gray)
};

// Estimate type colors - used in "Estimates by Estimate Type" charts
export const ESTIMATE_TYPE_COLORS = {
  'Direct Estimates': '#8B5CF6',  // Purple
  'Property-Based': '#06B6D4',    // Cyan
  'Work Order': '#F97316'         // Orange
};

// Bar chart colors - used for horizontal bar charts (categories)
export const BAR_CHART_COLORS = ['#0891B2', '#DB2777', '#7C3AED', '#059669', '#CA8A04'];

// Known category colors - ensures same category always gets same color
export const CATEGORY_COLORS = {
  // Work Order Categories (distinct from status colors)
  'Building Interior': '#0891B2',    // Cyan
  'Building Exterior': '#059669',    // Emerald
  'Appliances': '#7C3AED',           // Violet
  'Electrical': '#CA8A04',           // Yellow-700
  'Plumbing': '#DB2777',             // Pink
  'HVAC': '#0284C7',                 // Sky
  'Landscaping': '#9333EA',          // Purple-600
  'Other': '#78716C',                // Stone
  
  // Property Types (same as PROPERTY_TYPE_COLORS)
  'Apartment': '#7C3AED',            // Violet
  'Villa': '#DB2777',                // Pink
  'Flat': '#059669',                 // Emerald
  'Plot': '#CA8A04',                 // Yellow-700
  'Gated Community': '#0891B2'       // Cyan
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
  SCHEDULE_STATUS_COLORS,
  WORK_ORDER_STATUS_COLORS,
  PRIORITY_COLORS,
  PROPERTY_TYPE_COLORS,
  SERVICE_COLORS,
  PAYMENT_STATUS_COLORS,
  ESTIMATE_TYPE_COLORS,
  BAR_CHART_COLORS,
  CATEGORY_COLORS,
  getConsistentColor,
  getServiceColor,
  createStatusDataArray,
  createEstimateTypeDataArray
};
