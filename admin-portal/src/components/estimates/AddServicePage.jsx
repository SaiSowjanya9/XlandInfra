import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/safeStorage';
import { ChevronLeft, Plus, Trash2, Save, Loader2, SlidersHorizontal } from 'lucide-react';
import { useFP } from '../../contexts/FPContext';
import AutocompleteInput from '../common/AutocompleteInput';
import { manpowerRangeLabel, previewManpower, suggestedManpower } from '../../utils/manpowerPricing';
import { primaryInputLabel, unitGroupsFor, unitOptionsFor } from '../../utils/estimatePackageUtils';

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

// A franchise service may share its name with an admin-wide one, so only ambiguous names carry a scope
export const serviceOptionLabel = (service, services = []) =>
  services.filter(item => item.service_name === service.service_name).length > 1
    ? `${service.service_name} (${service.franchise_partner_id ? `FP ${service.franchise_partner_id}` : 'All FPs'})`
    : service.service_name;

// Frequency Options. On Request has no scheduled visits, so its annual count is zero.
export const FREQUENCY_OPTIONS = [
  { value: 'On Request', label: 'On Request', defaultVisits: 0 },
  { value: 'Monthly', label: 'Monthly', defaultVisits: 12 },
  { value: 'Every 2 Months', label: 'Every 2 Months', defaultVisits: 6 },
  { value: 'Quarterly', label: 'Quarterly', defaultVisits: 4 },
  { value: 'Every 4 Months', label: 'Every 4 Months', defaultVisits: 3 },
  { value: 'Half Yearly', label: 'Half Yearly', defaultVisits: 2 },
  { value: 'Yearly', label: 'Yearly', defaultVisits: 1 },
  { value: 'Weekly', label: 'Weekly', defaultVisits: 52 },
  { value: 'Bi-Weekly', label: 'Bi-Weekly', defaultVisits: 26 }
];

// Property Type Options
export const PROPERTY_TYPES = [
  { id: 'GC', label: 'Gated Community' },
  { id: 'APT', label: 'Apartment' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'PLOT', label: 'Plot' }
];
// Not offered on new services; kept so older records and properties still read correctly
const LEGACY_PROPERTY_TYPES = [{ id: 'IH', label: 'Independent House' }];
export const propertyTypeLabel = id => [...PROPERTY_TYPES, ...LEGACY_PROPERTY_TYPES].find(type => type.id === id)?.label || id || '—';

// Billing Period Options (for Manpower)
const BILLING_PERIODS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500';

const Field = ({ label, children }) => (
  <label className="block min-w-0">
    <span className="mb-2 block text-xs font-semibold text-slate-700">{label}</span>
    {children}
  </label>
);

