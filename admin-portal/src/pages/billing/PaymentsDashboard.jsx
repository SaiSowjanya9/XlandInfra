import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import DateRangeFilter from '../../components/common/DateRangeFilter';

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

// Donut Chart Component
const DonutChart = ({ data, total, centerLabel, size = 160 }) => {
  const radius = size / 2 - 20;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
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
              strokeWidth="24"
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{formatCurrencyShort(total)}</span>
        <span className="text-xs text-gray-500">{centerLabel}</span>
      </div>
    </div>
  );
};

// Simple Donut for Invoice Status (with count instead of currency)
const DonutChartCount = ({ data, total, size = 160 }) => {
  const radius = size / 2 - 20;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
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
              strokeWidth="24"
              strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{total}</span>
        <span className="text-xs text-gray-500">Total</span>
      </div>
    </div>
  );
};

const PaymentsDashboard = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
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
    collectionTrend: [],
    outstandingByAging: [],
    topCustomers: []
  });

  const token = getAuthToken();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch payments data
      const paymentsRes = await fetch(`${API_BASE}/api/payments?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const paymentsResult = await paymentsRes.json();
      const payments = paymentsResult.success ? (paymentsResult.data || []) : [];

      // Fetch invoices data
      const invoicesRes = await fetch(`${API_BASE}/api/payments/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const invoicesResult = await invoicesRes.json();
      const invoices = invoicesResult.success ? (invoicesResult.data || []) : [];

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      
      // Total Invoice Amount
      const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.totalAmount) || 0), 0);
      
      // Amount Collected (paid payments)
      const paidPayments = payments.filter(p => p.status === 'paid');
      const amountCollected = paidPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      // Pending Amount (unpaid invoices)
      const pendingInvoices = invoices.filter(inv => inv.status !== 'paid');
      const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balanceAmount) || parseFloat(inv.totalAmount) || 0), 0);
      
      // Overdue Amount
      const overdueInvoices = invoices.filter(inv => {
        if (inv.status === 'paid') return false;
        const dueDate = new Date(inv.dueDate);
        return dueDate < new Date();
      });
      const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balanceAmount) || parseFloat(inv.totalAmount) || 0), 0);
      
      // Today's Collections
      const todaysPayments = payments.filter(p => {
        const paymentDate = new Date(p.paymentDate).toISOString().split('T')[0];
        return paymentDate === today && p.status === 'paid';
      });
      const todaysCollections = todaysPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      // Failed Payments
      const failedPaymentsList = payments.filter(p => p.status === 'failed');
      const failedPayments = failedPaymentsList.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      // Payments by Mode
      const modeMap = {
        upi: { label: 'UPI', color: '#10B981' },
        bank_transfer: { label: 'Bank Transfer', color: '#3B82F6' },
        razorpay: { label: 'Razorpay Link', color: '#8B5CF6' },
        debit_credit_card: { label: 'Card / POS', color: '#F59E0B' },
        cash: { label: 'Cash', color: '#6B7280' },
        check: { label: 'Cheque', color: '#14B8A6' }
      };
      
      const paymentsByModeMap = {};
      paidPayments.forEach(p => {
        const method = p.paymentMethod || 'other';
        if (!paymentsByModeMap[method]) {
          paymentsByModeMap[method] = 0;
        }
        paymentsByModeMap[method] += parseFloat(p.amount) || 0;
      });
      
      const paymentsByMode = Object.entries(paymentsByModeMap).map(([key, value]) => ({
        label: modeMap[key]?.label || key,
        value,
        color: modeMap[key]?.color || '#9CA3AF',
        percentage: amountCollected > 0 ? ((value / amountCollected) * 100).toFixed(1) : 0
      })).sort((a, b) => b.value - a.value);

      // Payments by Status
      const statusColors = {
        paid: '#10B981',
        partially_paid: '#F59E0B',
        failed: '#EF4444',
        refunded: '#6B7280',
        verification_pending: '#F97316'
      };
      
      const paymentsByStatusMap = {};
      payments.forEach(p => {
        const status = p.status || 'pending';
        if (!paymentsByStatusMap[status]) {
          paymentsByStatusMap[status] = 0;
        }
        paymentsByStatusMap[status] += parseFloat(p.amount) || 0;
      });
      
      const totalPaymentsAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const paymentsByStatus = Object.entries(paymentsByStatusMap).map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        color: statusColors[key] || '#9CA3AF',
        percentage: totalPaymentsAmount > 0 ? ((value / totalPaymentsAmount) * 100).toFixed(1) : 0
      }));

      // Invoices by Payment Status (count based)
      const invoiceStatusColors = {
        paid: '#10B981',
        partially_paid: '#F59E0B',
        unpaid: '#3B82F6',
        overdue: '#EF4444'
      };
      
      // Filter out cancelled/void invoices
      const activeInvoices = invoices.filter(inv => 
        inv.status !== 'cancelled' && inv.status !== 'void'
      );
      
      // Helper to get payment status
      const getPaymentStatus = (inv) => inv.paymentStatus || inv.payment_status || '';
      
      const paidInvoices = activeInvoices.filter(inv => 
        getPaymentStatus(inv) === 'paid' || inv.status === 'paid'
      ).length;
      const partiallyPaidInvoices = activeInvoices.filter(inv => 
        getPaymentStatus(inv) === 'partially_paid' || inv.status === 'partially_paid'
      ).length;
      const overdueInvoicesCount = activeInvoices.filter(inv => inv.status === 'overdue').length;
      // Unpaid = all active invoices that are not paid, partially_paid, or overdue
      const unpaidInvoices = activeInvoices.filter(inv => {
        const payStatus = getPaymentStatus(inv);
        const status = inv.status;
        const isPaid = payStatus === 'paid' || status === 'paid';
        const isPartial = payStatus === 'partially_paid' || status === 'partially_paid';
        const isOverdue = status === 'overdue';
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
        const dueDate = new Date(inv.dueDate);
        const daysPastDue = Math.max(0, Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)));
        const amount = parseFloat(inv.balanceAmount) || parseFloat(inv.totalAmount) || 0;
        
        for (const bucket of agingBuckets) {
          if (daysPastDue >= bucket.min && daysPastDue <= bucket.max) {
            bucket.amount += amount;
            break;
          }
        }
      });

      // Collection Trend (last 30 days)
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last30Days.push({
          date: dateStr,
          label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          invoiceAmount: 0,
          collectedAmount: 0
        });
      }
      
      invoices.forEach(inv => {
        const invDate = new Date(inv.invoiceDate).toISOString().split('T')[0];
        const dayData = last30Days.find(d => d.date === invDate);
        if (dayData) {
          dayData.invoiceAmount += parseFloat(inv.totalAmount) || 0;
        }
      });
      
      paidPayments.forEach(p => {
        const payDate = new Date(p.paymentDate).toISOString().split('T')[0];
        const dayData = last30Days.find(d => d.date === payDate);
        if (dayData) {
          dayData.collectedAmount += parseFloat(p.amount) || 0;
        }
      });

      // Top 5 Customers by Collection
      const customerCollections = {};
      paidPayments.forEach(p => {
        const customer = p.customerName || p.propertyName || 'Unknown';
        if (!customerCollections[customer]) {
          customerCollections[customer] = 0;
        }
        customerCollections[customer] += parseFloat(p.amount) || 0;
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
        collectionTrend: last30Days,
        outstandingByAging: agingBuckets,
        topCustomers,
        totalInvoices
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [token, dateRange]);

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
    ...dashboardData.collectionTrend.map(d => Math.max(d.invoiceAmount, d.collectedAmount)),
    1
  );

  const maxAgingValue = Math.max(...dashboardData.outstandingByAging.map(b => b.amount), 1);
  const maxCustomerValue = Math.max(...dashboardData.topCustomers.map(c => c.amount), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payments Dashboard</h1>
            <p className="text-sm text-gray-500">Overview of all payments and collections</p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter
              startDate={dateRange.start}
              endDate={dateRange.end}
              onDateChange={(start, end) => setDateRange({ start, end })}
              onRefresh={fetchDashboardData}
              showRefreshButton={true}
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {/* Total Invoice Amount */}
          <div className="bg-white rounded-xl p-4 border-l-4 border-l-blue-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-3 h-3 text-blue-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 leading-tight">Total Invoice Amount</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrencyShort(dashboardData.totalInvoiceAmount)}</p>
            <p className="text-[10px] text-gray-400 mb-1">100% of all invoices</p>
            <button onClick={() => navigate(`${basePath}/billing/invoices`)} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Amount Collected */}
          <div className="bg-white rounded-xl p-4 border-l-4 border-l-green-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-3 h-3 text-green-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 leading-tight">Amount Collected</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrencyShort(dashboardData.amountCollected)}</p>
            <p className="text-[10px] text-gray-400 mb-1">{dashboardData.collectedPercentage}% of total invoices</p>
            <button onClick={() => navigateToPaymentsList('paid')} className="flex items-center gap-1 text-[11px] text-green-600 hover:text-green-700 font-medium">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Pending Amount */}
          <div className="bg-white rounded-xl p-4 border-l-4 border-l-amber-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3 h-3 text-amber-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 leading-tight">Pending Amount</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrencyShort(dashboardData.pendingAmount)}</p>
            <p className="text-[10px] text-gray-400 mb-1">{dashboardData.pendingPercentage}% of total invoices</p>
            <button onClick={() => navigateToPaymentsList('verification_pending')} className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Overdue Amount */}
          <div className="bg-white rounded-xl p-4 border-l-4 border-l-red-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-3 h-3 text-red-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 leading-tight">Overdue Amount</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrencyShort(dashboardData.overdueAmount)}</p>
            <p className="text-[10px] text-gray-400 mb-1">{dashboardData.overduePercentage}% of total invoices</p>
            <button onClick={() => navigate(`${basePath}/billing/invoices?status=overdue`)} className="flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 font-medium">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Today's Collections */}
          <div className="bg-white rounded-xl p-4 border-l-4 border-l-purple-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3 h-3 text-purple-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 leading-tight">Today's Collections</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrencyShort(dashboardData.todaysCollections)}</p>
            <p className="text-[10px] text-gray-400 mb-1">{dashboardData.todaysPaymentCount} Payments</p>
            <button onClick={() => navigateToPaymentsList('paid')} className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium">
              View Details <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Failed Payments */}
          <div className="bg-white rounded-xl p-4 border-l-4 border-l-rose-500 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-3 h-3 text-rose-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-500 leading-tight">Failed Payments</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{formatCurrencyShort(dashboardData.failedPayments)}</p>
            <p className="text-[10px] text-gray-400 mb-1">{dashboardData.failedCount} Transactions</p>
            <button onClick={() => navigateToPaymentsList('failed')} className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-medium">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Collection Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Collection Trend</h3>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="relative">
                <select className="appearance-none text-sm text-gray-700 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Invoice Amount</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-green-500 rounded"></div>
                <span className="text-gray-600">Collected Amount</span>
              </div>
            </div>
            <div className="h-40 flex items-end gap-1">
              {dashboardData.collectionTrend.slice(-15).map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end h-32">
                    <div 
                      className="flex-1 bg-blue-200 rounded-t"
                      style={{ height: `${(day.invoiceAmount / maxTrendValue) * 100}%`, minHeight: day.invoiceAmount > 0 ? '4px' : '0' }}
                    ></div>
                    <div 
                      className="flex-1 bg-green-400 rounded-t"
                      style={{ height: `${(day.collectedAmount / maxTrendValue) * 100}%`, minHeight: day.collectedAmount > 0 ? '4px' : '0' }}
                    ></div>
                  </div>
                  <span className="text-[8px] text-gray-400 truncate w-full text-center">{day.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payments by Mode */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Payments by Mode</h3>
              <div className="relative">
                <select className="appearance-none text-sm text-gray-700 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <DonutChart 
                data={dashboardData.paymentsByMode}
                total={dashboardData.amountCollected}
                centerLabel="Total"
              />
              <div className="flex-1 ml-4 space-y-2">
                {dashboardData.paymentsByMode.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{formatCurrencyShort(item.value)} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payments by Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Payments by Status</h3>
              <div className="relative">
                <select className="appearance-none text-sm text-gray-700 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <DonutChart 
                data={dashboardData.paymentsByStatus}
                total={dashboardData.paymentsByStatus.reduce((sum, s) => sum + s.value, 0)}
                centerLabel="Total"
              />
              <div className="flex-1 ml-4 space-y-2">
                {dashboardData.paymentsByStatus.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{formatCurrencyShort(item.value)} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-3 gap-4">
          {/* Outstanding by Aging */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-900">Outstanding by Aging</h3>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <div className="space-y-3">
              {dashboardData.outstandingByAging.map((bucket, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{bucket.label}</span>
                    <span className="text-xs font-medium text-gray-900">{formatCurrencyShort(bucket.amount)}</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-lg overflow-hidden">
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
          </div>

          {/* Top 5 Customers by Collection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Top 5 Customers by Collection</h3>
              <div className="relative">
                <select className="appearance-none text-sm text-gray-700 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-3">
              {dashboardData.topCustomers.length > 0 ? dashboardData.topCustomers.map((customer, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 truncate max-w-[150px]">{customer.name}</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrencyShort(customer.amount)}</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded overflow-hidden">
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
          </div>

          {/* Invoices by Payment Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Invoices by Payment Status</h3>
              <div className="relative">
                <select className="appearance-none text-sm text-gray-700 border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="all">All Time</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="sixmonths">Last 6 Months</option>
                  <option value="year">This Year</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <DonutChartCount 
                data={dashboardData.invoicesByStatus}
                total={dashboardData.totalInvoices || 0}
              />
              <div className="flex-1 ml-4 space-y-2">
                {dashboardData.invoicesByStatus.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{item.value} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentsDashboard;
