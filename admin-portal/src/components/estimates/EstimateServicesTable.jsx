import { formatCurrency, getAddonName, getAddonPrice, getServiceInput, getServiceMarginPercent,
  getServiceMethodLabel, getServiceOperatingCost, getServiceRate, getServiceVendorCost } from '../../utils/estimatePackageUtils';

/**
 * The services on a saved estimate: what the service is, how it was priced, what was measured at
 * the property, its schedule, and the customer's price.
 *
 * `internal` adds Vendor Cost, XLAND Cost and Margin % beside those, and names the category under
 * the service. It is passed only by the screens allowed to see what arranging the work costs --
 * Admin, Ops Manager, FP and Manager -- and never by Coordinator, Supervisor or Executive, whose
 * tables state the customer's price alone. A hand-entered service has no vendor behind it, so its
 * cost cells read as a dash rather than zero: nothing was quoted for it.
 *
 * One component rather than a copy per screen. Both modes are described by the same column list, so
 * a column is defined once and the customer layout keeps the 12-column grid it has always used. The
 * caller keeps its own heading and wrapper, and passes its own `decode` for HTML-encoded names.
 */
// The table is drawn in the cream skin, not green: every filled block here -- the header, the row
// number, the method badge and the total -- is a warm tint, and figures read in warm text.
const money = value => (value == null ? '-' : formatCurrency(value));
// Internal mode carries three more columns than a 12-column grid holds legibly, so it sizes them
const INTERNAL_GRID = 'grid grid-cols-[2rem_minmax(9rem,2fr)_6.5rem_minmax(6rem,1fr)_6.5rem_3.5rem_6.5rem_6.5rem_6.5rem_4rem]';

const serviceColumns = (internal, decode) => {
  const number = { label: '#', head: 'col-span-1', cell: 'col-span-1',
    render: (row, index) => <span className="w-5 h-5 bg-warm-accent-soft border border-warm-border text-warm-text text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span> };
  const service = { label: 'Service', head: 'col-span-3', cell: 'col-span-3 min-w-0',
    render: row => <>
      <p className="font-medium text-gray-800 text-sm break-words">{decode(getAddonName(row))}</p>
      {internal && row.category && <p className="text-[10px] text-gray-500">{decode(row.category)}</p>}
    </> };
  const method = { label: 'Method', head: 'col-span-2', cell: 'col-span-2',
    // A hand-entered service has no configured method, so it says nothing rather than guessing one
    render: row => (getServiceMethodLabel(row)
      ? <span className="inline-block rounded bg-warm-accent-soft px-2 py-0.5 text-[10px] font-semibold text-warm-text">{getServiceMethodLabel(row)}</span>
      : <span className="text-xs text-gray-400">-</span>) };
  const input = { label: 'Input / Details', head: 'col-span-2', cell: 'col-span-2 min-w-0',
    // Two lines internally: what was measured, and the rate it was priced at. The rate is a vendor
    // figure, so the customer-safe table states the measured amount alone.
    render: row => <>
      <p className="text-xs text-gray-700 break-words">{getServiceInput(row) || '-'}</p>
      {internal && getServiceRate(row) && <p className="text-[10px] text-gray-500 break-words">{getServiceRate(row)}</p>}
    </> };
  const frequency = { label: 'Frequency', head: 'col-span-2 text-center', cell: 'col-span-2 text-center',
    render: row => <p className="text-sm text-warm-text">{row.frequency_type || row.frequencyType || 'Monthly'}</p> };
  const visits = { label: 'Visits / Year', head: 'col-span-1 text-center', cell: 'col-span-1 text-center',
    render: row => <p className="text-sm text-warm-text font-semibold">{row.frequency_count ?? row.frequencyCount ?? 1}</p> };
  const price = { label: 'Customer Price', head: 'col-span-1 text-right', cell: 'col-span-1 text-right',
    render: row => <p className="text-xs text-gray-800 font-semibold">{formatCurrency(getAddonPrice(row))}</p> };
  if (!internal) return [number, service, method, input, frequency, visits, price];
  const plain = column => ({ ...column, head: column.head.replace(/col-span-\d+ ?/, ''), cell: column.cell.replace(/col-span-\d+ ?/, '') });
  return [number, service, method, input, frequency, visits,
    { label: 'Vendor Cost (₹)', head: 'text-right', cell: 'text-right',
      render: row => <p className="text-xs text-gray-700">{money(getServiceVendorCost(row))}</p> },
    { label: 'XLAND Cost (₹)', head: 'text-right', cell: 'text-right',
      render: row => <p className="text-xs text-gray-700">{money(getServiceOperatingCost(row))}</p> },
    price,
    { label: 'Margin %', head: 'text-right', cell: 'text-right',
      render: row => <p className="text-xs font-semibold text-warm-accent-hover">{getServiceMarginPercent(row) == null ? '-' : `${getServiceMarginPercent(row)}%`}</p> }
  ].map(plain);
};

export default function EstimateServicesTable({ rows, total, decode = value => value ?? '',
  internal = false, topRadius = 'rounded-t-lg', bottomRadius = 'rounded-b-lg' }) {
  const services = Array.isArray(rows) ? rows : [];
  if (!services.length) return null;
  const sum = total ?? services.reduce((value, row) => value + getAddonPrice(row), 0);
  const columns = serviceColumns(internal, decode);
  const grid = internal ? INTERNAL_GRID : 'grid grid-cols-12';
  return (
    <div className={internal ? 'overflow-x-auto' : undefined}>
      <div className={internal ? 'min-w-[62rem]' : undefined}>
        <div className={`${grid} gap-2 px-3 py-2 bg-warm-section ${topRadius}`}>
          {columns.map(column => <div key={column.label} className={`text-xs font-semibold text-warm-muted ${column.head}`}>{column.label}</div>)}
        </div>
        <div className="border border-warm-border divide-y divide-warm-border/60">
          {services.map((row, index) => (
            <div key={index} className={`${grid} gap-2 px-3 py-2 items-center bg-white`}>
              {columns.map(column => <div key={column.label} className={column.cell}>{column.render(row, index)}</div>)}
            </div>
          ))}
        </div>
        <div className={`flex justify-between items-center bg-warm-section p-3 ${bottomRadius}`}>
          <p className="font-semibold text-warm-text">Total Services Price</p>
          <p className="font-bold text-warm-text">{formatCurrency(sum)}</p>
        </div>
      </div>
    </div>
  );
}
