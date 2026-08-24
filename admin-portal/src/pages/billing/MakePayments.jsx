import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Banknote,
  CheckCircle,
  AlertCircle,
  Shield,
  ArrowRight,
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
  Edit,
  Clock,
  IndianRupee,
  MapPin,
  User,
  MessageSquare,
  CreditCard,
  Lock,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Payment method labels and colors
const PAYMENT_METHOD_CONFIG = {
  razorpay: { label: 'Card/Net Banking', color: 'bg-blue-100 text-blue-700 border-blue-200', detailsLabel: 'Razorpay payment' },
  upi: { label: 'UPI', color: 'bg-green-100 text-green-700 border-green-200', detailsLabel: 'Enter UPI payment details' },
  bank_transfer: { label: 'Bank Transfer', color: 'bg-amber-100 text-amber-700 border-amber-200', detailsLabel: 'Enter bank transfer details' },
  cash: { label: 'Cash', color: 'bg-orange-100 text-orange-700 border-orange-200', detailsLabel: 'Enter payment information' },
  check: { label: 'Cheque', color: 'bg-red-100 text-red-700 border-red-200', detailsLabel: 'Enter cheque information' },
};

// Card Payment Icon
const CardIcon = () => (
  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
    <CreditCard className="w-7 h-7 text-white" />
  </div>
);

// Card logos component
const CardLogos = () => (
  <div className="flex items-center gap-2 mt-2 flex-wrap">
    <div className="px-2 py-1 bg-blue-900 rounded text-white text-[10px] font-bold">VISA</div>
    <div className="w-6 h-6 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full flex items-center justify-center">
      <div className="w-4 h-4 bg-gradient-to-r from-red-600 to-orange-500 rounded-full"></div>
    </div>
    <div className="px-2 py-1 bg-blue-600 rounded text-white text-[10px] font-bold">RuPay</div>
    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
      <span className="text-white text-[8px] font-bold">M</span>
    </div>
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
      <Building2 className="w-3 h-3 text-gray-600" />
      <span className="text-[10px] text-gray-600">Net Banking</span>
    </div>
  </div>
);

// UPI App logos component - matches reference image exactly
const UPIAppLogos = () => (
  <div className="flex items-center gap-2 mt-3">
    {/* GPay */}
    <div className="flex items-center gap-0.5 px-2 py-1.5 bg-white rounded-lg border border-gray-200">
      <span className="text-sm font-medium">
        <span className="text-blue-500">G</span>
        <span className="text-red-500"> </span>
        <span className="text-gray-700">Pay</span>
      </span>
    </div>
    {/* PhonePe */}
    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="currentColor"/>
        <path d="M8 12c0 2.2 1.8 4 4 4s4-1.8 4-4" stroke="white" strokeWidth="2" fill="none"/>
      </svg>
    </div>
    {/* Paytm */}
    <div className="px-2 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
      <span className="text-sm font-bold text-blue-600">pay<span className="text-blue-800">tm</span></span>
    </div>
    {/* BHIM */}
    <div className="px-2 py-1.5 bg-orange-50 rounded-lg border border-orange-100">
      <span className="text-sm font-bold text-orange-600">BHIM</span>
    </div>
    {/* More */}
    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
      <span className="text-gray-500 font-bold">...</span>
    </div>
  </div>
);

// UPI Icon - matches official UPI branding
const UPIIcon = () => (
  <div className="w-16 h-14 bg-white rounded-xl flex flex-col items-center justify-center border border-gray-200 p-1">
    <div className="flex items-baseline">
      <span className="text-green-600 font-bold text-lg tracking-tight">UPI</span>
      <span className="text-orange-500 font-bold text-lg">|</span>
    </div>
    <span className="text-[7px] text-gray-400 uppercase tracking-wider">Unified Payments</span>
  </div>
);

const BankIcon = () => (
  <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200">
    <Building2 className="w-7 h-7 text-amber-600" />
  </div>
);

const CashIcon = () => (
  <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-200">
    <Banknote className="w-7 h-7 text-orange-500" />
  </div>
);

const ChequeIcon = () => (
  <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center border border-red-200">
    <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </div>
);

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

// Format date
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format date with time
const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
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

