import { useState, useEffect } from 'react';
import { Search, Eye, X, Check, Clock, AlertCircle } from 'lucide-react';

const WorkOrders = ({ admin }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const response = await fetch('/api/admin/work-orders');
      const result = await response.json();
      if (result.success) setWorkOrders(result.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const response = await fetch(`/api/admin/work-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Status updated');
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

  const filtered = workOrders.filter(wo => {
    const matchesSearch = 
      wo.work_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.category_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || wo.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
        <p className="text-gray-500">Manage and track all work orders</p>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <Check className="w-5 h-5" /><span>{success}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search work orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Order ID</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Resident</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden md:table-cell">Unit</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Category</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap hidden sm:table-cell">Created</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-gray-500">No work orders found</td></tr>
              ) : (
                filtered.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 font-mono text-xs whitespace-nowrap text-gray-700">{wo.work_order_id}</td>
                    <td className="px-3 py-3 font-medium text-sm whitespace-nowrap truncate max-w-[100px]">{wo.first_name} {wo.last_name}</td>
                    <td className="px-3 py-3 text-sm whitespace-nowrap hidden md:table-cell">{wo.unit_number} - {wo.property_name}</td>
                    <td className="px-3 py-3 text-sm whitespace-nowrap">{wo.category_name}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 whitespace-nowrap hidden sm:table-cell">{new Date(wo.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => setSelectedOrder(wo)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold">Work Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Order ID</p>
                  <p className="font-mono font-medium">{selectedOrder.work_order_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <select value={selectedOrder.status} onChange={(e) => { updateStatus(selectedOrder.id, e.target.value); setSelectedOrder({ ...selectedOrder, status: e.target.value }); }} className="mt-1 px-3 py-1 border border-gray-300 rounded-lg text-sm">
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Resident</p>
                  <p className="font-medium">{selectedOrder.first_name} {selectedOrder.last_name}</p>
                  <p className="text-sm text-gray-600 break-all">{selectedOrder.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">Unit {selectedOrder.unit_number}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.property_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium">{selectedOrder.category_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Subcategory</p>
                  <p className="font-medium">{selectedOrder.subcategory_name}</p>
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
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setSelectedOrder(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrders;
