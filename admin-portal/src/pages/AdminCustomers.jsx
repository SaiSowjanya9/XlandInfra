import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Loader2, AlertCircle, CheckCircle, X, RefreshCw,
  UserPlus, Mail, ShieldCheck, ShieldOff, Send
} from 'lucide-react';
import { getAuthToken, safeStorage } from '../utils/safeStorage';
import { decodeEntities } from '../utils/text';
import { useFP } from '../contexts/FPContext';
import PageHeader, { HEADER_ACTION_CLASS, HEADER_GHOST_CLASS } from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Customers, for the admin portal -- the section the FP portal has, over every franchise partner.
 *
 * The list is the FP list's twin (search by name, email, phone or customer id), with two columns
 * only an admin needs: the owning franchise partner, because one table carries several
 * franchises, and the state of the customer's portal login.
 *
 * Adding a customer is the existing Add Customer screen, so this page links to it rather than
 * carrying a second copy of that 1,500-line form.
 *
 * `is_active` and `is_activated` are different things and the customer login reads both: a
 * disabled account (is_active = 0) is refused outright, while an account that was never activated
 * (is_activated = 0) is told to use the link from its email. The two controls below match that --
 * Enable/Disable for access, Resend activation for the link.
 */
const ACCOUNT_STATES = {
  disabled: { label: 'Disabled', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  pending: { label: 'Activation pending', className: 'bg-[#FEF3E2] text-[#B45309] border-[#F3E2B3]' },
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  legacy: { label: 'No portal login', className: 'bg-gray-50 text-gray-500 border-gray-200' }
};

const accountState = (customer) => {
  if (customer.source_type !== 'customer_account') return 'legacy';
  if (!customer.is_active) return 'disabled';
  return customer.is_activated ? 'active' : 'pending';
};

const AdminCustomers = () => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const { selectedFp } = useFP();

  // The Operations Manager reads this section like every other one; the server refuses its writes
  // too, so the buttons below are hidden rather than left to fail.
  const currentUser = JSON.parse(safeStorage.getItem('pm_current_user') || '{}');
  const canManage = !(currentUser?.role === 'operations_manager');

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  // 'all' is what FPContext stores for Admin (All FPs); only a real partner narrows the list.
  const fpId = selectedFp?.id && selectedFp.id !== 'all' ? Number(selectedFp.id) : null;

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const url = fpId
        ? `${API_BASE}/api/admin/customers?fpId=${fpId}`
        : `${API_BASE}/api/admin/customers`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      if (result.success) {
        setCustomers(Array.isArray(result.data) ? result.data : []);
      } else {
        setLoadError(result.message || 'Failed to load customers.');
      }
    } catch (e) {
      setLoadError('Failed to load customers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token, fpId]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const accountAction = async (customer, action, successFallback) => {
    setBusyId(customer.id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/customer-accounts/${customer.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      showToast(result.message || successFallback, result.success ? 'success' : 'error');
      if (result.success) loadCustomers();
    } catch (e) {
      showToast('The request failed. Please try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) => (
      decodeEntities(c.name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term) ||
      (c.client_id || '').toLowerCase().includes(term) ||
      decodeEntities(c.property_name || '').toLowerCase().includes(term) ||
      (c.property_code || '').toLowerCase().includes(term)
    ));
  }, [customers, searchTerm]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        icon={Users}
        title="Customers"
        subtitle={selectedFp && selectedFp.id !== 'all'
          ? `${filtered.length} customers — ${decodeEntities(selectedFp.companyName || selectedFp.company_name || '')}`
          : `${filtered.length} customers across all franchise partners`}
      >
        <button onClick={loadCustomers} className={HEADER_GHOST_CLASS} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button onClick={() => navigate('/employee/create-customer')} className={HEADER_ACTION_CLASS}>
          <UserPlus className="w-4 h-4" /> Add Customer
        </button>
      </PageHeader>

      {toast && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search customers by name, email, phone, customer ID or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#B5812A] mx-auto" />
            <p className="text-gray-500 mt-2">Loading customers...</p>
          </div>
        ) : loadError ? (
          <div className="p-6 flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{loadError}</span>
            <button onClick={loadCustomers} className="ml-auto text-sm font-medium underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={customers.length === 0 ? 'No customers yet' : 'No customers match that search'}
            description={customers.length === 0
              ? 'Customers appear here once a property is onboarded with a contact.'
              : 'Try a different name, email, phone number or property.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-600 whitespace-nowrap">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 whitespace-nowrap">Franchise Partner</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 whitespace-nowrap">Property</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 whitespace-nowrap">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600 whitespace-nowrap">Portal Login</th>
                  {canManage && <th className="text-left py-3 px-4 font-medium text-gray-600 whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => {
                  const state = accountState(customer);
                  const badge = ACCOUNT_STATES[state];
                  const isAccount = customer.source_type === 'customer_account';
                  const busy = busyId === customer.id;
                  return (
                    <tr key={`${customer.source_type}-${customer.id}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#F6EBD1] flex items-center justify-center flex-shrink-0">
                            <span className="text-[#B5812A] font-semibold">
                              {(decodeEntities(customer.name || '').trim()[0] || 'C').toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {decodeEntities(customer.name || '').trim() || customer.client_id || '-'}
                            </div>
                            <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                              {customer.email ? <><Mail className="w-3 h-3" />{customer.email}</> : customer.client_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700">{decodeEntities(customer.franchise_partner_name || '') || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{decodeEntities(customer.property_name || '') || '-'}</div>
                        <div className="text-xs text-gray-500">{customer.property_code || ''}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{customer.phone || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      {canManage && (
                        <td className="py-3 px-4">
                          {!isAccount ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {customer.is_active ? (
                                <button
                                  onClick={() => accountAction(customer, 'deactivate', 'Account disabled')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                  title="Block this customer from signing in"
                                >
                                  <ShieldOff className="w-3.5 h-3.5" /> Disable
                                </button>
                              ) : (
                                <button
                                  onClick={() => accountAction(customer, 'activate', 'Account enabled')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  title="Restore this customer's access"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" /> Enable
                                </button>
                              )}
                              {!customer.is_activated && (
                                <button
                                  onClick={() => accountAction(customer, 'resend-activation', 'Activation email sent')}
                                  disabled={busy}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#E8DFC9] text-xs font-medium text-[#B5812A] hover:bg-[#F6EBD1] disabled:opacity-50"
                                  title="Email a fresh activation link and temporary password"
                                >
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Resend activation
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
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

export default AdminCustomers;
