import { useCallback, useEffect, useState } from 'react';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// The Category box on the service form and on the hand-entered service dialog. Both read the same
// suggestions from whichever catalog they are pointed at, and both may save a new one and delete a
// mistyped one, so the fetching lives here rather than twice over.
//
// `canManage` comes from the server: the Operations Manager and FP staff read this catalog but do
// not author it, so their box has no save tick and no delete cross.
export default function useServiceCategories({ apiPath, fpId, enabled = true }) {
  const [categories, setCategories] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const token = getAuthToken();
  const scope = fpId == null || fpId === '' ? undefined : fpId;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setError('');
    const query = scope ? `?${new URLSearchParams({ fpId: scope })}` : '';
    fetch(`${API_BASE}${apiPath}/categories${query}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load categories.');
      // The endpoint answers with { name, id, removable } objects
      setCategories(Array.isArray(result.data) ? result.data.filter(item => item?.name) : []);
      setCanManage(!!result.canManage);
    }).catch(loadError => {
      if (loadError.name !== 'AbortError') setError('Unable to load categories. Please retry.');
    });
    return () => controller.abort();
  }, [apiPath, scope, token, enabled, attempt]);

  const send = useCallback(async (path, method, body) => {
    const response = await fetch(`${API_BASE}${apiPath}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || 'Unable to update the category list.');
    return result.data;
  }, [apiPath, token]);

  // The saved category is in the list before the caller selects it, so the box never names
  // something the dropdown below it does not offer
  const createCategory = useCallback(async name => {
    const created = await send('/categories', 'POST', { name, ...(scope ? { fpId: scope } : {}) });
    setCategories(prev => prev.some(item => item.name.toLowerCase() === created.name.toLowerCase())
      ? prev.map(item => item.name.toLowerCase() === created.name.toLowerCase() ? { ...item, ...created } : item)
      : [...prev, created]);
    return created;
  }, [send, scope]);

  const deleteCategory = useCallback(async category => {
    await send(`/categories/${category.id}`, 'DELETE');
    setCategories(prev => prev.filter(item => item.id !== category.id));
  }, [send]);

  return { categories, canManage, error, reload: () => setAttempt(value => value + 1), createCategory, deleteCategory };
}
