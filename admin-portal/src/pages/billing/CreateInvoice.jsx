import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  Calendar,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Frequency types for invoice line items
const FREQUENCY_TYPES = ['Monthly', 'Every 2 Months', 'Quarterly', 'Half-Yearly', 'Yearly', 'Other'];

// Auto-calculate visits based on frequency
const FREQUENCY_VISITS_MAP = {
  'Monthly': 12,
  'Every 2 Months': 6,
  'Quarterly': 4,
  'Half-Yearly': 2,
  'Yearly': 1,
  'Other': null  // Custom - user enters manually
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

// Format date to IST (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date)) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse IST date (dd/mm/yyyy) to yyyy-mm-dd
const parseISTDate = (displayStr) => {
  if (!displayStr || displayStr.length < 10) return null;
  const parts = displayStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle IST date input with auto-formatting
const handleISTDateInput = (value) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  return cleaned;
};

const CreateInvoice = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  
  // Line items with service, description, frequency, visits, price
  const [lineItems, setLineItems] = useState([
    { serviceName: '', description: '', frequency: 'Monthly', visits: 12, price: 0, totalPrice: 0 }
  ]);
  
  // Customer details
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  // Use local date (not UTC) for correct timezone handling
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [invoiceDate, setInvoiceDate] = useState(getLocalDateString());
  const [invoiceDateDisplay, setInvoiceDateDisplay] = useState(formatDateIST(getLocalDateString()));
  const [dueDate, setDueDate] = useState('');
  const [dueDateDisplay, setDueDateDisplay] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
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

  // Set default due date (14 days from today) on mount
  useEffect(() => {
    if (!dueDate) {
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 14);
      const year = defaultDueDate.getFullYear();
      const month = String(defaultDueDate.getMonth() + 1).padStart(2, '0');
      const day = String(defaultDueDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      setDueDate(dateStr);
      setDueDateDisplay(formatDateIST(dateStr));
    }
  }, []);

  // Line items management
  const addLineItem = () => {
    setLineItems([...lineItems, { serviceName: '', description: '', frequency: 'Monthly', visits: 12, price: 0, totalPrice: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    
    // Auto-calculate visits based on frequency
    if (field === 'frequency') {
      const autoVisits = FREQUENCY_VISITS_MAP[value];
      if (autoVisits !== null) {
        updated[index].visits = autoVisits;
      }
    }
    
    // Auto-calculate total price (visits × price)
    if (field === 'visits' || field === 'price' || field === 'frequency') {
      const visits = parseFloat(updated[index].visits) || 0;
      const price = parseFloat(updated[index].price) || 0;
      updated[index].totalPrice = visits * price;
    }
    
    setLineItems(updated);
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.totalPrice) || 0), 0);
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
    
    // Validate required fields
    if (!customerDetails.name || !customerDetails.email) {
      setError('Customer name and email are required');
      return;
    }
    
    if (lineItems.length === 0 || !lineItems.some(item => item.serviceName && item.totalPrice > 0)) {
      setError('At least one service with price is required');
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
          lineItems: lineItems
            .filter(item => item.serviceName && item.totalPrice > 0)
            .map(item => ({
              name: item.serviceName,
              description: item.description || item.serviceName,
              frequency: item.frequency,
              frequencyType: item.frequency,
              visits: item.visits,
              frequencyCount: item.visits,
              price: item.price,
              unitPrice: item.price,
              amount: item.totalPrice,
              totalPrice: item.totalPrice
            })),
          discountPercent,
          gstPercent,
          invoiceDate: invoiceDate || getLocalDateString(),
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
              Create a manual invoice for any service
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleCreateInvoice} className="space-y-6">
          {/* Customer Details Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={customerDetails.name}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter customer name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={customerDetails.email}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="customer@email.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Invoice will be automatically sent to this email</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={customerDetails.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setCustomerDetails(prev => ({ ...prev, phone: value }));
                  }}
                  placeholder="Enter 10-digit phone number"
                  maxLength={10}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={customerDetails.address}
                  onChange={(e) => setCustomerDetails(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address (optional)"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Invoice Items</h2>
              <button
                type="button"
                onClick={addLineItem}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-gray-500 uppercase">
                <div className="col-span-2">Service</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2">Frequency</div>
                <div className="col-span-1 text-center">Visits</div>
                <div className="col-span-2 text-right">Price (₹)</div>
                <div className="col-span-1 text-right">Total (₹)</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {/* Line Items */}
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-3">
                  {/* Service Name */}
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={item.serviceName}
                      onChange={(e) => updateLineItem(index, 'serviceName', e.target.value)}
                      placeholder="e.g., Deep Cleaning"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  {/* Description */}
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Service description..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  {/* Frequency */}
                  <div className="col-span-2">
                    <select
                      value={item.frequency}
                      onChange={(e) => updateLineItem(index, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    >
                      {FREQUENCY_TYPES.map(freq => (
                        <option key={freq} value={freq}>{freq}</option>
                      ))}
                    </select>
                  </div>
                  {/* Visits */}
                  <div className="col-span-1">
                    <input
                      type="number"
                      value={item.visits}
                      onChange={(e) => updateLineItem(index, 'visits', parseInt(e.target.value) || 0)}
                      readOnly={item.frequency !== 'Other'}
                      min="1"
                      className={`w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-center ${item.frequency !== 'Other' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  {/* Price */}
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.price || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        updateLineItem(index, 'price', val ? parseInt(val, 10) : '');
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-right"
                    />
                  </div>
                  {/* Total */}
                  <div className="col-span-1 text-right font-medium text-gray-900 text-sm">
                    {formatCurrency(item.totalPrice)}
                  </div>
                  {/* Action */}
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
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
          </div>

          {/* Pricing & Notes Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Details</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={invoiceDateDisplay}
                    onChange={(e) => {
                      const formatted = handleISTDateInput(e.target.value);
                      setInvoiceDateDisplay(formatted);
                      const parsed = parseISTDate(formatted);
                      if (parsed) setInvoiceDate(parsed);
                    }}
                    onBlur={() => {
                      const parsed = parseISTDate(invoiceDateDisplay);
                      if (parsed) setInvoiceDate(parsed);
                      else if (invoiceDateDisplay && invoiceDateDisplay.length < 10) setInvoiceDateDisplay(formatDateIST(invoiceDate));
                    }}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setInvoiceDate(e.target.value);
                          setInvoiceDateDisplay(formatDateIST(e.target.value));
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="dd/mm/yyyy"
                    value={dueDateDisplay}
                    onChange={(e) => {
                      const formatted = handleISTDateInput(e.target.value);
                      setDueDateDisplay(formatted);
                      const parsed = parseISTDate(formatted);
                      if (parsed) setDueDate(parsed);
                    }}
                    onBlur={() => {
                      const parsed = parseISTDate(dueDateDisplay);
                      if (parsed) setDueDate(parsed);
                      else if (dueDateDisplay && dueDateDisplay.length < 10) setDueDateDisplay(formatDateIST(dueDate));
                    }}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                    <input
                      type="date"
                      value={dueDate}
                      min={invoiceDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDueDate(e.target.value);
                          setDueDateDisplay(formatDateIST(e.target.value));
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                <input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GST (%)</label>
                <input
                  type="number"
                  value={gstPercent}
                  onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes (optional)..."
              />
            </div>

            {/* Totals */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Discount ({discountPercent}%)</span>
                  <span className="font-medium text-green-600">-{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">GST ({gstPercent}%)</span>
                <span className="font-medium text-gray-900">{formatCurrency(totals.gstAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
                <span className="text-gray-900">Grand Total</span>
                <span className="text-gray-900">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 font-medium"
            >
              {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateInvoice;
