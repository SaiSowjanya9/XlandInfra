/**
 * What a set of estimates costs XLAND and what it makes, for the Estimates dashboard's Profit &
 * Margin Summary. The client twin of `backend/utils/estimateMargins.js` (the payments dashboard's
 * Cost & Margin panel), so the two screens can never disagree: a test runs both on the same rows.
 *
 * Every figure comes from the pricing snapshot saved with each service. The headline totals count
 * every live estimate: one whose services were all typed by hand contributes its price with zero
 * recorded cost, which lifts the margin -- `uncostedCount` says how many estimates are priced that
 * way so the reader can weigh the figure. Rejected and archived estimates are not work we expect to
 * bill, so they are left out before anything is added up.
 */
const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const parseRows = value => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'object') return Array.isArray(value.addons) ? value.addons : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const figure = (...values) => {
  const found = values.find(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
  return found === undefined ? 0 : Number(found);
};

const parseSnapshot = value => {
  if (!value || typeof value === 'object') return value || {};
  try { return JSON.parse(value) || {}; } catch { return {}; }
};

export const estimateProfit = estimate => {
  const rows = parseRows(estimate.addons_data ?? estimate.addons);
  const sum = getter => round2(rows.reduce((total, row) => total + getter(row || {}), 0));
  // The package's own services carry what the vendor charges for them; the package price is already
  // in the subtotal, so its cost belongs beside it. Mirrors backend/utils/estimateMargins.js.
  const packageCost = round2(parseRows(estimate.package_services ?? estimate.packageServices)
    .reduce((total, row) => total + figure(row?.vendorCost), 0));
  const vendorCost = round2(sum(row => figure(row.vendorCost, parseSnapshot(row.pricingSnapshot).vendorCost)) + packageCost);
  const operatingCost = sum(row => figure(row.operatingCost, parseSnapshot(row.pricingSnapshot).operatingCost));
  const servicesPrice = sum(row => figure(row.totalPrice, row.price, parseSnapshot(row.pricingSnapshot).totalPrice));
  // The subtotal is what the customer was quoted, package included, so it is the selling price
  const subtotal = figure(estimate.subtotal);
  const customerPrice = round2(subtotal > 0 ? subtotal : servicesPrice + figure(estimate.package_price));
  const actualCost = round2(vendorCost + operatingCost);
  const profit = round2(customerPrice - actualCost);
  return { vendorCost, operatingCost, actualCost, customerPrice, profit,
    marginPercent: customerPrice ? round2(profit / customerPrice * 100) : null };
};

const EXCLUDED = ['rejected', 'archived'];

export const estimateProfitSummary = (estimates = []) => {
  const live = estimates.filter(estimate => !EXCLUDED.includes(String(estimate.status || '').toLowerCase())
    && !(estimate.is_archived === 1 || estimate.is_archived === true));
  const rows = live.map(estimateProfit);
  const costed = rows.filter(row => row.actualCost > 0);
  // Every live estimate's price and cost count; `uncostedCount` flags how many carried no cost
  const sum = field => round2(rows.reduce((total, row) => total + (row[field] || 0), 0));
  const customerPrice = sum('customerPrice');
  const vendorCost = sum('vendorCost');
  const operatingCost = sum('operatingCost');
  const actualCost = round2(vendorCost + operatingCost);
  const profit = round2(customerPrice - actualCost);
  return {
    estimateCount: rows.length, costedCount: costed.length, uncostedCount: rows.length - costed.length,
    excludedCount: estimates.length - live.length,
    vendorCost, operatingCost, actualCost, customerPrice, profit,
    marginPercent: customerPrice ? round2(profit / customerPrice * 100) : null
  };
};
