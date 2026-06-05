import { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FPContext = createContext();

export const useFP = () => {
  const context = useContext(FPContext);
  if (!context) {
    throw new Error('useFP must be used within FPProvider');
  }
  return context;
};

export const FPProvider = ({ children }) => {
  const [fpList, setFpList] = useState([]);
  const [selectedFp, setSelectedFp] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchFpList = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/admin/fp-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data) {
        setFpList(result.data);
        // Auto-select first FP if none selected
        if (!selectedFp && result.data.length > 0) {
          const savedFp = sessionStorage.getItem('selectedFpId');
          if (savedFp) {
            const fp = result.data.find(f => f.id.toString() === savedFp);
            if (fp) setSelectedFp(fp);
            else setSelectedFp(result.data[0]);
          } else {
            setSelectedFp(result.data[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching FP list:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFpList();
  }, [token]);

  const selectFp = (fp) => {
    setSelectedFp(fp);
    if (fp) {
      sessionStorage.setItem('selectedFpId', fp.id.toString());
    } else {
      sessionStorage.removeItem('selectedFpId');
    }
  };

  const refreshFpList = () => {
    fetchFpList();
  };

  return (
    <FPContext.Provider value={{
      fpList,
      selectedFp,
      selectFp,
      loading,
      refreshFpList
    }}>
      {children}
    </FPContext.Provider>
  );
};

export default FPContext;
