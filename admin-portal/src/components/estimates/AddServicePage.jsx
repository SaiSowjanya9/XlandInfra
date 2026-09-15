import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../utils/safeStorage';
import { 
  ChevronDown, ChevronLeft, Plus, Trash2, Edit2, Save, X, Info, Check,
  Building2, Home, TreePine, LayoutGrid, Map, Briefcase, Search
} from 'lucide-react';
import { useFP } from '../../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Pricing Method Options
const PRICING_METHODS = [
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
  capacity_slab: ['KVA', 'KW', 'HP'],
  manpower: ['Guards', 'Staff', 'Personnel'],
  fixed_visit_custom: ['Visit', 'Job'],
  custom_quote: ['Quote', 'Project']
};

// Frequency Options
const FREQUENCY_OPTIONS = [
  { value: 'Monthly', label: 'Monthly', defaultVisits: 12 },
  { value: 'Every 2 Months', label: 'Every 2 Months', defaultVisits: 6 },
  { value: 'Quarterly', label: 'Quarterly', defaultVisits: 4 },
  { value: 'Half-Yearly', label: 'Half-Yearly', defaultVisits: 2 },
  { value: 'Yearly', label: 'Yearly', defaultVisits: 1 },
  { value: 'One-time', label: 'One-time', defaultVisits: 1 }
];

// Property Type Options
const PROPERTY_TYPES = [
  { id: 'APT', label: 'Apartment' },
  { id: 'GC', label: 'Gated Community' },
  { id: 'FLAT', label: 'Flat' },
  { id: 'VILLA', label: 'Villa' },
  { id: 'IH', label: 'Independent House' },
  { id: 'PLOT', label: 'Plot' },
  { id: 'COMMERCIAL', label: 'Commercial' }
];

// Billing Period Options (for Manpower)
const BILLING_PERIODS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

