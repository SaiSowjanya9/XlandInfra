import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Plus,
  Eye,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  CreditCard,
  Banknote,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  IndianRupee,
  Wallet,
  Smartphone,
  FileCheck,
  MoreHorizontal,
  Edit,
  Archive,
  FileText,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Format date in IST format (dd/mm/yyyy)
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

// Parse dd/mm/yyyy to yyyy-mm-dd
const parseISTDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle date input with auto-formatting
const handleDateInput = (value, setter) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  setter(cleaned);
};

// Payment method config with colors matching reference
const PAYMENT_METHODS = {
  cash: { label: 'Cash', icon: Banknote, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  upi: { label: 'UPI', icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  debit_credit_card: { label: 'Card', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  check: { label: 'Check', icon: FileCheck, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  other: { label: 'Other', icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
};

// Status config
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  partially_paid: { label: 'Partially Paid', color: 'bg-blue-100 text-blue-700' },
  verification_pending: { label: 'Verification Pending', color: 'bg-orange-100 text-orange-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-600' },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-600' }
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

// Format date with time
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const dateFormatted = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeFormatted = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return { date: dateFormatted, time: timeFormatted };
};

// Record Payment Modal
const RecordPaymentModal = ({ isOpen, onClose, onSuccess, invoices }) => {
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    paymentMethod: 'bank_transfer',
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
    proofFile: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = getAuthToken();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.invoiceId || !formData.amount) {
      setError('Please fill in required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      const response = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData
      });

      const result = await response.json();
      if (result.success) {
        onSuccess();
        onClose();
        setFormData({
          invoiceId: '',
          amount: '',
          paymentMethod: 'bank_transfer',
          transactionId: '',
          paymentDate: new Date().toISOString().split('T')[0],
          notes: '',
          proofFile: null
        });
      } else {
        setError(result.message || 'Failed to record payment');
      }
    } catch (err) {
      setError('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

          {/* Invoice ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID *</label>
            <input
              type="text"
              value={formData.invoiceId}
              onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
              placeholder="Enter Invoice ID (e.g., INV-00001)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PAYMENT_METHODS).map(([key, method]) => {
                const Icon = method.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: key })}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      formData.paymentMethod === key
                        ? `${method.bg} ${method.color} ${method.border} border-2`
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {method.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transaction/Reference ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Transaction No.</label>
            <input
              type="text"
              value={formData.transactionId}
              onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
              placeholder="UTR, Check No., Transaction ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Payments = ({ user, portalType = 'admin' }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [dateRangeDisplay, setDateRangeDisplay] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const itemsPerPage = 10;

  const token = getAuthToken();

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/payments`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (methodFilter !== 'all') params.append('paymentMethod', methodFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setPayments(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, methodFilter, searchTerm, dateRange]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Calculate stats
  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    paidAmount: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    verificationPending: payments.filter(p => p.status === 'verification_pending').length,
    verificationAmount: payments.filter(p => p.status === 'verification_pending').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    partiallyPaid: payments.filter(p => p.status === 'partially_paid').length,
    partiallyPaidAmount: payments.filter(p => p.status === 'partially_paid').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    failed: payments.filter(p => p.status === 'failed' || p.status === 'refunded').length,
    failedAmount: payments.filter(p => p.status === 'failed' || p.status === 'refunded').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  };

  // Filtering
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchTerm ||
      payment.paymentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredPayments.map(p => ({
      'Payment ID': p.paymentId,
      'Invoice ID': p.invoiceId,
      'Customer': p.customerName,
      'Property ID': p.propertyCode || p.propertyId,
      'Method': PAYMENT_METHODS[p.paymentMethod]?.label || p.paymentMethod,
      'Amount': parseFloat(p.amount) || 0,
      'Payment Date': p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '',
      'Status': STATUS_CONFIG[p.status]?.label || p.status,
      'Reference/Transaction No.': p.transactionId || p.referenceNumber || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    XLSX.writeFile(wb, `Payments_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported successfully!');
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedPayments.length === paginatedPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(paginatedPayments.map(p => p.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedPayments(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white flex items-center gap-2`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">Home &gt; Billing & Payments &gt; Payments</p>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Payment ID, Invoice ID, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {/* Total Payments */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <IndianRupee className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-400">This Month</p>
            </div>
          </div>

          {/* Received (Paid) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <div className="p-2.5 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Received (Paid)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-xs text-gray-400">{formatCurrencyShort(stats.paidAmount)}</p>
            </div>
          </div>

          {/* Verification Pending */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <div className="p-2.5 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Verification Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.verificationPending}</p>
              <p className="text-xs text-gray-400">{formatCurrencyShort(stats.verificationAmount)}</p>
            </div>
          </div>

          {/* Partially Paid */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Partially Paid</p>
              <p className="text-2xl font-bold text-gray-900">{stats.partiallyPaid}</p>
              <p className="text-xs text-gray-400">{formatCurrencyShort(stats.partiallyPaidAmount)}</p>
            </div>
          </div>

          {/* Failed / Refunded */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Failed / Refunded</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              <p className="text-xs text-gray-400">{formatCurrencyShort(stats.failedAmount)}</p>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4">
          <div className="flex items-center gap-3 p-4 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="verification_pending">Verification Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Payment Method Filter */}
            <div className="relative">
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="debit_credit_card">Debit/Credit Card</option>
                <option value="check">Check</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Range - IST Format (dd/mm/yyyy) */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateRangeDisplay.start}
                  onChange={(e) => {
                    handleDateInput(e.target.value, (val) => setDateRangeDisplay(prev => ({ ...prev, start: val })));
                    const parsed = parseISTDate(e.target.value);
                    if (parsed) setDateRange(prev => ({ ...prev, start: parsed }));
                  }}
                  className="text-sm border-none focus:outline-none bg-transparent w-[90px]"
                />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange(prev => ({ ...prev, start: e.target.value }));
                      setDateRangeDisplay(prev => ({ ...prev, start: formatDateIST(e.target.value) }));
                    }
                  }}
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateRangeDisplay.end}
                  onChange={(e) => {
                    handleDateInput(e.target.value, (val) => setDateRangeDisplay(prev => ({ ...prev, end: val })));
                    const parsed = parseISTDate(e.target.value);
                    if (parsed) setDateRange(prev => ({ ...prev, end: parsed }));
                  }}
                  className="text-sm border-none focus:outline-none bg-transparent w-[90px]"
                />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange(prev => ({ ...prev, end: e.target.value }));
                      setDateRangeDisplay(prev => ({ ...prev, end: formatDateIST(e.target.value) }));
                    }
                  }}
                />
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Record Payment Button */}
            <button
              onClick={() => setShowRecordModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : paginatedPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No payments found</p>
              <p className="text-sm">Record your first payment to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedPayments.length === paginatedPayments.length && paginatedPayments.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Payment ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid Date</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reference / Transaction No.</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedPayments.map((payment) => {
                      const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.other;
                      const status = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                      const MethodIcon = method.icon;
                      const dateTime = formatDateTime(payment.paymentDate);

                      return (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedPayments.includes(payment.id)}
                              onChange={() => toggleSelect(payment.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-blue-600">{payment.paymentId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{payment.invoiceId || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-800">{payment.customerName || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{payment.propertyCode || payment.propertyId || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${method.bg} ${method.color} border ${method.border}`}>
                              <MethodIcon className="w-3.5 h-3.5" />
                              {method.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrencyShort(payment.amount)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-800">{dateTime.date}</div>
                            <div className="text-xs text-gray-500">{dateTime.time}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">{payment.transactionId || payment.referenceNumber || '-'}</span>
                          </td>
                          <td className="px-4 py-3 text-center relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === payment.id ? null : payment.id)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg"
                            >
                              <MoreHorizontal className="w-4 h-4 text-gray-500" />
                            </button>
                            {actionMenuOpen === payment.id && (
                              <div className="absolute right-4 top-10 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                                <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  <Eye className="w-4 h-4" /> View
                                </button>
                                <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  <Edit className="w-4 h-4" /> Modify
                                </button>
                                <button className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  <Download className="w-4 h-4" /> Download
                                </button>
                                <button className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 className="w-4 h-4" /> Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} payments
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="px-2 text-gray-400">...</span>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="w-9 h-9 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={() => {
          fetchPayments();
          showToast('Payment recorded successfully!');
        }}
        invoices={[]}
      />

      {/* Click outside to close action menu */}
      {actionMenuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActionMenuOpen(null)}
        />
      )}
    </div>
  );
};

export default Payments;
