import { formatCurrency } from '../../utils/estimatePackageUtils';

/**
 * What the estimate cost XLAND and what it makes, under a heading that says so. Shown only on the
 * Admin, Ops Manager, FP and Manager screens; it must never reach a customer document, which is why
 * it lives in its own component and its own section rather than inside the services table.
 *
 * Every figure comes from estimateInternalCosts, i.e. from the pricing snapshots the server wrote,
 * so it reports what the estimate was costed at rather than what today's catalog would say.
 */
export default function EstimateInternalSummary({ costs, title = 'Internal Cost & Profit Summary' }) {
  if (!costs) return null;
  // Four figures: what the work costs, what the customer pays for it, and the margin between them.
  // Actual cost, selling price and gross profit were dropped as restatements of those.
  const figures = [
    ['Total Vendor Cost', formatCurrency(costs.vendorCost)],
    // The markup in rupees, the same figure the service form and the package form call XLAND Cost:
    // vendor cost plus this is the customer price. It showed `operatingCost`, a separate overhead
    // no configured service carries, so it sat at ₹0 beside a real margin.
    ['XLAND Cost', formatCurrency(costs.xlandCost)],
    ['Customer Price', formatCurrency(costs.sellingPrice)],
    ['Gross Margin %', costs.marginPercent == null ? '-' : `${costs.marginPercent}%`]
  ];
  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title} <span className="font-normal text-xs text-gray-400">(internal only)</span></p>
      <div className="overflow-x-auto">
        <div className="grid min-w-[32rem] grid-cols-4 divide-x divide-gray-200 rounded-lg border border-gray-200 bg-slate-50">
          {figures.map(([label, value], index) => (
            <div key={label} className="px-3 py-3 text-center">
              <p className="text-[11px] text-gray-500">{label}</p>
              {/* The margin is what the reader is looking for, so it is the one picked out -- in the
                  warm accent rather than green, and in red only when it has gone negative */}
              <p className={`mt-1 text-sm font-bold ${index === figures.length - 1 ? (costs.profit >= 0 ? 'text-warm-accent-hover' : 'text-red-600') : 'text-gray-800'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
