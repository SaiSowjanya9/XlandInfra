import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  CreditCard, 
  Smartphone,
  Landmark,
  Banknote,
  FileCheck,
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
  Lock
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Payment methods matching the design
const PAYMENT_METHODS = [
  { 
    id: 'card', 
    label: 'Cards / Net Banking', 
    description: 'Pay securely using debit card, credit card or net banking.', 
    icon: CreditCard, 
    type: 'online',
    badges: ['VISA', 'RuPay', 'maestro', 'Net Banking'],
    feeText: 'Processing Fee',
    feeAmount: '2% + GST',
    tags: ['Secure Payment', 'Razorpay Trusted']
  },
  { 
    id: 'upi', 
    label: 'UPI', 
    description: 'Pay instantly using GPay, PhonePe, Paytm, BHIM or any UPI app.', 
    icon: Smartphone, 
    type: 'online',
    badges: ['GPay', 'PhonePe', 'Paytm', 'BHIM'],
    feeText: 'Instant Payment',
    tags: ['Razorpay Secured']
  },
  { 
    id: 'bank_transfer', 
    label: 'Bank Transfer', 
    description: 'Transfer directly from your bank account.', 
    icon: Landmark, 
    type: 'offline',
    feeText: 'No Additional Charges',
    tags: ['Direct Collection', 'No Fees']
  },
  { 
    id: 'cash', 
    label: 'Cash', 
    description: 'Pay with cash at our office / collection point.', 
    icon: Banknote, 
    type: 'offline',
    feeText: 'No Additional Charges',
    tags: ['Direct Collection', 'No Fees']
  },
  { 
    id: 'cheque', 
    label: 'Cheque', 
    description: 'Pay using cheque.', 
    icon: FileCheck, 
    type: 'offline',
    feeText: 'No Additional Charges',
    tags: ['Direct Collection', 'No Fees']
  }
];

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

  // Fetch invoice details
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/razorpay/public/invoice/${invoiceId}?token=${token || ''}`);
        const result = await response.json();
        
        if (result.success) {
          setInvoice(result.data);
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

  const handleProceed = () => {
    const method = PAYMENT_METHODS.find(m => m.id === selectedMethod);
    if (method?.type === 'online') {
      // Redirect to Razorpay
      if (invoice?.paymentLink) {
        setProcessing(true);
        window.location.href = invoice.paymentLink;
      } else {
        setError('Payment link not available. Please contact support.');
      }
    } else {
      // Show offline payment instructions
      setStep(2);
    }
  };

  const selectedMethodData = PAYMENT_METHODS.find(m => m.id === selectedMethod);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Invoice</h2>
          <p className="text-gray-600 mb-6">{error}</p>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center border border-gray-200">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invoice Already Paid</h2>
          <p className="text-gray-600 mb-4">This invoice has already been paid. Thank you!</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
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
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose Payment Method</h2>
              <p className="text-sm text-gray-500 mb-4">Select any one payment method to proceed</p>

              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = selectedMethod === method.id;
                  const isOnline = method.type === 'online';
                  
                  return (
                    <label
                      key={method.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method.id}
                        checked={isSelected}
                        onChange={() => setSelectedMethod(method.id)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{method.label}</p>
                        <p className="text-sm text-gray-500">{method.description}</p>
                        {method.badges && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {method.badges.map((badge, idx) => (
                              <span 
                                key={idx} 
                                className={`text-xs px-2 py-0.5 rounded ${
                                  badge === 'VISA' ? 'bg-blue-900 text-white' :
                                  badge === 'RuPay' ? 'bg-green-600 text-white' :
                                  badge === 'maestro' ? 'bg-red-600 text-white' :
                                  badge === 'Net Banking' ? 'bg-gray-200 text-gray-700' :
                                  badge === 'GPay' ? 'bg-white border text-gray-700' :
                                  badge === 'PhonePe' ? 'bg-purple-600 text-white' :
                                  badge === 'Paytm' ? 'bg-blue-500 text-white' :
                                  badge === 'BHIM' ? 'bg-orange-500 text-white' :
                                  'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${isOnline ? 'text-blue-600' : 'text-green-600'}`}>
                          {method.feeText}
                        </p>
                        {method.feeAmount && (
                          <p className="text-sm text-gray-500">{method.feeAmount}</p>
                        )}
                        {method.tags && (
                          <div className="mt-1 space-y-0.5">
                            {method.tags.map((tag, idx) => (
                              <p key={idx} className="text-xs text-green-600 flex items-center justify-end gap-1">
                                <CheckCircle className="w-3 h-3" /> {tag}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                After payment, your invoice will be marked as Paid and a receipt will be sent to you.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
                      <span className="text-gray-600">{item.label}</span>
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
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="font-medium text-gray-900">{OFFICE_ADDRESS.line1}</p>
                  <p className="text-gray-700">{OFFICE_ADDRESS.line2}</p>
                  <p className="text-gray-700">{OFFICE_ADDRESS.city}</p>
                  <p className="text-gray-600 mt-2">Phone: {OFFICE_ADDRESS.phone}</p>
                  <p className="text-gray-600">Timings: {OFFICE_ADDRESS.timings}</p>
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
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
