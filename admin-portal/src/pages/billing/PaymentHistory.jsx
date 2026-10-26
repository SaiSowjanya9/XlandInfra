import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History, Search, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Loader2,
  PlusCircle, RefreshCcw, RotateCcw, Trash2, Pencil, CreditCard, Inbox, Download, X
} from 'lucide-react';
import { useFP } from '../../contexts/FPContext';
import { getAuthToken } from '../../utils/safeStorage';
import PageHeader, { HEADER_GHOST_CLASS } from '../../components/common/PageHeader';
import DismissPanel from '../../components/common/DismissPanel';
import Modal from '../../components/common/Modal';
import {
  formatDate, formatDateTime, formatTime, maskTypedDate, parseTypedDate, toTypedDate, DATE_PLACEHOLDER
} from '../../utils/dateFormat';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Billing > Payment History -- the `payment_history` audit trail.
 *
 * This used to render the Payments screen. Both routes mounted the same component, the online/
 * offline tab that was meant to tell them apart had its online half switched off behind
 * `{false && ...}`, and the header was hard-coded to "Payments" -- so the two URLs produced
 * byte-identical pages and the only difference was a Razorpay request whose result was never
 * shown. The audit trail is the screen the name promises, and `GET /api/payments/history` was
 * already serving it with nothing on the other end.
 *
 * A row here is one *thing that happened* to a payment, not a payment: the same payment appears
 * as often as it moved. That is the point -- it answers "who marked this paid, and when", which
 * the Payments list cannot.
 */

// What each audited action looks like. `action` is free text on a current database
// (schema_v27 widened the column from an ENUM), so an unrecognised one still renders -- it is
// titled from its own value rather than dropped. See backend/utils/paymentHistoryAction.js.
const ACTIONS = {
  created: { label: 'Created', icon: PlusCircle, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  updated: { label: 'Updated', icon: Pencil, tone: 'bg-gray-50 text-gray-600 border-gray-200' },
  status_changed: { label: 'Status changed', icon: RefreshCcw, tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  razorpay_payment: { label: 'Razorpay payment', icon: CreditCard, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  refunded: { label: 'Refunded', icon: RotateCcw, tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  refund: { label: 'Refund', icon: RotateCcw, tone: 'bg-purple-50 text-purple-700 border-purple-200' },
  failed: { label: 'Failed', icon: RefreshCcw, tone: 'bg-red-50 text-red-700 border-red-200' },
  deleted: { label: 'Deleted', icon: Trash2, tone: 'bg-red-50 text-red-700 border-red-200' }
};

const titleCase = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/^./, (c) => c.toUpperCase());

const actionLook = (action) => ACTIONS[action] || {
  label: titleCase(action) || 'Activity',
  icon: History,
  tone: 'bg-gray-50 text-gray-600 border-gray-200'
};

// Two decimals, always: `maximumFractionDigits` alone rendered ₹99,189.90 as "₹99,189.9", which
// reads as a mis-keyed amount in a column of money.
const money = (value) => (
  value === null || value === undefined || value === ''
    ? '-'
    : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
);

// A status as it reads in a sentence: the column stores 'partially_paid', never 'Partially paid'.
const statusLabel = (value) => (value ? titleCase(value) : null);

// What a payment status means, at a glance. The transition is the whole point of an audit row, so
// it carries colour rather than sitting in the same grey as everything else. Keyed on the stored
// spelling, lower-cased -- an unknown status falls back to neutral rather than to no pill.
const STATUS_TONES = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  verification_pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200'
};

const statusTone = (value) => STATUS_TONES[String(value || '').toLowerCase().replace(/\s+/g, '_')]
  || 'bg-gray-100 text-gray-600 border-gray-200';

const StatusPill = ({ status, muted = false }) => (
  <span
    className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap ${
      muted ? 'bg-white text-gray-400 border-gray-200' : statusTone(status)
    }`}
  >
    {statusLabel(status)}
  </span>
);

/**
 * The state this row moved the payment to, and where it came from.
 *
 * `from → to` where they differ, the one pill where they do not: a status_changed row whose old and
 * new status are the same read "Paid → Paid", which says nothing twice.
 */
const StatusChange = ({ from, to }) => {
  if (!to && !from) return <span className="text-gray-300">-</span>;
  if (!to || from === to) return <StatusPill status={to || from} />;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {from && <StatusPill status={from} muted />}
      {from && <span className="text-gray-300">→</span>}
      <StatusPill status={to} />
    </span>
  );
};

const EventBadge = ({ action }) => {
  const look = actionLook(action);
  const Icon = look.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${look.tone}`}>
      <Icon className="w-3 h-3" />
      {look.label}
    </span>
  );
};

