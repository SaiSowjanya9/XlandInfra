import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Store, Plus, Search, Edit, Trash2, Download, RefreshCw, X, Save, AlertCircle, CheckCircle, Phone, Mail, MapPin, Eye, Lock } from 'lucide-react';

const SupervisorVendors = ({ user }) => {
  const location = useLocation();
  const [vendors, setVendors] = useState({ own: [], assigned: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({ companyName: '', contactPerson: '', email: '', phone: '', alternatePhone: '', address: '', city: '', state: '', zipCode: '', gstNumber: '', panNumber: '' });

  const viewType = location.pathname.includes('/assigned') ? 'assigned' : 'all';
  const token = sessionStorage.getItem('pm_auth_token');

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/vendors', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) setVendors(result.data);
    } catch (error) {
      console.error('Fetch vendors error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); if (viewType === 'assigned') setActiveTab('assigned'); }, [viewType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    try {
      const url = editingVendor ? `/api/supervisor/vendors/${editingVendor.id}` : '/api/supervisor/vendors';
      const response = await fetch(url, {
        method: editingVendor ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: `Vendor ${editingVendor ? 'updated' : 'created'} successfully!` });
        setShowModal(false);
        resetForm();
        fetchVendors();
      } else {
        setMessage({ type: 'error', text: result.message || 'Operation failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save vendor' });
    }
  };

  const handleDelete = async (vendor) => {
    if (!vendor.can_delete) { setMessage({ type: 'error', text: 'You do not have permission to delete this vendor' }); return; }
    if (!window.confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const response = await fetch(`/api/supervisor/vendors/${vendor.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      if (result.success) { setMessage({ type: 'success', text: 'Vendor deleted successfully!' }); fetchVendors(); }
      else setMessage({ type: 'error', text: result.message || 'Delete failed' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete vendor' });
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/supervisor/export/vendors', { headers: { 'Authorization': `Bearer ${token}` } });
      const result = await response.json();
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'supervisor_vendors_export.json'; a.click();
    } catch (error) {
      setMessage({ type: 'error', text: 'Export failed' });
    }
  };

  const openEditModal = (vendor) => {
    if (!vendor.can_modify) { setMessage({ type: 'error', text: 'You do not have permission to edit this vendor (View Only)' }); return; }
    setEditingVendor(vendor);
    setFormData({ companyName: vendor.company_name || '', contactPerson: vendor.contact_person || '', email: vendor.email || '', phone: vendor.phone || '', alternatePhone: vendor.alternate_phone || '', address: vendor.address || '', city: vendor.city || '', state: vendor.state || '', zipCode: vendor.zip_code || '', gstNumber: vendor.gst_number || '', panNumber: vendor.pan_number || '' });
    setShowModal(true);
  };

  const resetForm = () => { setEditingVendor(null); setFormData({ companyName: '', contactPerson: '', email: '', phone: '', alternatePhone: '', address: '', city: '', state: '', zipCode: '', gstNumber: '', panNumber: '' }); };

  const getVendorList = () => { switch (activeTab) { case 'own': return vendors.own || []; case 'assigned': return vendors.assigned || []; default: return vendors.all || []; } };
  const filteredVendors = getVendorList().filter(v => v.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) || v.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) || v.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1><p className="text-gray-500 mt-1">{activeTab === 'assigned' ? 'View assigned vendors' : 'Manage your vendors'}</p></div>
        <div className="flex gap-2">
          <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"><Plus className="w-4 h-4" /><span>Add Vendor</span></button>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-1">
        <div className="flex gap-1">
          <button onClick={() => setActiveTab('all')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-50'}`}>All Vendors ({vendors.all?.length || 0})</button>
          <button onClick={() => setActiveTab('own')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'own' ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-50'}`}>My Vendors ({vendors.own?.length || 0})</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search vendors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 text-amber-600 animate-spin" /></div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12"><Store className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No vendors found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Vendor</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Contact</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Location</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Access</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4"><p className="font-medium text-gray-900">{vendor.company_name}</p><p className="text-sm text-gray-500">{vendor.vendor_id}</p>{vendor.contact_person && <p className="text-sm text-gray-400">{vendor.contact_person}</p>}</td>
                    <td className="py-4 px-4"><span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${vendor.vendor_type === 'own' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{vendor.vendor_type === 'own' ? 'My Vendor' : 'Assigned'}</span></td>
                    <td className="py-4 px-4">{vendor.phone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {vendor.phone}</p>}{vendor.email && <p className="text-sm text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {vendor.email}</p>}</td>
                    <td className="py-4 px-4"><div className="flex items-start gap-1"><MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" /><span className="text-sm text-gray-600">{vendor.city ? `${vendor.city}, ${vendor.state || ''}` : '-'}</span></div></td>
                    <td className="py-4 px-4">{vendor.can_modify ? <span className="text-xs text-green-600 flex items-center gap-1"><Edit className="w-3 h-3" /> Edit</span> : <span className="text-xs text-gray-400 flex items-center gap-1"><Eye className="w-3 h-3" /> View Only</span>}</td>
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
              <h2 className="text-xl font-semibold text-gray-900">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label><input type="text" required value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label><input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label><input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label><input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Alternate Phone</label><input type="tel" value={formData.alternatePhone} onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" rows={2} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">State</label><input type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label><input type="text" value={formData.gstNumber} onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label><input type="text" value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"><Save className="w-4 h-4" /><span>{editingVendor ? 'Update' : 'Add'} Vendor</span></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorVendors;
