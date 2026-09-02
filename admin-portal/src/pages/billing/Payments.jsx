import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useFP } from '../../contexts/FPContext';
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
  Info,
  Copy,
  Check,
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

// Normalize property type to consistent format
const formatPropertyType = (type) => {
  if (!type) return '-';
  const normalized = type.toLowerCase().trim();
  
  if (normalized === 'gc' || normalized === 'gated community' || normalized === 'gatedcommunity') {
    return 'Gated Community';
  }
  if (normalized === 'apt' || normalized === 'apartment' || normalized === 'flat' || normalized === 'flats') {
    return 'Apartment';
  }
  if (normalized === 'villa' || normalized === 'villas' || normalized === 'independent house' || normalized === 'individual house') {
    return 'Villa';
  }
  if (normalized === 'commercial' || normalized === 'comm' || normalized === 'office' || normalized === 'shop') {
    return 'Commercial';
  }
  if (normalized === 'plot' || normalized === 'land') {
    return 'Plot';
  }
  if (normalized === 'row house' || normalized === 'rowhouse' || normalized === 'townhouse') {
    return 'Row House';
  }
  
  return type.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
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

// Cash Payment Verification Modal - Detailed form for verifying cash payments
const CashPaymentVerifyModal = ({ isOpen, onClose, onSuccess, payment, user }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Payment Details, 2: Review & Confirm
  const [formData, setFormData] = useState({
    amountReceived: '',
    receivedDate: new Date().toISOString().split('T')[0],
    receivedById: '',
    receivedBy: '',
    paymentLocation: 'office',
    receiptNumber: '',
    notes: '',
    verificationNotes: '',
    rejectionReason: '',
    action: 'verify' // 'verify' or 'reject'
  });
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = getAuthToken();

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const response = await fetch(`${API_BASE}/api/staff`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          setEmployees((result.data || []).filter(emp => emp.status === 'active'));
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    if (isOpen) fetchEmployees();
  }, [isOpen, token]);

  // Initialize form data when payment changes
  useEffect(() => {
    if (payment) {
      setFormData(prev => ({
        ...prev,
        amountReceived: (parseFloat(payment.amount) || 0).toFixed(2),
        receivedDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        receiptNumber: payment.transactionId || payment.referenceNumber || '',
        receivedBy: payment.receivedByName || '',
        action: 'verify'
      }));
      setCurrentStep(1);
      setError('');
    }
  }, [payment]);

  const handleNextStep = () => {
    // Validate step 1
    if (!formData.amountReceived || parseFloat(formData.amountReceived) <= 0) {
      setError('Please enter the amount received');
      return;
    }
    if (!formData.receivedDate) {
      setError('Please select the date when payment was received');
      return;
    }
    if (!formData.receivedById && !formData.receivedBy) {
      setError('Please select or enter who received the payment');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    if (formData.action === 'reject' && !formData.rejectionReason) {
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
          status: formData.action === 'verify' ? 'paid' : 'failed',
          amountReceived: formData.amountReceived,
          receivedDate: formData.receivedDate,
          receivedById: formData.receivedById,
          receivedBy: formData.receivedBy,
          paymentLocation: formData.paymentLocation,
          receiptNumber: formData.receiptNumber,
          verificationNotes: formData.notes || formData.verificationNotes,
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
  
  // Calculate days until due
  const getDaysInfo = () => {
    if (!payment.dueDate) return null;
    const today = new Date();
    const due = new Date(payment.dueDate);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return { days: Math.abs(diffDays), isOverdue: diffDays < 0 };
  };
  const daysInfo = getDaysInfo();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <button onClick={currentStep > 1 ? () => setCurrentStep(1) : onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Cash Payment</h2>
              <p className="text-sm text-gray-500">Provide cash payment details and mark as complete</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Invoice Summary Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice ID</p>
                <p className="font-semibold text-blue-600 mt-1">{payment.invoiceId || payment.paymentId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-medium text-gray-900 mt-1">{payment.customerName || payment.propertyName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
                <p className="font-medium text-gray-900 mt-1">{formatDateDisplay(payment.invoiceDate || payment.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Due Date</p>
                <p className={`font-medium mt-1 ${daysInfo?.isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDateDisplay(payment.dueDate) || '-'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Amount Payable</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrencyShort(payment.amount)}</p>
              {daysInfo && (
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mt-1 ${daysInfo.isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  <Clock className="w-3 h-3" />
                  {daysInfo.isOverdue ? `Overdue by ${daysInfo.days} days` : `Due in ${daysInfo.days} days`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-4 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Select Payment Method</p>
              <p className="text-xs text-gray-500">{method.label}</p>
            </div>
          </div>
          <div className={`w-12 h-0.5 ${currentStep >= 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className="flex items-center gap-2">
            {currentStep > 1 ? (
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            )}
            <div>
              <p className={`text-sm font-medium ${currentStep >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>Payment Details</p>
              <p className="text-xs text-gray-500">Enter payment information</p>
            </div>
          </div>
          <div className={`w-12 h-0.5 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
            <div>
              <p className={`text-sm font-medium ${currentStep === 2 ? 'text-gray-900' : 'text-gray-400'}`}>Review & Confirm</p>
              <p className="text-xs text-gray-500">Review and complete payment</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-320px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
            </div>
          )}

          {/* Step 1: Payment Details */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Cash Payment Details</h3>
              <p className="text-sm text-gray-500 mb-6">Enter the cash payment information below</p>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Form Fields */}
                <div className="col-span-2 space-y-5">
                  {/* Amount Received & Received Date Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Received <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                        <input 
                          type="text" 
                          value={formData.amountReceived} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            setFormData(prev => ({ ...prev, amountReceived: value }));
                          }}
                          className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="15,000.00" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Received Date <span className="text-red-500">*</span></label>
                      <input 
                        type="date" 
                        value={formData.receivedDate} 
                        onChange={(e) => setFormData(prev => ({ ...prev, receivedDate: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      />
                    </div>
                  </div>

                  {/* Received By & Payment Location Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Received By <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          value={formData.receivedById}
                          onChange={(e) => {
                            const selectedEmp = employees.find(emp => emp.id === parseInt(e.target.value));
                            setFormData(prev => ({ 
                              ...prev, 
                              receivedById: e.target.value,
                              receivedBy: selectedEmp ? `${selectedEmp.firstName || ''} ${selectedEmp.lastName || ''}`.trim() : ''
                            }));
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Staff / Employee</option>
                          {loadingEmployees ? (
                            <option disabled>Loading employees...</option>
                          ) : (
                            employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.firstName || ''} {emp.lastName || ''} ({emp.userId || emp.role || 'Staff'})
                              </option>
                            ))
                          )}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Location <span className="text-red-500">*</span></label>
                      <div className="space-y-2 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="paymentLocation" 
                            value="office" 
                            checked={formData.paymentLocation === 'office'} 
                            onChange={(e) => setFormData(prev => ({ ...prev, paymentLocation: e.target.value }))}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Office / Collection Point</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="paymentLocation" 
                            value="property_site" 
                            checked={formData.paymentLocation === 'property_site'} 
                            onChange={(e) => setFormData(prev => ({ ...prev, paymentLocation: e.target.value }))}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">At Property Site</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Receipt / Reference No. */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipt / Reference No.</label>
                    <input 
                      type="text" 
                      value={formData.receiptNumber} 
                      onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Enter receipt or reference number" 
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
                    <textarea 
                      value={formData.notes} 
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
                      rows={3} 
                      placeholder="Add any additional notes about this payment..." 
                    />
                  </div>
                </div>

                {/* Right Column - Info Cards */}
                <div className="space-y-4">
                  {/* Cash Payment Info Card */}
                  <div className="border border-green-200 rounded-xl p-5 bg-green-50/50">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Banknote className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Cash Payment</h4>
                        <p className="text-sm text-green-600 font-medium">No Additional Charges</p>
                        <p className="text-xs text-gray-500 mt-2">Collect cash from the customer and record the payment details.</p>
                      </div>
                    </div>
                  </div>

                  {/* Important Reminders Card */}
                  <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/50">
                    <h4 className="font-semibold text-amber-800 mb-3">Important Reminders</h4>
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Count and verify the cash amount before saving</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Provide a receipt to the customer</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Keep the cash in the safe / cash box</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Update the payment status after collection</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Info Notice */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-700">After saving, the payment will be marked as "Verification Pending".</p>
              </div>
            </div>
          )}

          {/* Step 2: Review & Confirm */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Review Payment Information</h3>
                <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                  <Edit className="w-4 h-4" /> Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Payment Details Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Payment Details</h4>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount Received</span>
                      <span className="font-semibold text-gray-900">{formatCurrencyShort(formData.amountReceived)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Received Date</span>
                      <span className="font-medium text-gray-900">{formatDateDisplay(formData.receivedDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Received By</span>
                      <span className="font-medium text-gray-900">{formData.receivedBy || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Location</span>
                      <span className="font-medium text-gray-900">{formData.paymentLocation === 'office' ? 'Office / Collection Point' : 'At Property Site'}</span>
                    </div>
                    {formData.receiptNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Receipt / Ref No.</span>
                        <span className="font-medium text-gray-900 font-mono">{formData.receiptNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Action Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h4 className="font-semibold text-gray-900 mb-4">Verification Action</h4>
                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.action === 'verify' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="action" value="verify" checked={formData.action === 'verify'} onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.action === 'verify' ? 'border-green-500' : 'border-gray-300'}`}>
                        {formData.action === 'verify' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Verify & Mark as Paid</p>
                        <p className="text-xs text-gray-500">Payment verified successfully</p>
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.action === 'reject' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="radio" name="action" value="reject" checked={formData.action === 'reject'} onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.action === 'reject' ? 'border-red-500' : 'border-gray-300'}`}>
                        {formData.action === 'reject' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Reject Payment</p>
                        <p className="text-xs text-gray-500">Payment could not be verified</p>
                      </div>
                      <XCircle className="w-5 h-5 text-red-500" />
                    </label>

                    {formData.action === 'reject' && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason *</label>
                        <textarea
                          value={formData.rejectionReason}
                          onChange={(e) => setFormData(prev => ({ ...prev, rejectionReason: e.target.value }))}
                          rows={2}
                          placeholder="Please provide a reason..."
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {formData.notes && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600">{formData.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button 
            onClick={currentStep > 1 ? () => setCurrentStep(1) : onClose} 
            className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          
          {currentStep === 1 ? (
            <button 
              onClick={handleNextStep}
              className="flex items-center gap-4 px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            >
              <div className="text-left">
                <p className="font-semibold">Review Payment</p>
                <p className="text-xs text-blue-100">Review and confirm payment details</p>
              </div>
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className={`flex items-center gap-2 px-8 py-2.5 rounded-lg font-medium shadow-lg ${
                formData.action === 'verify' 
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20' 
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
              }`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (formData.action === 'verify' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
              {formData.action === 'verify' ? 'Verify & Complete Payment' : 'Reject Payment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Cheque Payment Verification Modal - Detailed form for verifying cheque payments
const ChequePaymentVerifyModal = ({ isOpen, onClose, onSuccess, payment, user }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Payment Details, 2: Review & Confirm
  const [formData, setFormData] = useState({
    checkNumber: '',
    checkDate: new Date().toISOString().split('T')[0],
    bankName: '',
    branchName: '',
    payeeName: 'XLAND INFRA PM SERVICES PVT LTD',
    amountReceived: '',
    receivedById: '',
    receivedBy: '',
    paymentLocation: 'office',
    notes: '',
    verificationNotes: '',
    rejectionReason: '',
    action: 'verify' // 'verify' or 'reject'
  });
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = getAuthToken();

  // Bank list for dropdown
  const banks = [
    'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Punjab National Bank',
    'Bank of Baroda',
    'Canara Bank',
    'Union Bank of India',
    'Indian Bank',
    'Bank of India',
    'Central Bank of India',
    'Indian Overseas Bank',
    'UCO Bank',
    'IDBI Bank',
    'Kotak Mahindra Bank',
    'IndusInd Bank',
    'Yes Bank',
    'Federal Bank',
    'South Indian Bank',
    'Karur Vysya Bank',
    'Other'
  ];

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const response = await fetch(`${API_BASE}/api/staff`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          setEmployees((result.data || []).filter(emp => emp.status === 'active'));
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    if (isOpen) fetchEmployees();
  }, [isOpen, token]);

  // Initialize form data when payment changes
  useEffect(() => {
    if (payment) {
      setFormData(prev => ({
        ...prev,
        amountReceived: (parseFloat(payment.amount) || 0).toFixed(2),
        checkDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        checkNumber: payment.transactionId || payment.referenceNumber || '',
        receivedBy: payment.receivedByName || '',
        action: 'verify'
      }));
      setCurrentStep(1);
      setError('');
    }
  }, [payment]);

  const handleNextStep = () => {
    // Validate step 1
    if (!formData.checkNumber) {
      setError('Please enter the cheque number');
      return;
    }
    if (!formData.checkDate) {
      setError('Please select the cheque date');
      return;
    }
    if (!formData.bankName) {
      setError('Please select the bank name');
      return;
    }
    if (!formData.payeeName) {
      setError('Please enter the payee name');
      return;
    }
    if (!formData.amountReceived || parseFloat(formData.amountReceived) <= 0) {
      setError('Please enter the cheque amount');
      return;
    }
    if (!formData.receivedById && !formData.receivedBy) {
      setError('Please select who received the cheque');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    if (formData.action === 'reject' && !formData.rejectionReason) {
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
          status: formData.action === 'verify' ? 'paid' : 'failed',
          paymentMethod: 'cheque',
          checkNumber: formData.checkNumber,
          checkDate: formData.checkDate,
          bankName: formData.bankName,
          branchName: formData.branchName,
          payeeName: formData.payeeName,
          amountReceived: formData.amountReceived,
          receivedById: formData.receivedById,
          receivedBy: formData.receivedBy,
          paymentLocation: formData.paymentLocation,
          verificationNotes: formData.notes || formData.verificationNotes,
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

  const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.check;
  
  // Calculate days until due
  const getDaysInfo = () => {
    if (!payment.dueDate) return null;
    const today = new Date();
    const due = new Date(payment.dueDate);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return { days: Math.abs(diffDays), isOverdue: diffDays < 0 };
  };
  const daysInfo = getDaysInfo();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <button onClick={currentStep > 1 ? () => setCurrentStep(1) : onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Cheque Payment</h2>
              <p className="text-sm text-gray-500">Provide check payment details and mark as complete</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Invoice Summary Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice ID</p>
                <p className="font-semibold text-blue-600 mt-1">{payment.invoiceId || payment.paymentId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-medium text-gray-900 mt-1">{payment.customerName || payment.propertyName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
                <p className="font-medium text-gray-900 mt-1">{formatDateDisplay(payment.invoiceDate || payment.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Due Date</p>
                <p className={`font-medium mt-1 ${daysInfo?.isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDateDisplay(payment.dueDate) || '-'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Amount Payable</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrencyShort(payment.amount)}</p>
              {daysInfo && (
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mt-1 ${daysInfo.isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  <Clock className="w-3 h-3" />
                  {daysInfo.isOverdue ? `Overdue by ${daysInfo.days} days` : `Due in ${daysInfo.days} days`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-4 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Select Payment Method</p>
              <p className="text-xs text-gray-500">Cheque</p>
            </div>
          </div>
          <div className={`w-12 h-0.5 ${currentStep >= 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className="flex items-center gap-2">
            {currentStep > 1 ? (
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            )}
            <div>
              <p className={`text-sm font-medium ${currentStep >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>Payment Details</p>
              <p className="text-xs text-gray-500">Enter check information</p>
            </div>
          </div>
          <div className={`w-12 h-0.5 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
            <div>
              <p className={`text-sm font-medium ${currentStep === 2 ? 'text-gray-900' : 'text-gray-400'}`}>Review & Confirm</p>
              <p className="text-xs text-gray-500">Review and complete payment</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-320px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
            </div>
          )}

          {/* Step 1: Cheque Payment Details */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Cheque Payment Details</h3>
              <p className="text-sm text-gray-500 mb-6">Enter the check payment information below</p>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Form Fields */}
                <div className="col-span-2 space-y-5">
                  {/* Cheque Number & Cheque Date Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Cheque Number <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.checkNumber} 
                        onChange={(e) => setFormData(prev => ({ ...prev, checkNumber: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="Enter check number" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Cheque Date <span className="text-red-500">*</span></label>
                      <input 
                        type="date" 
                        value={formData.checkDate} 
                        onChange={(e) => setFormData(prev => ({ ...prev, checkDate: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      />
                    </div>
                  </div>

                  {/* Bank Name & Branch Name Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          value={formData.bankName}
                          onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Bank</option>
                          {banks.map(bank => (
                            <option key={bank} value={bank}>{bank}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch Name</label>
                      <input 
                        type="text" 
                        value={formData.branchName} 
                        onChange={(e) => setFormData(prev => ({ ...prev, branchName: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="Enter branch name" 
                      />
                    </div>
                  </div>

                  {/* Payee Name & Amount Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Payee Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.payeeName} 
                        onChange={(e) => setFormData(prev => ({ ...prev, payeeName: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="Enter payee name" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹) <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.amountReceived} 
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setFormData(prev => ({ ...prev, amountReceived: value }));
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="15,000.00" 
                      />
                    </div>
                  </div>

                  {/* Received By & Payment Location Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Received By <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          value={formData.receivedById}
                          onChange={(e) => {
                            const selectedEmp = employees.find(emp => emp.id === parseInt(e.target.value));
                            setFormData(prev => ({ 
                              ...prev, 
                              receivedById: e.target.value,
                              receivedBy: selectedEmp ? `${selectedEmp.firstName || ''} ${selectedEmp.lastName || ''}`.trim() : ''
                            }));
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Staff / Employee</option>
                          {loadingEmployees ? (
                            <option disabled>Loading employees...</option>
                          ) : (
                            employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.firstName || ''} {emp.lastName || ''} ({emp.userId || emp.role || 'Staff'})
                              </option>
                            ))
                          )}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Location <span className="text-red-500">*</span></label>
                      <div className="space-y-2 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="chequePaymentLocation" 
                            value="office" 
                            checked={formData.paymentLocation === 'office'} 
                            onChange={(e) => setFormData(prev => ({ ...prev, paymentLocation: e.target.value }))}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">Office / Collection Point</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="chequePaymentLocation" 
                            value="property_site" 
                            checked={formData.paymentLocation === 'property_site'} 
                            onChange={(e) => setFormData(prev => ({ ...prev, paymentLocation: e.target.value }))}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">At Property Site</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
                    <textarea 
                      value={formData.notes} 
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
                      rows={3} 
                      placeholder="Add any additional notes about this payment..." 
                    />
                  </div>
                </div>

                {/* Right Column - Info Cards */}
                <div className="space-y-4">
                  {/* Cheque Payment Info Card */}
                  <div className="border border-purple-200 rounded-xl p-5 bg-purple-50/50">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileCheck className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Cheque Payment</h4>
                        <p className="text-sm text-purple-600 font-medium">No Additional Charges</p>
                        <p className="text-xs text-gray-500 mt-2">We will deposit the check and update the payment status once it is cleared.</p>
                      </div>
                    </div>
                  </div>

                  {/* Important Reminders Card */}
                  <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/50">
                    <h4 className="font-semibold text-amber-800 mb-3">Important Reminders</h4>
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Ensure the check is valid and not expired</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Write the correct payee name</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Post-dated checks will be cleared on the given date</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>Payment status will be updated after check clearance</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Info Notice */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-700">After saving, the payment will be marked as "Verification Pending" until the check is cleared.</p>
              </div>
            </div>
          )}

          {/* Step 2: Review & Confirm */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Review Cheque Payment Information</h3>
                <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                  <Edit className="w-4 h-4" /> Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Check Details Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Check Details</h4>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cheque Number</span>
                      <span className="font-semibold text-gray-900 font-mono">{formData.checkNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cheque Date</span>
                      <span className="font-medium text-gray-900">{formatDateDisplay(formData.checkDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bank Name</span>
                      <span className="font-medium text-gray-900">{formData.bankName}</span>
                    </div>
                    {formData.branchName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Branch Name</span>
                        <span className="font-medium text-gray-900">{formData.branchName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payee Name</span>
                      <span className="font-medium text-gray-900">{formData.payeeName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount</span>
                      <span className="font-semibold text-gray-900">{formatCurrencyShort(formData.amountReceived)}</span>
                    </div>
                  </div>
                </div>

                {/* Collection Details & Action Card */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Collection Details</h4>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Received By</span>
                        <span className="font-medium text-gray-900">{formData.receivedBy || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Payment Location</span>
                        <span className="font-medium text-gray-900">{formData.paymentLocation === 'office' ? 'Office / Collection Point' : 'At Property Site'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Verification Action */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Verification Action</h4>
                    <div className="space-y-3">
                      <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.action === 'verify' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="radio" name="chequeAction" value="verify" checked={formData.action === 'verify'} onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} className="sr-only" />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.action === 'verify' ? 'border-green-500' : 'border-gray-300'}`}>
                          {formData.action === 'verify' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Verify & Mark as Paid</p>
                          <p className="text-xs text-gray-500">Check cleared successfully</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </label>

                      <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.action === 'reject' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="radio" name="chequeAction" value="reject" checked={formData.action === 'reject'} onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} className="sr-only" />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.action === 'reject' ? 'border-red-500' : 'border-gray-300'}`}>
                          {formData.action === 'reject' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Reject / Check Bounced</p>
                          <p className="text-xs text-gray-500">Check could not be cleared</p>
                        </div>
                        <XCircle className="w-5 h-5 text-red-500" />
                      </label>

                      {formData.action === 'reject' && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason *</label>
                          <textarea
                            value={formData.rejectionReason}
                            onChange={(e) => setFormData(prev => ({ ...prev, rejectionReason: e.target.value }))}
                            rows={2}
                            placeholder="Please provide a reason (e.g., Cheque bounced, signature mismatch)..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {formData.notes && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600">{formData.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button 
            onClick={currentStep > 1 ? () => setCurrentStep(1) : onClose} 
            className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          
          {currentStep === 1 ? (
            <button 
              onClick={handleNextStep}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            >
              Review Payment <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className={`flex items-center gap-2 px-8 py-2.5 rounded-lg font-medium shadow-lg ${
                formData.action === 'verify' 
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20' 
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
              }`}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (formData.action === 'verify' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
              {formData.action === 'verify' ? 'Verify & Complete Payment' : 'Reject Payment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Bank Transfer Payment Verification Modal - Detailed form for verifying bank transfer payments
const BankTransferVerifyModal = ({ isOpen, onClose, onSuccess, payment, user }) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Payment Details, 2: Review & Confirm
  const [formData, setFormData] = useState({
    amountReceived: '',
    transferDate: new Date().toISOString().split('T')[0],
    utrNumber: '',
    senderBankName: '',
    senderAccountNumber: '',
    receivedById: '',
    receivedBy: '',
    paymentProof: null,
    paymentProofPreview: null,
    notes: '',
    verificationNotes: '',
    rejectionReason: '',
    action: 'verify' // 'verify' or 'reject'
  });
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const token = getAuthToken();

  // Bank account details (company's receiving account)
  const bankDetails = {
    accountHolderName: 'XLAND INFRA PM SERVICES PVT LTD',
    bankName: 'HDFC Bank',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    accountType: 'Current Account',
    branch: 'Gachibowli, Hyderabad'
  };

  // Generate reference number
  const generateReferenceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `XLAND${year}${month}${day}${random}`;
  };

  const [referenceNumber] = useState(generateReferenceNumber);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const response = await fetch(`${API_BASE}/api/staff`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          setEmployees((result.data || []).filter(emp => emp.status === 'active'));
        }
      } catch (err) {
        console.error('Error fetching employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    if (isOpen) fetchEmployees();
  }, [isOpen, token]);

  // Initialize form data when payment changes
  useEffect(() => {
    if (payment) {
      setFormData(prev => ({
        ...prev,
        amountReceived: (parseFloat(payment.amount) || 0).toFixed(2),
        transferDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        utrNumber: payment.transactionId || payment.referenceNumber || '',
        receivedBy: payment.receivedByName || '',
        action: 'verify',
        paymentProof: null,
        paymentProofPreview: null
      }));
      setCurrentStep(1);
      setError('');
    }
  }, [payment]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, or PDF.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large. Maximum 5MB allowed.');
      return;
    }

    setError('');
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          paymentProof: file,
          paymentProofPreview: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormData(prev => ({
        ...prev,
        paymentProof: file,
        paymentProofPreview: 'pdf'
      }));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const input = fileInputRef.current;
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      handleFileSelect({ target: { files: [file] } });
    }
  };

  const handleNextStep = () => {
    // Validate step 1
    if (!formData.amountReceived || parseFloat(formData.amountReceived) <= 0) {
      setError('Please enter the transfer amount');
      return;
    }
    if (!formData.transferDate) {
      setError('Please select the transfer date');
      return;
    }
    if (!formData.utrNumber) {
      setError('Please enter the UTR/Transaction number');
      return;
    }
    if (!formData.receivedById && !formData.receivedBy) {
      setError('Please select who verified this transfer');
      return;
    }
    setError('');
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    if (formData.action === 'reject' && !formData.rejectionReason) {
      setError('Please provide a reason for rejection');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // If there's a payment proof, upload it first
      let paymentProofUrl = null;
      if (formData.paymentProof) {
        setUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.paymentProof);
        uploadFormData.append('type', 'payment_proof');
        
        const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: uploadFormData
        });
        
        const uploadResult = await uploadResponse.json();
        if (uploadResult.success) {
          paymentProofUrl = uploadResult.url || uploadResult.data?.url;
        }
        setUploading(false);
      }

      const response = await fetch(`${API_BASE}/api/payments/${payment.id}/verify`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: formData.action === 'verify' ? 'paid' : 'failed',
          paymentMethod: 'bank_transfer',
          amountReceived: formData.amountReceived,
          receivedDate: formData.transferDate,
          receivedById: formData.receivedById,
          receivedBy: formData.receivedBy,
          utrNumber: formData.utrNumber,
          senderBankName: formData.senderBankName,
          senderAccountNumber: formData.senderAccountNumber,
          referenceNumber: referenceNumber,
          paymentProof: paymentProofUrl,
          verificationNotes: formData.notes || formData.verificationNotes,
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
      setUploading(false);
    }
  };

  if (!isOpen || !payment) return null;

  const method = PAYMENT_METHODS[payment.paymentMethod] || PAYMENT_METHODS.bank_transfer;
  
  // Calculate days until due
  const getDaysInfo = () => {
    if (!payment.dueDate) return null;
    const today = new Date();
    const due = new Date(payment.dueDate);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return { days: Math.abs(diffDays), isOverdue: diffDays < 0 };
  };
  const daysInfo = getDaysInfo();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-3">
            <button onClick={currentStep > 1 ? () => setCurrentStep(1) : onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Bank Transfer Payment</h2>
              <p className="text-sm text-gray-500">Verify bank transfer and complete payment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Invoice Summary Bar */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-8">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice ID</p>
                <p className="font-semibold text-blue-600 mt-1">{payment.invoiceId || payment.paymentId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-medium text-gray-900 mt-1">{payment.customerName || payment.propertyName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
                <p className="font-medium text-gray-900 mt-1">{formatDateDisplay(payment.invoiceDate || payment.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Due Date</p>
                <p className={`font-medium mt-1 ${daysInfo?.isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                  {formatDateDisplay(payment.dueDate) || '-'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Amount Payable</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrencyShort(payment.amount)}</p>
              {daysInfo && (
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mt-1 ${daysInfo.isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  <Clock className="w-3 h-3" />
                  {daysInfo.isOverdue ? `Overdue by ${daysInfo.days} days` : `Due in ${daysInfo.days} days`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-center gap-4 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Select Payment Method</p>
              <p className="text-xs text-gray-500">Bank Transfer</p>
            </div>
          </div>
          <div className={`w-12 h-0.5 ${currentStep >= 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className="flex items-center gap-2">
            {currentStep > 1 ? (
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            )}
            <div>
              <p className={`text-sm font-medium ${currentStep >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>Payment Details</p>
              <p className="text-xs text-gray-500">Enter bank transfer details</p>
            </div>
          </div>
          <div className={`w-12 h-0.5 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
            <div>
              <p className={`text-sm font-medium ${currentStep === 2 ? 'text-gray-900' : 'text-gray-400'}`}>Review & Confirm</p>
              <p className="text-xs text-gray-500">Verify and complete payment</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-320px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
            </div>
          )}

          {/* Step 1: Bank Transfer Details */}
          {currentStep === 1 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Bank Transfer Details</h3>
              <p className="text-sm text-gray-500 mb-6">Verify the bank transfer information below</p>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - How it works + Bank Details */}
                <div className="space-y-5">
                  {/* How it works */}
                  <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/50">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">How it works?</h4>
                      </div>
                    </div>
                    <ol className="space-y-2 text-sm text-gray-700 ml-2">
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-600">1.</span>
                        <span>Customer transfers amount to bank account</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-600">2.</span>
                        <span>Verify the UTR/reference number in bank statement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-600">3.</span>
                        <span>Upload payment proof for records</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-blue-600">4.</span>
                        <span>Confirm and update payment status</span>
                      </li>
                    </ol>
                    <div className="mt-4 pt-3 border-t border-blue-200 flex items-center gap-2 text-blue-700">
                      <Info className="w-4 h-4" />
                      <span className="text-sm font-medium">No additional charges for Bank Transfer</span>
                    </div>
                  </div>

                  {/* Our Bank Account Details */}
                  <div className="border border-gray-200 rounded-xl p-5 bg-white">
                    <h4 className="font-semibold text-blue-700 mb-4">Our Bank Account Details</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-500">Account Holder Name</p>
                          <p className="font-semibold text-gray-900">{bankDetails.accountHolderName}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-500">Bank Name</p>
                          <p className="font-semibold text-gray-900">{bankDetails.bankName}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <p className="text-gray-500">Account Number</p>
                            <p className="font-semibold text-gray-900 font-mono">{bankDetails.accountNumber}</p>
                          </div>
                          <button onClick={() => copyToClipboard(bankDetails.accountNumber, 'account')} className="p-1 hover:bg-gray-100 rounded">
                            {copied === 'account' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <p className="text-gray-500">IFSC Code</p>
                            <p className="font-semibold text-gray-900 font-mono">{bankDetails.ifscCode}</p>
                          </div>
                          <button onClick={() => copyToClipboard(bankDetails.ifscCode, 'ifsc')} className="p-1 hover:bg-gray-100 rounded">
                            {copied === 'ifsc' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Receipt className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-500">Account Type</p>
                          <p className="font-semibold text-gray-900">{bankDetails.accountType}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Home className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-500">Branch</p>
                          <p className="font-semibold text-gray-900">{bankDetails.branch}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 pt-2 border-t border-gray-100">
                        <FileText className="w-4 h-4 text-blue-500 mt-0.5" />
                        <div className="flex-1 flex items-center justify-between">
                          <div>
                            <p className="text-gray-500">Reference / UTR Number</p>
                            <p className="font-semibold text-blue-600 font-mono">{referenceNumber}</p>
                          </div>
                          <button onClick={() => copyToClipboard(referenceNumber, 'ref')} className="p-1 hover:bg-gray-100 rounded">
                            {copied === 'ref' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">Verify the UTR number matches the customer's bank transfer</p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Transfer Details Form + Upload */}
                <div className="space-y-5">
                  {/* Transfer Details Form */}
                  <div className="space-y-4">
                    {/* Amount & Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Received (₹) <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          value={formData.amountReceived} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            setFormData(prev => ({ ...prev, amountReceived: value }));
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="15,000.00" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Transfer Date <span className="text-red-500">*</span></label>
                        <input 
                          type="date" 
                          value={formData.transferDate} 
                          onChange={(e) => setFormData(prev => ({ ...prev, transferDate: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        />
                      </div>
                    </div>

                    {/* UTR Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">UTR / Transaction Number <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.utrNumber} 
                        onChange={(e) => setFormData(prev => ({ ...prev, utrNumber: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="Enter UTR or transaction reference number" 
                      />
                    </div>

                    {/* Sender Bank Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender's Bank Name</label>
                        <input 
                          type="text" 
                          value={formData.senderBankName} 
                          onChange={(e) => setFormData(prev => ({ ...prev, senderBankName: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="E.g., HDFC Bank" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Sender's Account (Last 4 digits)</label>
                        <input 
                          type="text" 
                          value={formData.senderAccountNumber} 
                          onChange={(e) => setFormData(prev => ({ ...prev, senderAccountNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) }))}
                          maxLength={4}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="XXXX" 
                        />
                      </div>
                    </div>

                    {/* Verified By */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Verified By <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          value={formData.receivedById}
                          onChange={(e) => {
                            const selectedEmp = employees.find(emp => emp.id === parseInt(e.target.value));
                            setFormData(prev => ({ 
                              ...prev, 
                              receivedById: e.target.value,
                              receivedBy: selectedEmp ? `${selectedEmp.firstName || ''} ${selectedEmp.lastName || ''}`.trim() : ''
                            }));
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Staff / Employee</option>
                          {loadingEmployees ? (
                            <option disabled>Loading employees...</option>
                          ) : (
                            employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.firstName || ''} {emp.lastName || ''} ({emp.userId || emp.role || 'Staff'})
                              </option>
                            ))
                          )}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Upload Payment Proof */}
                  <div className="border border-gray-200 rounded-xl p-5">
                    <h4 className="font-semibold text-gray-900 mb-2">Upload Payment Proof</h4>
                    <p className="text-xs text-gray-500 mb-4">Please upload the screenshot or receipt of the bank transfer</p>
                    
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={handleFileSelect}
                        className="hidden" 
                      />
                      
                      {formData.paymentProofPreview ? (
                        <div className="space-y-3">
                          {formData.paymentProofPreview === 'pdf' ? (
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                              <FileText className="w-8 h-8" />
                              <span className="font-medium">{formData.paymentProof?.name}</span>
                            </div>
                          ) : (
                            <img src={formData.paymentProofPreview} alt="Payment Proof" className="max-h-32 mx-auto rounded-lg border" />
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, paymentProof: null, paymentProofPreview: null }));
                            }}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <Download className="w-8 h-8 text-gray-400 mx-auto mb-2 rotate-180" />
                          <p className="text-sm text-gray-600 mb-2">Drag & drop your file here or</p>
                          <span className="inline-block px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50">
                            Choose File
                          </span>
                          <p className="text-xs text-gray-400 mt-3">Supports: JPG, PNG, PDF (Max size: 5MB)</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Important Notes */}
                  <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/50">
                    <h4 className="font-semibold text-amber-800 mb-2">Important Notes</h4>
                    <ul className="space-y-1.5 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Verify the exact amount matches the transfer</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Cross-check UTR number with bank statement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Upload clear payment proof for records</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>Customer will receive confirmation once verified</span>
                      </li>
                    </ul>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
                    <textarea 
                      value={formData.notes} 
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" 
                      rows={2} 
                      placeholder="Add any additional notes..." 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review & Confirm */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Review Bank Transfer Payment</h3>
                <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
                  <Edit className="w-4 h-4" /> Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Transfer Details Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-green-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">Transfer Details</h4>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount Received</span>
                      <span className="font-semibold text-gray-900">{formatCurrencyShort(formData.amountReceived)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Transfer Date</span>
                      <span className="font-medium text-gray-900">{formatDateDisplay(formData.transferDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">UTR / Transaction No.</span>
                      <span className="font-semibold text-gray-900 font-mono">{formData.utrNumber}</span>
                    </div>
                    {formData.senderBankName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sender's Bank</span>
                        <span className="font-medium text-gray-900">{formData.senderBankName}</span>
                      </div>
                    )}
                    {formData.senderAccountNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Sender's Account</span>
                        <span className="font-medium text-gray-900">XXXX{formData.senderAccountNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Verified By</span>
                      <span className="font-medium text-gray-900">{formData.receivedBy || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reference Number</span>
                      <span className="font-medium text-blue-600 font-mono">{referenceNumber}</span>
                    </div>
                  </div>
                  
                  {formData.paymentProofPreview && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">Payment Proof</p>
                      {formData.paymentProofPreview === 'pdf' ? (
                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                          <FileText className="w-5 h-5" />
                          <span>{formData.paymentProof?.name}</span>
                        </div>
                      ) : (
                        <img src={formData.paymentProofPreview} alt="Payment Proof" className="max-h-24 rounded-lg border" />
                      )}
                    </div>
                  )}
                </div>

                {/* Verification Action Card */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="font-semibold text-gray-900 mb-4">Verification Action</h4>
                    <div className="space-y-3">
                      <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.action === 'verify' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="radio" name="bankAction" value="verify" checked={formData.action === 'verify'} onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} className="sr-only" />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.action === 'verify' ? 'border-green-500' : 'border-gray-300'}`}>
                          {formData.action === 'verify' && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Verify & Mark as Paid</p>
                          <p className="text-xs text-gray-500">Transfer verified successfully</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </label>

                      <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.action === 'reject' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="radio" name="bankAction" value="reject" checked={formData.action === 'reject'} onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))} className="sr-only" />
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.action === 'reject' ? 'border-red-500' : 'border-gray-300'}`}>
                          {formData.action === 'reject' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Reject Payment</p>
                          <p className="text-xs text-gray-500">Transfer could not be verified</p>
                        </div>
                        <XCircle className="w-5 h-5 text-red-500" />
                      </label>

                      {formData.action === 'reject' && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason *</label>
                          <textarea
                            value={formData.rejectionReason}
                            onChange={(e) => setFormData(prev => ({ ...prev, rejectionReason: e.target.value }))}
                            rows={2}
                            placeholder="Please provide a reason (e.g., UTR not found, amount mismatch)..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {formData.notes && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
                      <p className="text-sm text-gray-600">{formData.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button 
            onClick={currentStep > 1 ? () => setCurrentStep(1) : onClose} 
            className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          
          {currentStep === 1 ? (
            <button 
              onClick={handleNextStep}
              className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            >
              Review Payment <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading || uploading}
              className={`flex items-center gap-2 px-8 py-2.5 rounded-lg font-medium shadow-lg ${
                formData.action === 'verify' 
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20' 
                  : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
              }`}
            >
              {(loading || uploading) ? <RefreshCw className="w-4 h-4 animate-spin" /> : (formData.action === 'verify' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
              {uploading ? 'Uploading...' : formData.action === 'verify' ? 'Verify & Complete Payment' : 'Reject Payment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Simple Verify Payment Modal (for non-cash/non-cheque/non-bank-transfer payments)
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
  const { fpList, selectedFp, selectFp } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  const isAdminPortal = portalType === 'admin' || portalType === 'employee';
  
  // Set initial tab based on URL
  const getInitialTab = () => {
    if (location.pathname.includes('payment-history') || location.pathname.includes('offline')) return 'offline';
    return 'online';
  };
  
  const [payments, setPayments] = useState([]);
  const [razorpayHistory, setRazorpayHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [dateDisplayStart, setDateDisplayStart] = useState('');
  const [dateDisplayEnd, setDateDisplayEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPaymentForVerify, setSelectedPaymentForVerify] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab); // 'online' or 'offline'

  // Refs for date inputs
  const offlineStartDateRef = useRef(null);
  const offlineEndDateRef = useRef(null);
  const onlineStartDateRef = useRef(null);
  const onlineEndDateRef = useRef(null);

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
      let url = `${API_BASE}/api/payments/payments`;
      const params = new URLSearchParams();
      // Add FP filter for admin viewing specific FP
      if (selectedFp && selectedFp.id !== 'all') {
        params.append('fpId', selectedFp.id);
      }
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
  }, [token, statusFilter, methodFilter, searchTerm, headerSearchTerm, dateRange, selectedFp]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Fetch Razorpay transaction history
  const fetchRazorpayHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // Add FP filter for admin viewing specific FP
      if (selectedFp && selectedFp.id !== 'all') {
        params.append('fpId', selectedFp.id);
      }
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (headerSearchTerm) params.append('search', headerSearchTerm);
      
      const url = `${API_BASE}/api/payments/razorpay-history${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setRazorpayHistory(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching Razorpay history:', err);
    }
  }, [token, dateRange, headerSearchTerm, selectedFp]);

  useEffect(() => {
    if (activeTab === 'online') {
      fetchRazorpayHistory();
    }
  }, [activeTab, fetchRazorpayHistory]);

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

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Payments
              </h1>
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
                <span>Billing & Payments</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
                <span className="text-gray-700">
                  Payments
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* FP Selector - Only for Admin Portal */}
              {isAdminPortal && (
                <div className="relative">
                  <button
                    onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
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
              )}
              <div className="relative w-72">
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
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            </div>
          </div>
        </div>

        {/* All Payments Content */}
        {/* Stats Cards - Responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm min-h-[80px] sm:min-h-[90px]">
            <div className="p-2 sm:p-2.5 bg-blue-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Total Payments</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-[9px] sm:text-xs text-gray-400">This Month</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm min-h-[80px] sm:min-h-[90px]">
            <div className="p-2 sm:p-2.5 bg-green-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Received</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.paid}</p>
              <p className="text-[9px] sm:text-xs text-gray-400 truncate">{formatCurrencyShort(stats.paidAmount)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm min-h-[80px] sm:min-h-[90px]">
            <div className="p-2 sm:p-2.5 bg-orange-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Pending</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.verificationPending}</p>
              <p className="text-[9px] sm:text-xs text-gray-400 truncate">{formatCurrencyShort(stats.verificationAmount)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm min-h-[80px] sm:min-h-[90px]">
            <div className="p-2 sm:p-2.5 bg-blue-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Partial</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.partiallyPaid}</p>
              <p className="text-[9px] sm:text-xs text-gray-400 truncate">{formatCurrencyShort(stats.partiallyPaidAmount)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm min-h-[80px] sm:min-h-[90px]">
            <div className="p-2 sm:p-2.5 bg-red-100 rounded-lg sm:rounded-xl flex-shrink-0">
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate">Failed</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.failed}</p>
              <p className="text-[9px] sm:text-xs text-gray-400 truncate">{formatCurrencyShort(stats.failedAmount)}</p>
            </div>
          </div>
        </div>

        {/* Filters Row - Responsive */}
        <div className="bg-white rounded-xl border border-gray-200 mb-3 sm:mb-4 p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="relative min-w-[100px] flex-shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full appearance-none pl-2 sm:pl-3 pr-7 sm:pr-8 py-2 sm:py-2.5 border border-gray-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-300"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="verification_pending">Pending</option>
                <option value="partially_paid">Partial</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[120px] flex-shrink-0">
              <select
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-2 sm:pl-4 pr-8 sm:pr-10 py-2 sm:py-2.5 border border-gray-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-300"
              >
                <option value="all">All Methods</option>
                <option value="debit_card">Debit Card</option>
                <option value="credit_card">Credit Card</option>
                <option value="net_banking">Net Banking</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Cheque</option>
              </select>
              <ChevronDown className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative min-w-[110px] flex-shrink-0">
              <select
                value={propertyTypeFilter}
                onChange={(e) => { setPropertyTypeFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none pl-2 sm:pl-4 pr-8 sm:pr-10 py-2 sm:py-2.5 border border-gray-200 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-gray-300"
              >
                <option value="all">All Types</option>
                <option value="apartment">Apartment</option>
                <option value="villa">Villa</option>
                <option value="commercial">Commercial</option>
              </select>
              <ChevronDown className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 bg-white flex-shrink-0">
              <Calendar 
                className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-pointer" 
                onClick={() => offlineStartDateRef.current?.click()}
              />
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateDisplayStart || formatDateIST(dateRange.start)}
                  onChange={(e) => {
                    const formatted = handleISTDateInput(e.target.value);
                    setDateDisplayStart(formatted);
                    if (formatted.length === 10) {
                      setDateRange(prev => ({ ...prev, start: parseISTDate(formatted) }));
                    } else if (formatted.length === 0) {
                      setDateRange(prev => ({ ...prev, start: '' }));
                    }
                  }}
                  onBlur={() => setDateDisplayStart('')}
                  onClick={() => offlineStartDateRef.current?.click()}
                  className="text-sm border-none focus:outline-none bg-transparent w-[85px] cursor-pointer"
                />
                <input
                  ref={offlineStartDateRef}
                  type="date"
                  className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
                  value={dateRange.start}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange(prev => ({ ...prev, start: e.target.value }));
                      setDateDisplayStart('');
                    }
                  }}
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateDisplayEnd || formatDateIST(dateRange.end)}
                  onChange={(e) => {
                    const formatted = handleISTDateInput(e.target.value);
                    setDateDisplayEnd(formatted);
                    if (formatted.length === 10) {
                      setDateRange(prev => ({ ...prev, end: parseISTDate(formatted) }));
                    } else if (formatted.length === 0) {
                      setDateRange(prev => ({ ...prev, end: '' }));
                    }
                  }}
                  onBlur={() => setDateDisplayEnd('')}
                  onClick={() => offlineEndDateRef.current?.click()}
                  className="text-sm border-none focus:outline-none bg-transparent w-[85px] cursor-pointer"
                />
                <input
                  ref={offlineEndDateRef}
                  type="date"
                  className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
                  value={dateRange.end}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange(prev => ({ ...prev, end: e.target.value }));
                      setDateDisplayEnd('');
                    }
                  }}
                />
              </div>
            </div>
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
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">Estimate ID</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property ID</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property Type</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid Date</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Received By</th>
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
                          <td className="px-4 py-4 hidden xl:table-cell">
                            <span className="text-sm text-gray-600">{payment.estimateId || payment.estimate_id || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-800">{payment.customerName || payment.propertyName || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600">{payment.propertyCode || payment.propertyId || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-gray-600">{formatPropertyType(payment.propertyType)}</span>
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
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <div className="text-sm font-medium text-gray-900">
                              {payment.receivedByName || payment.received_by_name || payment.createdByName || 'System'}
                            </div>
                            {(payment.receivedByRole || payment.received_by_role || payment.createdByRole) && (
                              <div className="text-xs text-gray-400 capitalize">
                                {(payment.receivedByRole || payment.received_by_role || payment.createdByRole || '').replace(/_/g, ' ')}
                              </div>
                            )}
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
        {/* End of Payments Content - Online section removed, unified interface */}
        {false && (
          <>
          {/* Filters Row for Online Payments */}
          <div className="bg-white rounded-xl border border-gray-200 mb-4 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <select
                  value={methodFilter}
                  onChange={(e) => { setMethodFilter(e.target.value); setCurrentPage(1); }}
                  className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="net_banking">Net Banking</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="check">Cheque</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
                <Calendar 
                  className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-pointer" 
                  onClick={() => onlineStartDateRef.current?.click()}
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dateDisplayStart || formatDateIST(dateRange.start)}
                    onChange={(e) => {
                      const formatted = handleISTDateInput(e.target.value);
                      setDateDisplayStart(formatted);
                      if (formatted.length === 10) {
                        setDateRange(prev => ({ ...prev, start: parseISTDate(formatted) }));
                      } else if (formatted.length === 0) {
                        setDateRange(prev => ({ ...prev, start: '' }));
                      }
                    }}
                    onBlur={() => setDateDisplayStart('')}
                    onClick={() => onlineStartDateRef.current?.click()}
                    className="text-sm border-none focus:outline-none bg-transparent w-[85px] cursor-pointer"
                  />
                  <input
                    ref={onlineStartDateRef}
                    type="date"
                    className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
                    value={dateRange.start}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDateRange(prev => ({ ...prev, start: e.target.value }));
                        setDateDisplayStart('');
                      }
                    }}
                  />
                </div>
                <span className="text-gray-400">-</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dateDisplayEnd || formatDateIST(dateRange.end)}
                    onChange={(e) => {
                      const formatted = handleISTDateInput(e.target.value);
                      setDateDisplayEnd(formatted);
                      if (formatted.length === 10) {
                        setDateRange(prev => ({ ...prev, end: parseISTDate(formatted) }));
                      } else if (formatted.length === 0) {
                        setDateRange(prev => ({ ...prev, end: '' }));
                      }
                    }}
                    onBlur={() => setDateDisplayEnd('')}
                    onClick={() => onlineEndDateRef.current?.click()}
                    className="text-sm border-none focus:outline-none bg-transparent w-[85px] cursor-pointer"
                  />
                  <input
                    ref={onlineEndDateRef}
                    type="date"
                    className="absolute top-0 left-0 w-full h-full opacity-0 pointer-events-none"
                    value={dateRange.end}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDateRange(prev => ({ ...prev, end: e.target.value }));
                        setDateDisplayEnd('');
                      }
                    }}
                  />
                </div>
              </div>

              <button
                onClick={() => fetchRazorpayHistory()}
                className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Transaction</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Invoice</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Customer</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Payment Method</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Amount</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Balance</th>
                    <th className="text-center text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {razorpayHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-gray-100 rounded-full">
                            <Receipt className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 font-medium">No online payments yet</p>
                          <p className="text-sm text-gray-400">Card, Net Banking & UPI payments will appear here</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    razorpayHistory.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <button
                              onClick={() => handleViewReceipt(txn)}
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-sm cursor-pointer"
                            >
                              {txn.paymentId || `PAY-${txn.id}`}
                            </button>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(txn.transactionDate).toLocaleDateString('en-IN', { 
                                day: '2-digit', month: 'short', year: 'numeric', 
                                hour: '2-digit', minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">{txn.invoiceId || '-'}</p>
                          {txn.invoiceTotal && (
                            <p className="text-xs text-gray-500">Total: {formatCurrencyShort(txn.invoiceTotal)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">{txn.customerName || '-'}</p>
                          <p className="text-xs text-gray-500">{txn.propertyName || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                            <CreditCard className="w-3 h-3" />
                            {txn.paymentMethod}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-green-600">{formatCurrencyShort(txn.amountPaid)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={`font-medium ${txn.balanceRemaining <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {txn.balanceRemaining <= 0 ? '₹0' : formatCurrencyShort(txn.balanceRemaining)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleViewReceipt(txn)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Use appropriate modal based on payment method */}
      {selectedPaymentForVerify?.paymentMethod === 'cash' ? (
        <CashPaymentVerifyModal
          isOpen={showVerifyModal}
          onClose={() => {
            setShowVerifyModal(false);
            setSelectedPaymentForVerify(null);
          }}
          onSuccess={() => {
            fetchPayments();
            showToast('Payment verified and marked as paid successfully!');
          }}
          payment={selectedPaymentForVerify}
          user={user}
        />
      ) : ['check', 'cheque'].includes(selectedPaymentForVerify?.paymentMethod) ? (
        <ChequePaymentVerifyModal
          isOpen={showVerifyModal}
          onClose={() => {
            setShowVerifyModal(false);
            setSelectedPaymentForVerify(null);
          }}
          onSuccess={() => {
            fetchPayments();
            showToast('Cheque payment verified successfully!');
          }}
          payment={selectedPaymentForVerify}
          user={user}
        />
      ) : ['bank_transfer', 'bank'].includes(selectedPaymentForVerify?.paymentMethod) ? (
        <BankTransferVerifyModal
          isOpen={showVerifyModal}
          onClose={() => {
            setShowVerifyModal(false);
            setSelectedPaymentForVerify(null);
          }}
          onSuccess={() => {
            fetchPayments();
            showToast('Bank transfer verified successfully!');
          }}
          payment={selectedPaymentForVerify}
          user={user}
        />
      ) : (
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
      )}

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
