import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  Send,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Link,
  Copy,
  CheckCircle,
  Mail,
  X,
  ExternalLink,
  Clock,
  XCircle,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Company Details - Can be configured
const COMPANY_INFO = {
  name: 'XLAND INFRA PVT LTD',
  address: 'D.No. 7-333/A/1, Nri Hospital Road',
  city: 'Mangalagiri, Guntur, 522503',
  phone: '8500010111',
  email: 'info@xlandinfra.com',
  gstin: '',
};

const PAYMENT_LINK_STATUS = {
  created: { label: 'Link Created', color: 'bg-blue-100 text-blue-700', icon: Link },
  sent: { label: 'Link Sent', color: 'bg-purple-100 text-purple-700', icon: Send },
  paid: { label: 'Paid via Link', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  expired: { label: 'Link Expired', color: 'bg-red-100 text-red-700', icon: Clock },
  cancelled: { label: 'Link Cancelled', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

const FPInvoiceView = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const invoiceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Payment Link States
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [paymentLinkStatus, setPaymentLinkStatus] = useState(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [emailToSend, setEmailToSend] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const token = getAuthToken();

  const fetchInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setInvoice(result.data);
        setEmailToSend(result.data.customerEmail || '');
        // Fetch payment link status
        fetchPaymentLinkStatus(result.data.id);
      } else {
        setError(result.message || 'Failed to fetch invoice');
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentLinkStatus = async (invoiceId) => {
    try {
      const response = await fetch(`${API_BASE}/api/razorpay/payment-link-status/${invoiceId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setPaymentLinkStatus(result.data);
      }
    } catch (err) {
      console.error('Error fetching payment link status:', err);
    }
  };

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Invoice_${invoice.invoiceId}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Create Payment Link
  const handleCreatePaymentLink = async () => {
    setCreatingLink(true);
    try {
      const response = await fetch(`${API_BASE}/api/razorpay/create-payment-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId: invoice.id })
      });
      const result = await response.json();
      
      if (result.success) {
        showToast('Payment link created successfully!');
        setPaymentLinkStatus(result.data);
        fetchPaymentLinkStatus(invoice.id);
      } else {
        showToast(result.message || 'Failed to create payment link', 'error');
      }
    } catch (err) {
      console.error('Error creating payment link:', err);
      showToast('Failed to create payment link', 'error');
    } finally {
      setCreatingLink(false);
    }
  };

  // Send Payment Link via Email
  const handleSendPaymentLink = async () => {
    if (!emailToSend) {
      showToast('Please enter an email address', 'error');
      return;
    }

    setSendingLink(true);
    try {
      const response = await fetch(`${API_BASE}/api/razorpay/send-payment-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          email: emailToSend,
          customMessage
        })
      });
      const result = await response.json();
      
      if (result.success) {
        showToast(`Payment link sent to ${emailToSend}`);
        setShowPaymentLinkModal(false);
        fetchPaymentLinkStatus(invoice.id);
      } else {
        showToast(result.message || 'Failed to send payment link', 'error');
      }
    } catch (err) {
      console.error('Error sending payment link:', err);
      showToast('Failed to send payment link', 'error');
    } finally {
      setSendingLink(false);
    }
  };

  // Copy Payment Link
  const handleCopyLink = async () => {
    if (paymentLinkStatus?.paymentLink) {
      await navigator.clipboard.writeText(paymentLinkStatus.paymentLink);
      setCopied(true);
      showToast('Payment link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canEdit = ['admin', 'operations_manager', 'franchise_partner', 'manager'].includes(user?.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-2 text-gray-600">Loading invoice...</span>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error || 'Invoice not found'}</p>
        <button
          onClick={() => navigate('/fp/payments/invoices')}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  const linkStatusConfig = paymentLinkStatus?.status ? PAYMENT_LINK_STATUS[paymentLinkStatus.status] : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Action Bar - Hidden on Print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/fp/payments/invoices')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice {invoice.invoiceId}</h1>
            <p className="text-gray-500 mt-1">View and manage invoice</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </button>
          {canEdit && invoice.balanceAmount > 0 && (
            <>
              <button
                onClick={() => setShowPaymentLinkModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
              >
                <Link className="w-4 h-4" />
                Payment Link
              </button>
              <button
                onClick={() => navigate(`/fp/payments/record?invoiceId=${invoice.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Record Payment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payment Link Status Banner */}
      {paymentLinkStatus?.paymentLink && paymentLinkStatus.status !== 'paid' && (
        <div className={`print:hidden rounded-xl p-4 ${linkStatusConfig?.color || 'bg-gray-100'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {linkStatusConfig?.icon && <linkStatusConfig.icon className="w-5 h-5" />}
              <div>
                <p className="font-medium">{linkStatusConfig?.label || 'Payment Link'}</p>
                <p className="text-sm opacity-80">
                  Created: {formatDateTime(paymentLinkStatus.createdAt)}
                  {paymentLinkStatus.sentAt && ` • Sent: ${formatDateTime(paymentLinkStatus.sentAt)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/80 rounded-lg hover:bg-white transition-colors text-sm font-medium"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={paymentLinkStatus.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-white/80 rounded-lg hover:bg-white transition-colors text-sm font-medium"
              >
                <ExternalLink className="w-4 h-4" />
                Open Link
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Document */}
      <div 
        ref={invoiceRef}
        className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none"
      >
        {/* Invoice Content */}
        <div className="p-8 md:p-12" style={{ fontFamily: 'Georgia, serif' }}>
          
          {/* Header with Logo placeholder and Invoice Title */}
          <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
            <h1 className="text-3xl font-bold tracking-wider text-gray-800 mb-1">INVOICE</h1>
            <div className="w-24 h-0.5 bg-amber-500 mx-auto"></div>
          </div>

          {/* Two Column Header: Customer Info & Invoice Details */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            {/* Left: Bill To */}
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Bill To</h2>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-gray-900">{invoice.customerName || 'Customer'}</p>
                {invoice.propertyName && (
                  <p className="text-gray-600">{invoice.propertyName}</p>
                )}
                {invoice.customerEmail && (
                  <p className="text-gray-600">{invoice.customerEmail}</p>
                )}
                {invoice.customerPhone && (
                  <p className="text-gray-600">Ph: {invoice.customerPhone}</p>
                )}
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="text-right">
              <div className="inline-block text-left">
                <table className="text-sm">
                  <tbody>
                    <tr>
                      <td className="text-gray-500 pr-4 py-1">Invoice No:</td>
                      <td className="font-semibold text-gray-900">{invoice.invoiceId}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-500 pr-4 py-1">Date:</td>
                      <td className="font-semibold text-gray-900">{formatDate(invoice.invoiceDate)}</td>
                    </tr>
                    <tr>
                      <td className="text-gray-500 pr-4 py-1">Due Date:</td>
                      <td className="font-semibold text-gray-900">{formatDate(invoice.dueDate)}</td>
                    </tr>
                    {invoice.propertyCode && (
                      <tr>
                        <td className="text-gray-500 pr-4 py-1">Property ID:</td>
                        <td className="font-semibold text-gray-900">{invoice.propertyCode}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="py-3 px-4 text-left text-sm font-semibold">#</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold">Description</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold">Qty</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold">Rate</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lineItems || []).map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-3 px-4 text-gray-600">{index + 1}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{item.description}</p>
                      {item.details && (
                        <p className="text-sm text-gray-500">{item.details}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{item.quantity || 1}</td>
                    <td className="py-3 px-4 text-right text-gray-600">₹{formatCurrency(item.rate || item.amount)}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">₹{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                {(!invoice.lineItems || invoice.lineItems.length === 0) && (
                  <tr className="border-b border-gray-200">
                    <td className="py-3 px-4 text-gray-600">1</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">Services</p>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">1</td>
                    <td className="py-3 px-4 text-right text-gray-600">₹{formatCurrency(invoice.subtotal)}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">₹{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-72">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-900">₹{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Discount ({invoice.discountPercentage}%):</span>
                    <span className="font-medium text-red-600">-₹{formatCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">GST ({invoice.taxPercentage}%):</span>
                    <span className="font-medium text-gray-900">₹{formatCurrency(invoice.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 bg-gray-800 text-white px-4 -mx-4 rounded">
                  <span className="font-bold">Total Amount:</span>
                  <span className="font-bold text-lg">₹{formatCurrency(invoice.totalAmount)}</span>
                </div>
                {invoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Amount Paid:</span>
                      <span className="font-medium text-green-600">₹{formatCurrency(invoice.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between py-2 bg-amber-100 px-4 -mx-4 rounded">
                      <span className="font-bold text-amber-800">Balance Due:</span>
                      <span className="font-bold text-amber-800">₹{formatCurrency(invoice.balanceAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          {invoice.balanceAmount > 0 && (
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">Payment Options</h3>
              <p className="text-sm text-blue-700">
                Pay online using UPI, Credit Card, Debit Card, Net Banking, or Digital Wallets.
                {paymentLinkStatus?.paymentLink && (
                  <span className="block mt-1">
                    <strong>Payment Link:</strong> {paymentLinkStatus.paymentLink}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-8">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-gray-800 pt-6 mt-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From</h3>
                <p className="font-semibold text-gray-900">{COMPANY_INFO.name}</p>
                <p className="text-sm text-gray-600">{COMPANY_INFO.address}</p>
                <p className="text-sm text-gray-600">{COMPANY_INFO.city}</p>
                <p className="text-sm text-gray-600">Ph: {COMPANY_INFO.phone}</p>
                <p className="text-sm text-gray-600">{COMPANY_INFO.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Thank you for your business!</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 print:hidden">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
          <div className="space-y-3">
            {invoice.payments.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{payment.paymentId}</p>
                  <p className="text-sm text-gray-500">
                    {formatDateTime(payment.paymentDate)} • {payment.paymentMethod?.replace('_', ' ').toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">₹{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-gray-500">{payment.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Link Modal */}
      {showPaymentLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Send Payment Link</h2>
                <button
                  onClick={() => setShowPaymentLinkModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Invoice Summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Invoice</p>
                    <p className="font-semibold">{invoice.invoiceId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Customer</p>
                    <p className="font-semibold">{invoice.customerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Property</p>
                    <p className="font-semibold">{invoice.propertyName || invoice.propertyCode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount Due</p>
                    <p className="font-semibold text-amber-600">₹{formatCurrency(invoice.balanceAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Due Date</p>
                    <p className="font-semibold">{formatDate(invoice.dueDate)}</p>
                  </div>
                </div>
              </div>

              {/* Payment Link Status */}
              {paymentLinkStatus?.paymentLink ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">Payment Link Ready</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg p-2">
                      <input
                        type="text"
                        value={paymentLinkStatus.paymentLink}
                        readOnly
                        className="flex-1 text-sm text-gray-600 bg-transparent border-none focus:outline-none"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Expires: {formatDateTime(paymentLinkStatus.expiresAt)}
                    </p>
                  </div>

                  {/* Send via Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Send to Email
                    </label>
                    <input
                      type="email"
                      value={emailToSend}
                      onChange={(e) => setEmailToSend(e.target.value)}
                      placeholder="customer@email.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Message (Optional)
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Add a personal message..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSendPaymentLink}
                    disabled={sendingLink || !emailToSend}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
                  >
                    {sendingLink ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Send Payment Link
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Create a secure Razorpay payment link that allows your customer to pay using:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4">
                    <li>• UPI (GPay, PhonePe, Paytm, etc.)</li>
                    <li>• Credit Card / Debit Card</li>
                    <li>• Net Banking</li>
                    <li>• Digital Wallets</li>
                  </ul>

                  <button
                    onClick={handleCreatePaymentLink}
                    disabled={creatingLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50"
                  >
                    {creatingLink ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Creating Link...
                      </>
                    ) : (
                      <>
                        <Link className="w-5 h-5" />
                        Create Payment Link
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Info Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> The payment link will be valid for 7 days. 
                  Once the customer completes the payment, the invoice status will be automatically updated.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPInvoiceView;
