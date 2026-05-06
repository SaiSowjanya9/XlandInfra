import { useState, useEffect } from 'react';
import { Trash2, PlusCircle, DollarSign, ChevronDown, Plus } from 'lucide-react';
import {
  getAddons, createAddon, deleteAddon,
  getServices, calculateEstimateTotal, seedTestData, FREQUENCY_TYPES
} from '../../utils/estimateStore';

const AddonsManager = ({ showToast }) => {
  const [addons, setAddons] = useState([]);
  const [services, setServices] = useState([]);
  const [addonForm, setAddonForm] = useState({
    serviceName: '',
    frequencyCount: 1,
    frequencyType: 'Monthly',
    price: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    seedTestData();
    setAddons(getAddons());
    setServices(getServices());
  };

  const handleSaveAddon = () => {
    if (!addonForm.serviceName.trim()) {
      showToast('Please select or enter a service name', 'error');
      return;
    }
    if (!addonForm.price || parseFloat(addonForm.price) <= 0) {
      showToast('Please enter a valid price', 'error');
      return;
    }

    const addonData = {
      services: [{
        name: addonForm.serviceName.trim(),
        frequency: parseInt(addonForm.frequencyCount) || 1,
        frequencyType: addonForm.frequencyType,
        price: parseFloat(addonForm.price)
      }],
      totalPrice: parseFloat(addonForm.price)
    };

    createAddon(addonData);
    showToast('Add-on created!');
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setAddonForm({
      serviceName: '',
      frequencyCount: 1,
      frequencyType: 'Monthly',
      price: ''
    });
  };

  const handleDeleteAddon = (addonId) => {
    if (window.confirm('Are you sure you want to delete this add-on?')) {
      deleteAddon(addonId);
      showToast('Add-on deleted');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
          <PlusCircle className="w-5 h-5 text-stone-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add-ons</h1>
          <p className="text-sm text-gray-500">Create optional services for AMC packages</p>
        </div>
      </div>

      {/* Add-on Form - Simple Layout */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">Create Add-on</h3>
        </div>

        <div className="p-6">
          {/* Single Row Layout: Select Service | Frequency Count | Frequency Type | Price | Save */}
          <div className="grid grid-cols-12 gap-4 items-end">
            {/* Select Service - First */}
            <div className="col-span-4">
              <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Select Service</label>
              <input
                type="text"
                list="service-options"
                value={addonForm.serviceName}
                onChange={(e) => setAddonForm({ ...addonForm, serviceName: e.target.value })}
                placeholder="Select or type service name"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400"
              />
              <datalist id="service-options">
                {services.map((service, idx) => (
                  <option key={idx} value={service} />
                ))}
              </datalist>
            </div>

            {/* Frequency Count */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Frequency Count</label>
              <input
                type="number"
                min="1"
                value={addonForm.frequencyCount}
                onChange={(e) => setAddonForm({ ...addonForm, frequencyCount: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400"
              />
            </div>

            {/* Frequency Type */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Frequency Type</label>
              <div className="relative">
                <select
                  value={addonForm.frequencyType}
                  onChange={(e) => setAddonForm({ ...addonForm, frequencyType: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400 bg-white appearance-none"
                >
                  {FREQUENCY_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Price */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 mb-2 block uppercase tracking-wider">Price (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={addonForm.price}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setAddonForm({ ...addonForm, price: value });
                  }}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-200 focus:border-stone-400 font-medium"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="col-span-2">
              <button
                onClick={handleSaveAddon}
                className="w-full px-4 py-2.5 bg-stone-700 text-white rounded-lg hover:bg-stone-800 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* All Add-ons List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">All Add-ons</h3>
          <p className="text-sm text-gray-500">{addons.length} add-on(s) available</p>
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
              <div key={addon.addonId} className="p-4 hover:bg-stone-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center">
                      <PlusCircle className="w-5 h-5 text-stone-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        {addon.services?.[0]?.name || addon.addonId}
                      </p>
                      <p className="text-sm text-gray-500">
                        {addon.services?.[0]?.frequency || 1}x {addon.services?.[0]?.frequencyType || 'Monthly'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase">Price</p>
                      <p className="text-lg font-semibold text-stone-700">
                        ₹{(addon.totalPrice || addon.services?.[0]?.price || 0).toLocaleString()}
                      </p>
                    </div>
                    {/* Only Delete button - NO Edit button */}
                    <button
                      onClick={() => handleDeleteAddon(addon.addonId)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddonsManager;
