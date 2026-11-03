const { customerEstimateData, stripInternalServiceDetails } = require('./estimateData');

/**
 * The services an invoice bills for -- resolved once, for every surface that lists them.
 *
 * An invoice raised from an estimate bills the estimate's services, so it reads them back through
 * the estimate's own customer projection (`customerEstimateData`): the same rows, in the same
 * order, with the same customer-safe description and Input / Details the estimate's view, PDF and
 * email already print. The invoice's stored `line_items` are a snapshot taken when the
 * draft was raised and are used only where there is no estimate behind the row (a generic or
 * manual invoice), or where the estimate no longer resolves.
 *
 * This replaces two hand-written "enrichment" blocks -- one in `GET /invoices/:id`, one in
 * `GET /invoices/:id/pdf` -- that rebuilt the rows differently from each other: the modal matched
 * a stored line by name and kept its price and frequency, the PDF matched by position and kept
 * neither, so the same invoice showed a service as "Quarterly, Rs. 3,360" on screen and
 * "Other, 0" on paper. Both also wrote the description twice (`description` as "Name - detail"
 * and `details` as the same detail), which the PDF then printed on two lines.
 *
 * Every surface renders these rows with the estimate document's columns:
 * `#`, Service (category under it), Description, Input / Details, Frequency, Visits.
 * No per-service price: the invoice is priced as a whole, in its summary, exactly as the
 * estimate is.
 *
 * `method` is still resolved on the row -- the screens read it -- but **no document prints it**:
 * how XLAND prices a service is how the figure was arrived at, not something the customer is
 * billed for, so the user asked for that column to come off the PDFs and the emails.
 */

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const amount = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
const text = value => String(value ?? '').trim();

const decodeHtml = value => text(value)
  .replace(/&amp;amp;amp;/g, '&')
  .replace(/&amp;amp;/g, '&')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&#x2F;/gi, '/')
  .replace(/&nbsp;/g, ' ');

const parse = value => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const list = value => {
  const parsed = parse(value);
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['serviceRows', 'services', 'rows']) if (Array.isArray(parsed?.[key])) return parsed[key];
  return [];
};

