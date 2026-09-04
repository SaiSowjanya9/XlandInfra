import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, Download, ChevronLeft, ChevronRight,
  RefreshCw, CheckCircle, AlertCircle, XCircle, Clock3, CalendarDays, 
  Users, Building2, List, MapPin, Eye, Edit2, X, FileText
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

// TODO: Set to false when backend is deployed
const USE_MOCK_DATA = true;

// Mock data for development
const MOCK_SCHEDULES = [
  { id: 1, visitId: 'VIS-001', propertyId: 'PROP-101', propertyName: 'Sunrise Apartments', propertyType: 'Apartment', customerName: 'Rajesh Kumar', serviceName: 'Pest Control', serviceCategory: 'Pest Control', vendorId: 1, vendorCode: 'VND-001', vendorName: 'ABC Pest Solutions', visitNumber: 1, totalVisits: 12, targetDate: '2024-09-15', scheduledDate: '2024-09-15', scheduledTime: '10:00:00', originalDate: null, isRescheduled: false, zone: 'Zone A', workOrderId: 'WO-2024-001', workOrderStatus: 'in_progress', status: 'scheduled' },
  { id: 2, visitId: 'VIS-002', propertyId: 'PROP-102', propertyName: 'Green Valley Villa', propertyType: 'Villa', customerName: 'Priya Sharma', serviceName: 'Deep Cleaning', serviceCategory: 'Cleaning', vendorId: 2, vendorCode: 'VND-002', vendorName: 'CleanPro Services', visitNumber: 2, totalVisits: 6, targetDate: '2024-09-16', scheduledDate: '2024-09-18', scheduledTime: '14:00:00', originalDate: '2024-09-16', isRescheduled: true, zone: 'Zone B', workOrderId: null, workOrderStatus: null, status: 'rescheduled' },
  { id: 3, visitId: 'VIS-003', propertyId: 'PROP-103', propertyName: 'Royal Heights', propertyType: 'Apartment', customerName: 'Amit Patel', serviceName: 'AC Service', serviceCategory: 'HVAC', vendorId: 3, vendorCode: 'VND-003', vendorName: 'CoolTech AC', visitNumber: 1, totalVisits: 4, targetDate: '2024-09-10', scheduledDate: '2024-09-10', scheduledTime: '09:00:00', originalDate: null, isRescheduled: false, zone: 'Zone A', workOrderId: 'WO-2024-002', workOrderStatus: 'completed', status: 'completed' },
  { id: 4, visitId: 'VIS-004', propertyId: 'PROP-104', propertyName: 'Lake View Residency', propertyType: 'Villa', customerName: 'Sneha Reddy', serviceName: 'Plumbing', serviceCategory: 'Plumbing', vendorId: 4, vendorCode: 'VND-004', vendorName: 'QuickFix Plumbers', visitNumber: 3, totalVisits: 12, targetDate: '2024-09-20', scheduledDate: '2024-09-20', scheduledTime: '11:00:00', originalDate: null, isRescheduled: false, zone: 'Zone C', workOrderId: null, workOrderStatus: null, status: 'upcoming' },
  { id: 5, visitId: 'VIS-005', propertyId: 'PROP-105', propertyName: 'Paradise Towers', propertyType: 'Apartment', customerName: 'Vikram Singh', serviceName: 'Pest Control', serviceCategory: 'Pest Control', vendorId: 1, vendorCode: 'VND-001', vendorName: 'ABC Pest Solutions', visitNumber: 5, totalVisits: 12, targetDate: '2024-09-05', scheduledDate: '2024-09-05', scheduledTime: '15:00:00', originalDate: null, isRescheduled: false, zone: 'Zone B', workOrderId: 'WO-2024-003', workOrderStatus: 'in_progress', status: 'in_progress' },
  { id: 6, visitId: 'VIS-006', propertyId: 'PROP-106', propertyName: 'Ocean Breeze Apartments', propertyType: 'Apartment', customerName: 'Meera Nair', serviceName: 'Electrical', serviceCategory: 'Electrical', vendorId: 5, vendorCode: 'VND-005', vendorName: 'PowerFix Electricals', visitNumber: 1, totalVisits: 2, targetDate: '2024-08-25', scheduledDate: '2024-08-25', scheduledTime: '10:00:00', originalDate: null, isRescheduled: false, zone: 'Zone A', workOrderId: 'WO-2024-004', workOrderStatus: 'cancelled', status: 'cancelled' },
  { id: 7, visitId: 'VIS-007', propertyId: 'PROP-107', propertyName: 'Silver Oak Villa', propertyType: 'Villa', customerName: 'Karthik Menon', serviceName: 'Deep Cleaning', serviceCategory: 'Cleaning', vendorId: 2, vendorCode: 'VND-002', vendorName: 'CleanPro Services', visitNumber: 4, totalVisits: 6, targetDate: '2024-08-20', scheduledDate: '2024-08-20', scheduledTime: '09:30:00', originalDate: null, isRescheduled: false, zone: 'Zone C', workOrderId: 'WO-2024-005', workOrderStatus: 'completed', status: 'completed' },
  { id: 8, visitId: 'VIS-008', propertyId: 'PROP-101', propertyName: 'Sunrise Apartments', propertyType: 'Apartment', customerName: 'Rajesh Kumar', serviceName: 'Pest Control', serviceCategory: 'Pest Control', vendorId: 1, vendorCode: 'VND-001', vendorName: 'ABC Pest Solutions', visitNumber: 2, totalVisits: 12, targetDate: '2024-10-15', scheduledDate: '2024-10-15', scheduledTime: '10:00:00', originalDate: null, isRescheduled: false, zone: 'Zone A', workOrderId: null, workOrderStatus: null, status: 'scheduled' },
  { id: 9, visitId: 'VIS-009', propertyId: 'PROP-108', propertyName: 'Palm Grove Estate', propertyType: 'Independent House', customerName: 'Ananya Iyer', serviceName: 'AC Service', serviceCategory: 'HVAC', vendorId: 3, vendorCode: 'VND-003', vendorName: 'CoolTech AC', visitNumber: 2, totalVisits: 4, targetDate: '2024-09-01', scheduledDate: '2024-09-01', scheduledTime: '14:00:00', originalDate: null, isRescheduled: false, zone: 'Zone B', workOrderId: 'WO-2024-006', workOrderStatus: 'completed', status: 'completed' },
  { id: 10, visitId: 'VIS-010', propertyId: 'PROP-109', propertyName: 'Emerald Heights', propertyType: 'Apartment', customerName: 'Suresh Babu', serviceName: 'Pest Control', serviceCategory: 'Pest Control', vendorId: 1, vendorCode: 'VND-001', vendorName: 'ABC Pest Solutions', visitNumber: 1, totalVisits: 12, targetDate: '2024-08-15', scheduledDate: '2024-08-15', scheduledTime: '11:00:00', originalDate: null, isRescheduled: false, zone: 'Zone A', workOrderId: 'WO-2024-007', workOrderStatus: 'overdue', status: 'overdue' },
  { id: 11, visitId: 'VIS-011', propertyId: 'PROP-110', propertyName: 'Crystal Bay Residency', propertyType: 'Villa', customerName: 'Divya Krishnan', serviceName: 'Plumbing', serviceCategory: 'Plumbing', vendorId: 4, vendorCode: 'VND-004', vendorName: 'QuickFix Plumbers', visitNumber: 1, totalVisits: 12, targetDate: '2024-09-22', scheduledDate: '2024-09-22', scheduledTime: '10:30:00', originalDate: null, isRescheduled: false, zone: 'Zone C', workOrderId: null, workOrderStatus: null, status: 'scheduled' },
  { id: 12, visitId: 'VIS-012', propertyId: 'PROP-111', propertyName: 'Maple Gardens', propertyType: 'Apartment', customerName: 'Rahul Verma', serviceName: 'Deep Cleaning', serviceCategory: 'Cleaning', vendorId: 2, vendorCode: 'VND-002', vendorName: 'CleanPro Services', visitNumber: 1, totalVisits: 6, targetDate: '2024-09-25', scheduledDate: '2024-09-25', scheduledTime: '09:00:00', originalDate: null, isRescheduled: false, zone: 'Zone B', workOrderId: null, workOrderStatus: null, status: 'scheduled' },
];

