import { formatCurrency } from '../../utils/estimatePackageUtils';

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * The internal cost read-out, in the same shape everywhere it appears -- the AMC package form, the
 * create-estimate screens and the estimate view modals: Annual Vendor Cost, XLAND Cost, Customer
 * Price, Margin. Read left to right it is the arithmetic: vendor cost plus XLAND cost is the price.
 *
 * XLAND Cost is what XLAND makes on top of what it pays out (customer price less vendor and
 * operating cost), so it is derived and never entered. Screen only: every caller hides it from
 * print, and no PDF or email draws it.
 */
export default function EstimateProfitSummaryPanel({ vendorCost = 0, operatingCost = 0, customerPrice = 0, className = '' }) {
  const vendor = round2(vendorCost);
  const price = round2(customerPrice);
  const xlandCost = round2(price - vendor - round2(operatingCost));
  const margin = price ? round2(xlandCost / price * 100) : null;
  const cards = [
    ['Annual Vendor Cost', formatCurrency(vendor), 'text-gray-900'],
    ['XLAND Cost', formatCurrency(xlandCost), 'text-gray-900'],
    ['Customer Price', formatCurrency(price), 'text-gray-900'],
    ['Margin', margin == null ? '—' : `${margin}%`, xlandCost >= 0 ? 'text-emerald-600' : 'text-red-600']
  ];
  return (
    <div className={`print:hidden ${className}`}>
      <p className="text-gray-600 text-[11px] uppercase tracking-wider font-semibold">
        Internal <span className="font-normal normal-case tracking-normal text-gray-400">(not shown to customers)</span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([label, value, tone]) => (
          <div key={label} className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <dt className="truncate text-[11px] text-gray-500" title={label}>{label}</dt>
            <dd className={`mt-1 truncate text-sm font-bold tabular-nums ${tone}`} title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
