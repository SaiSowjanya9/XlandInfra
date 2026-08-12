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
  Trash2,
  Receipt,
  ClipboardList,
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
  
  // Invoice type selection: 'estimate' or 'generic'
  const [invoiceType, setInvoiceType] = useState(null);
  
  // Estimate-based invoice states
  const [estimateId, setEstimateId] = useState('');
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [step, setStep] = useState(1); // 1: Enter Estimate ID, 2: Confirm Estimate, 3: Review & Create
  
  // Generic invoice states
  const [genericStep, setGenericStep] = useState(1); // 1: Customer Details, 2: Line Items, 3: Review & Create
  const [lineItems, setLineItems] = useState([
    { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }
  ]);
  
  // Common states
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState('');
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

  // Set default due date (14 days from today) when invoice type is selected
  useEffect(() => {
    if (invoiceType && !dueDate) {
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 14);
      setDueDate(defaultDueDate.toISOString().split('T')[0]);
    }
  }, [invoiceType]);

  // Line items management for generic invoice
  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    
    // Auto-calculate total price
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = parseFloat(updated[index].quantity) || 0;
      const price = parseFloat(updated[index].unitPrice) || 0;
      updated[index].totalPrice = qty * price;
    }
    
    setLineItems(updated);
  };

  // Calculate totals for generic invoice
  const calculateGenericTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
    const discountAmount = (subtotal * discountPercent) / 100;
    const afterDiscount = subtotal - discountAmount;
    const gstAmount = (afterDiscount * gstPercent) / 100;
    const total = afterDiscount + gstAmount;
    
    return { subtotal, discountAmount, gstAmount, total };
  };

  const genericTotals = calculateGenericTotals();

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
          phone: estResult.data.customerPhone || '',
          address: estResult.data.address || ''
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

  // Create generic invoice
  const handleCreateGenericInvoice = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!customerDetails.name || !customerDetails.email) {
      setError('Customer name and email are required');
      return;
    }
    
    if (lineItems.length === 0 || !lineItems.some(item => item.description && item.totalPrice > 0)) {
      setError('At least one valid line item is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/create-generic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          customerDetails,
          lineItems: lineItems.filter(item => item.description && item.totalPrice > 0),
          discountPercent,
          gstPercent,
          dueDate: dueDate || undefined,
          notes,
          sendEmail: true // Auto-send email to customer
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showToast(`Invoice created and sent to ${customerDetails.email}!`);
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

  // Reset form and go back to type selection
  const resetToTypeSelection = () => {
    setInvoiceType(null);
    setStep(1);
    setGenericStep(1);
    setEstimateId('');
    setSelectedEstimate(null);
    setCustomerDetails({ name: '', email: '', phone: '', address: '' });
    setLineItems([{ description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
    setDiscountPercent(0);
    setGstPercent(18);
    setDueDate('');
    setNotes('');
    setError('');
  };

  // Step indicator for estimate-based invoice
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
            onClick={() => invoiceType ? resetToTypeSelection() : navigate(`${getBasePath()}/billing/generate-invoices`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {!invoiceType ? 'Choose invoice type to get started' : 
               invoiceType === 'estimate' ? 'Create invoice from approved estimates' : 
               'Create a generic invoice for any service'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Invoice Type Selection */}
        {!invoiceType && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 text-center mb-6">Select Invoice Type</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Estimate-based Invoice */}
              <button
                onClick={() => setInvoiceType('estimate')}
                className="bg-white rounded-xl border-2 border-gray-200 p-8 shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left group"
              >
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors">
                  <ClipboardList className="w-7 h-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">From Approved Estimate</h3>
                <p className="text-sm text-gray-500">
                  Create an invoice from an existing approved estimate. Customer and service details will be auto-filled.
                </p>
              </button>

              {/* Generic Invoice */}
              <button
                onClick={() => setInvoiceType('generic')}
                className="bg-white rounded-xl border-2 border-gray-200 p-8 shadow-sm hover:border-green-500 hover:shadow-md transition-all text-left group"
              >
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-500 transition-colors">
                  <Receipt className="w-7 h-7 text-green-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Generic Invoice</h3>
                <p className="text-sm text-gray-500">
                  Create a manual invoice for any service. Enter customer details and line items manually. Invoice will be emailed automatically.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Estimate-based Invoice Flow */}
        {invoiceType === 'estimate' && (
          <>
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
          </>
        )}

        {/* Generic Invoice Flow */}
        {invoiceType === 'generic' && (
          <>
            {/* Step Indicator for Generic Invoice */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[
                { num: 1, label: 'Customer Details' },
                { num: 2, label: 'Line Items' },
                { num: 3, label: 'Review & Create' }
              ].map((s, i) => (
                <div key={s.num} className="flex items-center">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    genericStep === s.num 
                      ? 'bg-green-600 text-white' 
                      : genericStep > s.num 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
                      {genericStep > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
                    </span>
                    {s.label}
                  </div>
                  {i < 2 && <ChevronRight className="w-5 h-5 text-gray-300 mx-2" />}
                </div>
              ))}
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Step 1: Customer Details */}
            {genericStep === 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Customer Details</h2>
                <p className="text-sm text-gray-500 mb-6">Enter the customer information for this invoice</p>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name *</label>
                      <input
                        type="text"
                        value={customerDetails.name}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter customer name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                      <input
                        type="email"
                        value={customerDetails.email}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="customer@email.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Invoice will be automatically sent to this email</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        value={customerDetails.phone}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter phone number"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                      <input
                        type="text"
                        value={customerDetails.address}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter address (optional)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => {
                      if (!customerDetails.name || !customerDetails.email) {
                        setError('Customer name and email are required');
                        return;
                      }
                      setError('');
                      setGenericStep(2);
                    }}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Continue to Line Items
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Line Items */}
            {genericStep === 2 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Invoice Line Items</h2>
                    <p className="text-sm text-gray-500">Add the services or products to be invoiced</p>
                  </div>
                  <button
                    onClick={addLineItem}
                    className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex items-center gap-2 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                    <div className="col-span-5">Description</div>
                    <div className="col-span-2 text-center">Quantity</div>
                    <div className="col-span-2 text-right">Unit Price (₹)</div>
                    <div className="col-span-2 text-right">Total (₹)</div>
                    <div className="col-span-1"></div>
                  </div>

                  {/* Line Items */}
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-center bg-gray-50 rounded-lg p-3">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Service or product description"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm text-right"
                        />
                      </div>
                      <div className="col-span-2 text-right font-medium text-gray-900">
                        {formatCurrency(item.totalPrice)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal Preview */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Subtotal:</span>
                    <span className="text-green-700">{formatCurrency(genericTotals.subtotal)}</span>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setGenericStep(1)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!lineItems.some(item => item.description && item.totalPrice > 0)) {
                        setError('At least one valid line item is required');
                        return;
                      }
                      setError('');
                      setGenericStep(3);
                    }}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Continue to Review
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Create */}
            {genericStep === 3 && (
              <form onSubmit={handleCreateGenericInvoice} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                <h2 className="text-lg font-semibold text-gray-900">Review & Create Invoice</h2>

                {/* Customer Summary */}
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-green-600" />
                    <h3 className="text-sm font-semibold text-green-900">Customer Details</h3>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{customerDetails.name}</p>
                  <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                    <Mail className="w-3.5 h-3.5" />
                    {customerDetails.email}
                  </p>
                  {customerDetails.phone && (
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {customerDetails.phone}
                    </p>
                  )}
                </div>

                {/* Line Items Summary */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice Items</h3>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                          <th className="text-center px-4 py-2 font-medium text-gray-600">Qty</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Unit Price</th>
                          <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.filter(item => item.description && item.totalPrice > 0).map((item, index) => (
                          <tr key={index} className="border-t border-gray-200">
                            <td className="px-4 py-3">{item.description}</td>
                            <td className="px-4 py-3 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Additional notes..."
                  />
                </div>

                {/* Totals */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(genericTotals.subtotal)}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount ({discountPercent}%):</span>
                      <span className="font-medium text-red-600">-{formatCurrency(genericTotals.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST ({gstPercent}%):</span>
                    <span className="font-medium">{formatCurrency(genericTotals.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
                    <span>Total Amount:</span>
                    <span className="text-green-600">{formatCurrency(genericTotals.total)}</span>
                  </div>
                </div>

                {/* Email Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Invoice will be emailed automatically</p>
                    <p className="text-sm text-blue-700">
                      After creating this invoice, it will be automatically sent to <strong>{customerDetails.email}</strong>. 
                      You can then generate a payment link from the Payment Links section.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setGenericStep(2)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create & Send Invoice
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreateInvoice;