const AddServicePage = ({ admin, showToast, onBack, onSave }) => {
  const { selectedFp } = useFP();
  const token = getAuthToken();
  
  // Form State
  const [formData, setFormData] = useState({
    pricingMethod: 'area_based',
    primaryInput: 'Area (Square Feet)',
    unit: 'Sq Ft',
    applicablePropertyTypes: ['GC', 'VILLA', 'IH', 'COMMERCIAL'],
    
    // Area Based specific
    ratePerUnit: 1.20,
    defaultFrequency: 'Every 2 Months',
    defaultVisitsPerYear: 6,
    allowFrequencyOverride: true,
    
    // Markup & Margin
    defaultMarkupPercentage: 40,
    minimumMarginPercentage: 30,
    
    // Description
    description: '',
    
    // For Manpower
    billingPeriod: 'Monthly',
    periodMonths: 12,
    
    // For Fixed Price
    fixedPrice: 0,
    
    // For Quantity Based
    ratePerQuantity: 0,
    
    // For Capacity Based
    ratePerCapacity: 0,
    
    // For Fixed Visit + Custom Work
    visitCharge: 0,
    customWorkRate: 0
  });
  
  // Capacity Slab Configuration
  const [capacitySlabs, setCapacitySlabs] = useState([
    { id: 1, capacityFrom: 0, capacityTo: 25, vendorRate: 2000 },
    { id: 2, capacityFrom: 26, capacityTo: 50, vendorRate: 2750 },
    { id: 3, capacityFrom: 51, capacityTo: 100, vendorRate: 3500 },
    { id: 4, capacityFrom: 101, capacityTo: 200, vendorRate: 5250 },
    { id: 5, capacityFrom: 201, capacityTo: null, vendorRate: null, isCustomQuote: true }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update unit options when pricing method changes
  useEffect(() => {
    const units = UNIT_OPTIONS[formData.pricingMethod] || ['Unit'];
    const primaryInputMap = {
      fixed_price: 'Service Type',
      quantity_based: 'Quantity of Assets',
      area_based: 'Area (Square Feet)',
      capacity_based: 'Capacity (KL / Liters)',
      capacity_slab: 'Capacity (KVA)',
      manpower: 'Number of Personnel',
      fixed_visit_custom: 'Visit + Custom Work',
      custom_quote: 'Project Requirement'
    };
    setFormData(prev => ({ 
      ...prev, 
      unit: units[0],
      primaryInput: primaryInputMap[formData.pricingMethod] || 'Input'
    }));
  }, [formData.pricingMethod]);

  // Update visits when frequency changes
  useEffect(() => {
    const freq = FREQUENCY_OPTIONS.find(f => f.value === formData.defaultFrequency);
    if (freq) {
      setFormData(prev => ({ ...prev, defaultVisitsPerYear: freq.defaultVisits }));
    }
  }, [formData.defaultFrequency]);

  // Handle property type toggle
  const togglePropertyType = (typeId) => {
    setFormData(prev => ({
      ...prev,
      applicablePropertyTypes: prev.applicablePropertyTypes.includes(typeId)
        ? prev.applicablePropertyTypes.filter(t => t !== typeId)
        : [...prev.applicablePropertyTypes, typeId]
    }));
  };

  // Add new capacity slab
  const addCapacitySlab = () => {
    const lastSlab = capacitySlabs[capacitySlabs.length - 1];
    const newFrom = lastSlab?.capacityTo ? lastSlab.capacityTo + 1 : 0;
    
    setCapacitySlabs([
      ...capacitySlabs,
      {
        id: Date.now(),
        capacityFrom: newFrom,
        capacityTo: newFrom + 50,
        vendorRate: 0,
        isCustomQuote: false
      }
    ]);
  };

  // Update capacity slab
  const updateCapacitySlab = (id, field, value) => {
    setCapacitySlabs(prev => prev.map(slab => 
      slab.id === id ? { ...slab, [field]: value } : slab
    ));
  };

  // Delete capacity slab
  const deleteCapacitySlab = (id) => {
    if (capacitySlabs.length <= 1) {
      showToast?.('At least one slab is required', 'error');
      return;
    }
    setCapacitySlabs(prev => prev.filter(slab => slab.id !== id));
  };

  // Calculate example pricing
  const calculateExamplePricing = () => {
    const rate = parseFloat(formData.ratePerUnit) || 0;
    const exampleArea = 10000; // Example: 10,000 Sq Ft
    const visits = formData.defaultVisitsPerYear;
    const markup = parseFloat(formData.defaultMarkupPercentage) || 0;
    
    const vendorCost = rate * exampleArea * visits;
    const customerPrice = vendorCost * (1 + markup / 100);
    
    return { vendorCost, customerPrice, exampleArea, rate, visits, markup };
  };

  // Get formula text based on pricing method
  const getFormulaText = () => {
    const rate = formData.ratePerUnit || 0;
    const visits = formData.defaultVisitsPerYear;
    
    switch (formData.pricingMethod) {
      case 'area_based':
        return `Annual Vendor Cost = ₹${rate} × Area (${formData.unit}) × ${visits} (Visits Per Year)`;
      case 'quantity_based':
        return `Annual Vendor Cost = ₹${formData.ratePerQuantity || 0} × Quantity × ${visits} (Visits Per Year)`;
      case 'capacity_based':
        return `Annual Vendor Cost = ₹${formData.ratePerCapacity || 0} × Capacity (${formData.unit}) × ${visits} (Visits Per Year)`;
      case 'fixed_price':
        return `Annual Vendor Cost = ₹${formData.fixedPrice || 0} × ${visits} (Visits Per Year)`;
      case 'manpower':
        return `Annual Vendor Cost = No. of ${formData.unit} × Monthly Rate × ${formData.periodMonths} Months`;
      case 'capacity_slab':
        return `Annual Vendor Cost = Rate from Matching Slab × ${visits} (Visits Per Year)`;
      case 'fixed_visit_custom':
        return `Annual Vendor Cost = Visit Charge + Extra Material Cost (Custom Work)`;
      case 'custom_quote':
        return `Manual price entry by manager or admin`;
      default:
        return '';
    }
  };

  // Get configuration info text
  const getConfigInfoText = () => {
    switch (formData.pricingMethod) {
      case 'area_based':
        return 'Area based method calculates cost using rate per unit area (Sq Ft) and total area entered in estimate.';
      case 'quantity_based':
        return 'Quantity based method calculates cost using rate per unit and total quantity of assets/items entered in estimate.';
      case 'capacity_based':
        return 'Capacity based method calculates cost using rate per capacity unit (KL) and total capacity entered in estimate.';
      case 'capacity_slab':
        return 'Capacity slab method picks the matching slab based on capacity and applies the corresponding rate per visit.';
      case 'fixed_price':
        return 'Fixed price method uses a constant price per visit regardless of quantity or area.';
      case 'manpower':
        return 'Manpower method calculates cost based on number of personnel and monthly rate.';
      case 'fixed_visit_custom':
        return 'Fixed visit + custom work method combines a fixed visit charge with additional custom work costs.';
      case 'custom_quote':
        return 'Custom quote allows manual price entry when standard pricing methods don\'t apply.';
      default:
        return '';
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (formData.applicablePropertyTypes.length === 0) {
      showToast?.('Please select at least one property type', 'error');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const serviceData = {
        pricing_method: formData.pricingMethod,
        primary_input: formData.primaryInput.trim(),
        unit: formData.unit,
        applicable_property_types: formData.applicablePropertyTypes,
        default_frequency: formData.defaultFrequency,
        default_visits_per_year: formData.defaultVisitsPerYear,
        allow_frequency_override: formData.allowFrequencyOverride,
        default_markup_percentage: parseFloat(formData.defaultMarkupPercentage) || 0,
        minimum_margin_percentage: parseFloat(formData.minimumMarginPercentage) || 0,
        description: formData.description.trim(),
        // Method-specific fields
        rate_per_unit: formData.ratePerUnit,
        fixed_price: formData.fixedPrice,
        rate_per_quantity: formData.ratePerQuantity,
        rate_per_capacity: formData.ratePerCapacity,
        visit_charge: formData.visitCharge,
        custom_work_rate: formData.customWorkRate,
        // Capacity slabs
        capacity_slabs: formData.pricingMethod === 'capacity_slab' ? capacitySlabs : null,
        // Manpower fields
        billing_period: formData.pricingMethod === 'manpower' ? formData.billingPeriod : null,
        period_months: formData.pricingMethod === 'manpower' ? formData.periodMonths : null
      };
      
      // API call to save service
      const response = await fetch(`${API_BASE}/api/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(serviceData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast?.('Service created successfully!', 'success');
        onSave?.(result.data);
        onBack?.();
      } else {
        throw new Error(result.message || 'Failed to create service');
      }
    } catch (error) {
      console.error('Error creating service:', error);
      showToast?.(error.message || 'Failed to create service', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pricing = calculateExamplePricing();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Add Service – {PRICING_METHODS.find(m => m.value === formData.pricingMethod)?.label}
              </h1>
              <p className="text-sm text-gray-500">Master Data &gt; Service Master &gt; Add Service</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? 'Saving...' : 'Save Service'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6">
        <div className="flex gap-6">
          {/* Left Column - Main Form */}
          <div className="flex-1 space-y-6">
            {/* 1. Basic Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-6">1. Basic Information</h2>
              
              <div className="grid grid-cols-3 gap-6">
                {/* Pricing Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pricing Method <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.pricingMethod}
                      onChange={(e) => setFormData({ ...formData, pricingMethod: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                    >
                      {PRICING_METHODS.map(method => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                
                {/* Primary Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Input <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.primaryInput}
                    onChange={(e) => setFormData({ ...formData, primaryInput: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                </div>
                
                {/* Unit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                    >
                      {(UNIT_OPTIONS[formData.pricingMethod] || ['Unit']).map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* 2. Method-Specific Configuration */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                2. {PRICING_METHODS.find(m => m.value === formData.pricingMethod)?.label} Configuration
              </h2>
              
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800">{getConfigInfoText()}</p>
                    <p className="text-sm font-medium text-blue-900 mt-1">{getFormulaText()}</p>
                  </div>
                </div>
              </div>
              
              {/* Area Based / Quantity Based / Capacity Based Fields */}
              {['area_based', 'quantity_based', 'capacity_based'].includes(formData.pricingMethod) && (
                <div className="grid grid-cols-4 gap-6">
                  {/* Rate per Unit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rate per {formData.unit} (₹) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.ratePerUnit}
                        onChange={(e) => setFormData({ ...formData, ratePerUnit: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Vendor charge per {formData.unit.toLowerCase()}</p>
                  </div>
                  
                  {/* Default Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Frequency <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.defaultFrequency}
                        onChange={(e) => setFormData({ ...formData, defaultFrequency: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                      >
                        {FREQUENCY_OPTIONS.map(freq => (
                          <option key={freq.value} value={freq.value}>{freq.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Default visit frequency</p>
                  </div>
                  
                  {/* Default Visits Per Year */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Visits Per Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.defaultVisitsPerYear}
                      onChange={(e) => setFormData({ ...formData, defaultVisitsPerYear: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Visits based on selected frequency</p>
                  </div>
                  
                  {/* Allow Frequency Override */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allow Frequency Override
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowFrequencyOverride: !formData.allowFrequencyOverride })}
                      className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${
                        formData.allowFrequencyOverride ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform ${
                          formData.allowFrequencyOverride ? 'translate-x-11' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <p className="text-xs text-gray-500 mt-1">Allow override during estimate</p>
                  </div>
                </div>
              )}
              
              {/* Fixed Price Fields */}
              {formData.pricingMethod === 'fixed_price' && (
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fixed Price per Visit (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.fixedPrice}
                      onChange={(e) => setFormData({ ...formData, fixedPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Frequency <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.defaultFrequency}
                        onChange={(e) => setFormData({ ...formData, defaultFrequency: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                      >
                        {FREQUENCY_OPTIONS.map(freq => (
                          <option key={freq.value} value={freq.value}>{freq.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Visits Per Year
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.defaultVisitsPerYear}
                      onChange={(e) => setFormData({ ...formData, defaultVisitsPerYear: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allow Frequency Override
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowFrequencyOverride: !formData.allowFrequencyOverride })}
                      className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${
                        formData.allowFrequencyOverride ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-transform ${
                          formData.allowFrequencyOverride ? 'translate-x-11' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Manpower Fields */}
              {formData.pricingMethod === 'manpower' && (
                <div className="grid grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Period <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.billingPeriod}
                        onChange={(e) => setFormData({ ...formData, billingPeriod: e.target.value })}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                      >
                        {BILLING_PERIODS.map(period => (
                          <option key={period} value={period}>{period}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Period (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.periodMonths}
                      onChange={(e) => setFormData({ ...formData, periodMonths: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
              
              {/* Capacity Slab Configuration */}
              {formData.pricingMethod === 'capacity_slab' && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Capacity Slab Configuration</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left text-xs font-semibold text-gray-600 pb-3 w-12">#</th>
                          <th className="text-left text-xs font-semibold text-gray-600 pb-3">Capacity From ({formData.unit})</th>
                          <th className="text-left text-xs font-semibold text-gray-600 pb-3">Capacity To ({formData.unit})</th>
                          <th className="text-left text-xs font-semibold text-gray-600 pb-3">Vendor Rate (₹) Per Visit</th>
                          <th className="text-center text-xs font-semibold text-gray-600 pb-3 w-20">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capacitySlabs.map((slab, index) => (
                          <tr key={slab.id} className="border-b border-gray-100">
                            <td className="py-3 text-sm text-gray-600">{index + 1}</td>
                            <td className="py-3">
                              <input
                                type="number"
                                min="0"
                                value={slab.capacityFrom}
                                onChange={(e) => updateCapacitySlab(slab.id, 'capacityFrom', parseInt(e.target.value) || 0)}
                                className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200"
                              />
                            </td>
                            <td className="py-3">
                              {slab.isCustomQuote ? (
                                <span className="text-sm text-gray-500">Above</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  value={slab.capacityTo || ''}
                                  onChange={(e) => updateCapacitySlab(slab.id, 'capacityTo', parseInt(e.target.value) || 0)}
                                  className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200"
                                />
                              )}
                            </td>
                            <td className="py-3">
                              {slab.isCustomQuote ? (
                                <span className="text-sm text-orange-600 font-medium">Custom Quote</span>
                              ) : (
                                <div className="relative w-40">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={slab.vendorRate || ''}
                                    onChange={(e) => updateCapacitySlab(slab.id, 'vendorRate', parseInt(e.target.value) || 0)}
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200"
                                  />
                                </div>
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => deleteCapacitySlab(slab.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <button
                    onClick={addCapacitySlab}
                    className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Slab
                  </button>
                </div>
              )}
              
              {/* Formula Preview */}
              {formData.pricingMethod !== 'custom_quote' && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Formula Preview</p>
                      <p className="text-sm text-green-700">{getFormulaText()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 3. Markup & Margin */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-6">3. Markup & Margin</h2>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Default Markup Percentage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Markup Percentage (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.defaultMarkupPercentage}
                    onChange={(e) => setFormData({ ...formData, defaultMarkupPercentage: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Applied on total actual cost</p>
                </div>
                
                {/* Minimum Margin Percentage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Margin Percentage (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.minimumMarginPercentage}
                    onChange={(e) => setFormData({ ...formData, minimumMarginPercentage: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum margin allowed</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Sidebar */}
          <div className="w-80 space-y-6 flex-shrink-0">
            {/* Applicable Property Types */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Applicable Property Types</h2>
              
              <div className="grid grid-cols-2 gap-3">
                {PROPERTY_TYPES.map(type => {
                  const isSelected = formData.applicablePropertyTypes.includes(type.id);
                  return (
                    <label
                      key={type.id}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePropertyType(type.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{type.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            
            {/* Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Description</h2>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Includes regular landscape maintenance for gardens, lawns, plants and common green areas. Any plant replacement or major landscaping work is excluded."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 resize-none"
              />
              <p className="text-right text-xs text-gray-400 mt-1">{formData.description.length}/500</p>
            </div>
            
            {/* Pricing Preview (Example) */}
            {['area_based', 'quantity_based', 'capacity_based'].includes(formData.pricingMethod) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Pricing Preview (Example)</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rate per {formData.unit} per Visit</span>
                    <span className="font-medium">₹{pricing.rate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total {formData.unit === 'Sq Ft' ? 'Area' : 'Units'} ({formData.unit})</span>
                    <span className="font-medium">{pricing.exampleArea.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Visits Per Year</span>
                    <span className="font-medium">{pricing.visits}</span>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Annual Vendor Cost (A)</span>
                      <span className="font-semibold text-gray-900">₹{pricing.vendorCost.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">If Markup = {pricing.markup}%</span>
                    <span></span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Customer Price (B)</span>
                    <span className="font-bold text-blue-600">₹{pricing.customerPrice.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    <Info className="w-3 h-3 inline mr-1" />
                    Actual customer price will be calculated in the estimate screen with all costs.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddServicePage;