// Function to calculate stats from mock data
const calculateMockStats = (data) => {
  return {
    total: data.length,
    scheduled: data.filter(s => s.status === 'scheduled').length,
    upcoming: data.filter(s => s.status === 'upcoming').length,
    inProgress: data.filter(s => s.status === 'in_progress').length,
    completed: data.filter(s => s.status === 'completed').length,
    rescheduled: data.filter(s => s.status === 'rescheduled').length,
    cancelled: data.filter(s => s.status === 'cancelled').length,
    overdue: data.filter(s => s.status === 'overdue').length
  };
};

const MOCK_SERVICES = [
  { id: 1, name: 'Pest Control' },
  { id: 2, name: 'Deep Cleaning' },
  { id: 3, name: 'AC Service' },
  { id: 4, name: 'Plumbing' },
  { id: 5, name: 'Electrical' },
];

const MOCK_VENDORS = [
  { id: 1, name: 'ABC Pest Solutions', businessName: 'ABC Pest Solutions' },
  { id: 2, name: 'CleanPro Services', businessName: 'CleanPro Services' },
  { id: 3, name: 'CoolTech AC', businessName: 'CoolTech AC' },
  { id: 4, name: 'QuickFix Plumbers', businessName: 'QuickFix Plumbers' },
  { id: 5, name: 'PowerFix Electricals', businessName: 'PowerFix Electricals' },
];

