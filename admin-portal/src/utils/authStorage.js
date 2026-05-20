// Auth Storage Utility - Uses sessionStorage for session-based auth (expires on browser close)
// Change to localStorage if you want persistent sessions

const STORAGE = sessionStorage; // Change to localStorage for persistent sessions

export const AUTH_TOKEN_KEY = 'pm_auth_token';
export const CURRENT_USER_KEY = 'pm_current_user';

export const authStorage = {
  // Token methods
  getToken: () => STORAGE.getItem(AUTH_TOKEN_KEY),
  setToken: (token) => STORAGE.setItem(AUTH_TOKEN_KEY, token),
  removeToken: () => STORAGE.removeItem(AUTH_TOKEN_KEY),
  
  // User methods
  getUser: () => {
    const user = STORAGE.getItem(CURRENT_USER_KEY);
    return user ? JSON.parse(user) : null;
  },
  setUser: (user) => STORAGE.setItem(CURRENT_USER_KEY, JSON.stringify(user)),
  removeUser: () => STORAGE.removeItem(CURRENT_USER_KEY),
  
  // Clear all auth data
  clear: () => {
    STORAGE.removeItem(AUTH_TOKEN_KEY);
    STORAGE.removeItem(CURRENT_USER_KEY);
    // Also clear any legacy localStorage items
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(CURRENT_USER_KEY);
  },
  
  // Check if authenticated
  isAuthenticated: () => !!STORAGE.getItem(AUTH_TOKEN_KEY)
};

export default authStorage;
