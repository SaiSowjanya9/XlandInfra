import { useState, useEffect } from 'react';
import { 
  Building2, User, Phone, Mail, Search, FileText, 
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase,
  Package, Send, Plus, Trash2, Lock, ChevronDown
} from 'lucide-react';
import PhoneInput from '../common/PhoneInput';
import { 
  createEstimate, calculateEstimateTotal, getServices, PROPERTY_TYPES,
  getAMCPackageByPropertyId, addService, FREQUENCY_TYPES,
  getAMCPackages, getAddons, seedTestData, getAMCPackageByPropertyType,
  migratePackagesToServiceRows, getAMCPackagesByPropertyType
} from '../../utils/estimateStore';

import { getProperties } from '../../utils/propertyStore';

// Subcategory options for services
const SUBCATEGORIES = ['Maintenance', 'Cleaning', 'Security', 'Landscaping', 'Utilities', 'Other'];

// Auto-calculate frequency count based on frequency type
const FREQUENCY_COUNT_MAP = {
  'Monthly': 1,
  'Quarterly': 3,
  'Half-yearly': 6,
  'Yearly': 12,
  'Custom Months': null // User enters manually
};

const PROPERTY_ICONS = {
  APT: Home,
  Flats: LayoutGrid,
  GC: Layers,
  Villas: TreePine,
  Plots: Map,
  Commercial: Briefcase
};

