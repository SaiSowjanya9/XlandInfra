/**
 * The invoice summary -- one block of figures, in one order, on every surface.
 *
 * The client twin of `backend/utils/invoiceSummary.js`, which the PDF and the invoice emails draw
 * from. This copy is shared by the staff portals (`admin-portal`) and the customer portal
 * (`frontend`) and **the two files are identical**: `invoiceSummaryView.test.js` fails if they
 * drift.
 *
 * An invoice states its money as:
 *
 *   Sub Total
 *   GST (n%)        always, whatever the rate -- see below
 *   Discount (n%)   only where the estimate behind the invoice carried one
 *   Total
 *   Balance Due     always: the total until something is paid, 0 once it is settled in full
 *
 * **GST is stated, not omitted.** The rate on every invoice raised since GST was unlinked from the
 * estimate is 0 (see AGENTS.md "An Invoice Carries No GST" -- the estimate's rate is still never
 * copied, and no screen offers a GST field on an invoice), and the user's call is that the line is
 * printed at that rate rather than left out: a summary that jumps from Sub Total to Total reads as
 * though a tax line went missing. A historic invoice that really was billed 18% keeps its own
 * `taxPercentage`/`taxAmount`, so the line states what that invoice charged.
 *
 * **Balance Due is stated, not conditional.** Every surface used to print Amount Paid and Balance
 * Due together and only once something had been paid, so an unpaid invoice never said what was
 * owed and a settled one said nothing either. Amount Paid is gone from the summary -- the
 * payments list beneath it is the record of what came in -- and Balance Due always renders, so a
 * payment made in any portal is read straight off it: 0 once the invoice is settled in full.
 */

const figure = value => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

const pick = (source, ...keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

/** A rate reads as the whole number it usually is (0%, 18%) and keeps its decimals when it is not. */
const ratePercent = value => {
  const number = figure(value);
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)));
};

export const SUBTOTAL_LABEL = 'Sub Total';
export const TOTAL_LABEL = 'Total';
export const BALANCE_LABEL = 'Balance Due';

/**
 * The summary of an invoice row, a draft's totals or an API payload -- snake_case and camelCase
 * keys are both read, so a caller hands over whichever shape it already has.
 */
export const invoiceSummary = (invoice = {}) => {
  const subtotal = figure(pick(invoice, 'subtotal', 'sub_total'));
  const taxPercentage = figure(pick(invoice, 'taxPercentage', 'tax_percentage', 'taxPercent', 'tax_percent'));
  const taxAmount = figure(pick(invoice, 'taxAmount', 'tax_amount'));
  const discountAmount = figure(pick(invoice, 'discountAmount', 'discount_amount'));
  const totalAmount = figure(pick(invoice, 'totalAmount', 'total_amount'));
  const amountPaid = figure(pick(invoice, 'amountPaid', 'amount_paid'));
  // A fixed-amount discount carries no percentage of its own; it is what the amount came to
  const storedDiscountPercentage = figure(pick(invoice, 'discountPercentage', 'discount_percentage',
    'discountPercent', 'discount_percent'));
  const discountPercentage = storedDiscountPercentage > 0 || subtotal <= 0
    ? storedDiscountPercentage
    : (discountAmount / subtotal) * 100;

  // Never left undefined: an invoice with nothing against it owes its total, and one settled in
  // full owes 0. A stored balance is the settlement cache and is preferred where it is present.
  const storedBalance = pick(invoice, 'balanceAmount', 'balance_amount');
  const balanceDue = storedBalance === undefined
    ? Math.max(0, totalAmount - amountPaid)
    : Math.max(0, figure(storedBalance));

  const lines = [
    { key: 'subtotal', label: SUBTOTAL_LABEL, amount: subtotal, negative: false },
    { key: 'gst', label: `GST (${ratePercent(taxPercentage)}%)`, amount: taxAmount, negative: false }
  ];
  // The discount is entered on the estimate and comes over with it; the invoice states that figure
  if (discountAmount > 0) {
    lines.push({
      key: 'discount',
      label: `Discount (${ratePercent(discountPercentage)}%)`,
      amount: discountAmount,
      negative: true
    });
  }

  return {
    subtotal, taxPercentage, taxAmount, discountPercentage, discountAmount,
    totalAmount, amountPaid, balanceDue,
    hasDiscount: discountAmount > 0,
    lines,
    totalLabel: TOTAL_LABEL,
    balanceLabel: BALANCE_LABEL
  };
};
