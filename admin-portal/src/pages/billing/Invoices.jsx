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
  Trash2,
  RotateCcw,
  Archive,
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { exportInvoiceToPDF } from '../../utils/pdfExport';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Format date in IST format (dd/mm/yyyy)
const formatDateIST = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date)) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Parse dd/mm/yyyy to yyyy-mm-dd
const parseISTDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Handle date input with auto-formatting
const handleDateInput = (value, setter) => {
  let cleaned = value.replace(/[^\d/]/g, '');
  if (cleaned.length === 2 && !cleaned.includes('/')) cleaned += '/';
  else if (cleaned.length === 5 && cleaned.split('/').length === 2) cleaned += '/';
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
  setter(cleaned);
};

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

// Tab configuration for invoice types
const INVOICE_TABS = [
  { id: 'generated', label: 'Estimate Invoices', filter: 'estimate', icon: FileText },
  { id: 'work_order', label: 'Work Order Invoices', filter: 'work_order', icon: Receipt },
  { id: 'archived', label: 'Archived', filter: 'archived', icon: Archive }
];

const Invoices = ({ user, portalType = 'admin', defaultTab = 'generated' }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [archivedInvoices, setArchivedInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [dateRangeDisplay, setDateRangeDisplay] = useState({ start: '', end: '' });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const itemsPerPage = 10;
  
  // Get the current tab's filter value
  const typeFilter = INVOICE_TABS.find(t => t.id === activeTab)?.filter || 'all';

  const token = getAuthToken();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL active invoices (filter by type on client side)
      let url = `${API_BASE}/api/payments/invoices`;
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      params.append('archived', 'false');
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data || []);
      }
      
      // Fetch archived invoices
      const archivedResponse = await fetch(`${API_BASE}/api/payments/invoices?archived=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const archivedResult = await archivedResponse.json();
      if (archivedResult.success) {
        setArchivedInvoices(archivedResult.data || []);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, searchTerm, dateRange]);

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

  // Archive invoice (soft delete)
  const handleArchiveInvoice = async (invoice) => {
    try {
      setActionLoading(invoice.id);
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoice.id}/archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Invoice archived successfully');
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to archive invoice', 'error');
      }
    } catch (err) {
      showToast('Failed to archive invoice', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Restore archived invoice
  const handleRestoreInvoice = async (invoice) => {
    try {
      setActionLoading(invoice.id);
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoice.id}/restore`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Invoice restored successfully');
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to restore invoice', 'error');
      }
    } catch (err) {
      showToast('Failed to restore invoice', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Permanently delete invoice
  const handleDeleteInvoice = async (invoiceId) => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast('Invoice deleted permanently');
        setDeleteConfirm(null);
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to delete invoice', 'error');
      }
    } catch (err) {
      showToast('Failed to delete invoice', 'error');
    }
  };

  // Delete all archived invoices
  const handleDeleteAllArchived = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/invoices/archived/delete-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        showToast(`Deleted ${result.deletedCount || archivedInvoices.length} archived invoices`);
        setShowDeleteAllConfirm(false);
        fetchInvoices();
      } else {
        showToast(result.message || 'Failed to delete archived invoices', 'error');
      }
    } catch (err) {
      showToast('Failed to delete archived invoices', 'error');
    }
  };

  // Download invoice PDF using frontend jsPDF (matches Estimate format)
  const handleDownloadPDF = async (invoice) => {
    try {
      setActionLoading(invoice.id);
      
      // Use frontend PDF export (consistent with Estimate PDF format)
      const success = exportInvoiceToPDF({
        invoiceId: invoice.invoiceId || invoice.invoice_id,
        invoiceDate: invoice.invoiceDate || invoice.invoice_date,
        dueDate: invoice.dueDate || invoice.due_date,
        status: invoice.status,
        propertyCode: invoice.propertyCode || invoice.property_code,
        propertyName: invoice.propertyName || invoice.property_name,
        customerName: invoice.customerName || invoice.customer_name,
        customerEmail: invoice.customerEmail || invoice.customer_email,
        customerPhone: invoice.customerPhone || invoice.customer_phone,
        lineItems: invoice.lineItems || invoice.line_items || [],
        subtotal: invoice.subtotal,
        discountAmount: invoice.discountAmount || invoice.discount_amount,
        taxPercentage: invoice.taxPercentage || invoice.tax_percentage,
        taxAmount: invoice.taxAmount || invoice.tax_amount,
        totalAmount: invoice.totalAmount || invoice.total_amount,
        amountPaid: invoice.amountPaid || invoice.amount_paid,
        balanceAmount: invoice.balanceAmount || invoice.balance_amount,
        sourceEstimateId: invoice.sourceEstimateId || invoice.source_estimate_id
      });
      
      if (success) {
        showToast('Invoice PDF downloaded');
      } else {
        showToast('Failed to generate PDF', 'error');
      }
    } catch (err) {
      console.error('PDF download error:', err);
      showToast('Failed to download invoice', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Comprehensive export with all page details
  const exportToExcel = () => {
    if (filteredInvoices.length === 0) {
      showToast('No invoices to export', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();
    const exportDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const currentTabLabel = INVOICE_TABS.find(t => t.id === activeTab)?.label || 'All';
    
    // Calculate totals
    const totalAmount = filteredInvoices.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0);
    const totalPaid = filteredInvoices.reduce((sum, i) => sum + (parseFloat(i.amountPaid) || 0), 0);
    const totalBalance = filteredInvoices.reduce((sum, i) => sum + (parseFloat(i.balanceAmount) || 0), 0);

    // Sheet 1: Summary
    const summaryData = [
      ['INVOICES REPORT'],
      ['Generated on:', exportDate],
      [''],
      ['CURRENT VIEW'],
      ['Tab:', currentTabLabel],
      ['Total Records:', filteredInvoices.length],
      [''],
      ['SUMMARY STATISTICS'],
      ['Metric', 'Count', 'Amount (₹)'],
      ['Total Invoices', filteredInvoices.length, totalAmount],
      ['Draft', filteredInvoices.filter(i => i.status === 'draft').length, filteredInvoices.filter(i => i.status === 'draft').reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0)],
      ['Sent', filteredInvoices.filter(i => i.status === 'sent').length, filteredInvoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0)],
      ['Paid', filteredInvoices.filter(i => i.status === 'paid').length, filteredInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0)],
      ['Partially Paid', filteredInvoices.filter(i => i.status === 'partially_paid').length, filteredInvoices.filter(i => i.status === 'partially_paid').reduce((sum, i) => sum + (parseFloat(i.amountPaid) || 0), 0)],
      ['Overdue', filteredInvoices.filter(i => i.status === 'overdue').length, filteredInvoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (parseFloat(i.balanceAmount) || 0), 0)],
      [''],
      ['AMOUNT SUMMARY'],
      ['Total Invoice Amount:', '', totalAmount],
      ['Total Amount Paid:', '', totalPaid],
      ['Total Balance Due:', '', totalBalance],
      [''],
      ['FILTERS APPLIED'],
      ['Status Filter:', statusFilter === 'all' ? 'All Status' : STATUS_CONFIG[statusFilter]?.label || statusFilter],
      ['Date Range:', dateRange.start || dateRange.end ? `${dateRange.start || 'Start'} to ${dateRange.end || 'End'}` : 'All Dates'],
      ['Search Term:', searchTerm || 'None']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: All Invoices Data
    const invoicesData = filteredInvoices.map((inv, idx) => ({
      'S.No': idx + 1,
      'Invoice ID': inv.invoiceId,
      'Property ID': inv.propertyCode || '-',
      'Property Name': inv.propertyName || '-',
      'Customer Name': inv.customerName || '-',
      'Customer Email': inv.customerEmail || '-',
      'Customer Phone': inv.customerPhone || '-',
      'Invoice Type': INVOICE_TYPE_CONFIG[inv.invoiceType]?.label || 'Manual',
      'Invoice Date': formatDate(inv.invoiceDate),
      'Due Date': formatDate(inv.dueDate),
      'Subtotal (₹)': parseFloat(inv.subtotal) || 0,
      'Discount (%)': parseFloat(inv.discountPercent) || 0,
      'Discount Amount (₹)': parseFloat(inv.discountAmount) || 0,
      'Tax/GST (%)': parseFloat(inv.taxPercent) || 0,
      'Tax Amount (₹)': parseFloat(inv.taxAmount) || 0,
      'Total Amount (₹)': parseFloat(inv.totalAmount) || 0,
      'Amount Paid (₹)': parseFloat(inv.amountPaid) || 0,
      'Balance Due (₹)': parseFloat(inv.balanceAmount) || 0,
      'Status': STATUS_CONFIG[inv.status]?.label || inv.status,
      'Payment Status': inv.paymentStatus || '-',
      'Created At': formatDate(inv.createdAt)
    }));

    const wsInvoices = XLSX.utils.json_to_sheet(invoicesData);
    wsInvoices['!cols'] = [
      { wch: 6 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 20 },
      { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // Sheet 3: Status Breakdown
    const statusBreakdown = Object.entries(STATUS_CONFIG).map(([key, config]) => {
      const statusInvoices = filteredInvoices.filter(i => i.status === key);
      return {
        'Status': config.label,
        'Count': statusInvoices.length,
        'Total Amount (₹)': statusInvoices.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0),
        'Amount Paid (₹)': statusInvoices.reduce((sum, i) => sum + (parseFloat(i.amountPaid) || 0), 0),
        'Balance Due (₹)': statusInvoices.reduce((sum, i) => sum + (parseFloat(i.balanceAmount) || 0), 0)
      };
    }).filter(s => s.Count > 0);
    
    if (statusBreakdown.length > 0) {
      const wsStatus = XLSX.utils.json_to_sheet(statusBreakdown);
      wsStatus['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsStatus, 'By Status');
    }

    // Sheet 4: Invoice Type Breakdown
    const typeBreakdown = Object.entries(INVOICE_TYPE_CONFIG).map(([key, config]) => {
      const typeInvoices = filteredInvoices.filter(i => i.invoiceType === key);
      return {
        'Invoice Type': config.label,
        'Count': typeInvoices.length,
        'Total Amount (₹)': typeInvoices.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0)
      };
    }).filter(t => t.Count > 0);
    
    if (typeBreakdown.length > 0) {
      const wsType = XLSX.utils.json_to_sheet(typeBreakdown);
      wsType['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsType, 'By Type');
    }

    const fileName = `Invoices_${currentTabLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Exported successfully!');
  };

  // Filter invoices based on active tab
  const filteredInvoices = activeTab === 'archived' 
    ? archivedInvoices 
    : invoices.filter(i => {
        const currentFilter = INVOICE_TABS.find(t => t.id === activeTab)?.filter;
        if (currentFilter === 'estimate') return i.invoiceType === 'estimate' || i.invoiceType === 'manual';
        if (currentFilter === 'work_order') return i.invoiceType === 'work_order';
        return true;
      });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
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
          {activeTab === 'manual' && (
            <button
              onClick={() => navigate(`/${portalType === 'admin' ? 'employee' : portalType}/billing/create-invoice`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          )}
        </div>
        
        {/* Invoice Type Tabs */}
        <div className="flex gap-1 mt-4 border-b border-gray-200 -mb-4">
          {INVOICE_TABS.map(tab => {
            const Icon = tab.icon;
            const count = tab.filter === 'archived' 
              ? archivedInvoices.length
              : invoices.filter(i => 
                  tab.filter === 'estimate' ? i.invoiceType === 'estimate' :
                  tab.filter === 'manual' ? i.invoiceType === 'manual' :
                  tab.filter === 'work_order' ? i.invoiceType === 'work_order' : true
                ).length;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>{count}</span>
              </button>
            );
          })}
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

            {/* Date Range - IST Format (dd/mm/yyyy) */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateRangeDisplay.start}
                  onChange={(e) => {
                    handleDateInput(e.target.value, (val) => setDateRangeDisplay(prev => ({ ...prev, start: val })));
                    const parsed = parseISTDate(e.target.value);
                    if (parsed) setDateRange(prev => ({ ...prev, start: parsed }));
                  }}
                  className="text-sm border-none focus:outline-none bg-transparent w-[90px]"
                />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange(prev => ({ ...prev, start: e.target.value }));
                      setDateRangeDisplay(prev => ({ ...prev, start: formatDateIST(e.target.value) }));
                    }
                  }}
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  value={dateRangeDisplay.end}
                  onChange={(e) => {
                    handleDateInput(e.target.value, (val) => setDateRangeDisplay(prev => ({ ...prev, end: val })));
                    const parsed = parseISTDate(e.target.value);
                    if (parsed) setDateRange(prev => ({ ...prev, end: parsed }));
                  }}
                  className="text-sm border-none focus:outline-none bg-transparent w-[90px]"
                />
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateRange(prev => ({ ...prev, end: e.target.value }));
                      setDateRangeDisplay(prev => ({ ...prev, end: formatDateIST(e.target.value) }));
                    }
                  }}
                />
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
        {activeTab === 'archived' ? (
          /* Archived Invoices Section - Matching Archived Estimates Design */
          <div className="space-y-4">
            {/* Header Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Archived Invoices</h2>
                    <p className="text-sm text-gray-500">View and manage archived invoices</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <button
                    onClick={fetchInvoices}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-6 border-l border-gray-200 pl-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
                      <p className="text-xs text-gray-500">Active Invoices</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{invoices.filter(i => i.status === 'paid').length}</p>
                      <p className="text-xs text-gray-500">Paid</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{invoices.filter(i => i.status === 'partially_paid').length}</p>
                      <p className="text-xs text-gray-500">Partial</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{archivedInvoices.length}</p>
                      <p className="text-xs text-gray-500">Archived</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Row */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Type:</span>
                  <select
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer"
                    defaultValue="all"
                  >
                    <option value="all">All Types</option>
                    <option value="estimate">Estimate</option>
                    <option value="work_order">Work Order</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                
                {archivedInvoices.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All ({archivedInvoices.length})
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {archivedInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Archive className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-lg font-medium">No archived invoices</p>
                  <p className="text-sm">Archived invoices will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Archived On</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {archivedInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => openInvoiceDetail(invoice)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {invoice.invoiceId}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-sm font-medium ${INVOICE_TYPE_CONFIG[invoice.invoiceType]?.color || 'text-gray-600'}`}>
                              {INVOICE_TYPE_CONFIG[invoice.invoiceType]?.label || 'Manual'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600">{invoice.propertyCode || invoice.propertyName || '-'}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-800">{invoice.customerName || '-'}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">{formatDate(invoice.archivedAt || invoice.updatedAt)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1">
                              {/* View */}
                              <button
                                onClick={() => openInvoiceDetail(invoice)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {/* Restore */}
                              <button
                                onClick={() => handleRestoreInvoice(invoice)}
                                disabled={actionLoading === invoice.id}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Restore Invoice"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              {/* Download */}
                              <button
                                onClick={() => handleDownloadPDF(invoice)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {/* Delete Permanently */}
                              <button
                                onClick={() => setDeleteConfirm(invoice)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Permanently"
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
              )}
            </div>
          </div>
        ) : (
        <div className="flex gap-6">
          {/* Table */}
          <div className={`flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 ${showDetailPanel ? 'mr-[380px]' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : paginatedInvoices.length === 0 ? (
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
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
                          className={`hover:bg-gray-50 transition-colors ${selectedInvoice?.id === invoice.id ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => openInvoiceDetail(invoice)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {invoice.invoiceId}
                            </button>
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
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{formatDate(invoice.invoiceDate)}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
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
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              {/* View */}
                              <button
                                onClick={() => openInvoiceDetail(invoice)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {/* Download */}
                              <button
                                onClick={() => handleDownloadPDF(invoice)}
                                disabled={actionLoading === invoice.id}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {/* Archive (soft delete) */}
                              <button
                                onClick={() => handleArchiveInvoice(invoice)}
                                disabled={actionLoading === invoice.id}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Archive Invoice"
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
                    Showing {filteredInvoices.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
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

        </div>
        )}
      </div>

      {/* Invoice Detail Modal/Lightbox */}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Invoice</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently delete invoice <strong>{deleteConfirm.invoiceId}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteInvoice(deleteConfirm.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-100 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete All Archived Invoices</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently delete all <strong>{archivedInvoices.length}</strong> archived invoices? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllArchived}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

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

// Invoice Detail Modal (Lightbox)
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
  // Parse line items
  const lineItems = invoice.lineItems ? (typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems) : [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">{invoice.invoiceId}</h2>
              <p className="text-blue-100 text-sm">Invoice Details</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-xs font-medium rounded-full bg-white/20 text-white`}>
              {STATUS_CONFIG[invoice.status]?.label || invoice.status}
            </span>
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          {/* Customer & Property Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Customer Details</h3>
              <p className="text-sm font-medium text-gray-900">{invoice.customerName || '-'}</p>
              <p className="text-sm text-gray-600">{invoice.customerEmail || '-'}</p>
              <p className="text-sm text-gray-600">{invoice.customerPhone || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Property Details</h3>
              <p className="text-sm font-medium text-gray-900">{invoice.propertyName || '-'}</p>
              <p className="text-sm text-gray-600">Property ID: {invoice.propertyCode || '-'}</p>
              {invoice.sourceEstimateId && <p className="text-sm text-gray-600">Estimate: {invoice.sourceEstimateId}</p>}
              {invoice.sourceWorkOrderId && <p className="text-sm text-gray-600">Work Order: {invoice.sourceWorkOrderId}</p>}
            </div>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Invoice Date</p>
              <p className="text-sm font-semibold text-gray-900">{formatDate(invoice.invoiceDate)}</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Due Date</p>
              <p className={`text-sm font-semibold ${invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>
                {formatDate(invoice.dueDate)}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Invoice Type</p>
              <p className="text-sm font-semibold text-gray-900">
                {INVOICE_TYPE_CONFIG[invoice.invoiceType]?.label || 'Manual'}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Payment Status</p>
              <p className={`text-sm font-semibold ${
                invoice.paymentStatus === 'paid' ? 'text-green-600' : 
                invoice.paymentStatus === 'partially_paid' ? 'text-orange-600' : 'text-red-600'
              }`}>
                {invoice.paymentStatus === 'paid' ? 'Paid' : invoice.paymentStatus === 'partially_paid' ? 'Partial' : 'Unpaid'}
              </p>
            </div>
          </div>

          {/* Services & Add-ons */}
          {(() => {
            // Filter out AMC Package entries
            const filteredItems = lineItems.filter(item => {
              const desc = String(item.description || item.name || '').toLowerCase();
              return !desc.includes('amc package') && !desc.includes('amc services');
            });

            // Helper to check if item is addon
            const isAddon = (item) => {
              const typeStr = String(item.type || '').toLowerCase();
              return typeStr === 'addon' || typeStr === 'add-on' || typeStr === 'add_on';
            };

            // Helper to extract frequency
            const getFrequency = (item) => {
              const freq = item.frequency || item.frequencyType || item.frequency_type || item.billingDuration || '';
              if (!freq || freq === '-') return '-';
              // Capitalize first letter
              return String(freq).charAt(0).toUpperCase() + String(freq).slice(1).toLowerCase();
            };

            // Separate services and addons
            const services = filteredItems.filter(item => !isAddon(item)).map(item => {
              const fullDesc = String(item.description || item.name || 'Service');
              const parts = fullDesc.split(' - ');
              return {
                name: parts[0] || 'Service',
                description: parts.slice(1).join(' - ') || '-',
                frequency: getFrequency(item),
                visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1
              };
            });

            const addons = filteredItems.filter(item => isAddon(item)).map(item => {
              const fullDesc = String(item.description || item.name || 'Add-on');
              const parts = fullDesc.split(' - ');
              return {
                name: parts[0] || 'Add-on',
                description: parts.slice(1).join(' - ') || '-',
                frequency: getFrequency(item),
                visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1
              };
            });

            return (
              <>
                {/* Services Included */}
                {services.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Services Included</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-8">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Service</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Frequency</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Visits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {services.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-sm text-gray-600 text-center">{idx + 1}</td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.name}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{item.description}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-center">{item.frequency}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-center">{item.visits}</td>
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
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Add-Ons</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-8">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Add-on Service</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Frequency</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Visits</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {addons.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 text-sm text-gray-600 text-center">{idx + 1}</td>
                              <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.name}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{item.description}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-center">{item.frequency}</td>
                              <td className="px-3 py-2 text-sm text-gray-600 text-center">{item.visits}</td>
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

          {/* Amount Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount ({invoice.discountPercentage}%)</span>
                  <span className="text-green-600">-{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST ({invoice.taxPercentage || 18}%)</span>
                <span className="text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                <span className="text-gray-900">Total Amount</span>
                <span className="text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid</span>
                <span className="text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span className="text-gray-900">Balance Due</span>
                <span className={invoice.balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(invoice.balanceAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Payment History</h3>
              <div className="space-y-2">
                {invoice.payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDate(payment.paymentDate)}</p>
                      <p className="text-xs text-gray-500">{payment.paymentMethod}</p>
                    </div>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Eye className="w-4 h-4" />
              View PDF
            </button>
            <button 
              onClick={() => onSend(invoice)}
              disabled={actionLoading === invoice.id}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Send Invoice
            </button>
          </div>
          <button
            onClick={onRecordPayment}
            disabled={invoice.balanceAmount <= 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </button>
        </div>
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
    { value: 'debit_credit_card', label: 'Debit/Credit Card', icon: CreditCard },
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
