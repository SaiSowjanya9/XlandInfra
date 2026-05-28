import { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit, Trash2, Download, RefreshCw, X, Save, AlertCircle, CheckCircle, Phone, Mail, Eye, MapPin } from 'lucide-react';

const SupervisorEmployees = ({ user }) => {
  const [employees, setEmployees] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'sup_executive', assignedZones: [] });

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, zoneRes] = await Promise.all([
        fetch('/api/supervisor/employees', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/zones', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [empData, zoneData] = await Promise.all([empRes.json(), zoneRes.json()]);
      if (empData.success) setEmployees(empData.data);
      if (zoneData.success) setZones(zoneData.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const url = editingEmployee ? `/api/supervisor/employees/${editingEmployee.id}` : '/api/supervisor/employees';
      const response = await fetch(url, {
        method: editingEmployee ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Employee ${editingEmployee ? 'updated' : 'created'} successfully!` });
        setShowModal(false);
        resetForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save employee' });
    }
  };

  const handleDelete = async (employee) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      const response = await fetch(`/api/supervisor/employees/${employee.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) { setMessage({ type: 'success', text: 'Employee deleted successfully!' }); fetchData(); }
      else setMessage({ type: 'error', text: result.message || 'Delete failed' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete employee' });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/supervisor/export/employees', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'supervisor_employees_export.json'; a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const viewEmployeeDetails = async (employee) => {
    try {
      const response = await fetch(`/api/supervisor/employees/${employee.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) { setSelectedEmployee(result.data); setShowDetailModal(true); }
    } catch (error) {
      console.error('Fetch employee details error:', error);
    }
  };

  const openEditModal = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      firstName: employee.first_name || '', lastName: employee.last_name || '',
      email: employee.email || '', phone: employee.phone || '',
      role: employee.role || 'sup_executive',
      assignedZones: employee.zone_ids ? employee.zone_ids.split(',').map(id => parseInt(id)) : []
    });
    setShowModal(true);
  };

  const resetForm = () => { setEditingEmployee(null); setFormData({ firstName: '', lastName: '', email: '', phone: '', role: 'sup_executive', assignedZones: [] }); };

  const toggleZone = (zoneId) => {
    setFormData(prev => ({
      ...prev,
      assignedZones: prev.assignedZones.includes(zoneId)
        ? prev.assignedZones.filter(z => z !== zoneId)
        : [...prev.assignedZones, zoneId]
    }));
  };

  const filteredEmployees = employees.filter(e =>
    e.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employee_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleOptions = [
    { value: 'sup_executive', label: 'Executive' },
    { value: 'sup_helper', label: 'Helper' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Employee Management</h1><p className="text-gray-500 mt-1">View your team members</p></div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-amber-600 animate-spin" /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12"><Users className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No employees found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Employee</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zones</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{employee.first_name} {employee.last_name}</p>
                      <p className="text-sm text-gray-500">{employee.employee_code}</p>
                    </td>
                    <td className="py-4 px-4"><span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium capitalize">{employee.role?.replace('sup_', '')}</span></td>
                    <td className="py-4 px-4">{employee.phone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {employee.phone}</p>}{employee.email && <p className="text-sm text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {employee.email}</p>}</td>
                    <td className="py-4 px-4"><div className="flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-600">{employee.zone_names || 'No zones'}</span></div></td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end">
                        {/* View Details - Only action available for Supervisor */}
                        <button onClick={() => viewEmployeeDetails(employee)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg" title="View Details"><Eye className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label><input type="text" required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input type="tel" required value={formData.phone} onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: value });
                  }}
                  maxLength={10}
                  placeholder="9876543210" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label><select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500">{roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Assigned Zones</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {zones.length === 0 ? <p className="text-gray-400 text-sm col-span-2">No zones available</p> : zones.map(zone => (
                    <label key={zone.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.assignedZones.includes(zone.id)} onChange={() => toggleZone(zone.id)} className="rounded border-gray-300 text-amber-600 focus:ring-amber-500" /><span className="text-sm text-gray-600">{zone.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"><Save className="w-4 h-4" /><span>{editingEmployee ? 'Update' : 'Add'} Employee</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Employee Details</h2>
              <button onClick={() => { setShowDetailModal(false); setSelectedEmployee(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center"><Users className="w-8 h-8 text-amber-600" /></div>
                <div><p className="text-xl font-semibold text-gray-900">{selectedEmployee.first_name} {selectedEmployee.last_name}</p><p className="text-sm text-gray-500">{selectedEmployee.employee_code}</p><span className="inline-block mt-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium capitalize">{selectedEmployee.role?.replace('sup_', '')}</span></div>
              </div>
              <div className="space-y-3 pt-4 border-t border-gray-100">
                {selectedEmployee.email && <div className="flex items-center gap-3"><Mail className="w-5 h-5 text-gray-400" /><span className="text-gray-600">{selectedEmployee.email}</span></div>}
                {selectedEmployee.phone && <div className="flex items-center gap-3"><Phone className="w-5 h-5 text-gray-400" /><span className="text-gray-600">{selectedEmployee.phone}</span></div>}
                <div className="flex items-start gap-3"><MapPin className="w-5 h-5 text-gray-400 mt-0.5" /><div><p className="text-sm font-medium text-gray-700">Assigned Zones</p><p className="text-gray-600">{selectedEmployee.zone_names || 'No zones assigned'}</p></div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorEmployees;
