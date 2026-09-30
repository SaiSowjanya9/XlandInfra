import { formatCurrency, getAddonName, getAddonPrice, getServiceInput,
  getServiceMethodLabel, getServiceRate, getServiceVendorCost, getServiceXlandCost,
  getServiceMarginPercent } from '../../utils/estimatePackageUtils';
import { normalizeServiceRow } from './EstimateDraftServicesTable';

/**
 * The services on a saved estimate: what the service is, how it was priced, what was measured at
 * the property, its schedule, and the customer's price.
 *
 * **The customer's price is the only money in it unless `internal` is set.** With `internal`, the
 * table adds Vendor Cost, XLAND Cost and Margin % and states the rate under the measured input —
 * the same columns the create form's draft table shows. Only Admin, Operations Manager and FP may
 * see them, so `internal` is passed only from those portals' detail views; Manager, Coordinator,
 * Executive, Supervisor and every customer document keep the cost-free table, so what they read is
 * still what the customer receives.
 *
 * One component rather than a copy per screen: every screen that lists an estimate's services uses
 * it. The caller keeps its own heading and wrapper, and passes its own `decode` for HTML-encoded
 * names.
 */
// The table is drawn in the cream skin, not green: every filled block here -- the header, the row
// number, the method badge and the total -- is a warm tint, and figures read in warm text.

const serviceColumns = (decode, internal) => {
  const number = { label: '#', head: 'col-span-1', cell: 'col-span-1',
    render: (row, index) => <span className="w-5 h-5 bg-warm-accent-soft border border-warm-border text-warm-text text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span> };
  // The category says what kind of service this is, so it reads under the name rather than among
  // the details -- the same place the PDF sets it
  const service = { label: 'Service', head: 'col-span-3', cell: 'col-span-3 min-w-0',
    render: row => <>
      <p className="font-medium text-gray-800 text-sm break-words">{decode(getAddonName(row))}</p>
      {row.category && <p className="text-[10px] text-gray-500">{decode(row.category)}</p>}
      {/* A package's own service, folded into the internal table beside the added services */}
      {row._tag && <span className="mt-0.5 inline-block rounded bg-warm-accent-soft px-1.5 py-px text-[10px] text-warm-muted">{row._tag}</span>}
    </> };
  const method = { label: 'Method', head: 'col-span-2', cell: 'col-span-2',
    // A hand-entered service has no configured method, so it says nothing rather than guessing one
    render: row => (getServiceMethodLabel(row)
      ? <span className="inline-block rounded bg-warm-accent-soft px-2 py-0.5 text-[10px] font-semibold text-warm-text">{getServiceMethodLabel(row)}</span>
      : <span className="text-xs text-gray-400">-</span>) };
  const input = { label: 'Input / Details', head: 'col-span-2', cell: 'col-span-2 min-w-0',
    // What was measured at the property -- 4 Lift, 15,000 Sq Ft. The subline is screen-only
    // (print:hidden keeps a browser print clean): a slab band names the bracket the input fell in
    // for everyone, while a ₹ rate is the vendor's price and shows to internal viewers only.
    render: row => {
      const sub = getServiceRate(row);
      const showSub = sub && (!sub.includes('₹') || internal);
      return <>
        <p className="text-xs text-gray-700 break-words">{getServiceInput(row) || '-'}</p>
        {showSub && <p className="text-[10px] text-gray-500 print:hidden">{sub}</p>}
      </>;
    } };
  const frequency = { label: 'Frequency', head: 'col-span-2 text-center', cell: 'col-span-2 text-center',
    render: row => <p className="text-sm text-warm-text">{row.frequency_type || row.frequencyType || 'Monthly'}</p> };
  const visits = { label: 'Visits / Year', head: 'col-span-1 text-center', cell: 'col-span-1 text-center',
    render: row => <p className="text-sm text-warm-text font-semibold">{row.frequency_count ?? row.frequencyCount ?? 1}</p> };
  const money = (value, cls = 'text-gray-700') =>
    <p className={`text-xs ${cls}`}>{value != null ? formatCurrency(value) : '—'}</p>;
  // The three internal figures are print:hidden throughout: a browser print of the internal
  // detail view is still the customer's document, so it prices like the customer-facing one
  const vendor = { label: 'Vendor Cost', head: 'col-span-1 text-right print:hidden', cell: 'col-span-1 text-right print:hidden',
    render: row => money(getServiceVendorCost(row)) };
  const xland = { label: 'XLAND Cost', head: 'col-span-1 text-right print:hidden', cell: 'col-span-1 text-right print:hidden',
    render: row => money(getServiceXlandCost(row)) };
  const price = { label: 'Customer Price', head: 'col-span-1 text-right', cell: 'col-span-1 text-right',
    render: row => <p className="text-xs text-gray-800 font-semibold">{formatCurrency(getAddonPrice(row))}</p> };
  const margin = { label: 'Margin %', head: 'col-span-1 text-center print:hidden', cell: 'col-span-1 text-center print:hidden',
    render: row => {
      const value = getServiceMarginPercent(row);
      return <p className={`text-xs font-semibold ${value != null && value < 0 ? 'text-red-600' : 'text-warm-accent-hover'}`}>{value != null ? `${Math.round(value)}%` : '—'}</p>;
    } };
  return internal
    ? [number, service, method, input, frequency, visits, vendor, xland, price, margin]
    : [number, service, method, input, frequency, visits, price];
};

export default function EstimateServicesTable({ rows, total, decode = value => value ?? '',
  topRadius = 'rounded-t-lg', bottomRadius = 'rounded-b-lg', internal = false }) {
  const services = (Array.isArray(rows) ? rows : []).map(normalizeServiceRow);
  if (!services.length) return null;
  const sum = total ?? services.reduce((value, row) => value + getAddonPrice(row), 0);
  const columns = serviceColumns(decode, internal);
  // 12 tracks without the cost columns; the three internal figures take it to 15, with a floor so
  // the money columns don't collapse — that floor is internal-only, other views keep squeezing.
  // On paper the cost cells are hidden and the tracks drop back to 12, so the printed table is
  // laid out exactly as the customer-facing one.
  const grid = internal ? 'grid-cols-[repeat(15,minmax(0,1fr))] print:grid-cols-12' : 'grid-cols-12';
  const floor = internal ? 'min-w-[720px] print:min-w-0' : '';
  return (
    <div className={internal ? 'overflow-x-auto print:overflow-visible' : undefined}>
      <div className={`grid ${grid} gap-2 px-3 py-2 bg-warm-section ${topRadius} ${floor}`}>
        {columns.map(column => <div key={column.label} className={`text-xs font-semibold text-warm-muted ${column.head}`}>{column.label}</div>)}
      </div>
      <div className={`border border-warm-border divide-y divide-warm-border/60 ${floor}`}>
        {services.map((row, index) => (
          <div key={index} className={`grid ${grid} gap-2 px-3 py-2 items-center bg-white`}>
            {columns.map(column => <div key={column.label} className={column.cell}>{column.render(row, index)}</div>)}
          </div>
        ))}
      </div>
      <div className={`flex justify-between items-center bg-warm-section p-3 ${bottomRadius} ${floor}`}>
        <p className="font-semibold text-warm-text">Total Services Price</p>
        <p className="font-bold text-warm-text">{formatCurrency(sum)}</p>
      </div>
    </div>
  );
}
