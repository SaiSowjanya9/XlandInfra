import { useState, useEffect } from 'react';
import { Edit, Trash2, Package, Plus, Calendar, ChevronDown, Home, LayoutGrid, Layers, TreePine, Map, Briefcase } from 'lucide-react';
import ServiceSelector from './ServiceSelector';
import {
  getAMCPackages, createAMCPackage, updateAMCPackage, deleteAMCPackage,
  getServices, calculateEstimateTotal, PROPERTY_TYPES, FREQUENCY_TYPES
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

const GST_RATE = 0.18;

const AMCPackage = ({ showToast }) => {
  const [amcPackages, setAmcPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [editingAMC, setEditingAMC] = useState(null);
  const [amcForm, setAMCForm] = useState({
    propertyId: '',
    propertyName: '',
    blockTower: '',
    flatUnit: '',
    customerName: '',
    estimateDate: new Date().toISOString().split('T')[0],
    services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
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
    return Math.round(calculateSubTotal() * GST_RATE);
  };

  const calculateTotal = () => {
    return calculateSubTotal() + calculateGST();
  };

  const handleSaveAMC = (isDraft = false) => {
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
      services: validServices,
      subTotal: calculateSubTotal(),
      gst: calculateGST(),
      totalPrice: calculateTotal(),
      status: isDraft ? 'draft' : 'generated',
      propertyType: amcForm.propertyId.split('-')[0] || 'APT'
    };

    if (editingAMC) {
      updateAMCPackage(editingAMC.packageId, packageData);
      showToast(isDraft ? 'Draft saved!' : 'AMC Estimate updated!');
      setEditingAMC(null);
    } else {
      createAMCPackage(packageData);
      showToast(isDraft ? 'Draft saved!' : 'AMC Estimate generated!');
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
      estimateDate: new Date().toISOString().split('T')[0],
      services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
    setEditingAMC(null);
  };

  const handleEditAMC = (pkg) => {
    setEditingAMC(pkg);
    setAMCForm({
      propertyId: pkg.propertyId || '',
      propertyName: pkg.propertyName || '',
      blockTower: pkg.blockTower || '',
      flatUnit: pkg.flatUnit || '',
      customerName: pkg.customerName || '',
      estimateDate: pkg.estimateDate || new Date().toISOString().split('T')[0],
      services: pkg.services || [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
  };

  const handleDeleteAMC = (packageId) => {
    deleteAMCPackage(packageId);
    showToast('AMC Estimate deleted');
    loadData();
  };

  const addServiceRow = () => {
    setAMCForm({
      ...amcForm,
      services: [...amcForm.services, { name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
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
    setAMCForm({ ...amcForm, services: newServices });
  };

  const handlePropertySelect = (propertyId) => {
    const property = properties.find(p => p.propertyId === propertyId);
    if (property) {
      setAMCForm({
        ...amcForm,
        propertyId: property.propertyId,
        propertyName: property.communityName || '',
        customerName: property.associationContacts?.[0]?.name || ''
      });
    } else {
      setAMCForm({ ...amcForm, propertyId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-blue-600">2. AMC (Annual Maintenance Contract)</h2>
      </div>

      {/* AMC Form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Estimate Details Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">Estimate Details</h3>
        </div>
        
        <div className="px-6 py-4">
          <div className="grid grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Property ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={amcForm.propertyId}
                  onChange={(e) => handlePropertySelect(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
                >
                  <option value="">APT-1001</option>
                  {properties.map(prop => (
                    <option key={prop.propertyId} value={prop.propertyId}>{prop.propertyId}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Property Name</label>
              <input
                type="text"
                value={amcForm.propertyName}
                onChange={(e) => setAMCForm({ ...amcForm, propertyName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-gray-50"
                placeholder="Green City Apartments"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Block / Tower</label>
              <input
                type="text"
                value={amcForm.blockTower}
                onChange={(e) => setAMCForm({ ...amcForm, blockTower: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="A"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Flat / Unit No.</label>
              <input
                type="text"
                value={amcForm.flatUnit}
                onChange={(e) => setAMCForm({ ...amcForm, flatUnit: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="A-101"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name</label>
              <input
                type="text"
                value={amcForm.customerName}
                onChange={(e) => setAMCForm({ ...amcForm, customerName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="Ramesh Kumar"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Estimate Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={amcForm.estimateDate}
                  onChange={(e) => setAMCForm({ ...amcForm, estimateDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AMC Services Section */}
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-blue-600 mb-4">AMC Services</h3>
          
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 mb-2 px-2">
            <div className="col-span-1 text-xs font-medium text-gray-600">#</div>
            <div className="col-span-3 text-xs font-medium text-gray-600">
              Service <span className="text-red-500">*</span>
            </div>
            <div className="col-span-2 text-xs font-medium text-gray-600">
              Frequency (Visits) <span className="text-red-500">*</span>
            </div>
            <div className="col-span-2 text-xs font-medium text-gray-600">
              Frequency Type <span className="text-red-500">*</span>
            </div>
            <div className="col-span-2 text-xs font-medium text-gray-600">
              Price (₹) <span className="text-red-500">*</span>
            </div>
            <div className="col-span-1 text-xs font-medium text-gray-600">Total (₹)</div>
            <div className="col-span-1 text-xs font-medium text-gray-600 text-center">Action</div>
          </div>

          {/* Service Rows */}
          <div className="space-y-2">
            {amcForm.services.map((service, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-md p-2">
                <div className="col-span-1 text-sm text-gray-600 font-medium pl-2">
                  {index + 1}
                </div>
                <div className="col-span-3">
                  <ServiceSelector
                    value={service.name}
                    onChange={(val) => updateServiceRow(index, 'name', val)}
                    services={services}
                    onServicesUpdate={setServices}
                  />
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    value={service.frequency}
                    onChange={(e) => updateServiceRow(index, 'frequency', parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 text-center"
                  />
                  <span className="text-xs text-gray-500">(Visits per Drop Down)</span>
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
                    placeholder="15000"
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

        {/* Summary and Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-end">
            <div></div>
            <div className="flex gap-8 items-end">
              {/* Totals */}
              <div className="text-right space-y-1">
                <div className="flex justify-between gap-8 text-sm">
                  <span className="text-gray-600">Sub Total (₹)</span>
                  <span className="font-medium text-gray-800 w-24 text-right">{calculateSubTotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-8 text-sm">
                  <span className="text-gray-600">GST (₹)</span>
                  <span className="font-medium text-gray-800 w-24 text-right">{calculateGST().toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-8 text-sm bg-blue-50 px-3 py-2 rounded-md -mx-3">
                  <span className="font-semibold text-blue-700">Total AMC Price (₹)</span>
                  <span className="font-bold text-blue-700 w-24 text-right">{calculateTotal().toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="px-6 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveAMC(true)}
                  className="px-6 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  onClick={() => handleSaveAMC(false)}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Generate Estimate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 border-t border-gray-200 bg-white">
          <p className="text-xs text-gray-500">
            * Currency: INR (₹) | Price Input: Per selected frequency | Frequency (Visits): Number of visits each time (per drop down)
          </p>
        </div>
      </div>

      {/* AMC Packages List */}
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
                        </div>
                        <p className="text-sm text-gray-500">
                          {pkg.customerName && `${pkg.customerName} • `}
                          {pkg.services?.length || 0} services • {new Date(pkg.estimateDate || pkg.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAMC(pkg.packageId)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
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
                            {service.name} ({service.frequency}x {service.frequencyType})
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
  );
};

export default AMCPackage;
