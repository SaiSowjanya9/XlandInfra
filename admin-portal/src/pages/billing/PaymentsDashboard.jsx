import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  XCircle,
  ArrowRight,
  Plus,
  Calendar,
  ChevronDown,
  RefreshCw,
  Info,
  Building2,
  Smartphone,
  CreditCard,
  Banknote,
  Wallet,
  Users,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getAuthToken } from '../../utils/safeStorage';
import ChartLegend from '../../components/common/ChartLegend';
import useChartTooltip, { ChartTooltipContent } from '../../components/common/ChartTooltip';
import { collectionTrendBuckets } from '../../utils/collectionTrend';
import { estimateMarginChartRows, estimateMarginSummary, estimatesInRange } from '../../utils/estimateMarginTrend';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import { useFP } from '../../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Format date to IST (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date)) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse IST date (dd/mm/yyyy) to yyyy-mm-dd
const parseISTDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.replace(/[^\d/]/g, '').split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle IST date input with auto-formatting
const handleISTDateInput = (value, maxLength = 10) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength);
  return cleaned;
};

// Format currency in INR
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

const formatCurrencyShort = (amount) => {
  const num = parseFloat(amount) || 0;
  return '₹' + new Intl.NumberFormat('en-IN').format(num);
};

// For an axis tick or a label sitting over a bar, where ₹1,50,300 is wider than the bar itself and
// runs into whatever is beside it. One decimal keeps ₹42.3K distinct from ₹42.8K; the exact figure
// is a hover and a summary card away.
const formatCurrencyCompact = (amount) => {
  const num = parseFloat(amount) || 0;
  const scale = Math.abs(num);
  const trim = value => `${Number(value.toFixed(1))}`;
  if (scale >= 1e7) return `₹${trim(num / 1e7)}Cr`;
  if (scale >= 1e5) return `₹${trim(num / 1e5)}L`;
  if (scale >= 1000) return `₹${trim(num / 1000)}K`;
  return `₹${Math.round(num)}`;
};

// The margin chart mixes money with a percentage, so each series is formatted as what it is
const marginTrendValue = (value, entry) => (entry?.dataKey === 'marginPercent'
  ? (value == null ? '—' : `${value}%`)
  : formatCurrency(value));

// An estimate id is long enough to overlap its neighbour, so the axis keeps its tail -- which is
// what distinguishes one from another -- and names the property underneath it, as a reader
// recognises an estimate by the property before the number.
const shortEstimateId = (id = '') => (id.length > 13 ? `${id.slice(0, 4)}…${id.slice(-5)}` : id);

/**
 * The margin's own label.
 *
 * A bar's figure is always drawn above the bar, and the line's dot for the same estimate sits at
 * whatever height the percentage puts it -- which, for the middle bar of the group, is repeatedly
 * the same place. So the label is drawn **below** the dot rather than above it: under a dot at 28%
 * is the body of a bar, not another number, and under a dot at 100% is empty plot rather than the
 * legend. Only a margin low enough for "below" to mean the axis itself is drawn above instead.
 *
 * The chip carries its own background, so where it does cross a bar it is still read as a figure.
 */
const MarginLabel = ({ x, y, value }) => {
  if (value == null || x == null || y == null) return null;
  const text = `${value}%`;
  const width = text.length * 6.2 + 12;
  const below = Number(value) >= 12;
  return (
    <g transform={`translate(${x}, ${y + (below ? 18 : -16)})`}>
      <rect x={-width / 2} y={-9} width={width} height={18} rx={9} fill="#EEF2FF" stroke="#C7D2FE" />
      <text textAnchor="middle" dy={4} fontSize={10} fontWeight={600} fill="#4F6BED">{text}</text>
    </g>
  );
};

// The legend is the panel's own, above the plot, not recharts'. Its `payload` and `height` props
// were ignored here: the legend kept the order the shapes happen to be painted in -- Customer
// Price first, Margin % in the middle of the costs -- and floated over the plot, where a 100%
// margin point ran straight through it. Ours states the series in the order the reader meets them.
const MARGIN_CHART_SERIES = [
  { label: 'Vendor Cost', color: '#A5B4FC' },
  { label: 'XLAND Cost', color: '#FCD34D' },
  { label: 'Customer Price', color: '#6EE7B7' },
  { label: 'Margin %', color: '#4F6BED', line: true }
];
const EstimateAxisTick = ({ x, y, payload, rows = [] }) => {
  const row = rows[payload?.index] || {};
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{`${row.estimateId || ''}${row.property ? ` · ${row.property}` : ''}`}</title>
      <text textAnchor="middle" dy={14} fontSize={11} fontWeight={600} fill="#334155">{shortEstimateId(row.estimateId || '')}</text>
      {row.property && <text textAnchor="middle" dy={29} fontSize={10} fill="#94A3B8">
        {row.property.length > 18 ? `${row.property.slice(0, 17)}…` : row.property}
      </text>}
    </g>
  );
};

