import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Plus,
  Eye,
  Edit,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  FileText,
  Receipt,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Printer,
  Building2,
  User,
  Mail,
  Phone,
  IndianRupee,
  Briefcase,
  Trash2,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Tab configuration
const TABS = [
  { id: 'generated', label: 'Generated Invoices', icon: FileText, description: 'Auto-generated from approved estimates' },
  { id: 'work_order', label: 'Work Order Invoices', icon: Briefcase, description: 'Invoices from work order submissions' }
];

// Status config
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  partially_paid: { label: 'Partially Paid', color: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' }
};

// Helper to decode HTML entities (fix triple/double encoded ampersands etc.)
const decodeHtmlEntities = (str) => {
  if (!str) return str;
  return String(str)
    .replace(/&amp;amp;amp;/g, '&')
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
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

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Create Invoice Form Component
const CreateInvoiceForm = ({ onSuccess, onCancel, token }) => {
  const [estimateId, setEstimateId] = useState('');
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [approvedEstimates, setApprovedEstimates] = useState([]);
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [gstPercent, setGstPercent] = useState(18);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Enter Estimate ID, 2: Select Estimate, 3: Review & Create

  // Fetch estimate details when Estimate ID is entered
  const fetchEstimateData = async () => {
    if (!estimateId || estimateId.length < 3) return;
    
    setFetchingData(true);
    setError('');
    setApprovedEstimates([]);
    setSelectedEstimate(null);
    
    try {
      // Fetch estimate by ID
      const estResponse = await fetch(`${API_BASE}/api/payments/estimates/by-id/${estimateId}?status=approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const estResult = await estResponse.json();
      
      if (estResult.success && estResult.data) {
        const estimate = estResult.data;
        // Set customer details from estimate
        setCustomerDetails({
          name: estimate.customer_name || estimate.client_name || '',
          email: estimate.customer_email || estimate.client_email || '',
          phone: estimate.customer_phone || estimate.client_phone || ''
        });
        setApprovedEstimates([estimate]);
        setStep(2);
      } else {
        setError(estResult.message || 'No approved estimate found with this ID. Either the estimate is not approved, or an invoice has already been generated.');
      }
    } catch (err) {
      console.log('Fetch failed:', err);
      setError('Failed to fetch estimate data');
    } finally {
      setFetchingData(false);
    }
  };

  // Calculate totals based on selected estimate
  const calculateTotals = () => {
    if (!selectedEstimate) return { subtotal: 0, discountAmount: 0, gstAmount: 0, total: 0 };
    
    const subtotal = parseFloat(selectedEstimate.total) || parseFloat(selectedEstimate.subtotal) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const taxableAmount = subtotal - discountAmount;
    const gstAmount = taxableAmount * (gstPercent / 100);
    const total = taxableAmount + gstAmount;
    
    return { subtotal, discountAmount, gstAmount, total };
  };

  const handleSelectEstimate = (estimate) => {
    setSelectedEstimate(estimate);
    setStep(3);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEstimate) {
      setError('Please select an estimate');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const totals = calculateTotals();
      const response = await fetch(`${API_BASE}/api/payments/invoices/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          propertyId: selectedEstimate.property_id || selectedEstimate.property_code,
          estimateId: selectedEstimate.estimate_id || selectedEstimate.id,
          customerName: customerDetails.name,
          customerEmail: customerDetails.email,
          customerPhone: customerDetails.phone,
          invoiceType: 'estimate',
          lineItems: selectedEstimate.line_items || selectedEstimate.items || [],
          subtotal: totals.subtotal,
          discountPercent: discountPercent,
          discountAmount: totals.discountAmount,
          taxPercent: gstPercent,
          taxAmount: totals.gstAmount,
          totalAmount: totals.total,
          balanceAmount: totals.total,
          dueDate: dueDate,
          notes: notes
        })
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(result.data);
      } else {
        setError(result.message || 'Failed to create invoice');
      }
    } catch (err) {
      setError('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Create New Invoice</h2>
      <p className="text-sm text-gray-500 mb-6">Create invoice from approved estimates</p>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${step >= 1 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white rounded-full text-xs">1</span>
          Enter Estimate ID
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${step >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
          Confirm Estimate
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${step >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</span>
          Review & Create
        </div>
      </div>

      {/* Step 1: Enter Estimate ID */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estimate ID *
              {fetchingData && <span className="ml-2 text-blue-500 text-xs animate-pulse">(Loading...)</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={estimateId}
                onChange={(e) => setEstimateId(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Estimate ID (e.g., EST-1783369179946)"
              />
              <button
                type="button"
                onClick={fetchEstimateData}
                disabled={fetchingData || !estimateId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {fetchingData ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter the Estimate ID to fetch estimate details and create invoice</p>
          </div>
        </div>
      )}

      {/* Step 2: Select Estimate */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Customer Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Customer Details</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Name:</span>
                <span className="ml-2 text-gray-800">{customerDetails.name || '-'}</span>
              </div>
              <div>
                <span className="text-blue-600">Email:</span>
                <span className="ml-2 text-gray-800">{customerDetails.email || '-'}</span>
              </div>
              <div>
                <span className="text-blue-600">Phone:</span>
                <span className="ml-2 text-gray-800">{customerDetails.phone || '-'}</span>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-700">Select Approved Estimate ({approvedEstimates.length} found)</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {approvedEstimates.map((estimate) => (
              <div
                key={estimate.id || estimate.estimate_id}
                onClick={() => handleSelectEstimate(estimate)}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-blue-600">{estimate.estimate_id}</span>
                    <span className="ml-3 text-sm text-gray-600">{estimate.property_name || estimate.service_type}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(estimate.total || estimate.subtotal)}</span>
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Approved</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Created: {formatDate(estimate.created_at)} | Service: {estimate.service_type || 'General'}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to Property Search
          </button>
        </div>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && selectedEstimate && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selected Estimate Info */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-green-800">Selected Estimate</h3>
                <p className="text-lg font-semibold text-green-700">{selectedEstimate.estimate_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-green-600 hover:text-green-800"
              >
                Change
              </button>
            </div>
          </div>

          {/* Customer Details (Editable) */}
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
              ← Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Invoice
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// Invoice List Component
const InvoiceList = ({ invoices, loading, type, onRefresh, onView, onDownload, onSend, completedWorkOrders = [], loadingWorkOrders = false, onWorkOrderClick, getBasePath }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !searchTerm || 
      inv.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = type === 'generated' 
      ? inv.invoiceType === 'estimate' 
      : inv.invoiceType === 'work_order';
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Format date/time for work orders
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Search & Actions */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Invoice ID, Customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={onRefresh}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* For Work Order tab: Always show pending work orders section first, then invoices */}
      {type === 'work_order' ? (
        <div className="space-y-6">
          {/* Section 1: Pending Estimate Creation - Completed work orders without estimates */}
          {completedWorkOrders.length > 0 && (
            <div className="border border-orange-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-orange-50 border-b border-orange-200">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-800">Pending Estimate Creation</h3>
                  <p className="text-sm text-orange-600">Completed work orders waiting for estimate - Click to create</p>
                </div>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  {completedWorkOrders.length}
                </span>
              </div>
              {loadingWorkOrders ? (
                <div className="flex items-center justify-center h-32 bg-white">
                  <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto bg-white">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Order ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {completedWorkOrders.map(wo => (
                        <tr 
                          key={wo.id} 
                          className="hover:bg-orange-50 cursor-pointer transition-colors"
                          onClick={() => onWorkOrderClick && onWorkOrderClick(wo)}
                        >
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-medium text-orange-600 font-mono">{wo.work_order_id}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{wo.customer_name || '-'}</p>
                              <p className="text-xs text-gray-500">{wo.community_name || wo.property_name || '-'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{wo.category_name || '-'}</p>
                              <p className="text-xs text-gray-500">{wo.subcategory_name || '-'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              completed
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                            {formatDateTime(wo.created_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{wo.customer_name || wo.community_name || '-'}</p>
                              <p className="text-xs text-gray-500">{wo.property_code || wo.property_id || '-'}</p>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Generated Invoices from Work Orders */}
          <div className="border border-green-200 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-green-50 border-b border-green-200">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-green-800">Generated Invoices</h3>
                <p className="text-sm text-green-600">Invoices created from approved work order estimates</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {paginatedInvoices.length}
              </span>
            </div>
            {paginatedInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 bg-white">
                <FileText className="w-8 h-8 mb-2" />
                <p className="text-sm">No work order invoices yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedInvoices.map(invoice => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => onView(invoice)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {invoice.invoiceId}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-800">{invoice.customerName || '-'}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">{invoice.propertyCode || '-'}</td>
                        <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(invoice.invoiceDate)}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(invoice.totalAmount)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[invoice.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_CONFIG[invoice.status]?.label || invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => onView(invoice)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDownload(invoice)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Download">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => onSend(invoice)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Send">
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Show message if both sections are empty */}
          {completedWorkOrders.length === 0 && paginatedInvoices.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Briefcase className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">No work order activity</p>
              <p className="text-sm">Complete work orders will appear here for estimate creation</p>
            </div>
          )}
        </div>
      ) : paginatedInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileText className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium">No invoices found</p>
          <p className="text-sm">Invoices will appear here when estimates are approved</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedInvoices.map(invoice => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => onView(invoice)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        {invoice.invoiceId}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-800">{invoice.customerName || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{invoice.propertyCode || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">{formatDate(invoice.invoiceDate)}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(invoice.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[invoice.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_CONFIG[invoice.status]?.label || invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        {/* View */}
                        <button
                          onClick={() => onView(invoice)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Download */}
                        <button
                          onClick={() => onDownload(invoice)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {/* Delete/Archive */}
                        <button
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
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

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const GeneratedInvoices = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('generated');
  const [invoices, setInvoices] = useState([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const token = getAuthToken();
  
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
  
  // Format helpers
  const formatCurrency = (amount) => `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices?archived=false`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCompletedWorkOrders = useCallback(async () => {
    setLoadingWorkOrders(true);
    try {
      // Fetch completed work orders that don't have estimates yet
      const response = await fetch(`${API_BASE}/api/fp/work-orders?status=completed&excludeWithEstimates=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setCompletedWorkOrders(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching completed work orders:', err);
    } finally {
      setLoadingWorkOrders(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (activeTab === 'work_order') {
      fetchCompletedWorkOrders();
    }
  }, [activeTab, fetchCompletedWorkOrders]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDownload = async (invoice) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoice.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${invoice.invoiceId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Invoice downloaded');
      }
    } catch (err) {
      showToast('Failed to download', 'error');
    }
  };

  const handleSend = async (invoice) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Invoice sent successfully');
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to send', 'error');
      }
    } catch (err) {
      showToast('Failed to send invoice', 'error');
    }
  };

  const handleView = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailPanel(true);
  };

  const handleCreateSuccess = (data) => {
    showToast('Invoice created successfully!');
    setActiveTab('generated');
    fetchInvoices();
  };

  // Stats
  const generatedCount = invoices.filter(i => i.invoiceType === 'estimate').length;
  const workOrderCount = invoices.filter(i => i.invoiceType === 'work_order').length;

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
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Generated Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Home &gt; Billing & Payments &gt; Generated Invoices
          </p>
        </div>
        <button
          onClick={() => navigate(`${getBasePath()}/billing/create-invoice`)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const count = tab.id === 'generated' ? generatedCount : tab.id === 'work_order' ? workOrderCount : null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {count !== null && (
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <InvoiceList
          invoices={invoices}
          loading={loading}
          type={activeTab}
          onRefresh={fetchInvoices}
          onView={handleView}
          onDownload={handleDownload}
          onSend={handleSend}
          completedWorkOrders={completedWorkOrders}
          loadingWorkOrders={loadingWorkOrders}
          onWorkOrderClick={(wo) => navigate(`${getBasePath()}/estimates/create?workOrderId=${wo.work_order_id}`)}
          getBasePath={getBasePath}
        />
      </div>

      {/* Professional Invoice Detail Modal */}
      {showDetailPanel && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowDetailPanel(false); setSelectedInvoice(null); }}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Professional Header with Company Info */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src="/logo.webp" alt="XLAND INFRA" className="h-12 w-auto object-contain" />
                  <div>
                    <h1 className="text-amber-400 text-xl font-bold tracking-wide">XLAND INFRA</h1>
                    <p className="text-gray-400 text-xs tracking-widest">PVT LTD</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="inline-block bg-amber-500 text-gray-900 px-4 py-2 rounded font-bold tracking-wider">INVOICE</span>
                  <button onClick={() => { setShowDetailPanel(false); setSelectedInvoice(null); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>

            {/* Invoice Meta Row */}
            <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice No.</p>
                  <p className="text-base font-bold text-gray-900">{selectedInvoice.invoiceId}</p>
                  {selectedInvoice.sourceEstimateId && <p className="text-xs text-gray-500">Ref: {selectedInvoice.sourceEstimateId}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Date</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(selectedInvoice.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-red-500 uppercase tracking-wide">Due Date</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                    selectedInvoice.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 
                    selectedInvoice.paymentStatus === 'partially_paid' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {selectedInvoice.paymentStatus === 'paid' ? '✓ PAID' : selectedInvoice.paymentStatus === 'partially_paid' ? 'PARTIAL' : 'UNPAID'}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
              {/* FROM & BILL TO - Side by Side */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* FROM: Company Details */}
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">From</p>
                  <h3 className="text-white font-bold text-base mb-1">XLAND INFRA PVT LTD</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Property Management Services<br />
                    D.No. 7-333/A/1, Nri Hospital Road<br />
                    Mangalagiri, Guntur - 522503<br />
                    <span className="text-amber-400">Phone:</span> +91 8500 010 111<br />
                    <span className="text-amber-400">Email:</span> info@xlandinfra.com
                  </p>
                </div>
                {/* BILL TO: Customer Details */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2">Bill To</p>
                  <h3 className="text-gray-900 font-bold text-base mb-1">{selectedInvoice.customerName || 'Customer'}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {selectedInvoice.propertyName && <><strong>Property:</strong> {selectedInvoice.propertyName}<br /></>}
                    {selectedInvoice.propertyCode && <><strong>Property ID:</strong> {selectedInvoice.propertyCode}<br /></>}
                    <strong>Phone:</strong> {selectedInvoice.customerPhone || '-'}<br />
                    <strong>Email:</strong> {selectedInvoice.customerEmail || '-'}
                    {selectedInvoice.sourceWorkOrderId && <><br /><strong>Work Order:</strong> {selectedInvoice.sourceWorkOrderId}</>}
                  </p>
                </div>
              </div>

              {/* Amount Due Highlight */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-5 mb-6 text-center">
                <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">Total Amount Due</p>
                <p className="text-white text-3xl font-bold">{formatCurrency(selectedInvoice.totalAmount)}</p>
              </div>

              {/* Services & Add-ons - Only show for NON-work order invoices */}
              {selectedInvoice.invoiceType !== 'work_order' && (() => {
                const rawItems = selectedInvoice.lineItems ? (typeof selectedInvoice.lineItems === 'string' ? JSON.parse(selectedInvoice.lineItems) : selectedInvoice.lineItems) : [];
                
                const allItems = rawItems.filter(item => {
                  const desc = String(item.description || item.name || '').toLowerCase();
                  return !desc.includes('amc package') && !desc.includes('amc services');
                });

                const isAddon = (item) => {
                  const typeStr = String(item.type || '').toLowerCase();
                  return typeStr === 'addon' || typeStr === 'add-on' || typeStr === 'add_on';
                };

                const getFrequency = (item) => {
                  const freq = item.frequency || item.frequencyType || item.frequency_type || item.billingDuration || '';
                  if (!freq || freq === '-') return '-';
                  return String(freq).charAt(0).toUpperCase() + String(freq).slice(1).toLowerCase();
                };

                const services = allItems.filter(item => !isAddon(item)).map(item => {
                  const fullDesc = decodeHtmlEntities(String(item.description || item.name || 'Service'));
                  const parts = fullDesc.split(' - ');
                  return {
                    name: decodeHtmlEntities(parts[0] || 'Service'),
                    description: decodeHtmlEntities(parts.slice(1).join(' - ') || ''),
                    frequency: getFrequency(item),
                    visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1,
                    price: item.totalPrice || item.total_price || item.unitPrice || item.unit_price || item.price || 0
                  };
                });

                const addons = allItems.filter(item => isAddon(item)).map(item => {
                  const fullDesc = decodeHtmlEntities(String(item.description || item.name || 'Add-on'));
                  const parts = fullDesc.split(' - ');
                  return {
                    name: decodeHtmlEntities(parts[0] || 'Add-on'),
                    description: decodeHtmlEntities(parts.slice(1).join(' - ') || ''),
                    frequency: getFrequency(item),
                    visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1,
                    price: item.totalPrice || item.total_price || item.unitPrice || item.unit_price || item.price || 0
                  };
                });

                return (
                  <>
                    {/* AMC Services */}
                    {services.length > 0 && (
                      <div className="mb-6">
                        <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
                          <div className="bg-green-600 px-4 py-3">
                            <h3 className="text-white text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                              <FileText className="w-4 h-4" /> AMC Services
                            </h3>
                          </div>
                          <table className="w-full">
                            <thead className="bg-green-100">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-green-800 uppercase">Service</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-green-800 uppercase w-24">Frequency</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-green-800 uppercase w-16">Visits</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-green-800 uppercase w-24">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {services.map((item, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                                  <td className="px-4 py-3 border-b border-green-100">
                                    <p className="text-sm font-semibold text-green-700">{item.name}</p>
                                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm text-gray-600 border-b border-green-100">{item.frequency}</td>
                                  <td className="px-4 py-3 text-center text-sm text-gray-600 border-b border-green-100">{item.visits}</td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-700 border-b border-green-100">{formatCurrency(item.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Add-ons */}
                    {addons.length > 0 && (
                      <div className="mb-6">
                        <div className="bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
                          <div className="bg-amber-500 px-4 py-3">
                            <h3 className="text-white text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                              <Plus className="w-4 h-4" /> Add-on Services
                            </h3>
                          </div>
                          <table className="w-full">
                            <thead className="bg-amber-100">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-amber-800 uppercase">Add-on</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-amber-800 uppercase w-24">Frequency</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-amber-800 uppercase w-16">Visits</th>
                                <th className="px-4 py-2.5 text-right text-xs font-semibold text-amber-800 uppercase w-24">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {addons.map((item, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                                  <td className="px-4 py-3 border-b border-amber-100">
                                    <p className="text-sm font-semibold text-amber-700">{item.name}</p>
                                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm text-gray-600 border-b border-amber-100">{item.frequency}</td>
                                  <td className="px-4 py-3 text-center text-sm text-gray-600 border-b border-amber-100">{item.visits}</td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-amber-700 border-b border-amber-100">{formatCurrency(item.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Price Summary - Dark Theme */}
              <div className="bg-gray-800 rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-gray-700">
                  <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Price Summary
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-200">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount ({selectedInvoice.discountPercentage || 0}%)</span>
                      <span className="text-green-400">-{formatCurrency(selectedInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">GST ({selectedInvoice.taxPercentage || 18}%)</span>
                    <span className="text-gray-200">{formatCurrency(selectedInvoice.taxAmount)}</span>
                  </div>
                  <div className="border-t border-gray-600 pt-3 mt-3">
                    <div className="flex justify-between">
                      <span className="text-white font-semibold">Grand Total</span>
                      <span className="text-amber-400 text-xl font-bold">{formatCurrency(selectedInvoice.totalAmount)}</span>
                    </div>
                  </div>
                  {(selectedInvoice.amountPaid || 0) > 0 && (
                    <>
                      <div className="border-t border-gray-700 border-dashed pt-3 mt-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-green-400">Amount Paid</span>
                          <span className="text-green-400">{formatCurrency(selectedInvoice.amountPaid)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-400 font-semibold">Balance Due</span>
                        <span className="text-red-400 text-lg font-bold">{formatCurrency(selectedInvoice.balanceAmount)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowDetailPanel(false); setSelectedInvoice(null); }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              {selectedInvoice.balanceAmount > 0 && (
                <button
                  onClick={() => { /* TODO: Record payment */ }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Receipt className="w-4 h-4" /> Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratedInvoices;
