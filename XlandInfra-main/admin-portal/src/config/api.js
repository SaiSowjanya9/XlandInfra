/**
 * API Configuration
 * Automatically uses Railway URL in production
 */

// Get API base URL from environment or default to empty (for dev proxy)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Make API request with proper base URL
 * Use this instead of fetch('/api/...')
 */
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, options);
};

/**
 * Get full API URL for any endpoint
 */
export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

export default { API_BASE_URL, apiFetch, getApiUrl };
