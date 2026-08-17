/**
 * Custom hooks for URL-synced state management
 * Enables browser back/forward button navigation and state persistence
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
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
    }, { replace: false });
  }, [setSearchParams, modalKey]);
  
  const closeModal = useCallback(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete(modalKey);
    
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
 */
export function useUrlTab(defaultTab, paramKey = 'tab') {
  const [searchParams, setSearchParams] = useSearchParams();
  
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
 * Hook to preserve and restore scroll position
 */
export function useScrollRestore(key) {
  const location = useLocation();
  
  useEffect(() => {
    const savedPosition = sessionStorage.getItem(`scroll_${key}_${location.pathname}`);
    if (savedPosition) {
      window.scrollTo(0, parseInt(savedPosition, 10));
    }
    
    const saveScroll = () => {
      sessionStorage.setItem(`scroll_${key}_${location.pathname}`, String(window.scrollY));
    };
    
    window.addEventListener('beforeunload', saveScroll);
    
    return () => {
      saveScroll();
      window.removeEventListener('beforeunload', saveScroll);
    };
  }, [key, location.pathname]);
}

/**
 * Hook for navigation with state preservation
 */
export function useNavigationHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const goBack = useCallback((fallbackPath = '/') => {
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

export default {
  useUrlParam,
  useUrlFilters,
  useUrlPagination,
  useUrlModal,
  useUrlTab,
  useScrollRestore,
  useNavigationHistory
};
