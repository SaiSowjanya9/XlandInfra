import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Send,
  CreditCard,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Link as LinkIcon,
  Edit,
  MoreHorizontal,
  Banknote,
  Receipt,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600 border border-gray-300' },
  sent: { label: 'Sent', color: 'bg-blue-50 text-blue-600 border border-blue-300' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700' },
  partially_paid: { label: 'Partially Paid', color: 'bg-orange-100 text-orange-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-600' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' }
};

const INVOICE_TYPE_CONFIG = {
  estimate: { label: 'Estimate', color: 'text-purple-600' },
  work_order: { label: 'Work Order', color: 'text-blue-600' },
  amc: { label: 'AMC', color: 'text-teal-600' },
  manual: { label: 'Manual', color: 'text-gray-600' }
};

const Invoices = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const itemsPerPage = 10;

  const token = getAuthToken();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/api/payments/invoices`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('invoiceType', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
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
  }, [token, statusFilter, typeFilter, searchTerm, dateRange]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0).replace('₹', '₹');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleSendInvoice = async (invoice) => {
    setActionLoading(invoice.id);
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
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePaymentLink = async (invoice) => {
    setActionLoading(invoice.id);
    try {
      const response = await fetch(`${API_BASE}/api/razorpay/create-payment-link`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceId: invoice.id })
      });
      const result = await response.json();
      if (result.success) {
        showToast('Payment link created successfully!');
        if (result.data?.paymentLink) {
          navigator.clipboard.writeText(result.data.paymentLink);
          showToast('Payment link copied to clipboard!');
        }
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to create payment link', 'error');
      }
    } catch (err) {
      showToast('Failed to create payment link', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openInvoiceDetail = async (invoice) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoice.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setSelectedInvoice(result.data);
        setShowDetailPanel(true);
      }
    } catch (err) {
      console.error('Error fetching invoice details:', err);
    }
  };

  const exportToExcel = () => {
    if (invoices.length === 0) {
      showToast('No invoices to export', 'error');
      return;
    }

    const exportData = invoices.map(inv => ({
      'Invoice ID': inv.invoiceId,
      'Property ID': inv.propertyCode || '-',
      'Customer': inv.customerName || '-',
      'Invoice Type': INVOICE_TYPE_CONFIG[inv.invoiceType]?.label || 'Manual',
      'Invoice Date': formatDate(inv.invoiceDate),
      'Due Date': formatDate(inv.dueDate),
      'Amount': inv.totalAmount,
      'Paid': inv.amountPaid,
      'Balance': inv.balanceAmount,
      'Status': STATUS_CONFIG[inv.status]?.label || inv.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Exported successfully!');
  };

  // Pagination
  const totalPages = Math.ceil(invoices.length / itemsPerPage);
  const paginatedInvoices = invoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate stats from invoices
  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    partiallyPaid: invoices.filter(i => i.status === 'partially_paid').length,
    partiallyPaidAmount: invoices.filter(i => i.status === 'partially_paid').reduce((sum, i) => sum + (parseFloat(i.amountPaid) || 0), 0),
    paid: invoices.filter(i => i.status === 'paid').length,
    paidAmount: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0),
    overdue: invoices.filter(i => i.status === 'overdue').length,
    overdueAmount: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (parseFloat(i.balanceAmount) || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Home &gt; Billing & Payments &gt; Invoices
            </p>
          </div>
          <button
            onClick={() => navigate(`/${portalType === 'admin' ? 'employee' : portalType}/billing/generate-invoices`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {/* Total Invoices */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
                <p className="text-xs text-gray-400 mt-0.5">This Month</p>
              </div>
            </div>
          </div>
          
          {/* Draft */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Draft</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.draft}</p>
              </div>
            </div>
          </div>

          {/* Sent */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <Send className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Sent</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.sent}</p>
              </div>
            </div>
          </div>

          {/* Partially Paid */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-teal-100">
                <Receipt className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Partially Paid</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.partiallyPaid}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(stats.partiallyPaidAmount)}</p>
              </div>
            </div>
          </div>

          {/* Paid */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-green-100">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Paid</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.paid}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(stats.paidAmount)}</p>
              </div>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-red-100">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Overdue</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.overdue}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(stats.overdueAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Invoice ID, Property, Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer min-w-[140px]"
              >
                <option value="all">All Invoice Type</option>
                <option value="estimate">Estimate</option>
                <option value="work_order">Work Order</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div className="relative">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-sm border-none focus:outline-none bg-transparent w-28 opacity-0 absolute inset-0 cursor-pointer"
                />
                <span className="text-sm text-gray-600">
                  {dateRange.start ? new Date(dateRange.start).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/yyyy'}
                </span>
              </div>
              <span className="text-gray-400">-</span>
              <div className="relative">
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-sm border-none focus:outline-none bg-transparent w-28 opacity-0 absolute inset-0 cursor-pointer"
                />
                <span className="text-sm text-gray-600">
                  {dateRange.end ? new Date(dateRange.end).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'dd/mm/yyyy'}
                </span>
              </div>
            </div>

            {/* Refresh & Export */}
            <button
              onClick={fetchInvoices}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportToExcel}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Export"
            >
              <Download className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex gap-6">
          {/* Table */}
          <div className={`flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 ${showDetailPanel ? 'mr-[380px]' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <FileText className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-lg font-medium">No invoices found</p>
                <p className="text-sm">Create your first invoice or adjust filters</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                            Invoice ID
                            <ChevronDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                            Invoice Date
                            <ChevronDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-gray-700">
                            Due Date
                            <ChevronDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedInvoices.map((invoice) => (
                        <tr 
                          key={invoice.id} 
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedInvoice?.id === invoice.id ? 'bg-blue-50' : ''}`}
                          onClick={() => openInvoiceDetail(invoice)}
                        >
                          <td className="px-4 py-3.5">
                            <span className="text-sm font-medium text-blue-600">{invoice.invoiceId}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-600">{invoice.propertyCode || '-'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-800">{invoice.customerName || invoice.propertyName || '-'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-sm font-medium ${INVOICE_TYPE_CONFIG[invoice.invoiceType]?.color || 'text-gray-600'}`}>
                              {INVOICE_TYPE_CONFIG[invoice.invoiceType]?.label || 'Manual'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-gray-600">{formatDate(invoice.invoiceDate)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-sm ${invoice.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {formatDate(invoice.dueDate)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-medium text-gray-800">{formatCurrency(invoice.totalAmount)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm text-gray-600">{formatCurrency(invoice.amountPaid)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <span className={`text-sm font-medium ${invoice.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(invoice.balanceAmount)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[invoice.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                              {STATUS_CONFIG[invoice.status]?.label || invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openInvoiceDetail(invoice)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, invoices.length)} of {invoices.length} invoices
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-500" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-1 text-gray-400">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="w-8 h-8 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Detail Panel */}
          {showDetailPanel && selectedInvoice && (
            <InvoiceDetailPanel
              invoice={selectedInvoice}
              onClose={() => {
                setShowDetailPanel(false);
                setSelectedInvoice(null);
              }}
              onSend={handleSendInvoice}
              onCreatePaymentLink={handleCreatePaymentLink}
              onRecordPayment={() => setShowRecordPayment(true)}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              actionLoading={actionLoading}
            />
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {showRecordPayment && selectedInvoice && (
        <RecordPaymentModal
          invoice={selectedInvoice}
          onClose={() => setShowRecordPayment(false)}
          onSuccess={() => {
            setShowRecordPayment(false);
            fetchInvoices();
            if (selectedInvoice) {
              openInvoiceDetail(selectedInvoice);
            }
            showToast('Payment recorded successfully!');
          }}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-5 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

// Invoice Detail Panel
const InvoiceDetailPanel = ({ 
  invoice, 
  onClose, 
  onSend, 
  onCreatePaymentLink, 
  onRecordPayment,
  formatCurrency, 
  formatDate,
  actionLoading 
}) => {
  return (
    <div className="fixed right-0 top-0 h-full w-[380px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-gray-900">{invoice.invoiceId}</span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CONFIG[invoice.status]?.color}`}>
            {STATUS_CONFIG[invoice.status]?.label}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Customer/Property Info */}
        <div className="flex items-start gap-2 mb-5">
          <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">{invoice.customerName || invoice.propertyName}</p>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1 mb-6">
          <p>Property ID: {invoice.propertyCode || '-'}</p>
          {invoice.sourceWorkOrderId && <p>Work Order ID: {invoice.sourceWorkOrderId}</p>}
          {invoice.sourceEstimateId && <p>Estimate ID: {invoice.sourceEstimateId}</p>}
        </div>

        {/* Dates & Type */}
        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-1">Invoice Date</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(invoice.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Due Date</p>
            <p className={`text-sm font-medium ${invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>
              {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Invoice Type</p>
            <p className="text-sm font-medium text-gray-900">
              {INVOICE_TYPE_CONFIG[invoice.invoiceType]?.label || 'Manual'}
            </p>
          </div>
        </div>

        {/* Amounts */}
        <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">GST ({invoice.taxPercentage || 18}%)</span>
            <span className="text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
          </div>
          {invoice.discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="text-gray-900">{formatCurrency(invoice.discountAmount)}</span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-gray-900">Total Amount</span>
            <span className="text-base font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Amount Paid</span>
            <span className="text-gray-900">{formatCurrency(invoice.amountPaid)}</span>
          </div>
        </div>

        {/* Balance Due */}
        <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Balance Due</span>
          <span className={`text-xl font-bold ${invoice.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(invoice.balanceAmount)}
          </span>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase font-medium tracking-wider mb-3">Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
              <Eye className="w-4 h-4" />
              View Invoice (PDF)
            </button>
            <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
              <Edit className="w-4 h-4" />
              Edit Invoice
            </button>
            <button 
              onClick={() => onSend(invoice)}
              disabled={actionLoading === invoice.id}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send Invoice
            </button>
            <button 
              onClick={onRecordPayment}
              disabled={invoice.balanceAmount <= 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>
            <button 
              onClick={() => onCreatePaymentLink(invoice)}
              disabled={actionLoading === invoice.id || invoice.balanceAmount <= 0}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors col-span-2 disabled:opacity-50"
            >
              <LinkIcon className="w-4 h-4" />
              Send Payment Link
            </button>
          </div>
        </div>

        {/* Payment Status */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Payment Status</span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              invoice.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
              invoice.paymentStatus === 'partially_paid' ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-600'
            }`}>
              {invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus === 'partially_paid' ? 'Partial' : 'Unpaid'}
            </span>
          </div>
          {invoice.payments && invoice.payments.length > 0 ? (
            <div className="space-y-2">
              {invoice.payments.map((payment, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-gray-500">{formatDate(payment.paymentDate)} - {payment.paymentMethod}</span>
                  <span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No payment received yet.</p>
          )}
        </div>
      </div>

      {/* Footer - Record Payment Button */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={onRecordPayment}
          disabled={invoice.balanceAmount <= 0}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          Record Payment
        </button>
      </div>
    </div>
  );
};

// Record Payment Modal
const RecordPaymentModal = ({ invoice, onClose, onSuccess, formatCurrency }) => {
  const [amount, setAmount] = useState(invoice.balanceAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionRef, setTransactionRef] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = getAuthToken();

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: Banknote },
    { value: 'upi_manual', label: 'UPI (QR / UPI ID)', icon: Receipt },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
    { value: 'razorpay', label: 'Card / Net Banking', icon: CreditCard },
    { value: 'cheque', label: 'Cheque', icon: FileText }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > invoice.balanceAmount) {
      setError('Amount cannot exceed balance due');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/payments/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: parseFloat(amount),
          paymentMethod,
          paymentDate,
          transactionReference: transactionRef,
          remarks,
          customerName: invoice.customerName
        })
      });

      const result = await response.json();
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message || 'Failed to record payment');
      }
    } catch (err) {
      setError('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-500">Invoice: {invoice.invoiceId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Invoice Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Amount</span>
              <span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount Paid</span>
              <span className="font-medium text-green-600">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="font-medium text-gray-700">Balance Due</span>
              <span className="font-bold text-red-600">{formatCurrency(invoice.balanceAmount)}</span>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                max={invoice.balanceAmount}
                step="0.01"
                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method *</label>
            <div className="space-y-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <label
                    key={method.value}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      paymentMethod === method.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Icon className="w-5 h-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{method.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Transaction Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction Reference</label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="UTR number, Transaction ID, etc."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Optional notes"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Invoices;
