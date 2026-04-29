import { useState, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Trash2,
  Package,
  Edit,
  Home,
  LayoutGrid,
  Layers,
  TreePine,
  Map,
  Briefcase,
  FileText,
  Lock
} from 'lucide-react';
import { getProperties } from '../utils/propertyStore';
import {
  getAMCPackages,
  createAMCPackage,
  updateAMCPackage,
  deleteAMCPackage,
  getServices,
  addService,
  FREQUENCY_TYPES
} from '../utils/estimateStore';

const PROPERTY_ICONS = {
  APT: Home,
  Flats: LayoutGrid,
  GC: Layers,
  Villas: TreePine,
  Plots: Map,
  Commercial: Briefcase
};

const GST_RATE = 0.02; // 2% GST as default

const CustomerContact = ({ user }) => {
  const [amcPackages, setAmcPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [editingAMC, setEditingAMC] = useState(null);
  const [toast, setToast] = useState(null);
  const [lockedEstimate, setLockedEstimate] = useState(null);
  
  const [amcForm, setAMCForm] = useState({
    propertyId: '',
    propertyName: '',
    blockTower: '',
    flatUnit: '',
    customerName: '',
    serviceType: '',
    services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '', gst: 2 }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setAmcPackages(getAMCPackages());
    setServices(getServices());
    const props = await getProperties();
    setProperties(props);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const calculateServiceTotal = (service) => {
    const price = parseFloat(service.price) || 0;
    const frequency = parseInt(service.frequency) || 1;
    return price * frequency;
  };

  const calculateSubTotal = () => {
    return amcForm.services.reduce((sum, service) => {
      return sum + calculateServiceTotal(service);
    }, 0);
  };

  const calculateGST = () => {
    return amcForm.services.reduce((sum, service) => {
      const serviceTotal = calculateServiceTotal(service);
      const gstRate = (parseFloat(service.gst) || 2) / 100;
      return sum + Math.round(serviceTotal * gstRate);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubTotal() + calculateGST();
  };

  const handlePropertySelect = (propertyId) => {
    if (!propertyId) {
      setAMCForm({
        ...amcForm,
        propertyId: '',
        propertyName: '',
        blockTower: '',
        flatUnit: '',
        customerName: ''
      });
      setLockedEstimate(null);
      return;
    }

    const property = properties.find(p => p.propertyId === propertyId);
    if (property) {
      // Auto-fill fields from property data
      let blockTower = '';
      let flatUnit = '';
      
      // Extract block/tower info
      if (property.blockInfo) {
        blockTower = property.blockInfo;
      } else if (property.blockNames && Object.keys(property.blockNames).length > 0) {
        blockTower = Object.values(property.blockNames).join(', ');
      } else if (property.numberOfBlocks) {
        blockTower = `${property.numberOfBlocks} Block(s)`;
      }
      
      // Extract flat/unit info
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
      
      // Get customer name from association contacts
      const customerName = property.associationContacts?.[0]?.name || '';
      
      setAMCForm({
        ...amcForm,
        propertyId: property.propertyId,
        propertyName: property.communityName || '',
        blockTower,
        flatUnit,
        customerName
      });

      // Check for existing locked estimate for this property
      const existingEstimate = amcPackages.find(
        pkg => pkg.propertyId === propertyId && pkg.status === 'generated'
      );
      
      if (existingEstimate) {
        setLockedEstimate(existingEstimate);
      } else {
        setLockedEstimate(null);
      }
    } else {
      setAMCForm({ ...amcForm, propertyId });
      setLockedEstimate(null);
    }
  };

  const handleServiceTypeChange = (serviceType) => {
    setAMCForm({ ...amcForm, serviceType });
    
    // If there's a locked estimate and user selects AMC, pre-fill with estimate data
    if (serviceType === 'amc' && lockedEstimate) {
      setAMCForm({
        ...amcForm,
        serviceType,
        services: lockedEstimate.services?.map(s => ({
          ...s,
          gst: s.gst || 2
        })) || [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '', gst: 2 }]
      });
    }
  };

  const handleSave = () => {
    if (!amcForm.propertyId) {
      showToast('Property ID is required', 'error');
      return;
    }

    const validServices = amcForm.services.filter(s => s.name.trim() && s.price);
    if (validServices.length === 0) {
      showToast('At least one service with price is required', 'error');
      return;
    }

    const packageData = {
      ...amcForm,
      services: validServices.map(s => ({ ...s, gst: s.gst || 2 })),
      subTotal: calculateSubTotal(),
      gst: calculateGST(),
      totalPrice: calculateTotal(),
      status: 'generated',
      propertyType: amcForm.propertyId.split('-')[0] || 'APT'
    };

    if (editingAMC) {
      updateAMCPackage(editingAMC.packageId, packageData);
      showToast('AMC Estimate updated successfully!');
      setEditingAMC(null);
    } else {
      createAMCPackage(packageData);
      showToast('AMC Estimate saved successfully!');
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setAMCForm({
      propertyId: '',
      propertyName: '',
      blockTower: '',
      flatUnit: '',
      customerName: '',
      serviceType: '',
      services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '', gst: 2 }]
    });
    setEditingAMC(null);
    setLockedEstimate(null);
  };

  const handleEditAMC = (pkg) => {
    setEditingAMC(pkg);
    setAMCForm({
      propertyId: pkg.propertyId || '',
      propertyName: pkg.propertyName || '',
      blockTower: pkg.blockTower || '',
      flatUnit: pkg.flatUnit || '',
      customerName: pkg.customerName || '',
      serviceType: pkg.serviceType || 'amc',
      services: pkg.services?.map(s => ({ ...s, gst: s.gst || 2 })) || [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '', gst: 2 }]
    });
    
    // Check for locked estimate
    const existingEstimate = amcPackages.find(
      p => p.propertyId === pkg.propertyId && p.status === 'generated' && p.packageId !== pkg.packageId
    );
    setLockedEstimate(existingEstimate || null);
  };

  const handleDeleteAMC = (packageId) => {
    deleteAMCPackage(packageId);
    showToast('AMC Estimate deleted');
    loadData();
  };

  const addServiceRow = () => {
    setAMCForm({
      ...amcForm,
      services: [...amcForm.services, { name: '', frequency: 1, frequencyType: 'Monthly', price: '', gst: 2 }]
    });
  };

  const removeServiceRow = (index) => {
    if (amcForm.services.length > 1) {
      setAMCForm({
        ...amcForm,
        services: amcForm.services.filter((_, i) => i !== index)
      });
    }
  };

  const updateServiceRow = (index, field, value) => {
    const newServices = [...amcForm.services];
    newServices[index] = { ...newServices[index], [field]: value };
    // Ensure GST stays at 2% by default when adding new services
    if (field === 'name' && !newServices[index].gst) {
      newServices[index].gst = 2;
    }
    setAMCForm({ ...amcForm, services: newServices });
  };

  const handleAddNewService = (serviceName) => {
    if (serviceName.trim()) {
      addService(serviceName.trim());
      setServices(getServices());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Customer Service Contact</h1>
              <p className="text-sm text-gray-500">Create and manage AMC estimates for customers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* AMC Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          {/* Estimate Details Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">AMC Estimate Details</h3>
          </div>
          
          <div className="px-6 py-4">
            <div className="grid grid-cols-5 gap-4 mb-4">
              {/* Property ID */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Prop ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={amcForm.propertyId}
                    onChange={(e) => handlePropertySelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="">Select Property</option>
                    {properties.map(prop => (
                      <option key={prop.propertyId} value={prop.propertyId}>{prop.propertyId}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              
              {/* Property Name - Auto-filled */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Property Name</label>
                <input
                  type="text"
                  value={amcForm.propertyName}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                  placeholder="Auto-filled"
                />
              </div>
              
              {/* Block / Tower - Auto-filled */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Block / Tower</label>
                <input
                  type="text"
                  value={amcForm.blockTower}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                  placeholder="Auto-filled"
                />
              </div>
              
              {/* Flat / Unit No. - Auto-filled */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Flat / Unit No.</label>
                <input
                  type="text"
                  value={amcForm.flatUnit}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                  placeholder="Auto-filled"
                />
              </div>
              
              {/* Customer Name - Auto-filled */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={amcForm.customerName}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                  placeholder="Auto-filled"
                />
              </div>
            </div>

            {/* Service Type - Wide dropdown */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Service Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={amcForm.serviceType}
                  onChange={(e) => handleServiceTypeChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="">Select Service Type</option>
                  <option value="amc">AMC (Annual Maintenance Contract)</option>
                  <option value="one-time">One-Time Service</option>
                  <option value="repair">Repair Service</option>
                  <option value="inspection">Inspection Service</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              
              {/* Show locked estimate info if available */}
              {lockedEstimate && amcForm.serviceType === 'amc' && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Lock className="w-4 h-4" />
                    <span className="text-sm font-medium">Locked Estimate Found</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    Estimate ID: {lockedEstimate.packageId} | Total: ₹{(lockedEstimate.totalPrice || 0).toLocaleString()} | 
                    Services: {lockedEstimate.services?.length || 0}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    The form has been pre-filled with the locked estimate details.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Services Section */}
          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-blue-600 mb-4">Services</h3>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 mb-2 px-2">
              <div className="col-span-1 text-xs font-medium text-gray-600">#</div>
              <div className="col-span-4 text-xs font-medium text-gray-600">
                Service <span className="text-red-500">*</span>
              </div>
              <div className="col-span-1 text-xs font-medium text-gray-600">
                Frequency
              </div>
              <div className="col-span-2 text-xs font-medium text-gray-600">
                Frequency Type
              </div>
              <div className="col-span-1 text-xs font-medium text-gray-600">
                Price (₹)
              </div>
              <div className="col-span-1 text-xs font-medium text-gray-600">
                GST (%)
              </div>
              <div className="col-span-1 text-xs font-medium text-gray-600">Total</div>
              <div className="col-span-1 text-xs font-medium text-gray-600 text-center">Action</div>
            </div>

            {/* Service Rows */}
            <div className="space-y-2">
              {amcForm.services.map((service, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-md p-2">
                  <div className="col-span-1 text-sm text-gray-600 font-medium pl-2">
                    {index + 1}
                  </div>
                  <div className="col-span-4">
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
                      {services.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__add_new__">+ Add New Service</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      value={service.frequency}
                      onChange={(e) => updateServiceRow(index, 'frequency', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 text-center"
                    />
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
                  <div className="col-span-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={service.gst || 2}
                      onChange={(e) => updateServiceRow(index, 'gst', parseFloat(e.target.value) || 2)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 text-center bg-yellow-50"
                    />
                  </div>
                  <div className="col-span-1 text-sm text-gray-800 font-medium">
                    {calculateServiceTotal(service).toLocaleString()}
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

          {/* Summary and Actions - Calculation on Right, Buttons Below */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <div className="w-80">
                {/* Calculation Section */}
                <div className="text-right space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sub Total (₹)</span>
                    <span className="font-medium text-gray-800">{calculateSubTotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (₹) @ 2%</span>
                    <span className="font-medium text-gray-800">{calculateGST().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm bg-blue-100 px-3 py-2 rounded-md">
                    <span className="font-semibold text-blue-700">Total Amount (₹)</span>
                    <span className="font-bold text-blue-700">{calculateTotal().toLocaleString()}</span>
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
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="px-6 py-3 border-t border-gray-200 bg-white">
            <p className="text-xs text-gray-500">
              * Currency: INR (₹) | GST Default: 2% for all services | Fields marked with * are mandatory
            </p>
          </div>
        </div>

        {/* All AMC Estimates List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">All AMC Estimates</h3>
          </div>
          {amcPackages.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No AMC estimates yet</p>
              <p className="text-sm text-gray-400">Create your first AMC estimate above</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {amcPackages.map((pkg) => {
                const Icon = PROPERTY_ICONS[pkg.propertyType] || Package;
                return (
                  <div key={pkg.packageId} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">
                              {pkg.propertyId} {pkg.propertyName && `- ${pkg.propertyName}`}
                            </p>
                            {pkg.status === 'draft' && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">Draft</span>
                            )}
                            {pkg.status === 'generated' && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {pkg.customerName && `${pkg.customerName} • `}
                            {pkg.blockTower && `Block: ${pkg.blockTower} • `}
                            {pkg.flatUnit && `Unit: ${pkg.flatUnit} • `}
                            {pkg.services?.length || 0} services
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Total Amount</p>
                          <p className="font-semibold text-gray-800">
                            ₹{(pkg.totalPrice || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditAMC(pkg)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAMC(pkg.packageId)}
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
                              {service.name} ({service.frequency}x {service.frequencyType}) - GST: {service.gst || 2}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-white'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerContact;
