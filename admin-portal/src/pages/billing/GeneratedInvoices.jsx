import { useState, useEffect, useCallback } from 'react';
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
  { id: 'create', label: 'Create Invoice', icon: Plus, description: 'Create manual invoice for other requirements' },
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
  const [propertyId, setPropertyId] = useState('');
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
  const [step, setStep] = useState(1); // 1: Enter Property, 2: Select Estimate, 3: Review & Create

  // Fetch property details and approved estimates when Property ID is entered
  const fetchPropertyData = async () => {
    if (!propertyId || propertyId.length < 3) return;
    
    setFetchingData(true);
    setError('');
    setApprovedEstimates([]);
    setSelectedEstimate(null);
    
    try {
      // Fetch property details
      const propResponse = await fetch(`${API_BASE}/api/payments/properties/by-code/${propertyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const propResult = await propResponse.json();
      
      if (propResult.success && propResult.data) {
        const property = propResult.data;
        setCustomerDetails({
          name: property.customer_name || property.name || '',
          email: property.customer_email || '',
          phone: property.customer_phone || ''
        });
      }
      
      // Fetch approved estimates for this property
      const estResponse = await fetch(`${API_BASE}/api/payments/estimates/by-property/${propertyId}?status=approved`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const estResult = await estResponse.json();
      
      if (estResult.success && estResult.data && estResult.data.length > 0) {
        setApprovedEstimates(estResult.data);
        setStep(2);
      } else {
        setError('No approved estimates found for this property');
      }
    } catch (err) {
      console.log('Fetch failed:', err);
      setError('Failed to fetch property data');
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
          propertyId: propertyId,
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
          Enter Property ID
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${step >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
          Select Estimate
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${step >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>3</span>
          Review & Create
        </div>
      </div>

      {/* Step 1: Enter Property ID */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Property ID *
              {fetchingData && <span className="ml-2 text-blue-500 text-xs animate-pulse">(Loading...)</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Property ID (e.g., PROP-001)"
              />
              <button
                type="button"
                onClick={fetchPropertyData}
                disabled={fetchingData || !propertyId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {fetchingData ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter the Property ID to fetch customer details and approved estimates</p>
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
const InvoiceList = ({ invoices, loading, type, onRefresh, onView, onDownload, onSend }) => {
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

      {/* Table */}
      {paginatedInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileText className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-lg font-medium">No invoices found</p>
          <p className="text-sm">{type === 'generated' ? 'Invoices will appear here when estimates are approved' : 'No work order invoices yet'}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
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
                      <span className="text-sm font-medium text-blue-600">{invoice.invoiceId}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-800">{invoice.customerName || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{invoice.propertyCode || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{formatDate(invoice.invoiceDate)}</td>
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
                        {/* Modify */}
                        <button
                          onClick={() => onView(invoice)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                          title="Modify"
                        >
                          <Edit className="w-4 h-4" />
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
  const [activeTab, setActiveTab] = useState('create');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const token = getAuthToken();

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

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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
    // Open in new tab or modal
    window.open(`${API_BASE}/api/payments/invoices/${invoice.id}/pdf`, '_blank');
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Generated Invoices</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Home &gt; Billing & Payments &gt; Generated Invoices
        </p>
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
        {activeTab === 'create' ? (
          <CreateInvoiceForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setActiveTab('generated')}
            token={token}
          />
        ) : (
          <InvoiceList
            invoices={invoices}
            loading={loading}
            type={activeTab}
            onRefresh={fetchInvoices}
            onView={handleView}
            onDownload={handleDownload}
            onSend={handleSend}
          />
        )}
      </div>
    </div>
  );
};

export default GeneratedInvoices;
