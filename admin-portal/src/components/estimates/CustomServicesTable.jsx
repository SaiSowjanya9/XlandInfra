import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { FREQUENCY_OPTIONS } from './AddServicePage';
import { frequencyOptionStyle, isCustomFrequency } from '../../utils/estimateStore';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';

// Services typed in by hand, for an estimate built without an AMC package. These are not catalog
// services: there is no configured rate behind them, so the customer price is entered directly and
// no vendor cost, method or margin is shown. Rows are added on request rather than the table always
// trailing a blank one, and a row can be edited in place or removed.
const currency = value => `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
  return {
    addonId: addonId || `CUSTOM-${Date.now()}${Math.floor(Math.random() * 1000)}`, customService: true,
    name, service_name: name, description,
    frequency_type: values.frequency_type, frequency_count: visits,
    totalPrice: price, price,
    services: [{ name, description, frequencyType: values.frequency_type, frequency: visits, price: visits ? price / visits : price }]
  };
};

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
  return '';
};

// `title` is null where the hosting card already names the section, so the heading is never shown
// twice. `addControl` replaces the default Add Service button, which is how the FP form offers
// catalog services and a blank row from the one dropdown instead of a second picker beside it.
//
// `extraRows` are services added from the catalog. They are held in the caller's own array, because
// the estimate payload prices them differently, but they belong in this table: whichever way a
// service was added, the estimate has one list of them, numbered straight through. They are not
// edited inline -- their figures come from the server -- so the caller supplies their actions.
export default function CustomServicesTable({ rows = [], onChange, title = 'Custom Services', addControl = null,
  extraRows = [], renderExtraActions = null, theme }) {
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
    setEdit({ index, values: { name: row.name, description: row.description, frequency_type: row.frequency_type,
      frequency_count: row.frequency_count, price: isBlank(row) ? '' : (row.totalPrice ?? row.price) } });
  };
  // A row arrives blank from the Custom option, so it opens for typing without another click
  useEffect(() => {
    if (edit) return;
    const index = rows.findIndex(isBlank);
    if (index >= 0) startEdit(index);
  }, [rows, edit]);

  // Picking a frequency fills the annual visits from the same table the catalog uses; it stays editable
  const setEditField = (field, value) => {
    setProblem('');
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
      <table className="w-full table-fixed">
        <thead>
          {/* The table is fixed-width and often sits in a narrow form column, so a heading that
              does not fit wraps onto a second line instead of running into its neighbour -- nowrap
              on all seven had "Visits / Year" and "Customer Price (₹)" touching. Each long label
              breaks after its first word and no further: the non-breaking spaces hold "/ Details",
              "/ Year" and "Price (₹)" together, and align-bottom keeps one- and two-line headings
              on the same baseline. */}
          <tr className={`border-b text-xs font-semibold uppercase tracking-wide ${skin.headRow}`}>
            <th className="w-[5%] whitespace-nowrap px-3 py-2.5 text-center align-bottom">#</th>
            <th className="w-[19%] whitespace-nowrap px-3 py-2.5 text-left align-bottom">Service</th>
            <th className="w-[21%] px-3 py-2.5 text-left align-bottom">Input /&nbsp;Details</th>
            <th className="w-[14%] whitespace-nowrap px-3 py-2.5 text-left align-bottom">Frequency</th>
            <th className="w-[12%] px-3 py-2.5 text-center align-bottom">Visits /&nbsp;Year</th>
            <th className="w-[18%] px-3 py-2.5 text-right align-bottom">Customer Price&nbsp;(₹)</th>
            <th className="w-[11%] whitespace-nowrap px-3 py-2.5 text-center align-bottom">Action</th>
          </tr>
        </thead>
        <tbody className={`divide-y ${skin.rowDivide}`}>
          {!rows.length && !extraRows.length && (
            <tr><td colSpan={7} className={`px-3 py-8 text-center text-sm ${skin.faint}`}>
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
              <td className="px-3 py-2.5">
                <input type="number" min="0" step="0.01" value={edit.values.price} onChange={event => setEditField('price', event.target.value)} onKeyDown={onKeyDown}
                  placeholder="0" aria-label="Customer price" className={`${numberClass} text-right`} />
              </td>
              <td className="px-3 py-2.5">
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
              <td className={`${cell} break-words font-medium ${skin.strong}`}>{row.name}</td>
              <td className={`${cell} break-words text-xs ${skin.muted} ${row.description ? 'text-left' : 'text-center'}`}>{row.description || '-'}</td>
              <td className={cell}>{row.frequency_type}</td>
              <td className={`${cell} text-center`}>{row.frequency_count}</td>
              <td className={`${cell} text-right font-medium ${skin.strong}`}>{currency(row.totalPrice ?? row.price)}</td>
              {/* Every row can be amended or taken back off the estimate */}
              <td className="px-3 py-2.5">
                <div className="flex items-center justify-center gap-1">
                  <button type="button" onClick={() => startEdit(index)} title={`Edit ${row.name}`} aria-label={`Edit ${row.name}`}
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
              <td className={`${cell} break-words font-medium ${skin.strong}`}>{row.name}</td>
              <td className={`${cell} break-words text-xs ${skin.muted} ${row.description ? 'text-left' : 'text-center'}`}>{row.description || '-'}</td>
              <td className={cell}>{row.frequency_type}</td>
              <td className={`${cell} text-center`}>{row.frequency_count}</td>
              <td className={`${cell} text-right font-medium ${skin.strong}`}>{currency(row.totalPrice ?? row.price)}</td>
              <td className="px-3 py-2.5">{renderExtraActions?.(row)}</td>
            </tr>
          ))}
        </tbody>
        {(rows.length > 0 || extraRows.length > 0) && <tfoot>
          <tr className={`border-t ${skin.panelFoot}`}>
            <td colSpan={5} className={`px-3 py-2.5 text-right text-sm font-semibold ${skin.text}`}>Total Services</td>
            <td className={`px-3 py-2.5 text-right text-sm font-bold ${skin.strong}`}>{currency(customServicesTotal(rows) + customServicesTotal(extraRows))}</td>
            <td />
          </tr>
        </tfoot>}
      </table>
      <div className={`flex items-center justify-between gap-3 border-t px-5 py-3 ${skin.panelFoot}`}>
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
