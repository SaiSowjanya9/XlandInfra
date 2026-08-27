import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  FileText, 
  Briefcase,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  X,
  RefreshCw,
  Building2,
  User,
  Receipt,
  Loader2,
  Smartphone,
  Landmark,
  Wallet,
  Shield,
  ArrowRight,
  Check,
  Banknote,
  FileCheck,
  Copy,
  Info
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Status configuration
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  partially_paid: { label: 'Partial', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertCircle },
  overdue: { label: 'Overdue', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-500 border-gray-500/30', icon: X }
};

// All Payment methods - unified list (no online/offline separation in UI)
const ALL_PAYMENT_METHODS = [
  { 
    id: 'card', 
    label: 'Debit / Card Payments & Net Banking', 
    description: 'Pay securely using your debit card, credit card or net banking.', 
    icon: CreditCard, 
    type: 'online',
    badges: ['VISA', 'MC', 'RuPay', 'maestro', 'Net Banking']
  },
  { 
    id: 'upi', 
    label: 'UPI (QR / UPI ID)', 
    description: 'Scan QR code or pay using any UPI app.', 
    icon: Smartphone, 
    type: 'online',
    badges: ['GPay', 'PhonePe', 'Paytm', 'BHIM']
  },
  { 
    id: 'bank_transfer', 
    label: 'Bank Transfer', 
    description: 'Transfer directly from your bank account.', 
    icon: Landmark, 
    type: 'offline'
  },
  { 
    id: 'cash', 
    label: 'Cash', 
    description: 'Pay with cash at our office / collection point.', 
    icon: Banknote, 
    type: 'offline'
  },
  { 
    id: 'cheque', 
    label: 'Cheque', 
    description: 'Pay using cheque.', 
    icon: FileCheck, 
    type: 'offline'
  }
];

// Bank details for bank transfer
const BANK_DETAILS = {
  accountName: 'XLAND INFRA PVT LTD',
  accountNumber: '50200085463214',
  bankName: 'HDFC Bank',
  branch: 'Mangalagiri Branch',
  ifscCode: 'HDFC0002847',
  upiId: 'xlandinfra@hdfcbank'
};

// Office address for cash/cheque
const OFFICE_ADDRESS = {
  line1: 'D.No. 7-333/A/1, NRI Hospital Road',
  line2: 'Mangalagiri, Guntur District',
  city: 'Andhra Pradesh - 522503',
  phone: '+91 8500-101-111',
  timings: 'Mon - Sat: 9:00 AM - 6:00 PM'
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Copy to clipboard helper
const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
};

