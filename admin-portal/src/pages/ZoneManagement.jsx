import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  RotateCcw,
  Users,
  Search,
  ChevronDown,
} from 'lucide-react';
import { getZones, createZone, updateZone, deactivateZone, reactivateZone, deleteZone } from '../utils/zoneStore';
import { getEmployees, updateEmployeeZones } from '../utils/employeeStore';

const ZoneManagement = () => {
  const [zones, setZones] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewEmployeesZone, setViewEmployeesZone] = useState(null);
  const [showAddEmployeeToZone, setShowAddEmployeeToZone] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = () => {
    setZones(getZones(statusFilter));
    setEmployees(getEmployees('active'));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCreateZone = () => {
    if (!newZoneName.trim()) {
      showToast('Please enter a zone name', 'error');
      return;
    }
    
    const result = createZone(newZoneName.trim());
    if (result.success) {
      showToast('Zone created successfully');
      setNewZoneName('');
      setShowAddModal(false);
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleUpdateZone = () => {
    if (!newZoneName.trim()) {
      showToast('Please enter a zone name', 'error');
      return;
    }
    
    const result = updateZone(editingZone.id, { name: newZoneName.trim() });
    if (result.success) {
      showToast('Zone updated successfully');
      setNewZoneName('');
      setEditingZone(null);
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleDeactivateZone = (zone) => {
    const result = deactivateZone(zone.id);
    if (result.success) {
      showToast('Zone deactivated successfully');
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleReactivateZone = (zone) => {
    const result = reactivateZone(zone.id);
    if (result.success) {
      showToast('Zone reactivated successfully');
      loadData();
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleDeleteZone = (zone) => {
    deleteZone(zone.id);
    showToast('Zone deleted permanently');
    setDeleteConfirm(null);
    loadData();
  };

  const getEmployeesInZone = (zoneName) => {
    return employees.filter(e => 
      e.assignedZones === 'all' || 
      (Array.isArray(e.assignedZones) && e.assignedZones.includes(zoneName))
    );
  };

  const getEmployeesNotInZone = (zoneName) => {
    return employees.filter(e => 
      e.assignedZones !== 'all' && 
      (!Array.isArray(e.assignedZones) || !e.assignedZones.includes(zoneName))
    );
  };

  const handleAddEmployeeToZone = (employee, zoneName) => {
    const currentZones = Array.isArray(employee.assignedZones) ? employee.assignedZones : [];
    const newZones = [...currentZones, zoneName];
    updateEmployeeZones(employee.id, newZones);
    showToast(`${employee.name} added to ${zoneName}`);
    loadData();
  };

  const handleRemoveEmployeeFromZone = (employee, zoneName) => {
    if (employee.assignedZones === 'all') {
      showToast('Cannot remove employee assigned to all zones. Edit their assignment first.', 'error');
      return;
    }
    const currentZones = Array.isArray(employee.assignedZones) ? employee.assignedZones : [];
    const newZones = currentZones.filter(z => z !== zoneName);
    updateEmployeeZones(employee.id, newZones);
    showToast(`${employee.name} removed from ${zoneName}`);
    loadData();
  };

  const filteredZones = zones.filter(z =>
    z.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border animate-slide-in ${
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
          <h1 className="text-2xl font-semibold text-gray-900">Zone Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage operational zones and view assigned employees
          </p>
        </div>
        <button
          onClick={() => { setShowAddModal(true); setNewZoneName(''); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Zone
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search zones..."
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
              <option value="active">Active Zones</option>
              <option value="inactive">Inactive Zones</option>
              <option value="all">All Zones</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Zones Grid */}
      {filteredZones.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No zones found</p>
          <p className="text-gray-400 text-sm mt-1">
            {zones.length === 0 ? 'Click "Add Zone" to create your first zone.' : 'Try adjusting your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredZones.map((zone) => {
            const zoneEmployees = getEmployeesInZone(zone.name);
            return (
              <div
                key={zone.id}
                className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
                  zone.status === 'inactive' ? 'border-gray-200 opacity-60' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      zone.status === 'active' ? 'bg-indigo-100' : 'bg-gray-100'
                    }`}>
                      <MapPin className={`w-5 h-5 ${zone.status === 'active' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{zone.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        zone.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {zone.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Created:</span>
                    <span className="text-gray-900">{formatDate(zone.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Employees:</span>
                    <button
                      onClick={() => setViewEmployeesZone(zone)}
                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {zoneEmployees.length} assigned
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => { setEditingZone(zone); setNewZoneName(zone.name); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  {zone.status === 'active' ? (
                    <button
                      onClick={() => handleDeactivateZone(zone)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactivateZone(zone)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reactivate
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(zone)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Zone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Add New Zone</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Zone Name</label>
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Enter zone name..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateZone}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Create Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Zone Modal */}
      {editingZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingZone(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit Zone</h2>
              <button onClick={() => setEditingZone(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Zone Name</label>
              <input
                type="text"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Enter zone name..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingZone(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateZone}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Zone?</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to permanently delete "{deleteConfirm.name}"? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteZone(deleteConfirm)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Employees Modal */}
      {viewEmployeesZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setViewEmployeesZone(null); setShowAddEmployeeToZone(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Employees in {viewEmployeesZone.name}</h2>
                <p className="text-sm text-gray-500">{getEmployeesInZone(viewEmployeesZone.name).length} employees assigned</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAddEmployeeToZone(!showAddEmployeeToZone)} 
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Employee
                </button>
                <button onClick={() => { setViewEmployeesZone(null); setShowAddEmployeeToZone(false); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Add Employee Section */}
            {showAddEmployeeToZone && (
              <div className="px-4 py-3 border-b border-gray-200 bg-indigo-50">
                <p className="text-sm font-medium text-gray-700 mb-2">Select employee to add to {viewEmployeesZone.name}:</p>
                {getEmployeesNotInZone(viewEmployeesZone.name).length === 0 ? (
                  <p className="text-sm text-gray-500">All employees are already assigned to this zone.</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {getEmployeesNotInZone(viewEmployeesZone.name).map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => handleAddEmployeeToZone(emp, viewEmployeesZone.name)}
                        className="flex items-center gap-2 w-full p-2 bg-white rounded-lg hover:bg-indigo-100 transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-semibold text-xs">
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                          <p className="text-xs text-gray-500">{emp.employeeId}</p>
                        </div>
                        <Plus className="w-4 h-4 text-indigo-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {getEmployeesInZone(viewEmployeesZone.name).length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No employees assigned to this zone</p>
                  <p className="text-gray-400 text-xs mt-1">Click "Add Employee" above to assign employees</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getEmployeesInZone(viewEmployeesZone.name).map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.employeeId}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        emp.assignedZones === 'all' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {emp.assignedZones === 'all' ? 'All Zones' : 'Selected'}
                      </span>
                      {emp.assignedZones !== 'all' && (
                        <button
                          onClick={() => handleRemoveEmployeeFromZone(emp, viewEmployeesZone.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove from zone"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

export default ZoneManagement;
