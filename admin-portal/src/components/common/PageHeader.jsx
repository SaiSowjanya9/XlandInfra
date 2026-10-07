import { FileText } from 'lucide-react';

/**
 * The header every section's page wears — Work Orders, Payments, Invoices, Schedules and the rest.
 *
 * Each section had grown its own: a white full-width band here, a bare `<h1>` there, a blue-to-
 * purple gradient tile on Work Orders, a plain card on Billing. The agreed design ("Elegant Gold
 * Accent") is one cream bar: a gold icon circle, the title and its line of context, the section's
 * counts behind a rule, and whatever that page acts with — a Create button, an FP switcher, a
 * search box — against the right edge.
 *
 * Measurements are the design's: 20px/16px padding, a 40px icon circle, the title at 24px
 * semibold, the subtitle at 14px, each stat's figure at 20px semibold over a 13px label, 24px
 * between stats.
 *
 * Colour is carried by the stat icons and the one gold action; everything else is the cream and
 * sand of the rest of the system. Gold `#B5812A` is the primary — it meets contrast with white
 * text, which the lighter tan `warm-accent` does not.
 */

// A stat's icon colour says what it is: gold for a plain count, green for done, amber for an
// end state, red for something overdue. A page passes the tone, never the hex.
export const STAT_TONES = {
  primary: { circle: 'bg-[#F6EBD1]', color: 'text-[#B5812A]' },
  success: { circle: 'bg-[#ECFDF5]', color: 'text-[#10B981]' },
  warning: { circle: 'bg-[#FEF3E2]', color: 'text-[#D97706]' },
  danger: { circle: 'bg-[#FEF2F2]', color: 'text-[#EF4444]' },
  info: { circle: 'bg-[#EEF4FF]', color: 'text-[#3B82F6]' }
};

// Gold, 40px tall, 10px radius — the one filled control on the page
export const HEADER_ACTION_CLASS = 'shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-[#B5812A] hover:bg-[#9C6E22] text-white text-sm font-semibold transition-colors disabled:opacity-50';

export const PageHeaderStat = ({ icon: Icon = FileText, tone = 'primary', label, value }) => {
  const { circle, color } = STAT_TONES[tone] || STAT_TONES.primary;
  return (
    <div className="shrink-0 flex items-center gap-3" title={`${value} ${label}`}>
      <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${circle}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </span>
      <span>
        <span className="block text-xl font-semibold leading-none text-[#111827]">{value}</span>
        <span className="block mt-1 text-[13px] text-[#6B7280] whitespace-nowrap">{label}</span>
      </span>
    </div>
  );
};

/**
 * `stats` are `{ icon, tone, label, value }`; a page passes only the counts it keeps, and none at
 * all is fine. `children` are the page's own controls, which keep whatever markup they already
 * had — this component owns the bar, not what a section does on it.
 */
const PageHeader = ({ icon: Icon = FileText, title, subtitle, stats = [], children = null, className = '' }) => (
  <div className={`bg-[#FFFAF0] border border-[#E8DFC9] rounded-xl px-5 py-4 ${className}`}>
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <span className="w-10 h-10 rounded-full bg-[#F6EBD1] flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#B5812A]" />
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-semibold leading-tight text-[#111827] truncate">{title}</span>
          {subtitle && <span className="block text-sm text-[#6B7280] truncate">{subtitle}</span>}
        </span>
      </div>

      {stats.length > 0 && (
        <>
          {/* The rule separates the page's name from its figures, as the design draws it */}
          <span className="shrink-0 self-stretch w-px bg-[#E8DFC9]" aria-hidden="true" />
          <div className="flex items-center gap-6 shrink-0 overflow-x-auto">
            {stats.map(stat => <PageHeaderStat key={stat.label} {...stat} />)}
          </div>
        </>
      )}

      {children && <div className="ml-auto flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  </div>
);

export default PageHeader;
