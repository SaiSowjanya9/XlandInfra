import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  CalendarClock,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  Building2,
  Eye,
  ArrowRight,
  AlertCircle,
  Wrench,
  Home,
  Users,
  X,
  Search,
  MoreHorizontal,
  Truck,
  Phone,
  Mail,
  Download,
  HelpCircle,
  Package,
  UserCheck,
  UserX,
  AlertTriangle,
  Bell
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import DateRangeFilter from '../../components/common/DateRangeFilter';
import VendorAssignmentModal from '../../components/scheduling/VendorAssignmentModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'employee': 'admin',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor'
  };
  return portalMap[portalType] || 'fp';
};

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format time helper
const formatTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Property type icons
const PropertyTypeIcon = ({ type }) => {
  const iconMap = {
    'Apartment': { icon: Building2, color: '#3B82F6' },
    'Villa': { icon: Home, color: '#10B981' },
    'Gated Community': { icon: Building2, color: '#8B5CF6' },
    'Plot': { icon: MapPin, color: '#F59E0B' },
    'Flat': { icon: Building2, color: '#EC4899' }
  };
  const config = iconMap[type] || iconMap['Apartment'];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2">
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${config.color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <span className="text-sm text-gray-700">{type || 'Apartment'}</span>
    </div>
  );
};

