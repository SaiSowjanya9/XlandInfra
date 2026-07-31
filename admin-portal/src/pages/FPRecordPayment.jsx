import { useState, useEffect } from 'react';
import {
  CreditCard,
  Search,
  Save,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  IndianRupee,
  Banknote,
  Smartphone,
  Building2,
  CreditCardIcon,
  RefreshCw,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700' },
  { value: 'upi_manual', label: 'UPI (Manual)', icon: Smartphone, color: 'bg-purple-100 text-purple-700' },
  { value: 'bank_transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  { value: 'card_pos', label: 'Card / POS Machine', icon: CreditCardIcon, color: 'bg-orange-100 text-orange-700' },
];

const FPRecordPayment = ({ user }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoiceId = searchParams.get('invoiceId');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
  const [toast, setToast] = useState(null);
  const [paymentProof, setPaymentProof] = useState(null);

  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: '',
    paymentMethod: 'cash',
    transactionReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: ''
  });

  const token = getAuthToken();

  // Fetch invoices with pending balance
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices?paymentStatus=pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        // Filter invoices with balance > 0
        const invoicesWithBalance = result.data.filter(inv => inv.balanceAmount > 0);
        setInvoices(invoicesWithBalance);
        
        // If preselected invoice ID, find and select it
        if (preselectedInvoiceId) {
          const preselected = result.data.find(inv => inv.id === parseInt(preselectedInvoiceId));
          if (preselected) {
            handleSelectInvoice(preselected);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleSelectInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setFormData(prev => ({
      ...prev,
      invoiceId: invoice.id,
      amount: invoice.balanceAmount.toString()
    }));
    setShowInvoiceSearch(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error');
        return;
      }
      setPaymentProof(file);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.invoiceId) {
      showToast('Please select an invoice', 'error');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    if (formData.paymentMethod !== 'cash' && !formData.transactionReference) {
      showToast('Transaction reference is required for non-cash payments', 'error');
      return;
    }

    if (parseFloat(formData.amount) > selectedInvoice.balanceAmount) {
      showToast('Amount cannot exceed the balance amount', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append('invoiceId', formData.invoiceId);
      submitData.append('amount', formData.amount);
      submitData.append('paymentMethod', formData.paymentMethod);
      submitData.append('paymentDate', formData.paymentDate);
      submitData.append('customerName', selectedInvoice.customerName);
      
      if (formData.transactionReference) {
        submitData.append('transactionReference', formData.transactionReference);
      }
      if (formData.remarks) {
        submitData.append('remarks', formData.remarks);
      }
      if (paymentProof) {
        submitData.append('paymentProof', paymentProof);
      }

      const response = await fetch(`${API_BASE}/api/payments/payments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        showToast('Payment recorded successfully!');
        setTimeout(() => {
          navigate('/fp/payments');
        }, 1500);
      } else {
        showToast(result.message || 'Failed to record payment', 'error');
      }
    } catch (err) {
      console.error('Error recording payment:', err);
      showToast('Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = searchTerm.toLowerCase();
    return (
      inv.invoiceId?.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.propertyName?.toLowerCase().includes(q)
    );
  });

  // Check if user can edit payments
  const canEdit = ['admin', 'operations_manager', 'franchise_partner', 'manager'].includes(user?.role);

  if (!canEdit) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
        <p className="text-yellow-700">You do not have permission to record payments.</p>
        <button
          onClick={() => navigate('/fp/payments')}
          className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/fp/payments')}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Record Manual Payment</h1>
          <p className="text-gray-500 mt-1">Record a payment received from customer</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            Invoice Details
          </h3>

          {selectedInvoice ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{selectedInvoice.invoiceId}</p>
                  <p className="text-sm text-gray-600">{selectedInvoice.customerName}</p>
                  {selectedInvoice.propertyName && (
                    <p className="text-sm text-gray-500">{selectedInvoice.propertyName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedInvoice(null);
                    setFormData(prev => ({ ...prev, invoiceId: '', amount: '' }));
                  }}
                  className="p-1 hover:bg-amber-100 rounded-lg"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-amber-200">
                <div>
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount Paid</p>
                  <p className="font-semibold text-green-600">{formatCurrency(selectedInvoice.amountPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Balance Due</p>
                  <p className="font-semibold text-red-600">{formatCurrency(selectedInvoice.balanceAmount)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div
                onClick={() => setShowInvoiceSearch(true)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl cursor-pointer hover:border-amber-300 transition-colors flex items-center gap-2"
              >
                <Search className="w-5 h-5 text-gray-400" />
                <span className="text-gray-400">Search and select an invoice...</span>
              </div>

              {showInvoiceSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-80 overflow-hidden">
                  <div className="p-3 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by invoice ID, customer, property..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading invoices...
                      </div>
                    ) : filteredInvoices.length > 0 ? (
                      filteredInvoices.map(invoice => (
                        <div
                          key={invoice.id}
                          onClick={() => handleSelectInvoice(invoice)}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{invoice.invoiceId}</p>
                              <p className="text-sm text-gray-500">{invoice.customerName}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-red-600">{formatCurrency(invoice.balanceAmount)}</p>
                              <p className="text-xs text-gray-400">Balance Due</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No invoices with pending balance found
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setShowInvoiceSearch(false)}
                      className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-600" />
            Payment Details
          </h3>

          <div className="space-y-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Paid <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={selectedInvoice?.balanceAmount || 999999999}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                  required
                />
              </div>
              {selectedInvoice && (
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: {formatCurrency(selectedInvoice.balanceAmount)}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PAYMENT_METHODS.map(method => {
                  const Icon = method.icon;
                  const isSelected = formData.paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: method.value }))}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 ${method.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className={`text-xs font-medium ${isSelected ? 'text-amber-700' : 'text-gray-600'}`}>
                        {method.label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transaction Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction / Reference Number
                {formData.paymentMethod !== 'cash' && <span className="text-red-500"> *</span>}
              </label>
              <input
                type="text"
                name="transactionReference"
                value={formData.transactionReference}
                onChange={handleInputChange}
                placeholder={formData.paymentMethod === 'cash' ? 'Optional for cash payments' : 'Enter UTR/Transaction ID'}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                required={formData.paymentMethod !== 'cash'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.paymentMethod === 'upi_manual' && 'Enter the UTR number from UPI transaction'}
                {formData.paymentMethod === 'bank_transfer' && 'Enter the NEFT/RTGS/IMPS reference number'}
                {formData.paymentMethod === 'card_pos' && 'Enter the transaction ID from POS machine'}
              </p>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleInputChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                required
              />
            </div>

            {/* Payment Proof Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Proof (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                {paymentProof ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-gray-700">{paymentProof.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentProof(null)}
                      className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Click to upload screenshot or receipt</span>
                    <span className="text-xs text-gray-400 mt-1">Max 5MB (JPG, PNG, PDF)</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks (Optional)
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                placeholder="Add any notes about this payment..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/fp/payments')}
            className="px-6 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedInvoice}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Recording Payment...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Record Payment
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FPRecordPayment;
