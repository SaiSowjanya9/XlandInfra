import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Plus, X } from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import ManpowerFields from './ManpowerFields';
import CapacitySlabList, { CapacitySlabSelect } from './CapacitySlabList';
import { isVisitManpower, suggestedManpower } from '../../utils/manpowerPricing';
import { FREQUENCY_OPTIONS, getServiceSchedule, methodLabel, serviceOptionLabel } from './AddServicePage';
import { estimateSkin, useEstimateTheme } from '../../utils/estimateTheme';
import { resolveVisits, sanitizeVisits } from '../../utils/visitsPerYear';
import useScrollLock from '../../hooks/useScrollLock';

const API_BASE = import.meta.env.VITE_API_URL || '';
// The dropdown sits on the panel's own tint; the dialog's fields sit on white and follow the
// borders the rest of the estimate forms use. Both come from the skin, so a portal on the warm
// system gets warm fields and every other portal keeps the original slate/blue ones.
const selectClass = skin => `w-full rounded-lg border bg-white px-3 py-2 text-sm ${skin.selectBorder} ${skin.disabledField}`;
// `inline` drops the panel so the dropdown can sit on a row beside another one -- on the Estimate
// Structure row next to Select AMC Package -- rather than in a tinted box of its own.
const inlineSelectClass = skin => `w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm ${skin.inputBorder} ${skin.disabledField}`;
const inputClassFor = skin => `w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${skin.fieldSoft} ${skin.disabledField}`;
const fieldLabelFor = skin => `block text-xs font-semibold ${skin.label}`;
const currency = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
const categoryName = value => (typeof value === 'string' ? value : value?.name) || '';
const INPUTS = {
  quantity_based: ['quantity', 'Quantity', 1], area_based: ['area', 'Area', 0.01],
  capacity_based: ['capacity', 'Capacity', 0.01], capacity_slab: ['capacity', 'Capacity', 1],
  manpower: ['personnel', 'Personnel count', 1]
};

