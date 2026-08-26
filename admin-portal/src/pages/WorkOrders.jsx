import { useState, useEffect, useCallback } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import { Search, Eye, X, XCircle, Check, Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Shield, RefreshCw, ClipboardList, CheckCircle, CheckCircle2, Pencil, Plus, Building2, User, List, Download, Lock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ITEMS_PER_PAGE = 10;

const WorkOrders = ({ admin }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'completed', or 'create'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
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
  
  // Auto-delete notification states
  const [approachingDeletion, setApproachingDeletion] = useState([]);
  const [showDeletionWarning, setShowDeletionWarning] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // FP Context
  const { fpList, selectedFp, selectFp, loading: fpLoading } = useFP();
  const token = getAuthToken();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);

  const fetchWorkOrders = useCallback(async () => {
    if (!selectedFp) return;
    setLoading(true);
    
    try {
      let endpoint;
      const statusParam = activeTab === 'all' ? '' : `?status=${activeTab}`;
      if (selectedFp.id === 'all') {
        endpoint = `${API_BASE}/api/admin/all-work-orders${statusParam}`;
      } else {
        endpoint = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/work-orders${statusParam}`;
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

  // Fetch work orders approaching auto-deletion (30 days after closed/cancelled)
  const fetchApproachingDeletion = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/admin/work-orders/approaching-deletion`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        setApproachingDeletion(result.data);
        setShowDeletionWarning(true);
      }
    } catch (error) {
      console.error('Fetch approaching deletion error:', error);
    }
  }, [token]);

  // Auto-select "Admin (All FPs)" if no FP is selected
  useEffect(() => {
    if (!selectedFp && !fpLoading) {
      selectFp({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' });
    }
  }, [selectedFp, fpLoading, selectFp]);

  useEffect(() => {
    if (selectedFp) {
      fetchWorkOrders();
      fetchApproachingDeletion();
    }
  }, [fetchWorkOrders, fetchApproachingDeletion, selectedFp]);

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

  // Handle property selection
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

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setFormData({ ...formData, categoryId, subcategoryId: '' });
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };

  // Add new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), subcategoryName: newSubcategoryName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        const catRes = await fetch(`${API_BASE}/api/admin/categories`, { headers: { 'Authorization': `Bearer ${token}` } });
        const catData = await catRes.json();
        if (catData.success) setCategories(catData.data);
        setNewCategoryName('');
        setNewSubcategoryName('');
        setShowAddCategoryModal(false);
        setSuccess(`Category "${newCategoryName}" added successfully`);
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  // Delete category (admin-created only)
  const handleDeleteCategory = async (categoryId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this category?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if ((await res.json()).success) {
        setCategories(categories.filter(c => c.id !== categoryId));
        if (formData.categoryId === String(categoryId)) {
          setFormData({ ...formData, categoryId: '', subcategoryId: '' });
          setCategorySearch('');
        }
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  // Delete subcategory
  const handleDeleteSubcategory = async (subcategoryId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this subcategory?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/subcategories/${subcategoryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if ((await res.json()).success) {
        setSubcategories(subcategories.filter(s => s.id !== subcategoryId));
        if (formData.subcategoryId === String(subcategoryId)) {
          setFormData({ ...formData, subcategoryId: '' });
          setSubcategorySearch('');
        }
      }
    } catch (error) {
      console.error('Error deleting subcategory:', error);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name?.toLowerCase().includes((categorySearch || '').toLowerCase())
  );
  
  const filteredSubcategories = subcategories.filter(s => 
    s.name?.toLowerCase().includes((subcategorySearch || '').toLowerCase())
  );

  // Handle create work order submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.propertyId) {
      setError('Please select a property');
      return;
    }
    if (!formData.customerName?.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!formData.customerPhone?.trim()) {
      setError('Customer phone number is required');
      return;
    }
    if (!formData.categoryId) {
      setError('Please select a category');
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
        setActiveTab('all');
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
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'requested': return 'bg-orange-100 text-orange-700';
      case 'under_review': return 'bg-amber-100 text-amber-700';
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'accepted': return 'bg-indigo-100 text-indigo-700';
      case 'in_progress': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-200 text-gray-700';
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

  // Filter by tab, search and status dropdown
  const filteredOrders = workOrders.filter(wo => {
    // Tab filter - All shows everything, Completed shows only completed, Closed shows only closed
    if (activeTab === 'completed' && wo.status !== 'completed') return false;
    if (activeTab === 'closed' && wo.status !== 'closed') return false;
    
    // Status dropdown filter
    if (statusFilter && wo.status !== statusFilter) return false;
    
    // Search filter
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      wo.work_order_id?.toLowerCase().includes(q) ||
      wo.title?.toLowerCase().includes(q) ||
      wo.property_name?.toLowerCase().includes(q) ||
      wo.category_name?.toLowerCase().includes(q) ||
      wo.property_code?.toLowerCase().includes(q) ||
      wo.actual_property_id?.toLowerCase().includes(q) ||
      wo.property_id?.toString().toLowerCase().includes(q) ||
      wo.customer_name?.toLowerCase().includes(q)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activeTab, selectedFp]);

  // Export all work orders to Excel
  const exportAllWorkOrders = () => {
    if (filteredOrders.length === 0) {
      setSuccess('No work orders to export');
      return;
    }

    const exportData = filteredOrders.map(wo => ({
      'Order ID': wo.work_order_id || '',
      'Resident': wo.customer_name || '',
      'Property': wo.property_name || '',
      'Category': wo.category_name || '',
      'Subcategory': wo.subcategory_name || '',
      'Status': wo.status?.replace('_', ' ') || '',
      'Priority': wo.priority || '',
      'Description': wo.description || '',
      'Created Date': wo.created_at ? new Date(wo.created_at).toLocaleDateString('en-IN') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Work Orders');
    XLSX.writeFile(wb, `work_orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    setSuccess(`Exported ${filteredOrders.length} work orders`);
  };

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
        
        <div className="flex items-center gap-3">
          {/* Create Work Order Button */}
          <button
            onClick={() => setActiveTab('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </button>
          
          {/* FP Switcher */}
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
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <Check className="w-5 h-5" /><span>{success}</span>
        </div>
      )}

      {/* Auto-Delete Warning Notification */}
      {showDeletionWarning && approachingDeletion.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-amber-800">Work Orders Approaching Auto-Delete</h4>
              <p className="text-sm text-amber-700 mt-1">
                {approachingDeletion.length} work order(s) will be automatically deleted within 7 days. 
                Closed and cancelled work orders are deleted 30 days after completion.
              </p>
              <div className="mt-2 space-y-1">
                {approachingDeletion.slice(0, 3).map(wo => (
                  <div key={wo.id} className="text-sm text-amber-700">
                    • <strong>{wo.workOrderId}</strong> - {wo.title} ({wo.daysUntilDeletion} days left)
                  </div>
                ))}
                {approachingDeletion.length > 3 && (
                  <div className="text-sm text-amber-600">...and {approachingDeletion.length - 3} more</div>
                )}
              </div>
            </div>
            <button onClick={() => setShowDeletionWarning(false)} className="text-amber-600 hover:text-amber-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs: All / Completed */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <List className="w-4 h-4" />
          All
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            activeTab === 'all' ? 'bg-amber-200 text-amber-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {workOrders.length}
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
            {workOrders.filter(wo => wo.status === 'completed').length}
          </span>
        </button>
        <button
          onClick={fetchWorkOrders}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={exportAllWorkOrders}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          title="Export All Work Orders"
        >
          <Download className="w-4 h-4" />
          Export All
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
              )}
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type="text"
                      value={categorySearch || categories.find(c => c.id === parseInt(formData.categoryId))?.name || ''}
                      onChange={(e) => { setCategorySearch(e.target.value); setShowCategoryDropdown(true); }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 400)}
                      placeholder="Select a category"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" />
                    {showCategoryDropdown && (
                      <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredCategories.map(cat => (
                          <div key={cat.id} className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 ${formData.categoryId === String(cat.id) ? 'bg-blue-50' : ''}`}>
                            <button type="button" onMouseDown={() => { handleCategoryChange(cat.id); setCategorySearch(cat.name); setShowCategoryDropdown(false); }}
                              className={`flex-1 text-left text-sm ${formData.categoryId === String(cat.id) ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{cat.name}</button>
                            {!cat.isDefault && (
                              <button type="button" onMouseDown={(e) => handleDeleteCategory(cat.id, e)} className="p-1 text-red-400 hover:text-red-600 rounded"><X className="w-3 h-3" /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowAddCategoryModal(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                <div className="relative">
                  <input type="text"
                    value={subcategorySearch || subcategories.find(s => s.id === parseInt(formData.subcategoryId))?.name || ''}
                    onChange={(e) => { setSubcategorySearch(e.target.value); setShowSubcategoryDropdown(true); }}
                    onFocus={() => setShowSubcategoryDropdown(true)}
                    onBlur={() => setTimeout(() => setShowSubcategoryDropdown(false), 400)}
                    placeholder={formData.categoryId ? 'Select a subcategory' : 'Select a category first'}
                    disabled={!formData.categoryId}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed" />
                  {showSubcategoryDropdown && formData.categoryId && (
                    <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredSubcategories.map(sub => (
                        <div key={sub.id} className={`flex items-center justify-between px-3 py-2 hover:bg-blue-50 ${formData.subcategoryId === String(sub.id) ? 'bg-blue-50' : ''}`}>
                          <button type="button" onMouseDown={() => { setFormData({ ...formData, subcategoryId: String(sub.id) }); setSubcategorySearch(sub.name); setShowSubcategoryDropdown(false); }}
                            className={`flex-1 text-left text-sm ${formData.subcategoryId === String(sub.id) ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{sub.name}</button>
                          {sub.name !== 'Other' && !categories.find(c => c.id === parseInt(formData.categoryId))?.isDefault && (
                            <button type="button" onMouseDown={(e) => handleDeleteSubcategory(sub.id, e)} className="p-1 text-red-400 hover:text-red-600 rounded"><X className="w-3 h-3" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
              placeholder="Search by Property ID..." 
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
            onClick={() => { setSearchInput(''); setSearchTerm(''); setStatusFilter(''); fetchWorkOrders(); }} 
            className="p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Created By</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-12 text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                  Loading work orders...
                </td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-12 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No {activeTab} work orders found</p>
                  <p className="text-sm text-gray-400 mt-1">Work orders will appear here when created</p>
                </td></tr>
              ) : (
                paginatedOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 font-mono text-sm whitespace-nowrap text-gray-700">{wo.work_order_id}</td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wo.customer_name || wo.title || 'N/A'}</p>
                        {wo.property_name && <p className="text-xs text-gray-500">{wo.property_name}</p>}
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
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        wo.priority === 'high' || wo.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                        wo.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        wo.priority === 'low' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {wo.priority || 'Not Set'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(wo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {wo.created_by_name || wo.created_by || 'System'}
                        </p>
                        {(wo.property_code || wo.property_id) && (
                          <p className="text-xs text-gray-500">{wo.property_code || wo.property_id}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center">
                        <button onClick={() => setSelectedOrder(wo)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {filteredOrders.length > 0 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} work orders
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
        </>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Work Order Details</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedOrder.work_order_id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Customer Name</p>
                    <p className="font-medium text-gray-900 mt-1">{selectedOrder.customer_name || [selectedOrder.first_name, selectedOrder.last_name].filter(Boolean).join(' ') || 'N/A'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <p className="font-medium text-gray-900 mt-1 text-sm truncate" title={selectedOrder.customer_email || selectedOrder.email || 'N/A'}>
                      {selectedOrder.customer_email || selectedOrder.email || 'N/A'}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                    <p className="font-medium text-gray-900 mt-1">{selectedOrder.customer_phone || selectedOrder.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Property Details Section */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Property Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Property Name</p>
                    <p className="font-medium text-gray-900">{selectedOrder.property_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Property ID</p>
                    <p className="font-medium text-gray-900 font-mono text-blue-600">{selectedOrder.actual_property_id || selectedOrder.property_code || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Property Type</p>
                    <p className="font-medium text-gray-900 capitalize">{selectedOrder.property_type?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Zone / Division</p>
                    <p className="font-medium text-gray-900">{selectedOrder.zone || 'N/A'} / {selectedOrder.division || 'N/A'}</p>
                  </div>
                  {(selectedOrder.property_type === 'gated_community' || selectedOrder.property_type === 'apartment') && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">Total Units</p>
                        <p className="font-medium text-gray-900">{selectedOrder.total_units || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Blocks</p>
                        <p className="font-medium text-gray-900">{selectedOrder.total_blocks || 'N/A'}</p>
                      </div>
                    </>
                  )}
                  {selectedOrder.block && (
                    <div>
                      <p className="text-xs text-gray-500">Block</p>
                      <p className="font-medium text-gray-900">{selectedOrder.block}</p>
                    </div>
                  )}
                  {selectedOrder.flat_number && (
                    <div>
                      <p className="text-xs text-gray-500">Flat/Unit</p>
                      <p className="font-medium text-gray-900">{selectedOrder.flat_number}</p>
                    </div>
                  )}
                  {selectedOrder.property_address && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-medium text-gray-900">{selectedOrder.property_address}{selectedOrder.property_city ? `, ${selectedOrder.property_city}` : ''}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Work Order Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{selectedOrder.category_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subcategory</p>
                  <p className="font-medium text-gray-900">{selectedOrder.subcategory_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                    selectedOrder.priority === 'high' || selectedOrder.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    selectedOrder.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {selectedOrder.priority}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Assigned To</p>
                  <p className="font-medium text-gray-900">{selectedOrder.vendor_name || selectedOrder.assigned_employee_name || 'Not Assigned'}</p>
                </div>
              </div>

              {selectedOrder.title && (
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-medium text-gray-900">{selectedOrder.title}</p>
                </div>
              )}

              {selectedOrder.description && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <p className="text-sm font-medium text-amber-800 mb-1">Description</p>
                  <p className="text-gray-700">{selectedOrder.description}</p>
                </div>
              )}

              {/* Entry Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedOrder.permission_to_enter === 'yes' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-sm text-gray-600">Permission to Enter: <span className="font-medium">{selectedOrder.permission_to_enter || 'N/A'}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedOrder.has_pet === 'yes' ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                  <span className="text-sm text-gray-600">Has Pet: <span className="font-medium">{selectedOrder.has_pet || 'N/A'}</span></span>
                </div>
              </div>

              {selectedOrder.entry_notes && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Entry Notes</p>
                  <p className="text-gray-700">{selectedOrder.entry_notes}</p>
                </div>
              )}

              {/* Attachments Section */}
              {selectedOrder.attachments && selectedOrder.attachments.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Attachments ({selectedOrder.attachments.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedOrder.attachments.map((att) => {
                      // Handle various file_path formats: /uploads/file.png, uploads/file.png, or just file.png
                      let filePath = att.file_path || att.file_name || '';
                      if (filePath.startsWith('/')) filePath = filePath.substring(1);
                      if (!filePath.startsWith('uploads/')) filePath = `uploads/${filePath}`;
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
              {selectedOrder.status === 'completed' && selectedOrder.closing_notes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Completion Notes
                  </p>
                  <p className="text-sm text-green-700">{selectedOrder.closing_notes}</p>
                </div>
              )}

              {/* Cancellation Note Section - Show when work order is cancelled */}
              {selectedOrder.status === 'cancelled' && selectedOrder.cancellation_note && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Cancellation Reason
                  </p>
                  <p className="text-sm text-red-700">{selectedOrder.cancellation_note}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setSelectedOrder(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Close</button>
                <button onClick={() => handleEditWorkOrder(selectedOrder)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Edit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Order Modal */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                          <option value="closed">Closed</option>
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

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddCategoryModal(false); setNewCategoryName(''); setNewSubcategoryName(''); }}>
          <div className="bg-white rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Add New Category</h2>
              <button onClick={() => { setShowAddCategoryModal(false); setNewCategoryName(''); setNewSubcategoryName(''); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name <span className="text-red-500">*</span></label>
                <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Enter category name" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Subcategory <span className="text-gray-400">(Optional)</span></label>
                <input type="text" value={newSubcategoryName} onChange={(e) => setNewSubcategoryName(e.target.value)} placeholder="Enter subcategory name" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setShowAddCategoryModal(false); setNewCategoryName(''); setNewSubcategoryName(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Add Category</button>
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

export default WorkOrders;
