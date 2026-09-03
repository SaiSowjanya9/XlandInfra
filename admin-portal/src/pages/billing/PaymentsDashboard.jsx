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
  Users,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
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

// Donut Chart Component
const DonutChart = ({ data, total, centerLabel, size = 130 }) => {
  const strokeWidth = size > 140 ? 24 : 20;
  const radius = size / 2 - strokeWidth / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
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
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg sm:text-xl font-bold text-gray-900">{formatCurrencyShort(total)}</span>
        <span className="text-[10px] sm:text-xs text-gray-500">{centerLabel}</span>
      </div>
    </div>
  );
};

// Simple Donut for Invoice Status (with count instead of currency)
const DonutChartCount = ({ data, total, size = 130 }) => {
  const strokeWidth = size > 140 ? 24 : 20;
  const radius = size / 2 - strokeWidth / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
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
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl sm:text-2xl font-bold text-gray-900">{total}</span>
        <span className="text-[10px] sm:text-xs text-gray-500">Total</span>
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
    topCustomers: [],
    recentPayments: []
  });
  
  // FP Context
  const { fpList, selectedFp, selectFp, loading: fpLoading } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);

  const token = getAuthToken();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query params with optional FP filter
      const fpParam = selectedFp ? `&fpId=${selectedFp.id}` : '';
      
      // Fetch payments data
      const paymentsRes = await fetch(`${API_BASE}/api/payments?startDate=${dateRange.start}&endDate=${dateRange.end}${fpParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const paymentsResult = await paymentsRes.json();
      const payments = paymentsResult.success ? (paymentsResult.data || []) : [];

      // Fetch invoices data
      const invoicesRes = await fetch(`${API_BASE}/api/payments/invoices${selectedFp ? `?fpId=${selectedFp.id}` : ''}`, {
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

      // Recent Payments (last 5)
      const recentPayments = [...payments]
        .sort((a, b) => new Date(b.paymentDate || b.createdAt) - new Date(a.paymentDate || a.createdAt))
        .slice(0, 5)
        .map(p => ({
          id: p.id,
          customerName: p.customerName || p.propertyName || 'Unknown',
          invoiceId: p.invoiceId,
          paymentMethod: p.paymentMethod,
          amount: parseFloat(p.amount) || 0,
          paymentDate: p.paymentDate || p.createdAt
        }));

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
        totalInvoices,
        recentPayments
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [token, dateRange, selectedFp]);

  useEffect(() => {
    fetchDashboardData();
  }, [token, dateRange, selectedFp]);

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
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatCurrencyShort(dashboardData.totalInvoiceAmount)}</p>
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
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatCurrencyShort(dashboardData.amountCollected)}</p>
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
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatCurrencyShort(dashboardData.pendingAmount)}</p>
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
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatCurrencyShort(dashboardData.overdueAmount)}</p>
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
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatCurrencyShort(dashboardData.todaysCollections)}</p>
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
              <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{formatCurrencyShort(dashboardData.failedPayments)}</p>
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
              {dashboardData.collectionTrend.slice(-15).map((day, idx) => (
                <div key={idx} className="flex-1 min-w-[16px] flex flex-col items-center gap-1">
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
                  <span className="text-[7px] sm:text-[8px] text-gray-400 truncate w-full text-center">{day.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <DonutChart 
                  data={dashboardData.paymentsByMode}
                  total={dashboardData.amountCollected}
                  centerLabel="Total"
                  size={130}
                />
              </div>
              <div className="flex-1 space-y-2 min-w-0 w-full sm:w-auto">
                {dashboardData.paymentsByMode.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700 truncate">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0">{formatCurrencyShort(item.value)} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <DonutChart 
                  data={dashboardData.paymentsByStatus}
                  total={dashboardData.paymentsByStatus.reduce((sum, s) => sum + s.value, 0)}
                  centerLabel="Total"
                  size={130}
                />
              </div>
              <div className="flex-1 space-y-2 min-w-0 w-full sm:w-auto">
                {dashboardData.paymentsByStatus.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700 truncate">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0">{formatCurrencyShort(item.value)} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
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
                <div key={idx}>
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
                <div key={idx}>
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <DonutChartCount 
                  data={dashboardData.invoicesByStatus}
                  total={dashboardData.totalInvoices || 0}
                  size={130}
                />
              </div>
              <div className="flex-1 space-y-2 min-w-0 w-full sm:w-auto">
                {dashboardData.invoicesByStatus.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-700 truncate">{item.label}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0">{item.value} ({item.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions and Recent Payments Row - Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <button
                onClick={() => navigate(`${basePath}/billing/invoices`)}
                className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                </div>
                <span className="text-[10px] sm:text-sm font-medium text-gray-700 text-center leading-tight">View Invoices</span>
              </button>
              <button
                onClick={() => navigate(`${basePath}/billing/payments`)}
                className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <span className="text-[10px] sm:text-sm font-medium text-gray-700 text-center leading-tight">Payment History</span>
              </button>
              <button
                onClick={() => navigate(`${basePath}/billing/create-invoice`)}
                className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <span className="text-[10px] sm:text-sm font-medium text-gray-700 text-center leading-tight">Create Invoice</span>
              </button>
            </div>
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">Recent Payments</h3>
              <button 
                onClick={() => navigate(`${basePath}/billing/payments`)}
                className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                View All <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {dashboardData.recentPayments && dashboardData.recentPayments.length > 0 ? (
                dashboardData.recentPayments.map((payment, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{payment.customerName}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                        {payment.invoiceId} | {payment.paymentMethod?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-semibold text-green-600">{formatCurrencyShort(payment.amount)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-400">
                        {new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No recent payments</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentsDashboard;