// `editing` is a row already on the estimate. Passing one reopens this dialog on the service it was
// added from, with the figures it was priced from, so changing an area or a frequency is a re-price
// rather than a delete and a re-add. `onAdd` receives the rebuilt row under the same addonId, so the
// caller upserts rather than appends.
const ServiceCatalogPicker = ({ fpId, propertyType, selectedAddons, onAdd, apiPath = '/api/admin/service-catalog',
  label = 'Add Service', editing = null, onEditClose = () => {}, inline = false,
  // 'menu' replaces the dropdown panel with an Add Service button that opens the same list, so the
  // custom-services table can offer configured services and a blank row from one control instead of
  // repeating the picker in a panel of its own. `extraItems` are listed above the services.
  variant = 'panel', extraItems = [], theme }) => {
  // The hook runs every render; an explicit theme prop still wins over the page's own
  const pageTheme = useEstimateTheme();
  const skin = estimateSkin(theme ?? pageTheme);
  const inputClass = inputClassFor(skin);
  const fieldLabel = fieldLabelFor(skin);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu is drawn into document.body: every card it sits in clips its overflow, which cut the
  // list off mid-item and hid Custom entirely. A portal with fixed coordinates escapes all of them.
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const menuPanelRef = useRef(null);
  const [services, setServices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [inputs, setInputs] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requiresQuote, setRequiresQuote] = useState(false);
  // Even where the service permits it, changing the frequency is a deliberate act
  const [overrideFrequency, setOverrideFrequency] = useState(false);
  // Priced as the inputs change so the cost breakdown is visible before the service is added
  const [preview, setPreview] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const quoteRequest = useRef(null);
  const token = getAuthToken();
  const service = services.find(item => String(item.id) === selectedId);
  // The page stays put while a service's details are open over it
  useScrollLock(Boolean(service));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ fpId: fpId || 'all', propertyType: propertyType || '' });
    fetch(`${API_BASE}${apiPath}?${params}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load services.');
      setServices(result.data);
    }).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); quoteRequest.current?.abort(); };
  }, [apiPath, fpId, propertyType, token, attempt]);

  // The row this service is already on the estimate as, if it is
  const rowFor = item => (item ? selectedAddons.find(addon => addon.catalogServiceId === item.id) : undefined);

  // Opens the dialog on a service. `row` is what it is already on the estimate as: passing one
  // reopens the figures it was priced from, so picking a service a second time is a re-price and
  // never a reset. Without one the service's own defaults are used.
  const openService = (item, row) => {
    setSelectedId(item ? String(item.id) : '');
    setError('');
    setPreview(null);
    if (!item) {
      setOverrideFrequency(false);
      setRequiresQuote(false);
      setInputs({});
      return;
    }
    if (row) {
      setRequiresQuote(Boolean(row.pricingInputs?.custom_quote));
      // The checkbox reflects what was actually saved: ticked only where the row left the service's schedule
      setOverrideFrequency(Boolean(item.allow_frequency_override) && row.frequency_type !== item.default_frequency);
      setInputs({ ...row.pricingInputs, frequency: row.frequency_type, visits: row.frequency_count });
      return;
    }
    setOverrideFrequency(false);
    setRequiresQuote(item.pricing_method === 'custom_quote');
    setInputs({ frequency: item.default_frequency, visits: item.default_visits_per_year, custom_work_cost: item.custom_work_rate ?? 0,
      // Carried from the service so the quote is unchanged, but not shown or editable here: what
      // XLAND spends running the service is internal, and this dialog states only the customer price.
      operating_cost: item.default_operating_cost ?? 0,
      ...(isVisitManpower(item) ? { personnel: suggestedManpower(item), overtime_hours_per_visit: 0 } : {}) });
  };

  const selectService = id => {
    const item = services.find(value => String(value.id) === id);
    openService(item, rowFor(item));
  };
  // Closing has to clear the row being edited too, or this effect would reopen the dialog on it
  const closeDialog = () => { selectService(''); onEditClose(); };
  // An edited row opens the dialog on its own service, prefilled with what it was priced from
  useEffect(() => {
    if (!editing || !services.length) return;
    const item = services.find(value => value.id === editing.catalogServiceId);
    if (item) openService(item, editing);
  }, [editing, services]);
  // Escape dismisses the dialog, the way the other estimate dialogs behave. Never mid-save: the
  // service is being priced on the server at that point.
  useEffect(() => {
    if (!service) return;
    const onKeyDown = event => { if (event.key === 'Escape' && !saving) closeDialog(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [service, saving, editing]);
  // Anchored to the button: above it when there is room, below it when there is not, and right-aligned
  // so a wide list never runs off the edge of the screen.
  const MENU_HEIGHT = 320;
  // Where the menu goes for the button as it is on screen now. Null once the button is out of view.
  const placeMenu = () => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return null;
    const above = rect.top > MENU_HEIGHT + 16;
    return {
      right: Math.max(8, window.innerWidth - rect.right),
      ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      // Never collapse to nothing in a short viewport: it scrolls instead
      maxHeight: Math.max(180, Math.min(MENU_HEIGHT, (above ? rect.top : window.innerHeight - rect.bottom) - 16)),
      minWidth: Math.max(rect.width, 260)
    };
  };
  const openMenu = () => {
    const position = placeMenu();
    if (!position) return;
    setMenuPosition(position);
    setMenuOpen(true);
  };
  // Closes on a click elsewhere or Escape, like any dropdown. The panel is outside this component's
  // DOM subtree, so a click inside it has to be excused explicitly.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = event => {
      if (menuRef.current?.contains(event.target) || menuPanelRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = event => { if (event.key === 'Escape') setMenuOpen(false); };
    // The menu follows its button as the page scrolls or resizes. It used to close on any scroll at
    // all -- the listener captures every element's scroll, the menu's own list included -- so the
    // moment the services were scrolled to find one, the menu vanished. Its own scroll is ignored,
    // and it closes only once the button itself has left the screen.
    let frame = 0;
    const onReflow = event => {
      if (event?.target instanceof Node && menuPanelRef.current?.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const position = placeMenu();
        if (position) setMenuPosition(position); else setMenuOpen(false);
      });
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [menuOpen]);
  // Quote on the server as soon as the service has what it needs, so vendor cost, XLAND cost,
  // customer price and margin fill in by themselves rather than only after adding the service.
  useEffect(() => {
    if (!service || !propertyType) return;
    const required = INPUTS[service.pricing_method]?.[0];
    if (required && (inputs[required] === undefined || inputs[required] === '')) {
      setPreview(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${API_BASE}${apiPath}/${service.id}/quote`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, property_type: propertyType, fpId: fpId || 'all' }), signal: controller.signal
      }).then(response => response.json())
        .then(result => {
          if (result?.success) {
            setPreview(result.data);
            // The server is the authority on whether a figure needs quoting by hand; a custom-quote
            // answer opens the vendor cost field the same way picking such a slab does
            if (result.data?.requiresCustomQuote) setRequiresQuote(true);
          } else setPreview(null);
        })
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [service, inputs, propertyType, apiPath, fpId, token]);

  const setInput = (field, value) => {
    if (field === 'capacity' && service.pricing_method === 'capacity_slab') setRequiresQuote(false);
    setInputs(prev => ({ ...prev, [field]: value, ...(field === 'capacity' && service.pricing_method === 'capacity_slab'
      ? { ...getServiceSchedule(service, value), custom_quote: undefined } : {}),
      ...(field === 'area' && isVisitManpower(service) ? { personnel: suggestedManpower(service, value) } : {}) }));
  };
  const addService = async () => {
    if (!service || saving) return;
    setSaving(true);
    setError('');
    const controller = new AbortController();
    quoteRequest.current = controller;
    try {
      const response = await fetch(`${API_BASE}${apiPath}/${service.id}/quote`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, property_type: propertyType, fpId: fpId || 'all' }), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to price this service.');
      const quote = result.data;
      if (quote.requiresCustomQuote) {
        setRequiresQuote(true);
        setError('This capacity requires a custom quote. Enter the total vendor cost for the selected service period.');
        return;
      }
      onAdd({
        addonId: `CAT-${service.id}`, catalogServiceId: service.id,
        name: service.service_name, service_name: service.service_name, description: service.description,
        pricing_method: service.pricing_method, unit: service.unit, manpower_basis: service.manpower_basis, role_designation: service.role_designation,
        category: service.category,
        applicable_property_types: service.applicable_property_types,
        frequency_type: quote.frequency, frequency_count: quote.visits,
        totalPrice: quote.totalPrice, pricingInputs: quote.inputs,
        // The cost figures ride on the draft row so the create form's internal view can show them;
        // the save payload maps its own fields, so they never reach the estimate or the customer.
        vendorCost: quote.vendorCost, operatingCost: quote.operatingCost, marginPercentage: quote.marginPercentage,
        vendorRatePerVisit: quote.vendorRatePerVisit, pricingSnapshot: { ...service, ...quote },
        services: [{ name: service.service_name, description: service.description, frequencyType: quote.frequency, frequency: quote.visits, price: quote.visits ? quote.totalPrice / quote.visits : quote.totalPrice }]
      });
      closeDialog();
    } catch (error) {
      if (error.name !== 'AbortError') setError(error.message);
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  };
  // Every configured service stays listed, whether or not it is already on the estimate: a picker
  // that drops what was chosen leaves the user hunting for a service that looks deleted. The ones
  // already there are marked, and picking one reopens it for re-pricing under the same row.
  const available = services;
  const input = service && INPUTS[service.pricing_method];
  // OK stays out of reach until the service has the figures it is priced from, so a row is never
  // added at a price the server could not work out.
  const blank = value => value === undefined || value === null || String(value).trim() === '';
  const incomplete = !!service && ((input && blank(inputs[input[0]]))
    || (isVisitManpower(service) && service.manpower_ranges?.length > 0 && blank(inputs.area))
    || (requiresQuote && blank(inputs.custom_quote)));

  return (
    <div className={variant === 'menu' ? 'inline-block shrink-0' : inline ? 'min-w-0' : `mb-4 rounded-lg border p-4 ${skin.tint}`}
      ref={variant === 'menu' ? menuRef : undefined}>
      {variant === 'menu' ? (<>
        <button type="button" onClick={() => menuOpen ? setMenuOpen(false) : openMenu()} disabled={loading || saving}
          aria-haspopup="menu" aria-expanded={menuOpen}
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${skin.disabledSolid} ${skin.primary}`}>
          <Plus className="h-4 w-4" />Add Service<ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && menuPosition && createPortal(
          <div ref={menuPanelRef} role="menu" style={{ position: 'fixed', ...menuPosition }}
            className={`z-50 flex max-w-[22rem] flex-col overflow-hidden rounded-xl border bg-white shadow-xl ${skin.border}`}>
            <div className="min-h-0 overflow-y-auto overscroll-contain py-1">
              {extraItems.map(item => (
                <button key={item.key} type="button" role="menuitem" onClick={() => { setMenuOpen(false); item.onSelect(); }}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors ${skin.menuItem}`}>
                  <Plus className={`h-4 w-4 shrink-0 ${skin.faint}`} />{item.label}
                </button>
              ))}
              {extraItems.length > 0 && <div className={`my-1 border-t ${skin.borderSoft}`} />}
              <p className={`px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide ${skin.faint}`}>Services</p>
              {!propertyType ? <p className={`px-3 py-2 text-sm ${skin.muted}`}>Select a property type first</p>
                : available.length ? available.map(item => (
                  <button key={item.id} type="button" role="menuitem" onClick={() => { setMenuOpen(false); selectService(String(item.id)); }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${skin.menuItem}`}
                    title={serviceOptionLabel(item, services)}>
                    {/* A service already on the estimate is listed like any other, unmarked; picking
                        it reopens its figures rather than adding a second row */}
                    <span className="min-w-0 flex-1 truncate">{serviceOptionLabel(item, services)}</span>
                  </button>
                )) : <p className={`px-3 py-2 text-sm ${skin.muted}`}>No services for this property type.</p>}
              {error && <p role="alert" className="px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>
          </div>, document.body)}
      </>) : (<>
        <label className={`block text-sm font-medium ${inline ? 'min-w-0' : 'max-w-md'} ${inline ? skin.label : skin.text}`}>
          {label}
          {/* Unchosen reads as a placeholder, not as a value */}
          <select value={selectedId} onChange={event => selectService(event.target.value)} disabled={loading || !propertyType || saving}
            className={`${inline ? inlineSelectClass(skin) : selectClass(skin)} ${inline ? 'mt-1.5' : 'mt-2'} ${selectedId ? skin.strong : skin.faint}`}>
            <option value="" className={skin.faint}>{loading ? 'Loading services...' : !propertyType ? 'Select a property type first' : 'Select service'}</option>
            {available.map(item => <option key={item.id} value={item.id} className={skin.strong}>{serviceOptionLabel(item, services)}</option>)}
          </select>
        </label>
        {!loading && !services.length && !error && <p className={`mt-2 text-xs ${skin.muted}`}>No services available for this property type.</p>}
        {/* A load failure belongs on the panel; anything the dialog raises is shown inside it */}
        {error && !service && <p role="alert" className="mt-3 text-sm text-red-600">{error} {!services.length && <button type="button" onClick={() => setAttempt(value => value + 1)} className="font-semibold underline">Retry</button>}</p>}
      </>)}

      {/* Selecting a service opens its details here rather than expanding the panel: the estimate
          gets its row only once OK is pressed, so a service being looked at is never half-added. */}
      {service && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="catalog-service-title">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
          <div className={`flex items-start justify-between gap-4 border-b px-6 py-4 ${skin.border}`}>
            <div className="min-w-0">
              <h3 id="catalog-service-title" className={`truncate text-base font-semibold ${skin.strong}`}>{service.service_name}</h3>
              <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-xs ${skin.muted}`}>
                <span className={`rounded px-2 py-0.5 font-semibold ${skin.badge}`}>{methodLabel(service.pricing_method)}</span>
                {categoryName(service.category) && <span>{categoryName(service.category)}</span>}
                <span>Priced per {service.unit}</span>
              </div>
            </div>
            <button type="button" onClick={closeDialog} disabled={saving} aria-label="Cancel service selection"
              className={`shrink-0 rounded-lg p-1.5 disabled:opacity-50 ${skin.faint} ${skin.iconEdit}`}><X className="h-4 w-4" /></button>
          </div>
          {/* The scroll lives on the wrapper: a fieldset is an unreliable flex/scroll container */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <fieldset disabled={saving} className="min-w-0 px-6 py-5">
              {service.description && <p className={`mb-5 text-xs leading-relaxed ${skin.muted}`}>{service.description}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <ManpowerFields service={service} inputs={inputs} onChange={setInput} theme={theme} />
                {/* The figure the service is priced from, so the dialog opens on it */}
                {/* Capacity Slab prices from a table, so the bands are the choices: picking one
                    sets the capacity to its lower bound and the quote follows. Every other method
                    measures something at the property, which is typed. */}
                {input && service.pricing_method === 'capacity_slab'
                  ? <label className={fieldLabel}>Slab *
                    <CapacitySlabSelect slabs={service.capacity_slabs} unit={service.unit} capacity={inputs.capacity}
                      onChange={(value, slab) => {
                        setInput('capacity', value);
                        // A band priced case by case asks for the vendor quote the moment it is
                        // picked: waiting for a failed OK hid the field it was asking about.
                        const needsQuote = Boolean(slab?.isCustomQuote);
                        setRequiresQuote(needsQuote);
                        setError(needsQuote ? 'This capacity requires a custom quote. Enter the total vendor cost for the selected service period.' : '');
                      }} ariaLabel={`${service.service_name} slab`}
                      className={`${inputClass} mt-2`} />
                  </label>
                  : input && <label className={fieldLabel}>{input[1]} ({service.unit}) *<input autoFocus aria-label={`${input[1]} (${service.unit})`} type="number" min={isVisitManpower(service) ? service.minimum_manpower : input[2]} step={input[2]} value={inputs[input[0]] ?? ''} onChange={event => setInput(input[0], event.target.value)} className={`${inputClass} mt-2`} /></label>}
                {/* The checkbox has its own label beside the select's. Nested inside the select's
                    label, a click on "Override frequency" went to the (disabled) select instead,
                    so the box would not tick and the frequency stayed locked. */}
                <div>
                  <label className={fieldLabel}>Frequency<select disabled={!service.allow_frequency_override || !overrideFrequency || saving} value={inputs.frequency} onChange={event => {
                    const frequency = event.target.value;
                    setInputs(prev => ({ ...prev, ...getServiceSchedule(service, prev.capacity, frequency) }));
                  }} className={`${inputClass} mt-2`}>{FREQUENCY_OPTIONS.map(item => <option key={item.value}>{item.value}</option>)}</select></label>
                  {service.allow_frequency_override
                    ? <label className={`mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-normal ${skin.muted}`}>
                      <input type="checkbox" checked={overrideFrequency} onChange={event => {
                        setOverrideFrequency(event.target.checked);
                        if (!event.target.checked) setInputs(prev => ({ ...prev, ...getServiceSchedule(service, prev.capacity) }));
                      }} className={skin.control} />Override frequency
                    </label>
                    : <p className={`mt-2 text-xs ${skin.faint}`}>This service has a fixed frequency. Turn on Allow Frequency Override on the service to change it here.</p>}
                </div>
                {/* Locked with the frequency: it follows the frequency (Half Yearly -> 2) until Override
                    frequency is ticked, and is then editable -- changing the frequency still refills it */}
                {(() => {
                  const visitsLocked = !service.allow_frequency_override || !overrideFrequency || saving;
                  // A whole count of visits, nothing else: a number box accepts "n", "e" and "-"
                  // and then reports no value at all, so it displayed text this never saw and the
                  // service was priced on no visits. Blurring it empty puts the frequency's own
                  // count back rather than asking the server to price a blank.
                  return <label className={fieldLabel}>Visits Per Year<input type="text" inputMode="numeric" readOnly={visitsLocked} value={inputs.visits ?? ''}
                    onChange={event => setInput('visits', sanitizeVisits(event.target.value))}
                    onBlur={event => setInput('visits', resolveVisits(event.target.value, getServiceSchedule(service, inputs.capacity, inputs.frequency).visits))}
                    title={visitsLocked ? 'Set by the frequency. Tick Override frequency to change it.' : undefined}
                    className={`${inputClass} mt-2 ${visitsLocked ? `cursor-not-allowed ${skin.readOnlyBg}` : ''}`} /></label>;
                })()}
                {service.pricing_method === 'fixed_visit_custom' && <label className={fieldLabel}>One-off Custom Work Cost (₹)<input type="number" min="0" step="0.01" value={inputs.custom_work_cost} onChange={event => setInput('custom_work_cost', event.target.value)} className={`${inputClass} mt-2`} /></label>}
                {requiresQuote && <label className={fieldLabel}>Total Vendor Quote for Service Period (₹) *<input type="number" min="0.01" step="0.01" value={inputs.custom_quote ?? ''} onChange={event => setInput('custom_quote', event.target.value)} className={`${inputClass} mt-2`} /></label>}
              </div>
              {/* Capacity Slab prices from a table rather than a rate, so the whole table is shown
                  with the band the typed capacity lands in marked. Customer prices only, like the
                  rest of this dialog. */}
              <CapacitySlabList service={service} capacity={inputs.capacity} className="mt-5" />
              {/* The customer price is the only figure this dialog states: vendor cost, operating
                  cost, markup and margin are internal and belong to the service configuration. */}
              {preview && !preview.requiresCustomQuote && (
                <dl className={`mt-5 flex items-center justify-between gap-3 rounded-xl border p-4 text-xs ${skin.previewBox}`}>
                  <dt className={`font-semibold ${skin.text}`}>Customer Price</dt>
                  <dd className="text-sm font-semibold text-emerald-600">{currency(preview.totalPrice)}</dd>
                </dl>
              )}
              {error && <p role="alert" className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            </fieldset>
          </div>
          <div className={`flex items-center justify-end gap-3 border-t px-6 py-4 ${skin.panelFoot}`}>
            <button type="button" onClick={closeDialog} disabled={saving}
              className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${skin.secondary}`}>Cancel</button>
            <button type="button" onClick={addService} disabled={saving || incomplete}
              className={`inline-flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold text-white disabled:opacity-50 ${skin.primary}`}>
              {/* Re-pricing a service the estimate already carries is a change, not an addition */}
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editing || rowFor(service) ? 'Save Changes' : 'OK'}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
};

export default ServiceCatalogPicker;
