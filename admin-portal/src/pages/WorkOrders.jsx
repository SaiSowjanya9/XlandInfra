import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, X, Check, Clock, AlertCircle, ChevronDown, Shield, RefreshCw, ClipboardList, CheckCircle2, Pencil, Plus, Building2, User } from 'lucide-react';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const WorkOrders = ({ admin }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'completed', or 'create'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [formData, setFormData] = useState({
    propertyId: '', categoryId: '', subcategoryId: '',
    customerName: '', customerEmail: '', customerPhone: '',
    description: '', priority: 'medium',
    permissionToEnter: 'no', hasPet: 'no', entryNotes: ''
  });
  const [editFormData, setEditFormData] = useState({
    categoryId: '', subcategoryId: '', description: '',
    permissionToEnter: '', hasPet: '', entryNotes: '',
    priority: 'medium', status: '',
    customerName: '', customerEmail: '', customerPhone: '',
    block: '', flatNumber: ''
  });
  
  // FP Context
  const { fpList, selectedFp, selectFp, loading: fpLoading } = useFP();
  const token = sessionStorage.getItem('pm_auth_token');
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);

  const fetchWorkOrders = useCallback(async () => {
    if (!selectedFp) return;
    setLoading(true);
    
    try {
      let endpoint;
      if (selectedFp.id === 'all') {
        endpoint = `${API_BASE}/api/admin/all-work-orders?status=${activeTab}`;
      } else {
        endpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/work-orders?status=${activeTab}`;
      }
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) setWorkOrders(result.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedFp, activeTab, token]);

  useEffect(() => {
    if (selectedFp) {
      fetchWorkOrders();
    }
  }, [fetchWorkOrders, selectedFp]);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/admin/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) setCategories(result.data || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, [token]);

  // Fetch properties when FP is selected or tab changes to create
  useEffect(() => {
    const fetchProperties = async () => {
      if (!selectedFp) {
        console.log('[WorkOrders] No FP selected, skipping property fetch');
        return;
      }
      try {
        let endpoint;
        if (selectedFp.id === 'all') {
          endpoint = `${API_BASE}/api/admin/all-properties`;
        } else {
          endpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/properties`;
        }
        console.log('[WorkOrders] Fetching properties from:', endpoint, 'Token:', token ? 'present' : 'missing');
        const response = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('[WorkOrders] Response status:', response.status);
        const result = await response.json();
        console.log('[WorkOrders] Properties response:', result.success, 'count:', result.data?.length);
        if (result.success) {
          setProperties(result.data || []);
          if (result.data?.length > 0) {
            console.log('[WorkOrders] First property:', result.data[0].property_id, result.data[0].name);
          }
        } else {
          console.error('[WorkOrders] API error:', result.message);
        }
      } catch (error) {
        console.error('[WorkOrders] Error fetching properties:', error);
      }
    };
    if (activeTab === 'create') {
      fetchProperties();
    }
  }, [selectedFp, token, activeTab]);

  // Filter properties based on search - also check propertyId (camelCase from onboarded)
  const filteredProperties = propertySearch && !formData.propertyId ? properties.filter(p => {
    const searchLower = propertySearch.toLowerCase();
    const propId = (p.property_id || p.propertyId || '').toLowerCase();
    const propName = (p.name || p.communityName || '').toLowerCase();
    return propId.includes(searchLower) || propName.includes(searchLower);
  }) : [];
  
  // Debug log for filtering
  if (propertySearch && properties.length > 0) {
    console.log('[WorkOrders] Filtering:', propertySearch, 'from', properties.length, 'properties, found:', filteredProperties.length);
  }

  // Handle property selection
  const handlePropertySelect = (property) => {
    setSelectedProperty(property);
    setFormData({
      ...formData,
      propertyId: property.id,
      customerName: property.contact_person || property.contactPerson || property.owner_name || '',
      customerEmail: property.contact_email || property.contactEmail || property.email || '',
      customerPhone: property.contact_phone || property.contactPhone || property.phone || property.mobile || ''
    });
    setPropertySearch(property.property_id || '');
  };

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setFormData({ ...formData, categoryId, subcategoryId: '' });
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };

  // Handle create work order submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.propertyId || !formData.categoryId) {
      setSuccess('Please select property and category');
      return;
    }
    try {
      const property = properties.find(p => p.id === formData.propertyId);
      const category = categories.find(c => c.id === parseInt(formData.categoryId));
      const subcategory = subcategories.find(s => s.id === parseInt(formData.subcategoryId));
      
      const payload = {
        propertyId: formData.propertyId,
        propertyName: property?.name || '',
        categoryId: formData.categoryId,
        categoryName: category?.name || '',
        subcategoryId: formData.subcategoryId,
        subcategoryName: subcategory?.name || '',
        description: formData.description,
        priority: formData.priority,
        permissionToEnter: formData.permissionToEnter,
        hasPet: formData.hasPet,
        entryNotes: formData.entryNotes,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone
      };
      
      const response = await fetch(`${API_BASE}/api/admin/work-orders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Work order created successfully!');
        setFormData({
          propertyId: '', categoryId: '', subcategoryId: '',
          customerName: '', customerEmail: '', customerPhone: '',
          description: '', priority: 'medium',
          permissionToEnter: 'no', hasPet: 'no', entryNotes: ''
        });
        setPropertySearch('');
        setSelectedProperty(null);
        setActiveTab('pending');
        fetchWorkOrders();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error creating work order:', error);
    }
  };
  
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
  };

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/work-orders/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess(`Status updated to ${status.replace(/_/g, ' ')}`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleEditWorkOrder = (wo) => {
    setSelectedOrder(null);
    setTimeout(() => {
      setSelectedOrder(wo);
      setEditFormData({
        categoryId: wo.category_id || '',
        subcategoryId: wo.subcategory_id || '',
        description: wo.description || '',
        permissionToEnter: wo.permission_to_enter || '',
        hasPet: wo.has_pet || '',
        entryNotes: wo.entry_notes || '',
        priority: wo.priority || 'medium',
        status: wo.status || 'pending',
        customerName: wo.customer_name || [wo.first_name, wo.last_name].filter(Boolean).join(' ') || '',
        customerEmail: wo.customer_email || wo.email || '',
        customerPhone: wo.customer_phone || wo.phone || '',
        block: wo.block || '',
        flatNumber: wo.flat_number || ''
      });
      setShowEditModal(true);
    }, 100);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    try {
      const response = await fetch(`${API_BASE}/api/admin/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          category_id: editFormData.categoryId,
          subcategory_id: editFormData.subcategoryId,
          description: editFormData.description,
          permission_to_enter: editFormData.permissionToEnter,
          has_pet: editFormData.hasPet,
          entry_notes: editFormData.entryNotes,
          priority: editFormData.priority,
          status: editFormData.status,
          customer_name: editFormData.customerName,
          customer_email: editFormData.customerEmail,
          customer_phone: editFormData.customerPhone,
          block: editFormData.block,
          flat_number: editFormData.flatNumber
        })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Work order updated successfully');
        setShowEditModal(false);
        setSelectedOrder(null);
        fetchWorkOrders();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get viewing label
  const getViewingLabel = () => {
    if (selectedFp && selectedFp.id !== 'all') {
      return `Viewing work orders for ${selectedFp.companyName}`;
    }
    return `Viewing all work orders (Admin Mode)`;
  };

  // Filter by search and status
  const filteredOrders = workOrders.filter(wo => {
    // Status filter
    if (statusFilter && wo.status !== statusFilter) return false;
    
    // Search filter
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      wo.work_order_id?.toLowerCase().includes(q) ||
      wo.title?.toLowerCase().includes(q) ||
      wo.property_name?.toLowerCase().includes(q) ||
      wo.category_name?.toLowerCase().includes(q)
    );
  });

  // If no FP selected, show FP selection
  if (!selectedFp) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 mt-1">Select a Franchise Partner to view work orders</p>
        </div>
        <div className="bg-gray-50 rounded-2xl p-12 text-center">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Select Franchise Partner</h2>
          <p className="text-gray-500 mb-6">Choose an FP from the list or view all work orders</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' })}
              className="px-6 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Admin (All FPs)
            </button>
            {fpList.map(fp => (
              <button
                key={fp.id}
                onClick={() => handleFpSelect(fp)}
                className="px-6 py-3 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:bg-teal-50 transition-colors"
              >
                {fp.fpId} - {fp.companyName}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with FP Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Work Orders</h1>
          <p className="text-gray-500 text-sm mt-1">
            {getViewingLabel()} • {workOrders.length} orders
          </p>
        </div>
        
        {/* FP Switcher - Top Right */}
        <div className="relative">
          <button
            onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
            className="flex items-center gap-3 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
            <span className="font-medium text-gray-700">
              {selectedFp.id === 'all' ? 'Admin (All FPs)' : selectedFp.fpId}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {fpDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
              <button
                onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' })}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-gray-100 ${
                  selectedFp.id === 'all' ? 'bg-slate-50' : ''
                }`}
              >
                <div className="font-medium flex items-center gap-2 text-slate-700">
                  <Shield className="w-4 h-4" />
                  Admin (All FPs)
                </div>
              </button>
              {fpList.map(fp => (
                <button
                  key={fp.id}
                  onClick={() => handleFpSelect(fp)}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                    selectedFp.id === fp.id ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">{fp.fpId}</span>
                    <span className="text-xs text-gray-500">{fp.ownerName}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <Check className="w-5 h-5" /><span>{success}</span>
        </div>
      )}

      {/* Tabs: Pending / Completed */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'pending' ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {activeTab === 'pending' ? workOrders.length : ''}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
            activeTab === 'completed'
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Completed
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'completed' ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {activeTab === 'completed' ? workOrders.length : ''}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
            activeTab === 'create'
              ? 'bg-blue-100 text-blue-700 border border-blue-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <Plus className="w-4 h-4" />
          Create New
        </button>
        <button
          onClick={fetchWorkOrders}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Create New Work Order Form */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create New Work Order</h2>
              <p className="text-sm text-gray-500">Fill in the details to create a work order on behalf of a resident</p>
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-6">
            {/* Property Information */}
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
                {filteredProperties.length > 0 && !formData.propertyId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredProperties.map((p) => (
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
                {propertySearch && filteredProperties.length === 0 && !formData.propertyId && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
                    No properties found
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
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.division || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">City</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Total Units</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.total_units || selectedProperty.units || '1'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Address</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.address || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="bg-gray-50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Customer Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} placeholder="Customer name" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.customerEmail} onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })} placeholder="customer@email.com" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                  <input type="tel" required value={formData.customerPhone} onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} placeholder="Phone number" className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                <select required value={formData.categoryId} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Select a category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                <select value={formData.subcategoryId} onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" disabled={!formData.categoryId}>
                  <option value="">{formData.categoryId ? 'Select a subcategory' : 'Select a category first'}</option>
                  {subcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(Optional)</span></label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} placeholder="Describe the issue or request in detail..." className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Create Work Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter */}
      {activeTab !== 'create' && (
        <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by Work Order ID, category, or name..." 
              value={searchInput} 
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearchTerm(searchInput)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
          <button 
            onClick={() => setSearchTerm(searchInput)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
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
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button 
            onClick={() => { setSearchInput(''); setSearchTerm(''); setStatusFilter(''); }} 
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Order ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Resident</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Created By</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600 whitespace-nowrap text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-12 text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                  Loading work orders...
                </td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-12 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No {activeTab} work orders found</p>
                  <p className="text-sm text-gray-400 mt-1">Work orders will appear here when created</p>
                </td></tr>
              ) : (
                filteredOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 font-mono text-sm whitespace-nowrap text-gray-700">{wo.work_order_id}</td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wo.customer_name || wo.title || 'N/A'}</p>
                        <p className="text-xs text-gray-500">{wo.property_name || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wo.category_name || '-'}</p>
                        {wo.subcategory_name && <p className="text-xs text-gray-500">{wo.subcategory_name}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative inline-block">
                        <select
                          value={wo.status}
                          onChange={(e) => {
                            updateStatus(wo.id, e.target.value);
                            setWorkOrders(prev => prev.map(w => w.id === wo.id ? { ...w, status: e.target.value } : w));
                          }}
                          className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(wo.status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="assigned">Assigned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="closed">Closed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-current opacity-70" />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(wo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4 text-center w-24">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelectedOrder(wo)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditWorkOrder(wo)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredOrders.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            Showing {filteredOrders.length} of {workOrders.length} work orders
          </div>
        )}
      </div>
        </>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold">Work Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div>
                <p className="text-sm text-gray-500">Order ID</p>
                <p className="font-mono font-medium">{selectedOrder.work_order_id}</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 uppercase">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 uppercase">Priority:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedOrder.priority === 'high' || selectedOrder.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    selectedOrder.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {selectedOrder.priority}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer Name</p>
                  <p className="font-medium">{selectedOrder.customer_name || [selectedOrder.first_name, selectedOrder.last_name].filter(Boolean).join(' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-sm text-gray-600 break-all">{selectedOrder.customer_email || selectedOrder.email || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{selectedOrder.customer_phone || selectedOrder.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Property/Community</p>
                  <p className="font-medium">{selectedOrder.property_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Property ID</p>
                  <p className="font-medium font-mono text-blue-600">{selectedOrder.property_code || selectedOrder.actual_property_id || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Block</p>
                  <p className="font-medium">{selectedOrder.block || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Property Type</p>
                  <p className="font-medium capitalize">{selectedOrder.property_type?.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Zone</p>
                  <p className="font-medium">{selectedOrder.zone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Division</p>
                  <p className="font-medium">{selectedOrder.division || 'N/A'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{[selectedOrder.address, selectedOrder.city, selectedOrder.state].filter(Boolean).join(', ') || 'N/A'}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="font-medium">{selectedOrder.contact_person || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact Phone</p>
                  <p className="font-medium">{selectedOrder.contact_phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact Email</p>
                  <p className="font-medium text-sm break-all">{selectedOrder.contact_email || 'N/A'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium">{selectedOrder.category_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subcategory</p>
                  <p className="font-medium">{selectedOrder.subcategory_name || 'N/A'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedOrder.description || 'No description provided'}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${selectedOrder.permission_to_enter === 'yes' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-sm">Permission to Enter: {selectedOrder.permission_to_enter}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${selectedOrder.has_pet === 'yes' ? 'bg-amber-500' : 'bg-gray-300'}`}></span>
                  <span className="text-sm">Has Pet: {selectedOrder.has_pet}</span>
                </div>
              </div>
              {selectedOrder.entry_notes && (
                <div>
                  <p className="text-sm text-gray-500">Entry Notes</p>
                  <p className="mt-1 p-3 bg-amber-50 rounded-lg text-sm">{selectedOrder.entry_notes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => handleEditWorkOrder(selectedOrder)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Edit</button>
              <button onClick={() => setSelectedOrder(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Order Modal */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Work Order</h2>
                  <p className="text-sm text-gray-500">{selectedOrder.work_order_id}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Property Info (Read Only) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Property Information</h3>
                <p className="text-sm text-gray-600">{selectedOrder.property_name || 'N/A'}</p>
                <p className="text-xs text-gray-500">Zone: {selectedOrder.zone || 'N/A'} | Division: {selectedOrder.division || 'N/A'}</p>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input type="text" value={editFormData.customerName} onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                  <input type="email" value={editFormData.customerEmail} onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                  <input type="tel" value={editFormData.customerPhone} onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Phone" />
                </div>
              </div>

              {/* Block & Flat */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                  <input type="text" value={editFormData.block} onChange={(e) => setEditFormData({ ...editFormData, block: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Block" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flat/Unit Number</label>
                  <input type="text" value={editFormData.flatNumber} onChange={(e) => setEditFormData({ ...editFormData, flatNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Flat/Unit" />
                </div>
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={editFormData.categoryId} onChange={(e) => setEditFormData({ ...editFormData, categoryId: e.target.value, subcategoryId: '' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <select value={editFormData.subcategoryId} onChange={(e) => setEditFormData({ ...editFormData, subcategoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Subcategory</option>
                    {(categories.find(c => c.id === parseInt(editFormData.categoryId))?.subcategories || []).map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Describe the issue..." />
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select value={editFormData.priority} onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={editFormData.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Permission & Pet */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Permission to Enter</label>
                  <select value={editFormData.permissionToEnter} onChange={(e) => setEditFormData({ ...editFormData, permissionToEnter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Has Pet</label>
                  <select value={editFormData.hasPet} onChange={(e) => setEditFormData({ ...editFormData, hasPet: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              {/* Entry Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entry Notes</label>
                <textarea value={editFormData.entryNotes} onChange={(e) => setEditFormData({ ...editFormData, entryNotes: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500" placeholder="Special instructions..." />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrders;
