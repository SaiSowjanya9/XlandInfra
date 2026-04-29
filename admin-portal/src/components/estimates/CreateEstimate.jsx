import { useState, useEffect } from 'react';
import { 
  Building2, User, Phone, Mail, Search, FileText, 
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase,
  Package, Send
} from 'lucide-react';
import ServiceRows from './ServiceRows';
import { 
  createEstimate, calculateEstimateTotal, getServices, PROPERTY_TYPES,
  getAMCPackageByPropertyId 
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

const GST_RATE = 0.02;

const CreateEstimate = ({ onSuccess, showToast }) => {
  const [estimateType, setEstimateType] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertyIdInput, setPropertyIdInput] = useState('');
  const [showPropertySuggestions, setShowPropertySuggestions] = useState(false);
  const [properties, setProperties] = useState([]);
  const [services, setServices] = useState([]);
  const [amcPackage, setAmcPackage] = useState(null);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [lastCreatedEstimate, setLastCreatedEstimate] = useState(null);
  const [estimateForm, setEstimateForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const props = await getProperties();
    setProperties(props);
    setServices(getServices());
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
    
    // Check for AMC package and auto-populate services
    const existingAMC = getAMCPackageByPropertyId(property.propertyId);
    if (existingAMC) {
      setAmcPackage(existingAMC);
      // Auto-populate services from AMC package
      const amcServices = existingAMC.services?.map(s => ({
        name: s.name,
        frequency: s.frequency || 1,
        frequencyType: s.frequencyType || 'Monthly',
        price: s.rate || s.price || ''
      })) || [];
      
      if (amcServices.length > 0) {
        setEstimateForm(prev => ({
          ...prev,
          services: amcServices
        }));
        showToast?.('AMC package services auto-populated', 'success');
      }
    } else {
      setAmcPackage(null);
    }
  };

  const calculateSubTotal = () => {
    return estimateForm.services.reduce((sum, service) => {
      const price = parseFloat(service.price) || 0;
      const frequency = parseInt(service.frequency) || 1;
      return sum + (price * frequency);
    }, 0);
  };

  const calculateGST = () => {
    return Math.round(calculateSubTotal() * GST_RATE);
  };

  const calculateTotal = () => {
    return calculateSubTotal() + calculateGST();
  };

  const handleCreateEstimate = () => {
    if (!estimateType) {
      showToast?.('Please select an estimate type', 'error');
      return;
    }
    if (estimateType === 'property' && !selectedProperty) {
      showToast?.('Please enter a valid Property ID', 'error');
      return;
    }
    if (estimateType === 'direct' && !estimateForm.customerName.trim()) {
      showToast?.('Customer name is required', 'error');
      return;
    }

    const validServices = estimateForm.services.filter(s => s.name.trim() && s.price);
    if (validServices.length === 0) {
      showToast?.('At least one service with price is required', 'error');
      return;
    }

    const estimateData = {
      estimateType: estimateType === 'property' ? 'property-based' : 'direct',
      services: validServices,
      notes: estimateForm.notes,
      subTotal: calculateSubTotal(),
      gst: calculateGST(),
      totalPrice: calculateTotal()
    };

    if (estimateType === 'property') {
      estimateData.propertyId = selectedProperty.propertyId;
      estimateData.propertyType = selectedProperty.entryType;
      estimateData.clientName = selectedProperty.associationContacts?.[0]?.name || selectedProperty.communityName;
      estimateData.communityName = selectedProperty.communityName;
      estimateData.customerEmail = selectedProperty.associationContacts?.[0]?.email || '';
      estimateData.customerPhone = selectedProperty.associationContacts?.[0]?.phone || '';
      
      if (amcPackage) {
        estimateData.amcPackageId = amcPackage.packageId;
      }
    } else {
      estimateData.customerName = estimateForm.customerName;
      estimateData.phone = estimateForm.phone;
      estimateData.email = estimateForm.email;
      estimateData.customerEmail = estimateForm.email;
    }

    const createdEstimate = createEstimate(estimateData);
    setLastCreatedEstimate(createdEstimate);
    
    const customerEmail = estimateData.customerEmail;
    if (customerEmail) {
      setShowEmailConfirm(true);
    } else {
      showToast?.('Estimate created successfully!', 'success');
      resetForm();
      if (onSuccess) onSuccess();
    }
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
    setEstimateForm({
      customerName: '',
      phone: '',
      email: '',
      services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }],
      notes: ''
    });
  };

  const addServiceRow = () => {
    setEstimateForm({
      ...estimateForm,
      services: [...estimateForm.services, { name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
  };

  const removeServiceRow = (index) => {
    if (estimateForm.services.length > 1) {
      setEstimateForm({
        ...estimateForm,
        services: estimateForm.services.filter((_, i) => i !== index)
      });
    }
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
            onClick={() => { setEstimateType('property'); setSelectedProperty(null); setPropertyIdInput(''); }}
            className={`p-6 rounded-xl border-2 transition-all ${
              estimateType === 'property'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <Building2 className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'property' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <p className="font-medium text-gray-800">Property-based</p>
            <p className="text-sm text-gray-500 mt-1">Enter Property ID to auto-fill details</p>
          </button>
          <button
            onClick={() => { setEstimateType('direct'); setSelectedProperty(null); setPropertyIdInput(''); }}
            className={`p-6 rounded-xl border-2 transition-all ${
              estimateType === 'direct'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <User className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'direct' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <p className="font-medium text-gray-800">Direct Customer</p>
            <p className="text-sm text-gray-500 mt-1">Enter customer details manually</p>
          </button>
        </div>
      </div>

      {/* Property ID Input with Auto-fill */}
      {estimateType === 'property' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Property Details</h3>
          
          <div className="relative mb-4">
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
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              />
            </div>
            
            {showPropertySuggestions && propertyIdInput && filteredProperties.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredProperties.slice(0, 8).map((prop) => {
                  const Icon = PROPERTY_ICONS[prop.entryType] || Building2;
                  return (
                    <button
                      key={prop.propertyId}
                      onClick={() => handlePropertySelect(prop)}
                      className="w-full p-3 text-left hover:bg-indigo-50 flex items-center gap-3"
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

          {selectedProperty && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Property Name</label>
                <p className="text-sm font-medium text-gray-800">{selectedProperty.communityName || selectedProperty.name}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Property Type</label>
                <p className="text-sm font-medium text-gray-800">{selectedProperty.entryType}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact Person</label>
                <p className="text-sm font-medium text-gray-800">
                  {selectedProperty.associationContacts?.[0]?.name || '-'}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Zone</label>
                <p className="text-sm font-medium text-gray-800">{selectedProperty.zone || '-'}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <p className="text-sm font-medium text-gray-800">
                  {selectedProperty.associationContacts?.[0]?.email || '-'}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <p className="text-sm font-medium text-gray-800">
                  {selectedProperty.associationContacts?.[0]?.phone || '-'}
                </p>
              </div>
            </div>
          )}

          {amcPackage && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <Package className="w-5 h-5" />
                <span className="font-medium">AMC Package Found</span>
              </div>
              <p className="text-sm text-green-600">
                Package ID: {amcPackage.packageId} | {amcPackage.services?.length || 0} services | 
                Total: ₹{(amcPackage.totalPrice || 0).toLocaleString()}
              </p>
              <p className="text-xs text-green-500 mt-1">
                Services have been auto-populated from this AMC package.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Direct Customer Form */}
      {estimateType === 'direct' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Details</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" /> Customer Name *
              </label>
              <input
                type="text"
                value={estimateForm.customerName}
                onChange={(e) => setEstimateForm({ ...estimateForm, customerName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                placeholder="Enter customer name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" /> Phone
              </label>
              <input
                type="tel"
                value={estimateForm.phone}
                onChange={(e) => setEstimateForm({ ...estimateForm, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" /> Email
              </label>
              <input
                type="email"
                value={estimateForm.email}
                onChange={(e) => setEstimateForm({ ...estimateForm, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                placeholder="Enter email address"
              />
            </div>
          </div>
        </div>
      )}

      {/* Services Selection */}
      {estimateType && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Services</h3>
          <ServiceRows
            services={estimateForm.services}
            onUpdate={updateServiceRow}
            onAdd={addServiceRow}
            onRemove={removeServiceRow}
            availableServices={services}
            onServicesUpdate={setServices}
          />
        </div>
      )}

      {/* Notes */}
      {estimateType && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Additional Notes</h3>
          <textarea
            value={estimateForm.notes}
            onChange={(e) => setEstimateForm({ ...estimateForm, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            placeholder="Enter any additional notes or terms..."
          />
        </div>
      )}

      {/* Total and Submit */}
      {estimateType && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-500 gap-8">
                  <span>Sub Total:</span>
                  <span className="font-medium text-gray-700">₹{calculateSubTotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 gap-8">
                  <span>GST (2%):</span>
                  <span className="font-medium text-gray-700">₹{calculateGST().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t border-gray-200 gap-8">
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="font-bold text-gray-800">₹{calculateTotal().toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={handleCreateEstimate}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Create Estimate
              </button>
            </div>
          </div>
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
