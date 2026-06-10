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
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/fp-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
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
