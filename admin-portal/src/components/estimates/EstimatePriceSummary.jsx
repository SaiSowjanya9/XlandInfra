import { formatCurrency } from '../../utils/estimatePackageUtils';

/**
 * What the estimate comes to, in a card against the right edge.
 *
 * A money block reads down one edge: the figures line up on the right, the total is the last thing
 * the eye lands on, and the same four lines appear in the same order in the PDF and the email. One
 * component for the detail panel and for the Coordinator, Supervisor and Executive view modals,
 * which had four copies of it that had already drifted apart on whether a zero discount shows.
 */

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const number = value => Number(value || 0);

export default function EstimatePriceSummary({ estimate, className = '' }) {
  const subtotal = number(first(estimate.subtotal, estimate.subTotal, estimate.sub_total));
  const discountPercent = number(first(estimate.discount_percent, estimate.discountPercent));
  const discountAmount = number(first(estimate.discount_amount, estimate.discountAmount, estimate.discount));
  const gstPercent = number(first(estimate.gst_percent, estimate.gstPercent));
  const gstAmount = number(first(estimate.gst_amount, estimate.gstAmount, estimate.tax));
  const total = number(first(estimate.total_amount, estimate.totalAmount, estimate.total, estimate.totalPrice));

  // The cream skin the services table is drawn in: a warm caption bar, warm rules between the
  // lines, and the total on the tan accent in dark text -- white on tan does not meet contrast.
  return (
    <div className={`flex justify-end ${className}`}>
      <div className="w-full overflow-hidden rounded-lg border border-warm-border sm:w-72">
        <p className="border-b border-warm-border bg-warm-section px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-warm-muted">Price Summary</p>
        <div className="divide-y divide-warm-border/60">
          <div className="flex justify-between px-3 py-1.5 text-xs"><span className="text-warm-muted">Subtotal</span><span className="font-semibold text-warm-text">{formatCurrency(subtotal)}</span></div>
          {/* A discount is stated only when one was given: a line reading -₹0 says nothing */}
          {discountAmount > 0 && (
            <div className="flex justify-between px-3 py-1.5 text-xs"><span className="text-warm-muted">Discount ({discountPercent}%)</span><span className="font-semibold text-emerald-700">-{formatCurrency(discountAmount)}</span></div>
          )}
          <div className="flex justify-between px-3 py-1.5 text-xs"><span className="text-warm-muted">GST ({gstPercent}%)</span><span className="font-semibold text-warm-text">{formatCurrency(gstAmount)}</span></div>
        </div>
        <div className="flex items-center justify-between bg-warm-accent px-3 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-warm-text">Total</span>
          <span className="text-base font-bold text-warm-text">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
