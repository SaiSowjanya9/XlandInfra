// Safe Storage Utility - Handles cases where storage access is blocked
// This prevents "The operation is insecure" errors in certain browser contexts

export const safeStorage = {
  // localStorage operations
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage access blocked:', e.message);
      return null;
    }
  },
  
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('localStorage write blocked:', e.message);
      return false;
    }
  },
  
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('localStorage remove blocked:', e.message);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (e) {
      console.warn('localStorage clear blocked:', e.message);
      return false;
    }
  }
};

export const safeSessionStorage = {
  // sessionStorage operations
  getItem: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch (e) {
      console.warn('sessionStorage access blocked:', e.message);
      return null;
    }
  },
  
  setItem: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('sessionStorage write blocked:', e.message);
      return false;
    }
  },
  
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('sessionStorage remove blocked:', e.message);
      return false;
    }
  },
  
  clear: () => {
    try {
      sessionStorage.clear();
      return true;
    } catch (e) {
      console.warn('sessionStorage clear blocked:', e.message);
      return false;
    }
  }
};

// Helper to parse JSON safely
export const safeJSONParse = (str, defaultValue = null) => {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
};

export default safeStorage;
