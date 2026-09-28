import { findCapacitySlab } from './AddServicePage';

/**
 * Every slab of a Capacity Slab service, wherever one is being priced or read.
 *
 * A Capacity Slab service is the one method whose price is not a rate but a table: the capacity
 * decides which band applies. Showing only the matching band -- or nothing at all, as the pricing
 * dialogs did -- leaves the reader unable to see what the next band costs or where the boundaries
 * fall, which is exactly what they need before typing a capacity.
 *
 * `capacity` marks the slab in force, so the table doubles as the answer to "which one did I get?".
 * `internal` adds the vendor rate; a customer-facing caller leaves it off and states the customer
 * price alone. A slab flagged `isCustomQuote` says so instead of showing a price it does not have.
 */
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const slabRangeLabel = (slab, unit) =>
  `${slab.capacityFrom}${slab.capacityTo == null || slab.capacityTo === '' ? ' and above' : `–${slab.capacityTo}`}${unit ? ` ${unit}` : ''}`;

export default function CapacitySlabList({ service, capacity, internal = false, className = '', title = 'Capacity slabs' }) {
  const slabs = Array.isArray(service?.capacity_slabs) ? service.capacity_slabs : [];
  if (service?.pricing_method !== 'capacity_slab' || !slabs.length) return null;
  const inForce = findCapacitySlab(slabs, capacity);
  const markup = Number(service.default_markup_percentage || 0) / 100;

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${className}`}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title} <span className="font-normal normal-case tracking-normal text-slate-400">({slabs.length})</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-[11px]">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-semibold">Slab{service.unit ? ` (${service.unit})` : ''}</th>
              {internal && <th className="py-1 pr-3 text-right font-semibold">Vendor / Visit</th>}
              <th className="py-1 pr-3 text-right font-semibold">Price / Visit</th>
              <th className="py-1 pr-3 font-semibold">Frequency</th>
              <th className="py-1 text-center font-semibold">Visits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {slabs.map((slab, index) => {
              const rate = Number(slab.vendorRate);
              const applies = inForce && slab === inForce;
              return (
                <tr key={index} className={applies ? 'bg-white font-semibold text-slate-900' : 'text-slate-700'}>
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {/* A slab named by hand is called that, with its range beside it; an unnamed one
                        is its range, as before */}
                    {String(slab.name || '').trim()
                      ? <>{slab.name} <span className="font-normal text-slate-400">{slabRangeLabel(slab, '')}</span></>
                      : slabRangeLabel(slab, '')}
                    {/* The band the typed capacity lands in, so the price above is traceable */}
                    {applies && <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">applies</span>}
                  </td>
                  {slab.isCustomQuote
                    ? <td className="py-1 pr-3 text-amber-700" colSpan={internal ? 2 : 1}>Custom quote required</td>
                    : <>
                      {internal && <td className="py-1 pr-3 text-right tabular-nums">{money(rate)}</td>}
                      <td className="py-1 pr-3 text-right tabular-nums">{money(rate * (1 + markup))}</td>
                    </>}
                  <td className="py-1 pr-3 whitespace-nowrap">{slab.defaultFrequency ?? service.default_frequency}</td>
                  <td className="py-1 text-center tabular-nums">{slab.defaultVisitsPerYear ?? service.default_visits_per_year}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
