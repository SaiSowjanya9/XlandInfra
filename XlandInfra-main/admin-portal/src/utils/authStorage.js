// Auth Storage Utility - Uses sessionStorage for session-based auth (expires on browser close)
// All operations wrapped in try-catch to handle "operation is insecure" errors

export const AUTH_TOKEN_KEY = 'pm_auth_token';
export const CURRENT_USER_KEY = 'pm_current_user';

// Safe storage helper - handles cases where storage is blocked
const safeGetItem = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.warn('Storage access blocked:', e.message);
    return null;
  }
};

const safeSetItem = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.warn('Storage write blocked:', e.message);
  }
};

const safeRemoveItem = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    console.warn('Storage remove blocked:', e.message);
  }
};

const safeLocalRemoveItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('localStorage remove blocked:', e.message);
  }
};

export const authStorage = {
  // Token methods
  getToken: () => safeGetItem(AUTH_TOKEN_KEY),
  setToken: (token) => safeSetItem(AUTH_TOKEN_KEY, token),
  removeToken: () => safeRemoveItem(AUTH_TOKEN_KEY),
  
  // User methods
  getUser: () => {
    const user = safeGetItem(CURRENT_USER_KEY);
    try {
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  },
  setUser: (user) => safeSetItem(CURRENT_USER_KEY, JSON.stringify(user)),
  removeUser: () => safeRemoveItem(CURRENT_USER_KEY),
  
  // Clear all auth data
  clear: () => {
    safeRemoveItem(AUTH_TOKEN_KEY);
    safeRemoveItem(CURRENT_USER_KEY);
    // Also clear any legacy localStorage items
    safeLocalRemoveItem(AUTH_TOKEN_KEY);
    safeLocalRemoveItem(CURRENT_USER_KEY);
  },
  
  // Check if authenticated
  isAuthenticated: () => !!safeGetItem(AUTH_TOKEN_KEY)
};

export default authStorage;
