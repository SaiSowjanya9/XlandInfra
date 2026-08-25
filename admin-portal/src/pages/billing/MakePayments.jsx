import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Banknote,
  CheckCircle,
  AlertCircle,
  Shield,
  Smartphone,
  FileCheck,
  Info,
  Copy,
  Check,
  Loader2,
  Search,
  X,
  Upload,
  FileText,
  CreditCard,
  Lock,
  HelpCircle,
  Clock,
  User,
  MapPin,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Format currency in INR
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return '₹' + new Intl.NumberFormat('en-IN').format(num);
};

// Format date
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Calculate days until due date
const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Card logos component - matching Image 1 exactly
const CardLogos = () => (
  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
    <div className="px-2 py-0.5 bg-[#1a1f71] rounded text-white text-[10px] font-bold tracking-wide">VISA</div>
    <div className="w-6 h-4 rounded flex items-center justify-center">
      <div className="flex">
        <div className="w-2.5 h-2.5 bg-[#eb001b] rounded-full"></div>
        <div className="w-2.5 h-2.5 bg-[#f79e1b] rounded-full -ml-1"></div>
      </div>
    </div>
    <div className="px-1.5 py-0.5 bg-[#097a44] rounded text-white text-[9px] font-bold">RuPay</div>
    <div className="px-1.5 py-0.5 bg-[#016fd0] rounded text-white text-[9px] font-bold">maestro</div>
    <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
      <Building2 className="w-3 h-3 text-gray-600" />
      <span className="text-[10px] text-gray-700 font-medium">Net Banking</span>
    </div>
  </div>
);

