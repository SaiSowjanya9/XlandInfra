import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/safeStorage';
import { ChevronLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useFP } from '../../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Pricing Method Options
export const PRICING_METHODS = [
  { value: 'fixed_price', label: 'Fixed Price' },
  { value: 'quantity_based', label: 'Quantity Based' },
  { value: 'area_based', label: 'Area Based' },
  { value: 'capacity_based', label: 'Capacity Based' },
  { value: 'capacity_slab', label: 'Capacity Slab' },
  { value: 'manpower', label: 'Manpower' },
  { value: 'fixed_visit_custom', label: 'Fixed Visit + Custom Work' },
  { value: 'custom_quote', label: 'Custom Quote' }
];

// Unit Options based on pricing method
const UNIT_OPTIONS = {
  fixed_price: ['Visit', 'Service', 'Job'],
  quantity_based: ['Nos', 'Units', 'Lifts', 'Pumps', 'Tanks'],
  area_based: ['Sq Ft', 'Sq M', 'Acres'],
  capacity_based: ['KL', 'Liters', 'KVA', 'KW'],
  capacity_slab: ['Persons', 'KVA', 'KW', 'HP', 'KL', 'Liters'],
  manpower: ['Guards', 'Staff', 'Personnel'],
  fixed_visit_custom: ['Visit', 'Job'],
  custom_quote: ['Quote', 'Project']
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
    monthlyRate: '',
    billingPeriod: 'Monthly',
    periodMonths: 12,
    // For Fixed Price
    fixedPrice: '',
    // For Quantity Based
    ratePerQuantity: '',
    // For Capacity Based
    ratePerCapacity: '',
    // For Fixed Visit + Custom Work
    visitCharge: '',
    customWorkRate: 0
  });

  // Capacity Slab Configuration
  const [capacitySlabs, setCapacitySlabs] = useState([
    { id: 1, capacityFrom: 1, capacityTo: 6, vendorRate: 500, isCustomQuote: false },
    { id: 2, capacityFrom: 7, capacityTo: 10, vendorRate: 750, isCustomQuote: false },
    { id: 3, capacityFrom: 11, capacityTo: 15, vendorRate: 1000, isCustomQuote: false },
    { id: 4, capacityFrom: 16, capacityTo: 20, vendorRate: 1250, isCustomQuote: false },
    { id: 5, capacityFrom: 21, capacityTo: null, vendorRate: null, isCustomQuote: true }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!service) return;
    const fields = { serviceName: 'service_name', category: 'category', pricingMethod: 'pricing_method', unit: 'unit', applicablePropertyTypes: 'applicable_property_types', ratePerUnit: 'rate_per_unit', defaultFrequency: 'default_frequency', defaultVisitsPerYear: 'default_visits_per_year', allowFrequencyOverride: 'allow_frequency_override', allowManualVisits: 'allow_manual_visits', defaultMarkupPercentage: 'default_markup_percentage', description: 'description', monthlyRate: 'monthly_rate', billingPeriod: 'billing_period', periodMonths: 'period_months', fixedPrice: 'fixed_price', ratePerQuantity: 'rate_per_quantity', ratePerCapacity: 'rate_per_capacity', visitCharge: 'visit_charge', customWorkRate: 'custom_work_rate' };
    setFormData(prev => Object.fromEntries(Object.entries(prev).map(([field, value]) => [field, service[fields[field]] ?? value])));
    if (service.capacity_slabs) setCapacitySlabs(service.capacity_slabs.map((slab, index) => ({ ...slab, id: index + 1 })));
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
    setFormData(prev => ({ ...prev, pricingMethod, unit: UNIT_OPTIONS[pricingMethod][0] }));
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
      const slab = { id: Math.max(0, ...prev.map(item => item.id)) + 1, capacityFrom: start, capacityTo: start + 49, vendorRate: '', isCustomQuote: false };
      return openEnded
        ? [...prev.slice(0, -1), slab, { ...last, capacityFrom: start + 50 }]
        : [...prev, slab];
    });
  };

  // Update capacity slab
  const updateCapacitySlab = (id, field, value) => {
    setCapacitySlabs(prev => prev.map(slab => slab.id === id ? { ...slab, [field]: value } : slab));
  };

  // Delete capacity slab
  const deleteCapacitySlab = (id) => {
    if (capacitySlabs.length <= 1) return;
    setCapacitySlabs(prev => prev.filter(slab => slab.id !== id));
  };

  // Calculate example pricing
  const calculateExamplePricing = () => {
    const exampleArea = 10000; // Example: 10,000 Sq Ft
    const vendorCost = Number(formData.ratePerUnit) * exampleArea * Number(formData.defaultVisitsPerYear);
    return { vendorCost, customerPrice: vendorCost * (1 + Number(formData.defaultMarkupPercentage) / 100) };
  };

  // Get formula text based on pricing method
  const getFormulaText = () => PRICING_METHODS.find(method => method.value === formData.pricingMethod)?.label;

  // Get configuration info text
  const getConfigInfoText = () => formData.pricingMethod === 'custom_quote'
    ? 'The vendor quote is entered by an admin or manager while preparing the estimate.' : '';

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
        visit_charge: Number(formData.visitCharge),
        custom_work_rate: Number(formData.customWorkRate),
        // Capacity slabs
        capacity_slabs: formData.pricingMethod === 'capacity_slab' ? capacitySlabs.map(slab => ({
          capacityFrom: Number(slab.capacityFrom),
          capacityTo: slab.capacityTo === null ? null : Number(slab.capacityTo),
          vendorRate: slab.isCustomQuote ? null : Number(slab.vendorRate),
          isCustomQuote: slab.isCustomQuote
        })) : null,
        // Manpower fields
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

  const rateField = { area_based: 'ratePerUnit', quantity_based: 'ratePerQuantity', capacity_based: 'ratePerCapacity' }[formData.pricingMethod];
  const numberInput = (field, props = {}) => (
    <input type="number" min="0" step="0.01" required value={formData[field]}
      onChange={event => setField(field, event.target.value)} className={inputClass} {...props} />
  );

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
            <h1 className="text-xl font-semibold">{service ? 'Edit Service' : 'Add Service'}</h1>
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
        {sections.map(([id, label], index) => (
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
                <Field label="Unit *"><select value={formData.unit} onChange={event => setField('unit', event.target.value)} className={inputClass}>{UNIT_OPTIONS[formData.pricingMethod].map(unit => <option key={unit}>{unit}</option>)}</select></Field>
              </div>
              {categoryError && <div role="alert" className="mt-3 text-sm text-red-600">{categoryError} <button type="button" onClick={() => setCategoryAttempt(value => value + 1)} className="font-semibold underline">Retry</button></div>}
            </div>
            <div className="border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">Default Frequency</h2>
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
                {/* Default Frequency */}
                <Field label="Default Frequency *" hint="Default visit frequency for this service"><select value={formData.defaultFrequency} onChange={event => changeFrequency(event.target.value)} className={inputClass}>{FREQUENCY_OPTIONS.map(frequency => <option key={frequency.value}>{frequency.value}</option>)}</select></Field>
                {/* Default Visits Per Year */}
                <Field label="Default Visits Per Year *" hint={formData.allowManualVisits ? 'Manual visit count enabled' : 'Based on selected frequency'}>{numberInput('defaultVisitsPerYear', { min: 1, max: 366, step: 1, readOnly: !formData.allowManualVisits, className: `${inputClass} ${!formData.allowManualVisits ? 'bg-slate-50' : ''}` })}</Field>
                {/* Allow Frequency Override */}
                <Toggle label="Allow Frequency Override" hint="Allow override while creating estimate" checked={formData.allowFrequencyOverride} onChange={() => setField('allowFrequencyOverride', !formData.allowFrequencyOverride)} />
                <Toggle label="Allow Manual Visits" hint="Allow manual number of visits" checked={formData.allowManualVisits} onChange={() => setFormData(prev => ({ ...prev, allowManualVisits: !prev.allowManualVisits, defaultVisitsPerYear: prev.allowManualVisits ? FREQUENCY_OPTIONS.find(item => item.value === prev.defaultFrequency).defaultVisits : prev.defaultVisitsPerYear }))} />
              </div>
              {/* 3. Markup & Margin */}
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
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
          </aside>
        </div>
        {/* 2. Method-Specific Configuration */}
        <section id="pricing-configuration" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 text-sm font-semibold">{getFormulaText()} Configuration</h2>
          {/* Info Box */}
          {/* Area Based / Quantity Based / Capacity Based Fields */}
          {rateField && <div className="max-w-sm">
            {/* Rate per Unit */}
            <Field label={`Vendor Rate (₹) per ${formData.unit} per Visit *`}>{numberInput(rateField)}</Field>
          </div>}
          {/* Fixed Price Fields */}
          {formData.pricingMethod === 'fixed_price' && <div className="max-w-sm"><Field label="Fixed Vendor Price (₹) per Visit *">{numberInput('fixedPrice')}</Field></div>}
          {/* Manpower Fields */}
          {formData.pricingMethod === 'manpower' && <div className="grid gap-5 sm:grid-cols-3">
            <Field label={`Monthly Vendor Rate (₹) per ${formData.unit} *`}>{numberInput('monthlyRate')}</Field>
            <Field label="Billing Period *"><select value={formData.billingPeriod} onChange={event => setField('billingPeriod', event.target.value)} className={inputClass}>{BILLING_PERIODS.map(period => <option key={period}>{period}</option>)}</select></Field>
            <Field label="Period (Months) *">{numberInput('periodMonths', { min: 1, max: 12, step: 1 })}</Field>
          </div>}
          {formData.pricingMethod === 'fixed_visit_custom' && <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Vendor Visit Charge (₹) *">{numberInput('visitCharge')}</Field>
            <Field label="Default Extra Material / Custom Work Cost (₹)" hint="One-off cost; can be changed in the estimate">{numberInput('customWorkRate')}</Field>
          </div>}
          {formData.pricingMethod === 'custom_quote' && <p className="text-sm text-slate-500">{getConfigInfoText()}</p>}
          {/* Capacity Slab Configuration */}
          {formData.pricingMethod === 'capacity_slab' && <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>
                  <th className="px-3 py-3">#</th><th className="px-3 py-3">Capacity From ({formData.unit})</th><th className="px-3 py-3">Capacity To ({formData.unit})</th><th className="px-3 py-3">Vendor Rate (₹) Per Visit</th><th className="px-3 py-3 text-center">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">{capacitySlabs.map((slab, index) => <tr key={slab.id}>
                  <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3"><input aria-label={`Slab ${index + 1} capacity from`} type="number" min="0" step="1" required value={slab.capacityFrom} onChange={event => updateCapacitySlab(slab.id, 'capacityFrom', event.target.value)} className={`${inputClass} min-w-[100px]`} /></td>
                  <td className="px-3 py-3"><div className="space-y-2">
                    {slab.capacityTo !== null && <input aria-label={`Slab ${index + 1} capacity to`} type="number" min={slab.capacityFrom} step="1" required value={slab.capacityTo} onChange={event => updateCapacitySlab(slab.id, 'capacityTo', event.target.value)} className={`${inputClass} min-w-[100px]`} />}
                    {index === capacitySlabs.length - 1 && <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={slab.capacityTo === null} onChange={event => updateCapacitySlab(slab.id, 'capacityTo', event.target.checked ? null : Number(slab.capacityFrom) + 49)} className="accent-blue-600" />Above (no limit)</label>}
                  </div></td>
                  <td className="px-3 py-3"><div className="space-y-2">
                    {!slab.isCustomQuote && <input aria-label={`Slab ${index + 1} vendor rate`} type="number" min="0" step="0.01" required value={slab.vendorRate ?? ''} onChange={event => updateCapacitySlab(slab.id, 'vendorRate', event.target.value)} className={`${inputClass} min-w-[130px]`} />}
                    <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={slab.isCustomQuote} onChange={event => updateCapacitySlab(slab.id, 'isCustomQuote', event.target.checked)} className="accent-blue-600" />Custom Quote</label>
                  </div></td>
                  <td className="px-3 py-3 text-center"><button type="button" aria-label={`Delete slab ${index + 1}`} disabled={capacitySlabs.length === 1} onClick={() => deleteCapacitySlab(slab.id)} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
                </tr>)}</tbody>
              </table>
            </div>
            <button type="button" onClick={addCapacitySlab} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-200 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"><Plus className="h-4 w-4" />Add Slab</button>
          </>}
          {/* Formula Preview */}
        </section>
      </fieldset>
    </form>
  );
};

export default AddServicePage;
