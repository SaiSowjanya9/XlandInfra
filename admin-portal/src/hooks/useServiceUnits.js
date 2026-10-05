import { useCallback, useEffect, useState } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import { unitOptionsFor } from '../utils/estimatePackageUtils';

const API_BASE = import.meta.env.VITE_API_URL || '';

// The Unit / Capacity Unit box on the service form, the same way useServiceCategories serves the
// Category box: the method's built-in units, units saved services already use, and units saved with
// the box's own Save row. Until the list arrives (or if it cannot be loaded) the built-in units are
// offered, so the box is never empty. `canManage` comes from the server.
export default function useServiceUnits({ apiPath, fpId, pricingMethod }) {
  const builtIn = useCallback(() => unitOptionsFor(pricingMethod).map(name => ({ name, id: null, removable: false, builtIn: true })), [pricingMethod]);
  const [units, setUnits] = useState(builtIn);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const token = getAuthToken();
  const scope = fpId == null || fpId === '' ? undefined : fpId;

  useEffect(() => {
    setUnits(builtIn());
    if (!pricingMethod) return;
    const controller = new AbortController();
    setError('');
    const query = new URLSearchParams({ pricing_method: pricingMethod, ...(scope ? { fpId: scope } : {}) });
    fetch(`${API_BASE}${apiPath}/units?${query}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load units.');
        setUnits(Array.isArray(result.data) && result.data.length ? result.data.filter(item => item?.name) : builtIn());
        setCanManage(!!result.canManage);
      })
      .catch(loadError => { if (loadError.name !== 'AbortError') setError('Saved units could not be loaded; the standard units are listed.'); });
    return () => controller.abort();
  }, [apiPath, scope, token, pricingMethod, builtIn]);

  const send = useCallback(async (path, method, body) => {
    const response = await fetch(`${API_BASE}${apiPath}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Unable to update the unit list.');
    return result.data;
  }, [apiPath, token]);

  // The saved unit is in the list before the caller selects it, so the box never names something the
  // dropdown below it does not offer
  const createUnit = useCallback(async name => {
    const created = await send('/units', 'POST', { name, pricing_method: pricingMethod, ...(scope ? { fpId: scope } : {}) });
    setUnits(prev => prev.some(item => item.name.toLowerCase() === created.name.toLowerCase()) ? prev : [...prev, created]);
    return created;
  }, [send, pricingMethod, scope]);

  const deleteUnit = useCallback(async unit => {
    await send(`/units/${unit.id}`, 'DELETE');
    setUnits(prev => prev.filter(item => item.id !== unit.id));
  }, [send]);

  return { units, canManage, error, createUnit, deleteUnit };
}
