import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  Calendar,
  Search,
  Eye,
  FileText,
  Mail,
  Link as LinkIcon,
  ChevronDown,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Service Categories
const SERVICE_CATEGORIES = [
  'Maintenance Services',
  'Deep Cleaning',
  'Pest Control',
  'Security Services',
  'Landscaping',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Other'
];

// Frequency options
const FREQUENCY_OPTIONS = [
  'One Time',
  'Monthly',
  'Every 2 Months',
  'Quarterly',
  'Half-Yearly',
  'Yearly'
];

// Payment Terms
const PAYMENT_TERMS = [
  { value: 'net_7', label: 'Net 7' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'due_on_receipt', label: 'Due on Receipt' },
];

// UOM options
const UOM_OPTIONS = ['Visit', 'Hour', 'Day', 'Month', 'Sq.Ft', 'Unit', 'KVA', 'Piece'];

// Indian States for Place of Supply
const INDIAN_STATES = [
  'Andhra Pradesh (37)', 'Arunachal Pradesh (12)', 'Assam (18)', 'Bihar (10)',
  'Chhattisgarh (22)', 'Goa (30)', 'Gujarat (24)', 'Haryana (06)', 'Himachal Pradesh (02)',
  'Jharkhand (20)', 'Karnataka (29)', 'Kerala (32)', 'Madhya Pradesh (23)', 'Maharashtra (27)',
  'Manipur (14)', 'Meghalaya (17)', 'Mizoram (15)', 'Nagaland (13)', 'Odisha (21)',
  'Punjab (03)', 'Rajasthan (08)', 'Sikkim (11)', 'Tamil Nadu (33)', 'Telangana (36)',
  'Tripura (16)', 'Uttar Pradesh (09)', 'Uttarakhand (05)', 'West Bengal (19)',
  'Delhi (07)', 'Jammu & Kashmir (01)', 'Ladakh (02)', 'Puducherry (34)',
  'Chandigarh (04)', 'Andaman & Nicobar (35)', 'Dadra & Nagar Haveli (26)',
  'Daman & Diu (25)', 'Lakshadweep (31)'
];

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

// Format date to display format (dd MMM yyyy)
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Get local date string
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate Invoice ID
const generateInvoiceId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `INV-${year}-${String(random).padStart(5, '0')}`;
};

