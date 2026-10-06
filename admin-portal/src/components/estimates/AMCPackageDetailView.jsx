import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency, getPackagePropertyTypes, getPropertyTypeLabel } from '../../utils/estimatePackageUtils';
import { decodeEntities } from '../../utils/text';
import { packageInternalSummary } from '../../utils/packageServicePricing';
import EstimateProfitSummaryPanel from './EstimateProfitSummaryPanel';

/**
 * An AMC package opened from the AMC Packages list, in place of the list -- inside the portal, with
 * its sidebar and page header still there -- the way an estimate opens from All Estimates: a Back
 * button, then everything the package holds in one card. It is not an overlay: an earlier version
 * covered the whole window and read as a separate page. It replaces the centred View modal each
 * portal drew for itself (and the eye icon that opened it); the row or the package name opens this
 * instead. One component for every portal, so the six lists show a package the same way. The caller
 * renders it where the list goes and hides the list while it is open.
 *
 * The lists hand packages over in different shapes -- `servicesData`, `serviceRows`, or the stored
 * `services` JSON with `serviceRows` inside -- so all of them are read. Stored text is HTML-escaped
 * by the server, so it is decoded before it is shown ("Electrical &amp; Plumbing" read literally).
 */
const parse = value => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

export const packageServiceRows = pkg => {
  if (Array.isArray(pkg?.servicesData) && pkg.servicesData.length) return pkg.servicesData;
  if (Array.isArray(pkg?.serviceRows) && pkg.serviceRows.length) return pkg.serviceRows;
  const stored = parse(pkg?.services);
  if (Array.isArray(stored?.serviceRows)) return stored.serviceRows;
  return Array.isArray(stored) ? stored : [];
};

const packageBilling = pkg => {
  const stored = parse(pkg?.services);
  return String(pkg?.billingDuration || pkg?.billing_duration || stored?.billing_duration || 'yearly').replace('-', ' ');
};

