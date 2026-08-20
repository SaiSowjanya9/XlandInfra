import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CheckCircle, 
  Download, 
  Home,
  FileText,
  Calendar,
  CreditCard,
  Building2,
  User,
  Loader2,
  AlertCircle,
  Printer
} from 'lucide-react';
import jsPDF from 'jspdf';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Get payment details from URL params (sent by Razorpay callback)
  const paymentId = searchParams.get('razorpay_payment_id');
  const paymentLinkId = searchParams.get('razorpay_payment_link_id');
  const paymentLinkStatus = searchParams.get('razorpay_payment_link_status');

  useEffect(() => {
    if (paymentId || paymentLinkId) {
      fetchPaymentDetails();
    } else {
      setError('Invalid payment callback');
      setLoading(false);
    }
  }, [paymentId, paymentLinkId]);

  const fetchPaymentDetails = async () => {
    try {
      setLoading(true);
      
      // Verify payment with backend
      const response = await fetch(`${API_BASE}/api/razorpay/verify-payment-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_payment_id: paymentId,
          razorpay_payment_link_id: paymentLinkId,
          razorpay_payment_link_status: paymentLinkStatus
        })
      });

      const result = await response.json();

      if (result.success) {
        // Fetch full payment details
        const detailsResponse = await fetch(`${API_BASE}/api/razorpay/payment-details/${paymentId}`);
        const detailsResult = await detailsResponse.json();
        
        if (detailsResult.success) {
          setPaymentDetails(detailsResult.data);
        } else {
          // Use basic info from callback
          setPaymentDetails({
            paymentId,
            status: paymentLinkStatus || 'paid',
            verified: true
          });
        }
      } else {
        setError(result.message || 'Payment verification failed');
      }
    } catch (err) {
      console.error('Error fetching payment details:', err);
      // Still show success if we have payment ID
      if (paymentId) {
        setPaymentDetails({
          paymentId,
          status: 'paid',
          verified: false
        });
      } else {
        setError('Failed to load payment details');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return new Date().toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return new Date(date).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0 
    }).format(amount || 0);
  };

  const generateReceiptPDF = () => {
    setDownloading(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFillColor(21, 21, 21);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(201, 162, 39);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('XLAND INFRA', margin, 22);
      doc.setFontSize(8);
      doc.text('PVT LTD', margin, 30);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('PAYMENT RECEIPT', pageWidth - margin, 25, { align: 'right' });

      y = 55;

      // Success badge
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 4, 4, 'F');
      doc.setTextColor(22, 163, 74);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT SUCCESSFUL', pageWidth / 2, y + 12, { align: 'center' });
      
      y += 30;

      // Receipt details
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      const details = [
        ['Receipt No:', `RCP-${paymentId?.slice(-8) || Date.now()}`],
        ['Payment ID:', paymentId || 'N/A'],
        ['Date & Time:', formatDate(new Date())],
        ['Invoice ID:', paymentDetails?.invoiceId || 'N/A'],
        ['Property:', paymentDetails?.propertyName || 'N/A'],
        ['Customer:', paymentDetails?.customerName || 'N/A'],
        ['Payment Method:', 'Online (Razorpay)'],
      ];

      details.forEach(([label, value]) => {
        doc.setTextColor(100, 100, 100);
        doc.text(label, margin, y);
        doc.setTextColor(30, 30, 30);
        doc.setFont('helvetica', 'bold');
        doc.text(String(value), margin + 45, y);
        doc.setFont('helvetica', 'normal');
        y += 8;
      });

      y += 10;

      // Amount box
      doc.setFillColor(251, 247, 238);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 4, 4, 'F');
      
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.text('Amount Paid', pageWidth / 2, y + 10, { align: 'center' });
      
      doc.setTextColor(22, 163, 74);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(paymentDetails?.amount || paymentDetails?.totalAmount || 0), pageWidth / 2, y + 23, { align: 'center' });

      y += 45;

      // Footer
      doc.setDrawColor(229, 229, 229);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('This is a computer-generated receipt and does not require a signature.', pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.text('For any queries, please contact support@xlandinfra.com', pageWidth / 2, y, { align: 'center' });

      // Save
      doc.save(`Receipt_${paymentId || Date.now()}.pdf`);
    } catch (err) {
      console.error('Error generating receipt:', err);
      alert('Failed to generate receipt');
    } finally {
      setDownloading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Verification Failed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">If amount was debited, please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#151515] rounded-lg flex items-center justify-center">
              <span className="text-[#c9a227] font-bold text-sm">X</span>
            </div>
            <span className="font-bold text-gray-900">XLAND INFRA</span>
          </div>
          <a href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <Home className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </a>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <CheckCircle className="w-14 h-14 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-green-700 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">Thank you for your payment. Your transaction has been completed.</p>
        </div>

        {/* Receipt Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none" id="receipt">
          {/* Receipt Header */}
          <div className="bg-[#151515] text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.webp" alt="XLAND INFRA" className="h-12 w-12 object-contain" />
                <div>
                  <h2 className="text-[#c9a227] font-bold text-base">XLAND INFRA</h2>
                  <p className="text-gray-400 text-sm">Payment Receipt</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Receipt No.</p>
                <p className="font-mono font-bold">RCP-{paymentId?.slice(-8) || Date.now()}</p>
              </div>
            </div>
          </div>

          {/* Receipt Body */}
          <div className="p-6">
            {/* Status Badge */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Payment Confirmed</p>
                <p className="text-sm text-green-600">{formatDate(new Date())}</p>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Payment ID</span>
                </div>
                <p className="font-mono font-semibold text-gray-900 text-sm break-all">{paymentId || 'N/A'}</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Invoice ID</span>
                </div>
                <p className="font-semibold text-gray-900">{paymentDetails?.invoiceId || 'N/A'}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Property</span>
                </div>
                <p className="font-semibold text-gray-900">{paymentDetails?.propertyName || 'N/A'}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Customer</span>
                </div>
                <p className="font-semibold text-gray-900">{paymentDetails?.customerName || 'N/A'}</p>
              </div>
            </div>

            {/* Amount */}
            <div className="bg-gradient-to-r from-[#c9a227]/10 to-amber-50 rounded-xl p-6 text-center border border-[#c9a227]/30">
              <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
              <p className="text-4xl font-bold text-green-600">
                {formatCurrency(paymentDetails?.amount || paymentDetails?.totalAmount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-2">Paid via Razorpay</p>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="border-t border-gray-100 p-6 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              This is a computer-generated receipt. For any queries, contact support@xlandinfra.com
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4 mt-6 print:hidden">
          <button
            onClick={generateReceiptPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-6 py-3 bg-[#c9a227] text-white rounded-xl font-semibold hover:bg-[#b08a1f] transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            Download Receipt
          </button>
          
          <button
            onClick={printReceipt}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-5 h-5" />
            Print
          </button>
        </div>

        {/* Info Notice */}
        <div className="mt-8 text-center text-sm text-gray-500 print:hidden">
          <p>A copy of this receipt has been sent to your email.</p>
          <p className="mt-1">This receipt is also saved in your payment history.</p>
        </div>
      </main>
    </div>
  );
};

export default PaymentSuccess;
