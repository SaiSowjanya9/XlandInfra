import { safeStorage, getAuthToken } from './safeStorage';
/**
 * API Configuration
 * Uses VITE_API_URL environment variable in production
 * Falls back to relative URLs (handled by Vite proxy) in development
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Make an API request with proper base URL
 * @param {string} endpoint - API endpoint (e.g., '/api/admin/login')
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available (check sessionStorage first, then localStorage for backwards compatibility)
  const token = getAuthToken() || safeStorage.getItem('pm_auth_token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  return response;
};

/**
 * GET request helper
 */
export const apiGet = (endpoint) => apiRequest(endpoint, { method: 'GET' });

/**
 * POST request helper
 */
export const apiPost = (endpoint, data) => 
  apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });

/**
 * PUT request helper
 */
export const apiPut = (endpoint, data) => 
  apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

/**
 * DELETE request helper
 */
export const apiDelete = (endpoint) => 
  apiRequest(endpoint, { method: 'DELETE' });

/**
 * Get the full API URL for a given endpoint
 * Useful for direct fetch calls or axios
 */
export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

export default {
  apiRequest,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  getApiUrl,
  API_BASE_URL,
};
