import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
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
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  Image as ImageIcon,
  Edit,
  Trash2,
  RotateCcw,
  IndianRupee,
  Wallet,
  Smartphone,
  CircleDollarSign,
  FileCheck,
  History,
  Archive,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Payment method icons and colors
const PAYMENT_METHODS = {
  cash: { label: 'Cash', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
  upi: { label: 'UPI', icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50' },
  razorpay: { label: 'Razorpay', icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  check: { label: 'Check', icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
  card: { label: 'Card', icon: CreditCard, color: 'text-pink-600', bg: 'bg-pink-50' },
  other: { label: 'Other', icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50' }
};

// Payment status config
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partially_paid: { label: 'Partially Paid', color: 'bg-blue-100 text-blue-700', icon: CircleDollarSign },
  verification_pending: { label: 'Verification Pending', color: 'bg-orange-100 text-orange-700', icon: Clock },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-600', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-600', icon: RefreshCw }
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

// Format date in IST
const formatDateIST = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
};

const formatDateOnlyIST = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

// Payment Detail Panel Component
const PaymentDetailPanel = ({ payment, onClose, formatCurrency, formatDateIST }) => {
  if (!payment) return null;

  const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.other;
  const MethodIcon = method.icon;
  const status = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-40 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">{payment.paymentId}</h2>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Payment Overview */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Payment Overview
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Invoice ID</span>
              <span className="text-sm font-medium text-blue-600">{payment.invoiceId || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Customer</span>
              <span className="text-sm font-medium text-gray-900">{payment.customerName || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Property ID</span>
              <span className="text-sm font-medium text-gray-900">{payment.propertyCode || '-'}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-3">
              <span className="text-sm text-gray-500">Invoice Amount</span>
              <span className="text-sm font-semibold text-gray-900">{formatCurrency(payment.invoiceAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Paid Amount</span>
              <span className="text-sm font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Balance Amount</span>
              <span className="text-sm font-semibold text-red-600">{formatCurrency(payment.balanceAmount)}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payment Details
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Payment Method</span>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${method.bg}`}>
                <MethodIcon className={`w-4 h-4 ${method.color}`} />
                <span className={`text-sm font-medium ${method.color}`}>{method.label}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Payment Date</span>
              <span className="text-sm font-medium text-gray-900">{formatDateIST(payment.paymentDate)}</span>
            </div>
            {payment.transactionReference && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Reference / UTR No.</span>
                <span className="text-sm font-mono font-medium text-gray-900">{payment.transactionReference}</span>
              </div>
            )}
            {payment.bankName && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Bank Name</span>
                <span className="text-sm font-medium text-gray-900">{payment.bankName}</span>
              </div>
            )}
            {payment.remarks && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-500">Remarks</span>
                <p className="text-sm text-gray-700 mt-1">{payment.remarks}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Proof */}
        {payment.proofUrl && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Payment Proof
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                  {payment.proofUrl.endsWith('.pdf') ? (
                    <FileText className="w-8 h-8 text-gray-400" />
                  ) : (
                    <img src={payment.proofUrl} alt="Payment proof" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{payment.proofFilename || 'Payment_Proof'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Uploaded on {formatDateIST(payment.proofUploadedAt || payment.paymentDate)}</p>
                  {payment.recordedBy && (
                    <p className="text-xs text-gray-500">Uploaded by: {payment.recordedBy}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={payment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> View
                    </a>
                    <a
                      href={payment.proofUrl}
                      download
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status History */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Status History
          </h3>
          <div className="space-y-3">
            {/* Current status */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${payment.status === 'paid' ? 'bg-green-500' : payment.status === 'verification_pending' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                <div className="w-0.5 h-full bg-gray-200"></div>
              </div>
              <div className="pb-4">
                <p className="text-sm font-medium text-gray-900">
                  {payment.status === 'paid' ? 'Payment Recorded' : payment.status === 'verification_pending' ? 'Verification Pending' : STATUS_CONFIG[payment.status]?.label || 'Updated'}
                </p>
                <p className="text-xs text-gray-500">{formatDateIST(payment.paymentDate)} {payment.recordedBy ? `by ${payment.recordedBy}` : ''}</p>
              </div>
            </div>
            {/* Invoice created */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Invoice Created</p>
                <p className="text-xs text-gray-500">{formatDateIST(payment.invoiceCreatedAt || payment.createdAt)} by System</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Record Payment Modal
const RecordPaymentModal = ({ onClose, onSuccess, invoices, token }) => {
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    paymentMethod: 'bank_transfer',
    paymentDate: new Date().toISOString().split('T')[0],
    transactionReference: '',
    bankName: '',
    remarks: ''
  });
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.invoiceId || !formData.amount) {
      setError('Please select an invoice and enter amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });
      if (proofFile) {
        submitData.append('paymentProof', proofFile);
      }

      const response = await fetch(`${API_BASE}/api/payments/record`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData
      });

      const result = await response.json();
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message || 'Failed to record payment');
      }
    } catch (err) {
      setError('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoice = invoices.find(i => i.id?.toString() === formData.invoiceId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          {/* Invoice Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Invoice *</label>
            <select
              value={formData.invoiceId}
              onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose an invoice...</option>
              {invoices.filter(i => i.status !== 'paid').map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceId} - {inv.customerName} - {formatCurrency(inv.balanceAmount || inv.totalAmount)}
                </option>
              ))}
            </select>
          </div>

          {selectedInvoice && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">{formatCurrency(selectedInvoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-600">Balance Due:</span>
                <span className="font-medium text-red-600">{formatCurrency(selectedInvoice.balanceAmount || selectedInvoice.totalAmount)}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter amount"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PAYMENT_METHODS).slice(0, 6).map(([key, method]) => {
                const Icon = method.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMethod: key })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      formData.paymentMethod === key
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Transaction Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference / UTR No.</label>
            <input
              type="text"
              value={formData.transactionReference}
              onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter transaction reference"
            />
          </div>

          {/* Bank Name (for bank transfer) */}
          {(formData.paymentMethod === 'bank_transfer' || formData.paymentMethod === 'check') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter bank name"
              />
            </div>
          )}

          {/* Payment Proof */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Proof</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Upload screenshot or receipt (JPG, PNG, PDF)</p>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const token = getAuthToken();

  // Generate payment ID
  const generatePaymentId = (index, total) => {
    const num = total - index;
    return `PYMT-${String(num).padStart(4, '0')}`;
  };

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
        // Add generated payment IDs
        const paymentsWithIds = (result.data || []).map((p, idx, arr) => ({
          ...p,
          paymentId: p.paymentId || generatePaymentId(idx, arr.length)
        }));
        setPayments(paymentsWithIds);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, methodFilter, searchTerm, dateRange]);

  const fetchInvoices = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices?archived=false`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchInvoices();
  }, [fetchPayments]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Download individual payment receipt/details
  const handleDownloadPayment = async (payment) => {
    try {
      setActionLoading(payment.id);
      // Create a simple receipt/payment details document
      const wb = XLSX.utils.book_new();
      const receiptData = [
        ['PAYMENT RECEIPT'],
        [''],
        ['Payment ID:', payment.paymentId],
        ['Date:', formatDateIST(payment.paymentDate)],
        [''],
        ['PAYMENT DETAILS'],
        ['Invoice ID:', payment.invoiceId || '-'],
        ['Customer:', payment.customerName || '-'],
        ['Property ID:', payment.propertyCode || '-'],
        [''],
        ['Payment Method:', PAYMENT_METHODS[payment.paymentMethod]?.label || payment.paymentMethod],
        ['Amount Paid:', `₹${parseFloat(payment.amount).toLocaleString('en-IN')}`],
        ['Reference/UTR:', payment.transactionReference || '-'],
        ['Bank Name:', payment.bankName || '-'],
        [''],
        ['Status:', STATUS_CONFIG[payment.status]?.label || payment.status],
        ['Recorded By:', payment.recordedBy || '-'],
        ['Remarks:', payment.remarks || '-'],
        [''],
        ['Generated on:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]
      ];
      const ws = XLSX.utils.aoa_to_sheet(receiptData);
      ws['!cols'] = [{ wch: 20 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Receipt');
      XLSX.writeFile(wb, `Payment_${payment.paymentId}_Receipt.xlsx`);
      showToast('Payment receipt downloaded!');
    } catch (err) {
      showToast('Failed to download receipt', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Archive/Delete payment (soft delete)
  const handleArchivePayment = async (payment) => {
    try {
      setActionLoading(payment.id);
      const response = await fetch(`${API_BASE}/api/payments/${payment.id}/archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Payment archived successfully');
        fetchPayments();
      } else {
        showToast(result.message || 'Failed to archive payment', 'error');
      }
    } catch (err) {
      showToast('Failed to archive payment', 'error');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  // Open edit modal
  const handleEditPayment = (payment) => {
    setEditingPayment(payment);
    setShowEditModal(true);
  };

  // Export to Excel - Comprehensive export with all page details
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const exportDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // Sheet 1: Summary
    const summaryData = [
      ['PAYMENTS REPORT'],
      ['Generated on:', exportDate],
      [''],
      ['SUMMARY STATISTICS'],
      ['Total Payments:', payments.length],
      [''],
      ['Status', 'Count', 'Amount (₹)'],
      ['Received (Paid)', payments.filter(p => p.status === 'paid').length, payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)],
      ['Verification Pending', payments.filter(p => p.status === 'verification_pending').length, payments.filter(p => p.status === 'verification_pending').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)],
      ['Partially Paid', payments.filter(p => p.status === 'partially_paid').length, payments.filter(p => p.status === 'partially_paid').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)],
      ['Failed/Refunded', payments.filter(p => p.status === 'failed' || p.status === 'refunded').length, payments.filter(p => p.status === 'failed' || p.status === 'refunded').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)],
      [''],
      ['FILTERS APPLIED'],
      ['Status Filter:', statusFilter === 'all' ? 'All Status' : STATUS_CONFIG[statusFilter]?.label || statusFilter],
      ['Payment Method:', methodFilter === 'all' ? 'All Methods' : PAYMENT_METHODS[methodFilter]?.label || methodFilter],
      ['Date Range:', dateRange.start || dateRange.end ? `${dateRange.start || 'Start'} to ${dateRange.end || 'End'}` : 'All Dates'],
      ['Search Term:', searchTerm || 'None']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: All Payments Data
    const paymentsData = payments.map((p, idx) => ({
      'S.No': idx + 1,
      'Payment ID': p.paymentId,
      'Invoice ID': p.invoiceId || '-',
      'Customer Name': p.customerName || '-',
      'Customer Email': p.customerEmail || '-',
      'Property ID': p.propertyCode || '-',
      'Property Name': p.propertyName || '-',
      'Payment Method': PAYMENT_METHODS[p.paymentMethod]?.label || p.paymentMethod,
      'Amount (₹)': parseFloat(p.amount) || 0,
      'Invoice Amount (₹)': parseFloat(p.invoiceAmount) || 0,
      'Balance Amount (₹)': parseFloat(p.balanceAmount) || 0,
      'Payment Date': formatDateIST(p.paymentDate),
      'Reference/UTR No.': p.transactionReference || '-',
      'Bank Name': p.bankName || '-',
      'Status': STATUS_CONFIG[p.status]?.label || p.status,
      'Recorded By': p.recordedBy || '-',
      'Remarks': p.remarks || '-',
      'Created At': formatDateIST(p.createdAt)
    }));

    const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
    wsPayments['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 25 },
      { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 30 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments');

    // Sheet 3: Payment Method Breakdown
    const methodBreakdown = Object.entries(PAYMENT_METHODS).map(([key, method]) => {
      const methodPayments = payments.filter(p => p.paymentMethod === key);
      return {
        'Payment Method': method.label,
        'Count': methodPayments.length,
        'Total Amount (₹)': methodPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
      };
    }).filter(m => m.Count > 0);
    
    if (methodBreakdown.length > 0) {
      const wsMethod = XLSX.utils.json_to_sheet(methodBreakdown);
      wsMethod['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsMethod, 'By Payment Method');
    }

    XLSX.writeFile(wb, `Payments_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported successfully!');
  };

  // Stats calculation
  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    paidAmount: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    verificationPending: payments.filter(p => p.status === 'verification_pending').length,
    verificationAmount: payments.filter(p => p.status === 'verification_pending').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    partiallyPaid: payments.filter(p => p.status === 'partially_paid').length,
    partialAmount: payments.filter(p => p.status === 'partially_paid').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    failed: payments.filter(p => p.status === 'failed' || p.status === 'refunded').length,
    failedAmount: payments.filter(p => p.status === 'failed' || p.status === 'refunded').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  };

  // Pagination
  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const paginatedPayments = payments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Home &gt; Billing & Payments &gt; Payments
            </p>
          </div>
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {/* Total Payments */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <IndianRupee className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
                <p className="text-xs text-gray-400 mt-0.5">This Month</p>
              </div>
            </div>
          </div>

          {/* Received (Paid) */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-green-100">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Received (Paid)</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.paid}</p>
                <p className="text-xs text-green-600 mt-0.5">{formatCurrency(stats.paidAmount)}</p>
              </div>
            </div>
          </div>

          {/* Verification Pending */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-orange-100">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Verification Pending</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.verificationPending}</p>
                <p className="text-xs text-orange-600 mt-0.5">{formatCurrency(stats.verificationAmount)}</p>
              </div>
            </div>
          </div>

          {/* Partially Paid */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <CircleDollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Partially Paid</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.partiallyPaid}</p>
                <p className="text-xs text-blue-600 mt-0.5">{formatCurrency(stats.partialAmount)}</p>
              </div>
            </div>
          </div>

          {/* Failed / Refunded */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-red-100">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Failed / Refunded</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.failed}</p>
                <p className="text-xs text-red-600 mt-0.5">{formatCurrency(stats.failedAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Payment ID, Invoice ID, Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer min-w-[130px]"
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
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer min-w-[160px]"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="razorpay">Razorpay</option>
                <option value="check">Check</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Range - IST Format */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateRange.start ? new Date(dateRange.start).toLocaleDateString('en-IN') : ''}
                  onClick={(e) => e.target.nextSibling.showPicker()}
                  readOnly
                  className="text-sm border-none focus:outline-none bg-transparent w-24 cursor-pointer"
                />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateRange.end ? new Date(dateRange.end).toLocaleDateString('en-IN') : ''}
                  onClick={(e) => e.target.nextSibling.showPicker()}
                  readOnly
                  className="text-sm border-none focus:outline-none bg-transparent w-24 cursor-pointer"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Export Button */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 ${selectedPayment ? 'mr-[420px]' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <CreditCard className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No payments found</p>
              <p className="text-sm">Record your first payment or adjust filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference / Transaction No.</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedPayments.map((payment) => {
                      const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.other;
                      const MethodIcon = method.icon;
                      const status = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                      
                      return (
                        <tr
                          key={payment.id}
                          className={`hover:bg-gray-50 transition-colors ${selectedPayment?.id === payment.id ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => setSelectedPayment(payment)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {payment.paymentId}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600">{payment.invoiceId || '-'}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-800">{payment.customerName || '-'}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600">{payment.propertyCode || '-'}</td>
                          <td className="px-4 py-3.5">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${method.bg}`}>
                              <MethodIcon className={`w-3.5 h-3.5 ${method.color}`} />
                              <span className={`text-xs font-medium ${method.color}`}>{method.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600">
                            {formatDateIST(payment.paymentDate)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-mono text-gray-600">
                            {payment.transactionReference || '-'}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1">
                              {/* Download */}
                              <button
                                onClick={() => handleDownloadPayment(payment)}
                                disabled={actionLoading === payment.id}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Download Receipt"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {/* View */}
                              <button
                                onClick={() => setSelectedPayment(payment)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {/* Edit */}
                              <button
                                onClick={() => handleEditPayment(payment)}
                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Edit Payment"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {/* Archive/Delete */}
                              <button
                                onClick={() => setDeleteConfirm(payment)}
                                disabled={actionLoading === payment.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Archive Payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
                  Showing {payments.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, payments.length)} of {payments.length} payments
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Detail Panel */}
      {selectedPayment && (
        <PaymentDetailPanel
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          formatCurrency={formatCurrency}
          formatDateIST={formatDateIST}
        />
      )}

      {/* Record Payment Modal */}
      {showRecordModal && (
        <RecordPaymentModal
          onClose={() => setShowRecordModal(false)}
          onSuccess={() => {
            setShowRecordModal(false);
            fetchPayments();
            showToast('Payment recorded successfully!');
          }}
          invoices={invoices}
          token={token}
        />
      )}

      {/* Delete/Archive Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Archive Payment</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to archive payment <strong>{deleteConfirm.paymentId}</strong>? This payment will be moved to archived records.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchivePayment(deleteConfirm)}
                disabled={actionLoading === deleteConfirm.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                {actionLoading === deleteConfirm.id && <RefreshCw className="w-4 h-4 animate-spin" />}
                Archive Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && editingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Payment</h3>
              <button onClick={() => { setShowEditModal(false); setEditingPayment(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment ID</label>
                <input type="text" value={editingPayment.paymentId} disabled className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input 
                  type="number" 
                  value={editingPayment.amount} 
                  onChange={(e) => setEditingPayment({ ...editingPayment, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference/UTR</label>
                <input 
                  type="text" 
                  value={editingPayment.transactionReference || ''} 
                  onChange={(e) => setEditingPayment({ ...editingPayment, transactionReference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea 
                  value={editingPayment.remarks || ''} 
                  onChange={(e) => setEditingPayment({ ...editingPayment, remarks: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowEditModal(false); setEditingPayment(null); }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`${API_BASE}/api/payments/${editingPayment.id}`, {
                      method: 'PUT',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        amount: editingPayment.amount,
                        transactionReference: editingPayment.transactionReference,
                        remarks: editingPayment.remarks
                      })
                    });
                    const result = await response.json();
                    if (result.success) {
                      showToast('Payment updated successfully');
                      setShowEditModal(false);
                      setEditingPayment(null);
                      fetchPayments();
                    } else {
                      showToast(result.message || 'Failed to update payment', 'error');
                    }
                  } catch (err) {
                    showToast('Failed to update payment', 'error');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
