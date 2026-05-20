import { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Package,
  PlusCircle,
  Archive,
  List,
  Trash2,
  EyeOff
} from 'lucide-react';

const ManagerEstimates = ({ user, defaultTab = 'list' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [estimates, setEstimates] = useState([]);
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('estimate');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [estimateForm, setEstimateForm] = useState({
    clientId: '',
    propertyId: '',
    title: '',
    description: '',
    estimateType: 'property_based',
    subtotal: 0,
    taxPercentage: 18,
    discountPercentage: 0,
    validUntil: '',
    items: [{ description: '', quantity: 1, unitPrice: 0 }]
  });

  const [amcForm, setAmcForm] = useState({
    name: '',
    description: '',
    durationMonths: 12,
    basePrice: 0,
    services: '',
    termsConditions: '',
    hidePricing: false
  });

  const [addonForm, setAddonForm] = useState({
    name: '',
    description: '',
    price: 0,
    unit: 'per_service',
    categoryId: '',
    hidePricing: false
  });

  const token = sessionStorage.getItem('pm_auth_token');

  const tabs = [
    { id: 'list', label: 'All Estimates', icon: List },
    { id: 'create', label: 'Create Estimate', icon: Plus },
    { id: 'amc', label: 'AMC Packages', icon: Package },
    { id: 'addons', label: 'Add-ons', icon: PlusCircle },
    { id: 'archived', label: 'Archived', icon: Archive }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [estRes, amcRes, addRes, custRes, propRes, catRes] = await Promise.all([
        fetch(`/api/manager/estimates${activeTab === 'archived' ? '?archived=true' : '?archived=false'}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/amc-packages', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/addons', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/manager/categories', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [estData, amcData, addData, custData, propData, catData] = await Promise.all([
        estRes.json(), amcRes.json(), addRes.json(), custRes.json(), propRes.json(), catRes.json()
      ]);

      if (estData.success) setEstimates(estData.data);
      if (amcData.success) setAmcPackages(amcData.data);
      if (addData.success) setAddons(addData.data);
      if (custData.success) setCustomers(custData.data);
      if (propData.success) setProperties(propData.data);
      if (catData.success) setCategories(catData.data);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleEstimateSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    try {
      const response = await fetch('/api/manager/estimates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...estimateForm,
          subtotal,
          items: estimateForm.items.map(item => ({
            ...item,
            totalPrice: item.quantity * item.unitPrice
          }))
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Estimate created successfully!' });
        resetEstimateForm();
        fetchData();
        setActiveTab('list');
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create estimate' });
    }
  };

  const handleAmcSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/manager/amc-packages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...amcForm,
          services: amcForm.services.split(',').map(s => s.trim()).filter(Boolean)
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'AMC Package created successfully!' });
        setShowModal(false);
        resetAmcForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create AMC package' });
    }
  };

  const handleAddonSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('/api/manager/addons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addonForm)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Add-on created successfully!' });
        setShowModal(false);
        resetAddonForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create add-on' });
    }
  };

  const resetEstimateForm = () => {
    setEstimateForm({
      clientId: '',
      propertyId: '',
      title: '',
      description: '',
      estimateType: 'property_based',
      subtotal: 0,
      taxPercentage: 18,
      discountPercentage: 0,
      validUntil: '',
      items: [{ description: '', quantity: 1, unitPrice: 0 }]
    });
  };

  const resetAmcForm = () => {
    setAmcForm({
      name: '',
      description: '',
      durationMonths: 12,
      basePrice: 0,
      services: '',
      termsConditions: '',
      hidePricing: false
    });
  };

  const resetAddonForm = () => {
    setAddonForm({
      name: '',
      description: '',
      price: 0,
      unit: 'per_service',
      categoryId: '',
      hidePricing: false
    });
  };

  const addLineItem = () => {
    setEstimateForm({
      ...estimateForm,
      items: [...estimateForm.items, { description: '', quantity: 1, unitPrice: 0 }]
    });
  };

  const removeLineItem = (index) => {
    if (estimateForm.items.length > 1) {
      setEstimateForm({
        ...estimateForm,
        items: estimateForm.items.filter((_, i) => i !== index)
      });
    }
  };

  const updateLineItem = (index, field, value) => {
    const updatedItems = [...estimateForm.items];
    updatedItems[index][field] = value;
    setEstimateForm({ ...estimateForm, items: updatedItems });
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      pending_approval: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      converted: 'bg-blue-100 text-blue-700',
      archived: 'bg-gray-100 text-gray-500'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateTotals = () => {
    const subtotal = estimateForm.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = (subtotal * estimateForm.taxPercentage) / 100;
    const discount = (subtotal * estimateForm.discountPercentage) / 100;
    const total = subtotal + tax - discount;
    return { subtotal, tax, discount, total };
  };

  const filteredEstimates = estimates.filter(e =>
    e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.estimate_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates / AMC Management</h1>
          <p className="text-gray-500 mt-1">Manage estimates, AMC packages, and add-ons</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 p-1">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* List Tab */}
          {(activeTab === 'list' || activeTab === 'archived') && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search estimates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {filteredEstimates.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No estimates found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Estimate</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Customer</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEstimates.map((estimate) => (
                          <tr key={estimate.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-4 px-4">
                              <div>
                                <p className="font-medium text-gray-900">{estimate.title}</p>
                                <p className="text-sm text-gray-500">{estimate.estimate_id}</p>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-600">{estimate.client_name || '-'}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-600">{estimate.property_name || '-'}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="font-medium text-gray-900">{formatCurrency(estimate.total_amount)}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(estimate.status)}`}>
                                {estimate.status?.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <form onSubmit={handleEstimateSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={estimateForm.title}
                      onChange={(e) => setEstimateForm({ ...estimateForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Estimate title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <select
                      value={estimateForm.clientId}
                      onChange={(e) => setEstimateForm({ ...estimateForm, clientId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Customer</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                    <select
                      value={estimateForm.propertyId}
                      onChange={(e) => setEstimateForm({ ...estimateForm, propertyId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Property</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={estimateForm.description}
                      onChange={(e) => setEstimateForm({ ...estimateForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Line Items</label>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {estimateForm.items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Description"
                        />
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Qty"
                          min="1"
                        />
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Price"
                        />
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax %</label>
                    <input
                      type="number"
                      value={estimateForm.taxPercentage}
                      onChange={(e) => setEstimateForm({ ...estimateForm, taxPercentage: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                    <input
                      type="number"
                      value={estimateForm.discountPercentage}
                      onChange={(e) => setEstimateForm({ ...estimateForm, discountPercentage: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                    <input
                      type="date"
                      value={estimateForm.validUntil}
                      onChange={(e) => setEstimateForm({ ...estimateForm, validUntil: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">TOTAL</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(calculateTotals().total)}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={resetEstimateForm}
                    className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4" />
                    <span>Create Estimate</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* AMC Tab */}
          {activeTab === 'amc' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => { setModalType('amc'); resetAmcForm(); setShowModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add AMC Package</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {amcPackages.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-100">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No AMC packages found</p>
                  </div>
                ) : (
                  amcPackages.map((pkg) => (
                    <div key={pkg.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                        {pkg.hide_pricing && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <EyeOff className="w-3 h-3" /> Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{pkg.description || 'No description'}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-400">Base Price</p>
                          {pkg.hide_pricing ? (
                            <p className="text-sm font-medium text-gray-400 italic">Hidden</p>
                          ) : (
                            <p className="text-lg font-bold text-blue-600">{formatCurrency(pkg.base_price)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Duration</p>
                          <p className="text-sm font-medium text-gray-700">{pkg.duration_months} months</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Addons Tab */}
          {activeTab === 'addons' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => { setModalType('addon'); resetAddonForm(); setShowModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Add-on</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {addons.length === 0 ? (
                  <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-100">
                    <PlusCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No add-ons found</p>
                  </div>
                ) : (
                  addons.map((addon) => (
                    <div key={addon.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-gray-900">{addon.name}</h3>
                        {addon.hide_pricing && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <EyeOff className="w-3 h-3" /> Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{addon.description || 'No description'}</p>
                      {addon.category_name && (
                        <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                          {addon.category_name}
                        </span>
                      )}
                      <div className="mt-4">
                        {addon.hide_pricing ? (
                          <p className="text-sm font-medium text-gray-400 italic">Pricing Hidden</p>
                        ) : (
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(addon.price)} <span className="text-xs font-normal text-gray-400">/ {addon.unit}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal for AMC / Addon */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {modalType === 'amc' ? 'Add AMC Package' : 'Add Add-on'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={modalType === 'amc' ? handleAmcSubmit : handleAddonSubmit} className="p-6 space-y-4">
              {modalType === 'amc' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                    <input
                      type="text"
                      required
                      value={amcForm.name}
                      onChange={(e) => setAmcForm({ ...amcForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={amcForm.description}
                      onChange={(e) => setAmcForm({ ...amcForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months)</label>
                      <input
                        type="number"
                        value={amcForm.durationMonths}
                        onChange={(e) => setAmcForm({ ...amcForm, durationMonths: parseInt(e.target.value) || 12 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Price</label>
                      <input
                        type="number"
                        value={amcForm.basePrice}
                        onChange={(e) => setAmcForm({ ...amcForm, basePrice: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Services (comma-separated)</label>
                    <input
                      type="text"
                      value={amcForm.services}
                      onChange={(e) => setAmcForm({ ...amcForm, services: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Service 1, Service 2, Service 3"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amcForm.hidePricing}
                      onChange={(e) => setAmcForm({ ...amcForm, hidePricing: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Hide pricing from other users</span>
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Add-on Name *</label>
                    <input
                      type="text"
                      required
                      value={addonForm.name}
                      onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={addonForm.description}
                      onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                      <input
                        type="number"
                        value={addonForm.price}
                        onChange={(e) => setAddonForm({ ...addonForm, price: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                      <select
                        value={addonForm.unit}
                        onChange={(e) => setAddonForm({ ...addonForm, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="per_service">Per Service</option>
                        <option value="per_hour">Per Hour</option>
                        <option value="per_sqft">Per Sq.ft</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={addonForm.categoryId}
                      onChange={(e) => setAddonForm({ ...addonForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addonForm.hidePricing}
                      onChange={(e) => setAddonForm({ ...addonForm, hidePricing: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Hide pricing from other users</span>
                  </label>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerEstimates;
