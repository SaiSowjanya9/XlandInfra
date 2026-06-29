import { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, Plus, Search, RefreshCw, X, AlertCircle,
  CheckCircle, Clock, CheckCircle2, Eye, Image, Camera, FileText, Trash2, List
} from 'lucide-react';

const SupervisorWorkOrders = ({ user }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [propertySearchResults, setPropertySearchResults] = useState([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    propertyId: '', propertySearch: '', categoryId: '', subcategoryId: '',
    customerName: '', customerEmail: '', customerPhone: '',
    description: '', priority: 'medium', permissionToEnter: 'yes', hasPet: 'no', entryNotes: ''
  });

  const token = sessionStorage.getItem('pm_auth_token');

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'border-gray-300 text-gray-600' },
    { value: 'medium', label: 'Medium', color: 'border-amber-400 text-amber-600 bg-amber-50' },
    { value: 'high', label: 'High', color: 'border-orange-400 text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'border-red-400 text-red-600' }
  ];

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      // Always fetch ALL work orders for accurate tab counts
      const response = await fetch('/api/supervisor/work-orders', { headers: { 'Authorization': `Bearer ${token}` } });
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
      const [propRes, catRes] = await Promise.all([
        fetch('/api/supervisor/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/categories', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [propData, catData] = await Promise.all([propRes.json(), catRes.json()]);
      if (propData.success) setProperties(propData.data || []);
      if (catData.success) setCategories(catData.data || []);
    } catch (error) {
      console.error('Fetch dependencies error:', error);
    }
  };

  useEffect(() => { 
    if (activeTab !== 'create') fetchWorkOrders(); 
    fetchDependencies(); 
  }, [activeTab]);

  const handlePropertySearch = (value) => {
    setFormData({ ...formData, propertySearch: value, propertyId: '' });
    setSelectedProperty(null);
    if (value.length > 1) {
      const results = properties.filter(p => 
        p.name?.toLowerCase().includes(value.toLowerCase()) ||
        p.property_id?.toLowerCase().includes(value.toLowerCase())
      );
      setPropertySearchResults(results);
      setShowPropertyDropdown(true);
    } else {
      setPropertySearchResults([]);
      setShowPropertyDropdown(false);
    }
  };

  const selectProperty = (property) => {
    setSelectedProperty(property);
    setFormData({ 
      ...formData, 
      propertyId: property.id, 
      propertySearch: property.property_id || '',
      customerName: property.contact_person || property.contactPerson || property.owner_name || '',
      customerEmail: property.contact_email || property.contactEmail || property.email || '',
      customerPhone: property.contact_phone || property.contactPhone || property.phone || property.mobile || ''
    });
    setShowPropertyDropdown(false);
  };

  const handleCategoryChange = (categoryId) => {
    setFormData({ ...formData, categoryId, subcategoryId: '' });
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (attachments.length + files.length > 5) {
      setMessage({ type: 'error', text: 'Maximum 5 files allowed' });
      return;
    }
    const newAttachments = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const removeAttachment = (index) => {
    const newAttachments = [...attachments];
    URL.revokeObjectURL(newAttachments[index].preview);
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.propertyId) {
      setMessage({ type: 'error', text: 'Please select a property' });
      return;
    }
    if (!formData.customerName || !formData.customerPhone) {
      setMessage({ type: 'error', text: 'Customer name and phone are required' });
      return;
    }
    if (!formData.categoryId) {
      setMessage({ type: 'error', text: 'Please select a category' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const submitData = new FormData();
      submitData.append('propertyId', formData.propertyId);
      submitData.append('categoryId', formData.categoryId);
      submitData.append('subcategoryId', formData.subcategoryId || '');
      submitData.append('customerName', formData.customerName);
      submitData.append('customerEmail', formData.customerEmail);
      submitData.append('customerPhone', formData.customerPhone);
      submitData.append('description', formData.description);
      submitData.append('priority', formData.priority);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('hasPet', formData.hasPet);
      submitData.append('entryNotes', formData.entryNotes);

      attachments.forEach((att) => {
        submitData.append('attachments', att.file);
      });

      const response = await fetch('/api/supervisor/work-orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: submitData
      });

      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Work order created successfully!' });
        resetForm();
        setActiveTab('all');
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to create work order' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create work order' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: '', propertySearch: '', categoryId: '', subcategoryId: '',
      customerName: '', customerEmail: '', customerPhone: '',
      description: '', priority: 'medium', permissionToEnter: 'yes', hasPet: 'no', entryNotes: ''
    });
    attachments.forEach(att => URL.revokeObjectURL(att.preview));
    setAttachments([]);
    setSubcategories([]);
  };

  const handleStatusChange = async (workOrder, newStatus) => {
    try {
      const response = await fetch(`/api/supervisor/work-orders/${workOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Status updated to ${newStatus}` });
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update status' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const getStatusColor = (status) => {
    const colors = { 
      draft: 'bg-gray-100 text-gray-700', requested: 'bg-blue-100 text-blue-700', 
      under_review: 'bg-yellow-100 text-yellow-700', assigned: 'bg-purple-100 text-purple-700', 
      accepted: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-orange-100 text-orange-700', 
      completed: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  // Filter by tab (all/completed) first, then by status filter, then by search
  const tabFilteredWorkOrders = activeTab === 'completed'
    ? workOrders.filter(wo => wo.status === 'completed')
    : workOrders;
  
  // Apply status filter
  const statusFilteredWorkOrders = statusFilter 
    ? tabFilteredWorkOrders.filter(wo => wo.status === statusFilter)
    : tabFilteredWorkOrders;
  
  // Apply search filter
  const filteredWorkOrders = statusFilteredWorkOrders.filter(wo =>
    wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wo.work_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wo.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wo.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allCount = workOrders.length;
  const completedCount = workOrders.filter(wo => wo.status === 'completed').length;

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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <List className="w-4 h-4" />
          <span>All</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {allCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'completed' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Completed</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {completedCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
        >
          <Plus className="w-4 h-4" />
          <span>Create Work Order</span>
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Create New Tab */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create New Work Order</h2>
              <p className="text-sm text-gray-500">Fill in the details to create a work order on behalf of a resident</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Property Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList className="w-5 h-5 text-gray-600" />
                <h3 className="font-medium text-gray-900">Property Information</h3>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.propertySearch}
                  onChange={(e) => handlePropertySearch(e.target.value)}
                  onFocus={() => formData.propertySearch && setShowPropertyDropdown(true)}
                  placeholder="Search by Property ID or Community Name..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {showPropertyDropdown && propertySearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {propertySearchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProperty(p)}
                        className="w-full px-4 py-2 text-left hover:bg-blue-50 text-sm"
                      >
                        <span className="font-medium">{p.property_id || p.name}</span>
                        <span className="text-gray-500 ml-2">{p.address}</span>
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
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Address</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.address || '-'}</p>
                    </div>
                  </div>
                  {/* Property Type Specific Fields */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    {(selectedProperty.property_type === 'gated_community' || selectedProperty.property_type === 'GC') && (
                      <>
                        <div><p className="text-xs text-gray-500 mb-1">Total Units</p><p className="text-sm font-medium text-gray-900">{selectedProperty.total_units || '-'}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Blocks</p><p className="text-sm font-medium text-gray-900">{selectedProperty.blocks || selectedProperty.number_of_blocks || '-'}</p></div>
                      </>
                    )}
                    {(selectedProperty.property_type === 'apartment' || selectedProperty.property_type === 'APT') && (
                      <>
                        <div><p className="text-xs text-gray-500 mb-1">Total Units</p><p className="text-sm font-medium text-gray-900">{selectedProperty.total_units || '-'}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Tower/Block</p><p className="text-sm font-medium text-gray-900">{selectedProperty.tower_name || selectedProperty.block_number || '-'}</p></div>
                      </>
                    )}
                    {(selectedProperty.property_type === 'villa' || selectedProperty.property_type === 'VILLA') && (
                      <div><p className="text-xs text-gray-500 mb-1">Villa Number</p><p className="text-sm font-medium text-gray-900">{selectedProperty.villa_number || selectedProperty.villa_plot_number || '-'}</p></div>
                    )}
                    {(selectedProperty.property_type === 'plot' || selectedProperty.property_type === 'PLOT') && (
                      <div><p className="text-xs text-gray-500 mb-1">Plot Number</p><p className="text-sm font-medium text-gray-900">{selectedProperty.plot_number || selectedProperty.villa_plot_number || '-'}</p></div>
                    )}
                    {(selectedProperty.property_type === 'flat' || selectedProperty.property_type === 'FLAT') && (
                      <>
                        <div><p className="text-xs text-gray-500 mb-1">Block</p><p className="text-sm font-medium text-gray-900">{selectedProperty.block || selectedProperty.block_number || '-'}</p></div>
                        <div><p className="text-xs text-gray-500 mb-1">Flat Number</p><p className="text-sm font-medium text-gray-900">{selectedProperty.flat_number || '-'}</p></div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h3 className="font-medium text-gray-900">Customer Details</h3>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Customer name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="customer@email.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="Phone number"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcategory <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.subcategoryId}
                  onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                  disabled={!formData.categoryId}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">{formData.categoryId ? 'Select subcategory' : 'Select a category first'}</option>
                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the issue or request in detail..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{formData.description.length}/500</p>
            </div>

            {/* Permission & Pet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permission to Enter <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Allow entry if resident is unavailable</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'yes' })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors ${
                      formData.permissionToEnter === 'yes' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'no' })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors ${
                      formData.permissionToEnter === 'no' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Has Pet? <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Does the resident have a pet?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'yes' })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors ${
                      formData.hasPet === 'yes' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'no' })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors ${
                      formData.hasPet === 'no' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* Entry Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Notes (Optional)</label>
              <input
                type="text"
                value={formData.entryNotes}
                onChange={(e) => setFormData({ ...formData, entryNotes: e.target.value })}
                placeholder="Special instructions for entry (gate code, parking, etc.)..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-3">
                {priorityOptions.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p.value })}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium transition-colors ${
                      formData.priority === p.value ? p.color + ' border-current' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional - max 5 files)</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2"
                >
                  <Image className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500">Gallery</span>
                </button>
                <button
                  type="button"
                  className="flex-1 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2"
                >
                  <Camera className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-2"
                >
                  <FileText className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500">Files</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              {attachments.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative group">
                      <div className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                        {att.file.type.startsWith('image/') ? (
                          <img src={att.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Create Work Order
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Pending / Completed Tabs */}
      {activeTab !== 'create' && (
        <>
          {/* Search */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Work Order ID, category, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Search className="w-4 h-4" /> Search
              </button>
              {/* Status Filter Dropdown */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white min-w-[140px]"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={() => { setSearchTerm(''); setStatusFilter(''); }} className="px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Clear
              </button>
            </div>
          </div>

          {/* Work Orders List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No work orders found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Order ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Resident</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created By</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkOrders.map((wo) => (
                      <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900">{wo.work_order_id}</p>
                          <p className="text-sm text-gray-500">{wo.title}</p>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600">{wo.customer_name || wo.client_name || '-'}</td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{wo.category_name || '-'}</p>
                            {wo.subcategory_name && <p className="text-xs text-gray-500">{wo.subcategory_name}</p>}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                            {wo.status?.replace(/_/g, ' ').toUpperCase()}
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
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
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
        </>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Work Order Details</h2>
              <button onClick={() => { setShowViewModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
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
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${selectedWorkOrder.priority === 'high' ? 'bg-red-100 text-red-700' : selectedWorkOrder.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
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
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.vendor_name || 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedWorkOrder.created_at)}</p>
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
                      const fileUrl = `/${filePath}`;
                      return (
                        <a
                          key={att.id}
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-colors group"
                        >
                          {att.file_type?.startsWith('image/') ? (
                            <img
                              src={fileUrl}
                              alt={att.original_name || att.file_name}
                              className="w-full h-20 object-cover rounded"
                            />
                          ) : (
                            <div className="w-full h-20 bg-gray-100 rounded flex items-center justify-center">
                              <span className="text-2xl">📄</span>
                            </div>
                          )}
                          <p className="text-xs font-medium text-gray-700 truncate mt-1 group-hover:text-blue-600">{att.original_name || att.file_name}</p>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowViewModal(false); setSelectedWorkOrder(null); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal - for entering cancellation note */}
      {showCancelModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Cancel Work Order</h2>
              <p className="text-sm text-gray-500 mt-1">Please provide a reason for cancellation</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Note <span className="text-red-500">*</span></label>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowCancelModal(false); setCancelNote(''); }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!cancelNote.trim()) {
                      setMessage({ type: 'error', text: 'Cancellation note is required' });
                      return;
                    }
                    try {
                      const response = await fetch(`/api/supervisor/work-orders/${selectedWorkOrder.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'cancelled', cancelNote })
                      });
                      const result = await response.json();
                      if (result.success) {
                        setMessage({ type: 'success', text: 'Work order cancelled' });
                        setShowCancelModal(false);
                        setCancelNote('');
                        fetchWorkOrders();
                      } else {
                        setMessage({ type: 'error', text: result.message || 'Failed to cancel' });
                      }
                    } catch (error) {
                      setMessage({ type: 'error', text: 'Failed to cancel work order' });
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorWorkOrders;
