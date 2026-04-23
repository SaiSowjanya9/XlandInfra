import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

const Units = ({ admin }) => {
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    propertyId: '',
    unitNumber: '',
    floor: '',
    bedrooms: 1,
    bathrooms: 1,
    squareFeet: ''
  });

  useEffect(() => {
    fetchUnits();
    fetchProperties();
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await fetch('/api/admin/units');
      const result = await response.json();
      if (result.success) setUnits(result.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/admin/properties');
      const result = await response.json();
      if (result.success) setProperties(result.data);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const url = editingUnit ? `/api/admin/units/${editingUnit.id}` : '/api/admin/units';
      const response = await fetch(url, {
        method: editingUnit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();

      if (result.success) {
        setSuccess(editingUnit ? 'Unit updated' : 'Unit created');
        setShowModal(false);
        resetForm();
        fetchUnits();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to save unit');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this unit?')) return;
    try {
      const response = await fetch(`/api/admin/units/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setSuccess('Unit deleted');
        fetchUnits();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError('Failed to delete');
    }
  };

  const openEditModal = (unit) => {
    setEditingUnit(unit);
    setFormData({
      propertyId: unit.property_id,
      unitNumber: unit.unit_number,
      floor: unit.floor || '',
      bedrooms: unit.bedrooms || 1,
      bathrooms: unit.bathrooms || 1,
      squareFeet: unit.square_feet || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ propertyId: '', unitNumber: '', floor: '', bedrooms: 1, bathrooms: 1, squareFeet: '' });
    setEditingUnit(null);
    setError('');
  };

  const filtered = units.filter(u => 
    u.unit_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.property_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Units</h1>
          <p className="text-gray-500">Manage units and apartments</p>
        </div>
        {admin.role === 'admin' && (
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary mt-4 sm:mt-0 flex items-center space-x-2">
            <Plus className="w-5 h-5" /><span>Add Unit</span>
          </button>
        )}
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700">
          <Check className="w-5 h-5" /><span>{success}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search units..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Unit</th>
                <th className="table-header">Property</th>
                <th className="table-header">Floor</th>
                <th className="table-header">Bed/Bath</th>
                <th className="table-header">Sq Ft</th>
                <th className="table-header">Resident</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-500">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-500">No units found</td></tr>
              ) : (
                filtered.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{unit.unit_number}</td>
                    <td className="table-cell">{unit.property_name}</td>
                    <td className="table-cell">{unit.floor || '-'}</td>
                    <td className="table-cell">{unit.bedrooms}/{unit.bathrooms}</td>
                    <td className="table-cell">{unit.square_feet || '-'}</td>
                    <td className="table-cell">{unit.resident_first_name ? `${unit.resident_first_name} ${unit.resident_last_name}` : '-'}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${unit.is_occupied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {unit.is_occupied ? 'Occupied' : 'Vacant'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => openEditModal(unit)} className="p-1 text-gray-500 hover:text-primary-600"><Edit2 className="w-4 h-4" /></button>
                        {admin.role === 'admin' && <button onClick={() => handleDelete(unit.id)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{editingUnit ? 'Edit Unit' : 'Add New Unit'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700"><AlertCircle className="w-5 h-5" /><span className="text-sm">{error}</span></div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property *</label>
                <select value={formData.propertyId} onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })} className="input-field" required disabled={editingUnit}>
                  <option value="">Select property</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number *</label>
                  <input type="text" value={formData.unitNumber} onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                  <input type="text" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                  <input type="number" min="0" value={formData.bedrooms} onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
                  <input type="number" min="0" step="0.5" value={formData.bathrooms} onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sq Feet</label>
                  <input type="number" min="0" value={formData.squareFeet} onChange={(e) => setFormData({ ...formData, squareFeet: e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingUnit ? 'Update' : 'Create'} Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Units;
