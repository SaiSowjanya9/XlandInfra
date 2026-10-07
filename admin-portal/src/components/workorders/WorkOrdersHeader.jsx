import { Link } from 'react-router-dom';
import { CheckCircle, ClipboardList, FileText, Lock, Plus } from 'lucide-react';
import PageHeader, { HEADER_ACTION_CLASS } from '../common/PageHeader';

/**
 * The Work Orders page header: the shared section header with this section's three counts and its
 * Create button. Six portals had six headers for the same thing; they all come through here now.
 *
 * The bar itself — the cream card, the gold icon circle, the rule before the stats, the sizes —
 * lives in components/common/PageHeader.jsx, which every other section uses too.
 */
const STAT_TONES = {
  total: { icon: FileText, tone: 'primary' },
  completed: { icon: CheckCircle, tone: 'success' },
  closed: { icon: Lock, tone: 'warning' },
  pending: { icon: ClipboardList, tone: 'warning' }
};

/**
 * `stats` are `{ tone, label, value }` where tone is one of the four above; a page passes only the
 * counts it keeps. `action` is the primary button — `{ label, onClick }` or `{ label, to }` where
 * the portal navigates to a create page rather than switching a tab — and is omitted where the
 * role cannot create one. `children` ride in the same row: that is where the admin page's FP
 * switcher sits.
 */
const WorkOrdersHeader = ({
  title = 'Work Orders',
  subtitle = 'Manage and track all work orders',
  stats = [],
  action = null,
  children = null
}) => (
  <PageHeader
    icon={ClipboardList}
    title={title}
    subtitle={subtitle}
    stats={stats.map(({ tone, label, value }) => ({ ...(STAT_TONES[tone] || STAT_TONES.total), label, value }))}
  >
    {children}
    {action && (action.to
      ? <Link to={action.to} className={HEADER_ACTION_CLASS}><Plus className="w-4 h-4" />{action.label}</Link>
      : <button type="button" onClick={action.onClick} className={HEADER_ACTION_CLASS}><Plus className="w-4 h-4" />{action.label}</button>
    )}
  </PageHeader>
);

export default WorkOrdersHeader;
