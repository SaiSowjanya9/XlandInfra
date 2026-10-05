import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { FREQUENCY_OPTIONS } from './AddServicePage';
import { frequencyOptionStyle, isCustomFrequency } from '../../utils/estimateStore';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';
import { customServiceValues, customVisitsComplaint } from './CustomServicesTable';
import { capitalizeFirst } from '../../utils/text';
import AutocompleteInput from '../common/AutocompleteInput';
import useServiceCategories from '../../hooks/useServiceCategories';

// A service typed in by hand is entered here rather than in the table row, because a row has no
// space for what one needs: a category, a quantity and whether the job needs a vendor as well as
// the name, description, schedule and price. OK adds it to the Custom Services table as one row.
//
// Where the price is a customer's the vendor cost and markup are asked for too, and the price,
// XLAND cost and margin derive from them by the same rule the service form prices a catalog
// service: price = vendor cost + vendor cost x markup/100, margin = XLAND cost / price. Where the
// field prices a vendor instead (a package's hand-typed row) there is no markup to charge, so
// those fields stay out of the dialog.
const FREQUENCY_CHOICES = [...FREQUENCY_OPTIONS, { value: 'Custom', label: 'Custom', defaultVisits: null }];
const visitsFor = frequency => FREQUENCY_OPTIONS.find(item => item.value === frequency)?.defaultVisits ?? 0;
const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;
const isFigure = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) >= 0;

