/**
 * Custom hooks for URL-synced state management
 * Enables browser back/forward button navigation and state persistence
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

/**
 * Hook to sync a single state value with URL search params
 * @param {string} key - URL parameter key
 * @param {*} defaultValue - Default value if not in URL
 * @returns {[value, setValue]} - State value and setter
 */
export function useUrlParam(key, defaultValue = '') {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const value = useMemo(() => {
    const param = searchParams.get(key);
    if (param === null) return defaultValue;
    
    // Try to parse as JSON for objects/arrays/booleans
    try {
      return JSON.parse(param);
    } catch {
      return param;
    }
  }, [searchParams, key, defaultValue]);
  
  const setValue = useCallback((newValue) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      
      if (newValue === defaultValue || newValue === '' || newValue === null || newValue === undefined) {
        newParams.delete(key);
      } else {
        const stringValue = typeof newValue === 'object' 
          ? JSON.stringify(newValue) 
          : String(newValue);
        newParams.set(key, stringValue);
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, key, defaultValue]);
  
  return [value, setValue];
}

/**
 * Hook to sync multiple filter values with URL
 * @param {Object} defaultFilters - Object with default filter values
 * @returns {Object} - { filters, setFilter, setFilters, clearFilters }
 */
export function useUrlFilters(defaultFilters = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const filters = useMemo(() => {
    const result = { ...defaultFilters };
    
    for (const key of Object.keys(defaultFilters)) {
      const param = searchParams.get(key);
      if (param !== null) {
        try {
          result[key] = JSON.parse(param);
        } catch {
          result[key] = param;
        }
      }
    }
    
    return result;
  }, [searchParams, defaultFilters]);
  
  const setFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      const defaultValue = defaultFilters[key];
      
      if (value === defaultValue || value === '' || value === null || value === undefined) {
        newParams.delete(key);
      } else {
        const stringValue = typeof value === 'object' 
          ? JSON.stringify(value) 
          : String(value);
        newParams.set(key, stringValue);
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, defaultFilters]);
  
  const setFilters = useCallback((newFilters) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      
      for (const [key, value] of Object.entries(newFilters)) {
        const defaultValue = defaultFilters[key];
        
        if (value === defaultValue || value === '' || value === null || value === undefined) {
          newParams.delete(key);
        } else {
          const stringValue = typeof value === 'object' 
            ? JSON.stringify(value) 
            : String(value);
          newParams.set(key, stringValue);
        }
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, defaultFilters]);
  
  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      
      for (const key of Object.keys(defaultFilters)) {
        newParams.delete(key);
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, defaultFilters]);
  
  return { filters, setFilter, setFilters, clearFilters };
}

/**
 * Hook for URL-based pagination
 * @param {number} defaultPage - Default page number (1-indexed)
 * @param {number} defaultLimit - Default items per page
 * @returns {Object} - { page, limit, setPage, setLimit, offset }
 */
export function useUrlPagination(defaultPage = 1, defaultLimit = 10) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const page = useMemo(() => {
    const param = searchParams.get('page');
    return param ? parseInt(param, 10) : defaultPage;
  }, [searchParams, defaultPage]);
  
  const limit = useMemo(() => {
    const param = searchParams.get('limit');
    return param ? parseInt(param, 10) : defaultLimit;
  }, [searchParams, defaultLimit]);
  
  const offset = useMemo(() => (page - 1) * limit, [page, limit]);
  
  const setPage = useCallback((newPage) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      
      if (newPage === defaultPage) {
        newParams.delete('page');
      } else {
        newParams.set('page', String(newPage));
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, defaultPage]);
  
  const setLimit = useCallback((newLimit) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      
      // Reset to page 1 when changing limit
      newParams.delete('page');
      
      if (newLimit === defaultLimit) {
        newParams.delete('limit');
      } else {
        newParams.set('limit', String(newLimit));
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, defaultLimit]);
  
  return { page, limit, setPage, setLimit, offset };
}

/**
 * Hook for URL-based modal state
 * Allows modals to be opened via URL and supports browser back to close
 * @param {string} modalKey - Unique key for this modal in URL
 * @returns {Object} - { isOpen, openModal, closeModal, modalData }
 */
