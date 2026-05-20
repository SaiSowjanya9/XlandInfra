import { useState, useEffect } from 'react';
import {
  Building2, Plus, Search, Edit, Trash2, Download, RefreshCw,
  MapPin, Phone, X, Save, AlertCircle, CheckCircle, User, Store, Eye, Lock
} from 'lucide-react';

const SupervisorProperties = ({ user }) => {
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editingProperty, setEditingProperty] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    name: '', propertyType: 'residential', address: '', city: '', state: '',
    zipCode: '', contactPerson: '', contactPhone: '', contactEmail: '', zoneId: ''
  });

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propRes, zoneRes, vendRes, empRes] = await Promise.all([
        fetch('/api/supervisor/properties', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/zones', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/vendors', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/supervisor/employees', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const [propData, zoneData, vendData, empData] = await Promise.all([
        propRes.json(), zoneRes.json(), vendRes.json(), empRes.json()
      ]);
      if (propData.success) setProperties(propData.data);
      if (zoneData.success) setZones(zoneData.data);
      if (vendData.success) setVendors(vendData.data.all || []);
      if (empData.success) setEmployees(empData.data);
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
      const url = editingProperty ? `/api/supervisor/properties/${editingProperty.id}` : '/api/supervisor/properties';
      const response = await fetch(url, {
        method: editingProperty ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Property ${editingProperty ? 'updated' : 'created'} successfully!` });
        setShowModal(false);
        resetForm();
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save property' });
    }
  };

  const handleDelete = async (property) => {
    if (!property.can_delete) {
      setMessage({ type: 'error', text: 'You do not have permission to delete this property' });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    try {
      const response = await fetch(`/api/supervisor/properties/${property.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Property deleted successfully!' });
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Delete failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete property' });
    }
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedProperty) return;
    try {
      const endpoint = assignType === 'vendor' 
        ? `/api/supervisor/properties/${selectedProperty.id}/assign-vendor`
        : `/api/supervisor/properties/${selectedProperty.id}/assign-employee`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(assignType === 'vendor' ? { vendorId: assigneeId } : { employeeId: assigneeId })
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `${assignType === 'vendor' ? 'Vendor' : 'Employee'} assigned successfully!` });
        setShowAssignModal(false);
        setSelectedProperty(null);
        fetchData();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign' });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/supervisor/export/properties', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'supervisor_properties_export.json';
      a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const openEditModal = (property) => {
    if (!property.can_modify) {
      setMessage({ type: 'error', text: 'You do not have permission to edit this property' });
      return;
    }
    setEditingProperty(property);
    setFormData({
      name: property.name || '', propertyType: property.property_type || 'residential',
      address: property.address || '', city: property.city || '', state: property.state || '',
      zipCode: property.zip_code || '', contactPerson: property.contact_person || '',
      contactPhone: property.contact_phone || '', contactEmail: property.contact_email || '',
      zoneId: property.zone_id || ''
    });
    setShowModal(true);
  };

  const openAssignModal = (property, type) => {
    const canAssign = type === 'vendor' ? property.can_assign_vendor : property.can_assign_employee;
    if (!canAssign) {
      setMessage({ type: 'error', text: `You do not have permission to assign ${type}s to this property` });
      return;
    }
    setSelectedProperty(property);
    setAssignType(type);
    setShowAssignModal(true);
  };

  const resetForm = () => {
    setEditingProperty(null);
    setFormData({ name: '', propertyType: 'residential', address: '', city: '', state: '', zipCode: '', contactPerson: '', contactPhone: '', contactEmail: '', zoneId: '' });
  };

  const filteredProperties = properties.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.property_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">Manage your assigned properties</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            <Plus className="w-4 h-4" /><span>Add Property</span>
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Search properties..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-amber-600 animate-spin" /></div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12"><Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No properties found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Property</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Access</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{property.name}</p>
                      <p className="text-sm text-gray-500">{property.property_id}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium capitalize">{property.property_type}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${property.access_type === 'own' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {property.access_type === 'own' ? 'Own' : 'Assigned'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div><p className="text-sm text-gray-600">{property.city}, {property.state}</p><p className="text-xs text-gray-400">{property.zone_name || 'No zone'}</p></div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {property.contact_person && <p className="text-sm text-gray-600">{property.contact_person}</p>}
                      {property.contact_phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {property.contact_phone}</p>}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <span className="p-2 text-gray-400" title="View Only"><Eye className="w-4 h-4" /></span>
                        {property.can_modify ? (
                          <button onClick={() => openEditModal(property)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg" title="Edit Property"><Edit className="w-4 h-4" /></button>
                        ) : <span className="p-2 text-gray-300"><Lock className="w-4 h-4" /></span>}
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">{editingProperty ? 'Edit Property' : 'Add New Property'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                  <select value={formData.propertyType} onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500">
                    <option value="residential">Residential</option><option value="commercial">Commercial</option><option value="industrial">Industrial</option><option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                  <select value={formData.zoneId} onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500">
                    <option value="">Select Zone</option>
                    {zones.map((zone) => (<option key={zone.id} value={zone.id}>{zone.name}</option>))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea required value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" rows={2} />
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">City *</label><input type="text" required value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">State *</label><input type="text" required value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label><input type="text" value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label><input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label><input type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label><input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"><Save className="w-4 h-4" /><span>{editingProperty ? 'Update' : 'Create'} Property</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Assign {assignType === 'vendor' ? 'Vendor' : 'Employee'}</h2>
              <button onClick={() => { setShowAssignModal(false); setSelectedProperty(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="px-6 text-sm text-gray-500">Property: {selectedProperty.name}</p>
            <div className="p-6">
              {(assignType === 'vendor' ? vendors : employees).length === 0 ? (
                <p className="text-gray-500 text-center py-4">No {assignType === 'vendor' ? 'vendors' : 'employees'} available</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(assignType === 'vendor' ? vendors : employees).map((item) => (
                    <button key={item.id} onClick={() => handleAssign(item.id)} className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-amber-50 hover:border-amber-300 transition-colors text-left">
                      <div className={`w-10 h-10 ${assignType === 'vendor' ? 'bg-purple-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                        {assignType === 'vendor' ? <Store className="w-5 h-5 text-purple-600" /> : <User className="w-5 h-5 text-green-600" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{assignType === 'vendor' ? item.company_name : `${item.first_name} ${item.last_name}`}</p>
                        <p className="text-sm text-gray-500">{assignType === 'vendor' ? (item.contact_person || item.email) : item.role}</p>
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

export default SupervisorProperties;
