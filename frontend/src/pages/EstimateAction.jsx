import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, AlertTriangle, FileText } from 'lucide-react';

// API base URL for production
const API_URL = import.meta.env.VITE_API_URL || '';

const EstimateAction = () => {
  const { estimateId } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchEstimateStatus();
  }, [estimateId, token]);

  const fetchEstimateStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/estimates-sync/${estimateId}/status?token=${token}`);
      const data = await response.json();
      
      if (data.success) {
        setEstimate(data.data);
        
        // If action is in URL and estimate is still in 'Sent' or 'sent' status, auto-process
        if (action && ['Sent', 'sent'].includes(data.data.status)) {
          handleAction(action);
        }
      } else {
        setError(data.message || 'Failed to load estimate');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionType) => {
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/estimates-sync/${estimateId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionType, token })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult({ type: actionType, status: data.status });
        setEstimate(prev => ({ ...prev, status: data.status }));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to process action');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading estimate details...</p>
        </div>
      </div>
    );
  }

  if (error && !estimate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Already actioned or expired - handle case insensitivity
  const normalizedStatus = estimate?.status?.toLowerCase();
  if (estimate && ['approved', 'rejected', 'expired'].includes(normalizedStatus) && !result) {
    const statusConfig = {
      approved: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', text: 'has been approved', label: 'Approved' },
      rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', text: 'has been rejected', label: 'Rejected' },
      expired: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', text: 'has expired', label: 'Expired' }
    };
    const config = statusConfig[normalizedStatus];
    const Icon = config.icon;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className={`w-20 h-20 ${config.bg} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <Icon className={`w-12 h-12 ${config.color}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Estimate {config.label}</h1>
          <p className="text-gray-600 mb-4">
            This estimate {config.text}.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left">
            <p className="text-sm text-gray-500">Estimate ID</p>
            <p className="font-semibold text-gray-800">{estimate.estimateId}</p>
            {estimate.propertyName && (
              <>
                <p className="text-sm text-gray-500 mt-3">Property</p>
                <p className="font-semibold text-gray-800">{estimate.propertyName}</p>
              </>
            )}
            <p className="text-sm text-gray-500 mt-3">Total Amount</p>
            <p className="font-bold text-xl text-indigo-600">₹{Math.round(Number(estimate.total)).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Result after action
  if (result) {
    const isApproved = result.type === 'approve';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className={`w-20 h-20 ${isApproved ? 'bg-green-50' : 'bg-red-50'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {isApproved ? (
              <CheckCircle className="w-12 h-12 text-green-500" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Estimate {isApproved ? 'Approved' : 'Rejected'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isApproved 
              ? 'Thank you! Your estimate has been approved. Our team will contact you shortly.'
              : 'The estimate has been rejected. Our team may follow up for feedback.'}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left">
            <p className="text-sm text-gray-500">Estimate ID</p>
            <p className="font-semibold text-gray-800">{estimate.estimateId}</p>
            {estimate.propertyName && (
              <>
                <p className="text-sm text-gray-500 mt-3">Property</p>
                <p className="font-semibold text-gray-800">{estimate.propertyName}</p>
              </>
            )}
            <p className="text-sm text-gray-500 mt-3">Total Amount</p>
            <p className="font-bold text-xl text-indigo-600">₹{Math.round(Number(estimate.total)).toLocaleString('en-IN')}</p>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Contact us at <a href="mailto:info@xlandinfra.com" className="text-indigo-600">info@xlandinfra.com</a>
          </p>
        </div>
      </div>
    );
  }

  // Show action buttons
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Review Estimate</h1>
          <p className="text-gray-500 mt-1">Please review and take action</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Estimate ID</p>
              <p className="font-semibold text-gray-800">{estimate?.estimateId}</p>
            </div>
            {estimate?.customerName && (
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-semibold text-gray-800">{estimate.customerName}</p>
              </div>
            )}
            {estimate?.propertyName && (
              <div>
                <p className="text-sm text-gray-500">Property</p>
                <p className="font-semibold text-gray-800">{estimate.propertyName}</p>
              </div>
            )}
            <div className="pt-3 border-t">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="font-bold text-2xl text-indigo-600">₹{Math.round(Number(estimate?.total || 0)).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => handleAction('approve')}
            disabled={processing}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Approve
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={processing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Reject
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Need help? Contact <a href="mailto:info@xlandinfra.com" className="text-indigo-600">info@xlandinfra.com</a>
        </p>
      </div>
    </div>
  );
};

export default EstimateAction;
