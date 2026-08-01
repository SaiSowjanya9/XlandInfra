import { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  IndianRupee,
  FileText,
  CheckCircle,
  AlertCircle,
  Banknote,
  Smartphone,
  Building2,
  CreditCard as CreditCardIcon,
  Eye,
  XCircle,
  User,
  ChevronDown,
  X,
  Home,
  Hash,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PAYMENT_METHOD_CONFIG = {
  cash: { label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700' },
  upi_manual: { label: 'UPI (Manual)', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  upi_online: { label: 'UPI (Online)', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  card_pos: { label: 'Card/POS', icon: CreditCardIcon, color: 'bg-orange-100 text-orange-700' },
  razorpay: { label: 'Razorpay', icon: CreditCardIcon, color: 'bg-indigo-100 text-indigo-700' },
  credit_card: { label: 'Credit Card', icon: CreditCardIcon, color: 'bg-red-100 text-red-700' },
  debit_card: { label: 'Debit Card', icon: CreditCardIcon, color: 'bg-teal-100 text-teal-700' },
  net_banking: { label: 'Net Banking', icon: Building2, color: 'bg-cyan-100 text-cyan-700' },
  wallet: { label: 'Wallet', icon: Banknote, color: 'bg-pink-100 text-pink-700' },
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-700' },
};

const FPPaymentHistory = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewPayment, setViewPayment] = useState(null);
  const [toast, setToast] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const token = getAuthToken();

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/payments/payments`;
      const params = new URLSearchParams();
      if (methodFilter !== 'all') params.append('paymentMethod', methodFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (searchTerm) params.append('search', searchTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setPayments(result.data);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [methodFilter, statusFilter, dateRange.start, dateRange.end]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchPayments();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToExcel = () => {
    if (payments.length === 0) {
      showToast('No payments to export', 'error');
      return;
    }

    const exportData = payments.map(p => ({
      'Payment ID': p.paymentId,
      'Invoice ID': p.invoiceCode || '-',
      'Estimate ID': p.estimateId || '-',
      'Property ID': p.propertyCode || '-',
      'Property Name': p.propertyName || '-',
      'Customer Name': p.customerName || '-',
      'Payment Method': PAYMENT_METHOD_CONFIG[p.paymentMethod]?.label || p.paymentMethod,
      'Transaction Reference': p.transactionReference || '-',
      'Amount Paid': p.amount,
      'Payment Date': formatDate(p.paymentDate),
      'Received By': p.receivedBy || '-',
      'Payment Status': STATUS_CONFIG[p.status]?.label || p.status,
      'Remarks': p.remarks || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    XLSX.writeFile(wb, `Payment_History_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Payment history exported successfully');
  };

  // Calculate stats
  const stats = {
    total: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    completed: payments.filter(p => p.status === 'completed').length,
    pending: payments.filter(p => p.status === 'pending').length
  };

  const canEdit = ['admin', 'operations_manager', 'franchise_partner', 'manager'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <p className="text-gray-500 mt-1">Complete payment history for all invoices</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {canEdit && (
            <button
              onClick={() => navigate('/fp/payments/record')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
            >
              <IndianRupee className="w-4 h-4" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Total Payments</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Total Amount</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalAmount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Payment ID, Customer, Transaction Ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition-colors ${
              showFilters ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Refresh */}
          <button
            onClick={fetchPayments}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Payment Method Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              >
                <option value="all">All Methods</option>
                {Object.entries(PAYMENT_METHOD_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              >
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <span className="ml-2 text-gray-600">Loading payments...</span>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No payment records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Payment ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Invoice ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Property</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Method</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Transaction Ref</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Received By</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(payment => {
                  const methodConfig = PAYMENT_METHOD_CONFIG[payment.paymentMethod] || {};
                  const statusConfig = STATUS_CONFIG[payment.status] || {};
                  const MethodIcon = methodConfig.icon || CreditCardIcon;

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{payment.paymentId}</p>
                        {payment.estimateId && (
                          <p className="text-xs text-gray-500">Est: {payment.estimateId}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900">{payment.invoiceCode || '-'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900">{payment.propertyCode || '-'}</p>
                        {payment.propertyName && (
                          <p className="text-xs text-gray-500 truncate max-w-[150px]">{payment.propertyName}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900">{payment.customerName || '-'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${methodConfig.color || 'bg-gray-100'}`}>
                            <MethodIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm text-gray-700">{methodConfig.label || payment.paymentMethod}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600 text-sm font-mono">
                          {payment.transactionReference || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600">{formatDate(payment.paymentDate)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900">{payment.receivedBy || '-'}</p>
                        {payment.receivedByRole && (
                          <p className="text-xs text-gray-500 capitalize">{payment.receivedByRole.replace('_', ' ')}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color || 'bg-gray-100'}`}>
                            {statusConfig.label || payment.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => setViewPayment(payment)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Details Modal */}
      {viewPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
                  <p className="text-gray-500">{viewPayment.paymentId}</p>
                </div>
                <button
                  onClick={() => setViewPayment(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Amount & Status */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-6 text-white">
                <p className="text-amber-100 text-sm mb-1">Amount Paid</p>
                <p className="text-3xl font-bold">{formatCurrency(viewPayment.amount)}</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    viewPayment.status === 'completed' ? 'bg-white/20' : 'bg-white/10'
                  }`}>
                    {STATUS_CONFIG[viewPayment.status]?.label || viewPayment.status}
                  </span>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Payment ID</p>
                  <p className="font-semibold text-gray-900">{viewPayment.paymentId}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Invoice ID</p>
                  <p className="font-semibold text-gray-900">{viewPayment.invoiceCode || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Estimate ID</p>
                  <p className="font-semibold text-gray-900">{viewPayment.estimateId || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Property ID</p>
                  <p className="font-semibold text-gray-900">{viewPayment.propertyCode || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Property Name</p>
                  <p className="font-semibold text-gray-900">{viewPayment.propertyName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Customer Name</p>
                  <p className="font-semibold text-gray-900">{viewPayment.customerName || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Payment Method</p>
                  <p className="font-semibold text-gray-900">
                    {PAYMENT_METHOD_CONFIG[viewPayment.paymentMethod]?.label || viewPayment.paymentMethod}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Transaction Reference</p>
                  <p className="font-semibold text-gray-900 font-mono">{viewPayment.transactionReference || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Payment Date</p>
                  <p className="font-semibold text-gray-900">{formatDate(viewPayment.paymentDate)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Received By</p>
                  <p className="font-semibold text-gray-900">{viewPayment.receivedBy || '-'}</p>
                  {viewPayment.receivedByRole && (
                    <p className="text-xs text-gray-500 capitalize">{viewPayment.receivedByRole.replace('_', ' ')}</p>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {viewPayment.remarks && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-1">Remarks</p>
                  <p className="text-gray-900">{viewPayment.remarks}</p>
                </div>
              )}

              {/* Payment Proof */}
              {viewPayment.paymentProofUrl && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Payment Proof</p>
                  <a
                    href={`${API_BASE}${viewPayment.paymentProofUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:text-amber-700 font-medium"
                  >
                    View Attachment
                  </a>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setViewPayment(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
                {viewPayment.invoiceCode && (
                  <button
                    onClick={() => {
                      setViewPayment(null);
                      navigate(`/fp/payments/invoices/${viewPayment.invoiceId}`);
                    }}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700"
                  >
                    View Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPPaymentHistory;
