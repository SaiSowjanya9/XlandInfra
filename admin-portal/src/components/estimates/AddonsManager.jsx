import { useState, useEffect } from 'react';
import { Edit, Trash2, PlusCircle, DollarSign } from 'lucide-react';
import ServiceRows from './ServiceRows';
import {
  getAddons, createAddon, updateAddon, deleteAddon,
  getServices, calculateEstimateTotal, seedTestData
} from '../../utils/estimateStore';

const AddonsManager = ({ showToast }) => {
  const [addons, setAddons] = useState([]);
  const [services, setServices] = useState([]);
  const [editingAddon, setEditingAddon] = useState(null);
  const [addonForm, setAddonForm] = useState({
    services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Seed test data if none exists
    seedTestData();
    setAddons(getAddons());
    setServices(getServices());
  };

  const handleSaveAddon = () => {
    const validServices = addonForm.services.filter(s => s.name.trim() && s.price);
    if (validServices.length === 0) {
      showToast('At least one service with price is required', 'error');
      return;
    }

    const addonData = {
      services: validServices,
      totalPrice: calculateEstimateTotal({ services: validServices })
    };

    if (editingAddon) {
      updateAddon(editingAddon.addonId, addonData);
      showToast('Add-on updated!');
      setEditingAddon(null);
    } else {
      createAddon(addonData);
      showToast('Add-on created!');
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setAddonForm({
      services: [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
    setEditingAddon(null);
  };

  const handleEditAddon = (addon) => {
    setEditingAddon(addon);
    setAddonForm({
      services: addon.services || [{ name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
  };

  const handleDeleteAddon = (addonId) => {
    deleteAddon(addonId);
    showToast('Add-on deleted');
    loadData();
  };

  const addServiceRow = () => {
    setAddonForm({
      ...addonForm,
      services: [...addonForm.services, { name: '', frequency: 1, frequencyType: 'Monthly', price: '' }]
    });
  };

  const removeServiceRow = (index) => {
    if (addonForm.services.length > 1) {
      setAddonForm({
        ...addonForm,
        services: addonForm.services.filter((_, i) => i !== index)
      });
    }
  };

  const updateServiceRow = (index, field, value) => {
    const newServices = [...addonForm.services];
    newServices[index] = { ...newServices[index], [field]: value };
    setAddonForm({ ...addonForm, services: newServices });
  };

  return (
    <div className="space-y-6">
      {/* Add-on Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {editingAddon ? 'Edit Add-on' : 'Create Add-on'}
              </h3>
              <p className="text-sm text-gray-500">Define optional services that can be added to AMC packages</p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <ServiceRows
            services={addonForm.services}
            onUpdate={updateServiceRow}
            onAdd={addServiceRow}
            onRemove={removeServiceRow}
            availableServices={services}
            onServicesUpdate={setServices}
          />
        </div>

        {/* Footer with Total and Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-white rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Total Add-on Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{calculateEstimateTotal({ services: addonForm.services }).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {editingAddon && (
                <button
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveAddon}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {editingAddon ? 'Update Add-on' : 'Save Add-on'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add-ons List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">All Add-ons</h3>
        </div>
        {addons.length === 0 ? (
          <div className="p-12 text-center">
            <PlusCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No add-ons yet</p>
            <p className="text-sm text-gray-400">Create your first add-on above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {addons.map((addon) => (
              <div key={addon.addonId} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <PlusCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {addon.addonId}
                      </p>
                      <p className="text-sm text-gray-500">
                        {addon.services?.length || 0} services • Created {new Date(addon.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Value</p>
                      <p className="font-semibold text-gray-800">
                        ₹{(addon.totalPrice || calculateEstimateTotal(addon)).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditAddon(addon)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAddon(addon.addonId)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {addon.services && addon.services.length > 0 && (
                  <div className="mt-3 ml-14">
                    <div className="flex flex-wrap gap-2">
                      {addon.services.map((service, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                        >
                          {service.name} - ₹{service.price}
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
    </div>
  );
};

export default AddonsManager;
