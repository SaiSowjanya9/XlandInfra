import { invoiceSummary } from '../../utils/invoiceSummary';

/**
 * What an invoice comes to, in a card against the right edge.
 *
 * One component for every staff portal's invoice document -- the Invoices modal, the Generated
 * Invoices modal and the FP invoice page all mount it, so the six portals cannot state the figures
 * in different orders. The lines come from `utils/invoiceSummary.js`, the twin of the backend
 * helper the PDF and the invoice emails draw from.
 *
 *   Sub Total
 *   GST (n%)        always, whatever the rate
 *   Discount (n%)   only where the estimate behind the invoice carried one
 *   Total
 *   Balance Due     always: the total until something is paid, 0 once settled in full
 *
 * Balance Due sits *below* the Total rule rather than among the lines above it: it is read from
 * the total, not summed into it. It replaced an Amount Paid / Balance Due pair that rendered only
 * once something had been paid, so an unpaid invoice never said what was owed.
 */

const rupees = value => `Rs. ${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

export default function InvoiceSummaryCard({ invoice, className = '' }) {
  const summary = invoiceSummary(invoice || {});
  const settled = summary.balanceDue <= 0;

  return (
    <div className={`flex justify-end ${className}`}>
      <div className="w-64">
        <div className="overflow-hidden rounded-lg border border-warm-border">
          <p className="border-b border-warm-border bg-warm-section px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-warm-muted">Price Summary</p>
          <div className="divide-y divide-warm-border/60">
            {summary.lines.map(line => (
              <div key={line.key} className="flex justify-between px-3 py-1.5 text-xs">
                <span className="text-warm-muted">{line.label}</span>
                <span className={`font-semibold ${line.negative ? 'text-emerald-700' : 'text-warm-text'}`}>
                  {line.negative ? '-' : ''}{rupees(line.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between bg-warm-accent-soft border-t border-warm-border px-3 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-warm-text">{summary.totalLabel}</span>
            <span className="text-base font-bold text-warm-text">{rupees(summary.totalAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-warm-border bg-white px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-warm-muted">{summary.balanceLabel}</span>
            <span className={`text-sm font-bold ${settled ? 'text-emerald-700' : 'text-red-600'}`}>{rupees(summary.balanceDue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
