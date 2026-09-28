// Read the same way every other util does, but tolerantly: these helpers are unit-tested under node,
// where there is no import.meta.env at all.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

/**
 * Pricing for the services inside an AMC package.
 *
 * A package used to carry one price typed by hand. It now carries its services' own prices: each row
 * keeps the configured service it came from, the amount that service is priced on (a quantity, an
 * area, a capacity, a headcount) and the figures the server quoted for it. The package price is the
 * sum, so it cannot disagree with what it is made of.
 *
 * The amount is the package's own assumption, not a property's, which is why it is stored with the
 * row and the quoted price is what an estimate then uses. Pricing is done by the same
 * `<catalog path>/:id/quote` endpoint the estimate screens use, so a package and an estimate can
 * never price the same service differently.
 */

// What each pricing method measures. Mirrors INPUTS in components/estimates/ServiceCatalogPicker.jsx.
export const METHOD_INPUTS = {
  quantity_based: { key: 'quantity', label: 'Quantity', step: 1, min: 1 },
  area_based: { key: 'area', label: 'Area', step: 0.01, min: 0.01 },
  capacity_based: { key: 'capacity', label: 'Capacity', step: 0.01, min: 0.01 },
  capacity_slab: { key: 'capacity', label: 'Capacity', step: 1, min: 0 },
  manpower: { key: 'personnel', label: 'Personnel', step: 1, min: 1 }
};

// The input a row needs, with the unit to label it by. Fixed Price measures nothing, so it has none.
export const rowInput = (row) => {
  const input = METHOD_INPUTS[row?.pricingMethod];
  return input ? { ...input, unit: row.unit || '' } : null;
};

export const isPricedRow = (row) => Boolean(row?.catalogServiceId);

/**
 * Prices one row against the catalog. Returns the figures to store on it, or an error message.
 * `propertyType` is the package's first applicable type: a quote is validated against the types the
 * service allows, and no pricing method varies by type, so the first is enough.
 */
export const quotePackageRow = async (row, { apiPath, propertyType, fpId, token, signal }) => {
  const input = rowInput(row);
  if (!isPricedRow(row)) return { skipped: true };
  if (input && (row.inputValue === '' || row.inputValue === null || row.inputValue === undefined)) {
    return { cleared: true };
  }
  const body = {
    ...(input ? { [input.key]: row.inputValue } : {}),
    frequency: row.frequencyType, visits: row.frequencyCount,
    property_type: propertyType || '', fpId: fpId || 'all'
  };
  const response = await fetch(`${API_BASE}${apiPath}/${row.catalogServiceId}/quote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  const result = await response.json();
  if (!response.ok || !result.success) return { error: result.message || 'Unable to price this service.' };
  const quote = result.data;
  if (quote.requiresCustomQuote) return { error: `${row.service} needs a custom quote at this capacity.` };
  return {
    priced: {
      price: quote.totalPrice, vendorCost: quote.vendorCost, operatingCost: quote.operatingCost,
      vendorRatePerVisit: quote.vendorRatePerVisit, markupPercentage: quote.inputs?.markup_percentage,
      marginPercentage: quote.marginPercentage, frequencyType: quote.frequency, frequencyCount: quote.visits
    }
  };
};

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * What the package costs and sells for: the sum of its priced rows. A row typed by hand carries no
 * price, so it adds nothing here -- it is part of the package, but it is not what sets its price.
 */
export const packageTotals = (rows = []) => {
  const priced = rows.filter(row => Number.isFinite(Number(row?.price)));
  const sum = (field) => round2(priced.reduce((total, row) => total + (Number(row[field]) || 0), 0));
  const price = sum('price');
  const vendorCost = sum('vendorCost');
  const operatingCost = sum('operatingCost');
  const actualCost = round2(vendorCost + operatingCost);
  const profit = round2(price - actualCost);
  return { price, vendorCost, operatingCost, actualCost, profit,
    marginPercent: price ? round2(profit / price * 100) : null,
    pricedCount: priced.length };
};
