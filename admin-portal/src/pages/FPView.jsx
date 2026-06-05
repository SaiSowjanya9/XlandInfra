import { useState, useEffect } from 'react';
import { 
  Building2, Users, ClipboardList, Wrench, UserCheck, MapPin, 
  FileText, Package, PlusCircle, Archive, ChevronDown, Search,
  Home, Eye, RefreshCw, AlertCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FPView = ({ admin }) => {
  const [fpList, setFpList] = useState([]);
  const [selectedFp, setSelectedFp] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [fpLoading, setFpLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  
  // Data states for each section
  const [dashboardData, setDashboardData] = useState(null);
  const [properties, setProperties] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [pendingWorkOrders, setPendingWorkOrders] = useState([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorAssignments, setVendorAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeZones, setEmployeeZones] = useState({ employees: [], zones: [] });
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [amcPackages, setAmcPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [customers, setCustomers] = useState([]);

  const token = sessionStorage.getItem('pm_auth_token');

  // Fetch FP list on mount
  useEffect(() => {
    fetchFpList();
  }, []);

  // Fetch data when FP or tab changes
  useEffect(() => {
    if (selectedFp) {
      fetchTabData(activeTab);
    }
  }, [selectedFp, activeTab]);

  const fetchFpList = async () => {
    setFpLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/admin/fp-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setFpList(result.data);
      }
    } catch (error) {
      console.error('Error fetching FP list:', error);
      setError('Failed to load franchise partners');
    } finally {
      setFpLoading(false);
    }
  };

  const fetchTabData = async (tab) => {
    if (!selectedFp) return;
    setLoading(true);
    setError(null);
    
    try {
      const fpId = selectedFp.id;
      let endpoint = '';
      
      switch (tab) {
        case 'dashboard':
          endpoint = `/api/admin/fp-view/${fpId}/dashboard`;
          break;
        case 'properties':
          endpoint = `/api/admin/fp-view/${fpId}/properties`;
          break;
        case 'work-orders':
          endpoint = `/api/admin/fp-view/${fpId}/work-orders`;
          break;
        case 'pending-wo':
          endpoint = `/api/admin/fp-view/${fpId}/work-orders?status=pending`;
          break;
        case 'completed-wo':
          endpoint = `/api/admin/fp-view/${fpId}/work-orders?status=completed`;
          break;
        case 'vendors':
          endpoint = `/api/admin/fp-view/${fpId}/vendors`;
          break;
        case 'vendor-assignments':
          endpoint = `/api/admin/fp-view/${fpId}/vendor-assignments`;
          break;
        case 'employees':
          endpoint = `/api/admin/fp-view/${fpId}/employees`;
          break;
        case 'employee-zones':
          endpoint = `/api/admin/fp-view/${fpId}/employee-zones`;
          break;
        case 'estimates':
          endpoint = `/api/admin/fp-view/${fpId}/estimates`;
          break;
        case 'archived':
          endpoint = `/api/admin/fp-view/${fpId}/estimates?archived=true`;
          break;
        case 'amc-packages':
          endpoint = `/api/admin/fp-view/${fpId}/amc-packages`;
          break;
        case 'addons':
          endpoint = `/api/admin/fp-view/${fpId}/addons`;
          break;
        case 'customers':
          endpoint = `/api/admin/fp-view/${fpId}/customers`;
          break;
        default:
          return;
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        switch (tab) {
          case 'dashboard':
            setDashboardData(result.data);
            break;
          case 'properties':
            setProperties(result.data);
            break;
          case 'work-orders':
            setWorkOrders(result.data);
            break;
          case 'pending-wo':
            setPendingWorkOrders(result.data);
            break;
          case 'completed-wo':
            setCompletedWorkOrders(result.data);
            break;
          case 'vendors':
            setVendors(result.data);
            break;
          case 'vendor-assignments':
            setVendorAssignments(result.data);
            break;
          case 'employees':
            setEmployees(result.data);
            break;
          case 'employee-zones':
            setEmployeeZones(result.data);
            break;
          case 'estimates':
            setEstimates(result.data);
            break;
          case 'archived':
            setArchivedEstimates(result.data);
            break;
          case 'amc-packages':
            setAmcPackages(result.data);
            break;
          case 'addons':
            setAddons(result.data);
            break;
          case 'customers':
            setCustomers(result.data);
            break;
        }
      } else {
        setError(result.message || 'Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'work-orders', label: 'All Work Orders', icon: ClipboardList },
    { id: 'pending-wo', label: 'Pending WO', icon: ClipboardList },
    { id: 'completed-wo', label: 'Completed WO', icon: ClipboardList },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'vendors', label: 'Vendor Details', icon: Wrench },
    { id: 'vendor-assignments', label: 'Assigned Vendors', icon: UserCheck },
    { id: 'employees', label: 'Employee Details', icon: Users },
    { id: 'employee-zones', label: 'Employee Zones', icon: MapPin },
    { id: 'estimates', label: 'All Estimates', icon: FileText },
    { id: 'amc-packages', label: 'AMC Packages', icon: Package },
    { id: 'addons', label: 'Add-ons', icon: PlusCircle },
    { id: 'archived', label: 'Archived', icon: Archive },
  ];

  const filteredFpList = fpList.filter(fp => 
    fp.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fp.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fp.fpId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      requested: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Render FP Selector
  if (!selectedFp) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">FP Data Viewer</h1>
              <p className="text-gray-500 mt-2">Select a Franchise Partner to view their data (Read-Only)</p>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by FP ID or Company Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {fpLoading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                <p>{error}</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredFpList.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No franchise partners found</p>
                ) : (
                  filteredFpList.map(fp => (
                    <button
                      key={fp.id}
                      onClick={() => setSelectedFp(fp)}
                      className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-left"
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{fp.fpId}</div>
                        <div className="text-sm text-gray-600">{fp.companyName}</div>
                        <div className="text-xs text-gray-400">{fp.city}, {fp.state}</div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-gray-400 transform -rotate-90" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Content
  const renderDashboard = () => {
    if (!dashboardData) return null;
    const { stats, recentWorkOrders, fpInfo } = dashboardData;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{stats.totalProperties}</div>
            <div className="text-sm text-blue-600">Properties</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">{stats.pendingWorkOrders}</div>
            <div className="text-sm text-yellow-600">Pending WO</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{stats.completedWorkOrders}</div>
            <div className="text-sm text-green-600">Completed WO</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-700">{stats.totalVendors}</div>
            <div className="text-sm text-purple-600">Vendors</div>
          </div>
          <div className="bg-indigo-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-indigo-700">{stats.totalEmployees}</div>
            <div className="text-sm text-indigo-600">Employees</div>
          </div>
          <div className="bg-pink-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-pink-700">{stats.totalEstimates}</div>
            <div className="text-sm text-pink-600">Estimates</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Recent Work Orders</h3>
          {recentWorkOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent work orders</p>
          ) : (
            <div className="space-y-2">
              {recentWorkOrders.map(wo => (
                <div key={wo.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{wo.work_order_id}</div>
                    <div className="text-sm text-gray-500">{wo.title}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(wo.status)}`}>
                    {wo.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Table Content
  const renderTable = (data, columns) => {
    if (data.length === 0) {
      return <p className="text-gray-500 text-center py-8">No data available</p>;
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-4 py-3 text-left font-medium text-gray-600">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    {col.render ? col.render(row) : row[col.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      
      case 'properties':
        return renderTable(properties, [
          { header: 'Property ID', key: 'property_id' },
          { header: 'Name', key: 'name' },
          { header: 'Type', key: 'property_type' },
          { header: 'Zone', key: 'zone_name' },
          { header: 'City', key: 'city' },
          { header: 'Status', key: 'status', render: (r) => (
            <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(r.status)}`}>{r.status || 'active'}</span>
          )},
          { header: 'Created', key: 'created_at', render: (r) => formatDate(r.created_at) },
        ]);
      
      case 'work-orders':
      case 'pending-wo':
      case 'completed-wo':
        const woData = activeTab === 'pending-wo' ? pendingWorkOrders : 
                       activeTab === 'completed-wo' ? completedWorkOrders : workOrders;
        return renderTable(woData, [
          { header: 'WO ID', key: 'work_order_id' },
          { header: 'Title', key: 'title' },
          { header: 'Property', key: 'property_name' },
          { header: 'Priority', key: 'priority' },
          { header: 'Status', key: 'status', render: (r) => (
            <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(r.status)}`}>{r.status}</span>
          )},
          { header: 'Created', key: 'created_at', render: (r) => formatDate(r.created_at) },
        ]);
      
      case 'customers':
        return renderTable(customers, [
          { header: 'Name', key: 'name' },
          { header: 'Email', key: 'email' },
          { header: 'Phone', key: 'phone' },
          { header: 'Property', key: 'property_name' },
          { header: 'Created', key: 'created_at', render: (r) => formatDate(r.created_at) },
        ]);
      
      case 'vendors':
        return renderTable(vendors, [
          { header: 'Vendor ID', key: 'vendor_id' },
          { header: 'Name', key: 'vendor_name' },
          { header: 'Service', key: 'service_type' },
          { header: 'Zone', key: 'zone' },
          { header: 'Phone', key: 'phone' },
          { header: 'Email', key: 'email' },
        ]);
      
      case 'vendor-assignments':
        return renderTable(vendorAssignments, [
          { header: 'Property', key: 'property_name' },
          { header: 'Vendor', key: 'vendor_name' },
          { header: 'Service', key: 'service_type' },
          { header: 'Zone', key: 'zone_name' },
          { header: 'Assigned', key: 'assigned_at', render: (r) => formatDate(r.assigned_at) },
        ]);
      
      case 'employees':
        return renderTable(employees, [
          { header: 'Name', key: 'name' },
          { header: 'Email', key: 'email' },
          { header: 'Phone', key: 'phone' },
          { header: 'Role', key: 'role' },
          { header: 'Zones', key: 'zone_names', render: (r) => r.zone_names || 'No zones' },
        ]);
      
      case 'employee-zones':
        return renderTable(employeeZones.employees, [
          { header: 'Name', key: 'name' },
          { header: 'Email', key: 'email' },
          { header: 'Role', key: 'role' },
          { header: 'Assigned Zones', key: 'zone_names' },
        ]);
      
      case 'estimates':
      case 'archived':
        const estData = activeTab === 'archived' ? archivedEstimates : estimates;
        return renderTable(estData, [
          { header: 'Estimate ID', key: 'estimate_id' },
          { header: 'Customer', key: 'customer_name' },
          { header: 'Property', key: 'property_name' },
          { header: 'Total', key: 'total_amount', render: (r) => `₹${r.total_amount || 0}` },
          { header: 'Status', key: 'status', render: (r) => (
            <span className={`px-2 py-1 rounded text-xs ${getStatusBadge(r.status)}`}>{r.status}</span>
          )},
          { header: 'Created', key: 'created_at', render: (r) => formatDate(r.created_at) },
        ]);
      
      case 'amc-packages':
        return renderTable(amcPackages, [
          { header: 'Package Name', key: 'name' },
          { header: 'Description', key: 'description' },
          { header: 'Price', key: 'price', render: (r) => `₹${r.price || 0}` },
          { header: 'Duration', key: 'duration_months', render: (r) => `${r.duration_months || 12} months` },
          { header: 'Created', key: 'created_at', render: (r) => formatDate(r.created_at) },
        ]);
      
      case 'addons':
        return renderTable(addons, [
          { header: 'Add-on Name', key: 'name' },
          { header: 'Description', key: 'description' },
          { header: 'Price', key: 'price', render: (r) => `₹${r.price || 0}` },
          { header: 'Created', key: 'created_at', render: (r) => formatDate(r.created_at) },
        ]);
      
      default:
        return <p className="text-gray-500 text-center py-8">Select a tab to view data</p>;
    }
  };

  // Main View with FP Selected
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedFp(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to FP List
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{selectedFp.displayName}</h1>
                <p className="text-sm text-gray-500">Read-Only View</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1 rounded-full">
              <Eye className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-700 font-medium">View Mode</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border p-2 sticky top-24">
              <nav className="space-y-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                {tabs.find(t => t.id === activeTab)?.icon && 
                  (() => {
                    const Icon = tabs.find(t => t.id === activeTab).icon;
                    return <Icon className="w-5 h-5 text-indigo-600" />;
                  })()
                }
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPView;