// Donut Chart Component. Hovering a segment names it and states its figure: the legend beside the
// chart lists every slice, but which arc is which is only answerable by pointing at one.
const DonutSegments = ({ data, total, size, valueLabel, formatValue }) => {
  const chart = useChartTooltip();
  const strokeWidth = size > 140 ? 24 : 20;
  const radius = size / 2 - strokeWidth / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const strokeLength = (percentage / 100) * circumference;
          const offset = currentOffset;
          currentOffset += strokeLength;

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dasharray 0.3s ease', cursor: item.value > 0 ? 'pointer' : 'default' }}
              {...chart.hover(item.value > 0 ? {
                title: item.label,
                rows: [{ label: valueLabel, value: formatValue(item.value), color: item.color }],
                footer: `${percentage.toFixed(1)}% of total`
              } : null)}
            />
          );
        })}
      </svg>
      {chart.node}
    </>
  );
};

const DonutChart = ({ data, total, centerLabel, size = 130 }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    <DonutSegments data={data} total={total} size={size} valueLabel="Amount" formatValue={formatCurrencyShort} />
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-sm sm:text-base font-bold text-gray-900 tabular-nums">{formatCurrencyShort(total)}</span>
      <span className="text-[10px] sm:text-xs text-gray-500">{centerLabel}</span>
    </div>
  </div>
);

// Simple Donut for Invoice Status (with count instead of currency)
const DonutChartCount = ({ data, total, size = 130 }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    <DonutSegments data={data} total={total} size={size} valueLabel="Invoices" formatValue={value => `${value}`} />
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums">{total}</span>
      <span className="text-[10px] sm:text-xs text-gray-500">Total</span>
    </div>
  </div>
);

