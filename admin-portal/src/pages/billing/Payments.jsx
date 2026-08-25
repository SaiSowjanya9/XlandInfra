import { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Search,
  Download,
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
  Smartphone,
  FileCheck,
  MoreHorizontal,
  Edit,
  Trash2,
  FileText,
  Filter,
  Home,
  ChevronRight as ChevronRightIcon,
  Receipt,
  User,
  Send,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Format date display
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
  // Auto add slashes
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > maxLength) cleaned = cleaned.slice(0, maxLength);
  return cleaned;
};

// Payment method config with colors matching reference image
const PAYMENT_METHODS = {
  razorpay: { label: 'Razorpay', icon: CreditCard, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  cash: { label: 'Cash', icon: Banknote, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  upi: { label: 'UPI', icon: Smartphone, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  debit_credit_card: { label: 'Card', icon: CreditCard, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  check: { label: 'Cheque', icon: FileCheck, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  other: { label: 'Other', icon: CreditCard, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' }
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

// Format currency
const formatCurrencyShort = (amount) => {
  const num = parseFloat(amount) || 0;
  return '₹' + new Intl.NumberFormat('en-IN').format(num);
};

// Format date with time
const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: '-', time: '' };
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

// Verify Payment Modal
const VerifyPaymentModal = ({ isOpen, onClose, onSuccess, payment }) => {
  const [formData, setFormData] = useState({
    status: 'paid',
    verificationNotes: '',
    rejectionReason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = getAuthToken();

  useEffect(() => {
    if (payment) {
      setFormData({ status: 'paid', verificationNotes: '', rejectionReason: '' });
    }
  }, [payment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.status === 'failed' && !formData.rejectionReason) {
      setError('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/payments/${payment.id}/verify`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: formData.status,
          verificationNotes: formData.verificationNotes,
          rejectionReason: formData.rejectionReason
        })
      });

      const result = await response.json();
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.message || 'Failed to update payment');
      }
    } catch (err) {
      setError('Failed to update payment status');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !payment) return null;

  const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.other;
  const MethodIcon = method.icon;
  const dateTime = formatDateTime(payment.paymentDate);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Verify Payment</h2>
              <p className="text-sm text-gray-500">Review and update payment status</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/80 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-5">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Payment ID</p>
                <p className="font-semibold text-gray-900">{payment.paymentId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Invoice ID</p>
                <p className="font-medium text-gray-700">{payment.invoiceId || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-medium text-gray-700">{payment.customerName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="font-bold text-gray-900 text-lg">{formatCurrencyShort(payment.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${method.bg} ${method.color} border ${method.border}`}>
                  <MethodIcon className="w-3.5 h-3.5" />
                  {method.label}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Date</p>
                <p className="font-medium text-gray-700">{dateTime.date} {dateTime.time}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Reference / Transaction No.</p>
                <p className="font-mono text-gray-700">{payment.transactionId || payment.referenceNumber || '-'}</p>
              </div>
            </div>
          </div>

          {payment.paymentProof && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Proof</h3>
              <div className="flex items-center gap-3">
                <img src={payment.paymentProof} alt="Payment Proof" className="w-20 h-20 object-cover rounded-lg border" />
                <a href={payment.paymentProof} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  View Full Image
                </a>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Verification Action</h3>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                formData.status === 'paid' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" name="status" value="paid" checked={formData.status === 'paid'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="sr-only" />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.status === 'paid' ? 'border-green-500' : 'border-gray-300'}`}>
                  {formData.status === 'paid' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Verify & Mark as Paid</p>
                  <p className="text-xs text-gray-500">Payment has been verified and received successfully</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                formData.status === 'failed' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input type="radio" name="status" value="failed" checked={formData.status === 'failed'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="sr-only" />
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.status === 'failed' ? 'border-red-500' : 'border-gray-300'}`}>
                  {formData.status === 'failed' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Reject / Mark as Failed</p>
                  <p className="text-xs text-gray-500">Payment could not be verified or was incorrect</p>
                </div>
                <XCircle className="w-5 h-5 text-red-500" />
              </label>
            </div>

            {formData.status === 'failed' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason *</label>
                <textarea
                  value={formData.rejectionReason}
                  onChange={(e) => setFormData({ ...formData, rejectionReason: e.target.value })}
                  rows={2}
                  placeholder="Please provide a reason for rejection..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Verification Notes (Optional)</label>
              <textarea
                value={formData.verificationNotes}
                onChange={(e) => setFormData({ ...formData, verificationNotes: e.target.value })}
                rows={2}
                placeholder="Add any notes about this verification..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${
                formData.status === 'paid' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (formData.status === 'paid' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
              {formData.status === 'paid' ? 'Verify Payment' : 'Reject Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Receipt View Modal Component
const ReceiptModal = ({ isOpen, onClose, payment, onDownload, onSend, downloading }) => {
  if (!isOpen || !payment) return null;

  const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.other;
  
  // Calculate values
  const amountPaid = parseFloat(payment.amount) || 0;
  const invoiceTotal = parseFloat(payment.invoiceAmount) || amountPaid;
  const remainingBalance = parseFloat(payment.balanceAmount) || 0;
  const isFullyPaid = remainingBalance <= 0;
  
  // Format date
  const paymentDateFormatted = payment.paymentDate 
    ? new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Action Buttons - Top Right */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          {payment.status === 'paid' && onSend && (
            <button
              onClick={() => onSend(payment)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              title="Send to Customer"
            >
              <Send className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <button
            onClick={() => onDownload(payment)}
            disabled={downloading}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            title="Download PDF"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin text-gray-600" /> : <Download className="w-4 h-4 text-gray-600" />}
          </button>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" title="Close">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-8 overflow-y-auto max-h-[90vh]">
          {/* Header - Green checkmark with amount */}
          <div className="flex items-start gap-4 mb-2">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">You paid {formatCurrencyShort(amountPaid)}</h2>
              <p className="text-gray-500 mt-1">to XLAND INFRA on {paymentDateFormatted}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-6"></div>

          {/* Payment Details Section */}
          <h3 className="text-lg font-semibold text-gray-900 mb-5">Payment details</h3>

          <div className="space-y-4">
            {/* Invoice no */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Invoice no.</span>
              <span className="text-blue-600 font-medium">{payment.invoiceId || payment.paymentId}</span>
            </div>

            {/* Invoice amount */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Invoice amount</span>
              <span className="text-gray-900">{formatCurrencyShort(invoiceTotal)}</span>
            </div>

            {/* Amount paid */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Amount paid</span>
              <span className="text-gray-900 font-semibold">{formatCurrencyShort(amountPaid)}</span>
            </div>

            {/* Remaining balance */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Remaining balance</span>
              <span className={`font-semibold ${isFullyPaid ? 'text-green-600' : 'text-red-500'}`}>
                {isFullyPaid ? '₹0' : formatCurrencyShort(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-6"></div>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${isFullyPaid ? 'text-green-600' : 'text-amber-500'}`}>
                {isFullyPaid ? 'Fully Paid' : 'Partially Paid'}
              </span>
            </div>

            {/* Payment method */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Payment method</span>
              <span className="text-gray-900">{method.label}</span>
            </div>

            {/* Reference ID */}
            {(payment.transactionReference || payment.referenceNumber) && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Reference ID</span>
                <span className="text-gray-900 font-mono text-sm">{payment.transactionReference || payment.referenceNumber}</span>
              </div>
            )}

            {/* Receipt ID */}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Receipt ID</span>
              <span className="text-gray-900">{payment.paymentId}</span>
            </div>

            {/* Customer */}
            {(payment.customerName || payment.propertyName) && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Customer</span>
                <span className="text-gray-900">{payment.customerName || payment.propertyName}</span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-8 pt-4">
            <p className="text-gray-400 text-sm leading-relaxed">
              Please don't reply to this email, if you need any help regarding this message, please contact the business directly.
            </p>
            
            <p className="text-gray-900 mt-6">Thank you,</p>
            <p className="text-gray-900 font-semibold">XLAND INFRA PM SERVICES PVT LTD</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Payments = ({ user, portalType = 'admin' }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPaymentForVerify, setSelectedPaymentForVerify] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  const token = getAuthToken();

  useEffect(() => {
    if (location.state?.message) {
      showToast(location.state.message, 'success');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/payments`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (methodFilter !== 'all') params.append('paymentMethod', methodFilter);
      const search = headerSearchTerm || searchTerm;
      if (search) params.append('search', search);
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
  }, [token, statusFilter, methodFilter, searchTerm, headerSearchTerm, dateRange]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // View payment receipt
  const handleViewReceipt = (payment) => {
    setSelectedPaymentForReceipt(payment);
    setShowReceiptModal(true);
  };

  // Download receipt PDF
  const handleDownloadReceipt = async (payment) => {
    setDownloadingReceipt(true);
    try {
      const response = await fetch(`${API_BASE}/api/payments/${payment.id}/receipt/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate receipt');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${payment.paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Receipt downloaded successfully!');
    } catch (err) {
      console.error('Error downloading receipt:', err);
      showToast('Failed to download receipt', 'error');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  // Send receipt email to customer
  const handleSendReceipt = async (payment) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/${payment.id}/receipt/send`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      if (result.success) {
        showToast('Receipt sent to customer successfully!');
        fetchPayments();
      } else {
        showToast(result.message || 'Failed to send receipt', 'error');
      }
    } catch (err) {
      console.error('Error sending receipt:', err);
      showToast('Failed to send receipt', 'error');
    }
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
    const search = headerSearchTerm || searchTerm;
    const matchesSearch = !search ||
      payment.paymentId?.toLowerCase().includes(search.toLowerCase()) ||
      payment.invoiceId?.toLowerCase().includes(search.toLowerCase()) ||
      payment.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      payment.propertyCode?.toLowerCase().includes(search.toLowerCase()) ||
      payment.propertyName?.toLowerCase().includes(search.toLowerCase());
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
      'Property': p.propertyCode || p.propertyId,
      'Method': PAYMENT_METHODS[p.paymentMethod]?.label || p.paymentMethod,
      'Amount': parseFloat(p.amount) || 0,
      'Paid Date & Time': p.paymentDate ? new Date(p.paymentDate).toLocaleString('en-IN') : '',
      'Status': STATUS_CONFIG[p.status]?.label || p.status,
      'Reference/Transaction No.': p.transactionId || p.referenceNumber || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PaymentHistory');
    XLSX.writeFile(wb, `PaymentHistory_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported successfully!');
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const formatDateRangeDisplay = () => {
    if (!dateRange.start && !dateRange.end) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = now;
      return `${formatDateDisplay(start)} - ${formatDateDisplay(end)}`;
    }
    return `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
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
            <h1 className="text-xl font-bold text-gray-900">Payments</h1>
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
              <span>Billing & Payments</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
              <span className="text-gray-700">Payments</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Payment ID, Invoice ID, Customer, Property..."
                value={headerSearchTerm}
                onChange={(e) => { setHeaderSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <IndianRupee className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-0.5">This Month</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Received (Paid)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrencyShort(stats.paidAmount)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
            <div className="p-2.5 bg-orange-100 rounded-xl">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium whitespace-nowrap">Verification Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.verificationPending}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrencyShort(stats.verificationAmount)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Partially Paid</p>
              <p className="text-2xl font-bold text-gray-900">{stats.partiallyPaid}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrencyShort(stats.partiallyPaidAmount)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 shadow-sm">
            <div className="p-2.5 bg-red-100 rounded-xl">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Failed / Refunded</p>
              <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrencyShort(stats.failedAmount)}</p>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search payments..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="verification_pending">Verification Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Payment Methods</option>
                <option value="razorpay">Razorpay</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="check">Cheque</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={propertyTypeFilter}
                onChange={(e) => { setPropertyTypeFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Property Types</option>
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="commercial">Commercial</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={formatDateIST(dateRange.start)}
                onChange={(e) => {
                  const formatted = handleISTDateInput(e.target.value);
                  if (formatted.length === 10) {
                    setDateRange(prev => ({ ...prev, start: parseISTDate(formatted) }));
                  } else if (formatted.length === 0) {
                    setDateRange(prev => ({ ...prev, start: '' }));
                  }
                }}
                onBlur={(e) => {
                  const parsed = parseISTDate(e.target.value);
                  if (parsed) setDateRange(prev => ({ ...prev, start: parsed }));
                }}
                className="text-sm border-none focus:outline-none bg-transparent w-[90px] text-center"
              />
              <span className="text-gray-400">-</span>
              <input
                type="text"
                placeholder="dd/mm/yyyy"
                value={formatDateIST(dateRange.end)}
                onChange={(e) => {
                  const formatted = handleISTDateInput(e.target.value);
                  if (formatted.length === 10) {
                    setDateRange(prev => ({ ...prev, end: parseISTDate(formatted) }));
                  } else if (formatted.length === 0) {
                    setDateRange(prev => ({ ...prev, end: '' }));
                  }
                }}
                onBlur={(e) => {
                  const parsed = parseISTDate(e.target.value);
                  if (parsed) setDateRange(prev => ({ ...prev, end: parsed }));
                }}
                className="text-sm border-none focus:outline-none bg-transparent w-[90px] text-center"
              />
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>

            <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : paginatedPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No payments found</p>
              <p className="text-sm">Payment records will appear here</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3.5 w-10">
                        <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment ID</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice ID</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property ID</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid Date</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference / Transaction No.</th>
                      <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedPayments.map((payment) => {
                      const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.other;
                      const status = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
                      const MethodIcon = method.icon;
                      const dateTime = formatDateTime(payment.paymentDate);

                      return (
                        <tr key={payment.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-4">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleViewReceipt(payment)}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {payment.paymentId}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600">{payment.invoiceId || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-800">{payment.customerName || payment.propertyName || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600">{payment.propertyCode || payment.propertyId || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${method.bg} ${method.color} border ${method.border}`}>
                              <MethodIcon className="w-3.5 h-3.5" />
                              {method.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrencyShort(payment.amount)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-800">{dateTime.date}</div>
                            <div className="text-xs text-gray-500">{dateTime.time}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {payment.status === 'verification_pending' ? (
                              <button
                                onClick={() => {
                                  setSelectedPaymentForVerify(payment);
                                  setShowVerifyModal(true);
                                }}
                                className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${status.color} hover:opacity-80 cursor-pointer transition-opacity`}
                                title="Click to verify payment"
                              >
                                {status.label}
                              </button>
                            ) : (
                              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                {status.label}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600 font-mono">{payment.transactionId || payment.referenceNumber || '-'}</span>
                          </td>
                          <td className="px-4 py-4 text-center relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === payment.id ? null : payment.id)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg"
                            >
                              <MoreHorizontal className="w-5 h-5 text-gray-400" />
                            </button>
                            {actionMenuOpen === payment.id && (
                              <div className="absolute right-4 top-12 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-2 min-w-[160px]">
                                {payment.status === 'verification_pending' && (
                                  <>
                                    <button 
                                      onClick={() => {
                                        setSelectedPaymentForVerify(payment);
                                        setShowVerifyModal(true);
                                        setActionMenuOpen(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2 font-medium"
                                    >
                                      <CheckCircle className="w-4 h-4" /> Verify Payment
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                  </>
                                )}
                                <button 
                                  onClick={() => { handleViewReceipt(payment); setActionMenuOpen(null); }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" /> View Receipt
                                </button>
                                <button 
                                  onClick={() => { handleDownloadReceipt(payment); setActionMenuOpen(null); }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" /> Download Receipt
                                </button>
                                {payment.status === 'paid' && (
                                  <button 
                                    onClick={() => { handleSendReceipt(payment); setActionMenuOpen(null); }}
                                    className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                                  >
                                    <Send className="w-4 h-4" /> Send Receipt
                                  </button>
                                )}
                                <div className="border-t border-gray-100 my-1"></div>
                                <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
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
              <div className="flex items-center justify-between px-4 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPayments.length)} of {filteredPayments.length} payments
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {getPageNumbers().map((page, idx) => (
                      page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative ml-4">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <VerifyPaymentModal
        isOpen={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);
          setSelectedPaymentForVerify(null);
        }}
        onSuccess={() => {
          fetchPayments();
          showToast('Payment status updated successfully!');
        }}
        payment={selectedPaymentForVerify}
      />

      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedPaymentForReceipt(null);
        }}
        payment={selectedPaymentForReceipt}
        onDownload={handleDownloadReceipt}
        onSend={handleSendReceipt}
        downloading={downloadingReceipt}
      />

      {actionMenuOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenuOpen(null)} />
      )}
    </div>
  );
};

export default Payments;
