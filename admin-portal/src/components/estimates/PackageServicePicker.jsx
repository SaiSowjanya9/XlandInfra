import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { FREQUENCY_COUNT_MAP } from '../../utils/estimateStore';
import { methodLabel, propertyTypeLabel } from './AddServicePage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Picks configured services into an AMC package's Service Configuration table. A package row holds
// only a name, description, frequency and visits, so that is all a picked service contributes: no
// price comes across, because the package carries a single price of its own. Add Row stays beside
// this for a service the catalog does not have, which is typed in by hand.
export default function PackageServicePicker({ open, onClose, onAdd, propertyTypes = [], fpId,
  apiPath = '/api/admin/service-catalog', existing = [] }) {
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
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h3 id="package-service-picker-title" className="text-base font-semibold text-slate-900">Add Service</h3>
            <p className="mt-1 text-xs text-slate-500">{typeLabels ? `Services for ${typeLabels}` : 'Services'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close service list"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-b border-slate-100 px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search services"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? <p className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading services...</p>
            : error ? <p role="alert" className="py-6 text-sm text-red-600">{error}</p>
            : !shown.length ? <p className="py-6 text-center text-sm text-slate-500">
                {available.length ? 'No service matches this search.' : `No services apply to ${typeLabels || 'this package'}.`}
              </p>
            : <ul className="space-y-2">
              {shown.map(service => {
                const disabled = isAdded(service);
                const checked = picked.includes(service.id);
                return (
                  <li key={service.id}>
                    <label className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${disabled ? 'border-slate-100 bg-slate-50' : `cursor-pointer ${checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}`}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(service.id)}
                        className="mt-0.5 h-4 w-4 accent-blue-600" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{service.service_name}</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{methodLabel(service.pricing_method)}</span>
                          {disabled && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Added</span>}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {[service.category, `${service.default_frequency || 'Monthly'} - ${service.default_visits_per_year ?? 0} visits`,
                            service.applicable_property_types?.map(propertyTypeLabel).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                        </span>
                        {service.description && <span className="mt-1 block truncate text-xs text-slate-400">{service.description}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={addPicked} disabled={!picked.length}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
            <Check className="h-4 w-4" />{picked.length > 1 ? `Add ${picked.length} Services` : 'Add Service'}
          </button>
        </div>
      </div>
    </div>
  );
}
