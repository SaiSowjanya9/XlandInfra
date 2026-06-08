import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, X, Check, Clock, AlertCircle, ChevronDown, Shield, RefreshCw, ClipboardList, CheckCircle2 } from 'lucide-react';
import { useFP } from '../contexts/FPContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const WorkOrders = ({ admin }) => {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'completed'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
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
        setSuccess('Status updated successfully');
        setError('');
        fetchWorkOrders();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message || 'Failed to update status');
        setTimeout(() => setError(''), 5000);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to update status');
      setTimeout(() => setError(''), 5000);
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

  // Filter by search
  const filteredOrders = workOrders.filter(wo => {
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
          <AlertCircle className="w-5 h-5" /><span>{error}</span>
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
          onClick={fetchWorkOrders}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by ID, title, property, or category..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Order ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">Property</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">Created By</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">Created</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="9" className="text-center py-12 text-gray-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                  Loading work orders...
                </td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-12 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No {activeTab} work orders found</p>
                  <p className="text-sm text-gray-400 mt-1">Work orders will appear here when created</p>
                </td></tr>
              ) : (
                filteredOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-gray-700">{wo.work_order_id}</td>
                    <td className="px-4 py-3 font-medium text-sm whitespace-nowrap truncate max-w-[150px]">{wo.title || '-'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap hidden md:table-cell truncate max-w-[120px]">{wo.property_name || '-'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{wo.category_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                        wo.priority === 'high' ? 'bg-red-100 text-red-700' :
                        wo.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {wo.priority || 'normal'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(wo.status)}`}>
                        {wo.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap hidden lg:table-cell">{wo.created_by_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap hidden sm:table-cell">{new Date(wo.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setSelectedOrder(wo)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
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
