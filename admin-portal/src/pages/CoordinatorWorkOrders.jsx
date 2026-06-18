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
  Send
} from 'lucide-react';
import { Link } from 'react-router-dom';

const CoordinatorWorkOrders = ({ user }) => {
  // Check if this is an FP-created Coordinator (has franchisePartnerId)
  const isFPCoordinator = !!user?.franchisePartnerId;
  
  const location = useLocation();
  const [workOrders, setWorkOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
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
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelledNoteModal, setShowCancelledNoteModal] = useState(false);
  const [cancelledNote, setCancelledNote] = useState('');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryId: '',
    subcategoryId: '',
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

  const viewType = location.pathname.includes('/pending') ? 'pending' 
                 : location.pathname.includes('/completed') ? 'completed'
                 : location.pathname.includes('/create') ? 'create'
                 : 'pending'; // Default to pending

  const token = sessionStorage.getItem('pm_auth_token');

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
      const response = await fetch('/api/coordinator/work-orders', {
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
        fetch('/api/coordinator/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/vendors', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/employees', { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ json: () => ({ success: false }) }))
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

    try {
      const response = await fetch('/api/coordinator/work-orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
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

  const handleStatusUpdate = async (id, newStatus, note = '') => {
    // If changing to cancelled, show the note modal first
    if (newStatus === 'cancelled' && !note) {
      const wo = workOrders.find(w => w.id === id);
      setSelectedWorkOrder(wo);
      setShowCancelledNoteModal(true);
      return;
    }

    try {
      const response = await fetch(`/api/coordinator/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, cancellationNote: note })
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

  const handleCancelWithNote = async () => {
    if (!selectedWorkOrder) return;
    await handleStatusUpdate(selectedWorkOrder.id, 'cancelled', cancelledNote);
    setShowCancelledNoteModal(false);
    setCancelledNote('');
    setSelectedWorkOrder(null);
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
        wo.created_at ? new Date(wo.created_at).toLocaleDateString() : ''
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

  const handleDeleteWorkOrder = async (wo) => {
    if (!window.confirm('Are you sure you want to delete this work order?')) return;

    try {
      const response = await fetch(`/api/coordinator/work-orders/${wo.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Work order deleted successfully!' });
        fetchWorkOrders();
      } else {
        setMessage({ type: 'error', text: result.message || 'Delete failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete work order' });
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: '',
      categoryId: '',
      subcategoryId: '',
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
    setFormData({ ...formData, categoryId, subcategoryId: '' });
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
  };

  // Fetch subcategories (uses embedded data from categories)
  const fetchSubcategories = (categoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    setSubcategories(category?.subcategories || []);
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
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter by tab (pending/completed) first, then by status filter, then by search
  const pendingStatuses = ['pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress'];
  const completedStatuses = ['completed', 'closed'];
  const tabFilteredWorkOrders = viewType === 'pending' 
    ? workOrders.filter(wo => pendingStatuses.includes(wo.status))
    : viewType === 'completed'
    ? workOrders.filter(wo => completedStatuses.includes(wo.status))
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
    if (viewType === 'pending') return 'Pending Work Orders';
    if (viewType === 'completed') return 'Completed Work Orders';
    return 'All Work Orders';
  };

  const getViewIcon = () => {
    if (viewType === 'pending') return Clock;
    if (viewType === 'completed') return CheckCircle2;
    return ClipboardList;
  };

  const ViewIcon = getViewIcon();

  // Get pending and completed counts
  const pendingCount = workOrders.filter(wo => ['pending', 'requested', 'under_review', 'assigned', 'accepted', 'in_progress'].includes(wo.status)).length;
  const completedCount = workOrders.filter(wo => ['completed', 'closed'].includes(wo.status)).length;

  // Filter properties based on search
  const filteredProperties = properties.filter(p =>
    p.property_id?.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.name?.toLowerCase().includes(propertySearch.toLowerCase())
  );

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
            to="/coordinator/work-orders/pending"
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewType === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              viewType === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {pendingCount}
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
                            setSelectedProperty(p);
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
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Address</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProperty.address || '-'}</p>
                      </div>
                    </div>
                    {/* Property Type Specific Fields */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      {(selectedProperty.property_type === 'gated_community' || selectedProperty.property_type === 'GC') && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Units</p>
                            <p className="text-sm font-medium text-gray-900">{selectedProperty.total_units || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Blocks</p>
                            <p className="text-sm font-medium text-gray-900">{selectedProperty.blocks || selectedProperty.number_of_blocks || '-'}</p>
                          </div>
                        </>
                      )}
                      {(selectedProperty.property_type === 'apartment' || selectedProperty.property_type === 'APT') && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Total Units</p>
                            <p className="text-sm font-medium text-gray-900">{selectedProperty.total_units || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Tower/Block</p>
                            <p className="text-sm font-medium text-gray-900">{selectedProperty.tower_name || selectedProperty.block_number || '-'}</p>
                          </div>
                        </>
                      )}
                      {(selectedProperty.property_type === 'villa' || selectedProperty.property_type === 'VILLA') && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Villa Number</p>
                          <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_number || selectedProperty.villa_plot_number || '-'}</p>
                        </div>
                      )}
                      {(selectedProperty.property_type === 'plot' || selectedProperty.property_type === 'PLOT') && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Plot Number</p>
                          <p className="text-sm font-medium text-gray-900">{selectedProperty.plot_number || selectedProperty.villa_plot_number || '-'}</p>
                        </div>
                      )}
                      {(selectedProperty.property_type === 'flat' || selectedProperty.property_type === 'FLAT') && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Block</p>
                            <p className="text-sm font-medium text-gray-900">{selectedProperty.block || selectedProperty.block_number || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Flat Number</p>
                            <p className="text-sm font-medium text-gray-900">{selectedProperty.flat_number || '-'}</p>
                          </div>
                        </>
                      )}
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
                <select
                  value={formData.subcategoryId}
                  onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={!formData.categoryId}
                >
                  <option value="">Select a category first</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
            onClick={() => { setSearchTerm(''); setStatusFilter(''); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Clear</span>
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
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
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
                      <span className="text-sm text-gray-600">{wo.category_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
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
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => { setSelectedWorkOrder(wo); setShowViewModal(true); }}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
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
    </div>
  );
};

export default CoordinatorWorkOrders;