const MOCK_ZONES = [
  { id: 1, name: 'Zone A' },
  { id: 2, name: 'Zone B' },
  { id: 3, name: 'Zone C' },
];

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'coordinator': 'coordinator',
    'supervisor': 'supervisor'
  };
  return portalMap[portalType] || 'admin';
};

// Role-based permissions
const getSchedulePermissions = (portalType) => {
  const permissions = {
    admin: { canView: true, canReschedule: true, canCancel: true, fullAccess: true },
    operations_manager: { canView: true, canReschedule: true, canCancel: true, fullAccess: false },
    franchise: { canView: true, canReschedule: true, canCancel: true, fullAccess: false },
    manager: { canView: true, canReschedule: true, canCancel: true, fullAccess: false },
    coordinator: { canView: true, canReschedule: false, canCancel: false, fullAccess: false },
    supervisor: { canView: true, canReschedule: false, canCancel: false, fullAccess: false },
    executive: { canView: true, canReschedule: false, canCancel: false, fullAccess: false }
  };
  return permissions[portalType] || permissions.executive;
};

const AllSchedulesPage = ({ portalType = 'admin' }) => {
  const navigate = useNavigate();
  const permissions = getSchedulePermissions(portalType);
  const apiPath = getApiPath(portalType);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0, scheduled: 0, upcoming: 0, workOrderCreated: 0,
    inProgress: 0, completed: 0, rescheduled: 0, cancelled: 0, overdue: 0
  });
  
  // Ref to store mock data that persists modifications
  const mockDataRef = useRef([...MOCK_SCHEDULES]);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    service: 'all',
    vendor: 'all',
    zone: 'all',
    propertyType: 'all'
  });
  
  // Dropdown data
  const [services, setServices] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [zones, setZones] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  
  // Modal states
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleSearch, setRescheduleSearch] = useState('');
  const [selectedForReschedule, setSelectedForReschedule] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [isSingleReschedule, setIsSingleReschedule] = useState(false); // true = single row action, false = header button

  // Fetch schedules
  const fetchSchedules = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    // Use mock data if enabled
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        let filteredSchedules = [...mockDataRef.current];
        
        // Apply filters
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredSchedules = filteredSchedules.filter(s => 
            s.propertyId.toLowerCase().includes(searchLower) ||
            s.propertyName.toLowerCase().includes(searchLower) ||
            s.serviceName.toLowerCase().includes(searchLower) ||
            s.vendorName.toLowerCase().includes(searchLower)
          );
        }
        if (filters.status !== 'all') {
          filteredSchedules = filteredSchedules.filter(s => s.status === filters.status);
        }
        if (filters.service !== 'all') {
          filteredSchedules = filteredSchedules.filter(s => s.serviceName === filters.service);
        }
        if (filters.vendor !== 'all') {
          filteredSchedules = filteredSchedules.filter(s => s.vendorName === filters.vendor);
        }
        if (filters.zone !== 'all') {
          filteredSchedules = filteredSchedules.filter(s => s.zone === filters.zone);
        }
        if (filters.propertyType !== 'all') {
          filteredSchedules = filteredSchedules.filter(s => s.propertyType === filters.propertyType);
        }
        
        // Pagination
        const startIdx = (currentPage - 1) * itemsPerPage;
        const paginatedSchedules = filteredSchedules.slice(startIdx, startIdx + itemsPerPage);
        
        setSchedules(paginatedSchedules);
        setTotalCount(filteredSchedules.length);
        setStats(calculateMockStats(mockDataRef.current));
        setLoading(false);
        setRefreshing(false);
      }, 500);
      return;
    }
    
    try {
      const token = getAuthToken();
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        ...(filters.search && { search: filters.search }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.service !== 'all' && { service: filters.service }),
        ...(filters.vendor !== 'all' && { vendor: filters.vendor }),
        ...(filters.zone !== 'all' && { zone: filters.zone }),
        ...(filters.propertyType !== 'all' && { propertyType: filters.propertyType })
      });
      
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/all?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const schedulesArray = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.schedules) ? data.schedules : []));
        setSchedules(schedulesArray);
        setTotalCount(data.total || data.totalCount || schedulesArray.length);
        if (data.stats) setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, filters, apiPath, itemsPerPage]);

  // Fetch filter options
  const fetchFilterOptions = useCallback(async () => {
    // Use mock data if enabled
    if (USE_MOCK_DATA) {
      setServices(MOCK_SERVICES);
      setVendors(MOCK_VENDORS);
      setZones(MOCK_ZONES);
      return;
    }
    
    try {
      const token = getAuthToken();
      
      // Fetch zones
      const zonesRes = await fetch(`${API_BASE}/api/${apiPath}/zones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (zonesRes.ok) {
        const data = await zonesRes.json();
        const zonesArray = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.zones) ? data.zones : []));
        setZones(zonesArray);
      }

      // Fetch vendors
      const vendorsRes = await fetch(`${API_BASE}/api/${apiPath}/vendors?status=active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (vendorsRes.ok) {
        const data = await vendorsRes.json();
        const vendorsArray = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.vendors) ? data.vendors : []));
        setVendors(vendorsArray);
      }

      // Fetch services
      const servicesRes = await fetch(`${API_BASE}/api/${apiPath}/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        const servicesArray = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.services) ? data.services : []));
        setServices(servicesArray);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  }, [apiPath]);

  useEffect(() => {
    fetchSchedules();
    fetchFilterOptions();
  }, [fetchSchedules, fetchFilterOptions]);

  // Status badge styles based on document Section 12
  const getStatusBadge = (status) => {
    const styles = {
      pending_schedule: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending Schedule' },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
      upcoming: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Upcoming' },
      work_order_created: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Work Order Created' },
      in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      rescheduled: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Rescheduled' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-500', label: 'Cancelled' },
      overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Overdue' }
    };
    return styles[status] || styles.scheduled;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
    });
  };

  const formatTime = (time) => {
    if (!time) return '-';
    try {
      if (time.includes('AM') || time.includes('PM')) return time;
      return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', minute: '2-digit', hour12: true 
      });
    } catch { return time; }
  };

  // Handle export to CSV
  const handleExport = () => {
    // Get data to export (use mockDataRef for mock mode, or filtered schedules)
    const dataToExport = USE_MOCK_DATA ? mockDataRef.current : schedules;
    
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Property ID',
      'Property Name',
      'Customer Name',
      'Service',
      'Vendor',
      'Visit',
      'Target Date',
      'Scheduled Date',
      'Time',
      'Zone',
      'Work Order',
      'Status'
    ];

    // Convert data to CSV rows
    const rows = dataToExport.map(schedule => [
      schedule.propertyId || '',
      schedule.propertyName || '',
      schedule.customerName || '',
      schedule.serviceName || '',
      schedule.vendorName || '',
      `${schedule.visitNumber} of ${schedule.totalVisits}`,
      schedule.targetDate || '',
      schedule.scheduledDate || '',
      schedule.scheduledTime || '',
      schedule.zone || '',
      schedule.workOrderId || '',
      schedule.status || ''
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `all_schedules_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle view details
  const handleViewDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setShowViewModal(true);
  };

  // Handle reschedule - open modal with schedule pre-selected (single row action)
  const handleReschedule = (schedule) => {
    setSelectedForReschedule(schedule);
    setNewDate('');
    setNewTime('');
    setRescheduleReason('');
    setRescheduleSearch('');
    setIsSingleReschedule(true); // Single schedule mode - hide table
    setShowRescheduleModal(true);
  };

  // Handle cancel click
  const handleCancelClick = (schedule) => {
    setSelectedSchedule(schedule);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // Handle cancel confirmation
  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }
    
    setCancelling(true);
    
    // For mock data, just update locally
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        // Update the persistent mock data ref
        mockDataRef.current = mockDataRef.current.map(s => 
          s.id === selectedSchedule.id ? { ...s, status: 'cancelled', cancelReason: cancelReason } : s
        );
        // Update stats
        setStats(calculateMockStats(mockDataRef.current));
        // Also update the displayed schedules
        setSchedules(prev => prev.map(s => 
          s.id === selectedSchedule.id ? { ...s, status: 'cancelled' } : s
        ));
        setShowCancelModal(false);
        setSelectedSchedule(null);
        setCancelling(false);
        alert('Schedule cancelled successfully');
      }, 500);
      return;
    }
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/${selectedSchedule.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason })
      });
      
      if (response.ok) {
        // Update the schedule in the list
        setSchedules(prev => prev.map(s => 
          s.id === selectedSchedule.id ? { ...s, status: 'cancelled' } : s
        ));
        setShowCancelModal(false);
        setSelectedSchedule(null);
        alert('Schedule cancelled successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to cancel schedule');
      }
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      alert('Error cancelling schedule');
    } finally {
      setCancelling(false);
    }
  };

  // Open reschedule modal
  // Open reschedule modal from header button (show all schedules list)
  const openRescheduleModal = () => {
    setShowRescheduleModal(true);
    setRescheduleSearch('');
    setSelectedForReschedule(null);
    setNewDate('');
    setNewTime('');
    setRescheduleReason('');
    setIsSingleReschedule(false); // All schedules mode - show table
  };

  // Get filtered schedules for reschedule modal (exclude completed/cancelled)
  const getReschedulableSchedules = () => {
    // Use mockDataRef for mock mode to show all schedules (not just paginated)
    const sourceData = USE_MOCK_DATA ? mockDataRef.current : schedules;
    const reschedulable = sourceData.filter(s => 
      s.status !== 'completed' && s.status !== 'cancelled'
    );
    
    if (!rescheduleSearch) return reschedulable;
    
    const searchLower = rescheduleSearch.toLowerCase();
    return reschedulable.filter(s =>
      s.propertyId?.toLowerCase().includes(searchLower) ||
      s.propertyName?.toLowerCase().includes(searchLower) ||
      s.serviceName?.toLowerCase().includes(searchLower) ||
      s.vendorName?.toLowerCase().includes(searchLower)
    );
  };

  // Convert dd/mm/yyyy to yyyy-mm-dd
  const convertDateToISO = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
    return `${year}-${month}-${day}`;
  };

  // Validate dd/mm/yyyy format
  const isValidDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 10) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2024) return false;
    return true;
  };

  // Handle confirm reschedule
  const handleConfirmReschedule = async () => {
    if (!selectedForReschedule) {
      alert('Please select a schedule to reschedule');
      return;
    }
    if (!newDate) {
      alert('Please enter a new date');
      return;
    }
    if (!isValidDate(newDate)) {
      alert('Please enter a valid date in dd/mm/yyyy format');
      return;
    }
    if (!newTime) {
      alert('Please select a new time');
      return;
    }
    if (!rescheduleReason.trim()) {
      alert('Please provide a reason for rescheduling');
      return;
    }

    const isoDate = convertDateToISO(newDate);
    
    setRescheduling(true);
    
    // For mock data, just update locally
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        // Update the persistent mock data ref
        mockDataRef.current = mockDataRef.current.map(s => 
          s.id === selectedForReschedule.id 
            ? { 
                ...s, 
                originalDate: s.scheduledDate,
                scheduledDate: isoDate,
                scheduledTime: newTime,
                isRescheduled: true,
                status: 'rescheduled'
              } 
            : s
        );
        // Update stats
        setStats(calculateMockStats(mockDataRef.current));
        // Also update the displayed schedules
        setSchedules(prev => prev.map(s => 
          s.id === selectedForReschedule.id 
            ? { 
                ...s, 
                originalDate: s.scheduledDate,
                scheduledDate: isoDate,
                scheduledTime: newTime,
                isRescheduled: true,
                status: 'rescheduled'
              } 
            : s
        ));
        setShowRescheduleModal(false);
        setSelectedForReschedule(null);
        setRescheduling(false);
        alert('Schedule rescheduled successfully');
      }, 500);
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/visits/${selectedForReschedule.id}/reschedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          newDate: isoDate, 
          newTimeStart: newTime,
          reason: rescheduleReason 
        })
      });
      
      if (response.ok) {
        setSchedules(prev => prev.map(s => 
          s.id === selectedForReschedule.id 
            ? { ...s, scheduledDate: isoDate, isRescheduled: true, status: 'rescheduled' } 
            : s
        ));
        setShowRescheduleModal(false);
        setSelectedForReschedule(null);
        alert('Schedule rescheduled successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Error rescheduling schedule');
    } finally {
      setRescheduling(false);
    }
  };

  // Stats cards based on document Section 12 statuses
  const statsCards = [
    { label: 'Total', value: stats.total || 0, icon: CalendarDays, color: 'bg-blue-500' },
    { label: 'Scheduled', value: stats.scheduled || 0, icon: Calendar, color: 'bg-blue-500' },
    { label: 'Upcoming', value: stats.upcoming || 0, icon: Clock3, color: 'bg-indigo-500' },
    { label: 'In Progress', value: stats.inProgress || 0, icon: RefreshCw, color: 'bg-amber-500' },
    { label: 'Completed', value: stats.completed || 0, icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Rescheduled', value: stats.rescheduled || 0, icon: RefreshCw, color: 'bg-orange-500' },
    { label: 'Overdue', value: stats.overdue || 0, icon: AlertCircle, color: 'bg-red-500' }
  ];

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Schedules</h1>
            <p className="text-sm text-gray-500 mt-1">
              View all schedule occurrences across properties
            </p>
          </div>
          <div className="flex items-center gap-3">
            {permissions.canReschedule && (
              <button
                onClick={openRescheduleModal}
                className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 flex items-center gap-2 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Reschedule
              </button>
            )}
            <button
              onClick={() => fetchSchedules(true)}
              disabled={refreshing}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-7 gap-3 mb-6">
          {statsCards.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${stat.color} bg-opacity-10 flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Property ID, Name, Service..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="upcoming">Upcoming</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="overdue">Overdue</option>
            </select>

            {/* Service Filter */}
            <select
              value={filters.service}
              onChange={(e) => setFilters({ ...filters, service: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Services</option>
              {services.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>

            {/* Vendor Filter */}
            <select
              value={filters.vendor}
              onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id || v.name} value={v.name || v.businessName}>{v.name || v.businessName}</option>
              ))}
            </select>

            {/* Zone Filter */}
            <select
              value={filters.zone}
              onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones</option>
              {zones.map(z => (
                <option key={z.id || z.name} value={z.name}>{z.name}</option>
              ))}
            </select>

            {/* Export */}
            <button 
              onClick={handleExport}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Clear Filters */}
            {(filters.search || filters.status !== 'all' || filters.service !== 'all' || 
              filters.vendor !== 'all' || filters.zone !== 'all') && (
              <button
                onClick={() => setFilters({ search: '', status: 'all', service: 'all', vendor: 'all', zone: 'all', propertyType: 'all' })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Visit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Target Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Scheduled Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Work Order</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">Loading schedules...</p>
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No schedules found</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  schedules.map((schedule, index) => {
                    const statusStyle = getStatusBadge(schedule.status);
                    return (
                      <tr key={schedule.id || index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-blue-600">{schedule.propertyId}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{schedule.propertyName}</p>
                          <p className="text-xs text-gray-500">{schedule.customerName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{schedule.serviceName}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{schedule.vendorName || '-'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{schedule.visitNumber} of {schedule.totalVisits}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{formatDate(schedule.targetDate)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${schedule.isRescheduled ? 'text-orange-600 font-medium' : 'text-gray-900'}`}>
                            {formatDate(schedule.scheduledDate)}
                          </span>
                          {schedule.isRescheduled && schedule.originalDate && (
                            <p className="text-xs text-gray-400">Was: {formatDate(schedule.originalDate)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-700">{formatTime(schedule.scheduledTime)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{schedule.zone || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {schedule.workOrderId ? (
                            <span className="text-sm text-blue-600 font-medium">{schedule.workOrderId}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => handleViewDetails(schedule)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {permissions.canReschedule && schedule.status !== 'completed' && schedule.status !== 'cancelled' && (
                              <button 
                                onClick={() => handleReschedule(schedule)}
                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                title="Reschedule"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {permissions.canCancel && schedule.status !== 'completed' && schedule.status !== 'cancelled' && (
                              <button 
                                onClick={() => handleCancelClick(schedule)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount.toLocaleString()} schedules
              </p>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className={`w-8 h-8 text-sm font-medium rounded ${
                        pageNum === currentPage ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {showViewModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Schedule Details</h2>
              <button
                onClick={() => { setShowViewModal(false); setSelectedSchedule(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Property ID</label>
                    <p className="text-sm font-medium text-blue-600">{selectedSchedule.propertyId}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Property Name</label>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.propertyName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Customer</label>
                    <p className="text-sm text-gray-700">{selectedSchedule.customerName || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Service</label>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.serviceName}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Vendor</label>
                    <p className="text-sm text-gray-700">{selectedSchedule.vendorName || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Zone</label>
                    <p className="text-sm text-gray-700">{selectedSchedule.zone || '-'}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Visit Number</label>
                    <p className="text-sm font-medium text-gray-900">{selectedSchedule.visitNumber} of {selectedSchedule.totalVisits}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Target Date</label>
                    <p className="text-sm text-gray-700">{formatDate(selectedSchedule.targetDate)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Scheduled Date</label>
                    <p className={`text-sm ${selectedSchedule.isRescheduled ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>
                      {formatDate(selectedSchedule.scheduledDate)}
                      {selectedSchedule.isRescheduled && <span className="text-xs ml-1">(Rescheduled)</span>}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Time</label>
                    <p className="text-sm text-gray-700">{formatTime(selectedSchedule.scheduledTime)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Work Order</label>
                    <p className="text-sm text-blue-600 font-medium">{selectedSchedule.workOrderId || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(selectedSchedule.status).bg} ${getStatusBadge(selectedSchedule.status).text}`}>
                      {getStatusBadge(selectedSchedule.status).label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              {permissions.canCancel && selectedSchedule.status !== 'completed' && selectedSchedule.status !== 'cancelled' && (
                <button
                  onClick={() => { setShowViewModal(false); handleCancelClick(selectedSchedule); }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Cancel Schedule
                </button>
              )}
              {permissions.canReschedule && selectedSchedule.status !== 'completed' && selectedSchedule.status !== 'cancelled' && (
                <button
                  onClick={() => { setShowViewModal(false); handleReschedule(selectedSchedule); }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                >
                  Reschedule
                </button>
              )}
              <button
                onClick={() => { setShowViewModal(false); setSelectedSchedule(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Schedule Modal */}
      {showCancelModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Cancel Schedule</h2>
              <button
                onClick={() => { setShowCancelModal(false); setSelectedSchedule(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-700">
                  You are about to cancel the schedule for <strong>{selectedSchedule.serviceName}</strong> at <strong>{selectedSchedule.propertyName}</strong> on <strong>{formatDate(selectedSchedule.scheduledDate)}</strong>.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Cancellation *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please provide a reason for cancelling this schedule..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => { setShowCancelModal(false); setSelectedSchedule(null); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Keep Schedule
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling || !cancelReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal with Table View */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-2xl shadow-xl w-full ${isSingleReschedule ? 'max-w-xl' : 'max-w-5xl'} max-h-[90vh] overflow-hidden flex flex-col`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-orange-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Reschedule Service</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isSingleReschedule 
                    ? `Reschedule ${selectedForReschedule?.serviceName} at ${selectedForReschedule?.propertyName}`
                    : 'Select a schedule from the table below to reschedule'}
                </p>
              </div>
              <button
                onClick={() => { setShowRescheduleModal(false); setSelectedForReschedule(null); }}
                className="p-2 hover:bg-orange-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar - Only show in all schedules mode */}
            {!isSingleReschedule && (
              <div className="p-4 border-b bg-gray-50">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by Property ID, Name, Service, Vendor..."
                    value={rescheduleSearch}
                    onChange={(e) => setRescheduleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            {/* Schedule Table - Only show in all schedules mode */}
            {!isSingleReschedule && (
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Select</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Property</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Visit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Current Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getReschedulableSchedules().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No schedules available for rescheduling
                        </td>
                      </tr>
                    ) : (
                      getReschedulableSchedules().map((schedule) => {
                        const isSelected = selectedForReschedule?.id === schedule.id;
                        const statusStyle = getStatusBadge(schedule.status);
                        return (
                          <tr 
                            key={schedule.id} 
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-orange-50 border-l-4 border-l-orange-500' : 'hover:bg-gray-50'}`}
                            onClick={() => setSelectedForReschedule(schedule)}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="radio"
                                name="rescheduleSelect"
                                checked={isSelected}
                                onChange={() => setSelectedForReschedule(schedule)}
                                className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-blue-600">{schedule.propertyId}</p>
                              <p className="text-xs text-gray-500">{schedule.propertyName}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{schedule.serviceName}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{schedule.vendorName || '-'}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">{schedule.visitNumber} of {schedule.totalVisits}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{formatDate(schedule.scheduledDate)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-gray-700">{formatTime(schedule.scheduledTime)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                                {statusStyle.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Single Schedule Info - Only show in single reschedule mode */}
            {isSingleReschedule && selectedForReschedule && (
              <div className="p-4 bg-gray-50">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Property</label>
                      <p className="text-sm font-medium text-blue-600">{selectedForReschedule.propertyId}</p>
                      <p className="text-sm text-gray-700">{selectedForReschedule.propertyName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Service</label>
                      <p className="text-sm font-medium text-gray-900">{selectedForReschedule.serviceName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Vendor</label>
                      <p className="text-sm text-gray-700">{selectedForReschedule.vendorName || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Visit</label>
                      <p className="text-sm font-medium text-gray-900">{selectedForReschedule.visitNumber} of {selectedForReschedule.totalVisits}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Current Date</label>
                      <p className="text-sm text-gray-700">{formatDate(selectedForReschedule.scheduledDate)}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Current Time</label>
                      <p className="text-sm text-gray-700">{formatTime(selectedForReschedule.scheduledTime)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reschedule Form - Only shown when a schedule is selected */}
            {selectedForReschedule && (
              <div className={`p-4 ${isSingleReschedule ? '' : 'border-t'} bg-orange-50`}>
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    {isSingleReschedule ? 'New Schedule Details' : `Reschedule: ${selectedForReschedule.serviceName} at ${selectedForReschedule.propertyName}`}
                  </h3>
                  <div className={`grid ${isSingleReschedule ? 'grid-cols-1 gap-3' : 'grid-cols-3 gap-4'}`}>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Date * (dd/mm/yyyy)</label>
                      <input
                        type="text"
                        value={newDate}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9/]/g, '');
                          // Auto-insert slashes
                          if (val.length === 2 && !val.includes('/')) val += '/';
                          if (val.length === 5 && val.split('/').length === 2) val += '/';
                          if (val.length <= 10) setNewDate(val);
                        }}
                        placeholder="dd/mm/yyyy"
                        maxLength={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Time *</label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Reason *</label>
                      <input
                        type="text"
                        value={rescheduleReason}
                        onChange={(e) => setRescheduleReason(e.target.value)}
                        placeholder="e.g., Customer request, Vendor unavailable..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className={`flex ${isSingleReschedule ? 'justify-end' : 'justify-between'} items-center p-4 border-t bg-gray-50`}>
              {!isSingleReschedule && (
                <p className="text-sm text-gray-500">
                  {selectedForReschedule 
                    ? `Selected: ${selectedForReschedule.propertyName} - ${selectedForReschedule.serviceName}` 
                    : 'Select a schedule to reschedule'}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRescheduleModal(false); setSelectedForReschedule(null); }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReschedule}
                  disabled={!selectedForReschedule || !newDate || !newTime || !rescheduleReason.trim() || rescheduling}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {rescheduling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Confirm Reschedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllSchedulesPage;
