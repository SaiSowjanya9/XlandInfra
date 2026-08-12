import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Link2,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Copy,
  ExternalLink,
  Mail,
  Plus,
  FileText,
  Building2,
  User,
  Phone,
  IndianRupee,
  Calendar,
  Check,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Format date in IST format (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date)) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Format currency
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

// Status badge component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    created: { bg: 'bg-blue-50', text: 'text-blue-700', icon: Link2, label: 'Created' },
    sent: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Send, label: 'Sent' },
    paid: { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle, label: 'Paid' },
    expired: { bg: 'bg-red-50', text: 'text-red-700', icon: Clock, label: 'Expired' },
    cancelled: { bg: 'bg-gray-50', text: 'text-gray-700', icon: XCircle, label: 'Cancelled' }
  };
  
  const config = statusConfig[status] || statusConfig.created;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

const PaymentLinks = () => {
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [counts, setCounts] = useState({ all: 0, created: 0, sent: 0, paid: 0, expired: 0, cancelled: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLink, setSelectedLink] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);
  const itemsPerPage = 20;

  // Generate Payment Link Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const [foundInvoice, setFoundInvoice] = useState(null);
  const [invoiceError, setInvoiceError] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch payment links
  const fetchPaymentLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const params = new URLSearchParams({
        status: activeTab,
        search: searchTerm,
        page: currentPage,
        limit: itemsPerPage
      });
      
      const response = await fetch(`${API_BASE}/api/razorpay/payment-links?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch payment links');
      
      const result = await response.json();
      if (result.success) {
        setPaymentLinks(result.data.paymentLinks || []);
        setCounts(result.data.counts || { all: 0, created: 0, sent: 0, paid: 0, expired: 0, cancelled: 0 });
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching payment links:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, currentPage]);

  useEffect(() => {
    fetchPaymentLinks();
  }, [fetchPaymentLinks]);

  // Search invoice for generating payment link
  const searchInvoice = async () => {
    if (!invoiceSearchTerm.trim()) return;
    
    setSearchingInvoice(true);
    setInvoiceError('');
    setFoundInvoice(null);
    setGeneratedLink(null);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/payments/invoices/search?q=${encodeURIComponent(invoiceSearchTerm)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        setFoundInvoice(result.data[0]);
      } else {
        // Try fetching by exact invoice ID
        const exactResponse = await fetch(`${API_BASE}/api/payments/invoices?invoiceId=${encodeURIComponent(invoiceSearchTerm)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const exactResult = await exactResponse.json();
        
        if (exactResult.success && exactResult.data && exactResult.data.length > 0) {
          setFoundInvoice(exactResult.data[0]);
        } else {
          setInvoiceError('Invoice not found. Please check the Invoice ID.');
        }
      }
    } catch (err) {
      setInvoiceError('Error searching invoice: ' + err.message);
    } finally {
      setSearchingInvoice(false);
    }
  };

  // Generate payment link for invoice
  const generatePaymentLink = async () => {
    if (!foundInvoice) return;
    
    setGeneratingLink(true);
    setInvoiceError('');
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/razorpay/create-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId: foundInvoice.id })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setGeneratedLink(result.data);
        showToast('Payment link generated successfully!');
        fetchPaymentLinks(); // Refresh the list
      } else {
        setInvoiceError(result.message || 'Failed to generate payment link');
      }
    } catch (err) {
      setInvoiceError('Error generating payment link: ' + err.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  // Copy link to clipboard
  const copyToClipboard = async (link, id) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      showToast('Payment link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Send payment link email
  const sendPaymentLinkEmail = async (invoiceId) => {
    setActionLoading(invoiceId);
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/razorpay/send-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ invoiceId })
      });
      
      const result = await response.json();
      if (result.success) {
        showToast('Payment link sent successfully!');
        fetchPaymentLinks();
      } else {
        showToast(result.message || 'Failed to send payment link', 'error');
      }
    } catch (err) {
      showToast('Failed to send payment link: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = paymentLinks.map(link => ({
      'Invoice ID': link.invoice_id,
      'Customer': link.customer_name || '-',
      'Email': link.customer_email || '-',
      'Phone': link.customer_phone || '-',
      'Amount': link.balance_amount,
      'Status': link.payment_link_status || '-',
      'Created': formatDateIST(link.payment_link_created_at),
      'Sent': formatDateIST(link.payment_link_sent_at),
      'Expires': formatDateIST(link.payment_link_expires_at),
      'Payment Link': link.payment_link || '-'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Links');
    XLSX.writeFile(wb, `PaymentLinks_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Reset generate modal
  const resetGenerateModal = () => {
    setShowGenerateModal(false);
    setInvoiceSearchTerm('');
    setFoundInvoice(null);
    setInvoiceError('');
    setGeneratedLink(null);
  };

  // Filter tabs
  const tabs = [
    { id: 'all', label: 'All Links', count: counts.all },
    { id: 'created', label: 'Created', count: counts.created },
    { id: 'sent', label: 'Sent', count: counts.sent },
    { id: 'paid', label: 'Paid', count: counts.paid },
    { id: 'expired', label: 'Expired', count: counts.expired }
  ];

  // Check if link is expired
  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Links</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage online payment links for invoices</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Generate Payment Link
          </button>
          <button
            onClick={fetchPaymentLinks}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Links', value: counts.all, icon: Link2, color: 'blue' },
          { label: 'Created', value: counts.created, icon: Clock, color: 'gray' },
          { label: 'Sent', value: counts.sent, icon: Send, color: 'amber' },
          { label: 'Paid', value: counts.paid, icon: CheckCircle, color: 'green' },
          { label: 'Expired', value: counts.expired, icon: XCircle, color: 'red' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-${stat.color}-50 flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice or customer..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-500">Loading payment links...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Link2 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium">No payment links yet</p>
              <p className="text-sm mb-4">Generate payment links for your invoices to get started</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Generate Payment Link
              </button>
            </div>
          ) : paymentLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Link2 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium">No payment links found</p>
              <p className="text-sm mb-4">Generate payment links for your invoices</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                Generate Payment Link
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payment Link</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paymentLinks.map((link) => (
                  <tr key={link.invoice_db_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-blue-600">{link.invoice_id}</div>
                      {link.source_estimate_id && (
                        <div className="text-xs text-gray-400">{link.source_estimate_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{link.customer_name || '-'}</div>
                      <div className="text-xs text-gray-500">{link.customer_email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{formatCurrency(link.balance_amount)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={isExpired(link.payment_link_expires_at) && link.payment_link_status !== 'paid' ? 'expired' : link.payment_link_status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateIST(link.payment_link_created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={isExpired(link.payment_link_expires_at) ? 'text-red-500' : 'text-gray-600'}>
                        {formatDateIST(link.payment_link_expires_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {link.payment_link ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={link.payment_link}
                            readOnly
                            className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 w-40 truncate"
                          />
                          <button
                            onClick={() => copyToClipboard(link.payment_link, link.invoice_db_id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              copiedId === link.invoice_db_id 
                                ? 'bg-green-100 text-green-600' 
                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title="Copy Link"
                          >
                            {copiedId === link.invoice_db_id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {link.payment_link && (
                          <a
                            href={link.payment_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Open Link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {link.payment_link_status !== 'paid' && !isExpired(link.payment_link_expires_at) && (
                          <button
                            onClick={() => sendPaymentLinkEmail(link.invoice_db_id)}
                            disabled={actionLoading === link.invoice_db_id}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Send via Email"
                          >
                            {actionLoading === link.invoice_db_id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Mail className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedLink(link); setShowDetailModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {paymentLinks.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, counts.all)} of {counts.all} links
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage * itemsPerPage >= counts.all}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Payment Link Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center gap-3">
                <Link2 className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-lg font-semibold text-white">Generate Payment Link</h2>
                  <p className="text-blue-100 text-sm">Create a payment link for an invoice</p>
                </div>
              </div>
              <button onClick={resetGenerateModal} className="p-1.5 hover:bg-white/20 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Search Invoice */}
              {!generatedLink && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Invoice</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={invoiceSearchTerm}
                        onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchInvoice()}
                        placeholder="Enter Invoice ID (e.g., INV-001)"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={searchInvoice}
                      disabled={searchingInvoice || !invoiceSearchTerm.trim()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {searchingInvoice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Search
                    </button>
                  </div>
                </div>
              )}

              {/* Error */}
              {invoiceError && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {invoiceError}
                </div>
              )}

              {/* Invoice Details */}
              {foundInvoice && !generatedLink && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Invoice Details
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left Column */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500">Invoice ID</p>
                          <p className="text-lg font-bold text-blue-600">{foundInvoice.invoiceId || foundInvoice.invoice_id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Invoice Date</p>
                          <p className="text-sm font-medium text-gray-900">{formatDateIST(foundInvoice.invoiceDate || foundInvoice.invoice_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Due Date</p>
                          <p className="text-sm font-medium text-gray-900">{formatDateIST(foundInvoice.dueDate || foundInvoice.due_date)}</p>
                        </div>
                      </div>
                      
                      {/* Right Column */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Amount</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(foundInvoice.totalAmount || foundInvoice.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Balance Due</p>
                          <p className="text-lg font-semibold text-orange-600">{formatCurrency(foundInvoice.balanceAmount || foundInvoice.balance_amount || foundInvoice.totalAmount || foundInvoice.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                            foundInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                            foundInvoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {foundInvoice.status || 'Draft'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <h4 className="text-xs font-semibold text-blue-800 uppercase mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Customer Details
                      </h4>
                      <p className="text-sm font-medium text-gray-900">{foundInvoice.customerName || foundInvoice.customer_name || '-'}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Mail className="w-3.5 h-3.5" />
                        {foundInvoice.customerEmail || foundInvoice.customer_email || '-'}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {foundInvoice.customerPhone || foundInvoice.customer_phone || '-'}
                      </p>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <h4 className="text-xs font-semibold text-green-800 uppercase mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Property Details
                      </h4>
                      <p className="text-sm font-medium text-gray-900">{foundInvoice.propertyName || foundInvoice.property_name || '-'}</p>
                      <p className="text-sm text-gray-600">Property ID: {foundInvoice.propertyCode || foundInvoice.property_code || '-'}</p>
                      <p className="text-sm text-gray-600">Estimate: {foundInvoice.sourceEstimateId || foundInvoice.source_estimate_id || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Existing Payment Link Warning */}
                  {(foundInvoice.payment_link || foundInvoice.paymentLink) && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
                      <p className="text-sm font-medium">This invoice already has a payment link:</p>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={foundInvoice.payment_link || foundInvoice.paymentLink}
                          readOnly
                          className="flex-1 text-sm bg-white border border-amber-300 rounded px-3 py-2"
                        />
                        <button
                          onClick={() => copyToClipboard(foundInvoice.payment_link || foundInvoice.paymentLink, 'existing')}
                          className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generated Link Success */}
              {generatedLink && (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Payment Link Generated!</h3>
                    <p className="text-gray-500 mt-1">The payment link has been created successfully</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Link</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={generatedLink.paymentLink || generatedLink.shortUrl}
                        readOnly
                        className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(generatedLink.paymentLink || generatedLink.shortUrl, 'generated')}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          copiedId === 'generated' 
                            ? 'bg-green-600 text-white' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {copiedId === 'generated' ? (
                          <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Copied!</span>
                        ) : (
                          <span className="flex items-center gap-2"><Copy className="w-4 h-4" /> Copy</span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(generatedLink.amount)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="text-lg font-bold text-green-600">{generatedLink.status}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Expires</p>
                      <p className="text-lg font-bold text-orange-600">{formatDateIST(generatedLink.expiresAt)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-100 flex justify-between">
              <button
                onClick={resetGenerateModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                {generatedLink ? 'Close' : 'Cancel'}
              </button>
              
              {foundInvoice && !generatedLink && (
                <button
                  onClick={generatePaymentLink}
                  disabled={generatingLink}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingLink ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Link2 className="w-4 h-4" /> Generate Payment Link</>
                  )}
                </button>
              )}
              
              {generatedLink && foundInvoice && (
                <button
                  onClick={() => sendPaymentLinkEmail(foundInvoice.id)}
                  disabled={actionLoading === foundInvoice.id}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading === foundInvoice.id ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Mail className="w-4 h-4" /> Send to Customer</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payment Link Details</h2>
                <p className="text-sm text-gray-500">{selectedLink.invoice_id}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Customer</label>
                  <p className="text-sm font-medium text-gray-900">{selectedLink.customer_name || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Email</label>
                  <p className="text-sm text-gray-900">{selectedLink.customer_email || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Amount</label>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedLink.balance_amount)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Status</label>
                  <div className="mt-1">
                    <StatusBadge status={selectedLink.payment_link_status} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Created</label>
                  <p className="text-sm text-gray-900">{formatDateIST(selectedLink.payment_link_created_at)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Sent</label>
                  <p className="text-sm text-gray-900">{formatDateIST(selectedLink.payment_link_sent_at) || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Expires</label>
                  <p className={`text-sm ${isExpired(selectedLink.payment_link_expires_at) ? 'text-red-500' : 'text-gray-900'}`}>
                    {formatDateIST(selectedLink.payment_link_expires_at)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Sent Via</label>
                  <p className="text-sm text-gray-900">{selectedLink.payment_link_sent_via || '-'}</p>
                </div>
              </div>
              
              {selectedLink.payment_link && (
                <div className="pt-4 border-t border-gray-100">
                  <label className="text-xs text-gray-500 font-medium">Payment Link</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedLink.payment_link}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"
                    />
                    <button
                      onClick={() => copyToClipboard(selectedLink.payment_link, selectedLink.invoice_db_id)}
                      className={`px-3 py-2 rounded-lg text-sm ${
                        copiedId === selectedLink.invoice_db_id 
                          ? 'bg-green-600 text-white' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {copiedId === selectedLink.invoice_db_id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Close
              </button>
              {selectedLink.payment_link_status !== 'paid' && !isExpired(selectedLink.payment_link_expires_at) && (
                <button
                  onClick={() => { sendPaymentLinkEmail(selectedLink.invoice_db_id); setShowDetailModal(false); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send via Email
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentLinks;
