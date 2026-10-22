import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History, Search, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Loader2,
  PlusCircle, RefreshCcw, RotateCcw, Trash2, Pencil, CreditCard, Inbox
} from 'lucide-react';
import { useFP } from '../../contexts/FPContext';
import { getAuthToken } from '../../utils/safeStorage';
import PageHeader, { HEADER_GHOST_CLASS } from '../../components/common/PageHeader';
import DismissPanel from '../../components/common/DismissPanel';
import {
  formatDateTime, maskTypedDate, parseTypedDate, toTypedDate, DATE_PLACEHOLDER
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

const money = (value) => (
  value === null || value === undefined || value === ''
    ? '-'
    : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
);

// A status as it reads in a sentence: the column stores 'partially_paid', never 'Partially paid'.
const statusLabel = (value) => (value ? titleCase(value) : null);

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
                <DismissPanel open={fpDropdownOpen} onDismiss={() => setFpDropdownOpen(false)} className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-auto">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">When</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Activity</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Payment</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Invoice</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Change</th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Inbox className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {hasFilters ? 'Nothing matches these filters' : 'No payment activity yet'}
                        </p>
                        <p className="text-xs text-gray-500 max-w-sm">
                          {hasFilters
                            ? 'Clear them to see the whole trail.'
                            : 'Every payment that is recorded, verified, refunded or paid online is logged here.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => {
                    const look = actionLook(row.action);
                    const Icon = look.icon;
                    const from = statusLabel(row.oldStatus);
                    const to = statusLabel(row.newStatus);
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${look.tone}`}>
                            <Icon className="w-3 h-3" />
                            {look.label}
                          </span>
                          {/* The server's own sentence for what happened -- it names the verifier,
                              the rejection reason or the Razorpay method, which no column does. */}
                          {row.description && (
                            <p className="mt-1 text-xs text-gray-500 max-w-[260px]">{row.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                          {row.paymentCode || '-'}
                          {row.razorpayPaymentId && (
                            <span className="block text-[11px] font-normal text-gray-400">{row.razorpayPaymentId}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.invoiceCode || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.customerName || '-'}
                          {row.propertyName && (
                            <span className="block text-[11px] text-gray-400">{row.propertyName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {to
                            ? <>{from && <><span className="text-gray-400">{from}</span> <span className="text-gray-300">→</span> </>}<span className="font-medium text-gray-900">{to}</span></>
                            : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {money(row.amount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {row.performedBy || '-'}
                          {row.performedByRole && (
                            <span className="block text-[11px] text-gray-400 capitalize">
                              {titleCase(row.performedByRole)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
    </div>
  );
};

export default PaymentHistory;
