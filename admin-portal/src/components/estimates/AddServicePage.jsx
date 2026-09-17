import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/safeStorage';
import { ChevronLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useFP } from '../../contexts/FPContext';
import { manpowerRangeLabel, previewManpower, suggestedManpower } from '../../utils/manpowerPricing';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Pricing Method Options
export const PRICING_METHODS = [
  { value: 'fixed_price', label: 'Fixed Price' },
  { value: 'quantity_based', label: 'Quantity Based' },
  { value: 'area_based', label: 'Area Based' },
  { value: 'capacity_based', label: 'Capacity Based' },
  { value: 'capacity_slab', label: 'Capacity Slab' },
  { value: 'manpower', label: 'Manpower' }
];

// Methods no longer offered; kept only so services saved earlier still read correctly
const RETIRED_METHODS = [
  { value: 'fixed_visit_custom', label: 'Fixed Visit + Custom Work' },
  { value: 'custom_quote', label: 'Custom Quote' }
];
export const methodLabel = value => [...PRICING_METHODS, ...RETIRED_METHODS].find(method => method.value === value)?.label || value || '—';

// Unit Options based on pricing method
const UNIT_OPTIONS = {
  fixed_price: ['Visit', 'Service', 'Job'],
  quantity_based: ['Nos', 'Units', 'Lifts', 'Pumps', 'Tanks', 'Camera'],
  area_based: ['Sq Ft', 'Sq M', 'Acres'],
  capacity_based: ['KL', 'Liters', 'KVA', 'KW'],
  capacity_slab: ['Persons', 'KVA', 'KW', 'HP', 'KL', 'Liters'],
  manpower: ['Persons', 'Guards', 'Staff', 'Personnel']
};

// Frequency Options
export const FREQUENCY_OPTIONS = [
  { value: 'Monthly', label: 'Monthly', defaultVisits: 12 },
  { value: 'Every 2 Months', label: 'Every 2 Months', defaultVisits: 6 },
  { value: 'Quarterly', label: 'Quarterly', defaultVisits: 4 },
  { value: 'Half-Yearly', label: 'Half-Yearly', defaultVisits: 2 },
  { value: 'Yearly', label: 'Yearly', defaultVisits: 1 },
  { value: 'One-time', label: 'One-time', defaultVisits: 1 }
];

// Property Type Options
export const PROPERTY_TYPES = [
  { id: 'APT', label: 'Apartment' },
  { id: 'GC', label: 'Gated Community' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'IH', label: 'Independent House' },
  { id: 'PLOT', label: 'Plot' }
];

// Billing Period Options (for Manpower)
const BILLING_PERIODS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';
const sections = [
  ['basic-information', 'Basic Information'],
  ['pricing-configuration', 'Pricing Configuration'],
  ['additional-information', 'Additional Information']
];

