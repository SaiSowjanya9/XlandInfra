import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  User,
  ChevronDown,
  Clock,
  CheckCircle2,
  Eye,
  Store,
  Users,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  Lock,
  MessageSquare,
  Building2,
  Mail,
  Phone,
  Image,
  Camera,
  FileText,
  Send,
  List,
  Pencil,
  Truck,
  UserPlus,
  XCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Link } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';

const CoordinatorWorkOrders = ({ user }) => {
  // Check if this is an FP-created Coordinator (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
  const location = useLocation();
  const [workOrders, setWorkOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignEmployeeModal, setShowAssignEmployeeModal] = useState(false);
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
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelledNoteModal, setShowCancelledNoteModal] = useState(false);
  const [cancelledNote, setCancelledNote] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [completingWorkOrderId, setCompletingWorkOrderId] = useState(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryId: '',
    subcategoryId: '',
    customSubcategory: '',
    clientId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    title: '',
    description: '',
    priority: 'medium',
    permissionToEnter: '',
    hasPet: '',
    entryNotes: '',
    scheduledDate: ''
  });

  const viewType = location.pathname.includes('/completed') ? 'completed'
                 : location.pathname.includes('/create') ? 'create'
                 : 'all'; // Default to all

  const token = getAuthToken();

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'requested', label: 'Requested' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
    { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' }
  ];

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      // Always fetch ALL work orders for accurate tab counts
      const response = await fetch(`${API_BASE}/api/coordinator/work-orders`, {
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
      const [propRes, catRes, custRes, vendRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/coordinator/properties`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/categories`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/customers`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/vendors`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/coordinator/employees`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ json: () => ({ success: false }) }))
      ]);

      const [propData, catData, custData, vendData, empData] = await Promise.all([
        propRes.json(), catRes.json(), custRes.json(), vendRes.json(), empRes.json()
      ]);

      if (propData.success) setProperties(propData.data);
      if (catData.success) setCategories(catData.data);
      if (custData.success) setCustomers(custData.data);
      if (vendData.success) setVendors(vendData.data.all || []);
      if (empData.success) setEmployees(empData.data || []);
    } catch (error) {
      console.error('Fetch dependencies error:', error);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchDependencies();
  }, [viewType, statusFilter]);

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
      
      const response = await fetch(`${API_BASE}/api/coordinator/work-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Work order created successfully!' });
        setShowModal(false);
        resetForm();
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create work order' });
    }
  };

  const handleStatusUpdate = async (id, newStatus, note = '', closingNotesValue = null) => {
    // If changing to cancelled, show the note modal first
    if (newStatus === 'cancelled' && !note) {
      const wo = workOrders.find(w => w.id === id);
      setSelectedWorkOrder(wo);
      setShowCancelledNoteModal(true);
      return;
    }

    // If completing, show modal to enter closing notes
    if (newStatus === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(id);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/coordinator/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, cancellationNote: note, closingNotes: closingNotesValue })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Status updated successfully!' });
        fetchWorkOrders();
        // Close completion modal if open
        if (newStatus === 'completed') {
          setShowCompletionModal(false);
          setClosingNotes('');
          setCompletingWorkOrderId(null);
        }
      } else {
        setMessage({ type: 'error', text: result.message || 'Update failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update status' });
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (completingWorkOrderId && !isSubmittingCompletion) {
      setIsSubmittingCompletion(true);
      await handleStatusUpdate(completingWorkOrderId, 'completed', '', closingNotes);
      setIsSubmittingCompletion(false);
    }
  };

  const handleCancelWithNote = async () => {
    if (!selectedWorkOrder) return;
    await handleStatusUpdate(selectedWorkOrder.id, 'cancelled', cancelledNote);
    setShowCancelledNoteModal(false);
    setCancelledNote('');
    setSelectedWorkOrder(null);
  };

  // Handle status change from dropdown (NO Closed option for Coordinator)
  const handleStatusChange = async (workOrderId, newStatus, closingNotesValue = null) => {
    // If completing, show modal to enter closing notes
    if (newStatus === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(workOrderId);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    // If cancelling, show cancel modal
    if (newStatus === 'cancelled') {
      const wo = workOrders.find(w => w.id === workOrderId);
      setSelectedWorkOrder(wo);
      setShowCancelledNoteModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/coordinator/work-orders/${workOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, closingNotes: closingNotesValue })
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
      const response = await fetch(`/api/coordinator/work-orders/${workOrderId}`, {
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
        ? `/api/coordinator/work-orders/${selectedWorkOrder.id}/assign-vendor`
        : `/api/coordinator/work-orders/${selectedWorkOrder.id}/assign-employee`;

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
      fetchSubcategoriesForEdit(wo.category_id);
    }
    setShowEditModal(true);
  };

  // Fetch subcategories for edit modal
  const fetchSubcategoriesForEdit = (categoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };

  // Save edited work order
  const handleSaveEdit = async () => {
    if (!selectedWorkOrder) return;
    
    try {
      const response = await fetch(`/api/coordinator/work-orders/${selectedWorkOrder.id}`, {
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

  const handleAssignVendor = async (vendorId) => {
    if (!selectedWorkOrder) return;

    try {
      const response = await fetch(`/api/coordinator/work-orders/${selectedWorkOrder.id}/assign-vendor`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vendorId })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Vendor assigned successfully!' });
        setShowAssignModal(false);
        setSelectedWorkOrder(null);
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign vendor' });
    }
  };

  const handleAssignEmployee = async (employeeId) => {
    if (!selectedWorkOrder) return;

    try {
      const response = await fetch(`/api/coordinator/work-orders/${selectedWorkOrder.id}/assign-employee`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ employeeId })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Employee assigned successfully!' });
        setShowAssignEmployeeModal(false);
        setSelectedWorkOrder(null);
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign employee' });
    }
  };

  const handleExportWorkOrder = (wo) => {
    try {
      const headers = ['Order ID', 'Title', 'Resident', 'Property', 'Category', 'Status', 'Priority', 'Created'];
      const values = [
        wo.work_order_id,
        wo.title || '',
        wo.client_name || wo.customer_name || '',
        wo.property_name || '',
        wo.category_name || '',
        wo.status,
        wo.priority || 'medium',
        wo.created_at ? new Date(wo.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''
      ];
      
      const csvContent = [headers.join(','), values.map(v => `"${v}"`).join(',')].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workorder_${wo.work_order_id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Work order exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: '',
      categoryId: '',
      subcategoryId: '',
      customSubcategory: '',
      clientId: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      title: '',
      description: '',
      priority: 'medium',
      permissionToEnter: '',
      hasPet: '',
      entryNotes: '',
      scheduledDate: ''
    });
    setSubcategories([]);
    setAttachments([]);
    setPropertySearch('');
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

  // Fetch subcategories (uses embedded data from categories)
  const fetchSubcategories = (categoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };

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

  // Filter by tab (all/completed) first, then by status filter, then by search
  const tabFilteredWorkOrders = viewType === 'completed'
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
    wo.property_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getViewTitle = () => {
    if (viewType === 'completed') return 'Completed Work Orders';
    return 'All Work Orders';
  };

  const getViewIcon = () => {
    if (viewType === 'completed') return CheckCircle2;
    return List;
  };

  const ViewIcon = getViewIcon();

  // Get all and completed counts
  const allCount = workOrders.length;
  const completedCount = workOrders.filter(wo => wo.status === 'completed').length;

  // Filter properties based on search
  const filteredProperties = properties.filter(p =>
    p.property_id?.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.name?.toLowerCase().includes(propertySearch.toLowerCase())
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
        <Link
            to="/coordinator/work-orders"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewType === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <List className="w-4 h-4" />
            <span>All</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              viewType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {allCount}
            </span>
          </Link>
          <Link
            to="/coordinator/work-orders/completed"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewType === 'completed'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              viewType === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {completedCount}
            </span>
          </Link>
          <Link
            to="/coordinator/work-orders/create"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </Link>
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

      {/* Create New Work Order Form */}
      {viewType === 'create' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          {/* Form Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create New Work Order</h2>
              <p className="text-sm text-gray-500">Fill in the details to create a work order on behalf of a resident</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Property Information */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Building2 className="w-4 h-4" />
                <span>Property Information</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={propertySearch}
                    onChange={(e) => { setPropertySearch(e.target.value); setFormData({ ...formData, propertyId: '' }); setSelectedProperty(null); }}
                    placeholder="Search by Property ID or Community Name..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  {propertySearch && filteredProperties.length > 0 && !formData.propertyId && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredProperties.slice(0, 5).map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            const totalUnits = computeTotalUnits(p);
                            setSelectedProperty({ ...p, total_units: totalUnits });
                            setFormData({ 
                              ...formData, 
                              propertyId: p.id,
                              customerName: p.contact_person || p.contactPerson || p.owner_name || formData.customerName,
                              customerEmail: p.contact_email || p.contactEmail || p.email || formData.customerEmail,
                              customerPhone: p.contact_phone || p.contactPhone || p.phone || p.mobile || formData.customerPhone
                            });
                            setPropertySearch(p.property_id || '');
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                        >
                          <span className="font-medium">{p.property_id}</span> - {p.name}
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
            </div>

            {/* Customer Details */}
            <div className="bg-gray-50 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <User className="w-4 h-4" />
                <span>Customer Details</span>
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
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="customer@email.com"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                    onChange={(e) => {
                      setFormData({ ...formData, categoryId: e.target.value, subcategoryId: '' });
                      fetchSubcategories(e.target.value);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
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
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <select
                    value={formData.subcategoryId}
                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    disabled={!formData.categoryId}
                  >
                    <option value="">{formData.categoryId ? 'Select a subcategory' : 'Select a category first'}</option>
                    {subcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
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
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-right text-xs text-gray-400 mt-1">{formData.description.length}/500</p>
            </div>

            {/* Permission to Enter & Has Pet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permission to Enter <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">Allow entry if resident is unavailable</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'yes' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                      formData.permissionToEnter === 'yes'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, permissionToEnter: 'no' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                      formData.permissionToEnter === 'no'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
                <p className="text-xs text-gray-500 mb-2">Does the resident have a pet</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'yes' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                      formData.hasPet === 'yes'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, hasPet: 'no' })}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition-colors ${
                      formData.hasPet === 'no'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
              <input
                type="text"
                value={formData.entryNotes}
                onChange={(e) => setFormData({ ...formData, entryNotes: e.target.value })}
                placeholder="Special instructions for entry (gate code, parking, etc.)..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {['low', 'medium', 'high', 'urgent'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority: p })}
                    className={`py-2 px-4 rounded-lg border-2 font-medium capitalize transition-colors ${
                      formData.priority === p
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments <span className="text-gray-400">(Optional - max 5 files)</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (attachments.length + files.length <= 5) {
                        setAttachments([...attachments, ...files]);
                      } else {
                        setMessage({ type: 'error', text: 'Maximum 5 files allowed' });
                      }
                    }}
                  />
                  <Image className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Gallery</span>
                </label>
                <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (attachments.length + files.length <= 5) {
                        setAttachments([...attachments, ...files]);
                      } else {
                        setMessage({ type: 'error', text: 'Maximum 5 files allowed' });
                      }
                    }}
                  />
                  <Camera className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Camera</span>
                </label>
                <label className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (attachments.length + files.length <= 5) {
                        setAttachments([...attachments, ...files]);
                      } else {
                        setMessage({ type: 'error', text: 'Maximum 5 files allowed' });
                      }
                    }}
                  />
                  <FileText className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Files</span>
                </label>
              </div>
              {/* Show selected files */}
              {attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-gray-700 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              <span>Create Work Order</span>
            </button>
          </form>
        </div>
      )}

      {/* Search Bar - Only show for list views */}
      {viewType !== 'create' && (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Work Order ID, category, or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.trim())}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={fetchWorkOrders}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
          {/* Status Filter Dropdown */}
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
          <button
            onClick={() => { setSearchTerm(''); setStatusFilter(''); fetchWorkOrders(); }}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
      )}

      {/* Work Orders List */}
      {viewType !== 'create' && (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-teal-600 animate-spin" />
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
                      <div>
                        <p className="font-medium text-gray-900">{wo.work_order_id}</p>
                        {wo.title && <p className="text-sm text-gray-500">{wo.title}</p>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{wo.client_name || wo.customer_name || '-'}</p>
                        <p className="text-sm text-gray-500">{wo.property_name || '-'}</p>
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
      )}

      {/* Create Work Order Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Create Work Order</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                  <select
                    required
                    value={formData.propertyId}
                    onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Property</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  {isOtherCategory ? (
                    <input
                      type="text"
                      value={formData.customSubcategory}
                      onChange={(e) => setFormData({ ...formData, customSubcategory: e.target.value })}
                      placeholder="Enter subcategory / issue type"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  ) : (
                    <select
                      value={formData.subcategoryId}
                      onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                      disabled={!formData.categoryId}
                    >
                      <option value="">{formData.categoryId ? 'Select Subcategory' : 'Select Category first'}</option>
                      {subcategories.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {priorityOptions.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="Brief title"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Permission to Enter</label>
                    <select
                      value={formData.permissionToEnter}
                      onChange={(e) => setFormData({ ...formData, permissionToEnter: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Has Pet?</label>
                    <select
                      value={formData.hasPet}
                      onChange={(e) => setFormData({ ...formData, hasPet: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>

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
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <span>Create Work Order</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Vendor Modal */}
      {showAssignModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Assign Vendor</h2>
                <button onClick={() => { setShowAssignModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Work Order: {selectedWorkOrder.work_order_id}
              </p>
            </div>

            <div className="p-6">
              {vendors.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No vendors available</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {vendors.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => handleAssignVendor(vendor.id)}
                      className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{vendor.company_name}</p>
                        <p className="text-sm text-gray-500">{vendor.contact_person || vendor.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Employee Modal */}
      {showAssignEmployeeModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Assign Employee</h2>
                <button onClick={() => { setShowAssignEmployeeModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Work Order: {selectedWorkOrder.work_order_id}
              </p>
            </div>

            <div className="p-6">
              {employees.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No employees available</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => handleAssignEmployee(emp.id)}
                      className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                        <p className="text-sm text-gray-500">{emp.role || emp.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Work Order Details</h2>
                <button onClick={() => { setShowViewModal(false); setSelectedWorkOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Work Order Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Order ID</p>
                  <p className="font-mono font-medium text-gray-900">{selectedWorkOrder.work_order_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedWorkOrder.status)}`}>
                    {selectedWorkOrder.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Resident</p>
                  <p className="text-gray-900">{selectedWorkOrder.client_name || selectedWorkOrder.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="text-gray-900">{selectedWorkOrder.category_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subcategory</p>
                  <p className="text-gray-900">{selectedWorkOrder.subcategory_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Priority</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    selectedWorkOrder.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    selectedWorkOrder.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    selectedWorkOrder.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {(selectedWorkOrder.priority || 'medium').toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-gray-900">{formatDate(selectedWorkOrder.created_at)}</p>
                </div>
              </div>

              {/* Property Details Section */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h4 className="text-sm font-semibold text-blue-800 mb-3">Property Details</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="font-medium text-gray-900">{selectedWorkOrder.property_address}{selectedWorkOrder.property_city ? `, ${selectedWorkOrder.property_city}` : ''}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {selectedWorkOrder.description && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">Description</p>
                  <p className="text-gray-700">{selectedWorkOrder.description}</p>
                </div>
              )}

              {/* Additional Info */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Additional Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Permission to Enter</p>
                    <p className="text-gray-900 capitalize">{selectedWorkOrder.permission_to_enter || 'No'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Has Pet</p>
                    <p className="text-gray-900 capitalize">{selectedWorkOrder.has_pet || 'No'}</p>
                  </div>
                  <div>
                      <p className="text-sm text-gray-500">Assigned Vendor</p>
                      <p className="text-gray-900">{selectedWorkOrder.vendor_name || 'Not Assigned'}</p>
                    </div>
                </div>
              </div>

              {/* Attachments Section */}
              {selectedWorkOrder.attachments && selectedWorkOrder.attachments.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500 mb-2">Attachments ({selectedWorkOrder.attachments.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedWorkOrder.attachments.map((att) => {
                      const filePath = att.file_path?.startsWith('uploads/') ? att.file_path : `uploads/${att.file_path || att.file_name}`;
                      const fileUrl = `${API_BASE}/${filePath}`;
                      return (
                        <div
                          key={att.id}
                          onClick={() => att.file_type?.startsWith('image/') ? setViewingImage({ url: fileUrl, name: att.original_name || att.file_name }) : window.open(fileUrl, '_blank')}
                          className="border border-gray-200 rounded-lg p-2 hover:bg-gray-50 transition-colors group cursor-pointer"
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Closing Notes Section - Show when work order is completed */}
              {selectedWorkOrder.status === 'completed' && selectedWorkOrder.closing_notes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Completion Notes
                  </p>
                  <p className="text-sm text-green-700">{selectedWorkOrder.closing_notes}</p>
                </div>
              )}

              {/* Cancellation Note Section - Show when work order is cancelled */}
              {selectedWorkOrder.status === 'cancelled' && selectedWorkOrder.cancellation_note && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                  <p className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Cancellation Reason
                  </p>
                  <p className="text-sm text-red-700">{selectedWorkOrder.cancellation_note}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => { setShowViewModal(false); setSelectedWorkOrder(null); }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Note Modal */}
      {showCancelledNoteModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Cancel Work Order</h2>
                    <p className="text-sm text-gray-500">{selectedWorkOrder.work_order_id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowCancelledNoteModal(false); setCancelledNote(''); setSelectedWorkOrder(null); }} 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelledNote}
                onChange={(e) => setCancelledNote(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                required
              />
              <p className="mt-2 text-xs text-gray-500">
                This note will be recorded with the cancellation for future reference.
              </p>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowCancelledNoteModal(false); setCancelledNote(''); setSelectedWorkOrder(null); }}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelWithNote}
                disabled={!cancelledNote.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Cancellation
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

      {/* Edit Work Order Modal */}
      {showEditModal && selectedWorkOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
              <div className="grid grid-cols-3 gap-4">
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
                      fetchSubcategoriesForEdit(e.target.value);
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
    </div>
  );
};

export default CoordinatorWorkOrders;
