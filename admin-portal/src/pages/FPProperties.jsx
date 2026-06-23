import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Home,
  Building,
  Lock,
  Grid3X3,
  Landmark,
  LayoutGrid,
  Users,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  UserPlus,
  Truck,
  Trash2,
  User,
  Store,
  Edit2,
  Save,
  ExternalLink,
  FileText,
  MapPin,
  Calendar,
  Download,
  Phone,
  Mail
} from 'lucide-react';
import * as XLSX from 'xlsx';

const FPProperties = ({ user }) => {
  // Check if user is FP Manager (restricted access - view only)
  const isFPManager = user?.role === 'manager';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL-synced state for filters and navigation
  const searchTerm = searchParams.get('search') || '';
  const activeTab = searchParams.get('type') || 'all';
  const selectedZone = searchParams.get('zone') || '';
  const statusFilter = searchParams.get('status') || 'active';
  const selectedCategory = searchParams.get('category') || null;
  const viewPropertyId = searchParams.get('view');
  const editPropertyId = searchParams.get('edit');
  
  // Helper to update URL params
  const updateUrlParam = useCallback((key, value) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === '' || value === null || value === undefined || value === 'all' || value === 'active') {
        // Don't store default values in URL
        if (key === 'status' && value === 'active') {
          newParams.delete(key);
        } else if (key === 'type' && value === 'all') {
          newParams.delete(key);
        } else if (!value) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      } else {
        newParams.set(key, value);
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);
  
  // Setters that update URL
  const setSearchTerm = (value) => updateUrlParam('search', value);
  const setActiveTab = (value) => updateUrlParam('type', value);
  const setSelectedZone = (value) => updateUrlParam('zone', value);
  const setStatusFilter = (value) => updateUrlParam('status', value);
  const setSelectedCategory = (value) => updateUrlParam('category', value);
  
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDivision, setSelectedDivision] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('vendor');
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editFormData, setEditFormData] = useState({});
  
  // Derived state for modals based on URL
  const showDetailsModal = !!viewPropertyId;
  const showEditModal = !!editPropertyId;

  const token = sessionStorage.getItem('pm_auth_token');

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/fp/properties', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setProperties(result.data);
      }
    } catch (error) {
      console.error('Fetch properties error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await fetch('/api/fp/zones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setZones(result.data);
      }
    } catch (error) {
      console.error('Fetch zones error:', error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/fp/vendors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVendors(result.data?.all || result.data || []);
      }
    } catch (error) {
      console.error('Fetch vendors error:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/fp/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setEmployees(result.data || []);
      }
    } catch (error) {
      console.error('Fetch employees error:', error);
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchZones();
    fetchVendors();
    fetchEmployees();
  }, []);
  
  // Sync selectedProperty from URL params
  useEffect(() => {
    if (viewPropertyId && properties.length > 0) {
      const property = properties.find(p => String(p.id) === viewPropertyId);
      if (property) setSelectedProperty(property);
    } else if (editPropertyId && properties.length > 0) {
      const property = properties.find(p => String(p.id) === editPropertyId);
      if (property) {
        setSelectedProperty(property);
        // Parse association_contacts JSON if available
        let contacts = [];
        try {
          if (property.association_contacts) {
            contacts = typeof property.association_contacts === 'string' 
              ? JSON.parse(property.association_contacts) 
              : property.association_contacts;
          }
        } catch (e) { contacts = []; }
        
        // Fallback to single contact if no association_contacts
        if (contacts.length === 0 && (property.contact_person || property.contact_email || property.contact_phone)) {
          contacts = [{
            name: property.contact_person || '',
            email: property.contact_email || '',
            phone: property.contact_phone?.replace(/^\+91\s?/, '') || '',
            countryCode: '+91'
          }];
        }
        if (contacts.length === 0) {
          contacts = [{ name: '', email: '', phone: '', countryCode: '+91' }];
        }
        
        // Parse block_names, units_per_block and block_unit_types JSON
        let blockNames = {};
        let unitsPerBlock = {};
        let blockUnitTypes = {};
        try {
          if (property.block_names) {
            blockNames = typeof property.block_names === 'string' 
              ? JSON.parse(property.block_names) : property.block_names;
          }
          if (property.units_per_block) {
            unitsPerBlock = typeof property.units_per_block === 'string' 
              ? JSON.parse(property.units_per_block) : property.units_per_block;
          }
          if (property.block_unit_types) {
            blockUnitTypes = typeof property.block_unit_types === 'string' 
              ? JSON.parse(property.block_unit_types) : property.block_unit_types;
          }
        } catch (e) {}
        
        // Also set edit form data with all fields
        setEditFormData({
          id: property.id,
          name: property.name || '',
          propertyType: property.property_type || property.entry_type || 'residential',
          entryType: property.entry_type || '',
          address: property.address || '',
          city: property.city || '',
          state: property.state || '',
          zipCode: property.zip_code || property.postal_code || '',
          zone: property.zone_name || property.zone_id || property.zone || '',
          division: property.division_name || property.division || property.division_id || '',
          area: property.area || property.area_name || '',
          isActive: property.is_active !== false && property.status !== 'inactive',
          sourceTable: property.source_table || 'properties',
          // Contact information
          contacts: contacts,
          contactPerson: property.contact_person || '',
          contactPhone: property.contact_phone || '',
          contactEmail: property.contact_email || '',
          // Block Details (for GC/APT)
          numberOfBlocks: property.number_of_blocks || 1,
          blockNames: blockNames,
          unitsPerBlock: unitsPerBlock,
          blockUnitTypes: blockUnitTypes,
          // APT specific
          blockInfo: property.block_info || '',
          blockNA: property.block_na || false,
          numberOfUnits: property.number_of_units || '',
          // Villa/Plot/Flat specific
          villaPlotNumber: property.villa_plot_number || '',
          flatBlockInfo: property.flat_block_info || '',
          flatBlockNA: property.flat_block_na || false,
          plotNA: property.plot_na || false,
          // Location
          latitude: property.latitude || property.map_lat || '',
          longitude: property.longitude || property.map_lng || '',
          landmark: property.landmark || '',
          // Watchman Info
          watchmanName: property.watchman_name || '',
          watchmanContact: property.watchman_contact?.replace(/^\+91\s?/, '') || '',
          // Notes
          notes: property.notes || ''
        });
      }
    } else if (!viewPropertyId && !editPropertyId) {
      setSelectedProperty(null);
    }
  }, [viewPropertyId, editPropertyId, properties]);
  
  // URL-based modal handlers
  const openViewModal = (property) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', String(property.id));
      return newParams;
    });
  };
  
  const closeViewModal = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('view');
      return newParams;
    }, { replace: true });
    setSelectedProperty(null);
  };
  
  const openEditModalUrl = (property) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('edit', String(property.id));
      return newParams;
    });
  };
  
  const closeEditModal = () => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('edit');
      return newParams;
    }, { replace: true });
    setSelectedProperty(null);
    setEditFormData({});
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;
    
    try {
      const response = await fetch(`/api/fp/properties/${propertyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setMessage({ type: 'success', text: 'Property deleted successfully' });
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to delete property' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete property' });
    }
  };

  const openAssignModal = (property, type) => {
    setSelectedProperty(property);
    setAssignType(type);
    setShowAssignModal(true);
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedProperty) return;

    try {
      const endpoint = assignType === 'vendor'
        ? `/api/fp/properties/${selectedProperty.id}/assign-vendor`
        : `/api/fp/properties/${selectedProperty.id}/assign-employee`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assignType === 'vendor' ? { vendorId: assigneeId } : { employeeId: assigneeId })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: `${assignType === 'vendor' ? 'Vendor' : 'Employee'} assigned successfully!` });
        setShowAssignModal(false);
        setSelectedProperty(null);
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Assignment failed' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign' });
    }
  };

  const openEditModal = (property) => {
    // Parse association_contacts JSON if available
    let contacts = [];
    try {
      if (property.association_contacts) {
        contacts = typeof property.association_contacts === 'string' 
          ? JSON.parse(property.association_contacts) 
          : property.association_contacts;
      }
    } catch (e) { contacts = []; }
    
    // Fallback to single contact if no association_contacts
    if (contacts.length === 0 && (property.contact_person || property.contact_email || property.contact_phone)) {
      contacts = [{
        name: property.contact_person || '',
        email: property.contact_email || '',
        phone: property.contact_phone?.replace(/^\+91\s?/, '') || '',
        countryCode: '+91'
      }];
    }
    if (contacts.length === 0) {
      contacts = [{ name: '', email: '', phone: '', countryCode: '+91' }];
    }
    
    // Parse block_names, units_per_block and block_unit_types JSON
    let blockNames = {};
    let unitsPerBlock = {};
    let blockUnitTypes = {};
    try {
      if (property.block_names) {
        blockNames = typeof property.block_names === 'string' 
          ? JSON.parse(property.block_names) : property.block_names;
      }
      if (property.units_per_block) {
        unitsPerBlock = typeof property.units_per_block === 'string' 
          ? JSON.parse(property.units_per_block) : property.units_per_block;
      }
      if (property.block_unit_types) {
        blockUnitTypes = typeof property.block_unit_types === 'string' 
          ? JSON.parse(property.block_unit_types) : property.block_unit_types;
      }
    } catch (e) {}
    
    setEditFormData({
      id: property.id,
      name: property.name || '',
      propertyType: property.property_type || property.entry_type || 'residential',
      entryType: property.entry_type || '',
      address: property.address || '',
      city: property.city || '',
      state: property.state || '',
      zipCode: property.zip_code || property.postal_code || '',
      zone: property.zone_name || property.zone_id || property.zone || '',
      division: property.division_name || property.division || property.division_id || '',
      area: property.area || property.area_name || '',
      isActive: property.is_active !== false && property.status !== 'inactive',
      sourceTable: property.source_table || 'properties',
      // Contact information
      contacts: contacts,
      contactPerson: property.contact_person || '',
      contactPhone: property.contact_phone || '',
      contactEmail: property.contact_email || '',
      // Block Details (for GC/APT)
      numberOfBlocks: property.number_of_blocks || 1,
      blockNames: blockNames,
      unitsPerBlock: unitsPerBlock,
      blockUnitTypes: blockUnitTypes,
      // APT specific
      blockInfo: property.block_info || '',
      blockNA: property.block_na || false,
      numberOfUnits: property.number_of_units || '',
      // Villa/Plot/Flat specific
      villaPlotNumber: property.villa_plot_number || '',
      flatBlockInfo: property.flat_block_info || '',
      flatBlockNA: property.flat_block_na || false,
      plotNA: property.plot_na || false,
      // Location
      latitude: property.latitude || property.map_lat || '',
      longitude: property.longitude || property.map_lng || '',
      landmark: property.landmark || '',
      // Watchman Info
      watchmanName: property.watchman_name || '',
      watchmanContact: property.watchman_contact?.replace(/^\+91\s?/, '') || '',
      // Notes
      notes: property.notes || ''
    });
    // Use URL-based modal
    openEditModalUrl(property);
  };
  
  // Helper functions for edit form contacts
  const addEditContact = () => {
    setEditFormData(prev => ({
      ...prev,
      contacts: [...(prev.contacts || []), { name: '', email: '', phone: '', countryCode: '+91' }]
    }));
  };

  const removeEditContact = (index) => {
    if (editFormData.contacts?.length > 1) {
      setEditFormData(prev => ({
        ...prev,
        contacts: prev.contacts.filter((_, i) => i !== index)
      }));
    }
  };

  const updateEditContact = (index, field, value) => {
    setEditFormData(prev => ({
      ...prev,
      contacts: prev.contacts.map((contact, i) => 
        i === index ? { ...contact, [field]: value } : contact
      )
    }));
  };
  
  // Helper functions for edit form block details
  const updateEditBlockName = (blockNum, name) => {
    setEditFormData(prev => ({
      ...prev,
      blockNames: { ...prev.blockNames, [blockNum]: name }
    }));
  };

  const updateEditUnitsPerBlock = (blockNum, units) => {
    setEditFormData(prev => ({
      ...prev,
      unitsPerBlock: { ...prev.unitsPerBlock, [blockNum]: parseInt(units) || 0 }
    }));
  };

  // Update unit type for a specific block in edit form
  const updateEditBlockUnitType = (blockNum, unitType, value) => {
    setEditFormData(prev => {
      const currentBlockUnits = prev.blockUnitTypes?.[blockNum] || {
        studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0
      };
      const updatedBlockUnits = {
        ...currentBlockUnits,
        [unitType]: parseInt(value) || 0
      };
      const newBlockUnitTypes = {
        ...prev.blockUnitTypes,
        [blockNum]: updatedBlockUnits
      };
      // Auto-calculate total units for this block
      const totalUnits = Object.values(updatedBlockUnits).reduce((sum, val) => sum + val, 0);
      return {
        ...prev,
        blockUnitTypes: newBlockUnitTypes,
        unitsPerBlock: { ...prev.unitsPerBlock, [blockNum]: totalUnits }
      };
    });
  };

  // Get unit type value for a block in edit form
  const getEditBlockUnitTypeValue = (blockNum, unitType) => {
    const val = editFormData.blockUnitTypes?.[blockNum]?.[unitType];
    return val === undefined || val === null || val === 0 ? '' : val;
  };

  const handleSaveEdit = async () => {
    try {
      // Build contact info from first contact or use direct fields
      const primaryContact = editFormData.contacts?.[0] || {};
      const contactPerson = primaryContact.name || editFormData.contactPerson || '';
      const contactPhone = primaryContact.phone ? `${primaryContact.countryCode || '+91'}${primaryContact.phone}` : editFormData.contactPhone || '';
      const contactEmail = primaryContact.email || editFormData.contactEmail || '';
      
      const response = await fetch(`/api/fp/properties/${editFormData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editFormData.name,
          propertyType: editFormData.propertyType,
          address: editFormData.address,
          city: editFormData.city,
          state: editFormData.state,
          zipCode: editFormData.zipCode,
          contactPerson: contactPerson,
          contactPhone: contactPhone,
          contactEmail: contactEmail,
          zoneId: editFormData.zone,
          divisionId: editFormData.division,
          areaName: editFormData.area,
          isActive: editFormData.isActive,
          sourceTable: editFormData.sourceTable,
          // Additional fields
          notes: editFormData.notes,
          landmark: editFormData.landmark,
          latitude: editFormData.latitude || null,
          longitude: editFormData.longitude || null,
          // Block details
          numberOfBlocks: editFormData.numberOfBlocks,
          blockNames: editFormData.blockNames,
          unitsPerBlock: editFormData.unitsPerBlock,
          blockUnitTypes: editFormData.blockUnitTypes,
          // APT specific
          blockInfo: editFormData.blockInfo,
          blockNA: editFormData.blockNA,
          numberOfUnits: editFormData.numberOfUnits,
          // Villa/Plot/Flat
          villaPlotNumber: editFormData.villaPlotNumber,
          flatBlockInfo: editFormData.flatBlockInfo,
          flatBlockNA: editFormData.flatBlockNA,
          plotNA: editFormData.plotNA,
          // Watchman
          watchmanName: editFormData.watchmanName,
          watchmanContact: editFormData.watchmanContact ? `+91${editFormData.watchmanContact.replace(/^\+91\s?/, '')}` : '',
          // Multiple contacts as JSON
          associationContacts: editFormData.contacts
        })
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: 'Property updated successfully!' });
        closeEditModal();
        fetchProperties();
      } else {
        setMessage({ type: 'error', text: result.message || 'Update failed' });
      }
    } catch (error) {
      console.error('Update property error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update property' });
    }
  };

  // Export single property to CSV
  const exportSingleProperty = (property) => {
    const headers = ['Property ID', 'Name', 'Type', 'Zone', 'Area', 'Division', 'Units', 'Address', 'City', 'State', 'ZIP', 'Contact', 'Phone', 'Email', 'Created By', 'Created Date', 'Status'];
    const values = [
      property.property_id || '',
      property.name || '',
      property.property_type?.replace(/_/g, ' ') || '',
      property.zone_name || '',
      property.area || property.area_name || '',
      property.division || '',
      property.units || property.number_of_units || '1',
      property.address || '',
      property.city || '',
      property.state || '',
      property.zip_code || '',
      property.contact_person || '',
      property.contact_phone || '',
      property.contact_email || '',
      property.created_by_name || 'System',
      property.created_at ? new Date(property.created_at).toLocaleDateString() : '',
      property.is_active !== false ? 'Active' : 'Inactive'
    ];
    
    const csvContent = [headers.join(','), values.map(v => `"${v}"`).join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property_${property.property_id || property.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all properties to Excel
  const exportAllProperties = () => {
    if (filteredProperties.length === 0) {
      setMessage({ type: 'error', text: 'No properties to export' });
      return;
    }

    const exportData = filteredProperties.map(property => ({
      'Property ID': property.property_id || '',
      'Name': property.name || '',
      'Type': property.property_type?.replace(/_/g, ' ') || '',
      'Zone': property.zone_name || '',
      'Area': property.area || property.area_name || '',
      'Division': property.division || '',
      'Units': property.units || property.number_of_units || '1',
      'Address': property.address || '',
      'City': property.city || '',
      'State': property.state || '',
      'ZIP Code': property.zip_code || '',
      'Contact Person': property.contact_person || '',
      'Phone': property.contact_phone || '',
      'Email': property.contact_email || '',
      'Created By': property.created_by_name || 'System',
      'Created Date': property.created_at ? new Date(property.created_at).toLocaleDateString() : '',
      'Status': property.is_active !== false ? 'Active' : 'Inactive'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Properties');
    XLSX.writeFile(wb, `fp_properties_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMessage({ type: 'success', text: `Exported ${filteredProperties.length} properties` });
  };

  // Property type tabs
  const tabs = [
    { id: 'all', label: 'All Customers', icon: Users },
    { id: 'gated_community', label: 'Gated Communities', icon: Grid3X3 },
    { id: 'apartment', label: 'Apartments', icon: Building },
    { id: 'villa', label: 'Villas', icon: Home },
    { id: 'plot', label: 'Plots', icon: LayoutGrid },
    { id: 'flat', label: 'Flats', icon: Landmark }
  ];

  // Normalize property type for consistent filtering (handles both uppercase and lowercase)
  const normalizePropertyType = (type) => {
    if (!type) return '';
    const lower = type.toLowerCase().replace(/[_\s-]/g, '');
    if (lower === 'gc' || lower.includes('gated')) return 'gated_community';
    if (lower === 'apt' || lower.includes('apartment')) return 'apartment';
    if (lower === 'villa' || lower === 'villas') return 'villa';
    if (lower === 'flat' || lower === 'flats') return 'flat';
    if (lower === 'plot' || lower === 'plots') return 'plot';
    return type.toLowerCase();
  };

  // Get type badge color
  const getTypeBadgeColor = (type) => {
    const normalized = normalizePropertyType(type);
    const colors = {
      'apartment': 'bg-blue-100 text-blue-700',
      'gated_community': 'bg-teal-100 text-teal-700',
      'villa': 'bg-amber-100 text-amber-700',
      'plot': 'bg-purple-100 text-purple-700',
      'flat': 'bg-pink-100 text-pink-700'
    };
    return colors[normalized] || 'bg-gray-100 text-gray-700';
  };

  // Filter properties
  const filteredProperties = properties.filter(p => {
    // Tab filter - normalize property type for consistent matching
    if (activeTab !== 'all' && normalizePropertyType(p.property_type) !== activeTab) return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!(
        p.name?.toLowerCase().includes(search) ||
        p.property_id?.toLowerCase().includes(search) ||
        p.zone_name?.toLowerCase().includes(search) ||
        p.address?.toLowerCase().includes(search)
      )) return false;
    }
    
    // Zone filter
    if (selectedZone && p.zone_id !== parseInt(selectedZone)) return false;
    
    // Division filter
    if (selectedDivision && p.division !== selectedDivision) return false;
    
    // Status filter - use is_active field to match display logic
    if (statusFilter === 'active' && p.is_active === false) return false;
    if (statusFilter === 'inactive' && p.is_active !== false) return false;
    
    return true;
  });

  // Count properties by type
  const getTypeCount = (type) => {
    if (type === 'all') return properties.length;
    return properties.filter(p => normalizePropertyType(p.property_type) === type).length;
  };

  // Get unique divisions from properties
  const uniqueDivisions = [...new Set(properties.map(p => p.division).filter(Boolean))];

  // Category Selection View
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500 mt-1">View and manage created customers</p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
            <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Selection */}
        <div className="bg-gray-50 rounded-2xl p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Select Category</h2>
            <p className="text-gray-500 mt-2">Choose the customer category to proceed</p>
          </div>

          <div className="flex justify-center gap-8">
            {/* Residential Card */}
            <button
              onClick={() => setSelectedCategory('residential')}
              className="w-72 h-52 p-8 border-2 border-teal-400 rounded-2xl hover:shadow-xl transition-all duration-200 bg-teal-50/50 group flex flex-col items-start justify-center"
            >
              <div className="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Home className="w-7 h-7 text-white" />
              </div>
              <p className="text-lg font-semibold text-gray-900">Residential</p>
            </button>

            {/* Commercial Card - Coming Soon */}
            <div className="w-72 h-52 p-8 border border-gray-200 rounded-2xl bg-white relative cursor-not-allowed flex flex-col items-start justify-center">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Coming Soon</span>
              </div>
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center mb-5">
                <Building className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-400">Commercial</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedCategory(null)}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to categories"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Management</h1>
          <p className="text-gray-500">{properties.length} total customers</p>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = getTypeCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, zone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="relative">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="">All Zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          >
            <option value="active">Active Customers</option>
            <option value="all">All Customers</option>
            <option value="inactive">Inactive Customers</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={fetchProperties}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No properties found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Zone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Area</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Division</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Address</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">City</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Contacts</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created By</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-gray-900">{property.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">{property.property_id}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeBadgeColor(property.property_type)}`}>
                          {property.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.zone_name || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.area || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.division_name || property.division || property.division_id || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 max-w-[150px] truncate block">{property.address || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.city || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.contact_phone || '-'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{property.created_by_name || 'System'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">{formatDate(property.created_at)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          property.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {property.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openViewModal(property)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => exportSingleProperty(property)}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Export to CSV"
                          >
                            <Download className="w-4 h-4 text-gray-400 hover:text-emerald-600" />
                          </button>
                          {!isFPManager && (
                            <>
                              <button
                                onClick={() => openEditModal(property)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Property"
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                              </button>
                              <button
                                onClick={() => openAssignModal(property, 'vendor')}
                                className="p-1.5 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Assign Vendor"
                              >
                                <Truck className="w-4 h-4 text-purple-500" />
                              </button>
                              <button
                                onClick={() => openAssignModal(property, 'employee')}
                                className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                                title="Assign Employee"
                              >
                                <UserPlus className="w-4 h-4 text-green-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteProperty(property.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {filteredProperties.length} of {properties.length} properties
              </p>
            </div>
          </>
        )}
      </div>

      {/* View Details Modal */}
      {showDetailsModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedProperty.name}</h2>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {selectedProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Property'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{selectedProperty.property_id}</p>
              </div>
              <button
                onClick={closeViewModal}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Property Information */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Zone</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.zone_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Area Name</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.area || selectedProperty.area_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Division</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.division_name || selectedProperty.division || selectedProperty.division_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Property Type</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.property_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Units</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.units || selectedProperty.number_of_units || selectedProperty.number_of_blocks || '1'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Created Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedProperty.created_at ? new Date(selectedProperty.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Gated Community Block Details */}
              {(['gated_community', 'GC', 'Gated Community'].some(t => 
                selectedProperty.property_type?.toLowerCase() === t.toLowerCase() || 
                selectedProperty.entry_type === 'GC'
              )) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Block Details</h3>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Number of Blocks</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.number_of_blocks || 1}</p>
                  </div>
                  {(() => {
                    try {
                      const blockNames = typeof selectedProperty.block_names === 'string' ? JSON.parse(selectedProperty.block_names) : selectedProperty.block_names || {};
                      const unitsPerBlock = typeof selectedProperty.units_per_block === 'string' ? JSON.parse(selectedProperty.units_per_block) : selectedProperty.units_per_block || {};
                      const blockUnitTypes = typeof selectedProperty.block_unit_types === 'string' ? JSON.parse(selectedProperty.block_unit_types) : selectedProperty.block_unit_types || {};
                      const numBlocks = selectedProperty.number_of_blocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || 1;
                      if (Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0) {
                        return (
                          <div className="space-y-4">
                            {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                              const unitTypes = blockUnitTypes[blockNum] || {};
                              return (
                                <div key={blockNum} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                  <div className="flex gap-4 mb-3">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Block Name</p>
                                      <p className="text-sm font-medium text-gray-900">{blockNames[blockNum] || `Block ${blockNum}`}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Total Units</p>
                                      <p className="text-sm font-medium text-gray-900">{unitsPerBlock[blockNum] || 0}</p>
                                    </div>
                                  </div>
                                  {Object.keys(unitTypes).length > 0 && (
                                    <div className="grid grid-cols-5 gap-2 pt-2 border-t border-gray-200">
                                      <div>
                                        <p className="text-xs text-gray-500">Studio</p>
                                        <p className="text-sm font-medium">{unitTypes.studio || 0}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">1 Bed</p>
                                        <p className="text-sm font-medium">{unitTypes.oneBed || 0}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">2 Bed</p>
                                        <p className="text-sm font-medium">{unitTypes.twoBed || 0}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">3 Bed</p>
                                        <p className="text-sm font-medium">{unitTypes.threeBed || 0}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">4 Bed</p>
                                        <p className="text-sm font-medium">{unitTypes.fourBed || 0}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return null;
                    } catch { return null; }
                  })()}
                </div>
              )}

              {/* Apartment Details */}
              {(selectedProperty.property_type === 'apartment' || selectedProperty.property_type === 'APT') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.block_na ? 'N/A' : (selectedProperty.block_info || '-')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Number of Units</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.number_of_units || '-'}</p>
                    </div>
                  </div>
                  {(() => {
                    try {
                      const blockUnitTypes = typeof selectedProperty.block_unit_types === 'string' ? JSON.parse(selectedProperty.block_unit_types) : selectedProperty.block_unit_types || {};
                      const unitTypes = blockUnitTypes['apt'] || {};
                      if (Object.keys(unitTypes).length > 0 && Object.values(unitTypes).some(v => v > 0)) {
                        return (
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-gray-500 mb-2 font-medium">Unit Types</p>
                            <div className="grid grid-cols-5 gap-2">
                              <div>
                                <p className="text-xs text-gray-500">Studio</p>
                                <p className="text-sm font-medium">{unitTypes.studio || 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">1 Bed</p>
                                <p className="text-sm font-medium">{unitTypes.oneBed || 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">2 Bed</p>
                                <p className="text-sm font-medium">{unitTypes.twoBed || 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">3 Bed</p>
                                <p className="text-sm font-medium">{unitTypes.threeBed || 0}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">4 Bed</p>
                                <p className="text-sm font-medium">{unitTypes.fourBed || 0}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    } catch { return null; }
                  })()}
                </div>
              )}

              {/* Villa Details */}
              {(selectedProperty.property_type === 'villa' || selectedProperty.property_type === 'VILLA') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Villa Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Villa Number</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_plot_number || '-'}</p>
                  </div>
                </div>
              )}

              {/* Flat Details */}
              {(selectedProperty.property_type === 'flat' || selectedProperty.property_type === 'FLAT') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Flat Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Flat Number</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_plot_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Block Information</p>
                      <p className="text-sm font-medium text-gray-900">{selectedProperty.flat_block_na ? 'N/A' : (selectedProperty.flat_block_info || '-')}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Plot Details */}
              {(selectedProperty.property_type === 'plot' || selectedProperty.property_type === 'PLOT') && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Plot Details</h3>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Plot Number</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.plot_na ? 'N/A' : (selectedProperty.villa_plot_number || '-')}</p>
                  </div>
                </div>
              )}

              {/* Address */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Street Address</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Apt/Suite</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.villa_plot_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">City</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">State/Province</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.state || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ZIP/Postal Code</p>
                    <p className="text-sm font-medium text-gray-900">{selectedProperty.zip_code || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Map Location */}
              {(selectedProperty.latitude || selectedProperty.longitude || selectedProperty.landmark) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Map Location</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-3">
                      {selectedProperty.landmark || `${selectedProperty.address}, ${selectedProperty.city}, ${selectedProperty.state}, ${selectedProperty.zip_code}`}
                    </p>
                    {(selectedProperty.latitude && selectedProperty.longitude) && (
                      <>
                        <a
                          href={`https://www.google.com/maps?q=${selectedProperty.latitude},${selectedProperty.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Maps
                        </a>
                        <p className="text-xs text-blue-600 mt-3 font-mono">
                          {selectedProperty.latitude}, {selectedProperty.longitude}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {(() => {
                // Parse association_contacts if available
                let contacts = [];
                try {
                  if (selectedProperty.association_contacts) {
                    contacts = typeof selectedProperty.association_contacts === 'string' 
                      ? JSON.parse(selectedProperty.association_contacts) 
                      : selectedProperty.association_contacts;
                  }
                } catch { contacts = []; }
                
                // Fallback to single contact if no association_contacts
                if (contacts.length === 0 && (selectedProperty.contact_person || selectedProperty.contact_email || selectedProperty.contact_phone)) {
                  contacts = [{
                    name: selectedProperty.contact_person,
                    email: selectedProperty.contact_email,
                    phone: selectedProperty.contact_phone
                  }];
                }
                
                if (contacts.length === 0) return null;
                
                return (
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Contact Information</h3>
                    <div className="space-y-3">
                      {contacts.map((contact, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                            </div>
                            <span className="text-xs text-gray-500">Contact {index + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2.5fr_1fr] gap-4">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Name</p>
                              <p className="text-sm font-medium text-gray-900">{contact.name || '-'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Email</p>
                              <p className="text-sm font-medium text-gray-900 break-all">{contact.email || '-'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-1">Phone</p>
                              <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                                {(() => {
                                  if (!contact.phone) return '-';
                                  const phone = contact.phone.toString().trim();
                                  if (phone.startsWith('+')) return phone;
                                  return `+91 ${phone}`;
                                })()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Watchman Information - Only for GC and APT */}
              {(['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes((selectedProperty.property_type || '').toLowerCase()) ||
               ['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes((selectedProperty.entry_type || '').toLowerCase())) && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Watchman Information</h3>
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Name</p>
                        <p className="text-sm font-medium text-gray-900">{selectedProperty.watchman_name || selectedProperty.watchmanName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Watchman Contact</p>
                        <p className="text-sm font-medium text-gray-900">
                          {(() => {
                            const contact = selectedProperty.watchman_contact || selectedProperty.watchmanContact;
                            if (!contact) return 'N/A';
                            return contact.startsWith('+') ? contact : `+91 ${contact}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              {selectedProperty.notes && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Additional Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedProperty.notes}</p>
                  </div>
                </div>
              )}

              {/* Estimates Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h3 className="text-base font-semibold text-gray-900">Estimates (0)</h3>
                </div>
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No estimates for this property</p>
                  <p className="text-xs text-gray-400 mt-1">Create an estimate from the Estimates section</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Assign {assignType === 'vendor' ? 'Vendor' : 'Employee'}
                </h2>
                <button onClick={() => { setShowAssignModal(false); setSelectedProperty(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Property: {selectedProperty.name}</p>
            </div>

            <div className="p-6">
              {(() => {
                // Filter vendors by property zone - zone is required
                const propertyZone = (selectedProperty?.zone_name || selectedProperty?.zone || selectedProperty?.zone_id || '').toString().toLowerCase().trim();
                
                // If property has NO zone, don't show any vendors
                if (assignType === 'vendor' && !propertyZone) {
                  return (
                    <div className="text-center py-4">
                      <p className="text-gray-500">This property has no zone assigned</p>
                      <p className="text-xs text-gray-400 mt-1">Please assign a zone to this property first to see matching vendors</p>
                    </div>
                  );
                }
                
                // Filter vendors by EXACT zone match only
                const zoneFilteredVendors = assignType === 'vendor' 
                  ? vendors.filter(v => {
                      const vendorZone = (v.zone_name || v.zone || v.zone_id || '').toString().toLowerCase().trim();
                      if (!vendorZone) return false;
                      // Exact zone match - extract numbers for comparison
                      const propZoneNum = propertyZone.replace(/[^0-9]/g, '');
                      const vendorZoneNum = vendorZone.replace(/[^0-9]/g, '');
                      // Match exactly: "Zone 43" === "Zone 43" OR "43" === "43"
                      return vendorZone === propertyZone || (propZoneNum && vendorZoneNum && propZoneNum === vendorZoneNum);
                    })
                  : employees;
                
                return zoneFilteredVendors.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500">
                      No {assignType === 'vendor' ? 'vendors' : 'employees'} available for {selectedProperty?.zone_name || selectedProperty?.zone || selectedProperty?.zone_id}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Add vendors with matching zone to assign them to this property</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {zoneFilteredVendors.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAssign(item.id)}
                        className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                      >
                        <div className={`w-10 h-10 ${assignType === 'vendor' ? 'bg-purple-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                          {assignType === 'vendor' ? (
                            <Store className="w-5 h-5 text-purple-600" />
                          ) : (
                            <User className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {assignType === 'vendor' 
                              ? (item.ownerName || item.owner_name || item.company_name || 'Unknown Vendor')
                              : (`${item.first_name || ''} ${item.last_name || ''}`.trim() || item.name || 'Unknown Employee')}
                          </p>
                          <p className="text-sm text-gray-500">
                            {assignType === 'vendor' 
                              ? (item.serviceType || item.service_type || item.email || '-')
                              : (item.role || item.email || '-')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Property Modal - Comprehensive */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Property</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editFormData.propertyType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Property'}
                </p>
              </div>
              <button onClick={closeEditModal} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Property Information */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Property Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property/Community Name *</label>
                    <input type="text" value={editFormData.name || ''} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                    <input type="text" value={editFormData.zone || ''} onChange={(e) => setEditFormData({ ...editFormData, zone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area Name</label>
                    <input type="text" value={editFormData.area || ''} onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                    <input type="text" value={editFormData.division || ''} onChange={(e) => setEditFormData({ ...editFormData, division: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                    <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700">
                      {editFormData.propertyType?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information - Multiple Contacts */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900">Contact Information</h3>
                  <button type="button" onClick={addEditContact} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Add Contact
                  </button>
                </div>
                <div className="space-y-4">
                  {(editFormData.contacts || []).map((contact, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 relative">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                        </div>
                        <span className="text-sm text-gray-600">Contact {index + 1}</span>
                        {editFormData.contacts.length > 1 && (
                          <button type="button" onClick={() => removeEditContact(index)} className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Name *</label>
                          <input type="text" value={contact.name || ''} onChange={(e) => updateEditContact(index, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Contact name" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email *</label>
                          <input type="email" value={contact.email || ''} onChange={(e) => updateEditContact(index, 'email', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="email@example.com" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Phone *</label>
                          <div className="flex gap-1">
                            <div className="w-12 flex-shrink-0 px-2 py-2 border border-gray-200 rounded-lg text-xs bg-gray-100 text-gray-600 flex items-center justify-center">+91</div>
                            <input type="tel" inputMode="numeric" maxLength={10} value={contact.phone || ''} onChange={(e) => updateEditContact(index, 'phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="10-digit" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watchman Information - Only for GC and APT */}
              {(['gated_community', 'apartment', 'GC', 'APT', 'Gated Community', 'Apartment'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType?.toLowerCase().includes(t.toLowerCase())
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Watchman Information <span className="text-gray-400 text-sm font-normal">(Optional)</span></h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Name</label>
                      <input type="text" value={editFormData.watchmanName || ''} onChange={(e) => setEditFormData({ ...editFormData, watchmanName: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter watchman name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Watchman Contact</label>
                      <div className="flex gap-2">
                        <div className="w-14 flex-shrink-0 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 flex items-center justify-center">+91</div>
                        <input type="tel" inputMode="numeric" maxLength={10} value={editFormData.watchmanContact || ''} onChange={(e) => setEditFormData({ ...editFormData, watchmanContact: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="10-digit number" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Block Details - Only for GC */}
              {(['gated_community', 'GC', 'Gated Community'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType === 'GC'
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Block Details</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Blocks</label>
                    <input type="number" min="1" max="50" value={editFormData.numberOfBlocks || 1} onChange={(e) => setEditFormData({ ...editFormData, numberOfBlocks: parseInt(e.target.value) || 1 })} className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {editFormData.numberOfBlocks > 0 && (
                    <div className="space-y-4">
                      {Array.from({ length: editFormData.numberOfBlocks }, (_, i) => i + 1).map(blockNum => (
                        <div key={blockNum} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">Block {blockNum} Name</label>
                              <input type="text" value={editFormData.blockNames?.[blockNum] || ''} onChange={(e) => updateEditBlockName(blockNum, e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder={`Block ${blockNum}`} />
                            </div>
                            <div className="w-20">
                              <label className="block text-xs text-gray-500 mb-1">Units</label>
                              <input type="number" min="0" value={editFormData.unitsPerBlock?.[blockNum] || 0} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 cursor-not-allowed" />
                            </div>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Studio</label>
                              <input type="number" min="0" value={getEditBlockUnitTypeValue(blockNum, 'studio')} onChange={(e) => updateEditBlockUnitType(blockNum, 'studio', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">1 Bed</label>
                              <input type="number" min="0" value={getEditBlockUnitTypeValue(blockNum, 'oneBed')} onChange={(e) => updateEditBlockUnitType(blockNum, 'oneBed', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">2 Bed</label>
                              <input type="number" min="0" value={getEditBlockUnitTypeValue(blockNum, 'twoBed')} onChange={(e) => updateEditBlockUnitType(blockNum, 'twoBed', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">3 Bed</label>
                              <input type="number" min="0" value={getEditBlockUnitTypeValue(blockNum, 'threeBed')} onChange={(e) => updateEditBlockUnitType(blockNum, 'threeBed', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">4 Bed</label>
                              <input type="number" min="0" value={getEditBlockUnitTypeValue(blockNum, 'fourBed')} onChange={(e) => updateEditBlockUnitType(blockNum, 'fourBed', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Apartment Specific */}
              {(['apartment', 'APT', 'Apartment'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                editFormData.entryType === 'APT'
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Apartment Details</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Block Information</label>
                      <div className="flex items-center gap-3">
                        <input type="text" value={editFormData.blockInfo || ''} disabled={editFormData.blockNA} onChange={(e) => setEditFormData({ ...editFormData, blockInfo: e.target.value })} className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 ${editFormData.blockNA ? 'bg-gray-100' : ''}`} placeholder="Enter block info" />
                        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                          <input type="checkbox" checked={editFormData.blockNA || false} onChange={(e) => setEditFormData({ ...editFormData, blockNA: e.target.checked, blockInfo: e.target.checked ? '' : editFormData.blockInfo })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          N/A
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Number of Units</label>
                      <input type="number" min="0" value={editFormData.numberOfUnits || 0} readOnly className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed" />
                    </div>
                  </div>
                  {/* Unit Types for Apartment */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Unit Types</label>
                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Studio</label>
                        <input type="number" min="0" value={getEditBlockUnitTypeValue('apt', 'studio')} onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditFormData(prev => {
                            const currentUnits = prev.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                            const updatedUnits = { ...currentUnits, studio: val };
                            const totalUnits = Object.values(updatedUnits).reduce((sum, v) => sum + v, 0);
                            return { ...prev, blockUnitTypes: { ...prev.blockUnitTypes, apt: updatedUnits }, numberOfUnits: totalUnits };
                          });
                        }} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">1 Bed</label>
                        <input type="number" min="0" value={getEditBlockUnitTypeValue('apt', 'oneBed')} onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditFormData(prev => {
                            const currentUnits = prev.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                            const updatedUnits = { ...currentUnits, oneBed: val };
                            const totalUnits = Object.values(updatedUnits).reduce((sum, v) => sum + v, 0);
                            return { ...prev, blockUnitTypes: { ...prev.blockUnitTypes, apt: updatedUnits }, numberOfUnits: totalUnits };
                          });
                        }} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">2 Bed</label>
                        <input type="number" min="0" value={getEditBlockUnitTypeValue('apt', 'twoBed')} onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditFormData(prev => {
                            const currentUnits = prev.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                            const updatedUnits = { ...currentUnits, twoBed: val };
                            const totalUnits = Object.values(updatedUnits).reduce((sum, v) => sum + v, 0);
                            return { ...prev, blockUnitTypes: { ...prev.blockUnitTypes, apt: updatedUnits }, numberOfUnits: totalUnits };
                          });
                        }} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">3 Bed</label>
                        <input type="number" min="0" value={getEditBlockUnitTypeValue('apt', 'threeBed')} onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditFormData(prev => {
                            const currentUnits = prev.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                            const updatedUnits = { ...currentUnits, threeBed: val };
                            const totalUnits = Object.values(updatedUnits).reduce((sum, v) => sum + v, 0);
                            return { ...prev, blockUnitTypes: { ...prev.blockUnitTypes, apt: updatedUnits }, numberOfUnits: totalUnits };
                          });
                        }} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">4 Bed</label>
                        <input type="number" min="0" value={getEditBlockUnitTypeValue('apt', 'fourBed')} onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditFormData(prev => {
                            const currentUnits = prev.blockUnitTypes?.['apt'] || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0, fourBed: 0 };
                            const updatedUnits = { ...currentUnits, fourBed: val };
                            const totalUnits = Object.values(updatedUnits).reduce((sum, v) => sum + v, 0);
                            return { ...prev, blockUnitTypes: { ...prev.blockUnitTypes, apt: updatedUnits }, numberOfUnits: totalUnits };
                          });
                        }} className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500" placeholder="0" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Villa/Flat/Plot Specific */}
              {(['villa', 'flat', 'plot', 'VILLA', 'FLAT', 'PLOT'].some(t => 
                editFormData.propertyType?.toLowerCase().includes(t.toLowerCase()) || 
                ['VILLA', 'FLAT', 'PLOT'].includes(editFormData.entryType)
              )) && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">
                    {editFormData.entryType === 'VILLA' || editFormData.propertyType?.toLowerCase().includes('villa') ? 'Villa' : 
                     editFormData.entryType === 'FLAT' || editFormData.propertyType?.toLowerCase().includes('flat') ? 'Flat' : 'Plot'} Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {editFormData.entryType === 'VILLA' || editFormData.propertyType?.toLowerCase().includes('villa') ? 'Villa Number' : 
                         editFormData.entryType === 'FLAT' || editFormData.propertyType?.toLowerCase().includes('flat') ? 'Flat Number' : 'Plot Number'}
                      </label>
                      <div className="flex items-center gap-3">
                        <input type="text" value={editFormData.villaPlotNumber || ''} disabled={editFormData.plotNA} onChange={(e) => setEditFormData({ ...editFormData, villaPlotNumber: e.target.value })} className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 ${editFormData.plotNA ? 'bg-gray-100' : ''}`} />
                        {(editFormData.entryType === 'PLOT' || editFormData.propertyType?.toLowerCase().includes('plot')) && (
                          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                            <input type="checkbox" checked={editFormData.plotNA || false} onChange={(e) => setEditFormData({ ...editFormData, plotNA: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            N/A
                          </label>
                        )}
                      </div>
                    </div>
                    {(editFormData.entryType === 'FLAT' || editFormData.propertyType?.toLowerCase().includes('flat')) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Block Information</label>
                        <div className="flex items-center gap-3">
                          <input type="text" value={editFormData.flatBlockInfo || ''} disabled={editFormData.flatBlockNA} onChange={(e) => setEditFormData({ ...editFormData, flatBlockInfo: e.target.value })} className={`flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 ${editFormData.flatBlockNA ? 'bg-gray-100' : ''}`} />
                          <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                            <input type="checkbox" checked={editFormData.flatBlockNA || false} onChange={(e) => setEditFormData({ ...editFormData, flatBlockNA: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            N/A
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                    <textarea value={editFormData.address || ''} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Enter street address" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input type="text" value={editFormData.city || ''} onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input type="text" value={editFormData.state || ''} onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP/Postal Code</label>
                    <input type="text" value={editFormData.zipCode || ''} onChange={(e) => setEditFormData({ ...editFormData, zipCode: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                    <input type="text" value={editFormData.landmark || ''} onChange={(e) => setEditFormData({ ...editFormData, landmark: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Near landmark" />
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Additional Notes <span className="text-gray-400 text-sm font-normal">(Optional)</span></h3>
                <textarea value={editFormData.notes || ''} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" rows={3} placeholder="Enter any additional notes or comments..." />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={closeEditModal} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveEdit} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Save className="w-4 h-4" />Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FPProperties;