const frequencyLabel = value => {
  const label = text(value).replace(/^\d+x\s*/i, '');
  if (!label || label === '-') return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * One row shape, carried by every surface. The snake/camel aliases are deliberate: a screen or
 * export written against the old stored line item (`frequency_type`, `total_price`) keeps reading.
 */
const documentRow = ({ name, category, description, input, method, frequency, visits, price, tag, type }) => {
  const frequencyType = frequencyLabel(frequency);
  const frequencyCount = Number.isFinite(Number(visits)) && Number(visits) > 0 ? Number(visits) : 1;
  const amountValue = amount(price);
  return {
    name: decodeHtml(name) || 'Service',
    category: decodeHtml(category),
    // The pricing segments the customer never reads (Property Types, Slab, the vendor rate) come
    // out here, so no caller has to remember to strip them
    description: stripInternalServiceDetails(decodeHtml(description)).trim(),
    input: decodeHtml(input),
    method: decodeHtml(method),
    frequency: frequencyType,
    frequencyType,
    frequency_type: frequencyType,
    visits: frequencyCount,
    frequencyCount,
    frequency_count: frequencyCount,
    price: amountValue,
    totalPrice: amountValue,
    total_price: amountValue,
    // 'Package' marks one of the AMC package's own services, as the estimate's table does
    tag: text(tag),
    type: type || (text(tag) ? 'package_service' : 'service')
  };
};

/** A stored line item was written as `"<name> - <description>"`; the name is not part of the description. */
const describeLineItem = (item, name) => {
  const detail = first(item.details, item.serviceDescription, item.service_description, item.itemDescription);
  if (detail) return detail;
  const full = text(item.description);
  if (!full || full.toLowerCase() === text(name).toLowerCase()) return '';
  const prefix = `${text(name).toLowerCase()} - `;
  return full.toLowerCase().startsWith(prefix) ? full.slice(prefix.length) : full;
};

const rowFromLineItem = item => {
  const source = item && typeof item === 'object' ? item : {};
  const name = first(source.name, source.serviceName, source.service_name, source.service,
    text(source.description).split(' - ')[0], 'Service');
  return documentRow({
    name,
    category: first(source.category, source.serviceCategory, source.subcategory, ''),
    description: describeLineItem(source, name),
    input: first(source.input, source.inputText, ''),
    method: first(source.method, source.methodLabel, ''),
    frequency: first(source.frequency, source.frequencyType, source.frequency_type, source.billingDuration, ''),
    visits: first(source.visits, source.frequencyCount, source.frequency_count, source.quantity, 1),
    price: first(source.totalPrice, source.total_price, source.amount, source.unitPrice, source.unit_price, 0),
    type: source.type
  });
};

const rowFromEstimateService = (service, tag) => documentRow({
  name: service.name,
  category: service.category,
  description: service.description,
  input: service.input,
  method: service.method,
  frequency: service.frequencyType || service.frequency_type,
  visits: service.frequencyCount ?? service.frequency_count,
  price: service.totalPrice ?? service.price,
  tag
});

/**
 * The estimate an invoice was raised from, shaped for the document.
 *
 * A work-order estimate keeps its rows in `work_order_services`, which the estimate normalizer
 * does not read, so they are handed over as the estimate's services.
 */
const estimateDocumentServices = estimate => {
  if (!estimate) return null;
  const workOrderRows = list(estimate.work_order_services);
  const source = workOrderRows.length && !list(estimate.package_services).length && !list(estimate.services).length
    ? { ...estimate, services: workOrderRows }
    : estimate;
  const projected = customerEstimateData(source);
  // A package's own services are tagged, as they are in the estimate's own table
  const packageName = text(projected.packageName);
  const services = [
    ...projected.services.map(service => rowFromEstimateService(service, packageName ? 'Package' : '')),
    ...projected.addons.map(service => rowFromEstimateService(service, ''))
  ];
  if (!services.length) return null;
  return {
    services,
    packageName,
    packagePrice: amount(projected.packagePrice),
    addonsTotal: projected.addons.reduce((sum, service) => sum + amount(service.totalPrice ?? service.price), 0)
  };
};

/**
 * The invoice's document rows, from the estimate where there is one.
 *
 * `servicesTotal` is the figure the services table foots to: the invoice's own subtotal, because
 * that is what is being billed. The estimate's package price plus its added services is the
 * fallback for a row with no subtotal of its own, and it is what the AMC package note states.
 */
const invoiceDocument = (invoice = {}, estimate = null) => {
  const stored = list(invoice.line_items ?? invoice.lineItems);
  const fromEstimate = estimateDocumentServices(estimate);
  const services = fromEstimate ? fromEstimate.services : stored.map(rowFromLineItem);
  const packageName = fromEstimate ? fromEstimate.packageName : '';
  const packagePrice = fromEstimate ? fromEstimate.packagePrice : 0;
  const estimateTotal = fromEstimate
    ? fromEstimate.packagePrice + fromEstimate.addonsTotal
    : services.reduce((sum, service) => sum + service.price, 0);
  const subtotal = invoice.subtotal ?? invoice.sub_total;
  return {
    services,
    packageName,
    packagePrice,
    servicesTotal: subtotal === undefined || subtotal === null || subtotal === '' ? estimateTotal : amount(subtotal),
    source: fromEstimate ? 'estimate' : 'line_items'
  };
};

/**
 * The document's services as an email table -- header included, so no message can print its own
 * column set. The three invoice emails (the draft's send action, the auto-generated invoice, and
 * `sendInvoiceEmail`) each used to hand-write `# / Service / Description / Frequency / Visits`,
 * reading the name and description out of one `"Name - detail"` string.
 *
 * Drawn in the warm palette the PDFs and the portal's modals use: a cream header with muted
 * labels, warm rules, figures in warm text.
 */
const WARM = { section: '#FFF9EE', border: '#EADFCF', muted: '#8A7A66', text: '#1F2937' };
// No Method column: it is read on the screens, not on the document the customer receives
const INVOICE_SERVICE_COLUMNS = ['#', 'Service', 'Description', 'Input / Details', 'Frequency', 'Visits'];
const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cellText = value => escapeHtml(value || '-').replace(/\n/g, '<br>');

const invoiceServicesEmailTable = services => {
  const rows = Array.isArray(services) ? services : [];
  if (!rows.length) return '';
  const align = index => (index === 0 || index >= INVOICE_SERVICE_COLUMNS.length - 2 ? 'center' : 'left');
  const header = INVOICE_SERVICE_COLUMNS.map((label, index) => `
    <th style="background: ${WARM.section}; color: ${WARM.muted}; font-size: 9.5px; letter-spacing: 0.6px; text-transform: uppercase;
      font-weight: 700; padding: 7px 8px; border-bottom: 1px solid ${WARM.border}; text-align: ${align(index)};">${label}</th>`).join('');
  const body = rows.map((service, index) => {
    // The category reads under the service name, as it does in the table and the PDF, in a
    // smaller face than the name
    const name = [escapeHtml(service.name), service.category ? `<br><span style="color: ${WARM.muted}; font-size: 10.5px;">${escapeHtml(service.category)}</span>` : '',
      service.tag ? `<br><span style="color: ${WARM.muted}; font-size: 10px; font-style: italic;">${escapeHtml(service.tag)}</span>` : ''].join('');
    const cell = (content, index_) => `<td style="padding: 8px; border-bottom: 1px solid ${WARM.border}; font-size: 12px; color: ${WARM.text};
      text-align: ${align(index_)};">${content}</td>`;
    return `<tr>
      ${cell(index + 1, 0)}
      ${cell(`<strong>${name}</strong>`, 1)}
      ${cell(cellText(service.description), 2)}
      ${cell(cellText(service.input), 3)}
      ${cell(cellText(service.frequency), 4)}
      ${cell(escapeHtml(service.visits ?? 1), 5)}
    </tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
    <tr>${header}</tr>
    ${body}
  </table>`;
};

/**
 * Read the estimate behind an invoice. `source_estimate_id` is the estimate's code, and an
 * estimate written in a staff portal lives in `fp_estimates` while the admin's own lives in
 * `estimates`; both are tried, in that order.
 */
const loadInvoiceEstimate = async (runner, estimateCode) => {
  if (!estimateCode) return null;
  for (const table of ['fp_estimates', 'estimates']) {
    try {
      const [rows] = await runner.execute(`SELECT * FROM ${table} WHERE estimate_id = ? LIMIT 1`, [estimateCode]);
      if (rows && rows.length) return rows[0];
    } catch (error) {
      // A deployment without one of the tables must not cost the other its lookup
      console.error(`[invoiceDocument] ${table} lookup failed for ${estimateCode}:`, error.message);
    }
  }
  return null;
};

/** The document for an invoice row, estimate included. */
const loadInvoiceDocument = async (runner, invoice = {}) => {
  const estimate = await loadInvoiceEstimate(runner, invoice.source_estimate_id || invoice.sourceEstimateId);
  return invoiceDocument(invoice, estimate);
};

/**
 * The documents for a list of invoices, with one estimate query per table rather than one per
 * invoice -- a customer's invoice list would otherwise fire two lookups a row.
 */
const loadInvoiceDocuments = async (runner, invoices = []) => {
  const codes = [...new Set(invoices.map(invoice => invoice.source_estimate_id || invoice.sourceEstimateId).filter(Boolean))];
  const estimates = new Map();
  if (codes.length) {
    const placeholders = codes.map(() => '?').join(', ');
    for (const table of ['fp_estimates', 'estimates']) {
      try {
        const [rows] = await runner.execute(`SELECT * FROM ${table} WHERE estimate_id IN (${placeholders})`, codes);
        // fp_estimates is read first and keeps the row where both tables hold the code
        for (const row of rows || []) if (!estimates.has(row.estimate_id)) estimates.set(row.estimate_id, row);
      } catch (error) {
        console.error(`[invoiceDocument] ${table} batch lookup failed:`, error.message);
      }
    }
  }
  return invoices.map(invoice => invoiceDocument(invoice, estimates.get(invoice.source_estimate_id || invoice.sourceEstimateId) || null));
};

module.exports = { invoiceDocument, loadInvoiceDocument, loadInvoiceDocuments, loadInvoiceEstimate, documentRow,
  rowFromLineItem, decodeHtml, invoiceServicesEmailTable, INVOICE_SERVICE_COLUMNS };
