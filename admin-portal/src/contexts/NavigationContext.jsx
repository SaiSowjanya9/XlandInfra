import { createContext, useContext, useState, useCallback } from 'react';

const NavigationContext = createContext(null);

export const NavigationProvider = ({ children }) => {
  const [dirtyForm, setDirtyForm] = useState(null); // string message
  const [showModal, setShowModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const setDirty = useCallback((message) => {
    setDirtyForm(message);
  }, []);

  const clearDirty = useCallback(() => {
    setDirtyForm(null);
  }, []);

  const requestNavigation = useCallback((onNavigate) => {
    if (dirtyForm) {
      setShowModal(true);
      setPendingNavigation(onNavigate);
    } else {
      onNavigate();
    }
  }, [dirtyForm]);

  const confirmNavigation = useCallback(() => {
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
    setShowModal(false);
    setDirtyForm(null);
  }, [pendingNavigation]);

  const cancelNavigation = useCallback(() => {
    setPendingNavigation(null);
    setShowModal(false);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        dirtyForm,
        setDirty,
        clearDirty,
        requestNavigation,
        showModal,
        confirmNavigation,
        cancelNavigation
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
};

export default NavigationContext;
