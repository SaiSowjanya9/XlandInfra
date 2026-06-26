import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FPContext = createContext(null);

export const useFP = () => {
  const context = useContext(FPContext);
  if (!context) {
    // Return safe defaults if context is not available (graceful fallback)
    return {
      fpList: [],
      selectedFp: null,
      selectFp: () => {},
      selectedPropertyType: null,
      setSelectedPropertyType: () => {},
      loading: false,
      refreshFpList: () => {},
      error: null
    };
  }
  return context;
};

export const FPProvider = ({ children }) => {
  const [fpList, setFpList] = useState([]);
  const [selectedFp, setSelectedFp] = useState(null);
  const [selectedPropertyType, setSelectedPropertyType] = useState(null); // 'residential' or 'commercial'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFpList = useCallback(async () => {
    // Get token fresh each time to handle login state changes
    const token = sessionStorage.getItem('pm_auth_token');
    
    if (!token) {
      setLoading(false);
      setFpList([]);
      setSelectedFp(null);
      return;
    }
    
    // Check user role - only admin/operations_manager should fetch FP list
    // FP users and other employees should use their own portal endpoints
    try {
      const savedUser = sessionStorage.getItem('adminUser');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        const isAdmin = user?.role === 'admin' || user?.role === 'operations_manager';
        if (!isAdmin) {
          // Non-admin users don't need FP list - they use their own portal
          setFpList([]);
          setSelectedFp(null);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      // If parsing fails, continue with fetch attempt
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/fp-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Handle 403 Forbidden gracefully - user is not an admin
      if (response.status === 403) {
        setFpList([]);
        setSelectedFp(null);
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && Array.isArray(result.data)) {
        setFpList(result.data);
        
        // Restore previously selected FP or default to Admin (All FPs)
        const savedFpId = sessionStorage.getItem('selectedFpId');
        if (savedFpId === 'all') {
          setSelectedFp({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' });
        } else if (savedFpId && result.data.length > 0) {
          const fpToSelect = result.data.find(f => f.id?.toString() === savedFpId);
          if (fpToSelect) {
            setSelectedFp(fpToSelect);
          } else {
            // Saved FP not found, default to Admin mode
            setSelectedFp({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' });
            sessionStorage.setItem('selectedFpId', 'all');
          }
        } else {
          // No saved selection, default to Admin (All FPs)
          setSelectedFp({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' });
          sessionStorage.setItem('selectedFpId', 'all');
        }
      } else {
        setFpList([]);
        setError(result.message || 'Failed to load franchise partners');
      }
    } catch (err) {
      console.error('Error fetching FP list:', err);
      setError(err.message || 'Network error');
      setFpList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFpList();
  }, [fetchFpList]);

  // Listen for storage changes (login/logout) to refresh FP list
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pm_auth_token') {
        // Token was added or removed - refresh FP list
        fetchFpList();
      }
    };
    
    // Also listen for custom login event (for same-tab login)
    const handleLoginEvent = () => {
      fetchFpList();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('fp-refresh', handleLoginEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('fp-refresh', handleLoginEvent);
    };
  }, [fetchFpList]);

  // Check for token on interval for same-tab login detection
  useEffect(() => {
    let lastToken = sessionStorage.getItem('pm_auth_token');
    
    const checkTokenChange = () => {
      const currentToken = sessionStorage.getItem('pm_auth_token');
      if (currentToken !== lastToken) {
        lastToken = currentToken;
        if (currentToken) {
          // Token was just added - fetch FP list
          fetchFpList();
        }
      }
    };
    
    // Check every 500ms for token changes (handles same-tab login)
    const interval = setInterval(checkTokenChange, 500);
    
    return () => clearInterval(interval);
  }, [fetchFpList]);

  const selectFp = useCallback((fp) => {
    if (fp && fp.id) {
      setSelectedFp(fp);
      sessionStorage.setItem('selectedFpId', fp.id.toString()); // stores 'all' or numeric id
    } else {
      setSelectedFp({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' });
      sessionStorage.setItem('selectedFpId', 'all');
    }
  }, []);

  const refreshFpList = useCallback(() => {
    fetchFpList();
  }, [fetchFpList]);

  return (
    <FPContext.Provider value={{
      fpList,
      selectedFp,
      selectFp,
      selectedPropertyType,
      setSelectedPropertyType,
      loading,
      refreshFpList,
      error
    }}>
      {children}
    </FPContext.Provider>
  );
};

export default FPContext;
