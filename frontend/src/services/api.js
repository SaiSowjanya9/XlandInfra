import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Categories API
export const categoriesApi = {
  getAll: () => api.get('/categories'),
  getSubcategories: (categoryId) => api.get(`/categories/${categoryId}/subcategories`),
  getAllWithSubcategories: () => api.get('/categories/all'),
};

// Work Orders API
export const workOrdersApi = {
  create: (formData) => {
    return api.post('/work-orders', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getAll: () => api.get('/work-orders'),
  getById: (id) => api.get(`/work-orders/${id}`),
  updateStatus: (id, status) => api.patch(`/work-orders/${id}/status`, { status }),
};

// Health check
export const healthCheck = () => api.get('/health');

export default api;
