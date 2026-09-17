import { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import AddServicePage, { methodLabel, propertyTypeLabel, serviceOptionLabel } from './AddServicePage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const RATE_LABELS = {
  fixed_price: 'Vendor price per visit', rate_per_unit: 'Rate per area unit per visit',
  rate_per_quantity: 'Rate per item per visit', rate_per_capacity: 'Rate per capacity unit per visit',
  monthly_rate: 'Monthly rate per person', rate_per_person: 'Rate per person per visit', overtime_rate_per_hour: 'Overtime rate per person / hour',
  visit_charge: 'Vendor visit charge', custom_work_rate: 'Default one-off custom work cost'
};
const money = value => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ServiceCatalogList({ fpId, admin, showToast, apiPath = '/api/admin/service-catalog',
  scoped = false, scopeLabel, canCreate = false, canEdit = service => admin?.role === 'admin' }) {
  const [editingService, setEditingService] = useState(null);
  const [creating, setCreating] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const token = getAuthToken();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`${API_BASE}${apiPath}?${new URLSearchParams({ fpId: fpId || 'all' })}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load service catalog.');
      setServices(result.data);
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiPath, fpId, token, refresh]);

  if (editingService || creating) return <AddServicePage service={editingService ?? undefined} admin={admin} showToast={showToast}
    apiPath={apiPath} scoped={scoped} scopeLabel={scopeLabel}
    onBack={() => { setEditingService(null); setCreating(false); }} onSave={() => setRefresh(value => value + 1)} />;

  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h3 className="font-semibold text-slate-800">Configured Services</h3><p className="mt-1 text-xs text-slate-500">{loading ? 'Loading...' : `${services.length} service(s)`} · Pricing configurations for estimates</p></div>
      <div className="flex items-center gap-3">
        {canCreate && <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add Service</button>}
        <button type="button" aria-label="Refresh service catalog" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-lg border border-slate-200 p-2 text-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
    </div>
    {error ? <p role="alert" className="px-5 py-4 text-sm text-red-600">{error}</p> : !loading && !services.length ? <p className="px-5 py-6 text-sm text-slate-500">{admin?.role === 'admin' || canCreate ? 'No configured services yet. Use Add Service to create one.' : 'No configured services are available in your scope yet.'}</p> : <div className="divide-y divide-slate-100">
      {services.map(service => <details key={service.id} className="group min-w-0 px-5 py-4">
        <summary className="cursor-pointer text-sm text-slate-700 [overflow-wrap:anywhere]">
          <span className="font-semibold text-slate-900">{serviceOptionLabel(service, services)}</span>
          <span className="ml-3 inline-block rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{methodLabel(service.pricing_method)}</span>
          <span className="ml-3 text-xs text-slate-500">{service.category} · {service.default_frequency} — {service.default_visits_per_year} visits</span>
        </summary>
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>div]:min-w-0 [&_dd]:[overflow-wrap:anywhere]">
            <div><dt className="text-xs text-slate-500">Applicable property types</dt><dd className="mt-1">{service.applicable_property_types.map(propertyTypeLabel).join(', ')}</dd></div>
            <div><dt className="text-xs text-slate-500">Unit</dt><dd className="mt-1">{service.unit}</dd></div>
            <div><dt className="text-xs text-slate-500">Scope</dt><dd className="mt-1">{service.franchise_partner_id ? `FP ${service.franchise_partner_id}` : 'All FPs'}</dd></div>
            <div><dt className="text-xs text-slate-500">Default markup</dt><dd className="mt-1">{service.default_markup_percentage}%</dd></div>
            <div><dt className="text-xs text-slate-500">Frequency override / Manual visits</dt><dd className="mt-1">{service.allow_frequency_override ? 'Allowed' : 'Not allowed'} / {service.allow_manual_visits ? 'Allowed' : 'Not allowed'}</dd></div>
            {Object.entries(RATE_LABELS).filter(([field]) => service[field] != null).map(([field, label]) => <div key={field}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1">{money(service[field])}</dd></div>)}
            {service.pricing_method === 'manpower' && (service.manpower_basis === 'per_visit' ? <>
              <div><dt className="text-xs text-slate-500">Pricing basis</dt><dd className="mt-1">Per person per visit</dd></div>
              <div><dt className="text-xs text-slate-500">Role / Designation</dt><dd className="mt-1">{service.role_designation || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">Included hours per visit</dt><dd className="mt-1">{service.working_hours_per_visit}</dd></div>
              <div><dt className="text-xs text-slate-500">Minimum manpower required</dt><dd className="mt-1">{service.minimum_manpower}</dd></div>
            </> : <div><dt className="text-xs text-slate-500">Billing period / Duration</dt><dd className="mt-1">{service.billing_period} / {service.period_months} months</dd></div>)}
          </dl>
          {service.description && <p className="mt-4 whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere]">{service.description}</p>}
          {canEdit(service) && <button type="button" onClick={() => setEditingService(service)} className="mt-4 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-600">Edit Service</button>}
          {service.capacity_slabs && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr><th className="py-2">Capacity From ({service.unit})</th><th>Capacity To ({service.unit})</th><th>Vendor Rate Per Visit</th><th>Frequency</th><th>Visits</th></tr></thead><tbody>{service.capacity_slabs.map((slab, index) => <tr key={index} className="border-t border-slate-200"><td className="py-2">{slab.capacityFrom}</td><td>{slab.capacityTo ?? 'Above'}</td><td>{slab.isCustomQuote ? 'Custom Quote' : money(slab.vendorRate)}</td><td>{slab.defaultFrequency ?? service.default_frequency}</td><td>{slab.defaultVisitsPerYear ?? service.default_visits_per_year}</td></tr>)}</tbody></table></div>}
          {service.manpower_ranges?.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr><th className="py-2">Area From (Sq Ft)</th><th>Area To (Sq Ft)</th><th>Recommended Min</th><th>Recommended Max</th><th>Rate per Person / Visit</th></tr></thead><tbody>{service.manpower_ranges.map((range, index) => <tr key={index} className="border-t border-slate-200"><td className="py-2">{range.areaFrom}</td><td>{range.areaTo ?? 'Above'}</td><td>{range.recommendedMin}</td><td>{range.recommendedMax}</td><td>{money(range.ratePerPerson)}</td></tr>)}</tbody></table></div>}
        </div>
      </details>)}
    </div>}
  </section>;
}
