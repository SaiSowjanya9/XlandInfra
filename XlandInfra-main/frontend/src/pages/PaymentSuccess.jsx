import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, Home, FileText, ArrowRight, Shield } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, partial, failed, error
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      // Extract payment details from URL query params
      const paymentId = searchParams.get('razorpay_payment_id');
      const paymentLinkId = searchParams.get('razorpay_payment_link_id');
      const paymentLinkReferenceId = searchParams.get('razorpay_payment_link_reference_id');
      const paymentLinkStatus = searchParams.get('razorpay_payment_link_status');
      const signature = searchParams.get('razorpay_signature');

      // If no payment params, show error
      if (!paymentId && !paymentLinkId) {
        setStatus('error');
        return;
      }

      // Try to verify signature with backend
      try {
        const response = await fetch(`${API_BASE}/api/razorpay/verify-payment-callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_payment_id: paymentId,
            razorpay_payment_link_id: paymentLinkId,
            razorpay_payment_link_reference_id: paymentLinkReferenceId,
            razorpay_payment_link_status: paymentLinkStatus,
            razorpay_signature: signature
          })
        });

        const result = await response.json();

        if (result.success) {
          setVerified(result.verified);
          setPaymentDetails({
            paymentId: result.data?.paymentId || paymentId,
            paymentLinkId: result.data?.paymentLinkId || paymentLinkId,
            referenceId: result.data?.referenceId || paymentLinkReferenceId,
            amount: result.data?.amount,
            invoiceId: result.data?.invoiceId,
            customerName: result.data?.customerName
          });

          // Determine status
          const statusParam = result.data?.status || paymentLinkStatus;
          if (statusParam === 'paid' || statusParam === 'completed') {
            setStatus('success');
          } else if (statusParam === 'partially_paid') {
            setStatus('partial');
          } else {
            setStatus('success'); // Default to success if we got a valid response
          }
        } else {
          // Verification failed - still show details but mark as unverified
          setPaymentDetails({
            paymentId,
            paymentLinkId,
            referenceId: paymentLinkReferenceId
          });
          
          if (paymentLinkStatus === 'paid') {
            setStatus('success');
          } else if (paymentLinkStatus === 'partially_paid') {
            setStatus('partial');
          } else if (paymentLinkStatus === 'cancelled' || paymentLinkStatus === 'expired') {
            setStatus('failed');
          } else {
            setStatus(paymentId ? 'success' : 'error');
          }
        }
      } catch (err) {
        console.error('Payment verification error:', err);
        // On network error, still show status based on URL params
        setPaymentDetails({
          paymentId,
          paymentLinkId,
          referenceId: paymentLinkReferenceId
        });

        if (paymentLinkStatus === 'paid') {
          setStatus('success');
        } else if (paymentLinkStatus === 'partially_paid') {
          setStatus('partial');
        } else if (paymentLinkStatus === 'cancelled' || paymentLinkStatus === 'expired') {
          setStatus('failed');
        } else {
          setStatus(paymentId ? 'success' : 'error');
        }
      }
    };

    verifyPayment();
  }, [searchParams]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="w-20 h-20 bg-gold-600/20 border border-gold-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader className="w-10 h-10 text-gold-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Processing Payment...
            </h2>
            <p className="text-dark-300">
              Please wait while we confirm your payment.
            </p>
          </div>
        );

      case 'success':
      case 'partial':
        return (
          <div className="text-center">
            <div className="w-24 h-24 bg-green-600/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-14 h-14 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              {status === 'partial' ? 'Partial Payment Received!' : 'Payment Successful!'}
            </h2>
            <p className="text-dark-300 max-w-md mx-auto mb-8">
              {status === 'partial' 
                ? 'Your partial payment has been received successfully. The remaining balance will be reflected in your invoice.'
                : 'Thank you for your payment. Your transaction has been completed successfully.'}
            </p>

            {/* Verified Badge */}
            {verified && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-full mb-6">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Payment Verified</span>
              </div>
            )}

            {/* Payment Details */}
            {paymentDetails && (
              <div className="bg-dark-700/50 border border-dark-600 rounded-xl p-6 max-w-md mx-auto mb-8">
                <h3 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-4">
                  Transaction Details
                </h3>
                <div className="space-y-3 text-left">
                  {paymentDetails.amount && (
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Amount Paid</span>
                      <span className="text-white font-semibold text-lg">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(paymentDetails.amount)}
                      </span>
                    </div>
                  )}
                  {paymentDetails.invoiceId && (
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Invoice</span>
                      <span className="text-white font-mono text-sm">{paymentDetails.invoiceId}</span>
                    </div>
                  )}
                  {paymentDetails.customerName && (
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Customer</span>
                      <span className="text-white text-sm">{paymentDetails.customerName}</span>
                    </div>
                  )}
                  {paymentDetails.paymentId && (
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Payment ID</span>
                      <span className="text-white font-mono text-sm">{paymentDetails.paymentId}</span>
                    </div>
                  )}
                  {paymentDetails.referenceId && (
                    <div className="flex justify-between items-center">
                      <span className="text-dark-400">Reference</span>
                      <span className="text-white font-mono text-sm">{paymentDetails.referenceId}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-dark-600">
                    <span className="text-dark-400">Status</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {status === 'partial' ? 'Partially Paid' : 'Paid'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-xl transition-colors"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-dark-900 font-semibold rounded-xl transition-colors"
              >
                <FileText className="w-5 h-5" />
                View Invoice
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center">
            <div className="w-24 h-24 bg-red-600/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-14 h-14 text-red-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Payment Failed
            </h2>
            <p className="text-dark-300 max-w-md mx-auto mb-8">
              Unfortunately, your payment could not be processed. This could be due to insufficient funds, 
              payment cancellation, or a technical issue.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-xl transition-colors"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </Link>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-dark-900 font-semibold rounded-xl transition-colors"
              >
                Try Again
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="text-center">
            <div className="w-24 h-24 bg-amber-600/20 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-14 h-14 text-amber-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Invalid Payment Link
            </h2>
            <p className="text-dark-300 max-w-md mx-auto mb-8">
              This page is meant to be accessed after completing a payment. 
              If you just made a payment, please check your email for confirmation.
            </p>

            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-dark-900 font-semibold rounded-xl transition-colors"
            >
              <Home className="w-5 h-5" />
              Go to Homepage
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-charcoal-900 relative overflow-hidden px-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-600/5 rounded-full blur-3xl"></div>
        {status === 'success' && (
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-green-500/5 rounded-full blur-3xl animate-pulse"></div>
        )}
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link to="/">
            <BrandLogo size="lg" />
          </Link>
        </div>

        {/* Content Card */}
        <div className="bg-dark-800/80 backdrop-blur-sm border border-dark-700 rounded-2xl p-8 sm:p-12 shadow-xl">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-dark-500 text-sm">
            Need help?{' '}
            <a 
              href="mailto:info@xlandinfra.com" 
              className="text-gold-400 hover:text-gold-300 transition-colors"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
