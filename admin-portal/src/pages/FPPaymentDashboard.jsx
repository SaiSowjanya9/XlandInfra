import { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FPPaymentDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);

  const token = getAuthToken();

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/payments/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError(result.message || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  // Initial load and auto-refresh every 30 seconds
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(() => {
      fetchDashboard();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: 'Cash',
      upi_manual: 'UPI (Manual)',
      upi_online: 'UPI (Online)',
      bank_transfer: 'Bank Transfer',
      card_pos: 'Card/POS',
      razorpay: 'Razorpay',
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
      net_banking: 'Net Banking',
      wallet: 'Wallet'
    };
    return labels[method] || method;
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
      refunded: 'bg-gray-100 text-gray-700'
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = dashboardData || {
    totalInvoiceAmount: 0,
    totalCollected: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    paidInvoices: 0,
    partiallyPaidInvoices: 0,
    overdueInvoices: 0,
    totalInvoices: 0,
    todayCollections: 0,
    recentPayments: []
  };

  const collectionRate = stats.totalInvoiceAmount > 0
    ? ((stats.totalCollected / stats.totalInvoiceAmount) * 100).toFixed(1)
    : 0;

  // Only these roles can edit/record payments
  const canEdit = ['admin', 'operations_manager', 'franchise_partner', 'manager'].includes(user?.role);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of all payments and collections</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {canEdit && (
            <button
              onClick={() => navigate('/fp/payments/record')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoice Amount */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Invoice Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.totalInvoiceAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.totalInvoices} invoices</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Collected</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {formatCurrency(stats.totalCollected)}
              </p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                {collectionRate}% collection rate
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* Pending Amount */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Amount</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {formatCurrency(stats.pendingAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.partiallyPaidInvoices} partially paid</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue Amount</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">
                {formatCurrency(stats.overdueAmount)}
              </p>
              <p className="text-xs text-rose-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {stats.overdueInvoices} overdue invoices
              </p>
            </div>
            <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Today's Collection & Quick Actions */}
      <div className="grid grid-cols-3 gap-6">
        {/* Today's Collection */}
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm">Today's Collections</p>
              <p className="text-3xl font-bold mt-2">{formatCurrency(stats.todayCollections)}</p>
              <p className="text-slate-400 text-sm mt-2 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
            <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center">
              <IndianRupee className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Invoice Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Invoice Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Paid Invoices
              </span>
              <span className="font-semibold text-gray-900">{stats.paidInvoices}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Partially Paid
              </span>
              <span className="font-semibold text-gray-900">{stats.partiallyPaidInvoices}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Overdue
              </span>
              <span className="font-semibold text-gray-900">{stats.overdueInvoices}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/fp/payments/invoices')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">View All Invoices</span>
            </button>
            <button
              onClick={() => navigate('/fp/payments/history')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <Clock className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">Payment History</span>
            </button>
            {canEdit && (
              <button
                onClick={() => navigate('/fp/payments/invoices/create')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <CreditCard className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-gray-700">Create Invoice</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Payments</h3>
            <button
              onClick={() => navigate('/fp/payments/history')}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              View All
            </button>
          </div>
        </div>
        <div className="p-6">
          {stats.recentPayments && stats.recentPayments.length > 0 ? (
            <div className="space-y-4">
              {stats.recentPayments.map((payment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <IndianRupee className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{payment.customerName || 'Unknown Customer'}</p>
                      <p className="text-sm text-gray-500">
                        {payment.invoiceId} | {getPaymentMethodLabel(payment.paymentMethod)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(payment.amount)}</p>
                    <p className="text-xs text-gray-400">{formatDate(payment.paymentDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No recent payments</p>
              {canEdit && (
                <button
                  onClick={() => navigate('/fp/payments/record')}
                  className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Record your first payment
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FPPaymentDashboard;
