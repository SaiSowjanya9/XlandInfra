/**
 * Schedule Generator Utility
 * Generates service schedules based on frequency type and first service date
 * 
 * Frequency Types:
 * - Monthly: 12 visits/year, same day each month
 * - Every 2 Months: 6 visits/year, every 2 months from first service date
 * - Quarterly: 4 visits/year, every 3 months
 * - Half-Yearly: 2 visits/year, every 6 months
 * - Yearly: 1 visit/year
 * - Customer Requirement / On Request: Manual entry, no automatic recurrence
 */

// Frequency configuration
export const FREQUENCY_CONFIG = {
  'monthly': {
    label: 'Monthly',
    visitsPerYear: 12,
    intervalMonths: 1,
    autoGenerate: true
  },
  'every 2 months': {
    label: 'Every 2 Months',
    visitsPerYear: 6,
    intervalMonths: 2,
    autoGenerate: true
  },
  'bi-monthly': {
    label: 'Every 2 Months',
    visitsPerYear: 6,
    intervalMonths: 2,
    autoGenerate: true
  },
  'quarterly': {
    label: 'Quarterly',
    visitsPerYear: 4,
    intervalMonths: 3,
    autoGenerate: true
  },
  'half-yearly': {
    label: 'Half-Yearly',
    visitsPerYear: 2,
    intervalMonths: 6,
    autoGenerate: true
  },
  'half yearly': {
    label: 'Half-Yearly',
    visitsPerYear: 2,
    intervalMonths: 6,
    autoGenerate: true
  },
  'yearly': {
    label: 'Yearly',
    visitsPerYear: 1,
    intervalMonths: 12,
    autoGenerate: true
  },
  'annual': {
    label: 'Yearly',
    visitsPerYear: 1,
    intervalMonths: 12,
    autoGenerate: true
  },
  'customer requirement': {
    label: 'Customer Requirement',
    visitsPerYear: null, // Manual entry
    intervalMonths: null,
    autoGenerate: false
  },
  'on request': {
    label: 'On Request',
    visitsPerYear: null,
    intervalMonths: null,
    autoGenerate: false
  },
  'as needed': {
    label: 'As Needed',
    visitsPerYear: null,
    intervalMonths: null,
    autoGenerate: false
  }
};

/**
 * Get frequency configuration
 * @param {string} frequencyType - The frequency type string
 * @returns {object} Frequency configuration
 */
export const getFrequencyConfig = (frequencyType) => {
  const normalizedType = frequencyType?.toLowerCase()?.trim() || 'monthly';
  return FREQUENCY_CONFIG[normalizedType] || FREQUENCY_CONFIG['monthly'];
};

/**
 * Generate schedule dates based on first service date and frequency
 * @param {Date|string} firstServiceDate - The anchor date for recurrence
 * @param {string} frequencyType - Type of frequency (monthly, quarterly, etc.)
 * @param {number} customVisits - Optional custom number of visits (for customer requirement)
 * @param {Date|string} contractEndDate - Optional end date to limit schedules
 * @returns {Array} Array of scheduled dates
 */