// `internal` -- only for the portals allowed internal figures (Admin, Operations Manager, FP,
// Manager) -- adds the package's INTERNAL panel under its price summary: the same four figures the
// create form showed when the package was made, from what was saved with it.
export default function AMCPackageDetailView({ pkg, onClose, backLabel = 'Back to AMC Packages', actions = null, internal = false }) {
  // Escape returns to the list like the Back button. Opening a package brings its top into view,
  // since the row clicked may have been far down the list.
  const topRef = useRef(null);
  useEffect(() => {
    if (!pkg) return undefined;
    topRef.current?.scrollIntoView({ block: 'start' });
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pkg, onClose]);
  if (!pkg) return null;

  const decode = value => decodeEntities(String(value ?? ''));
  const rows = packageServiceRows(pkg);
  const types = getPackagePropertyTypes(pkg);
  const typeList = (types.length ? types : [pkg.propertyType || pkg.property_type].filter(Boolean)).map(getPropertyTypeLabel);
  const price = Number(pkg.price ?? pkg.base_price ?? pkg.rate) || 0;
  const gstPercent = Number(pkg.gst_percentage) || 0;
  const gst = price * gstPercent / 100;
  const description = decode(pkg.description).trim();
  const name = decode(pkg.name || pkg.packageName || pkg.package_name) || 'Unnamed Package';
  const figures = internal ? packageInternalSummary(rows, price) : null;
  const code = pkg.packageId || pkg.package_code || `PKG-${pkg.id}`;

  return (
    <section ref={topRef} aria-labelledby="amc-package-title" className="scroll-mt-4">
      {/* Back above the document, as All Estimates has it */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />{backLabel}
        </button>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="space-y-6 p-4 sm:p-6">
          <div className="rounded-xl border border-warm-border bg-warm-section p-5">
            <h4 id="amc-package-title" className="text-xl font-bold text-warm-text [overflow-wrap:anywhere]">{name}</h4>
            <p className="mt-1 text-sm text-warm-accent-hover">{code}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-warm-section p-4">
              <p className="mb-2 text-xs text-warm-muted">Property Type</p>
              <div className="flex flex-wrap gap-1.5">
                {typeList.length ? typeList.map(label => (
                  <span key={label} className="rounded-full border border-warm-border bg-white px-2.5 py-0.5 text-xs font-medium text-warm-text">{label}</span>
                )) : <span className="text-sm text-warm-muted">-</span>}
              </div>
            </div>
            <div className="rounded-xl bg-warm-section p-4">
              <p className="mb-1 text-xs text-warm-muted">Billing</p>
              <p className="font-semibold capitalize text-warm-text">{packageBilling(pkg)}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-4">
              <p className="mb-1 text-xs text-warm-muted">Total Rate</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(price)}</p>
            </div>
          </div>

          {description && (
            <div>
              <p className="mb-1 text-sm font-semibold text-warm-text">Description</p>
              <p className="whitespace-pre-wrap text-sm text-warm-muted [overflow-wrap:anywhere]">{description}</p>
            </div>
          )}

          <div>
            <p className="mb-3 text-sm font-semibold text-warm-text">Services Included ({rows.length})</p>
            {rows.length ? (
              <div className="overflow-x-auto rounded-xl border border-warm-border">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="bg-warm-section">
                    <tr>
                      {['#', 'Service', 'Description', 'Frequency', 'Visits'].map(label => (
                        <th key={label} scope="col" className={`px-4 py-3 text-xs font-semibold text-warm-muted ${label === 'Frequency' || label === 'Visits' ? 'text-center' : 'text-left'}`}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-border/60 bg-white">
                    {rows.map((service, index) => {
                      const category = decode(service.category);
                      return (
                        <tr key={index} className="align-top">
                          <td className="px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warm-accent-soft text-xs font-bold text-warm-text">{index + 1}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-warm-text [overflow-wrap:anywhere]">{decode(service.name || service.service) || 'Service'}</p>
                            {category && <p className="text-[11px] text-warm-muted">{category}</p>}
                          </td>
                          <td className="px-4 py-3 text-warm-muted whitespace-pre-wrap [overflow-wrap:anywhere]">{decode(service.description).trim() || '-'}</td>
                          <td className="px-4 py-3 text-center text-warm-text">{service.frequency_type || service.frequencyType || 'Monthly'}</td>
                          <td className="px-4 py-3 text-center font-medium text-warm-text">{service.frequency_count ?? service.frequencyCount ?? service.visits ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm italic text-warm-muted">No services listed</p>}
          </div>

          <div className="ml-auto w-full max-w-sm">
            <p className="mb-3 text-sm font-semibold text-warm-text">Price Summary</p>
            <div className="space-y-3 rounded-xl bg-warm-section p-5">
              <div className="flex items-center justify-between"><span className="text-warm-muted">Subtotal</span><span className="font-semibold text-warm-text">{formatCurrency(price)}</span></div>
              <div className="flex items-center justify-between"><span className="text-warm-muted">GST ({gstPercent}%)</span><span className="font-semibold text-warm-text">{formatCurrency(gst)}</span></div>
              <div className="flex items-center justify-between border-t border-warm-border pt-3"><span className="font-bold text-warm-text">Total</span><span className="text-xl font-bold text-green-600">{formatCurrency(price + gst)}</span></div>
            </div>
          </div>

          {internal && (figures
            ? <EstimateProfitSummaryPanel vendorCost={figures.vendorCost} operatingCost={figures.operatingCost}
                customerPrice={figures.customerPrice} className="border-t border-warm-border pt-4" />
            : <p className="border-t border-warm-border pt-4 text-[11px] text-warm-muted print:hidden">
                INTERNAL: this package was saved before its services carried a vendor cost, so there are no internal figures to show. Open it in Edit and save it once to record them.
              </p>)}
        </div>
      </div>
    </section>
  );
}
