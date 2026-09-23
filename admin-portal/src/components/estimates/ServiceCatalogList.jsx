import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { primaryInputLabel } from '../../utils/estimatePackageUtils';
import AddServicePage, { methodLabel, propertyTypeLabel, PROPERTY_TYPES } from './AddServicePage';

const API_BASE = import.meta.env.VITE_API_URL || '';
// Paise only when there are paise, so a column of rates stays narrow enough to read at a glance
const money = value => {
  const amount = Number(value) || 0;
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
// Short codes keep the property column on one line; the full names are in the cell's tooltip
const PROPERTY_CODES = { GC: 'GC', APT: 'APT', FLAT: 'Flat', VILLA: 'Villa', PLOT: 'Plot', IH: 'IH' };

// One clearly separated hue per pricing method, so a method is recognised before its label is read:
// blue, violet, green, cyan, amber, pink. A retired method falls back to grey rather than borrowing
// a live method's colour.
const METHOD_STYLES = {
  fixed_price: 'border-blue-200 bg-blue-50 text-blue-700',
  quantity_based: 'border-violet-200 bg-violet-50 text-violet-700',
  area_based: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  capacity_based: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  capacity_slab: 'border-amber-200 bg-amber-50 text-amber-700',
  manpower: 'border-pink-200 bg-pink-50 text-pink-700'
};
const methodStyle = method => `border ${METHOD_STYLES[method] || 'border-slate-200 bg-slate-100 text-slate-600'}`;

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
  // The service awaiting confirmation, shown in this page's own dialog
  const [confirmDelete, setConfirmDelete] = useState(null);
  // The one service whose slabs are open; a slab table is too tall to leave several expanded
  const [openSlabs, setOpenSlabs] = useState(null);
  const [propertyFilter, setPropertyFilter] = useState('all');
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

  // Deleting or editing can take the last service of a type with it. Without this the list would
  // be stranded on an empty view with no chip left to switch away from.
  useEffect(() => {
    if (propertyFilter !== 'all' && services.length && !services.some(service => service.applicable_property_types?.includes(propertyFilter))) {
      setPropertyFilter('all');
    }
  }, [services, propertyFilter]);

  // Deleting removes the configuration only. Estimates saved with this service keep their own
  // pricing snapshot, so they still price and read correctly; it just cannot be added again.
  // Confirmed in the page's own dialog, never a browser one.
  const deleteService = async service => {
    setDeletingId(service.id);
    try {
      const response = await fetch(`${API_BASE}${apiPath}/${service.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to delete the service.');
      showToast?.('Service deleted', 'success');
      setConfirmDelete(null);
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

  // Every column has to fit without sideways scrolling, so the padding is tight and only the two
  // wordy columns wrap; the rest stay on one line.
  // Columns are sized by the table, so a cell wraps within its share rather than widening the row
  const cell = 'px-1.5 py-3 align-top text-slate-700 break-words';
  const nowrap = `${cell} whitespace-nowrap`;
  // A service applies to several property types, so a chip counts every service that includes it,
  // and the counts add up to more than the service total by design.
  const countFor = type => services.filter(service => service.applicable_property_types?.includes(type)).length;
  // Only the property types these services actually cover get a chip: a filter that can only ever
  // return nothing is noise, the same rule the schedules filters follow.
  const availableTypes = PROPERTY_TYPES.map(type => ({ ...type, count: countFor(type.id) })).filter(type => type.count > 0);
  const shown = propertyFilter === 'all' ? services : services.filter(service => service.applicable_property_types?.includes(propertyFilter));
  const chip = active => `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${active
    ? 'border-slate-700 bg-slate-700 text-white'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`;
  const chipCount = active => `ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`;
  // No card around the list: an open table has the page's full width, which is what lets every
  // column show at once.
  return <section className="min-w-0">
    {/* The top row carries the title and the property type filter with its counts, so the whole
        list can be narrowed from where it is introduced. */}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <h3 className="font-semibold text-slate-800">All Services</h3>
        {/* The count follows the filter, so the heading always describes the rows underneath it */}
        <p className="mt-1 text-xs text-slate-500">
          {loading ? 'Loading...'
            : propertyFilter === 'all' ? `${services.length} service(s)`
            : `${shown.length} of ${services.length} service(s) apply to ${propertyTypeLabel(propertyFilter)}`} · Pricing configurations for estimates
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* A service is counted under every property type it applies to */}
        {availableTypes.length > 1 && <>
          <button type="button" onClick={() => setPropertyFilter('all')} className={chip(propertyFilter === 'all')}>
            All<span className={chipCount(propertyFilter === 'all')}>{services.length}</span>
          </button>
          {availableTypes.map(type => (
            <button key={type.id} type="button" onClick={() => setPropertyFilter(type.id)} className={chip(propertyFilter === type.id)}
              title={`${type.count} of ${services.length} service(s) apply to ${type.label}`}>
              {type.label}<span className={chipCount(propertyFilter === type.id)}>{type.count}</span>
            </button>
          ))}
        </>}
        {/* No create action here: this list sits on the Add Service screen, which is where a service
            is created, so the button is not repeated. */}
        <button type="button" aria-label="Refresh service catalog" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="rounded-lg border border-slate-200 p-2 text-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
    </div>
    {error ? <p role="alert" className="py-4 text-sm text-red-600">{error}</p>
      : !loading && !services.length ? <p className="py-6 text-sm text-slate-500">{admin?.role === 'admin' ? 'No configured services yet. Use Add Service to create one.' : 'No configured services are available in your scope yet.'}</p>
      : !shown.length ? <p className="py-6 text-sm text-slate-500">No configured services apply to {propertyTypeLabel(propertyFilter)}.</p>
      : <div>
        {/* Fixed proportional widths: the table can never grow past the page, so there is no
            sideways scrollbar and every column stays visible at once. */}
        <table className="w-full table-fixed text-left text-[11px]">
          {/* Every heading stays on one line, so the row keeps a single height */}
          <thead className="whitespace-nowrap bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-[3%] px-1.5 py-2.5 text-center">#</th>
              <th className="w-[10%] px-1.5 py-2.5">Service</th>
              <th className="w-[9%] px-1.5 py-2.5">Description</th>
              <th className="w-[10%] px-1.5 py-2.5">Method</th>
              <th className="w-[8%] px-1.5 py-2.5">Input</th>
              <th className="w-[7%] px-1.5 py-2.5">Frequency</th>
              <th className="w-[5%] px-1.5 py-2.5 text-center">Visits</th>
              <th className="w-[9%] px-1.5 py-2.5">Vendor Cost</th>
              <th className="w-[7%] px-1.5 py-2.5 text-center">Markup %</th>
              <th className="w-[9%] px-1.5 py-2.5">XLAND Margin</th>
              <th className="w-[10%] px-1.5 py-2.5">Customer Price</th>
              <th className="w-[7%] px-1.5 py-2.5">Property</th>
              <th className="w-[6%] px-1.5 py-2.5 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((service, index) => <Fragment key={service.id}>
            <tr className="hover:bg-slate-50/60">
              <td className={`${cell} text-center text-slate-400`}>{index + 1}</td>
              <td className={cell}>
                <p className="font-semibold text-slate-900" title={service.service_name}>{service.service_name}</p>
              </td>
              <td className={`${cell} text-slate-500`} title={service.description || ''}><p className="line-clamp-2">{service.description || '—'}</p></td>
              {/* Capacity Slab prices from a table of its own, so the row opens to show every slab */}
              <td className={cell}>
                {service.pricing_method === 'capacity_slab' && service.capacity_slabs?.length
                  ? <button type="button" onClick={() => setOpenSlabs(current => current === service.id ? null : service.id)}
                      aria-expanded={openSlabs === service.id} aria-label={`${openSlabs === service.id ? 'Hide' : 'Show'} slabs for ${service.service_name}`}
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 font-medium hover:brightness-95 ${methodStyle(service.pricing_method)}`}>
                      {methodLabel(service.pricing_method)}
                      <ChevronDown className={`h-3 w-3 transition-transform ${openSlabs === service.id ? 'rotate-180' : ''}`} />
                    </button>
                  : <span className={`inline-block whitespace-nowrap rounded px-1.5 py-1 font-medium ${methodStyle(service.pricing_method)}`}>{methodLabel(service.pricing_method)}</span>}
              </td>
              {/* The input only: the vendor rate has its own column rather than sitting underneath */}
              <td className={cell}><p className="line-clamp-2">{primaryInputLabel(service.service_name, service.pricing_method, service.unit) || '—'}</p></td>
              <td className={cell}>{service.default_frequency}</td>
              <td className={`${nowrap} text-center`}>{service.default_visits_per_year}</td>
              <td className={cell}>{rateSummary(service)}</td>
              <td className={`${nowrap} text-center`}>{service.default_markup_percentage}%</td>
              {/* Both derived from the vendor rate: XLAND takes the markup, the customer pays the sum */}
              <td className={cell}>{rateSummary(service, Number(service.default_markup_percentage || 0) / 100)}</td>
              <td className={`${cell} font-semibold text-emerald-700`}>{rateSummary(service, 1 + Number(service.default_markup_percentage || 0) / 100)}</td>
              <td className={cell} title={service.applicable_property_types.map(propertyTypeLabel).join(', ')}>
                {service.applicable_property_types.map(type => PROPERTY_CODES[type] || propertyTypeLabel(type)).join(', ')}
              </td>
              <td className={`${nowrap} text-center`}>
                {canEdit(service) ? <div className="flex items-center justify-center gap-0.5">
                  <button type="button" onClick={() => setEditingService(service)} title="Edit service" aria-label={`Edit ${service.service_name}`}
                    className="rounded p-1 text-blue-600 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setConfirmDelete(service)} disabled={deletingId === service.id} title="Delete service" aria-label={`Delete ${service.service_name}`}
                    className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div> : <span className="text-slate-300">—</span>}
              </td>
            </tr>
            {openSlabs === service.id && <tr className="bg-slate-50/70">
              <td colSpan={13} className="px-6 py-4">
                <p className="mb-2 font-semibold text-slate-700">Capacity slabs ({service.capacity_slabs.length})</p>
                <table className="w-full text-left text-[11px]">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1.5 pr-4">Slab ({service.unit})</th>
                      <th className="py-1.5 pr-4">Vendor Rate / Visit</th>
                      <th className="py-1.5 pr-4">XLAND Margin / Visit</th>
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

    {/* Confirmation lives in the page, so deleting never hands over to a browser dialog */}
    {confirmDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-service-title">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 className="h-5 w-5 text-red-500" /></span>
          <div className="min-w-0">
            <h3 id="delete-service-title" className="text-base font-semibold text-slate-900">Delete “{confirmDelete.service_name}”?</h3>
            <p className="mt-2 text-sm text-slate-600">Estimates already saved with this service keep their pricing, but it can no longer be added to a new estimate. This cannot be undone.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setConfirmDelete(null)} disabled={deletingId === confirmDelete.id}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => deleteService(confirmDelete)} disabled={deletingId === confirmDelete.id}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {deletingId === confirmDelete.id ? 'Deleting...' : 'Delete Service'}
          </button>
        </div>
      </div>
    </div>}
  </section>;
}