export const generateScheduleDates = (
  firstServiceDate,
  frequencyType,
  customVisits = null,
  contractEndDate = null
) => {
  const config = getFrequencyConfig(frequencyType);
  const schedules = [];
  
  // Parse first service date
  const startDate = new Date(firstServiceDate);
  if (isNaN(startDate.getTime())) {
    console.error('Invalid first service date:', firstServiceDate);
    return [];
  }
  
  // Parse contract end date if provided
  let endDate = null;
  if (contractEndDate) {
    endDate = new Date(contractEndDate);
    if (isNaN(endDate.getTime())) {
      endDate = null;
    }
  }
  
  // For non-auto-generate frequencies, return empty or handle custom visits
  if (!config.autoGenerate) {
    if (customVisits && customVisits > 0) {
      // Return placeholder visits for manual scheduling
      for (let i = 0; i < customVisits; i++) {
        schedules.push({
          visitNumber: i + 1,
          date: null, // To be manually selected
          suggestedDate: null,
          status: 'pending_selection',
          isManual: true
        });
      }
    }
    return schedules;
  }
  
  // Determine number of visits
  const numberOfVisits = customVisits || config.visitsPerYear;
  const intervalMonths = config.intervalMonths;
  
  // Generate scheduled dates
  for (let i = 0; i < numberOfVisits; i++) {
    const visitDate = new Date(startDate);
    visitDate.setMonth(visitDate.getMonth() + (i * intervalMonths));
    
    // Adjust for month overflow (e.g., Jan 31 + 1 month = Feb 28/29)
    const targetDay = startDate.getDate();
    const actualDay = visitDate.getDate();
    if (actualDay !== targetDay) {
      // Month overflow occurred, set to last day of intended month
      visitDate.setDate(0); // Go to last day of previous month
    }
    
    // Check if within contract period
    if (endDate && visitDate > endDate) {
      break;
    }
    
    schedules.push({
      visitNumber: i + 1,
      date: new Date(visitDate),
      suggestedDate: new Date(visitDate),
      dayOfMonth: visitDate.getDate(),
      month: visitDate.toLocaleString('en-US', { month: 'short' }),
      year: visitDate.getFullYear(),
      status: i === 0 ? 'scheduled' : 'target',
      isManual: false,
      canAdjust: true // System can move date based on vendor availability
    });
  }
  
  return schedules;
};

/**
 * Smart Recommended Date Generation
 * 1. Generate target date based on frequency (recurrence anchor)
 * 2. Search vendor availability within ±3 days window
 * 3. Score and rank options based on multiple factors
 * 
 * Scoring factors:
 * - Same Zone jobs already scheduled (better routing)
 * - Vendor availability
 * - Available capacity
 * - Closest date to recurrence target
 * - Customer preferred days/time
 * - No scheduling conflicts
 */

const RECOMMENDATION_WEIGHTS = {
  sameZoneJobs: 30,        // Vendor has other jobs in same zone
  exactTargetDate: 25,     // Exact match with target date
  closestToTarget: 20,     // Proximity to target date
  highAvailability: 15,    // More available slots
  customerPreferred: 10    // Customer's preferred day/time
};

/**
 * Generate recommended dates around a target date
 * @param {Date} targetDate - The ideal recurrence date
 * @param {Array} vendorAvailability - Vendor's available slots with zone info
 * @param {number} searchWindow - Days to search before/after target (default: 3)
 * @param {object} options - Additional options (zone, customerPrefs, etc.)
 * @returns {Array} Scored and ranked recommended dates
 */
