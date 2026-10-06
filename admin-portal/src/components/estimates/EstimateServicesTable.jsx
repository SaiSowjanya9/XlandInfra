import { formatCurrency, getAddonName, getAddonPrice, getServiceInput, stripInternalServiceDetails,
  getServiceMethodLabel, getServiceRate, getServiceVendorCost, getServiceXlandCost,
  getServiceMarginPercent } from '../../utils/estimatePackageUtils';
import { normalizeServiceRow } from './EstimateDraftServicesTable';

/**
 * The services on a saved estimate: what the service is, how it was priced, what was measured at
 * the property, its schedule and its Customer Price. This view is the one place a service states a
 * price of its own (the user asked for the column back here); the create screens, PDFs and emails
 * price the estimate as a whole, in Total Services Price and the Price Summary.
 *
 * **The Customer Price is the only money in it unless `internal` is set.** With `internal`, the
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
const serviceColumns = (decode, internal, showTag = true) => {
  const number = { label: '#', head: 'w-10', cell: '',
    // Plain text throughout: no chips, pills or tags -- the user asked for the boxes to go
    render: (row, index) => <span className="text-xs text-warm-muted">{index + 1}</span> };
  // The category says what kind of service this is, so it reads under the name rather than among
  // the details -- the same place the PDF sets it
  const service = { label: 'Service', head: '', cell: 'min-w-[140px]',
    render: row => <>
      <p className="font-medium text-gray-800 text-sm break-words">{decode(getAddonName(row))}</p>
      {row.category && <p className="text-[10px] text-gray-500">{decode(row.category)}</p>}
      {/* A package's own service, folded into the internal table beside the added services */}
      {showTag && row._tag && <p className="text-[10px] italic text-warm-muted">{row._tag}</p>}
    </> };
  // What the service covers, as entered on it -- its own description, not the generated pricing
  // segments (those are the Method and Input / Details columns), so nothing reads twice
  const description = { label: 'Description', head: '', cell: 'min-w-[160px] max-w-[260px]',
    render: row => {
      const text = decode(stripInternalServiceDetails(String(row.description ?? ''))).trim();
      return <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{text || '-'}</p>;
    } };
  const method = { label: 'Method', head: '', cell: '',
    // A hand-entered service has no configured method, so it says nothing rather than guessing one
    render: row => (getServiceMethodLabel(row)
      ? <span className="text-xs text-gray-700">{getServiceMethodLabel(row)}</span>
      : <span className="text-xs text-gray-400">-</span>) };
  const input = { label: 'Input / Details', head: '', cell: 'min-w-[110px]',
    // What was measured at the property -- 4 Lift, 15,000 Sq Ft. The subline is screen-only
    // (print:hidden keeps a browser print clean): a slab band names the bracket the input fell in
    // for everyone, while a ₹ rate is the vendor's price and shows to internal viewers only.
    render: row => {
      const sub = getServiceRate(row);
      // A package's capacity-slab service was set up by choosing a slab, not by entering a capacity:
      // its stored amount is only a point inside that slab, so the slab itself is what it states --
      // "0 - 3 KL", as the package form shows it
      if (row._tag === 'Package' && row.pricing_method === 'capacity_slab' && sub && !sub.includes('₹')) {
        return <p className="text-xs text-gray-700 break-words">{sub.replace(/^[^:]*:\s*/, '')}</p>;
      }
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
  // A package's own service is sold as part of the package, so its XLAND Cost and Margin % are read
  // against its share of the package price (`packageShare`, worked out on the server from the
  // package's rows and markup, and adding up to the package price). With no share or no vendor cost
  // on record there is nothing to work from, and it says so with a dash.
  const inPackage = row => row._tag === 'Package';
  const priced = row => (inPackage(row)
    ? (row.packageShare == null ? null : { ...row, price: row.packageShare, totalPrice: row.packageShare, marginPercentage: undefined })
    : row);
  const vendor = { label: 'Vendor Cost', head: 'text-right print:hidden', cell: 'text-right print:hidden',
    render: row => money(getServiceVendorCost(row)) };
  const xland = { label: 'XLAND Cost', head: 'text-right print:hidden', cell: 'text-right print:hidden',
    render: row => money(priced(row) ? getServiceXlandCost(priced(row)) : null) };
  // Customer Price, in the estimate view only -- the create screens, PDFs and emails list no
  // per-service price. A package's own service states its share of the package price (worked out
  // on the server; ₹0 for a service the package price does not cover). Never "Included": a figure,
  // or a dash where none is on record.
  const price = { label: 'Customer Price', head: 'text-center', cell: 'text-center',
    render: row => {
      const value = inPackage(row) ? row.packageShare : getAddonPrice(row);
      return value == null
        ? <p className="text-xs text-warm-muted">—</p>
        : <p className="whitespace-nowrap text-xs font-semibold text-gray-800">{formatCurrency(value)}</p>;
    } };
  const margin = { label: 'Margin %', head: 'text-center print:hidden', cell: 'text-center print:hidden',
    render: row => {
      if (!priced(row)) return <p className="text-xs text-warm-muted">—</p>;
      const value = getServiceMarginPercent(priced(row));
      return <p className={`text-xs font-semibold ${value != null && value < 0 ? 'text-red-600' : 'text-warm-accent-hover'}`}>{value != null ? `${Math.round(value)}%` : '—'}</p>;
    } };
  return internal
    // One order for every list of an estimate's services, here and in its PDFs and emails:
    // name, description, what was measured, how it is priced, schedule, then the internal costs
    ? [number, service, description, input, method, frequency, visits, vendor, xland, price, margin]
    : [number, service, description, input, method, frequency, visits, price];
};

// `totalLabel` names the footer figure; `showTag` is off where a table holds a package's services alone
export default function EstimateServicesTable({ rows, total, note = null, totalLabel = 'Total Services Price', showTag = true, decode = value => value ?? '',
  topRadius = 'rounded-t-lg', bottomRadius = 'rounded-b-lg', internal = false }) {
  const services = (Array.isArray(rows) ? rows : []).map(normalizeServiceRow);
  if (!services.length) return null;
  const sum = total ?? services.reduce((value, row) => value + getAddonPrice(row), 0);
  const columns = serviceColumns(decode, internal, showTag);
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
        {/* One figure for all the services, across the full width */}
        <tfoot className="bg-warm-section">
          <tr>
            <td colSpan={columns.length} className={cell}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-warm-text">{totalLabel}</span>
                <span className="whitespace-nowrap font-bold text-warm-text">{formatCurrency(sum)}</span>
              </div>
            </td>
          </tr>
          {/* A small line under the total, e.g. which AMC package it includes and at what price */}
          {note && (
            <tr>
              <td colSpan={columns.length} className="px-3 pb-2 pt-0 text-right text-[11px] text-warm-muted">{note}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
