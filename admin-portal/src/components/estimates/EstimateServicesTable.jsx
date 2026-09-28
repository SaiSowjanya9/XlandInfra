import { formatCurrency, getAddonName, getAddonPrice, getServiceInput, getServiceMethodLabel } from '../../utils/estimatePackageUtils';

/**
 * The services on a saved estimate, as every portal's view modal lists them: what the service is,
 * how it was priced, what was measured at the property, its schedule, and the customer's price.
 *
 * Vendor Cost, XLAND Cost and Margin are deliberately absent. They are internal to the service
 * configuration, and a view modal states what the customer was quoted, not what arranging it cost.
 * Markup is gone with them, for the same reason.
 *
 * Every portal shows the same columns, so this is one component rather than the seven near-identical
 * grids it replaces. The caller keeps its own heading and wrapper -- only the table is shared -- and
 * passes its own `decode` for HTML-encoded names.
 */
const HEAD = 'text-xs font-semibold text-green-700';

export default function EstimateServicesTable({ rows, total, decode = value => value ?? '',
  topRadius = 'rounded-t-lg', bottomRadius = 'rounded-b-lg' }) {
  const services = Array.isArray(rows) ? rows : [];
  if (!services.length) return null;
  const sum = total ?? services.reduce((value, row) => value + getAddonPrice(row), 0);
  return (
    <div>
      <div className={`grid grid-cols-12 gap-2 px-3 py-2 bg-green-100 ${topRadius}`}>
        <div className={`col-span-1 ${HEAD}`}>#</div>
        <div className={`col-span-3 ${HEAD}`}>Service</div>
        <div className={`col-span-2 ${HEAD}`}>Method</div>
        <div className={`col-span-2 ${HEAD}`}>Input / Details</div>
        <div className={`col-span-2 ${HEAD} text-center`}>Frequency</div>
        <div className={`col-span-1 ${HEAD} text-center`}>Visits / Year</div>
        <div className={`col-span-1 ${HEAD} text-right`}>Customer Price</div>
      </div>
      <div className="border border-green-100 divide-y divide-green-50">
        {services.map((row, index) => {
          const method = getServiceMethodLabel(row);
          const input = getServiceInput(row);
          return (
            <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-white">
              <div className="col-span-1">
                <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span>
              </div>
              <div className="col-span-3">
                <p className="font-medium text-gray-800 text-sm break-words">{decode(getAddonName(row))}</p>
              </div>
              <div className="col-span-2">
                {/* A hand-entered service has no configured method, so it says nothing rather than guessing one */}
                {method ? <span className="inline-block rounded bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">{method}</span> : <span className="text-xs text-gray-400">-</span>}
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-600 break-words">{input || '-'}</p>
              </div>
              <div className="col-span-2 text-center">
                <p className="text-sm text-green-600">{row.frequency_type || row.frequencyType || 'Monthly'}</p>
              </div>
              <div className="col-span-1 text-center">
                <p className="text-sm text-green-700 font-semibold">{row.frequency_count ?? row.frequencyCount ?? 1}</p>
              </div>
              <div className="col-span-1 text-right">
                <p className="text-xs text-gray-800 font-semibold">{formatCurrency(getAddonPrice(row))}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`flex justify-between items-center bg-green-100 p-3 ${bottomRadius}`}>
        <p className="font-semibold text-green-800">Total Services Price</p>
        <p className="font-bold text-green-700">{formatCurrency(sum)}</p>
      </div>
    </div>
  );
}