export const generateRecommendedDates = (
  targetDate,
  vendorAvailability = [],
  searchWindow = 3,
  options = {}
) => {
  const target = new Date(targetDate);
  const targetDateStr = target.toISOString().split('T')[0];
  const { zone, customerPreferredDays = [], customerPreferredTime } = options;
  
  // Generate search window dates: Target ± 3 days
  const searchDates = [];
  for (let i = -searchWindow; i <= searchWindow; i++) {
    const searchDate = new Date(target);
    searchDate.setDate(searchDate.getDate() + i);
    searchDates.push({
      date: searchDate,
      dateStr: searchDate.toISOString().split('T')[0],
      daysFromTarget: i,
      dayOfWeek: searchDate.getDay(),
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][searchDate.getDay()]
    });
  }
  
  // Score each date in the search window
  const scoredDates = searchDates.map(searchDate => {
    let score = 0;
    const reasons = [];
    
    // Find matching availability slot
    const availSlot = vendorAvailability.find(slot => 
      new Date(slot.date).toISOString().split('T')[0] === searchDate.dateStr
    );
    
    // Check if vendor is available on this date
    const isAvailable = availSlot && (availSlot.availableSlots > 0 || availSlot.isAvailable);
    
    if (!isAvailable) {
      return {
        ...searchDate,
        score: -1,
        isAvailable: false,
        reasons: ['Vendor not available'],
        recommendation: 'unavailable'
      };
    }
    
    // 1. Exact target date match
    if (searchDate.daysFromTarget === 0) {
      score += RECOMMENDATION_WEIGHTS.exactTargetDate;
      reasons.push('Exact recurrence date');
    }
    
    // 2. Closest to target (inverse of distance)
    const proximityScore = RECOMMENDATION_WEIGHTS.closestToTarget * (1 - Math.abs(searchDate.daysFromTarget) / searchWindow);
    score += proximityScore;
    
    // 3. Same zone jobs (better routing)
    if (availSlot?.sameZoneJobs > 0) {
      score += RECOMMENDATION_WEIGHTS.sameZoneJobs;
      reasons.push(`${availSlot.sameZoneJobs} other ${zone || 'zone'} jobs scheduled`);
    }
    
    // 4. High availability (more capacity = more flexibility)
    if (availSlot?.availableSlots >= 3) {
      score += RECOMMENDATION_WEIGHTS.highAvailability;
      reasons.push('High availability');
    } else if (availSlot?.availableSlots >= 1) {
      score += RECOMMENDATION_WEIGHTS.highAvailability * 0.5;
      reasons.push('Limited availability');
    }
    
    // 5. Customer preferred day
    if (customerPreferredDays.includes(searchDate.dayName) || 
        customerPreferredDays.includes(searchDate.dayOfWeek)) {
      score += RECOMMENDATION_WEIGHTS.customerPreferred;
      reasons.push('Customer preferred day');
    }
    
    // Determine recommendation level
    let recommendation = 'available';
    if (score >= 60) recommendation = 'highly_recommended';
    else if (score >= 40) recommendation = 'recommended';
    else if (score >= 20) recommendation = 'available';
    else recommendation = 'limited';
    
    return {
      ...searchDate,
      score: Math.round(score),
      isAvailable: true,
      availableSlots: availSlot?.availableSlots || 0,
      sameZoneJobs: availSlot?.sameZoneJobs || 0,
      reasons,
      recommendation
    };
  });
  
  // Sort by score (highest first), filter out unavailable
  const rankedDates = scoredDates
    .filter(d => d.isAvailable)
    .sort((a, b) => b.score - a.score);
  
  // Return top recommendations
  return {
    targetDate: targetDateStr,
    searchWindow: `${searchWindow} days`,
    recommendations: rankedDates,
    bestOption: rankedDates[0] || null,
    hasAvailability: rankedDates.length > 0
  };
};

/**
 * Adjust schedule date based on vendor availability (legacy support)
 * @param {Date} originalDate - The original scheduled date
 * @param {Array} availableSlots - Array of available time slots
 * @param {number} maxDaysShift - Maximum days to shift from original date
 * @returns {object} Adjusted date info
 */
export const adjustForVendorAvailability = (
  originalDate,
  availableSlots = [],
  maxDaysShift = 3
) => {
  // Use the new smart recommendation system
  const recommendations = generateRecommendedDates(originalDate, availableSlots, maxDaysShift);
  
  if (recommendations.bestOption) {
    return {
      date: recommendations.bestOption.date,
      adjusted: recommendations.bestOption.daysFromTarget !== 0,
      daysShifted: recommendations.bestOption.daysFromTarget,
      reason: recommendations.bestOption.reasons.join(', '),
      recommendation: recommendations.bestOption.recommendation,
      score: recommendations.bestOption.score,
      alternatives: recommendations.recommendations.slice(1, 4)
    };
  }
  
  // No available slot found
  return {
    date: new Date(originalDate),
    adjusted: false,
    daysShifted: 0,
    reason: 'No available vendor slots within range - requires manual adjustment'
  };
};

/**
 * Format schedule for display
 * @param {Array} schedules - Array of schedule objects
 * @returns {Array} Formatted schedules for UI display
 */
