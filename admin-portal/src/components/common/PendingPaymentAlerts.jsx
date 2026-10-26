import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const REFRESH_MS = 60 * 1000;
const METHOD_LABELS = { cash: 'Cash', cheque: 'Cheque', bank_transfer: 'Bank Transfer' };

const formatAmount = (value) =>
  `₹${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Customer offline payments waiting for a staff verification, for the Admin, Operations Manager,
 * Franchise Partner and Manager bells. Read live from the payments rows on the server, so an alert
 * goes away by itself once the payment is verified or rejected -- there is nothing to mark read.
 * A portal whose role cannot verify payments gets a 403 and simply shows no alerts.
 */
export const usePendingPaymentAlerts = () => {
  const [alerts, setAlerts] = useState([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payments/pending-offline-alerts`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result.success) setAlerts(result.data || []);
    } catch {
      // A failed poll leaves the last list in place; the next one tries again
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { alerts, reload: load };
};

/** The alerts as a section of a bell's dropdown. Renders nothing when there are none. */
const PendingPaymentAlerts = ({ alerts, paymentsPath, onNavigate }) => {
  const navigate = useNavigate();
  if (!alerts?.length) return null;

  const open = () => {
    onNavigate?.();
    navigate(paymentsPath);
  };

  return (
    <div>
      <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center gap-2 text-emerald-800">
          <Banknote className="w-4 h-4" />
          <span className="text-xs font-medium">Payments Awaiting Verification ({alerts.length})</span>
        </div>
      </div>
      {alerts.map((alert) => (
        <button
          key={`pay-${alert.id}`}
          type="button"
          onClick={open}
          className="w-full text-left px-4 py-3 border-b border-gray-100 bg-emerald-50/40 hover:bg-gray-50 transition-colors"
        >
          <p className="text-sm font-semibold text-gray-900 truncate">
            {alert.customerName || 'Customer'} · {formatAmount(alert.amount)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {METHOD_LABELS[alert.method] || alert.method}
            {alert.invoiceCode ? ` · ${alert.invoiceCode}` : ''}
            {alert.propertyCode ? ` · ${alert.propertyCode}` : ''}
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">Verify in Billing › Payments</p>
        </button>
      ))}
    </div>
  );
};

export default PendingPaymentAlerts;
