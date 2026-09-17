import { Link } from 'react-router-dom';

/**
 * Shared dashboard summary card row.
 * Cards keep an equal width and height in a single row and scroll horizontally
 * on narrow screens instead of wrapping or overflowing the page.
 */
export default function DashboardStatCards({ cards = [] }) {
  return <div className="-mx-1 overflow-x-auto px-1 py-1">
    <div className="grid min-w-full grid-flow-col auto-cols-[minmax(11rem,1fr)] gap-2">
      {cards.map(({ key, label, value, to, icon: Icon, iconBg, iconColor, accent, hoverBorder }) =>
        <Link key={key || label} to={to}
          className={`group flex h-16 min-w-0 items-center gap-2.5 rounded-lg border bg-white px-3 transition-all duration-200 hover:shadow-md ${accent ? 'border-orange-200 hover:border-orange-300' : `border-gray-100 ${hoverBorder || 'hover:border-gray-200'}`}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`flex items-center gap-1.5 text-xs font-medium ${accent ? 'text-orange-600' : 'text-gray-500'}`}>
              <span className="truncate" title={label}>{label}</span>
              {accent && <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>}
            </span>
            <span className={`block text-lg font-bold leading-tight ${accent ? 'text-orange-700' : 'text-gray-900'}`}>{value}</span>
          </span>
        </Link>
      )}
    </div>
  </div>;
}
