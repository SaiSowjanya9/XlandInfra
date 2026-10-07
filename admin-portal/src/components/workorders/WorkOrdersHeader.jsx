import { Link } from 'react-router-dom';
import { CheckCircle, ClipboardList, FileText, Lock, Plus } from 'lucide-react';

/**
 * The Work Orders page header — the agreed "Elegant Gold Accent" design, shared by every portal.
 *
 * Six pages had six headers for the same three things: a title, a few counts and a Create button.
 * They ranged from a blue-to-purple gradient tile to a bare `<h1>`, and the counts were sometimes
 * in the header, sometimes only in the tab bar. This is one inline row instead: the title block,
 * then the stats separated from it by a rule, then the primary action against the right edge.
 *
 * The design's measurements: 72px tall, 20px/16px padding, a 40px icon circle, the title at 24px
 * semibold, the subtitle at 14px, each stat's number at 20px semibold over a 13px label, 24px
 * between stats and 16px before the button, which is 40px tall with a 10px radius.
 *
 * Colour is carried by the stat icons and the one gold button; everything else is the cream and
 * sand of the rest of the system. Gold `#B5812A` is the primary (it meets contrast with white
 * text, which the lighter tan accent does not), `#10B981` reads as completed and `#D97706` as
 * closed.
 */
const STAT_TONES = {
  total: { Icon: FileText, circle: 'bg-[#F6EBD1]', color: 'text-[#B5812A]' },
  completed: { Icon: CheckCircle, circle: 'bg-[#ECFDF5]', color: 'text-[#10B981]' },
  closed: { Icon: Lock, circle: 'bg-[#FEF3E2]', color: 'text-[#D97706]' },
  pending: { Icon: ClipboardList, circle: 'bg-[#FEF3E2]', color: 'text-[#D97706]' }
};

// Gold, 40px tall, 10px radius — the one filled control on the page
const ACTION_CLASS = 'shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-[10px] bg-[#B5812A] hover:bg-[#9C6E22] text-white text-sm font-semibold transition-colors';

const WorkOrderStat = ({ tone, label, value }) => {
  const { Icon, circle, color } = STAT_TONES[tone] || STAT_TONES.total;
  return (
    <div className="shrink-0 flex items-center gap-3 px-1" title={`${value} ${label}`}>
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
 * `stats` are `{ tone, label, value }`; a page passes only the counts it actually keeps.
 * `action` is the primary button — `{ label, onClick }` or `{ label, to }` where the portal
 * navigates to a create page instead of switching a tab. Omit it where the role cannot create
 * one. `children` is anything a single portal needs in the same row, such as the admin page's
 * FP switcher.
 */
const WorkOrdersHeader = ({
  title = 'Work Orders',
  subtitle = 'Manage and track all work orders',
  stats = [],
  action = null,
  children = null
}) => (
  <div className="bg-[#FFFAF0] border border-[#E8DFC9] rounded-xl px-5 py-4">
    <div className="flex items-center gap-4 overflow-x-auto">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <span className="w-10 h-10 rounded-full bg-[#F6EBD1] flex items-center justify-center shrink-0">
          <ClipboardList className="w-5 h-5 text-[#B5812A]" />
        </span>
        <span className="min-w-0">
          <span className="block text-2xl font-semibold leading-tight text-[#111827] truncate">{title}</span>
          <span className="block text-sm text-[#6B7280] truncate">{subtitle}</span>
        </span>
      </div>

      {stats.length > 0 && (
        <>
          {/* The rule separates the page's name from its figures, as the design draws it */}
          <span className="shrink-0 self-stretch w-px bg-[#E8DFC9]" aria-hidden="true" />
          <div className="flex items-center gap-6 shrink-0">
            {stats.map(stat => <WorkOrderStat key={stat.label} {...stat} />)}
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-4 shrink-0">
        {children}
        {action && (action.to
          ? <Link to={action.to} className={ACTION_CLASS}><Plus className="w-4 h-4" />{action.label}</Link>
          : <button type="button" onClick={action.onClick} className={ACTION_CLASS}><Plus className="w-4 h-4" />{action.label}</button>
        )}
      </div>
    </div>
  </div>
);

export default WorkOrdersHeader;
