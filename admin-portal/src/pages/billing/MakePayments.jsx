import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
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

// Card logos component
const CardLogos = () => (
  <div className="flex items-center gap-2 mt-3 flex-wrap">
    <div className="px-2.5 py-1 bg-[#1a1f71] rounded text-white text-[11px] font-bold tracking-wide">VISA</div>
    <div className="w-7 h-5 bg-gradient-to-r from-[#eb001b] via-[#ff5f00] to-[#f79e1b] rounded flex items-center justify-center">
      <div className="flex">
        <div className="w-3 h-3 bg-[#eb001b] rounded-full opacity-80"></div>
        <div className="w-3 h-3 bg-[#f79e1b] rounded-full -ml-1.5 opacity-80"></div>
      </div>
    </div>
    <div className="px-2 py-1 bg-[#097a44] rounded text-white text-[10px] font-bold">RuPay</div>
    <div className="px-2 py-1 bg-[#016fd0] rounded text-white text-[10px] font-bold">maestro</div>
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded border border-gray-200">
      <Building2 className="w-3.5 h-3.5 text-gray-600" />
      <span className="text-[11px] text-gray-700 font-medium">Net Banking</span>
    </div>
  </div>
);

// UPI App logos component
const UPIAppLogos = () => (
  <div className="flex items-center gap-2 mt-3 flex-wrap">
    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200">
      <span className="text-sm font-medium">
        <span className="text-[#4285f4]">G</span>
        <span className="text-gray-700"> Pay</span>
      </span>
    </div>
    <div className="w-8 h-8 bg-[#5f259f] rounded-lg flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white rounded-full"></div>
    </div>
    <div className="px-2.5 py-1.5 bg-[#00baf2] rounded-lg">
      <span className="text-sm font-bold text-white">pay<span className="text-[#002970]">tm</span></span>
    </div>
    <div className="px-2.5 py-1.5 bg-[#ed752e] rounded-lg">
      <span className="text-sm font-bold text-white">BHIM</span>
    </div>
    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
      <span className="text-gray-500 font-bold text-sm">...</span>
    </div>
  </div>
);

// Your Collection Badge
const YourCollectionBadge = () => (
  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full border border-green-200">
    Your Collection
  </span>
);

// Powered by Razorpay Badge
const RazorpayBadge = () => (
  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-full border border-blue-200">
    Powered by Razorpay
  </span>
);

// No Fees indicator
const NoFeesIndicator = () => (
  <div className="text-right">
    <p className="text-green-600 font-semibold text-sm">No Additional Charges</p>
    <div className="flex items-center justify-end gap-1.5 mt-1">
      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      <span className="text-xs text-gray-500">Direct Collection</span>
    </div>
    <div className="flex items-center justify-end gap-1.5 mt-0.5">
      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      <span className="text-xs text-green-600 font-medium">No Fees</span>
    </div>
  </div>
);