// Payment Flow Component - 3 Steps
const PaymentFlow = ({ invoice, onClose, onPaymentSuccess }) => {
  const [step, setStep] = useState(1); // 1: Select Method, 2: Review/Instructions, 3: Processing/Success
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // null, 'processing', 'success', 'failed', 'submitted'
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Check if selected method is online (Razorpay) or offline (manual)
  const selectedMethodData = ALL_PAYMENT_METHODS.find(m => m.id === selectedMethod);
  const isOnlineMethod = selectedMethodData?.type === 'online';

  // Handle copy with feedback
  const handleCopy = (text, field) => {
    copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Handle online payment (Razorpay)
  const handleOnlinePayment = async () => {
    setLoading(true);
    setStep(3);
    setPaymentStatus('processing');

    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        throw new Error('Please login to make a payment');
      }

      // Create Razorpay Order
      const orderResponse = await fetch(`${API_BASE}/api/customers/invoices/${invoice.id}/create-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const orderResult = await orderResponse.json();

      if (!orderResult.success) {
        throw new Error(orderResult.message || 'Failed to create order');
      }

      const { orderId, amountInPaise, razorpayKeyId, customerName, customerEmail, customerPhone, invoiceId } = orderResult.data;

      // Initialize Razorpay Checkout
      const options = {
        key: razorpayKeyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'XLAND INFRA',
        description: `Payment for Invoice ${invoiceId}`,
        order_id: orderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone
        },
        notes: {
          invoice_id: invoiceId
        },
        theme: {
          color: '#D4AF37'
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus('failed');
            setLoading(false);
          }
        },
        handler: async (response) => {
          // Verify payment on backend
          try {
            const verifyResponse = await fetch(`${API_BASE}/api/customers/invoices/${invoice.id}/verify-payment`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyResult = await verifyResponse.json();

            if (verifyResult.success) {
              setPaymentStatus('success');
              setPaymentDetails({
                paymentId: response.razorpay_payment_id,
                amount: invoice.balanceAmount,
                invoiceId: invoiceId
              });
              if (onPaymentSuccess) {
                onPaymentSuccess();
              }
            } else {
              setPaymentStatus('failed');
            }
          } catch (err) {
            console.error('Payment verification error:', err);
            setPaymentStatus('failed');
          }
          setLoading(false);
        }
      };

      // Open Razorpay Checkout based on selected method
      if (selectedMethod === 'upi') {
        options.method = { upi: true, card: false, netbanking: false, wallet: false };
      } else if (selectedMethod === 'card') {
        options.method = { upi: false, card: true, netbanking: false, wallet: false };
      } else if (selectedMethod === 'netbanking') {
        options.method = { upi: false, card: false, netbanking: true, wallet: false };
      } else if (selectedMethod === 'wallet') {
        options.method = { upi: false, card: false, netbanking: false, wallet: true };
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        console.error('Payment failed:', response.error);
        setPaymentStatus('failed');
        setLoading(false);
      });
      rzp.open();

    } catch (err) {
      console.error('Error initiating payment:', err);
      setPaymentStatus('failed');
      setLoading(false);
    }
  };

  // Handle offline payment submission (record intent)
  const handleOfflinePayment = async () => {
    setLoading(true);
    setStep(3);
    setPaymentStatus('processing');

    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        throw new Error('Please login to submit payment');
      }

      // Record offline payment intent
      const response = await fetch(`${API_BASE}/api/customers/invoices/${invoice.id}/offline-payment-intent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod: selectedMethod,
          amount: invoice.balanceAmount
        })
      });

      const result = await response.json();

      if (result.success) {
        setPaymentStatus('submitted');
        setPaymentDetails({
          referenceId: result.data?.referenceId || `REF-${Date.now()}`,
          amount: invoice.balanceAmount,
          invoiceId: invoice.invoiceId,
          method: selectedMethodData?.label
        });
      } else {
        // Even if API fails, show submitted for offline - admin will verify
        setPaymentStatus('submitted');
        setPaymentDetails({
          referenceId: `REF-${Date.now()}`,
          amount: invoice.balanceAmount,
          invoiceId: invoice.invoiceId,
          method: selectedMethodData?.label
        });
      }
    } catch (err) {
      // For offline payments, still show as submitted
      setPaymentStatus('submitted');
      setPaymentDetails({
        referenceId: `REF-${Date.now()}`,
        amount: invoice.balanceAmount,
        invoiceId: invoice.invoiceId,
        method: selectedMethodData?.label
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle payment based on method type
  const handlePayment = () => {
    if (isOnlineMethod) {
      handleOnlinePayment();
    } else {
      handleOfflinePayment();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl shadow-2xl border border-gold-600/20 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with Step Indicator */}
        <div className="bg-gradient-to-r from-gold-600/20 to-gold-500/10 px-6 py-4 border-b border-gold-600/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Make Payment</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= s 
                    ? 'bg-gold-500 text-dark-900' 
                    : 'bg-dark-600 text-dark-400'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-12 h-0.5 mx-1 ${step > s ? 'bg-gold-500' : 'bg-dark-600'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-2 text-xs text-dark-400">
            <span className={step === 1 ? 'text-gold-400' : ''}>Select Method</span>
            <span className={step === 2 ? 'text-gold-400' : ''}>Review</span>
            <span className={step === 3 ? 'text-gold-400' : ''}>Confirm</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Select Payment Method */}
          {step === 1 && (
            <div className="p-6">
              {/* Header */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">Choose Payment Method</h3>
                <p className="text-dark-400 text-sm">Select any one payment method to proceed</p>
              </div>

              {/* Payment Methods List */}
              <div className="space-y-3">
                {ALL_PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = selectedMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? 'bg-gold-500/10 border-gold-500/50' 
                          : 'bg-dark-700/30 border-dark-600 hover:border-dark-500'
                      }`}
                    >
                      {/* Radio Button */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-gold-500 bg-gold-500' : 'border-dark-400'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-dark-900" />}
                      </div>

                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-gold-500/20' : 'bg-dark-600/50'
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-gold-400' : 'text-dark-300'}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 text-left">
                        <p className={`font-semibold ${isSelected ? 'text-white' : 'text-dark-200'}`}>
                          {method.label}
                        </p>
                        <p className="text-xs text-dark-400 mt-0.5">{method.description}</p>
                        
                        {/* Payment Brand Icons */}
                        {method.badges && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {method.badges.map((badge, idx) => (
                              <div key={idx} className="flex items-center justify-center">
                                {/* VISA */}
                                {badge === 'VISA' && (
                                  <div className="bg-[#1A1F71] text-white px-2.5 py-1 rounded text-[11px] font-bold italic">
                                    VISA
                                  </div>
                                )}
                                {/* Mastercard */}
                                {badge === 'MC' && (
                                  <div className="flex items-center -space-x-2">
                                    <div className="w-5 h-5 rounded-full bg-[#EB001B]"></div>
                                    <div className="w-5 h-5 rounded-full bg-[#F79E1B]"></div>
                                  </div>
                                )}
                                {/* RuPay */}
                                {badge === 'RuPay' && (
                                  <div className="bg-[#097969] text-white px-2 py-1 rounded text-[10px] font-semibold">
                                    RuPay
                                  </div>
                                )}
                                {/* Maestro */}
                                {badge === 'maestro' && (
                                  <div className="bg-[#0066A1] text-white px-2 py-1 rounded text-[10px] font-medium">
                                    maestro
                                  </div>
                                )}
                                {/* Net Banking */}
                                {badge === 'Net Banking' && (
                                  <div className="flex items-center gap-1.5 bg-white border border-gray-300 px-2.5 py-1 rounded text-[11px] text-gray-700">
                                    <Landmark className="w-3.5 h-3.5" />
                                    <span>Net Banking</span>
                                  </div>
                                )}
                                {/* Google Pay */}
                                {badge === 'GPay' && (
                                  <div className="flex items-center bg-white border border-gray-200 rounded px-2 py-1 shadow-sm">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 mr-1">
                                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    <span className="text-[11px] text-gray-600 font-medium">Pay</span>
                                  </div>
                                )}
                                {/* PhonePe */}
                                {badge === 'PhonePe' && (
                                  <div className="w-7 h-7 rounded-full bg-[#5F259F] flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">₹</span>
                                  </div>
                                )}
                                {/* Paytm */}
                                {badge === 'Paytm' && (
                                  <div className="border border-[#00B9F5] rounded-full px-2.5 py-0.5">
                                    <span className="text-[#00B9F5] text-[11px] font-medium">paytm</span>
                                  </div>
                                )}
                                {/* BHIM */}
                                {badge === 'BHIM' && (
                                  <div className="bg-[#EF6C00] text-white px-2.5 py-1 rounded text-[10px] font-bold">
                                    BHIM
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl border border-dark-500 text-dark-300 hover:text-white hover:border-dark-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark-900 font-semibold transition-all"
                >
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review Payment / Show Instructions */}
          {step === 2 && (
            <div className="p-6">
              {/* Invoice Summary */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-dark-400 text-sm">Invoice</span>
                  <span className="text-white font-semibold">{invoice.invoiceId}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-dark-400 text-sm">Property</span>
                  <span className="text-white text-sm">{invoice.propertyName || invoice.propertyCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-400 text-sm">Amount to Pay</span>
                  <span className="text-gold-400 font-bold text-lg">{formatCurrency(invoice.balanceAmount)}</span>
                </div>
              </div>

              {/* Selected Payment Method */}
              <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600 mb-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const method = ALL_PAYMENT_METHODS.find(m => m.id === selectedMethod);
                    const Icon = method?.icon || CreditCard;
                    return (
                      <>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${method?.color || 'from-dark-600 to-dark-700'}`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{method?.label}</p>
                          <p className="text-dark-400 text-sm">{method?.description}</p>
                        </div>
                        <button
                          onClick={() => setStep(1)}
                          className="text-gold-400 text-sm hover:text-gold-300"
                        >
                          Change
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Bank Transfer Instructions */}
              {selectedMethod === 'bank_transfer' && (
                <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-cyan-400" />
                    <p className="text-cyan-400 font-semibold text-sm">Bank Transfer Details</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Account Name</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white">{BANK_DETAILS.accountName}</span>
                        <button onClick={() => handleCopy(BANK_DETAILS.accountName, 'name')} className="text-cyan-400 hover:text-cyan-300">
                          {copiedField === 'name' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono">{BANK_DETAILS.accountNumber}</span>
                        <button onClick={() => handleCopy(BANK_DETAILS.accountNumber, 'account')} className="text-cyan-400 hover:text-cyan-300">
                          {copiedField === 'account' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">IFSC Code</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono">{BANK_DETAILS.ifscCode}</span>
                        <button onClick={() => handleCopy(BANK_DETAILS.ifscCode, 'ifsc')} className="text-cyan-400 hover:text-cyan-300">
                          {copiedField === 'ifsc' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Bank & Branch</span>
                      <span className="text-white text-right">{BANK_DETAILS.bankName}, {BANK_DETAILS.branch}</span>
                    </div>
                  </div>
                  <p className="text-xs text-dark-400 mt-3">
                    Please use Invoice ID <span className="text-white font-mono">{invoice.invoiceId}</span> as payment reference
                  </p>
                </div>
              )}

              {/* Cash/Cheque Instructions */}
              {(selectedMethod === 'cash' || selectedMethod === 'cheque') && (
                <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-orange-400" />
                    <p className="text-orange-400 font-semibold text-sm">
                      {selectedMethod === 'cash' ? 'Cash Payment' : 'Cheque Payment'} Instructions
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-dark-400 block text-xs mb-1">Visit our office at:</span>
                      <p className="text-white">{OFFICE_ADDRESS.line1}</p>
                      <p className="text-white">{OFFICE_ADDRESS.line2}</p>
                      <p className="text-white">{OFFICE_ADDRESS.city}</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-orange-500/20">
                      <span className="text-dark-400">Contact</span>
                      <span className="text-white">{OFFICE_ADDRESS.phone}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Office Hours</span>
                      <span className="text-white">{OFFICE_ADDRESS.timings}</span>
                    </div>
                  </div>
                  {selectedMethod === 'cheque' && (
                    <p className="text-xs text-dark-400 mt-3">
                      Make cheque payable to: <span className="text-white font-semibold">{BANK_DETAILS.accountName}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Security Badge for Online */}
              {isOnlineMethod && (
                <div className="flex items-center justify-center gap-2 text-dark-400 text-xs mb-4">
                  <Shield className="w-4 h-4" />
                  <span>Secured by Razorpay | 256-bit SSL Encryption</span>
                </div>
              )}

              {/* Offline Payment Note */}
              {!isOnlineMethod && (
                <div className="flex items-center gap-2 text-dark-400 text-xs mb-4 justify-center">
                  <Info className="w-4 h-4" />
                  <span>Payment will be verified by our team within 24-48 hours</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dark-500 text-dark-300 hover:text-white hover:border-dark-400 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark-900 font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : isOnlineMethod ? (
                    <>
                      Pay {formatCurrency(invoice.balanceAmount)}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      Confirm Payment
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment Processing/Confirmation */}
          {step === 3 && (
            <div className="p-6">
              {paymentStatus === 'processing' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-gold-600/20 border border-gold-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-gold-400 animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Processing Payment</h3>
                  <p className="text-dark-300">
                    {isOnlineMethod ? 'Please complete the payment in the popup window...' : 'Submitting your payment details...'}
                  </p>
                </div>
              )}

              {paymentStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Successful!</h3>
                  <p className="text-dark-300 mb-6">Your payment has been processed successfully.</p>
                  
                  {paymentDetails && (
                    <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600 text-left mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="text-dark-400 text-sm">Amount Paid</span>
                        <span className="text-green-400 font-semibold">{formatCurrency(paymentDetails.amount)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-dark-400 text-sm">Invoice</span>
                        <span className="text-white text-sm">{paymentDetails.invoiceId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400 text-sm">Transaction ID</span>
                        <span className="text-white text-sm font-mono">{paymentDetails.paymentId}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark-900 font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Offline Payment Submitted */}
              {paymentStatus === 'submitted' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Details Submitted!</h3>
                  <p className="text-dark-300 mb-6">
                    {selectedMethod === 'bank_transfer' 
                      ? 'Please complete the bank transfer using the details provided. Your payment will be verified within 24-48 hours.'
                      : 'Please visit our office to complete the payment. Your invoice details have been recorded.'}
                  </p>
                  
                  {paymentDetails && (
                    <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600 text-left mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="text-dark-400 text-sm">Amount</span>
                        <span className="text-white font-semibold">{formatCurrency(paymentDetails.amount)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-dark-400 text-sm">Invoice</span>
                        <span className="text-white text-sm">{paymentDetails.invoiceId}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-dark-400 text-sm">Payment Method</span>
                        <span className="text-white text-sm">{paymentDetails.method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dark-400 text-sm">Reference ID</span>
                        <span className="text-white text-sm font-mono">{paymentDetails.referenceId}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark-900 font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-red-600/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <X className="w-10 h-10 text-red-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Failed</h3>
                  <p className="text-dark-300 mb-6">Something went wrong. Please try again.</p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-3 rounded-xl border border-dark-500 text-dark-300 hover:text-white hover:border-dark-400 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setStep(1);
                        setPaymentStatus(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark-900 font-semibold transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Invoice Detail Modal Component
const InvoiceDetailModal = ({ invoice, onClose, onPay }) => {
  if (!invoice) return null;

  const isPaid = invoice.status === 'paid' || invoice.balanceAmount <= 0;
  const isOverdue = invoice.status === 'overdue' || (invoice.dueDate && new Date(invoice.dueDate) < new Date() && !isPaid);
  
  // Separate services and addons
  const services = (invoice.lineItems || []).filter(item => item.type !== 'addon');
  const addons = (invoice.lineItems || []).filter(item => item.type === 'addon');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl shadow-2xl border border-gold-600/20 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gold-600/20 to-gold-500/10 px-6 py-4 border-b border-gold-600/20 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Invoice Details</h2>
            <p className="text-gold-400 text-sm">{invoice.invoiceId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status & Dates Row */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_CONFIG[invoice.status]?.color || STATUS_CONFIG.draft.color}`}>
              {(() => {
                const Icon = STATUS_CONFIG[invoice.status]?.icon || FileText;
                return <Icon className="w-4 h-4" />;
              })()}
              {STATUS_CONFIG[invoice.status]?.label || invoice.status}
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-dark-400">Invoice Date:</span>
                <span className="ml-2 text-white font-medium">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div>
                <span className={isOverdue && !isPaid ? 'text-red-400' : 'text-dark-400'}>Due Date:</span>
                <span className={`ml-2 font-medium ${isOverdue && !isPaid ? 'text-red-400' : 'text-white'}`}>
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Property Info - Combined */}
          <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-600">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {invoice.customerName && (
                <div className="flex gap-2">
                  <span className="text-dark-400">Customer:</span>
                  <span className="text-white">{invoice.customerName}</span>
                </div>
              )}
              {invoice.propertyCode && (
                <div className="flex gap-2">
                  <span className="text-dark-400">Property ID:</span>
                  <span className="text-white">{invoice.propertyCode}</span>
                </div>
              )}
              {invoice.customerEmail && (
                <div className="flex gap-2">
                  <span className="text-dark-400">Email:</span>
                  <span className="text-white truncate">{invoice.customerEmail}</span>
                </div>
              )}
              {invoice.propertyName && (
                <div className="flex gap-2">
                  <span className="text-dark-400">Property:</span>
                  <span className="text-white">{invoice.propertyName}</span>
                </div>
              )}
              {invoice.customerPhone && (
                <div className="flex gap-2">
                  <span className="text-dark-400">Phone:</span>
                  <span className="text-white">{invoice.customerPhone}</span>
                </div>
              )}
              {invoice.propertyType && (
                <div className="flex gap-2">
                  <span className="text-dark-400">Type:</span>
                  <span className="text-white">{invoice.propertyType}</span>
                </div>
              )}
            </div>
          </div>

          {/* Work Order Details (for work order invoices) */}
          {invoice.invoiceType === 'work_order' && invoice.workOrderId && (
            <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
              <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Work Order Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-dark-400 block text-xs">Work Order ID</span>
                  <span className="text-white font-medium">{invoice.workOrderId}</span>
                </div>
                <div>
                  <span className="text-dark-400 block text-xs">Category</span>
                  <span className="text-white">{invoice.workOrderCategory || '-'}</span>
                </div>
                <div>
                  <span className="text-dark-400 block text-xs">Subcategory</span>
                  <span className="text-white">{invoice.workOrderSubcategory || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Services Table */}
          {services.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gold-400 mb-3">Services Included</h3>
              <div className="bg-dark-700/30 rounded-xl border border-dark-600 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-dark-700/50 border-b border-dark-600">
                      <th className="px-4 py-3 text-left text-dark-300 font-medium">#</th>
                      <th className="px-4 py-3 text-left text-dark-300 font-medium">Service</th>
                      <th className="px-4 py-3 text-center text-dark-300 font-medium">Frequency</th>
                      <th className="px-4 py-3 text-right text-dark-300 font-medium">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((item, idx) => (
                      <tr key={idx} className="border-b border-dark-600/50 last:border-0">
                        <td className="px-4 py-3 text-dark-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{item.name || item.description || 'Service'}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-dark-300">
                          {item.frequency || item.frequencyType || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          {item.visits || item.frequencyCount || item.quantity || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Price Summary */}
          <div className="bg-gradient-to-br from-gold-600/10 to-gold-500/5 rounded-xl p-5 border border-gold-600/20">
            <h3 className="text-sm font-semibold text-gold-400 mb-4">Price Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-dark-300">Subtotal</span>
                <span className="text-white">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Discount ({invoice.discountPercentage || 0}%)</span>
                  <span className="text-green-400">-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-dark-300">GST ({invoice.taxPercentage || 18}%)</span>
                <span className="text-white">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              <div className="border-t border-gold-600/20 pt-3">
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Total Amount</span>
                  <span className="text-gold-400 text-lg font-bold">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
              {invoice.amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">Amount Paid</span>
                    <span className="text-green-400">{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gold-600/20 pt-3">
                    <span className="text-white font-semibold">Balance Due</span>
                    <span className="text-red-400 text-lg font-bold">{formatCurrency(invoice.balanceAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-dark-600 bg-dark-800/80 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-dark-500 text-dark-300 hover:text-white hover:border-dark-400 transition-colors"
          >
            Close
          </button>
          
          {!isPaid && invoice.balanceAmount > 0 && (
            <button
              onClick={() => onPay(invoice)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-400 text-dark-900 font-semibold transition-all"
            >
              <CreditCard className="w-5 h-5" />
              Pay Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Payment Component
const Payment = () => {
  const [activeTab, setActiveTab] = useState('amc');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);

  // Fetch invoices
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        setError('Please login to view invoices');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/customers/invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setInvoices(result.data || []);
      } else {
        setError(result.message || 'Failed to fetch invoices');
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Fetch single invoice details
  const fetchInvoiceDetails = async (invoiceId) => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        setError('Please login to view invoice details');
        return;
      }

      const response = await fetch(`${API_BASE}/api/customers/invoices/${invoiceId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setSelectedInvoice(result.data);
      } else {
        console.error('Invoice fetch failed:', result.message);
        setError(result.message || 'Failed to load invoice details');
      }
    } catch (err) {
      console.error('Error fetching invoice details:', err);
      setError('Failed to load invoice details. Please try again.');
    }
  };

  // Handle Pay button click - opens payment flow
  const handlePay = (invoice) => {
    setPayingInvoice(invoice);
    setShowPaymentFlow(true);
    setSelectedInvoice(null); // Close detail modal
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    fetchInvoices(); // Refresh invoices
  };

  // Filter invoices by type
  const amcInvoices = invoices.filter(inv => inv.invoiceType === 'estimate' || inv.invoiceType === 'manual' || !inv.invoiceType);
  const workOrderInvoices = invoices.filter(inv => inv.invoiceType === 'work_order');

  const displayedInvoices = activeTab === 'amc' ? amcInvoices : workOrderInvoices;

  // Stats calculations
  const totalPending = displayedInvoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);
  
  const totalPaid = displayedInvoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Payments & Invoices
        </h1>
        <p className="text-dark-300">
          View and pay your invoices securely
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-dark-800/80 rounded-xl p-5 border border-gold-600/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-dark-400 text-sm">Total Invoices</p>
              <p className="text-2xl font-bold text-white">{displayedInvoices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-800/80 rounded-xl p-5 border border-gold-600/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-dark-400 text-sm">Pending Amount</p>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </div>

        <div className="bg-dark-800/80 rounded-xl p-5 border border-gold-600/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-dark-400 text-sm">Total Paid</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('amc')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'amc'
              ? 'bg-gold-600/20 text-gold-400 border border-gold-500/30'
              : 'bg-dark-800/50 text-dark-300 border border-dark-600 hover:text-white hover:border-dark-500'
          }`}
        >
          <FileText className="w-4 h-4" />
          AMC Invoices
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'amc' ? 'bg-gold-500/20' : 'bg-dark-700'
          }`}>
            {amcInvoices.length}
          </span>
        </button>
        
        <button
          onClick={() => setActiveTab('workorder')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'workorder'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'bg-dark-800/50 text-dark-300 border border-dark-600 hover:text-white hover:border-dark-500'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Work Order Invoices
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'workorder' ? 'bg-blue-500/20' : 'bg-dark-700'
          }`}>
            {workOrderInvoices.length}
          </span>
        </button>

        <button
          onClick={fetchInvoices}
          disabled={loading}
          className="ml-auto p-2.5 rounded-xl bg-dark-800/50 border border-dark-600 text-dark-300 hover:text-white hover:border-dark-500 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Invoice List */}
      <div className="bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-gold-400 animate-spin mx-auto mb-3" />
              <p className="text-dark-300">Loading invoices...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-dark-300">{error}</p>
              <button
                onClick={fetchInvoices}
                className="mt-4 px-4 py-2 rounded-lg bg-gold-600/20 text-gold-400 hover:bg-gold-600/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : displayedInvoices.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="w-12 h-12 text-dark-500 mx-auto mb-3" />
              <p className="text-dark-300">No {activeTab === 'amc' ? 'AMC' : 'Work Order'} invoices found</p>
              <p className="text-dark-500 text-sm mt-1">Invoices will appear here once generated</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-dark-600/50">
            {displayedInvoices.map((invoice) => {
              const isPaid = invoice.status === 'paid' || invoice.balanceAmount <= 0;
              const isOverdue = invoice.status === 'overdue' || (invoice.dueDate && new Date(invoice.dueDate) < new Date() && !isPaid);
              const StatusIcon = STATUS_CONFIG[invoice.status]?.icon || FileText;

              return (
                <div
                  key={invoice.id}
                  className="p-4 sm:p-5 hover:bg-dark-700/30 transition-colors cursor-pointer"
                  onClick={() => fetchInvoiceDetails(invoice.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Invoice Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      activeTab === 'workorder' ? 'bg-blue-500/20' : 'bg-gold-600/20'
                    }`}>
                      {activeTab === 'workorder' ? (
                        <Briefcase className="w-6 h-6 text-blue-400" />
                      ) : (
                        <FileText className="w-6 h-6 text-gold-400" />
                      )}
                    </div>

                    {/* Invoice Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-semibold">{invoice.invoiceId}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[invoice.status]?.color || STATUS_CONFIG.draft.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {STATUS_CONFIG[invoice.status]?.label || invoice.status}
                        </span>
                      </div>
                      <p className="text-dark-400 text-sm truncate">
                        {invoice.propertyName || invoice.propertyCode || 'Property'}
                        {invoice.invoiceType === 'work_order' && invoice.workOrderId && (
                          <span className="ml-2 text-blue-400">• WO: {invoice.workOrderId}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-dark-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(invoice.invoiceDate)}
                        </span>
                        <span className={`flex items-center gap-1 ${isOverdue && !isPaid ? 'text-red-400' : ''}`}>
                          <Clock className="w-3 h-3" />
                          Due: {formatDate(invoice.dueDate)}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Action */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
                      {!isPaid && invoice.balanceAmount > 0 && (
                        <p className="text-sm text-amber-400">Due: {formatCurrency(invoice.balanceAmount)}</p>
                      )}
                      {isPaid && (
                        <p className="text-sm text-green-400 flex items-center justify-end gap-1">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-dark-500" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onPay={handlePay}
        />
      )}

      {/* Payment Flow Modal */}
      {showPaymentFlow && payingInvoice && (
        <PaymentFlow
          invoice={payingInvoice}
          onClose={() => {
            setShowPaymentFlow(false);
            setPayingInvoice(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default Payment;
