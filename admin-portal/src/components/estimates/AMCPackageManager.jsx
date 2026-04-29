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
} from '../../utils/estimateStore';
import { getProperties } from '../../utils/propertyStore';

const GST_RATE = 0.02;

const AMCPackageManager = ({ showToast }) => {
  const [properties, setProperties] = useState([]);
  const [services, setServices] = useState([]);
  const [amcPackages, setAmcPackages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [editingPackage, setEditingPackage] = useState(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false);

  const [amcForm, setAmcForm] = useState({
    propertyId: '',
    propertyName: '',
    billingDuration: 'monthly',
    services: [{ name: '', frequency: 1, rate: '' }],
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

  const handlePropertySelect = (property) => {
    // Check for duplicate package
    if (checkDuplicateAMCPackage(property.propertyId, editingPackage?.packageId)) {
      showToast?.('An AMC package already exists for this property', 'error');
      return;
    }

    setAmcForm({
      ...amcForm,
      propertyId: property.propertyId,
      propertyName: property.communityName || property.propertyName || '',
    });
    setPropertySearch(property.propertyId);
    setShowPropertyDropdown(false);
  };

  const filteredProperties = properties.filter(prop => {
    const search = propertySearch.toLowerCase();
    return (
      prop.propertyId?.toLowerCase().includes(search) ||
      prop.communityName?.toLowerCase().includes(search)
    );
  });

  // Service row management
  const addServiceRow = () => {
    setAmcForm({
      ...amcForm,
      services: [...amcForm.services, { name: '', frequency: 1, rate: '' }],
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

  // Calculations
  const calculateSubTotal = () => {
    return calculateAMCPrice(amcForm.services, amcForm.billingDuration);
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
    setAmcForm({
      propertyId: pkg.propertyId || '',
      propertyName: pkg.propertyName || '',
      billingDuration: pkg.billingDuration || 'monthly',
      services: pkg.services || [{ name: '', frequency: 1, rate: '' }],
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
      services: [{ name: '', frequency: 1, rate: '' }],
    });
    setEditingPackage(null);
    setPropertySearch('');

    // Reapply default template
    const defaultTemplate = getDefaultAMCTemplate();
    if (defaultTemplate) {
      applyTemplate(defaultTemplate);
    }
  };

  // Template management
  const handleSaveAsTemplate = () => {
    if (!templateName.trim()) {
      showToast?.('Please enter a template name', 'error');
      return;
    }

    const validServices = amcForm.services.filter(s => s.name.trim());
    if (validServices.length === 0) {
      showToast?.('Please add at least one service', 'error');
      return;
    }

    createAMCTemplate({
      name: templateName.trim(),
      billingDuration: amcForm.billingDuration,
      services: validServices,
      isDefault: isDefaultTemplate,
    });

    showToast?.('Template saved successfully!', 'success');
    setShowTemplateModal(false);
    setTemplateName('');
    setIsDefaultTemplate(false);
    loadData();
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
      {/* AMC Package Form */}
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
                  {editingPackage ? `Editing: ${editingPackage.packageId}` : 'Create a new AMC package for a property'}
                </p>
              </div>
            </div>

            {/* Templates Dropdown */}
            <div className="flex items-center gap-2">
              {templates.length > 0 && (
                <div className="relative group">
                  <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Templates
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 hidden group-hover:block">
                    {templates.map(template => (
                      <div key={template.templateId} className="px-4 py-2 hover:bg-gray-50 flex items-center justify-between">
                        <button
                          onClick={() => applyTemplate(template)}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          {template.isDefault && <Star className="w-3 h-3 text-yellow-500" />}
                          {template.name}
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSetDefaultTemplate(template.templateId)}
                            className="p-1 text-gray-400 hover:text-yellow-500"
                            title="Set as default"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.templateId)}
                            className="p-1 text-gray-400 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-2 text-sm border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save as Template
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Property Details Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Property Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Property ID with Search */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Property ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={propertySearch}
                    onChange={(e) => {
                      setPropertySearch(e.target.value);
                      setShowPropertyDropdown(true);
                    }}
                    onFocus={() => setShowPropertyDropdown(true)}
                    placeholder="Search property ID..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                {showPropertyDropdown && propertySearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProperties.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No properties found</div>
                    ) : (
                      filteredProperties.slice(0, 8).map(prop => (
                        <button
                          key={prop.propertyId}
                          onClick={() => handlePropertySelect(prop)}
                          className="w-full px-4 py-2 text-left hover:bg-indigo-50 text-sm"
                        >
                          <span className="font-medium">{prop.propertyId}</span>
                          <span className="text-gray-500 ml-2">- {prop.communityName}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Property Name (Read-only) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Property Name
                </label>
                <input
                  type="text"
                  value={amcForm.propertyName}
                  readOnly
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700"
                  placeholder="Auto-filled from property"
                />
              </div>
            </div>
          </div>

          {/* Services Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Services
            </h3>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 mb-2 px-2">
              <div className="col-span-1 text-xs font-medium text-gray-500">#</div>
              <div className="col-span-5 text-xs font-medium text-gray-500">Service <span className="text-red-500">*</span></div>
              <div className="col-span-2 text-xs font-medium text-gray-500">Frequency</div>
              <div className="col-span-2 text-xs font-medium text-gray-500">Rate (₹) <span className="text-red-500">*</span></div>
              <div className="col-span-1 text-xs font-medium text-gray-500">Total</div>
              <div className="col-span-1"></div>
            </div>

            {/* Service Rows */}
            <div className="space-y-2">
              {amcForm.services.map((service, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-center bg-gray-50 rounded-lg p-2">
                  <div className="col-span-1 text-sm text-gray-600 font-medium pl-2">
                    {index + 1}
                  </div>
                  <div className="col-span-5">
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
                      value={service.frequency}
                      onChange={(e) => updateServiceRow(index, 'frequency', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 text-center"
                    />
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
                  <div className="col-span-1 text-sm text-gray-700 font-medium">
                    ₹{((parseFloat(service.rate) || 0) * (parseInt(service.frequency) || 1) * getDurationMultiplier()).toLocaleString()}
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

          {/* Billing Duration & Price Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* Billing Duration */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Billing Duration
              </h3>
              <select
                value={amcForm.billingDuration}
                onChange={(e) => setAmcForm({ ...amcForm, billingDuration: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              >
                {BILLING_DURATIONS.map(duration => (
                  <option key={duration.value} value={duration.value}>
                    {duration.label} ({duration.multiplier} month{duration.multiplier > 1 ? 's' : ''})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Total = Service Rate × Frequency × {getDurationMultiplier()} month(s)
              </p>
            </div>

            {/* AMC Price Card */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                AMC Price
              </h3>
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-5 text-white">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm opacity-90">
                    <span>Sub Total</span>
                    <span>₹{calculateSubTotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm opacity-90">
                    <span>GST (2%)</span>
                    <span>₹{calculateGST().toLocaleString()}</span>
                  </div>
                  <div className="border-t border-white/30 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Total Amount</span>
                      <span className="text-2xl font-bold">₹{calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
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

      {/* Save as Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Save as Template</h3>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateName('');
                  setIsDefaultTemplate(false);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Residential AMC"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefaultTemplate}
                  onChange={(e) => setIsDefaultTemplate(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Set as default template</span>
              </label>

              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p className="font-medium mb-1">Template will include:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>Billing Duration: {BILLING_DURATIONS.find(d => d.value === amcForm.billingDuration)?.label}</li>
                  <li>{amcForm.services.filter(s => s.name.trim()).length} service(s)</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setTemplateName('');
                  setIsDefaultTemplate(false);
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AMCPackageManager;
