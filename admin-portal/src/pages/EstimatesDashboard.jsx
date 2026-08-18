import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Send, 
  CheckCircle, 
  XCircle, 
  FileEdit, 
  Building2, 
  RefreshCw,
  Mail,
  Calendar,
  ChevronDown,
  Wrench
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import DonutChart from '../components/common/DonutChart';
import { getAuthToken } from '../utils/safeStorage';
import { STATUS_COLORS, ESTIMATE_TYPE_COLORS, getConsistentColor } from '../utils/chartColors';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper to normalize property type
const normalizePropertyType = (type) => {
  if (!type) return 'Other';
  const upper = type.toUpperCase().replace(/[_\s-]/g, '');
  if (upper === 'GC' || upper.includes('GATED')) return 'Apartment';
  if (upper === 'APT' || upper.includes('APARTMENT')) return 'Apartment';
  if (upper === 'VILLA' || upper === 'VILLAS') return 'Villa';
  if (upper === 'FLAT' || upper === 'FLATS') return 'Flat';
  if (upper === 'PLOT' || upper === 'PLOTS') return 'Plot';
  if (upper.includes('GATED')) return 'Gated Community';
  return 'Other';
};

// Get portal-specific API path
const getApiPath = (portalType) => {
  const portalMap = {
    'franchise': 'fp',
    'manager': 'manager',
    'admin': 'admin',
    'employee': 'admin'
  };
  return portalMap[portalType] || 'fp';
};

