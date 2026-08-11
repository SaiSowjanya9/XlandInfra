import { useState, useEffect, useRef } from 'react';
import { safeStorage, getAuthToken } from '../utils/safeStorage';
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
  Pencil,
  Truck,
  UserPlus,
  Trash2,
  Shield,
  Store,
  List,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;
import SelectWithAdd from '../components/SelectWithAdd';
import { getCategories, addCategory, getSubcategories, addSubcategory } from '../utils/fieldOptionsStore';
import { extractBlockNames, extractTotalUnits, extractUnitNumber } from '../utils/propertyStore';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const EmployeeWorkOrders = ({ admin }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({ pending: 0, completed: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
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
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [selectedAssignee, setSelectedAssignee] = useState('');

  // Create form state
  const [categories, setCategories] = useState([]);
  const [editSubcategories, setEditSubcategories] = useState([]); // For edit modal
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: '',
    propertyName: '',
    propertyType: '',
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
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [completingWorkOrderId, setCompletingWorkOrderId] = useState(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const fileInputRef = useRef(null);
  
  // Get selected FP from context
  const { selectedFp, fpList, selectFp } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
  };
  const token = getAuthToken();
  
  // Check if user is Operations Manager (view-only access)
  const currentUser = JSON.parse(safeStorage.getItem('pm_current_user') || '{}');
  const isOpsManager = currentUser?.role === 'operations_manager';
  const { loading: fpLoading } = useFP();

  // Auto-select "Admin (All FPs)" if no FP is selected
  useEffect(() => {
    if (!selectedFp && !fpLoading) {
      selectFp({ id: 'all', fpId: 'ADMIN', companyName: 'All Franchise Partners', displayName: 'Admin (All FPs)' });
    }
  }, [selectedFp, fpLoading, selectFp]);

  useEffect(() => {
    if (selectedFp) {
      fetchWorkOrders();
      fetchCategories();
      fetchProperties();
    }
  }, [activeTab, selectedFp]);

  const fetchWorkOrders = async (searchQuery = '') => {
    if (!selectedFp) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let url;
      
      // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
      // Fetch ALL orders to get correct counts, then filter by tab
      if (selectedFp.id === 'all') {
        url = `${API_BASE}/api/admin/all-work-orders`;
      } else {
        url = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/work-orders`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        const allOrders = result.data || [];
        
        // Calculate counts - Pending = all except completed, Completed = only completed
        const pendingCount = allOrders.filter(o => o.status !== 'completed').length;
        const completedCount = allOrders.filter(o => o.status === 'completed').length;
        setCounts({ pending: pendingCount, completed: completedCount, total: allOrders.length });
        
        // Filter orders based on active tab - All shows everything, Completed shows only completed
        let filteredOrders = allOrders;
        if (activeTab === 'completed') {
          filteredOrders = allOrders.filter(o => o.status === 'completed');
        }
        
        setWorkOrders(filteredOrders);
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
      const response = await fetch(`${API_BASE}/api/work-orders/categories`);
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Fetch subcategories for edit modal (uses embedded data from categories)
  const fetchEditSubcategories = (categoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    setEditSubcategories(category?.subcategories || []);
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/onboarding`);
      const result = await response.json();
      if (result.success) {
        setProperties(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  // Helper to compute total units based on property type
  const computeTotalUnits = (prop) => {
    const propType = (prop.property_type || prop.entryType || '').toUpperCase();
    
    // For GC properties, compute from units_per_block
    if (propType === 'GC' || propType === 'GATED_COMMUNITY') {
      const upbData = prop.units_per_block || prop.unitsPerBlock;
      if (upbData) {
        try {
          const upb = typeof upbData === 'string' ? JSON.parse(upbData) : upbData;
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
    if (prop.total_units || prop.totalUnits) return prop.total_units || prop.totalUnits;
    if (prop.number_of_units || prop.numberOfUnits) return prop.number_of_units || prop.numberOfUnits;
    return null;
  };

  const handlePropertySelect = (property) => {
    const totalUnits = computeTotalUnits(property);
    setSelectedProperty({ ...property, total_units: totalUnits });
    setPropertySearch(property.propertyId || property.property_id || '');
    setShowPropertyDropdown(false);
    
    // Auto-populate customer details from property's contacts (backend returns 'contacts')
    const contact = property.contacts?.[0] || property.associationContacts?.[0] || {};
    const customerName = contact.name || property.communityName || property.name || '';
    const customerEmail = contact.email || '';
    const customerPhone = contact.phone ? (contact.phone.startsWith('+') ? contact.phone : `${contact.countryCode || '+91'} ${contact.phone}`) : '';
    
    // Use helper functions for consistent block/unit extraction
    const blockValue = extractBlockNames(property);
    const flatValue = extractUnitNumber(property);
    
    // Debug log for property data
    console.log('[WorkOrders] Property ID:', property.propertyId);
    console.log('[WorkOrders] Entry Type:', property.entryType);
    console.log('[WorkOrders] Extracted Block:', blockValue);
    console.log('[WorkOrders] Extracted Unit:', flatValue);
    
    setFormData(prev => ({
      ...prev,
      propertyId: property.propertyId,
      propertyName: property.communityName || property.name || '',
      propertyType: property.entryType || '',
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

  const updateStatus = async (id, status, closingNotesValue = null) => {
    // If completing, show modal to enter closing notes
    if (status === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(id);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminId: admin?.id, closingNotes: closingNotesValue })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Status updated successfully');
        fetchWorkOrders();
        setSelectedOrder(null);
        if (status === 'completed') {
          setShowCompletionModal(false);
          setClosingNotes('');
          setCompletingWorkOrderId(null);
        }
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError('Failed to update status');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      requested: 'bg-blue-100 text-blue-700',
      under_review: 'bg-yellow-100 text-yellow-700',
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

  const filtered = workOrders.filter(wo => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      wo.work_order_id?.toLowerCase().includes(search) ||
      wo.first_name?.toLowerCase().includes(search) ||
      wo.last_name?.toLowerCase().includes(search) ||
      wo.category_name?.toLowerCase().includes(search) ||
      wo.property_code?.toLowerCase().includes(search) ||
      wo.property_id?.toString().toLowerCase().includes(search)
    );
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Reset to page 1 when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedWorkOrders = filtered.slice(startIndex, endIndex);

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

  // Handle status change - uses the same endpoint as updateStatus
  const handleStatusChange = async (workOrderId, newStatus, closingNotesValue = null) => {
    // If completing, show modal to enter closing notes
    if (newStatus === 'completed' && closingNotesValue === null) {
      setCompletingWorkOrderId(workOrderId);
      setClosingNotes('');
      setShowCompletionModal(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/work-orders/${workOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, adminId: admin?.id, closingNotes: closingNotesValue })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Status updated successfully');
        fetchWorkOrders();
        if (newStatus === 'completed') {
          setShowCompletionModal(false);
          setClosingNotes('');
          setCompletingWorkOrderId(null);
        }
      } else {
        setError(result.message || 'Failed to update status');
      }
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (completingWorkOrderId && !isSubmittingCompletion) {
      setIsSubmittingCompletion(true);
      await updateStatus(completingWorkOrderId, 'completed', closingNotes);
      setIsSubmittingCompletion(false);
    }
  };

  // Handle edit work order
  const handleEditWorkOrder = (wo) => {
    setSelectedOrder(wo);
    setEditFormData({
      categoryId: wo.category_id || '',
      subcategoryId: wo.subcategory_id || '',
      description: wo.description || '',
      permissionToEnter: wo.permission_to_enter || wo.permissionToEnter || '',
      hasPet: wo.has_pet || wo.hasPet || '',
      entryNotes: wo.entry_notes || wo.entryNotes || '',
      priority: wo.priority || 'medium',
      status: wo.status || 'pending',
      customerName: wo.customer_name || [wo.first_name, wo.last_name].filter(Boolean).join(' ') || '',
      customerPhone: wo.customer_phone || wo.phone || '',
      customerEmail: wo.customer_email || wo.email || '',
      block: wo.block || '',
      flatNumber: wo.flat_number || wo.flatNumber || ''
    });
    // Load subcategories for the selected category
    if (wo.category_id) {
      fetchEditSubcategories(wo.category_id);
    }
    setShowEditModal(true);
  };

  // Save edit
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
      } else {
        setError(result.message || 'Failed to update work order');
      }
    } catch (err) {
      setError('Failed to update work order');
    }
  };

  // Handle delete
  const handleDeleteWorkOrder = async (workOrderId) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) return;
    try {
      console.log('Deleting work order:', workOrderId, 'Token:', token ? 'present' : 'missing');
      const response = await fetch(`${API_BASE}/api/admin/work-orders/${workOrderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Delete response status:', response.status);
      const result = await response.json();
      console.log('Delete result:', result);
      if (result.success) {
        setSuccess('Work order deleted successfully');
        fetchWorkOrders();
      } else {
        setError(result.message || 'Failed to delete work order');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete work order');
    }
  };

  // Open assign modal
  const openAssignModal = (wo, type) => {
    setSelectedOrder(wo);
    setAssignType(type);
    setSelectedAssignee('');
    setShowAssignModal(true);
    // Fetch vendors or employees for the specific FP (not seed data)
    const fpId = wo.franchise_partner_id || wo.fp_id;
    if (type === 'vendor') {
      // Fetch vendors from the FP's onboarded vendors
      fetch(`${API_BASE}/api/admin/fp-view/${fpId}/vendors`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(data => {
        if (data.success) setVendors(data.vendors || data.data || []);
      });
    } else {
      // Fetch employees from the FP
      fetch(`${API_BASE}/api/admin/fp-view/${fpId}/employees`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).then(data => {
        if (data.success) setEmployees(data.employees || data.data || []);
      });
    }
  };

  // Handle assign - accepts assigneeId directly (like FP)
  const handleAssign = async (assigneeId) => {
    if (!assigneeId || !selectedOrder) return;
    try {
      const response = await fetch(`${API_BASE}/api/admin/work-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          assignedTo: assigneeId,
          status: 'assigned'
        })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess(`${assignType === 'vendor' ? 'Vendor' : 'Employee'} assigned successfully`);
        setShowAssignModal(false);
        setSelectedOrder(null);
        fetchWorkOrders();
      } else {
        setError(result.message || 'Failed to assign');
      }
    } catch (err) {
      setError('Failed to assign');
    }
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
      submitData.append('propertyName', formData.propertyName);
      submitData.append('propertyType', formData.propertyType);
      if (formData.block) submitData.append('block', formData.block);
      if (formData.flatNumber) submitData.append('flatNumber', formData.flatNumber);
      submitData.append('customerName', formData.customerName);
      if (formData.customerEmail) submitData.append('customerEmail', formData.customerEmail);
      submitData.append('customerPhone', formData.customerPhone);
      submitData.append('categoryId', formData.categoryId);
      // Add category name
      const selectedCat = categories.find(c => c.id === parseInt(formData.categoryId));
      submitData.append('categoryName', selectedCat?.name || '');
      submitData.append('subcategoryId', formData.subcategoryId);
      // Add subcategory name
      const selectedSubcat = selectedCat?.subcategories?.find(s => s.id === parseInt(formData.subcategoryId));
      submitData.append('subcategoryName', selectedSubcat?.name || '');
      submitData.append('description', formData.description);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('entryNotes', formData.entryNotes);
      submitData.append('hasPet', formData.hasPet);
      submitData.append('priority', formData.priority);
      submitData.append('adminId', admin?.id || '');

      formData.attachments.forEach(attachment => {
        submitData.append('attachments', attachment.file);
      });

      const response = await fetch(`${API_BASE}/api/work-orders/admin/create`, {
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
          propertyName: '',
          propertyType: '',
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
        setActiveTab('all');
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

  const allTabs = [
    { id: 'all', label: 'All', icon: List, count: counts.total },
    { id: 'completed', label: 'Completed', icon: CheckCircle2, count: counts.completed },
    { id: 'create', label: 'Create New', icon: Plus, count: null },
  ];
  // Hide Create tab for Operations Manager
  const tabs = isOpsManager ? allTabs.filter(t => t.id !== 'create') : allTabs;

  // Show FP selection if no FP selected
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with FP Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-500 text-sm">
              {selectedFp.id === 'all' ? 'Viewing all work orders (Admin Mode)' : `Viewing work orders for ${selectedFp.companyName}`} • {workOrders.length} orders
            </p>
          </div>
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
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
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
                  placeholder="Search by Work Order ID, Property ID, category, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.trim())}
                  onKeyPress={handleSearchKeyPress}
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
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); fetchWorkOrders(); }}
                className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Work Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
                          <span className="text-gray-500">Loading work orders...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-12">
                        <div className="flex flex-col items-center justify-center">
                          <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
                          <span className="text-gray-500">No work orders found</span>
                          {!isOpsManager && (
                            <button
                              onClick={() => setActiveTab('create')}
                              className="mt-3 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                            >
                              Create a new work order →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedWorkOrders.map((wo) => (
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
                          {isOpsManager ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                              {wo.status === 'pending' ? 'Pending' : wo.status === 'assigned' ? 'Assigned' : wo.status === 'in_progress' ? 'In Progress' : wo.status === 'completed' ? 'Completed' : 'Cancelled'}
                            </span>
                          ) : (
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
                                <option value="closed" className="bg-white text-gray-900">Closed</option>
                                <option value="cancelled" className="bg-white text-gray-900">Cancelled</option>
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-500">{formatDate(wo.created_at)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {wo.source === 'customer' ? (wo.customer_name || 'Customer') : (wo.created_by_name || wo.created_by || 'System')}
                            </p>
                            <p className="text-xs text-gray-500">{wo.property_code || ''}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedOrder(wo)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4 text-gray-500" />
                            </button>
                            {!isOpsManager && (
                              <>
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
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(endIndex, filtered.length)} of {filtered.length} work orders
                </div>
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
                          className={`w-8 h-8 rounded-lg text-sm font-medium ${
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
              </div>
            )}
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
                          {extractBlockNames(selectedProperty) || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Number of Units</p>
                        <p className="text-sm font-medium text-gray-800">
                          {extractTotalUnits(selectedProperty) ? `${extractTotalUnits(selectedProperty)} Units` : '-'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Villa/Plot/Flat: Show the unit number */}
                  {(selectedProperty.entryType === 'VILLA' || selectedProperty.entryType === 'PLOT' || selectedProperty.entryType === 'FLAT') && extractUnitNumber(selectedProperty) && (
                    <div className="mt-3 pt-3 border-t border-indigo-200">
                      <p className="text-xs text-gray-500">
                        {selectedProperty.entryType === 'VILLA' ? 'Villa Number' : 
                         selectedProperty.entryType === 'PLOT' ? 'Plot Number' : 'Flat Number'}
                      </p>
                      <p className="text-sm font-medium text-gray-800">{extractUnitNumber(selectedProperty)}</p>
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
              )}
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
                    <span>Create Work Order</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedOrder && !showEditModal && !showAssignModal && (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Customer Name</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.customer_name || [selectedOrder.first_name, selectedOrder.last_name].filter(Boolean).join(' ') || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Email</p>
                  <p className="font-medium text-gray-900 mt-1 text-sm truncate" title={selectedOrder.customer_email || selectedOrder.email || 'N/A'}>
                    {selectedOrder.customer_email || selectedOrder.email || 'N/A'}
                  </p>
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
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Property/Community</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.onboarded_property_name || selectedOrder.property_name || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Zone / Division</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.zone || 'N/A'} / {selectedOrder.division || 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Block</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.block || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Flat/Unit</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedOrder.flat_number || selectedOrder.unit_number || 'N/A'}</p>
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

              {/* Closing Notes Section - Show when work order is completed */}
              {selectedOrder.status === 'completed' && selectedOrder.closing_notes && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4" />
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

      {/* Edit Work Order Modal */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Edit Work Order</h2>
                  <p className="text-sm text-gray-500">{selectedOrder.work_order_id}</p>
                </div>
                <button onClick={() => { setShowEditModal(false); setSelectedOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Property Info (Read Only) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Property Information</h3>
                <p className="text-sm text-gray-600">{selectedOrder.property_name || selectedOrder.community_name || 'N/A'}</p>
                <p className="text-xs text-gray-500">Zone: {selectedOrder.zone || 'N/A'} | Division: {selectedOrder.division || 'N/A'}</p>
              </div>

              {/* Customer Information */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input type="text" value={editFormData.customerName || ''} onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Customer name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={editFormData.customerEmail || ''} onChange={(e) => setEditFormData({ ...editFormData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={editFormData.customerPhone || ''} onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Phone" />
                </div>
              </div>

              {/* Block & Flat */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Block</label>
                  <input type="text" value={editFormData.block || ''} onChange={(e) => setEditFormData({ ...editFormData, block: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Block" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Flat/Unit</label>
                  <input type="text" value={editFormData.flatNumber || ''} onChange={(e) => setEditFormData({ ...editFormData, flatNumber: e.target.value })}
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
                    fetchEditSubcategories(e.target.value);
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
                  {editSubcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editFormData.description || ''}
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
                  <option value="closed">Closed</option>
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
                onClick={() => { setShowEditModal(false); setSelectedOrder(null); }}
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

      {/* Assign Modal - matches FP portal design */}
      {showAssignModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Assign {assignType === 'vendor' ? 'Vendor' : 'Employee'}
                </h2>
                <button onClick={() => { setShowAssignModal(false); setSelectedOrder(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Work Order: {selectedOrder.work_order_id}
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
                            : (`${item.first_name || item.firstName || ''} ${item.last_name || item.lastName || ''}`.trim() || item.name || 'Unknown Employee')}
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

      {/* Completion Modal with Closing Notes */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Check className="w-5 h-5 text-green-600" />
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
                <Check className="w-4 h-4" />
                {isSubmittingCompletion ? 'Completing...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeWorkOrders;