const CreateEstimate = ({ onSuccess, showToast }) => {
  const [estimateType, setEstimateType] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [showPropertySuggestions, setShowPropertySuggestions] = useState(false);
  const [properties, setProperties] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [amcPackage, setAmcPackage] = useState(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [lastCreatedEstimate, setLastCreatedEstimate] = useState(null);
  const [lockedServices, setLockedServices] = useState([]); // Services from existing AMC package (locked/read-only)
  const [hasStartedTyping, setHasStartedTyping] = useState(false); // Track if user started typing in ID field
  
  // New state for AMC Package selection and Add-ons
  const [availablePackages, setAvailablePackages] = useState([]); // AMC Packages from manager
  const [availableAddons, setAvailableAddons] = useState([]); // Add-ons from Add-ons manager
  const [selectedPackage, setSelectedPackage] = useState(null); // Selected AMC Package
  const [selectedAddons, setSelectedAddons] = useState([]); // Selected add-ons
  const [discount, setDiscount] = useState(''); // Discount percentage
  const [gstRate, setGstRate] = useState('18'); // GST percentage - customizable
  const [subcategories, setSubcategories] = useState(SUBCATEGORIES); // Dynamic subcategories
  const [estimateForm, setEstimateForm] = useState({
    // Property-based auto-populated fields
    propertyId: '',
    propertyName: '',
    entryType: '',
    zone: '',
    areaName: '',
    division: '',
    propertyType: '',
    numberOfUnits: '',
    address: '',
    city: '',
    blockTower: '',
    blockNumber: '', // Block Number with N/A option
    flatUnit: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    // Direct customer fields
    phone: '',
    countryCode: '+91',
    email: '',
    // Services (new/additional only)
    services: [],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Seed test data if none exists
    seedTestData();
    // Migrate existing packages to include serviceRows with frequency data
    migratePackagesToServiceRows();
    const props = await getProperties();
    setProperties(props);
    setAvailableServices(getServices());
    setAvailablePackages(getAMCPackages());
    setAvailableAddons(getAddons());
  };

  const filteredProperties = properties.filter(prop => {
    const search = propertyIdInput.toLowerCase();
    return (
      prop.propertyId?.toLowerCase().includes(search) ||
      prop.communityName?.toLowerCase().includes(search)
    );
  });

  const handlePropertyIdChange = (value) => {
    setPropertyIdInput(value);
    setShowPropertySuggestions(true);
    
    // Mark that user has started typing - hide estimate type selection
    if (value.length > 0 && !hasStartedTyping) {
      setHasStartedTyping(true);
    }
    
    // Try to find exact match
    const exactMatch = properties.find(
      p => p.propertyId?.toLowerCase() === value.toLowerCase()
    );
    
    if (exactMatch) {
      handlePropertySelect(exactMatch);
    } else {
      setSelectedProperty(null);
      setAmcPackage(null);
    }
  };

  const handlePropertySelect = (property) => {
    setSelectedProperty(property);
    setPropertyIdInput(property.propertyId);
    setShowPropertySuggestions(false);
    setHasStartedTyping(true); // Ensure estimate type selection is hidden
    
    // Dynamic auto-population based on property type
    const entryType = property.entryType?.toUpperCase();
    let blockTower = '';
    let flatUnit = '';
    let numberOfUnits = '';
    
    if (entryType === 'GC') {
      // Gated Community: Block Name + Number of Units
      if (property.blockNames && typeof property.blockNames === 'object') {
        const blockKeys = Object.keys(property.blockNames);
        if (blockKeys.length > 0) {
          // Get all block names (e.g., "A, B, C")
          blockTower = Object.values(property.blockNames).filter(Boolean).join(', ');
        }
      }
      // Calculate total units from unitsPerBlock
      if (property.unitsPerBlock && typeof property.unitsPerBlock === 'object') {
        const totalUnits = Object.values(property.unitsPerBlock).reduce((sum, u) => sum + (parseInt(u) || 0), 0);
        numberOfUnits = totalUnits > 0 ? totalUnits : '';
      }
    } else if (entryType === 'APT') {
      // Apartment: Block Information + Number of Units
      if (property.blockInfo && typeof property.blockInfo === 'string') {
        blockTower = property.blockInfo.trim();
      }
      numberOfUnits = property.numberOfUnits || '';
    } else if (entryType === 'VILLA' || entryType === 'VILLAS') {
      // Villa: Villa Number
      flatUnit = property.villaPlotNumber || '';
    } else if (entryType === 'PLOT' || entryType === 'PLOTS') {
      // Plot: Plot Number
      flatUnit = property.villaPlotNumber || '';
    } else if (entryType === 'FLAT' || entryType === 'FLATS') {
      // Flat: Flat Number (and optional block info)
      flatUnit = property.villaPlotNumber || '';
      if (property.blockInfo && typeof property.blockInfo === 'string') {
        blockTower = property.blockInfo.trim();
      }
    }
    
    // Get customer details from contacts (backend returns 'contacts', not 'associationContacts')
    const primaryContact = property.contacts?.[0] || {};
    
    // Auto-select AMC package based on property type
    const propertyType = property.entryType || property.propertyType;
    if (propertyType) {
      const matchingPackage = getAMCPackageByPropertyType(propertyType);
      if (matchingPackage) {
        setSelectedPackage(matchingPackage);
        showToast?.(`Auto-selected "${matchingPackage.packageName}" package for ${propertyType}`, 'success');
      }
    }
    
    // Check for AMC package and auto-populate locked services
    const existingAMC = getAMCPackageByPropertyId(property.propertyId);
    if (existingAMC && existingAMC.services && existingAMC.services.length > 0) {
      setAmcPackage(existingAMC);
      // Set locked services from AMC package (read-only)
      const amcServices = existingAMC.services.map(s => ({
        name: s.name,
        frequency: s.frequency || 1,
        frequencyType: s.frequencyType || 'Monthly',
        price: s.rate || s.price || '',
        isLocked: true
      }));
      setLockedServices(amcServices);
      showToast?.('Existing package services loaded', 'success');
    } else {
      setAmcPackage(null);
      setLockedServices([]);
    }
    
    // Build full address
    const fullAddress = [
      property.addressLine1,
      property.aptSuiteUnit,
      property.landmark
    ].filter(Boolean).join(', ') || property.address || '';
    
    // Update form with auto-populated fields
    // Note: backend returns communityName as 'name'
    setEstimateForm(prev => ({
      ...prev,
      propertyId: property.propertyId || '',
      propertyName: property.communityName || property.name || '',
      entryType: property.entryType || '',
      zone: property.zone || '',
      areaName: property.areaName || '',
      division: property.division || '',
      propertyType: property.propertyType || '',
      numberOfUnits: numberOfUnits, // Using computed value based on property type
      address: fullAddress,
      city: property.city || '',
      blockTower,
      flatUnit,
      customerName: primaryContact.name || '',
      customerPhone: primaryContact.phone ? `${primaryContact.countryCode || '+91'} ${primaryContact.phone}` : '',
      customerEmail: primaryContact.email || '',
      services: [] // Start with empty new services
    }));
  };

  const calculateServiceTotal = (service) => {
    const price = parseFloat(service.price) || 0;
    const frequency = parseInt(service.frequency) || 1;
    return price * frequency;
  };

  // Get package base price
  const getPackagePrice = () => {
    return selectedPackage ? (parseFloat(selectedPackage.rate) || 0) : 0;
  };

  // Get total add-ons price
  const getAddonsTotal = () => {
    return selectedAddons.reduce((sum, addon) => {
      const addonTotal = addon.services?.reduce((s, service) => {
        const price = parseFloat(service.price) || 0;
        const frequency = parseInt(service.frequency) || 1;
        return s + (price * frequency);
      }, 0) || addon.totalPrice || 0;
      return sum + addonTotal;
    }, 0);
  };

  const calculateSubTotal = () => {
    // For property-based: Package + Add-ons
    if (estimateType === 'property' && selectedPackage) {
      return getPackagePrice() + getAddonsTotal();
    }
    // For direct or when no package: Individual services
    const lockedTotal = lockedServices.reduce((sum, service) => {
      return sum + calculateServiceTotal(service);
    }, 0);
    const newTotal = estimateForm.services.reduce((sum, service) => {
      return sum + calculateServiceTotal(service);
    }, 0);
    return lockedTotal + newTotal;
  };

  // Get discount amount (percentage of subtotal)
  const getDiscountAmount = () => {
    const discountPercent = parseFloat(discount) || 0;
    const subtotal = calculateSubTotal();
    return Math.round(subtotal * (discountPercent / 100));
  };

  // Calculate GST on (Subtotal - Discount)
  const calculateGST = () => {
    const gstPercent = parseFloat(gstRate) || 0;
    const subtotal = calculateSubTotal();
    const discountAmt = getDiscountAmount();
    return Math.round((subtotal - discountAmt) * (gstPercent / 100));
  };

  // Final total: (Subtotal - Discount) + GST
  const calculateTotal = () => {
    const subtotal = calculateSubTotal();
    const discountAmt = getDiscountAmount();
    const gst = calculateGST();
    return subtotal - discountAmt + gst;
  };

  // Handle AMC Package selection
  const handlePackageSelect = (packageId) => {
    if (!packageId) {
      setSelectedPackage(null);
      return;
    }
    const pkg = availablePackages.find(p => p.packageId === packageId);
    setSelectedPackage(pkg || null);
  };

  // Handle adding an add-on from dropdown
  const handleAddAddon = (addonId) => {
    if (!addonId) return;
    const addon = availableAddons.find(a => a.addonId === addonId);
    if (addon && !selectedAddons.find(a => a.addonId === addonId)) {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // Handle removing an add-on
  const handleRemoveAddon = (addonId) => {
    setSelectedAddons(selectedAddons.filter(a => a.addonId !== addonId));
  };

  const handleSave = () => {
    if (!estimateType) {
      showToast?.('Please select an estimate type', 'error');
      return;
    }
    if (estimateType === 'property' && !selectedProperty) {
      showToast?.('Please enter a valid Property ID', 'error');
      return;
    }
    if (estimateType === 'property' && !selectedPackage) {
      showToast?.('Please select an AMC Package', 'error');
      return;
    }
    if (estimateType === 'direct' && !estimateForm.customerName.trim()) {
      showToast?.('Customer name is required', 'error');
      return;
    }
    if (estimateType === 'direct' && !estimateForm.phone.trim()) {
      showToast?.('Phone number is required', 'error');
      return;
    }

    // For property-based: use package + addons
    // For direct: use individual services
    let allServices = [];
    if (estimateType === 'property' && selectedPackage) {
      // Package services (auto-populated from package)
      allServices = [{
        name: selectedPackage.packageName,
        type: 'package',
        services: selectedPackage.services,
        price: selectedPackage.rate
      }];
    } else {
      // Combine locked services with new services
      const newValidServices = estimateForm.services.filter(s => s.name && s.name.trim() && s.price);
      allServices = [...lockedServices, ...newValidServices];
      
      if (allServices.length === 0) {
        showToast?.('At least one service with price is required', 'error');
        return;
      }
    }

    const estimateData = {
      estimateType: estimateType === 'property' ? 'property-based' : 'direct',
      services: allServices,
      notes: estimateForm.notes,
      subTotal: calculateSubTotal(),
      gst: calculateGST(),
      discount: getDiscountAmount(),
      totalPrice: calculateTotal(),
      status: estimateType === 'direct' ? 'Archived' : 'Draft'
    };

    if (estimateType === 'property') {
      estimateData.propertyId = selectedProperty.propertyId;
      estimateData.propertyType = selectedProperty.entryType;
      estimateData.propertyName = estimateForm.propertyName;
      estimateData.blockTower = estimateForm.blockTower;
      estimateData.flatUnit = estimateForm.flatUnit;
      estimateData.clientName = estimateForm.customerName || selectedProperty.communityName;
      estimateData.communityName = selectedProperty.communityName;
      estimateData.customerName = estimateForm.customerName;
      estimateData.customerEmail = estimateForm.customerEmail;
      estimateData.customerPhone = estimateForm.customerPhone;
      
      // Package info
      if (selectedPackage) {
        estimateData.packageId = selectedPackage.packageId;
        estimateData.packageName = selectedPackage.packageName;
        estimateData.packageRate = getPackagePrice();
      }
      
      // Add-ons info
      if (selectedAddons.length > 0) {
        estimateData.addons = selectedAddons.map(a => ({
          addonId: a.addonId,
          services: a.services,
          totalPrice: a.totalPrice
        }));
        estimateData.addonsTotal = getAddonsTotal();
      }
    } else {
      estimateData.customerName = estimateForm.customerName;
      estimateData.phone = estimateForm.phone;
      estimateData.countryCode = estimateForm.countryCode;
      estimateData.email = estimateForm.email;
      estimateData.customerEmail = estimateForm.email;
      estimateData.propertyName = estimateForm.propertyName;
      estimateData.entryType = estimateForm.entryType;
      estimateData.zone = estimateForm.zone;
      estimateData.areaName = estimateForm.areaName;
      estimateData.division = estimateForm.division;
      estimateData.numberOfUnits = estimateForm.numberOfUnits;
      estimateData.address = estimateForm.address;
      estimateData.city = estimateForm.city;
      estimateData.blockTower = estimateForm.blockTower;
      estimateData.blockNumber = estimateForm.blockNumber;
      estimateData.flatUnit = estimateForm.flatUnit;
    }

    const createdEstimate = createEstimate(estimateData);
    setLastCreatedEstimate(createdEstimate);
    
    showToast?.('Estimate saved successfully!', 'success');
    resetForm();
    if (onSuccess) onSuccess();
  };

  const handleSendEmail = () => {
    const email = lastCreatedEstimate?.customerEmail || selectedProperty?.associationContacts?.[0]?.email;
    showToast?.(`Estimate sent to ${email}`, 'success');
    setShowEmailConfirm(false);
    resetForm();
    if (onSuccess) onSuccess();
  };

  const handleSkipEmail = () => {
    showToast?.('Estimate created successfully!', 'success');
    setShowEmailConfirm(false);
    resetForm();
    if (onSuccess) onSuccess();
  };

  const resetForm = () => {
    setEstimateType(null);
    setSelectedProperty(null);
    setPropertyIdInput('');
    setAmcPackage(null);
    setLastCreatedEstimate(null);
    setLockedServices([]);
    setSelectedPackage(null);
    setSelectedAddons([]);
    setDiscount('');
    setHasStartedTyping(false); // Reset typing state
    setEstimateForm({
      propertyId: '',
      propertyName: '',
      entryType: '',
      zone: '',
      areaName: '',
      division: '',
      propertyType: '',
      numberOfUnits: '',
      address: '',
      city: '',
      blockTower: '',
      blockNumber: '',
      flatUnit: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      phone: '',
      countryCode: '+91',
      email: '',
      services: [],
      notes: ''
    });
  };

  const handleAddNewService = (serviceName) => {
    if (serviceName && serviceName.trim()) {
      addService(serviceName.trim());
      setAvailableServices(getServices());
    }
  };

  const addServiceRow = () => {
    setEstimateForm({
      ...estimateForm,
      services: [...estimateForm.services, { name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
  };

  const removeServiceRow = (index) => {
    setEstimateForm({
      ...estimateForm,
      services: estimateForm.services.filter((_, i) => i !== index)
    });
  };

  const updateServiceRow = (index, field, value) => {
    const newServices = [...estimateForm.services];
    
    // If frequency type changes, auto-set frequency count
    if (field === 'frequencyType') {
      const autoCount = FREQUENCY_COUNT_MAP[value];
      newServices[index] = { 
        ...newServices[index], 
        [field]: value,
        frequency: autoCount !== null ? autoCount : ''
      };
    } else {
      newServices[index] = { ...newServices[index], [field]: value };
    }
    
    setEstimateForm({ ...estimateForm, services: newServices });
  };

  return (
    <div className="space-y-6">
      {/* Estimate Type Selection - Hidden after user starts typing/interacting */}
      {!hasStartedTyping && (
        <div className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all duration-300 ${estimateType ? 'opacity-100' : 'opacity-100'}`}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Estimate Type</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => { setEstimateType('property'); }}
              className={`p-6 rounded-xl border-2 transition-all ${
                estimateType === 'property'
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Building2 className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'property' ? 'text-gray-700' : 'text-gray-400'}`} />
              <p className="font-medium text-gray-800">Property-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
            </button>
            <button
              onClick={() => { setEstimateType('direct'); setHasStartedTyping(true); }}
              className={`p-6 rounded-xl border-2 transition-all ${
                estimateType === 'direct'
                  ? 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <User className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'direct' ? 'text-gray-700' : 'text-gray-400'}`} />
              <p className="font-medium text-gray-800">Direct-Based Estimate</p>
              <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
            </button>
          </div>
        </div>
      )}

      {/* Property-based Estimate Form */}
      {estimateType === 'property' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Estimate Details Header */}
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-800">Estimate Details</h3>
          </div>
          
          <div className="px-6 py-4">
            {/* Property ID Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={propertyIdInput}
                  onChange={(e) => handlePropertyIdChange(e.target.value)}
                  onFocus={() => {
                    setShowPropertySuggestions(true);
                    setHasStartedTyping(true); // Hide estimate type selection on focus
                  }}
                  onBlur={() => setTimeout(() => setShowPropertySuggestions(false), 200)}
                  placeholder="Type Property ID (e.g., GC-2024-001)"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                />
                
                {showPropertySuggestions && propertyIdInput && filteredProperties.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProperties.slice(0, 8).map((prop) => {
                      const Icon = PROPERTY_ICONS[prop.entryType] || Building2;
                      return (
                        <button
                          key={prop.propertyId}
                          onClick={() => handlePropertySelect(prop)}
                          className="w-full p-3 text-left hover:bg-blue-50 flex items-center gap-3"
                        >
                          <Icon className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{prop.propertyId}</p>
                            <p className="text-xs text-gray-500">{prop.communityName}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Auto-populated Fields (only show when property selected) */}
            {selectedProperty && (
              <>
                {/* First Row - Contact Name, Property ID, Type, Zone, Area */}
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={estimateForm.customerName}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Property ID</label>
                    <input
                      type="text"
                      value={estimateForm.propertyId}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Entry Type</label>
                    <input
                      type="text"
                      value={estimateForm.entryType}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
                    <input
                      type="text"
                      value={estimateForm.zone}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Area</label>
                    <input
                      type="text"
                      value={estimateForm.areaName}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Second Row - Community Name, Division, Property Type, Units, City */}
                <div className="grid grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Community Name</label>
                    <input
                      type="text"
                      value={estimateForm.propertyName}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Division</label>
                    <input
                      type="text"
                      value={estimateForm.division}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Property Type</label>
                    <input
                      type="text"
                      value={estimateForm.propertyType}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Units</label>
                    <input
                      type="text"
                      value={estimateForm.numberOfUnits}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                    <input
                      type="text"
                      value={estimateForm.city}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Third Row - Address, Contact Phone, Contact Email */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                    <input
                      type="text"
                      value={estimateForm.address}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={estimateForm.customerPhone}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
                    <input
                      type="text"
                      value={estimateForm.customerEmail}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-blue-50 text-gray-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Dynamic Property-Specific Fields based on Entry Type */}
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg mb-4">
                  <h4 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Unit Details
                    <span className="text-xs font-normal text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                      {estimateForm.entryType || 'Property'}
                    </span>
                  </h4>
                  
                  {/* Apartment (APT) - Block Information + Number of Units */}
                  {estimateForm.entryType === 'APT' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Block Information                         </label>
                        <input
                          type="text"
                          value={estimateForm.blockTower}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Number of Units                         </label>
                        <input
                          type="text"
                          value={estimateForm.numberOfUnits ? `${estimateForm.numberOfUnits} Units` : '-'}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Flats - Flat Number (Auto-populated) */}
                  {(estimateForm.entryType === 'Flats' || estimateForm.entryType === 'FLAT') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Flat Number                         </label>
                        <input
                          type="text"
                          value={estimateForm.flatUnit}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      {estimateForm.blockTower && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Block Info                           </label>
                          <input
                            type="text"
                            value={estimateForm.blockTower}
                            readOnly
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Villa - Villa Number (Auto-populated) */}
                  {(estimateForm.entryType === 'Villas' || estimateForm.entryType === 'VILLA') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Villa Number                         </label>
                        <input
                          type="text"
                          value={estimateForm.flatUnit}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Plot - Plot Number (Auto-populated) */}
                  {(estimateForm.entryType === 'Plots' || estimateForm.entryType === 'PLOT') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Plot Number                         </label>
                        <input
                          type="text"
                          value={estimateForm.flatUnit}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Commercial/Factory - Block No + Flat/Unit No */}
                  {(estimateForm.entryType === 'Commercial' || estimateForm.entryType === 'Factory') && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Block No <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={estimateForm.blockTower}
                          onChange={(e) => setEstimateForm({ ...estimateForm, blockTower: e.target.value })}
                          placeholder="e.g., Block-A, Building-1"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Flat/Unit No <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={estimateForm.flatUnit}
                          onChange={(e) => setEstimateForm({ ...estimateForm, flatUnit: e.target.value })}
                          placeholder="e.g., Unit-101, Shop-1"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Gated Community (GC) - Block Name + Number of Units */}
                  {estimateForm.entryType === 'GC' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Block Name                         </label>
                        <input
                          type="text"
                          value={estimateForm.blockTower}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Number of Units                         </label>
                        <input
                          type="text"
                          value={estimateForm.numberOfUnits ? `${estimateForm.numberOfUnits} Units` : '-'}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-indigo-50 text-gray-700 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Default for other/unknown types - exclude all known property types including uppercase variants */}
                  {!['APT', 'Flats', 'FLAT', 'Villas', 'VILLA', 'Plots', 'PLOT', 'Commercial', 'Factory', 'GC'].includes(estimateForm.entryType) && estimateForm.entryType && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Block/Section
                        </label>
                        <input
                          type="text"
                          value={estimateForm.blockTower}
                          onChange={(e) => setEstimateForm({ ...estimateForm, blockTower: e.target.value })}
                          placeholder="Block/Section"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Unit No
                        </label>
                        <input
                          type="text"
                          value={estimateForm.flatUnit}
                          onChange={(e) => setEstimateForm({ ...estimateForm, flatUnit: e.target.value })}
                          placeholder="Unit No"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* AMC Package Info */}
                {lockedServices.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md mb-4">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Lock className="w-4 h-4" />
                      <span className="text-sm font-medium">Existing Package Services</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {lockedServices.length} service(s) from existing package. Use "Add Service" to add additional services.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AMC Package Selection Section */}
          {selectedProperty && (
            <>
              <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-800">AMC Package</h3>
              </div>
              
              <div className="px-6 py-4">
                {/* AMC Package Dropdown - Filtered by Property Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select AMC Package <span className="text-red-500">*</span>
                    {selectedProperty?.entryType && (
                      <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                        Filtered for: {selectedProperty.entryType}
                      </span>
                    )}
                  </label>
                  <div className="relative max-w-md">
                    <select
                      value={selectedPackage?.packageId || ''}
                      onChange={(e) => handlePackageSelect(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                    >
                      <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                      {/* Show packages filtered by property type first, then all packages */}
                      {(() => {
                        const propertyType = selectedProperty?.entryType || selectedProperty?.propertyType;
                        const filteredPkgs = propertyType 
                          ? availablePackages.filter(pkg => {
                              const pkgType = pkg.propertyType?.toUpperCase();
                              const searchType = propertyType.toUpperCase();
                              return pkgType === searchType || 
                                     (pkgType === 'GC' && searchType === 'GC') ||
                                     (pkgType === 'APT' && (searchType === 'APT' || searchType === 'APARTMENT')) ||
                                     (pkgType === 'VILLA' && (searchType === 'VILLA' || searchType === 'VILLAS')) ||
                                     (pkgType === 'FLAT' && (searchType === 'FLAT' || searchType === 'FLATS')) ||
                                     (pkgType === 'PLOT' && (searchType === 'PLOT' || searchType === 'PLOTS'));
                            })
                          : availablePackages;
                        
                        const remainingPkgs = propertyType 
                          ? availablePackages.filter(pkg => !filteredPkgs.includes(pkg))
                          : [];
                        
                        return (
                          <>
                            {filteredPkgs.length > 0 && (
                              <optgroup label={`Recommended for ${propertyType}`}>
                                {filteredPkgs.map(pkg => (
                                  <option key={pkg.packageId} value={pkg.packageId}>
                                    {pkg.packageName || pkg.packageId} - ₹{(pkg.rate || 0).toLocaleString()}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {remainingPkgs.length > 0 && (
                              <optgroup label="Other Packages">
                                {remainingPkgs.map(pkg => (
                                  <option key={pkg.packageId} value={pkg.packageId}>
                                    {pkg.packageName || pkg.packageId} - ₹{(pkg.rate || 0).toLocaleString()}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {filteredPkgs.length === 0 && remainingPkgs.length === 0 && (
                              availablePackages.map(pkg => (
                                <option key={pkg.packageId} value={pkg.packageId}>
                                  {pkg.packageName || pkg.packageId} - ₹{(pkg.rate || 0).toLocaleString()}
                                </option>
                              ))
                            )}
                          </>
                        );
                      })()}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  
                  {availablePackages.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      No packages available. Create packages in AMC Packages first.
                    </p>
                  )}
                </div>

                {/* Selected Package Details - Auto-populated */}
                {selectedPackage && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-800">{selectedPackage.packageName}</span>
                      <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded">{selectedPackage.packageId}</span>
                    </div>
                    {/* Services Table - Without individual Price column */}
                    <div className="bg-white rounded border border-blue-100 overflow-hidden">
                      {/* Table Header */}
                      <div className="grid grid-cols-10 gap-2 px-3 py-2 bg-blue-100/50 border-b border-blue-200">
                        <div className="col-span-6 text-xs font-semibold text-blue-800 uppercase">Service</div>
                        <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase">Frequency Type</div>
                        <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">Count</div>
                      </div>
                      {/* Table Body */}
                      {selectedPackage.serviceRows && selectedPackage.serviceRows.length > 0 ? (
                        selectedPackage.serviceRows.filter(s => s.service?.trim()).map((service, idx) => (
                          <div key={idx} className="grid grid-cols-10 gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <div className="col-span-6 text-sm font-medium text-gray-800">{service.service}</div>
                            <div className="col-span-2 text-sm text-gray-600">{service.frequencyType || 'Monthly'}</div>
                            <div className="col-span-2 text-sm text-gray-600 text-center">{service.frequencyCount || 1}</div>
                          </div>
                        ))
                      ) : (
                        (typeof selectedPackage.services === 'string' ? selectedPackage.services.split(',') : 
                         Array.isArray(selectedPackage.services) ? selectedPackage.services.map(s => s.name || s) : []
                        ).filter(s => s?.trim()).map((serviceName, idx) => (
                          <div key={idx} className="grid grid-cols-10 gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <div className="col-span-6 text-sm font-medium text-gray-800">{serviceName.trim()}</div>
                            <div className="col-span-2 text-sm text-gray-400">Monthly</div>
                            <div className="col-span-2 text-sm text-gray-400 text-center">1</div>
                          </div>
                        ))
                      )}
                      {/* Total Row - Only shows Total Package Price */}
                      <div className="flex justify-between px-3 py-2.5 bg-blue-50 border-t border-blue-200">
                        <span className="text-sm font-semibold text-blue-800">Total Package Price</span>
                        <span className="text-sm font-bold text-blue-700">₹{getPackagePrice().toLocaleString()}</span>
                      </div>
                    </div>
                    {selectedPackage.billingDuration && (
                      <p className="text-xs text-blue-600 mt-2">
                        Billing Cycle: {selectedPackage.billingDuration.charAt(0).toUpperCase() + selectedPackage.billingDuration.slice(1)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Additional Services Section - Blue themed, attached under AMC Package */}
              <div className="px-6 py-4 border-t border-gray-100">
                {/* Add-on Dropdown - Reduced width */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Service from Add-ons
                  </label>
                  <div className="relative max-w-sm">
                    <select
                      onChange={(e) => {
                        handleAddAddon(e.target.value);
                        e.target.value = '';
                      }}
                      className="w-full px-4 py-2.5 text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400 appearance-none bg-white"
                    >
                      <option value="">+ Select Add-on to add</option>
                      {availableAddons
                        .filter(addon => !selectedAddons.find(a => a.addonId === addon.addonId))
                        .map(addon => (
                          <option key={addon.addonId} value={addon.addonId}>
                            {addon.services?.map(s => s.name).join(', ') || addon.addonId} - ₹{(addon.totalPrice || 0).toLocaleString()}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                  </div>
                  
                  {availableAddons.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      No add-ons available. Create add-ons in the Add-ons section first.
                    </p>
                  )}
                </div>

                {/* Selected Add-ons Table - Blue theme */}
                {selectedAddons.length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-blue-100/60 border-b border-blue-200">
                      <p className="text-sm font-semibold text-blue-800">Additional Services (Add-ons)</p>
                    </div>
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-white border-b border-blue-100">
                      <div className="col-span-4 text-xs font-semibold text-blue-800 uppercase">Service</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase">Freq. Type</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">Count</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-right">Price</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">Action</div>
                    </div>
                    {/* Table Body */}
                    {selectedAddons.map((addon) => (
                      addon.services?.map((service, sIdx) => (
                        <div key={`${addon.addonId}-${sIdx}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white border-b border-gray-100 last:border-0 hover:bg-blue-50/30">
                          <div className="col-span-4 text-sm font-medium text-gray-800">{service.name}</div>
                          <div className="col-span-2 text-sm text-gray-600">{service.frequencyType || 'Monthly'}</div>
                          <div className="col-span-2 text-sm text-gray-600 text-center">{service.frequency || 1}</div>
                          <div className="col-span-2 text-sm font-medium text-blue-700 text-right">₹{(service.price || 0).toLocaleString()}</div>
                          <div className="col-span-2 text-center">
                            <button
                              onClick={() => handleRemoveAddon(addon.addonId)}
                              className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ))}
                    {/* Total Row */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-blue-50 border-t border-blue-200">
                      <div className="col-span-8 text-sm font-semibold text-blue-800">Total Add-ons</div>
                      <div className="col-span-2 text-sm font-bold text-blue-700 text-right">₹{getAddonsTotal().toLocaleString()}</div>
                      <div className="col-span-2"></div>
                    </div>
                  </div>
                )}

                {selectedAddons.length === 0 && (
                  <div className="p-3 text-center text-gray-400 border border-dashed border-blue-200 rounded-lg bg-blue-50/30">
                    <p className="text-sm">No add-ons selected. Use the dropdown above to add services.</p>
                  </div>
                )}
              </div>

              {/* Dynamic Summary Section */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Price Summary</h3>
                
                <div className="flex justify-end">
                  <div className="w-96">
                    {/* Sub Total (Package + Add-ons) */}
                    <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                      <span className="text-gray-600">Sub Total</span>
                      <span className="font-medium text-gray-800">₹{calculateSubTotal().toLocaleString()}</span>
                    </div>
                    
                    {/* Discount (Percentage) */}
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">Discount (%)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          placeholder="0"
                          className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                        />
                        <span className="text-sm text-gray-500 w-24 text-right">- ₹{getDiscountAmount().toLocaleString()}</span>
                      </div>
                    </div>
                    
                    {/* GST (Customizable) */}
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">GST (%)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={gstRate}
                          onChange={(e) => setGstRate(e.target.value)}
                          placeholder="18"
                          className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                        />
                        <span className="text-sm text-gray-500 w-24 text-right">+ ₹{calculateGST().toLocaleString()}</span>
                      </div>
                    </div>
                    
                    {/* Total */}
                    <div className="flex justify-between text-base py-3 bg-gray-700 text-white px-3 rounded-md mt-2">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold">₹{calculateTotal().toLocaleString()}</span>
                    </div>
                    
                    {/* Formula Note */}
                    <p className="text-xs text-gray-500 mt-2 text-right">
                      Formula: (Subtotal - Discount%) + GST%
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end mt-4">
                      <button
                        onClick={resetForm}
                        className="px-6 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="px-6 py-3 border-t border-gray-200 bg-white">
                <p className="text-xs text-gray-500">
                  * Currency: INR (₹) | GST: 2% applied on total | Fields marked with * are mandatory
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Direct-Based Estimate Form */}
      {estimateType === 'direct' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Customer Information Header */}
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-800">Customer Information</h3>
          </div>
          
          <div className="px-6 py-4">
            {/* Customer Information Row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={estimateForm.customerName}
                  onChange={(e) => setEstimateForm({ ...estimateForm, customerName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="Enter customer name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                <div className="flex">
                  <select
                    value={estimateForm.countryCode}
                    onChange={(e) => setEstimateForm({ ...estimateForm, countryCode: e.target.value })}
                    className="px-2 py-2 text-sm border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-200 bg-gray-50"
                  >
                    <option value="+91">+91</option>
                    <option value="+1">+1</option>
                    <option value="+44">+44</option>
                  </select>
                  <input
                    type="text"
                    value={estimateForm.phone}
                    onChange={(e) => setEstimateForm({ ...estimateForm, phone: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-l-0 border-gray-300 rounded-r-md focus:ring-2 focus:ring-blue-200"
                    placeholder="10-digit phone number"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={estimateForm.email}
                  onChange={(e) => setEstimateForm({ ...estimateForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              </div>
            </div>
          </div>

          {/* Property Details Header */}
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-800">Property Details</h3>
          </div>
          
          <div className="px-6 py-4">
            {/* Property Type Selection */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Property Type *</label>
                <select
                  value={estimateForm.propertyType}
                  onChange={(e) => setEstimateForm({ ...estimateForm, propertyType: e.target.value, blockTower: '', flatUnit: '', numberOfUnits: '' })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  required
                >
                  <option value="">Select Property Type</option>
                  <option value="GC">Gated Community</option>
                  <option value="APT">Apartment</option>
                  <option value="VILLA">Villa</option>
                  <option value="FLAT">Flat</option>
                  <option value="PLOT">Plot</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Property Name</label>
                <input
                  type="text"
                  value={estimateForm.propertyName}
                  onChange={(e) => setEstimateForm({ ...estimateForm, propertyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="Enter property name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
                <input
                  type="text"
                  value={estimateForm.zone}
                  onChange={(e) => setEstimateForm({ ...estimateForm, zone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="Enter zone"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <input
                  type="text"
                  value={estimateForm.city}
                  onChange={(e) => setEstimateForm({ ...estimateForm, city: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="Enter city"
                />
              </div>
            </div>

            {/* Dynamic Fields Based on Property Type */}
            {estimateForm.propertyType === 'GC' && (
              <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Blocks *</label>
                  <input
                    type="number"
                    min="1"
                    value={estimateForm.blockTower}
                    onChange={(e) => setEstimateForm({ ...estimateForm, blockTower: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Enter number of blocks"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Block Number</label>
                  <select
                    value={estimateForm.blockNumber || ''}
                    onChange={(e) => setEstimateForm({ ...estimateForm, blockNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  >
                    <option value="">Select Block</option>
                    <option value="N/A">N/A</option>
                    <option value="A">Block A</option>
                    <option value="B">Block B</option>
                    <option value="C">Block C</option>
                    <option value="D">Block D</option>
                    <option value="E">Block E</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Block Name</label>
                  <input
                    type="text"
                    value={estimateForm.areaName}
                    onChange={(e) => setEstimateForm({ ...estimateForm, areaName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="e.g., Tower 1, Phase 2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Units *</label>
                  <input
                    type="number"
                    min="1"
                    value={estimateForm.numberOfUnits}
                    onChange={(e) => setEstimateForm({ ...estimateForm, numberOfUnits: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Total units"
                  />
                </div>
              </div>
            )}

            {(estimateForm.propertyType === 'APT' || estimateForm.propertyType === 'FLAT') && (
              <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tower/Building Name</label>
                  <input
                    type="text"
                    value={estimateForm.blockTower}
                    onChange={(e) => setEstimateForm({ ...estimateForm, blockTower: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Tower/Building name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Block Number</label>
                  <select
                    value={estimateForm.blockNumber || ''}
                    onChange={(e) => setEstimateForm({ ...estimateForm, blockNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  >
                    <option value="">Select Block</option>
                    <option value="N/A">N/A (Not Applicable)</option>
                    <option value="A">Block A</option>
                    <option value="B">Block B</option>
                    <option value="C">Block C</option>
                    <option value="D">Block D</option>
                    <option value="E">Block E</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Flat/Unit Number</label>
                  <input
                    type="text"
                    value={estimateForm.flatUnit}
                    onChange={(e) => setEstimateForm({ ...estimateForm, flatUnit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="e.g., 101, 202"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Units *</label>
                  <input
                    type="number"
                    min="1"
                    value={estimateForm.numberOfUnits}
                    onChange={(e) => setEstimateForm({ ...estimateForm, numberOfUnits: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Total units"
                  />
                </div>
              </div>
            )}

            {estimateForm.propertyType === 'VILLA' && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Villa Number *</label>
                  <input
                    type="text"
                    value={estimateForm.flatUnit}
                    onChange={(e) => setEstimateForm({ ...estimateForm, flatUnit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Enter villa number"
                  />
                </div>
              </div>
            )}

            {estimateForm.propertyType === 'PLOT' && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-rose-50 rounded-lg border border-rose-100">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Plot Number *</label>
                  <input
                    type="text"
                    value={estimateForm.flatUnit}
                    onChange={(e) => setEstimateForm({ ...estimateForm, flatUnit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Enter plot number"
                  />
                </div>
              </div>
            )}

            {estimateForm.propertyType === 'FLAT' && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Flat Number *</label>
                  <input
                    type="text"
                    value={estimateForm.flatUnit}
                    onChange={(e) => setEstimateForm({ ...estimateForm, flatUnit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    placeholder="Enter flat number"
                  />
                </div>
              </div>
            )}

            {/* Address Row */}
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input
                  type="text"
                  value={estimateForm.address}
                  onChange={(e) => setEstimateForm({ ...estimateForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="Enter full address"
                />
              </div>
            </div>
          </div>

          {/* AMC Services Section */}
          <>
            <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">AMC Services</h3>
            </div>
            
            <div className="px-6 py-4">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 mb-2 px-2 py-2 bg-gray-100 rounded-t-md">
                <div className="col-span-1 text-xs font-semibold text-gray-700">#</div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Subcategory
                </div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Service <span className="text-red-500">*</span>
                </div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Frequency Type <span className="text-red-500">*</span>
                </div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Frequency Count <span className="text-red-500">*</span>
                </div>
                <div className="col-span-1 text-xs font-semibold text-gray-700">
                  Price (₹) <span className="text-red-500">*</span>
                </div>
                <div className="col-span-1 text-xs font-semibold text-gray-700">Total</div>
                <div className="col-span-1 text-xs font-semibold text-gray-700 text-center">Action</div>
              </div>

              {/* Service Rows */}
              <div className="border border-gray-200 rounded-b-md divide-y divide-gray-100">
                {estimateForm.services.map((service, index) => (
                  <div key={`new-${index}`} className="grid grid-cols-12 gap-2 items-center p-3 bg-white hover:bg-gray-50">
                    <div className="col-span-1 text-sm text-gray-600 font-medium pl-2">
                      {index + 1}
                    </div>
                    {/* Subcategory Dropdown with + Add */}
                    <div className="col-span-2">
                      <select
                        value={service.subcategory || ''}
                        onChange={(e) => {
                          if (e.target.value === '__add_subcategory__') {
                            const newSubcat = prompt('Enter new subcategory:');
                            if (newSubcat && newSubcat.trim()) {
                              setSubcategories(prev => [...prev, newSubcat.trim()]);
                              updateServiceRow(index, 'subcategory', newSubcat.trim());
                            }
                          } else {
                            updateServiceRow(index, 'subcategory', e.target.value);
                          }
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                      >
                        <option value="">Select</option>
                        {subcategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__add_subcategory__" className="text-blue-600 font-medium">+ Add</option>
                      </select>
                    </div>
                    {/* Service Dropdown */}
                    <div className="col-span-2">
                      <select
                        value={service.name}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            const newService = prompt('Enter new service name:');
                            if (newService) {
                              handleAddNewService(newService);
                              updateServiceRow(index, 'name', newService);
                            }
                          } else {
                            updateServiceRow(index, 'name', e.target.value);
                          }
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                      >
                        <option value="">Select Service</option>
                        {availableServices.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__add_new__">+ Add New Service</option>
                      </select>
                    </div>
                    {/* Frequency Type - First to trigger auto-calculation */}
                    <div className="col-span-2">
                      <select
                        value={service.frequencyType}
                        onChange={(e) => updateServiceRow(index, 'frequencyType', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                      >
                        {FREQUENCY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    {/* Frequency Count - Auto-set based on type, manual only for 'Custom Months' */}
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={service.frequency}
                        onChange={(e) => updateServiceRow(index, 'frequency', parseInt(e.target.value) || 1)}
                        placeholder={service.frequencyType === 'Custom Months' ? 'Enter months' : ''}
                        readOnly={service.frequencyType !== 'Custom Months'}
                        title={service.frequencyType === 'Custom Months' ? 'Enter the number of months manually' : `Auto-set to ${FREQUENCY_COUNT_MAP[service.frequencyType] || 1}`}
                        className={`w-full px-2 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-blue-200 text-center ${
                          service.frequencyType === 'Custom Months' 
                            ? 'border-blue-300 bg-blue-50' 
                            : 'border-gray-300 bg-gray-100 cursor-not-allowed'
                        }`}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min="0"
                        value={service.price}
                        onChange={(e) => updateServiceRow(index, 'price', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 text-sm text-gray-800 font-medium">
                      {calculateServiceTotal(service).toLocaleString()}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeServiceRow(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove service"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Empty state */}
                {estimateForm.services.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    <p className="text-sm">No services added. Click "Add Service" to add a new service.</p>
                  </div>
                )}
              </div>

              {/* Add Service Button */}
              <button
                type="button"
                onClick={addServiceRow}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>

            {/* Summary and Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end">
                <div className="w-80">
                  {/* Calculation Section - GST calculated in backend, not shown */}
                  <div className="text-right space-y-2 mb-4">
                    <div className="flex justify-between text-sm bg-blue-100 px-3 py-2 rounded-md">
                      <span className="font-semibold text-blue-700">Total Price (₹)</span>
                      <span className="font-bold text-blue-700">{calculateSubTotal().toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons - Only Save and Cancel */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={resetForm}
                      className="px-6 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-6 py-2.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 transition-colors"
                    >
                      Save to Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="px-6 py-3 border-t border-gray-200 bg-white">
              <p className="text-xs text-gray-500">
                * Currency: INR (₹) | Price Input: Per selected frequency | Fields marked with * are mandatory | Direct estimates are saved to Archive section
              </p>
            </div>
          </>
        </div>
      )}

      {/* Email Confirmation Modal */}
      {showEmailConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Estimate Created Successfully!</h3>
              <p className="text-sm text-gray-500 mt-2">
                Would you like to send this estimate to the registered customer email?
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg mb-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {lastCreatedEstimate?.customerEmail || selectedProperty?.associationContacts?.[0]?.email || 'No email available'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {lastCreatedEstimate?.clientName || lastCreatedEstimate?.customerName || selectedProperty?.communityName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSkipEmail}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Skip
              </button>
              <button
                onClick={handleSendEmail}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateEstimate;
