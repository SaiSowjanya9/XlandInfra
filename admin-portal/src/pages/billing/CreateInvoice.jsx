import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle,
  Building2,
  User,
  Mail,
  Phone,
  IndianRupee,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

const CreateInvoice = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  
  const [estimateId, setEstimateId] = useState('');
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Enter Estimate ID, 2: Confirm Estimate, 3: Review & Create
  const [toast, setToast] = useState(null);
  
  // Get base path for navigation based on portal type
  const getBasePath = () => {
    switch (portalType) {
      case 'fp': return '/fp';
      case 'manager': return '/manager';
      case 'employee': return '/employee';
      case 'coordinator': return '/coordinator';
      case 'supervisor': return '/supervisor';
      case 'executive': return '/executive';
      default: return '/admin';
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch estimate details when Estimate ID is entered
  const fetchEstimateData = async () => {
    if (!estimateId || estimateId.length < 3) return;
    
    setFetchingData(true);
    setError('');
    setSelectedEstimate(null);
    
    try {
      const estResponse = await fetch(`${API_BASE}/api/payments/estimates/by-id/${estimateId}?status=approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const estResult = await estResponse.json();
      
      if (estResult.success && estResult.data) {
        setSelectedEstimate(estResult.data);
        setCustomerDetails({
          name: estResult.data.customerName || '',
          email: estResult.data.customerEmail || '',
          phone: estResult.data.customerPhone || ''
        });
        setStep(2);
      } else {
        setError('Estimate not found or not approved');
      }
    } catch (err) {
      setError('Error fetching estimate: ' + err.message);
    } finally {
      setFetchingData(false);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!selectedEstimate) return { subtotal: 0, discountAmount: 0, gstAmount: 0, total: 0 };
    
    const subtotal = parseFloat(selectedEstimate.total) || parseFloat(selectedEstimate.subtotal) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = (afterDiscount * gstPercent) / 100;
    const total = afterDiscount + gstAmount;
    
    return { subtotal, discountAmount, gstAmount, total };
  };

  const totals = calculateTotals();

  // Create invoice
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    if (!selectedEstimate) {
      setError('No estimate selected');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/create-from-estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estimateId: selectedEstimate.estimateId || selectedEstimate.estimate_id,
          customerDetails,
          discountPercent,
          gstPercent,
          dueDate: dueDate || undefined,
          notes
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast('Invoice created successfully!');
        setTimeout(() => {
          navigate(`${getBasePath()}/billing/generate-invoices`);
        }, 1500);
      } else {
        setError(result.message || 'Failed to create invoice');
      }
    } catch (err) {
      setError('Failed to create invoice: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[
        { num: 1, label: 'Enter Estimate ID' },
        { num: 2, label: 'Confirm Estimate' },
        { num: 3, label: 'Review & Create' }
      ].map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            step === s.num 
              ? 'bg-blue-600 text-white' 
              : step > s.num 
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
          }`}>
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
              {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
            </span>
            {s.label}
          </div>
          {i < 2 && <ChevronRight className="w-5 h-5 text-gray-300 mx-2" />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
        } text-white flex items-center gap-2`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`${getBasePath()}/billing/generate-invoices`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create invoice from approved estimates
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Step Indicator */}
        <StepIndicator />

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Enter Estimate ID */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Create New Invoice</h2>
            <p className="text-sm text-gray-500 mb-6">Create invoice from approved estimates</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estimate ID *</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={estimateId}
                    onChange={(e) => setEstimateId(e.target.value.toUpperCase())}
                    placeholder="Enter Estimate ID (e.g., EST-1783369179946)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={fetchEstimateData}
                    disabled={fetchingData || !estimateId}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {fetchingData ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Enter the Estimate ID to fetch estimate details and create invoice</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Confirm Estimate */}
        {step === 2 && selectedEstimate && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Confirm Estimate Details</h2>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Customer Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-900">Customer Details</h3>
                </div>
                <p className="text-sm font-medium text-gray-900">{selectedEstimate.customerName || '-'}</p>
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <Mail className="w-3.5 h-3.5" />
                  {selectedEstimate.customerEmail || '-'}
                </p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {selectedEstimate.customerPhone || '-'}
                </p>
              </div>

              {/* Property Info */}
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-semibold text-green-900">Property Details</h3>
                </div>
                <p className="text-sm font-medium text-gray-900">{selectedEstimate.propertyName || '-'}</p>
                <p className="text-sm text-gray-600">Property ID: {selectedEstimate.propertyCode || '-'}</p>
                <p className="text-sm text-gray-600">Type: {selectedEstimate.propertyType || '-'}</p>
              </div>
            </div>

            {/* Estimate Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Estimate ID</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedEstimate.estimateId || selectedEstimate.estimate_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(selectedEstimate.total || selectedEstimate.subtotal)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={() => { setStep(1); setSelectedEstimate(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue to Review
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Create */}
        {step === 3 && selectedEstimate && (
          <form onSubmit={handleCreateInvoice} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review & Create Invoice</h2>

            {/* Customer Details (editable) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerDetails.name}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Discount & GST */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
                <input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST (%)</label>
                <input
                  type="number"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (from Estimate):</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount ({discountPercent}%):</span>
                  <span className="font-medium text-red-600">-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST ({gstPercent}%):</span>
                <span className="font-medium">{formatCurrency(totals.gstAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
                <span>Total Amount:</span>
                <span className="text-blue-600">{formatCurrency(totals.total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Invoice
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateInvoice;
