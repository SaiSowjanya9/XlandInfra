import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

const Residents = ({ admin }) => {
  const [residents, setResidents] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingResident, setEditingResident] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    unitId: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    leaseStartDate: '',
    leaseEndDate: ''
  });

  useEffect(() => {
    fetchResidents();
    fetchUnits();
  }, []);

  const fetchResidents = async () => {
    try {
      const response = await fetch('/api/admin/residents');
      const result = await response.json();
      if (result.success) {
        setResidents(result.data);
      }
    } catch (error) {
      console.error('Error fetching residents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await fetch('/api/admin/units');
      const result = await response.json();
      if (result.success) {
        setUnits(result.data);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const url = editingResident 
        ? `/api/admin/residents/${editingResident.id}`
        : '/api/admin/residents';
      
      const response = await fetch(url, {
        method: editingResident ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, adminId: admin.id })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(editingResident ? 'Resident updated successfully' : 'Resident created successfully');
        setShowModal(false);
        resetForm();
        fetchResidents();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to save resident');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this resident?')) return;

    try {
      const response = await fetch(`/api/admin/residents/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        setSuccess('Resident deleted successfully');
        fetchResidents();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError('Failed to delete resident');
    }
  };

  const openEditModal = (resident) => {
    setEditingResident(resident);
    setFormData({
      unitId: resident.unitId,
      email: resident.email,
      firstName: resident.firstName,
      lastName: resident.lastName,
      phone: resident.phone || '',
      leaseStartDate: resident.leaseStartDate?.split('T')[0] || '',
      leaseEndDate: resident.leaseEndDate?.split('T')[0] || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      unitId: '',
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      leaseStartDate: '',
      leaseEndDate: ''
    });
    setEditingResident(null);
    setError('');
  };

  const filteredResidents = residents.filter(r => 
    r.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.unitNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Residents</h1>
          <p className="text-gray-500">Manage resident accounts and information</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary mt-4 sm:mt-0 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add Resident</span>
        </button>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <Check className="w-5 h-5" />
          <span>{success}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search residents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Resident ID</th>
                <th className="table-header">Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Unit</th>
                <th className="table-header">Property</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">Loading...</td>
                </tr>
              ) : filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-gray-500">No residents found</td>
                </tr>
              ) : (
                filteredResidents.map((resident) => (
                  <tr key={resident.id} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-xs">{resident.residentId}</td>
                    <td className="table-cell font-medium">{resident.firstName} {resident.lastName}</td>
                    <td className="table-cell">{resident.email}</td>
                    <td className="table-cell">{resident.unitNumber}</td>
                    <td className="table-cell">{resident.propertyName}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        resident.isRegistered 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {resident.isRegistered ? 'Registered' : 'Pending'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditModal(resident)}
                          className="p-1 text-gray-500 hover:text-primary-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {admin.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(resident.id)}
                            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {editingResident ? 'Edit Resident' : 'Add New Resident'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                <select
                  value={formData.unitId}
                  onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select a unit</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.property_name} - Unit {unit.unit_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lease Start</label>
                  <input
                    type="date"
                    value={formData.leaseStartDate}
                    onChange={(e) => setFormData({ ...formData, leaseStartDate: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lease End</label>
                  <input
                    type="date"
                    value={formData.leaseEndDate}
                    onChange={(e) => setFormData({ ...formData, leaseEndDate: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingResident ? 'Update' : 'Create'} Resident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Residents;
