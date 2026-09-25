import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { FREQUENCY_COUNT_MAP } from '../../utils/estimateStore';
import { methodLabel, propertyTypeLabel } from './AddServicePage';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Picks configured services into an AMC package's Service Configuration table. A package row holds
// only a name, description, frequency and visits, so that is all a picked service contributes: no
// price comes across, because the package carries a single price of its own. Add Row stays beside
// this for a service the catalog does not have, which is typed in by hand.
export default function PackageServicePicker({ open, onClose, onAdd, propertyTypes = [], fpId,
  apiPath = '/api/admin/service-catalog', existing = [], theme }) {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState([]);
  const token = getAuthToken();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setPicked([]);
    setSearch('');
    fetch(`${API_BASE}${apiPath}?${new URLSearchParams({ fpId: fpId || 'all' })}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load services.');
      setServices(Array.isArray(result.data) ? result.data : []);
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, apiPath, fpId, token]);

  // Escape dismisses the dialog, the way the other estimate dialogs behave
  useEffect(() => {
    if (!open) return;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // A package applies to one or more property types, so a service is offered when it covers any of
  // them — never an equality check against a single type.
  const available = useMemo(() => services.filter(service =>
    !propertyTypes.length || service.applicable_property_types?.some(type => propertyTypes.includes(type))),
    [services, propertyTypes]);
  const term = search.trim().toLowerCase();
  const shown = term ? available.filter(service => `${service.service_name} ${service.category || ''}`.toLowerCase().includes(term)) : available;
  // A service already in the table cannot be added twice; it is still listed, so its absence is not a puzzle
  const added = new Set(existing.map(name => String(name || '').trim().toLowerCase()).filter(Boolean));
  const isAdded = service => added.has(String(service.service_name || '').trim().toLowerCase());
  const toggle = id => setPicked(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]);
  const addPicked = () => {
    onAdd(available.filter(service => picked.includes(service.id)).map(service => {
      const frequencyType = service.default_frequency || 'Monthly';
      return { service: service.service_name, description: service.description || '', frequencyType,
        frequencyCount: service.default_visits_per_year ?? FREQUENCY_COUNT_MAP[frequencyType] ?? 0 };
    }));
    onClose();
  };

  if (!open) return null;
  const typeLabels = propertyTypes.map(propertyTypeLabel).filter(Boolean).join(', ');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="package-service-picker-title">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className={`flex items-start justify-between gap-4 border-b px-6 py-4 ${skin.border}`}>
          <div className="min-w-0">
            <h3 id="package-service-picker-title" className={`text-base font-semibold ${skin.strong}`}>Add Service</h3>
            <p className={`mt-1 text-xs ${skin.muted}`}>{typeLabels ? `Services for ${typeLabels}` : 'Services'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close service list"
            className={`shrink-0 rounded-lg p-1.5 ${skin.faint} ${skin.iconMuted}`}><X className="h-4 w-4" /></button>
        </div>
        <div className={`border-b px-6 py-3 ${skin.borderSoft}`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${skin.faint}`} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search services"
              className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 ${skin.fieldSoft}`} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? <p className={`flex items-center gap-2 py-6 text-sm ${skin.muted}`}><Loader2 className="h-4 w-4 animate-spin" />Loading services...</p>
            : error ? <p role="alert" className="py-6 text-sm text-red-600">{error}</p>
            : !shown.length ? <p className={`py-6 text-center text-sm ${skin.muted}`}>
                {available.length ? 'No service matches this search.' : `No services apply to ${typeLabels || 'this package'}.`}
              </p>
            : <ul className="space-y-2">
              {shown.map(service => {
                const disabled = isAdded(service);
                const checked = picked.includes(service.id);
                return (
                  <li key={service.id}>
                    <label className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${disabled ? `${skin.borderSoft} ${skin.readOnlyBg}` : `cursor-pointer ${checked ? skin.tileActive : skin.tileIdle}`}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(service.id)}
                        className={`mt-0.5 h-4 w-4 ${skin.control}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-medium ${skin.strong}`}>{service.service_name}</span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${skin.badge}`}>{methodLabel(service.pricing_method)}</span>
                          {disabled && <span className="rounded bg-warm-success px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Added</span>}
                        </span>
                        <span className={`mt-1 block text-xs ${skin.muted}`}>
                          {[service.category, `${service.default_frequency || 'Monthly'} - ${service.default_visits_per_year ?? 0} visits`,
                            service.applicable_property_types?.map(propertyTypeLabel).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                        </span>
                        {service.description && <span className={`mt-1 block truncate text-xs ${skin.faint}`}>{service.description}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>}
        </div>
        <div className={`flex items-center justify-end gap-3 border-t px-6 py-4 ${skin.panelFoot}`}>
          <button type="button" onClick={onClose}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${skin.secondary}`}>Cancel</button>
          <button type="button" onClick={addPicked} disabled={!picked.length}
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-40 ${skin.primary}`}>
            <Check className="h-4 w-4" />{picked.length > 1 ? `Add ${picked.length} Services` : 'Add Service'}
          </button>
        </div>
      </div>
    </div>
  );
}
