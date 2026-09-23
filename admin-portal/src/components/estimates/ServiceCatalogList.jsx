import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { primaryInputLabel } from '../../utils/estimatePackageUtils';
import AddServicePage, { methodLabel, propertyTypeLabel } from './AddServicePage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const money = value => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Each pricing method is configured with one vendor rate, so the table states it the way the method
// charges. Capacity Slab has no service-level rate: its slabs carry a rate each, so the span is shown.
// `factor` scales the rate, which is how the XLAND column derives its share from the markup.
const rateSummary = (service, factor = 1) => {
  const unit = service.unit || 'Unit';
  const at = value => money(Number(value) * factor);
  switch (service.pricing_method) {
    case 'fixed_price': return `${at(service.fixed_price)} / Visit`;
    case 'quantity_based': return `${at(service.rate_per_quantity)} / ${unit} / Visit`;
    case 'area_based': return `${at(service.rate_per_unit)} / ${unit} / Visit`;
    case 'capacity_based': return `${at(service.rate_per_capacity)} / ${unit} / Visit`;
    case 'capacity_slab': {
      const rates = (service.capacity_slabs || []).filter(slab => !slab.isCustomQuote).map(slab => Number(slab.vendorRate));
      const span = rates.length ? `${at(Math.min(...rates))}–${at(Math.max(...rates))} / Visit` : 'Custom quote';
      return factor === 1 ? `${(service.capacity_slabs || []).length} slab(s) · ${span}` : span;
    }
    case 'manpower': return service.manpower_basis === 'per_visit'
      ? `${at(service.rate_per_person)} / Person / Visit`
      : `${at(service.monthly_rate)} / Person / Month`;
    default: return '—';
  }
};

