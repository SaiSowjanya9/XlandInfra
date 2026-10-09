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
  ChevronDown,
  Filter,
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
  Info,
  Lock,
  HelpCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Status configuration
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gold-500/20 text-gray-500 border-gold-500/30', icon: FileText },
  // 'sent' is staff language — to the customer the invoice arrived, so the badge reads Received
  sent: { label: 'Received', color: 'bg-blue-100 text-blue-600 border-blue-200', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-600 border-green-200', icon: CheckCircle },
  partially_paid: { label: 'Partially Paid', color: 'bg-amber-100 text-amber-600 border-amber-200', icon: AlertCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-600 border-red-200', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gold-500/20 text-gray-500 border-gold-500/30', icon: X }
};

// All Payment methods - unified list (no online/offline separation in UI)
const ALL_PAYMENT_METHODS = [
  { 
    id: 'card', 
    label: 'Debit / Card Payments & Net Banking', 
    description: 'Pay securely using your debit card, credit card or net banking.', 
    icon: CreditCard, 
    type: 'online',
    badges: ['VISA', 'MC', 'RuPay', 'maestro', 'Net Banking'],
    feeText: 'Processing Fee', feeAmount: '2%', tags: ['Secure Payment', 'Razorpay Trusted']
  },
  { 
    id: 'upi', 
    label: 'UPI (QR / UPI ID)', 
    description: 'Scan QR code or pay using any UPI app.', 
    icon: Smartphone, 
    type: 'online',
    badges: ['GPay', 'PhonePe', 'Paytm', 'BHIM'],
    feeText: 'Processing Fee', feeAmount: '2%', tags: ['Instant Payment', 'Razorpay Secured']
  },
  { 
    id: 'bank_transfer', 
    label: 'Bank Transfer', 
    description: 'Transfer directly from your bank account.', 
    icon: Landmark, 
    type: 'offline',
    feeText: 'No Additional Charges', tags: ['Direct Collection', 'No Fees']
  },
  { 
    id: 'cash', 
    label: 'Cash', 
    description: 'Pay with cash at our office / collection point.', 
    icon: Banknote, 
    type: 'offline',
    feeText: 'No Additional Charges', tags: ['Direct Collection', 'No Fees']
  },
  { 
    id: 'cheque', 
    label: 'Cheque', 
    description: 'Pay using cheque.', 
    icon: FileCheck, 
    type: 'offline',
    feeText: 'No Additional Charges', tags: ['Direct Collection', 'No Fees']
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
  // The customer gets exactly one alternative to the full balance: pay half now, the rest before
  // the next service period. Off by default — the full amount is what the invoice is for.
  const [payHalf, setPayHalf] = useState(false);

  const balanceNum = parseFloat(invoice?.balanceAmount ?? invoice?.totalAmount) || 0;
  const halfAmount = Math.round((balanceNum / 2 + Number.EPSILON) * 100) / 100;
  // Both halves must clear the ₹1 floor the gateway enforces
  const canSplit = halfAmount >= 1 && Math.round((balanceNum - halfAmount + Number.EPSILON) * 100) / 100 >= 1;
  const amountToPay = payHalf && canSplit ? halfAmount : balanceNum;
  // The remainder falls due 30 days before the next 6-month service period — the server works
  // the authoritative dates out of the payment date; this preview matches it
  const secondDue = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  })();

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
        },
        // The server derives the charge from the invoice's own balance — only the share travels
        body: JSON.stringify({ portion: payHalf && canSplit ? 'half' : 'full' })
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
                amount: verifyResult.data?.amount ?? orderResult.data?.amount,
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
          // The server derives the figure from the invoice's own balance — only the share travels
          portion: payHalf && canSplit ? 'half' : 'full'
        })
      });

      const result = await response.json();

      if (result.success) {
        setPaymentStatus('submitted');
        setPaymentDetails({
          referenceId: result.data?.referenceId || `REF-${Date.now()}`,
          amount: result.data?.amount ?? amountToPay,
          invoiceId: invoice.invoiceId,
          method: selectedMethodData?.label
        });
      } else {
        // Even if API fails, show submitted for offline - admin will verify
        setPaymentStatus('submitted');
        setPaymentDetails({
          referenceId: `REF-${Date.now()}`,
          amount: amountToPay,
          invoiceId: invoice.invoiceId,
          method: selectedMethodData?.label
        });
      }
    } catch (err) {
      // For offline payments, still show as submitted
      setPaymentStatus('submitted');
      setPaymentDetails({
        referenceId: `REF-${Date.now()}`,
        amount: amountToPay,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gold-600/20 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header with Step Indicator */}
        <div className="bg-gradient-to-r from-gold-600/20 to-gold-500/10 px-6 py-4 border-b border-gold-600/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Make Payment</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
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
                    ? 'bg-gold-600 text-gray-900' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-12 h-0.5 mx-1 ${step > s ? 'bg-gold-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-2 text-xs text-gray-500">
            <span className={step === 1 ? 'text-gold-600' : ''}>Select Method</span>
            <span className={step === 2 ? 'text-gold-600' : ''}>Review</span>
            <span className={step === 3 ? 'text-gold-600' : ''}>Confirm</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Select Payment Method */}
          {step === 1 && (
            <div className="p-6">
              {/* Payment Amount — full balance or half of it */}
              {canSplit && (
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Amount</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPayHalf(false)}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        !payHalf
                          ? 'bg-gold-600/10 border-gold-500/50'
                          : 'bg-gray-100 border-gray-200 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        !payHalf ? 'border-gold-500 bg-gold-600' : 'border-gray-200'
                      }`}>
                        {!payHalf && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-900 text-sm font-semibold">Pay Full Amount</p>
                        <p className="text-gray-500 text-xs mt-0.5">{formatCurrency(balanceNum)}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayHalf(true)}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        payHalf
                          ? 'bg-gold-600/10 border-gold-500/50'
                          : 'bg-gray-100 border-gray-200 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        payHalf ? 'border-gold-500 bg-gold-600' : 'border-gray-200'
                      }`}>
                        {payHalf && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-900 text-sm font-semibold">Pay 50% Now</p>
                        <p className="text-gray-500 text-xs mt-0.5">{formatCurrency(halfAmount)}, rest later</p>
                      </div>
                    </button>
                  </div>

                  {payHalf && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-gold-600/10 border border-gold-500/20 px-4 py-3">
                      <Wallet className="w-5 h-5 text-gold-600 shrink-0" />
                      <p className="text-xs text-gray-500 leading-relaxed">
                        You will be charged <span className="text-gold-600 font-semibold">{formatCurrency(halfAmount)}</span> now.
                        The remaining <span className="text-gray-900 font-medium">{formatCurrency(balanceNum - halfAmount)}</span> is
                        due by <span className="text-gray-900 font-medium">{secondDue}</span> (30 days before the next service period).
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Header */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Choose Payment Method</h3>
                <p className="text-gray-500 text-sm">Select any one payment method to proceed</p>
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
                          ? 'bg-gold-600/10 border-gold-500/50' 
                          : 'bg-gray-100 border-gray-200 hover:border-gray-200'
                      }`}
                    >
                      {/* Radio Button */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-gold-500 bg-gold-600' : 'border-gray-200'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>

                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-gold-600/20' : 'bg-gray-200'
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-gold-600' : 'text-gray-500'}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-900'}`}>
                          {method.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{method.description}</p>
                        
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
                                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2.5 py-1 rounded text-[11px] text-gray-900">
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
                                    <span className="text-[11px] text-gray-500 font-medium">Pay</span>
                                  </div>
                                )}
                                {/* PhonePe */}
                                {badge === 'PhonePe' && (
                                  <div className="w-7 h-7 rounded-full bg-[#5F259F] flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">₹</span>
                                  </div>
                                )}
                                {/* Paytm - Official Logo */}
                                {badge === 'Paytm' && (
                                  <div className="flex items-center bg-white border border-gray-200 rounded px-2 py-1">
                                    <span className="text-[12px] font-bold">
                                      <span className="text-[#002E6E]">Pay</span>
                                      <span className="text-[#00BAF2]">tm</span>
                                    </span>
                                  </div>
                                )}
                                {/* BHIM - Official Logo */}
                                {badge === 'BHIM' && (
                                  <div className="flex items-center bg-white border border-gray-200 rounded px-2 py-1">
                                    <span className="text-gray-500 text-[11px] font-bold tracking-tight">BHIM</span>
                                    <svg viewBox="0 0 20 20" className="w-4 h-4 ml-0.5">
                                      <path d="M10 2L18 10L14 10L14 18L10 14" fill="#FF9933"/>
                                      <path d="M10 6L14 10L10 10L10 14L6 10L10 10L10 6" fill="white"/>
                                      <path d="M10 10L6 10L2 10L10 18L10 14L10 10" fill="#138808"/>
                                    </svg>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* What the method costs: the gateway's processing fee on cards and UPI, nothing on
                          a direct payment -- the same wording as the emailed payment link */}
                      <div className="flex-shrink-0 self-start text-right">
                        {method.feeAmount ? (<>
                          <p className="text-[11px] text-gray-500">{method.feeText}</p>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <span className="text-sm font-semibold text-gray-900">{method.feeAmount}</span>
                            <HelpCircle className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-1">
                            {method.id === 'upi'
                              ? <span className="text-[11px] font-semibold text-green-600">{method.tags[0]}</span>
                              : <><Lock className="h-3 w-3 text-gray-500" /><span className="text-[11px] text-gray-500">{method.tags[0]}</span></>}
                          </div>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <Shield className="h-3 w-3 text-blue-600" />
                            <span className="text-[11px] font-medium text-blue-600">{method.tags[1]}</span>
                          </div>
                        </>) : (<>
                          <p className="text-xs font-semibold text-green-600">{method.feeText}</p>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-[11px] text-gray-500">{method.tags[0]}</span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-[11px] font-medium text-green-600">{method.tags[1]}</span>
                          </div>
                        </>)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-500 text-gray-900 font-semibold transition-all"
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
              <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Invoice</span>
                  <span className="text-gray-900 font-semibold">{invoice.invoiceId}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 text-sm">Property</span>
                  <span className="text-gray-900 text-sm">{invoice.propertyName || invoice.propertyCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Amount to Pay{payHalf && canSplit ? ' (50%)' : ''}</span>
                  <span className="text-gold-600 font-bold text-lg">{formatCurrency(amountToPay)}</span>
                </div>
                {payHalf && canSplit && (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <span className="text-gray-500 text-xs">Remaining due by {secondDue}</span>
                    <span className="text-gray-500 text-sm font-medium">{formatCurrency(balanceNum - halfAmount)}</span>
                  </div>
                )}
              </div>

              {/* Selected Payment Method */}
              <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 mb-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const method = ALL_PAYMENT_METHODS.find(m => m.id === selectedMethod);
                    const Icon = method?.icon || CreditCard;
                    return (
                      <>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${method?.color || 'from-gray-200 to-gray-100'}`}>
                          <Icon className="w-5 h-5 text-gray-900" />
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium">{method?.label}</p>
                          <p className="text-gray-500 text-sm">{method?.description}</p>
                        </div>
                        <button
                          onClick={() => setStep(1)}
                          className="text-gold-600 text-sm hover:text-gold-600"
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
                <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-cyan-600" />
                    <p className="text-cyan-600 font-semibold text-sm">Bank Transfer Details</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Account Name</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">{BANK_DETAILS.accountName}</span>
                        <button onClick={() => handleCopy(BANK_DETAILS.accountName, 'name')} className="text-cyan-600 hover:text-cyan-700">
                          {copiedField === 'name' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-mono">{BANK_DETAILS.accountNumber}</span>
                        <button onClick={() => handleCopy(BANK_DETAILS.accountNumber, 'account')} className="text-cyan-600 hover:text-cyan-700">
                          {copiedField === 'account' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">IFSC Code</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-mono">{BANK_DETAILS.ifscCode}</span>
                        <button onClick={() => handleCopy(BANK_DETAILS.ifscCode, 'ifsc')} className="text-cyan-600 hover:text-cyan-700">
                          {copiedField === 'ifsc' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Bank & Branch</span>
                      <span className="text-gray-900 text-right">{BANK_DETAILS.bankName}, {BANK_DETAILS.branch}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Please use Invoice ID <span className="text-gray-900 font-mono">{invoice.invoiceId}</span> as payment reference
                  </p>
                </div>
              )}

              {/* Cash/Cheque Instructions */}
              {(selectedMethod === 'cash' || selectedMethod === 'cheque') && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 text-orange-600" />
                    <p className="text-orange-600 font-semibold text-sm">
                      {selectedMethod === 'cash' ? 'Cash Payment' : 'Cheque Payment'} Instructions
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 block text-xs mb-1">Visit our office at:</span>
                      <p className="text-gray-900">{OFFICE_ADDRESS.line1}</p>
                      <p className="text-gray-900">{OFFICE_ADDRESS.line2}</p>
                      <p className="text-gray-900">{OFFICE_ADDRESS.city}</p>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-orange-200">
                      <span className="text-gray-500">Contact</span>
                      <span className="text-gray-900">{OFFICE_ADDRESS.phone}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Office Hours</span>
                      <span className="text-gray-900">{OFFICE_ADDRESS.timings}</span>
                    </div>
                  </div>
                  {selectedMethod === 'cheque' && (
                    <p className="text-xs text-gray-500 mt-3">
                      Make cheque payable to: <span className="text-gray-900 font-semibold">{BANK_DETAILS.accountName}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Security Badge for Online */}
              {isOnlineMethod && (
                <div className="flex items-center justify-center gap-2 text-gray-500 text-xs mb-4">
                  <Shield className="w-4 h-4" />
                  <span>Secured by Razorpay | 256-bit SSL Encryption</span>
                </div>
              )}

              {/* Offline Payment Note */}
              {!isOnlineMethod && (
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-4 justify-center">
                  <Info className="w-4 h-4" />
                  <span>Payment will be verified by our team within 24-48 hours</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-200 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-500 text-gray-900 font-semibold transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : isOnlineMethod ? (
                    <>
                      Pay {formatCurrency(amountToPay)}
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
                    <Loader2 className="w-10 h-10 text-gold-600 animate-spin" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Payment</h3>
                  <p className="text-gray-500">
                    {isOnlineMethod ? 'Please complete the payment in the popup window...' : 'Submitting your payment details...'}
                  </p>
                </div>
              )}

              {paymentStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                  <p className="text-gray-500 mb-6">Your payment has been processed successfully.</p>
                  
                  {paymentDetails && (
                    <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 text-left mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-500 text-sm">Amount Paid</span>
                        <span className="text-green-600 font-semibold">{formatCurrency(paymentDetails.amount)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-500 text-sm">Invoice</span>
                        <span className="text-gray-900 text-sm">{paymentDetails.invoiceId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Transaction ID</span>
                        <span className="text-gray-900 text-sm font-mono">{paymentDetails.paymentId}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-500 text-gray-900 font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {/* Offline Payment Submitted */}
              {paymentStatus === 'submitted' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-blue-100 border border-blue-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Details Submitted!</h3>
                  <p className="text-gray-500 mb-6">
                    {selectedMethod === 'bank_transfer' 
                      ? 'Please complete the bank transfer using the details provided. Your payment will be verified within 24-48 hours.'
                      : 'Please visit our office to complete the payment. Your invoice details have been recorded.'}
                  </p>
                  
                  {paymentDetails && (
                    <div className="bg-gray-100 rounded-xl p-4 border border-gray-200 text-left mb-6">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-500 text-sm">Amount</span>
                        <span className="text-gray-900 font-semibold">{formatCurrency(paymentDetails.amount)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-500 text-sm">Invoice</span>
                        <span className="text-gray-900 text-sm">{paymentDetails.invoiceId}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-500 text-sm">Payment Method</span>
                        <span className="text-gray-900 text-sm">{paymentDetails.method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-sm">Reference ID</span>
                        <span className="text-gray-900 text-sm font-mono">{paymentDetails.referenceId}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-500 text-gray-900 font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-red-100 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <X className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Failed</h3>
                  <p className="text-gray-500 mb-6">Something went wrong. Please try again.</p>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setStep(1);
                        setPaymentStatus(null);
                      }}
                      className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-500 text-gray-900 font-semibold transition-all"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gold-600/20 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gold-600/20 to-gold-500/10 px-6 py-4 border-b border-gold-600/20 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
            <p className="text-gold-600 text-sm">{invoice.invoiceId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
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
              {invoice.status === 'partially_paid' && (() => {
                const pct = Math.round(((parseFloat(invoice.amountPaid) || 0) / (parseFloat(invoice.totalAmount) || 1)) * 100);
                return pct > 0 ? ` (${pct}%)` : '';
              })()}
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500">Invoice Date:</span>
                <span className="ml-2 text-gray-900 font-medium">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div>
                <span className={isOverdue && !isPaid ? 'text-red-600' : 'text-gray-500'}>Due Date:</span>
                <span className={`ml-2 font-medium ${isOverdue && !isPaid ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Property Info - Combined */}
          <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {invoice.customerName && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Customer:</span>
                  <span className="text-gray-900">{invoice.customerName}</span>
                </div>
              )}
              {invoice.propertyCode && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Property ID:</span>
                  <span className="text-gray-900">{invoice.propertyCode}</span>
                </div>
              )}
              {invoice.customerEmail && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-900 truncate">{invoice.customerEmail}</span>
                </div>
              )}
              {invoice.propertyName && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Property:</span>
                  <span className="text-gray-900">{invoice.propertyName}</span>
                </div>
              )}
              {invoice.customerPhone && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900">{invoice.customerPhone}</span>
                </div>
              )}
              {invoice.propertyType && (
                <div className="flex gap-2">
                  <span className="text-gray-500">Type:</span>
                  <span className="text-gray-900">{invoice.propertyType}</span>
                </div>
              )}
            </div>
          </div>

          {/* Work Order Details (for work order invoices) */}
          {invoice.invoiceType === 'work_order' && invoice.workOrderId && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Work Order Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Work Order ID</span>
                  <span className="text-gray-900 font-medium">{invoice.workOrderId}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Category</span>
                  <span className="text-gray-900">{invoice.workOrderCategory || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Subcategory</span>
                  <span className="text-gray-900">{invoice.workOrderSubcategory || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Services Table */}
          {services.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gold-600 mb-3">Services Included</h3>
              <div className="bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-gray-500 font-medium">#</th>
                      <th className="px-4 py-3 text-left text-gray-500 font-medium">Service</th>
                      <th className="px-4 py-3 text-center text-gray-500 font-medium">Frequency</th>
                      <th className="px-4 py-3 text-right text-gray-500 font-medium">Visits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200 last:border-0">
                        <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-gray-900 font-medium">{item.name || item.description || 'Service'}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">
                          {item.frequency || item.frequencyType || '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
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
            <h3 className="text-sm font-semibold text-gold-600 mb-4">Price Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Discount ({invoice.discountPercentage || 0}%)</span>
                  <span className="text-green-600">-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">GST ({parseFloat(invoice.taxPercentage) || 0}%)</span>
                <span className="text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              <div className="border-t border-gold-600/20 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-900 font-semibold">Total Amount</span>
                  <span className="text-gold-600 text-lg font-bold">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
              {invoice.amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Amount Paid</span>
                    <span className="text-green-600">{formatCurrency(invoice.amountPaid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gold-600/20 pt-3">
                    <span className="text-gray-900 font-semibold">Balance Due</span>
                    <span className="text-red-600 text-lg font-bold">{formatCurrency(invoice.balanceAmount)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-200 transition-colors"
          >
            Close
          </button>
          
          {!isPaid && invoice.balanceAmount > 0 && (
            <button
              onClick={() => onPay(invoice)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-gold-600 to-gold-500 hover:from-gold-500 hover:to-gold-500 text-gray-900 font-semibold transition-all"
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
  // 'all' by default: the page opens on everything the customer owes
  const [invoiceFilter, setInvoiceFilter] = useState('all');
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
  // One list of everything owed, narrowed by choice rather than split in two by default: a tab
  // per kind hid half the invoices behind a click, and the totals above counted only the half on
  // screen — a customer with an unpaid work order read "Pending ₹0" while standing on AMC.
  const INVOICE_FILTERS = [
    { value: 'all', label: 'All Invoices', count: invoices.length },
    { value: 'amc', label: 'AMC Invoices', count: amcInvoices.length },
    { value: 'workorder', label: 'Work Order Invoices', count: workOrderInvoices.length }
  ];

  const displayedInvoices = invoiceFilter === 'amc' ? amcInvoices
    : invoiceFilter === 'workorder' ? workOrderInvoices
    : invoices;

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Payments & Invoices
        </h1>
        <p className="text-gray-500">
          View and pay your invoices securely
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gold-600/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{displayedInvoices.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gold-600/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Pending Amount</p>
              <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gold-600/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* One list, narrowed by a filter rather than split across tabs */}
      <div className="flex items-center gap-3 mb-6">
        <label htmlFor="invoice-filter" className="sr-only">Show invoices</label>
        <div className="relative">
          <Filter className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            id="invoice-filter"
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value)}
            className="appearance-none pl-9 pr-9 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 font-medium hover:border-gray-200 focus:outline-none focus:border-gold-500/50 transition-colors"
          >
            {INVOICE_FILTERS.map(option => (
              <option key={option.value} value={option.value} className="bg-white">
                {option.label} ({option.count})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          onClick={fetchInvoices}
          disabled={loading}
          className="ml-auto p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-200 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-2xl shadow-lg border border-gold-600/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-gold-600 animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading invoices...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <p className="text-gray-500">{error}</p>
              <button
                onClick={fetchInvoices}
                className="mt-4 px-4 py-2 rounded-lg bg-gold-600/20 text-gold-600 hover:bg-gold-600/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : displayedInvoices.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500">
                No {invoiceFilter === 'amc' ? 'AMC ' : invoiceFilter === 'workorder' ? 'work order ' : ''}invoices found
              </p>
              <p className="text-gray-500 text-sm mt-1">Invoices will appear here once generated</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {displayedInvoices.map((invoice) => {
              const isPaid = invoice.status === 'paid' || invoice.balanceAmount <= 0;
              const isOverdue = invoice.status === 'overdue' || (invoice.dueDate && new Date(invoice.dueDate) < new Date() && !isPaid);
              const StatusIcon = STATUS_CONFIG[invoice.status]?.icon || FileText;
              const isWorkOrder = invoice.invoiceType === 'work_order';
              const paidPct = Math.round(((parseFloat(invoice.amountPaid) || 0) / (parseFloat(invoice.totalAmount) || 1)) * 100);

              return (
                <div
                  key={invoice.id}
                  className="p-4 sm:p-5 hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => fetchInvoiceDetails(invoice.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Invoice Icon. Read from the invoice itself, not from the filter: on All
                        the two kinds sit in one list, and the icon is what tells them apart. */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isWorkOrder ? 'bg-blue-100' : 'bg-gold-600/20'
                    }`}>
                      {isWorkOrder ? (
                        <Briefcase className="w-6 h-6 text-blue-600" />
                      ) : (
                        <FileText className="w-6 h-6 text-gold-600" />
                      )}
                    </div>

                    {/* Invoice Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-gray-900 font-semibold">{invoice.invoiceId}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[invoice.status]?.color || STATUS_CONFIG.draft.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {STATUS_CONFIG[invoice.status]?.label || invoice.status}
                          {invoice.status === 'partially_paid' && paidPct > 0 && ` (${paidPct}%)`}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm truncate">
                        {invoice.propertyName || invoice.propertyCode || 'Property'}
                        {invoice.invoiceType === 'work_order' && invoice.workOrderId && (
                          <span className="ml-2 text-blue-600">• WO: {invoice.workOrderId}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(invoice.invoiceDate)}
                        </span>
                        <span className={`flex items-center gap-1 ${isOverdue && !isPaid ? 'text-red-600' : ''}`}>
                          <Clock className="w-3 h-3" />
                          Due: {formatDate(invoice.dueDate)}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Action */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                      {!isPaid && invoice.balanceAmount > 0 && (
                        <p className="text-sm text-amber-600">Due: {formatCurrency(invoice.balanceAmount)}</p>
                      )}
                      {isPaid && (
                        <p className="text-sm text-green-600 flex items-center justify-end gap-1">
                          <CheckCircle className="w-3 h-3" /> Paid
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-gray-500" />
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
