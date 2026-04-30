import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Building2,
  Calendar,
  DollarSign,
  Edit,
  Search,
  ChevronDown,
  AlertCircle,
  Check,
  X,
  FileText,
  Star,
  Copy,
  Download,
  Mail,
} from 'lucide-react';
import {
  getAMCPackages,
  createAMCPackage,
  updateAMCPackage,
  deleteAMCPackage,
  getServices,
  addService,
  BILLING_DURATIONS,
  getAMCTemplates,
  createAMCTemplate,
  updateAMCTemplate,
  deleteAMCTemplate,
  getDefaultAMCTemplate,
  calculateAMCPrice,
  checkDuplicateAMCPackage,
  getAMCTemplateByPropertyType,
} from '../../utils/estimateStore';
import { getProperties } from '../../utils/propertyStore';

const GST_RATE = 0.02;

// Property type options for templates
const TEMPLATE_PROPERTY_TYPES = [
  { value: 'GC', label: 'AMC – GC (Gated Community)' },
  { value: 'APT', label: 'AMC – APT (Apartment)' },
  { value: 'VILLA', label: 'AMC – VILLA' },
  { value: 'FLAT', label: 'AMC – FLAT' },
  { value: 'PLOT', label: 'AMC – PLOT' },
];

const AMCPackageManager = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState('packages'); // 'packages' or 'templates'
  const [properties, setProperties] = useState([]);
  const [services, setServices] = useState([]);
  const [amcPackages, setAmcPackages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templatePropertyType, setTemplatePropertyType] = useState('');
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(null);
  const [selectedPropertyType, setSelectedPropertyType] = useState('');

  const [amcForm, setAmcForm] = useState({
    propertyId: '',
    propertyName: '',
    billingDuration: 'monthly',
    services: [{ name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setAmcPackages(getAMCPackages());
    setServices(getServices());
    setTemplates(getAMCTemplates());
    const props = await getProperties();
    setProperties(props);

    // Load default template if exists
    const defaultTemplate = getDefaultAMCTemplate();
    if (defaultTemplate && !editingPackage) {
      applyTemplate(defaultTemplate);
    }
  };

  const applyTemplate = (template) => {
    setAmcForm({
      ...amcForm,
      billingDuration: template.billingDuration || 'monthly',
      services: template.services?.map(s => ({ ...s })) || [{ name: '', frequency: 1, rate: '' }],
    });
    showToast?.(`Template "${template.name}" applied`, 'success');
  };

  const [selectedPropertyDetails, setSelectedPropertyDetails] = useState(null);

  const handlePropertySelect = (property) => {
    // Check for duplicate package
    if (checkDuplicateAMCPackage(property.propertyId, editingPackage?.packageId)) {
      showToast?.('An AMC package already exists for this property', 'error');
      return;
    }

    // Store full property details for display
    setSelectedPropertyDetails(property);

    // Auto-populate from matching template based on property type (entryType)
    const matchingTemplate = getAMCTemplateByPropertyType(property.entryType);
    
    if (matchingTemplate) {
      // Apply template services and billing
      setAmcForm({
        propertyId: property.propertyId,
        propertyName: property.communityName || property.name || '',
        billingDuration: matchingTemplate.billingDuration || 'monthly',
        services: matchingTemplate.services?.map(s => ({
          name: s.name || '',
          frequencyCount: s.frequencyCount || s.frequency || 1,
          frequencyType: s.frequencyType || 'Monthly',
          rate: s.rate || '',
          billing: s.billing || matchingTemplate.billingDuration || 'monthly'
        })) || [{ name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
      });
      setTemplateApplied(matchingTemplate);
      showToast?.(`Template "${matchingTemplate.name}" auto-applied for ${property.entryType}`, 'success');
    } else {
      // No matching template - use empty form
      setAmcForm({
        ...amcForm,
        propertyId: property.propertyId,
        propertyName: property.communityName || property.name || '',
      });
      setTemplateApplied(null);
    }
    
    setPropertySearch(property.propertyId);
    setShowPropertyDropdown(false);
  };

  const filteredProperties = properties.filter(prop => {
    // Filter by selected property type first
    if (selectedPropertyType && prop.entryType !== selectedPropertyType) {
      return false;
    }
    const search = propertySearch.toLowerCase();
    return (
      prop.propertyId?.toLowerCase().includes(search) ||
      prop.communityName?.toLowerCase().includes(search) ||
      prop.name?.toLowerCase().includes(search)
    );
  });

  // Service row management
  const addServiceRow = () => {
    setAmcForm({
      ...amcForm,
      services: [...amcForm.services, { name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
    });
  };

  const removeServiceRow = (index) => {
    if (amcForm.services.length > 1) {
      setAmcForm({
        ...amcForm,
        services: amcForm.services.filter((_, i) => i !== index),
      });
    }
  };

  const updateServiceRow = (index, field, value) => {
    const newServices = [...amcForm.services];
    newServices[index] = { ...newServices[index], [field]: value };
    setAmcForm({ ...amcForm, services: newServices });
  };

  const handleAddNewService = (serviceName) => {
    if (serviceName.trim()) {
      addService(serviceName.trim());
      setServices(getServices());
    }
  };

  // Frequency type multipliers for annual calculation
  const FREQUENCY_MULTIPLIERS = {
    'Monthly': 12,
    'Quarterly': 4,
    'Half-Yearly': 2,
    'Yearly': 1
  };

  // Calculations - AMC Price based on services, frequency count, and frequency type
  const calculateServiceAnnualPrice = (service) => {
    const rate = parseFloat(service.rate) || 0;
    const frequencyCount = parseInt(service.frequencyCount) || 1;
    const frequencyMultiplier = FREQUENCY_MULTIPLIERS[service.frequencyType] || 12;
    // Annual price = rate per service × frequency count × times per year
    return rate * frequencyCount * frequencyMultiplier;
  };

  const calculateSubTotal = () => {
    return amcForm.services.reduce((sum, service) => {
      return sum + calculateServiceAnnualPrice(service);
    }, 0);
  };

  const calculateGST = () => {
    return Math.round(calculateSubTotal() * GST_RATE);
  };

  const calculateTotal = () => {
    return calculateSubTotal() + calculateGST();
  };

  const getDurationMultiplier = () => {
    const duration = BILLING_DURATIONS.find(d => d.value === amcForm.billingDuration);
    return duration ? duration.multiplier : 1;
  };

  // Form actions
  const handleSavePackage = () => {
    if (!amcForm.propertyId) {
      showToast?.('Please select a property', 'error');
      return;
    }

    const validServices = amcForm.services.filter(s => s.name.trim() && s.rate);
    if (validServices.length === 0) {
      showToast?.('Please add at least one service with rate', 'error');
      return;
    }

    const packageData = {
      ...amcForm,
      services: validServices,
      subTotal: calculateSubTotal(),
      gst: calculateGST(),
      totalPrice: calculateTotal(),
      billingDuration: amcForm.billingDuration,
      status: 'active',
    };

    if (editingPackage) {
      updateAMCPackage(editingPackage.packageId, packageData);
      showToast?.('AMC Package updated successfully!', 'success');
    } else {
      createAMCPackage(packageData);
      showToast?.('AMC Package created successfully!', 'success');
    }

    resetForm();
    loadData();
  };

  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
    // Find property details for display
    const property = properties.find(p => p.propertyId === pkg.propertyId);
    setSelectedPropertyDetails(property || null);
    
    setAmcForm({
      propertyId: pkg.propertyId || '',
      propertyName: pkg.propertyName || '',
      billingDuration: pkg.billingDuration || 'monthly',
      services: pkg.services?.map(s => ({
        name: s.name || '',
        frequencyCount: s.frequencyCount || s.frequency || 1,
        frequencyType: s.frequencyType || 'Monthly',
        rate: s.rate || ''
      })) || [{ name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
    });
    setPropertySearch(pkg.propertyId || '');
  };

  const handleDeletePackage = (packageId) => {
    if (window.confirm('Are you sure you want to delete this AMC package?')) {
      deleteAMCPackage(packageId);
      showToast?.('AMC Package deleted', 'success');
      loadData();
    }
  };

  const resetForm = () => {
    setAmcForm({
      propertyId: '',
      propertyName: '',
      billingDuration: 'monthly',
      services: [{ name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
    });
    setEditingPackage(null);
    setPropertySearch('');
    setSelectedPropertyDetails(null);
    setSelectedPropertyType('');
    setTemplateApplied(null);
  };

  // Template management
  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      showToast?.('Please enter a template name', 'error');
      return;
    }

    if (!templatePropertyType) {
      showToast?.('Please select a property type for this template', 'error');
      return;
    }

    const validServices = amcForm.services.filter(s => s.name.trim());
    if (validServices.length === 0) {
      showToast?.('Please add at least one service', 'error');
      return;
    }

    // Check if template for this property type already exists
    const existingTemplate = templates.find(t => t.propertyType === templatePropertyType && t.templateId !== editingTemplate?.templateId);
    if (existingTemplate) {
      if (!window.confirm(`A template for ${templatePropertyType} already exists. Do you want to replace it?`)) {
        return;
      }
      deleteAMCTemplate(existingTemplate.templateId);
    }

    if (editingTemplate) {
      // Update existing template
      updateAMCTemplate(editingTemplate.templateId, {
        name: templateName.trim(),
        propertyType: templatePropertyType,
        billingDuration: amcForm.billingDuration,
        services: validServices,
        isDefault: isDefaultTemplate,
      });
      showToast?.('Template updated successfully!', 'success');
    } else {
      // Create new template
      createAMCTemplate({
        name: templateName.trim(),
        propertyType: templatePropertyType,
        billingDuration: amcForm.billingDuration,
        services: validServices,
        isDefault: isDefaultTemplate,
      });
      showToast?.('Template created successfully!', 'success');
    }

    setShowTemplateModal(false);
    resetTemplateForm();
    loadData();
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplatePropertyType(template.propertyType);
    setIsDefaultTemplate(template.isDefault || false);
    setAmcForm({
      propertyId: '',
      propertyName: '',
      billingDuration: template.billingDuration || 'monthly',
      services: template.services?.map(s => ({
        name: s.name || '',
        frequencyCount: s.frequencyCount || s.frequency || 1,
        frequencyType: s.frequencyType || 'Monthly',
        rate: s.rate || '',
        billing: s.billing || template.billingDuration || 'monthly'
      })) || [{ name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
    });
    setShowTemplateModal(true);
  };

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplatePropertyType('');
    setIsDefaultTemplate(false);
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      deleteAMCTemplate(templateId);
      showToast?.('Template deleted', 'success');
      loadData();
    }
  };

  const handleSetDefaultTemplate = (templateId) => {
    updateAMCTemplate(templateId, { isDefault: true });
    showToast?.('Default template updated', 'success');
    loadData();
  };

  // Export to PDF (placeholder)
  const handleExportPDF = (pkg) => {
    showToast?.('PDF export feature coming soon!', 'info');
  };

  // Email package (placeholder)
  const handleEmailPackage = (pkg) => {
    showToast?.('Email feature coming soon!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'packages'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Property Packages
          </div>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            AMC Templates
            {templates.length > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">
                {templates.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">AMC Templates</h2>
                  <p className="text-sm text-gray-500">Create reusable templates for different property types</p>
                </div>
              </div>
              <button
                onClick={() => {
                  resetTemplateForm();
                  resetForm();
                  setShowTemplateModal(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </button>
            </div>
          </div>

          <div className="p-6">
            {templates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No templates yet</p>
                <p className="text-sm mb-4">Create AMC templates for GC, APT, VILLA to auto-populate when selecting properties</p>
                <button
                  onClick={() => {
                    resetTemplateForm();
                    resetForm();
                    setShowTemplateModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  Create Your First Template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                  <div key={template.templateId} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            {template.propertyType}
                          </span>
                          {template.isDefault && (
                            <span className="flex items-center gap-1 text-yellow-600 text-xs">
                              <Star className="w-3 h-3 fill-current" />
                              Default
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-800 mt-2">{template.name}</h3>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <p>{template.services?.length || 0} services configured</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Updated: {new Date(template.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.templateId)}
                        className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Property Packages Tab */}
      {activeTab === 'packages' && (
      <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingPackage ? 'Edit AMC Package' : 'Create AMC Package'}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingPackage ? `Editing: ${editingPackage.packageId}` : 'Select a property to auto-apply matching template'}
                </p>
              </div>
            </div>

            {/* Template Applied Badge */}
            {templateApplied && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Template "{templateApplied.name}" applied
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Property Type & Property Selection Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Select Property Type & Property
            </h3>
            
            {/* Property Type Selection */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {TEMPLATE_PROPERTY_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => {
                    setSelectedPropertyType(type.value === selectedPropertyType ? '' : type.value);
                    setPropertySearch('');
                    setSelectedPropertyDetails(null);
                    setTemplateApplied(null);
                    // Auto-apply template if exists for this type
                    if (type.value !== selectedPropertyType) {
                      const matchingTemplate = templates.find(t => t.propertyType === type.value);
                      if (matchingTemplate) {
                        setAmcForm(prev => ({
                          ...prev,
                          billingDuration: matchingTemplate.billingDuration || 'monthly',
                          services: matchingTemplate.services?.map(s => ({
                            name: s.name || '',
                            frequencyCount: s.frequencyCount || s.frequency || 1,
                            frequencyType: s.frequencyType || 'Monthly',
                            rate: s.rate || '',
                          })) || [{ name: '', frequencyCount: 1, frequencyType: 'Monthly', rate: '' }],
                        }));
                        setTemplateApplied(matchingTemplate);
                        showToast?.(`Template "${matchingTemplate.name}" applied for ${type.value}`, 'success');
                      }
                    }
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    selectedPropertyType === type.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  {type.value}
                </button>
              ))}
            </div>

            {/* Show template applied badge */}
            {templateApplied && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  Template "{templateApplied.name}" applied - {templateApplied.services?.length || 0} services pre-configured
                </span>
              </div>
            )}

            {/* Property Search - shown after selecting type */}
            {selectedPropertyType && (
              <div className="relative max-w-md">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Select {selectedPropertyType} Property <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={propertySearch}
                    onChange={(e) => {
                      setPropertySearch(e.target.value);
                      setShowPropertyDropdown(true);
                      if (!e.target.value) setSelectedPropertyDetails(null);
                    }}
                    onFocus={() => setShowPropertyDropdown(true)}
                    placeholder={`Search ${selectedPropertyType} properties...`}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                {showPropertyDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProperties.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No {selectedPropertyType} properties found
                      </div>
                    ) : (
                      filteredProperties.slice(0, 8).map(prop => (
                        <button
                          key={prop.propertyId}
                          onClick={() => handlePropertySelect(prop)}
                          className="w-full px-4 py-2 text-left hover:bg-indigo-50 text-sm flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium">{prop.propertyId}</span>
                            <span className="text-gray-500 ml-2">- {prop.communityName || prop.name}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                            {prop.entryType}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {!selectedPropertyType && (
              <p className="text-sm text-gray-500 italic">
                ↑ Select a property type above to begin creating an AMC package
              </p>
            )}
          </div>

          {/* Property Details Display (when selected) */}
          {selectedPropertyDetails && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-800 mb-3">Property Details</h4>
              {/* Row 1: Contact Name, Property ID, Entry Type, Zone, Area */}
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Contact Name</label>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedPropertyDetails.contacts?.[0]?.name || '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Property ID</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.propertyId}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Entry Type</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.entryType || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Zone</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.zone || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Area</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.areaName || '-'}</p>
                </div>
              </div>
              {/* Row 2: Community Name, Division, Property Type, Units, City */}
              <div className="grid grid-cols-5 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Community Name</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.communityName || selectedPropertyDetails.name || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Division</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.division || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Property Type</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.propertyType || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Units</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.numberOfUnits || '-'}</p>
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">City</label>
                  <p className="text-sm font-medium text-gray-800">{selectedPropertyDetails.city || '-'}</p>
                </div>
              </div>
              {/* Row 3: Contact Phone, Contact Email */}
              <div className="grid grid-cols-5 gap-4 mt-3">
                <div>
                  <label className="block text-xs text-blue-600 mb-1">Contact Phone</label>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedPropertyDetails.contacts?.[0]?.phone 
                      ? `${selectedPropertyDetails.contacts[0].countryCode || '+91'} ${selectedPropertyDetails.contacts[0].phone}` 
                      : '-'}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-blue-600 mb-1">Contact Email</label>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedPropertyDetails.contacts?.[0]?.email || '-'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Services Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              AMC Services Configuration
            </h3>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 mb-2 px-3 py-2 bg-gray-100 rounded-t-lg">
              <div className="col-span-1 text-xs font-semibold text-gray-600">#</div>
              <div className="col-span-3 text-xs font-semibold text-gray-600">Service <span className="text-red-500">*</span></div>
              <div className="col-span-2 text-xs font-semibold text-gray-600">Frequency (Count)</div>
              <div className="col-span-2 text-xs font-semibold text-gray-600">Frequency Type</div>
              <div className="col-span-2 text-xs font-semibold text-gray-600">Rate (₹) <span className="text-red-500">*</span></div>
              <div className="col-span-1 text-xs font-semibold text-gray-600">Billing</div>
              <div className="col-span-1"></div>
            </div>

            {/* Service Rows */}
            <div className="space-y-2 border border-t-0 border-gray-200 rounded-b-lg p-2">
              {amcForm.services.map((service, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-center bg-gray-50 rounded-lg p-3">
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    >
                      <option value="">Select Service</option>
                      {services.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__add_new__">+ Add New Service</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={service.frequencyCount}
                      onChange={(e) => updateServiceRow(index, 'frequencyCount', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 text-center"
                      placeholder="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={service.frequencyType}
                      onChange={(e) => updateServiceRow(index, 'frequencyType', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      value={service.rate}
                      onChange={(e) => updateServiceRow(index, 'rate', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1">
                    <select
                      value={service.billing || amcForm.billingDuration}
                      onChange={(e) => updateServiceRow(index, 'billing', e.target.value)}
                      className="w-full px-2 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                    >
                      {BILLING_DURATIONS.map(duration => (
                        <option key={duration.value} value={duration.value}>
                          {duration.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeServiceRow(index)}
                      disabled={amcForm.services.length === 1}
                      className={`p-1.5 rounded ${
                        amcForm.services.length === 1
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addServiceRow}
              className="mt-3 flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          </div>

          {/* AMC Price Section - Full Width */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              AMC Price Summary
            </h3>
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="grid grid-cols-2 gap-6">
                {/* Services Summary */}
                <div>
                  <p className="text-sm opacity-80 mb-1">Services Configured</p>
                  <p className="text-2xl font-bold">{amcForm.services.filter(s => s.name && s.rate).length}</p>
                </div>
                
                {/* Total AMC Price */}
                <div className="bg-white/20 rounded-lg p-4">
                  <p className="text-sm opacity-90 mb-1">Total AMC Price</p>
                  <p className="text-3xl font-bold">₹{calculateSubTotal().toLocaleString()}</p>
                </div>
              </div>
              
              {/* Per Service Breakdown */}
              {amcForm.services.filter(s => s.name && s.rate).length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-xs opacity-80 mb-2">Service-wise Breakdown:</p>
                  <div className="flex flex-wrap gap-2">
                    {amcForm.services.filter(s => s.name && s.rate).map((service, idx) => (
                      <span key={idx} className="px-2 py-1 bg-white/20 rounded text-xs">
                        {service.name}: ₹{(parseFloat(service.rate) || 0).toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={resetForm}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          {editingPackage && (
            <button
              onClick={() => handleDeletePackage(editingPackage.packageId)}
              className="px-5 py-2.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            onClick={handleSavePackage}
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingPackage ? 'Update Package' : 'Save AMC Package'}
          </button>
        </div>
      </div>

      {/* Existing AMC Packages List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">All AMC Packages</h3>
          <p className="text-sm text-gray-500">{amcPackages.length} package(s)</p>
        </div>

        {amcPackages.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No AMC packages yet</p>
            <p className="text-sm text-gray-400">Create your first AMC package above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {amcPackages.map((pkg) => (
              <div key={pkg.packageId} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {pkg.propertyId} - {pkg.propertyName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {pkg.services?.length || 0} services • {BILLING_DURATIONS.find(d => d.value === pkg.billingDuration)?.label || 'Monthly'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="font-semibold text-gray-800">₹{(pkg.totalPrice || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditPackage(pkg)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExportPDF(pkg)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title="Export PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEmailPackage(pkg)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePackage(pkg.packageId)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {pkg.services && pkg.services.length > 0 && (
                  <div className="mt-3 ml-14">
                    <div className="flex flex-wrap gap-2">
                      {pkg.services.map((service, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                        >
                          {service.name} ({service.frequency}x @ ₹{service.rate})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Save as Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingTemplate ? 'Edit AMC Template' : 'Create AMC Template'}
              </h3>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  resetTemplateForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={templatePropertyType}
                  onChange={(e) => setTemplatePropertyType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                >
                  <option value="">Select Property Type</option>
                  {TEMPLATE_PROPERTY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  This template will auto-apply when selecting properties of this type
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., AMC – GC Standard Package"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                />
              </div>

              {/* Services Configuration in Modal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services Configuration
                </label>
                <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {amcForm.services.map((service, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select
                        value={service.name}
                        onChange={(e) => updateServiceRow(index, 'name', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                      >
                        <option value="">Select Service</option>
                        {services.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={service.rate}
                        onChange={(e) => updateServiceRow(index, 'rate', e.target.value)}
                        placeholder="Rate"
                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                      <button
                        onClick={() => removeServiceRow(index)}
                        disabled={amcForm.services.length === 1}
                        className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addServiceRow}
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Service
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefaultTemplate}
                  onChange={(e) => setIsDefaultTemplate(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Set as default template</span>
              </label>

              <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
                <p className="font-medium mb-1">Template Summary:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Property Type: {templatePropertyType || 'Not selected'}</li>
                  <li>{amcForm.services.filter(s => s.name.trim()).length} service(s) configured</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  resetTemplateForm();
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingTemplate ? 'Update Template' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AMCPackageManager;
