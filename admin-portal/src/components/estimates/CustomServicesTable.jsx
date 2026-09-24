import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FREQUENCY_OPTIONS } from './AddServicePage';

// Services typed in by hand, for an estimate built without an AMC package. These are not catalog
// services: there is no configured rate behind them, so the customer price is entered directly and
// no vendor cost, method or margin is shown. The table always ends in an empty row, which is where
// a service is entered; Add Service commits it and leaves a fresh empty row behind.
const currency = value => `₹${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const BLANK = { name: '', description: '', frequency_type: 'Monthly', frequency_count: 12, price: '' };
const visitsFor = frequency => FREQUENCY_OPTIONS.find(item => item.value === frequency)?.defaultVisits ?? 0;
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

// The row an estimate carries. It keeps the shape of a configured-service add-on so the existing
// service tables, view modals and PDFs render it without knowing where it came from, and `services`
// holds the per-visit price the same way.
export const buildCustomService = values => {
  const name = String(values.name || '').trim();
  const description = String(values.description || '').trim();
  const visits = Number(values.frequency_count) || 0;
  const price = Number(values.price) || 0;
  return {
    addonId: `CUSTOM-${Date.now()}${Math.floor(Math.random() * 1000)}`, customService: true,
    name, service_name: name, description,
    frequency_type: values.frequency_type, frequency_count: visits,
    totalPrice: price, price,
    services: [{ name, description, frequencyType: values.frequency_type, frequency: visits, price: visits ? price / visits : price }]
  };
};

export const customServicesTotal = rows => (rows || []).reduce((sum, row) => sum + (Number(row.totalPrice ?? row.price) || 0), 0);

// `title` is null where the hosting card already names the section, so the heading is never shown twice.
export default function CustomServicesTable({ rows = [], onChange, title = 'Custom Services' }) {
  const [draft, setDraft] = useState(BLANK);
  // Picking a frequency fills the annual visits from the same table the catalog uses; it stays editable
  const setField = (field, value) => setDraft(prev => ({ ...prev, [field]: value,
    ...(field === 'frequency_type' ? { frequency_count: visitsFor(value) } : {}) }));
  const ready = draft.name.trim() !== '' && String(draft.price).trim() !== ''
    && Number.isFinite(Number(draft.price)) && Number(draft.price) >= 0;
  const addDraft = () => {
    if (!ready) return;
    onChange([...rows, buildCustomService(draft)]);
    setDraft(BLANK);
  };
  // Enter commits the row like the button does, rather than submitting the estimate around it
  const addOnEnter = event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addDraft();
  };
  const cell = 'px-3 py-2.5 text-sm text-gray-700';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {title && (
        <div className="border-b border-gray-200 bg-slate-50 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-800">{title} ({rows.length})</h3>
        </div>
      )}
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="w-[5%] px-3 py-2.5 text-center">#</th>
            <th className="w-[22%] px-3 py-2.5 text-left">Service</th>
            <th className="w-[27%] px-3 py-2.5 text-left">Input / Details</th>
            <th className="w-[16%] px-3 py-2.5 text-left">Frequency</th>
            <th className="w-[11%] px-3 py-2.5 text-center">Visits / Year</th>
            <th className="w-[14%] px-3 py-2.5 text-right">Customer Price (₹)</th>
            <th className="w-[5%] px-3 py-2.5 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, index) => (
            <tr key={row.addonId} className="align-top">
              <td className={`${cell} text-center text-gray-500`}>{index + 1}</td>
              <td className={`${cell} break-words font-medium text-gray-800`}>{row.name}</td>
              <td className={`${cell} break-words text-xs text-gray-500 ${row.description ? 'text-left' : 'text-center'}`}>{row.description || '-'}</td>
              <td className={cell}>{row.frequency_type}</td>
              <td className={`${cell} text-center`}>{row.frequency_count}</td>
              <td className={`${cell} text-right font-medium text-gray-800`}>{currency(row.totalPrice ?? row.price)}</td>
              <td className={`${cell} text-center`}>
                <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  title="Remove service" className="text-gray-400 transition-colors hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
          {/* The empty row: the estimate's services are entered here, one at a time. Its Action cell
              stays empty -- committing is the single Add Service button below, which has room for
              its label and cannot be clipped by this column. */}
          <tr className="bg-slate-50/60 align-top">
            <td className={`${cell} text-center text-gray-400`}>{rows.length + 1}</td>
            <td className="px-3 py-2.5">
              <input value={draft.name} onChange={event => setField('name', event.target.value)} onKeyDown={addOnEnter}
                placeholder="Service name" maxLength={150} aria-label="Service name" className={inputClass} />
            </td>
            <td className="px-3 py-2.5">
              <input value={draft.description} onChange={event => setField('description', event.target.value)} onKeyDown={addOnEnter}
                placeholder="e.g. 4 Lifts, 15,000 Sq Ft" maxLength={255} aria-label="Input / details" className={inputClass} />
            </td>
            <td className="px-3 py-2.5">
              <select value={draft.frequency_type} onChange={event => setField('frequency_type', event.target.value)}
                aria-label="Frequency" className={inputClass}>
                {FREQUENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </td>
            <td className="px-3 py-2.5">
              <input type="number" min="0" max="366" step="1" value={draft.frequency_count} onKeyDown={addOnEnter}
                onChange={event => setField('frequency_count', event.target.value)} aria-label="Visits per year" className={`${inputClass} text-center`} />
            </td>
            <td className="px-3 py-2.5">
              <input type="number" min="0" step="0.01" value={draft.price} onChange={event => setField('price', event.target.value)} onKeyDown={addOnEnter}
                placeholder="0" aria-label="Customer price" className={`${inputClass} text-right`} />
            </td>
            <td className="px-3 py-2.5" />
          </tr>
        </tbody>
        {rows.length > 0 && <tfoot>
          <tr className="border-t border-gray-200 bg-slate-50">
            <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold text-gray-700">Total Custom Services</td>
            <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-900">{currency(customServicesTotal(rows))}</td>
            <td />
          </tr>
        </tfoot>}
      </table>
      {/* One Add Service control for this table, stated plainly so a disabled button never reads as broken */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-slate-50 px-5 py-3">
        <p className="text-xs text-gray-500">
          {ready ? 'Adds the service above to this estimate.' : 'Enter a service name and customer price to add it.'}
        </p>
        <button type="button" onClick={addDraft} disabled={!ready}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400">
          <Plus className="h-4 w-4" />Add Service
        </button>
      </div>
    </div>
  );
}
