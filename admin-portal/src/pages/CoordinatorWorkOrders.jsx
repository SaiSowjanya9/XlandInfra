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
  CheckCircle2
} from 'lucide-react';

const CoordinatorWorkOrders = ({ user }) => {
  const location = useLocation();
  const [workOrders, setWorkOrders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    propertyId: '',
    categoryId: '',
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
    { value: 'closed', label: 'Closed' },
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
      const [propRes, catRes, custRes, vendRes] = await Promise.all([
        fetch('/api/coordinator/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/customers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/coordinator/vendors', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [propData, catData, custData, vendData] = await Promise.all([
        propRes.json(), catRes.json(), custRes.json(), vendRes.json()
      ]);

      if (propData.success) setProperties(propData.data);
      if (catData.success) setCategories(catData.data);
      if (custData.success) setCustomers(custData.data);
      if (vendData.success) setVendors(vendData.data.all || []);
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

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await fetch(`/api/coordinator/work-orders/${id}/status`, {
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

  const resetForm = () => {
    setFormData({
      propertyId: '',
      categoryId: '',
      clientId: '',
      title: '',
      description: '',
      priority: 'medium',
      permissionToEnter: 'no',
      hasPet: 'no',
      scheduledDate: ''
    });
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
            <p className="text-gray-500 mt-1">Manage your work orders</p>
          </div>
        </div>
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Work Order</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Priority</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Created</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkOrders.map((wo) => (
                  <tr key={wo.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{wo.title || wo.work_order_id}</p>
                        <p className="text-sm text-gray-500">{wo.work_order_id}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{wo.property_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{wo.category_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(wo.priority)}`}>
                        {wo.priority?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-600">{wo.vendor_name || '-'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-500">{formatDate(wo.created_at)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        {!wo.assigned_vendor_id && wo.status !== 'closed' && wo.status !== 'cancelled' && (
                          <button
                            onClick={() => { setSelectedWorkOrder(wo); setShowAssignModal(true); }}
                            className="px-3 py-1 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50"
                          >
                            Assign Vendor
                          </button>
                        )}
                        {wo.status === 'completed' && (
                          <button
                            onClick={() => handleStatusUpdate(wo.id, 'closed')}
                            className="px-3 py-1 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                          >
                            Close
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
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
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
    </div>
  );
};

export default CoordinatorWorkOrders;
