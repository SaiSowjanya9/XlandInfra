/**
 * The legend beside or beneath a chart.
 *
 * Every dashboard wrote its own, and every one of them truncated: "Ba..." for Bank Transfer,
 * "Verifi..." for Verification Pending, "Partially P..." for Partially Paid. A legend whose labels
 * are cut off is worse than no legend -- the reader cannot tell which slice is which -- so here a
 * label **wraps** rather than truncating, and its figure sits to the right on its own line, which
 * holds at any card width.
 *
 * Items are `{ label, value, color }`. `value` is already formatted by the caller, since one chart
 * counts and another totals money.
 */
export default function ChartLegend({ items = [], className = '', size = 'sm' }) {
  const rows = items.filter(Boolean);
  if (!rows.length) return null;
  const text = size === 'xs' ? 'text-[11px]' : 'text-xs sm:text-sm';
  return (
    <ul className={`w-full space-y-2 ${className}`}>
      {rows.map((item, index) => (
        // The row wraps as a whole: where the label and its figure will not share a line, the figure
        // drops to the next one and the label keeps the full width. Holding them on one line squeezed
        // the label into a column too narrow for its own words -- "Bank Transfer" came out as
        // "Ba / nk / Tra / nsf / er" -- so the label wraps between words and never inside one.
        <li key={item.key ?? item.label ?? index} className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ${text}`}>
          <span className="flex min-w-0 items-start gap-2">
            {/* Nudged down to sit on the first line of a label that wraps to two */}
            <span className="mt-[0.3em] h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="leading-snug text-gray-700" title={item.label}>{item.label}</span>
          </span>
          {item.value !== undefined && item.value !== null && item.value !== '' && (
            <span className="ml-auto whitespace-nowrap tabular-nums text-gray-500">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