const PaymentHistory = ({ user, portalType = 'admin' }) => {
  const { fpList, selectedFp, selectFp } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  const isAdminPortal = portalType === 'admin' || portalType === 'employee';

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [typedStart, setTypedStart] = useState('');
  const [typedEnd, setTypedEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const token = getAuthToken();

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Only an admin narrows by partner; an FP's own token already scopes the route.
      if (isAdminPortal && selectedFp && selectedFp.id !== 'all') params.append('fpId', selectedFp.id);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const query = params.toString();
      const response = await fetch(`${API_BASE}/api/payments/history${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setHistory(result.data || []);
        setError(null);
      } else {
        setError(result.message || 'Failed to load payment history.');
      }
    } catch (err) {
      setError('Failed to load payment history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, isAdminPortal, selectedFp, dateRange]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // The payment code opens the receipt PDF itself -- the document the customer was emailed --
  // rather than a summary card. It needs the bearer token, so it is fetched as a blob.
  const openReceipt = async (row) => {
    if (!row.paymentId || receiptLoading) return;
    setReceiptLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/payments/${row.paymentId}/receipt/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to generate receipt');
      const blob = await response.blob();
      setReceipt({ code: row.receiptCode || row.paymentCode || row.paymentId, url: window.URL.createObjectURL(blob) });
    } catch (err) {
      setError('Could not load the receipt. Please try again.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const closeReceipt = useCallback(() => {
    setReceipt(current => {
      if (current) window.URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const downloadReceipt = () => {
    const a = document.createElement('a');
    a.href = receipt.url;
    a.download = `Receipt_${receipt.code}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // The actions actually present, so the filter never offers one that would empty the table.
  const actionOptions = useMemo(() => (
    [...new Set(history.map((row) => row.action).filter(Boolean))]
  ), [history]);

  // Text filtering is the browser's: the route answers one partner's own audit rows, and asking
  // the server again on every keystroke would be a request per character for no better answer.
  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return history.filter((row) => {
      if (actionFilter !== 'all' && row.action !== actionFilter) return false;
      if (!needle) return true;
      return [
        row.paymentCode, row.invoiceCode, row.customerName, row.propertyName,
        row.description, row.performedBy, row.razorpayPaymentId
      ].some((field) => String(field || '').toLowerCase().includes(needle));
    });
  }, [history, actionFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const visible = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const onTypedDate = (which) => (event) => {
    const masked = maskTypedDate(event.target.value);
    (which === 'start' ? setTypedStart : setTypedEnd)(masked);
    const parsed = parseTypedDate(masked);
    if (parsed || masked === '') {
      setDateRange((prev) => ({ ...prev, [which]: parsed || '' }));
      setCurrentPage(1);
    }
  };

  const hasFilters = searchTerm || actionFilter !== 'all' || dateRange.start || dateRange.end;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <PageHeader
          icon={History}
          title="Payment History"
          subtitle="Home › Billing & Payments › Payment History"
          className="mb-4"
        >
          <>
            {isAdminPortal && (
              <div className="relative">
                <button
                  onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {selectedFp && selectedFp.id !== 'all'
                      ? (selectedFp.fpId || selectedFp.fp_code || selectedFp.name)
                      : 'Admin (All FPs)'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                <DismissPanel open={fpDropdownOpen} onDismiss={() => setFpDropdownOpen(false)} className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-auto">
                  <button
                    onClick={() => { selectFp({ id: 'all', name: 'All Franchise Partners' }); setFpDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!selectedFp || selectedFp.id === 'all' ? 'bg-blue-50' : ''}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">Admin (All FPs)</p>
                    <p className="text-xs text-gray-500">Every partner's audit trail</p>
                  </button>
                  <div className="py-1">
                    {fpList.map((fp) => (
                      <button
                        key={fp.id}
                        onClick={() => { selectFp(fp); setFpDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedFp?.id === fp.id ? 'bg-blue-50' : ''}`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{fp.fpId || fp.fp_code}</p>
                        <p className="text-xs text-gray-500">{fp.companyName || fp.company_name || fp.name}</p>
                      </button>
                    ))}
                  </div>
                </DismissPanel>
              </div>
            )}
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Payment ID, Invoice, Customer, who did it..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button onClick={fetchHistory} className={HEADER_GHOST_CLASS} title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        </PageHeader>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Activity</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>{actionLook(action).label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
              <input
                type="text"
                placeholder={DATE_PLACEHOLDER}
                value={typedStart || toTypedDate(dateRange.start)}
                onChange={onTypedDate('start')}
                onBlur={() => setTypedStart('')}
                className="text-sm border-none focus:outline-none bg-transparent w-[85px]"
              />
              <span className="text-gray-400">-</span>
              <input
                type="text"
                placeholder={DATE_PLACEHOLDER}
                value={typedEnd || toTypedDate(dateRange.end)}
                onChange={onTypedDate('end')}
                onBlur={() => setTypedEnd('')}
                className="text-sm border-none focus:outline-none bg-transparent w-[85px]"
              />
            </div>

            {hasFilters && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActionFilter('all');
                  setDateRange({ start: '', end: '' });
                  setTypedStart('');
                  setTypedEnd('');
                  setCurrentPage(1);
                }}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <Inbox className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900">
                {hasFilters ? 'Nothing matches these filters' : 'No payment activity yet'}
              </p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                {hasFilters
                  ? 'Clear them to see the whole trail.'
                  : 'Every payment that is recorded, verified, refunded or paid online is logged here.'}
              </p>
            </div>
          ) : (
            <>
              {/* `table-fixed`, with a width on every column: the eight free-width columns this
                  replaced were pushed past the card by their own `whitespace-nowrap`, so the last
                  one -- who did it -- was cut off mid-word. Payment and Invoice share a cell
                  because they identify the same thing, which is what made room. */}
              <div className="hidden lg:block">
                <table className="w-full table-fixed">
                  {/* Sticky, because this is a log read by scrolling: the column a row's value
                      belongs to has to stay visible with it. */}
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="w-[108px] px-4 py-3">When</th>
                      <th className="w-[23%] px-4 py-3">Activity</th>
                      <th className="w-[160px] px-4 py-3">Payment</th>
                      <th className="w-[15%] px-4 py-3">Customer</th>
                      <th className="w-[19%] px-4 py-3">Change</th>
                      <th className="w-[124px] px-4 py-3 text-right">Amount</th>
                      <th className="w-[136px] px-4 py-3">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80 transition-colors align-top">
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 whitespace-nowrap">{formatDate(row.createdAt)}</p>
                          <p className="text-[11px] text-gray-400 whitespace-nowrap">{formatTime(row.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <EventBadge action={row.action} />
                          {/* The server's own sentence for what happened -- it names the verifier,
                              the rejection reason or the Razorpay method, which no column does.
                              Clamped, so one long reference cannot make a row three times the
                              height of its neighbours; the whole text is in the tooltip. */}
                          {row.description && (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2" title={row.description}>
                              {row.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.paymentId ? (
                            <button
                              onClick={() => openReceipt(row)}
                              disabled={receiptLoading}
                              className="text-left text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate disabled:opacity-50"
                              title="View receipt"
                            >
                              {row.paymentCode || '-'}
                            </button>
                          ) : (
                            <p className="text-sm font-medium text-gray-500 truncate" title={row.paymentCode || ''}>
                              {row.paymentCode || '-'}
                            </p>
                          )}
                          {row.receiptCode && (
                            <p className="text-[11px] text-gray-500">{row.receiptCode}</p>
                          )}
                          <p className="text-[11px] text-gray-400 truncate" title={row.invoiceCode || ''}>
                            {row.invoiceCode || '-'}
                          </p>
                          {row.razorpayPaymentId && (
                            <p className="text-[11px] text-gray-400 break-all">{row.razorpayPaymentId}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 truncate" title={row.customerName || ''}>
                            {row.customerName || '-'}
                          </p>
                          {row.propertyName && (
                            <p className="text-[11px] text-gray-400 truncate" title={row.propertyName}>{row.propertyName}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChange from={row.oldStatus} to={row.newStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                            {money(row.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 truncate" title={row.performedBy || ''}>
                            {row.performedBy || '-'}
                          </p>
                          {row.performedByRole && (
                            <p className="text-[11px] text-gray-400 truncate">{titleCase(row.performedByRole)}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Below `lg` the same rows read as cards. Seven columns in a horizontal scroller is
                  a table nobody can follow on a laptop, let alone a tablet. */}
              <ul className="lg:hidden divide-y divide-gray-100">
                {visible.map((row) => (
                  <li key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <EventBadge action={row.action} />
                      <span className="text-[11px] text-gray-400 whitespace-nowrap">{formatDateTime(row.createdAt)}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        {row.paymentId ? (
                          <button
                            onClick={() => openReceipt(row)}
                            disabled={receiptLoading}
                            className="text-sm font-medium text-blue-600 hover:underline truncate disabled:opacity-50"
                          >
                            {row.paymentCode || '-'}
                          </button>
                        ) : (
                          <p className="text-sm font-medium text-gray-500 truncate">{row.paymentCode || '-'}</p>
                        )}
                        <p className="text-xs text-gray-500 truncate">
                          {row.receiptCode ? `${row.receiptCode} · ` : ''}
                          {row.invoiceCode || '-'}
                          {row.customerName ? ` · ${row.customerName}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {money(row.amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusChange from={row.oldStatus} to={row.newStatus} />
                      <span className="text-[11px] text-gray-400">
                        by {row.performedBy || 'unknown'}
                        {row.performedByRole ? ` (${titleCase(row.performedByRole)})` : ''}
                      </span>
                    </div>
                    {row.description && (
                      <p className="mt-2 text-xs text-gray-500">{row.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between gap-4 flex-wrap px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="px-3 py-1.5 text-sm font-medium text-gray-700">{page} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
                <div className="relative">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* A click on a payment code opens its receipt here — a history row carries no Send
          action: this is an audit view, so download and close only. */}
      {receipt && (
        <Modal onClose={closeReceipt} className="max-w-3xl h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-border">
            <h3 className="text-sm font-semibold text-gray-900">Receipt {receipt.code}</h3>
            <div className="flex items-center gap-2">
              <button onClick={downloadReceipt} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" title="Download PDF">
                <Download className="w-4 h-4 text-gray-600" />
              </button>
              <button onClick={closeReceipt} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" title="Close">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
          <iframe src={receipt.url} title={`Receipt ${receipt.code}`} className="flex-1 w-full border-0" />
        </Modal>
      )}
    </div>
  );
};

export default PaymentHistory;