const PaymentsDashboard = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // Default to last 365 days for comprehensive data view
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1); // Go back 1 year
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  });
  const [dashboardData, setDashboardData] = useState({
    totalInvoiceAmount: 0,
    amountCollected: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    todaysCollections: 0,
    todaysPaymentCount: 0,
    failedPayments: 0,
    failedCount: 0,
    paymentsByMode: [],
    paymentsByStatus: [],
    invoicesByStatus: [],
    outstandingByAging: [],
    topCustomers: []
  });
  // What the live property-based estimates cost and make. Null until it loads, so the panel appears
  // with its figures rather than as a row of zeroes.
  const [estimateMargins, setEstimateMargins] = useState(null);
  // The timeline the cost & margin trend is drawn over; blank ends mean all of it
  const [marginRange, setMarginRange] = useState({ from: '', to: '' });
  // The invoices and payments the Collection Trend is drawn from, and the range it is drawn over.
  // "All Time" is the dropdown's own default, and now means it.
  const [trendSource, setTrendSource] = useState({ invoices: [], payments: [] });
  const [trendRange, setTrendRange] = useState('all');
  // Vendor cost and margin belong to Admin, the Operations Manager and a Franchise Partner alone --
  // a Manager, Supervisor or Executive sees this dashboard without them. The server refuses them
  // too, so this hides a panel they could not fill rather than being the only thing stopping them.
  const canSeeEstimateMargins = ['admin', 'operations_manager', 'franchise_partner']
    .includes(user?.role);
  
  // FP Context
  const { fpList, selectedFp, selectFp, loading: fpLoading } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);

  const token = getAuthToken();

  // Buckets by day over a short range and by month over a long one, so a year of activity is 12
  // bars rather than 365. Every bucket in the range is emitted, including empty ones, so a gap in
  // collections reads as a gap rather than as missing data.
  // Bucketed by the range the dropdown asks for -- by day over a month or less, by month beyond
  // that. Tested in utils/collectionTrend.test.js, date-only parsing included.
  const collectionTrend = useMemo(() => collectionTrendBuckets(trendSource, trendRange), [trendSource, trendRange]);

  // The calendar over the estimate margin trend. Empty means every active property-based estimate;
  // the range only narrows what the server already scoped, so nothing else can enter the panel.
  const marginRows = useMemo(() => estimatesInRange(estimateMargins?.estimates || [], marginRange),
    [estimateMargins, marginRange]);
  const marginSummary = useMemo(() => estimateMarginSummary(marginRows), [marginRows]);
  // One column group per estimate, oldest first. Every estimate in the range is plotted, including
  // one with no cost behind it: a price with no margin is worth seeing.
  const marginChart = useMemo(() => estimateMarginChartRows(marginRows), [marginRows]);

  // Hover readouts, one per chart card: a bar or a slice is a figure, and pointing at it is how the
  // reader is told which. Declared here so they run before the loading return, as hooks must.
  const trendChart = useChartTooltip();
  const agingChart = useChartTooltip();
  const customerChart = useChartTooltip();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query params with optional FP filter
      const params = new URLSearchParams();
      if (selectedFp && selectedFp.id !== 'all') {
        params.append('fpId', selectedFp.id);
      }
      const queryString = params.toString();
      
      // Fetch ALL payments data (no date filter for dashboard overview).
      // The list lives at /api/payments/payments - /api/payments has no handler and 404s,
      // which silently left every payment figure on this dashboard at zero.
      const paymentsRes = await fetch(`${API_BASE}/api/payments/payments${queryString ? '?' + queryString : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!paymentsRes.ok) {
        console.error('[Payments Dashboard] Payments request failed:', paymentsRes.status);
      }
      const paymentsResult = await paymentsRes.json().catch(() => ({}));
      const allPayments = paymentsResult.success ? (paymentsResult.data || []) : (Array.isArray(paymentsResult) ? paymentsResult : []);

      // What the active property-based estimates cost XLAND. Aggregated server-side from the pricing
      // snapshot saved with each service, so the browser is not sent every estimate to add up. Not
      // requested at all by a role that may not see it.
      if (canSeeEstimateMargins) {
        fetch(`${API_BASE}/api/payments/property-estimate-margins${queryString ? '?' + queryString : ''}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(response => response.json())
          .then(result => setEstimateMargins(result.success ? result.data : null))
          .catch(error => console.error('[Payments Dashboard] Estimate margins request failed:', error));
      }

      // Fetch ALL invoices data
      const invoicesRes = await fetch(`${API_BASE}/api/payments/invoices${queryString ? '?' + queryString : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const invoicesResult = await invoicesRes.json();
      const invoices = invoicesResult.success ? (invoicesResult.data || []) : (Array.isArray(invoicesResult) ? invoicesResult : []);

      // Calculate stats using ALL payments (not filtered by date)
      const today = new Date().toISOString().split('T')[0];
      
      // Filter for active invoices only (exclude cancelled, void, draft)
      const activeInvoices = invoices.filter(inv => {
        const status = (inv.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'void' && status !== 'draft';
      });
      
      // Filter for active payments only (exclude failed, refunded, cancelled)
      const activePayments = allPayments.filter(p => {
        const status = (p.status || '').toLowerCase();
        return status !== 'failed' && status !== 'refunded' && status !== 'cancelled';
      });
      
      // Total Invoice Amount - only from active invoices
      const totalInvoiceAmount = activeInvoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount || inv.total_amount) || 0), 0);
      
      // Amount Collected (paid payments) - from active payments only
      const allPaidPayments = activePayments.filter(p => p.status === 'paid' || p.status === 'verified');
      const amountCollected = allPaidPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      // Pending Amount (unpaid active invoices)
      const pendingInvoices = activeInvoices.filter(inv => {
        const payStatus = inv.paymentStatus || inv.payment_status || inv.status;
        return payStatus !== 'paid';
      });
      const pendingAmount = pendingInvoices.reduce((sum, inv) => {
        return sum + (parseFloat(inv.balanceAmount || inv.balance_amount) || parseFloat(inv.totalAmount || inv.total_amount) || 0);
      }, 0);
      
      // Overdue Amount - from active invoices only
      const overdueInvoices = activeInvoices.filter(inv => {
        const payStatus = inv.paymentStatus || inv.payment_status || inv.status;
        if (payStatus === 'paid') return false;
        const dueDate = new Date(inv.dueDate || inv.due_date);
        return dueDate < new Date();
      });
      const overdueAmount = overdueInvoices.reduce((sum, inv) => {
        return sum + (parseFloat(inv.balanceAmount || inv.balance_amount) || parseFloat(inv.totalAmount || inv.total_amount) || 0);
      }, 0);
      
      // Today's Collections - from active payments only
      const todaysPayments = activePayments.filter(p => {
        const paymentDate = new Date(p.paymentDate || p.payment_date || p.created_at).toISOString().split('T')[0];
        return paymentDate === today && (p.status === 'paid' || p.status === 'verified');
      });
      const todaysCollections = todaysPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      // Failed Payments - keep for reference but show 0 if no failures
      const failedPaymentsList = allPayments.filter(p => p.status === 'failed');
      const failedPayments = failedPaymentsList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      // Payments by Mode - from ALL paid payments
      const modeMap = {
        upi: { label: 'UPI', color: '#10B981' },
        bank_transfer: { label: 'Bank Transfer', color: '#3B82F6' },
        razorpay: { label: 'Razorpay Link', color: '#8B5CF6' },
        debit_credit_card: { label: 'Card / POS', color: '#F59E0B' },
        cash: { label: 'Cash', color: '#6B7280' },
        check: { label: 'Cheque', color: '#14B8A6' },
        cheque: { label: 'Cheque', color: '#14B8A6' }
      };
      
      const paymentsByModeMap = {};
      allPaidPayments.forEach(p => {
        const method = p.paymentMethod || p.payment_method || 'other';
        if (!paymentsByModeMap[method]) {
          paymentsByModeMap[method] = 0;
        }
        paymentsByModeMap[method] += parseFloat(p.amount) || 0;
      });
      
      const paymentsByMode = Object.entries(paymentsByModeMap).map(([key, value]) => ({
        label: modeMap[key]?.label || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        color: modeMap[key]?.color || '#9CA3AF',
        percentage: amountCollected > 0 ? ((value / amountCollected) * 100).toFixed(1) : 0
      })).sort((a, b) => b.value - a.value);

      // Payments by Status - from active payments only (exclude failed, refunded, cancelled)
      const statusColors = {
        paid: '#10B981',
        verified: '#10B981',
        partially_paid: '#F59E0B',
        verification_pending: '#F97316',
        pending: '#3B82F6'
      };
      
      const paymentsByStatusMap = {};
      activePayments.forEach(p => {
        const status = p.status || 'pending';
        if (!paymentsByStatusMap[status]) {
          paymentsByStatusMap[status] = 0;
        }
        paymentsByStatusMap[status] += parseFloat(p.amount) || 0;
      });
      
      const totalPaymentsAmount = activePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const paymentsByStatus = Object.entries(paymentsByStatusMap).map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        color: statusColors[key] || '#9CA3AF',
        percentage: totalPaymentsAmount > 0 ? ((value / totalPaymentsAmount) * 100).toFixed(1) : 0
      }));

      // Invoices by Payment Status (count based) - using activeInvoices already defined above
      const invoiceStatusColors = {
        paid: '#10B981',
        partially_paid: '#F59E0B',
        unpaid: '#3B82F6',
        overdue: '#EF4444'
      };
      
      // Helper to get payment status
      const getPaymentStatus = (inv) => inv.paymentStatus || inv.payment_status || '';
      
      const paidInvoices = activeInvoices.filter(inv => 
        getPaymentStatus(inv) === 'paid' || inv.status === 'paid'
      ).length;
      const partiallyPaidInvoices = activeInvoices.filter(inv => 
        getPaymentStatus(inv) === 'partially_paid' || inv.status === 'partially_paid'
      ).length;
      // Check if invoice is overdue by due date
      const overdueInvoicesCount = activeInvoices.filter(inv => {
        const payStatus = getPaymentStatus(inv);
        if (payStatus === 'paid' || inv.status === 'paid') return false;
        const dueDate = new Date(inv.dueDate || inv.due_date);
        return dueDate < new Date() || inv.status === 'overdue';
      }).length;
      // Unpaid = all active invoices that are not paid, partially_paid, or overdue
      const unpaidInvoices = activeInvoices.filter(inv => {
        const payStatus = getPaymentStatus(inv);
        const status = inv.status;
        const isPaid = payStatus === 'paid' || status === 'paid';
        const isPartial = payStatus === 'partially_paid' || status === 'partially_paid';
        const dueDate = new Date(inv.dueDate || inv.due_date);
        const isOverdue = dueDate < new Date() || status === 'overdue';
        return !isPaid && !isPartial && !isOverdue;
      }).length;
      
      const totalInvoices = activeInvoices.length;
      const invoicesByStatus = [
        { label: 'Paid', value: paidInvoices, color: invoiceStatusColors.paid, percentage: totalInvoices > 0 ? ((paidInvoices / totalInvoices) * 100).toFixed(1) : 0 },
        { label: 'Partially Paid', value: partiallyPaidInvoices, color: invoiceStatusColors.partially_paid, percentage: totalInvoices > 0 ? ((partiallyPaidInvoices / totalInvoices) * 100).toFixed(1) : 0 },
        { label: 'Unpaid', value: unpaidInvoices, color: invoiceStatusColors.unpaid, percentage: totalInvoices > 0 ? ((unpaidInvoices / totalInvoices) * 100).toFixed(1) : 0 },
        { label: 'Overdue', value: overdueInvoicesCount, color: invoiceStatusColors.overdue, percentage: totalInvoices > 0 ? ((overdueInvoicesCount / totalInvoices) * 100).toFixed(1) : 0 }
      ];

      // Outstanding by Aging
      const now = new Date();
      const agingBuckets = [
        { label: '0 - 30 Days', min: 0, max: 30, amount: 0, color: '#10B981' },
        { label: '31 - 60 Days', min: 31, max: 60, amount: 0, color: '#3B82F6' },
        { label: '61 - 90 Days', min: 61, max: 90, amount: 0, color: '#F59E0B' },
        { label: '91 - 120 Days', min: 91, max: 120, amount: 0, color: '#F97316' },
        { label: '> 120 Days', min: 121, max: Infinity, amount: 0, color: '#EF4444' }
      ];
      
      pendingInvoices.forEach(inv => {
        const dueDate = new Date(inv.dueDate || inv.due_date);
        const daysPastDue = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
        const amount = parseFloat(inv.balanceAmount || inv.balance_amount) || parseFloat(inv.totalAmount || inv.total_amount) || 0;
        
        for (const bucket of agingBuckets) {
          if (daysPastDue >= bucket.min && daysPastDue <= bucket.max) {
            bucket.amount += amount;
            break;
          }
        }
      });

      // The trend is built from these two lists by the range the chart's own dropdown asks for, so
      // it is kept rather than reduced here: a fixed 30-day window showed nothing at all whenever
      // the invoices were older than that.
      setTrendSource({
        invoices: activeInvoices.map(inv => ({
          date: inv.invoiceDate || inv.invoice_date || inv.created_at,
          amount: parseFloat(inv.totalAmount || inv.total_amount) || 0
        })),
        payments: allPaidPayments.map(p => ({
          date: p.paymentDate || p.payment_date || p.created_at,
          amount: parseFloat(p.amount) || 0
        }))
      });

      // Top 5 Customers by Collection - from paid payments only
      const customerCollections = {};
      allPaidPayments.forEach(p => {
        const customer = p.customerName || p.customer_name || p.propertyName || p.property_name || 'Unknown';
        if (customer && customer !== 'Unknown') {
          if (!customerCollections[customer]) {
            customerCollections[customer] = 0;
          }
          customerCollections[customer] += parseFloat(p.amount) || 0;
        }
      });
      
      const topCustomers = Object.entries(customerCollections)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setDashboardData({
        totalInvoiceAmount,
        amountCollected,
        collectedPercentage: totalInvoiceAmount > 0 ? ((amountCollected / totalInvoiceAmount) * 100).toFixed(1) : 0,
        pendingAmount,
        pendingPercentage: totalInvoiceAmount > 0 ? ((pendingAmount / totalInvoiceAmount) * 100).toFixed(1) : 0,
        overdueAmount,
        overduePercentage: totalInvoiceAmount > 0 ? ((overdueAmount / totalInvoiceAmount) * 100).toFixed(1) : 0,
        todaysCollections,
        todaysPaymentCount: todaysPayments.length,
        failedPayments,
        failedCount: failedPaymentsList.length,
        paymentsByMode,
        paymentsByStatus,
        invoicesByStatus,
        outstandingByAging: agingBuckets,
        topCustomers,
        totalInvoices
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedFp, canSeeEstimateMargins]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDateRange = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return `${start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const basePath = portalType === 'employee' || portalType === 'admin' ? '/employee' : `/${portalType}`;

  const navigateToPaymentsList = (filter = '') => {
    navigate(`${basePath}/billing/payments${filter ? `?status=${filter}` : ''}`);
  };

  const maxTrendValue = Math.max(
    ...collectionTrend.map(d => Math.max(d.invoiceAmount, d.collectedAmount)),
    1
  );

  const maxAgingValue = Math.max(...dashboardData.outstandingByAging.map(b => b.amount), 1);
  const maxCustomerValue = Math.max(...dashboardData.topCustomers.map(c => c.amount), 1);
  // What a hovered bar is a share of. The donuts have their own total already.
  const agingTotal = dashboardData.outstandingByAging.reduce((sum, bucket) => sum + (Number(bucket.amount) || 0), 0);
  const customerCollectedTotal = dashboardData.topCustomers.reduce((sum, customer) => sum + (Number(customer.amount) || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-page flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-page">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Payments Dashboard</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {selectedFp ? `Viewing payments for ${selectedFp.name}` : 'Overview of all payments and collections'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* FP Selector */}
            <div className="relative">
              <button
                onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-sm font-medium text-gray-700">
                  {selectedFp ? (selectedFp.id === 'all' ? 'Admin (All FPs)' : selectedFp.fpId || selectedFp.fp_code || selectedFp.name) : 'Admin (All FPs)'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {fpDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-auto">
                  {/* Admin (All FPs) Option */}
                  <button
                    onClick={() => { selectFp({ id: 'all', name: 'All Franchise Partners' }); setFpDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!selectedFp || selectedFp.id === 'all' ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Admin (All FPs)</p>
                        <p className="text-xs text-gray-500">View aggregated data</p>
                      </div>
                    </div>
                  </button>
                  {/* FP List */}
                  <div className="py-1">
                    {fpList.map(fp => (
                      <button
                        key={fp.id}
                        onClick={() => { selectFp(fp); setFpDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedFp?.id === fp.id ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{fp.fpId || fp.fp_code}</p>
                            <p className="text-xs text-gray-500">{fp.companyName || fp.company_name || fp.name}</p>
                          </div>
                          <span className="text-xs text-gray-400">{fp.ownerName || fp.owner_name || ''}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DateRangeFilter
              startDate={dateRange.start}
              endDate={dateRange.end}
              onDateChange={(start, end) => setDateRange({ start, end })}
              onRefresh={fetchDashboardData}
              showRefreshButton={false}
            />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Stats Cards - Responsive grid with consistent heights */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4 sm:mb-6">
          {/* Total Invoice Amount */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-l-4 border-l-blue-500 shadow-sm flex flex-col min-h-[110px] sm:min-h-[125px]">
            <div className="flex items-center gap-2 mb-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-700 block truncate">Total Invoice</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">Amount</span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums truncate" title={formatCurrencyShort(dashboardData.totalInvoiceAmount)}>{formatCurrency(dashboardData.totalInvoiceAmount)}</p>
              <button onClick={() => navigate(`${basePath}/billing/invoices`)} className="flex items-center gap-1 text-[10px] sm:text-[11px] text-blue-600 hover:text-blue-700 font-medium mt-1">
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Amount Collected */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-l-4 border-l-green-500 shadow-sm flex flex-col min-h-[110px] sm:min-h-[125px]">
            <div className="flex items-center gap-2 mb-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-700 block truncate">Collected</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">{dashboardData.collectedPercentage}%</span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums truncate" title={formatCurrencyShort(dashboardData.amountCollected)}>{formatCurrency(dashboardData.amountCollected)}</p>
              <button onClick={() => navigateToPaymentsList('paid')} className="flex items-center gap-1 text-[10px] sm:text-[11px] text-green-600 hover:text-green-700 font-medium mt-1">
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Pending Amount */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-l-4 border-l-amber-500 shadow-sm flex flex-col min-h-[110px] sm:min-h-[125px]">
            <div className="flex items-center gap-2 mb-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-700 block truncate">Pending</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">{dashboardData.pendingPercentage}%</span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums truncate" title={formatCurrencyShort(dashboardData.pendingAmount)}>{formatCurrency(dashboardData.pendingAmount)}</p>
              <button onClick={() => navigateToPaymentsList('verification_pending')} className="flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-600 hover:text-amber-700 font-medium mt-1">
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Overdue Amount */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-l-4 border-l-red-500 shadow-sm flex flex-col min-h-[110px] sm:min-h-[125px]">
            <div className="flex items-center gap-2 mb-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-700 block truncate">Overdue</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">{dashboardData.overduePercentage}%</span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums truncate" title={formatCurrencyShort(dashboardData.overdueAmount)}>{formatCurrency(dashboardData.overdueAmount)}</p>
              <button onClick={() => navigate(`${basePath}/billing/invoices?status=overdue`)} className="flex items-center gap-1 text-[10px] sm:text-[11px] text-red-600 hover:text-red-700 font-medium mt-1">
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Today's Collections */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-l-4 border-l-purple-500 shadow-sm flex flex-col min-h-[110px] sm:min-h-[125px]">
            <div className="flex items-center gap-2 mb-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-700 block truncate">Today's</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">{dashboardData.todaysPaymentCount} Payments</span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums truncate" title={formatCurrencyShort(dashboardData.todaysCollections)}>{formatCurrency(dashboardData.todaysCollections)}</p>
              <button onClick={() => navigateToPaymentsList('paid')} className="flex items-center gap-1 text-[10px] sm:text-[11px] text-purple-600 hover:text-purple-700 font-medium mt-1">
                View <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Failed Payments */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-l-4 border-l-rose-500 shadow-sm flex flex-col min-h-[110px] sm:min-h-[125px]">
            <div className="flex items-center gap-2 mb-auto">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-700 block truncate">Failed</span>
                <span className="text-[9px] sm:text-[10px] text-gray-400">{dashboardData.failedCount} Transactions</span>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm sm:text-base font-bold text-gray-900 tabular-nums truncate" title={formatCurrencyShort(dashboardData.failedPayments)}>{formatCurrency(dashboardData.failedPayments)}</p>
              <button onClick={() => navigateToPaymentsList('failed')} className="flex items-center gap-1 text-[10px] sm:text-[11px] text-rose-600 hover:text-rose-700 font-medium mt-1">
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Charts Row 1 - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Collection Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Collection Trend</h3>
                <Info className="w-4 h-4 text-gray-400 hidden sm:block" />
              </div>
              <div className="relative">
                <select aria-label="Collection trend range" value={trendRange} onChange={event => setTrendRange(event.target.value)}
                  className="appearance-none text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-lg pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-3 sm:mb-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Invoice Amount</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 bg-green-500 rounded"></div>
                <span className="text-gray-600">Collected Amount</span>
              </div>
            </div>
            <div className="h-36 sm:h-40 flex items-end gap-0.5 sm:gap-1 overflow-x-auto">
              {/* Hovering the column, not one bar, so both figures for that date are read
                  together -- and an empty bucket still answers, with zeroes */}
              {collectionTrend.map((day, idx) => (
                <div key={idx} className="flex-1 min-w-[16px] flex flex-col items-center gap-1 cursor-pointer"
                  {...trendChart.hover({ title: day.label, rows: [
                    { label: 'Invoice Amount', value: formatCurrencyShort(day.invoiceAmount), color: '#BFDBFE' },
                    { label: 'Collected Amount', value: formatCurrencyShort(day.collectedAmount), color: '#4ADE80' }
                  ] })}>
                  <div className="w-full flex gap-0.5 items-end h-28 sm:h-32">
                    <div 
                      className="flex-1 bg-blue-200 rounded-t"
                      style={{ height: `${(day.invoiceAmount / maxTrendValue) * 100}%`, minHeight: day.invoiceAmount > 0 ? '4px' : '0' }}
                    ></div>
                    <div 
                      className="flex-1 bg-green-400 rounded-t"
                      style={{ height: `${(day.collectedAmount / maxTrendValue) * 100}%`, minHeight: day.collectedAmount > 0 ? '4px' : '0' }}
                    ></div>
                  </div>
                  {/* The hover card names the bucket now, so the axis label keeps no `title` of
                      its own -- two tooltips for one bar read as a glitch */}
                  <span className="text-[7px] sm:text-[8px] text-gray-400 truncate w-full text-center">{day.label.split(' ')[0]}</span>
                </div>
              ))}
              {/* A range with nothing in it says so, rather than drawing an empty frame that reads
                  as a broken chart */}
              {!collectionTrend.some(day => day.invoiceAmount > 0 || day.collectedAmount > 0) && (
                <p className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  No invoices or collections in this range
                </p>
              )}
            </div>
            {trendChart.node}
          </div>

          {/* Payments by Mode */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Payments by Mode</h3>
              <div className="relative">
                <select className="appearance-none text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-lg pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center gap-4 xl:gap-5">
              <div className="flex-shrink-0">
                <DonutChart 
                  data={dashboardData.paymentsByMode}
                  total={dashboardData.amountCollected}
                  centerLabel="Total"
                  size={130}
                />
              </div>
              <ChartLegend className="xl:w-44" items={dashboardData.paymentsByMode.slice(0, 5).map(item => ({ label: item.label, color: item.color, value: formatCurrencyShort(item.value) + ` (${item.percentage}%)` }))} />
            </div>
          </div>

          {/* Payments by Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Payments by Status</h3>
              <div className="relative">
                <select className="appearance-none text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-lg pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center gap-4 xl:gap-5">
              <div className="flex-shrink-0">
                <DonutChart 
                  data={dashboardData.paymentsByStatus}
                  total={dashboardData.paymentsByStatus.reduce((sum, s) => sum + s.value, 0)}
                  centerLabel="Total"
                  size={130}
                />
              </div>
              <ChartLegend className="xl:w-44" items={dashboardData.paymentsByStatus.map(item => ({ label: item.label, color: item.color, value: formatCurrencyShort(item.value) + ` (${item.percentage}%)` }))} />
            </div>
          </div>
        </div>

        {/* Charts Row 2 - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Outstanding by Aging */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Outstanding by Aging</h3>
              <Info className="w-4 h-4 text-gray-400 hidden sm:block" />
            </div>
            <div className="space-y-3">
              {dashboardData.outstandingByAging.map((bucket, idx) => (
                <div key={idx} className="cursor-pointer" {...agingChart.hover({
                  title: bucket.label,
                  rows: [{ label: 'Outstanding', value: formatCurrency(bucket.amount), color: bucket.color }],
                  footer: agingTotal > 0 ? `${((bucket.amount / agingTotal) * 100).toFixed(1)}% of outstanding` : undefined
                })}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{bucket.label}</span>
                    <span className="text-xs font-medium text-gray-900">{formatCurrencyShort(bucket.amount)}</span>
                  </div>
                  <div className="h-5 sm:h-6 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className="h-full rounded-lg transition-all"
                      style={{ 
                        width: `${(bucket.amount / maxAgingValue) * 100}%`,
                        backgroundColor: bucket.color,
                        minWidth: bucket.amount > 0 ? '8px' : '0'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            {agingChart.node}
          </div>

          {/* Top 5 Customers by Collection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Top 5 Customers</h3>
              <div className="relative">
                <select className="appearance-none text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-lg pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-3">
              {dashboardData.topCustomers.length > 0 ? dashboardData.topCustomers.map((customer, idx) => (
                <div key={idx} className="cursor-pointer" {...customerChart.hover({
                  title: customer.name,
                  rows: [{ label: 'Collected', value: formatCurrency(customer.amount), color: '#22C55E' }],
                  footer: customerCollectedTotal > 0 ? `${((customer.amount / customerCollectedTotal) * 100).toFixed(1)}% of the top 5` : undefined
                })}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-xs sm:text-sm text-gray-700 truncate flex-1 min-w-0">{customer.name}</span>
                    <span className="text-xs sm:text-sm font-medium text-gray-900 flex-shrink-0">{formatCurrencyShort(customer.amount)}</span>
                  </div>
                  <div className="h-3 sm:h-4 bg-gray-100 rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded transition-all"
                      style={{ width: `${(customer.amount / maxCustomerValue) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-4">No data available</p>
              )}
            </div>
            {customerChart.node}
          </div>

          {/* Invoices by Payment Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Invoices by Status</h3>
              <div className="relative">
                <select className="appearance-none text-xs sm:text-sm text-gray-700 border border-gray-200 rounded-lg pl-2 sm:pl-3 pr-6 sm:pr-8 py-1 sm:py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center gap-4 xl:gap-5">
              <div className="flex-shrink-0">
                <DonutChartCount 
                  data={dashboardData.invoicesByStatus}
                  total={dashboardData.totalInvoices || 0}
                  size={130}
                />
              </div>
              <ChartLegend className="xl:w-44" items={dashboardData.invoicesByStatus.map(item => ({ label: item.label, color: item.color, value: `${item.value} (${item.percentage}%)` }))} />
            </div>
          </div>
        </div>

        {/* What the live property-based estimates cost XLAND and what they make. Internal: vendor
            cost and margin belong to this screen and never to a customer document. */}
        {canSeeEstimateMargins && estimateMargins && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mt-4 sm:mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  Property-Based Estimates — Cost &amp; Margin
                  <span className="ml-2 text-xs font-normal text-gray-400">internal only</span>
                </h3>
                <p className="text-xs text-gray-500">Cost vs. customer price by estimate, with margin %</p>
              </div>
              {/* The calendar narrows the trend to a timeline. It filters the estimates the server
                  already decided are active and property-based -- nothing else enters this panel. */}
              <DateRangeFilter
                startDate={marginRange.from}
                endDate={marginRange.to}
                onDateChange={(from, to) => setMarginRange({ from, to })}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {marginSummary.estimateCount === 0
                ? 'No active property-based estimates in this range'
                : `${marginSummary.estimateCount} active ${marginSummary.estimateCount === 1 ? 'estimate' : 'estimates'} raised in this range`}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Vendor Cost', formatCurrency(marginSummary.vendorCost), 'text-gray-900'],
                // The markup in rupees -- ₹4,000 of vendor cost at 30% earns ₹1,200 -- not the
                // `operating_cost` field, which is a separate overhead no property-based estimate
                // carries and which had this card reading ₹0 beside a margin of 28%
                ['XLAND Cost', formatCurrency(marginSummary.xlandCost), 'text-gray-900'],
                ['Customer Price', formatCurrency(marginSummary.customerPrice), 'text-gray-900'],
                ['Margin %', marginSummary.marginPercent == null ? '—' : `${marginSummary.marginPercent}%`,
                  marginSummary.profit >= 0 ? 'text-emerald-600' : 'text-red-600']
              ].map(([label, value, tone]) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] text-gray-500">{label}</p>
                  <p className={`mt-1 text-sm sm:text-base font-bold tabular-nums truncate ${tone}`} title={value}>{value}</p>
                </div>
              ))}
            </div>

            {/* One group of bars per estimate, oldest first: what the vendor charges, what XLAND
                makes on top of it and what the customer pays, side by side, with the margin those
                come to as a line across them on its own axis -- a percentage beside figures in
                lakhs would otherwise lie flat on the floor. Each bar states its own figure, so the
                chart is read without hovering. Total Actual Cost is deliberately absent: with no
                operating cost it is the vendor cost again under another name.
                The plot scrolls sideways rather than squeezing, since a group needs room for three
                labelled bars; the card clips nothing, so the hover card is never cut off. */}
            {marginChart.length > 0 ? (
              <>
              {/* Above the plot and outside it, so nothing the chart draws can cross it */}
              <ChartLegend layout="row" size="xs" className="mt-5 justify-end" items={MARGIN_CHART_SERIES} />
              <div className="mt-2 overflow-x-auto">
                <div style={{ minWidth: Math.max(560, marginChart.length * 190) }} className="h-80 sm:h-[22rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    {/* The top margin is the room the tallest bar's figure stands in. The bars of
                        one estimate are kept close (`barGap`) and the estimates apart
                        (`barCategoryGap`), so a group reads as a group. */}
                    <ComposedChart data={marginChart} margin={{ top: 22, right: 12, left: 0, bottom: 16 }}
                      barGap={2} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="estimateId" tickLine={false} axisLine={{ stroke: '#E2E8F0' }}
                        interval={0} height={44} tick={<EstimateAxisTick rows={marginChart} />} />
                      <YAxis yAxisId="money" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={64}
                        tickFormatter={value => formatCurrencyCompact(value)} />
                      <YAxis yAxisId="margin" orientation="right" domain={[0, 100]} unit="%" width={44}
                        tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#F8FAFC' }} content={<ChartTooltipContent formatValue={marginTrendValue}
                        footer={row => [row.property, row.propertyCode, row.createdAt && new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')} />} />
                      {/* The figures are compact -- ₹1.5L, not ₹1,50,300 -- because an exact label
                          is wider than the bar it belongs to and runs into its neighbour. Exact
                          figures are in the hover and in the cards above. */}
                      <Bar yAxisId="money" dataKey="vendorCost" name="Vendor Cost" fill="#A5B4FC" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        <LabelList dataKey="vendorCost" position="top" formatter={formatCurrencyCompact} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                      <Bar yAxisId="money" dataKey="xlandCost" name="XLAND Cost" fill="#FCD34D" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        <LabelList dataKey="xlandCost" position="top" formatter={formatCurrencyCompact} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                      <Bar yAxisId="money" dataKey="customerPrice" name="Customer Price" fill="#6EE7B7" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        <LabelList dataKey="customerPrice" position="top" formatter={formatCurrencyCompact} style={{ fontSize: 10, fill: '#475569' }} />
                      </Bar>
                      <Line yAxisId="margin" type="monotone" dataKey="marginPercent" name="Margin %" stroke="#4F6BED"
                        strokeWidth={2} dot={{ r: 4, fill: '#4F6BED' }} activeDot={{ r: 5 }}>
                        <LabelList dataKey="marginPercent" content={<MarginLabel />} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              </>
            ) : (
              <p className="mt-5 text-sm text-gray-500">
                {estimateMargins.estimateCount === 0
                  ? 'No active property-based estimates yet.'
                  : 'No property-based estimates were raised in this range.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsDashboard;