//  names the figure being entered. An estimate's custom service is sold to a customer,
// so it asks for the customer price; a package's hand-typed row is bought from a vendor, so it asks
// for the vendor price. The field is the same field either way, which is why this is a label rather
// than a second dialog.
export default function CustomServiceDialog({ open, onClose, onSubmit, editing = null,
  apiPath = '/api/admin/service-catalog', fpId, theme,
  title, priceLabel = 'Customer Price', subtitle = 'Entered by hand, so the customer price is set here rather than calculated' }) {
  // Vendor cost and markup only where the figure sold is a customer's. A package row's price IS
  // what the vendor charges, so asking for a vendor cost beside it would price the row twice.
  const withCosts = priceLabel === 'Customer Price';
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  const [values, setValues] = useState(() => customServiceValues(editing));
  const [problem, setProblem] = useState('');
  const nameRef = useRef(null);
  // Category suggestions are the service catalog's own, so a category used on a configured service
  // and one typed here are offered from the same list -- and saved into the same list
  const { categories, canManage, createCategory, deleteCategory } = useServiceCategories({ apiPath, fpId, enabled: open });

  // Reopening starts from the row being edited, or from the defaults for a new one
  useEffect(() => {
    if (!open) return;
    setValues(customServiceValues(editing));
    setProblem('');
  }, [open, editing]);

  // Escape dismisses, as it does on the configured-service dialog
  useEffect(() => {
    if (!open) return;
    const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => { if (open) nameRef.current?.focus(); }, [open]);

  const categoryOptions = useMemo(() => {
    const options = categories.map(category => ({ label: category.name, value: category.name, id: category.id, removable: category.removable }));
    const typed = String(values.category || '').trim();
    // Where the tick can save it, a typed category stays out of the list until it is saved -- an
    // option matching what was typed is exactly what hides the save row. Without the tick (FP
    // staff, Operations Manager) it is still offered for the rest of the session, as before.
    if (canManage || !typed || options.some(option => option.label.toLowerCase() === typed.toLowerCase())) return options;
    return [{ label: typed, value: typed }, ...options];
  }, [values.category, categories, canManage]);

  const setField = (field, raw) => {
    setProblem('');
    const value = field === 'name' || field === 'description' ? capitalizeFirst(raw) : raw;
    setValues(prev => {
      const next = { ...prev, [field]: value,
        // The frequency states how many visits a year it means, so the count follows it. Custom is
        // the exception: it has no count of its own, so the figure is typed.
        ...(field === 'frequency_type' && !isCustomFrequency(value) ? { frequency_count: visitsFor(value) } : {}) };
      // Vendor cost and markup together set the customer price -- the same rule the service form
      // prices a catalog service by. With a cost alone the price stays typed, and the margin that
      // price makes is shown live below.
      if (field === 'vendorCost' || field === 'markupPercentage') {
        const cost = Number(next.vendorCost), markup = Number(next.markupPercentage);
        if (isFigure(next.vendorCost) && isFigure(next.markupPercentage)) {
          next.price = String(round2(cost * (1 + markup / 100)));
        }
      }
      return next;
    });
  };

  // What the row costs and earns: XLAND cost is the price over the vendor cost, margin that figure
  // as a share of the price -- both derived, never typed.
  const costed = withCosts && isFigure(values.vendorCost);
  const autoPriced = costed && isFigure(values.markupPercentage);
  const priceFigure = Number(values.price);
  const xlandCost = costed && Number.isFinite(priceFigure) ? round2(priceFigure - Number(values.vendorCost)) : null;
  const marginPercent = costed && priceFigure > 0 ? round2((priceFigure - Number(values.vendorCost)) / priceFigure * 100) : null;

  if (!open) return null;

  const submit = () => {
    if (!String(values.name).trim()) return setProblem('Enter a service name.');
    if (withCosts && values.vendorCost !== '' && !isFigure(values.vendorCost)) return setProblem('Enter a vendor cost of 0 or more, or leave it empty.');
    if (withCosts && values.markupPercentage !== '' && (!Number.isFinite(Number(values.markupPercentage)) || Number(values.markupPercentage) < 0 || Number(values.markupPercentage) > 1000)) {
      return setProblem('Enter a markup between 0 and 1000%.');
    }
    const price = String(values.price ?? '').trim();
    if (price === '' || !Number.isFinite(Number(price)) || Number(price) < 0) return setProblem(`Enter a ${priceLabel.toLowerCase()} for this service.`);
    const quantity = Number(values.quantity);
    if (values.quantity !== '' && (!Number.isInteger(quantity) || quantity < 1)) return setProblem('Enter the quantity as a whole number of 1 or more.');
    const visitsIssue = customVisitsComplaint(values);
    if (visitsIssue) return setProblem(visitsIssue);
    onSubmit({ ...values, name: String(values.name).trim(), description: String(values.description || '').trim(), category: String(values.category || '').trim() });
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

            {/* Type a category that is not listed and the tick saves it into this same list, so it
                is offered next time without waiting for the estimate to be saved; the cross beside
                one nothing uses yet takes a misspelling out again */}
            <div>
              <AutocompleteInput label="Category" value={values.category} onChange={value => setField('category', value)}
                options={categoryOptions} placeholder="Type or select category..." allowCustom showAllOnOpen capitalize
                onCreateOption={canManage ? createCategory : undefined}
                onDeleteOption={canManage ? deleteCategory : undefined}
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

            {withCosts && <>
              <label className="block">
                <span className={label}>Vendor Cost (₹)</span>
                <input type="number" min="0" step="0.01" value={values.vendorCost}
                  onChange={event => setField('vendorCost', event.target.value)} placeholder="What the vendor charges" className={field} />
              </label>

              <label className="block">
                <span className={label}>Markup (%)</span>
                <input type="number" min="0" max="1000" step="0.01" value={values.markupPercentage}
                  onChange={event => setField('markupPercentage', event.target.value)} placeholder="Charged on the vendor cost" className={field} />
              </label>
            </>}

            <label className="block">
              <span className={label}>{priceLabel} (₹) <span className="text-red-500">*</span></span>
              {/* Vendor cost and markup together set this; type over it only where no markup is
                  being charged */}
              <input type="number" min="0" step="0.01" value={values.price}
                readOnly={autoPriced}
                title={autoPriced ? 'Vendor cost plus markup' : undefined}
                onChange={event => setField('price', event.target.value)} placeholder="0"
                className={autoPriced ? readOnlyField : field} />
            </label>

            {/* Derived, never typed: the markup in rupees and its share of the price -- the same
                two readouts the service form shows a catalog service. Shown from the start, so the
                pair is where the reader expects it; a dash stands in until a cost makes them real. */}
            {withCosts && <>
              <label className="block">
                <span className={label}>XLAND Cost (₹)</span>
                <input readOnly value={xlandCost == null ? '—' : xlandCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  title="Customer price minus vendor cost" className={readOnlyField} />
              </label>
              <label className="block">
                <span className={label}>Margin %</span>
                <input readOnly value={marginPercent == null ? '—' : `${marginPercent}%`}
                  title="XLAND cost as a share of the customer price" className={readOnlyField} />
              </label>
            </>}

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
