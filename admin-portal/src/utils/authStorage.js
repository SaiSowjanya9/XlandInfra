// Auth Storage Utility - Uses sessionStorage for session-based auth (expires on browser close)
// All operations wrapped in try-catch to handle "operation is insecure" errors

const STORAGE = sessionStorage; // Change to localStorage for persistent sessions

export const AUTH_TOKEN_KEY = 'pm_auth_token';
export const CURRENT_USER_KEY = 'pm_current_user';

// Safe storage helper - handles cases where storage is blocked
const safeGetItem = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch (e) {
    console.warn('Storage access blocked:', e.message);
    return null;
  }
};

const safeSetItem = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch (e) {
    console.warn('Storage write blocked:', e.message);
  }
};

const safeRemoveItem = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch (e) {
    console.warn('Storage remove blocked:', e.message);
  }
};

export const authStorage = {
  // Token methods
  getToken: () => safeGetItem(STORAGE, AUTH_TOKEN_KEY),
  setToken: (token) => safeSetItem(STORAGE, AUTH_TOKEN_KEY, token),
  removeToken: () => safeRemoveItem(STORAGE, AUTH_TOKEN_KEY),
  
  // User methods
  getUser: () => {
    const user = safeGetItem(STORAGE, CURRENT_USER_KEY);
    try {
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },
  setUser: (user) => safeSetItem(STORAGE, CURRENT_USER_KEY, JSON.stringify(user)),
  removeUser: () => safeRemoveItem(STORAGE, CURRENT_USER_KEY),
  
  // Clear all auth data
  clear: () => {
    safeRemoveItem(STORAGE, AUTH_TOKEN_KEY);
    safeRemoveItem(STORAGE, CURRENT_USER_KEY);
    // Also clear any legacy localStorage items
    safeRemoveItem(localStorage, AUTH_TOKEN_KEY);
    safeRemoveItem(localStorage, CURRENT_USER_KEY);
  },
  
  // Check if authenticated
  isAuthenticated: () => !!safeGetItem(STORAGE, AUTH_TOKEN_KEY)
};

export default authStorage;
