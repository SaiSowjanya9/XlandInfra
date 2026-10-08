import { AlertTriangle } from 'lucide-react';

const inr = value =>
  '₹' + (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * The caution shown where a typed amount runs past what is still owed. An over-balance figure is
 * almost always a slip — ₹6,70,000 typed for ₹67,000 — so it is flagged in place, not left to
 * fail at submit. Renders nothing while the amount is within the balance.
 */
const AmountExceedsCaution = ({ amount, balance }) => {
  const over = parseFloat(amount);
  const owed = parseFloat(balance);
  if (!Number.isFinite(over) || !Number.isFinite(owed) || over <= owed) return null;
  return (
    <div className="mt-2 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800">
        <span className="font-semibold">Please check this amount.</span>{' '}
        It is more than the {inr(owed)} still owed on this invoice — a typing slip is easy to make
        (₹6,70,000 instead of ₹67,000). For the full balance, use Pay Full Amount.
      </p>
    </div>
  );
};

export default AmountExceedsCaution;
