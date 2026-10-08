import { Wallet } from 'lucide-react';
import { formatPlanDate } from '../../utils/halfPayment';
import AmountExceedsCaution from './AmountExceedsCaution';

/**
 * The "Payment Amount" chooser: Pay Full Amount vs Partial Payment as two radio cards, then —
 * when partial — a Percentage/Custom Amount pill row, the computed figures (paying now,
 * remaining, next due date), and the blue "Amount to Pay Now" summary bar.
 *
 * Percentage offers 25/50/75/100; the caller turns the selection into a `splitPaymentPlan` and
 * hands it back as `plan`, which supplies the remainder's due dates. Custom Amount carries the
 * typed figure the same way — the server validates it against the invoice balance either way.
 *
 * `fixedPercentage` locks the partial to one share (the customer payment page offers only
 * 50/50): the kind radios and the select/input are not rendered, the card says what the part
 * payment is, and the figures read off the plan the caller computed for that share.
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
  canSplit = true,
  fixedPercentage
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
      className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 text-left transition-colors ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{desc}</span>
      </span>
    </button>
  );

  const Figure = ({ label, children }) => (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1.5 whitespace-nowrap">{label}</p>
      {children}
    </div>
  );

  const figureValue = 'text-base font-semibold text-gray-900 leading-none py-1.5';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-5">Payment Amount</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Invoice Total</p>
          <p className="text-[28px] leading-tight font-bold text-gray-900 mt-1.5">{inr(total || balanceNum)}</p>
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
            desc={fixedPercentage
              ? `Pay ${fixedPercentage}% now, the rest later`
              : 'Pay a part of the invoice amount now'}
          />
        </div>
      </div>

      {partial && (
        <div className="mt-6 pt-5 border-t border-gray-100">
          {!fixedPercentage && (
            <div className="flex items-center gap-6 mb-4">
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
          )}

          <div className="grid grid-cols-2 sm:grid-cols-[0.9fr_1fr_1fr_1.15fr_1fr] gap-x-4 gap-y-5">
            <Figure label={!fixedPercentage && kind === 'custom' ? 'Custom Amount' : 'Percentage'}>
              {fixedPercentage ? (
                <p className={figureValue}>{fixedPercentage}%</p>
              ) : kind === 'custom' ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={e => onCustomAmountChange?.(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Enter amount"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                />
              ) : (
                <select
                  value={percentage}
                  onChange={e => onPercentageChange?.(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none"
                >
                  {PERCENTAGES.map(p => (
                    <option key={p} value={p}>{p}%</option>
                  ))}
                </select>
              )}
            </Figure>
            <Figure label="Amount Paying Now">
              <p className={`${figureValue} text-blue-700`}>{inr(payingNow)}</p>
            </Figure>
            <Figure label="Remaining Balance">
              <p className={figureValue}>{inr(remaining)}</p>
            </Figure>
            <Figure label="Remaining Due">
              <p className={figureValue}>{dueLabel}</p>
            </Figure>
            <Figure label="Next Due Date">
              <p className={figureValue}>{nextDue}</p>
            </Figure>
          </div>

          <AmountExceedsCaution
            amount={!fixedPercentage && kind === 'custom' ? customAmount : 0}
            balance={balanceNum}
          />

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4">
            <div className="flex items-center gap-3.5 shrink-0">
              <span className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-600" />
              </span>
              <span>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-gray-500">Amount to Pay Now</span>
                <span className="block text-2xl font-bold text-gray-900 leading-tight mt-0.5">{inr(payingNow)}</span>
              </span>
            </div>
            <p className="sm:ml-auto text-sm text-gray-600 leading-relaxed max-w-md">
              {remaining > 0
                ? `You will be charged ${inr(payingNow)} now. The remaining ${inr(remaining)} will be due on ${nextDue}${plan ? ' (after 6 months)' : ''}.`
                : `You will be charged ${inr(payingNow)} now — the invoice is settled in full.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentAmountSection;