export function useUrlModal(modalKey) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const isOpen = useMemo(() => {
    return searchParams.has(modalKey);
  }, [searchParams, modalKey]);
  
  const modalData = useMemo(() => {
    const param = searchParams.get(modalKey);
    if (!param) return null;
    
    try {
      return JSON.parse(param);
    } catch {
      return param;
    }
  }, [searchParams, modalKey]);
  
  const openModal = useCallback((data = 'open') => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      const stringValue = typeof data === 'object' 
        ? JSON.stringify(data) 
        : String(data);
      newParams.set(modalKey, stringValue);
      return newParams;
    }, { replace: false }); // Don't replace - allows back button to close
  }, [setSearchParams, modalKey]);
  
  const closeModal = useCallback(() => {
    // Use navigate with -1 to go back, or remove param if no history
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(modalKey);
    
    // Check if we can go back
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      setSearchParams(newParams, { replace: true });
    }
  }, [navigate, searchParams, setSearchParams, modalKey]);
  
  return { isOpen, openModal, closeModal, modalData };
}

/**
 * Hook for URL-based tab state
 * @param {string} defaultTab - Default tab ID
 * @param {string} paramKey - URL parameter key (default: 'tab')
 * @returns {[activeTab, setActiveTab]}
 */
export function useUrlTab(defaultTab, paramKey = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  const activeTab = useMemo(() => {
    return searchParams.get(paramKey) || defaultTab;
  }, [searchParams, paramKey, defaultTab]);
  
  const setActiveTab = useCallback((tab) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      
      if (tab === defaultTab) {
        newParams.delete(paramKey);
      } else {
        newParams.set(paramKey, tab);
      }
      
      return newParams;
    }, { replace: true });
  }, [setSearchParams, paramKey, defaultTab]);
  
  return [activeTab, setActiveTab];
}

/**
 * Hook to preserve and restore scroll position on navigation
 * @param {string} key - Unique key for this page's scroll position
 */
export function useScrollRestore(key) {
  const location = useLocation();
  
  useEffect(() => {
    // Restore scroll position on mount
    const savedPosition = safeStorage.getItem(`scroll_${key}_${location.pathname}`);
    if (savedPosition) {
      window.scrollTo(0, parseInt(savedPosition, 10));
    }
    
    // Save scroll position before unload or navigation
    const saveScroll = () => {
      safeStorage.setItem(`scroll_${key}_${location.pathname}`, String(window.scrollY));
    };
    
    window.addEventListener('beforeunload', saveScroll);
    
    return () => {
      saveScroll();
      window.removeEventListener('beforeunload', saveScroll);
    };
  }, [key, location.pathname]);
}

/**
 * Hook to handle navigation with state preservation
 * Useful for "Back" buttons that should return to previous filtered state
 */
export function useNavigationHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const goBack = useCallback((fallbackPath = '/') => {
    // Check if there's history to go back to
    if (window.history.length > 1 && document.referrer) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  }, [navigate]);
  
  const navigateWithState = useCallback((path, state = {}) => {
    navigate(path, { 
      state: { 
        ...state, 
        from: location.pathname + location.search 
      } 
    });
  }, [navigate, location]);
  
  const returnToPrevious = useCallback((fallbackPath = '/') => {
    const from = location.state?.from;
    if (from) {
      navigate(from, { replace: true });
    } else {
      goBack(fallbackPath);
    }
  }, [navigate, location.state, goBack]);
  
  return { goBack, navigateWithState, returnToPrevious };
}

/**
 * Hook for managing view/edit/detail states via URL
 * @param {string} basePath - Base path for the resource
 * @returns {Object} - Navigation helpers for view/edit/create modes
 */
export function useResourceNavigation(basePath) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const viewId = searchParams.get('view');
  const editId = searchParams.get('edit');
  const isCreating = searchParams.has('create');
  
  const viewResource = useCallback((id) => {
    navigate(`${basePath}?view=${id}`);
  }, [navigate, basePath]);
  
  const editResource = useCallback((id) => {
    navigate(`${basePath}?edit=${id}`);
  }, [navigate, basePath]);
  
  const createResource = useCallback(() => {
    navigate(`${basePath}?create=true`);
  }, [navigate, basePath]);
  
  const closeResource = useCallback(() => {
    navigate(basePath, { replace: true });
  }, [navigate, basePath]);
  
  return {
    viewId,
    editId,
    isCreating,
    viewResource,
    editResource,
    createResource,
    closeResource
  };
}

export default {
  useUrlParam,
  useUrlFilters,
  useUrlPagination,
  useUrlModal,
  useUrlTab,
  useScrollRestore,
  useNavigationHistory,
  useResourceNavigation
};