// Fee indicator for Card/Net Banking
const FeeIndicator = () => (
  <div className="text-right">
    <p className="text-gray-500 text-xs">Processing Fee</p>
    <div className="flex items-center justify-end gap-1 mt-0.5">
      <span className="text-gray-900 font-semibold">2% + GST</span>
      <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
    </div>
    <div className="flex items-center justify-end gap-1.5 mt-2">
      <Lock className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-xs text-gray-500">Secure Payment</span>
    </div>
    <div className="flex items-center justify-end gap-1.5 mt-0.5">
      <Shield className="w-3.5 h-3.5 text-blue-500" />
      <span className="text-xs text-blue-600 font-medium">Razorpay Trusted</span>
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

  // Step 2 state for manual payments
  const [showStep2, setShowStep2] = useState(false);
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
    if (showStep2) {
      setShowStep2(false);
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
          invoiceId: selectedInvoice.invoiceId || selectedInvoice.id 
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

  // Handle proceed to pay
  const handleProceedToPay = () => {
    if (!selectedInvoice) {
      setError('Please select an invoice');
      return;
    }
    setError(null);
    
    if (selectedMethod === 'razorpay') {
      handleRazorpayPayment();
    } else {
      setShowStep2(true);
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

  // Step 2 - Manual Payment Details
  if (showStep2 && selectedInvoice) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Complete Payment</h1>
              <p className="text-sm text-gray-500">
                {selectedMethod === 'upi' && 'Pay using UPI'}
                {selectedMethod === 'bank_transfer' && 'Bank Transfer Details'}
                {selectedMethod === 'cash' && 'Record Cash Payment'}
                {selectedMethod === 'check' && 'Record Cheque Payment'}
              </p>
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

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* UPI Payment */}
            {selectedMethod === 'upi' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <Smartphone className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">UPI ID</p>
                    <p className="font-mono text-lg">{upiDetails.upiId}</p>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(upiDetails.upiId, 'upi')} 
                    className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    {copied === 'upi' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-1">Reference Number (use in remarks)</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold text-blue-900">{generatedReference}</p>
                    <button onClick={() => copyToClipboard(generatedReference, 'ref')} className="text-blue-600 hover:text-blue-700">
                      {copied === 'ref' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <UPIAppLogos />
              </div>
            )}

            {/* Bank Transfer */}
            {selectedMethod === 'bank_transfer' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Account Name</p>
                    <p className="font-semibold">{bankDetails.accountName}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Bank Name</p>
                    <p className="font-semibold">{bankDetails.bankName}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Account Number</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-semibold">{bankDetails.accountNumber}</p>
                      <button onClick={() => copyToClipboard(bankDetails.accountNumber, 'acc')}>
                        {copied === 'acc' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">IFSC Code</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-semibold">{bankDetails.ifscCode}</p>
                      <button onClick={() => copyToClipboard(bankDetails.ifscCode, 'ifsc')}>
                        {copied === 'ifsc' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-1">Reference Number (use in remarks)</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold text-blue-900">{generatedReference}</p>
                    <button onClick={() => copyToClipboard(generatedReference, 'ref')} className="text-blue-600 hover:text-blue-700">
                      {copied === 'ref' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Payment */}
            {selectedMethod === 'cash' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Received By *</label>
                  <input
                    type="text"
                    value={paymentDetails.receivedBy}
                    onChange={(e) => setPaymentDetails(prev => ({ ...prev, receivedBy: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Name of person receiving payment"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    value={paymentDetails.notes}
                    onChange={(e) => setPaymentDetails(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            )}

            {/* Cheque Payment */}
            {selectedMethod === 'check' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number *</label>
                    <input
                      type="text"
                      value={paymentDetails.chequeNumber}
                      onChange={(e) => setPaymentDetails(prev => ({ ...prev, chequeNumber: e.target.value, transactionReference: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter cheque number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Date *</label>
                    <input
                      type="date"
                      value={paymentDetails.chequeDate}
                      onChange={(e) => setPaymentDetails(prev => ({ ...prev, chequeDate: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    value={paymentDetails.chequeBank}
                    onChange={(e) => setPaymentDetails(prev => ({ ...prev, chequeBank: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Bank name on cheque"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Received By *</label>
                  <input
                    type="text"
                    value={paymentDetails.receivedBy}
                    onChange={(e) => setPaymentDetails(prev => ({ ...prev, receivedBy: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Name of person receiving cheque"
                  />
                </div>
              </div>
            )}

            {/* Payment Proof Upload */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Payment Proof {selectedMethod === 'cash' || selectedMethod === 'check' ? '(Optional)' : '(Recommended)'}
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input type="file" onChange={handleFileChange} className="hidden" id="proof-upload" accept="image/*,.pdf" />
                <label htmlFor="proof-upload" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">{paymentProof ? paymentProof.name : 'Click to upload or drag and drop'}</p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF up to 5MB</p>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={processing}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
              {processing ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Payment Selection Screen (Image 2 Layout)
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
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Choose Payment Method</h3>
              <p className="text-sm text-gray-500 mt-1">Select any one payment method to proceed</p>
            </div>

            <div className="divide-y divide-gray-100">
              {/* Debit/Card Payments & Net Banking */}
              <label className={`flex items-start gap-4 p-5 cursor-pointer transition-colors ${selectedMethod === 'razorpay' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="razorpay" 
                  checked={selectedMethod === 'razorpay'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-1 w-5 h-5 text-blue-600"
                />
                <div className="w-16 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Debit / Card Payments & Net Banking</h4>
                    <RazorpayBadge />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Pay securely using your debit card, credit card or net banking.</p>
                  <CardLogos />
                </div>
                <FeeIndicator />
              </label>

              {/* UPI */}
              <label className={`flex items-start gap-4 p-5 cursor-pointer transition-colors ${selectedMethod === 'upi' ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="upi" 
                  checked={selectedMethod === 'upi'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-1 w-5 h-5 text-green-600"
                />
                <div className="w-16 h-14 bg-white rounded-xl flex flex-col items-center justify-center border-2 border-gray-200 flex-shrink-0">
                  <span className="text-green-600 font-bold text-lg">UPI</span>
                  <span className="text-[7px] text-gray-400">UNIFIED PAYMENTS</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">UPI (QR / UPI ID)</h4>
                    <YourCollectionBadge />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Scan QR code or pay using any UPI app.</p>
                  <UPIAppLogos />
                </div>
                <NoFeesIndicator />
              </label>

              {/* Bank Transfer */}
              <label className={`flex items-start gap-4 p-5 cursor-pointer transition-colors ${selectedMethod === 'bank_transfer' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="bank_transfer" 
                  checked={selectedMethod === 'bank_transfer'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-1 w-5 h-5 text-amber-600"
                />
                <div className="w-16 h-14 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200 flex-shrink-0">
                  <Building2 className="w-7 h-7 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Bank Transfer</h4>
                    <YourCollectionBadge />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Transfer directly from your bank account.</p>
                </div>
                <NoFeesIndicator />
              </label>

              {/* Cash */}
              <label className={`flex items-start gap-4 p-5 cursor-pointer transition-colors ${selectedMethod === 'cash' ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="cash" 
                  checked={selectedMethod === 'cash'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-1 w-5 h-5 text-orange-600"
                />
                <div className="w-16 h-14 bg-orange-50 rounded-xl flex items-center justify-center border border-orange-200 flex-shrink-0">
                  <Banknote className="w-7 h-7 text-orange-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Cash</h4>
                    <YourCollectionBadge />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Pay with cash at our office / collection point.</p>
                </div>
                <NoFeesIndicator />
              </label>

              {/* Check */}
              <label className={`flex items-start gap-4 p-5 cursor-pointer transition-colors ${selectedMethod === 'check' ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  value="check" 
                  checked={selectedMethod === 'check'} 
                  onChange={(e) => setSelectedMethod(e.target.value)} 
                  className="mt-1 w-5 h-5 text-red-600"
                />
                <div className="w-16 h-14 bg-red-50 rounded-xl flex items-center justify-center border border-red-200 flex-shrink-0">
                  <FileCheck className="w-7 h-7 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Check</h4>
                    <YourCollectionBadge />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Pay using cheque.</p>
                </div>
                <NoFeesIndicator />
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
                onClick={handleProceedToPay}
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