const Field = ({ label, hint, children }) => (
  <label className="block min-w-0">
    <span className="mb-2 block text-xs font-semibold text-slate-700">{label}</span>
    {children}
    {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
  </label>
);

const Toggle = ({ label, hint, checked, onChange }) => (
  <div>
    <span className="mb-3 block text-xs font-semibold text-slate-700">{label}</span>
    <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
    <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
  </div>
);

export const findCapacitySlab = (slabs, capacity) => {
  if (capacity == null || String(capacity).trim() === '' || !Number.isInteger(Number(capacity))) return undefined;
  return slabs?.find(slab => slab.capacityFrom !== '' && Number(capacity) >= Number(slab.capacityFrom) &&
    (slab.capacityTo === null || (slab.capacityTo !== '' && Number(capacity) <= Number(slab.capacityTo))));
};

export const getServiceSchedule = (service, capacity, frequency) => {
  const slab = service.pricing_method === 'capacity_slab' ? findCapacitySlab(service.capacity_slabs, capacity) : null;
  const defaultFrequency = slab?.defaultFrequency ?? service.default_frequency;
  const defaultVisits = slab?.defaultVisitsPerYear ?? (defaultFrequency === service.default_frequency
    ? service.default_visits_per_year : FREQUENCY_OPTIONS.find(item => item.value === defaultFrequency)?.defaultVisits);
  const selectedFrequency = frequency ?? defaultFrequency;
  return { frequency: selectedFrequency, visits: selectedFrequency === defaultFrequency
    ? defaultVisits : FREQUENCY_OPTIONS.find(item => item.value === selectedFrequency)?.defaultVisits };
};

const AddServicePage = ({ admin, showToast, onBack, onSave, service }) => {
  const { selectedFp } = useFP();
  const token = getAuthToken();

  // Form State
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [formError, setFormError] = useState('');
  const [activeSection, setActiveSection] = useState('basic-information');
  const [formData, setFormData] = useState({
    serviceName: '',
    category: '',
    pricingMethod: 'capacity_slab',
    unit: 'Persons',
    applicablePropertyTypes: [],
    // Area Based specific
    ratePerUnit: '',
    defaultFrequency: 'Monthly',
    defaultVisitsPerYear: 12,
    allowFrequencyOverride: true,
    allowManualVisits: false,
    // Markup & Margin
    defaultMarkupPercentage: 35,
    // Description
    description: '',
    // For Manpower
    manpowerBasis: 'per_visit',
    ratePerPerson: '',
    roleDesignation: '',
    workingHoursPerVisit: 2,
    overtimeRatePerHour: '',
    minimumManpower: 1,
    monthlyRate: '',
    billingPeriod: 'Monthly',
    periodMonths: 12,
    // For Fixed Price
    fixedPrice: '',
    // For Quantity Based
    ratePerQuantity: '',
    // For Capacity Based
    ratePerCapacity: ''
  });

  // Capacity Slab Configuration
  const [capacitySlabs, setCapacitySlabs] = useState([
    { id: 1, capacityFrom: 1, capacityTo: 6, vendorRate: 500, isCustomQuote: false },
    { id: 2, capacityFrom: 7, capacityTo: 10, vendorRate: 750, isCustomQuote: false },
    { id: 3, capacityFrom: 11, capacityTo: 15, vendorRate: 1000, isCustomQuote: false },
    { id: 4, capacityFrom: 16, capacityTo: 20, vendorRate: 1250, isCustomQuote: false },
    { id: 5, capacityFrom: 21, capacityTo: null, vendorRate: null, isCustomQuote: true }
  ].map(slab => ({ ...slab, defaultFrequency: 'Monthly', defaultVisitsPerYear: 12 })));
  const [manpowerRanges, setManpowerRanges] = useState([]);
  const [exampleManpowerArea, setExampleManpowerArea] = useState('1500');
  const [examplePersonnel, setExamplePersonnel] = useState('2');
  const [exampleOvertime, setExampleOvertime] = useState('0');
  const [exampleCapacity, setExampleCapacity] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'overtimeRatePerHour' && value === '') setExampleOvertime('0');
  };

  useEffect(() => {
    if (!service) return;
    const fields = { manpowerBasis: 'manpower_basis', ratePerPerson: 'rate_per_person', roleDesignation: 'role_designation', workingHoursPerVisit: 'working_hours_per_visit', overtimeRatePerHour: 'overtime_rate_per_hour', minimumManpower: 'minimum_manpower', serviceName: 'service_name', category: 'category', pricingMethod: 'pricing_method', unit: 'unit', applicablePropertyTypes: 'applicable_property_types', ratePerUnit: 'rate_per_unit', defaultFrequency: 'default_frequency', defaultVisitsPerYear: 'default_visits_per_year', allowFrequencyOverride: 'allow_frequency_override', allowManualVisits: 'allow_manual_visits', defaultMarkupPercentage: 'default_markup_percentage', description: 'description', monthlyRate: 'monthly_rate', billingPeriod: 'billing_period', periodMonths: 'period_months', fixedPrice: 'fixed_price', ratePerQuantity: 'rate_per_quantity', ratePerCapacity: 'rate_per_capacity' };
    setFormData(prev => ({ ...Object.fromEntries(Object.entries(prev).map(([field, value]) => [field, service[fields[field]] ?? value])),
      manpowerBasis: service.pricing_method === 'manpower' ? service.manpower_basis ?? 'monthly' : 'per_visit',
      overtimeRatePerHour: service.overtime_rate_per_hour ?? '' }));
    setManpowerRanges((service.manpower_ranges || []).map((range, index) => ({ ...range, id: index + 1 })));
    if (service.capacity_slabs) setCapacitySlabs(service.capacity_slabs.map((slab, index) => {
      const schedule = getServiceSchedule({ ...service, capacity_slabs: [slab] }, slab.capacityFrom);
      return { ...slab, id: index + 1, defaultFrequency: schedule.frequency, defaultVisitsPerYear: schedule.visits };
    }));
  }, [service]);

  useEffect(() => {
    const controller = new AbortController();
    setCategoryError('');
    fetch(`${API_BASE}/api/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error('Unable to load categories.');
      setCategories(result.data || []);
    }).catch(error => {
      if (error.name !== 'AbortError') setCategoryError('Unable to load categories. Please retry.');
    });
    return () => controller.abort();
  }, [token, categoryAttempt]);

  // Update unit options when pricing method changes
  const changePricingMethod = (pricingMethod) => {
    setFormData(prev => ({ ...prev, pricingMethod, unit: UNIT_OPTIONS[pricingMethod]?.[0] ?? prev.unit }));
    setActiveSection('basic-information');
  };

  // Update visits when frequency changes
  const changeFrequency = (defaultFrequency) => {
    const frequency = FREQUENCY_OPTIONS.find(item => item.value === defaultFrequency);
    setFormData(prev => ({ ...prev, defaultFrequency, defaultVisitsPerYear: frequency.defaultVisits }));
  };

  // Handle property type toggle
  const togglePropertyType = (typeId) => {
    setFormData(prev => ({
      ...prev,
      applicablePropertyTypes: prev.applicablePropertyTypes.includes(typeId)
        ? prev.applicablePropertyTypes.filter(type => type !== typeId)
        : [...prev.applicablePropertyTypes, typeId]
    }));
  };

  // Add new capacity slab
  const addCapacitySlab = () => {
    setCapacitySlabs(prev => {
      const last = prev[prev.length - 1];
      const openEnded = last?.capacityTo === null;
      const start = openEnded ? Number(last.capacityFrom) : Number(last?.capacityTo ?? -1) + 1;
      const slab = { id: Math.max(0, ...prev.map(item => item.id)) + 1, capacityFrom: start, capacityTo: start + 49, vendorRate: '', isCustomQuote: false,
        defaultFrequency: last?.defaultFrequency ?? formData.defaultFrequency, defaultVisitsPerYear: last?.defaultVisitsPerYear ?? formData.defaultVisitsPerYear };
      return openEnded
        ? [...prev.slice(0, -1), slab, { ...last, capacityFrom: start + 50 }]
        : [...prev, slab];
    });
  };

  // Update capacity slab
  const updateCapacitySlab = (id, field, value) => {
    setCapacitySlabs(prev => prev.map(slab => slab.id === id ? { ...slab, [field]: value,
      ...(field === 'defaultFrequency' ? { defaultVisitsPerYear: FREQUENCY_OPTIONS.find(item => item.value === value).defaultVisits } : {}) } : slab));
  };

  // Delete capacity slab
  const deleteCapacitySlab = (id) => {
    if (capacitySlabs.length <= 1) return;
    setCapacitySlabs(prev => prev.filter(slab => slab.id !== id));
  };

  const updateManpowerRange = (id, field, value) => setManpowerRanges(prev => prev.map(range => range.id === id ? { ...range, [field]: value } : range));
  const addManpowerRange = () => setManpowerRanges(prev => {
    const last = prev[prev.length - 1];
    const openEnded = last?.areaTo === null;
    const start = openEnded ? Number(last.areaFrom) : last ? Number(last.areaTo) + 1 : 0;
    const end = start === 0 ? 1000 : start + 999;
    const people = Math.max(Number(formData.minimumManpower) || 1, last ? Number(last.recommendedMin) + 1 : 1);
    const range = { id: Math.max(0, ...prev.map(item => item.id)) + 1, areaFrom: start, areaTo: end,
      recommendedMin: people, recommendedMax: people, ratePerPerson: formData.ratePerPerson };
    return openEnded ? [...prev.slice(0, -1), range, { ...last, areaFrom: end + 1 }] : [...prev, range];
  });

  // Calculate example pricing
  const calculateExamplePricing = () => {
    const exampleArea = 10000; // Example: 10,000 Sq Ft
    const quantity = isFixedPrice ? 1 : isQuantityBased || isCapacityBased ? 10 : exampleArea;
    const vendorCost = Number(formData[rateField]) * quantity * Number(formData.defaultVisitsPerYear);
    return { vendorCost, customerPrice: vendorCost * (1 + Number(formData.defaultMarkupPercentage) / 100) };
  };

  // Get formula text based on pricing method
  const getFormulaText = () => methodLabel(formData.pricingMethod);

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');
    if (!formData.applicablePropertyTypes.length) {
      setFormError('Select at least one applicable property type.');
      return;
    }
    setIsSubmitting(true);
    try {
      const serviceData = {
        service_name: formData.serviceName.trim(),
        category: formData.category,
        franchise_partner_id: service ? service.franchise_partner_id : selectedFp?.id && selectedFp.id !== 'all' ? Number(selectedFp.id) : null,
        pricing_method: formData.pricingMethod,
        unit: formData.unit,
        applicable_property_types: formData.applicablePropertyTypes,
        default_frequency: formData.defaultFrequency,
        default_visits_per_year: Number(formData.defaultVisitsPerYear),
        allow_frequency_override: formData.allowFrequencyOverride,
        allow_manual_visits: formData.allowManualVisits,
        default_markup_percentage: Number(formData.defaultMarkupPercentage),
        description: formData.description.trim(),
        // Method-specific fields
        rate_per_unit: Number(formData.ratePerUnit),
        fixed_price: Number(formData.fixedPrice),
        rate_per_quantity: Number(formData.ratePerQuantity),
        rate_per_capacity: Number(formData.ratePerCapacity),
        // Capacity slabs
        capacity_slabs: formData.pricingMethod === 'capacity_slab' ? capacitySlabs.map(slab => ({
          capacityFrom: Number(slab.capacityFrom),
          capacityTo: slab.capacityTo === null ? null : Number(slab.capacityTo),
          vendorRate: slab.isCustomQuote ? null : Number(slab.vendorRate),
          isCustomQuote: slab.isCustomQuote,
          defaultFrequency: slab.defaultFrequency,
          defaultVisitsPerYear: Number(slab.defaultVisitsPerYear)
        })) : null,
        // Manpower fields
        manpower_basis: formData.manpowerBasis,
        rate_per_person: Number(formData.ratePerPerson),
        role_designation: formData.roleDesignation.trim(),
        working_hours_per_visit: Number(formData.workingHoursPerVisit),
        overtime_rate_per_hour: formData.overtimeRatePerHour === '' ? null : Number(formData.overtimeRatePerHour),
        minimum_manpower: Number(formData.minimumManpower),
        manpower_ranges: manpowerRanges.map(range => ({ areaFrom: Number(range.areaFrom), areaTo: range.areaTo === null ? null : Number(range.areaTo),
          recommendedMin: Number(range.recommendedMin), recommendedMax: Number(range.recommendedMax), ratePerPerson: Number(range.ratePerPerson) })),
        monthly_rate: Number(formData.monthlyRate),
        billing_period: formData.pricingMethod === 'manpower' ? formData.billingPeriod : null,
        period_months: formData.pricingMethod === 'manpower' ? Number(formData.periodMonths) : null
      };
      // API call to save service
      const response = await fetch(`${API_BASE}/api/admin/service-catalog${service ? `/${service.id}` : ''}`, {
        method: service ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Failed to create service');
      showToast?.(service ? 'Service updated successfully!' : 'Service created successfully!', 'success');
      onSave?.(result.data);
      onBack?.();
    } catch (error) {
      setFormError(error.message || 'Failed to create service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFixedPrice = formData.pricingMethod === 'fixed_price';
  const isQuantityBased = formData.pricingMethod === 'quantity_based';
  const isCapacityBased = formData.pricingMethod === 'capacity_based';
  const isCapacitySlab = formData.pricingMethod === 'capacity_slab';
  const isVisitManpower = formData.pricingMethod === 'manpower' && formData.manpowerBasis === 'per_visit';
  const isRatePricing = formData.pricingMethod === 'area_based' || isQuantityBased || isCapacityBased || isFixedPrice || isVisitManpower;
  const rateField = { fixed_price: 'fixedPrice', area_based: 'ratePerUnit', quantity_based: 'ratePerQuantity', capacity_based: 'ratePerCapacity', manpower: isVisitManpower ? 'ratePerPerson' : undefined }[formData.pricingMethod];
  const manpowerConfig = { manpower_ranges: manpowerRanges, rate_per_person: formData.ratePerPerson, minimum_manpower: formData.minimumManpower,
    working_hours_per_visit: formData.workingHoursPerVisit, overtime_rate_per_hour: formData.overtimeRatePerHour === '' ? null : formData.overtimeRatePerHour,
    default_visits_per_year: formData.defaultVisitsPerYear, default_markup_percentage: formData.defaultMarkupPercentage };
  const manpowerExample = isVisitManpower ? previewManpower(manpowerConfig, { area: exampleManpowerArea, personnel: examplePersonnel, overtime_hours_per_visit: exampleOvertime }) : null;
  const formSections = isRatePricing || isCapacitySlab
    ? [sections[0], ['pricing-configuration', `${getFormulaText()} Configuration`], ['markup', 'Markup']]
    : sections;
  const examplePricing = isRatePricing && !isVisitManpower && formData[rateField] !== '' ? calculateExamplePricing() : null;
  const currency = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
  const numberInput = (field, props = {}) => (
    <input type="number" min="0" step="0.01" required value={formData[field]}
      onChange={event => setField(field, event.target.value)} className={inputClass} {...props} />
  );
  const slabLabel = slab => `${slab.capacityFrom}${slab.capacityTo === null ? '+' : `–${slab.capacityTo}`} ${formData.unit}`;
  const previewSlab = findCapacitySlab(capacitySlabs, exampleCapacity);
  const validCapacity = exampleCapacity.trim() !== '' && Number.isInteger(Number(exampleCapacity)) && Number(exampleCapacity) >= 0 && Number(exampleCapacity) <= 1e9;
  const slabPreviewMessage = !validCapacity ? 'Enter a whole-number capacity between 0 and 1,000,000,000.'
    : Number(exampleCapacity) < Number(capacitySlabs[0]?.capacityFrom) ? 'Capacity is below the first configured slab.'
    : !previewSlab || previewSlab.isCustomQuote ? 'Custom quote required for this capacity.'
    : previewSlab.vendorRate === '' || previewSlab.vendorRate == null || Number(previewSlab.vendorRate) < 0 || Number(previewSlab.defaultVisitsPerYear) < 1 ? 'Enter a valid slab rate and visit count to see example pricing.' : '';
  const slabVendorCost = slabPreviewMessage ? null : Number(previewSlab.vendorRate) * Number(previewSlab.defaultVisitsPerYear);
  const toggleManualVisits = () => {
    if (formData.allowManualVisits) setCapacitySlabs(prev => prev.map(slab => ({ ...slab, defaultVisitsPerYear: FREQUENCY_OPTIONS.find(item => item.value === slab.defaultFrequency).defaultVisits })));
    setFormData(prev => ({ ...prev, allowManualVisits: !prev.allowManualVisits, defaultVisitsPerYear: prev.allowManualVisits ? FREQUENCY_OPTIONS.find(item => item.value === prev.defaultFrequency).defaultVisits : prev.defaultVisitsPerYear }));
  };

  if (admin?.role === 'operations_manager') {
    return <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">Service configuration is read-only for your role.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-900">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} disabled={isSubmitting} aria-label="Back to services" className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50">
            <ChevronLeft className="h-5 w-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{service ? 'Edit Service' : 'Add Service'} — {getFormulaText()}</h1>
            <p className="mt-1 text-xs text-slate-500">Master Data <span className="mx-2">›</span> Service Master <span className="mx-2">›</span> {service ? 'Edit Service' : 'Add Service'}</p>
            <p className="mt-1 text-xs text-slate-500">{service ? (service.franchise_partner_id ? `For FP ${service.franchise_partner_id}` : 'Available to all FPs') : selectedFp?.id && selectedFp.id !== 'all' ? `For ${selectedFp.companyName || selectedFp.fpId || `FP ${selectedFp.id}`}` : 'Available to all FPs'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} disabled={isSubmitting} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50">Cancel</button>
          <button type="submit" disabled={isSubmitting || !categories.length} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSubmitting ? 'Saving...' : 'Save Service'}
          </button>
        </div>
      </header>
      <nav aria-label="Service form sections" className="flex gap-4 overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 sm:gap-8">
        {formSections.map(([id, label], index) => (
          <a key={id} href={`#${id}`} onClick={() => setActiveSection(id)} aria-current={activeSection === id ? 'location' : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 py-4 text-xs font-semibold ${activeSection === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${activeSection === id ? 'bg-blue-600' : 'bg-slate-300'}`}>{index + 1}</span>{label}
          </a>
        ))}
      </nav>
      {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
        {/* Main Content */}
        <div className="grid gap-5 xl:grid-cols-3">
          {/* Left Column - Main Form */}
          <section id="basic-information" className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-2">
            {/* 1. Basic Information */}
            <div className="p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold">Basic Information</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Service Name *"><input required maxLength={150} value={formData.serviceName} onChange={event => setField('serviceName', event.target.value)} placeholder="e.g. Generator Maintenance" className={inputClass} /></Field>
                <Field label="Category *">
                  <select required value={formData.category} onChange={event => setField('category', event.target.value)} className={inputClass}>
                    <option value="">{categories.length ? 'Select category' : 'Loading categories...'}</option>
                    {[...new Set(categories.map(category => category.name))].map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </Field>
                {/* Pricing Method */}
                <Field label="Pricing Method *"><select value={formData.pricingMethod} onChange={event => changePricingMethod(event.target.value)} className={inputClass}>{PRICING_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}</select></Field>
                {/* Primary Input */}
                {/* Unit */}
                <Field label={isCapacityBased || isCapacitySlab ? 'Capacity Unit *' : 'Unit *'}><select value={formData.unit} onChange={event => setField('unit', event.target.value)} className={inputClass}>{(UNIT_OPTIONS[formData.pricingMethod] ?? [formData.unit]).map(unit => <option key={unit}>{unit}</option>)}</select></Field>
              </div>
              {categoryError && <div role="alert" className="mt-3 text-sm text-red-600">{categoryError} <button type="button" onClick={() => setCategoryAttempt(value => value + 1)} className="font-semibold underline">Retry</button></div>}
            </div>
            {/* Capacity Slab Configuration */}
            {isCapacitySlab && <div id="pricing-configuration" className="scroll-mt-6 border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">Capacity Slab Configuration</h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[1000px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500"><tr>
                    <th className="px-3 py-3">Slab Name</th><th className="px-3 py-3">Capacity From</th><th className="px-3 py-3">Capacity To</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Rate Per Visit (₹)</th><th className="px-3 py-3">Default Frequency</th><th className="px-3 py-3">Default Visits Per Year</th><th className="px-3 py-3 text-center">Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">{capacitySlabs.map((slab, index) => <tr key={slab.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-700">{slabLabel(slab)}</td>
                    <td className="px-3 py-3"><input aria-label={`Slab ${index + 1} capacity from`} type="number" min="0" max={1e9} step="1" required value={slab.capacityFrom} onChange={event => updateCapacitySlab(slab.id, 'capacityFrom', event.target.value)} className={`${inputClass} min-w-[100px]`} /></td>
                    <td className="px-3 py-3"><div className="space-y-2">
                      {slab.capacityTo !== null && <input aria-label={`Slab ${index + 1} capacity to`} type="number" min={slab.capacityFrom} max={1e9} step="1" required value={slab.capacityTo} onChange={event => updateCapacitySlab(slab.id, 'capacityTo', event.target.value)} className={`${inputClass} min-w-[100px]`} />}
                      {index === capacitySlabs.length - 1 && <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={slab.capacityTo === null} onChange={event => updateCapacitySlab(slab.id, 'capacityTo', event.target.checked ? null : Number(slab.capacityFrom) + 49)} className="accent-blue-600" />Above (no limit)</label>}
                    </div></td>
                    <td className="px-3 py-3 text-slate-500">{formData.unit}</td>
                    <td className="px-3 py-3"><div className="space-y-2">
                      {!slab.isCustomQuote && <input aria-label={`Slab ${index + 1} vendor rate`} type="number" min="0" max={1e9} step="0.01" required value={slab.vendorRate ?? ''} onChange={event => updateCapacitySlab(slab.id, 'vendorRate', event.target.value)} className={`${inputClass} min-w-[130px]`} />}
                      <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={slab.isCustomQuote} onChange={event => updateCapacitySlab(slab.id, 'isCustomQuote', event.target.checked)} className="accent-blue-600" />Custom Quote</label>
                    </div></td>
                    <td className="px-3 py-3"><select aria-label={`Slab ${index + 1} default frequency`} value={slab.defaultFrequency} onChange={event => updateCapacitySlab(slab.id, 'defaultFrequency', event.target.value)} className={`${inputClass} min-w-[145px]`}>{FREQUENCY_OPTIONS.map(item => <option key={item.value}>{item.value}</option>)}</select></td>
                    <td className="px-3 py-3"><input aria-label={`Slab ${index + 1} default visits per year`} type="number" min="1" max="366" step="1" required readOnly={!formData.allowManualVisits} value={slab.defaultVisitsPerYear} onChange={event => updateCapacitySlab(slab.id, 'defaultVisitsPerYear', event.target.value)} className={`${inputClass} min-w-[90px] ${!formData.allowManualVisits ? 'bg-slate-50' : ''}`} /></td>
                    <td className="px-3 py-3 text-center"><button type="button" aria-label={`Delete slab ${index + 1}`} disabled={capacitySlabs.length === 1} onClick={() => deleteCapacitySlab(slab.id)} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <button type="button" onClick={addCapacitySlab} disabled={capacitySlabs.length >= 100} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"><Plus className="h-4 w-4" />Add Slab</button>
            </div>}
            <div id={isRatePricing ? 'pricing-configuration' : undefined} className="scroll-mt-6 border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">{isRatePricing ? `${getFormulaText()} Configuration` : isCapacitySlab ? 'Fallback Frequency & Estimate Overrides' : 'Default Frequency'}</h2>
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
                {/* Fixed Price Fields */}
                {isRatePricing && <Field label={isVisitManpower ? 'Rate per Person per Visit (₹) *' : isFixedPrice ? 'Fixed Rate per Visit (₹) *' : `Rate per ${formData.unit} (₹) *`} hint={isVisitManpower ? 'Rate includes the configured regular working hours' : isFixedPrice ? 'Vendor charge for one visit' : `Vendor charge per ${formData.unit} per visit`}>{numberInput(rateField, { max: 1e9 })}</Field>}
                {/* Default Frequency */}
                <Field label="Default Frequency *" hint={isCapacitySlab ? 'Used when capacity is above the configured slabs' : 'Default visit frequency for this service'}><select value={formData.defaultFrequency} onChange={event => changeFrequency(event.target.value)} className={inputClass}>{FREQUENCY_OPTIONS.map(frequency => <option key={frequency.value}>{frequency.value}</option>)}</select></Field>
                {/* Default Visits Per Year */}
                <Field label="Default Visits Per Year *" hint={formData.allowManualVisits ? 'Manual visit count enabled' : 'Based on selected frequency'}>{numberInput('defaultVisitsPerYear', { min: 1, max: 366, step: 1, readOnly: !formData.allowManualVisits, className: `${inputClass} ${!formData.allowManualVisits ? 'bg-slate-50' : ''}` })}</Field>
                {/* Allow Frequency Override */}
                <Toggle label="Allow Frequency Override" hint="Allow override while creating estimate" checked={formData.allowFrequencyOverride} onChange={() => setField('allowFrequencyOverride', !formData.allowFrequencyOverride)} />
                <Toggle label="Allow Manual Visits" hint="Allow manual number of visits" checked={formData.allowManualVisits} onChange={toggleManualVisits} />
              </div>
              {isVisitManpower && <div className="mt-6 grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
                <Field label="Role / Designation (Optional)"><input maxLength={150} value={formData.roleDesignation} onChange={event => setField('roleDesignation', event.target.value)} placeholder="e.g. Housekeeping Staff" className={inputClass} /></Field>
                <Field label="Working Hours per Visit *" hint="Included regular hours per person">{numberInput('workingHoursPerVisit', { min: 0.01, max: 24 })}</Field>
                <Field label="Overtime Rate per Person / Hour (₹)" hint="Optional; extra hours are entered in the estimate">{numberInput('overtimeRatePerHour', { required: false, max: 1e9 })}</Field>
                <Field label="Minimum Manpower Required *" hint="Minimum persons per visit">{numberInput('minimumManpower', { min: 1, max: 1e6, step: 1 })}</Field>
              </div>}
            </div>
            {isVisitManpower && <section className="border-t border-slate-100 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-blue-600">Manpower Requirement Template (Optional)</h2>
              <p className="mb-4 mt-1 text-xs text-slate-500">Area ranges apply their rate automatically and suggest a headcount. Leave empty to use the default rate.</p>
              {manpowerRanges.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500"><tr>{['#', 'Area From (Sq Ft)', 'Area To (Sq Ft)', 'Recommended Min', 'Recommended Max', 'Rate per Person / Visit (₹)', 'Action'].map(label => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">{manpowerRanges.map((range, index) => <tr key={range.id}>
                    <td className="px-3 py-3">{index + 1}</td>
                    <td className="px-3 py-3"><input aria-label={`Manpower range ${index + 1} area from`} type="number" min="0" max={1e9} step="1" required value={range.areaFrom} onChange={event => updateManpowerRange(range.id, 'areaFrom', event.target.value)} className={`${inputClass} min-w-[100px]`} /></td>
                    <td className="px-3 py-3"><div className="space-y-2">
                      {range.areaTo !== null && <input aria-label={`Manpower range ${index + 1} area to`} type="number" min={Math.max(1, Number(range.areaFrom))} max={1e9} step="1" required value={range.areaTo} onChange={event => updateManpowerRange(range.id, 'areaTo', event.target.value)} className={`${inputClass} min-w-[100px]`} />}
                      {index === manpowerRanges.length - 1 && <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" checked={range.areaTo === null} onChange={event => updateManpowerRange(range.id, 'areaTo', event.target.checked ? null : Number(range.areaFrom) + 999)} className="accent-blue-600" />No upper limit</label>}
                    </div></td>
                    <td className="px-3 py-3"><input aria-label={`Manpower range ${index + 1} recommended minimum`} type="number" min="1" max={1e6} step="1" required value={range.recommendedMin} onChange={event => updateManpowerRange(range.id, 'recommendedMin', event.target.value)} className={`${inputClass} min-w-[90px]`} /></td>
                    <td className="px-3 py-3"><input aria-label={`Manpower range ${index + 1} recommended maximum`} type="number" min={Math.max(Number(range.recommendedMin), Number(formData.minimumManpower))} max={1e6} step="1" required value={range.recommendedMax} onChange={event => updateManpowerRange(range.id, 'recommendedMax', event.target.value)} className={`${inputClass} min-w-[90px]`} /></td>
                    <td className="px-3 py-3"><input aria-label={`Manpower range ${index + 1} rate per person`} type="number" min="0" max={1e9} step="0.01" required value={range.ratePerPerson} onChange={event => updateManpowerRange(range.id, 'ratePerPerson', event.target.value)} className={`${inputClass} min-w-[120px]`} /></td>
                    <td className="px-3 py-3"><button type="button" aria-label={`Delete manpower range ${index + 1}`} onClick={() => setManpowerRanges(prev => prev.filter(item => item.id !== range.id))} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>)}</tbody>
                </table>
              </div>}
              <button type="button" onClick={addManpowerRange} disabled={manpowerRanges.length >= 100} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"><Plus className="h-4 w-4" />Add Range</button>
            </section>}
            {/* 3. Markup & Margin */}
            <div id="markup" className="scroll-mt-6 border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">Default Markup</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Default Markup Percentage */}
                <Field label="Default Markup Percentage (%) *" hint="Applied on total actual cost">{numberInput('defaultMarkupPercentage', { max: 1000 })}</Field>
              </div>
            </div>
          </section>
          {/* Right Column - Sidebar */}
          <aside id="additional-information" className="scroll-mt-6 space-y-5">
            {/* Applicable Property Types */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold">Applicable Property Types <span className="text-red-500">*</span></h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                {PROPERTY_TYPES.map(type => (
                  <label key={type.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition ${formData.applicablePropertyTypes.includes(type.id) ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={formData.applicablePropertyTypes.includes(type.id)} onChange={() => togglePropertyType(type.id)} className="h-4 w-4 shrink-0 accent-blue-600" />
                    <span className="text-xs text-slate-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </section>
            {/* Description */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <Field label="Description"><textarea value={formData.description} onChange={event => setField('description', event.target.value)} placeholder="Describe the service" rows={6} maxLength={500} className={`${inputClass} resize-y`} /></Field>
              <p className="mt-1 text-right text-xs text-slate-400">{formData.description.length}/500</p>
            </section>
            {/* Pricing Preview (Example) */}
            {isRatePricing && !isVisitManpower && <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold">Pricing Preview (Example)</h2>
              <dl className="space-y-3 text-xs text-slate-600">
                <div className="flex justify-between gap-3"><dt>{isFixedPrice ? 'Fixed Rate per Visit' : `Rate per ${formData.unit} per Visit`}</dt><dd className="font-medium text-slate-800">{currency(formData[rateField] === '' ? null : Number(formData[rateField]))}</dd></div>
                {!isFixedPrice && <div className="flex justify-between gap-3"><dt>Total {isQuantityBased ? 'Quantity' : isCapacityBased ? 'Capacity' : 'Area'} ({formData.unit})</dt><dd className="font-medium text-slate-800">{isQuantityBased || isCapacityBased ? '10' : '10,000'}</dd></div>}
                <div className="flex justify-between gap-3"><dt>Visits Per Year</dt><dd className="font-medium text-slate-800">{formData.defaultVisitsPerYear}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold">Annual Vendor Cost</dt><dd className="font-semibold text-slate-800">{currency(examplePricing?.vendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Default Markup</dt><dd className="font-medium text-slate-800">{formData.defaultMarkupPercentage}%</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">Example Customer Price</dt><dd className="font-semibold text-blue-600">{currency(examplePricing?.customerPrice)}</dd></div>
              </dl>
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Example only, with no XLAND operating cost or tax. Final customer pricing uses the {isFixedPrice ? 'visits and operating costs' : `actual ${isQuantityBased ? 'quantity' : isCapacityBased ? 'capacity' : 'area'}, visits and operating costs`} entered in the estimate.</p>
            </section>}
            {isVisitManpower && <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold">Pricing Preview (Example)</h2>
              <div className="space-y-3">
                {manpowerRanges.length > 0 && <Field label="Example Property Area (Sq Ft)"><input inputMode="numeric" value={exampleManpowerArea} onChange={event => { setExampleManpowerArea(event.target.value); setExamplePersonnel(String(suggestedManpower(manpowerConfig, event.target.value))); }} className={inputClass} /></Field>}
                <Field label="Manpower (Persons)" hint={`Minimum required: ${formData.minimumManpower}`}><input inputMode="numeric" value={examplePersonnel} onChange={event => setExamplePersonnel(event.target.value)} className={inputClass} /></Field>
                {formData.overtimeRatePerHour !== '' && <Field label="Overtime Hours per Person / Visit"><input inputMode="decimal" value={exampleOvertime} onChange={event => setExampleOvertime(event.target.value)} className={inputClass} /></Field>}
              </div>
              <dl className="mt-4 space-y-3 text-xs text-slate-600">
                {manpowerRanges.length > 0 && <div className="flex justify-between gap-3"><dt>Matching Area Range</dt><dd className="font-medium text-slate-800">{manpowerRangeLabel(manpowerExample?.range)}</dd></div>}
                <div className="flex justify-between gap-3"><dt>Rate per Person per Visit</dt><dd className="font-medium text-slate-800">{currency(manpowerExample?.ratePerPerson)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Visits Per Year</dt><dd className="font-medium text-slate-800">{formData.defaultVisitsPerYear}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold">Annual Vendor Cost</dt><dd className="font-semibold text-slate-800">{currency(manpowerExample?.vendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Default Markup</dt><dd className="font-medium text-slate-800">{formData.defaultMarkupPercentage}%</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">Example Customer Price</dt><dd className="font-semibold text-blue-600">{currency(manpowerExample?.customerPrice)}</dd></div>
              </dl>
              {manpowerExample?.error && <p className="mt-3 text-xs text-amber-700">{manpowerExample.error}</p>}
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Example only, with no XLAND operating cost or tax. Final pricing uses the selected manpower, area range, visits and overtime entered in the estimate.</p>
            </section>}
            {isCapacitySlab && <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold">Pricing Preview (Example)</h2>
              <Field label={`Entered Capacity (${formData.unit})`}><input inputMode="numeric" value={exampleCapacity} onChange={event => setExampleCapacity(event.target.value)} className={inputClass} /></Field>
              <dl className="mt-4 space-y-3 text-xs text-slate-600">
                <div className="flex justify-between gap-3"><dt>Matching Slab</dt><dd className="font-medium text-slate-800">{previewSlab ? slabLabel(previewSlab) : '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt>Rate Per Visit</dt><dd className="font-medium text-slate-800">{currency(slabVendorCost == null ? null : Number(previewSlab.vendorRate))}</dd></div>
                <div className="flex justify-between gap-3"><dt>Frequency</dt><dd className="font-medium text-slate-800">{previewSlab?.defaultFrequency ?? '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt>Visits Per Year</dt><dd className="font-medium text-slate-800">{previewSlab?.defaultVisitsPerYear ?? '—'}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold">Annual Vendor Cost</dt><dd className="font-semibold text-slate-800">{currency(slabVendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Default Markup</dt><dd className="font-medium text-slate-800">{formData.defaultMarkupPercentage}%</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">Example Customer Price</dt><dd className="font-semibold text-blue-600">{currency(slabVendorCost == null ? null : slabVendorCost * (1 + Number(formData.defaultMarkupPercentage) / 100))}</dd></div>
              </dl>
              {slabPreviewMessage && <p className="mt-3 text-xs text-amber-700">{slabPreviewMessage}</p>}
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">Example only, with no XLAND operating cost or tax. Final customer pricing uses the actual capacity, visits and operating costs entered in the estimate.</p>
            </section>}
          </aside>
        </div>
        {/* 2. Monthly Manpower Configuration, kept for services saved before the per-visit basis */}
        {!isRatePricing && !isCapacitySlab && <section id="pricing-configuration" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 text-sm font-semibold">{getFormulaText()} Configuration</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label={`Monthly Vendor Rate (₹) per ${formData.unit} *`}>{numberInput('monthlyRate')}</Field>
            <Field label="Billing Period *"><select value={formData.billingPeriod} onChange={event => setField('billingPeriod', event.target.value)} className={inputClass}>{BILLING_PERIODS.map(period => <option key={period}>{period}</option>)}</select></Field>
            <Field label="Period (Months) *">{numberInput('periodMonths', { min: 1, max: 12, step: 1 })}</Field>
          </div>
        </section>}
      </fieldset>
    </form>
  );
};

export default AddServicePage;
