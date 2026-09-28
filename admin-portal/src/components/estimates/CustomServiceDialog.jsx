import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { FREQUENCY_OPTIONS } from './AddServicePage';
import { frequencyOptionStyle, isCustomFrequency } from '../../utils/estimateStore';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';
import { customServiceValues } from './CustomServicesTable';
import AutocompleteInput from '../common/AutocompleteInput';

const API_BASE = import.meta.env.VITE_API_URL || '';

// A service typed in by hand is entered here rather than in the table row, because a row has no
// space for what one needs: a category, a quantity and whether the job needs a vendor as well as
// the name, description, schedule and price. OK adds it to the Custom Services table as one row.
//
// There is no configured rate behind it, so the customer price is entered directly -- no vendor
// cost, markup or margin is asked for or shown.
const FREQUENCY_CHOICES = [...FREQUENCY_OPTIONS, { value: 'Custom', label: 'Custom', defaultVisits: null }];
const visitsFor = frequency => FREQUENCY_OPTIONS.find(item => item.value === frequency)?.defaultVisits ?? 0;

//  names the figure being entered. An estimate's custom service is sold to a customer,
// so it asks for the customer price; a package's hand-typed row is bought from a vendor, so it asks
// for the vendor price. The field is the same field either way, which is why this is a label rather
// than a second dialog.
export default function CustomServiceDialog({ open, onClose, onSubmit, editing = null,
  apiPath = '/api/admin/service-catalog', fpId, theme,
  title, priceLabel = 'Customer Price', subtitle = 'Entered by hand, so the customer price is set here rather than calculated' }) {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  const [values, setValues] = useState(() => customServiceValues(editing));
  const [problem, setProblem] = useState('');
  const [categories, setCategories] = useState([]);
  const nameRef = useRef(null);
  const token = getAuthToken();

  // Reopening starts from the row being edited, or from the defaults for a new one
  useEffect(() => {
    if (!open) return;
    setValues(customServiceValues(editing));
    setProblem('');
  }, [open, editing]);

  // Category suggestions are the service catalog's own, so a category used on a configured service
  // and one typed here are offered from the same list
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`${API_BASE}${apiPath}/categories?${new URLSearchParams({ fpId: fpId || 'all' })}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(response => response.json())
      // The endpoint answers with { name } objects, so the names are taken out here
      .then(result => {
        if (!result?.success || !Array.isArray(result.data)) return;
        setCategories([...new Set(result.data
          .map(item => (typeof item === 'string' ? item : item?.name))
          .filter(name => typeof name === 'string' && name.trim()))]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open, apiPath, fpId, token]);

  // Escape dismisses, as it does on the configured-service dialog
  useEffect(() => {
    if (!open) return;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => { if (open) nameRef.current?.focus(); }, [open]);

  // A category typed here is offered for the rest of the session straight away; it comes back from
  // the server once the estimate is saved, because the estimate itself is where it is stored
  const categoryOptions = useMemo(
    () => [...new Set([values.category, ...categories].filter(Boolean))], [values.category, categories]);

  const setField = (field, value) => {
    setProblem('');
    setValues(prev => ({ ...prev, [field]: value,
      // The frequency states how many visits a year it means, so the count follows it. Custom is
      // the exception: it has no count of its own, so the figure is typed.
      ...(field === 'frequency_type' && !isCustomFrequency(value) ? { frequency_count: visitsFor(value) } : {}) }));
  };

  if (!open) return null;

  const submit = () => {
    if (!String(values.name).trim()) return setProblem('Enter a service name.');
    const price = String(values.price ?? '').trim();
    if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return setProblem(`Enter a ${priceLabel.toLowerCase()} for this service.`);
    const quantity = Number(values.quantity);
    if (values.quantity !== '' && (!Number.isInteger(quantity) || quantity < 1)) return setProblem('Enter the quantity as a whole number of 1 or more.');
    onSubmit(values);
  };

  const label = `mb-1.5 block text-xs font-medium ${skin.label}`;
  const field = `w-full rounded-[10px] border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${skin.fieldSoft}`;
  const readOnlyField = `${field} ${skin.readOnlyBg} cursor-not-allowed`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="custom-service-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className={`flex items-start justify-between gap-4 border-b px-6 py-4 ${skin.border}`}>
          <div>
            <h3 id="custom-service-title" className={`text-base font-semibold ${skin.strong}`}>{title ?? (editing ? 'Edit Service' : 'Add Custom Service')}</h3>
            <p className={`mt-1 text-xs ${skin.muted}`}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className={`shrink-0 rounded-[10px] p-1.5 ${skin.faint} ${skin.iconMuted}`}><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={label}>Service <span className="text-red-500">*</span></span>
              <input ref={nameRef} value={values.name} onChange={event => setField('name', event.target.value)}
                maxLength={150} placeholder="Service name" className={field} />
            </label>

            <label className="block sm:col-span-2">
              <span className={label}>Description</span>
              <textarea value={values.description} onChange={event => setField('description', event.target.value)}
                rows={2} maxLength={255} placeholder="What this service covers" className={`${field} resize-y`} />
            </label>

            {/* Type a category that is not listed and it is saved with the estimate, which is what
                puts it in this list next time */}
            <div>
              <AutocompleteInput label="Category" value={values.category} onChange={value => setField('category', value)}
                options={categoryOptions} placeholder="Type or select category..." allowCustom showAllOnOpen
                inputClassName="text-sm" theme={theme ?? pageTheme} />
            </div>

            <label className="block">
              <span className={label}>Quantity (Nos)</span>
              <input type="number" min="1" step="1" value={values.quantity}
                onChange={event => setField('quantity', event.target.value)} className={field} />
            </label>

            <label className="block">
              <span className={label}>Frequency</span>
              <select value={values.frequency_type} onChange={event => setField('frequency_type', event.target.value)} className={field}>
                {FREQUENCY_CHOICES.map(option => (
                  <option key={option.value} value={option.value} style={frequencyOptionStyle(option.value)}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={label}>Visits / Year</span>
              {/* Fixed by the frequency, unless the frequency is Custom */}
              <input type="number" min="0" max="366" step="1" value={values.frequency_count}
                readOnly={!isCustomFrequency(values.frequency_type)}
                title={isCustomFrequency(values.frequency_type) ? undefined : `${values.frequency_type} means ${values.frequency_count} visits a year. Choose Custom to set your own.`}
                onChange={event => setField('frequency_count', event.target.value)}
                className={isCustomFrequency(values.frequency_type) ? field : readOnlyField} />
            </label>

            <label className="block">
              <span className={label}>{priceLabel} (₹) <span className="text-red-500">*</span></span>
              <input type="number" min="0" step="0.01" value={values.price}
                onChange={event => setField('price', event.target.value)} placeholder="0" className={field} />
            </label>

            <div>
              <span className={label}>Vendor Required</span>
              <button type="button" role="switch" aria-checked={values.vendorRequired} aria-label="Vendor required"
                onClick={() => setField('vendorRequired', !values.vendorRequired)}
                className={`flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition-colors ${values.vendorRequired ? skin.toggleOn : skin.toggleOff}`}>
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${values.vendorRequired ? skin.toggleTrackOn : skin.toggleTrackOff}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${values.vendorRequired ? 'left-[1.125rem]' : 'left-0.5'}`} />
                </span>
                {values.vendorRequired ? 'Yes' : 'No'}
              </button>
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 border-t px-6 py-4 ${skin.panelFoot}`}>
          {/* Said on the press rather than by disabling OK, which reads as broken */}
          <p role={problem ? 'alert' : undefined} className={`text-xs ${problem ? 'text-red-600' : 'text-transparent'}`}>{problem || '\u00a0'}</p>
          <div className="flex shrink-0 items-center gap-3">
            <button type="button" onClick={onClose} className={`rounded-[10px] border px-4 py-2 text-sm font-medium ${skin.secondary}`}>Cancel</button>
            <button type="button" onClick={submit}
              className={`inline-flex items-center gap-2 rounded-[10px] px-6 py-2 text-sm font-semibold text-white ${skin.primary}`}>
              <Check className="h-4 w-4" />{editing ? 'Save Changes' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
