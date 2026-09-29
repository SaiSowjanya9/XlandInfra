import { formatCurrency, getAddonName, getAddonPrice, getServiceInput,
  getServiceMethodLabel } from '../../utils/estimatePackageUtils';

/**
 * The services on a saved estimate: what the service is, how it was priced, what was measured at
 * the property, its schedule, and the customer's price.
 *
 * **The customer's price is the only money in it.** Vendor Cost, XLAND Cost, Margin % and the rate
 * a service was priced at were once shown here to Admin, Ops Manager, FP and Manager; they are
 * gone, in every portal, so that the table on screen is the table in the PDF the customer reads.
 * What the work costs XLAND is answered by the payments dashboard's Cost & Margin panel, which is
 * gated on `canViewEstimateMargins` and computed server-side.
 *
 * One component rather than a copy per screen: every screen that lists an estimate's services uses
 * it. The caller keeps its own heading and wrapper, and passes its own `decode` for HTML-encoded
 * names.
 */
// The table is drawn in the cream skin, not green: every filled block here -- the header, the row
// number, the method badge and the total -- is a warm tint, and figures read in warm text.

const serviceColumns = (decode) => {
  const number = { label: '#', head: 'col-span-1', cell: 'col-span-1',
    render: (row, index) => <span className="w-5 h-5 bg-warm-accent-soft border border-warm-border text-warm-text text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span> };
  // The category says what kind of service this is, so it reads under the name rather than among
  // the details -- the same place the PDF sets it
  const service = { label: 'Service', head: 'col-span-3', cell: 'col-span-3 min-w-0',
    render: row => <>
      <p className="font-medium text-gray-800 text-sm break-words">{decode(getAddonName(row))}</p>
      {row.category && <p className="text-[10px] text-gray-500">{decode(row.category)}</p>}
    </> };
  const method = { label: 'Method', head: 'col-span-2', cell: 'col-span-2',
    // A hand-entered service has no configured method, so it says nothing rather than guessing one
    render: row => (getServiceMethodLabel(row)
      ? <span className="inline-block rounded bg-warm-accent-soft px-2 py-0.5 text-[10px] font-semibold text-warm-text">{getServiceMethodLabel(row)}</span>
      : <span className="text-xs text-gray-400">-</span>) };
  const input = { label: 'Input / Details', head: 'col-span-2', cell: 'col-span-2 min-w-0',
    // What was measured at the property -- 4 Lift, 15,000 Sq Ft -- and never the rate beside it:
    // a rate is what the vendor is paid.
    render: row => <p className="text-xs text-gray-700 break-words">{getServiceInput(row) || '-'}</p> };
  const frequency = { label: 'Frequency', head: 'col-span-2 text-center', cell: 'col-span-2 text-center',
    render: row => <p className="text-sm text-warm-text">{row.frequency_type || row.frequencyType || 'Monthly'}</p> };
  const visits = { label: 'Visits / Year', head: 'col-span-1 text-center', cell: 'col-span-1 text-center',
    render: row => <p className="text-sm text-warm-text font-semibold">{row.frequency_count ?? row.frequencyCount ?? 1}</p> };
  const price = { label: 'Customer Price', head: 'col-span-1 text-right', cell: 'col-span-1 text-right',
    render: row => <p className="text-xs text-gray-800 font-semibold">{formatCurrency(getAddonPrice(row))}</p> };
  return [number, service, method, input, frequency, visits, price];
};

export default function EstimateServicesTable({ rows, total, decode = value => value ?? '',
  topRadius = 'rounded-t-lg', bottomRadius = 'rounded-b-lg' }) {
  const services = Array.isArray(rows) ? rows : [];
  if (!services.length) return null;
  const sum = total ?? services.reduce((value, row) => value + getAddonPrice(row), 0);
  const columns = serviceColumns(decode);
  return (
    <div>
      <div className={`grid grid-cols-12 gap-2 px-3 py-2 bg-warm-section ${topRadius}`}>
        {columns.map(column => <div key={column.label} className={`text-xs font-semibold text-warm-muted ${column.head}`}>{column.label}</div>)}
      </div>
      <div className="border border-warm-border divide-y divide-warm-border/60">
        {services.map((row, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
            {columns.map(column => <div key={column.label} className={column.cell}>{column.render(row, index)}</div>)}
          </div>
        ))}
      </div>
      <div className={`flex justify-between items-center bg-warm-section p-3 ${bottomRadius}`}>
        <p className="font-semibold text-warm-text">Total Services Price</p>
        <p className="font-bold text-warm-text">{formatCurrency(sum)}</p>
      </div>
    </div>
  );
}
