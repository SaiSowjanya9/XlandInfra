import { useState, useEffect, useRef } from 'react';
import { getAuthToken } from '../utils/safeStorage';
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  X,
  XCircle,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Eye,
  Building2,
  Users,
  Image,
  Camera,
  FileText,
  Trash2,
  Truck,
  UserPlus,
  RotateCcw,
  Store,
  ChevronDown,
  Pencil,
  List,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FPWorkOrders = ({ user }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
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
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [completingWorkOrderId, setCompletingWorkOrderId] = useState(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState('');
  const [cancellingWorkOrderId, setCancellingWorkOrderId] = useState(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryId: '',
    subcategoryId: '',
    customSubcategory: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    description: '',
    permissionToEnter: '',
    hasPet: '',
    entryNotes: '',
    priority: 'medium',
    attachments: []
  });

  const token = getAuthToken();

  // File input refs
  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // File handling functions
  const handleFileSelect = (e, type) => {
    const files = Array.from(e.target.files);
    const maxFiles = 5;
    const currentCount = formData.attachments.length;
    
    if (currentCount >= maxFiles) {
      setMessage({ type: 'error', text: 'Maximum 5 files allowed' });
      return;
    }

    const remainingSlots = maxFiles - currentCount;
    const filesToAdd = files.slice(0, remainingSlots);

    const newAttachments = filesToAdd.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }));

    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments]
    }));

    // Reset the input
    e.target.value = '';
  };

  const removeAttachment = (id) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(att => att.id !== id)
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' }
  ];

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/fp/work-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setWorkOrders(result.data);
      }
    } catch (error) {
      console.error('Fetch work orders error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [propRes, catRes, vendRes] = await Promise.all([
        fetch(`${API_BASE}/api/fp/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/fp/vendors`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [propData, catData, vendData] = await Promise.all([
        propRes.json(),
        catRes.json(),
        vendRes.json()
      ]);

      if (propData.success) setProperties(propData.data);
      if (catData.success) setCategories(catData.data);
      if (vendData.success) setVendors(vendData.data?.all || vendData.data || []);
    } catch (error) {
      console.error('Fetch dependencies error:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/fp/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setEmployees(result.data || []);
      }
    } catch (error) {
      console.error('Fetch employees error:', error);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchDependencies();
    fetchEmployees();
  }, []);

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
      // Get category and subcategory names for the selected IDs
      const selCategory = categories.find(c => c.id === parseInt(formData.categoryId));
      const selSubcategory = subcategories.find(s => s.id === parseInt(formData.subcategoryId));
      
      // Use FormData for file uploads
      const submitData = new FormData();
      submitData.append('propertyId', formData.propertyId);
      submitData.append('categoryId', formData.categoryId);
      // Handle custom subcategory for "Other" category
      if (isOtherCategory && formData.customSubcategory) {
        submitData.append('customSubcategory', formData.customSubcategory);
        submitData.append('subcategoryId', '');
        submitData.append('subcategoryName', formData.customSubcategory);
      } else {
        submitData.append('subcategoryId', formData.subcategoryId);
        submitData.append('subcategoryName', selSubcategory?.name || '');
      }
      submitData.append('categoryName', selCategory?.name || '');
      submitData.append('customerName', formData.customerName);
      submitData.append('customerEmail', formData.customerEmail);
      submitData.append('customerPhone', formData.customerPhone);
      submitData.append('description', formData.description);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('hasPet', formData.hasPet);
      submitData.append('entryNotes', formData.entryNotes);
      submitData.append('priority', formData.priority);

      // Append files
      formData.attachments.forEach((attachment, index) => {
        submitData.append('attachments', attachment.file);
      });

      const response = await fetch(`${API_BASE}/api/fp/work-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Work order created successfully!' });
        // Clean up preview URLs
        formData.attachments.forEach(att => {
          if (att.preview) URL.revokeObjectURL(att.preview);
        });
        resetForm();
        setActiveTab('all');
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create work order' });
    }
  };

  const handleCategoryChange = (categoryId) => {
    setFormData({ ...formData, categoryId, subcategoryId: '', customSubcategory: '' });
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };
  
  // Check if "Other" category is selected
  const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
  const isOtherCategory = selectedCategory?.isCustom || selectedCategory?.name === 'Other';

  // Fetch subcategories for edit modal (uses embedded data from categories)
  const fetchSubcategories = (categoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
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

  // Handle property selection and auto-populate customer details
  const handlePropertySelect = async (property) => {
    const totalUnits = computeTotalUnits(property);
    setSelectedProperty({ ...property, total_units: totalUnits });
    setFormData(prev => ({ 
      ...prev, 
      propertyId: property.id,
      customerName: property.contact_person || '',
      customerEmail: property.contact_email || property.email || '',
      customerPhone: property.contact_phone || ''
    }));
    setPropertySearch(property.property_id || '');
  };

  // Clear selected property
  const clearSelectedProperty = () => {
    setSelectedProperty(null);
    setFormData(prev => ({ ...prev, propertyId: '', customerName: '', customerEmail: '', customerPhone: '' }));
    setPropertySearch('');
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/fp/categories`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim(), subcategoryName: newSubcategoryName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh categories
        const catRes = await fetch(`${API_BASE}/api/fp/categories`, { headers: { 'Authorization': `Bearer ${token}` } });
        const catData = await catRes.json();
        if (catData.success) setCategories(catData.data);
        setNewCategoryName('');
        setNewSubcategoryName('');
        setShowAddCategoryModal(false);
        setMessage({ type: 'success', text: `Category "${newCategoryName}" added successfully` });
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleDeleteCategory = async (categoryId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this category?')) return;
    try {
      const res = await fetch(`/api/fp/categories/${categoryId}`, {
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

  const handleDeleteSubcategory = async (subcategoryId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this subcategory?')) return;
    try {
      const res = await fetch(`/api/fp/subcategories/${subcategoryId}`, {
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

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await fetch(`/api/fp/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Status updated successfully!' });
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Update failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const openAssignModal = (workOrder, type) => {
    setSelectedWorkOrder(workOrder);
    setAssignType(type);
    setShowAssignModal(true);
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedWorkOrder) return;

    try {
      const endpoint = assignType === 'vendor'
        ? `/api/fp/work-orders/${selectedWorkOrder.id}/assign-vendor`
        : `/api/fp/work-orders/${selectedWorkOrder.id}/assign-employee`;

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
      permissionToEnter: '',
      hasPet: '',
      entryNotes: '',
      priority: 'medium',
      attachments: []
    });
    setPropertySearch('');
    setSelectedProperty(null);
    setSubcategories([]);
  };

  // Filter properties based on search - only filter if search term exists and no property selected
  const filteredPropertyOptions = propertySearch && !formData.propertyId ? properties.filter(p => 
    p.name?.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.property_id?.toLowerCase().includes(propertySearch.toLowerCase())
  ) : [];

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      requested: 'bg-blue-100 text-blue-700',
      under_review: 'bg-amber-100 text-amber-700',
      assigned: 'bg-purple-100 text-purple-700',
      accepted: 'bg-indigo-100 text-indigo-700',
      in_progress: 'bg-orange-100 text-orange-700',
      completed: 'bg-green-100 text-green-700',
      verified: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority) => {
    return priorityOptions.find(p => p.value === priority)?.color || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  // Count work orders by status - Pending = all except completed, Completed = only completed
  const pendingCount = workOrders.filter(wo => wo.status !== 'completed').length;
  const completedCount = workOrders.filter(wo => wo.status === 'completed').length;

  // Filter work orders by active tab, status filter, and search term
  const filteredWorkOrders = workOrders.filter(wo => {
    // Tab filter - All shows everything, Completed shows only completed
    if (activeTab === 'completed' && wo.status !== 'completed') return false;

    // Status dropdown filter
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false;

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

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    setSearchTerm('');
    fetchWorkOrders();
  };

  // Export all work orders to Excel
  const exportAllWorkOrders = () => {
    if (filteredWorkOrders.length === 0) {
      setMessage({ type: 'error', text: 'No work orders to export' });
      return;
    }

    const exportData = filteredWorkOrders.map(wo => ({
      'Order ID': wo.work_order_id || '',
      'Resident': wo.customer_name || '',
      'Property': wo.property_name || '',
      'Category': wo.category_name || '',
      'Subcategory': wo.subcategory_name || '',
      'Status': wo.status?.replace('_', ' ') || '',
      'Priority': wo.priority || '',
      'Description': wo.description || '',
      'Assigned To': wo.assigned_to_name || wo.vendor_name || '',
      'Created Date': wo.created_at ? new Date(wo.created_at).toLocaleDateString('en-IN') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Work Orders');
    XLSX.writeFile(wb, `fp_work_orders_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: `Exported ${filteredWorkOrders.length} work orders` });
  };

  const handleViewDetail = (wo) => {
    setSelectedWorkOrder(wo);
    setShowDetailModal(true);
  };

  const handleStatusChange = async (workOrderId, newStatus, closingNotesValue = null, cancelNoteValue = null) => {
    // If completing, show modal to enter closing notes
    if (newStatus === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(workOrderId);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    // If cancelling, show modal to enter cancellation note
    if (newStatus === 'cancelled' && cancelNoteValue === null) {
      setCancellingWorkOrderId(workOrderId);
      setCancelNote('');
      setShowCancelModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/fp/work-orders/${workOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          status: newStatus, 
          closingNotes: closingNotesValue,
          cancelNote: cancelNoteValue
        })
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Status updated to ${newStatus}` });
        fetchWorkOrders();
        // Close modals if open
        if (newStatus === 'completed') {
          setShowCompletionModal(false);
          setClosingNotes('');
          setCompletingWorkOrderId(null);
        }
        if (newStatus === 'cancelled') {
          setShowCancelModal(false);
          setCancelNote('');
          setCancellingWorkOrderId(null);
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

  const handleCancelWorkOrder = async () => {
    if (!cancelNote.trim()) {
      setMessage({ type: 'error', text: 'Cancellation note is required' });
      return;
    }
    if (cancellingWorkOrderId) {
      await handleStatusChange(cancellingWorkOrderId, 'cancelled', null, cancelNote);
    }
  };

  const handleDeleteWorkOrder = async (workOrderId) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) return;
    
    try {
      const response = await fetch(`/api/fp/work-orders/${workOrderId}`, {
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

  const handleRevertToPending = async (workOrderId) => {
    await handleStatusChange(workOrderId, 'pending');
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
      fetchSubcategories(wo.category_id);
    }
    setShowEditModal(true);
  };

  // Save edited work order
  const handleSaveEdit = async () => {
    if (!selectedWorkOrder) return;
    
    try {
      const response = await fetch(`/api/fp/work-orders/${selectedWorkOrder.id}`, {
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

  // Check if user is FP Manager (restricted) - Admin users get full access
  // Admin portal users always get full access (dropdown status, action buttons)
  const isFPManager = false; // Always show full controls in admin portal

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
          }`}>
            {workOrders.length}
          </span>
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
          }`}>
            {completedCount}
          </span>
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
          <span>Create New</span>
        </button>
      </div>

      {/* Create New Work Order Form */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {/* Form Header */}
          <div className="flex items-start gap-3 mb-6">
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
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-gray-500" />
                <h3 className="font-medium text-gray-900">Property Information</h3>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Property ID or Community Name..."
                    value={propertySearch}
                    readOnly={!!selectedProperty}
                    onChange={(e) => {
                      setPropertySearch(e.target.value);
                      if (formData.propertyId) {
                        setSelectedProperty(null);
                        setFormData(prev => ({ ...prev, propertyId: '', customerName: '', customerEmail: '', customerPhone: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 ${selectedProperty ? 'bg-green-50 border-green-300 pr-10' : 'bg-gray-50'}`}
                  />
                  {selectedProperty && (
                    <button
                      type="button"
                      onClick={clearSelectedProperty}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {propertySearch && filteredPropertyOptions.length > 0 && !selectedProperty && (
                  <div className="absolute z-10 w-full mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-lg">
                    {filteredPropertyOptions.slice(0, 5).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePropertySelect(p)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                      >
                        <span className="font-medium">{p.property_id}</span>
                        <span className="text-gray-500 ml-2">{p.name}</span>
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
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-gray-500" />
                <h3 className="font-medium text-gray-900">Customer Details</h3>
              </div>
              {formData.propertyId ? (
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
                      required
                      placeholder="Customer name"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="customer@email.com"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Phone number"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Category Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={categorySearch || categories.find(c => c.id === parseInt(formData.categoryId))?.name || ''}
                      onChange={(e) => { setCategorySearch(e.target.value); setShowCategoryDropdown(true); }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 400)}
                      placeholder="Select a category"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    />
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
                    <span>Add</span>
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={subcategorySearch || subcategories.find(s => s.id === parseInt(formData.subcategoryId))?.name || ''}
                      onChange={(e) => { setSubcategorySearch(e.target.value); setShowSubcategoryDropdown(true); }}
                      onFocus={() => setShowSubcategoryDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSubcategoryDropdown(false), 400)}
                      placeholder={formData.categoryId ? 'Select a subcategory' : 'Select a category first'}
                      disabled={!formData.categoryId}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
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
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(Optional)</span>
              </label>
              <div className="relative">
                <textarea
                  rows={4}
                  maxLength={500}
                  placeholder="Describe the issue or request in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                />
                <span className="absolute bottom-2 right-3 text-xs text-gray-400">
                  {formData.description.length}/500
                </span>
              </div>
            </div>

            {/* Permission to Enter & Has Pet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permission to Enter <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Allow entry if resident is unavailable</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'yes' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.permissionToEnter === 'yes'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'no' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.permissionToEnter === 'no'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Has Pet? <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Does the resident have a pet?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'yes' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.hasPet === 'yes'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'no' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                      formData.hasPet === 'no'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
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
                rows={2}
                placeholder="Special instructions for entry (gate code, parking, etc.)..."
                value={formData.entryNotes}
                onChange={(e) => setFormData({ ...formData, entryNotes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="flex gap-3">
                {['low', 'medium', 'high', 'urgent'].map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority })}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                      formData.priority === priority
                        ? priority === 'low' ? 'border-green-500 bg-green-50 text-green-700'
                          : priority === 'medium' ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                            : priority === 'high' ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments <span className="text-gray-400">(Optional - max 5 files)</span>
              </label>
              
              {/* Hidden file inputs */}
              <input
                type="file"
                ref={galleryInputRef}
                onChange={(e) => handleFileSelect(e, 'gallery')}
                accept="image/*"
                multiple
                className="hidden"
              />
              <input
                type="file"
                ref={cameraInputRef}
                onChange={(e) => handleFileSelect(e, 'camera')}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e, 'files')}
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx"
                multiple
                className="hidden"
              />

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={formData.attachments.length >= 5}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-4 border-2 border-dashed rounded-lg transition-colors ${
                    formData.attachments.length >= 5
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600'
                  }`}
                >
                  <Image className="w-6 h-6" />
                  <span className="text-sm">Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={formData.attachments.length >= 5}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-4 border-2 border-dashed rounded-lg transition-colors ${
                    formData.attachments.length >= 5
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600'
                  }`}
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-sm">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={formData.attachments.length >= 5}
                  className={`flex flex-col items-center justify-center gap-2 py-4 px-4 border-2 border-dashed rounded-lg transition-colors ${
                    formData.attachments.length >= 5
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600'
                  }`}
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-sm">Files</span>
                </button>
              </div>

              {/* Selected Files Preview */}
              {formData.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">{formData.attachments.length}/5 files selected</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {formData.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="relative group border border-gray-200 rounded-lg p-2 bg-gray-50"
                      >
                        {attachment.preview ? (
                          <img
                            src={attachment.preview}
                            alt={attachment.name}
                            className="w-full h-20 object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-20 flex items-center justify-center bg-gray-100 rounded">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="mt-1">
                          <p className="text-xs font-medium text-gray-700 truncate">{attachment.name}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { resetForm(); setActiveTab('all'); }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <span>Create Work Order</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Work Orders List - Only show for pending/completed tabs */}
      {(activeTab === 'all' || activeTab === 'completed') && (
        <>
          {/* Search */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex flex-col sm:flex-row gap-3">
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
              <button
                onClick={handleSearch}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={handleClear}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={exportAllWorkOrders}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                title="Export All Work Orders"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            </div>
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
                          <span className="text-sm text-gray-900">{wo.work_order_id}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{wo.customer_name || 'N/A'}</p>
                            <p className="text-xs text-gray-500">{wo.property_name || ''}</p>
                          </div>
                        </td>
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
                              onChange={(e) => handleStatusChange(wo.id, e.target.value)}
                              className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${getStatusColor(wo.status)}`}
                            >
                              <option value="pending" className="bg-white text-gray-900">Pending</option>
                              <option value="assigned" className="bg-white text-gray-900">Assigned</option>
                              <option value="in_progress" className="bg-white text-gray-900">In Progress</option>
                              <option value="completed" className="bg-white text-gray-900">Completed</option>
                              <option value="cancelled" className="bg-white text-gray-900">Cancelled</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-500">{formatDate(wo.created_at)}</span>
                        </td>
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
                              onClick={() => handleViewDetail(wo)}
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
                            {activeTab === 'completed' && (
                              <button
                                onClick={() => handleRevertToPending(wo.id)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Revert to Pending"
                              >
                                <RotateCcw className="w-4 h-4 text-gray-500" />
                              </button>
                            )}
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

      {/* Work Order Detail Modal */}
      {showDetailModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Work Order Details</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedWorkOrder.work_order_id}</p>
                </div>
                <button onClick={() => { setShowDetailModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Information */}
              <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Customer Name</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.customer_name || [selectedWorkOrder.first_name, selectedWorkOrder.last_name].filter(Boolean).join(' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="font-medium text-gray-900 text-sm break-all">{selectedWorkOrder.customer_email || selectedWorkOrder.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Phone</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.customer_phone || selectedWorkOrder.phone || 'N/A'}</p>
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
                    <p className="font-medium text-gray-900 font-mono text-blue-600">{selectedWorkOrder.actual_property_id || selectedWorkOrder.property_code || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Property Type</p>
                    <p className="font-medium text-gray-900 capitalize">{selectedWorkOrder.property_type?.replace(/_/g, ' ') || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Zone / Division</p>
                    <p className="font-medium text-gray-900">{selectedWorkOrder.zone || 'N/A'} / {selectedWorkOrder.division || 'N/A'}</p>
                  </div>
                  {/* Show based on property type */}
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

              {/* Work Order Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.category_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subcategory</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.subcategory_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedWorkOrder.status)}`}>
                    {selectedWorkOrder.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedWorkOrder.priority)}`}>
                    {selectedWorkOrder.priority}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium text-gray-900">{formatDate(selectedWorkOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.vendor_name || 'Not Assigned'}</p>
                </div>
              </div>

              {selectedWorkOrder.title && (
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-medium text-gray-900">{selectedWorkOrder.title}</p>
                </div>
              )}

              {selectedWorkOrder.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="text-gray-700">{selectedWorkOrder.description}</p>
                </div>
              )}

              {/* Attachments Section */}
              {selectedWorkOrder.attachments && selectedWorkOrder.attachments.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Attachments ({selectedWorkOrder.attachments.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedWorkOrder.attachments.map((att) => {
                      const filePath = att.file_path?.startsWith('uploads/') ? att.file_path : `uploads/${att.file_path || att.file_name}`;
                      const fileUrl = `${API_BASE}/${filePath}`;
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

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                {!selectedWorkOrder.assigned_vendor_id && selectedWorkOrder.status !== 'completed' && selectedWorkOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => { setShowDetailModal(false); setShowAssignModal(true); }}
                    className="px-4 py-2 text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
                  >
                    Assign Vendor
                  </button>
                )}
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedWorkOrder(null); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Close
                </button>
                {/* Revert to Pending - for completed work orders */}
                {['completed', 'verified'].includes(selectedWorkOrder.status) && (
                  <button
                    onClick={async () => {
                      await handleStatusChange(selectedWorkOrder.id, 'pending');
                      setShowDetailModal(false);
                      setSelectedWorkOrder(null);
                    }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                  >
                    Revert to Pending
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Vendor/Employee Modal */}
      {showAssignModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Add New Category</h2>
                <button 
                  onClick={() => { setShowAddCategoryModal(false); setNewCategoryName(''); setNewSubcategoryName(''); }} 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Subcategory <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  placeholder="Enter subcategory name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">"Other" will be added automatically</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowAddCategoryModal(false); setNewCategoryName(''); setNewSubcategoryName(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Work Order Modal */}
      {showEditModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Work Order</h2>
                  <p className="text-sm text-gray-500">{selectedWorkOrder.work_order_id}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Property Info (Read Only) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Property Information</h3>
                <p className="text-sm text-gray-600">{selectedWorkOrder.property_name || 'N/A'}</p>
                <p className="text-xs text-gray-500">Zone: {selectedWorkOrder.zone || 'N/A'} | Division: {selectedWorkOrder.division || 'N/A'}</p>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input type="text" value={editFormData.customerName} onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={editFormData.customerEmail} onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={editFormData.customerPhone} onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Phone" />
                </div>
              </div>

              {/* Block & Flat */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                  <input type="text" value={editFormData.block} onChange={(e) => setEditFormData({ ...editFormData, block: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Block" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flat/Unit</label>
                  <input type="text" value={editFormData.flatNumber} onChange={(e) => setEditFormData({ ...editFormData, flatNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Flat/Unit" />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={editFormData.categoryId}
                  onChange={(e) => {
                    setEditFormData({ ...editFormData, categoryId: e.target.value, subcategoryId: '' });
                    fetchSubcategories(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                <select
                  value={editFormData.subcategoryId}
                  onChange={(e) => setEditFormData({ ...editFormData, subcategoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Subcategory</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the issue..."
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={editFormData.priority}
                  onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Status */}
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
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Permission to Enter */}
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
                  <option value="accompanied">Accompanied Only</option>
                </select>
              </div>

              {/* Has Pet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Has Pet</label>
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

              {/* Entry Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entry Notes</label>
                <textarea
                  value={editFormData.entryNotes}
                  onChange={(e) => setEditFormData({ ...editFormData, entryNotes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Any special instructions for entry..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
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
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    setClosingNotes('');
                    setCompletingWorkOrderId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Please add any closing notes or comments about the completed work.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Closing Notes <span className="text-gray-400">(Optional)</span>
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  placeholder="E.g., Replaced faulty wiring, cleaned AC filters, etc..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  setClosingNotes('');
                  setCompletingWorkOrderId(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteWorkOrder}
                disabled={isSubmittingCompletion}
                className={`px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 ${isSubmittingCompletion ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <CheckCircle className="w-4 h-4" />
                {isSubmittingCompletion ? 'Completing...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal with Note */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Cancel Work Order</h2>
                </div>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelNote('');
                    setCancellingWorkOrderId(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Please provide a reason for cancelling this work order.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  placeholder="Enter reason for cancellation..."
                  required
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                This note will be recorded with the cancellation for future reference.
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelNote('');
                  setCancellingWorkOrderId(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelWorkOrder}
                disabled={!cancelNote.trim()}
                className={`px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 ${!cancelNote.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <AlertCircle className="w-4 h-4" />
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPWorkOrders;
