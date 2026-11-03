import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Landmark,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
  Info,
  Copy,
  Check,
  Building2,
  HelpCircle,
  Lock
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Cards and UPI are routed through Razorpay; bank transfer, cash and cheque are collected
// directly and verified by the team. Only the routing lives here -- each row is written out in
// the page below, in the markup the portals' Make Payment screen uses, so the customer meets the
// same payment interface whether they arrive from the invoice email or from a portal.
const PAYMENT_METHODS = [
  { id: 'card', type: 'online' },
  { id: 'upi', type: 'online' },
  { id: 'bank_transfer', type: 'offline' },
  { id: 'cash', type: 'offline' },
  { id: 'cheque', type: 'offline' }
];

// Card networks, the gateway's processing fee and the "no fees" note for a direct collection --
// the same three blocks `admin-portal/src/pages/billing/MakePayments.jsx` draws beside a method.
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

const ProcessingFee = () => (
  <>
    <p className="text-gray-500 text-[10px]">Processing Fee</p>
    <div className="flex items-center justify-end gap-1 mt-0.5">
      <span className="text-gray-900 font-semibold text-sm">2%</span>
      <HelpCircle className="w-3 h-3 text-gray-400" />
    </div>
  </>
);

const FeeIndicator = () => (
  <div className="text-right flex-shrink-0">
    <ProcessingFee />
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

// Bank details
const BANK_DETAILS = {
  accountName: 'XLAND INFRA PVT LTD',
  accountNumber: '50200085463214',
  bankName: 'HDFC Bank',
  branch: 'Mangalagiri Branch',
  ifscCode: 'HDFC0002847',
  upiId: 'xlandinfra@hdfcbank'
};

// Office address
const OFFICE_ADDRESS = {
  line1: 'D.No. 7-333/A/1, NRI Hospital Road',
  line2: 'Mangalagiri, Guntur District',
  city: 'Andhra Pradesh - 522503',
  phone: '+91 8500-010-111',
  timings: 'Mon - Sat: 9:00 AM - 6:00 PM'
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const PublicPayment = () => {
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Select Method, 2: Instructions, 3: Processing
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [intentRef, setIntentRef] = useState(null);
  // A failed action — the gateway refusing a link, the team not being told about a cash payment —
  // is reported where it happened. `error` is the page's load failure and replaces the whole
  // screen, so using it for these turned a working invoice into "Unable to Load Invoice".
  const [actionError, setActionError] = useState(null);
  const intentRecorded = useRef(false);
  // The token the page acts with: the one in the link, or, for a link mailed before invoice
  // emails carried one, the invoice's own token handed back by the read below.
  const [payToken, setPayToken] = useState(token || '');

  // Fetch invoice details
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/razorpay/public/invoice/${invoiceId}?token=${encodeURIComponent(token || '')}`);
        const result = await response.json();
        
        if (result.success) {
          setInvoice(result.data);
          if (result.data.paymentToken) setPayToken(result.data.paymentToken);
          if (result.data.status === 'paid' || result.data.balanceAmount <= 0) {
            setStep(4); // Already paid
          }
        } else {
          setError(result.message || 'Invoice not found or link has expired');
        }
      } catch (err) {
        console.error('Error fetching invoice:', err);
        setError('Failed to load invoice. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (invoiceId) {
      fetchInvoice();
    }
  }, [invoiceId, token]);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleProceed = async () => {
    const method = PAYMENT_METHODS.find(m => m.id === selectedMethod);
    setActionError(null);
    setProcessing(true);
    try {
      if (method?.type === 'online') {
        // The server owns the link: it reuses the invoice's live one and mints a replacement
        // when it is missing, expired or cancelled. Redirecting straight to the stored
        // `paymentLink` sent the customer to a dead Razorpay page in exactly those cases, and
        // to "Payment link not available. Please contact support." when there was none at all.
        let target = null;
        let refusal = null;
        try {
          const response = await fetch(`${API_BASE}/api/razorpay/public/payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId, token: payToken, portion: 'full' })
          });
          const result = await response.json();
          if (result.success) target = result.data?.paymentLink || result.data?.shortUrl;
          else refusal = result.message;
        } catch {
          // Network failure: the invoice's own stored link is still worth trying
        }
        target = target || invoice?.paymentLink;
        if (target) {
          window.location.href = target;
          return;
        }
        setActionError(refusal || 'We could not start the payment. Please try again, or contact us.');
      } else {
        // Record the intent *before* showing the instructions, so the customer is never told
        // their payment is expected when the team has not been told about it. Without this row
        // a cash/cheque/bank payment made through the link left no trace in Payments.
        if (!intentRecorded.current) {
          const response = await fetch(`${API_BASE}/api/razorpay/public/record-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId, token: payToken, paymentMethod: selectedMethod })
          });
          const result = await response.json();
          if (result.success) {
            intentRecorded.current = true;
            if (result.data?.referenceId) setIntentRef(result.data.referenceId);
          } else {
            // The instructions are still correct and the customer can still pay, so they are
            // shown — with the failure stated, rather than a reference number that is not real.
            setActionError(result.message || 'We could not register this payment with our team. Please quote the invoice number when you pay.');
          }
        }
        setStep(2);
      }
    } catch (err) {
      console.error('Payment action failed:', err);
      setActionError('Something went wrong. Please check your connection and try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-page flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-warm-page flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Invoice</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Already paid
  if (step === 4) {
    return (
      <div className="min-h-screen bg-warm-page flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invoice Already Paid</h2>
          <p className="text-gray-500 mb-4">This invoice has already been paid. Thank you!</p>
          <div className="bg-warm-page rounded-lg p-4 mb-6">
            <p className="text-gray-500 text-sm">Invoice</p>
            <p className="text-gray-900 font-semibold">{invoice?.invoiceId}</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-page">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Make Payment</h1>
              <p className="text-sm text-gray-500">Choose a payment method and complete your payment</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Step 1: Payment Method Selection */}
        {step === 1 && (
          <>
            {/* Invoice Details Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-blue-600 font-medium uppercase mb-1">Invoice ID</p>
                  <p className="text-sm font-semibold text-blue-600">{invoice?.invoiceId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Property / Customer</p>
                  <p className="text-sm font-medium text-gray-900">{invoice?.propertyName || invoice?.customerName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Invoice Date</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(invoice?.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Due Date</p>
                  <p className="text-sm font-medium text-red-600">{formatDate(invoice?.dueDate)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-green-600 font-medium uppercase">Total Amount</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(invoice?.totalAmount)}</p>
                  <p className="text-xs text-green-600 mt-1">Due Amount</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(invoice?.balanceAmount)}</p>
                </div>
              </div>
            </div>

            {/* Payment Methods Card */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-base">Choose Payment Method</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select any one payment method to proceed</p>
              </div>

              <div className="divide-y divide-gray-100">
                {/* Cards / Net Banking - via Razorpay */}
                <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'card' ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="card"
                    checked={selectedMethod === 'card'}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="mt-2 w-4 h-4 text-blue-600"
                  />
                  {/* Card Icon - Line art */}
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="#6b7280" strokeWidth="1.5">
                      <rect x="1" y="1" width="26" height="20" rx="3"/>
                      <rect x="4" y="5" width="5" height="4" rx="1"/>
                      <line x1="1" y1="11" x2="27" y2="11"/>
                      <line x1="1" y1="14" x2="27" y2="14"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">Cards / Net Banking</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Pay securely using debit card, credit card or net banking.</p>
                    <CardLogos />
                  </div>
                  <FeeIndicator />
                </label>

                {/* UPI - via Razorpay */}
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
                    <svg viewBox="0 0 60 45" className="w-10 h-8" fill="none">
                      <text x="2" y="22" fill="#6b7280" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif" letterSpacing="-1">UPI</text>
                      <polygon points="38,6 44,6 38,16" stroke="#f97316" strokeWidth="1.5" fill="none"/>
                      <polygon points="38,16 44,16 44,26" stroke="#22c55e" strokeWidth="1.5" fill="none"/>
                      <text x="2" y="35" fill="#9ca3af" fontSize="5" fontFamily="Arial, sans-serif" letterSpacing="0.3">UNIFIED PAYMENTS</text>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">UPI</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Pay instantly using GPay, PhonePe, Paytm, BHIM or any UPI app.</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-white rounded border border-gray-200">
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span className="text-[10px] font-medium text-gray-600">Pay</span>
                      </div>
                      <div className="w-7 h-7 bg-[#5f259f] rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold" style={{ fontFamily: 'Arial, sans-serif' }}>पे</span>
                      </div>
                      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center border-2 border-[#00325b]">
                        <span className="text-[7px] font-bold"><span className="text-[#00325b]">pay</span><span className="text-[#00baf2]">tm</span></span>
                      </div>
                      <div className="px-2 py-1 bg-[#ed752e] rounded">
                        <span className="text-[10px] font-bold text-white">BHIM</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <ProcessingFee />
                    <p className="text-green-600 font-semibold text-xs mt-1.5">Instant Payment</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <Shield className="w-3 h-3 text-blue-500" />
                      <span className="text-[10px] text-blue-600 font-medium">Razorpay Secured</span>
                    </div>
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
                      <path d="M16 2L3 10H29L16 2Z" strokeLinejoin="round" fill="none"/>
                      <circle cx="16" cy="7" r="2" fill="none"/>
                      <rect x="3" y="10" width="26" height="2" fill="none"/>
                      <rect x="6" y="12" width="2" height="12" fill="none"/>
                      <rect x="12" y="12" width="2" height="12" fill="none"/>
                      <rect x="18" y="12" width="2" height="12" fill="none"/>
                      <rect x="24" y="12" width="2" height="12" fill="none"/>
                      <rect x="3" y="24" width="26" height="3" rx="0.5" fill="none"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">Bank Transfer</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Transfer directly from your bank account.</p>
                  </div>
                  <NoFeesIndicator />
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
                      <rect x="1" y="2" width="24" height="16" rx="1"/>
                      <circle cx="13" cy="10" r="4"/>
                      <text x="13" y="12.5" textAnchor="middle" fill="#6b7280" fontSize="6" fontWeight="bold" stroke="none">₹</text>
                      <ellipse cx="32" cy="20" rx="5" ry="2"/>
                      <ellipse cx="32" cy="17" rx="5" ry="2"/>
                      <ellipse cx="32" cy="14" rx="5" ry="2"/>
                      <text x="32" y="16" textAnchor="middle" fill="#6b7280" fontSize="4" fontWeight="bold" stroke="none">₹</text>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">Cash</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Pay with cash at our office / collection point.</p>
                  </div>
                  <NoFeesIndicator />
                </label>

                {/* Cheque */}
                <label className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${selectedMethod === 'cheque' ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cheque"
                    checked={selectedMethod === 'cheque'}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="mt-2 w-4 h-4 text-blue-600"
                  />
                  {/* Cheque Icon - Line art style matching other icons */}
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-gray-200 flex-shrink-0">
                    <svg width="28" height="22" viewBox="0 0 32 26" fill="none" stroke="#6b7280" strokeWidth="1.5">
                      <rect x="1" y="2" width="22" height="16" rx="1"/>
                      <line x1="4" y1="6" x2="14" y2="6"/>
                      <line x1="4" y1="10" x2="20" y2="10"/>
                      <line x1="4" y1="14" x2="12" y2="14"/>
                      <circle cx="26" cy="20" r="5"/>
                      <path d="M23.5 20L25 21.5L28.5 18" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">Cheque</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Pay using cheque.</p>
                  </div>
                  <NoFeesIndicator />
                </label>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                After payment, your invoice will be marked as Paid and a receipt will be sent to you.
              </p>
            </div>

            {actionError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{actionError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 border border-gray-200 text-gray-900 rounded-lg font-medium hover:bg-warm-page transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={processing}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Proceed to Pay
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Offline Payment Instructions */}
        {step === 2 && (
          <>
            {/* Invoice Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Invoice</p>
                  <p className="font-semibold text-gray-900">{invoice?.invoiceId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Amount to Pay</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(invoice?.balanceAmount)}</p>
                </div>
              </div>
              {intentRef && (
                <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  Payment reference: <span className="font-mono font-semibold text-gray-800">{intentRef}</span> — quote this when paying
                </p>
              )}
              {actionError && (
                <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-red-700 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span>{actionError} Quote invoice <strong>{invoice?.invoiceId}</strong> when you pay.</span>
                </p>
              )}
            </div>

            {/* Bank Transfer Instructions */}
            {selectedMethod === 'bank_transfer' && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-blue-600" />
                  Bank Transfer Details
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Account Name', value: BANK_DETAILS.accountName, key: 'name' },
                    { label: 'Account Number', value: BANK_DETAILS.accountNumber, key: 'account' },
                    { label: 'Bank Name', value: BANK_DETAILS.bankName, key: 'bank' },
                    { label: 'Branch', value: BANK_DETAILS.branch, key: 'branch' },
                    { label: 'IFSC Code', value: BANK_DETAILS.ifscCode, key: 'ifsc' },
                  ].map(item => (
                    <div key={item.key} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.value}</span>
                        <button 
                          onClick={() => handleCopy(item.value, item.key)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-blue-600"
                        >
                          {copiedField === item.key ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 font-medium mb-2">Important:</p>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li>Include invoice number <strong>{invoice?.invoiceId}</strong> in payment remarks</li>
                    <li>Share UTR/Reference number after transfer for faster verification</li>
                    <li>Payment will be verified within 24-48 hours</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Cash/Cheque Instructions */}
            {(selectedMethod === 'cash' || selectedMethod === 'cheque') && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Office Address
                </h3>
                <div className="bg-warm-page rounded-lg p-4 mb-4">
                  <p className="font-medium text-gray-900">{OFFICE_ADDRESS.line1}</p>
                  <p className="text-gray-900">{OFFICE_ADDRESS.line2}</p>
                  <p className="text-gray-900">{OFFICE_ADDRESS.city}</p>
                  <p className="text-gray-500 mt-2">Phone: {OFFICE_ADDRESS.phone}</p>
                  <p className="text-gray-500">Timings: {OFFICE_ADDRESS.timings}</p>
                </div>
                {selectedMethod === 'cheque' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium mb-2">Cheque Details:</p>
                    <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                      <li>Make cheque payable to: <strong>XLAND INFRA PVT LTD</strong></li>
                      <li>Write invoice number on the back: <strong>{invoice?.invoiceId}</strong></li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-2.5 border border-gray-200 text-gray-900 rounded-lg font-medium hover:bg-warm-page transition-colors"
              >
                Choose Different Method
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicPayment;
