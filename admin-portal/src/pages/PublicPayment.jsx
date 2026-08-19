import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  Building2, 
  Banknote, 
  CheckCircle, 
  ArrowLeft,
  Shield,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Simple Math CAPTCHA Component
const MathCaptcha = ({ onVerify }) => {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState('');

  const generateCaptcha = useCallback(() => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setUserAnswer('');
    setError('');
  }, []);

  useEffect(() => {
    generateCaptcha();
  }, [generateCaptcha]);

  const handleVerify = () => {
    const correctAnswer = num1 + num2;
    if (parseInt(userAnswer) === correctAnswer) {
      onVerify(true);
    } else {
      setError('Incorrect answer. Please try again.');
      generateCaptcha();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Security Verification</h2>
        <p className="text-gray-500 text-sm mt-1">Please solve this to continue</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-6 mb-4">
        <div className="flex items-center justify-center gap-3 text-2xl font-bold text-gray-800">
          <span className="bg-white px-4 py-2 rounded-lg shadow-sm">{num1}</span>
          <span className="text-blue-600">+</span>
          <span className="bg-white px-4 py-2 rounded-lg shadow-sm">{num2}</span>
          <span className="text-gray-400">=</span>
          <span className="text-blue-600">?</span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Your answer"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-center text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
        />
        <button
          onClick={generateCaptcha}
          className="px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          title="New question"
        >
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center mb-4">{error}</p>
      )}

      <button
        onClick={handleVerify}
        disabled={!userAnswer}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Verify & Continue
      </button>
    </div>
  );
};

// Payment method icons
const UPIIcon = () => (
  <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center border border-green-200">
    <span className="text-green-600 font-bold text-xs">UPI</span>
  </div>
);

const BankIcon = () => (
  <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-200">
    <Building2 className="w-7 h-7 text-blue-600" />
  </div>
);

const CashIcon = () => (
  <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-200">
    <Banknote className="w-7 h-7 text-amber-600" />
  </div>
);

const ChequeIcon = () => (
  <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center border border-purple-200">
    <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  </div>
);

