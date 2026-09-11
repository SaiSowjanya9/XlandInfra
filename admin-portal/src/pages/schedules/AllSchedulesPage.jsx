import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, Search, Filter, Download, ChevronLeft, ChevronRight, ChevronDown,
  RefreshCw, CheckCircle, AlertCircle, XCircle, Clock3, CalendarDays, 
  Users, Building2, List, MapPin, Eye, Edit2, X, FileText, Plus, Printer
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

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
    admin: { canView: true, canCreate: true, canReschedule: true, canCancel: true, fullAccess: true },
    operations_manager: { canView: true, canCreate: true, canReschedule: true, canCancel: true, fullAccess: false },
    franchise: { canView: true, canCreate: true, canReschedule: true, canCancel: true, fullAccess: false },
    manager: { canView: true, canCreate: true, canReschedule: true, canCancel: true, fullAccess: false },
    coordinator: { canView: true, canCreate: false, canReschedule: false, canCancel: false, fullAccess: false },
    supervisor: { canView: true, canCreate: false, canReschedule: false, canCancel: false, fullAccess: false },
    executive: { canView: true, canCreate: false, canReschedule: false, canCancel: false, fullAccess: false }
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
  
  // Expanded properties for grouped view
  const [expandedProperties, setExpandedProperties] = useState(new Set());
  
  // Group schedules by property
  const groupedSchedules = React.useMemo(() => {
    const groups = {};
    schedules.forEach(schedule => {
      const key = schedule.propertyId;
      if (!groups[key]) {
        groups[key] = {
          propertyId: schedule.propertyId,
          propertyName: schedule.propertyName,
          customerName: schedule.customerName,
          zone: schedule.zone,
          services: {}
        };
      }
      // Group by service within property
      const serviceName = schedule.serviceName;
      if (!groups[key].services[serviceName]) {
        groups[key].services[serviceName] = {
          serviceName,
          vendorName: schedule.vendorName,
          visits: [],
          totalVisits: schedule.totalVisits,
          scheduledCount: 0,
          completedCount: 0
        };
      }
      groups[key].services[serviceName].visits.push(schedule);
      if (schedule.status === 'scheduled') groups[key].services[serviceName].scheduledCount++;
      if (schedule.status === 'completed') groups[key].services[serviceName].completedCount++;
    });
    return Object.values(groups);
  }, [schedules]);
  
  const togglePropertyExpand = (propertyId) => {
    setExpandedProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(500); // Show all at once - no pagination
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };
  
  // Modal states
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  
  // Bulk cancel modal states
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [bulkCancelProperty, setBulkCancelProperty] = useState(null);
  const [bulkCancelReason, setBulkCancelReason] = useState('');
  const [rescheduleSearch, setRescheduleSearch] = useState('');
  const [selectedForReschedule, setSelectedForReschedule] = useState(null);
  
  // Services modal state
  const [servicesModal, setServicesModal] = useState({ show: false, services: [], propertyName: '' });
  
  // Service-level reschedule modal state
  const [showServiceRescheduleModal, setShowServiceRescheduleModal] = useState(false);
  const [serviceToReschedule, setServiceToReschedule] = useState(null);
  const [selectedVisitForReschedule, setSelectedVisitForReschedule] = useState(null);
  const [rescheduleScope, setRescheduleScope] = useState('this_only'); // 'this_only' or 'this_and_future'
  const [serviceRescheduleDate, setServiceRescheduleDate] = useState('');
  const [serviceRescheduleTime, setServiceRescheduleTime] = useState('');
  const [serviceRescheduleReason, setServiceRescheduleReason] = useState('');
  const [serviceRescheduling, setServiceRescheduling] = useState(false);
  
  // Service-level cancel modal state
  const [showServiceCancelModal, setShowServiceCancelModal] = useState(false);
  const [serviceToCancel, setServiceToCancel] = useState(null);
  const [serviceCancelReason, setServiceCancelReason] = useState('');
  const [serviceCancelling, setServiceCancelling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [isSingleReschedule, setIsSingleReschedule] = useState(false); // true = single row action, false = header button
  
  // Schedule Details PDF Modal states
  const [showScheduleDetailsModal, setShowScheduleDetailsModal] = useState(false);
  const [scheduleDetailsData, setScheduleDetailsData] = useState(null); // Original clicked schedule
  const [propertySchedules, setPropertySchedules] = useState([]); // All schedules for the property
  const [filteredPropertySchedules, setFilteredPropertySchedules] = useState([]);
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilterPdf, setStatusFilterPdf] = useState(''); // Status filter for PDF modal
  const [loadingPropertySchedules, setLoadingPropertySchedules] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const scheduleDetailsRef = useRef(null);

  // Fetch schedules
  const fetchSchedules = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
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

  // Handle print to PDF
  const handlePrint = async () => {
    const dataToExport = schedules;
    
    if (dataToExport.length === 0) {
      showToast('No data to print', 'error');
      return;
    }

    // Create print content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title></title>
        <style>
          @page { margin: 8mm; margin-top: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: Arial, sans-serif; }
          .content { padding: 15px 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #f3f4f6; padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; }
          td { padding: 8px; border: 1px solid #e5e7eb; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="background: #3a3a3a; padding: 15px 0; text-align: center;" bgcolor="#3a3a3a">
              <table align="center" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <img src="/logo.webp" alt="Logo" width="45" height="45" style="display: block;" />
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <div style="color: #D39A1A; font-size: 20px; font-weight: bold; letter-spacing: 2px; font-family: Arial, sans-serif;">XLAND INFRA</div>
                    <div style="color: #D39A1A; font-size: 10px; letter-spacing: 2px; margin-top: 2px; font-family: Arial, sans-serif;">— PVT LTD —</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #D39A1A; color: white; text-align: center; padding: 8px 0; font-weight: 600; font-size: 13px; letter-spacing: 1px; font-family: Arial, sans-serif;" bgcolor="#D39A1A">SCHEDULE REPORT</td>
          </tr>
        </table>
        <div class="content">
        <table>
          <thead>
            <tr>
              <th>Property ID</th>
              <th>Property Name</th>
              <th>Service</th>
              <th>Vendor</th>
              <th>Visit</th>
              <th>Scheduled Date</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${dataToExport.map(schedule => `
              <tr>
                <td>${schedule.propertyId || ''}</td>
                <td>${schedule.propertyName || ''}</td>
                <td>${schedule.serviceName || ''}</td>
                <td>${schedule.vendorName || ''}</td>
                <td>${schedule.visitNumber} of ${schedule.totalVisits}</td>
                <td>${schedule.scheduledDate ? new Date(schedule.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</td>
                <td>${schedule.scheduledTime || ''}</td>
                <td><span class="status-${schedule.status === 'completed' ? 'completed' : schedule.status === 'cancelled' ? 'cancelled' : 'scheduled'}">${schedule.status || 'Scheduled'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <p>XLAND INFRA Property Management System</p>
        </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Handle export to CSV
  const handleExport = () => {
    const dataToExport = schedules;
    
    if (dataToExport.length === 0) {
      showToast('No data to export', 'error');
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

  // Handle Schedule Details with PDF - open detailed modal and fetch all property schedules
  const handleScheduleDetails = async (schedule) => {
    setScheduleDetailsData(schedule);
    setServiceFilter('');
    setStatusFilterPdf(''); // Reset status filter
    setShowScheduleDetailsModal(true);
    setLoadingPropertySchedules(true);
    
    try {
      const token = getAuthToken();
      // Fetch all schedules for this property
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/all?search=${schedule.propertyId}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const allSchedules = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : (Array.isArray(data.schedules) ? data.schedules : []));
        // Filter to only include schedules for this exact property
        const propertyOnly = allSchedules.filter(s => s.propertyId === schedule.propertyId);
        setPropertySchedules(propertyOnly);
        setFilteredPropertySchedules(propertyOnly);
      }
    } catch (error) {
      console.error('Error fetching property schedules:', error);
      // Fallback to just the clicked schedule
      setPropertySchedules([schedule]);
      setFilteredPropertySchedules([schedule]);
    } finally {
      setLoadingPropertySchedules(false);
    }
  };

  // Get unique service names from current schedules
  const getUniqueServices = () => {
    const serviceSet = new Set();
    propertySchedules.forEach(s => {
      if (s.serviceName) serviceSet.add(s.serviceName);
    });
    return Array.from(serviceSet).sort();
  };

  // Get unique statuses from current schedules
  const getUniqueStatuses = () => {
    const statusSet = new Set();
    propertySchedules.forEach(s => {
      if (s.status) statusSet.add(s.status);
    });
    return Array.from(statusSet).sort();
  };

  // Apply all PDF modal filters (service + status)
  const applyPdfFilters = (serviceFlt, statusFlt) => {
    let filtered = [...propertySchedules];
    
    // Apply service filter
    if (serviceFlt && serviceFlt !== 'all') {
      filtered = filtered.filter(s => s.serviceName === serviceFlt);
    }
    
    // Apply status filter
    if (statusFlt && statusFlt !== 'all') {
      filtered = filtered.filter(s => s.status === statusFlt);
    }
    
    setFilteredPropertySchedules(filtered);
  };

  // Handle service filter change
  const handleServiceFilterChange = (value) => {
    setServiceFilter(value);
    applyPdfFilters(value, statusFilterPdf);
  };

  // Handle status filter change for PDF modal
  const handleStatusFilterPdfChange = (value) => {
    setStatusFilterPdf(value);
    applyPdfFilters(serviceFilter, value);
  };

  // Generate and download/print PDF
  const handleDownloadPDF = (printDirect = false) => {
    if (!scheduleDetailsRef.current || !scheduleDetailsData) return;
    
    setGeneratingPDF(true);
    
    try {
      const element = scheduleDetailsRef.current;
      const printContent = element.innerHTML;
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Schedule Report - ${scheduleDetailsData.propertyId}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .page-break { page-break-before: always; }
            }
            @page { margin: 10mm; }
            body { font-family: Arial, sans-serif; }
          </style>
        </head>
        <body class="bg-white p-4">
          ${printContent}
          <div class="text-center mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400">
            <p>Generated on ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <p>XLAND INFRA Property Management System</p>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        setGeneratingPDF(false);
      }, 500);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
      setGeneratingPDF(false);
    }
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
      showToast('Please provide a reason for cancellation', 'error');
      return;
    }
    
    setCancelling(true);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/visits/${selectedSchedule.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: cancelReason })
      });
      
      if (response.ok) {
        setSchedules(prev => prev.map(s => 
          s.id === selectedSchedule.id ? { ...s, status: 'cancelled' } : s
        ));
        setShowCancelModal(false);
        setSelectedSchedule(null);
        showToast('Schedule cancelled successfully', 'success');
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to cancel schedule', 'error');
      }
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      showToast('Error cancelling schedule', 'error');
    } finally {
      setCancelling(false);
    }
  };

  // Handle cancel all schedules for a property - opens modal
  const handleCancelPropertySchedules = (property) => {
    const allVisits = Object.values(property.services).flatMap(s => s.visits);
    const activeVisits = allVisits.filter(v => v.status !== 'completed' && v.status !== 'cancelled');
    
    if (activeVisits.length === 0) {
      return; // No active schedules
    }
    
    setBulkCancelProperty({ ...property, activeVisits });
    setBulkCancelReason('');
    setShowBulkCancelModal(true);
  };
  
  // Confirm bulk cancel from modal
  const handleConfirmBulkCancel = () => {
    if (!bulkCancelReason.trim()) return;
    cancelMultipleSchedules(bulkCancelProperty.activeVisits, bulkCancelReason);
    setShowBulkCancelModal(false);
    setBulkCancelProperty(null);
    setBulkCancelReason('');
  };

  // Cancel multiple schedules
  const cancelMultipleSchedules = async (visits, reason) => {
    setCancelling(true);
    
    try {
      const token = getAuthToken();
      
      for (const visit of visits) {
        try {
          await fetch(`${API_BASE}/api/schedules/visits/${visit.id}/cancel`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason })
          });
        } catch (err) {
          console.error('Error cancelling visit:', err);
        }
      }
      
      // Refresh the list
      fetchSchedules(true);
    } catch (error) {
      console.error('Error cancelling schedules:', error);
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
    const reschedulable = schedules.filter(s => 
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
      showToast('Please select a schedule', 'error');
      return;
    }
    if (!newDate) {
      showToast('Please enter a new date', 'error');
      return;
    }
    if (!isValidDate(newDate)) {
      showToast('Please enter a valid date (dd/mm/yyyy)', 'error');
      return;
    }
    if (!newTime) {
      showToast('Please select a new time', 'error');
      return;
    }
    if (!rescheduleReason.trim()) {
      showToast('Please provide a reason', 'error');
      return;
    }

    const isoDate = convertDateToISO(newDate);
    
    setRescheduling(true);

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
        showToast('Schedule rescheduled successfully', 'success');
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to reschedule', 'error');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      showToast('Error rescheduling schedule', 'error');
    } finally {
      setRescheduling(false);
    }
  };

  // Handle service-level reschedule - open modal
  const handleServiceReschedule = (service, property) => {
    const activeVisits = service.visits.filter(v => v.status !== 'completed' && v.status !== 'cancelled');
    setServiceToReschedule({
      serviceName: service.serviceName,
      vendorName: service.vendorName,
      propertyId: property.propertyId,
      propertyName: property.propertyName,
      visits: activeVisits
    });
    setSelectedVisitForReschedule(activeVisits[0] || null); // Default select first visit
    setRescheduleScope('this_only'); // Default to this visit only
    setServiceRescheduleDate('');
    setServiceRescheduleTime('');
    setServiceRescheduleReason('');
    setShowServiceRescheduleModal(true);
  };

  // Handle confirm service-level reschedule
  const handleConfirmServiceReschedule = async () => {
    if (!selectedVisitForReschedule) {
      showToast('Please select a visit to reschedule', 'error');
      return;
    }
    if (!serviceRescheduleDate) {
      showToast('Please enter a new date', 'error');
      return;
    }
    if (!isValidDate(serviceRescheduleDate)) {
      showToast('Please enter a valid date (dd/mm/yyyy)', 'error');
      return;
    }
    if (!serviceRescheduleTime) {
      showToast('Please select a new time', 'error');
      return;
    }
    if (!serviceRescheduleReason.trim()) {
      showToast('Please provide a reason', 'error');
      return;
    }

    const isoDate = convertDateToISO(serviceRescheduleDate);
    setServiceRescheduling(true);

    try {
      const token = getAuthToken();
      let successCount = 0;
      let failCount = 0;

      if (rescheduleScope === 'this_only') {
        // Reschedule only the selected visit
        const response = await fetch(`${API_BASE}/api/schedules/visits/${selectedVisitForReschedule.id}/reschedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            newDate: isoDate, 
            newTimeStart: serviceRescheduleTime,
            reason: serviceRescheduleReason 
          })
        });
        
        if (response.ok) {
          successCount = 1;
        } else {
          failCount = 1;
        }
      } else {
        // Reschedule this and all future visits
        const sortedVisits = [...serviceToReschedule.visits].sort(
          (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)
        );
        
        // Find selected visit index
        const selectedIndex = sortedVisits.findIndex(v => v.id === selectedVisitForReschedule.id);
        const visitsToReschedule = sortedVisits.slice(selectedIndex);
        
        // Calculate the date shift
        const selectedVisitDate = new Date(selectedVisitForReschedule.scheduledDate);
        const newDate = new Date(isoDate);
        const daysDiff = Math.round((newDate - selectedVisitDate) / (1000 * 60 * 60 * 24));

        for (const visit of visitsToReschedule) {
          try {
            const visitDate = new Date(visit.scheduledDate);
            visitDate.setDate(visitDate.getDate() + daysDiff);
            const newVisitDate = visitDate.toISOString().split('T')[0];

            const response = await fetch(`${API_BASE}/api/schedules/visits/${visit.id}/reschedule`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ 
                newDate: newVisitDate, 
                newTimeStart: serviceRescheduleTime,
                reason: serviceRescheduleReason 
              })
            });
            
            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            failCount++;
          }
        }
      }

      setShowServiceRescheduleModal(false);
      setServiceToReschedule(null);
      setSelectedVisitForReschedule(null);
      
      if (successCount > 0) {
        showToast(`Rescheduled ${successCount} visit(s) successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        fetchSchedules(true);
      } else {
        showToast('Failed to reschedule visit(s)', 'error');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      showToast('Error rescheduling', 'error');
    } finally {
      setServiceRescheduling(false);
    }
  };

  // Handle service-level cancel - open modal
  const handleServiceCancel = (service, property) => {
    setServiceToCancel({
      serviceName: service.serviceName,
      vendorName: service.vendorName,
      propertyId: property.propertyId,
      propertyName: property.propertyName,
      visits: service.visits.filter(v => v.status !== 'completed' && v.status !== 'cancelled')
    });
    setServiceCancelReason('');
    setShowServiceCancelModal(true);
  };

  // Handle confirm service-level cancel (bulk)
  const handleConfirmServiceCancel = async () => {
    if (!serviceToCancel || serviceToCancel.visits.length === 0) {
      showToast('No visits to cancel', 'error');
      return;
    }
    if (!serviceCancelReason.trim()) {
      showToast('Please provide a reason', 'error');
      return;
    }

    setServiceCancelling(true);

    try {
      const token = getAuthToken();
      let successCount = 0;
      let failCount = 0;

      for (const visit of serviceToCancel.visits) {
        try {
          const response = await fetch(`${API_BASE}/api/schedules/visits/${visit.id}/cancel`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ reason: serviceCancelReason })
          });
          
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }

      setShowServiceCancelModal(false);
      setServiceToCancel(null);
      
      if (successCount > 0) {
        showToast(`Cancelled ${successCount} visit(s) successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
        fetchSchedules(true);
      } else {
        showToast('Failed to cancel visits', 'error');
      }
    } catch (error) {
      console.error('Error cancelling service:', error);
      showToast('Error cancelling service', 'error');
    } finally {
      setServiceCancelling(false);
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
            {permissions.canCreate && (
              <button
                onClick={() => {
                  const basePath = portalType === 'franchise' ? '/fp' : portalType === 'manager' ? '/manager' : '';
                  navigate(`${basePath}/schedules/pending`);
                }}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Schedule
              </button>
            )}
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
                <option key={s.id || s.service_name || s.name} value={s.service_name || s.name}>{s.service_name || s.name}</option>
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
                <option key={v.id || v.vendor_id} value={v.owner_name || v.company_name || v.name || v.businessName}>{v.owner_name || v.company_name || v.name || v.businessName}</option>
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
                <option key={z.id || z.zone_name || z.name} value={z.zone_name || z.name}>{z.zone_name || z.name}</option>
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

            {/* Print */}
            <button 
              onClick={handlePrint}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"
              title="Print Schedule Report"
            >
              <Printer className="w-4 h-4" />
              Print
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

        {/* Schedule Table - Grouped by Property */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Property Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Zone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Services</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Visits</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Progress</th>
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
                ) : groupedSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No schedules found</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : (
                  groupedSchedules.map((property, index) => {
                    const isExpanded = expandedProperties.has(property.propertyId);
                    const serviceList = Object.values(property.services);
                    const totalVisits = serviceList.reduce((sum, s) => sum + s.visits.length, 0);
                    const completedVisits = serviceList.reduce((sum, s) => sum + s.completedCount, 0);
                    const scheduledVisits = serviceList.reduce((sum, s) => sum + s.scheduledCount, 0);
                    
                    return (
                      <React.Fragment key={property.propertyId}>
                        {/* Property Row */}
                        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => togglePropertyExpand(property.propertyId)}>
                          <td className="px-4 py-3">
                            <button className="p-1 hover:bg-gray-200 rounded">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-blue-600">{property.propertyId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{property.propertyName}</p>
                            <p className="text-xs text-gray-500">{property.customerName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="text-sm text-gray-700">{property.zone || '-'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setServicesModal({ 
                                  show: true, 
                                  services: serviceList.map(s => s.serviceName), 
                                  propertyName: property.propertyName 
                                });
                              }}
                              className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              {serviceList.length}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-gray-900">{totalVisits} visits</span>
                            <p className="text-xs text-gray-500">{serviceList.length}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full" 
                                  style={{ width: `${(completedVisits / totalVisits) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">{completedVisits}/{totalVisits}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleScheduleDetails(serviceList[0]?.visits[0]); }}
                                className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200"
                                title="View Details"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              {/* Reschedule and Cancel actions moved to service-level only */}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded Service Details */}
                        {isExpanded && serviceList.map((service, sIdx) => (
                          <tr key={`${property.propertyId}-${sIdx}`} className="bg-gray-50">
                            <td className="px-4 py-2"></td>
                            <td colSpan={7} className="px-4 py-3">
                              <div className="ml-4 p-3 bg-white rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                    <span className="font-medium text-gray-900">{service.serviceName}</span>
                                    <span className="text-sm text-gray-500">Vendor: {service.vendorName || 'Unassigned'}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{service.visits.length} visits</span>
                                    {permissions.canReschedule && service.visits.some(v => v.status !== 'completed' && v.status !== 'cancelled') && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleServiceReschedule(service, property); }}
                                        className="p-1 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded border border-orange-200"
                                        title={`Reschedule all ${service.serviceName} visits`}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {permissions.canCancel && service.visits.some(v => v.status !== 'completed' && v.status !== 'cancelled') && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleServiceCancel(service, property); }}
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-red-200"
                                        title={`Cancel all ${service.serviceName} visits`}
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {[...service.visits].sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)).slice(0, 12).map((visit, vIdx) => {
                                    return (
                                      <div 
                                        key={vIdx} 
                                        className={`px-3 py-1.5 rounded text-xs border ${visit.status === 'completed' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}
                                      >
                                        <span className="font-medium">{formatDate(visit.scheduledDate)}</span>
                                        {visit.scheduledTime && <span className="ml-1 text-gray-500">• {formatTime(visit.scheduledTime)}</span>}
                                      </div>
                                    );
                                  })}
                                  {service.visits.length > 12 && (
                                    <span className="px-2 py-1 text-xs text-gray-500">+{service.visits.length - 12} more</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer - Total Count */}
          {totalCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Total: {totalCount.toLocaleString()} schedules across {Object.keys(groupedSchedules).length} properties
              </p>
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {showViewModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
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

      {/* Schedule Details PDF Modal */}
      {showScheduleDetailsModal && scheduleDetailsData && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 pt-8 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-200 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Property Schedules</h2>
                  <p className="text-gray-500 text-sm">{scheduleDetailsData.propertyId} • {scheduleDetailsData.propertyName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF()}
                  disabled={generatingPDF || filteredPropertySchedules.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {generatingPDF ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      Print / Save PDF
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowScheduleDetailsModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filters - Outside PDF area */}
            <div className="px-5 py-3 border-b bg-white">
              <div className="flex items-center flex-wrap gap-4">
                {/* Service Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Service:</label>
                  <div className="relative">
                    <select
                      value={serviceFilter}
                      onChange={(e) => handleServiceFilterChange(e.target.value)}
                      className="w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white appearance-none cursor-pointer pr-8"
                    >
                      <option value="all">All Services</option>
                      {getUniqueServices().map(serviceName => (
                        <option key={serviceName} value={serviceName}>{serviceName}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Status:</label>
                  <div className="relative">
                    <select
                      value={statusFilterPdf}
                      onChange={(e) => handleStatusFilterPdfChange(e.target.value)}
                      className="w-36 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 bg-white appearance-none cursor-pointer pr-8"
                    >
                      <option value="all">All Status</option>
                      {getUniqueStatuses().map(status => (
                        <option key={status} value={status}>
                          {status === 'scheduled' ? 'Scheduled' : status === 'completed' ? 'Completed' : status === 'cancelled' ? 'Cancelled' : status}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <span className="text-sm text-gray-500 ml-auto">
                  {filteredPropertySchedules.length} of {propertySchedules.length} schedules
                </span>
              </div>
            </div>
            
            {/* PDF Content Area */}
            <div className="overflow-y-auto max-h-[calc(95vh-160px)]">
              <div ref={scheduleDetailsRef} className="p-5 bg-white">
                {/* PDF Header with Logo Banner - Full Width */}
                <div className="mb-5 -mx-5 -mt-5">
                  <div className="bg-[#3a3a3a] px-5 py-3 flex items-center justify-center gap-3">
                    <img src="/logo.webp" alt="XLAND INFRA" className="h-10 w-10 object-contain" />
                    <div className="flex flex-col items-center">
                      <h1 className="text-[#D39A1A] text-base font-bold tracking-wider">XLAND INFRA</h1>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-4 h-[1px] bg-[#D39A1A]"></span>
                        <span className="text-[#D39A1A] text-[8px] tracking-[0.15em]">PVT LTD</span>
                        <span className="w-4 h-[1px] bg-[#D39A1A]"></span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#D39A1A] text-center py-1">
                    <span className="text-white font-semibold text-xs tracking-wide">SCHEDULE REPORT</span>
                  </div>
                </div>

                {/* Property Info Summary - Single Line */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span><span className="text-gray-500">Property:</span> <span className="font-medium text-gray-800">{scheduleDetailsData.propertyId}</span></span>
                    <span><span className="text-gray-500">Name:</span> <span className="font-medium text-gray-800">{scheduleDetailsData.propertyName}</span></span>
                    <span><span className="text-gray-500">Customer:</span> <span className="text-gray-700">{scheduleDetailsData.customerName || '-'}</span></span>
                    <span><span className="text-gray-500">Zone:</span> <span className="text-gray-700">{scheduleDetailsData.zone || '-'}</span></span>
                  </div>
                </div>

                {/* Filter Applied Indicator */}
                {((serviceFilter && serviceFilter !== 'all') || (statusFilterPdf && statusFilterPdf !== 'all')) && (
                  <div className="mb-3 text-sm text-gray-600">
                    <span className="font-medium">Filtered by:</span>{' '}
                    {serviceFilter && serviceFilter !== 'all' && <span>Service: {serviceFilter}</span>}
                    {serviceFilter && serviceFilter !== 'all' && statusFilterPdf && statusFilterPdf !== 'all' && <span> | </span>}
                    {statusFilterPdf && statusFilterPdf !== 'all' && <span>Status: {statusFilterPdf === 'scheduled' ? 'Scheduled' : statusFilterPdf === 'completed' ? 'Completed' : statusFilterPdf === 'cancelled' ? 'Cancelled' : statusFilterPdf}</span>}
                    {' '}— Showing {filteredPropertySchedules.length} schedule(s)
                  </div>
                )}

                {/* Schedules Table */}
                {loadingPropertySchedules ? (
                  <div className="py-8 text-center">
                    <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading schedules...</p>
                  </div>
                ) : filteredPropertySchedules.length === 0 ? (
                  <div className="py-8 text-center">
                    <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No schedules found
                      {(serviceFilter && serviceFilter !== 'all') || (statusFilterPdf && statusFilterPdf !== 'all') ? ' with selected filters' : ''}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Group schedules by service */}
                    {Object.entries(
                      filteredPropertySchedules.reduce((acc, schedule) => {
                        const key = schedule.serviceName;
                        if (!acc[key]) {
                          acc[key] = {
                            serviceName: schedule.serviceName,
                            vendorName: schedule.vendorName,
                            frequency: schedule.frequency,
                            totalVisits: schedule.totalVisits,
                            visits: []
                          };
                        }
                        acc[key].visits.push(schedule);
                        return acc;
                      }, {})
                    ).map(([serviceName, serviceData], idx) => (
                      <div key={serviceName} className="border border-gray-200 rounded-lg bg-white" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        {/* Service Header */}
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-800 text-sm">{serviceName}</span>
                            <span className="text-xs text-gray-500">Vendor: {serviceData.vendorName || '-'} • {serviceData.visits.length} visits</span>
                          </div>
                        </div>
                        {/* Compact Table View - fits PDF */}
                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-3 py-1.5 text-center font-medium text-gray-600" style={{width: '40px'}}>#</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-600">Date</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-600">Time</th>
                              <th className="px-3 py-1.5 text-center font-medium text-gray-600" style={{width: '100px'}}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {serviceData.visits
                              .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
                              .map((visit, vIdx) => {
                                const isCompleted = visit.status === 'completed';
                                const isCancelled = visit.status === 'cancelled';
                                return (
                                  <tr key={visit.id || vIdx} className={vIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                    <td className="px-3 py-1.5 text-center text-gray-500">{vIdx + 1}</td>
                                    <td className="px-3 py-1.5 text-center text-gray-800">{formatDate(visit.scheduledDate)}</td>
                                    <td className="px-3 py-1.5 text-center text-gray-600">{formatTime(visit.scheduledTime)}</td>
                                    <td className="px-3 py-1.5 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                        isCompleted ? 'bg-green-100 text-green-700' : isCancelled ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {isCompleted ? 'Done' : isCancelled ? 'Cancelled' : 'Scheduled'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-6 pt-3 border-t border-gray-200 text-center text-xs text-gray-400">
                  <p>Generated on {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  <p className="mt-0.5">XLAND INFRA Property Management System</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cancel Modal */}
      {showBulkCancelModal && bulkCancelProperty && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel All Schedules</h3>
              <p className="text-sm text-gray-500 mt-1">
                Property: {bulkCancelProperty.propertyId} • {bulkCancelProperty.activeVisits?.length || 0} active schedule(s)
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Cancellation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={bulkCancelReason}
                onChange={(e) => setBulkCancelReason(e.target.value)}
                placeholder="Enter reason for cancelling all schedules..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { setShowBulkCancelModal(false); setBulkCancelProperty(null); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkCancel}
                disabled={!bulkCancelReason.trim() || cancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service-Level Cancel Modal */}
      {showServiceCancelModal && serviceToCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-red-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Cancel Service Schedules</h2>
                <p className="text-sm text-gray-600">
                  Cancel all {serviceToCancel.serviceName} visits
                </p>
              </div>
              <button
                onClick={() => { setShowServiceCancelModal(false); setServiceToCancel(null); }}
                className="p-1.5 hover:bg-red-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5">
              {/* Service Info */}
              <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Property</label>
                  <p className="text-sm font-medium text-blue-600">{serviceToCancel.propertyId}</p>
                  <p className="text-xs text-gray-600">{serviceToCancel.propertyName}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Service</label>
                  <p className="text-sm font-medium text-gray-900">{serviceToCancel.serviceName}</p>
                  <p className="text-xs text-gray-600">{serviceToCancel.visits.length} visit(s) to cancel</p>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> This will cancel all {serviceToCancel.visits.length} scheduled visit(s) for {serviceToCancel.serviceName}. This action cannot be undone.
                </p>
              </div>

              {/* Cancel Form */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Cancellation *</label>
                <textarea
                  value={serviceCancelReason}
                  onChange={(e) => setServiceCancelReason(e.target.value)}
                  placeholder="e.g., Service no longer required, Contract terminated..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { setShowServiceCancelModal(false); setServiceToCancel(null); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Keep Schedules
              </button>
              <button
                onClick={handleConfirmServiceCancel}
                disabled={!serviceCancelReason.trim() || serviceCancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {serviceCancelling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Cancel All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service-Level Reschedule Modal */}
      {showServiceRescheduleModal && serviceToReschedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-orange-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Reschedule {serviceToReschedule.serviceName}</h2>
                <p className="text-sm text-gray-600">
                  {serviceToReschedule.propertyId} • {serviceToReschedule.propertyName}
                </p>
              </div>
              <button
                onClick={() => { setShowServiceRescheduleModal(false); setServiceToReschedule(null); setSelectedVisitForReschedule(null); }}
                className="p-1.5 hover:bg-orange-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Select Visit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Visit to Reschedule *</label>
                <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg">
                  {serviceToReschedule.visits
                    .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
                    .map((visit, i) => (
                      <label 
                        key={visit.id} 
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${selectedVisitForReschedule?.id === visit.id ? 'bg-orange-50' : ''} ${i > 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <input
                          type="radio"
                          name="visitSelect"
                          checked={selectedVisitForReschedule?.id === visit.id}
                          onChange={() => setSelectedVisitForReschedule(visit)}
                          className="w-4 h-4 text-orange-600"
                        />
                        <span className="text-sm text-gray-700">
                          Visit {i + 1}: <span className="font-medium">{formatDate(visit.scheduledDate)}</span>
                          {visit.scheduledTime && <span className="text-gray-500 ml-1">• {formatTime(visit.scheduledTime)}</span>}
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Reschedule Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reschedule Scope</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${rescheduleScope === 'this_only' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="rescheduleScope"
                      checked={rescheduleScope === 'this_only'}
                      onChange={() => setRescheduleScope('this_only')}
                      className="w-4 h-4 text-orange-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">This Visit Only</p>
                      <p className="text-xs text-gray-500">Only reschedule the selected visit</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${rescheduleScope === 'this_and_future' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="rescheduleScope"
                      checked={rescheduleScope === 'this_and_future'}
                      onChange={() => setRescheduleScope('this_and_future')}
                      className="w-4 h-4 text-orange-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">This and Future Visits</p>
                      <p className="text-xs text-gray-500">Shift all visits from selected date onwards</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* New Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Date * (dd/mm/yyyy)</label>
                  <input
                    type="text"
                    value={serviceRescheduleDate}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9/]/g, '');
                      if (val.length === 2 && !val.includes('/')) val += '/';
                      if (val.length === 5 && val.split('/').length === 2) val += '/';
                      if (val.length <= 10) setServiceRescheduleDate(val);
                    }}
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Time *</label>
                  <input
                    type="time"
                    value={serviceRescheduleTime}
                    onChange={(e) => setServiceRescheduleTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  />
                </div>
              </div>
              
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  value={serviceRescheduleReason}
                  onChange={(e) => setServiceRescheduleReason(e.target.value)}
                  placeholder="e.g., Customer request, Vendor unavailable..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => { setShowServiceRescheduleModal(false); setServiceToReschedule(null); setSelectedVisitForReschedule(null); }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmServiceReschedule}
                disabled={!selectedVisitForReschedule || !serviceRescheduleDate || !serviceRescheduleTime || !serviceRescheduleReason.trim() || serviceRescheduling}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {serviceRescheduling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Rescheduling...
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4" />
                    {rescheduleScope === 'this_only' ? 'Reschedule Visit' : 'Reschedule All'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Services Modal */}
      {servicesModal.show && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setServicesModal({ show: false, services: [], propertyName: '' })}>
          <div className="bg-white rounded-xl shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900">Services</h3>
                <span className="text-xs text-gray-500">({servicesModal.propertyName})</span>
              </div>
              <button
                onClick={() => setServicesModal({ show: false, services: [], propertyName: '' })}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {servicesModal.services.map((service, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    {service}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 
          toast.type === 'error' ? 'bg-red-600 text-white' : 
          'bg-gray-800 text-white'
        }`}>
          {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {toast.type === 'error' && <XCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default AllSchedulesPage;
