import React, { useState, useEffect } from 'react';
import { 
  Building2, User, Phone, Mail, Search, FileText, 
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase,
  Package, Send, Plus, Trash2, Lock, ChevronDown, FolderOpen, ExternalLink
} from 'lucide-react';
import { useFP } from '../../contexts/FPContext';
import PhoneInput from '../common/PhoneInput';
import { 
  createEstimate, calculateEstimateTotal, getServices, PROPERTY_TYPES,
  getAMCPackageByPropertyId, addService, FREQUENCY_TYPES, FREQUENCY_COUNT_MAP,
  getAMCPackages, getAddons, fetchAMCPackages, fetchAddons, seedTestData, getAMCPackageByPropertyType,
  migratePackagesToServiceRows, getAMCPackagesByPropertyType
} from '../../utils/estimateStore';

import { getProperties, getPropertyById, extractBlockNames, extractTotalUnits, extractUnitNumber } from '../../utils/propertyStore';
import { getPackageId, getPackageName, getPackagePrice as getNormalizedPackagePrice, getPackagePropertyType } from '../../utils/estimatePackageUtils';

// Subcategory options for services
const SUBCATEGORIES = ['Maintenance', 'Cleaning', 'Security', 'Landscaping', 'Utilities', 'Other'];

const PROPERTY_ICONS = {
  APT: Home,
  Flats: LayoutGrid,
  GC: Layers,
  Villas: TreePine,
  Plots: Map,
  Commercial: Briefcase
};

const API_BASE = import.meta.env.VITE_API_URL || '';

