/**
 * The services an invoice bills -- one table, one column set, every screen.
 *
 * `#`, Service (its category, and `Package` for one of the AMC package's own services, under the
 * name and smaller than it), Description, Input / Details, Method, Frequency, Visits: the estimate
 * document's columns, because an invoice bills the estimate's services and the two are read as one
 * document. The server resolves the rows (`backend/utils/invoiceDocument.js`) and the PDF draws
 * the same columns (`SERVICE_COLUMNS` in `backend/services/pdfService.js`), so the screen and the
 * download cannot disagree.
 *
 * **Method is the one column the documents do not carry**: how XLAND prices a service is how the
 * figure was arrived at, not something the customer is billed for, so the PDFs and the emails
 * leave it out while the screens keep it. Every cell of it is marked `data-column="Method"`, so a
 * screen capture taken as a document (`FPInvoiceView`'s download) can drop it from the clone.
 *
 * No money in it at all: no per-service price, and no total under the table either -- the invoice
 * is priced in the Price Summary beside it, and a services total directly above a Subtotal stating
 * the same figure said it twice (the PDFs drop it for the same reason). What this replaced was a
 * pair of tables per modal -- "Services Included" and "Services" -- split by sniffing the word
 * "addon" out of a description, where only the second stated a price.
 *
 * Mounted by `pages/billing/GeneratedInvoices.jsx`, `pages/billing/Invoices.jsx` and
 * `pages/FPInvoiceView.jsx`; guarded by `utils/invoiceDocumentView.test.js`.
 */

// Each column's share of the table width; adds up to 100
const COLUMN_SHARE = { '#': 4, 'Service': 17, 'Description': 25, 'Input / Details': 14, 'Method': 13, 'Frequency': 15, 'Visits': 12 };
const COLUMNS = Object.keys(COLUMN_SHARE);
const ALIGN = { '#': 'text-center', 'Frequency': 'text-center', 'Visits': 'text-center' };

const decode = value => {
  if (!value) return '';
  let text = String(value);
  // Several passes: a description stored through two layers of escaping reads `parts&amp;#x2F;replacement`
  for (let pass = 0; pass < 5; pass += 1) {
    const before = text;
    text = text
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&#x2F;/gi, '/');
    if (text === before) break;
  }
  return text;
};

// A row as the server hands it over, or as an older payload still shapes it
const normalize = (item, index) => ({
  key: index,
  name: decode(item.name || item.serviceName || item.service_name || String(item.description || '').split(' - ')[0] || 'Service'),
  category: decode(item.category || ''),
  tag: item.tag || '',
  description: decode(item.description || item.details || ''),
  input: decode(item.input || ''),
  method: decode(item.method || ''),
  frequency: decode(item.frequency || item.frequencyType || item.frequency_type || ''),
  visits: item.visits ?? item.frequencyCount ?? item.frequency_count ?? 1
});

export default function InvoiceServicesTable({ services, title = 'Services Billed' }) {
  const rows = (Array.isArray(services) ? services : []).map(normalize);
  if (!rows.length) return null;

  return (
    <div>
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-gray-900 uppercase whitespace-nowrap">{title}</span>
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-warm-border bg-white">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {COLUMNS.map(label => <col key={label} data-column={label} style={{ width: `${COLUMN_SHARE[label]}%` }} />)}
          </colgroup>
          <thead>
            <tr className="bg-warm-section">
              {COLUMNS.map(label => (
                <th key={label} data-column={label} className={`px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-warm-muted ${ALIGN[label] || 'text-left'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-border/60">
            {rows.map((row, index) => (
              <tr key={row.key} className="bg-white align-top">
                <td className="px-2 py-2 text-center text-xs text-warm-muted">{index + 1}</td>
                <td className="px-2 py-2">
                  <p className="text-xs font-medium text-gray-800 break-words">{row.name}</p>
                  {row.category && <p className="text-[10px] text-gray-500 break-words">{row.category}</p>}
                  {row.tag && <p className="text-[10px] italic text-warm-muted">{row.tag}</p>}
                </td>
                <td className="px-2 py-2 text-xs text-gray-600 whitespace-pre-wrap break-words">{row.description || '-'}</td>
                <td className="px-2 py-2 text-xs text-gray-700 break-words">{row.input || '-'}</td>
                <td data-column="Method" className="px-2 py-2 text-xs text-gray-700 break-words">{row.method || '-'}</td>
                <td className="px-2 py-2 text-center text-xs text-warm-text">{row.frequency || '-'}</td>
                <td className="px-2 py-2 text-center text-xs font-semibold text-warm-text">{row.visits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
