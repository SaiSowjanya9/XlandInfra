import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

/**
 * The portal header carries one Refresh button, and every page it sits above means something
 * different by it.
 *
 * A page says what its Refresh does with `useRegisterRefresh(fn)`; the header calls whatever is
 * registered. A page that registers nothing has no fetch to repeat, so the button reloads the
 * window instead -- a Refresh that silently does nothing is worse than a slow one.
 */
const PortalRefreshContext = createContext(null);

export const PortalRefreshProvider = ({ children }) => {
  // A Set, because a page may register more than one fetch, and in a ref so that registering does
  // not re-render the header.
  const handlers = useRef(new Set());

  const register = useCallback((handler) => {
    handlers.current.add(handler);
    return () => { handlers.current.delete(handler); };
  }, []);

  const refresh = useCallback(() => {
    if (handlers.current.size === 0) {
      window.location.reload();
      return;
    }
    handlers.current.forEach((handler) => handler());
  }, []);

  return (
    <PortalRefreshContext.Provider value={{ register, refresh }}>
      {children}
    </PortalRefreshContext.Provider>
  );
};

export const usePortalRefresh = () => {
  const context = useContext(PortalRefreshContext);
  return context?.refresh ?? (() => window.location.reload());
};

export const useRegisterRefresh = (handler) => {
  const context = useContext(PortalRefreshContext);
  // Held in a ref so a handler rebuilt on every render does not tear the registration down and
  // register again, while the header still calls the current one.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!context) return undefined;
    return context.register(() => handlerRef.current?.());
  }, [context]);
};
