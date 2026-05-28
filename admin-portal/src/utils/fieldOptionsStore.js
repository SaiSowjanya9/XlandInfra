/**
 * Field Options Store
 * Manages custom options for Categories, Sub-categories, Divisions, and Service Types
 * Uses database API for persistence (with localStorage fallback)
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://xlandinfra.com/api';
const STORAGE_KEY = 'xland_field_options';

// Default options (fallback)
const DEFAULT_OPTIONS = {
  categories: [],
  subcategories: {},
  divisions: [
    'Division A', 'Division B', 'Division C', 'Division D', 'Division E',
    'Division F', 'Division G', 'Division H', 'Division I', 'Division J', 'Division K'
  ],
  serviceTypes: []
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

// Add a new category (saves to database)
export const addCategory = async (category) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: category, description: `${category} services` })
    });
    const data = await response.json();
    if (data.success) {
      // Also update localStorage cache
      const options = getFieldOptions();
      if (!options.categories.includes(category)) {
        options.categories.push(category);
        options.subcategories[category] = [];
        saveFieldOptions(options);
      }
      return { success: true };
    }
    return { success: false, message: data.message || 'Category already exists' };
  } catch (error) {
    // Fallback to localStorage if API fails
    const options = getFieldOptions();
    if (!options.categories.includes(category)) {
      options.categories.push(category);
      options.subcategories[category] = [];
      saveFieldOptions(options);
      return { success: true };
    }
    return { success: false, message: 'Category already exists' };
  }
};

// Add a new subcategory (saves to database)
export const addSubcategory = async (category, subcategory, categoryId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/categories/${categoryId}/subcategories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name: subcategory })
    });
    const data = await response.json();
    if (data.success) {
      // Also update localStorage cache
      const options = getFieldOptions();
      if (!options.subcategories[category]) {
        options.subcategories[category] = [];
      }
      if (!options.subcategories[category].includes(subcategory)) {
        options.subcategories[category].push(subcategory);
        saveFieldOptions(options);
      }
      return { success: true };
    }
    return { success: false, message: data.message || 'Subcategory already exists' };
  } catch (error) {
    // Fallback to localStorage if API fails
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
  }
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
