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

// A real table, not a grid of equal tracks: the grid gave every money column one fifteenth of the
// width, too narrow for "Customer Price", and the unwrappable headings ran into one another --
// "Vendor CostXLAND CostCustomer Price". Table columns size to their headings and contents.
// `head`/`cell` carry alignment and print visibility only.
const serviceColumns = (decode, internal) => {
  const number = { label: '#', head: 'w-10', cell: '',
    render: (row, index) => <span className="w-5 h-5 bg-warm-accent-soft border border-warm-border text-warm-text text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span> };
  // The category says what kind of service this is, so it reads under the name rather than among
  // the details -- the same place the PDF sets it
  const service = { label: 'Service', head: '', cell: 'min-w-[140px]',
    render: row => <>
      <p className="font-medium text-gray-800 text-sm break-words">{decode(getAddonName(row))}</p>
      {row.category && <p className="text-[10px] text-gray-500">{decode(row.category)}</p>}
      {/* A package's own service, folded into the internal table beside the added services */}
      {row._tag && <span className="mt-0.5 inline-block rounded bg-warm-accent-soft px-1.5 py-px text-[10px] text-warm-muted">{row._tag}</span>}
    </> };
  const method = { label: 'Method', head: '', cell: '',
    // A hand-entered service has no configured method, so it says nothing rather than guessing one
    render: row => (getServiceMethodLabel(row)
      ? <span className="inline-block rounded bg-warm-accent-soft px-2 py-0.5 text-[10px] font-semibold text-warm-text">{getServiceMethodLabel(row)}</span>
      : <span className="text-xs text-gray-400">-</span>) };
  const input = { label: 'Input / Details', head: '', cell: 'min-w-[110px]',
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
  const frequency = { label: 'Frequency', head: 'text-center', cell: 'text-center',
    render: row => <p className="text-sm text-warm-text">{row.frequency_type || row.frequencyType || 'Monthly'}</p> };
  const visits = { label: 'Visits / Year', head: 'text-center', cell: 'text-center',
    render: row => <p className="text-sm text-warm-text font-semibold">{row.frequency_count ?? row.frequencyCount ?? 1}</p> };
  const money = (value, cls = 'text-gray-700') =>
    <p className={`whitespace-nowrap text-xs ${cls}`}>{value != null ? formatCurrency(value) : '—'}</p>;
  // The three internal figures are print:hidden throughout: a browser print of the internal
  // detail view is still the customer's document, so it prices like the customer-facing one
  // A package's own service is paid for by the package price, not on its own: it reads "Included"
  // rather than ₹0, and has no XLAND cost or margin of its own -- those belong to the package
  const inPackage = row => row._tag === 'Package';
  const vendor = { label: 'Vendor Cost', head: 'text-right print:hidden', cell: 'text-right print:hidden',
    render: row => money(getServiceVendorCost(row)) };
  const xland = { label: 'XLAND Cost', head: 'text-right print:hidden', cell: 'text-right print:hidden',
    render: row => (inPackage(row) ? money(null) : money(getServiceXlandCost(row))) };
  const price = { label: 'Customer Price', head: 'text-center', cell: 'text-center',
    render: row => (inPackage(row)
      ? <p className="whitespace-nowrap text-xs text-warm-muted">Included</p>
      : <p className="whitespace-nowrap text-xs text-gray-800 font-semibold">{formatCurrency(getAddonPrice(row))}</p>) };
  const margin = { label: 'Margin %', head: 'text-center print:hidden', cell: 'text-center print:hidden',
    render: row => {
      if (inPackage(row)) return <p className="text-xs text-warm-muted">—</p>;
      const value = getServiceMarginPercent(row);
      return <p className={`text-xs font-semibold ${value != null && value < 0 ? 'text-red-600' : 'text-warm-accent-hover'}`}>{value != null ? `${Math.round(value)}%` : '—'}</p>;
    } };
  return internal
    ? [number, service, method, input, frequency, visits, vendor, xland, price, margin]
    : [number, service, method, input, frequency, visits, price];
};

export default function EstimateServicesTable({ rows, total, note = null, decode = value => value ?? '',
  topRadius = 'rounded-t-lg', bottomRadius = 'rounded-b-lg', internal = false }) {
  const services = (Array.isArray(rows) ? rows : []).map(normalizeServiceRow);
  if (!services.length) return null;
  const sum = total ?? services.reduce((value, row) => value + getAddonPrice(row), 0);
  const columns = serviceColumns(decode, internal);
  const cell = 'px-3 py-2 align-middle';
  return (
    // Scrolls sideways on a narrow screen rather than squeezing the columns; on paper it lays out
    // in full, with the internal cost cells hidden
    <div className={`overflow-x-auto print:overflow-visible border border-warm-border ${topRadius} ${bottomRadius}`}>
      <table className="w-full border-collapse">
        <thead className="bg-warm-section">
          <tr>
            {columns.map(column => (
              <th key={column.label} scope="col"
                className={`${cell} whitespace-nowrap text-xs font-semibold text-warm-muted ${/text-(right|center)/.test(column.head) ? '' : 'text-left'} ${column.head}`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-border/60 bg-white">
          {services.map((row, index) => (
            <tr key={index}>
              {columns.map(column => <td key={column.label} className={`${cell} ${column.cell}`}>{column.render(row, index)}</td>)}
            </tr>
          ))}
        </tbody>
        {/* The figure sits in the Customer Price column. The label spans the six columns every
            view has; the internal cost cells either side are their own cells, so when print hides
            them the total still lands under the price. */}
        <tfoot className="bg-warm-section">
          <tr>
            <td colSpan={6} className={`${cell} font-semibold text-warm-text`}>Total Services Price</td>
            {internal && <td colSpan={2} className={`${cell} print:hidden`} />}
            <td className={`${cell} whitespace-nowrap text-center font-bold text-warm-text`}>{formatCurrency(sum)}</td>
            {internal && <td className={`${cell} print:hidden`} />}
          </tr>
          {/* A small line under the total, e.g. which AMC package it includes and at what price */}
          {note && (
            <tr>
              <td colSpan={internal ? 10 : 7} className="px-3 pb-2 pt-0 text-[11px] text-warm-muted">{note}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