const PublicPayment = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('razorpay');
  const [processing, setProcessing] = useState(false);
  const [copied, setCopied] = useState(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);

  // Bank details for bank transfer
  const bankDetails = {
    accountName: 'XLAND INFRA PVT LTD',
    accountNumber: '50200012345678',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    branch: 'Main Branch'
  };

  // UPI details
  const upiDetails = {
    upiId: 'xlandinfra@hdfcbank',
    qrCodeUrl: null // Will be generated
  };

  useEffect(() => {
    if (captchaVerified && token) {
      fetchInvoiceDetails();
    } else if (!token) {
      setLoading(false);
      setError('Invalid payment link');
    } else {
      setLoading(false);
    }
  }, [captchaVerified, token]);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      // Token contains invoice ID - backend extracts it
      const response = await fetch(`${API_BASE}/api/razorpay/public/pay?token=${encodeURIComponent(token)}`);
      const result = await response.json();
      
      if (result.success) {
        setInvoice(result.data);
        // Check if already paid
        if (result.data.status === 'paid') {
          setError('already_paid');
        }
      } else {
        setError(result.message || 'Invoice not found or link expired');
      }
    } catch (err) {
      setError('Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaVerified = (verified) => {
    setCaptchaVerified(verified);
    if (verified) {
      setLoading(true);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleProceedToPay = async () => {
    setProcessing(true);
    
    try {
      if (selectedMethod === 'razorpay') {
        // Redirect to Razorpay payment link
        if (invoice.paymentLink) {
          window.location.href = invoice.paymentLink;
        } else {
          // Create payment link if not exists
          const response = await fetch(`${API_BASE}/api/razorpay/create-payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId: invoice.invoiceId })
          });
          const result = await response.json();
          if (result.success && result.data?.paymentLink) {
            window.location.href = result.data.paymentLink;
          }
        }
      } else {
        // Record payment intent for other methods
        await fetch(`${API_BASE}/api/razorpay/public/record-payment-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: invoice.invoiceId,
            token,
            paymentMethod: selectedMethod
          })
        });
        // Show success message
        alert(`Payment method selected: ${selectedMethod}. Our team will verify and update the payment status.`);
      }
    } catch (err) {
      alert('Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0 
    }).format(amount || 0);
  };

  // Show CAPTCHA first (before loading invoice)
  if (!captchaVerified && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <MathCaptcha onVerify={handleCaptchaVerified} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Already paid - show success message
    if (error === 'already_paid') {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Already Paid!</h2>
            <p className="text-gray-600 mb-4">This invoice has already been paid. Thank you!</p>
            {invoice && (
              <div className="bg-gray-50 rounded-lg p-4 text-left">
                <p className="text-sm text-gray-500">Invoice ID</p>
                <p className="font-semibold text-gray-900">{invoice.invoiceId}</p>
                <p className="text-sm text-gray-500 mt-2">Amount Paid</p>
                <p className="font-semibold text-green-600">{formatCurrency(invoice.totalAmount)}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Invalid/Expired link
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Link Invalid</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Please contact XLAND INFRA for a new payment link.</p>
        </div>
      </div>
    );
  }

  const isDueDatePassed = invoice?.dueDate && new Date(invoice.dueDate) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Make Payment</h1>
          <p className="text-sm text-gray-500">Choose a payment method and complete your payment</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Invoice Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Invoice Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Invoice ID</p>
              <p className="font-semibold text-gray-900">{invoice?.invoiceId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Property / Customer</p>
              <p className="font-semibold text-gray-900">{invoice?.propertyName || invoice?.customerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Invoice Date</p>
              <p className="font-medium text-gray-700">{formatDate(invoice?.invoiceDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Due Date</p>
              <p className={`font-medium ${isDueDatePassed ? 'text-red-600' : 'text-gray-700'}`}>
                {formatDate(invoice?.dueDate)}
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
            <div className="text-right">
              <p className="text-xs text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice?.totalAmount)}</p>
              <p className="text-xs text-gray-500 mt-1">Due Amount</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(invoice?.balanceAmount || invoice?.totalAmount)}</p>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">Choose Payment Method</h2>
          <p className="text-sm text-gray-500 mb-4">Select any one payment method to proceed</p>

          <div className="space-y-3">
            {/* Razorpay - Cards/UPI/Net Banking */}
            <label 
              className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedMethod === 'razorpay' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="razorpay"
                checked={selectedMethod === 'razorpay'}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="mt-1 w-5 h-5 text-blue-600"
              />
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <CreditCard className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Debit / Card Payments & Net Banking</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Powered by Razorpay</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Pay securely using your debit card, credit card or net banking.</p>
                <div className="flex items-center gap-2 mt-2">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-4" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5" />
                  <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">RuPay</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">Net Banking</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Processing Fee</p>
                <p className="text-sm font-medium text-gray-700">2% + GST</p>
                <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                  <Shield className="w-3 h-3" /> Razorpay Trusted
                </p>
              </div>
            </label>

            {/* UPI */}
            <label 
              className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedMethod === 'upi' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="upi"
                checked={selectedMethod === 'upi'}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="mt-1 w-5 h-5 text-green-600"
              />
              <UPIIcon />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">UPI (QR / UPI ID)</span>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Your Collection</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Scan QR code or pay using any UPI app.</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">GPay</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">PhonePe</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Paytm</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">BHIM</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600 font-medium">No Additional Charges</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-500" /> Direct Collection
                </p>
                <p className="text-xs text-green-600">No Fees</p>
              </div>
            </label>

            {/* Bank Transfer */}
            <label 
              className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedMethod === 'bank' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="bank"
                checked={selectedMethod === 'bank'}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="mt-1 w-5 h-5 text-blue-600"
              />
              <BankIcon />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Bank Transfer</span>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Your Collection</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Transfer directly from your bank account.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600 font-medium">No Additional Charges</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-500" /> Direct Collection
                </p>
                <p className="text-xs text-green-600">No Fees</p>
              </div>
            </label>

            {/* Cash */}
            <label 
              className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedMethod === 'cash' 
                  ? 'border-amber-500 bg-amber-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={selectedMethod === 'cash'}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="mt-1 w-5 h-5 text-amber-600"
              />
              <CashIcon />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Cash</span>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Your Collection</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Pay with cash at our office / collection point.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600 font-medium">No Additional Charges</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-500" /> Direct Collection
                </p>
                <p className="text-xs text-green-600">No Fees</p>
              </div>
            </label>

            {/* Cheque */}
            <label 
              className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedMethod === 'cheque' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="cheque"
                checked={selectedMethod === 'cheque'}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="mt-1 w-5 h-5 text-purple-600"
              />
              <CheckIcon />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Cheque</span>
                  <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Your Collection</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Pay using cheque.</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600 font-medium">No Additional Charges</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-500" /> Direct Collection
                </p>
                <p className="text-xs text-green-600">No Fees</p>
              </div>
            </label>
          </div>
        </div>

        {/* Payment Details Section (shown when UPI or Bank Transfer selected) */}
        {selectedMethod === 'upi' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">UPI Payment Details</h3>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">UPI ID</p>
                <p className="font-mono font-semibold text-gray-900">{upiDetails.upiId}</p>
              </div>
              <button
                onClick={() => copyToClipboard(upiDetails.upiId, 'upi')}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
              >
                {copied === 'upi' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === 'upi' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              After payment, please share the payment screenshot or transaction ID with our team for faster verification.
            </p>
          </div>
        )}

        {selectedMethod === 'bank' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Bank Account Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Account Name', value: bankDetails.accountName, key: 'name' },
                { label: 'Account Number', value: bankDetails.accountNumber, key: 'account' },
                { label: 'IFSC Code', value: bankDetails.ifscCode, key: 'ifsc' },
                { label: 'Bank Name', value: bankDetails.bankName, key: 'bank' },
                { label: 'Branch', value: bankDetails.branch, key: 'branch' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="font-mono font-semibold text-gray-900">{item.value}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.value, item.key)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    {copied === item.key ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied === item.key ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Please mention Invoice ID <strong>{invoice?.invoiceId}</strong> in the transfer remarks.
            </p>
          </div>
        )}

        {/* Notice */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            After payment, your invoice will be marked as Paid and a receipt will be sent to you.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleProceedToPay}
            disabled={processing}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
            <span>Proceed to Pay</span>
            <span className="text-xs opacity-75">Secure Payment</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
        <p>Secured by XLAND INFRA Payment Gateway</p>
      </footer>
    </div>
  );
};

export default PublicPayment;
