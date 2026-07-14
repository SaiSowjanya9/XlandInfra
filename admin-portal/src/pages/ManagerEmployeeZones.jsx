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

// Helper function to format role display name
const formatRoleName = (role) => {
  const roleMap = {
    'coordinator': 'Coordinator',
    'supervisor': 'Supervisor',
    'executive': 'Executive',
    'manager': 'Manager',
    'employee': 'Employee',
    'field_staff': 'Field Staff',
    'technician': 'Technician'
  };
  return roleMap[role?.toLowerCase()] || role?.charAt(0).toUpperCase() + role?.slice(1) || 'Employee';
};

// Helper function to get role badge colors
const getRoleBadgeStyle = (role) => {
  const roleStyles = {
    'coordinator': 'bg-purple-100 text-purple-700 border-purple-200',
    'supervisor': 'bg-blue-100 text-blue-700 border-blue-200',
    'executive': 'bg-orange-100 text-orange-700 border-orange-200',
    'manager': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'field_staff': 'bg-teal-100 text-teal-700 border-teal-200',
    'technician': 'bg-cyan-100 text-cyan-700 border-cyan-200'
  };
  return roleStyles[role?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const ManagerEmployeeZones = ({ user }) => {
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedZones, setSelectedZones] = useState([]);
  const [assignedZonesMap, setAssignedZonesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewZonesEmployee, setViewZonesEmployee] = useState(null);

  const token = getAuthToken();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch employees
      const empResponse = await fetch('/api/manager/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!empResponse.ok) {
        console.error('Employee fetch failed:', empResponse.status);
        setEmployees([]);
        setZones([]);
        setLoading(false);
        return;
      }
      const empResult = await empResponse.json();
      const allEmployees = empResult.success ? (Array.isArray(empResult.data) ? empResult.data : []) : [];
      
      // Fetch zones
      const zoneResponse = await fetch('/api/manager/zones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!zoneResponse.ok) {
        console.error('Zones fetch failed:', zoneResponse.status);
        setEmployees(allEmployees);
        setZones([]);
        setLoading(false);
        return;
      }
      const zoneResult = await zoneResponse.json();
      const allZones = zoneResult.success ? (Array.isArray(zoneResult.data) ? zoneResult.data : []) : [];

      setEmployees(allEmployees);
      setZones(allZones);

      // Build a map of which zones are assigned to which employees (by role)
      // NOTE: "All Zones" employees do NOT block specific zone assignments
      const zoneMap = {};
      allEmployees.forEach(emp => {
        let empZones = emp.assignedZones || emp.assigned_zones;
        
        // If zone_names is a comma-separated string, parse it
        if (!empZones && emp.zone_names && emp.zone_names !== 'No zones assigned') {
          empZones = emp.zone_names.split(',').map(z => z.trim());
        }
        
        const empRole = emp.role || emp.employee_type || 'employee';
        const isAllZones = empZones === 'all';
        
        const addZoneAssignment = (zoneName) => {
          if (!zoneName) return;
          if (!zoneMap[zoneName]) {
            zoneMap[zoneName] = {};
          }
          // Only add specific zone assignments (not "All Zones") to block others
          if (!isAllZones) {
            zoneMap[zoneName][empRole] = { employeeId: emp.id, employeeName: emp.name, role: empRole };
          }
        };
        
        // Only track specific zone assignments, skip "All Zones"
        if (Array.isArray(empZones)) {
          empZones.forEach(zoneName => addZoneAssignment(zoneName));
        }
        // "All Zones" employees don't block zones
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

  const openAssignModal = async (employee) => {
    // Refresh zones to get any newly created zones
    try {
      const zoneResponse = await fetch('/api/manager/zones', { headers: { 'Authorization': `Bearer ${token}` } });
      const zoneResult = await zoneResponse.json();
      if (zoneResult.success) {
        const freshZones = Array.isArray(zoneResult.data) ? zoneResult.data : [];
        setZones(freshZones);
        
        setSelectedEmployee(employee);
        const empZones = employee.assignedZones || employee.assigned_zones;
        const validZoneNames = freshZones.map(z => z.name);
        const isAll = empZones === 'all' || (Array.isArray(empZones) && empZones.length === 1 && empZones[0] === 'all');
        if (isAll) {
          setSelectedZones(validZoneNames);
        } else if (Array.isArray(empZones)) {
          // Only include zones that still exist in the system
          const filteredZones = empZones.filter(z => validZoneNames.includes(z));
          setSelectedZones(filteredZones);
        } else {
          setSelectedZones([]);
        }
      }
    } catch (e) {
      setSelectedEmployee(employee);
      const empZones = employee.assignedZones || employee.assigned_zones;
      const validZoneNames = zones.map(z => z.name);
      const isAll = empZones === 'all' || (Array.isArray(empZones) && empZones.length === 1 && empZones[0] === 'all');
      if (isAll) {
        setSelectedZones(validZoneNames);
      } else if (Array.isArray(empZones)) {
        // Only include zones that still exist in the system
        const filteredZones = empZones.filter(z => validZoneNames.includes(z));
        setSelectedZones(filteredZones);
      } else {
        setSelectedZones([]);
      }
    }
  };

  const closeModal = () => {
    setSelectedEmployee(null);
    setSelectedZones([]);
  };

  const isZoneLockedForEmployee = (zoneName, employeeId, employeeRole) => {
    const zoneAssignments = assignedZonesMap[zoneName];
    if (!zoneAssignments) return false;
    
    const sameRoleAssignment = zoneAssignments[employeeRole];
    return sameRoleAssignment && sameRoleAssignment.employeeId !== employeeId;
  };

  const getZoneAssignedTo = (zoneName, employeeRole) => {
    const zoneAssignments = assignedZonesMap[zoneName];
    if (!zoneAssignments) return null;
    return zoneAssignments[employeeRole];
  };

  const toggleZone = (zoneName) => {
    const empRole = selectedEmployee?.role || selectedEmployee?.employee_type || 'employee';
    if (isZoneLockedForEmployee(zoneName, selectedEmployee?.id, empRole)) {
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
    const empRole = selectedEmployee.role || selectedEmployee.employee_type || 'employee';
    return zones.filter(zone => !isZoneLockedForEmployee(zone.name, selectedEmployee.id, empRole));
  };

  // "All Zones" should select ALL zones (including locked ones) - All Zones can coexist
  const handleSelectAllAvailable = () => {
    const allZoneNames = zones.map(z => z.name);
    const allSelected = allZoneNames.every(name => selectedZones.includes(name));
    
    if (allSelected) {
      // Deselect all
      setSelectedZones([]);
    } else {
      // Select ALL zones (not just available)
      setSelectedZones(allZoneNames);
    }
  };

  const isAllAvailableSelected = () => {
    if (zones.length === 0) return false;
    // Check if ALL zones are selected (not just available)
    return zones.every(zone => selectedZones.includes(zone.name));
  };

  const handleSaveZones = async () => {
    if (!selectedEmployee) return;

    try {
      // If ALL zones are selected, save as 'all' so new zones are auto-included
      const zonesToSave = isAllAvailableSelected() ? 'all' : selectedZones;
      
      const response = await fetch(`/api/manager/employees/${selectedEmployee.id}/zones`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zones: zonesToSave })
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

  const isAllZones = (empZones) => {
    return empZones === 'all' || (Array.isArray(empZones) && empZones.length === 1 && empZones[0] === 'all');
  };

  const getEmployeeZoneCount = (employee) => {
    const empZones = employee.assignedZones || employee.assigned_zones;
    if (isAllZones(empZones)) return zones.length;
    if (Array.isArray(empZones)) return empZones.length;
    return 0;
  };

  const getEmployeeZoneDisplay = (employee) => {
    const empZones = employee.assignedZones || employee.assigned_zones;
    if (isAllZones(empZones)) {
      if (zones.length <= 2) {
        return zones.map(z => z.name).join(', ');
      }
      return `${zones.slice(0, 2).map(z => z.name).join(', ')} +${zones.length - 2} more`;
    }
    if (Array.isArray(empZones) && empZones.length > 0) {
      const validZones = empZones.filter(z => z !== 'all');
      if (validZones.length <= 2) {
        return validZones.join(', ');
      }
      return `${validZones.slice(0, 2).join(', ')} +${validZones.length - 2} more`;
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
      return (isAllZones(empZones) || (Array.isArray(empZones) && empZones.length > 0));
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
    return isAllZones(empZones) || (Array.isArray(empZones) && empZones.length > 0);
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
              <p className="text-2xl font-bold text-gray-700">{unassignedCount}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <XCircle className="w-6 h-6 text-gray-500" />
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
              onChange={(e) => setSearchTerm(e.target.value.trim())}
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
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-mono text-gray-500 mb-1">{employee.employee_id || employee.user_id || employee.employeeId || `ID: ${employee.id}`}</p>
                    <h3 className="font-semibold text-gray-900">{employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim()}</h3>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    hasZones
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {hasZones ? 'Active' : 'Pending'}
                  </span>
                </div>

                {/* Role Badge */}
                <div className="mb-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getRoleBadgeStyle(employee.role || employee.employee_type)}`}>
                    {formatRoleName(employee.role || employee.employee_type)}
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
                    <span>{employee.phone?.startsWith('+') ? employee.phone : `${employee.countryCode || employee.country_code || '+91'} ${employee.phone || 'null'}`}</span>
                  </div>
                </div>

                {/* Zone Assignment Status - Clickable to view all zones */}
                <div 
                  onClick={() => hasZones && (isAllZones(empZones) || zoneCount > 2) && setViewZonesEmployee(employee)}
                  className={`p-3 rounded-lg mb-4 ${
                    hasZones ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-200'
                  } ${hasZones && (isAllZones(empZones) || zoneCount > 2) ? 'cursor-pointer hover:bg-emerald-100 transition-colors' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-4 h-4 ${hasZones ? 'text-emerald-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${hasZones ? 'text-emerald-700' : 'text-gray-600'}`}>
                        {!hasZones ? 'No Zones' : isAllZones(empZones) ? 'All Zones' : `${zoneCount} Zone${zoneCount !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    {hasZones && (isAllZones(empZones) || zoneCount > 2) && (
                      <span className="text-xs text-emerald-500 underline">View all</span>
                    )}
                  </div>
                  {hasZones && !isAllZones(empZones) && (
                    <p className={`text-xs mt-1 text-emerald-600`}>
                      {getEmployeeZoneDisplay(employee)}
                    </p>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => openAssignModal(employee)}
                  className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                    hasZones
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200'
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
                <div>
                  <p className="text-xs font-mono text-gray-500 mb-1">{selectedEmployee.employee_id || selectedEmployee.user_id || selectedEmployee.employeeId || `ID: ${selectedEmployee.id}`}</p>
                  <h2 className="text-xl font-bold text-gray-900">{selectedEmployee.name || `${selectedEmployee.first_name || ''} ${selectedEmployee.last_name || ''}`.trim()}</h2>
                  <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* All Zones Option */}
              {zones.length > 0 && (
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
                        Select all {zones.length} zones
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
                    const empRole = selectedEmployee.role || selectedEmployee.employee_type || 'employee';
                    const isSelected = selectedZones.includes(zone.name);
                    const allZonesSelected = isAllAvailableSelected();
                    // When "All Zones" is selected, zones are NOT locked (All Zones can coexist)
                    const isLocked = !allZonesSelected && isZoneLockedForEmployee(zone.name, selectedEmployee.id, empRole);
                    const assignedTo = getZoneAssignedTo(zone.name, empRole);
                    
                    return (
                      <div
                        key={zone.id}
                        onClick={() => !isLocked && toggleZone(zone.name)}
                        title={isLocked ? `Assigned to ${assignedTo?.employeeName || 'another ' + empRole}` : ''}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          isLocked
                            ? 'border-red-100 bg-red-50/30 cursor-not-allowed select-none opacity-60'
                            : isSelected
                            ? 'border-emerald-500 bg-emerald-50 shadow-md cursor-pointer'
                            : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium text-sm ${
                              isLocked ? 'text-gray-400' : isSelected ? 'text-emerald-700' : 'text-gray-700'
                            }`}>
                              {zone.name}
                            </p>
                            {isLocked && assignedTo && (
                              <p className="text-xs text-red-400 mt-0.5">Assigned to {assignedTo.employeeName}</p>
                            )}
                          </div>
                          {isLocked ? (
                            <Lock className="w-4 h-4 text-red-300" />
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

      {/* View All Zones Popup */}
      {viewZonesEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewZonesEmployee(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Assigned Zones</h3>
                  <p className="text-sm text-gray-500">{viewZonesEmployee.name || `${viewZonesEmployee.first_name || ''} ${viewZonesEmployee.last_name || ''}`.trim()}</p>
                </div>
                <button onClick={() => setViewZonesEmployee(null)} className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 max-h-80 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const empZones = viewZonesEmployee.assignedZones || viewZonesEmployee.assigned_zones || [];
                  let zoneList = [];
                  // Check for "all" zones - either string 'all' or array ['all']
                  if (isAllZones(empZones)) {
                    zoneList = zones.map(z => z.name);
                  } else if (Array.isArray(empZones)) {
                    // Filter out 'all' and map to names
                    zoneList = empZones
                      .filter(z => z !== 'all')
                      .map(z => typeof z === 'object' ? (z.name || z.zone_name || JSON.stringify(z)) : z);
                  } else if (typeof empZones === 'string' && empZones.includes(',')) {
                    zoneList = empZones.split(',').map(s => s.trim());
                  }
                  return zoneList.length > 0 ? zoneList.map((zoneName, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200">
                      <MapPin className="w-3.5 h-3.5" />
                      {zoneName}
                    </span>
                  )) : <p className="text-gray-500 text-sm">No zones assigned</p>;
                })()}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setViewZonesEmployee(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerEmployeeZones;
