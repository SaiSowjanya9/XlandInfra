import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Download,
  Printer,
  Send,
  RefreshCw,
  AlertCircle,
  CreditCard,
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
  gstin: '', // Add GSTIN if available
};

const FPInvoiceView = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const invoiceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

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

  useEffect(() => {
    if (id) {
      fetchInvoice();
    }
  }, [id]);

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
            <p className="text-gray-500 mt-1">View and download invoice</p>
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
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          {canEdit && invoice.balanceAmount > 0 && (
            <button
              onClick={() => navigate(`/fp/payments/record?invoiceId=${invoice.id}`)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>
          )}
        </div>
      </div>

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
                    <tr>
                      <td className="text-gray-500 pr-4 py-1">Status:</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          invoice.paymentStatus === 'paid' 
                            ? 'bg-green-100 text-green-700' 
                            : invoice.paymentStatus === 'partially_paid'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {invoice.paymentStatus === 'paid' ? 'PAID' : 
                           invoice.paymentStatus === 'partially_paid' ? 'PARTIAL' : 'UNPAID'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From</h2>
            <p className="font-bold text-gray-900">{COMPANY_INFO.name}</p>
            <p className="text-gray-600 text-sm">{COMPANY_INFO.address}</p>
            <p className="text-gray-600 text-sm">{COMPANY_INFO.city}</p>
            <p className="text-gray-600 text-sm">Ph: {COMPANY_INFO.phone}</p>
            {COMPANY_INFO.gstin && (
              <p className="text-gray-600 text-sm">GSTIN: {COMPANY_INFO.gstin}</p>
            )}
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="py-3 px-4 text-left text-sm font-semibold w-20">S.No</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold w-28">Date</th>
                  <th className="py-3 px-4 text-left text-sm font-semibold">Description</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold w-24">Qty</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold w-32">Rate</th>
                  <th className="py-3 px-4 text-right text-sm font-semibold w-36">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems && invoice.lineItems.length > 0 ? (
                  invoice.lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-4 px-4 text-gray-600">{index + 1}</td>
                      <td className="py-4 px-4 text-gray-600">{formatDate(invoice.invoiceDate)}</td>
                      <td className="py-4 px-4 text-gray-900">{item.description}</td>
                      <td className="py-4 px-4 text-right text-gray-600">{item.quantity || 1}</td>
                      <td className="py-4 px-4 text-right text-gray-600">{formatCurrency(item.rate || item.amount)}</td>
                      <td className="py-4 px-4 text-right font-medium text-gray-900">
                        {formatCurrency((item.quantity || 1) * (item.rate || item.amount || 0))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-gray-200">
                    <td className="py-4 px-4 text-gray-600">1</td>
                    <td className="py-4 px-4 text-gray-600">{formatDate(invoice.invoiceDate)}</td>
                    <td className="py-4 px-4 text-gray-900">Services as per agreement</td>
                    <td className="py-4 px-4 text-right text-gray-600">1</td>
                    <td className="py-4 px-4 text-right text-gray-600">{formatCurrency(invoice.subtotal)}</td>
                    <td className="py-4 px-4 text-right font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                )}
                {/* Empty rows for visual spacing */}
                {(!invoice.lineItems || invoice.lineItems.length < 3) && (
                  <>
                    {[...Array(3 - (invoice.lineItems?.length || 1))].map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-gray-200">
                        <td className="py-4 px-4">&nbsp;</td>
                        <td className="py-4 px-4"></td>
                        <td className="py-4 px-4"></td>
                        <td className="py-4 px-4"></td>
                        <td className="py-4 px-4"></td>
                        <td className="py-4 px-4"></td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-80">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-2 text-gray-600">Sub Total</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</td>
                  </tr>
                  {invoice.discountAmount > 0 && (
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-600">Discount ({invoice.discountPercentage}%)</td>
                      <td className="py-2 text-right font-medium text-red-600">-{formatCurrency(invoice.discountAmount)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-200">
                    <td className="py-2 text-gray-600">Tax (GST {invoice.taxPercentage}%)</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {invoice.taxAmount > 0 ? formatCurrency(invoice.taxAmount) : 'N/A'}
                    </td>
                  </tr>
                  <tr className="bg-gray-800">
                    <td className="py-3 px-3 text-white font-bold">Total</td>
                    <td className="py-3 px-3 text-right text-white font-bold text-lg">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Amount Paid & Balance */}
          {(invoice.amountPaid > 0 || invoice.balanceAmount > 0) && (
            <div className="flex justify-end mb-8">
              <div className="w-80 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(invoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-amber-200">
                  <span className="font-semibold text-gray-800">Balance Due:</span>
                  <span className="font-bold text-red-600 text-lg">{formatCurrency(invoice.balanceAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-gray-600 text-sm">{invoice.notes}</p>
            </div>
          )}

          {/* Terms & Conditions */}
          {invoice.termsAndConditions && (
            <div className="mb-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Terms & Conditions</h3>
              <p className="text-gray-600 text-sm whitespace-pre-line">{invoice.termsAndConditions}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t-2 border-gray-800">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm text-gray-500 mb-4">For any queries regarding this invoice:</p>
                <p className="text-sm text-gray-600">Email: {COMPANY_INFO.email}</p>
                <p className="text-sm text-gray-600">Phone: {COMPANY_INFO.phone}</p>
              </div>
              <div className="text-right">
                <div className="inline-block">
                  <div className="border-t-2 border-gray-400 pt-2 mt-12">
                    <p className="text-sm font-semibold text-gray-700">Authorized Signature</p>
                    <p className="text-xs text-gray-500">{COMPANY_INFO.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Thank You Message */}
          <div className="mt-8 text-center">
            <p className="text-lg font-semibold text-amber-600">Thank you for your business!</p>
          </div>

        </div>
      </div>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 print:hidden">
          <h3 className="font-semibold text-gray-900 mb-4">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Payment ID</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Method</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Amount</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Reference</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.payments.map((payment, index) => (
                  <tr key={index}>
                    <td className="py-2 px-3 text-sm font-medium text-gray-900">{payment.paymentId}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{formatDate(payment.paymentDate)}</td>
                    <td className="py-2 px-3 text-sm text-gray-600 capitalize">{payment.paymentMethod?.replace('_', ' ')}</td>
                    <td className="py-2 px-3 text-sm font-medium text-green-600 text-right">{formatCurrency(payment.amount)}</td>
                    <td className="py-2 px-3 text-sm text-gray-500">{payment.transactionReference || '-'}</td>
                    <td className="py-2 px-3 text-sm text-gray-600">{payment.receivedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          #invoice-content, #invoice-content * {
            visibility: visible;
          }
          #invoice-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default FPInvoiceView;
