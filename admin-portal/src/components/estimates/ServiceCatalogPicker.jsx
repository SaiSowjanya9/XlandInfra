import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import ManpowerFields from './ManpowerFields';
import { isVisitManpower, suggestedManpower } from '../../utils/manpowerPricing';
import { FREQUENCY_OPTIONS, getServiceSchedule, methodLabel, serviceOptionLabel } from './AddServicePage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const inputClass = 'w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500';
const INPUTS = {
  quantity_based: ['quantity', 'Quantity', 1], area_based: ['area', 'Area', 0.01],
  capacity_based: ['capacity', 'Capacity', 0.01], capacity_slab: ['capacity', 'Capacity', 1],
  manpower: ['personnel', 'Personnel count', 1]
};

const ServiceCatalogPicker = ({ fpId, propertyType, selectedAddons, onAdd, apiPath = '/api/admin/service-catalog' }) => {
  const [services, setServices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [inputs, setInputs] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requiresQuote, setRequiresQuote] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const quoteRequest = useRef(null);
  const token = getAuthToken();
  const service = services.find(item => String(item.id) === selectedId);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ fpId: fpId || 'all', propertyType: propertyType || '' });
    fetch(`${API_BASE}${apiPath}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load configured services.');
      setServices(result.data);
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); quoteRequest.current?.abort(); };
  }, [apiPath, fpId, propertyType, token, attempt]);

  const selectService = id => {
    const item = services.find(value => String(value.id) === id);
    setSelectedId(id);
    setError('');
    setRequiresQuote(item?.pricing_method === 'custom_quote');
    setInputs(item ? { frequency: item.default_frequency, visits: item.default_visits_per_year, custom_work_cost: item.custom_work_rate ?? 0,
      ...(isVisitManpower(item) ? { personnel: suggestedManpower(item), overtime_hours_per_visit: 0 } : {}) } : {});
  };
  const setInput = (field, value) => {
    if (field === 'capacity' && service.pricing_method === 'capacity_slab') setRequiresQuote(false);
    setInputs(prev => ({ ...prev, [field]: value, ...(field === 'capacity' && service.pricing_method === 'capacity_slab'
      ? { ...getServiceSchedule(service, value), custom_quote: undefined } : {}),
      ...(field === 'area' && isVisitManpower(service) ? { personnel: suggestedManpower(service, value) } : {}) }));
  };
  const addService = async () => {
    if (!service || saving) return;
    setSaving(true);
    setError('');
    const controller = new AbortController();
    quoteRequest.current = controller;
    try {
      const response = await fetch(`${API_BASE}${apiPath}/${service.id}/quote`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, property_type: propertyType, fpId: fpId || 'all' }), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to price this service.');
      const quote = result.data;
      if (quote.requiresCustomQuote) {
        setRequiresQuote(true);
        setError('This capacity requires a custom quote. Enter the total vendor cost for the selected service period.');
        return;
      }
      onAdd({
        addonId: `CAT-${service.id}`, catalogServiceId: service.id,
        name: service.service_name, service_name: service.service_name, description: service.description,
        pricing_method: service.pricing_method, unit: service.unit, manpower_basis: service.manpower_basis, role_designation: service.role_designation,
        frequency_type: quote.frequency, frequency_count: quote.visits,
        totalPrice: quote.totalPrice, pricingInputs: quote.inputs,
        services: [{ name: service.service_name, description: service.description, frequencyType: quote.frequency, frequency: quote.visits, price: quote.totalPrice / quote.visits }]
      });
      selectService('');
    } catch (error) {
      if (error.name !== 'AbortError') setError(error.message);
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  };
  const input = service && INPUTS[service.pricing_method];

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
      <fieldset disabled={saving} className="min-w-0">
        <label className="block max-w-md text-sm font-medium text-slate-700">
          Configured Service
          <select value={selectedId} onChange={event => selectService(event.target.value)} disabled={loading || !propertyType || saving} className={`${inputClass} mt-2`}>
            <option value="">{loading ? 'Loading services...' : !propertyType ? 'Select a property type first' : 'Select service from catalog'}</option>
            {services.filter(item => !selectedAddons.some(addon => addon.catalogServiceId === item.id)).map(item => <option key={item.id} value={item.id}>{serviceOptionLabel(item, services)}</option>)}
          </select>
        </label>
        {!loading && !services.length && !error && <p className="mt-2 text-xs text-slate-500">No configured services available for this property type.</p>}
        {service && <div className="mt-4">
          <div className="mb-4 flex items-center justify-between gap-2"><span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">{methodLabel(service.pricing_method)}</span><button type="button" onClick={() => selectService('')} aria-label="Cancel service selection" className="p-1 text-slate-500"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ManpowerFields service={service} inputs={inputs} onChange={setInput} />
            {input && <label className="block text-xs font-medium text-slate-600">{input[1]} ({service.unit}) *<input aria-label={`${input[1]} (${service.unit})`} type="number" min={isVisitManpower(service) ? service.minimum_manpower : service.pricing_method === 'capacity_slab' ? 0 : input[2]} step={input[2]} value={inputs[input[0]] ?? ''} onChange={event => setInput(input[0], event.target.value)} className={`${inputClass} mt-2`} /></label>}
            <label className="block text-xs font-medium text-slate-600">Frequency<select disabled={!service.allow_frequency_override || saving} value={inputs.frequency} onChange={event => {
              const frequency = event.target.value;
              setInputs(prev => ({ ...prev, ...getServiceSchedule(service, prev.capacity, frequency) }));
            }} className={`${inputClass} mt-2`}>{FREQUENCY_OPTIONS.map(item => <option key={item.value}>{item.value}</option>)}</select></label>
            <label className="block text-xs font-medium text-slate-600">Visits Per Year<input type="number" min="1" max="366" step="1" readOnly={!service.allow_manual_visits} value={inputs.visits} onChange={event => setInput('visits', event.target.value)} className={`${inputClass} mt-2 ${!service.allow_manual_visits ? 'bg-slate-50' : ''}`} /></label>
            {service.pricing_method === 'fixed_visit_custom' && <label className="block text-xs font-medium text-slate-600">One-off Custom Work Cost (₹)<input type="number" min="0" step="0.01" value={inputs.custom_work_cost} onChange={event => setInput('custom_work_cost', event.target.value)} className={`${inputClass} mt-2`} /></label>}
            {requiresQuote && <label className="block text-xs font-medium text-slate-600">Total Vendor Quote for Service Period (₹) *<input type="number" min="0.01" step="0.01" value={inputs.custom_quote ?? ''} onChange={event => setInput('custom_quote', event.target.value)} className={`${inputClass} mt-2`} /></label>}
          </div>
          <button type="button" onClick={addService} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add Service</button>
        </div>}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error} {!services.length && <button type="button" onClick={() => setAttempt(value => value + 1)} className="font-semibold underline">Retry</button>}</p>}
    </div>
  );
};

export default ServiceCatalogPicker;