// UPI App logos component - matching official logos
const UPIAppLogos = () => (
  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
    {/* Google Pay - Colorful G + Pay */}
    <div className="flex items-center gap-0.5 px-1.5 py-1 bg-white rounded border border-gray-200">
      <svg width="14" height="14" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      <span className="text-[10px] font-medium text-gray-600">Pay</span>
    </div>
    {/* PhonePe - Purple circle with "पे" */}
    <div className="w-7 h-7 bg-[#5f259f] rounded-full flex items-center justify-center">
      <span className="text-white text-sm font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>पे</span>
    </div>
    {/* Paytm - Dark blue circle outline with paytm text */}
    <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center border-2 border-[#00325b]">
      <span className="text-[7px] font-bold"><span className="text-[#00325b]">pay</span><span className="text-[#00baf2]">tm</span></span>
    </div>
    <div className="px-2 py-1 bg-[#ed752e] rounded">
      <span className="text-[10px] font-bold text-white">BHIM</span>
    </div>
    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center border border-gray-200">
      <span className="text-gray-400 font-bold text-xs">...</span>
    </div>
  </div>
);

// Your Collection Badge - green badge matching Image 1
const YourCollectionBadge = () => (
  <span className="px-2 py-0.5 bg-green-500 text-white text-[9px] font-semibold rounded">
    Your Collection
  </span>
);

// Powered by Razorpay Badge - blue badge matching Image 1
const RazorpayBadge = () => (
  <span className="px-2 py-0.5 bg-blue-500 text-white text-[9px] font-semibold rounded">
    Powered by Razorpay
  </span>
);

// No Fees indicator - matching Image 1 layout
const NoFeesIndicator = () => (
  <div className="text-right flex-shrink-0">
    <p className="text-green-600 font-semibold text-xs">No Additional Charges</p>
    <div className="flex items-center justify-end gap-1 mt-0.5">
      <CheckCircle className="w-3 h-3 text-green-500" />
      <span className="text-[10px] text-gray-500">Direct Collection</span>
    </div>
    <div className="flex items-center justify-end gap-1 mt-0.5">
      <CheckCircle className="w-3 h-3 text-green-500" />
      <span className="text-[10px] text-green-600 font-medium">No Fees</span>
    </div>
  </div>
);

// Fee indicator for Card/Net Banking - matching Image 1 layout
const FeeIndicator = () => (
  <div className="text-right flex-shrink-0">
    <p className="text-gray-500 text-[10px]">Processing Fee</p>
    <div className="flex items-center justify-end gap-1 mt-0.5">
      <span className="text-gray-900 font-semibold text-sm">2% + GST</span>
      <HelpCircle className="w-3 h-3 text-gray-400" />
    </div>
    <div className="flex items-center justify-end gap-1 mt-1.5">
      <Lock className="w-3 h-3 text-gray-400" />
      <span className="text-[10px] text-gray-500">Secure Payment</span>
    </div>
    <div className="flex items-center justify-end gap-1 mt-0.5">
      <Shield className="w-3 h-3 text-blue-500" />
      <span className="text-[10px] text-blue-600 font-medium">Razorpay Trusted</span>
    </div>
  </div>
);

// Payment method labels
const PAYMENT_METHOD_LABELS = {
  razorpay: 'Card / Net Banking',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  check: 'Cheque'
};

// Step Progress Component
const StepProgress = ({ currentStep, selectedMethod }) => (
  <div className="flex items-center justify-center gap-4 py-4 bg-white border-b border-gray-100">
    <div className="flex items-center gap-2">
      {currentStep > 1 ? (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
      )}
      <div>
        <p className={`text-sm font-medium ${currentStep >= 1 ? 'text-gray-900' : 'text-gray-400'}`}>Select Method</p>
        {currentStep > 1 && <p className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[selectedMethod]}</p>}
      </div>
    </div>
    <div className={`w-12 h-0.5 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
    <div className="flex items-center gap-2">
      {currentStep > 2 ? (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle className="w-5 h-5 text-white" />
        </div>
      ) : (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
      )}
      <div>
        <p className={`text-sm font-medium ${currentStep >= 2 ? 'text-gray-900' : 'text-gray-400'}`}>Payment Details</p>
        {currentStep === 2 && <p className="text-xs text-gray-500">Enter {PAYMENT_METHOD_LABELS[selectedMethod]?.toLowerCase()} details</p>}
      </div>
    </div>
    <div className={`w-12 h-0.5 ${currentStep > 2 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
      <div>
        <p className={`text-sm font-medium ${currentStep >= 3 ? 'text-gray-900' : 'text-gray-400'}`}>Review & Confirm</p>
        <p className="text-xs text-gray-500">Verify and complete</p>
      </div>
    </div>
  </div>
);

// Invoice Details Bar
const InvoiceDetailsBar = ({ invoice, daysUntilDue, balanceAmount }) => (
  <div className="bg-white border-b border-gray-200 px-6 py-4">
    <div className="max-w-5xl mx-auto flex items-center justify-between">
      <div className="grid grid-cols-4 gap-8">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice ID</p>
          <p className="font-semibold text-blue-600 mt-1">{invoice.invoiceId}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
          <p className="font-medium text-gray-900 mt-1">{invoice.propertyName || invoice.customerName}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
          <p className="font-medium text-gray-900 mt-1">{formatDate(invoice.invoiceDate)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Due Date</p>
          <p className={`font-medium mt-1 ${daysUntilDue < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatDate(invoice.dueDate)}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Amount Payable</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(balanceAmount)}</p>
        {daysUntilDue !== null && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs mt-1 ${daysUntilDue < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            <Clock className="w-3 h-3" />
            {daysUntilDue < 0 ? `Overdue by ${Math.abs(daysUntilDue)} days` : `Due in ${daysUntilDue} days`}
          </div>
        )}
      </div>
    </div>
  </div>
);

const MakePayments = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoiceId = searchParams.get('invoiceId');
  
  const [selectedMethod, setSelectedMethod] = useState('razorpay');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false);

  // Step state for payment flow (1=method selection, 2=payment details, 3=review)
  const [currentStep, setCurrentStep] = useState(1);
  const [paymentDetails, setPaymentDetails] = useState({
    transactionReference: '',
    receivedBy: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    notes: '',
    chequeBank: '',
    chequeNumber: '',
    chequeDate: '',
  });
  const [paymentProof, setPaymentProof] = useState(null);
  const [copied, setCopied] = useState(null);

  const token = getAuthToken();

  // Bank details
  const bankDetails = {
    accountName: 'XLAND INFRA PM SERVICES PVT LTD',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branch: 'Gachibowli, Hyderabad',
    accountType: 'Current Account'
  };

  // UPI details
  const upiDetails = {
    upiId: 'xlandinfra@upi'
  };

  // Fetch invoices with pending balance
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/payments/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        const invoicesWithBalance = (result.data || []).filter(inv => 
          (parseFloat(inv.balanceAmount) || parseFloat(inv.totalAmount) || 0) > 0 && 
          inv.status !== 'paid'
        );
        setInvoices(invoicesWithBalance);
        
        if (preselectedInvoiceId) {
          const preselected = invoicesWithBalance.find(
            inv => inv.id === parseInt(preselectedInvoiceId) || inv.invoiceId === preselectedInvoiceId
          );
          if (preselected) {
            setSelectedInvoice(preselected);
          }
        } else if (invoicesWithBalance.length === 1) {
          setSelectedInvoice(invoicesWithBalance[0]);
        } else if (invoicesWithBalance.length > 1) {
          setShowInvoiceSelector(true);
        }
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [token, preselectedInvoiceId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      return;
    }
    const basePath = portalType === 'employee' || portalType === 'admin' ? '/employee' : `/${portalType}`;
    navigate(`${basePath}/billing/invoices`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setPaymentProof(file);
    }
  };

  // Handle Razorpay payment
  const handleRazorpayPayment = async () => {
    if (!selectedInvoice) return;
    
    setProcessing(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE}/api/razorpay/create-payment-link`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          invoiceId: selectedInvoice.id || selectedInvoice.invoiceId 
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.paymentLink) {
        window.location.href = result.data.paymentLink;
      } else {
        setError(result.message || 'Failed to create payment link');
      }
    } catch (err) {
      console.error('Razorpay error:', err);
      setError('Failed to create payment link. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle proceed to next step
  const handleNextStep = () => {
    if (!selectedInvoice) {
      setError('Please select an invoice');
      return;
    }
    setError(null);
    
    if (currentStep === 1) {
      if (selectedMethod === 'razorpay') {
        handleRazorpayPayment();
      } else {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      // Validate step 2 before proceeding to review
      if (selectedMethod === 'cash' && !paymentDetails.receivedBy) {
        setError('Please enter who received the payment');
        return;
      }
      if (selectedMethod === 'check') {
        if (!paymentDetails.chequeNumber) {
          setError('Please enter the cheque number');
          return;
        }
        if (!paymentDetails.chequeBank) {
          setError('Please enter the bank name');
          return;
        }
        if (!paymentDetails.receivedBy) {
          setError('Please enter who received the cheque');
          return;
        }
      }
      setCurrentStep(3);
    }
  };

  // Handle confirm manual payment
  const handleConfirmPayment = async () => {
    if (!selectedInvoice) return;
    
    setProcessing(true);
    setError(null);
    
    const generatedReference = `XLAND${selectedInvoice.invoiceId?.replace(/[^0-9]/g, '') || ''}${new Date().getFullYear()}`;
    const finalReference = (selectedMethod === 'bank_transfer' || selectedMethod === 'upi') 
      ? generatedReference 
      : paymentDetails.transactionReference || paymentDetails.chequeNumber;
    
    try {
      const submitData = new FormData();
      submitData.append('invoiceId', selectedInvoice.id || selectedInvoice.invoiceId);
      submitData.append('amount', selectedInvoice.balanceAmount || selectedInvoice.totalAmount);
      submitData.append('paymentMethod', selectedMethod);
      submitData.append('paymentDate', new Date().toISOString().split('T')[0]);
      submitData.append('customerName', selectedInvoice.customerName || '');
      submitData.append('paymentStatus', 'verification_pending');
      submitData.append('transactionReference', finalReference);
      submitData.append('receivedBy', paymentDetails.receivedBy || user?.firstName || 'Admin');
      submitData.append('remarks', paymentDetails.notes || '');
      
      if (selectedMethod === 'check') {
        submitData.append('chequeBank', paymentDetails.chequeBank || '');
        submitData.append('checkDate', paymentDetails.chequeDate || '');
      }
      
      if (paymentProof) {
        submitData.append('paymentProof', paymentProof);
      }
      
      const response = await fetch(`${API_BASE}/api/payments/payments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData
      });
      
      const result = await response.json();
      
      if (result.success) {
        const basePath = portalType === 'employee' || portalType === 'admin' ? '/employee' : `/${portalType}`;
        navigate(`${basePath}/billing/payments`, { 
          state: { message: 'Payment recorded successfully! It will be verified shortly.' }
        });
      } else {
        setError(result.message || 'Failed to record payment');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to record payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Filter invoices for search
  const filteredInvoices = invoices.filter(inv => {
    const q = searchTerm.toLowerCase();
    return (
      inv.invoiceId?.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.propertyCode?.toLowerCase().includes(q) ||
      inv.propertyName?.toLowerCase().includes(q)
    );
  });

  const daysUntilDue = selectedInvoice ? getDaysUntilDue(selectedInvoice.dueDate) : null;
  const isDuePassed = daysUntilDue !== null && daysUntilDue < 0;
  const balanceAmount = selectedInvoice ? (parseFloat(selectedInvoice.balanceAmount) || parseFloat(selectedInvoice.totalAmount) || 0) : 0;
  const totalAmount = selectedInvoice ? (parseFloat(selectedInvoice.totalAmount) || 0) : 0;
  const generatedReference = selectedInvoice 
    ? `XLAND${selectedInvoice.invoiceId?.replace(/[^0-9]/g, '') || ''}${new Date().getFullYear()}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  // ==================== STEP 3: REVIEW & CONFIRM ====================
  if (currentStep === 3 && selectedInvoice) {
    const getPaymentMethodDescription = () => {
      switch (selectedMethod) {
        case 'bank_transfer': return 'Bank transfer information';
        case 'upi': return 'UPI payment information';
        case 'cash': return 'Cash payment information';
        case 'check': return 'Cheque payment information';
        default: return 'Payment information';
      }
    };

    return (
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white px-6 py-5">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Review & Confirm Payment</h1>
              <p className="text-sm text-gray-500">Please review all payment details before confirming</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
            </div>
          )}

          {/* Invoice Summary Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="grid grid-cols-4 gap-8">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Invoice ID</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.invoiceId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Customer</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.propertyName || selectedInvoice.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Invoice Date</p>
                  <p className="font-semibold text-gray-900">{formatDate(selectedInvoice.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Due Date</p>
                  <p className={`font-semibold ${daysUntilDue < 0 ? 'text-red-600' : 'text-orange-500'}`}>{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Amount Payable</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(balanceAmount)}</p>
                {daysUntilDue !== null && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1 ${daysUntilDue < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    <Clock className="w-3 h-3" />
                    {daysUntilDue < 0 ? `Overdue by ${Math.abs(daysUntilDue)} days` : `Due in ${daysUntilDue} days`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Step Progress */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Select Payment Method</p>
                  <p className="text-xs text-gray-500">{PAYMENT_METHOD_LABELS[selectedMethod]}</p>
                </div>
              </div>
              <div className="w-16 h-0.5 bg-green-500"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Payment Details</p>
                  <p className="text-xs text-gray-500">{getPaymentMethodDescription()}</p>
                </div>
              </div>
              <div className="w-16 h-0.5 bg-green-500"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-600">Review & Confirm</p>
                  <p className="text-xs text-gray-500">Review and confirm payment</p>
                </div>
              </div>
            </div>
          </div>

          {/* Review Payment Information Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Review Payment Information</h2>
            <button onClick={() => setCurrentStep(2)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
              <FileText className="w-4 h-4" /> Edit
            </button>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Invoice Details Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Invoice Details</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Invoice ID</span>
                    <span className="text-sm font-medium text-gray-900">{selectedInvoice.invoiceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Customer</span>
                    <span className="text-sm font-medium text-gray-900">{selectedInvoice.propertyName || selectedInvoice.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Invoice Date</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(selectedInvoice.invoiceDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Due Date</span>
                    <span className={`text-sm font-medium ${daysUntilDue < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatDate(selectedInvoice.dueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Amount</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Amount Payable</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(balanceAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Proof Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Payment Proof</h3>
                </div>
                {paymentProof ? (
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                      {paymentProof.type?.startsWith('image/') ? (
                        <img src={URL.createObjectURL(paymentProof)} alt="Payment proof" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{paymentProof.name}</p>
                      <p className="text-xs text-gray-500 mt-1">Uploaded on: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                      <p className="text-xs text-gray-500">Uploaded by: {paymentDetails.receivedBy || user?.firstName || 'Admin'}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full mt-2">
                        <CheckCircle className="w-3 h-3" /> Proof Uploaded
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No payment proof uploaded</p>
                    <p className="text-xs text-gray-400 mt-1">{selectedMethod === 'cash' || selectedMethod === 'check' ? 'Optional for this payment method' : 'Recommended for faster verification'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Payment Method Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Payment Method</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">{PAYMENT_METHOD_LABELS[selectedMethod]}</span>
                  <span className="text-sm text-gray-500">No Additional Charges</span>
                </div>
              </div>

              {/* Amount Information Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Amount Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Invoice Amount</span>
                    <div className="flex gap-8">
                      <span className="text-gray-400">Tax (0%)</span>
                      <span className="font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <div className="flex gap-8">
                      <span className="text-gray-400">₹0</span>
                      <span className="font-medium text-gray-900">₹0</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-2">
                    <span className="text-gray-500">Total Amount</span>
                    <div className="flex gap-8">
                      <span className="text-gray-400">Tax Incl.</span>
                      <span className="font-medium text-gray-900">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Amount Paid</span>
                    <div className="flex gap-8">
                      <span className="text-gray-400">₹0</span>
                      <span className="font-medium text-gray-900">{formatCurrency(totalAmount - balanceAmount)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t-2 border-blue-500 pt-3 mt-3">
                    <span className="text-blue-600 font-semibold">Amount Payable</span>
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(balanceAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Additional Information Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Info className="w-5 h-5 text-gray-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Additional Information</h3>
                </div>
                <div className="space-y-3">
                  {selectedMethod === 'bank_transfer' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Payment Type</span>
                        <span className="text-sm font-medium text-gray-900">Bank Transfer / NEFT / RTGS</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Reference Number</span>
                        <span className="text-sm font-medium text-gray-900 font-mono">{generatedReference}</span>
                      </div>
                    </>
                  )}
                  {selectedMethod === 'upi' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Payment Type</span>
                        <span className="text-sm font-medium text-gray-900">UPI Payment</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Reference Number</span>
                        <span className="text-sm font-medium text-gray-900 font-mono">{generatedReference}</span>
                      </div>
                    </>
                  )}
                  {selectedMethod === 'cash' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Payment Location</span>
                        <span className="text-sm font-medium text-gray-900">Office / Collection Point</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Received By</span>
                        <span className="text-sm font-medium text-gray-900">{paymentDetails.receivedBy || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Notes</span>
                        <span className="text-sm font-medium text-gray-900">{paymentDetails.notes || '-'}</span>
                      </div>
                    </>
                  )}
                  {selectedMethod === 'check' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Cheque Number</span>
                        <span className="text-sm font-medium text-gray-900">{paymentDetails.chequeNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Cheque Date</span>
                        <span className="text-sm font-medium text-gray-900">{paymentDetails.chequeDate ? formatDate(paymentDetails.chequeDate) : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Bank Name</span>
                        <span className="text-sm font-medium text-gray-900">{paymentDetails.chequeBank}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Received By</span>
                        <span className="text-sm font-medium text-gray-900">{paymentDetails.receivedBy || '-'}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700">Please verify all the details carefully before confirming.</p>
                <p className="text-sm text-gray-500">Once confirmed, the payment will be marked as "Verification Pending" and our team will verify the payment.</p>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between">
            <button onClick={handleBack} className="flex flex-col items-start px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
              <span className="flex items-center gap-2 font-medium">
                <ArrowLeft className="w-4 h-4" /> Back
              </span>
              <span className="text-xs text-gray-500 mt-0.5">Go back and edit</span>
            </button>
            <button 
              onClick={handleConfirmPayment} 
              disabled={processing} 
              className="flex flex-col items-center px-10 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-600/20 transition-colors"
            >
              <span className="flex items-center gap-2">
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {processing ? 'Processing...' : 'Confirm Payment'}
                {!processing && <Check className="w-4 h-4" />}
              </span>
              {!processing && <span className="text-xs text-blue-200 mt-0.5">Payment will be marked as "Verification Pending"</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== STEP 2: PAYMENT DETAILS ====================
  if (currentStep === 2 && selectedInvoice) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Make Payment</h1>
              <p className="text-sm text-gray-500">Complete your payment securely</p>
            </div>
          </div>
        </div>
        <InvoiceDetailsBar invoice={selectedInvoice} daysUntilDue={daysUntilDue} balanceAmount={balanceAmount} />
        <StepProgress currentStep={2} selectedMethod={selectedMethod} />

        <div className="max-w-5xl mx-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-red-600" /></button>
            </div>
          )}

          {/* ===== BANK TRANSFER ===== */}
          {selectedMethod === 'bank_transfer' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Bank Transfer Details</h3>
                <p className="text-sm text-gray-500 mb-6">Transfer the amount to the bank account below</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">How it works?</h4>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">1.</span>Transfer the exact amount to the bank account</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">2.</span>Use the provided reference number in your transfer</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">3.</span>Upload payment proof for verification</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">4.</span>We will verify and update your payment</li>
                    </ol>
                    <div className="mt-4 flex items-center gap-2 text-green-600">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">No additional charges for Bank Transfer</span>
                    </div>
                  </div>
                  <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/30">
                    <h4 className="font-semibold text-blue-800 mb-4">Our Bank Account Details</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Account Holder Name</p>
                          <p className="font-semibold text-gray-900">{bankDetails.accountName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Bank Name</p>
                          <p className="font-semibold text-gray-900">{bankDetails.bankName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Account Number</p>
                          <p className="font-mono font-semibold text-gray-900">{bankDetails.accountNumber}</p>
                        </div>
                        <button onClick={() => copyToClipboard(bankDetails.accountNumber, 'account')} className="p-1.5 hover:bg-blue-100 rounded">
                          {copied === 'account' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">IFSC Code</p>
                          <p className="font-mono font-semibold text-gray-900">{bankDetails.ifscCode}</p>
                        </div>
                        <button onClick={() => copyToClipboard(bankDetails.ifscCode, 'ifsc')} className="p-1.5 hover:bg-blue-100 rounded">
                          {copied === 'ifsc' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <Banknote className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Account Type</p>
                          <p className="font-semibold text-gray-900">{bankDetails.accountType}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Branch</p>
                          <p className="font-semibold text-gray-900">{bankDetails.branch}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-3 border-t border-blue-200">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Reference / UTR Number</p>
                          <p className="font-mono font-bold text-blue-600">{generatedReference}</p>
                        </div>
                        <button onClick={() => copyToClipboard(generatedReference, 'ref')} className="p-1.5 hover:bg-blue-100 rounded">
                          {copied === 'ref' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-700">Please use the above Reference Number in the remarks/notes while making the transfer.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Payment Proof</h3>
                <p className="text-sm text-gray-500 mb-6">Please upload the screenshot or receipt of the bank transfer</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                    <input type="file" onChange={handleFileChange} className="hidden" id="proof-upload" accept="image/*,.pdf" />
                    <label htmlFor="proof-upload" className="cursor-pointer">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">Drag & drop your file here or</p>
                      <span className="inline-block px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50">Choose File</span>
                      <p className="text-xs text-gray-400 mt-3">Supports: JPG, PNG, PDF (Max size: 5MB)</p>
                      {paymentProof && <p className="mt-3 text-sm text-green-600 font-medium">Selected: {paymentProof.name}</p>}
                    </label>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                    <h4 className="font-semibold text-amber-800 mb-3">Important Notes</h4>
                    <ul className="space-y-2 text-sm text-amber-700">
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0"></span>Make sure to transfer the exact amount</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0"></span>Use the reference number in your transfer</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0"></span>Upload clear payment proof</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0"></span>Payments are verified within 24 hours</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-amber-600 rounded-full flex-shrink-0"></span>You will receive confirmation once verified</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== UPI PAYMENT ===== */}
          {selectedMethod === 'upi' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">UPI Payment Details</h3>
                <p className="text-sm text-gray-500 mb-6">Pay using any UPI app</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-green-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">How it works?</h4>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">1.</span>Open any UPI app (GPay, PhonePe, Paytm, BHIM)</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">2.</span>Enter the UPI ID or scan QR code</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">3.</span>Enter the exact amount and add reference in remarks</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">4.</span>Upload payment screenshot for verification</li>
                    </ol>
                    <div className="mt-4 flex items-center gap-2 text-green-600">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">No additional charges for UPI Payment</span>
                    </div>
                    <UPIAppLogos />
                  </div>
                  <div className="border border-green-200 rounded-xl p-5 bg-green-50/30">
                    <h4 className="font-semibold text-green-800 mb-4">Our UPI Details</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-green-200">
                        <Smartphone className="w-6 h-6 text-green-600" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">UPI ID</p>
                          <p className="font-mono font-bold text-lg text-gray-900">{upiDetails.upiId}</p>
                        </div>
                        <button onClick={() => copyToClipboard(upiDetails.upiId, 'upi')} className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                          {copied === 'upi' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-green-200">
                        <FileText className="w-6 h-6 text-green-600" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Reference Number (use in remarks)</p>
                          <p className="font-mono font-bold text-green-600">{generatedReference}</p>
                        </div>
                        <button onClick={() => copyToClipboard(generatedReference, 'ref')} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200">
                          {copied === 'ref' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-700">Please use the Reference Number in remarks while making the UPI payment.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Payment Proof</h3>
                <p className="text-sm text-gray-500 mb-6">Please upload the screenshot of the UPI payment</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-400 transition-colors">
                    <input type="file" onChange={handleFileChange} className="hidden" id="proof-upload" accept="image/*,.pdf" />
                    <label htmlFor="proof-upload" className="cursor-pointer">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 mb-2">Drag & drop your file here or</p>
                      <span className="inline-block px-4 py-2 border border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50">Choose File</span>
                      <p className="text-xs text-gray-400 mt-3">Supports: JPG, PNG, PDF (Max size: 5MB)</p>
                      {paymentProof && <p className="mt-3 text-sm text-green-600 font-medium">Selected: {paymentProof.name}</p>}
                    </label>
                  </div>
                  <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-3">Important Notes</h4>
                    <ul className="space-y-2 text-sm text-green-700">
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-green-600 rounded-full flex-shrink-0"></span>Make sure to transfer the exact amount</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-green-600 rounded-full flex-shrink-0"></span>Use the reference number in remarks</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-green-600 rounded-full flex-shrink-0"></span>Upload clear payment screenshot</li>
                      <li className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 bg-green-600 rounded-full flex-shrink-0"></span>Payments are verified within 24 hours</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== CASH PAYMENT ===== */}
          {selectedMethod === 'cash' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Cash Payment Details</h3>
              <p className="text-sm text-gray-500 mb-6">Record cash payment received</p>
              <div className="grid grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Banknote className="w-6 h-6 text-orange-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900">How it works?</h4>
                  </div>
                  <ol className="space-y-3 text-sm text-gray-600">
                    <li className="flex gap-2"><span className="font-semibold text-gray-900">1.</span>Collect cash payment from customer</li>
                    <li className="flex gap-2"><span className="font-semibold text-gray-900">2.</span>Enter payment details below</li>
                    <li className="flex gap-2"><span className="font-semibold text-gray-900">3.</span>Issue receipt to customer</li>
                    <li className="flex gap-2"><span className="font-semibold text-gray-900">4.</span>Payment will be recorded in system</li>
                  </ol>
                  <div className="mt-4 flex items-center gap-2 text-green-600">
                    <Info className="w-4 h-4" />
                    <span className="text-sm">No additional charges for Cash Payment</span>
                  </div>
                </div>
                <div className="border border-orange-200 rounded-xl p-5 bg-orange-50/30">
                  <h4 className="font-semibold text-orange-800 mb-4">Payment Details</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Received By *</label>
                      <input type="text" value={paymentDetails.receivedBy} onChange={(e) => setPaymentDetails(prev => ({ ...prev, receivedBy: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" placeholder="Name of person receiving payment" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea value={paymentDetails.notes} onChange={(e) => setPaymentDetails(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" rows={3} placeholder="Any additional notes..." />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== CHEQUE PAYMENT ===== */}
          {selectedMethod === 'check' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Cheque Payment Details</h3>
                <p className="text-sm text-gray-500 mb-6">Record cheque payment received</p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                        <FileCheck className="w-6 h-6 text-red-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">How it works?</h4>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">1.</span>Collect cheque from customer</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">2.</span>Enter cheque details below</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">3.</span>Deposit cheque in bank</li>
                      <li className="flex gap-2"><span className="font-semibold text-gray-900">4.</span>Payment updated after cheque clears</li>
                    </ol>
                    <div className="mt-4 flex items-center gap-2 text-green-600">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">No additional charges for Cheque Payment</span>
                    </div>
                  </div>
                  <div className="border border-red-200 rounded-xl p-5 bg-red-50/30">
                    <h4 className="font-semibold text-red-800 mb-4">Cheque Details</h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number *</label>
                          <input type="text" value={paymentDetails.chequeNumber} onChange={(e) => setPaymentDetails(prev => ({ ...prev, chequeNumber: e.target.value, transactionReference: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="Enter cheque number" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Date *</label>
                          <input type="date" value={paymentDetails.chequeDate} onChange={(e) => setPaymentDetails(prev => ({ ...prev, chequeDate: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name *</label>
                        <input type="text" value={paymentDetails.chequeBank} onChange={(e) => setPaymentDetails(prev => ({ ...prev, chequeBank: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="Bank name on cheque" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Received By *</label>
                        <input type="text" value={paymentDetails.receivedBy} onChange={(e) => setPaymentDetails(prev => ({ ...prev, receivedBy: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" placeholder="Name of person receiving cheque" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Cheque Image (Optional)</h3>
                <p className="text-sm text-gray-500 mb-6">Take a photo of the cheque for records</p>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-red-400 transition-colors">
                  <input type="file" onChange={handleFileChange} className="hidden" id="proof-upload" accept="image/*,.pdf" />
                  <label htmlFor="proof-upload" className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-2">Drag & drop your file here or</p>
                    <span className="inline-block px-4 py-2 border border-red-600 text-red-600 rounded-lg font-medium hover:bg-red-50">Choose File</span>
                    <p className="text-xs text-gray-400 mt-3">Supports: JPG, PNG, PDF (Max size: 5MB)</p>
                    {paymentProof && <p className="mt-3 text-sm text-green-600 font-medium">Selected: {paymentProof.name}</p>}
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <button onClick={handleBack} className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="text-right">
              <button onClick={handleNextStep} className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                Review Payment <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-gray-500 mt-2">You will review details before confirming</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== STEP 1: PAYMENT METHOD SELECTION ====================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Make Payment</h1>
            <p className="text-sm text-gray-500">Choose a payment method and complete your payment</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}

        {/* Invoice Selector Modal */}
        {showInvoiceSelector && !selectedInvoice && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Select Invoice</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Invoice ID, Customer, Property..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => { setSelectedInvoice(invoice); setShowInvoiceSelector(false); }}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{invoice.invoiceId}</p>
                    <p className="text-sm text-gray-500">{invoice.customerName || invoice.propertyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(invoice.balanceAmount || invoice.totalAmount)}</p>
                    <p className="text-xs text-gray-400">Due: {formatDate(invoice.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invoice Details Section */}
        {selectedInvoice && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Invoice Details</h3>
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice ID</p>
                    <p className="font-semibold text-blue-600 mt-1">{selectedInvoice.invoiceId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Property / Customer</p>
                    <p className="font-medium text-gray-900 mt-1">{selectedInvoice.propertyName || selectedInvoice.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
                    <p className="font-medium text-gray-900 mt-1">{formatDate(selectedInvoice.invoiceDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Due Date</p>
                    <p className={`font-medium mt-1 ${isDuePassed ? 'text-red-600' : 'text-green-600'}`}>
                      {formatDate(selectedInvoice.dueDate)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-gray-500 mt-2">Due Amount</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(balanceAmount)}</p>
              </div>
            </div>
            {invoices.length > 1 && (
              <button 
                onClick={() => { setSelectedInvoice(null); setShowInvoiceSelector(true); }}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Change Invoice
              </button>
            )}
          </div>
        )}

        {/* Choose Payment Method Section */}
        {selectedInvoice && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-base">Choose Payment Method</h3>
              <p className="text-xs text-gray-500 mt-0.5">Select any one payment method to proceed</p>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Debit/Card Payments & Net Banking */}
              <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'razorpay' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="razorpay" 
                  checked={selectedMethod === 'razorpay'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-2 w-4 h-4 text-blue-600"
                />
                {/* Card Icon - Blue card with chip */}
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                  <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                    <rect x="1" y="1" width="26" height="20" rx="3" fill="#3b82f6"/>
                    <rect x="4" y="5" width="5" height="4" rx="1" fill="#fbbf24"/>
                    <rect x="1" y="11" width="26" height="3" fill="#1d4ed8"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">Debit / Card Payments & Net Banking</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Pay securely using your debit card, credit card or net banking.</p>
                  <CardLogos />
                </div>
              </label>

              {/* UPI */}
              <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'upi' ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="upi" 
                  checked={selectedMethod === 'upi'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-2 w-4 h-4 text-blue-600"
                />
                {/* Official UPI Logo Icon */}
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                  <svg viewBox="0 0 60 45" className="w-10 h-8">
                    {/* UPI Text */}
                    <text x="2" y="22" fill="#5a5a5a" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="-1">UPI</text>
                    {/* Orange triangle - pointing down-left */}
                    <polygon points="38,6 44,6 38,16" fill="#f97316"/>
                    {/* Green triangle - pointing right */}
                    <polygon points="38,16 44,16 44,26" fill="#22c55e"/>
                    {/* UNIFIED PAYMENTS text */}
                    <text x="2" y="35" fill="#9ca3af" fontSize="5" fontFamily="Arial, sans-serif" letterSpacing="0.3">UNIFIED PAYMENTS</text>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">UPI (QR / UPI ID)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Scan QR code or pay using any UPI app.</p>
                  <UPIAppLogos />
                </div>
              </label>

              {/* Bank Transfer */}
              <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'bank_transfer' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="bank_transfer" 
                  checked={selectedMethod === 'bank_transfer'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-2 w-4 h-4 text-blue-600"
                />
                {/* Bank Building Icon - Line art style */}
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                  <svg width="28" height="26" viewBox="0 0 32 30" fill="none" stroke="#6b7280" strokeWidth="1.5">
                    {/* Roof triangle */}
                    <path d="M16 2L3 10H29L16 2Z" strokeLinejoin="round" fill="none"/>
                    {/* Circle in roof */}
                    <circle cx="16" cy="7" r="2" fill="none"/>
                    {/* Top beam */}
                    <rect x="3" y="10" width="26" height="2" fill="none"/>
                    {/* Pillars */}
                    <rect x="6" y="12" width="2" height="12" fill="none"/>
                    <rect x="12" y="12" width="2" height="12" fill="none"/>
                    <rect x="18" y="12" width="2" height="12" fill="none"/>
                    <rect x="24" y="12" width="2" height="12" fill="none"/>
                    {/* Base */}
                    <rect x="3" y="24" width="26" height="3" rx="0.5" fill="none"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">Bank Transfer</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Transfer directly from your bank account.</p>
                </div>
              </label>

              {/* Cash */}
              <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'cash' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="cash" 
                  checked={selectedMethod === 'cash'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-2 w-4 h-4 text-blue-600"
                />
                {/* Cash - Rupee Banknote with coins */}
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                  <svg width="32" height="24" viewBox="0 0 40 28" fill="none" stroke="#6b7280" strokeWidth="1.5">
                    {/* Banknote */}
                    <rect x="1" y="2" width="24" height="16" rx="1" fill="none"/>
                    {/* Rupee circle in banknote */}
                    <circle cx="13" cy="10" r="4" fill="#6b7280" stroke="none"/>
                    <text x="13" y="12.5" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" stroke="none">₹</text>
                    {/* Stacked coins */}
                    <ellipse cx="32" cy="20" rx="5" ry="2" fill="none"/>
                    <ellipse cx="32" cy="17" rx="5" ry="2" fill="none"/>
                    <ellipse cx="32" cy="14" rx="5" ry="2" fill="none"/>
                    <text x="32" y="16" textAnchor="middle" fill="#6b7280" fontSize="4" fontWeight="bold" stroke="none">₹</text>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">Cash</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Pay with cash at our office / collection point.</p>
                </div>
              </label>

              {/* Check */}
              <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'check' ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="check" 
                  checked={selectedMethod === 'check'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-2 w-4 h-4 text-blue-600"
                />
                {/* Cheque Icon - Line art style matching other icons */}
                <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                  <svg width="28" height="22" viewBox="0 0 32 26" fill="none" stroke="#6b7280" strokeWidth="1.5">
                    {/* Cheque paper */}
                    <rect x="1" y="2" width="22" height="16" rx="1" fill="none"/>
                    {/* Lines on cheque */}
                    <line x1="4" y1="6" x2="14" y2="6"/>
                    <line x1="4" y1="10" x2="20" y2="10"/>
                    <line x1="4" y1="14" x2="12" y2="14"/>
                    {/* Checkmark circle */}
                    <circle cx="26" cy="20" r="5" fill="#22c55e" stroke="none"/>
                    <path d="M23.5 20L25 21.5L28.5 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">Check</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Pay using cheque.</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Footer */}
        {selectedInvoice && (
          <>
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-700">After payment, your invoice will be marked as Paid and a receipt will be sent to you.</p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNextStep}
                disabled={processing || !selectedInvoice}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Proceed to Pay
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MakePayments;