const EstimatesDashboard = ({ user, portalType = 'franchise' }) => {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Main date range filter (controls entire dashboard)
  const [startDate, setStartDate] = useState(''); // Internal format yyyy-mm-dd
  const [endDate, setEndDate] = useState(''); // Internal format yyyy-mm-dd
  const [startDateDisplay, setStartDateDisplay] = useState(''); // Display format dd/mm/yyyy
  const [endDateDisplay, setEndDateDisplay] = useState(''); // Display format dd/mm/yyyy
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Individual block filters (each block has its own)
  const [filter1, setFilter1] = useState('all'); // Property-Based Property Type
  const [filter2, setFilter2] = useState('all'); // Status Overview
  const [filter3, setFilter3] = useState('all'); // Estimate Type
  const [filter4, setFilter4] = useState('all'); // Direct Property Type
  const [filter5, setFilter5] = useState('all'); // Direct Status
  const [filter6, setFilter6] = useState('all'); // Property-Based Status
  const [filter7, setFilter7] = useState('all'); // Work Order Status
  const [filter8, setFilter8] = useState('all'); // Work Order Category
  const [filter9, setFilter9] = useState('all'); // Work Order Overview
  const [trendPeriod, setTrendPeriod] = useState('all'); // Default to All Time
  const [funnelFilter, setFunnelFilter] = useState('all'); // Default to All Time

  const token = getAuthToken();
  const apiPath = getApiPath(portalType);
  const datePickerRef = useRef(null);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get the base path for navigation
  const getBasePath = () => {
    if (portalType === 'franchise') return '/fp';
    if (portalType === 'employee' || portalType === 'admin') return '/employee';
    return `/${portalType}`;
  };

  // Fetch estimates data
  const fetchEstimates = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/${apiPath}/estimates?archived=false`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success || result.data || Array.isArray(result)) {
        const data = result.data || result.estimates || result || [];
        setEstimates(Array.isArray(data) ? data : []);
      } else {
        setError(result.message || 'Failed to load estimates');
      }
    } catch (err) {
      console.error('Fetch estimates error:', err);
      setError('Unable to load estimates data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, apiPath]);

  useEffect(() => {
    fetchEstimates();
  }, [fetchEstimates]);

  // Filter estimates by MAIN date range (controls entire dashboard)
  const getMainFilteredEstimates = () => {
    if (!startDate && !endDate) return estimates;
    
    return estimates.filter(est => {
      const estDate = new Date(est.created_at || est.createdAt);
      if (startDate && estDate < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (estDate > end) return false;
      }
      return true;
    });
  };

  const mainFilteredEstimates = getMainFilteredEstimates();

  // Helper function to apply period filter to a dataset (IST timezone aware)
  const applyPeriodFilter = (data, periodFilter) => {
    if (periodFilter === 'all') return data;
    
    const now = new Date();
    let filterDate = new Date();
    
    switch (periodFilter) {
      case 'week':
        // This week (last 7 days)
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        // This month (from 1st of current month)
        filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        // This quarter (last 3 months from 1st)
        filterDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'half':
        // This half-year (last 6 months from 1st)
        filterDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'year':
        // This calendar year (from Jan 1 of current year)
        filterDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return data;
    }
    
    return data.filter(est => {
      const estDate = new Date(est.created_at || est.createdAt);
      return estDate >= filterDate && estDate <= now;
    });
  };
  
  // Helper to format date in Indian format (dd/mm/yyyy)
  const formatDateIST = (dateString) => {
    if (!dateString) return '';
    // If already in yyyy-mm-dd format, parse directly to avoid timezone issues
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Parse dd/mm/yyyy to yyyy-mm-dd (internal format)
  const parseISTDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    const [day, month, year] = parts;
    if (!day || !month || !year || year.length !== 4) return '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Handle date input change with auto-formatting
  const handleDateInput = (value, setter) => {
    // Remove non-numeric characters except /
    let cleaned = value.replace(/[^\d/]/g, '');
    
    // Auto-insert slashes
    if (cleaned.length === 2 && !cleaned.includes('/')) {
      cleaned += '/';
    } else if (cleaned.length === 5 && cleaned.split('/').length === 2) {
      cleaned += '/';
    }
    
    // Limit to dd/mm/yyyy format (10 chars)
    if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);
    
    // Set display value
    setter(cleaned);
  };

  // Convert display date to internal date when valid
  const applyDateFilter = (displayDate) => {
    if (!displayDate || displayDate.length !== 10) return '';
    return parseISTDate(displayDate);
  };

  // For backward compatibility (charts that don't have individual filters yet)
  const filteredEstimates = mainFilteredEstimates;

  // Get funnel estimates based on funnel filter
  const getFunnelEstimates = () => {
    return applyPeriodFilter(mainFilteredEstimates, funnelFilter);
  };

  const funnelEstimates = getFunnelEstimates();

  // Calculate stats for STAT CARDS (use main date range filtered data)
  const totalEstimates = mainFilteredEstimates.length;
  const directEstimates = mainFilteredEstimates.filter(e => 
    e.estimate_type === 'direct' || e.estimateType === 'direct'
  ).length;
  const propertyBasedEstimates = mainFilteredEstimates.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  ).length;
  const workOrderEstimates = mainFilteredEstimates.filter(e => 
    e.estimate_type === 'work_order' || e.estimateType === 'work_order'
  ).length;
  
  const draftEstimates = mainFilteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'draft'
  ).length;
  const sentEstimates = mainFilteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'sent'
  ).length;
  const approvedEstimates = mainFilteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'approved'
  ).length;
  const rejectedEstimates = mainFilteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'rejected'
  ).length;

  // Calculate stats for CHARTS (use filtered estimates)
  const filteredTotal = filteredEstimates.length;
  const filteredDirect = filteredEstimates.filter(e => 
    e.estimate_type === 'direct' || e.estimateType === 'direct'
  ).length;
  const filteredPropertyBased = filteredEstimates.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  ).length;
  
  const filteredDraft = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'draft'
  ).length;
  const filteredSent = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'sent'
  ).length;
  const filteredApproved = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'approved'
  ).length;
  const filteredRejected = filteredEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'rejected'
  ).length;

  // Funnel stats (uses funnel filter)
  const funnelTotal = funnelEstimates.length;
  const funnelSent = funnelEstimates.filter(e => 
    ['sent', 'approved', 'rejected'].includes((e.status || '').toLowerCase())
  ).length;
  const funnelApproved = funnelEstimates.filter(e => 
    (e.status || '').toLowerCase() === 'approved'
  ).length;
  // Calculate invoices created (approved estimates) and paid (we'll assume some percentage)
  const funnelInvoicesCreated = funnelApproved;
  const funnelPaid = Math.floor(funnelApproved * 0.85); // Assuming 85% of approved are paid

  // Stat cards configuration - matching the reference image exactly with gradient backgrounds
  const statCards = [
    {
      label: 'Total Estimates',
      value: totalEstimates,
      percentage: '100% of all estimates',
      icon: FileText,
      iconBg: '#DBEAFE',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6',
      gradientEnd: 'rgba(59, 130, 246, 0.08)'
    },
    {
      label: 'Direct Estimates',
      value: directEstimates,
      percentage: totalEstimates ? `${((directEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Send,
      iconBg: '#EDE9FE',
      iconColor: '#8B5CF6',
      borderColor: '#8B5CF6',
      gradientEnd: 'rgba(139, 92, 246, 0.08)'
    },
    {
      label: 'Property-Based',
      value: propertyBasedEstimates,
      percentage: totalEstimates ? `${((propertyBasedEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Building2,
      iconBg: '#CCFBF1',
      iconColor: '#14B8A6',
      borderColor: '#14B8A6',
      gradientEnd: 'rgba(20, 184, 166, 0.08)'
    },
    {
      label: 'Work Order',
      value: workOrderEstimates,
      percentage: totalEstimates ? `${((workOrderEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Wrench,
      iconBg: '#FFEDD5',
      iconColor: '#F97316',
      borderColor: '#F97316',
      gradientEnd: 'rgba(249, 115, 22, 0.08)'
    },
    {
      label: 'Draft',
      value: draftEstimates,
      percentage: totalEstimates ? `${((draftEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: FileEdit,
      iconBg: '#FEF3C7',
      iconColor: '#F59E0B',
      borderColor: '#F59E0B',
      gradientEnd: 'rgba(245, 158, 11, 0.08)'
    },
    {
      label: 'Sent',
      value: sentEstimates,
      percentage: totalEstimates ? `${((sentEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: Mail,
      iconBg: '#DBEAFE',
      iconColor: '#3B82F6',
      borderColor: '#3B82F6',
      gradientEnd: 'rgba(59, 130, 246, 0.08)'
    },
    {
      label: 'Approved',
      value: approvedEstimates,
      percentage: totalEstimates ? `${((approvedEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: CheckCircle,
      iconBg: '#D1FAE5',
      iconColor: '#10B981',
      borderColor: '#10B981',
      gradientEnd: 'rgba(16, 185, 129, 0.08)'
    },
    {
      label: 'Rejected',
      value: rejectedEstimates,
      percentage: totalEstimates ? `${((rejectedEstimates / totalEstimates) * 100).toFixed(1)}% of total` : '0% of total',
      icon: XCircle,
      iconBg: '#FEE2E2',
      iconColor: '#EF4444',
      borderColor: '#EF4444',
      gradientEnd: 'rgba(239, 68, 68, 0.08)'
    }
  ];

  // ============================================
  // CHART DATA - Each uses its own filter
  // ============================================

  // Block 1: Property-Based Property Type (uses filter1)
  const block1Data = applyPeriodFilter(mainFilteredEstimates, filter1).filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  );
  const propertyTypeCount = {};
  block1Data.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    propertyTypeCount[propType] = (propertyTypeCount[propType] || 0) + 1;
  });
  const propertyTypeData = Object.entries(propertyTypeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Block 2: Status Overview (uses filter2)
  const block2Data = applyPeriodFilter(mainFilteredEstimates, filter2);
  const block2Draft = block2Data.filter(e => (e.status || '').toLowerCase() === 'draft').length;
  const block2Sent = block2Data.filter(e => (e.status || '').toLowerCase() === 'sent').length;
  const block2Approved = block2Data.filter(e => (e.status || '').toLowerCase() === 'approved').length;
  const block2Rejected = block2Data.filter(e => (e.status || '').toLowerCase() === 'rejected').length;
  // All statuses for legend display - using shared color constants
  const statusDataAll = [
    { name: 'Draft', value: block2Draft, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block2Sent, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block2Approved, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block2Rejected, color: STATUS_COLORS.Rejected }
  ];
  // Calculate total from breakdown
  const statusTotal = statusDataAll.reduce((sum, item) => sum + item.value, 0);
  // Only non-zero for chart display
  const statusData = statusDataAll.filter(item => item.value > 0);

  // Block 3: Estimate Type (uses filter3) - includes all types
  const block3Data = applyPeriodFilter(mainFilteredEstimates, filter3);
  const block3Direct = block3Data.filter(e => e.estimate_type === 'direct' || e.estimateType === 'direct').length;
  const block3PropertyBased = block3Data.filter(e => 
    e.estimate_type === 'property_based' || e.estimate_type === 'property-based' || 
    e.estimateType === 'property_based' || e.estimateType === 'property-based'
  ).length;
  const block3WorkOrder = block3Data.filter(e => e.estimate_type === 'work_order' || e.estimateType === 'work_order').length;
  const typeDataAll = [
    { name: 'Direct Estimates', value: block3Direct, color: ESTIMATE_TYPE_COLORS['Direct Estimates'] },
    { name: 'Property-Based', value: block3PropertyBased, color: ESTIMATE_TYPE_COLORS['Property-Based'] },
    { name: 'Work Order', value: block3WorkOrder, color: ESTIMATE_TYPE_COLORS['Work Order'] }
  ];
  const typeData = typeDataAll.filter(item => item.value > 0);

  // Block 4: Direct Property Type (uses filter4)
  const block4Data = applyPeriodFilter(mainFilteredEstimates, filter4).filter(e => 
    e.estimate_type === 'direct' || e.estimateType === 'direct'
  );
  const directPropertyTypeCount = {};
  block4Data.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    directPropertyTypeCount[propType] = (directPropertyTypeCount[propType] || 0) + 1;
  });
  const directPropertyTypeData = Object.entries(directPropertyTypeCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Block 5: Direct Status (uses filter5)
  const block5Data = applyPeriodFilter(mainFilteredEstimates, filter5).filter(e => {
    const type = (e.estimate_type || e.estimateType || '').toLowerCase();
    return type === 'direct';
  });
  // All statuses for legend display - using shared color constants
  const directStatusDataAll = [
    { name: 'Draft', value: block5Data.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block5Data.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block5Data.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block5Data.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  // Calculate total from breakdown
  const directStatusTotal = directStatusDataAll.reduce((sum, item) => sum + item.value, 0);
  // Only non-zero for chart display
  const directStatusData = directStatusDataAll.filter(item => item.value > 0);

  // Block 6: Property-Based Status (uses filter6)
  const block6Data = applyPeriodFilter(mainFilteredEstimates, filter6).filter(e => {
    const type = (e.estimate_type || e.estimateType || '').toLowerCase().replace(/[_\s-]/g, '');
    return type === 'propertybased' || type === 'property';
  });
  // All statuses for legend display - using shared color constants
  const propertyBasedStatusDataAll = [
    { name: 'Draft', value: block6Data.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block6Data.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block6Data.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block6Data.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  // Calculate total from breakdown
  const propertyBasedStatusTotal = propertyBasedStatusDataAll.reduce((sum, item) => sum + item.value, 0);
  // Only non-zero for chart display
  const propertyBasedStatusData = propertyBasedStatusDataAll.filter(item => item.value > 0);

  // Block 7: Work Order Estimate Status (uses filter7)
  const block7Data = applyPeriodFilter(mainFilteredEstimates, filter7).filter(e => {
    const type = (e.estimate_type || e.estimateType || '').toLowerCase().replace(/[_\s-]/g, '');
    return type === 'workorder';
  });
  const workOrderStatusDataAll = [
    { name: 'Draft', value: block7Data.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block7Data.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block7Data.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block7Data.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  // Calculate total from breakdown to ensure accuracy
  const workOrderStatusTotal = workOrderStatusDataAll.reduce((sum, item) => sum + item.value, 0);
  const workOrderStatusData = workOrderStatusDataAll.filter(item => item.value > 0);

  // Block 8: Work Order Estimates by Category grouped by Property Type
  const block8Data = applyPeriodFilter(mainFilteredEstimates, filter8).filter(e => 
    e.estimate_type === 'work_order' || e.estimateType === 'work_order'
  );
  
  // Group by property type, then by category
  const workOrderByPropertyAndCategory = {};
  const allCategories = new Set();
  
  block8Data.forEach(est => {
    const propType = normalizePropertyType(est.property_type || est.propertyType);
    const category = est.work_order_category || est.workOrderCategory || 'Other';
    
    allCategories.add(category);
    
    if (!workOrderByPropertyAndCategory[propType]) {
      workOrderByPropertyAndCategory[propType] = {};
    }
    workOrderByPropertyAndCategory[propType][category] = 
      (workOrderByPropertyAndCategory[propType][category] || 0) + 1;
  });
  
  // Convert to array format for chart
  const woPropertyTypes = Object.keys(workOrderByPropertyAndCategory).sort();
  const woCategories = Array.from(allCategories).sort();
  
  // Category colors for grouped chart
  const CATEGORY_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'
  ];

  // Block 9: Work Order Overview (uses filter9)
  const block9Data = applyPeriodFilter(mainFilteredEstimates, filter9).filter(e => 
    e.estimate_type === 'work_order' || e.estimateType === 'work_order'
  );
  const workOrderOverviewDataAll = [
    { name: 'Draft', value: block9Data.filter(e => (e.status || '').toLowerCase() === 'draft').length, color: STATUS_COLORS.Draft },
    { name: 'Sent', value: block9Data.filter(e => (e.status || '').toLowerCase() === 'sent').length, color: STATUS_COLORS.Sent },
    { name: 'Approved', value: block9Data.filter(e => (e.status || '').toLowerCase() === 'approved').length, color: STATUS_COLORS.Approved },
    { name: 'Rejected', value: block9Data.filter(e => (e.status || '').toLowerCase() === 'rejected').length, color: STATUS_COLORS.Rejected }
  ];
  const workOrderOverviewData = workOrderOverviewDataAll.filter(item => item.value > 0);

  // Legacy variables for compatibility
  const propertyBasedOnly = block1Data;
  const directOnly = block4Data;

  // Calculate trend data for line chart (uses trendPeriod filter)
  const getTrendData = () => {
    const trendFilteredData = applyPeriodFilter(mainFilteredEstimates, trendPeriod);
    const monthlyData = {};
    const now = new Date();
    
    // Determine how many months to show based on filter
    let monthsToShow = 6;
    if (trendPeriod === 'week') monthsToShow = 1;
    else if (trendPeriod === 'month') monthsToShow = 1;
    else if (trendPeriod === 'quarter') monthsToShow = 3;
    else if (trendPeriod === 'half') monthsToShow = 6;
    else if (trendPeriod === 'year') monthsToShow = 12;
    
    // Initialize months
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear();
      monthlyData[key] = { name: key, direct: 0, property: 0, workOrder: 0, sortDate: date };
    }
    
    trendFilteredData.forEach(est => {
      const date = new Date(est.created_at || est.createdAt);
      const key = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear();
      
      if (monthlyData[key]) {
        const estType = est.estimate_type || est.estimateType || '';
        if (estType === 'direct') {
          monthlyData[key].direct++;
        } else if (estType === 'property_based' || estType === 'property-based') {
          monthlyData[key].property++;
        } else if (estType === 'work_order') {
          monthlyData[key].workOrder++;
        }
      }
    });
    
    return Object.values(monthlyData).sort((a, b) => a.sortDate - b.sortDate);
  };

  const trendData = getTrendData();

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200">
          <p className="font-semibold text-gray-900 text-sm mb-2">{label || payload[0]?.name}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-bold text-gray-900">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 bg-red-50 text-red-600 p-6 rounded-xl flex items-center gap-3 border border-red-200">
        <XCircle className="w-6 h-6 flex-shrink-0" />
        <div>
          <p className="font-medium">Failed to load dashboard</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
        <button 
          onClick={() => fetchEstimates()} 
          className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
      {/* Header with Date Range Picker and Refresh */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of all your estimates</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="relative" ref={datePickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-md border border-white/30 rounded-xl hover:bg-white/95 transition-all shadow-sm hover:shadow-md"
            >
              <Calendar className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700 font-medium">
                {startDate && endDate 
                  ? `${formatDateIST(startDate)} - ${formatDateIST(endDate)}`
                  : startDate 
                    ? `From ${formatDateIST(startDate)}`
                    : endDate
                      ? `Until ${formatDateIST(endDate)}`
                      : 'All Time'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>
            
            {showDatePicker && (
              <div className="absolute right-0 mt-2 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-5 z-50 min-w-[320px]"
                   style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.5) inset' }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy"
                        value={startDateDisplay}
                        onChange={(e) => {
                          handleDateInput(e.target.value, setStartDateDisplay);
                          const parsed = parseISTDate(e.target.value);
                          if (parsed) setStartDate(parsed);
                        }}
                        onBlur={() => {
                          const parsed = parseISTDate(startDateDisplay);
                          if (parsed) setStartDate(parsed);
                          else if (startDateDisplay && startDateDisplay.length < 10) setStartDateDisplay('');
                        }}
                        className="w-full px-3 py-2.5 pr-10 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 backdrop-blur-sm transition-all"
                      />
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                        <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setStartDate(e.target.value); setStartDateDisplay(formatDateIST(e.target.value)); }}} />
                        <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="dd/mm/yyyy"
                        value={endDateDisplay}
                        onChange={(e) => {
                          handleDateInput(e.target.value, setEndDateDisplay);
                          const parsed = parseISTDate(e.target.value);
                          if (parsed) setEndDate(parsed);
                        }}
                        onBlur={() => {
                          const parsed = parseISTDate(endDateDisplay);
                          if (parsed) setEndDate(parsed);
                          else if (endDateDisplay && endDateDisplay.length < 10) setEndDateDisplay('');
                        }}
                        className="w-full px-3 py-2.5 pr-10 bg-white/70 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 backdrop-blur-sm transition-all"
                      />
                      <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center cursor-pointer">
                        <input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => { if (e.target.value) { setEndDate(e.target.value); setEndDateDisplay(formatDateIST(e.target.value)); }}} />
                        <Calendar className="w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const now = new Date();
                        const weekAgo = new Date(now);
                        weekAgo.setDate(now.getDate() - 7);
                        setStartDate(weekAgo.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(weekAgo.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-xs bg-white/60 hover:bg-white/80 border border-gray-200/50 rounded-full backdrop-blur-sm transition-all hover:shadow-sm"
                    >
                      Last 7 Days
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const monthAgo = new Date(now);
                        monthAgo.setMonth(now.getMonth() - 1);
                        setStartDate(monthAgo.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(monthAgo.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-xs bg-white/60 hover:bg-white/80 border border-gray-200/50 rounded-full backdrop-blur-sm transition-all hover:shadow-sm"
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const quarterAgo = new Date(now);
                        quarterAgo.setMonth(now.getMonth() - 3);
                        setStartDate(quarterAgo.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(quarterAgo.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-xs bg-white/60 hover:bg-white/80 border border-gray-200/50 rounded-full backdrop-blur-sm transition-all hover:shadow-sm"
                    >
                      Last 3 Months
                    </button>
                    <button
                      onClick={() => {
                        const now = new Date();
                        const yearAgo = new Date(now);
                        yearAgo.setFullYear(now.getFullYear() - 1);
                        setStartDate(yearAgo.toISOString().split('T')[0]);
                        setEndDate(now.toISOString().split('T')[0]);
                        setStartDateDisplay(formatDateIST(yearAgo.toISOString().split('T')[0]));
                        setEndDateDisplay(formatDateIST(now.toISOString().split('T')[0]));
                      }}
                      className="px-3 py-1.5 text-xs bg-white/60 hover:bg-white/80 border border-gray-200/50 rounded-full backdrop-blur-sm transition-all hover:shadow-sm"
                    >
                      Last Year
                    </button>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200/30">
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setStartDateDisplay('');
                        setEndDateDisplay('');
                      }}
                      className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-white/50 rounded-lg transition-all"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="px-5 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 transition-all"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => fetchEstimates(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards Row - 7 cards matching reference */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="rounded-xl p-3 shadow-sm hover:shadow-md transition-all"
              style={{ 
                borderTop: `3px solid ${card.borderColor}`,
                background: `linear-gradient(135deg, white 0%, white 60%, ${card.gradientEnd} 100%)`
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div 
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: card.iconBg }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: card.iconColor }} />
                </div>
                <span className="text-xs font-medium text-gray-600 leading-tight">{card.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-0.5">{card.value}</div>
              <div className="text-[10px] text-gray-500 mb-1">{card.percentage}</div>
              <div 
                onClick={() => navigate(`${getBasePath()}/estimates`)}
                className="text-[10px] font-medium flex items-center gap-0.5 cursor-pointer hover:gap-1 transition-all"
                style={{ color: card.borderColor }}
              >
                View All →
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 1: Estimates by Estimate Type | Estimate Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Estimates by Estimate Type (Donut) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Estimate Type</h3>
            <select
              value={filter3}
              onChange={(e) => setFilter3(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 flex items-center justify-center">
              <DonutChart data={typeData} centerValue={block3Data.length} size={130} strokeWidth={18} />
            </div>
            <div className="w-1/2 space-y-2 pl-3">
              {[
                { name: 'Direct Estimates', value: block3Direct, color: '#8B5CF6' },
                { name: 'Property-Based', value: block3PropertyBased, color: '#06B6D4' }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 w-20 flex-shrink-0">{item.name}</span>
                  <span className="font-medium text-gray-800 whitespace-nowrap">
                    {item.value} ({block3Data.length ? ((item.value / block3Data.length) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Estimate Status (Donut) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimate Status</h3>
            <select
              value={filter2}
              onChange={(e) => setFilter2(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 flex items-center justify-center">
              <DonutChart data={statusDataAll} centerValue={statusTotal} size={130} strokeWidth={18} />
            </div>
            <div className="w-1/2 space-y-1.5 pl-3">
              {statusDataAll.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 w-14 flex-shrink-0">{item.name}</span>
                  <span className="text-gray-800 whitespace-nowrap">
                    {item.value} ({statusTotal ? ((item.value / statusTotal) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Property-Based Status | Estimates by Property Type (Property-Based) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 3. Property-Based Status (Donut) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Property-Based Status</h3>
            <select
              value={filter6}
              onChange={(e) => setFilter6(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 flex items-center justify-center">
              <DonutChart data={propertyBasedStatusDataAll} centerValue={propertyBasedStatusTotal} size={130} strokeWidth={18} />
            </div>
            <div className="w-1/2 space-y-1.5 pl-3">
              {propertyBasedStatusDataAll.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 w-14 flex-shrink-0">{item.name}</span>
                  <span className="text-gray-800 whitespace-nowrap">
                    {item.value} ({propertyBasedStatusTotal ? ((item.value / propertyBasedStatusTotal) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Estimates by Property Type (Property-Based) - Horizontal Bar */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Property Type (Property-Based)</h3>
            <select
              value={filter1}
              onChange={(e) => setFilter1(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          {propertyTypeData.length > 0 ? (
            (() => {
              const maxValue = Math.max(...propertyTypeData.map(d => d.value));
              const total = propertyTypeData.reduce((sum, d) => sum + d.value, 0);
              return (
                <div className="space-y-3">
                  {propertyTypeData.map((item, index) => {
                    const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                    const barColor = getConsistentColor(item.name);
                    
                    return (
                      <div key={index} className="flex items-center gap-3 group relative cursor-pointer">
                        <div className="w-28 text-sm text-gray-600 truncate">{item.name}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                          <div 
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{ 
                              width: `${Math.max(widthPercent, 15)}%`,
                              backgroundColor: barColor
                            }}
                          >
                            <span className="text-white text-xs font-medium">{item.value}</span>
                          </div>
                          {/* Tooltip */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            <p className="font-semibold text-gray-900 text-sm mb-1">{item.name}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: barColor }}></div>
                              <span className="text-gray-600">Count:</span>
                              <span className="font-bold text-gray-900">{item.value} estimates</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}% of total</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-center gap-1 text-xs text-gray-400 mt-2">
                    <span>0</span>
                    <span className="flex-1 text-center">Number of Estimates</span>
                    <span>{maxValue}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl font-bold text-gray-300 mb-2">0</div>
              <div className="text-sm">No estimates</div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Direct Estimate Status | Estimates by Property Type (Direct) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 5. Direct Estimate Status (Donut) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Direct Estimate Status</h3>
            <select
              value={filter5}
              onChange={(e) => setFilter5(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 flex items-center justify-center">
              <DonutChart data={directStatusDataAll} centerValue={directStatusTotal} size={130} strokeWidth={18} />
            </div>
            <div className="w-1/2 space-y-1.5 pl-3">
              {directStatusDataAll.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 w-14 flex-shrink-0">{item.name}</span>
                  <span className="text-gray-800 whitespace-nowrap">
                    {item.value} ({directStatusTotal ? ((item.value / directStatusTotal) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6. Estimates by Property Type (Direct) - Horizontal Bar */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates by Property Type (Direct)</h3>
            <select
              value={filter4}
              onChange={(e) => setFilter4(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          {directPropertyTypeData.length > 0 ? (
            (() => {
              const maxValue = Math.max(...directPropertyTypeData.map(d => d.value));
              const total = directPropertyTypeData.reduce((sum, d) => sum + d.value, 0);
              return (
                <div className="space-y-3">
                  {directPropertyTypeData.map((item, index) => {
                    const widthPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                    const barColor = getConsistentColor(item.name);
                    
                    return (
                      <div key={index} className="flex items-center gap-3 group relative cursor-pointer">
                        <div className="w-28 text-sm text-gray-600 truncate">{item.name}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                          <div 
                            className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{ 
                              width: `${Math.max(widthPercent, 15)}%`,
                              backgroundColor: barColor
                            }}
                          >
                            <span className="text-white text-xs font-medium">{item.value}</span>
                          </div>
                          {/* Tooltip */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                            <p className="font-semibold text-gray-900 text-sm mb-1">{item.name}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: barColor }}></div>
                              <span className="text-gray-600">Count:</span>
                              <span className="font-bold text-gray-900">{item.value} estimates</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}% of total</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-center gap-1 text-xs text-gray-400 mt-2">
                    <span>0</span>
                    <span className="flex-1 text-center">Number of Estimates</span>
                    <span>{maxValue}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl font-bold text-gray-300 mb-2">0</div>
              <div className="text-sm">No estimates</div>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Work Order Estimate Status | Work Order Estimates by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 7. Work Order Estimate Status (Donut) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Work Order Estimate Status</h3>
            <select
              value={filter7}
              onChange={(e) => setFilter7(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <div className="w-1/2 flex items-center justify-center">
              <DonutChart data={workOrderStatusDataAll} centerValue={workOrderStatusTotal} size={130} strokeWidth={18} />
            </div>
            <div className="w-1/2 space-y-1.5 pl-3">
              {workOrderStatusDataAll.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 text-xs">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-600 w-14 flex-shrink-0">{item.name}</span>
                  <span className="text-gray-800 whitespace-nowrap">
                    {item.value} ({workOrderStatusTotal ? ((item.value / workOrderStatusTotal) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 8. Work Orders: Category by Property Type (Grouped Bar) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Work Orders: Category by Property Type</h3>
            <select
              value={filter8}
              onChange={(e) => setFilter8(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          {woPropertyTypes.length > 0 ? (
            (() => {
              // Find max value for scaling
              let maxValue = 0;
              woPropertyTypes.forEach(pt => {
                woCategories.forEach(cat => {
                  const val = workOrderByPropertyAndCategory[pt]?.[cat] || 0;
                  if (val > maxValue) maxValue = val;
                });
              });
              
              return (
                <div className="h-48 flex">
                  {/* Chart - Left side */}
                  <div className="flex-1 flex items-end justify-center gap-6 h-36">
                    {woPropertyTypes.map((propType) => (
                      <div key={propType} className="flex flex-col items-center">
                        {/* Bars group */}
                        <div className="flex items-end gap-1">
                          {woCategories.map((cat, catIdx) => {
                            const value = workOrderByPropertyAndCategory[propType]?.[cat] || 0;
                            const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                            const barColor = CATEGORY_COLORS[catIdx % CATEGORY_COLORS.length];
                            return (
                              <div key={cat} className="flex flex-col items-center relative group cursor-pointer">
                                {value > 0 && (
                                  <span className="text-[9px] font-semibold text-gray-700 mb-1">{value}</span>
                                )}
                                <div 
                                  className="w-6 rounded-t-md transition-all duration-500"
                                  style={{ 
                                    height: value > 0 ? `${Math.max(heightPercent, 10)}%` : '0px',
                                    backgroundColor: barColor,
                                    minHeight: value > 0 ? '16px' : '0px'
                                  }}
                                />
                                {/* Tooltip */}
                                {value > 0 && (
                                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white px-4 py-3 shadow-lg rounded-lg border border-gray-200 z-50 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                    <p className="font-semibold text-gray-900 text-sm mb-1">{propType}</p>
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: barColor }}></div>
                                      <span className="text-gray-600">{cat}:</span>
                                      <span className="font-bold text-gray-900">{value}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Property type label */}
                        <span className="text-[10px] text-gray-600 font-medium mt-2 text-center truncate w-20" title={propType}>
                          {propType}
                        </span>
                      </div>
                    ))}
                  </div>
              
                  {/* Legend - Right side */}
                  <div className="w-36 flex flex-col justify-center gap-1.5 pl-3 border-l border-gray-100">
                    {woCategories.map((cat, idx) => (
                      <div key={cat} className="flex items-center gap-1.5">
                        <div 
                          className="w-3 h-3 rounded-sm flex-shrink-0" 
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <span className="text-[9px] text-gray-600 leading-tight" title={cat}>
                          {cat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-36 flex flex-col items-center justify-center text-gray-400">
              <div className="text-3xl font-bold text-gray-300 mb-1">0</div>
              <div className="text-sm">No work order estimates</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row - Trend & Funnel */}
      <div className="grid grid-cols-2 gap-4">
        {/* Estimate Trend (Line Chart) */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimate Trend</h3>
            <select
              value={trendPeriod}
              onChange={(e) => setTrendPeriod(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} position={{ x: 0, y: -10 }} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="direct" 
                  name="Direct Estimates"
                  stroke="#5B8DEF" 
                  strokeWidth={2}
                  dot={{ fill: '#5B8DEF', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="property" 
                  name="Property-Based Estimates"
                  stroke="#14B8A6" 
                  strokeWidth={2}
                  dot={{ fill: '#14B8A6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="workOrder" 
                  name="Work Order Estimates"
                  stroke="#F97316" 
                  strokeWidth={2}
                  dot={{ fill: '#F97316', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl font-bold text-gray-300 mb-2">0</div>
              <div className="text-sm">No data available</div>
            </div>
          )}
        </div>

        {/* Estimates Funnel */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Estimates Funnel</h3>
            <select
              value={funnelFilter}
              onChange={(e) => setFunnelFilter(e.target.value)}
              className="text-xs border border-white/30 rounded-xl px-3 py-1.5 outline-none bg-white/70 backdrop-blur-md cursor-pointer shadow-sm hover:bg-white/90 transition-all focus:ring-2 focus:ring-blue-400/30"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="half">Last 6 Months</option>
              <option value="year">This Year</option>
            </select>
          </div>
          
          {funnelTotal > 0 ? (
            <div className="flex items-center gap-8">
              {/* Funnel Visual with hover effects */}
              <div className="flex-1 flex flex-col items-center" style={{ maxWidth: '280px' }}>
                {[
                  { label: 'Total Estimates', value: funnelTotal, width: '100%', color: '#5B8DEF', hoverColor: '#4A7DE0' },
                  { label: 'Sent', value: funnelSent, width: funnelTotal ? `${Math.max((funnelSent / funnelTotal) * 100, 20)}%` : '85%', color: '#14B8A6', hoverColor: '#0D9488' },
                  { label: 'Approved', value: funnelApproved, width: funnelTotal ? `${Math.max((funnelApproved / funnelTotal) * 100, 15)}%` : '70%', color: '#22C55E', hoverColor: '#16A34A' },
                  { label: 'Invoices Created', value: funnelInvoicesCreated, width: funnelTotal ? `${Math.max((funnelInvoicesCreated / funnelTotal) * 100, 10)}%` : '55%', color: '#FBBF24', hoverColor: '#EAB308' },
                  { label: 'Paid', value: funnelPaid, width: funnelTotal ? `${Math.max((funnelPaid / funnelTotal) * 100, 5)}%` : '40%', color: '#EF4444', hoverColor: '#DC2626' }
                ].map((bar, idx) => (
                  <div 
                    key={idx}
                    className="h-11 rounded-sm cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg group relative"
                    style={{ 
                      width: bar.width, 
                      backgroundColor: bar.color,
                      marginTop: idx === 0 ? '0' : '-1px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = bar.hoverColor}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = bar.color}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-12 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
                      <div className="font-semibold">{bar.label}</div>
                      <div>Count: <span className="font-bold">{bar.value}</span></div>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Funnel Legend - Right side with count, name, percentage */}
              <div className="flex-1 space-y-3">
                {[
                  { label: 'Total Estimates', value: funnelTotal, percent: funnelTotal > 0 ? 100 : 0, color: '#5B8DEF' },
                  { label: 'Sent', value: funnelSent, percent: funnelTotal ? ((funnelSent / funnelTotal) * 100).toFixed(1) : 0, color: '#14B8A6' },
                  { label: 'Approved', value: funnelApproved, percent: funnelTotal ? ((funnelApproved / funnelTotal) * 100).toFixed(1) : 0, color: '#22C55E' },
                  { label: 'Invoices Created', value: funnelInvoicesCreated, percent: funnelTotal ? ((funnelInvoicesCreated / funnelTotal) * 100).toFixed(1) : 0, color: '#FBBF24' },
                  { label: 'Paid', value: funnelPaid, percent: funnelTotal ? ((funnelPaid / funnelTotal) * 100).toFixed(1) : 0, color: '#EF4444' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center text-sm hover:bg-gray-50 rounded px-1 -mx-1 transition-colors cursor-default">
                    <span className="font-bold w-8" style={{ color: item.color }}>{item.value}</span>
                    <span className="text-gray-600 flex-1">{item.label}</span>
                    <span className="text-gray-500 font-medium">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400">
              <div className="text-4xl font-bold text-gray-300 mb-2">0</div>
              <div className="text-sm">No estimates</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstimatesDashboard;
