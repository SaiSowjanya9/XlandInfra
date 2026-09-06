import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import {
  ClipboardList, Plus, Search, RefreshCw, X, XCircle, AlertCircle,
  CheckCircle, Clock, CheckCircle2, Eye, Image, Camera, FileText, Trash2, List,
  ChevronDown, Pencil, Truck, UserPlus, Store, User, ChevronLeft, ChevronRight
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

const API_BASE = import.meta.env.VITE_API_URL || '';

const SupervisorWorkOrders = ({ user }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    categoryId: '',
    subcategoryId: '',
    description: '',
    permissionToEnter: '',
    hasPet: '',
    entryNotes: '',
    priority: 'medium',
    status: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    block: '',
    flatNumber: ''
  });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [completingWorkOrderId, setCompletingWorkOrderId] = useState(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [propertySearchResults, setPropertySearchResults] = useState([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    propertyId: '', propertySearch: '', categoryId: '', subcategoryId: '', customSubcategory: '',
    customerName: '', customerEmail: '', customerPhone: '',
    description: '', priority: 'medium', permissionToEnter: 'yes', hasPet: 'no', entryNotes: ''
  });

  const token = getAuthToken();

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700 border-green-400' },
    { value: 'medium', label: 'Medium', color: 'bg-amber-50 text-amber-700 border-amber-400' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-400' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-400' }
  ];

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      // Always fetch ALL work orders for accurate tab counts
      const response = await fetch(`${API_BASE}/api/supervisor/work-orders`, { headers: { 'Authorization': `Bearer ${token}` } });
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
      const [propRes, catRes, vendRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/supervisor/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/supervisor/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/supervisor/vendors`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ json: () => ({ success: false }) })),
        fetch(`${API_BASE}/api/supervisor/employees`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ json: () => ({ success: false }) }))
      ]);
      const [propData, catData, vendData, empData] = await Promise.all([propRes.json(), catRes.json(), vendRes.json(), empRes.json()]);
      if (propData.success) setProperties(propData.data || []);
      if (catData.success) setCategories(catData.data || []);
      if (vendData.success) setVendors(vendData.data?.all || vendData.data || []);
      if (empData.success) setEmployees(empData.data || []);
    } catch (error) {
      console.error('Fetch dependencies error:', error);
    }
  };

  useEffect(() => { 
    if (activeTab !== 'create') fetchWorkOrders(); 
    fetchDependencies(); 
  }, [activeTab]);

  const handlePropertySearch = (value) => {
    // Only reset propertyId if user is actively searching (not just clicking)
    setFormData(prev => ({ ...prev, propertySearch: value, propertyId: '' }));
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

  const clearSelectedProperty = () => {
    setSelectedProperty(null);
    setFormData(prev => ({ ...prev, propertyId: '', propertySearch: '', customerName: '', customerEmail: '', customerPhone: '' }));
  };

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

  const selectProperty = (property) => {
    console.log('Selecting property:', property);
    const propId = property.id || property.property_id;
    if (!propId) {
      setMessage({ type: 'error', text: 'Invalid property selection' });
      return;
    }
    const totalUnits = computeTotalUnits(property);
    setSelectedProperty({ ...property, total_units: totalUnits });
    setFormData(prev => ({ 
      ...prev, 
      propertyId: propId,
      propertySearch: property.property_id || property.name || '',
      customerName: property.contact_person || property.contactPerson || property.owner_name || '',
      customerEmail: property.contact_email || property.contactEmail || property.email || '',
      customerPhone: property.contact_phone || property.contactPhone || property.phone || property.mobile || ''
    }));
    setShowPropertyDropdown(false);
    setMessage({ type: '', text: '' }); // Clear any previous error
  };

  const handleCategoryChange = (categoryId) => {
    setFormData(prev => ({ ...prev, categoryId, subcategoryId: '', customSubcategory: '' }));
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };
  
  // Check if "Other" category is selected
  const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
  const isOtherCategory = selectedCategory?.isCustom || selectedCategory?.name === 'Other';

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
    // Use selectedProperty.id as fallback if formData.propertyId is missing
    const actualPropertyId = formData.propertyId || selectedProperty?.id || selectedProperty?.property_id;
    console.log('Submitting form with propertyId:', formData.propertyId, 'actualPropertyId:', actualPropertyId, 'selectedProperty:', selectedProperty);
    if (!actualPropertyId) {
      setMessage({ type: 'error', text: 'Property is required' });
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

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const submitData = new FormData();
      submitData.append('propertyId', actualPropertyId);
      submitData.append('propertyName', selectedProperty?.name || selectedProperty?.community_name || '');
      submitData.append('propertyType', selectedProperty?.property_type || '');
      submitData.append('categoryId', formData.categoryId);
      // Add category name
      const selectedCat = categories.find(c => c.id === parseInt(formData.categoryId));
      submitData.append('categoryName', selectedCat?.name || '');
      // Handle custom subcategory for "Other" category
      if (isOtherCategory && formData.customSubcategory) {
        submitData.append('customSubcategory', formData.customSubcategory);
        submitData.append('subcategoryId', '');
        submitData.append('subcategoryName', formData.customSubcategory);
      } else {
        submitData.append('subcategoryId', formData.subcategoryId || '');
        const selectedSubcat = selectedCat?.subcategories?.find(s => s.id === parseInt(formData.subcategoryId));
        submitData.append('subcategoryName', selectedSubcat?.name || '');
      }
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

      const response = await fetch(`${API_BASE}/api/supervisor/work-orders`, {
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
      propertyId: '', propertySearch: '', categoryId: '', subcategoryId: '', customSubcategory: '',
      customerName: '', customerEmail: '', customerPhone: '',
      description: '', priority: 'medium', permissionToEnter: 'yes', hasPet: 'no', entryNotes: ''
    });
    attachments.forEach(att => URL.revokeObjectURL(att.preview));
    setAttachments([]);
    setSubcategories([]);
  };

  const handleStatusChange = async (workOrder, newStatus, closingNotesValue = null) => {
    // If completing, show modal to enter closing notes
    if (newStatus === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(workOrder.id);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/work-orders/${workOrder.id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, closingNotes: closingNotesValue })
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Status updated to ${newStatus}` });
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
      await handleStatusChange({ id: completingWorkOrderId }, 'completed', closingNotes);
      setIsSubmittingCompletion(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = { 
      draft: 'bg-gray-100 text-gray-700', requested: 'bg-blue-100 text-blue-700', 
      under_review: 'bg-amber-100 text-amber-700', assigned: 'bg-purple-100 text-purple-700', 
      accepted: 'bg-indigo-100 text-indigo-700', in_progress: 'bg-orange-100 text-orange-700', 
      completed: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  // Handle status change from dropdown (NO Closed option for Supervisor)
  const handleDropdownStatusChange = async (workOrderId, newStatus) => {
    // If completing, show modal to enter closing notes
    if (newStatus === 'completed') {
      setCompletingWorkOrderId(workOrderId);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    // If cancelling, show cancel modal
    if (newStatus === 'cancelled') {
      const wo = workOrders.find(w => w.id === workOrderId);
      setSelectedWorkOrder(wo);
      setShowCancelModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/work-orders/${workOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
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

  // Delete Work Order
  const handleDeleteWorkOrder = async (workOrderId) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) return;
    
    try {
      const response = await fetch(`/api/supervisor/work-orders/${workOrderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Work order deleted successfully' });
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete work order' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete work order' });
    }
  };

  // Open Assign Modal
  const openAssignModal = (workOrder, type) => {
    setSelectedWorkOrder(workOrder);
    setAssignType(type);
    setShowAssignModal(true);
  };

  // Handle Assignment (both vendor and employee)
  const handleAssign = async (assigneeId) => {
    if (!selectedWorkOrder) return;

    try {
      const endpoint = assignType === 'vendor'
        ? `/api/supervisor/work-orders/${selectedWorkOrder.id}/assign-vendor`
        : `/api/supervisor/work-orders/${selectedWorkOrder.id}/assign-employee`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignType === 'vendor' ? { vendorId: assigneeId } : { employeeId: assigneeId })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `${assignType === 'vendor' ? 'Vendor' : 'Employee'} assigned successfully!` });
        setShowAssignModal(false);
        setSelectedWorkOrder(null);
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to assign ${assignType}` });
    }
  };

  // Open edit modal with work order data
  const handleEditWorkOrder = (wo) => {
    setSelectedWorkOrder(wo);
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
    // Load subcategories for the selected category
    if (wo.category_id) {
      const category = categories.find(c => c.id === parseInt(wo.category_id));
      setSubcategories(category?.subcategories || []);
    }
    setShowEditModal(true);
  };

  // Save edited work order
  const handleSaveEdit = async () => {
    if (!selectedWorkOrder) return;
    
    try {
      const response = await fetch(`/api/supervisor/work-orders/${selectedWorkOrder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
        setMessage({ type: 'success', text: 'Work order updated successfully' });
        setShowEditModal(false);
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to update work order' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update work order' });
    }
  };

  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '-';

  // Filter by tab (all/completed) first, then by status filter, then by search
  const tabFilteredWorkOrders = activeTab === 'completed'
    ? workOrders.filter(wo => wo.status === 'completed')
    : workOrders;
  
  // Apply status filter
  const statusFilteredWorkOrders = statusFilter 
    ? tabFilteredWorkOrders.filter(wo => wo.status === statusFilter)
    : tabFilteredWorkOrders;
  
  // Apply search filter
  const filteredWorkOrders = statusFilteredWorkOrders.filter(wo => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      wo.title?.toLowerCase().includes(search) ||
      wo.work_order_id?.toLowerCase().includes(search) ||
      wo.property_name?.toLowerCase().includes(search) ||
      wo.customer_name?.toLowerCase().includes(search) ||
      wo.property_code?.toLowerCase().includes(search) ||
      wo.actual_property_id?.toLowerCase().includes(search) ||
      wo.property_id?.toString().toLowerCase().includes(search)
    );
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, activeTab]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredWorkOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedWorkOrders = filteredWorkOrders.slice(startIndex, endIndex);

  const allCount = workOrders.length;
  const completedCount = workOrders.filter(wo => wo.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-500">Manage and track all work orders</p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('create')}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Create Work Order</span>
        </button>
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
                <div className="relative">
                  <input
                    type="text"
                    value={formData.propertySearch}
                    onChange={(e) => !selectedProperty && handlePropertySearch(e.target.value)}
                    onFocus={() => !selectedProperty && formData.propertySearch && setShowPropertyDropdown(true)}
                    placeholder="Search by Property ID or Community Name..."
                    readOnly={!!selectedProperty}
                    className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${selectedProperty ? 'bg-green-50 border-green-300 pr-10' : ''}`}
                  />
                  {selectedProperty && (
                    <button
                      type="button"
                      onClick={clearSelectedProperty}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
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
                    Add 
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcategory <span className="text-red-500">*</span>
                </label>
                {isOtherCategory ? (
                  <input
                    type="text"
                    value={formData.customSubcategory}
                    onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                    placeholder="Enter subcategory / issue type"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <select
                    value={formData.subcategoryId}
                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                    disabled={!formData.categoryId}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">{formData.categoryId ? 'Select subcategory' : 'Select a category first'}</option>
                    {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
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
                  placeholder="Search by Property ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.trim())}
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
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button onClick={() => fetchWorkOrders()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700" title="Refresh">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={() => { setSearchTerm(''); setStatusFilter(''); fetchWorkOrders(); }} className="flex items-center gap-1.5 px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-lg text-sm" title="Clear Filters">
                <X className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>

          {/* Work Orders List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
            ) : paginatedWorkOrders.length === 0 ? (
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
                    {paginatedWorkOrders.map((wo) => (
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
                          <div className="relative inline-block">
                            <select
                              value={wo.status}
                              onChange={(e) => handleDropdownStatusChange(wo.id, e.target.value)}
                              className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(wo.status)}`}
                            >
                              <option value="pending" className="bg-white text-gray-900">Pending</option>
                              <option value="assigned" className="bg-white text-gray-900">Assigned</option>
                              <option value="in_progress" className="bg-white text-gray-900">In Progress</option>
                              <option value="completed" className="bg-white text-gray-900">Completed</option>
                              <option value="closed" className="bg-white text-gray-900">Closed</option>
                              <option value="cancelled" className="bg-white text-gray-900">Cancelled</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                          </div>
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setSelectedWorkOrder(wo); setShowViewModal(true); }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleEditWorkOrder(wo)}
                              className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Work Order"
                            >
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </button>
                            <button
                              onClick={() => openAssignModal(wo, 'vendor')}
                              className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Assign Vendor"
                            >
                              <Truck className="w-4 h-4 text-purple-500" />
                            </button>
                            <button
                              onClick={() => openAssignModal(wo, 'employee')}
                              className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                              title="Assign Employee"
                            >
                              <UserPlus className="w-4 h-4 text-green-500" />
                            </button>
                            <button
                              onClick={() => handleDeleteWorkOrder(wo.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
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

          {/* Pagination Controls */}
          {filteredWorkOrders.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl mt-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredWorkOrders.length)} of {filteredWorkOrders.length} work orders
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => (
                    <span key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && (
                        <span className="px-2 text-gray-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
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

      {/* Completion Modal with Closing Notes */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
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

      {/* Assign Vendor/Employee Modal */}
      {showAssignModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Assign {assignType === 'vendor' ? 'Vendor' : 'Employee'}
                </h2>
                <button onClick={() => { setShowAssignModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Work Order: {selectedWorkOrder.work_order_id}
              </p>
            </div>

            <div className="p-6">
              {(assignType === 'vendor' ? vendors : employees).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No {assignType === 'vendor' ? 'vendors' : 'employees'} available
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(assignType === 'vendor' ? vendors : employees).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAssign(item.id)}
                      className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                    >
                      <div className={`w-10 h-10 ${assignType === 'vendor' ? 'bg-purple-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                        {assignType === 'vendor' ? (
                          <Store className="w-5 h-5 text-purple-600" />
                        ) : (
                          <User className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {assignType === 'vendor'
                            ? (item.ownerName || item.owner_name || item.company_name || 'Unknown Vendor')
                            : (`${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name || 'Unknown Employee')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {assignType === 'vendor'
                            ? (item.serviceType || item.service_type || item.email || '-')
                            : (item.role || item.email || '-')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Order Modal */}
      {showEditModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Edit Work Order</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedWorkOrder.work_order_id}</p>
                </div>
                <button onClick={() => { setShowEditModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Information */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editFormData.customerName}
                    onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editFormData.customerEmail}
                    onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.customerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editFormData.categoryId}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, categoryId: e.target.value, subcategoryId: '' });
                      const category = categories.find(c => c.id === parseInt(e.target.value));
                      setSubcategories(category?.subcategories || []);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <select
                    value={editFormData.subcategoryId}
                    onChange={(e) => setEditFormData({ ...editFormData, subcategoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={!editFormData.categoryId}
                  >
                    <option value="">Select subcategory</option>
                    {subcategories.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Block & Flat */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                  <input
                    type="text"
                    value={editFormData.block}
                    onChange={(e) => setEditFormData({ ...editFormData, block: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flat Number</label>
                  <input
                    type="text"
                    value={editFormData.flatNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, flatNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Priority & Status (NO Closed option) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {priorityOptions.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
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
                  <select
                    value={editFormData.permissionToEnter}
                    onChange={(e) => setEditFormData({ ...editFormData, permissionToEnter: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Has Pet?</label>
                  <select
                    value={editFormData.hasPet}
                    onChange={(e) => setEditFormData({ ...editFormData, hasPet: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Entry Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entry Notes</label>
                <textarea
                  value={editFormData.entryNotes}
                  onChange={(e) => setEditFormData({ ...editFormData, entryNotes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Special instructions for entry..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setShowEditModal(false); setSelectedWorkOrder(null); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
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

export default SupervisorWorkOrders;
