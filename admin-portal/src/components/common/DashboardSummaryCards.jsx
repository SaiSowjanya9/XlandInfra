import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * The summary card row every dashboard opens with.
 *
 * Four dashboards had four designs for the same thing: the Payments row (white card, coloured left
 * edge, icon tile, label over a sublabel, the figure, "View All →"), the Estimates row (top border
 * over a white-to-tint gradient, the figure at text-2xl), the Work Orders row (a tinted card with
 * the icon opposite the label, wrapping onto a second line at narrow widths) and the Schedules row
 * (white with a plain grey border). The Payments card is the agreed design, so it lives here once
 * and the pages state only their figures.
 *
 * The compact `DashboardStatCards` is a different component on purpose: Manager and FP use a 64px
 * link-row that carries no sublabel and no action, and is not in scope for this row.
 *
 * A card is `{ key, label, sublabel, value, title, icon, color, linkText, to, onClick }`. `to`
 * renders a router link and `onClick` a button; a card with neither simply has no action.
 */

// Tailwind is scanned statically, so every accent is spelled out rather than built from a token.
const ACCENTS = {
  blue: { edge: 'border-l-blue-500', tile: 'bg-blue-100', icon: 'text-blue-600', link: 'text-blue-600 hover:text-blue-700' },
  green: { edge: 'border-l-green-500', tile: 'bg-green-100', icon: 'text-green-600', link: 'text-green-600 hover:text-green-700' },
  amber: { edge: 'border-l-amber-500', tile: 'bg-amber-100', icon: 'text-amber-600', link: 'text-amber-600 hover:text-amber-700' },
  red: { edge: 'border-l-red-500', tile: 'bg-red-100', icon: 'text-red-600', link: 'text-red-600 hover:text-red-700' },
  rose: { edge: 'border-l-rose-500', tile: 'bg-rose-100', icon: 'text-rose-600', link: 'text-rose-600 hover:text-rose-700' },
  purple: { edge: 'border-l-purple-500', tile: 'bg-purple-100', icon: 'text-purple-600', link: 'text-purple-600 hover:text-purple-700' },
  indigo: { edge: 'border-l-indigo-500', tile: 'bg-indigo-100', icon: 'text-indigo-600', link: 'text-indigo-600 hover:text-indigo-700' },
  pink: { edge: 'border-l-pink-500', tile: 'bg-pink-100', icon: 'text-pink-600', link: 'text-pink-600 hover:text-pink-700' },
  teal: { edge: 'border-l-teal-500', tile: 'bg-teal-100', icon: 'text-teal-600', link: 'text-teal-600 hover:text-teal-700' },
  orange: { edge: 'border-l-orange-500', tile: 'bg-orange-100', icon: 'text-orange-600', link: 'text-orange-600 hover:text-orange-700' },
  gray: { edge: 'border-l-gray-400', tile: 'bg-gray-100', icon: 'text-gray-600', link: 'text-gray-600 hover:text-gray-700' }
};

// Spelled out for the same reason. Beyond nine the row keeps wrapping rather than fitting a
// tenth column into a width where no label would survive.
const COLUMNS = {
  3: '2xl:grid-cols-3', 4: '2xl:grid-cols-4', 5: '2xl:grid-cols-5', 6: '2xl:grid-cols-6',
  7: '2xl:grid-cols-7', 8: '2xl:grid-cols-8', 9: '2xl:grid-cols-9'
};

/**
 * One row carries both kinds of figure -- a count like `13` and a total like `₹7,92,547` -- so the
 * figure is sized to its own length. A count set at the currency size looks lost in the card, and a
 * total set at the count size overflows it.
 */
const valueSize = value => {
  const length = String(value ?? '').length;
  if (length <= 4) return 'text-2xl';
  if (length <= 7) return 'text-lg';
  if (length <= 10) return 'text-base';
  return 'text-sm';
};

export default function DashboardSummaryCards({ cards = [], className = '' }) {
  const rows = cards.filter(Boolean);
  if (!rows.length) return null;
  const columns = COLUMNS[rows.length] || '';

  return (
    // Below 2xl the cards wrap to the screen -- two per row on a phone, four on a tablet -- and
    // grow to share their row, so a short last row stretches instead of leaving a lonely card.
    // At 2xl they are one row of equal columns.
    <div className={className}>
      <div className={`flex flex-wrap gap-3 ${columns ? `2xl:grid ${columns}` : ''}`}>
        {rows.map(({ key, label, sublabel, value, title, icon: Icon, color, linkText = 'View All', to, onClick }, index) => {
          const accent = ACCENTS[color] || ACCENTS.blue;
          const actionClass = `mt-1 flex items-center gap-1 text-[10px] font-medium sm:text-[11px] ${accent.link}`;
          const actionLabel = <>{linkText} <ArrowRight className="h-3 w-3" /></>;

          return (
            <div key={key ?? label ?? index}
              className={`flex min-h-[110px] min-w-0 flex-[1_1_10rem] flex-col rounded-xl border-l-4 bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:min-h-[125px] sm:p-4 ${accent.edge}`}>
              <div className="mb-auto flex items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${accent.tile}`}>
                  {Icon && <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${accent.icon}`} aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-gray-700 sm:text-xs" title={label}>{label}</span>
                  {sublabel && <span className="block truncate text-[9px] text-gray-400 sm:text-[10px]" title={sublabel}>{sublabel}</span>}
                </span>
              </div>
              <div className="mt-2">
                <p className={`truncate font-bold tabular-nums text-gray-900 ${valueSize(value)}`} title={title ?? undefined}>{value}</p>
                {linkText && to && <Link to={to} className={actionClass}>{actionLabel}</Link>}
                {linkText && !to && onClick && <button type="button" onClick={onClick} className={actionClass}>{actionLabel}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