// Zone badge component
const ZoneBadge = ({ zone }) => {
  const colors = {
    'Zone A': 'bg-blue-100 text-blue-700 border-blue-200',
    'Zone B': 'bg-green-100 text-green-700 border-green-200',
    'Zone C': 'bg-purple-100 text-purple-700 border-purple-200',
    'Zone D': 'bg-orange-100 text-orange-700 border-orange-200',
    'default': 'bg-gray-100 text-gray-700 border-gray-200'
  };
  const colorClass = colors[zone] || colors['default'];
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-md border ${colorClass}`}>
      {zone || 'N/A'}
    </span>
  );
};

// Status badge component
const StatusBadge = ({ status, type = 'payment' }) => {
  const paymentColors = {
    'Paid': 'bg-green-100 text-green-700',
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Overdue': 'bg-red-100 text-red-700',
    'Partial': 'bg-orange-100 text-orange-700'
  };
  const scheduleColors = {
    'New': 'bg-blue-100 text-blue-700',
    'Scheduled': 'bg-green-100 text-green-700',
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Overdue': 'bg-red-100 text-red-700'
  };
  const colors = type === 'payment' ? paymentColors : scheduleColors;
  const colorClass = colors[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {status}
    </span>
  );
};

// Role-based permissions for scheduling
const getSchedulePermissions = (portalType) => {
  const permissions = {
    admin: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, canSchedule: true, fullAccess: true },
    operations_manager: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, canSchedule: true, fullAccess: false },
    franchise: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: false, canSchedule: true, fullAccess: false },
    manager: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, canSchedule: true, fullAccess: false },
    coordinator: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, canSchedule: false, fullAccess: false },
    supervisor: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, canSchedule: false, fullAccess: false },
    executive: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, canSchedule: false, fullAccess: false }
  };
  return permissions[portalType] || permissions.executive;
};

const PendingPropertySchedules = ({ user, portalType = 'admin' }) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  const permissions = getSchedulePermissions(portalType);
  
  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [properties, setProperties] = useState([]);
  const [zones, setZones] = useState([]);
  const [packages, setPackages] = useState([]);
  const [vendors, setVendors] = useState([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Modal states
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAssignVendorModal, setShowAssignVendorModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);

  // Fetch pending properties
  const fetchPendingProperties = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // Fetch properties that are paid and have vendors assigned but not yet scheduled
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/pending-properties`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // API not implemented yet, use mock data
          setProperties(getMockData());
          return;
        }
        throw new Error('Failed to fetch pending properties');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setProperties(result.data || []);
      } else {
        // Use mock data for development
        setProperties(getMockData());
      }
    } catch (err) {
      console.error('Fetch pending properties error:', err);
      // Use mock data for development
      setProperties(getMockData());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiPath]);

  // Fetch zones
  const fetchZones = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/onboarding/suggestions/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setZones(result.data);
      }
    } catch (err) {
      console.error('Fetch zones error:', err);
    }
  }, [token]);

  // Fetch packages - use correct endpoint for each portal
  const fetchPackages = useCallback(async () => {
    try {
      let endpoint;
      switch (apiPath) {
        case 'admin':
          endpoint = `${API_BASE}/api/admin/all-amc-packages`;
          break;
        case 'fp':
          endpoint = `${API_BASE}/api/fp/amc-packages`;
          break;
        case 'manager':
          endpoint = `${API_BASE}/api/manager/amc-packages`;
          break;
        case 'coordinator':
          endpoint = `${API_BASE}/api/coordinator/amc-packages`;
          break;
        case 'supervisor':
          endpoint = `${API_BASE}/api/supervisor/amc-packages`;
          break;
        default:
          endpoint = `${API_BASE}/api/fp/amc-packages`;
      }
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPackages(result.data);
      }
    } catch (err) {
      console.error('Fetch packages error:', err);
    }
  }, [token, apiPath]);

  // Fetch vendors
  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/vendors?status=active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setVendors(result.data);
      }
    } catch (err) {
      console.error('Fetch vendors error:', err);
    }
  }, [token]);

  // Mock data for development
  const getMockData = () => [
    {
      id: 1,
      propertyId: 'PROP-101',
      propertyName: 'Green Valley Apartments',
      customerName: 'Mr. Ramesh Kumar',
      customerPhone: '98765 43210',
      propertyType: 'Apartment',
      zone: 'Zone A',
      packageName: 'Apartment Basic',
      packageType: 'AMC',
      totalServices: 5,
      assignedVendors: 5,
      pendingServices: 0,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T09:15:00',
      isNew: true,
      services: [
        { name: 'HVAC', frequency: 'Monthly', visits: 12, vendorAssigned: true, vendorName: 'ABC HVAC' },
        { name: 'Plumbing', frequency: 'Every 2 Months', visits: 6, vendorAssigned: true, vendorName: 'XYZ Plumbing' },
        { name: 'Electrical', frequency: 'Quarterly', visits: 4, vendorAssigned: true, vendorName: 'Power Services' },
        { name: 'Pest Control', frequency: 'Half-Yearly', visits: 2, vendorAssigned: true, vendorName: 'PestFree' },
        { name: 'Water Tank', frequency: 'Yearly', visits: 1, vendorAssigned: true, vendorName: 'Aqua Service' }
      ]
    },
    {
      id: 2,
      propertyId: 'PROP-102',
      propertyName: 'Sunrise Villas',
      customerName: 'Mrs. Neha Singh',
      customerPhone: '87654 32109',
      propertyType: 'Villa',
      zone: 'Zone B',
      packageName: 'Villa Premium',
      packageType: 'AMC',
      totalServices: 4,
      assignedVendors: 4,
      pendingServices: 0,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T08:45:00',
      isNew: true,
      services: [
        { name: 'HVAC', frequency: 'Monthly', visits: 12, vendorAssigned: true, vendorName: 'CoolAir HVAC' },
        { name: 'Landscaping', frequency: 'Weekly', visits: 52, vendorAssigned: true, vendorName: 'Green Gardens' },
        { name: 'Pool', frequency: 'Weekly', visits: 52, vendorAssigned: true, vendorName: 'AquaCare Pool' },
        { name: 'Security', frequency: 'Daily', visits: 365, vendorAssigned: true, vendorName: 'SecureGuard' }
      ]
    },
    {
      id: 3,
      propertyId: 'PROP-103',
      propertyName: 'Palm Meadows',
      customerName: 'Mr. Arvind Rao',
      customerPhone: '96587 65432',
      propertyType: 'Villa',
      zone: 'Zone A',
      packageName: 'Villa Basic',
      packageType: 'AMC',
      totalServices: 6,
      assignedVendors: 5,
      pendingServices: 1,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T08:20:00',
      isNew: true,
      services: [
        { name: 'HVAC', frequency: 'Monthly', visits: 12, vendorAssigned: true, vendorName: 'ABC HVAC' },
        { name: 'Plumbing', frequency: 'Every 2 Months', visits: 6, vendorAssigned: true, vendorName: 'XYZ Plumbing' },
        { name: 'Electrical', frequency: 'Quarterly', visits: 4, vendorAssigned: true, vendorName: 'Power Services' },
        { name: 'Pest Control', frequency: 'Half-Yearly', visits: 2, vendorAssigned: true, vendorName: 'PestFree' },
        { name: 'Landscaping', frequency: 'Weekly', visits: 52, vendorAssigned: true, vendorName: 'Green Gardens' },
        { name: 'Pool', frequency: 'Weekly', visits: 52, vendorAssigned: false, vendorName: null }
      ]
    },
    {
      id: 4,
      propertyId: 'PROP-104',
      propertyName: 'Lake View Residency',
      customerName: 'Mr. Suresh Patel',
      customerPhone: '91234 56789',
      propertyType: 'Apartment',
      zone: 'Zone C',
      packageName: 'Apartment Premium',
      packageType: 'AMC',
      totalServices: 3,
      assignedVendors: 3,
      pendingServices: 0,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T07:50:00',
      isNew: true,
      services: []
    },
    {
      id: 5,
      propertyId: 'PROP-105',
      propertyName: 'Urban Nest',
      customerName: 'Mr. Ravi Kumar',
      customerPhone: '99876 54321',
      propertyType: 'Villa',
      zone: 'Zone D',
      packageName: 'Villa Basic',
      packageType: 'AMC',
      totalServices: 4,
      assignedVendors: 3,
      pendingServices: 1,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T07:10:00',
      isNew: true,
      services: []
    },
    {
      id: 6,
      propertyId: 'PROP-106',
      propertyName: 'Golden Heights',
      customerName: 'Mr. Vikram Reddy',
      customerPhone: '93456 78901',
      propertyType: 'Apartment',
      zone: 'Zone B',
      packageName: 'Apartment Basic',
      packageType: 'AMC',
      totalServices: 5,
      assignedVendors: 4,
      pendingServices: 1,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T06:40:00',
      isNew: true,
      services: []
    },
    {
      id: 7,
      propertyId: 'PROP-107',
      propertyName: 'Elite Enclave',
      customerName: 'Mr. Pooja Sharma',
      customerPhone: '88776 65544',
      propertyType: 'Apartment',
      zone: 'Zone A',
      packageName: 'Apartment Premium',
      packageType: 'AMC',
      totalServices: 6,
      assignedVendors: 6,
      pendingServices: 0,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T06:05:00',
      isNew: true,
      services: []
    },
    {
      id: 8,
      propertyId: 'PROP-108',
      propertyName: 'Maple Residency',
      customerName: 'Mr. Karthik Reddy',
      customerPhone: '99087 76655',
      propertyType: 'Apartment',
      zone: 'Zone C',
      packageName: 'Apartment Basic',
      packageType: 'AMC',
      totalServices: 4,
      assignedVendors: 2,
      pendingServices: 2,
      paymentStatus: 'Paid',
      addedOn: '2025-08-07T05:30:00',
      isNew: true,
      services: []
    }
  ];

  // Initial load - run once
  useEffect(() => {
    fetchPendingProperties();
    fetchZones();
    fetchPackages();
    fetchVendors();
  }, []);
  
  // Separate interval to avoid re-creating on every render
  useEffect(() => {
    const interval = setInterval(() => fetchPendingProperties(false), 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter properties
  const getFilteredProperties = () => {
    let filtered = properties;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.propertyId?.toLowerCase().includes(search) ||
        p.propertyName?.toLowerCase().includes(search) ||
        p.customerName?.toLowerCase().includes(search)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (statusFilter === 'ready') return p.pendingServices === 0;
        if (statusFilter === 'pending_vendor') return p.pendingServices > 0;
        return true;
      });
    }
    
    // Property type filter
    if (propertyTypeFilter !== 'all') {
      filtered = filtered.filter(p => p.propertyType === propertyTypeFilter);
    }
    
    // Zone filter
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(p => p.zone === zoneFilter);
    }
    
    // Package filter
    if (packageFilter !== 'all') {
      filtered = filtered.filter(p => p.packageName === packageFilter);
    }
    
    // Date filter
    if (startDate) {
      filtered = filtered.filter(p => new Date(p.addedOn) >= new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => new Date(p.addedOn) <= end);
    }
    
    return filtered;
  };

  const filteredProperties = getFilteredProperties();
  
  // Pagination
  const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProperties = filteredProperties.slice(startIndex, startIndex + itemsPerPage);

  // Calculate stats
  const stats = {
    pendingProperties: properties.length,
    totalServices: properties.reduce((sum, p) => sum + (p.totalServices || 0), 0),
    assignedVendors: properties.reduce((sum, p) => sum + (p.assignedVendors || 0), 0),
    withoutVendor: properties.reduce((sum, p) => sum + (p.pendingServices || 0), 0),
    overdue: properties.filter(p => {
      const addedDate = new Date(p.addedOn);
      const daysSince = Math.floor((new Date() - addedDate) / (1000 * 60 * 60 * 24));
      return daysSince > 7;
    }).length
  };

  const vendorAssignmentPercent = stats.totalServices > 0 
    ? Math.round((stats.assignedVendors / stats.totalServices) * 100) 
    : 0;

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPropertyTypeFilter('all');
    setZoneFilter('all');
    setPackageFilter('all');
    setVendorFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Handle schedule action
  const handleSchedule = (property) => {
    setSelectedProperty(property);
    // Navigate to property scheduling screen with property context
    const basePath = portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : portalType === 'coordinator' ? '/coordinator' : portalType === 'supervisor' ? '/supervisor' : '';
    navigate(`${basePath}/schedules/property/${property.id}`, { state: { property } });
  };

  // Handle assign vendor action
  const handleAssignVendor = (property, service = null) => {
    setSelectedProperty(property);
    // If specific service provided, use it; otherwise pick first unassigned service
    if (service) {
      setSelectedService(service);
    } else {
      const unassignedService = property.services?.find(s => !s.vendorAssigned);
      setSelectedService(unassignedService || property.services?.[0] || { name: 'General Service', frequency: 'Monthly', visits: 1 });
    }
    setShowAssignVendorModal(true);
  };

  // Handle vendor assigned callback
  const handleVendorAssigned = (assignmentData) => {
    // Update local state
    setProperties(prevProperties => 
      prevProperties.map(p => {
        if (p.id === selectedProperty?.id) {
          const updatedServices = p.services.map(s => 
            s.name === assignmentData.service
              ? { ...s, vendorAssigned: true, vendorName: assignmentData.vendorName, vendorId: assignmentData.vendorId }
              : s
          );
          const assignedCount = updatedServices.filter(s => s.vendorAssigned).length;
          return {
            ...p,
            services: updatedServices,
            assignedVendors: assignedCount,
            pendingServices: Math.max(0, p.totalServices - assignedCount)
          };
        }
        return p;
      })
    );
    
    // Refresh data after a short delay
    setTimeout(() => fetchPendingProperties(true), 1000);
  };

  // Handle view services
  const handleViewServices = (property) => {
    setSelectedProperty(property);
    setShowServicesModal(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading pending schedules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Property Schedules</h1>
          <nav className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <Link to={portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '/'} className="hover:text-blue-600">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Scheduling</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900">Pending Property Schedules</span>
          </nav>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Range */}
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          
          {/* Notification Bell */}
          <button className="relative p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Bell className="w-5 h-5 text-gray-500" />
          </button>
          
          {/* New Schedule Button */}
          <button
            onClick={() => {
              const basePath = portalType === 'franchise' ? '/fp' : 
                              portalType === 'manager' ? '/manager' : 
                              portalType === 'coordinator' ? '/coordinator' : 
                              portalType === 'supervisor' ? '/supervisor' : 
                              '/employee';
              navigate(`${basePath}/schedules/calendar`);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">New Schedule</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* Stats Cards - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Pending Properties */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow min-h-[100px] sm:min-h-[120px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Pending</p>
              <p className="text-[10px] sm:text-xs text-gray-400">Properties</p>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.pendingProperties}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Ready to Schedule</p>
          </div>
        </div>

        {/* Services Pending */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow min-h-[100px] sm:min-h-[120px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Services</p>
              <p className="text-[10px] sm:text-xs text-gray-400">Pending</p>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalServices}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Total Services</p>
          </div>
        </div>

        {/* Vendors Assigned */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow min-h-[100px] sm:min-h-[120px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Vendors</p>
              <p className="text-[10px] sm:text-xs text-gray-400">Assigned</p>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.assignedVendors}/{stats.totalServices}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">({vendorAssignmentPercent}%)</p>
          </div>
        </div>

        {/* Without Vendor */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow min-h-[100px] sm:min-h-[120px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <UserX className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Without</p>
              <p className="text-[10px] sm:text-xs text-gray-400">Vendor</p>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.withoutVendor}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Services</p>
          </div>
        </div>

        {/* Overdue to Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-md transition-shadow min-h-[100px] sm:min-h-[120px]">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 truncate">Overdue</p>
              <p className="text-[10px] sm:text-xs text-gray-400">to Schedule</p>
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.overdue}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">Properties</p>
          </div>
        </div>
      </div>

      {/* Filters & Search - Single Row */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-3 min-w-max">
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-28 sm:w-32 pl-9 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          
          {/* Divider - hidden on mobile */}
          <div className="hidden sm:block h-8 w-px bg-gray-200 flex-shrink-0"></div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="min-w-[100px] flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none cursor-pointer text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="ready">Ready</option>
            <option value="pending_vendor">Pending Vendor</option>
          </select>

          {/* Property Type Filter */}
          <select
            value={propertyTypeFilter}
            onChange={(e) => { setPropertyTypeFilter(e.target.value); setCurrentPage(1); }}
            className="min-w-[130px] flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none cursor-pointer text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Property Types</option>
            <option value="Apartment">Apartment</option>
            <option value="Villa">Villa</option>
            <option value="Gated Community">Gated Community</option>
            <option value="Plot">Plot</option>
            <option value="Flat">Flat</option>
          </select>

          {/* Zone Filter */}
          <select
            value={zoneFilter}
            onChange={(e) => { setZoneFilter(e.target.value); setCurrentPage(1); }}
            className="min-w-[95px] flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none cursor-pointer text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Zones</option>
            {zones.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>

          {/* Package Filter */}
          <select
            value={packageFilter}
            onChange={(e) => { setPackageFilter(e.target.value); setCurrentPage(1); }}
            className="min-w-[110px] max-w-[180px] flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none cursor-pointer text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Packages</option>
            {packages.map(pkg => (
              <option key={pkg.id || pkg.packageId || pkg.packageName} value={pkg.name || pkg.packageName}>
                {pkg.name || pkg.packageName}
              </option>
            ))}
          </select>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
            className="min-w-[105px] max-w-[160px] flex-shrink-0 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none cursor-pointer text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id || v.vendorId} value={v.vendorId}>{v.ownerName || v.companyName}</option>
            ))}
          </select>

          {/* Export Button */}
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 flex-shrink-0">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Properties Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Property ID</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Property Name</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Property Type</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Zone</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Package</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Services</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Vendors Assigned</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Pending Services</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Payment</th>
                <th className="text-left px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Added On</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedProperties.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <CalendarClock className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">No pending property schedules</p>
                      <p className="text-sm text-gray-400 mt-1 max-w-md">Properties with paid invoices will appear here for scheduling</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProperties.map((property, index) => (
                  <tr 
                    key={property.id} 
                    className={`hover:bg-blue-50/50 transition-all duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                  >
                    {/* Property ID */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-blue-600 font-mono">{property.propertyId}</span>
                        {property.isNew && (
                          <span className="inline-flex w-fit px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full uppercase">
                            New
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Property Name */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{property.propertyName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{property.customerName || 'N/A'}</p>
                    </td>
                    
                    {/* Property Type */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-700">{property.propertyType}</span>
                    </td>
                    
                    {/* Zone */}
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 rounded-full whitespace-nowrap">
                        {property.zone}
                      </span>
                    </td>
                    
                    {/* Package */}
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
                        <span className="text-sm font-medium text-purple-700">{property.packageName}</span>
                      </div>
                    </td>
                    
                    {/* Services */}
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleViewServices(property)}
                        className="text-blue-600 font-semibold underline hover:text-blue-800 transition-colors cursor-pointer"
                        title="View Services"
                      >
                        {property.totalServices} <span className="text-xs font-normal">view</span>
                      </button>
                    </td>
                    
                    {/* Vendors Assigned */}
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                        property.assignedVendors === property.totalServices 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {property.assignedVendors}/{property.totalServices}
                        {property.assignedVendors === property.totalServices && (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </div>
                    </td>
                    
                    {/* Pending Services */}
                    <td className="px-6 py-4 text-center">
                      {property.pendingServices > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-red-600 font-bold">{property.pendingServices}</span>
                          <span className="text-xs text-red-500">Assign Vendor</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    
                    {/* Payment */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase ${
                        property.paymentStatus?.toLowerCase() === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {property.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    
                    {/* Added On */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 whitespace-nowrap">
                        {new Date(property.addedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(property.addedOn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => property.pendingServices === 0 ? handleSchedule(property) : handleAssignVendor(property)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                        >
                          {property.pendingServices === 0 ? 'Schedule' : 'Assign Vendor'}
                        </button>
                        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredProperties.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProperties.length)} of {filteredProperties.length} pending properties
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHelpModal(false)}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">How Scheduling Works</h2>
              <button onClick={() => setShowHelpModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Customer Payment</h3>
                    <p className="text-sm text-gray-600 mt-1">Once a customer pays for their AMC package, the property appears in the Pending Property Schedules queue.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Vendor Assignment</h3>
                    <p className="text-sm text-gray-600 mt-1">Assign vendors to each service included in the package. Vendors are filtered by service capability, zone, and active status.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Create Schedule</h3>
                    <p className="text-sm text-gray-600 mt-1">Once all vendors are assigned, click "Schedule" to set up the recurring service calendar for each service.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-green-600">4</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Automatic Work Orders</h3>
                    <p className="text-sm text-gray-600 mt-1">Work orders are automatically generated before each scheduled service visit, ensuring timely service delivery.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Modal - View all services with vendor assignments */}
      {showServicesModal && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowServicesModal(false)}>
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Service & Vendor Assignments</h2>
                <p className="text-sm text-gray-500 mt-0.5">{selectedProperty.propertyName} ({selectedProperty.propertyId})</p>
              </div>
              <button onClick={() => setShowServicesModal(false)} className="p-2 hover:bg-white rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedProperty.services && selectedProperty.services.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 uppercase">Service</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">Frequency</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">Visits</th>
                      <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600 uppercase">Assigned Vendor</th>
                      <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedProperty.services.map((service, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-gray-900">{service.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {service.frequency}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className="font-medium text-gray-900">{service.visits}</span>
                        </td>
                        <td className="py-3 px-2">
                          {service.vendorAssigned ? (
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-700 font-medium">{service.vendorName}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm text-yellow-700">No Vendor Assigned</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {service.vendorAssigned ? (
                            <button
                              onClick={() => {
                                setShowServicesModal(false);
                                handleAssignVendor(selectedProperty, service);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Change
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setShowServicesModal(false);
                                handleAssignVendor(selectedProperty, service);
                              }}
                              className="px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors"
                            >
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No services found for this property</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-green-600">{selectedProperty.assignedVendors}</span> of{' '}
                <span className="font-medium">{selectedProperty.totalServices}</span> services have vendors assigned
              </div>
              <button
                onClick={() => setShowServicesModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Assignment Modal */}
      <VendorAssignmentModal
        isOpen={showAssignVendorModal}
        onClose={() => {
          setShowAssignVendorModal(false);
          setSelectedService(null);
        }}
        property={selectedProperty}
        service={selectedService}
        portalType={portalType}
        onVendorAssigned={handleVendorAssigned}
      />
    </div>
  );
};

export default PendingPropertySchedules;
