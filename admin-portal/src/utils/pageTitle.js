import { useEffect } from 'react';

/**
 * Sets the browser tab title for the portal that mounted it.
 * One static <title> in index.html cannot name a multi-portal SPA — every portal
 * (FP, Manager, …) used to show the same wrong name. Each Layout calls this once.
 */
const BASE = 'XLAND INFRA';

export const usePortalTitle = (portalName) => {
  useEffect(() => {
    document.title = portalName ? `${BASE} | ${portalName}` : BASE;
  }, [portalName]);
};
