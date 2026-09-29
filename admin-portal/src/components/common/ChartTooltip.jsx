import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * The hover readout for the charts that are drawn by hand rather than by a chart library.
 *
 * A bar or a donut segment is a value, and a reader hovers it to be told which one. The Payments
 * dashboard had no hover at all -- its Collection Trend, aging buckets, customer bars and donuts
 * were shapes with no figures -- and the shared donut's own tooltip was drawn 60px above the chart,
 * which put it outside every card that clips its corners with `overflow-hidden`: the value was
 * "there" and invisible.
 *
 * So the card is rendered into `document.body` and positioned against the viewport. Nothing an
 * ancestor does -- clipping, stacking, a plot area that scrolls sideways -- can hide it.
 *
 *   const chart = useChartTooltip();
 *   <div {...chart.hover({ title: 'Aug 2026', rows: [{ label: 'Collected', value: '₹1,20,000', color: '#4ADE80' }] })} />
 *   {chart.node}
 *
 * `rows` are already formatted by the caller, since one chart counts and another totals money --
 * the same division of labour as `ChartLegend`.
 */
const TOOLTIP_HALF_WIDTH = 130;

// The same card for the charts recharts draws, which take their tooltip as a component:
//   <Tooltip content={<ChartTooltipContent valueLabel="Work orders" />} />
// Several pie charts -- Executive, Supervisor, Coordinator, Vendor and Customer -- had no <Tooltip>
// at all, so their segments answered nothing at all when pointed at.
//
// One series reads as the slice and its figure; several read as the period and a line each, so a
// cost, a price and a margin are compared where they happened rather than one at a time.
// `formatValue` is given the entry as well as the value, which is how a chart mixing money with a
// percentage formats each of its series correctly. `footer` may be a string or a function of the
// hovered datum.
export function ChartTooltipContent({ active, payload, label, valueLabel = 'Count', formatValue = value => `${value}`, footer }) {
  if (!active || !payload || !payload.length) return null;
  const single = payload.length === 1;
  const datum = payload[0].payload || {};
  const colorOf = entry => entry.color || entry.payload?.color || entry.payload?.fill || entry.fill;
  const heading = single ? (payload[0].name ?? label) : label;
  const rows = single && valueLabel && payload[0].name === undefined
    ? [{ label: valueLabel, value: formatValue(payload[0].value, payload[0]), color: colorOf(payload[0]) }]
    : payload.map(entry => ({
      label: single ? valueLabel : entry.name,
      value: formatValue(entry.value, entry),
      color: colorOf(entry)
    }));
  const note = typeof footer === 'function' ? footer(datum) : footer;
  return (
    <div className="w-max max-w-[15rem] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg">
      {heading && <p className="mb-1 text-xs font-semibold text-gray-900">{heading}</p>}
      <ul className="space-y-0.5">
        {rows.map((row, index) => (
          <li key={row.label ?? index} className="flex items-baseline gap-2 text-xs">
            <span className="mt-[0.3em] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="text-gray-600">{row.label}</span>
            <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900">{row.value}</span>
          </li>
        ))}
      </ul>
      {(note || datum.percentage !== undefined) && (
        <p className="mt-1 text-[11px] text-gray-500">{note ?? `${datum.percentage}% of total`}</p>
      )}
    </div>
  );
}

export default function useChartTooltip() {
  const [state, setState] = useState(null);

  const place = useCallback((event, content) => {
    // A pointer reports where it is; a hover entered any other way has only the element itself,
    // so the tooltip sits over the middle of it
    const box = event?.currentTarget?.getBoundingClientRect?.();
    const x = event?.clientX || (box ? box.left + box.width / 2 : 0);
    const y = event?.clientY || (box ? box.top : 0);
    setState({ ...content, x, y });
  }, []);

  const hide = useCallback(() => setState(null), []);

  // Nothing to say, no handlers: an empty bucket is not worth a card that reads "—"
  const hover = useCallback(content => (content ? {
    onMouseEnter: event => place(event, content),
    onMouseMove: event => place(event, content),
    onMouseLeave: hide
  } : {}), [place, hide]);

  // Above the cursor, unless the chart is near the top of the window -- then below it, so a bar in
  // the first row of the page is readable too
  const above = state ? state.y > 110 : true;
  const node = state && typeof document !== 'undefined' ? createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[9999] w-max max-w-[15rem] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
      style={{
        left: Math.min(Math.max(state.x, TOOLTIP_HALF_WIDTH), Math.max(window.innerWidth - TOOLTIP_HALF_WIDTH, TOOLTIP_HALF_WIDTH)),
        top: above ? state.y - 12 : state.y + 20,
        transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
      }}
    >
      {state.title && <p className="mb-1 text-xs font-semibold text-gray-900">{state.title}</p>}
      <ul className="space-y-0.5">
        {(state.rows || []).map((row, index) => (
          <li key={row.label ?? index} className="flex items-baseline gap-2 text-xs">
            {row.color && <span className="mt-[0.3em] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />}
            <span className="text-gray-600">{row.label}</span>
            <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900">{row.value}</span>
          </li>
        ))}
      </ul>
      {state.footer && <p className="mt-1 text-[11px] text-gray-500">{state.footer}</p>}
    </div>,
    document.body
  ) : null;

  return { hover, hide, node };
}
