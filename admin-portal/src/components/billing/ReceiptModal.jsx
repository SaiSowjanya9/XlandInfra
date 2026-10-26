import { Send, Download, RefreshCw, X, CheckCircle, CreditCard, Banknote, Building2, FileCheck, Smartphone } from 'lucide-react';
import Modal from '../common/Modal';

/**
 * How a stored payment method reads in the table, the export and the receipt.
 *
 * Four methods are real: `razorpay` for everything taken online, and `cash`, `cheque` and
 * `bank_transfer` offline. A Razorpay payment is stored as `razorpay` whether the customer used a
 * card, net banking, UPI or a wallet -- the instrument is in
 * `payment_history.payment_method_details`, which is why the Razorpay receipt renders
 * "Card/Net Banking/UPI" rather than reading this map.
 */
export const PAYMENT_METHODS = {
  razorpay: { label: 'Razorpay', icon: CreditCard, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  cash: { label: 'Cash', icon: Banknote, color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  bank_transfer: { label: 'Bank Transfer', icon: Building2, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  // The verify flow stores 'cheque' while older rows say 'check' -- same method, two names
  check: { label: 'Cheque', icon: FileCheck, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  cheque: { label: 'Cheque', icon: FileCheck, color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  // Not offered anywhere any more, but schema_v17's ENUM allows it and a legacy row may hold it:
  // a stored value must still read as itself rather than fall through to 'Other'.
  upi: { label: 'UPI', icon: Smartphone, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  other: { label: 'Other', icon: CreditCard, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' }
};

// Format currency
export const formatCurrencyShort = (amount) => {
  const num = parseFloat(amount) || 0;
  return '₹' + new Intl.NumberFormat('en-IN').format(num);
};

/**
 * The payment receipt lightbox. `payment` is the receipt payload from
 * `GET /api/payments/:id/receipt` (or a Payments list row in the same shape).
 * `onSend` is optional -- leave it out on read-only screens and the send button is hidden.
 */
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
    <Modal onClose={onClose} className="w-full max-w-lg max-h-[90vh] overflow-hidden">
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
            {payment.receiptId && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Receipt No.</span>
                <span className="text-gray-900">{payment.receiptId}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Payment ID</span>
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
      </Modal>
  );
};

export default ReceiptModal;