const CreateEstimate = ({ admin, onSuccess, showToast }) => {
  // Check if user is Operations Manager (restricted access - view only)
  const isOpsManager = admin?.role === 'operations_manager';
  
  // FP Context for Admin mode - to show FP Portal Links
  const { selectedFp } = useFP();
  const [fpPortalLinks, setFpPortalLinks] = useState([]);
  const [allFpPortalLinks, setAllFpPortalLinks] = useState([]); // Aggregated from all FPs
  const token = sessionStorage.getItem('pm_auth_token');
  
  // Fetch FP Portal Links based on selection
  useEffect(() => {
    const fetchFpPortalLinks = async () => {
      if (!admin) {
        setFpPortalLinks([]);
        setAllFpPortalLinks([]);
        return;
      }
      
      try {
        if (selectedFp?.id === 'all') {
          // Fetch aggregated links from all FPs
          const res = await fetch(`${API_BASE}/api/admin/all-fp-portal-links`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setAllFpPortalLinks(data.data);
          } else {
            setAllFpPortalLinks([]);
          }
          setFpPortalLinks([]);
        } else if (selectedFp?.id) {
          // Fetch links for specific FP
          const res = await fetch(`${API_BASE}/api/admin/fp-view/${selectedFp.id}/portal-links`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setFpPortalLinks(data.data);
          } else {
            setFpPortalLinks([]);
          }
          setAllFpPortalLinks([]);
        } else {
          setFpPortalLinks([]);
          setAllFpPortalLinks([]);
        }
      } catch (e) {
        console.error('Failed to fetch FP portal links:', e);
        setFpPortalLinks([]);
        setAllFpPortalLinks([]);
      }
    };
    fetchFpPortalLinks();
  }, [admin, selectedFp, token]);
  
  // Show view-only message for Ops Manager (with FP Shared Resources)
  if (isOpsManager) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* FP Shared Resources - Aggregated from all FPs */}
        {allFpPortalLinks.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">All FP Shared Resources</h3>
                <p className="text-xs text-gray-500">Aggregated quick access links from all Franchise Partners</p>
              </div>
            </div>
            <div className="space-y-4">
              {allFpPortalLinks.map((fp) => (
                <div key={fp.fpId} className="border-t border-blue-100 pt-3 first:border-0 first:pt-0">
                  <p className="text-sm font-semibold text-indigo-700 mb-2">{fp.fpCode} - {fp.fpCompany}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {fp.links.map((link) => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all group">
                        <ExternalLink className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-gray-700 truncate">{link.heading}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* FP Shared Resources - Single FP */}
        {fpPortalLinks.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">FP Shared Resources</h3>
                <p className="text-xs text-gray-500">Quick access links from {selectedFp?.fpId || 'Franchise Partner'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fpPortalLinks.map((link) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all group">
                  <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <ExternalLink className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{link.heading}</p>
                    <p className="text-xs text-gray-400 truncate">{link.url}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
        
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
          <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-amber-800 mb-2">View Only Access</h2>
          <p className="text-amber-600 mb-4">Operations Manager cannot create new estimates. You can view existing estimates in All Estimates.</p>
        </div>
      </div>
    );
  }
  
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
  const [showCustomAddon, setShowCustomAddon] = useState(false); // Show custom addon form
  const [customAddonForm, setCustomAddonForm] = useState({
    serviceName: '',
    frequencyType: 'Monthly',
    frequencyCount: 12,
    price: '',
    description: ''
  });
  const [discount, setDiscount] = useState(''); // Discount percentage
  const [gstRate, setGstRate] = useState(''); // GST percentage - user enters value
  const [subcategories, setSubcategories] = useState(SUBCATEGORIES); // Dynamic subcategories
  const [directSelectedPackage, setDirectSelectedPackage] = useState(null); // Package for Direct estimate
  const [directSelectedAddons, setDirectSelectedAddons] = useState([]); // Add-ons for Direct estimate
  const [directShowCustomAddon, setDirectShowCustomAddon] = useState(false);
  const [directCustomAddonForm, setDirectCustomAddonForm] = useState({
    serviceName: '',
    frequencyType: 'Monthly',
    frequencyCount: 12,
    price: '',
    description: ''
  });
  const [directDiscount, setDirectDiscount] = useState('');
  const [directGstRate, setDirectGstRate] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
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
    notes: '',
    noOfVisits: '',
    description: '',
    // Blocks & Units for GC/Apartment
    numberOfBlocks: 1,
    unitsPerBlock: {},
    totalUnits: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Seed test data if none exists
    // Migrate existing packages to include serviceRows with frequency data
    migratePackagesToServiceRows();
    const props = await getProperties();
    setProperties(props);
    setAvailableServices(getServices());
    // Fetch packages and addons from API
    const [packages, addons] = await Promise.all([
      fetchAMCPackages(),
      fetchAddons()
    ]);
    setAvailablePackages(packages);
    setAvailableAddons(addons);
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
    
    // Use helper functions for consistent extraction across the app
    const blockTower = extractBlockNames(property);
    const numberOfUnits = extractTotalUnits(property);
    const flatUnit = extractUnitNumber(property);
    
    // Debug log for property data
    console.log('[PropertySelect] Property ID:', property.propertyId);
    console.log('[PropertySelect] Entry Type:', property.entryType);
    console.log('[PropertySelect] Block Names (raw):', property.blockNames);
    console.log('[PropertySelect] Block Info (raw):', property.blockInfo);
    console.log('[PropertySelect] Extracted Block Tower:', blockTower);
    console.log('[PropertySelect] Extracted Units:', numberOfUnits);
    
    // Get customer details from contacts (backend returns 'contacts', not 'associationContacts')
    const primaryContact = property.contacts?.[0] || {};
    
    // Auto-select AMC package based on property type
    const propertyType = property.property_type || property.entryType || property.propertyType;
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
    
    // Show message if block data is missing
    if (!blockTower && ['GC', 'APT'].includes(property.entryType?.toUpperCase())) {
      showToast?.('Block information not available for this property', 'info');
    }
  };

  const calculateServiceTotal = (service) => {
    const price = parseFloat(service.price) || 0;
    const frequency = parseInt(service.frequency) || 1;
    return price * frequency;
  };

  // Get package base price
  const getPackagePrice = () => {
    return getNormalizedPackagePrice(selectedPackage);
  };

  // Get total add-ons price
  const getAddonsTotal = () => {
    const total = selectedAddons.reduce((sum, addon) => {
      const addonTotal = addon.services?.reduce((s, service) => {
        const price = parseFloat(service.price) || 0;
        const frequency = parseInt(service.frequency) || 1;
        return s + (price * frequency);
      }, 0) || addon.totalPrice || 0;
      return sum + addonTotal;
    }, 0);
    return Math.round(total * 100) / 100; // Fix floating-point precision
  };

  const calculateSubTotal = () => {
    // For property-based: Package + Add-ons
    if (estimateType === 'property' && selectedPackage) {
      return Math.round(getPackagePrice() + getAddonsTotal());
    }
    // For direct or when no package: Individual services
    const lockedTotal = lockedServices.reduce((sum, service) => {
      return sum + calculateServiceTotal(service);
    }, 0);
    const newTotal = estimateForm.services.reduce((sum, service) => {
      return sum + calculateServiceTotal(service);
    }, 0);
    return Math.round(lockedTotal + newTotal);
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
    const pkg = availablePackages.find(p => getPackageId(p) === packageId);
    setSelectedPackage(pkg || null);
  };

  // Handle adding an add-on from dropdown
  const handleAddAddon = (addonId) => {
    if (!addonId) return;
    if (addonId === 'OTHER') {
      setShowCustomAddon(true);
      return;
    }
    const addon = availableAddons.find(a => a.addonId === addonId);
    if (addon) {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // Handle custom addon form changes
  const handleCustomAddonChange = (field, value) => {
    if (field === 'frequencyType') {
      const autoCount = FREQUENCY_COUNT_MAP[value];
      setCustomAddonForm(prev => ({
        ...prev,
        frequencyType: value,
        frequencyCount: autoCount !== null ? autoCount : prev.frequencyCount
      }));
    } else {
      setCustomAddonForm(prev => ({ ...prev, [field]: value }));
    }
  };

  // Handle adding custom addon
  const handleAddCustomAddon = () => {
    if (!customAddonForm.serviceName.trim()) {
      showToast?.('Please enter a service name', 'error');
      return;
    }
    if (!customAddonForm.price || parseFloat(customAddonForm.price) <= 0) {
      showToast?.('Please enter a valid price', 'error');
      return;
    }

    const customAddon = {
      addonId: `CUSTOM-${Date.now()}`,
      isCustom: true,
      services: [{
        name: customAddonForm.serviceName.trim(),
        frequencyType: customAddonForm.frequencyType,
        frequency: parseInt(customAddonForm.frequencyCount) || 1,
        price: parseFloat(customAddonForm.price),
        description: customAddonForm.description?.trim() || ''
      }],
      totalPrice: parseFloat(customAddonForm.price),
      description: customAddonForm.description?.trim() || ''
    };

    setSelectedAddons([...selectedAddons, customAddon]);
    setShowCustomAddon(false);
    setCustomAddonForm({
      serviceName: '',
      frequencyType: 'Monthly',
      frequencyCount: 12,
      price: '',
      description: ''
    });
  };

  // Cancel custom addon
  const handleCancelCustomAddon = () => {
    setShowCustomAddon(false);
    setCustomAddonForm({
      serviceName: '',
      frequencyType: 'Monthly',
      frequencyCount: 12,
      price: '',
      description: ''
    });
  };

  // Handle removing an add-on
  const handleRemoveAddon = (addonId) => {
    setSelectedAddons(selectedAddons.filter(a => a.addonId !== addonId));
  };

  // Phone validation - 10 digits only
  const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phone) return '';
    if (!phoneRegex.test(phone)) {
      return 'Phone must be exactly 10 digits';
    }
    return '';
  };

  // Email validation
  const validateEmail = (email) => {
    if (!email) return '';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  // Handle phone change with validation
  const handlePhoneChange = (value) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 10);
    setEstimateForm({ ...estimateForm, phone: numericValue });
    setPhoneError(validatePhone(numericValue));
  };

  // Handle email change with validation
  const handleEmailChange = (value) => {
    setEstimateForm({ ...estimateForm, email: value });
    setEmailError(validateEmail(value));
  };

  // Direct Estimate - Package selection handler
  const handleDirectPackageSelect = (packageId) => {
    if (!packageId) {
      setDirectSelectedPackage(null);
      return;
    }
    const pkg = availablePackages.find(p => getPackageId(p) === packageId);
    setDirectSelectedPackage(pkg || null);
  };

  // Direct Estimate - Get package price
  const getDirectPackagePrice = () => {
    if (!directSelectedPackage) return 0;
    return getNormalizedPackagePrice(directSelectedPackage);
  };

  // Direct Estimate - Get add-ons total
  const getDirectAddonsTotal = () => {
    const total = directSelectedAddons.reduce((sum, addon) => {
      const addonTotal = addon.services?.reduce((s, service) => {
        const price = parseFloat(service.price) || 0;
        const frequency = parseInt(service.frequency) || 1;
        return s + (price * frequency);
      }, 0) || addon.totalPrice || 0;
      return sum + addonTotal;
    }, 0);
    return Math.round(total * 100) / 100; // Fix floating-point precision
  };

  // Direct Estimate - Calculate subtotal
  const calculateDirectSubTotal = () => {
    return Math.round(getDirectPackagePrice() + getDirectAddonsTotal());
  };

  // Direct Estimate - Get discount amount
  const getDirectDiscountAmount = () => {
    const subtotal = calculateDirectSubTotal();
    const discountPercent = parseFloat(directDiscount) || 0;
    return Math.round(subtotal * (discountPercent / 100));
  };

  // Direct Estimate - Calculate GST
  const calculateDirectGST = () => {
    const subtotal = calculateDirectSubTotal();
    const discountAmount = getDirectDiscountAmount();
    const gst = parseFloat(directGstRate) || 0;
    return Math.round((subtotal - discountAmount) * (gst / 100));
  };

  // Direct Estimate - Calculate total
  const calculateDirectTotal = () => {
    return calculateDirectSubTotal() - getDirectDiscountAmount() + calculateDirectGST();
  };

  // Direct Estimate - Add addon
  const handleDirectAddAddon = (addonId) => {
    if (!addonId) return;
    if (addonId === 'OTHER') {
      setDirectShowCustomAddon(true);
      return;
    }
    const addon = availableAddons.find(a => a.addonId === addonId);
    if (addon) {
      setDirectSelectedAddons([...directSelectedAddons, addon]);
    }
  };

  // Direct Estimate - Remove addon
  const handleDirectRemoveAddon = (addonId) => {
    setDirectSelectedAddons(directSelectedAddons.filter(a => a.addonId !== addonId));
  };

  // Direct Estimate - Custom addon handlers
  const handleDirectCustomAddonChange = (field, value) => {
    if (field === 'frequencyType') {
      const autoCount = FREQUENCY_COUNT_MAP[value];
      setDirectCustomAddonForm(prev => ({
        ...prev,
        frequencyType: value,
        frequencyCount: autoCount !== null ? autoCount : prev.frequencyCount
      }));
    } else {
      setDirectCustomAddonForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleDirectAddCustomAddon = () => {
    if (!directCustomAddonForm.serviceName.trim()) {
      showToast?.('Please enter a service name', 'error');
      return;
    }
    if (!directCustomAddonForm.price || parseFloat(directCustomAddonForm.price) <= 0) {
      showToast?.('Please enter a valid price', 'error');
      return;
    }

    const customAddon = {
      addonId: `CUSTOM-${Date.now()}`,
      isCustom: true,
      services: [{
        name: directCustomAddonForm.serviceName.trim(),
        frequencyType: directCustomAddonForm.frequencyType,
        frequency: parseInt(directCustomAddonForm.frequencyCount) || 1,
        price: parseFloat(directCustomAddonForm.price),
        description: directCustomAddonForm.description?.trim() || ''
      }],
      totalPrice: parseFloat(directCustomAddonForm.price),
      description: directCustomAddonForm.description?.trim() || ''
    };

    setDirectSelectedAddons([...directSelectedAddons, customAddon]);
    setDirectShowCustomAddon(false);
    setDirectCustomAddonForm({
      serviceName: '',
      frequencyType: 'Monthly',
      frequencyCount: 12,
      price: '',
      description: ''
    });
  };

  const handleDirectCancelCustomAddon = () => {
    setDirectShowCustomAddon(false);
    setDirectCustomAddonForm({
      serviceName: '',
      frequencyType: 'Monthly',
      frequencyCount: 12,
      price: '',
      description: ''
    });
  };

  const handleSave = async () => {
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
    if (estimateType === 'direct' && estimateForm.phone.length !== 10) {
      showToast?.('Phone must be exactly 10 digits', 'error');
      return;
    }
    if (estimateType === 'direct' && estimateForm.email && emailError) {
      showToast?.('Please enter a valid email address', 'error');
      return;
    }
    if (estimateType === 'direct' && !directSelectedPackage) {
      showToast?.('Please select an AMC Package', 'error');
      return;
    }

    // For property-based: use package + addons
    // For direct: use package + addons (same as property-based)
    let allServices = [];
    if (estimateType === 'property' && selectedPackage) {
      // Package services (auto-populated from package)
      allServices = [{
        name: selectedPackage.packageName,
        type: 'package',
        services: selectedPackage.services,
        price: selectedPackage.rate
      }];
    } else if (estimateType === 'direct' && directSelectedPackage) {
      // Direct estimate with package
      allServices = [{
        name: directSelectedPackage.packageName,
        type: 'package',
        services: directSelectedPackage.services,
        price: directSelectedPackage.rate
      }];
    } else {
      // Fallback - should not reach here with new validation
      showToast?.('Please select an AMC Package', 'error');
      return;
    }

    const estimateData = {
      estimateType: estimateType === 'property' ? 'property-based' : 'direct',
      services: allServices,
      notes: estimateForm.notes,
      description: estimateForm.description || estimateForm.notes,
      noOfVisits: estimateForm.noOfVisits,
      subTotal: estimateType === 'direct' ? calculateDirectSubTotal() : calculateSubTotal(),
      gst: estimateType === 'direct' ? calculateDirectGST() : calculateGST(),
      discount: estimateType === 'direct' ? getDirectDiscountAmount() : getDiscountAmount(),
      totalPrice: estimateType === 'direct' ? calculateDirectTotal() : calculateTotal(),
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
      estimateData.zone = selectedProperty.zone || selectedProperty.areaName;
      estimateData.division = selectedProperty.division;
      estimateData.address = selectedProperty.address || `${selectedProperty.city || ''} ${selectedProperty.state || ''}`.trim();
      
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
      estimateData.customerPhone = `${estimateForm.countryCode} ${estimateForm.phone}`;
      estimateData.countryCode = estimateForm.countryCode;
      estimateData.email = estimateForm.email;
      estimateData.customerEmail = estimateForm.email;
      estimateData.propertyName = estimateForm.propertyName;
      estimateData.propertyType = estimateForm.propertyType;
      estimateData.entryType = estimateForm.propertyType;
      estimateData.zone = estimateForm.zone;
      estimateData.areaName = estimateForm.areaName;
      estimateData.division = estimateForm.division;
      estimateData.numberOfUnits = estimateForm.numberOfUnits;
      estimateData.address = estimateForm.address;
      estimateData.city = estimateForm.city;
      estimateData.blockTower = estimateForm.blockTower;
      estimateData.blockNumber = estimateForm.blockNumber;
      estimateData.flatUnit = estimateForm.flatUnit;
      
      // Package info for direct estimate
      if (directSelectedPackage) {
        estimateData.packageId = directSelectedPackage.packageId;
        estimateData.packageName = directSelectedPackage.packageName;
        estimateData.packageRate = getDirectPackagePrice();
      }
      
      // Add-ons info for direct estimate
      if (directSelectedAddons.length > 0) {
        estimateData.addons = directSelectedAddons.map(a => ({
          addonId: a.addonId,
          services: a.services,
          totalPrice: a.totalPrice
        }));
        estimateData.addonsTotal = getDirectAddonsTotal();
      }
    }

    try {
      const createdEstimate = await createEstimate(estimateData);
      setLastCreatedEstimate(createdEstimate);
      
      showToast?.('Estimate saved successfully!', 'success');
      resetForm();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Save estimate error:', error);
      showToast?.('Failed to save estimate', 'error');
    }
  };

  const handleSendEmail = async () => {
    if (!lastCreatedEstimate?.estimateId) {
      showToast?.('No estimate to send', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/estimates-sync/${lastCreatedEstimate.estimateId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      
      if (result.success) {
        showToast?.(`Estimate sent to ${result.email}`, 'success');
      } else {
        showToast?.(result.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      console.error('Send email error:', error);
      showToast?.('Failed to send email', 'error');
    }
    
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
      notes: '',
      noOfVisits: '',
      description: ''
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
          <div className={`grid gap-4 ${isOpsManager ? 'grid-cols-1 max-w-md' : 'grid-cols-2'}`}>
            {/* Property-Based Estimate - Hidden for Operations Manager */}
            {!isOpsManager && (
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
            )}
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

      {/* FP Shared Resources - Aggregated from all FPs */}
      {admin && allFpPortalLinks.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">All FP Shared Resources</h3>
              <p className="text-xs text-gray-500">Aggregated quick access links from all Franchise Partners</p>
            </div>
          </div>
          <div className="space-y-4">
            {allFpPortalLinks.map((fp) => (
              <div key={fp.fpId} className="border-t border-blue-100 pt-3 first:border-0 first:pt-0">
                <p className="text-sm font-semibold text-indigo-700 mb-2">{fp.fpCode} - {fp.fpCompany}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {fp.links.map((link) => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all group">
                      <ExternalLink className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-gray-700 truncate">{link.heading}</span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* FP Shared Resources - Single FP selected */}
      {admin && fpPortalLinks.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-800">FP Shared Resources</h3>
              <p className="text-xs text-gray-500">Quick access links from {selectedFp?.fpId || 'Franchise Partner'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fpPortalLinks.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all group">
                <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{link.heading}</p>
                  <p className="text-xs text-gray-400 truncate">{link.url}</p>
                </div>
              </a>
            ))}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
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
                  </label>
                  <div className="relative max-w-md">
                    <select
                      value={getPackageId(selectedPackage) || ''}
                      onChange={(e) => handlePackageSelect(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                    >
                      <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                      {/* Show packages filtered by property type first, then all packages */}
                      {(() => {
                        const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType;
                        const filteredPkgs = propertyType 
                          ? availablePackages.filter(pkg => {
                              const pkgType = (getPackagePropertyType(pkg) || '').toUpperCase();
                              const searchType = propertyType.toUpperCase();
                              // Normalize both to check equivalents
                              const isGC = ['GC', 'GATED_COMMUNITY', 'GATED COMMUNITY'].includes(pkgType) && ['GC', 'GATED_COMMUNITY', 'GATED COMMUNITY'].includes(searchType);
                              const isApt = ['APT', 'APARTMENT', 'APARTMENTS'].includes(pkgType) && ['APT', 'APARTMENT', 'APARTMENTS'].includes(searchType);
                              const isVilla = ['VILLA', 'VILLAS'].includes(pkgType) && ['VILLA', 'VILLAS'].includes(searchType);
                              const isFlat = ['FLAT', 'FLATS'].includes(pkgType) && ['FLAT', 'FLATS'].includes(searchType);
                              const isPlot = ['PLOT', 'PLOTS'].includes(pkgType) && ['PLOT', 'PLOTS'].includes(searchType);
                              return pkgType === searchType || isGC || isApt || isVilla || isFlat || isPlot;
                            })
                          : [];
                        
                        return (
                          <>
                            {filteredPkgs.length > 0 && filteredPkgs.map(pkg => (
                              <option key={getPackageId(pkg)} value={getPackageId(pkg)}>
                                {getPackageName(pkg)} - ₹{getNormalizedPackagePrice(pkg).toLocaleString()}
                              </option>
                            ))}
                            {propertyType && filteredPkgs.length === 0 && (
                              <option disabled>No packages available for {propertyType}</option>
                            )}
                            {!propertyType && (
                              <option disabled>Select property type first</option>
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
                        <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase">Frequency</div>
                        <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">No.of visits</div>
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
                        Service Period: {selectedPackage.billingDuration.charAt(0).toUpperCase() + selectedPackage.billingDuration.slice(1)}
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
                        if (e.target.value !== 'OTHER') e.target.value = '';
                      }}
                      className="w-full px-4 py-2.5 text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400 appearance-none bg-white"
                    >
                      <option value="">+ Select Add-on to add</option>
                      {(() => {
                        const propertyType = selectedProperty?.property_type || selectedProperty?.entryType || selectedProperty?.propertyType;
                        const filteredAddons = propertyType 
                          ? availableAddons.filter(addon => {
                              const addonType = addon.propertyType?.toUpperCase();
                              const searchType = propertyType.toUpperCase();
                              return addonType === searchType || 
                                     addonType === 'GC' && searchType === 'GC' ||
                                     addonType === 'GATED COMMUNITY' && searchType === 'GC';
                            })
                          : availableAddons;
                        return (
                          <>
                            {filteredAddons.length > 0 && filteredAddons.map(addon => (
                              <option key={addon.addonId} value={addon.addonId}>
                                {addon.services?.map(s => s.name).join(', ') || addon.addonId}
                              </option>
                            ))}
                            {propertyType && filteredAddons.length === 0 && (
                              <option disabled>No add-ons available for {propertyType}</option>
                            )}
                            {!propertyType && availableAddons.map(addon => (
                              <option key={addon.addonId} value={addon.addonId}>
                                {addon.services?.map(s => s.name).join(', ') || addon.addonId}
                              </option>
                            ))}
                          </>
                        );
                      })()}
                      <option value="OTHER" className="font-semibold text-blue-600">➕ Other (Custom Service)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                  </div>
                  
                  {availableAddons.length === 0 && !showCustomAddon && (
                    <p className="text-xs text-amber-600 mt-2">
                      No add-ons available. Create add-ons in the Add-ons section or select "Other" for custom service.
                    </p>
                  )}
                </div>

                {/* Custom Add-on Form - Shows when "Other" is selected */}
                {showCustomAddon && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-blue-800">Add Custom Service</h4>
                      <button
                        onClick={handleCancelCustomAddon}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-3">
                      {/* Service Name */}
                      <div className="col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Service Name *</label>
                        <input
                          type="text"
                          value={customAddonForm.serviceName}
                          onChange={(e) => handleCustomAddonChange('serviceName', e.target.value)}
                          placeholder="Enter service name"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                      </div>
                      {/* Frequency Type */}
                      <div className="col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                        <select
                          value={customAddonForm.frequencyType}
                          onChange={(e) => handleCustomAddonChange('frequencyType', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                        >
                          {FREQUENCY_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      {/* Visits */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Visits</label>
                        <input
                          type="number"
                          min="1"
                          value={customAddonForm.frequencyCount}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-200 bg-gray-100 rounded-md text-center cursor-not-allowed"
                        />
                      </div>
                      {/* Price */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹) *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={customAddonForm.price}
                          onChange={(e) => handleCustomAddonChange('price', e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                      </div>
                      {/* Add Button */}
                      <div className="col-span-1 flex items-end">
                        <button
                          onClick={handleAddCustomAddon}
                          className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {/* Description - Full width */}
                      <div className="col-span-12 mt-2">
                        <input
                          type="text"
                          value={customAddonForm.description}
                          onChange={(e) => handleCustomAddonChange('description', e.target.value)}
                          placeholder="Add description/notes (optional)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Add-ons Table - Blue theme */}
                {selectedAddons.length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-blue-100/60 border-b border-blue-200">
                      <p className="text-sm font-semibold text-blue-800">Additional Services (Add-ons)</p>
                    </div>
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-white border-b border-blue-100">
                      <div className="col-span-5 text-xs font-semibold text-blue-800 uppercase">Service</div>
                      <div className="col-span-3 text-xs font-semibold text-blue-800 uppercase">Frequency</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">No.of visits</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">Action</div>
                    </div>
                    {/* Table Body */}
                    {selectedAddons.map((addon) => (
                      addon.services?.map((service, sIdx) => (
                        <div key={`${addon.addonId}-${sIdx}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white border-b border-gray-100 last:border-0 hover:bg-blue-50/30">
                          <div className="col-span-5 text-sm font-medium text-gray-800">{service.name}</div>
                          <div className="col-span-3 text-sm text-gray-600">{service.frequencyType || 'Monthly'}</div>
                          <div className="col-span-2 text-sm text-gray-600 text-center">{service.frequency || 1}</div>
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
                      <div className="col-span-10 text-sm font-semibold text-blue-800">Total Add-ons Price</div>
                      <div className="col-span-2 text-sm font-bold text-blue-700 text-right">₹{getAddonsTotal().toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {selectedAddons.length === 0 && (
                  <div className="p-3 text-center text-gray-400 border border-dashed border-blue-200 rounded-lg bg-blue-50/30">
                    <p className="text-sm">No add-ons selected. Use the dropdown above to add services.</p>
                  </div>
                )}
              </div>

              {/* Description Section */}
              <div className="px-6 py-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description / Notes
                  </label>
                  <textarea
                    value={estimateForm.description}
                    onChange={(e) => setEstimateForm({ ...estimateForm, description: e.target.value })}
                    placeholder="Add any additional notes or description for this estimate..."
                    rows={3}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 resize-none"
                  />
                </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={`flex-1 px-3 py-2 text-sm border border-l-0 rounded-r-md focus:ring-2 focus:ring-blue-200 ${phoneError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                    placeholder="10-digit phone number"
                    maxLength={10}
                    required
                  />
                </div>
                {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={estimateForm.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 ${emailError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Enter email address"
                />
                {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
              </div>
            </div>
          </div>

          {/* Property Details Header */}
          <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-800">Property Details</h3>
          </div>
          
          <div className="px-6 py-4">
            {/* Property Type Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Block Details</h4>
                <div className="mb-4 max-w-xs">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Blocks *</label>
                  <input
                    type="number"
                    min="1"
                    value={estimateForm.numberOfBlocks}
                    onChange={(e) => { const blocks = parseInt(e.target.value) || 1; setEstimateForm({ ...estimateForm, numberOfBlocks: blocks, unitsPerBlock: {} }); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: estimateForm.numberOfBlocks }, (_, i) => i + 1).map(blockNum => (
                    <React.Fragment key={blockNum}>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Block Name</label>
                        <input type="text" value={estimateForm.blockNames?.[blockNum] || ''} onChange={(e) => { const newBlockNames = {...(estimateForm.blockNames || {}), [blockNum]: e.target.value}; setEstimateForm({...estimateForm, blockNames: newBlockNames}); }} placeholder={`Block ${blockNum}`} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Units *</label>
                        <input
                          type="number"
                          min="1"
                          value={estimateForm.unitsPerBlock[blockNum] || ''}
                          onChange={(e) => { const units = parseInt(e.target.value) || 0; const newUnitsPerBlock = {...estimateForm.unitsPerBlock, [blockNum]: units}; const totalUnits = Object.values(newUnitsPerBlock).reduce((sum, u) => sum + (u || 0), 0); setEstimateForm({...estimateForm, unitsPerBlock: newUnitsPerBlock, totalUnits, numberOfUnits: totalUnits}); }}
                          placeholder="No. of units"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                        />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                {estimateForm.totalUnits > 0 && (<div className="mt-3 p-2 bg-blue-100 rounded inline-block"><span className="text-xs text-blue-700 font-medium">Total Units: {estimateForm.totalUnits}</span></div>)}
              </div>
            )}

            {estimateForm.propertyType === 'APT' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tower/Building Name</label>
                  <input type="text" value={estimateForm.blockTower} onChange={(e) => setEstimateForm({...estimateForm, blockTower: e.target.value})} placeholder="Tower/Building name" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Block Number</label>
                  <input type="text" value={estimateForm.blockNumber} onChange={(e) => setEstimateForm({...estimateForm, blockNumber: e.target.value})} placeholder="e.g., A, B, 1, 2" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Number of Units *</label>
                  <input type="number" min="1" value={estimateForm.numberOfUnits} onChange={(e) => setEstimateForm({...estimateForm, numberOfUnits: e.target.value})} placeholder="Total units" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                </div>
              </div>
            )}

            {estimateForm.propertyType === 'VILLA' && (
              <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Villa Number *</label>
                  <input type="text" value={estimateForm.flatUnit} onChange={(e) => setEstimateForm({...estimateForm, flatUnit: e.target.value})} placeholder="Enter villa number" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                </div>
              </div>
            )}

            {estimateForm.propertyType === 'PLOT' && (
              <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Plot Number *</label>
                  <input type="text" value={estimateForm.flatUnit} onChange={(e) => setEstimateForm({...estimateForm, flatUnit: e.target.value})} placeholder="Enter plot number" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
                </div>
              </div>
            )}

            {estimateForm.propertyType === 'FLAT' && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Flat Number *</label>
                  <input type="text" value={estimateForm.flatUnit} onChange={(e) => setEstimateForm({...estimateForm, flatUnit: e.target.value})} placeholder="Enter flat number" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500" />
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

          {/* AMC Package Section - Same as Property-Based */}
          <>
            <div className="px-6 py-3 bg-gray-100 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">AMC Package</h3>
            </div>
            
            <div className="px-6 py-4">
              {/* AMC Package Dropdown - Filtered by Property Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select AMC Package <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-md">
                  <select
                    value={getPackageId(directSelectedPackage) || ''}
                    onChange={(e) => handleDirectPackageSelect(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                    {(() => {
                      const propertyType = estimateForm.propertyType;
                      const filteredPkgs = propertyType 
                        ? availablePackages.filter(pkg => {
                            const pkgType = (getPackagePropertyType(pkg) || '').toUpperCase();
                            const searchType = propertyType.toUpperCase();
                            // Normalize both to check equivalents
                            const isGC = ['GC', 'GATED_COMMUNITY', 'GATED COMMUNITY'].includes(pkgType) && ['GC', 'GATED_COMMUNITY', 'GATED COMMUNITY'].includes(searchType);
                            const isApt = ['APT', 'APARTMENT', 'APARTMENTS'].includes(pkgType) && ['APT', 'APARTMENT', 'APARTMENTS'].includes(searchType);
                            const isVilla = ['VILLA', 'VILLAS'].includes(pkgType) && ['VILLA', 'VILLAS'].includes(searchType);
                            const isFlat = ['FLAT', 'FLATS'].includes(pkgType) && ['FLAT', 'FLATS'].includes(searchType);
                            const isPlot = ['PLOT', 'PLOTS'].includes(pkgType) && ['PLOT', 'PLOTS'].includes(searchType);
                            return pkgType === searchType || isGC || isApt || isVilla || isFlat || isPlot;
                          })
                        : [];
                      
                      return (
                        <>
                          {filteredPkgs.length > 0 && filteredPkgs.map(pkg => (
                            <option key={getPackageId(pkg)} value={getPackageId(pkg)}>
                              {getPackageName(pkg)} - ₹{getNormalizedPackagePrice(pkg).toLocaleString()}
                            </option>
                          ))}
                          {propertyType && filteredPkgs.length === 0 && (
                            <option disabled>No packages available for {propertyType}</option>
                          )}
                          {!propertyType && <option disabled>Select property type first</option>}
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
              {directSelectedPackage && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">{directSelectedPackage.packageName}</span>
                    <span className="text-xs bg-blue-200 text-blue-700 px-2 py-0.5 rounded">{directSelectedPackage.packageId}</span>
                  </div>
                  {/* Services Table */}
                  <div className="bg-white rounded border border-blue-100 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-10 gap-2 px-3 py-2 bg-blue-100/50 border-b border-blue-200">
                      <div className="col-span-6 text-xs font-semibold text-blue-800 uppercase">Service</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase">Frequency</div>
                      <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">No.of visits</div>
                    </div>
                    {/* Table Body */}
                    {directSelectedPackage.serviceRows && directSelectedPackage.serviceRows.length > 0 ? (
                      directSelectedPackage.serviceRows.filter(s => s.service?.trim()).map((service, idx) => (
                        <div key={idx} className="grid grid-cols-10 gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <div className="col-span-6 text-sm font-medium text-gray-800">{service.service}</div>
                          <div className="col-span-2 text-sm text-gray-600">{service.frequencyType || 'Monthly'}</div>
                          <div className="col-span-2 text-sm text-gray-600 text-center">{service.frequencyCount || 1}</div>
                        </div>
                      ))
                    ) : (
                      (typeof directSelectedPackage.services === 'string' ? directSelectedPackage.services.split(',') : 
                       Array.isArray(directSelectedPackage.services) ? directSelectedPackage.services.map(s => s.name || s) : []
                      ).filter(s => s?.trim()).map((serviceName, idx) => (
                        <div key={idx} className="grid grid-cols-10 gap-2 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <div className="col-span-6 text-sm font-medium text-gray-800">{serviceName.trim()}</div>
                          <div className="col-span-2 text-sm text-gray-400">Monthly</div>
                          <div className="col-span-2 text-sm text-gray-400 text-center">1</div>
                        </div>
                      ))
                    )}
                    {/* Total Row */}
                    <div className="flex justify-between px-3 py-2.5 bg-blue-50 border-t border-blue-200">
                      <span className="text-sm font-semibold text-blue-800">Total Package Price</span>
                      <span className="text-sm font-bold text-blue-700">₹{getDirectPackagePrice().toLocaleString()}</span>
                    </div>
                  </div>
                  {directSelectedPackage.billingDuration && (
                    <p className="text-xs text-blue-600 mt-2">
                      Service Period: {directSelectedPackage.billingDuration.charAt(0).toUpperCase() + directSelectedPackage.billingDuration.slice(1)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Additional Services Section - Add-ons */}
            <div className="px-6 py-4 border-t border-gray-100">
              {/* Add-on Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Service from Add-ons
                </label>
                <div className="relative max-w-sm">
                  <select
                    onChange={(e) => {
                      handleDirectAddAddon(e.target.value);
                      if (e.target.value !== 'OTHER') e.target.value = '';
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400 appearance-none bg-white"
                  >
                    <option value="">+ Select Add-on to add</option>
                    {(() => {
                      const propertyType = estimateForm.propertyType;
                      const filteredAddons = propertyType 
                        ? availableAddons.filter(addon => {
                            const addonType = addon.propertyType?.toUpperCase();
                            const searchType = propertyType.toUpperCase();
                            return addonType === searchType || 
                                   addonType === 'GC' && searchType === 'GC' ||
                                   addonType === 'GATED COMMUNITY' && searchType === 'GC';
                          })
                        : availableAddons;
                      return (
                        <>
                          {filteredAddons.length > 0 && filteredAddons.map(addon => (
                            <option key={addon.addonId} value={addon.addonId}>
                              {addon.services?.map(s => s.name).join(', ') || addon.addonId}
                            </option>
                          ))}
                          {propertyType && filteredAddons.length === 0 && (
                            <option disabled>No add-ons available for {propertyType}</option>
                          )}
                          {!propertyType && availableAddons.map(addon => (
                            <option key={addon.addonId} value={addon.addonId}>
                              {addon.services?.map(s => s.name).join(', ') || addon.addonId}
                            </option>
                          ))}
                        </>
                      );
                    })()}
                    <option value="OTHER" className="font-semibold text-blue-600">➕ Other (Custom Service)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
                </div>
                
                {availableAddons.length === 0 && !directShowCustomAddon && (
                  <p className="text-xs text-amber-600 mt-2">
                    No add-ons available. Create add-ons in the Add-ons section or select "Other" for custom service.
                  </p>
                )}
              </div>

              {/* Custom Add-on Form */}
              {directShowCustomAddon && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-800">Add Custom Service</h4>
                    <button
                      onClick={handleDirectCancelCustomAddon}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Service Name *</label>
                      <input
                        type="text"
                        value={directCustomAddonForm.serviceName}
                        onChange={(e) => handleDirectCustomAddonChange('serviceName', e.target.value)}
                        placeholder="Enter service name"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                      />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                      <select
                        value={directCustomAddonForm.frequencyType}
                        onChange={(e) => handleDirectCustomAddonChange('frequencyType', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
                      >
                        {FREQUENCY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Visits</label>
                      <input
                        type="number"
                        min="1"
                        value={directCustomAddonForm.frequencyCount}
                        readOnly
                        className="w-full px-3 py-2 text-sm border border-gray-200 bg-gray-100 rounded-md text-center cursor-not-allowed"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹) *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={directCustomAddonForm.price}
                        onChange={(e) => handleDirectCustomAddonChange('price', e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                      />
                    </div>
                    <div className="lg:col-span-1 flex items-end">
                      <button
                        onClick={handleDirectAddCustomAddon}
                        className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                    {/* Description - Full width */}
                    <div className="lg:col-span-12 mt-2">
                      <input
                        type="text"
                        value={directCustomAddonForm.description}
                        onChange={(e) => handleDirectCustomAddonChange('description', e.target.value)}
                        placeholder="Add description/notes (optional)"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Add-ons Table */}
              {directSelectedAddons.length > 0 && (
                <div className="bg-blue-50/50 border border-blue-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-blue-100/60 border-b border-blue-200">
                    <p className="text-sm font-semibold text-blue-800">Additional Services (Add-ons)</p>
                  </div>
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-white border-b border-blue-100">
                    <div className="col-span-5 text-xs font-semibold text-blue-800 uppercase">Service</div>
                    <div className="col-span-3 text-xs font-semibold text-blue-800 uppercase">Frequency</div>
                    <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">No.of visits</div>
                    <div className="col-span-2 text-xs font-semibold text-blue-800 uppercase text-center">Action</div>
                  </div>
                  {/* Table Body */}
                  {directSelectedAddons.map((addon) => (
                    addon.services?.map((service, sIdx) => (
                      <div key={`${addon.addonId}-${sIdx}`} className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white border-b border-gray-100 last:border-0 hover:bg-blue-50/30">
                        <div className="col-span-5 text-sm font-medium text-gray-800">{service.name}</div>
                        <div className="col-span-3 text-sm text-gray-600">{service.frequencyType || 'Monthly'}</div>
                        <div className="col-span-2 text-sm text-gray-600 text-center">{service.frequency || 1}</div>
                        <div className="col-span-2 text-center">
                          <button
                            onClick={() => handleDirectRemoveAddon(addon.addonId)}
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
                    <div className="col-span-10 text-sm font-semibold text-blue-800">Total Add-ons Price</div>
                    <div className="col-span-2 text-sm font-bold text-blue-700 text-right">₹{getDirectAddonsTotal().toLocaleString()}</div>
                  </div>
                </div>
              )}

              {directSelectedAddons.length === 0 && (
                <div className="p-3 text-center text-gray-400 border border-dashed border-blue-200 rounded-lg bg-blue-50/30">
                  <p className="text-sm">No add-ons selected. Use the dropdown above to add services.</p>
                </div>
              )}
            </div>

            {/* Description Section for Direct */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description / Notes
                </label>
                <textarea
                  value={estimateForm.description}
                  onChange={(e) => setEstimateForm({ ...estimateForm, description: e.target.value })}
                  placeholder="Add any additional notes or description for this estimate..."
                  rows={3}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Dynamic Summary Section */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Price Summary</h3>
              
              <div className="flex justify-end">
                <div className="w-96">
                  {/* Sub Total (Package + Add-ons) */}
                  <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                    <span className="text-gray-600">Sub Total</span>
                    <span className="font-medium text-gray-800">₹{calculateDirectSubTotal().toLocaleString()}</span>
                  </div>
                  
                  {/* Discount (Percentage) */}
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-gray-600">Discount (%)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={directDiscount}
                        onChange={(e) => setDirectDiscount(e.target.value)}
                        placeholder="0"
                        className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="text-sm text-gray-500 w-24 text-right">- ₹{getDirectDiscountAmount().toLocaleString()}</span>
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
                        value={directGstRate}
                        onChange={(e) => setDirectGstRate(e.target.value)}
                        placeholder="18"
                        className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="text-sm text-gray-500 w-24 text-right">+ ₹{calculateDirectGST().toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-between text-base py-3 bg-gray-700 text-white px-3 rounded-md mt-2">
                    <span className="font-semibold">Total Amount</span>
                    <span className="font-bold">₹{calculateDirectTotal().toLocaleString()}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 justify-end mt-4">
                    <button
                      onClick={resetForm}
                      className="px-6 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    {/* Save button - Hidden for Operations Manager */}
                    {!isOpsManager && (
                      <button
                        onClick={handleSave}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 transition-colors"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="px-6 py-3 border-t border-gray-200 bg-white">
              <p className="text-xs text-gray-500">
                * Currency: INR (₹) | GST applied on total | Fields marked with * are mandatory | Direct estimates are saved to Archive section
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