const MakePayments = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoiceId = searchParams.get('invoiceId');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState('razorpay');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // Step 2 - Payment Details form data
  const [paymentDetails, setPaymentDetails] = useState({
    transactionReference: '',
    paymentLocation: 'Office / Collection Point',
    receivedBy: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '',
    notes: '',
  });
  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState(null);

  const token = getAuthToken();

  // Bank details
  const bankDetails = {
    accountName: 'XLAND INFRA PVT LTD',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branch: 'Main Branch'
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

  // Update receivedBy when user loads
  useEffect(() => {
    if (user && !paymentDetails.receivedBy) {
      setPaymentDetails(prev => ({
        ...prev,
        receivedBy: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      }));
    }
  }, [user]);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSelectInvoice = (invoice) => {
    setSelectedInvoice(invoice);
  };

  const handleBack = () => {
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
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPaymentProofPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setPaymentProofPreview(null);
      }
    }
  };

  // Handle Razorpay payment - create payment link and redirect
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
          invoiceId: selectedInvoice.invoiceId || selectedInvoice.id 
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data?.paymentLink) {
        // Redirect to Razorpay payment page
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

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!selectedInvoice) {
        setError('Please select an invoice');
        return;
      }
      
      // For Razorpay, directly process payment instead of going to step 2
      if (selectedMethod === 'razorpay') {
        handleRazorpayPayment();
        return;
      }
      
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Validate step 2 based on payment method
      if (selectedMethod === 'cash') {
        if (!paymentDetails.receivedBy) {
          setError('Please enter who received the payment');
          return;
        }
      } else if (selectedMethod === 'check') {
        if (!paymentDetails.transactionReference) {
          setError('Please enter the cheque number');
          return;
        }
        if (!paymentDetails.chequeBank) {
          setError('Please select the bank name');
          return;
        }
        if (!paymentDetails.receivedBy) {
          setError('Please select who received the cheque');
          return;
        }
      }
      // For bank_transfer and upi, the generated reference is used
      // No manual entry required, just need payment proof (recommended)
      setCurrentStep(3);
    }
    setError(null);
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      handleBack();
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedInvoice) return;
    
    setProcessing(true);
    setError(null);
    
    // Use generated reference for bank_transfer/upi, manual for others
    const finalReference = (selectedMethod === 'bank_transfer' || selectedMethod === 'upi') 
      ? generatedReference 
      : paymentDetails.transactionReference;
    
    try {
      const submitData = new FormData();
      submitData.append('invoiceId', selectedInvoice.id || selectedInvoice.invoiceId);
      submitData.append('amount', selectedInvoice.balanceAmount || selectedInvoice.totalAmount);
      submitData.append('paymentMethod', selectedMethod);
      submitData.append('paymentDate', paymentDetails.receivedDate || paymentDetails.checkDate || new Date().toISOString().split('T')[0]);
      submitData.append('customerName', selectedInvoice.customerName || '');
      submitData.append('paymentStatus', 'verification_pending');
      submitData.append('transactionReference', finalReference);
      submitData.append('receivedBy', paymentDetails.receivedBy || user?.firstName || 'Admin');
      submitData.append('remarks', paymentDetails.notes || '');
      submitData.append('paymentLocation', paymentDetails.paymentLocation || 'Online Transfer');
      
      // Check-specific fields
      if (selectedMethod === 'check') {
        submitData.append('chequeBank', paymentDetails.chequeBank || '');
        submitData.append('chequeBranch', paymentDetails.chequeBranch || '');
        submitData.append('checkDate', paymentDetails.checkDate || '');
        submitData.append('payeeName', paymentDetails.payeeName || 'XLAND INFRA PM SERVICES PVT LTD');
      }
      
      // Cash-specific fields
      if (selectedMethod === 'cash') {
        submitData.append('amountReceived', paymentDetails.amountReceived || balanceAmount);
        submitData.append('receivedDate', paymentDetails.receivedDate || new Date().toISOString().split('T')[0]);
      }
      
      if (paymentProof) {
        submitData.append('paymentProof', paymentProof);
      }
      
      const response = await fetch(`${API_BASE}/api/payments/payments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
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
  const isDueDatePassed = daysUntilDue !== null && daysUntilDue < 0;
  const balanceAmount = selectedInvoice ? (parseFloat(selectedInvoice.balanceAmount) || parseFloat(selectedInvoice.totalAmount) || 0) : 0;
  const totalAmount = selectedInvoice ? (parseFloat(selectedInvoice.totalAmount) || 0) : 0;
  const amountPaid = totalAmount - balanceAmount;
  const methodConfig = PAYMENT_METHOD_CONFIG[selectedMethod];
  
  // Generate reference number based on invoice
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">Make Payment</h1>
        </div>
      </div>

      {/* Compact Invoice Details Bar */}
      {selectedInvoice && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-medium text-blue-900">{selectedInvoice.invoiceId}</span>
              <span className="text-blue-700">{selectedInvoice.propertyName || selectedInvoice.customerName}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${isDueDatePassed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                Due: {formatDate(selectedInvoice.dueDate)}
              </span>
            </div>
            <span className="font-bold text-blue-900">{formatCurrencyShort(balanceAmount)}</span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-4">
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
              <X className="w-3 h-3 text-red-600" />
            </button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex gap-4">
          <div className="flex-1">
            {/* Compact Progress Steps */}
            {currentStep <= 2 && selectedInvoice && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${currentStep >= 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {currentStep > 1 ? <CheckCircle className="w-3 h-3" /> : <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>}
                  Select Method
                </span>
                <div className="w-6 h-px bg-gray-300" />
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${currentStep >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  <span className="w-4 h-4 rounded-full bg-gray-400 text-white flex items-center justify-center text-[10px]">2</span>
                  Review & Confirm
                </span>
              </div>
            )}

            {/* Step 1: Select Invoice & Payment Method */}
            {currentStep === 1 && (
              <>
                {/* Invoice Selector - Compact Table View */}
                {!selectedInvoice && (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
                      <h3 className="font-medium text-gray-800 text-sm">Select Invoice</h3>
                      <div className="relative flex-1 max-w-[200px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Search..."
                          className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    {filteredInvoices.length > 0 ? (
                      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {filteredInvoices.map((invoice) => (
                          <div
                            key={invoice.id || invoice.invoiceId}
                            onClick={() => handleSelectInvoice(invoice)}
                            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 text-xs">{invoice.invoiceId}</p>
                                <p className="text-[11px] text-gray-500 truncate">{invoice.customerName || invoice.propertyName}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="font-semibold text-gray-900 text-xs">{formatCurrency(invoice.balanceAmount || invoice.totalAmount)}</p>
                              <p className="text-[10px] text-gray-400">Due: {formatDate(invoice.dueDate)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-xs">
                        No unpaid invoices found
                      </div>
                    )}
                  </div>
                )}

            {/* Choose Payment Method - Compact Grid */}
            {selectedInvoice && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-medium text-gray-800 text-sm">Payment Method</h3>
                  <button onClick={() => setSelectedInvoice(null)} className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">
                    Change
                  </button>
                </div>

                <div className="p-2 grid grid-cols-3 lg:grid-cols-5 gap-1.5">
                  {/* Razorpay */}
                  <label className={`flex flex-col items-center p-2 border rounded cursor-pointer transition-all text-center ${
                    selectedMethod === 'razorpay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="paymentMethod" value="razorpay" checked={selectedMethod === 'razorpay'} onChange={(e) => setSelectedMethod(e.target.value)} className="sr-only" />
                    <CreditCard className="w-5 h-5 text-blue-600 mb-1" />
                    <span className="font-medium text-gray-900 text-[11px]">Card</span>
                    <span className="text-[9px] text-gray-400">2% fee</span>
                  </label>

                  {/* UPI */}
                  <label className={`flex flex-col items-center p-2 border rounded cursor-pointer transition-all text-center ${
                    selectedMethod === 'upi' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="paymentMethod" value="upi" checked={selectedMethod === 'upi'} onChange={(e) => setSelectedMethod(e.target.value)} className="sr-only" />
                    <Smartphone className="w-5 h-5 text-green-600 mb-1" />
                    <span className="font-medium text-gray-900 text-[11px]">UPI</span>
                    <span className="text-[9px] text-green-600">Free</span>
                  </label>

                  {/* Bank Transfer */}
                  <label className={`flex flex-col items-center p-2 border rounded cursor-pointer transition-all text-center ${
                    selectedMethod === 'bank_transfer' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="paymentMethod" value="bank_transfer" checked={selectedMethod === 'bank_transfer'} onChange={(e) => setSelectedMethod(e.target.value)} className="sr-only" />
                    <Building2 className="w-5 h-5 text-amber-600 mb-1" />
                    <span className="font-medium text-gray-900 text-[11px]">Bank</span>
                    <span className="text-[9px] text-green-600">Free</span>
                  </label>

                  {/* Cash */}
                  <label className={`flex flex-col items-center p-2 border rounded cursor-pointer transition-all text-center ${
                    selectedMethod === 'cash' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="paymentMethod" value="cash" checked={selectedMethod === 'cash'} onChange={(e) => setSelectedMethod(e.target.value)} className="sr-only" />
                    <Banknote className="w-5 h-5 text-orange-600 mb-1" />
                    <span className="font-medium text-gray-900 text-[11px]">Cash</span>
                    <span className="text-[9px] text-green-600">Free</span>
                  </label>

                  {/* Cheque */}
                  <label className={`flex flex-col items-center p-2 border rounded cursor-pointer transition-all text-center ${
                    selectedMethod === 'check' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input type="radio" name="paymentMethod" value="check" checked={selectedMethod === 'check'} onChange={(e) => setSelectedMethod(e.target.value)} className="sr-only" />
                    <FileCheck className="w-5 h-5 text-teal-600 mb-1" />
                    <span className="font-medium text-gray-900 text-[11px]">Cheque</span>
                    <span className="text-[9px] text-green-600">Free</span>
                  </label>
                </div>
              </div>
            )}
              </>
            )}
            

        {/* Step 2: Payment Details - Method Specific */}
        {currentStep === 2 && selectedInvoice && (
          <>
            {/* Bank Transfer Details */}
            {selectedMethod === 'bank_transfer' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-1">Bank Transfer Details</h3>
                <p className="text-sm text-gray-500 mb-5">Transfer the amount to the bank account below</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* How it works */}
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">How it works?</h4>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">1.</span>
                        <span>Transfer the exact amount to the bank account below</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">2.</span>
                        <span>Use the provided reference number in your transfer</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">3.</span>
                        <span>Upload payment proof for verification</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">4.</span>
                        <span>We will verify and update your payment</span>
                      </li>
                    </ol>
                    <div className="mt-4 flex items-center gap-2 text-green-600">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">No additional charges for Bank Transfer</span>
                    </div>
                  </div>

                  {/* Bank Account Details */}
                  <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/30">
                    <h4 className="font-semibold text-blue-700 mb-4">Our Bank Account Details</h4>
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
                          <p className="font-semibold text-gray-900">Current Account</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Branch</p>
                          <p className="font-semibold text-gray-900">{bankDetails.branch}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-blue-200">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Reference / UTR Number</p>
                          <p className="font-mono font-semibold text-blue-600">{generatedReference}</p>
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
            )}

            {/* UPI Details */}
            {selectedMethod === 'upi' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-1">UPI Payment Details</h3>
                <p className="text-sm text-gray-500 mb-5">Pay using any UPI app</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* How it works */}
                  <div className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-green-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">How it works?</h4>
                    </div>
                    <ol className="space-y-3 text-sm text-gray-600">
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">1.</span>
                        <span>Open any UPI app (GPay, PhonePe, Paytm, BHIM)</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">2.</span>
                        <span>Enter the UPI ID or scan QR code</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">3.</span>
                        <span>Enter the exact amount and add reference in remarks</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-semibold text-gray-900">4.</span>
                        <span>Upload payment screenshot for verification</span>
                      </li>
                    </ol>
                    <div className="mt-4 flex items-center gap-2 text-green-600">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">No additional charges for UPI Payment</span>
                    </div>
                  </div>

                  {/* UPI Details */}
                  <div className="border border-green-200 rounded-xl p-5 bg-green-50/30">
                    <h4 className="font-semibold text-green-700 mb-4">Our UPI Details</h4>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
                        <Smartphone className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">UPI ID</p>
                          <p className="font-mono font-semibold text-gray-900">{upiDetails.upiId}</p>
                        </div>
                        <button onClick={() => copyToClipboard(upiDetails.upiId, 'upi')} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">
                          {copied === 'upi' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
                        <FileText className="w-5 h-5 text-green-600" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Reference Number (use in remarks)</p>
                          <p className="font-mono font-semibold text-green-600">{generatedReference}</p>
                        </div>
                        <button onClick={() => copyToClipboard(generatedReference, 'ref')} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">
                          {copied === 'ref' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className="mt-2">
                        <UPIAppLogos />
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
            )}

            {/* Cash Payment Details */}
            {selectedMethod === 'cash' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-1">Cash Payment Details</h3>
                <p className="text-sm text-gray-500 mb-5">Enter the cash payment information below</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left side - Form Fields */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Amount and Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Amount Received *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                          <input
                            type="text"
                            value={paymentDetails.amountReceived || formatCurrencyShort(balanceAmount).replace('₹', '')}
                            onChange={(e) => setPaymentDetails({...paymentDetails, amountReceived: e.target.value})}
                            className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Received Date *</label>
                        <input
                          type="date"
                          value={paymentDetails.receivedDate || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setPaymentDetails({...paymentDetails, receivedDate: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Received By and Location Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Received By *</label>
                        <select
                          value={paymentDetails.receivedBy}
                          onChange={(e) => setPaymentDetails({...paymentDetails, receivedBy: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Staff / Employee</option>
                          <option value={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Admin'}>{user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Admin'}</option>
                          <option value="Field Executive">Field Executive</option>
                          <option value="Collection Agent">Collection Agent</option>
                          <option value="Office Staff">Office Staff</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Location *</label>
                        <div className="space-y-2 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentLocation"
                              value="Office / Collection Point"
                              checked={paymentDetails.paymentLocation === 'Office / Collection Point'}
                              onChange={(e) => setPaymentDetails({...paymentDetails, paymentLocation: e.target.value})}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Office / Collection Point</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="paymentLocation"
                              value="At Property Site"
                              checked={paymentDetails.paymentLocation === 'At Property Site'}
                              onChange={(e) => setPaymentDetails({...paymentDetails, paymentLocation: e.target.value})}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">At Property Site</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Receipt Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Receipt / Reference No.</label>
                      <input
                        type="text"
                        value={paymentDetails.transactionReference}
                        onChange={(e) => setPaymentDetails({...paymentDetails, transactionReference: e.target.value})}
                        placeholder="Enter receipt or reference number"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                      <textarea
                        value={paymentDetails.notes}
                        onChange={(e) => setPaymentDetails({...paymentDetails, notes: e.target.value})}
                        placeholder="Add any additional notes about this payment..."
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>

                  {/* Right side - Info Cards */}
                  <div className="space-y-4">
                    {/* Cash Payment Info Card */}
                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Banknote className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Cash Payment</h4>
                          <p className="text-xs text-green-600 font-medium">No Additional Charges</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        Collect cash from the customer and record the payment details.
                      </p>
                    </div>

                    {/* Important Reminders Card */}
                    <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
                      <h4 className="font-semibold text-amber-800 mb-3">Important Reminders</h4>
                      <ul className="space-y-2 text-sm text-amber-700">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Count and verify the cash amount before saving</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Provide a receipt to the customer</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Keep the cash in the safe / cash box</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Update the payment status after collection</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Notice */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    After saving, the payment will be marked as "Verification Pending".
                  </p>
                </div>
              </div>
            )}

            {/* Cheque Payment Details */}
            {selectedMethod === 'check' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-1">Cheque Payment Details</h3>
                <p className="text-sm text-gray-500 mb-5">Enter the cheque payment information below</p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left side - Form Fields */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Cheque Number and Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cheque Number *</label>
                        <input
                          type="text"
                          value={paymentDetails.transactionReference}
                          onChange={(e) => setPaymentDetails({...paymentDetails, transactionReference: e.target.value})}
                          placeholder="Enter cheque number"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cheque Date *</label>
                        <input
                          type="date"
                          value={paymentDetails.checkDate || new Date().toISOString().split('T')[0]}
                          onChange={(e) => setPaymentDetails({...paymentDetails, checkDate: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Bank Name and Branch Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name *</label>
                        <select
                          value={paymentDetails.chequeBank || ''}
                          onChange={(e) => setPaymentDetails({...paymentDetails, chequeBank: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Bank</option>
                          <option value="HDFC Bank">HDFC Bank</option>
                          <option value="ICICI Bank">ICICI Bank</option>
                          <option value="State Bank of India">State Bank of India</option>
                          <option value="Axis Bank">Axis Bank</option>
                          <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                          <option value="Punjab National Bank">Punjab National Bank</option>
                          <option value="Bank of Baroda">Bank of Baroda</option>
                          <option value="Canara Bank">Canara Bank</option>
                          <option value="Union Bank of India">Union Bank of India</option>
                          <option value="IndusInd Bank">IndusInd Bank</option>
                          <option value="Yes Bank">Yes Bank</option>
                          <option value="IDBI Bank">IDBI Bank</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name</label>
                        <input
                          type="text"
                          value={paymentDetails.chequeBranch || ''}
                          onChange={(e) => setPaymentDetails({...paymentDetails, chequeBranch: e.target.value})}
                          placeholder="Enter branch name"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Payee Name and Amount Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payee Name *</label>
                        <input
                          type="text"
                          value={paymentDetails.payeeName || 'XLAND INFRA PM SERVICES PVT LTD'}
                          onChange={(e) => setPaymentDetails({...paymentDetails, payeeName: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹) *</label>
                        <input
                          type="text"
                          value={paymentDetails.checkAmount || formatCurrencyShort(balanceAmount).replace('₹', '').trim()}
                          onChange={(e) => setPaymentDetails({...paymentDetails, checkAmount: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Received By and Location Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Received By *</label>
                        <select
                          value={paymentDetails.receivedBy}
                          onChange={(e) => setPaymentDetails({...paymentDetails, receivedBy: e.target.value})}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                        >
                          <option value="">Select Staff / Employee</option>
                          <option value={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Admin'}>{user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Admin'}</option>
                          <option value="Field Executive">Field Executive</option>
                          <option value="Collection Agent">Collection Agent</option>
                          <option value="Office Staff">Office Staff</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Location *</label>
                        <div className="space-y-2 mt-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="checkPaymentLocation"
                              value="Office / Collection Point"
                              checked={paymentDetails.paymentLocation === 'Office / Collection Point'}
                              onChange={(e) => setPaymentDetails({...paymentDetails, paymentLocation: e.target.value})}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Office / Collection Point</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="checkPaymentLocation"
                              value="At Property Site"
                              checked={paymentDetails.paymentLocation === 'At Property Site'}
                              onChange={(e) => setPaymentDetails({...paymentDetails, paymentLocation: e.target.value})}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">At Property Site</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                      <textarea
                        value={paymentDetails.notes}
                        onChange={(e) => setPaymentDetails({...paymentDetails, notes: e.target.value})}
                        placeholder="Add any additional notes about this payment..."
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>

                  {/* Right side - Info Cards */}
                  <div className="space-y-4">
                    {/* Cheque Payment Info Card */}
                    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Cheque Payment</h4>
                          <p className="text-xs text-green-600 font-medium">No Additional Charges</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        We will deposit the cheque and update the payment status once it is cleared.
                      </p>
                    </div>

                    {/* Important Reminders Card */}
                    <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
                      <h4 className="font-semibold text-amber-800 mb-3">Important Reminders</h4>
                      <ul className="space-y-2 text-sm text-amber-700">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Ensure the cheque is valid and not expired</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Write the correct payee name</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Post-dated cheques will be cleared on the given date</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <span>Payment status will be updated after cheque clearance</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Notice */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    After saving, the payment will be marked as "Verification Pending" until the cheque is cleared.
                  </p>
                </div>
              </div>
            )}

            {/* Upload Payment Proof Section - Only for Bank Transfer and UPI */}
            {(selectedMethod === 'bank_transfer' || selectedMethod === 'upi') && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 mb-1">Upload Payment Proof</h3>
                <p className="text-sm text-gray-500 mb-5">Please upload the screenshot or receipt of the {selectedMethod === 'bank_transfer' ? 'bank transfer' : 'UPI payment'}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                    {paymentProof ? (
                      <div className="flex flex-col items-center gap-4">
                        {paymentProofPreview ? (
                          <img src={paymentProofPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border" />
                        ) : (
                          <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        <div className="text-center">
                          <p className="font-medium text-gray-900">{paymentProof.name}</p>
                          <p className="text-sm text-gray-500">{(paymentProof.size / 1024).toFixed(1)} KB</p>
                          <button
                            onClick={() => { setPaymentProof(null); setPaymentProofPreview(null); }}
                            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove File
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600 mb-2">Drag & drop your file here or</p>
                        <span className="inline-block px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                          Choose File
                        </span>
                        <p className="text-xs text-gray-400 mt-3">Supports: JPG, PNG, PDF (Max size: 5MB)</p>
                        <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
                      </label>
                    )}
                  </div>

                  {/* Important Notes */}
                  <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/50">
                    <h4 className="font-semibold text-amber-800 mb-3">Important Notes</h4>
                    <ul className="space-y-2 text-sm text-amber-700">
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-1">•</span>
                        <span>Make sure to transfer the exact amount</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-1">•</span>
                        <span>Use the reference number in your transfer</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-1">•</span>
                        <span>Upload clear payment proof</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-1">•</span>
                        <span>Payments are verified within 24 hours</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-600 mt-1">•</span>
                        <span>You will receive confirmation once verified</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 3: Review & Confirm */}
        {currentStep === 3 && selectedInvoice && (
          <>
            {/* Review Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Review Payment Information</h3>
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Invoice Details Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Invoice Details</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Invoice ID</span>
                    <span className="text-sm font-medium text-gray-900">{selectedInvoice.invoiceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Customer</span>
                    <span className="text-sm font-medium text-gray-900">{selectedInvoice.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Invoice Date</span>
                    <span className="text-sm font-medium text-gray-900">{formatDate(selectedInvoice.invoiceDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Due Date</span>
                    <span className={`text-sm font-medium ${isDueDatePassed ? 'text-red-600' : 'text-gray-900'}`}>{formatDate(selectedInvoice.dueDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Amount</span>
                    <span className="text-sm font-medium text-gray-900">{formatCurrencyShort(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Amount Payable</span>
                    <span className="text-sm font-bold text-blue-600">{formatCurrencyShort(balanceAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method & Amount Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Payment Method</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${methodConfig?.color}`}>
                    {methodConfig?.label}
                  </span>
                  <span className="text-xs text-green-600">No Additional Charges</span>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                      <IndianRupee className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-900">Amount Information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Invoice Amount</span>
                      <span className="font-medium">{formatCurrencyShort(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tax (0%)</span>
                      <span className="font-medium">{formatCurrencyShort(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Amount</span>
                      <span className="font-medium">{formatCurrencyShort(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount Paid</span>
                      <span className="font-medium">{formatCurrencyShort(amountPaid)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="font-medium text-blue-600">Amount Payable</span>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrencyShort(balanceAmount)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Payment Proof Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Payment Proof</h4>
                </div>
                {paymentProof ? (
                  <div className="flex items-start gap-4">
                    {paymentProofPreview ? (
                      <img src={paymentProofPreview} alt="Proof" className="w-24 h-24 object-cover rounded-lg border" />
                    ) : (
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border">
                        <FileText className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{paymentProof.name}</p>
                      <p className="text-xs text-gray-500 mt-1">Uploaded on: {formatDateTime(new Date())}</p>
                      <p className="text-xs text-gray-500">Uploaded by: {paymentDetails.receivedBy}</p>
                      <div className="flex items-center gap-1 mt-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Proof Uploaded</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No payment proof uploaded</p>
                  </div>
                )}
              </div>

              {/* Additional Information Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Info className="w-4 h-4 text-amber-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    {selectedMethod === 'check' ? 'Cheque Details' : 'Additional Information'}
                  </h4>
                </div>
                <div className="space-y-3">
                  {/* Cheque-specific details */}
                  {selectedMethod === 'check' && (
                    <>
                      <div className="flex items-start gap-3">
                        <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Cheque Number</p>
                          <p className="text-sm font-medium text-gray-900 font-mono">{paymentDetails.transactionReference}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Bank Name</p>
                          <p className="text-sm font-medium text-gray-900">{paymentDetails.chequeBank}</p>
                        </div>
                      </div>
                      {paymentDetails.chequeBranch && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Branch Name</p>
                            <p className="text-sm font-medium text-gray-900">{paymentDetails.chequeBranch}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Cheque Date</p>
                          <p className="text-sm font-medium text-gray-900">{formatDate(paymentDetails.checkDate)}</p>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Cash-specific details */}
                  {selectedMethod === 'cash' && paymentDetails.receivedDate && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Received Date</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(paymentDetails.receivedDate)}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Payment Location</p>
                      <p className="text-sm font-medium text-gray-900">{paymentDetails.paymentLocation}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Received By</p>
                      <p className="text-sm font-medium text-gray-900">{paymentDetails.receivedBy || user?.firstName || 'Admin'}</p>
                    </div>
                  </div>
                  
                  {/* Reference for bank_transfer/upi */}
                  {(selectedMethod === 'bank_transfer' || selectedMethod === 'upi') && (
                    <div className="flex items-start gap-3">
                      <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Reference / Transaction No.</p>
                        <p className="text-sm font-medium text-gray-900 font-mono">{generatedReference}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Receipt number for cash */}
                  {selectedMethod === 'cash' && paymentDetails.transactionReference && (
                    <div className="flex items-start gap-3">
                      <FileCheck className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Receipt / Reference No.</p>
                        <p className="text-sm font-medium text-gray-900 font-mono">{paymentDetails.transactionReference}</p>
                      </div>
                    </div>
                  )}
                  
                  {paymentDetails.notes && (
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="text-sm font-medium text-gray-900">{paymentDetails.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notice */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
              <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-800">
                  <strong>Please verify all the details carefully before confirming.</strong>
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Once confirmed, the payment will be marked as "Verification Pending" and our team will verify the payment.
                </p>
              </div>
            </div>
          </>
        )}

            {/* Compact Action Buttons */}
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
              {currentStep === 1 ? (
                <button onClick={handleBack} className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              ) : (
                <button onClick={handlePreviousStep} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              
              {currentStep === 1 && (
                <button
                  onClick={handleNextStep}
                  disabled={!selectedInvoice || processing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              
              {currentStep === 2 && (
                <button
                  onClick={handleNextStep}
                  disabled={!selectedInvoice || (selectedMethod === 'check' && (!paymentDetails.transactionReference || !paymentDetails.chequeBank))}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              
              {currentStep === 3 && (
                <button
                  onClick={handleConfirmPayment}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Confirm Payment
                </button>
              )}
            </div>
          </div>

          {/* Right Sidebar - Only show in Step 1 when invoice is selected */}
          {currentStep === 1 && selectedInvoice && (
            <div className="w-80 flex-shrink-0 space-y-4">
              {/* Payment Summary Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Invoice Amount</span>
                    <span className="font-medium text-gray-900">{formatCurrencyShort(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax (0%)</span>
                    <span className="font-medium text-gray-900">{formatCurrencyShort(0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Amount</span>
                    <span className="font-medium text-gray-900">{formatCurrencyShort(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Amount Paid</span>
                    <span className="font-medium text-gray-900">{formatCurrencyShort(amountPaid)}</span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="font-medium text-blue-600">Amount Payable</span>
                      <span className="text-xl font-bold text-blue-600">{formatCurrencyShort(balanceAmount)}</span>
                    </div>
                  </div>
                </div>
                {daysUntilDue !== null && (
                  <div className={`mt-4 flex items-center gap-2 text-sm ${isDueDatePassed ? 'text-red-600' : 'text-amber-600'}`}>
                    <Clock className="w-4 h-4" />
                    <span>
                      {isDueDatePassed 
                        ? `Invoice overdue by ${Math.abs(daysUntilDue)} days`
                        : `Invoice due in ${daysUntilDue} days`
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* UPI QR Code Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">UPI QR (Scan & Pay)</h3>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Your Collection</span>
                </div>
                <div className="flex flex-col items-center">
                  {/* QR Code Placeholder */}
                  <div className="w-40 h-40 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-center text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span className="text-xs">QR Code</span>
                    </div>
                  </div>
                  <p className="text-sm font-mono text-gray-700 mb-1">UPI ID: {upiDetails.upiId}</p>
                  <p className="text-xs text-gray-500">Scan with any UPI app to pay</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded border border-gray-200">
                      <span className="text-xs font-semibold text-gray-700">G</span>
                      <span className="text-xs text-gray-600">Pay</span>
                    </div>
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-[8px] font-bold">Pe</span>
                    </div>
                    <div className="flex items-center px-2 py-1 bg-blue-50 rounded border border-blue-200">
                      <span className="text-xs font-semibold text-blue-600">Paytm</span>
                    </div>
                    <div className="flex items-center px-2 py-1 bg-green-50 rounded border border-green-200">
                      <span className="text-xs font-semibold text-green-700">BHIM</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Why different payment options? */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Why different payment options?</h4>
                <p className="text-sm text-gray-600">
                  Card/Net Banking is instant via Razorpay (2% + GST).
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Other methods (UPI, Bank Transfer, Cash, Check) have no extra charges.
                </p>
              </div>

              {/* 100% Secure & Trusted */}
              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">100% Secure & Trusted</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Your payment information is safe with us.
                    </p>
                    <p className="text-sm text-gray-600">
                      We never store your card or bank details.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MakePayments;
