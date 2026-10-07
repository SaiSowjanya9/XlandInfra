import { Archive, Circle, Database, Package, PlusCircle, RefreshCw } from 'lucide-react';

/**
 * The counts on an Estimates page header — Active Estimates, AMC Packages, Add Service, Archived.
 *
 * One component for every portal, because they had five different headers for the same four
 * figures: bare centred numbers in Manager, Coordinator, Supervisor and Executive, and three
 * tinted chips in FP. The design ("Variant 1") is a light cream card carrying a coloured icon
 * circle, so the colour identifies the figure and the card itself stays neutral against both the
 * warm page and the white ones.
 *
 * Sizes are the design's: 56px tall, 12px radius, a 32px icon circle, the count at 20px semibold
 * and the label at 14px medium. The cards are a fixed width so a row of them lines up, and the row
 * scrolls sideways rather than wrapping or pushing the title off the page on a narrow screen.
 */
const TONES = {
  // Lucide icon, the circle behind it, and its own colour
  active: { Icon: Circle, circle: 'bg-[#ECFDF5]', color: 'text-[#10B981]', filled: true },
  amc: { Icon: Package, circle: 'bg-[#FEF7E6]', color: 'text-[#D97706]' },
  services: { Icon: PlusCircle, circle: 'bg-[#FFF6E8]', color: 'text-[#D97706]' },
  archived: { Icon: Database, circle: 'bg-[#FFF6E8]', color: 'text-[#B45309]' },
  // Not used by the four standard cards; kept so a page with an archive-shaped count has a tone
  archive: { Icon: Archive, circle: 'bg-[#FFF6E8]', color: 'text-[#B45309]' }
};

export const EstimateStatCard = ({ tone, label, value }) => {
  const { Icon, circle, color, filled } = TONES[tone] || TONES.active;
  return (
    <div
      title={`${value} ${label}`}
      className={`shrink-0 flex items-center gap-3 w-[184px] h-14 px-4 py-3 rounded-xl border border-[#F1E3C6] bg-[#FFFAF0]
        transition-colors hover:border-warm-accent focus-within:border-warm-accent`}
    >
      <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${circle}`}>
        {/* The success dot is a filled circle rather than an outline, as the design draws it */}
        <Icon className={`w-[18px] h-[18px] ${color}`} {...(filled ? { fill: 'currentColor', strokeWidth: 0 } : {})} />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold leading-none text-[#111827]">{value}</span>
        <span className="block mt-1 text-sm font-medium text-[#6B7280] whitespace-nowrap">{label}</span>
      </span>
    </div>
  );
};

/**
 * The whole row, refresh button included, so every portal's header is assembled the same way.
 * A count passed as undefined is left out — Executive and FP do not list every one of them.
 */
const EstimateStatCards = ({ active, amc, services, archived, onRefresh, refreshing = false }) => (
  <div className="flex items-center gap-3 shrink-0 overflow-x-auto">
    {onRefresh && (
      <button onClick={onRefresh} title="Refresh"
        className="shrink-0 p-2.5 bg-white border border-[#F1E3C6] rounded-[10px] hover:bg-warm-accent-soft transition-colors">
        <RefreshCw className={`w-5 h-5 text-warm-accent ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    )}
    {[
      { tone: 'active', label: 'Active Estimates', value: active },
      { tone: 'amc', label: 'AMC Packages', value: amc },
      { tone: 'services', label: 'Add Service', value: services },
      { tone: 'archived', label: 'Archived', value: archived }
    ].filter(card => card.value !== undefined && card.value !== null)
      .map(card => <EstimateStatCard key={card.label} {...card} />)}
  </div>
);

export default EstimateStatCards;