const Toggle = ({ label, checked, onChange }) => (
  <div>
    <span className="mb-3 block text-xs font-semibold text-slate-700">{label}</span>
    <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

const blankSlab = (id) => ({ id, capacityFrom: '', capacityTo: '', vendorRate: '', isCustomQuote: false, defaultFrequency: 'Monthly', defaultVisitsPerYear: 12 });

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

// `scoped` portals (FP) own their catalog scope on the server, so no FP is sent with the service.
// `embedded` drops the form's own title: the hosting page already names the screen.
// `leading` lets the hosting page put its own controls on the form's action row, keeping one line.
const AddServicePage = ({ admin, showToast, onBack, onSave, service, apiPath = '/api/admin/service-catalog', scoped = false, scopeLabel, embedded = false, leading }) => {
  const { selectedFp } = useFP();
  const token = getAuthToken();

  // Form State
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    serviceName: '',
    category: '',
    // No method is preselected: the pricing method is an explicit choice
    pricingMethod: '',
    unit: '',
    applicablePropertyTypes: [],
    // Area Based specific
    ratePerUnit: '',
    defaultFrequency: 'Monthly',
    defaultVisitsPerYear: 12,
    allowFrequencyOverride: false,
    allowManualVisits: false,
    // On means no vendor is assigned and nothing is scheduled for this service
    skipVendorAssignment: false,
    // Markup & Margin
    defaultMarkupPercentage: '',
    // Description
    description: '',
    // For Manpower
    manpowerBasis: 'per_visit',
    ratePerPerson: '',
    roleDesignation: '',
    workingHoursPerVisit: '',
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

  // Capacity Slab Configuration starts empty; the ranges and rates are the user's to enter
  const [capacitySlabs, setCapacitySlabs] = useState([blankSlab(1)]);
  const [manpowerRanges, setManpowerRanges] = useState([]);
  const [exampleManpowerArea, setExampleManpowerArea] = useState('1500');
  const [examplePersonnel, setExamplePersonnel] = useState('2');
  const [exampleOvertime, setExampleOvertime] = useState('0');
  const [exampleCapacity, setExampleCapacity] = useState('10');
  const [exampleAmount, setExampleAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'overtimeRatePerHour' && value === '') setExampleOvertime('0');
  };

  useEffect(() => {
    if (!service) return;
    const fields = { manpowerBasis: 'manpower_basis', ratePerPerson: 'rate_per_person', roleDesignation: 'role_designation', workingHoursPerVisit: 'working_hours_per_visit', overtimeRatePerHour: 'overtime_rate_per_hour', minimumManpower: 'minimum_manpower', serviceName: 'service_name', category: 'category', pricingMethod: 'pricing_method', unit: 'unit', applicablePropertyTypes: 'applicable_property_types', ratePerUnit: 'rate_per_unit', defaultFrequency: 'default_frequency', defaultVisitsPerYear: 'default_visits_per_year', allowFrequencyOverride: 'allow_frequency_override', allowManualVisits: 'allow_manual_visits', skipVendorAssignment: 'skip_vendor_assignment', defaultMarkupPercentage: 'default_markup_percentage', description: 'description', monthlyRate: 'monthly_rate', billingPeriod: 'billing_period', periodMonths: 'period_months', fixedPrice: 'fixed_price', ratePerQuantity: 'rate_per_quantity', ratePerCapacity: 'rate_per_capacity' };
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
    fetch(`${API_BASE}${apiPath}/categories`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error('Unable to load categories.');
      setCategories(result.data || []);
    }).catch(error => {
      if (error.name !== 'AbortError') setCategoryError('Unable to load categories. Please retry.');
    });
    return () => controller.abort();
  }, [apiPath, scoped, token, categoryAttempt]);

  // Update unit options when pricing method changes
  const changePricingMethod = (pricingMethod) => {
    setFormData(prev => ({ ...prev, pricingMethod, unit: unitOptionsFor(pricingMethod)[0] ?? prev.unit }));
    setExampleAmount('');
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

  // Add new capacity slab, continuing from the previous row only when it holds a real number
  const addCapacitySlab = () => {
    setCapacitySlabs(prev => {
      const last = prev[prev.length - 1];
      const id = Math.max(0, ...prev.map(item => item.id)) + 1;
      const schedule = { defaultFrequency: last?.defaultFrequency ?? formData.defaultFrequency, defaultVisitsPerYear: last?.defaultVisitsPerYear ?? formData.defaultVisitsPerYear };
      const openEnded = last?.capacityTo === null;
      const previousEnd = openEnded ? Number(last.capacityFrom) - 1 : Number(last?.capacityTo);
      if (!Number.isFinite(previousEnd) || String(openEnded ? last.capacityFrom : last?.capacityTo).trim() === '') {
        return [...prev, { ...blankSlab(id), ...schedule }];
      }
      const slab = { ...blankSlab(id), ...schedule, capacityFrom: previousEnd + 1 };
      return openEnded ? [...prev.slice(0, -1), slab, { ...last, capacityFrom: previousEnd + 2 }] : [...prev, slab];
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

  // Example pricing for the preview. The real area, quantity or capacity belongs to the property and
  // is entered on the estimate, so this only demonstrates the configured rate.
  const calculateExamplePricing = () => {
    const quantity = isFixedPrice ? 1 : Number(exampleAmountValue);
    const markup = formData.defaultMarkupPercentage === '' ? null : Number(formData.defaultMarkupPercentage);
    const vendorCost = Number(formData[rateField]) * quantity * Number(formData.defaultVisitsPerYear);
    if (!Number.isFinite(vendorCost)) return null;
    // XLAND's margin is the markup on the vendor cost: ₹1,000 at 35% earns ₹350 and the customer
    // pays ₹1,350. It is derived from the rate and the markup, never entered.
    const xlandCost = markup == null ? null : vendorCost * markup / 100;
    const customerPrice = xlandCost == null ? null : vendorCost + xlandCost;
    return { vendorCost, xlandCost, customerPrice,
      marginPercentage: customerPrice ? xlandCost / customerPrice * 100 : null };
  };

  // Get formula text based on pricing method
  const getFormulaText = () => methodLabel(formData.pricingMethod);

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError('');
    if (!formData.pricingMethod) {
      setFormError('Select a pricing method.');
      return;
    }
    if (!formData.category.trim()) {
      setFormError('Enter or select a category.');
      return;
    }
    if (!formData.applicablePropertyTypes.length) {
      setFormError('Select at least one applicable property type.');
      return;
    }
    setIsSubmitting(true);
    try {
      const serviceData = {
        service_name: formData.serviceName.trim(),
        category: formData.category,
        ...(scoped ? {} : { franchise_partner_id: service ? service.franchise_partner_id : selectedFp?.id && selectedFp.id !== 'all' ? Number(selectedFp.id) : null }),
        pricing_method: formData.pricingMethod,
        unit: formData.unit,
        applicable_property_types: formData.applicablePropertyTypes,
        default_frequency: formData.defaultFrequency,
        default_visits_per_year: Number(formData.defaultVisitsPerYear),
        allow_frequency_override: formData.allowFrequencyOverride,
        allow_manual_visits: formData.allowManualVisits,
        skip_vendor_assignment: formData.skipVendorAssignment,
        default_markup_percentage: Number(formData.defaultMarkupPercentage),
        // XLAND's margin is the markup on the vendor cost, so nothing separate is stored: a quote
        // adds markup to the vendor cost and that difference is what XLAND earns.
        default_operating_cost: 0,
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
      const response = await fetch(`${API_BASE}${apiPath}${service ? `/${service.id}` : ''}`, {
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

  const unitOptions = unitOptionsFor(formData.pricingMethod);
  const isFixedPrice = formData.pricingMethod === 'fixed_price';
  const isQuantityBased = formData.pricingMethod === 'quantity_based';
  const isCapacityBased = formData.pricingMethod === 'capacity_based';
  const isCapacitySlab = formData.pricingMethod === 'capacity_slab';
  const isVisitManpower = formData.pricingMethod === 'manpower' && formData.manpowerBasis === 'per_visit';
  const isRatePricing = formData.pricingMethod === 'area_based' || isQuantityBased || isCapacityBased || isFixedPrice || isVisitManpower;
  const rateField = { fixed_price: 'fixedPrice', area_based: 'ratePerUnit', quantity_based: 'ratePerQuantity', capacity_based: 'ratePerCapacity', manpower: isVisitManpower ? 'ratePerPerson' : undefined }[formData.pricingMethod];
  const manpowerConfig = { manpower_ranges: manpowerRanges, rate_per_person: formData.ratePerPerson, minimum_manpower: formData.minimumManpower,
    working_hours_per_visit: formData.workingHoursPerVisit, overtime_rate_per_hour: formData.overtimeRatePerHour === '' ? null : formData.overtimeRatePerHour,
    default_visits_per_year: formData.defaultVisitsPerYear, default_markup_percentage: formData.defaultMarkupPercentage,
    // Nothing separate to add: what XLAND earns is the markup the preview already applies
    default_operating_cost: 0 };
  const manpowerExample = isVisitManpower ? previewManpower(manpowerConfig, { area: exampleManpowerArea, personnel: examplePersonnel, overtime_hours_per_visit: exampleOvertime }) : null;
  // The markup is the only figure entered: XLAND's margin and the customer price follow from the
  // vendor rate, on the rate's own basis. ₹140 a visit at 35% is ₹49 margin and ₹189 to the customer.
  const markupValue = formData.defaultMarkupPercentage === '' ? null : Number(formData.defaultMarkupPercentage);
  const vendorRateValue = (() => {
    const rate = isVisitManpower ? formData.ratePerPerson : formData.pricingMethod === 'manpower' ? formData.monthlyRate : formData[rateField];
    return rate === '' || rate == null || !Number.isFinite(Number(rate)) ? null : Number(rate);
  })();
  const rateBasis = formData.pricingMethod === 'manpower' && !isVisitManpower ? 'Month' : 'Visit';
  const xlandRate = markupValue == null || vendorRateValue == null ? null : vendorRateValue * markupValue / 100;
  const customerRate = xlandRate == null ? null : vendorRateValue + xlandRate;
  const exampleAmountValue = exampleAmount === '' ? (isQuantityBased || isCapacityBased ? '10' : '10000') : exampleAmount;
  const validExampleAmount = isFixedPrice || (String(exampleAmountValue).trim() !== '' && Number(exampleAmountValue) > 0 && Number(exampleAmountValue) <= 1e9);
  const examplePricing = isRatePricing && !isVisitManpower && formData[rateField] !== '' && validExampleAmount ? calculateExamplePricing() : null;
  const currency = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
  const numberInput = (field, props = {}) => (
    <input type="number" min="0" step="0.01" required value={formData[field]}
      onChange={event => setField(field, event.target.value)} className={inputClass} {...props} />
  );
  const slabLabel = slab => String(slab.capacityFrom).trim() === '' ? 'New slab'
    : `${slab.capacityFrom}${slab.capacityTo === null ? '+' : String(slab.capacityTo).trim() === '' ? '' : `–${slab.capacityTo}`} ${formData.unit}`;
  const previewSlab = findCapacitySlab(capacitySlabs, exampleCapacity);
  const validCapacity = exampleCapacity.trim() !== '' && Number.isInteger(Number(exampleCapacity)) && Number(exampleCapacity) >= 0 && Number(exampleCapacity) <= 1e9;
  const slabPreviewMessage = !capacitySlabs.some(slab => String(slab.capacityFrom).trim() !== '') ? 'Configure a slab to see example pricing.'
    : !validCapacity ? 'Enter a whole-number capacity between 0 and 1,000,000,000.'
    : Number(exampleCapacity) < Number(capacitySlabs[0]?.capacityFrom) ? 'Capacity is below the first configured slab.'
    : !previewSlab || previewSlab.isCustomQuote ? 'Custom quote required for this capacity.'
    : previewSlab.vendorRate === '' || previewSlab.vendorRate == null || Number(previewSlab.vendorRate) < 0 || Number(previewSlab.defaultVisitsPerYear) < 1 ? 'Enter a valid slab rate and visit count to see example pricing.' : '';
  const slabVendorCost = slabPreviewMessage ? null : Number(previewSlab.vendorRate) * Number(previewSlab.defaultVisitsPerYear);
  const slabXlandCost = slabVendorCost == null || markupValue == null ? null : slabVendorCost * markupValue / 100;
  const slabCustomerPrice = slabXlandCost == null ? null : slabVendorCost + slabXlandCost;
  const toggleManualVisits = () => {
    if (formData.allowManualVisits) setCapacitySlabs(prev => prev.map(slab => ({ ...slab, defaultVisitsPerYear: FREQUENCY_OPTIONS.find(item => item.value === slab.defaultFrequency).defaultVisits })));
    setFormData(prev => ({ ...prev, allowManualVisits: !prev.allowManualVisits, defaultVisitsPerYear: prev.allowManualVisits ? FREQUENCY_OPTIONS.find(item => item.value === prev.defaultFrequency).defaultVisits : prev.defaultVisitsPerYear }));
  };

  const categoryNames = [...new Set(categories.map(category => category.name).filter(Boolean))];
  const scopeText = scopeLabel ?? (service
    ? (service.franchise_partner_id ? `For FP ${service.franchise_partner_id}` : 'Available to all FPs')
    : selectedFp?.id && selectedFp.id !== 'all' ? `For ${selectedFp.companyName || selectedFp.fpId || `FP ${selectedFp.id}`}` : 'Available to all FPs');

  if (admin?.role === 'operations_manager') {
    return <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">Service configuration is read-only for your role.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
      {/* Header */}
      {/* One row, never wrapped: whatever the host supplies sits left, the actions right */}
      <header className="flex items-center gap-3 overflow-x-auto">
        {leading && <div className="mr-auto shrink-0">{leading}</div>}
        {!embedded && <div className="mr-auto min-w-0">
          <h1 className="truncate text-xl font-semibold">{service ? 'Edit Service' : 'Add Service'}{formData.pricingMethod ? ` — ${getFormulaText()}` : ''}</h1>
          <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{scopeText}</span>
        </div>}
        {/* Back, Cancel, Save and nothing else: this screen is already Add Service, so the
            host's create action is not repeated here, and Save is the row's one primary. */}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <button type="button" onClick={onBack} disabled={isSubmitting} aria-label="Back to services" className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:bg-slate-50">
            <ChevronLeft className="h-5 w-5 text-slate-500" />
          </button>
          <button type="button" onClick={onBack} disabled={isSubmitting} className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-blue-600 shadow-sm transition hover:bg-blue-50">Cancel</button>
          <button type="submit" disabled={isSubmitting || !formData.pricingMethod} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSubmitting ? 'Saving...' : 'Save Service'}
          </button>
        </div>
      </header>
      {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-5">
        {/* Main Content. The sidebar is a quarter of the width rather than a third: its cards are
            narrow content, while the Capacity Slab table needs the room to show all eight columns */}
        <div className="grid gap-5 xl:grid-cols-4">
          {/* Left Column - Main Form */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-3">
            {/* 1. Basic Information */}
            <div className="p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold">Basic Information</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Service Name *"><input required maxLength={150} value={formData.serviceName} onChange={event => setField('serviceName', event.target.value)} placeholder="e.g. Generator Maintenance" className={inputClass} /></Field>
                <Field label="Category *">
                  <AutocompleteInput value={formData.category} onChange={value => setField('category', value)} options={categoryNames}
                    placeholder="Type or select category" inputClassName="py-2.5" maxResults={100} showAllOnOpen />
                </Field>
                {/* Pricing Method — every method is visible so the form is never mistaken for a single-method screen */}
                <div className="sm:col-span-2">
                  <span className="mb-3 block text-xs font-semibold text-slate-700">Pricing Method <span className="text-red-500">*</span></span>
                  <div role="group" aria-label="Pricing Method" className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
                    {PRICING_METHODS.map(method => (
                      <button key={method.value} type="button" aria-pressed={formData.pricingMethod === method.value}
                        onClick={() => changePricingMethod(method.value)}
                        className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${formData.pricingMethod === method.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                        {method.label}
                      </button>
                    ))}
                    {formData.pricingMethod && !PRICING_METHODS.some(method => method.value === formData.pricingMethod) && (
                      <button type="button" disabled aria-pressed="true" title="This method is no longer offered"
                        className="cursor-not-allowed rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700">
                        {methodLabel(formData.pricingMethod)}
                      </button>
                    )}
                  </div>
                </div>
                {/* Unit: the options follow the pricing method and are grouped by unit type, and the
                    first one is selected for the method. A unit saved before its label was withdrawn
                    is kept selectable so editing the service does not silently change it. */}
                {formData.pricingMethod && <Field label={isCapacityBased || isCapacitySlab ? 'Capacity Unit *' : 'Unit *'}>
                  <select value={formData.unit} onChange={event => setField('unit', event.target.value)} className={inputClass}>
                    {formData.unit && !unitOptions.includes(formData.unit) &&
                      <option value={formData.unit}>{formData.unit}{unitOptions.length ? ' (no longer offered)' : ''}</option>}
                    {unitGroupsFor(formData.pricingMethod).map(group => (
                      <optgroup key={group.type} label={group.label}>
                        {group.units.map(unit => <option key={unit}>{unit}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>}
                {/* Primary Input is derived from the service and its method, never entered, and it
                    travels with the service into estimates, view modals, PDFs and emails */}
                {formData.pricingMethod && <Field label="Primary Input">
                  <p className={`${inputClass} bg-slate-50 text-slate-500`}>{primaryInputLabel(formData.serviceName, formData.pricingMethod, formData.unit) || '—'}</p>
                </Field>}
              </div>
              {categoryError && <div role="alert" className="mt-3 text-sm text-red-600">{categoryError} <button type="button" onClick={() => setCategoryAttempt(value => value + 1)} className="font-semibold underline">Retry</button></div>}
            </div>
            {/* Capacity Slab Configuration */}
            {isCapacitySlab && <div className="border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">Capacity Slab Configuration</h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[900px] text-left text-xs">
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
                      {!slab.isCustomQuote && <input aria-label={`Slab ${index + 1} vendor rate`} type="number" min="0" max={1e9} step="0.01" required value={slab.vendorRate ?? ''} onChange={event => updateCapacitySlab(slab.id, 'vendorRate', event.target.value)} className={`${inputClass} min-w-[110px]`} />}
                      <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={slab.isCustomQuote} onChange={event => updateCapacitySlab(slab.id, 'isCustomQuote', event.target.checked)} className="accent-blue-600" />Custom Quote</label>
                    </div></td>
                    <td className="px-3 py-3"><select aria-label={`Slab ${index + 1} default frequency`} value={slab.defaultFrequency} onChange={event => updateCapacitySlab(slab.id, 'defaultFrequency', event.target.value)} className={`${inputClass} min-w-[130px]`}>{FREQUENCY_OPTIONS.map(item => <option key={item.value}>{item.value}</option>)}</select></td>
                    <td className="px-3 py-3"><input aria-label={`Slab ${index + 1} default visits per year`} type="number" min="0" max="366" step="1" required readOnly={!formData.allowManualVisits} value={slab.defaultVisitsPerYear} onChange={event => updateCapacitySlab(slab.id, 'defaultVisitsPerYear', event.target.value)} className={`${inputClass} min-w-[90px] ${!formData.allowManualVisits ? 'bg-slate-50' : ''}`} /></td>
                    <td className="px-3 py-3 text-center"><button type="button" aria-label={`Delete slab ${index + 1}`} disabled={capacitySlabs.length === 1} onClick={() => deleteCapacitySlab(slab.id)} className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <button type="button" onClick={addCapacitySlab} disabled={capacitySlabs.length >= 100} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-4 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"><Plus className="h-4 w-4" />Add Slab</button>
            </div>}
            {!formData.pricingMethod && <div className="border-t border-slate-100 p-5 sm:p-6">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center">
                <SlidersHorizontal className="h-5 w-5 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">No pricing method selected</p>
                <p className="max-w-sm text-xs text-slate-500">Choose a method above to configure its rate, frequency, visits and markup.</p>
              </div>
            </div>}
            {formData.pricingMethod && <div className="border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">{isRatePricing ? `${getFormulaText()} Configuration` : isCapacitySlab ? 'Fallback Frequency & Estimate Overrides' : 'Default Frequency'}</h2>
              <div className={`grid gap-5 ${isRatePricing ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {/* Rate, frequency and visit count on one row */}
                {isRatePricing && <Field label={isVisitManpower ? 'Rate per Person per Visit (₹) *' : isFixedPrice ? 'Fixed Rate per Visit (₹) *' : `Rate per ${formData.unit} (₹) *`}>{numberInput(rateField, { max: 1e9 })}</Field>}
                <Field label="Default Frequency *"><select value={formData.defaultFrequency} onChange={event => changeFrequency(event.target.value)} className={inputClass}>{FREQUENCY_OPTIONS.map(frequency => <option key={frequency.value}>{frequency.value}</option>)}</select></Field>
                <Field label="Default Visits Per Year *">{numberInput('defaultVisitsPerYear', { min: 0, max: 366, step: 1, readOnly: !formData.allowManualVisits, className: `${inputClass} ${!formData.allowManualVisits ? 'bg-slate-50' : ''}` })}</Field>
              </div>
              {/* The three toggles on the row below, aligned to the same columns. The third is on
                  every pricing method: on means this service is arranged without a vendor, so no
                  vendor is assigned to it and nothing is scheduled for it. */}
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Toggle label="Allow Frequency Override" checked={formData.allowFrequencyOverride} onChange={() => setField('allowFrequencyOverride', !formData.allowFrequencyOverride)} />
                <Toggle label="Allow Manual Visits" checked={formData.allowManualVisits} onChange={toggleManualVisits} />
                <Toggle label="Do Not Assign Vendor" checked={formData.skipVendorAssignment} onChange={() => setField('skipVendorAssignment', !formData.skipVendorAssignment)} />
              </div>
              {isVisitManpower && <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Role / Designation (Optional)"><input maxLength={150} value={formData.roleDesignation} onChange={event => setField('roleDesignation', event.target.value)} placeholder="e.g. Housekeeping Staff" className={inputClass} /></Field>
                <Field label="Working Hours per Visit *">{numberInput('workingHoursPerVisit', { min: 0.01, max: 24 })}</Field>
                <Field label="Overtime Rate per Person / Hour (₹)">{numberInput('overtimeRatePerHour', { required: false, max: 1e9 })}</Field>
                <Field label="Minimum Manpower Required *">{numberInput('minimumManpower', { min: 1, max: 1e6, step: 1 })}</Field>
              </div>}
            </div>}
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
            {formData.pricingMethod && <div className="border-t border-slate-100 p-5 sm:p-6">
              <h2 className="mb-5 text-sm font-semibold text-blue-600">Default Markup</h2>
              {/* Markup is entered, then the margin and the customer price are calculated from it */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Default Markup Percentage (%) *">{numberInput('defaultMarkupPercentage', { max: 1000 })}</Field>
                {/* Derived, never entered. Capacity Slab prices from its slabs, so it shows neither. */}
                {!isCapacitySlab && <>
                  <Field label={`XLAND Margin (₹ per ${rateBasis})`}>
                    <input type="text" readOnly value={xlandRate == null ? '' : currency(xlandRate)} placeholder="Set a rate and markup"
                      className={`${inputClass} bg-slate-50 text-slate-600`} />
                  </Field>
                  <Field label={`Customer Price (₹ per ${rateBasis})`}>
                    <input type="text" readOnly value={customerRate == null ? '' : currency(customerRate)} placeholder="Set a rate and markup"
                      className={`${inputClass} bg-slate-50 font-semibold text-slate-800`} />
                  </Field>
                </>}
              </div>
            </div>}
          </section>
          {/* Right Column - Sidebar */}
          <aside className="space-y-5">
            {/* Applicable Property Types */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="mb-4 text-sm font-semibold">Applicable Property Types <span className="text-red-500">*</span></h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                {PROPERTY_TYPES.map(type => (
                  <label key={type.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition ${formData.applicablePropertyTypes.includes(type.id) ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={formData.applicablePropertyTypes.includes(type.id)} onChange={() => togglePropertyType(type.id)} className="h-4 w-4 shrink-0 accent-blue-600" />
                    <span className="text-xs text-slate-700">{type.label}</span>
                  </label>
                ))}
                {/* A type saved before it was withdrawn stays visible so it can be seen and removed */}
                {formData.applicablePropertyTypes.filter(id => !PROPERTY_TYPES.some(type => type.id === id)).map(id => (
                  <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5" title="No longer offered for new services">
                    <input type="checkbox" checked onChange={() => togglePropertyType(id)} className="h-4 w-4 shrink-0 accent-amber-600" />
                    <span className="text-xs text-amber-700">{propertyTypeLabel(id)}</span>
                  </label>
                ))}
              </div>
            </section>
            {/* Description */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <Field label="Description"><textarea value={formData.description} onChange={event => setField('description', event.target.value)} placeholder="Describe the service" rows={6} maxLength={500} className={`${inputClass} resize-y`} /></Field>
              <p className="mt-1 text-right text-xs text-slate-400">{formData.description.length}/500</p>
            </section>
            {/* Pricing Preview (Example) */}
            {isRatePricing && !isVisitManpower && <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="mb-4 text-sm font-semibold">Pricing Preview{isFixedPrice ? '' : ' (Example)'}</h2>
              {!isFixedPrice && <Field label={`Example Total ${isQuantityBased ? 'Quantity' : isCapacityBased ? 'Capacity' : 'Area'} (${formData.unit})`}>
                <input inputMode="decimal" value={exampleAmountValue} onChange={event => setExampleAmount(event.target.value)} className={inputClass} />
              </Field>}
              <dl className={`space-y-3 text-xs text-slate-600 ${isFixedPrice ? '' : 'mt-4'}`}>
                <div className="flex justify-between gap-3"><dt>{isFixedPrice ? 'Fixed Rate per Visit' : `Rate per ${formData.unit} per Visit`}</dt><dd className="font-medium text-slate-800">{currency(formData[rateField] === '' ? null : Number(formData[rateField]))}</dd></div>
                <div className="flex justify-between gap-3"><dt>Visits Per Year</dt><dd className="font-medium text-slate-800">{formData.defaultVisitsPerYear}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold">Annual Vendor Cost</dt><dd className="font-semibold text-slate-800">{currency(examplePricing?.vendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Default Markup</dt><dd className="font-medium text-slate-800">{formData.defaultMarkupPercentage === '' ? '—' : `${formData.defaultMarkupPercentage}%`}</dd></div>
                <div className="flex justify-between gap-3"><dt>XLAND Margin</dt><dd className="font-medium text-slate-800">{currency(examplePricing?.xlandCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">{isFixedPrice ? '' : 'Example '}Customer Price</dt><dd className="font-semibold text-blue-600">{currency(examplePricing?.customerPrice)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Margin</dt><dd className="font-medium text-slate-800">{examplePricing?.marginPercentage == null ? '—' : `${examplePricing.marginPercentage.toFixed(2)}%`}</dd></div>
              </dl>
              {!validExampleAmount && <p className="mt-3 text-xs text-amber-700">Enter an example {isQuantityBased ? 'quantity' : isCapacityBased ? 'capacity' : 'area'} greater than zero to see the pricing.</p>}
            </section>}
            {isVisitManpower && <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="mb-4 text-sm font-semibold">Pricing Preview (Example)</h2>
              <div className="space-y-3">
                {manpowerRanges.length > 0 && <Field label="Example Property Area (Sq Ft)"><input inputMode="numeric" value={exampleManpowerArea} onChange={event => { setExampleManpowerArea(event.target.value); setExamplePersonnel(String(suggestedManpower(manpowerConfig, event.target.value))); }} className={inputClass} /></Field>}
                <Field label="Manpower (Persons)"><input inputMode="numeric" value={examplePersonnel} onChange={event => setExamplePersonnel(event.target.value)} className={inputClass} /></Field>
                {formData.overtimeRatePerHour !== '' && <Field label="Overtime Hours per Person / Visit"><input inputMode="decimal" value={exampleOvertime} onChange={event => setExampleOvertime(event.target.value)} className={inputClass} /></Field>}
              </div>
              <dl className="mt-4 space-y-3 text-xs text-slate-600">
                {manpowerRanges.length > 0 && <div className="flex justify-between gap-3"><dt>Matching Area Range</dt><dd className="font-medium text-slate-800">{manpowerRangeLabel(manpowerExample?.range)}</dd></div>}
                <div className="flex justify-between gap-3"><dt>Rate per Person per Visit</dt><dd className="font-medium text-slate-800">{currency(manpowerExample?.ratePerPerson)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Visits Per Year</dt><dd className="font-medium text-slate-800">{formData.defaultVisitsPerYear}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold">Annual Vendor Cost</dt><dd className="font-semibold text-slate-800">{currency(manpowerExample?.vendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Default Markup</dt><dd className="font-medium text-slate-800">{formData.defaultMarkupPercentage === '' ? '—' : `${formData.defaultMarkupPercentage}%`}</dd></div>
                <div className="flex justify-between gap-3"><dt>XLAND Margin</dt><dd className="font-medium text-slate-800">{currency(manpowerExample?.customerPrice == null ? null : manpowerExample.customerPrice - manpowerExample.vendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">Example Customer Price</dt><dd className="font-semibold text-blue-600">{currency(manpowerExample?.customerPrice)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Margin</dt><dd className="font-medium text-slate-800">{manpowerExample?.marginPercentage == null ? '—' : `${manpowerExample.marginPercentage.toFixed(2)}%`}</dd></div>
              </dl>
              {manpowerExample?.error && <p className="mt-3 text-xs text-amber-700">{manpowerExample.error}</p>}
            </section>}
            {isCapacitySlab && <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h2 className="mb-4 text-sm font-semibold">Pricing Preview (Example)</h2>
              <Field label={`Entered Capacity (${formData.unit})`}><input inputMode="numeric" value={exampleCapacity} onChange={event => setExampleCapacity(event.target.value)} className={inputClass} /></Field>
              <dl className="mt-4 space-y-3 text-xs text-slate-600">
                <div className="flex justify-between gap-3"><dt>Matching Slab</dt><dd className="font-medium text-slate-800">{previewSlab ? slabLabel(previewSlab) : '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt>Rate Per Visit</dt><dd className="font-medium text-slate-800">{currency(slabVendorCost == null ? null : Number(previewSlab.vendorRate))}</dd></div>
                <div className="flex justify-between gap-3"><dt>Frequency</dt><dd className="font-medium text-slate-800">{previewSlab?.defaultFrequency ?? '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt>Visits Per Year</dt><dd className="font-medium text-slate-800">{previewSlab?.defaultVisitsPerYear ?? '—'}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-semibold">Annual Vendor Cost</dt><dd className="font-semibold text-slate-800">{currency(slabVendorCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Default Markup</dt><dd className="font-medium text-slate-800">{formData.defaultMarkupPercentage === '' ? '—' : `${formData.defaultMarkupPercentage}%`}</dd></div>
                <div className="flex justify-between gap-3"><dt>XLAND Margin</dt><dd className="font-medium text-slate-800">{currency(slabXlandCost)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold">Example Customer Price</dt><dd className="font-semibold text-blue-600">{currency(slabCustomerPrice)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Margin</dt><dd className="font-medium text-slate-800">{slabCustomerPrice == null ? '—' : `${(slabXlandCost / slabCustomerPrice * 100).toFixed(2)}%`}</dd></div>
              </dl>
              {slabPreviewMessage && <p className="mt-3 text-xs text-amber-700">{slabPreviewMessage}</p>}
            </section>}
          </aside>
        </div>
        {/* 2. Monthly Manpower Configuration, kept for services saved before the per-visit basis */}
        {formData.pricingMethod === 'manpower' && !isVisitManpower && <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
          <h2 className="mb-5 text-sm font-semibold">{getFormulaText()} Configuration</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
