import { CheckCircle2, Wallet } from 'lucide-react';
import { formatPlanDate } from '../../utils/halfPayment';

/**
 * The "Payment Amount" chooser: Pay Full Amount vs Partial Payment as two radio cards, then —
 * when partial — a Percentage/Custom Amount pill row, the computed figures (paying now,
 * remaining, next due date), and the blue "Amount to Pay Now" summary bar.
 *
 * Percentage offers 25/50/75/100; the caller turns the selection into a `splitPaymentPlan` and
 * hands it back as `plan`, which supplies the remainder's due dates. Custom Amount carries the
 * typed figure the same way — the server validates it against the invoice balance either way.
 */
const inr = value =>
  '₹' + (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const PERCENTAGES = ['25', '50', '75', '100'];

const PaymentAmountSection = ({
  total,
  balance,
  plan,
  partial,
  onPartialChange,
  kind = 'percentage',
  onKindChange,
  percentage = '50',
  onPercentageChange,
  customAmount,
  onCustomAmountChange,
  canSplit = true
}) => {
  const balanceNum = Number(balance) || 0;
  const custom = parseFloat(customAmount);
  const payingNow = !partial
    ? balanceNum
    : kind === 'custom'
      ? (Number.isFinite(custom) ? custom : 0)
      : (plan ? plan.firstAmount : balanceNum);
  const remaining = Math.max(balanceNum - payingNow, 0);
  // A plan carries the policy dates; paying the whole balance as "100%" leaves nothing to schedule
  const nextDue = plan ? formatPlanDate(plan.secondDueDate) : '—';
  const dueLabel = plan ? 'After 6 Months' : 'Paid in full';

  const OptionCard = ({ selected, disabled, onClick, title, desc }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}>
        {selected && <span className="w-2 h-2 rounded-full bg-blue-500" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
      </span>
    </button>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-base">Payment Amount</h3>
        {canSplit && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Partially Paid Rule Enabled
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="pt-1">
          <p className="text-xs text-gray-500">Invoice Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{inr(total || balanceNum)}</p>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <OptionCard
            selected={!partial}
            onClick={() => onPartialChange(false)}
            title="Pay Full Amount"
            desc={`Pay the full invoice amount of ${inr(balanceNum)}`}
          />
          <OptionCard
            selected={partial}
            disabled={!canSplit}
            onClick={() => onPartialChange(true)}
            title="Partial Payment"
            desc="Pay a part of the invoice amount now"
          />
        </div>
      </div>

      {partial && (
        <>
          <div className="flex items-center gap-5 mt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="partial-kind"
                checked={kind === 'percentage'}
                onChange={() => onKindChange?.('percentage')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-800">Percentage</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="partial-kind"
                checked={kind === 'custom'}
                onChange={() => onKindChange?.('custom')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-800">Custom Amount</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">{kind === 'custom' ? 'Custom Amount' : 'Percentage'}</p>
              {kind === 'custom' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={e => onCustomAmountChange?.(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                />
              ) : (
                <select
                  value={percentage}
                  onChange={e => onPercentageChange?.(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                >
                  {PERCENTAGES.map(p => (
                    <option key={p} value={p}>{p}%</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Amount Paying Now</p>
              <p className="text-sm font-semibold text-gray-900 py-2">{inr(payingNow)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Remaining Balance</p>
              <p className="text-sm font-semibold text-gray-900 py-2">{inr(remaining)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Remaining Payment Due</p>
              <p className="text-sm font-semibold text-gray-900 py-2">{dueLabel}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Next Due Date</p>
              <p className="text-sm font-semibold text-gray-900 py-2">{nextDue}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
            <div className="flex items-center gap-3 shrink-0">
              <span className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-600" />
              </span>
              <span>
                <span className="block text-xs text-gray-500">Amount to Pay Now</span>
                <span className="block text-xl font-bold text-gray-900">{inr(payingNow)}</span>
              </span>
            </div>
            <p className="sm:ml-auto text-xs sm:text-sm text-gray-600">
              {remaining > 0
                ? `You will be charged ${inr(payingNow)} now. The remaining ${inr(remaining)} will be due on ${nextDue}${plan ? ' (after 6 months)' : ''}.`
                : `You will be charged ${inr(payingNow)} now — the invoice is settled in full.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default PaymentAmountSection;
