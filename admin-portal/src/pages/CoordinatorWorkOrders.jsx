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
  MessageSquare
} from 'lucide-react';

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
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryId: '',
    subcategoryId: '',
    clientId: '',
    title: '',
    description: '',
    priority: 'medium',
    permissionToEnter: 'no',
    hasPet: 'no',
    scheduledDate: ''
  });

  const viewType = location.pathname.includes('/pending') ? 'pending' 
                 : location.pathname.includes('/completed') ? 'completed' 
                 : 'all';

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
      let endpoint = '/api/coordinator/work-orders';
      if (viewType === 'pending') endpoint = '/api/coordinator/work-orders/pending';
      else if (viewType === 'completed') endpoint = '/api/coordinator/work-orders/completed';
      else if (statusFilter) endpoint += `?status=${statusFilter}`;
      
      const response = await fetch(endpoint, {
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
      title: '',
      description: '',
      priority: 'medium',
      permissionToEnter: 'no',
      hasPet: 'no',
      scheduledDate: ''
    });
    setSubcategories([]);
  };

  // Handle category change to load subcategories
  const handleCategoryChange = async (categoryId) => {
    setFormData({ ...formData, categoryId, subcategoryId: '' });
    if (categoryId) {
      try {
        const response = await fetch(`/api/coordinator/categories/${categoryId}/subcategories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          setSubcategories(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch subcategories:', error);
        setSubcategories([]);
      }
    } else {
      setSubcategories([]);
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

  const filteredWorkOrders = workOrders.filter(wo =>
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

  return (
    <div className="space-y-6">
      {/* FP Coordinator - View Only Banner */}
      {isFPCoordinator && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Eye className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-800">View Only Access</h3>
            <p className="text-sm text-amber-700">You have view-only access. Status changes are allowed for completed orders.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            viewType === 'pending' ? 'bg-orange-100' : viewType === 'completed' ? 'bg-green-100' : 'bg-teal-100'
          }`}>
            <ViewIcon className={`w-5 h-5 ${
              viewType === 'pending' ? 'text-orange-600' : viewType === 'completed' ? 'text-green-600' : 'text-teal-600'
            }`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getViewTitle()}</h1>
            <p className="text-gray-500 mt-1">
              {isFPCoordinator ? 'View and manage work order statuses' : 'Manage your work orders'}
            </p>
          </div>
        </div>
        {/* Create Work Order - Always visible (as per diagram) */}
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          <span>Create Work Order</span>
        </button>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search work orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {viewType === 'all' && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 appearance-none bg-white"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
          <button
            onClick={fetchWorkOrders}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Work Orders List */}
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
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{wo.work_order_id}</p>
                        <p className="text-sm text-gray-500">{wo.title || '-'}</p>
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
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-500">{formatDate(wo.created_at)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* View Details - Always visible */}
                        <button
                          onClick={() => { setSelectedWorkOrder(wo); setShowViewModal(true); }}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* PENDING TAB ACTIONS */}
                        {viewType === 'pending' && (
                          <div className="flex items-center gap-1">
                            {/* Assign Vendor - Hidden for FP Coordinator */}
                            {!isFPCoordinator && (
                              <button
                                onClick={() => { setSelectedWorkOrder(wo); setShowAssignModal(true); }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Assign Vendor"
                              >
                                <Store className="w-4 h-4" />
                              </button>
                            )}
                            {/* Assign Employee - Hidden for FP Coordinator */}
                            {!isFPCoordinator && (
                              <button
                                onClick={() => { setSelectedWorkOrder(wo); setShowAssignEmployeeModal(true); }}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Assign Employee"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                            )}
                            {/* Export to Excel - Hidden for FP Coordinator */}
                            {!isFPCoordinator && (
                              <button
                                onClick={() => handleExportWorkOrder(wo)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Export to Excel"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>
                            )}
                            {/* Delete - Hidden for FP Coordinator */}
                            {!isFPCoordinator && (
                              <button
                                onClick={() => handleDeleteWorkOrder(wo)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* COMPLETED TAB ACTIONS */}
                        {viewType === 'completed' && (
                          <div className="flex items-center gap-1">
                            {/* Change of Status - dropdown */}
                            <select
                              value={wo.status}
                              onChange={(e) => handleStatusUpdate(wo.id, e.target.value)}
                              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-teal-500"
                              title="Change Status"
                            >
                              <option value="pending">Pending</option>
                              <option value="assigned">Assigned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            {/* Revert to Pending */}
                            <button
                              onClick={() => handleStatusUpdate(wo.id, 'pending')}
                              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Revert to Pending"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        
                        {/* ALL TAB ACTIONS */}
                        {viewType === 'all' && (
                          <div className="flex items-center gap-1">
                            {!isFPCoordinator && wo.status !== 'completed' && wo.status !== 'cancelled' && (
                              <>
                                <button
                                  onClick={() => { setSelectedWorkOrder(wo); setShowAssignModal(true); }}
                                  className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Assign Vendor"
                                >
                                  <Store className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => { setSelectedWorkOrder(wo); setShowAssignEmployeeModal(true); }}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Assign Employee"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {!isFPCoordinator && (
                              <button
                                onClick={() => handleExportWorkOrder(wo)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Export to Excel"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
                  <Save className="w-4 h-4" />
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
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="text-gray-900">{selectedWorkOrder.title || '-'}</p>
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
                  <p className="text-sm text-gray-500">Property</p>
                  <p className="text-gray-900">{selectedWorkOrder.property_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="text-gray-900">{selectedWorkOrder.category_name || '-'}</p>
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
                <div>
                  <p className="text-sm text-gray-500">Scheduled Date</p>
                  <p className="text-gray-900">{selectedWorkOrder.scheduled_date ? formatDate(selectedWorkOrder.scheduled_date) : '-'}</p>
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
                  {selectedWorkOrder.vendor_name && (
                    <div>
                      <p className="text-sm text-gray-500">Assigned Vendor</p>
                      <p className="text-gray-900">{selectedWorkOrder.vendor_name}</p>
                    </div>
                  )}
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