// `showWhenEmpty` is for a screen where this list is the whole content and needs to
// say something; elsewhere an empty panel is only noise, so it is not rendered at all.
export default function ServiceCatalogList({ fpId, admin, showToast, apiPath = '/api/admin/service-catalog',
  scoped = false, scopeLabel, embedded = false, showWhenEmpty = false,
  canEdit = service => admin?.role === 'admin' }) {
  const [editingService, setEditingService] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  // The one service whose slabs are open; a slab table is too tall to leave several expanded
  const [openSlabs, setOpenSlabs] = useState(null);
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

  // Deleting removes the configuration only. Estimates saved with this service keep their own
  // pricing snapshot, so they still price and read correctly; it just cannot be added again.
  const deleteService = async service => {
    if (!window.confirm(`Delete "${service.service_name}"? Estimates already saved with it keep their pricing, but the service cannot be added to a new estimate.`)) return;
    setDeletingId(service.id);
    try {
      const response = await fetch(`${API_BASE}${apiPath}/${service.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to delete the service.');
      showToast?.('Service deleted', 'success');
      setRefresh(value => value + 1);
    } catch (error) {
      showToast?.(error.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (editingService) return <AddServicePage service={editingService} admin={admin} showToast={showToast}
    apiPath={apiPath} scoped={scoped} scopeLabel={scopeLabel} embedded={embedded}
    onBack={() => setEditingService(null)} onSave={() => setRefresh(value => value + 1)} />;

  // Nothing to list and nothing to say: no header, no empty message, no card. A failure still
  // has to be shown.
  if (!services.length && !error && !showWhenEmpty) return null;

  const cell = 'px-3 py-3 align-top text-slate-700 [overflow-wrap:anywhere]';
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h3 className="font-semibold text-slate-800">Configured Services</h3><p className="mt-1 text-xs text-slate-500">{loading ? 'Loading...' : `${services.length} service(s)`} · Pricing configurations for estimates</p></div>
      {/* No create action here: this list sits on the Add Service screen, which is where a service
          is created, so the button is not repeated. */}
      <button type="button" aria-label="Refresh service catalog" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-lg border border-slate-200 p-2 text-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
    </div>
    {error ? <p role="alert" className="px-5 py-4 text-sm text-red-600">{error}</p>
      : !loading && !services.length ? <p className="px-5 py-6 text-sm text-slate-500">{admin?.role === 'admin' ? 'No configured services yet. Use Add Service to create one.' : 'No configured services are available in your scope yet.'}</p>
      : <div className="overflow-x-auto">
        <table className="w-full min-w-[1140px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2.5 text-center">#</th>
              <th className="px-3 py-2.5">Service</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5">Method</th>
              <th className="px-3 py-2.5">Input</th>
              <th className="px-3 py-2.5">Frequency</th>
              <th className="px-3 py-2.5 text-center">Visits / Year</th>
              <th className="px-3 py-2.5">Vendor Cost (₹)</th>
              <th className="px-3 py-2.5 text-center">Markup %</th>
              <th className="px-3 py-2.5">XLAND Cost (₹)</th>
              <th className="px-3 py-2.5">Property Types</th>
              <th className="w-24 px-3 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.map((service, index) => <Fragment key={service.id}>
            <tr className="hover:bg-slate-50/60">
              <td className={`${cell} text-center text-slate-400`}>{index + 1}</td>
              <td className={cell}>
                <p className="font-semibold text-slate-900">{service.service_name}</p>
                <p className="mt-0.5 text-slate-500">{service.category} · {service.franchise_partner_id ? `FP ${service.franchise_partner_id}` : 'All FPs'}</p>
              </td>
              <td className={`${cell} max-w-[220px] text-slate-500`} title={service.description || ''}>{service.description || '—'}</td>
              {/* Capacity Slab prices from a table of its own, so the row opens to show every slab */}
              <td className={cell}>
                {service.pricing_method === 'capacity_slab' && service.capacity_slabs?.length
                  ? <button type="button" onClick={() => setOpenSlabs(current => current === service.id ? null : service.id)}
                      aria-expanded={openSlabs === service.id} aria-label={`${openSlabs === service.id ? 'Hide' : 'Show'} slabs for ${service.service_name}`}
                      className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-1 font-medium text-amber-700 hover:bg-amber-100">
                      {methodLabel(service.pricing_method)}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSlabs === service.id ? 'rotate-180' : ''}`} />
                    </button>
                  : <span className="inline-block rounded bg-blue-50 px-2 py-1 font-medium text-blue-700">{methodLabel(service.pricing_method)}</span>}
              </td>
              {/* The input only: the vendor rate has its own column rather than sitting underneath */}
              <td className={cell}>{primaryInputLabel(service.service_name, service.pricing_method, service.unit) || '—'}</td>
              <td className={cell}>{service.default_frequency}</td>
              <td className={`${cell} text-center`}>{service.default_visits_per_year}</td>
              <td className={cell}>{rateSummary(service)}</td>
              <td className={`${cell} text-center`}>{service.default_markup_percentage}%</td>
              {/* Derived: XLAND's share is the markup on the vendor rate, never a stored figure */}
              <td className={cell}>{rateSummary(service, Number(service.default_markup_percentage || 0) / 100)}</td>
              <td className={cell}>{service.applicable_property_types.map(propertyTypeLabel).join(', ')}</td>
              <td className={`${cell} text-center`}>
                {canEdit(service) ? <div className="flex items-center justify-center gap-1">
                  <button type="button" onClick={() => setEditingService(service)} title="Edit service" aria-label={`Edit ${service.service_name}`}
                    className="rounded-lg border border-slate-200 p-1.5 text-blue-600 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => deleteService(service)} disabled={deletingId === service.id} title="Delete service" aria-label={`Delete ${service.service_name}`}
                    className="rounded-lg border border-slate-200 p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div> : <span className="text-slate-300">—</span>}
              </td>
            </tr>
            {openSlabs === service.id && <tr className="bg-slate-50/70">
              <td colSpan={12} className="px-6 py-4">
                <p className="mb-2 font-semibold text-slate-700">Capacity slabs ({service.capacity_slabs.length})</p>
                <table className="w-full text-left text-[11px]">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1.5 pr-4">Slab ({service.unit})</th>
                      <th className="py-1.5 pr-4">Vendor Rate / Visit</th>
                      <th className="py-1.5 pr-4">XLAND Cost / Visit</th>
                      <th className="py-1.5 pr-4">Customer Price / Visit</th>
                      <th className="py-1.5 pr-4">Frequency</th>
                      <th className="py-1.5 text-center">Visits / Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {service.capacity_slabs.map((slab, slabIndex) => {
                      const markup = Number(service.default_markup_percentage || 0) / 100;
                      const rate = Number(slab.vendorRate);
                      return <tr key={slabIndex} className="text-slate-700">
                        <td className="py-1.5 pr-4">{slab.capacityFrom}{slab.capacityTo == null ? ' and above' : `–${slab.capacityTo}`}</td>
                        {slab.isCustomQuote
                          ? <td className="py-1.5 pr-4 text-amber-700" colSpan={3}>Custom quote required</td>
                          : <>
                            <td className="py-1.5 pr-4">{money(rate)}</td>
                            <td className="py-1.5 pr-4">{money(rate * markup)}</td>
                            <td className="py-1.5 pr-4 font-medium text-slate-900">{money(rate * (1 + markup))}</td>
                          </>}
                        <td className="py-1.5 pr-4">{slab.defaultFrequency ?? service.default_frequency}</td>
                        <td className="py-1.5 text-center">{slab.defaultVisitsPerYear ?? service.default_visits_per_year}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </td>
            </tr>}
            </Fragment>)}
          </tbody>
        </table>
      </div>}
  </section>;
}
