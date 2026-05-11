import { useState, useEffect } from 'react';
import { Edit, Trash2, Package, Plus, ChevronDown, Home, LayoutGrid, Layers, TreePine, Map, Briefcase, Lock, X, PlusCircle } from 'lucide-react';
import {
  getAMCPackages, createAMCPackage, updateAMCPackage, deleteAMCPackage,
  getAddons, FREQUENCY_TYPES, createEstimate, seedTestData
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

const GST_RATE = 0.02; // 2% GST applied at estimate level only

const AMCPackage = ({ showToast }) => {
  // Core data
  const [amcPackages, setAmcPackages] = useState([]); // Created AMC Packages
  const [availableAddons, setAvailableAddons] = useState([]); // Add-ons from Add-ons Manager
  const [properties, setProperties] = useState([]);
  const [savedEstimates, setSavedEstimates] = useState([]); // Property-based estimates list
  
  // Form state
  const [editingEstimate, setEditingEstimate] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null); // Selected AMC Package
  const [selectedAddons, setSelectedAddons] = useState([]); // Selected add-ons from dropdown
  const [discount, setDiscount] = useState(''); // Discount amount
  
  const [estimateForm, setEstimateForm] = useState({
    propertyId: '',
    propertyName: '',
    blockTower: '',
    flatUnit: '',
    customerName: '',
    estimateDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Don't call seedTestData here - it can cause deleted items to reappear
    setAmcPackages(getAMCPackages());
    setAvailableAddons(getAddons());
    const props = await getProperties();
    setProperties(props);
  };

  // Calculate package price
  const getPackagePrice = () => {
    return selectedPackage ? (parseFloat(selectedPackage.rate) || 0) : 0;
  };

  // Calculate total add-ons price
  const getAddonsTotal = () => {
    return selectedAddons.reduce((sum, addon) => {
      // Each addon has services with prices
      const addonTotal = addon.services?.reduce((s, service) => {
        const price = parseFloat(service.price) || 0;
        const frequency = parseInt(service.frequency) || 1;
        return s + (price * frequency);
      }, 0) || addon.totalPrice || 0;
      return sum + addonTotal;
    }, 0);
  };

  // Calculate subtotal (Package + Add-ons)
  const calculateSubTotal = () => {
    return getPackagePrice() + getAddonsTotal();
  };

  // Calculate GST (2% on subtotal)
  const calculateGST = () => {
    return Math.round(calculateSubTotal() * GST_RATE);
  };

  // Calculate discount amount
  const getDiscountAmount = () => {
    return parseFloat(discount) || 0;
  };

  // Calculate final total: (Package + Add-ons) + GST - Discount
  const calculateTotal = () => {
    return calculateSubTotal() + calculateGST() - getDiscountAmount();
  };

  // Handle AMC Package selection
  const handlePackageSelect = (packageId) => {
    if (!packageId) {
      setSelectedPackage(null);
      return;
    }
    const pkg = amcPackages.find(p => p.packageId === packageId);
    setSelectedPackage(pkg || null);
  };

  // Handle adding an add-on from dropdown
  const handleAddAddon = (addonId) => {
    if (!addonId) return;
    const addon = availableAddons.find(a => a.addonId === addonId);
    if (addon && !selectedAddons.find(a => a.addonId === addonId)) {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  // Handle removing an add-on
  const handleRemoveAddon = (addonId) => {
    setSelectedAddons(selectedAddons.filter(a => a.addonId !== addonId));
  };

  // Handle save estimate
  const handleSaveEstimate = () => {
    if (!estimateForm.propertyId) {
      showToast('Property ID is required', 'error');
      return;
    }

    if (!selectedPackage) {
      showToast('Please select an AMC Package', 'error');
      return;
    }

    const estimateData = {
      ...estimateForm,
      packageId: selectedPackage.packageId,
      packageName: selectedPackage.packageName,
      packageRate: getPackagePrice(),
      addons: selectedAddons.map(a => ({
        addonId: a.addonId,
        services: a.services,
        totalPrice: a.totalPrice
      })),
      addonsTotal: getAddonsTotal(),
      subTotal: calculateSubTotal(),
      gst: calculateGST(),
      discount: getDiscountAmount(),
      totalPrice: calculateTotal(),
      status: 'generated',
      propertyType: estimateForm.propertyId.split('-')[0] || 'APT'
    };

    if (editingEstimate) {
      // Update existing estimate - store as AMC Package for now
      updateAMCPackage(editingEstimate.packageId, estimateData);
      showToast('Estimate updated successfully!');
      setEditingEstimate(null);
    } else {
      // Create new estimate
      createAMCPackage(estimateData);
      showToast('Estimate saved successfully!');
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setEstimateForm({
      propertyId: '',
      propertyName: '',
      blockTower: '',
      flatUnit: '',
      customerName: '',
      estimateDate: new Date().toISOString().split('T')[0]
    });
    setSelectedPackage(null);
    setSelectedAddons([]);
    setDiscount('');
    setEditingEstimate(null);
  };

  const handleEditEstimate = (estimate) => {
    setEditingEstimate(estimate);
    setEstimateForm({
      propertyId: estimate.propertyId || '',
      propertyName: estimate.propertyName || '',
      blockTower: estimate.blockTower || '',
      flatUnit: estimate.flatUnit || '',
      customerName: estimate.customerName || '',
      estimateDate: estimate.estimateDate || new Date().toISOString().split('T')[0]
    });
    
    // Restore selected package
    if (estimate.packageId) {
      const pkg = amcPackages.find(p => p.packageId === estimate.packageId);
      setSelectedPackage(pkg || null);
    }
    
    // Restore selected addons
    if (estimate.addons && estimate.addons.length > 0) {
      const restoredAddons = estimate.addons.map(a => 
        availableAddons.find(addon => addon.addonId === a.addonId)
      ).filter(Boolean);
      setSelectedAddons(restoredAddons);
    }
    
    // Restore discount
    setDiscount(estimate.discount?.toString() || '');
  };

  const handleDeleteEstimate = (packageId) => {
    if (window.confirm('Are you sure you want to delete this estimate?')) {
      deleteAMCPackage(packageId);
      // Update local state immediately (without calling loadData to avoid any re-seeding)
      setAmcPackages(prevPackages => prevPackages.filter(pkg => pkg.packageId !== packageId));
      showToast('Estimate deleted');
    }
  };

  const handlePropertySelect = (propertyId) => {
    if (!propertyId) {
      setEstimateForm({
        ...estimateForm,
        propertyId: '',
        propertyName: '',
        blockTower: '',
        flatUnit: '',
        customerName: ''
      });
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
      
      // Get customer name from contacts
      const customerName = property.contacts?.[0]?.name || property.associationContacts?.[0]?.name || '';
      
      setEstimateForm({
        ...estimateForm,
        propertyId: property.propertyId,
        propertyName: property.communityName || property.name || '',
        blockTower,
        flatUnit,
        customerName
      });
    } else {
      setEstimateForm({ ...estimateForm, propertyId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-blue-600">Property-Based Estimate</h2>
        <p className="text-sm text-gray-500">Select an AMC Package and customize with add-ons</p>
      </div>

      {/* Estimate Form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Property Details Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">Property Details</h3>
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
                  value={estimateForm.propertyId}
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
                value={estimateForm.propertyName}
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
                value={estimateForm.blockTower}
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
                value={estimateForm.flatUnit}
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
                value={estimateForm.customerName}
                readOnly
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-700"
                placeholder="Auto-filled"
              />
            </div>
          </div>

          {/* Estimate Date */}
          <div className="mb-4 max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Estimate Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={estimateForm.estimateDate}
              onChange={(e) => setEstimateForm({ ...estimateForm, estimateDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
            />
          </div>
        </div>

        {/* AMC Package Selection Section */}
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-blue-600 mb-4">AMC Package</h3>
          
          {/* AMC Package Dropdown */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Select AMC Package <span className="text-red-500">*</span>
            </label>
            <div className="relative max-w-md">
              <select
                value={selectedPackage?.packageId || ''}
                onChange={(e) => handlePackageSelect(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">Select a Package (e.g., Gold, Silver, Platinum)</option>
                {amcPackages.map(pkg => (
                  <option key={pkg.packageId} value={pkg.packageId}>
                    {pkg.packageName || pkg.packageId} - ₹{(pkg.rate || 0).toLocaleString()}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            {amcPackages.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No packages available. Create packages in AMC Packages first.
              </p>
            )}
          </div>

          {/* Selected Package Details */}
          {selectedPackage && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">{selectedPackage.packageName}</span>
                  <span className="text-xs text-blue-600">({selectedPackage.packageId})</span>
                </div>
                <span className="text-lg font-bold text-blue-700">₹{getPackagePrice().toLocaleString()}</span>
              </div>
              {selectedPackage.services && (
                <div className="text-sm text-blue-700">
                  <span className="font-medium">Services: </span>
                  {typeof selectedPackage.services === 'string' 
                    ? selectedPackage.services 
                    : Array.isArray(selectedPackage.services) 
                      ? selectedPackage.services.map(s => s.name || s).join(', ')
                      : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add-ons Section */}
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-green-600 mb-4">Add Services (from Add-ons)</h3>
          
          {/* Add-on Dropdown */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <select
                onChange={(e) => {
                  handleAddAddon(e.target.value);
                  e.target.value = ''; // Reset dropdown after selection
                }}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-green-200 focus:border-green-500 appearance-none bg-white"
              >
                <option value="">+ Add Service from Add-ons</option>
                {availableAddons
                  .filter(addon => !selectedAddons.find(a => a.addonId === addon.addonId))
                  .map(addon => (
                    <option key={addon.addonId} value={addon.addonId}>
                      {addon.addonId} - {addon.services?.map(s => s.name).join(', ')} (₹{(addon.totalPrice || 0).toLocaleString()})
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {availableAddons.length === 0 && (
            <p className="text-xs text-amber-600 mb-4">
              No add-ons available. Create add-ons in the Add-ons section first.
            </p>
          )}

          {/* Selected Add-ons List */}
          {selectedAddons.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 mb-2">Selected Add-ons:</p>
              {selectedAddons.map((addon) => (
                <div key={addon.addonId} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{addon.addonId}</p>
                      <p className="text-xs text-gray-600">
                        {addon.services?.map(s => `${s.name} (${s.frequency}x ${s.frequencyType})`).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-green-700">₹{(addon.totalPrice || 0).toLocaleString()}</span>
                    <button
                      onClick={() => handleRemoveAddon(addon.addonId)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                      title="Remove Add-on"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Summary Section */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Price Summary</h3>
          
          <div className="flex justify-end">
            <div className="w-96">
              {/* Package Price */}
              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                <span className="text-gray-600">
                  AMC Package: <span className="font-medium">{selectedPackage?.packageName || 'Not selected'}</span>
                </span>
                <span className="font-medium text-gray-800">₹{getPackagePrice().toLocaleString()}</span>
              </div>
              
              {/* Add-ons Total */}
              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                <span className="text-gray-600">
                  Add-ons ({selectedAddons.length})
                </span>
                <span className="font-medium text-gray-800">₹{getAddonsTotal().toLocaleString()}</span>
              </div>
              
              {/* Subtotal */}
              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                <span className="text-gray-600">Sub Total</span>
                <span className="font-medium text-gray-800">₹{calculateSubTotal().toLocaleString()}</span>
              </div>
              
              {/* GST */}
              <div className="flex justify-between text-sm py-2 border-b border-gray-200">
                <span className="text-gray-600">GST (2%)</span>
                <span className="font-medium text-gray-800">₹{calculateGST().toLocaleString()}</span>
              </div>
              
              {/* Discount */}
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-600">Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="w-28 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-200"
                />
              </div>
              
              {/* Total */}
              <div className="flex justify-between text-base py-3 bg-blue-100 px-3 rounded-md mt-2">
                <span className="font-semibold text-blue-700">Total Amount</span>
                <span className="font-bold text-blue-700">₹{calculateTotal().toLocaleString()}</span>
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
                  onClick={handleSaveEstimate}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save Estimate
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
      </div>

      {/* All Property-Based Estimates List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">All Property-Based Estimates</h3>
        </div>
        {amcPackages.filter(p => p.propertyId).length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No property-based estimates yet</p>
            <p className="text-sm text-gray-400">Create your first estimate above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {amcPackages.filter(p => p.propertyId).map((estimate) => {
              const Icon = PROPERTY_ICONS[estimate.propertyType] || Package;
              return (
                <div key={estimate.packageId} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">
                            {estimate.propertyId} {estimate.propertyName && `- ${estimate.propertyName}`}
                          </p>
                          {estimate.packageName && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              {estimate.packageName}
                            </span>
                          )}
                          {estimate.status === 'generated' && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {estimate.customerName && `${estimate.customerName} • `}
                          {estimate.addons?.length > 0 && `${estimate.addons.length} add-on(s) • `}
                          {estimate.discount > 0 && `Discount: ₹${estimate.discount}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Amount</p>
                        <p className="font-semibold text-gray-800">
                          ₹{(estimate.totalPrice || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditEstimate(estimate)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEstimate(estimate.packageId)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
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
