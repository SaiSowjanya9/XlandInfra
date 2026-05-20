import { useState, useEffect } from 'react';
import {
  Search,
  X,
  Check,
  AlertCircle,
  MapPin,
  Users,
  ChevronDown,
  Lock,
  Phone,
  Mail,
  Edit3,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';

const FPEmployeeZones = ({ user }) => {
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedZones, setSelectedZones] = useState([]);
  const [assignedZonesMap, setAssignedZonesMap] = useState({});
  const [loading, setLoading] = useState(true);

  const token = sessionStorage.getItem('pm_auth_token');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch employees
      const empResponse = await fetch('/api/fp/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const empResult = await empResponse.json();
      const allEmployees = empResult.success ? (Array.isArray(empResult.data) ? empResult.data : []) : [];
      
      // Fetch zones
      const zoneResponse = await fetch('/api/fp/zones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const zoneResult = await zoneResponse.json();
      const allZones = zoneResult.success ? (Array.isArray(zoneResult.data) ? zoneResult.data : []) : [];

      setEmployees(allEmployees);
      setZones(allZones);

      // Build a map of which zones are assigned to which employees
      const zoneMap = {};
      allEmployees.forEach(emp => {
        const empZones = emp.assignedZones || emp.assigned_zones;
        if (empZones === 'all') {
          allZones.forEach(zone => {
            zoneMap[zone.name] = { employeeId: emp.id, employeeName: emp.name };
          });
        } else if (Array.isArray(empZones)) {
          empZones.forEach(zoneName => {
            zoneMap[zoneName] = { employeeId: emp.id, employeeName: emp.name };
          });
        }
      });
      setAssignedZonesMap(zoneMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openAssignModal = (employee) => {
    setSelectedEmployee(employee);
    const empZones = employee.assignedZones || employee.assigned_zones;
    if (empZones === 'all') {
      setSelectedZones(zones.map(z => z.name));
    } else if (Array.isArray(empZones)) {
      setSelectedZones([...empZones]);
    } else {
      setSelectedZones([]);
    }
  };

  const closeModal = () => {
    setSelectedEmployee(null);
    setSelectedZones([]);
  };

  const isZoneLockedForEmployee = (zoneName, employeeId) => {
    const assigned = assignedZonesMap[zoneName];
    return assigned && assigned.employeeId !== employeeId;
  };

  const toggleZone = (zoneName) => {
    if (isZoneLockedForEmployee(zoneName, selectedEmployee?.id)) {
      return;
    }
    
    setSelectedZones(prev =>
      prev.includes(zoneName)
        ? prev.filter(z => z !== zoneName)
        : [...prev, zoneName]
    );
  };

  const getAvailableZonesForCurrentEmployee = () => {
    if (!selectedEmployee) return [];
    return zones.filter(zone => !isZoneLockedForEmployee(zone.name, selectedEmployee.id));
  };

  const handleSelectAllAvailable = () => {
    const availableZones = getAvailableZonesForCurrentEmployee();
    const availableZoneNames = availableZones.map(z => z.name);
    
    const allAvailableSelected = availableZoneNames.every(name => selectedZones.includes(name));
    
    if (allAvailableSelected) {
      setSelectedZones(prev => prev.filter(z => !availableZoneNames.includes(z)));
    } else {
      setSelectedZones(prev => {
        const newSelection = [...prev];
        availableZoneNames.forEach(name => {
          if (!newSelection.includes(name)) {
            newSelection.push(name);
          }
        });
        return newSelection;
      });
    }
  };

  const isAllAvailableSelected = () => {
    const availableZones = getAvailableZonesForCurrentEmployee();
    if (availableZones.length === 0) return false;
    return availableZones.every(zone => selectedZones.includes(zone.name));
  };

  const handleSaveZones = async () => {
    if (!selectedEmployee) return;

    try {
      const response = await fetch(`/api/fp/employees/${selectedEmployee.id}/zones`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zones: selectedZones })
      });

      const result = await response.json();
      if (result.success) {
        showToast(`Zones updated for ${selectedEmployee.name}`);
        closeModal();
        loadData();
      } else {
        showToast(result.message || 'Failed to update zones', 'error');
      }
    } catch (error) {
      console.error('Error updating zones:', error);
      showToast('Failed to update zones', 'error');
    }
  };

  const getEmployeeZoneCount = (employee) => {
    const empZones = employee.assignedZones || employee.assigned_zones;
    if (empZones === 'all') return zones.length;
    if (Array.isArray(empZones)) return empZones.length;
    return 0;
  };

  const getEmployeeZoneDisplay = (employee) => {
    const empZones = employee.assignedZones || employee.assigned_zones;
    if (empZones === 'all') return 'All Zones';
    if (Array.isArray(empZones) && empZones.length > 0) {
      if (empZones.length <= 2) {
        return empZones.join(', ');
      }
      return `${empZones.slice(0, 2).join(', ')} +${empZones.length - 2} more`;
    }
    return 'No zones assigned';
  };

  const filteredEmployees = employees.filter(e => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (e.name || '').toLowerCase().includes(q) ||
        (e.employeeId || e.employee_id || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    
    const empZones = e.assignedZones || e.assigned_zones;
    if (statusFilter === 'assigned') {
      return (empZones === 'all' || (Array.isArray(empZones) && empZones.length > 0));
    }
    if (statusFilter === 'unassigned') {
      return !empZones || (Array.isArray(empZones) && empZones.length === 0);
    }
    
    return true;
  });

  const unassignedCount = employees.filter(e => {
    const empZones = e.assignedZones || e.assigned_zones;
    return !empZones || (Array.isArray(empZones) && empZones.length === 0);
  }).length;

  const assignedCount = employees.filter(e => {
    const empZones = e.assignedZones || e.assigned_zones;
    return empZones === 'all' || (Array.isArray(empZones) && empZones.length > 0);
  }).length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Employee Zone Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Assign and manage zones for employees • {employees.length} employees
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Zones Assigned</p>
              <p className="text-2xl font-bold text-emerald-600">{assignedCount}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Assignment</p>
              <p className="text-2xl font-bold text-amber-600">{unassignedCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees by name, ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
            >
              <option value="all">All Employees</option>
              <option value="assigned">Zones Assigned</option>
              <option value="unassigned">Pending Assignment</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
          {(searchTerm || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
              className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Employee Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading employees...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No employees found</p>
          <p className="text-gray-400 text-sm mt-1">
            {employees.length === 0
              ? 'Add employees from the Add Employee page.'
              : 'Try adjusting your search or filters.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => {
            const zoneCount = getEmployeeZoneCount(employee);
            const hasZones = zoneCount > 0;
            const empZones = employee.assignedZones || employee.assigned_zones;
            
            return (
              <div
                key={employee.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
              >
                {/* Employee Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                      <span className="text-white font-bold text-lg">
                        {employee.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{employee.name}</h3>
                      <p className="text-xs font-mono text-gray-500">{employee.employeeId || employee.employee_id}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    hasZones
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {hasZones ? 'Active' : 'Pending'}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{employee.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{employee.countryCode || employee.country_code || '+91'} {employee.phone}</span>
                  </div>
                </div>

                {/* Zone Assignment Status */}
                <div className={`p-3 rounded-lg mb-4 ${
                  hasZones ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-4 h-4 ${hasZones ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <span className={`text-sm font-medium ${hasZones ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {hasZones ? `${zoneCount} Zone${zoneCount !== 1 ? 's' : ''}` : 'No Zones'}
                      </span>
                    </div>
                    {hasZones && empZones === 'all' && (
                      <span className="text-xs text-emerald-600">All</span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${hasZones ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {getEmployeeZoneDisplay(employee)}
                  </p>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => openAssignModal(employee)}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    hasZones
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  {hasZones ? 'Modify Zones' : 'Assign Zones'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Zone Assignment Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">
                      {selectedEmployee.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                    <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* All Zones Option */}
              {getAvailableZonesForCurrentEmployee().length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllAvailable}
                  className={`w-full mb-4 p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                    isAllAvailableSelected()
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isAllAvailableSelected() ? 'bg-indigo-500' : 'bg-gray-100'
                    }`}>
                      <Layers className={`w-5 h-5 ${isAllAvailableSelected() ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <div className="text-left">
                      <p className={`font-semibold ${
                        isAllAvailableSelected() ? 'text-indigo-700' : 'text-gray-800'
                      }`}>
                        All Zones
                      </p>
                      <p className="text-xs text-gray-500">
                        Select all {getAvailableZonesForCurrentEmployee().length} available zones
                      </p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isAllAvailableSelected()
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-gray-300'
                  }`}>
                    {isAllAvailableSelected() && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              )}

              {/* Zone Grid */}
              {zones.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No zones available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {zones.map((zone) => {
                    const isSelected = selectedZones.includes(zone.name);
                    const isLocked = isZoneLockedForEmployee(zone.name, selectedEmployee.id);
                    
                    return (
                      <div
                        key={zone.id}
                        onClick={() => !isLocked && toggleZone(zone.name)}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          isLocked
                            ? 'border-gray-100 bg-gray-50/50 cursor-not-allowed select-none'
                            : isSelected
                            ? 'border-emerald-500 bg-emerald-50 shadow-md cursor-pointer'
                            : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`font-medium text-sm ${
                            isLocked ? 'text-gray-300' : isSelected ? 'text-emerald-700' : 'text-gray-700'
                          }`}>
                            {zone.name}
                          </p>
                          {isLocked ? (
                            <Lock className="w-4 h-4 text-gray-300" />
                          ) : (
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Zones Summary */}
              {selectedZones.length > 0 && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-sm font-medium text-emerald-700 mb-2">
                    {selectedZones.length} zone{selectedZones.length !== 1 ? 's' : ''} selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedZones.map(zoneName => (
                      <span
                        key={zoneName}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md text-xs font-medium text-emerald-700 border border-emerald-200"
                      >
                        {zoneName}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleZone(zoneName);
                          }}
                          className="hover:bg-emerald-100 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Changes will be saved immediately
              </p>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveZones}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
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

export default FPEmployeeZones;
