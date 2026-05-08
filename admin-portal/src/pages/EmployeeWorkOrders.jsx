import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Eye,
  X,
  Check,
  Clock,
  AlertCircle,
  Plus,
  ClipboardList,
  ChevronDown,
  Camera,
  Image,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  User,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';
import SelectWithAdd from '../components/SelectWithAdd';
import { getCategories, addCategory, getSubcategories, addSubcategory } from '../utils/fieldOptionsStore';

const API_BASE = '/api';

const EmployeeWorkOrders = ({ admin }) => {
  const [activeTab, setActiveTab] = useState('pending');
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ pending: 0, completed: 0, total: 0 });

  // Create form state
  const [categories, setCategories] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: '',
    block: '',
    flatNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    categoryId: '',
    subcategoryId: '',
    description: '',
    permissionToEnter: '',
    entryNotes: '',
    hasPet: '',
    priority: 'medium',
    attachments: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchWorkOrders();
    fetchCategories();
    fetchProperties();
  }, [activeTab]);

  const fetchWorkOrders = async (searchQuery = '') => {
    setLoading(true);
    try {
      const status = activeTab === 'pending' ? 'pending' : activeTab === 'completed' ? 'closed' : 'all';
      let url = `${API_BASE}/work-orders?status=${status}`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setWorkOrders(result.data || []);
        setCounts(result.counts || { pending: 0, completed: 0, total: 0 });
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchWorkOrders(searchTerm);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/work-orders/categories`);
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch(`${API_BASE}/onboarding`);
      const result = await response.json();
      if (result.success) {
        setProperties(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handlePropertySelect = (property) => {
    setSelectedProperty(property);
    setPropertySearch(property.propertyId);
    setShowPropertyDropdown(false);
    
    // Auto-populate customer details from property's contacts (backend returns 'contacts')
    const contact = property.contacts?.[0] || property.associationContacts?.[0] || {};
    const customerName = contact.name || property.communityName || property.name || '';
    const customerEmail = contact.email || '';
    const customerPhone = contact.phone ? `${contact.countryCode || '+91'} ${contact.phone}` : '';
    
    // Auto-populate block/flat based on property type and available data
    let blockValue = '';
    let flatValue = '';
    
    const entryType = property.entryType?.toUpperCase();
    
    if (entryType === 'GC') {
      // For Gated Community: blockNames is object like { "1": "A", "2": "B" }
      if (property.blockNames && typeof property.blockNames === 'object') {
        const blockKeys = Object.keys(property.blockNames);
        if (blockKeys.length > 0) {
          // Get first block name value (e.g., "A")
          blockValue = property.blockNames[blockKeys[0]] || '';
        }
      }
    } else if (entryType === 'APT') {
      // For Apartment: blockInfo is a string like "Block A, Tower 1"
      if (property.blockInfo && typeof property.blockInfo === 'string') {
        blockValue = property.blockInfo.trim();
      }
    } else if (entryType === 'FLAT' || entryType === 'FLATS') {
      // For Flat: Check blockInfo first, then blockNames
      if (property.blockInfo && typeof property.blockInfo === 'string') {
        blockValue = property.blockInfo.trim();
      } else if (property.blockNames && typeof property.blockNames === 'object') {
        const blockKeys = Object.keys(property.blockNames);
        if (blockKeys.length > 0) {
          blockValue = property.blockNames[blockKeys[0]] || '';
        }
      }
      // Flat number from villaPlotNumber
      flatValue = property.villaPlotNumber || '';
    } else if (entryType === 'VILLA' || entryType === 'VILLAS') {
      // For Villa: Use villaPlotNumber
      flatValue = property.villaPlotNumber || '';
    } else if (entryType === 'PLOT' || entryType === 'PLOTS') {
      // For Plot: Use villaPlotNumber
      flatValue = property.villaPlotNumber || '';
    }
    
    setFormData(prev => ({
      ...prev,
      propertyId: property.propertyId,
      customerName: customerName,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
      block: blockValue,
      flatNumber: flatValue
    }));
    setFormErrors(prev => ({ ...prev, propertyId: '', customerName: '', block: '', flatNumber: '' }));
  };

  const filteredProperties = properties.filter(p =>
    p.propertyId?.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.name?.toLowerCase().includes(propertySearch.toLowerCase())
  );

  const getPropertyTypeLabel = (entryType) => {
    switch (entryType?.toUpperCase()) {
      case 'APT': return 'Apartment';
      case 'GC': return 'Gated Community';
      case 'VILLA':
      case 'VILLAS': return 'Villa';
      case 'PLOT':
      case 'PLOTS': return 'Plot';
      case 'FLAT':
      case 'FLATS': return 'Flat';
      default: return entryType;
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch(`${API_BASE}/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminId: admin?.id })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Status updated successfully');
        fetchWorkOrders();
        setSelectedOrder(null);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError('Failed to update status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filtered = workOrders.filter(wo => {
    const matchesSearch =
      wo.work_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Get selected category for form
  const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
  const subcategories = selectedCategory?.subcategories || [];

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      categoryId: categoryId.toString(),
      subcategoryId: ''
    }));
    setShowCategoryDropdown(false);
    setFormErrors(prev => ({ ...prev, categoryId: '' }));
  };

  // Handle adding new category
  const handleAddCategory = (categoryName) => {
    // Add to fieldOptionsStore for persistence
    const result = addCategory(categoryName);
    if (result.success) {
      // Also add to local categories state temporarily
      const newCategory = {
        id: Date.now(),
        name: categoryName,
        subcategories: ['Other']
      };
      setCategories(prev => [...prev, newCategory]);
      // Auto-select the new category
      handleCategorySelect(newCategory.id);
    }
    return result;
  };

  // Handle adding new subcategory
  const handleAddSubcategory = (subcategoryName) => {
    if (!selectedCategory) {
      return { success: false, message: 'Please select a category first' };
    }
    // Add to fieldOptionsStore
    const result = addSubcategory(selectedCategory.name, subcategoryName);
    if (result.success) {
      // Also add to local state temporarily
      const newSubcategory = {
        id: Date.now(),
        name: subcategoryName
      };
      setCategories(prev => prev.map(cat => 
        cat.id === selectedCategory.id
          ? { ...cat, subcategories: [...cat.subcategories, newSubcategory] }
          : cat
      ));
      // Auto-select the new subcategory
      handleSubcategorySelect(newSubcategory.id);
    }
    return result;
  };

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategoryId) => {
    setFormData(prev => ({
      ...prev,
      subcategoryId: subcategoryId.toString()
    }));
    setShowSubcategoryDropdown(false);
    setFormErrors(prev => ({ ...prev, subcategoryId: '' }));
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map(file => ({
        file,
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }));

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments].slice(0, 5)
      }));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (attachmentId) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== attachmentId)
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.propertyId) newErrors.propertyId = 'Please select a property';
    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!formData.customerPhone.trim()) newErrors.customerPhone = 'Phone number is required';
    if (!formData.categoryId) newErrors.categoryId = 'Please select a category';
    if (!formData.subcategoryId) newErrors.subcategoryId = 'Please select a subcategory';
    if (!formData.permissionToEnter) newErrors.permissionToEnter = 'Please select an option';
    if (!formData.hasPet) newErrors.hasPet = 'Please select an option';
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitWorkOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append('propertyId', formData.propertyId);
      if (formData.block) submitData.append('block', formData.block);
      if (formData.flatNumber) submitData.append('flatNumber', formData.flatNumber);
      submitData.append('customerName', formData.customerName);
      if (formData.customerEmail) submitData.append('customerEmail', formData.customerEmail);
      submitData.append('customerPhone', formData.customerPhone);
      submitData.append('categoryId', formData.categoryId);
      submitData.append('subcategoryId', formData.subcategoryId);
      submitData.append('description', formData.description);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('entryNotes', formData.entryNotes);
      submitData.append('hasPet', formData.hasPet);
      submitData.append('priority', formData.priority);
      submitData.append('adminId', admin?.id || '');

      formData.attachments.forEach(attachment => {
        submitData.append('attachments', attachment.file);
      });

      const response = await fetch(`${API_BASE}/work-orders/admin/create`, {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Work order created successfully!');
        setSelectedProperty(null);
        setPropertySearch('');
        setFormData({
          propertyId: '',
          block: '',
          flatNumber: '',
          customerName: '',
          customerEmail: '',
          customerPhone: '',
          categoryId: '',
          subcategoryId: '',
          description: '',
          permissionToEnter: '',
          entryNotes: '',
          hasPet: '',
          priority: 'medium',
          attachments: []
        });
        setActiveTab('pending');
        fetchWorkOrders();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Failed to create work order');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to create work order');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'pending', label: 'Pending', icon: Clock, count: counts.pending },
    { id: 'completed', label: 'Completed', icon: CheckCircle2, count: counts.completed },
    { id: 'create', label: 'Create New', icon: Plus, count: null },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-500">Manage and track all work orders</p>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <Check className="w-5 h-5" /><span>{success}</span>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
          <XCircle className="w-5 h-5" /><span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-medium text-sm transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab !== 'create' ? (
        <>
          {/* Search and Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Work Order ID, category, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
              <button
                onClick={() => { setSearchTerm(''); fetchWorkOrders(); }}
                className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Order ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Resident</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
                          <span className="text-gray-500">Loading work orders...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
                          <span className="text-gray-500">No work orders found</span>
                          <button
                            onClick={() => setActiveTab('create')}
                            className="mt-3 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                          >
                            Create a new work order →
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((wo) => (
                      <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-gray-900">{wo.work_order_id}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{wo.first_name} {wo.last_name}</p>
                            <p className="text-sm text-gray-500">{wo.unit_number ? `Unit ${wo.unit_number}` : 'N/A'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{wo.category_name}</p>
                            <p className="text-sm text-gray-500">{wo.subcategory_name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(wo.status)}`}>
                            {wo.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedOrder(wo)}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Create Work Order Form */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create New Work Order</h2>
              <p className="text-sm text-gray-500">Fill in the details to create a work order on behalf of a resident</p>
            </div>
          </div>

          <form onSubmit={handleSubmitWorkOrder} className="space-y-6">
            {/* Property ID Selection */}
            <div className="border border-gray-200 rounded-lg p-5 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Property Information</span>
              </h3>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Property ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertySearch}
                  onChange={(e) => {
                    setPropertySearch(e.target.value);
                    setShowPropertyDropdown(true);
                    if (!e.target.value.trim()) {
                      setSelectedProperty(null);
                      setFormData(prev => ({ ...prev, propertyId: '', block: '', flatNumber: '' }));
                    }
                  }}
                  onFocus={() => setShowPropertyDropdown(true)}
                  placeholder="Search by Property ID or Community Name..."
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${
                    formErrors.propertyId ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-400'
                  }`}
                />
                {showPropertyDropdown && propertySearch.trim() && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {filteredProperties.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500">No properties found</div>
                    ) : (
                      filteredProperties.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handlePropertySelect(p)}
                          className={`w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center justify-between transition-colors ${
                            formData.propertyId === p.propertyId ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{p.propertyId}</p>
                            <p className="text-xs text-gray-500">{p.name} - {getPropertyTypeLabel(p.entryType)}</p>
                          </div>
                          {formData.propertyId === p.propertyId && <Check className="w-4 h-4 text-indigo-600" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {formErrors.propertyId && (
                  <p className="mt-1 text-sm text-red-500 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{formErrors.propertyId}</p>
                )}
              </div>

              {/* Auto-detected Property Type with Auto-populated Details */}
              {selectedProperty && (
                <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-xs text-indigo-500 uppercase tracking-wider font-medium mb-2">Detected Property Type</p>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-indigo-800">{getPropertyTypeLabel(selectedProperty.entryType)}</p>
                  </div>
                  <p className="text-xs text-indigo-600">{selectedProperty.name}</p>
                  
                  {/* Show additional auto-populated info based on property type */}
                  {(selectedProperty.entryType === 'GC' || selectedProperty.entryType === 'APT') && (
                    <div className="mt-3 pt-3 border-t border-indigo-200 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">
                          {selectedProperty.entryType === 'GC' ? 'Block Name' : 'Block Info'}
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {selectedProperty.entryType === 'GC' 
                            ? (selectedProperty.blockNames ? Object.values(selectedProperty.blockNames).filter(Boolean).join(', ') : '-')
                            : (selectedProperty.blockInfo || '-')
                          }
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Number of Units</p>
                        <p className="text-sm font-medium text-gray-800">
                          {selectedProperty.entryType === 'GC' 
                            ? (selectedProperty.unitsPerBlock 
                                ? Object.values(selectedProperty.unitsPerBlock).reduce((sum, u) => sum + (parseInt(u) || 0), 0) + ' Units'
                                : '-')
                            : (selectedProperty.numberOfUnits ? selectedProperty.numberOfUnits + ' Units' : '-')
                          }
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Villa/Plot/Flat: Show the unit number */}
                  {(selectedProperty.entryType === 'VILLA' || selectedProperty.entryType === 'PLOT' || selectedProperty.entryType === 'FLAT') && selectedProperty.villaPlotNumber && (
                    <div className="mt-3 pt-3 border-t border-indigo-200">
                      <p className="text-xs text-gray-500">
                        {selectedProperty.entryType === 'VILLA' ? 'Villa Number' : 
                         selectedProperty.entryType === 'PLOT' ? 'Plot Number' : 'Flat Number'}
                      </p>
                      <p className="text-sm font-medium text-gray-800">{selectedProperty.villaPlotNumber}</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Customer Details */}
            <div className="border border-gray-200 rounded-lg p-5 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Customer Details</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Customer name"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${
                      formErrors.customerName ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-400'
                    }`}
                  />
                  {formErrors.customerName && (
                    <p className="mt-1 text-sm text-red-500 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{formErrors.customerName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    placeholder="customer@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="Phone number"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${
                      formErrors.customerPhone ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-indigo-200 focus:border-indigo-400'
                    }`}
                  />
                  {formErrors.customerPhone && (
                    <p className="mt-1 text-sm text-red-500 flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{formErrors.customerPhone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Category Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Dropdown */}
              <SelectWithAdd
                label="Category"
                value={formData.categoryId}
                onChange={(value) => handleCategorySelect(value)}
                options={categories.map(c => ({ label: c.name, value: c.id.toString() }))}
                onAddOption={(value) => handleAddCategory(value)}
                placeholder="Select a category"
                required
                error={formErrors.categoryId}
                addPlaceholder="Enter new category name"
              />

              {/* Subcategory Dropdown */}
              <SelectWithAdd
                label="Subcategory"
                value={formData.subcategoryId}
                onChange={(value) => handleSubcategorySelect(value)}
                options={subcategories.map(s => ({ label: s.name, value: s.id.toString() }))}
                onAddOption={(value) => handleAddSubcategory(value)}
                placeholder={formData.categoryId ? 'Select a subcategory' : 'Select a category first'}
                required
                disabled={!formData.categoryId}
                error={formErrors.subcategoryId}
                addPlaceholder="Enter new subcategory name"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                  }
                }}
                placeholder="Describe the issue or request in detail..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-sm ${formData.description.length >= 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {formData.description.length}/500
                </span>
              </div>
            </div>

            {/* Permission to Enter & Pet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Permission to Enter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission to Enter <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Allow entry if resident is unavailable</p>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, permissionToEnter: 'yes' }));
                      setFormErrors(prev => ({ ...prev, permissionToEnter: '' }));
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all font-medium ${
                      formData.permissionToEnter === 'yes'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, permissionToEnter: 'no' }));
                      setFormErrors(prev => ({ ...prev, permissionToEnter: '' }));
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all font-medium ${
                      formData.permissionToEnter === 'no'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    No
                  </button>
                </div>
                {formErrors.permissionToEnter && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.permissionToEnter}
                  </p>
                )}
              </div>

              {/* Has Pet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Has Pet? <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Does the resident have a pet?</p>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, hasPet: 'yes' }));
                      setFormErrors(prev => ({ ...prev, hasPet: '' }));
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all font-medium ${
                      formData.hasPet === 'yes'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, hasPet: 'no' }));
                      setFormErrors(prev => ({ ...prev, hasPet: '' }));
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all font-medium ${
                      formData.hasPet === 'no'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    No
                  </button>
                </div>
                {formErrors.hasPet && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.hasPet}
                  </p>
                )}
              </div>
            </div>

            {/* Entry Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Notes <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={formData.entryNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, entryNotes: e.target.value }))}
                placeholder="Special instructions for entry (gate code, parking, etc.)..."
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex space-x-3">
                {['low', 'medium', 'high', 'urgent'].map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, priority }))}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 transition-all capitalize ${
                      formData.priority === priority
                        ? priority === 'low' ? 'border-green-500 bg-green-50 text-green-700'
                          : priority === 'medium' ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                            : priority === 'high' ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* File Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments <span className="text-gray-400">(Optional - max 5 files)</span>
              </label>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }}
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                >
                  <Image className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.capture = 'environment';
                    fileInputRef.current.click();
                  }}
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                >
                  <Camera className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = '.pdf,image/*';
                    fileInputRef.current.click();
                  }}
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all"
                >
                  <FileText className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500">Files</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                multiple
                className="hidden"
              />

              {formData.attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  {formData.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {attachment.preview ? (
                        <img src={attachment.preview} alt={attachment.name} className="w-full h-20 object-cover" />
                      ) : (
                        <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-600 truncate">{attachment.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3.5 px-6 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all ${
                  isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Create Work Order</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Work Order Details</h2>
                <p className="text-sm text-gray-500 font-mono">{selectedOrder.work_order_id}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status and Actions */}
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1.5 text-sm font-semibold rounded-full border ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status?.replace('_', ' ')}
                </span>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => updateStatus(selectedOrder.id, e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Priority Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Priority:</span>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  selectedOrder.priority === 'low' ? 'bg-green-100 text-green-700' :
                  selectedOrder.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  selectedOrder.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  selectedOrder.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedOrder.priority || 'Medium'}
                </span>
              </div>

              {/* Customer/Resident Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Customer Name</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.customer_name || selectedOrder.first_name + ' ' + selectedOrder.last_name || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Email</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.customer_email || selectedOrder.email || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Phone</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.customer_phone || selectedOrder.phone || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Property ID</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.property_id || 'N/A'}</p>
                </div>
              </div>

              {/* Location Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Block</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.block || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Property/Community</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.onboarded_property_name || selectedOrder.property_name || 'N/A'}</p>
                </div>
              </div>

              {/* Category Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Category</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.category_name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Subcategory</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.subcategory_name}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Description</p>
                <p className="p-3 bg-gray-50 rounded-lg text-gray-700">{selectedOrder.description || 'No description provided'}</p>
              </div>

              {/* Entry Permissions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <span className={`w-3 h-3 rounded-full ${selectedOrder.permission_to_enter === 'yes' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-sm text-gray-700">Permission to Enter: <strong>{selectedOrder.permission_to_enter || 'N/A'}</strong></span>
                </div>
                <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                  <span className={`w-3 h-3 rounded-full ${selectedOrder.has_pet === 'yes' ? 'bg-amber-500' : 'bg-gray-300'}`}></span>
                  <span className="text-sm text-gray-700">Has Pet: <strong>{selectedOrder.has_pet || 'N/A'}</strong></span>
                </div>
              </div>

              {/* Entry Notes */}
              {selectedOrder.entry_notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Entry Notes</p>
                  <p className="p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">{selectedOrder.entry_notes}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  <span className="text-xs uppercase tracking-wider">Created:</span><br/>
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </div>
                {selectedOrder.completed_at && (
                  <div className="text-sm text-gray-500">
                    <span className="text-xs uppercase tracking-wider">Completed:</span><br/>
                    {new Date(selectedOrder.completed_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {(selectedOrder.status === 'closed' || selectedOrder.status === 'completed') && (
                <button
                  onClick={() => updateStatus(selectedOrder.id, 'pending')}
                  className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Revert to Pending</span>
                </button>
              )}
              {selectedOrder.status !== 'closed' && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && (
                <button
                  onClick={() => updateStatus(selectedOrder.id, 'closed')}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark as Closed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showCategoryDropdown || showSubcategoryDropdown) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setShowCategoryDropdown(false);
            setShowSubcategoryDropdown(false);
          }}
        />
      )}
    </div>
  );
};

export default EmployeeWorkOrders;
