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
        
        // Auto-select FP if none selected
        if (result.data.length > 0) {
          const savedFpId = sessionStorage.getItem('selectedFpId');
          let fpToSelect = null;
          
          if (savedFpId) {
            fpToSelect = result.data.find(f => f.id?.toString() === savedFpId);
          }
          
          // If saved FP not found or no saved FP, select first one
          if (!fpToSelect) {
            fpToSelect = result.data[0];
          }
          
          setSelectedFp(fpToSelect);
          if (fpToSelect) {
            sessionStorage.setItem('selectedFpId', fpToSelect.id.toString());
          }
        } else {
          setSelectedFp(null);
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
      sessionStorage.setItem('selectedFpId', fp.id.toString());
    } else {
      setSelectedFp(null);
      sessionStorage.removeItem('selectedFpId');
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
