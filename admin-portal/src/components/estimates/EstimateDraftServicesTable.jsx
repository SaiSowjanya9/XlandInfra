import { Pencil, Trash2 } from 'lucide-react';
import {
  formatCurrency,
  getAddonName,
  getAddonPrice,
  getServiceInput,
  getServiceMethodLabel,
  getServiceRate,
  getServiceVendorCost,
  getServiceXlandCost,
  getServiceMarginPercent,
} from '../../utils/estimatePackageUtils';

// The create-estimate services table. One layout for every portal: the category sits under the
// service name, the measured amount carries the rate or slab band beneath it, and each configured
// row states its method. `internal` adds Vendor Cost, XLAND Cost and Margin % — only Admin and FP
// pass it; every other portal gets the same table without the cost columns.
const INPUT_KEYS = {
  quantity_based: 'quantity',
  area_based: 'area',
  capacity_based: 'capacity',
  capacity_slab: 'capacity',
  manpower: 'personnel',
};

// Package rows store camelCase fields (pricingMethod, inputValue, capacitySlabs), catalog rows the
// picker's snake_case, and legacy add-ons neither — this folds all three into the shape the
// estimatePackageUtils helpers read. Exported so EstimateServicesTable normalizes the same way.
export const normalizeServiceRow = (row) => {
  if (typeof row === 'string') return { name: row, frequency_type: 'Monthly' };
  const method = row.pricing_method || row.pricingMethod || row.pricingSnapshot?.pricing_method || '';
  const pricingInputs = row.pricingInputs || row.inputs
    || (INPUT_KEYS[method] && row.inputValue != null && row.inputValue !== ''
      ? { [INPUT_KEYS[method]]: row.inputValue }
      : undefined);
  return {
    ...row,
    name: row.name || row.service_name || row.service,
    pricing_method: method,
    pricingInputs,
    capacity_slabs: row.capacity_slabs || row.capacitySlabs,
    frequency_type: row.frequency_type || row.frequencyType || row.services?.[0]?.frequencyType || 'Monthly',
    frequency_count: row.frequency_count ?? row.frequencyCount ?? row.services?.[0]?.frequencyCount,
  };
};

const METHOD_STYLES = {
  quantity_based: 'bg-blue-50 text-blue-600',
  area_based: 'bg-teal-50 text-teal-600',
  capacity_based: 'bg-purple-50 text-purple-600',
  capacity_slab: 'bg-amber-50 text-amber-600',
  fixed_price: 'bg-emerald-50 text-emerald-600',
  fixed_visit_custom: 'bg-orange-50 text-orange-600',
  manpower: 'bg-rose-50 text-rose-600',
  custom_quote: 'bg-gray-100 text-gray-500',
};

// The secondary line under the measured amount. Prices never appear here -- a ₹ rate is a cost
// and stays out of the field entirely. A capacity slab's band names the bracket the input fell
// in, which is not a cost, so it can stay.
const inputSubLine = (service) => {
  const rate = getServiceRate(service);
  return rate && !rate.includes('₹') ? rate : '';
};

const hasPrice = (service) =>
  service.price != null || service.totalPrice != null || service.total_price != null
  || service.calculatedPrice != null || (service.services || []).some(s => s.price != null)
  || service.catalogServiceId;

