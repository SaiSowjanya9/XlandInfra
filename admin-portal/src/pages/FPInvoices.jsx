import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Send,
  CreditCard,
  RefreshCw,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  IndianRupee,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partially_paid: { label: 'Partially Paid', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle }
};

const PAYMENT_STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  partially_paid: { label: 'Partially Paid', color: 'bg-orange-100 text-orange-700' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' }
};

const FPInvoices = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState(null);

  const token = getAuthToken();

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/payments/invoices`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentStatusFilter !== 'all') params.append('paymentStatus', paymentStatusFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, paymentStatusFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSendInvoice = async (invoice) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Invoice sent successfully!');
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to send invoice', 'error');
      }
    } catch (err) {
      showToast('Failed to send invoice', 'error');
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const exportToExcel = () => {
    if (invoices.length === 0) {
      showToast('No invoices to export', 'error');
      return;
    }

    const exportData = invoices.map(inv => ({
      'Invoice ID': inv.invoiceId,
      'Customer Name': inv.customerName || '-',
      'Property': inv.propertyName || '-',
      'Invoice Date': formatDate(inv.invoiceDate),
      'Due Date': formatDate(inv.dueDate),
      'Total Amount': inv.totalAmount,
      'Amount Paid': inv.amountPaid,
      'Balance': inv.balanceAmount,
      'Status': STATUS_CONFIG[inv.status]?.label || inv.status,
      'Payment Status': PAYMENT_STATUS_CONFIG[inv.paymentStatus]?.label || inv.paymentStatus
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Invoices exported successfully');
  };

  const canEdit = ['admin', 'operations_manager', 'franchise_partner', 'manager'].includes(user?.role);

  const filteredInvoices = invoices;

  // Stats
  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.paymentStatus === 'pending').length,
    partiallyPaid: invoices.filter(i => i.paymentStatus === 'partially_paid').length,
    paid: invoices.filter(i => i.paymentStatus === 'paid').length
  };

  return (
    <div className="space-y-6">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage all your invoices</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          {canEdit && (
            <button
              onClick={() => navigate('/fp/payments/invoices/create')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Total Invoices</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Pending Payment</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Partially Paid</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{stats.partiallyPaid}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm text-gray-500">Fully Paid</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.paid}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice ID, customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
          >
            <option value="all">All Payments</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>

          <button
            onClick={fetchInvoices}
            className="p-2.5 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
            <span className="ml-2 text-gray-600">Loading invoices...</span>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No invoices found</p>
            {canEdit && (
              <button
                onClick={() => navigate('/fp/payments/invoices/create')}
                className="mt-4 text-amber-600 hover:text-amber-700 font-medium"
              >
                Create your first invoice
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Invoice ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredInvoices.map(invoice => {
                  const statusConfig = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
                  const paymentConfig = PAYMENT_STATUS_CONFIG[invoice.paymentStatus] || PAYMENT_STATUS_CONFIG.pending;
                  const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.paymentStatus !== 'paid';

                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{invoice.invoiceId}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-900">{invoice.customerName || '-'}</p>
                        {invoice.propertyName && (
                          <p className="text-xs text-gray-500">{invoice.propertyName}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-600">{formatDate(invoice.invoiceDate)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {formatDate(invoice.dueDate)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className={invoice.balanceAmount > 0 ? 'font-semibold text-red-600' : 'text-green-600'}>
                          {formatCurrency(invoice.balanceAmount)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${paymentConfig.color}`}>
                            {paymentConfig.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/fp/payments/invoices/${invoice.id}`)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          {canEdit && invoice.status === 'draft' && (
                            <button
                              onClick={() => handleSendInvoice(invoice)}
                              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Send Invoice"
                            >
                              <Send className="w-4 h-4 text-blue-600" />
                            </button>
                          )}
                          {canEdit && invoice.balanceAmount > 0 && (
                            <button
                              onClick={() => navigate(`/fp/payments/record?invoiceId=${invoice.id}`)}
                              className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                              title="Record Payment"
                            >
                              <CreditCard className="w-4 h-4 text-green-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FPInvoices;
