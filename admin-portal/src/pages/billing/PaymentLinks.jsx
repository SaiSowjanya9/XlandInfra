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
          <p className="text-sm text-gray-500 mt-1">Track online payment links for invoices (auto-generated when invoice is sent)</p>
        </div>
        <div className="flex gap-3">
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
              <p className="text-sm text-gray-400">Payment links are auto-generated when you send an invoice</p>
              <p className="text-xs text-gray-400 mt-2">Go to Invoices → Send Invoice to create payment links</p>
            </div>
          ) : paymentLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Link2 className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium">No payment links found</p>
              <p className="text-sm text-gray-400">Payment links are auto-generated when you send an invoice</p>
              <p className="text-xs text-gray-400 mt-2">Go to Invoices → Send Invoice to create payment links</p>
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
