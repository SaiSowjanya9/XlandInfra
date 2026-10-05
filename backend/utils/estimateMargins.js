/**
 * What a property-based estimate costs XLAND and what it makes, for the payments dashboard.
 *
 * Every figure comes from the pricing snapshot the server wrote when each service was priced, so an
 * estimate reports what it was actually costed at rather than what today's catalog would say. This
 * mirrors `estimateInternalCosts` in the admin portal, which reads the same fields on the client.
 *
 * A service typed by hand with no vendor cost behind it contributes a customer price and no cost --
 * the margin of an estimate made entirely of uncosted typed rows is therefore 100%, which is true
 * of what we know about it rather than of the work. A typed row that does carry a vendor cost is
 * counted with the costed ones.
 */

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const parseRows = (value) => {
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

/** One estimate's internal costs, from its stored service rows. */
const estimateMargin = (estimate) => {
  const rows = parseRows(estimate.addons_data ?? estimate.addons);
  const sum = (getter) => round2(rows.reduce((total, row) => total + getter(row || {}), 0));
  // The package's own services carry what the vendor charges for them (utils/packageSnapshot.js).
  // The package price is already inside the subtotal, so leaving its cost out overstated the margin
  // of every package estimate.
  const packageCost = round2(parseRows(estimate.package_services ?? estimate.packageServices)
    .reduce((total, row) => total + figure(row?.vendorCost), 0));
  const vendorCost = round2(sum(row => figure(row.vendorCost, row.pricingSnapshot?.vendorCost)) + packageCost);
  const operatingCost = sum(row => figure(row.operatingCost, row.pricingSnapshot?.operatingCost));
  const servicesPrice = sum(row => figure(row.totalPrice, row.price, row.pricingSnapshot?.totalPrice));
  // The subtotal is what the customer was quoted, package included, so it is the selling price
  const subtotal = figure(estimate.subtotal);
  const customerPrice = round2(subtotal > 0 ? subtotal : servicesPrice + figure(estimate.package_price));
  const actualCost = round2(vendorCost + operatingCost);
  const profit = round2(customerPrice - actualCost);
  return {
    estimateId: estimate.estimate_id, clientName: estimate.client_name,
    propertyName: estimate.property_name, propertyCode: estimate.property_code,
    propertyType: estimate.property_type, status: estimate.status,
    // When the estimate was raised. The dashboard plots these figures over time and lets a
    // calendar narrow the range, so without a date every estimate would land in the same bucket.
    createdAt: estimate.created_at ?? null,
    fpName: estimate.fp_name || null, serviceCount: rows.length,
    vendorCost, operatingCost, actualCost, customerPrice, profit,
    marginPercent: customerPrice ? round2(profit / customerPrice * 100) : null
  };
};

/**
 * The same figures across a set of estimates, plus each estimate's own.
 *
 * The headline totals count only estimates that actually carry costs. An estimate whose services
 * were all typed by hand has a price and no cost, so including it would report a margin approaching
 * 100% and make the whole panel read as profit we have no evidence for. Those estimates are counted
 * as `uncostedCount` and still listed, so nothing is hidden -- they are just not averaged in.
 */
const estimateMarginTotals = (estimates = []) => {
  const rows = estimates.map(estimateMargin);
  const costed = rows.filter(row => row.actualCost > 0);
  const sum = (field) => round2(costed.reduce((total, row) => total + (row[field] || 0), 0));
  const customerPrice = sum('customerPrice');
  const vendorCost = sum('vendorCost');
  const operatingCost = sum('operatingCost');
  const actualCost = round2(vendorCost + operatingCost);
  const profit = round2(customerPrice - actualCost);
  return {
    estimateCount: rows.length,
    costedCount: costed.length,
    uncostedCount: rows.length - costed.length,
    vendorCost, operatingCost, actualCost, customerPrice, profit,
    marginPercent: customerPrice ? round2(profit / customerPrice * 100) : null,
    estimates: rows
  };
};

module.exports = { estimateMargin, estimateMarginTotals };
