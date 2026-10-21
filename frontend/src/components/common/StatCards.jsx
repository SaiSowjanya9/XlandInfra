/**
 * The customer portal's figures, as a compact strip that rides in the page header.
 *
 * These were full cards in a band of their own under the title: a 48px icon tile, a label and the
 * figure, four across, costing ~90px of height on every page — while the header row above them sat
 * half empty with nothing between the title and Refresh. The figures now sit in that space, one
 * line high, and the band is gone.
 *
 * A card is `{ key, label, value, icon, accent, title }`. `accent` is a **named** colour, never a
 * hex: Tailwind is scanned statically, so the icon and figure classes have to be spelled out, and a
 * hex passed here would render as no colour at all.
 *
 * The strip **scrolls** rather than wrapping where it does not fit, so it never pushes the page's
 * own content down — which is the whole point of moving it up here.
 */

const ACCENTS = {
  blue: { icon: 'text-blue-600', tile: 'bg-blue-50', value: 'text-gray-900' },
  gold: { icon: 'text-gold-600', tile: 'bg-gold-600/10', value: 'text-gold-600' },
  amber: { icon: 'text-amber-600', tile: 'bg-amber-50', value: 'text-amber-600' },
  green: { icon: 'text-green-600', tile: 'bg-green-50', value: 'text-green-600' },
  violet: { icon: 'text-violet-600', tile: 'bg-violet-50', value: 'text-violet-600' },
  red: { icon: 'text-red-600', tile: 'bg-red-50', value: 'text-red-600' },
  gray: { icon: 'text-gray-500', tile: 'bg-gray-100', value: 'text-gray-900' }
};

const StatCards = ({ cards = [], className = '' }) => {
  if (!cards.length) return null;

  return (
    <div className={`flex items-center gap-2 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>
      {cards.map(({ key, label, value, icon: Icon, accent = 'blue', title }) => {
        const tone = ACCENTS[accent] || ACCENTS.blue;
        return (
          <div
            key={key || label}
            className="shrink-0 flex items-center gap-2 bg-white border border-gold-600/20 rounded-lg pl-1.5 pr-3 py-1.5"
            title={title || `${label}: ${value}`}
          >
            {Icon && (
              <span className={`w-7 h-7 rounded-md flex items-center justify-center ${tone.tile}`}>
                <Icon className={`w-4 h-4 ${tone.icon}`} />
              </span>
            )}
            {/* Label over figure, both small: two short lines read faster here than one long one,
                and keep the strip to the height of the button beside it. */}
            <span className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wide text-gray-500 whitespace-nowrap">{label}</span>
              <span className={`block text-sm font-bold whitespace-nowrap ${tone.value}`}>{value}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default StatCards;