export const formatSchedulesForDisplay = (schedules) => {
  return schedules.map(schedule => ({
    ...schedule,
    dateStr: schedule.date 
      ? schedule.date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : 'To be scheduled',
    shortDateStr: schedule.date
      ? schedule.date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        })
      : 'TBD',
    monthYear: schedule.date
      ? schedule.date.toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric' 
        })
      : 'TBD'
  }));
};

/**
 * Generate schedule summary text
 * @param {string} frequencyType - Frequency type
 * @param {Date} firstServiceDate - First service date
 * @returns {string} Human-readable summary
 */
export const generateScheduleSummary = (frequencyType, firstServiceDate) => {
  const config = getFrequencyConfig(frequencyType);
  const startDate = new Date(firstServiceDate);
  const dayOfMonth = startDate.getDate();
  const monthName = startDate.toLocaleString('en-US', { month: 'long' });
  
  if (!config.autoGenerate) {
    return `${config.label}: Schedule to be determined based on customer requirements`;
  }
  
  switch (config.intervalMonths) {
    case 1:
      return `Monthly on day ${dayOfMonth} of each month (${config.visitsPerYear} visits/year)`;
    case 2:
      return `Every 2 months starting ${monthName} ${dayOfMonth} (${config.visitsPerYear} visits/year)`;
    case 3:
      return `Quarterly starting ${monthName} ${dayOfMonth} (${config.visitsPerYear} visits/year)`;
    case 6:
      return `Half-yearly starting ${monthName} ${dayOfMonth} (${config.visitsPerYear} visits/year)`;
    case 12:
      return `Yearly on ${monthName} ${dayOfMonth} (${config.visitsPerYear} visit/year)`;
    default:
      return `${config.label}: ${config.visitsPerYear} visits per year`;
  }
};

/**
 * Validate frequency type
 * @param {string} frequencyType - Frequency type to validate
 * @returns {boolean} Whether the frequency type is valid
 */
export const isValidFrequency = (frequencyType) => {
  const normalizedType = frequencyType?.toLowerCase()?.trim();
  return normalizedType in FREQUENCY_CONFIG;
};

/**
 * Get all available frequency options for dropdown
 * @returns {Array} Array of frequency options
 */
export const getFrequencyOptions = () => {
  return [
    { value: 'monthly', label: 'Monthly (12 visits/year)', visits: 12 },
    { value: 'every 2 months', label: 'Every 2 Months (6 visits/year)', visits: 6 },
    { value: 'quarterly', label: 'Quarterly (4 visits/year)', visits: 4 },
    { value: 'half-yearly', label: 'Half-Yearly (2 visits/year)', visits: 2 },
    { value: 'yearly', label: 'Yearly (1 visit/year)', visits: 1 },
    { value: 'customer requirement', label: 'Customer Requirement (Manual)', visits: null },
    { value: 'on request', label: 'On Request', visits: null }
  ];
};

/**
 * Calculate next service date based on last service and frequency
 * @param {Date} lastServiceDate - Date of last completed service
 * @param {string} frequencyType - Frequency type
 * @returns {Date} Next scheduled service date
 */
export const calculateNextServiceDate = (lastServiceDate, frequencyType) => {
  const config = getFrequencyConfig(frequencyType);
  
  if (!config.autoGenerate || !config.intervalMonths) {
    return null;
  }
  
  const nextDate = new Date(lastServiceDate);
  nextDate.setMonth(nextDate.getMonth() + config.intervalMonths);
  
  return nextDate;
};

export default {
  FREQUENCY_CONFIG,
  RECOMMENDATION_WEIGHTS,
  getFrequencyConfig,
  generateScheduleDates,
  generateRecommendedDates,
  adjustForVendorAvailability,
  formatSchedulesForDisplay,
  generateScheduleSummary,
  isValidFrequency,
  getFrequencyOptions,
  calculateNextServiceDate
};
