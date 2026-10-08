// The share of an invoice already collected, for badges like "Partially Paid (50%)" and summary
// rows that need the paid amount beside the balance. `amountPaid` is read from the invoice where
// the list provides it and otherwise derived as total minus balance, so every caller gets the same
// figure the accounts table records.
export const paidAmount = invoice => {
  const total = parseFloat(invoice?.totalAmount) || 0;
  const paid = invoice?.amountPaid != null
    ? parseFloat(invoice.amountPaid)
    : total - (parseFloat(invoice?.balanceAmount) || 0);
  return Number.isFinite(paid) ? Math.max(0, Math.min(paid, total)) : 0;
};

export const paidPercent = invoice => {
  const total = parseFloat(invoice?.totalAmount) || 0;
  const paid = paidAmount(invoice);
  if (total <= 0 || paid <= 0) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
};

// 'Partially Paid (50%)' where the invoice is partially paid, else the status config's own label.
// Works off either `status` or `paymentStatus` — the invoice tables use one or the other.
export const statusLabel = (invoice, configLabel) => {
  if (invoice?.status !== 'partially_paid' && invoice?.paymentStatus !== 'partially_paid') {
    return configLabel;
  }
  const pct = paidPercent(invoice);
  return pct > 0 ? `${configLabel} (${pct}%)` : configLabel;
};
