import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import {
  ClipboardList, Plus, Search, RefreshCw, X, XCircle, AlertCircle,
  CheckCircle, Clock, Eye, Building2, User, Camera, Upload, FileText, Image, List
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ExecutiveWorkOrders = ({ user }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [completingWorkOrderId, setCompletingWorkOrderId] = useState(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryId: '',
    subcategoryId: '',
    customSubcategory: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    description: '',
    priority: 'medium',
    permissionToEnter: 'no',
    hasPet: 'no',
    entryNotes: ''
  });

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const token = getAuthToken();

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' }
  ];

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/executive/work-orders`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) setWorkOrders(result.data || []);
    } catch (error) {
      console.error('Fetch work orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [propRes, catRes, custRes] = await Promise.all([
        fetch(`${API_BASE}/api/executive/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/executive/customers`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [propData, catData, custData] = await Promise.all([propRes.json(), catRes.json(), custRes.json()]);
      if (propData.success) setProperties(propData.data);
      if (catData.success) setCategories(catData.data);
      if (custData.success) setCustomers(custData.data);
    } catch (error) {
      console.error('Fetch dependencies error:', error);
    }
  };

  useEffect(() => { fetchWorkOrders(); fetchDependencies(); }, []);

  // Count work orders by status
  const allCount = workOrders.length;
  const completedCount = workOrders.filter(wo => wo.status === 'completed').length;

  // Filter work orders by active tab, status filter, and search term
  const filteredWorkOrders = workOrders.filter(wo => {
    // Tab filter - All shows everything, Completed shows only completed
    if (activeTab === 'completed' && wo.status !== 'completed') return false;

    // Status filter
    if (statusFilter && wo.status !== statusFilter) return false;

    // Search filter
    if (searchTerm) {
      return (
        wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.work_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  const handleSearch = () => setSearchTerm(searchInput);
  const handleClear = () => { setSearchInput(''); setSearchTerm(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Validate required fields
    if (!formData.propertyId) {
      setMessage({ type: 'error', text: 'Please select a property' });
      return;
    }
    if (!formData.customerName?.trim()) {
      setMessage({ type: 'error', text: 'Customer name is required' });
      return;
    }
    if (!formData.customerPhone?.trim()) {
      setMessage({ type: 'error', text: 'Customer phone number is required' });
      return;
    }
    if (!formData.categoryId) {
      setMessage({ type: 'error', text: 'Please select a category' });
      return;
    }
    // Validate subcategory - either dropdown selection or custom text
    if (isOtherCategory) {
      if (!formData.customSubcategory?.trim()) {
        setMessage({ type: 'error', text: 'Please enter a subcategory' });
        return;
      }
    } else if (!formData.subcategoryId) {
      setMessage({ type: 'error', text: 'Please select a subcategory' });
      return;
    }

    try {
      const submitData = { ...formData };
      // Add category name from the selected category
      const selectedCat = categories.find(c => c.id === parseInt(formData.categoryId));
      submitData.categoryName = selectedCat?.name || '';
      
      // Handle custom subcategory for "Other" category
      if (isOtherCategory && formData.customSubcategory) {
        submitData.customSubcategory = formData.customSubcategory;
        submitData.subcategoryId = '';
      } else if (formData.subcategoryId) {
        // Add subcategory name from selected subcategory
        const selectedSubcat = selectedCat?.subcategories?.find(s => s.id === parseInt(formData.subcategoryId));
        submitData.subcategoryName = selectedSubcat?.name || '';
      }
      
      const response = await fetch(`${API_BASE}/api/executive/work-orders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMessage({ type: 'success', text: 'Work order created successfully!' });
        resetForm();
        setActiveTab('all');
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      console.error('Work order create error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to create work order' });
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: '',
      categoryId: '',
      subcategoryId: '',
      customSubcategory: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      description: '',
      priority: 'medium',
      permissionToEnter: 'no',
      hasPet: 'no',
      entryNotes: ''
    });
    setPropertySearch('');
    setSubcategories([]);
    setAttachments([]);
  };

  // Filter properties based on search
  const filteredPropertiesForSearch = properties.filter(p => 
    propertySearch && (
      p.name?.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.property_id?.toLowerCase().includes(propertySearch.toLowerCase())
    )
  );

  // Helper to compute total units based on property type
  const computeTotalUnits = (prop) => {
    const propType = (prop.property_type || prop.entryType || '').toUpperCase();
    
    // For GC properties, compute from units_per_block
    if (propType === 'GC' || propType === 'GATED_COMMUNITY') {
      if (prop.units_per_block) {
        try {
          const upb = typeof prop.units_per_block === 'string' ? JSON.parse(prop.units_per_block) : prop.units_per_block;
          if (typeof upb === 'object' && upb !== null) {
            const total = Object.values(upb).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
            if (total > 0) return total;
          }
        } catch (e) { /* ignore */ }
      }
    }
    
    // For APT properties, use number_of_units or total_units
    if (propType === 'APT' || propType === 'APARTMENT') {
      return prop.number_of_units || prop.total_units || prop.numberOfUnits || prop.totalUnits || null;
    }
    
    // For VILLA, FLAT, PLOT - single unit
    if (['VILLA', 'VILLAS', 'FLAT', 'FLATS', 'PLOT', 'PLOTS'].includes(propType)) {
      return 1;
    }
    
    // Fallback to stored values
    if (prop.total_units) return prop.total_units;
    if (prop.number_of_units) return prop.number_of_units;
    return null;
  };

  // Handle property selection - auto-populate customer details and store property
  const handlePropertySelect = (property) => {
    const totalUnits = computeTotalUnits(property);
    setSelectedProperty({ ...property, total_units: totalUnits });
    setFormData({ 
      ...formData, 
      propertyId: property.id,
      customerName: property.contact_person || property.contactPerson || property.owner_name || '',
      customerEmail: property.contact_email || property.contactEmail || property.email || '',
      customerPhone: property.contact_phone || property.contactPhone || property.phone || property.mobile || ''
    });
    setPropertySearch(property.property_id || '');
  };

  // Handle category change to load subcategories from embedded data
  const handleCategoryChange = (categoryId) => {
    setFormData({ ...formData, categoryId, subcategoryId: '', customSubcategory: '' });
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };
  
  // Check if "Other" category is selected
  const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
  const isOtherCategory = selectedCategory?.isCustom || selectedCategory?.name === 'Other';

  // Handle file attachments
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      setMessage({ type: 'error', text: 'Maximum 5 files allowed' });
      return;
    }
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleStatusChange = async (workOrderId, newStatus, closingNotesValue = null) => {
    // If completing, show modal to enter closing notes
    if (newStatus === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(workOrderId);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/executive/work-orders/${workOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, closingNotes: closingNotesValue })
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Status updated successfully!' });
        fetchWorkOrders();
        if (newStatus === 'completed') {
          setShowCompletionModal(false);
          setClosingNotes('');
          setCompletingWorkOrderId(null);
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update status' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (completingWorkOrderId && !isSubmittingCompletion) {
      setIsSubmittingCompletion(true);
      await handleStatusChange(completingWorkOrderId, 'completed', closingNotes);
      setIsSubmittingCompletion(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = { draft: 'bg-gray-100 text-gray-700', requested: 'bg-blue-100 text-blue-700', under_review: 'bg-yellow-100 text-yellow-700', assigned: 'bg-purple-100 text-purple-700', accepted: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-orange-100 text-orange-700', completed: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-700' };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority) => priorityOptions.find(p => p.value === priority)?.color || 'bg-gray-100 text-gray-700';
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500">Manage and track all work orders</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <List className="w-4 h-4" />
          <span>All</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>{allCount}</span>
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Completed</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>{completedCount}</span>
        </button>
        <button
          onClick={() => { resetForm(); setActiveTab('create'); }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'create'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Create Work Order</span>
        </button>
      </div>

      {/* Search Bar - shown for pending/completed tabs */}
      {(activeTab === 'all' || activeTab === 'completed') && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by Work Order ID, category, or name..." 
                value={searchInput} 
                onChange={(e) => setSearchInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <button onClick={handleSearch} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Search className="w-4 h-4" /><span>Search</span>
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white min-w-[140px]"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={() => { setSearchInput(''); setSearchTerm(''); setStatusFilter(''); fetchWorkOrders(); }} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Work Orders List - shown for pending/completed tabs */}
      {(activeTab === 'all' || activeTab === 'completed') && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" /></div>
          ) : filteredWorkOrders.length === 0 ? (
            <div className="text-center py-12"><ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No work orders found</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Resident</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created By</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{wo.work_order_id}</p>
                      <p className="text-sm text-gray-500">{wo.title}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wo.client_name || wo.customer_name || wo.resident_name || '-'}</p>
                        <p className="text-sm text-gray-500">{wo.property_name || wo.property_type || 'SSR'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wo.category_name || '-'}</p>
                        {wo.subcategory_name && <p className="text-xs text-gray-500">{wo.subcategory_name}</p>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium uppercase ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ') || 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500">{formatDate(wo.created_at)}</td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {wo.source === 'customer' ? (wo.customer_name || 'Customer') : (wo.created_by || wo.source || 'System')}
                        </p>
                        {wo.source === 'customer' && (
                          <p className="text-xs text-gray-500">{wo.property_code || wo.property_name}</p>
                        )}
                        {wo.source !== 'customer' && wo.source && (
                          <p className="text-xs text-gray-400 capitalize">{wo.source}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center">
                        <button 
                          onClick={() => { setSelectedWorkOrder(wo); setShowViewModal(true); }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Work Order Form - shown for create tab */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-xl border border-gray-100">
          {/* Header */}
          <div className="flex items-start gap-3 p-6 border-b border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create New Work Order</h2>
              <p className="text-sm text-gray-500">Fill in the details to create a work order on behalf of a resident</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Property Information Section */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Property Information</h3>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Property ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={propertySearch}
                  onChange={(e) => { setPropertySearch(e.target.value); setFormData({ ...formData, propertyId: '' }); setSelectedProperty(null); }}
                  placeholder="Search by Property ID or Community Name..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {filteredPropertiesForSearch.length > 0 && !formData.propertyId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredPropertiesForSearch.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePropertySelect(p)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-900">{p.property_id}</p>
                        <p className="text-sm text-gray-500">{p.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Property Details - Show after selection */}
              {selectedProperty && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Property Name</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.name || selectedProperty.community_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Property Type</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Zone</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.zone_name || selectedProperty.zone || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Division</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.division_name || selectedProperty.division || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">City</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Address</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.address || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Units</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.total_units || selectedProperty.number_of_units || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Blocks</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.number_of_blocks || selectedProperty.blocks || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Customer Details Section */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Customer Details</h3>
              </div>
              {selectedProperty ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name <span className="text-red-500">*</span></p>
                    <p className="text-sm font-medium text-gray-900">{formData.customerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-sm font-medium text-gray-900">{formData.customerEmail || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Phone Number <span className="text-red-500">*</span></p>
                    <p className="text-sm font-medium text-gray-900">{formData.customerPhone || '-'}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Customer name"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="customer@email.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="Phone number"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory <span className="text-red-500">*</span></label>
                {isOtherCategory ? (
                  <input
                    type="text"
                    required
                    value={formData.customSubcategory}
                    onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                    placeholder="Enter subcategory / issue type"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <select
                    required
                    value={formData.subcategoryId}
                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!formData.categoryId}
                  >
                    <option value="">{formData.categoryId ? 'Select subcategory' : 'Select a category first'}</option>
                    {subcategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 500) })}
                placeholder="Describe the issue or request in detail..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
              <p className="text-right text-sm text-gray-400 mt-1">{formData.description.length}/500</p>
            </div>

            {/* Permission & Pet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission to Enter <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-500 mb-2">Allow entry if resident is unavailable</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'yes' })}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.permissionToEnter === 'yes'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'no' })}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.permissionToEnter === 'no'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Has Pet? <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-500 mb-2">Does the resident have a pet?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'yes' })}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.hasPet === 'yes'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'no' })}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.hasPet === 'no'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* Entry Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Entry Notes <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={formData.entryNotes}
                onChange={(e) => setFormData({ ...formData, entryNotes: e.target.value })}
                placeholder="Special instructions for entry (gate code, parking, etc.)..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Priority</label>
              <div className="grid grid-cols-4 gap-3">
                {priorityOptions.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.value })}
                    className={`py-3 rounded-lg border-2 font-medium transition-all ${
                      formData.priority === p.value
                        ? p.value === 'low' ? 'border-green-500 bg-green-50 text-green-700'
                        : p.value === 'medium' ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : p.value === 'high' ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { resetForm(); setActiveTab('all'); }}
                className="px-6 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Create Work Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Work Order Details</h2>
                <p className="text-sm text-gray-500">{selectedWorkOrder.work_order_id}</p>
              </div>
              <button onClick={() => { setShowViewModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Work Order ID</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.work_order_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedWorkOrder.status)}`}>
                    {selectedWorkOrder.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedWorkOrder.priority)}`}>
                    {selectedWorkOrder.priority?.toUpperCase() || '-'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.category_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subcategory</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.subcategory_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.client_name || selectedWorkOrder.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.vendor_name || 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedWorkOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Permission to Enter</p>
                  <p className="font-medium text-gray-900 capitalize">{selectedWorkOrder.permission_to_enter || '-'}</p>
                </div>
              </div>

              {/* Property Details Section */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Property Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Property Name</p>
                    <p className="font-medium text-gray-900">{selectedWorkOrder.property_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Property ID</p>
                    <p className="font-medium text-gray-900 font-mono text-blue-600">{selectedWorkOrder.property_code || selectedWorkOrder.actual_property_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Property Type</p>
                    <p className="font-medium text-gray-900 capitalize">{selectedWorkOrder.property_type?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Zone / Division</p>
                    <p className="font-medium text-gray-900">{selectedWorkOrder.zone || 'N/A'} / {selectedWorkOrder.division || 'N/A'}</p>
                  </div>
                  {(selectedWorkOrder.property_type === 'gated_community' || selectedWorkOrder.property_type === 'apartment') && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Total Units</p>
                        <p className="font-medium text-gray-900">{selectedWorkOrder.total_units || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Blocks</p>
                        <p className="font-medium text-gray-900">{selectedWorkOrder.total_blocks || 'N/A'}</p>
                      </div>
                    </>
                  )}
                  {selectedWorkOrder.block && (
                    <div>
                      <p className="text-xs text-gray-500">Block</p>
                      <p className="font-medium text-gray-900">{selectedWorkOrder.block}</p>
                    </div>
                  )}
                  {selectedWorkOrder.flat_number && (
                    <div>
                      <p className="text-xs text-gray-500">Flat Number</p>
                      <p className="font-medium text-gray-900">{selectedWorkOrder.flat_number}</p>
                    </div>
                  )}
                  {selectedWorkOrder.property_address && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-medium text-gray-900">{selectedWorkOrder.property_address}{selectedWorkOrder.property_city ? `, ${selectedWorkOrder.property_city}` : ''}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium text-gray-900">{selectedWorkOrder.description || '-'}</p>
              </div>

              {/* Attachments Section */}
              {selectedWorkOrder.attachments && selectedWorkOrder.attachments.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Attachments ({selectedWorkOrder.attachments.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedWorkOrder.attachments.map((att) => {
                      const filePath = att.file_path?.startsWith('uploads/') ? att.file_path : `uploads/${att.file_path || att.file_name}`;
                      const fileUrl = `${API_BASE}/${filePath}`;
                      const fileName = att.original_name || att.file_name || '';
                      const fileExt = fileName.split('.').pop()?.toLowerCase();
                      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
                      const isImage = att.file_type?.startsWith('image/') || imageExtensions.includes(fileExt);
                      return (
                        <div
                          key={att.id}
                          onClick={() => isImage ? setViewingImage({ url: fileUrl, name: att.original_name || att.file_name }) : window.open(fileUrl, '_blank')}
                          className="border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-colors group cursor-pointer"
                        >
                          {isImage ? (
                            <img
                              src={fileUrl}
                              alt={att.original_name || att.file_name}
                              className="w-full h-20 object-cover rounded"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-20 bg-gray-100 rounded flex-col items-center justify-center ${isImage ? 'hidden' : 'flex'}`}>
                            <span className="text-2xl">{isImage ? '???' : '??'}</span>
                            {isImage && <span className="text-xs text-gray-500 mt-1">Click to view</span>}
                          </div>
                          <p className="text-xs font-medium text-gray-700 truncate mt-1 group-hover:text-blue-600">{att.original_name || att.file_name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Closing Notes Section - Show when work order is completed */}
              {selectedWorkOrder.status === 'completed' && selectedWorkOrder.closing_notes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Completion Notes
                  </p>
                  <p className="text-sm text-green-700">{selectedWorkOrder.closing_notes}</p>
                </div>
              )}

              {/* Cancellation Note Section - Show when work order is cancelled */}
              {selectedWorkOrder.status === 'cancelled' && selectedWorkOrder.cancellation_note && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Cancellation Reason
                  </p>
                  <p className="text-sm text-red-700">{selectedWorkOrder.cancellation_note}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100">
              <button onClick={() => { setShowViewModal(false); setSelectedWorkOrder(null); }} className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal with Closing Notes */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Complete Work Order</h2>
                </div>
                <button onClick={() => { setShowCompletionModal(false); setClosingNotes(''); setCompletingWorkOrderId(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">Please add any closing notes or comments about the completed work.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Closing Notes <span className="text-gray-400">(Optional)</span></label>
                <textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 resize-none" placeholder="E.g., Replaced faulty wiring, cleaned AC filters, etc..." />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowCompletionModal(false); setClosingNotes(''); setCompletingWorkOrderId(null); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleCompleteWorkOrder} disabled={isSubmittingCompletion} className={`px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 ${isSubmittingCompletion ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <CheckCircle className="w-4 h-4" />
                {isSubmittingCompletion ? 'Completing...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Image Viewer Modal */}
      {viewingImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewingImage.url}
              alt={viewingImage.name}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <p className="text-white text-center mt-2 text-sm">{viewingImage.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveWorkOrders;
