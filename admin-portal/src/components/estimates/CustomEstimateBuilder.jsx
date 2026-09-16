import { useEffect, useState } from 'react';
import { Edit2, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { FREQUENCY_OPTIONS, PRICING_METHODS, PROPERTY_TYPES, getServiceSchedule } from './AddServicePage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const inputClass = 'mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const methodLabel = value => PRICING_METHODS.find(method => method.value === value)?.label || value;
const INPUTS = {
  quantity_based: ['quantity', 'Quantity', 1], area_based: ['area', 'Area', 0.01],
  capacity_based: ['capacity', 'Capacity', 0.01], capacity_slab: ['capacity', 'Capacity', 1],
  manpower: ['personnel', 'Personnel count', 1]
};
const Field = ({ label, children }) => <label className="block text-xs font-semibold text-slate-600">{label}{children}</label>;
const Metric = ({ label, value, emphasis = false }) => <div><p className="text-[11px] text-slate-500">{label}</p><p className={`mt-2 text-sm font-semibold ${emphasis ? 'text-green-700' : 'text-slate-800'}`}>{value}</p></div>;
const headers = () => ({ Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' });

const ServiceEditor = ({ services, vendors, property, initialRow, onSave, onCancel }) => {
  const [serviceId, setServiceId] = useState(String(initialRow?.service_id || ''));
  const [vendorId, setVendorId] = useState(String(initialRow?.vendor_id || ''));
  const [inputs, setInputs] = useState(initialRow?.inputs || {});
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const service = services.find(item => String(item.id) === serviceId);
  const field = service && INPUTS[service.pricing_method];

  useEffect(() => {
    setQuote(null);
    setError('');
    if (!service || (field && (inputs[field[0]] === undefined || inputs[field[0]] === ''))) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/service-catalog/${service.id}/quote`, {
          method: 'POST', headers: headers(), signal: controller.signal,
          body: JSON.stringify({ ...inputs, property_type: property.entry_type, fpId: property.franchise_partner_id || 'all' })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to calculate service pricing.');
        setQuote(result.data);
      } catch (error) { if (error.name !== 'AbortError') setError(error.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [service, inputs, property]);

  const updateInput = (name, value) => {
    setQuote(null);
    setInputs(prev => ({ ...prev, [name]: value, ...(name === 'capacity' && service.pricing_method === 'capacity_slab'
      ? { ...getServiceSchedule(service, value), custom_quote: undefined } : {}) }));
  };
  const selectService = id => {
    const selected = services.find(item => String(item.id) === id);
    setServiceId(id);
    setQuote(null);
    setInputs(selected ? { frequency: selected.default_frequency, visits: selected.default_visits_per_year, operating_cost: 0, markup_percentage: selected.default_markup_percentage, custom_work_cost: selected.custom_work_rate ?? 0 } : {});
  };
  const save = () => {
    const vendor = vendors.find(item => String(item.id) === vendorId);
    if (!service || !vendor || !quote || quote.requiresCustomQuote || loading) return;
    onSave({ ...quote, service_id: service.id, service_name: service.service_name, description: service.description, pricing_method: service.pricing_method, unit: service.unit, vendor_id: vendor.id, vendor_name: vendor.name });
  };

  return <section className="rounded-xl border border-blue-200 bg-white p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-800">{initialRow ? 'Edit Service' : 'Add Services'}</h3><button type="button" onClick={onCancel} aria-label="Close service editor" className="rounded p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Select Service *"><select value={serviceId} onChange={event => selectService(event.target.value)} className={inputClass}><option value="">Select a service</option>{services.map(item => <option key={item.id} value={item.id}>{item.service_name}</option>)}</select></Field>
      <Field label="Vendor *"><select value={vendorId} onChange={event => setVendorId(event.target.value)} className={inputClass}><option value="">Select a vendor</option>{vendors.map(item => <option key={item.id} value={item.id}>{item.name}{item.service_type ? ` — ${item.service_type}` : ''}</option>)}</select></Field>
    </div>
    {service && <>
      <p className="mt-4 inline-block rounded bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">{methodLabel(service.pricing_method)}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        {field && <Field label={`${field[1]} (${service.unit}) *`}><input type="number" min={service.pricing_method === 'capacity_slab' ? service.capacity_slabs[0].capacityFrom : field[2]} step={field[2]} value={inputs[field[0]] ?? ''} onChange={event => updateInput(field[0], event.target.value)} className={inputClass} /></Field>}
        <Field label="Frequency *"><select value={inputs.frequency} disabled={!service.allow_frequency_override} onChange={event => {
          const frequency = event.target.value;
          setQuote(null);
          setInputs(prev => ({ ...prev, ...getServiceSchedule(service, prev.capacity, frequency) }));
        }} className={inputClass}>{FREQUENCY_OPTIONS.map(item => <option key={item.value}>{item.value}</option>)}</select></Field>
        <Field label="Visits Per Year"><input type="number" min="1" max="366" step="1" readOnly={!service.allow_manual_visits} value={inputs.visits} onChange={event => updateInput('visits', event.target.value)} className={`${inputClass} ${!service.allow_manual_visits ? 'bg-slate-50' : ''}`} /><span className="mt-1 block text-[10px] font-normal text-slate-400">{service.allow_manual_visits ? 'Manual visits allowed' : 'Auto calculated'}</span></Field>
        {service.pricing_method === 'fixed_visit_custom' && <Field label="One-off Custom Work Cost (₹)"><input type="number" min="0" step="0.01" value={inputs.custom_work_cost} onChange={event => updateInput('custom_work_cost', event.target.value)} className={inputClass} /></Field>}
        {(service.pricing_method === 'custom_quote' || quote?.requiresCustomQuote || inputs.custom_quote !== undefined) && <Field label="Total Vendor Quote for Service Period (₹) *"><input type="number" min="0.01" step="0.01" value={inputs.custom_quote ?? ''} onChange={event => updateInput('custom_quote', event.target.value)} className={inputClass} /></Field>}
        <Field label="XLAND Operating Cost (Annual) (₹)"><input type="number" min="0" step="0.01" value={inputs.operating_cost} onChange={event => updateInput('operating_cost', event.target.value)} className={inputClass} /></Field>
        <Field label="Markup (%)"><input type="number" min="0" max="1000" step="0.01" value={inputs.markup_percentage} onChange={event => updateInput('markup_percentage', event.target.value)} className={inputClass} /></Field>
      </div>
      {loading && <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Calculating pricing...</p>}
      {quote?.requiresCustomQuote && <p className="mt-4 text-xs text-amber-700">Custom Quote required. Enter the total vendor cost for this service period.</p>}
      {quote && !quote.requiresCustomQuote && <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 lg:grid-cols-4">
        <Metric label="Vendor Rate (Per Visit)" value={money(quote.vendorRatePerVisit)} />
        <Metric label="Vendor Cost (Annual)" value={money(quote.vendorCost)} />
        <Metric label="XLAND Operating Cost (Annual)" value={money(quote.operatingCost)} />
        <Metric label="Actual Cost (Annual)" value={money(quote.actualCost)} />
        <Metric label="Markup" value={`${quote.inputs.markup_percentage}%`} />
        <Metric label="Customer Price (Annual)" value={money(quote.totalPrice)} emphasis />
        <Metric label="Profit" value={money(quote.profit)} />
        <Metric label="Margin" value={`${quote.marginPercentage}%`} />
      </div>}
    </>}
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button><button type="button" onClick={save} disabled={!service || !vendorId || !quote || quote.requiresCustomQuote || loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{initialRow ? 'Update Service' : 'Add Service'}</button></div>
  </section>;
};

export default function CustomEstimateBuilder({ selectedFp, showToast, onSuccess }) {
  const [properties, setProperties] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [services, setServices] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [rows, setRows] = useState([]);
  const [editor, setEditor] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const fpId = selectedFp?.id || 'all';
  const property = properties.find(item => String(item.id) === propertyId);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ fpId });
    Promise.all([
      fetch(`${API_BASE}/api/admin/service-catalog/estimate-options?${params}`, { headers: headers(), signal: controller.signal }),
      fetch(`${API_BASE}/api/admin/service-catalog?${params}`, { headers: headers(), signal: controller.signal })
    ]).then(async responses => {
      const results = await Promise.all(responses.map(response => response.json()));
      const failed = results.find((result, index) => !responses[index].ok || !result.success);
      if (failed) throw new Error(failed.message || 'Unable to load estimate options.');
      setProperties(results[0].data.properties);
      setVendors(results[0].data.vendors);
      setServices(results[1].data);
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [fpId, attempt]);

  const availableServices = property ? services.filter(service => service.applicable_property_types.includes(property.entry_type) && (!service.franchise_partner_id || service.franchise_partner_id === property.franchise_partner_id)) : [];
  const availableVendors = property ? vendors.filter(vendor => !vendor.franchise_partner_id || vendor.franchise_partner_id === property.franchise_partner_id) : [];
  const subtotal = round(rows.reduce((sum, row) => sum + row.totalPrice, 0));
  const discountAmount = round(subtotal * (Number(discount) || 0) / 100);
  const netSubtotal = round(subtotal - discountAmount);
  const tax = Math.round(netSubtotal * (Number(gst) || 0) / 100);
  const total = round(netSubtotal + tax);
  const vendorCost = round(rows.reduce((sum, row) => sum + row.vendorCost, 0));
  const operatingCost = round(rows.reduce((sum, row) => sum + row.operatingCost, 0));
  const actualCost = round(vendorCost + operatingCost);
  const profit = round(netSubtotal - actualCost);
  const margin = netSubtotal ? round(profit / netSubtotal * 100) : 0;
  const inputDetails = row => {
    const field = INPUTS[row.pricing_method];
    return field ? `${row.inputs[field[0]]} ${row.unit}` : row.isCustomQuote ? 'Custom Quote' : 'Fixed charge';
  };
  const saveEstimate = async (event, openPreview = false) => {
    event.preventDefault();
    if (saving || savedId) return;
    if (!property || !rows.length) { setError('Select a property and add at least one service.'); return; }
    if (editor) { setError('Add or cancel the service currently being edited before saving.'); return; }
    if (discount === '' || gst === '' || !Number.isFinite(Number(discount)) || !Number.isFinite(Number(gst)) || Number(discount) < 0 || Number(discount) > 100 || Number(gst) < 0 || Number(gst) > 100) { setError('Discount and GST must be between 0 and 100.'); return; }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/service-catalog/custom-estimates`, {
        method: 'POST', headers: headers(), body: JSON.stringify({
          fpId, property_id: property.id, discount_percentage: Number(discount), gst_percentage: Number(gst), notes,
          rows: rows.map(row => ({ service_id: row.service_id, vendor_id: row.vendor_id, inputs: row.inputs }))
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to save estimate.');
      setSavedId(result.data.estimateId);
      showToast?.('Custom estimate saved as draft.', 'success');
      if (openPreview) setPreview(result.data);
      else onSuccess?.();
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error} {!properties.length && <button type="button" onClick={() => setAttempt(value => value + 1)} className="ml-2 font-semibold underline">Retry</button>}</div>}
    <fieldset disabled={saving || !!savedId} className="grid min-w-0 items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)_270px]">
      <aside className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Property Details</h2>
        <Field label="Property *"><select disabled={loading} value={propertyId} onChange={event => { setPropertyId(event.target.value); setRows([]); setEditor(event.target.value ? { key: Date.now(), index: null } : null); setError(''); }} className={inputClass}><option value="">{loading ? 'Loading properties...' : 'Select property'}</option>{properties.map(item => <option key={item.id} value={item.id}>{item.property_id} — {item.community_name}</option>)}</select></Field>
        {property && <dl className="mt-5 space-y-4 text-sm text-slate-700">{[
          ['Property Type', PROPERTY_TYPES.find(type => type.id === property.entry_type)?.label || property.entry_type],
          ['Customer', property.customer_name || property.community_name], ['Zone', property.zone], ['Address', property.address]
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1">{value || '—'}</dd></div>)}</dl>}
        <p className="mt-5 text-xs text-slate-400">Changing the property clears the selected services.</p>
      </aside>
      <main className="min-w-0 space-y-5">
        {editor && property && <ServiceEditor key={editor.key} services={availableServices} vendors={availableVendors} property={property} initialRow={editor.index === null ? null : rows[editor.index]} onCancel={() => setEditor(null)} onSave={row => { setRows(prev => editor.index === null ? [...prev, row] : prev.map((item, index) => index === editor.index ? row : item)); setEditor(null); setError(''); }} />}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-800">Service List</h2><button type="button" disabled={!property || !!editor} onClick={() => setEditor({ key: Date.now(), index: null })} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-600 disabled:opacity-50"><Plus className="h-3 w-3" />Add Another Service</button></div>
          {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{['#', 'Service', 'Method', 'Input / Details', 'Vendor', 'Frequency', 'Visits / Year', 'Vendor Cost (₹)', 'XLAND Cost (₹)', 'Customer Price (₹)', 'Margin %', 'Action'].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={index} className="text-slate-700">
            <td className="px-3 py-4">{index + 1}</td><td className="px-3 py-4 font-medium">{row.service_name}</td><td className="px-3 py-4"><span className="whitespace-nowrap rounded bg-orange-50 px-2 py-1 text-orange-700">{methodLabel(row.pricing_method)}</span></td><td className="px-3 py-4">{inputDetails(row)}</td><td className="px-3 py-4">{row.vendor_name}</td><td className="px-3 py-4">{row.frequency}</td><td className="px-3 py-4 text-center">{row.visits}</td><td className="px-3 py-4">{money(row.vendorCost)}</td><td className="px-3 py-4">{money(row.operatingCost)}</td><td className="px-3 py-4 font-semibold text-green-700">{money(row.totalPrice)}</td><td className="px-3 py-4">{row.marginPercentage}%</td><td className="px-3 py-4"><div className="flex gap-1"><button type="button" disabled={!!editor} aria-label={`Edit ${row.service_name}`} onClick={() => setEditor({ key: Date.now(), index })} className="p-1 text-slate-500 disabled:opacity-30"><Edit2 className="h-3.5 w-3.5" /></button><button type="button" disabled={!!editor} aria-label={`Remove ${row.service_name}`} onClick={() => setRows(prev => prev.filter((_, rowIndex) => rowIndex !== index))} className="p-1 text-red-500 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
          </tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-slate-400">{property ? 'Add individual services to build this estimate.' : 'Select a property to get started.'}</div>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><Field label="Description / Notes"><textarea rows={3} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} className={inputClass} placeholder="Notes for the customer" /></Field></section>
      </main>
      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-5 text-sm font-semibold text-slate-800">Estimate Summary</h2><dl className="space-y-4 text-xs text-slate-600">
          <div className="flex justify-between gap-2"><dt>Service Subtotal</dt><dd className="font-semibold">{money(subtotal)}</dd></div>
          <div><Field label="Discount (%)"><input type="number" min="0" max="100" step="0.01" value={discount} onChange={event => setDiscount(event.target.value)} className={inputClass} /></Field><p className="mt-2 text-right">− {money(discountAmount)}</p></div>
          <div className="flex justify-between gap-2"><dt>Subtotal After Discount</dt><dd>{money(netSubtotal)}</dd></div>
          <div><Field label="GST (%)"><input type="number" min="0" max="100" step="0.01" value={gst} onChange={event => setGst(event.target.value)} className={inputClass} /></Field><p className="mt-2 text-right">{money(tax)}</p></div>
          <div className="flex justify-between gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-green-700"><dt>Grand Total</dt><dd>{money(total)}</dd></div>
        </dl></section>
        <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-5 text-sm font-semibold text-slate-800">Internal Profit Summary</h2><p className="mb-4 text-[11px] text-slate-400">For internal use only</p><dl className="space-y-4 text-xs text-slate-600">{[
          ['Total Vendor Cost', money(vendorCost)], ['XLAND Operating Cost', money(operatingCost)], ['Total Actual Cost', money(actualCost)], ['Gross Profit', money(profit)], ['Gross Margin', `${margin}%`]
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl></section>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={event => saveEstimate(event)} disabled={saving || !rows.length || !!editor || !!savedId} className="rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-xs font-semibold text-blue-600 disabled:opacity-50">Save Draft</button><button type="button" onClick={event => saveEstimate(event, true)} disabled={saving || !rows.length || !!editor || !!savedId} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save & Preview Estimate</button></div>
      </aside>
    </fieldset>
    {preview && <div role="dialog" aria-modal="true" aria-labelledby="custom-estimate-preview-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <div className="mb-6 flex items-start justify-between gap-4"><div><h2 id="custom-estimate-preview-title" className="text-xl font-semibold text-slate-900">Estimate Preview</h2><p className="mt-1 text-xs text-slate-400">{preview.estimateId}</p></div><button type="button" aria-label="Close preview" onClick={() => { setPreview(null); onSuccess?.(); }} className="p-1 text-slate-500"><X className="h-5 w-5" /></button></div>
      <h3 className="font-semibold text-slate-800">{preview.property.community_name}</h3><p className="mt-1 text-sm text-slate-600">{preview.property.customer_name}</p><p className="mt-1 text-sm text-slate-500">{preview.property.address}</p>
      <div className="my-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">Service</th><th className="p-3">Description</th><th className="p-3">Frequency</th><th className="p-3">Visits</th></tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index} className="border-b border-slate-100"><td className="p-3">{row.service_name}</td><td className="p-3">{row.description || '—'}</td><td className="p-3">{row.frequency}</td><td className="p-3">{row.visits}</td></tr>)}</tbody></table></div>
      <dl className="ml-auto max-w-sm space-y-3 text-sm">{[['Service Subtotal', money(preview.summary.subtotal)], [`Discount (${preview.summary.discountPercent}%)`, money(preview.summary.discount)], ['Subtotal After Discount', money(preview.summary.netSubtotal)], [`GST (${preview.summary.gstPercent}%)`, money(preview.summary.gst)], ['Grand Total', money(preview.summary.total)]].map(([label, value]) => <div key={label} className="flex justify-between gap-5"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
      {notes && <p className="mt-6 whitespace-pre-wrap text-sm text-slate-600">{notes}</p>}
      <button type="button" onClick={() => { setPreview(null); onSuccess?.(); }} className="mt-6 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white">Done</button>
    </section></div>}
  </div>;
}