const CreateInvoice = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  
  // Section 1: Invoice Details
  const [propertyId, setPropertyId] = useState('');
  const [propertyDetails, setPropertyDetails] = useState(null);
  const [propertySearching, setPropertySearching] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: '',
    contactPerson: ''
  });
  const [invoiceId] = useState(generateInvoiceId());
  const [invoiceDate, setInvoiceDate] = useState(getLocalDateString());
  const [dueDate, setDueDate] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [serviceCategory, setServiceCategory] = useState('Maintenance Services');
  const [frequency, setFrequency] = useState('Monthly');
  const [billingPeriod, setBillingPeriod] = useState({ start: '', end: '' });
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [currency] = useState('INR - Indian Rupee (₹)');
  const [placeOfSupply, setPlaceOfSupply] = useState('Telangana (36)');
  
  // Section 2: Items & Services
  const [lineItems, setLineItems] = useState([
    { id: 1, serviceName: '', description: '', uom: 'Visit', qty: 1, rate: 0, discount: 0, taxPercent: 18, amount: 0 }
  ]);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimates, setEstimates] = useState([]);
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  
  // Section 3: Additional Information
  const [customerNotes, setCustomerNotes] = useState('Thank you for your business.\nFor any queries, please contact our support team.');
  const [internalNotes, setInternalNotes] = useState('');
  
  // Section 4: Review & Send
  const [sendEmail, setSendEmail] = useState(true);
  const [emailRecipients, setEmailRecipients] = useState([]);
  const [generatePaymentLink, setGeneratePaymentLink] = useState(true);
  const [includeUpiQr, setIncludeUpiQr] = useState(false);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [currentSection, setCurrentSection] = useState(1);

  // Get base path for navigation
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
    setTimeout(() => setToast(null), 4000);
  };

  // Set default due date based on payment terms
  useEffect(() => {
    const termDays = {
      'net_7': 7, 'net_15': 15, 'net_30': 30, 'net_45': 45, 'net_60': 60, 'due_on_receipt': 0
    };
    const days = termDays[paymentTerms] || 30;
    const due = new Date();
    due.setDate(due.getDate() + days);
    setDueDate(due.toISOString().split('T')[0]);
  }, [paymentTerms, invoiceDate]);

  // Set billing period based on frequency
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    if (frequency === 'Quarterly') {
      end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    } else if (frequency === 'Half-Yearly') {
      end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    } else if (frequency === 'Yearly') {
      end = new Date(now.getFullYear(), now.getMonth() + 12, 0);
    }
    
    setBillingPeriod({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  }, [frequency]);

  // Search property by ID
  const searchProperty = async () => {
    if (!propertyId.trim()) {
      showToast('Please enter a Property ID', 'error');
      return;
    }
    
    setPropertySearching(true);
    try {
      const response = await fetch(`${API_BASE}/api/properties/search?code=${encodeURIComponent(propertyId)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success && data.data && data.data.length > 0) {
        const property = data.data[0];
        setPropertyDetails(property);
        setCustomerDetails({
          name: property.customerName || property.societyName || '',
          email: property.customerEmail || property.email || '',
          phone: property.customerPhone || property.phone || '',
          contactPerson: property.contactPerson || ''
        });
        setPlaceOfSupply(property.state ? `${property.state}` : 'Telangana (36)');
        showToast('Property found!');
      } else {
        showToast('Property not found', 'error');
        setPropertyDetails(null);
      }
    } catch (err) {
      console.error('Property search error:', err);
      showToast('Failed to search property', 'error');
    } finally {
      setPropertySearching(false);
    }
  };

  // Fetch work orders for property
  const fetchWorkOrders = async () => {
    if (!propertyDetails?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/work-orders?propertyId=${propertyDetails.id}&status=completed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setWorkOrders(data.data || []);
      }
    } catch (err) {
      console.error('Work orders fetch error:', err);
    }
  };

  // Fetch estimates for property
  const fetchEstimates = async () => {
    if (!propertyDetails?.id) {
      showToast('Please select a property first', 'error');
      return;
    }
    
    setEstimatesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/estimates?propertyId=${propertyDetails.id}&status=approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEstimates(data.data || []);
        setShowEstimateModal(true);
      }
    } catch (err) {
      console.error('Estimates fetch error:', err);
      showToast('Failed to fetch estimates', 'error');
    } finally {
      setEstimatesLoading(false);
    }
  };

  // Import items from estimate
  const importFromEstimate = (estimate) => {
    if (estimate.items && estimate.items.length > 0) {
      const importedItems = estimate.items.map((item, idx) => ({
        id: Date.now() + idx,
        serviceName: item.serviceName || item.name || '',
        description: item.description || '',
        uom: item.uom || item.unit || 'Visit',
        qty: parseFloat(item.qty || item.quantity || 1),
        rate: parseFloat(item.rate || item.unitPrice || item.price || 0),
        discount: parseFloat(item.discount || 0),
        taxPercent: parseFloat(item.taxPercent || item.gstPercent || 18),
        amount: 0
      }));
      
      // Calculate amounts
      importedItems.forEach(item => {
        const subtotal = item.qty * item.rate;
        const afterDiscount = subtotal - item.discount;
        item.amount = afterDiscount + (afterDiscount * item.taxPercent / 100);
      });
      
      setLineItems(importedItems);
      setShowEstimateModal(false);
      showToast(`Imported ${importedItems.length} items from estimate`);
    }
  };

  // Line item management
  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: Date.now(),
      serviceName: '',
      description: '',
      uom: 'Visit',
      qty: 1,
      rate: 0,
      discount: 0,
      taxPercent: 18,
      amount: 0
    }]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id, field, value) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate amount
        const subtotal = updated.qty * updated.rate;
        const afterDiscount = subtotal - updated.discount;
        updated.amount = afterDiscount + (afterDiscount * updated.taxPercent / 100);
        return updated;
      }
      return item;
    }));
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.qty * item.rate), 0);
    const totalDiscount = lineItems.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
    const afterDiscount = subtotal - totalDiscount;
    const totalTax = lineItems.reduce((sum, item) => {
      const itemSubtotal = item.qty * item.rate - item.discount;
      return sum + (itemSubtotal * item.taxPercent / 100);
    }, 0);
    const grandTotal = afterDiscount + totalTax;
    
    return { subtotal, totalDiscount, afterDiscount, totalTax, grandTotal };
  };

  const totals = calculateTotals();

  // Create invoice
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!customerDetails.name || !customerDetails.email) {
      setError('Customer name and email are required');
      setCurrentSection(1);
      return;
    }
    
    if (lineItems.length === 0 || !lineItems.some(item => item.serviceName && item.rate > 0)) {
      setError('At least one service item with rate is required');
      setCurrentSection(2);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const invoiceData = {
        // Invoice details
        invoiceId,
        propertyId: propertyDetails?.id || null,
        propertyCode: propertyDetails?.propertyCode || propertyId,
        propertyName: propertyDetails?.propertyName || propertyDetails?.societyName || '',
        propertyType: propertyDetails?.propertyType || '',
        workOrderId: workOrderId || null,
        
        // Customer details
        customerDetails,
        customerName: customerDetails.name,
        customerEmail: customerDetails.email,
        customerPhone: customerDetails.phone,
        
        // Dates
        invoiceDate,
        dueDate,
        
        // Settings
        serviceCategory,
        frequency,
        billingPeriod,
        paymentTerms,
        placeOfSupply,
        
        // Line items
        lineItems: lineItems
          .filter(item => item.serviceName && item.rate > 0)
          .map(item => ({
            name: item.serviceName,
            description: item.description,
            uom: item.uom,
            quantity: item.qty,
            unitPrice: item.rate,
            discount: item.discount,
            taxPercent: item.taxPercent,
            amount: item.amount
          })),
        
        // Totals
        subtotal: totals.subtotal,
        discountAmount: totals.totalDiscount,
        taxAmount: totals.totalTax,
        totalAmount: totals.grandTotal,
        
        // Notes
        customerNotes,
        internalNotes,
        
        // Send options
        sendEmail,
        emailRecipients: [customerDetails.email, ...emailRecipients],
        generatePaymentLink,
        includeUpiQr
      };

      const response = await fetch(`${API_BASE}/api/payments/invoices/create-generic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(invoiceData)
      });

      const result = await response.json();
      
      if (result.success) {
        showToast(`Invoice ${invoiceId} created successfully!`);
        setTimeout(() => {
          navigate(`${getBasePath()}/billing/invoices`);
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

  // Section Header Component
  const SectionHeader = ({ number, title }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
        {number}
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
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
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`${getBasePath()}/billing/invoices`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Create New Invoice</h1>
              <p className="text-sm text-gray-500">Fill in the details to generate an invoice</p>
            </div>
          </div>
          <button
            onClick={handleCreateInvoice}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 font-medium"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Create Invoice
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              &times;
            </button>
          </div>
        )}

        <form onSubmit={handleCreateInvoice} className="space-y-6">
          {/* Section 1: Invoice Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionHeader number={1} title="Invoice Details" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Property ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Property ID *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value.toUpperCase())}
                    placeholder="APT-000125"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={searchProperty}
                    disabled={propertySearching}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-1.5"
                  >
                    {propertySearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </div>
                {propertyDetails && (
                  <p className="text-xs text-green-600 mt-1">{propertyDetails.propertyName || propertyDetails.societyName}</p>
                )}
              </div>

              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Customer / Association Name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  />
                  {customerDetails.name && (
                    <button
                      type="button"
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                      title="View Customer Details"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
                {customerDetails.contactPerson && (
                  <p className="text-xs text-gray-500 mt-1">{customerDetails.contactPerson}</p>
                )}
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Date *</label>
                <div className="relative">
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              {/* Invoice ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice ID</label>
                <input
                  type="text"
                  value={invoiceId}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1">Auto Generated</p>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={invoiceDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* PO / Work Order ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">PO / Work Order ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workOrderId}
                    onChange={(e) => setWorkOrderId(e.target.value)}
                    placeholder="WO-2026-001254"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      fetchWorkOrders();
                      setShowWorkOrderModal(true);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Select
                  </button>
                </div>
              </div>

              {/* Service Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Category *</label>
                <select
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  {SERVICE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  {FREQUENCY_OPTIONS.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>

              {/* Billing Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Period</label>
                <input
                  type="text"
                  value={billingPeriod.start && billingPeriod.end ? 
                    `${formatDateDisplay(billingPeriod.start)} - ${formatDateDisplay(billingPeriod.end)}` : ''}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600"
                />
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Terms</label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  {PAYMENT_TERMS.map(term => (
                    <option key={term.value} value={term.value}>{term.label}</option>
                  ))}
                </select>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                <input
                  type="text"
                  value={currency}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-600"
                />
              </div>

              {/* Place of Supply */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Place of Supply</label>
                <select
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                >
                  {INDIAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Items & Services */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <SectionHeader number={2} title="Items & Services" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchEstimates}
                  disabled={estimatesLoading}
                  className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add from Estimate
                </button>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-8">#</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-2">Service / Item</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-2">Description</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-20">UOM</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-16">Qty</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-24">Rate (₹)</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-24">Discount (₹)</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-16">Tax %</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-28">Amount (₹)</th>
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase py-3 px-2 w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm text-gray-500">{index + 1}</td>
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          value={item.serviceName}
                          onChange={(e) => updateLineItem(item.id, 'serviceName', e.target.value)}
                          placeholder="Service name"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <select
                          value={item.uom}
                          onChange={(e) => updateLineItem(item.id, 'uom', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:ring-1 focus:ring-blue-500"
                        >
                          {UOM_OPTIONS.map(uom => (
                            <option key={uom} value={uom}>{uom}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateLineItem(item.id, 'qty', parseFloat(e.target.value) || 0)}
                          min="1"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.rate || ''}
                          onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.discount || ''}
                          onChange={(e) => updateLineItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          value={item.taxPercent}
                          onChange={(e) => updateLineItem(item.id, 'taxPercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-2 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            disabled={lineItems.length === 1}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
              <div className="text-right">
                <span className="text-sm text-gray-600 mr-4">Total (Before Discount)</span>
                <span className="text-xl font-bold text-gray-900">₹{formatCurrency(totals.subtotal)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Additional Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionHeader number={3} title="Additional Information" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes to Customer (Print on Invoice)
                </label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value.slice(0, 500))}
                  rows={4}
                  maxLength={500}
                  placeholder="Thank you for your business..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{customerNotes.length}/500</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Internal Notes (Not on Invoice)
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value.slice(0, 500))}
                  rows={4}
                  maxLength={500}
                  placeholder="Internal notes for reference..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{internalNotes.length}/500</p>
              </div>
            </div>
          </div>

          {/* Section 4: Review & Send */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionHeader number={4} title="Review & Send" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Invoice Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Invoice Preview</h4>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="aspect-[3/4] bg-white rounded border border-gray-200 flex items-center justify-center mb-3">
                    <div className="text-center p-4">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">Invoice Preview</p>
                      <p className="text-sm font-semibold text-gray-700 mt-1">{invoiceId}</p>
                      <p className="text-lg font-bold text-gray-900 mt-2">₹{formatCurrency(totals.grandTotal)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full py-2 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center justify-center gap-1"
                  >
                    Preview Full Invoice <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Send Invoice To */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Send Invoice To</h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Email</span>
                      </div>
                      <input
                        type="email"
                        value={customerDetails.email}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="customer@email.com"
                        className="w-full mt-2 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                      >
                        + Add Recipient
                      </button>
                    </div>
                  </label>
                </div>
              </div>

              {/* Payment Link */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Payment Link</h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generatePaymentLink}
                      onChange={(e) => setGeneratePaymentLink(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Generate Payment Link (Razorpay)</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Payment link will be sent to customer via email</p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUpiQr}
                      onChange={(e) => setIncludeUpiQr(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Include UPI QR Code in Invoice</span>
                      <p className="text-xs text-gray-500 mt-1">QR code will be shown on the invoice</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">₹{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Discount</span>
                      <span className="text-green-600">-₹{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax (GST)</span>
                    <span className="text-gray-900">₹{formatCurrency(totals.totalTax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                    <span className="text-gray-900">Grand Total</span>
                    <span className="text-blue-600">₹{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Estimate Selection Modal */}
      {showEstimateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Select Estimate</h3>
              <button onClick={() => setShowEstimateModal(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {estimates.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No approved estimates found for this property</p>
              ) : (
                <div className="space-y-3">
                  {estimates.map(estimate => (
                    <div
                      key={estimate.id}
                      onClick={() => importFromEstimate(estimate)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{estimate.estimateId}</span>
                        <span className="text-blue-600 font-semibold">₹{formatCurrency(estimate.totalAmount)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{estimate.items?.length || 0} items</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Work Order Selection Modal */}
      {showWorkOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Select Work Order</h3>
              <button onClick={() => setShowWorkOrderModal(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {workOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No completed work orders found</p>
              ) : (
                <div className="space-y-3">
                  {workOrders.map(wo => (
                    <div
                      key={wo.id}
                      onClick={() => {
                        setWorkOrderId(wo.workOrderId || wo.id);
                        setShowWorkOrderModal(false);
                      }}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">{wo.workOrderId || wo.id}</span>
                        <span className="text-sm text-gray-500">{formatDateDisplay(wo.completedAt || wo.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{wo.serviceCategory || wo.category}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateInvoice;