export default function EstimateDraftServicesTable({
  items,
  internal = false,
  total,
  totalLabel = 'Total Services Price',
  warm = false,
  decode,
}) {
  if (!items?.length) return null;
  const decodeText = decode || ((s) => s);
  const hasActions = items.some(item => item.actions || item.onEdit || item.onRemove);
  const text = warm ? 'text-warm-text' : 'text-gray-800';
  const muted = warm ? 'text-warm-muted' : 'text-gray-600';
  const headingCls = warm
    ? 'bg-warm-section/60 border-warm-border text-warm-muted'
    : 'bg-blue-50/60 border-blue-100 text-blue-700';
  const totalRowCls = warm
    ? 'bg-warm-section/70 border-warm-border text-warm-text'
    : 'bg-blue-50 border-blue-200 text-blue-800';
  const colCount = (internal ? 10 : 7) + (hasActions ? 1 : 0);

  return (
    <div className={`border rounded-xl overflow-hidden ${warm ? 'border-warm-border' : 'border-blue-200'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${headingCls}`}>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide w-8">#</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Service</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Method</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Input / Details</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">Frequency</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">Visits / Year</th>
              {internal && <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">Vendor Cost (₹)</th>}
              {internal && <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">XLAND Cost (₹)</th>}
              <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">Customer Price (₹)</th>
              {internal && <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide">Margin %</th>}
              {hasActions && <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide w-16">Action</th>}
            </tr>
          </thead>
          <tbody className={`divide-y ${warm ? 'divide-warm-border/60' : 'divide-gray-100'}`}>
            {items.map((item, idx) => {
              const service = normalizeServiceRow(item.row || item);
              const vendorCost = getServiceVendorCost(service);
              const xlandCost = getServiceXlandCost(service);
              const margin = getServiceMarginPercent(service);
              const input = getServiceInput(service)
                || Object.entries(service.pricingInputs || {})
                  .filter(([, v]) => ['string', 'number'].includes(typeof v) && v !== '')
                  .map(([, v]) => `${v}${service.unit ? ` ${service.unit}` : ''}`).join(', ')
                || '-';
              const sub = inputSubLine(service);
              const category = service.category || service.service_category;
              const code = service.service_code || service.serviceCode
                || (service.catalogServiceId ? `SER-${String(service.catalogServiceId).padStart(3, '0')}` : '');
              const visits = service.frequency_count ?? service.frequencyCount ?? '-';
              return (
                <tr key={item.key ?? idx} className="bg-white">
                  <td className={`px-3 py-2.5 text-center ${muted}`}>{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className={`font-medium ${text}`}>{decodeText(getAddonName(service))}</div>
                    {code && <div className={`text-xs ${muted}`}>{code}</div>}
                    {category && <div className={`text-xs ${muted}`}>{category}</div>}
                    {item.tag && <span className={`mt-0.5 inline-block px-1.5 py-px text-[10px] rounded ${warm ? 'bg-warm-accent-soft text-warm-muted' : 'bg-gray-100 text-gray-500'}`}>{item.tag}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {getServiceMethodLabel(service)
                      ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${METHOD_STYLES[service.pricing_method] || 'bg-gray-100 text-gray-600'}`}>{getServiceMethodLabel(service)}</span>
                      : <span className={muted}>-</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-semibold ${text}`}>{input}</div>
                    {sub && <div className={`text-xs ${muted}`}>{sub}</div>}
                  </td>
                  <td className={`px-3 py-2.5 ${muted}`}>{service.frequency_type}</td>
                  <td className={`px-3 py-2.5 text-center ${muted}`}>{visits}</td>
                  {internal && <td className={`px-3 py-2.5 text-right ${muted}`}>{vendorCost != null ? formatCurrency(vendorCost) : '—'}</td>}
                  {internal && (
                    <td className={`px-3 py-2.5 text-right ${muted}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {xlandCost != null ? formatCurrency(xlandCost) : '—'}
                        {item.onEdit && (
                          <button type="button" onClick={item.onEdit} className="text-gray-400 hover:text-gray-600" title="Edit service pricing">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">
                    {hasPrice(service) ? formatCurrency(getAddonPrice(service)) : '—'}
                  </td>
                  {internal && <td className="px-3 py-2.5 text-center font-semibold text-emerald-600">{margin != null ? `${Math.round(margin)}%` : '—'}</td>}
                  {hasActions && (
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center gap-2">
                        {!internal && item.onEdit && (
                          <button type="button" onClick={item.onEdit} className="text-gray-400 hover:text-gray-600" title="Edit service">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {item.onRemove && (
                          <button type="button" onClick={item.onRemove} className="text-red-400 hover:text-red-600" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {item.actions}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {total != null && (
            <tfoot>
              {/* The figure lands under the Customer Price column, with Margin and Action left empty */}
              <tr className={`border-t ${totalRowCls}`}>
                <td colSpan={internal ? 8 : 6} className="px-4 py-2.5 text-sm font-semibold">{totalLabel}</td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-900">{formatCurrency(total)}</td>
                {colCount - (internal ? 9 : 7) > 0 && <td colSpan={colCount - (internal ? 9 : 7)} />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
