/**
 * Field Options Store
 * Manages custom options for Categories, Sub-categories, Divisions, and Service Types
 * Uses localStorage for persistence
 */

const STORAGE_KEY = 'xland_field_options';

// Default options
const DEFAULT_OPTIONS = {
  categories: [
    'Plumbing',
    'Electrical',
    'HVAC',
    'Cleaning',
    'Security',
    'Landscaping',
    'Pest Control',
    'Painting',
    'Carpentry',
    'General Maintenance',
    'Fire Safety',
    'Elevator Maintenance',
    'Water Tank Cleaning',
    'Garbage Collection',
    'Swimming Pool Maintenance'
  ],
  subcategories: {
    'Plumbing': ['Pipe Repair', 'Drain Cleaning', 'Fixture Installation', 'Water Heater', 'Leak Detection'],
    'Electrical': ['Wiring', 'Lighting', 'Panel Upgrade', 'Outlet Installation', 'Generator'],
    'HVAC': ['AC Repair', 'Heating', 'Duct Cleaning', 'Thermostat', 'Ventilation'],
    'Cleaning': ['Deep Cleaning', 'Regular Cleaning', 'Window Cleaning', 'Carpet Cleaning', 'Sanitization'],
    'Security': ['CCTV Installation', 'Access Control', 'Guard Services', 'Alarm Systems', 'Monitoring'],
    'Landscaping': ['Lawn Care', 'Tree Trimming', 'Garden Design', 'Irrigation', 'Plant Maintenance'],
    'Pest Control': ['Termite Control', 'Rodent Control', 'Insect Control', 'Fumigation', 'Prevention'],
    'Painting': ['Interior Painting', 'Exterior Painting', 'Texture Work', 'Waterproofing', 'Touch-ups'],
    'Carpentry': ['Furniture Repair', 'Door Installation', 'Cabinet Work', 'Wood Flooring', 'Custom Work'],
    'General Maintenance': ['Handyman Services', 'Minor Repairs', 'Inspections', 'Preventive Maintenance'],
    'Fire Safety': ['Fire Alarm Installation', 'Extinguisher Service', 'Sprinkler System', 'Safety Audit'],
    'Elevator Maintenance': ['Routine Service', 'Emergency Repair', 'Modernization', 'Inspection'],
    'Water Tank Cleaning': ['Tank Cleaning', 'Disinfection', 'Inspection', 'Repair'],
    'Garbage Collection': ['Daily Collection', 'Waste Segregation', 'Recycling', 'Bulk Pickup'],
    'Swimming Pool Maintenance': ['Cleaning', 'Chemical Balance', 'Filter Maintenance', 'Equipment Repair']
  },
  divisions: [
    'Division A',
    'Division B',
    'Division C',
    'Division D',
    'Division E',
    'Division F',
    'Division G',
    'Division H',
    'Division I',
    'Division J',
    'Division K'
  ],
  serviceTypes: [
    'Plumbing',
    'Electrical',
    'HVAC',
    'Cleaning',
    'Security',
    'Landscaping',
    'Pest Control',
    'Painting',
    'Carpentry',
    'General Maintenance',
    'Fire Safety',
    'Elevator Maintenance',
    'Water Tank Cleaning',
    'Garbage Collection',
    'Swimming Pool Maintenance'
  ]
};

// Get all field options
export const getFieldOptions = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure all keys exist
      return {
        categories: parsed.categories || DEFAULT_OPTIONS.categories,
        subcategories: { ...DEFAULT_OPTIONS.subcategories, ...parsed.subcategories },
        divisions: parsed.divisions || DEFAULT_OPTIONS.divisions,
        serviceTypes: parsed.serviceTypes || DEFAULT_OPTIONS.serviceTypes
      };
    }
    return DEFAULT_OPTIONS;
  } catch (error) {
    console.error('Error loading field options:', error);
    return DEFAULT_OPTIONS;
  }
};

// Save field options
const saveFieldOptions = (options) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
};

// Add a new category
export const addCategory = (category) => {
  const options = getFieldOptions();
  if (!options.categories.includes(category)) {
    options.categories.push(category);
    options.subcategories[category] = []; // Initialize empty subcategories
    saveFieldOptions(options);
    return { success: true };
  }
  return { success: false, message: 'Category already exists' };
};

// Add a new subcategory
export const addSubcategory = (category, subcategory) => {
  const options = getFieldOptions();
  if (!options.subcategories[category]) {
    options.subcategories[category] = [];
  }
  if (!options.subcategories[category].includes(subcategory)) {
    options.subcategories[category].push(subcategory);
    saveFieldOptions(options);
    return { success: true };
  }
  return { success: false, message: 'Subcategory already exists' };
};

// Add a new division
export const addDivision = (division) => {
  const options = getFieldOptions();
  if (!options.divisions.includes(division)) {
    options.divisions.push(division);
    saveFieldOptions(options);
    return { success: true };
  }
  return { success: false, message: 'Division already exists' };
};

// Add a new service type
export const addServiceType = (serviceType) => {
  const options = getFieldOptions();
  if (!options.serviceTypes.includes(serviceType)) {
    options.serviceTypes.push(serviceType);
    // Also add to categories if it's a service-related category
    if (!options.categories.includes(serviceType)) {
      options.categories.push(serviceType);
      options.subcategories[serviceType] = [];
    }
    saveFieldOptions(options);
    return { success: true };
  }
  return { success: false, message: 'Service type already exists' };
};

// Get categories
export const getCategories = () => {
  return getFieldOptions().categories;
};

// Get subcategories for a category
export const getSubcategories = (category) => {
  const options = getFieldOptions();
  return options.subcategories[category] || [];
};

// Get divisions
export const getDivisions = () => {
  return getFieldOptions().divisions;
};

// Get service types
export const getServiceTypes = () => {
  return getFieldOptions().serviceTypes;
};

// Delete a category
export const deleteCategory = (category) => {
  const options = getFieldOptions();
  options.categories = options.categories.filter(c => c !== category);
  delete options.subcategories[category];
  saveFieldOptions(options);
  return { success: true };
};

// Delete a subcategory
export const deleteSubcategory = (category, subcategory) => {
  const options = getFieldOptions();
  if (options.subcategories[category]) {
    options.subcategories[category] = options.subcategories[category].filter(s => s !== subcategory);
    saveFieldOptions(options);
  }
  return { success: true };
};

// Delete a division
export const deleteDivision = (division) => {
  const options = getFieldOptions();
  options.divisions = options.divisions.filter(d => d !== division);
  saveFieldOptions(options);
  return { success: true };
};

// Delete a service type
export const deleteServiceType = (serviceType) => {
  const options = getFieldOptions();
  options.serviceTypes = options.serviceTypes.filter(s => s !== serviceType);
  saveFieldOptions(options);
  return { success: true };
};
