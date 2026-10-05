import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { FREQUENCY_OPTIONS } from './AddServicePage';
import { frequencyOptionStyle, isCustomFrequency } from '../../utils/estimateStore';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';
import { getServiceMarginPercent, getServiceVendorCost, getServiceXlandCost } from '../../utils/estimatePackageUtils';
import { capitalizeFirst, decodeEntities } from '../../utils/text';

// Services typed in by hand, for an estimate built without an AMC package. These are not catalog
// services: there is no configured rate behind them, so the price is entered directly rather than
// quoted. A row can still carry what the vendor charges and the markup it was priced at, and where
// it does the internal cost columns show them. Rows are added on request rather than the table
// always trailing a blank one, and a row can be edited in place or removed.
const currency = value => `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const costOr = value => value == null ? '—' : currency(value);
const marginOr = value => value == null ? '—' : `${value}%`;
const BLANK = { name: '', description: '', frequency_type: 'Monthly', frequency_count: 12, price: '' };
// Every frequency carries its own annual visit count, so Visits / Year is read-only once one is
// picked -- a schedule and a visit count that disagree is not a thing an estimate should be able to
// say. Custom is the deliberate exception: it has no count of its own, so the figure is typed.
const FREQUENCY_CHOICES = [...FREQUENCY_OPTIONS, { value: 'Custom', label: 'Custom', defaultVisits: null }];
const visitsFor = frequency => FREQUENCY_OPTIONS.find(item => item.value === frequency)?.defaultVisits ?? 0;
// A row being typed reads as part of the table, not as a form dropped into it: no box at rest, a
// faint one on hover so the cells are still discoverable, and a clear one only while focused.
const inlineInput = skin => `w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${skin.inlineField}`;
// Spinners add a second box inside the cell, which is the clutter this row is meant to be free of
const noSpinner = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const iconButton = 'rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2';

// The row an estimate carries. It keeps the shape of a configured-service add-on so the existing
// service tables, view modals and PDFs render it without knowing where it came from, and `services`
// holds the per-visit price the same way. An edited row keeps its original id so it stays in place.
export const buildCustomService = (values, addonId) => {
  const name = String(values.name || '').trim();
  const description = String(values.description || '').trim();
  const visits = Number(values.frequency_count) || 0;
  const price = Number(values.price) || 0;
  // Quantity, category and whether the job needs a vendor are settled per row, the same three a
  // Quantity Based catalog service settles per estimate. Vendor is carried the way the catalog
  // carries it -- skip_vendor_assignment -- so one flag means the same thing on every row.
  const quantity = Number(values.quantity);
  const category = String(values.category || '').trim();
  // What the vendor charges and the markup the price was set at -- optional, but where they are
  // given the row prices like a catalog service: the internal cost columns and the margins panel
  // read these same two fields off it.
  const vendorCost = values.vendorCost === '' || values.vendorCost == null ? null : Number(values.vendorCost);
  const markup = values.markupPercentage === '' || values.markupPercentage == null ? null : Number(values.markupPercentage);
  return {
    addonId: addonId || `CUSTOM-${Date.now()}${Math.floor(Math.random() * 1000)}`, customService: true,
    name, service_name: name, description,
    frequency_type: values.frequency_type, frequency_count: visits,
    ...(Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
    ...(category ? { category } : {}),
    ...(Number.isFinite(vendorCost) && vendorCost >= 0 ? { vendorCost } : {}),
    ...(Number.isFinite(markup) && markup >= 0 ? { markup_percentage: markup } : {}),
    skip_vendor_assignment: values.vendorRequired === false,
    totalPrice: price, price,
    services: [{ name, description, frequencyType: values.frequency_type, frequency: visits, price: visits ? price / visits : price }]
  };
};

// The values a dialog opens on: a new row starts on the defaults, an existing one on what it holds
// Text comes back from the server HTML-escaped, so it is decoded before it is edited and saved again
export const customServiceValues = row => ({
  name: decodeEntities(row?.name || ''), description: decodeEntities(row?.description || ''),
  category: decodeEntities(row?.category || ''), quantity: row?.quantity ?? 1,
  frequency_type: row?.frequency_type || 'Monthly',
  frequency_count: row?.frequency_count ?? 12,
  price: row ? String(row.totalPrice ?? row.price ?? '') : '',
  vendorCost: row?.vendorCost ?? '',
  markupPercentage: row?.markup_percentage ?? '',
  vendorRequired: row ? row.skip_vendor_assignment !== true : true
});

// The empty row the Custom option drops in. It has no name, which is how the table knows to open it
// for typing, so a caller only has to append one.
export const blankCustomService = () => buildCustomService(BLANK);
const isBlank = row => String(row?.name || '').trim() === '';

export const customServicesTotal = rows => (rows || []).reduce((sum, row) => sum + (Number(row.totalPrice ?? row.price) || 0), 0);

// What a row must have before it counts. Reported when it is confirmed rather than by disabling the
// control, which read as broken rather than as waiting for input.
const complaint = values => {
  if (String(values.name || '').trim() === '') return 'Enter a service name.';
  const price = String(values.price ?? '').trim();
  if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return 'Enter a customer price for this service.';
  return customVisitsComplaint(values);
};

// Custom is the one frequency with no count of its own, so the count typed for it must be a real one
export const customVisitsComplaint = values => {
  if (!isCustomFrequency(values.frequency_type)) return '';
  const visits = Number(values.frequency_count);
  return Number.isInteger(visits) && visits >= 1 && visits <= 366 ? '' : 'Enter the visits per year for a Custom frequency (1 to 366).';
};

// `title` is null where the hosting card already names the section, so the heading is never shown
// twice. `addControl` replaces the default Add Service button, which is how the FP form offers
// catalog services and a blank row from the one dropdown instead of a second picker beside it.
//
// `extraRows` are services added from the catalog. They are held in the caller's own array, because
// the estimate payload prices them differently, but they belong in this table: whichever way a
// service was added, the estimate has one list of them, numbered straight through. They are not
// edited inline -- their figures come from the server -- so the caller supplies their actions.
// `onEditRow` hands editing to the caller's own dialog: where a row carries a category, a quantity
// and a vendor answer there is more of it than a table row can hold, so it is entered in a dialog
// and this table only lists it. Without the prop the row is still edited in place, which is what
// the portals that add a blank row straight from the button rely on.
//
// `internal` adds the Vendor Cost, XLAND Cost and Margin % columns ahead of the price -- the same
// figures the catalog's service table shows the roles that may see costs. It is passed only by
// those portals; everywhere else the table stays customer-priced.
export default function CustomServicesTable({ rows = [], onChange, title = 'Custom Services', addControl = null,
  extraRows = [], renderExtraActions = null, onEditRow = null, internal = false, theme }) {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  const inputClass = inlineInput(skin);
  const numberClass = `${inputClass} ${noSpinner}`;
  const [problem, setProblem] = useState('');
  // The row being typed or amended: its index plus the working values, so a half-finished row never
  // reaches the estimate and Cancel can put the original back.
  const [edit, setEdit] = useState(null);

  const startEdit = index => {
    const row = rows[index];
    setProblem('');
    setEdit({ index, values: { name: decodeEntities(row.name), description: decodeEntities(row.description), frequency_type: row.frequency_type,
      frequency_count: row.frequency_count, price: isBlank(row) ? '' : (row.totalPrice ?? row.price),
      // Carried through an in-place edit so a costed row stays costed even though the cells are
      // not editable here -- the dialog is where they are set.
      vendorCost: row.vendorCost ?? '', markupPercentage: row.markup_percentage ?? '',
      // Likewise the category, quantity and vendor answer: rebuilding the row without them dropped
      // all three the first time a row was edited in place
      category: row.category ?? '', quantity: row.quantity ?? '', vendorRequired: row.skip_vendor_assignment !== true } });
  };
  // A row arrives blank from the Custom option, so it opens for typing without another click.
  // Where the caller edits in its own dialog no blank row is ever appended, so this stands down.
  useEffect(() => {
    if (edit || onEditRow) return;
    const index = rows.findIndex(isBlank);
    if (index >= 0) startEdit(index);
  }, [rows, edit, onEditRow]);

  // Picking a frequency fills the annual visits from the same table the catalog uses; it stays editable
  const setEditField = (field, raw) => {
    setProblem('');
    const value = field === 'name' || field === 'description' ? capitalizeFirst(raw) : raw;
    setEdit(prev => ({ ...prev, values: { ...prev.values, [field]: value,
      // Switching to Custom keeps the figure already there to be edited; any other frequency
      // replaces it with the count that frequency means.
      ...(field === 'frequency_type' && !isCustomFrequency(value) ? { frequency_count: visitsFor(value) } : {}) } }));
  };
  const saveEdit = () => {
    const issue = complaint(edit.values);
    if (issue) return setProblem(issue);
    onChange(rows.map((row, index) => index === edit.index ? buildCustomService(edit.values, row.addonId) : row));
    setEdit(null);
    setProblem('');
  };
  const removeRow = index => {
    setEdit(null);
    setProblem('');
    onChange(rows.filter((_, i) => i !== index));
  };
  // Abandoning a row that was never filled in takes it back out rather than leaving it empty
  const cancelEdit = () => {
    const index = edit.index;
    setEdit(null);
    setProblem('');
    if (isBlank(rows[index])) onChange(rows.filter((_, i) => i !== index));
  };
  // Enter confirms the row, rather than submitting the estimate around it
  const onKeyDown = event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    saveEdit();
  };
  const addBlankRow = () => onChange([...rows, blankCustomService()]);
  const cell = `px-3 py-2.5 text-sm ${skin.text}`;

  return (
    <div className={`overflow-hidden rounded-xl border ${skin.panel}`}>
      {title && (
        <div className={`border-b px-5 py-3 ${skin.panelHead}`}>
          <h3 className={`text-sm font-semibold ${skin.heading}`}>{title} ({rows.length + extraRows.length})</h3>
        </div>
      )}
      {/* Every heading stays on one line. Two were too long to fit the column they head, so they
          are shortened rather than wrapped -- "Visits" alone is unambiguous beside Frequency, and
          this table shows one price, the customer's -- and the full wording is on each `title`. The
          table keeps a minimum width and scrolls inside this wrapper, so a narrow form column
          makes the row scroll rather than pushing two headings into each other. */}
      <div className="overflow-x-auto">
      <table className={`w-full table-fixed ${internal ? 'min-w-[1080px]' : 'min-w-[820px]'}`}>
        <thead>
          <tr className={`border-b text-xs font-semibold uppercase tracking-wide ${skin.headRow}`}>
            <th className={`${internal ? 'w-[4%]' : 'w-[5%]'} whitespace-nowrap px-3 py-2.5 text-center`}>#</th>
            <th className={`${internal ? 'w-[14%]' : 'w-[20%]'} whitespace-nowrap px-3 py-2.5 text-left`}>Service</th>
            <th className={`${internal ? 'w-[15%]' : 'w-[24%]'} whitespace-nowrap px-3 py-2.5 text-left`}>Description</th>
            <th className={`${internal ? 'w-[11%]' : 'w-[14%]'} whitespace-nowrap px-3 py-2.5 text-left`}>Frequency</th>
            <th className={`${internal ? 'w-[8%]' : 'w-[11%]'} whitespace-nowrap px-3 py-2.5 text-center`} title="Visits per year">Visits</th>
            {/* Internal costs and row controls are screen furniture: a browser print of the form
                keeps only the customer's columns, so they are print:hidden */}
            {internal && <>
              <th className="w-[11%] whitespace-nowrap px-3 py-2.5 text-center print:hidden" title="What the vendor charges for this service">Vendor Cost</th>
              <th className="w-[11%] whitespace-nowrap px-3 py-2.5 text-center print:hidden" title="The markup in rupees: customer price minus vendor cost">XLAND Cost</th>
              <th className="w-[8%] whitespace-nowrap px-3 py-2.5 text-center print:hidden" title="XLAND cost as a share of the customer price">Margin %</th>
            </>}
            <th className={`${internal ? 'w-[11%]' : 'w-[15%]'} whitespace-nowrap px-3 py-2.5 text-center`} title="Customer price in rupees">Price (₹)</th>
            <th className={`${internal ? 'w-[7%]' : 'w-[11%]'} whitespace-nowrap px-3 py-2.5 text-center print:hidden`}>Action</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${skin.rowDivide}`}>
          {!rows.length && !extraRows.length && (
            <tr><td colSpan={internal ? 10 : 7} className={`px-3 py-8 text-center text-sm ${skin.faint}`}>
              No services yet. Use Add Service to add one.
            </td></tr>
          )}
          {rows.map((row, index) => edit?.index === index ? (
            // Being typed or amended: the fields, with confirm and cancel in the Action cell
            <tr key={row.addonId} className={`align-top ${skin.editingRow}`}>
              <td className={`${cell} text-center ${skin.muted}`}>{index + 1}</td>
              <td className="px-3 py-2.5">
                <input autoFocus value={edit.values.name} onChange={event => setEditField('name', event.target.value)} onKeyDown={onKeyDown}
                  placeholder="Service name" maxLength={150} aria-label="Service name" className={inputClass} />
              </td>
              <td className="px-3 py-2.5">
                <input value={edit.values.description} onChange={event => setEditField('description', event.target.value)} onKeyDown={onKeyDown}
                  placeholder="e.g. 4 Lifts, 15,000 Sq Ft" maxLength={255} aria-label="Input / details" className={inputClass} />
              </td>
              <td className="px-3 py-2.5">
                <select value={edit.values.frequency_type} onChange={event => setEditField('frequency_type', event.target.value)}
                  aria-label="Frequency" className={inputClass}>
                  {FREQUENCY_CHOICES.map(option => (
                    <option key={option.value} value={option.value} style={frequencyOptionStyle(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2.5">
                {/* Fixed by the frequency, unless the frequency is Custom */}
                <input type="number" min="0" max="366" step="1" value={edit.values.frequency_count} onKeyDown={onKeyDown}
                  readOnly={!isCustomFrequency(edit.values.frequency_type)}
                  title={isCustomFrequency(edit.values.frequency_type) ? undefined : `${edit.values.frequency_type} means ${edit.values.frequency_count} visits a year. Choose Custom to set your own.`}
                  onChange={event => setEditField('frequency_count', event.target.value)} aria-label="Visits per year"
                  className={`${numberClass} text-center ${isCustomFrequency(edit.values.frequency_type) ? '' : `cursor-not-allowed hover:border-transparent ${skin.muted}`}`} />
              </td>
              {/* The cost cells keep their places in an internal table; an in-place edit never
                  changes them -- the dialog is where cost and markup are set */}
              {internal && <><td className="print:hidden" /><td className="print:hidden" /><td className="print:hidden" /></>}
              <td className="px-3 py-2.5">
                <input type="number" min="0" step="0.01" value={edit.values.price} onChange={event => setEditField('price', event.target.value)} onKeyDown={onKeyDown}
                  placeholder="0" aria-label="Customer price" className={`${numberClass} text-center`} />
              </td>
              <td className="px-3 py-2.5 print:hidden">
                <div className="flex items-center justify-center gap-1">
                  <button type="button" onClick={saveEdit} title="Save service" aria-label="Save service"
                    className={`${iconButton} ${skin.faint} hover:bg-emerald-50 hover:text-emerald-600 focus:ring-emerald-100`}><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={cancelEdit} title="Discard service" aria-label="Discard service"
                    className={`${iconButton} ${skin.faint} ${skin.iconEdit}`}><X className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={row.addonId} className="align-top">
              <td className={`${cell} text-center ${skin.muted}`}>{index + 1}</td>
              <td className={`${cell} break-words font-medium ${skin.strong}`}>
                {decodeEntities(row.name)}
                {/* Category, quantity and a job arranged without a vendor sit under the name: they
                    belong to the row but do not each earn a column of their own */}
                {(row.category || row.quantity || row.skip_vendor_assignment) && (
                  <span className={`mt-0.5 block text-[11px] font-normal ${skin.muted}`}>
                    {[decodeEntities(row.category), row.quantity ? `Qty ${row.quantity}` : '', row.skip_vendor_assignment ? 'No vendor' : '']
                      .filter(Boolean).join(' · ')}
                  </span>
                )}
              </td>
              <td className={`${cell} break-words text-xs ${skin.muted} ${row.description ? 'text-left' : 'text-center'}`}>{decodeEntities(row.description) || '-'}</td>
              <td className={cell}>{row.frequency_type}</td>
              <td className={`${cell} text-center`}>{row.frequency_count}</td>
              {internal && <>
                <td className={`${cell} text-center print:hidden`}>{costOr(getServiceVendorCost(row))}</td>
                <td className={`${cell} text-center print:hidden`}>{costOr(getServiceXlandCost(row))}</td>
                <td className={`${cell} text-center print:hidden`}>{marginOr(getServiceMarginPercent(row))}</td>
              </>}
              <td className={`${cell} text-center font-medium ${skin.strong}`}>{currency(row.totalPrice ?? row.price)}</td>
              {/* Every row can be amended or taken back off the estimate */}
              <td className="px-3 py-2.5 print:hidden">
                <div className="flex items-center justify-center gap-1">
                  <button type="button" onClick={() => (onEditRow ? onEditRow(row, index) : startEdit(index))} title={`Edit ${row.name}`} aria-label={`Edit ${row.name}`}
                    className={`${iconButton} ${skin.faint} ${skin.iconEdit}`}><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeRow(index)} title={`Remove ${row.name}`} aria-label={`Remove ${row.name}`}
                    className={`${iconButton} ${skin.faint} hover:bg-red-50 hover:text-red-600 focus:ring-red-100`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
          {/* Catalog services continue the same numbering: one list, however each row got here */}
          {extraRows.map((row, index) => (
            <tr key={row.addonId} className="align-top">
              <td className={`${cell} text-center ${skin.muted}`}>{rows.length + index + 1}</td>
              <td className={`${cell} break-words font-medium ${skin.strong}`}>{decodeEntities(row.name)}</td>
              <td className={`${cell} break-words text-xs ${skin.muted} ${row.description ? 'text-left' : 'text-center'}`}>{decodeEntities(row.description) || '-'}</td>
              <td className={cell}>{row.frequency_type}</td>
              <td className={`${cell} text-center`}>{row.frequency_count}</td>
              {internal && <>
                <td className={`${cell} text-center print:hidden`}>{costOr(getServiceVendorCost(row))}</td>
                <td className={`${cell} text-center print:hidden`}>{costOr(getServiceXlandCost(row))}</td>
                <td className={`${cell} text-center print:hidden`}>{marginOr(getServiceMarginPercent(row))}</td>
              </>}
              <td className={`${cell} text-center font-medium ${skin.strong}`}>{currency(row.totalPrice ?? row.price)}</td>
              <td className="px-3 py-2.5 print:hidden">{renderExtraActions?.(row)}</td>
            </tr>
          ))}
        </tbody>
        {(rows.length > 0 || extraRows.length > 0) && <tfoot>
          <tr className={`border-t ${skin.panelFoot}`}>
            <td colSpan={internal ? 8 : 5} className={`px-3 py-2.5 text-left text-sm font-semibold ${skin.text}`}>Total Services</td>
            <td className={`px-3 py-2.5 text-center text-sm font-bold ${skin.strong}`}>{currency(customServicesTotal(rows) + customServicesTotal(extraRows))}</td>
            <td className="print:hidden" />
          </tr>
        </tfoot>}
      </table>
      </div>
      {/* The add-service bar is a form control, not part of the document */}
      <div className={`flex items-center justify-between gap-3 border-t px-5 py-3 print:hidden ${skin.panelFoot}`}>
        <p role={problem ? 'alert' : undefined} className={`text-xs ${problem ? 'text-red-600' : 'text-transparent'}`}>{problem || '\u00a0'}</p>
        {addControl || (
          <button type="button" onClick={addBlankRow}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${skin.primary}`}>
            <Plus className="h-4 w-4" />Add Service
          </button>
        )}
      </div>
    </div>
  );
}
