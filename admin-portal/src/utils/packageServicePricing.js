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
 * The property type a row is quoted against.
 *
 * The quote refuses a type the service does not cover -- "This service is not available for the
 * selected property type", a 400 -- so sending the package's first type blindly left a row unpriced
 * whenever the package had no type ticked yet, or its first type was one the service does not serve.
 * Typing an amount then produced no price at all, with nothing to say why.
 *
 * So: the first of the package's own types the service actually covers, failing that the service's
 * own first type, and failing that nothing -- which the quote will then answer for.
 */
export const quotePropertyType = (row, packageTypes = []) => {
  const allowed = Array.isArray(row?.applicablePropertyTypes) ? row.applicablePropertyTypes : [];
  const shared = (Array.isArray(packageTypes) ? packageTypes : []).find(type => !allowed.length || allowed.includes(type));
  return shared || allowed[0] || '';
};

/**
 * Prices one row against the catalog. Returns the figures to store on it, or an error message.
 * `propertyType` is the package's first applicable type: a quote is validated against the types the
 * service allows, and no pricing method varies by type, so the first is enough.
 */
export const quotePackageRow = async (row, { apiPath, propertyType, propertyTypes, fpId, token, signal }) => {
  const input = rowInput(row);
  if (!isPricedRow(row)) return { skipped: true };
  if (input && (row.inputValue === '' || row.inputValue === null || row.inputValue === undefined)) {
    return { cleared: true };
  }
  const body = {
    ...(input ? { [input.key]: row.inputValue } : {}),
    frequency: row.frequencyType, visits: row.frequencyCount,
    // A type the service covers, or the quote refuses it and the row stays unpriced
    property_type: propertyType || quotePropertyType(row, propertyTypes), fpId: fpId || 'all'
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
      // **A package is priced from what the vendor charges, not from what the service sells for.**
      // The quote returns both -- `vendorCost` is the vendor rate across the visits, `totalPrice`
      // is that with the service's own markup on it -- and a package takes the former: it sets its
      // own margin through its Markup (%), so taking the marked-up price would charge a markup on
      // a markup. A row therefore opens on the vendor cost and the package's markup is what turns
      // it into the customer price.
      price: quote.vendorCost, vendorCost: quote.vendorCost, operatingCost: quote.operatingCost,
      vendorRatePerVisit: quote.vendorRatePerVisit, markupPercentage: quote.inputs?.markup_percentage,
      // The quote's own margin describes its customer price, which is not the price this row
      // carries, so storing it would state a margin the package does not have
      marginPercentage: undefined, frequencyType: quote.frequency, frequencyCount: quote.visits
    }
  };
};

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * The package's own markup, added **on top of** the price a row already carries:
 *
 *   price = row price × (1 + markup / 100)
 *
 * so a markup can only raise a price, never lower it. Every row's price is now what the vendor
 * charges -- a configured one from `quote.vendorCost`, a hand-typed one from what was entered --
 * so the markup is XLAND's margin on the package, exactly as a service's own markup is its margin
 * on the service. It is no longer a markup charged on top of another markup.
 *
 * Left blank, each row keeps the price it already has. A price typed over is never recalculated:
 * that is what typing over it means.
 */
export const hasMarkup = (markup) => markup !== '' && markup !== null && markup !== undefined && Number.isFinite(Number(markup));

export const rowPriceWithMarkup = (row, markup) => {
  if (!hasMarkup(markup) || row?.priceOverridden) return row?.price;
  const factor = 1 + Number(markup) / 100;
  const quoted = Number(row?.price);
  if (Number.isFinite(quoted) && quoted > 0) return round2(quoted * factor);
  // Nothing quoted: a hand-typed row has only what the vendor charges to work from
  const cost = (Number(row?.vendorCost) || 0) + (Number(row?.operatingCost) || 0);
  return cost ? round2(cost * factor) : row?.price;
};

export const applyPackageMarkup = (rows = [], markup) =>
  rows.map(row => ({ ...row, price: rowPriceWithMarkup(row, markup) }));

/**
 * What the package costs and sells for: the sum of its priced rows. A row typed by hand carries no
 * price, so it adds nothing here -- it is part of the package, but it is not what sets its price.
 *
 * `xlandCost` is what XLAND makes on top of what the vendor charges -- the markup in rupees, the
 * same figure the service form's preview calls XLAND Cost: ₹4,000 of vendor cost at 30% earns
 * ₹1,200 and the customer pays ₹5,200. It is derived, never entered, and it is the profit under
 * the name the rest of the pricing UI uses, so vendor cost plus XLAND cost (plus any operating
 * cost) comes to exactly the package price.
 */
export const packageTotals = (rows = [], markup) => {
  const withMarkup = hasMarkup(markup) ? applyPackageMarkup(rows, markup) : rows;
  const priced = withMarkup.filter(row => Number.isFinite(Number(row?.price)));
  const sum = (field) => round2(priced.reduce((total, row) => total + (Number(row[field]) || 0), 0));
  const price = sum('price');
  const vendorCost = sum('vendorCost');
  const operatingCost = sum('operatingCost');
  const actualCost = round2(vendorCost + operatingCost);
  const xlandCost = round2(price - actualCost);
  return { price, vendorCost, operatingCost, actualCost, xlandCost, profit: xlandCost,
    marginPercent: price ? round2(xlandCost / price * 100) : null,
    pricedCount: priced.length };
};
