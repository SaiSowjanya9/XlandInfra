import { useState, useEffect } from 'react';
import { 
  Building2, User, Phone, Mail, Search, FileText, 
  Home, LayoutGrid, Layers, TreePine, Map, Briefcase 
} from 'lucide-react';
import ServiceRows from './ServiceRows';
import { 
  createEstimate, calculateEstimateTotal, getServices, PROPERTY_TYPES 
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

const CreateEstimate = ({ onSuccess, showToast }) => {
  const [estimateType, setEstimateType] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [properties, setProperties] = useState([]);
  const [services, setServices] = useState([]);
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
    const search = propertySearch.toLowerCase();
    return (
      prop.propertyId?.toLowerCase().includes(search) ||
      prop.communityName?.toLowerCase().includes(search) ||
      prop.entryType?.toLowerCase().includes(search) ||
      prop.associationContacts?.some(c => c.name?.toLowerCase().includes(search))
    );
  });

  const handleCreateEstimate = () => {
    if (!estimateType) {
      showToast('Please select an estimate type', 'error');
      return;
    }
    if (estimateType === 'property' && !selectedProperty) {
      showToast('Please select a property', 'error');
      return;
    }
    if (estimateType === 'direct' && !estimateForm.customerName.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }

    const validServices = estimateForm.services.filter(s => s.name.trim() && s.price);
    if (validServices.length === 0) {
      showToast('At least one service with price is required', 'error');
      return;
    }

    const estimateData = {
      estimateType: estimateType === 'property' ? 'property-based' : 'direct',
      services: validServices,
      notes: estimateForm.notes
    };

    if (estimateType === 'property') {
      estimateData.propertyId = selectedProperty.propertyId;
      estimateData.propertyType = selectedProperty.entryType;
      estimateData.clientName = selectedProperty.associationContacts?.[0]?.name || selectedProperty.communityName;
      estimateData.communityName = selectedProperty.communityName;
    } else {
      estimateData.customerName = estimateForm.customerName;
      estimateData.phone = estimateForm.phone;
      estimateData.email = estimateForm.email;
    }

    estimateData.totalPrice = calculateEstimateTotal(estimateData);
    createEstimate(estimateData);
    showToast('Estimate created successfully!');
    resetForm();
    if (onSuccess) onSuccess();
  };

  const resetForm = () => {
    setEstimateType(null);
    setSelectedProperty(null);
    setPropertySearch('');
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
            onClick={() => { setEstimateType('property'); setSelectedProperty(null); }}
            className={`p-6 rounded-xl border-2 transition-all ${
              estimateType === 'property'
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <Building2 className={`w-8 h-8 mx-auto mb-3 ${estimateType === 'property' ? 'text-indigo-600' : 'text-gray-400'}`} />
            <p className="font-medium text-gray-800">Property-based</p>
            <p className="text-sm text-gray-500 mt-1">Select from existing properties</p>
          </button>
          <button
            onClick={() => { setEstimateType('direct'); setSelectedProperty(null); }}
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

      {/* Property Selection */}
      {estimateType === 'property' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Property</h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={propertySearch}
              onChange={(e) => setPropertySearch(e.target.value)}
              placeholder="Search by property ID, community name, or contact..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredProperties.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No properties found</p>
            ) : (
              filteredProperties.slice(0, 10).map((prop) => {
                const Icon = PROPERTY_ICONS[prop.entryType] || Building2;
                return (
                  <button
                    key={prop.propertyId}
                    onClick={() => setSelectedProperty(prop)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedProperty?.propertyId === prop.propertyId
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-800">{prop.communityName}</p>
                        <p className="text-sm text-gray-500">
                          {prop.propertyId} • {prop.entryType}
                          {prop.associationContacts?.[0]?.name && ` • ${prop.associationContacts[0].name}`}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
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
              <p className="text-sm text-gray-500">Estimated Total</p>
              <p className="text-3xl font-bold text-gray-800">
                ₹{calculateEstimateTotal({ services: estimateForm.services }).toLocaleString()}
              </p>
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
    </div>
  );
};

export default CreateEstimate;
