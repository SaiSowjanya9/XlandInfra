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
  getAMCPackages, getAddons, seedTestData
} from '../../utils/estimateStore';
import { getProperties } from '../../utils/propertyStore';

const PROPERTY_ICONS = {
  APT: Home,
  Flats: LayoutGrid,
  GC: Layers,
  Villas: TreePine,
  Plots: Map,
  Commercial: Briefcase
};

const GST_RATE = 0.02; // 2% GST - calculated in backend, not shown in UI

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
  
  // New state for AMC Package selection and Add-ons
  const [availablePackages, setAvailablePackages] = useState([]); // AMC Packages from manager
  const [availableAddons, setAvailableAddons] = useState([]); // Add-ons from Add-ons manager
  const [selectedPackage, setSelectedPackage] = useState(null); // Selected AMC Package
  const [selectedAddons, setSelectedAddons] = useState([]); // Selected add-ons
  const [discount, setDiscount] = useState(''); // Discount amount
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
    
    // Extract block/tower info
    let blockTower = '';
    if (property.blockInfo) {
      blockTower = property.blockInfo;
    } else if (property.blockNames && Object.keys(property.blockNames).length > 0) {
      blockTower = Object.values(property.blockNames).join(', ');
    } else if (property.numberOfBlocks) {
      blockTower = `${property.numberOfBlocks} Block(s)`;
    }
    
    // Extract flat/unit info
    let flatUnit = '';
    if (property.villaPlotNumber) {
      flatUnit = property.villaPlotNumber;
    } else if (property.aptSuiteUnit) {
      flatUnit = property.aptSuiteUnit;
    } else if (property.numberOfUnits) {
      flatUnit = `${property.numberOfUnits} Units`;
    } else if (property.unitsPerBlock) {
      const totalUnits = Object.values(property.unitsPerBlock).reduce((sum, u) => sum + (parseInt(u) || 0), 0);
      flatUnit = totalUnits > 0 ? `${totalUnits} Units` : '';
    }
    
    // Get customer details from contacts (backend returns 'contacts', not 'associationContacts')
    const primaryContact = property.contacts?.[0] || {};
    
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
      numberOfUnits: property.numberOfUnits || property.unitsPerBlock ? 
        (typeof property.numberOfUnits === 'number' ? property.numberOfUnits : 
          Object.values(property.unitsPerBlock || {}).reduce((sum, u) => sum + (parseInt(u) || 0), 0)) : '',
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

  const calculateGST = () => {
    return Math.round(calculateSubTotal() * GST_RATE);
  };

  // Get discount amount
  const getDiscountAmount = () => {
    return parseFloat(discount) || 0;
  };

  // Final total: (Package + Add-ons) + GST - Discount
  const calculateTotal = () => {
    return calculateSubTotal() + calculateGST() - getDiscountAmount();
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
    newServices[index] = { ...newServices[index], [field]: value };
    setEstimateForm({ ...estimateForm, services: newServices });
  };

  return (
    <div className="space-y-6">
      {/* Estimate Type Selection */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Estimate Type</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { setEstimateType('property'); resetForm(); setEstimateType('property'); }}
            className={`p-6 rounded-xl border-2 transition-all ${
              estimateType === 'property'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <Building2 className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'property' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <p className="font-medium text-gray-800">Property-Based Estimate</p>
            <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
          </button>
          <button
            onClick={() => { setEstimateType('direct'); resetForm(); setEstimateType('direct'); }}
            className={`p-6 rounded-xl border-2 transition-all ${
              estimateType === 'direct'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <User className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'direct' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <p className="font-medium text-gray-800">Direct-Based Estimate</p>
            <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
          </button>
        </div>
      </div>

      {/* Property-based Estimate Form */}
      {estimateType === 'property' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Estimate Details Header */}
          <div className="px-6 py-3 bg-blue-600">
            <h3 className="text-base font-semibold text-white">Estimate Details</h3>
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
                  onFocus={() => setShowPropertySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowPropertySuggestions(false), 200)}
                  placeholder="Type Property ID (e.g., GC-2024-001)"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
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
              <div className="px-6 py-3 bg-blue-600">
                <h3 className="text-base font-semibold text-white">AMC Package</h3>
              </div>
              
              <div className="px-6 py-4">
                {/* AMC Package Dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select AMC Package <span className="text-red-500">*</span>
                  </label>
                  <div className="relative max-w-md">
                    <select
                      value={selectedPackage?.packageId || ''}
                      onChange={(e) => handlePackageSelect(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                    >
                      <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                      {availablePackages.map(pkg => (
                        <option key={pkg.packageId} value={pkg.packageId}>
                          {pkg.packageName || pkg.packageId} - ₹{(pkg.rate || 0).toLocaleString()}
                        </option>
                      ))}
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-800">{selectedPackage.packageName}</span>
                        <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded">{selectedPackage.packageId}</span>
                      </div>
                      <span className="text-lg font-bold text-blue-700">₹{getPackagePrice().toLocaleString()}</span>
                    </div>
                    {selectedPackage.services && (
                      <div className="text-sm text-blue-700 bg-white p-3 rounded border border-blue-100">
                        <span className="font-medium text-gray-600">Services Included: </span>
                        <span className="text-gray-800">
                          {typeof selectedPackage.services === 'string' 
                            ? selectedPackage.services 
                            : Array.isArray(selectedPackage.services) 
                              ? selectedPackage.services.map(s => s.name || s).join(', ')
                              : ''}
                        </span>
                      </div>
                    )}
                    {selectedPackage.billingDuration && (
                      <p className="text-xs text-blue-600 mt-2">
                        Billing: {selectedPackage.billingDuration.charAt(0).toUpperCase() + selectedPackage.billingDuration.slice(1)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Add Services (Add-ons) Section */}
              <div className="px-6 py-3 bg-green-600">
                <h3 className="text-base font-semibold text-white">Add Services (from Add-ons)</h3>
              </div>
              
              <div className="px-6 py-4">
                {/* Add-on Dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add Service from Add-ons
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1 max-w-md">
                      <select
                        onChange={(e) => {
                          handleAddAddon(e.target.value);
                          e.target.value = '';
                        }}
                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-200 focus:border-green-500 appearance-none bg-white"
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
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  
                  {availableAddons.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      No add-ons available. Create add-ons in the Add-ons section first.
                    </p>
                  )}
                </div>

                {/* Selected Add-ons List */}
                {selectedAddons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 mb-2">Selected Add-ons:</p>
                    {selectedAddons.map((addon) => (
                      <div key={addon.addonId} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Plus className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {addon.services?.map(s => s.name).join(', ') || addon.addonId}
                            </p>
                            <p className="text-xs text-gray-500">
                              {addon.services?.map(s => `${s.frequencyType}`).join(', ')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-green-700">₹{(addon.totalPrice || 0).toLocaleString()}</span>
                          <button
                            onClick={() => handleRemoveAddon(addon.addonId)}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                            title="Remove Add-on"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedAddons.length === 0 && (
                  <div className="p-4 text-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                    <p className="text-sm">No add-ons selected. Use the dropdown above to add services.</p>
                  </div>
                )}
              </div>

              {/* Dynamic Summary Section */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Price Summary</h3>
                
                <div className="flex justify-end">
                  <div className="w-96">
                    {/* Package Price */}
                    <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                      <span className="text-gray-600">
                        AMC Package: <span className="font-medium">{selectedPackage?.packageName || 'Not selected'}</span>
                      </span>
                      <span className="font-medium text-gray-800">₹{getPackagePrice().toLocaleString()}</span>
                    </div>
                    
                    {/* Add-ons Total */}
                    <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                      <span className="text-gray-600">
                        Add-ons ({selectedAddons.length})
                      </span>
                      <span className="font-medium text-gray-800">₹{getAddonsTotal().toLocaleString()}</span>
                    </div>
                    
                    {/* Subtotal */}
                    <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                      <span className="text-gray-600">Sub Total</span>
                      <span className="font-medium text-gray-800">₹{calculateSubTotal().toLocaleString()}</span>
                    </div>
                    
                    {/* GST */}
                    <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                      <span className="text-gray-600">GST (2%)</span>
                      <span className="font-medium text-gray-800">₹{calculateGST().toLocaleString()}</span>
                    </div>
                    
                    {/* Discount */}
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">Discount (₹)</span>
                      <input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        placeholder="0"
                        className="w-28 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    
                    {/* Total */}
                    <div className="flex justify-between text-base py-3 bg-blue-600 text-white px-3 rounded-md mt-2">
                      <span className="font-semibold">Total Amount</span>
                      <span className="font-bold">₹{calculateTotal().toLocaleString()}</span>
                    </div>
                    
                    {/* Formula Note */}
                    <p className="text-xs text-gray-500 mt-2 text-right">
                      Formula: (Package + Add-ons) + GST - Discount
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
                        className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
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
          <div className="px-6 py-3 bg-blue-600">
            <h3 className="text-base font-semibold text-white">Customer Information</h3>
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
          <div className="px-6 py-3 bg-indigo-600">
            <h3 className="text-base font-semibold text-white">Property Details</h3>
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
              <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
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
            <div className="px-6 py-3 bg-blue-600">
              <h3 className="text-base font-semibold text-white">AMC Services</h3>
            </div>
            
            <div className="px-6 py-4">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 mb-2 px-2 py-2 bg-gray-100 rounded-t-md">
                <div className="col-span-1 text-xs font-semibold text-gray-700">#</div>
                <div className="col-span-3 text-xs font-semibold text-gray-700">
                  Service <span className="text-red-500">*</span>
                </div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Frequency (Visits) <span className="text-red-500">*</span>
                </div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Frequency Type <span className="text-red-500">*</span>
                </div>
                <div className="col-span-2 text-xs font-semibold text-gray-700">
                  Price (₹) <span className="text-red-500">*</span>
                </div>
                <div className="col-span-1 text-xs font-semibold text-gray-700">Total (₹)</div>
                <div className="col-span-1 text-xs font-semibold text-gray-700 text-center">Action</div>
              </div>

              {/* Service Rows */}
              <div className="border border-gray-200 rounded-b-md divide-y divide-gray-100">
                {estimateForm.services.map((service, index) => (
                  <div key={`new-${index}`} className="grid grid-cols-12 gap-2 items-center p-3 bg-white hover:bg-gray-50">
                    <div className="col-span-1 text-sm text-gray-600 font-medium pl-2">
                      {index + 1}
                    </div>
                    <div className="col-span-3">
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
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                      >
                        <option value="">Select Service</option>
                        {availableServices.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__add_new__">+ Add New Service</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={service.frequency}
                          onChange={(e) => updateServiceRow(index, 'frequency', parseInt(e.target.value) || 1)}
                          className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 text-center"
                        />
                        <span className="text-xs text-gray-500">(Visits per Drop Down)</span>
                      </div>
                    </div>
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
                    <div className="col-span-2">
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
                      className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
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
