import { useState, useEffect } from 'react';
import { Edit, Trash2, Package, DollarSign, Home, LayoutGrid, Layers, TreePine, Map, Briefcase } from 'lucide-react';
import ServiceRows from './ServiceRows';
import {
  getAMCPackages, createAMCPackage, updateAMCPackage, deleteAMCPackage,
  getServices, calculateEstimateTotal, PROPERTY_TYPES
} from '../../utils/estimateStore';

const PROPERTY_ICONS = {
  APT: Home,
  Flats: LayoutGrid,
  GC: Layers,
  Villas: TreePine,
  Plots: Map,
  Commercial: Briefcase
};

const AMCPackage = ({ showToast }) => {
  const [amcPackages, setAmcPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [editingAMC, setEditingAMC] = useState(null);
  const [amcForm, setAMCForm] = useState({
    propertyType: '',
    propertyId: '',
    services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }],
    amcPrice: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setAmcPackages(getAMCPackages());
    setServices(getServices());
  };

  const handleSaveAMC = () => {
    if (!amcForm.propertyType) {
      showToast('Property type is required', 'error');
      return;
    }

    const validServices = amcForm.services.filter(s => s.name.trim());
    if (validServices.length === 0) {
      showToast('At least one service is required', 'error');
      return;
    }

    const packageData = {
      ...amcForm,
      services: validServices,
      totalPrice: calculateEstimateTotal({ services: validServices, amcPrice: amcForm.amcPrice })
    };

    if (editingAMC) {
      updateAMCPackage(editingAMC.packageId, packageData);
      showToast('AMC Package updated!');
      setEditingAMC(null);
    } else {
      createAMCPackage(packageData);
      showToast('AMC Package created!');
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setAMCForm({
      propertyType: '',
      propertyId: '',
      services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }],
      amcPrice: ''
    });
    setEditingAMC(null);
  };

  const handleEditAMC = (pkg) => {
    setEditingAMC(pkg);
    setAMCForm({
      propertyType: pkg.propertyType,
      propertyId: pkg.propertyId || '',
      services: pkg.services || [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }],
      amcPrice: pkg.amcPrice || ''
    });
  };

  const handleDeleteAMC = (packageId) => {
    deleteAMCPackage(packageId);
    showToast('AMC Package deleted');
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

  return (
    <div className="space-y-6">
      {/* AMC Form */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {editingAMC ? 'Edit AMC Package' : 'Create AMC Package'}
        </h3>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
            <select
              value={amcForm.propertyType}
              onChange={(e) => setAMCForm({ ...amcForm, propertyType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            >
              <option value="">Select property type</option>
              {PROPERTY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property ID (Optional)</label>
            <input
              type="text"
              value={amcForm.propertyId}
              onChange={(e) => setAMCForm({ ...amcForm, propertyId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              placeholder="Enter property ID"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AMC Price (₹)</label>
            <input
              type="number"
              min="0"
              value={amcForm.amcPrice}
              onChange={(e) => setAMCForm({ ...amcForm, amcPrice: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
              placeholder="Fixed AMC price"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Services</label>
          <ServiceRows
            services={amcForm.services}
            onUpdate={updateServiceRow}
            onAdd={addServiceRow}
            onRemove={removeServiceRow}
            availableServices={services}
            onServicesUpdate={setServices}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Total Package Value</p>
            <p className="text-2xl font-bold text-gray-800">
              ₹{calculateEstimateTotal({ services: amcForm.services, amcPrice: amcForm.amcPrice }).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            {editingAMC && (
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSaveAMC}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {editingAMC ? 'Update Package' : 'Create Package'}
            </button>
          </div>
        </div>
      </div>

      {/* AMC Packages List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">All AMC Packages</h3>
        </div>
        {amcPackages.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No AMC packages yet</p>
            <p className="text-sm text-gray-400">Create your first AMC package above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {amcPackages.map((pkg) => {
              const Icon = PROPERTY_ICONS[pkg.propertyType] || Package;
              return (
                <div key={pkg.packageId} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {pkg.propertyType} {pkg.propertyId && `- ${pkg.propertyId}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {pkg.services?.length || 0} services • Created {new Date(pkg.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Package Value</p>
                        <p className="font-semibold text-gray-800">
                          ₹{(pkg.totalPrice || calculateEstimateTotal(pkg)).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditAMC(pkg)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
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
                            {service.name}
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
