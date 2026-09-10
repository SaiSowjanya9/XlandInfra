import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Package, Calendar, CalendarDays, Clock,
  CheckCircle, AlertCircle, Sparkles, User, Wrench, RefreshCw, X, Save,
  Star, Info, Check, ChevronLeft, ChevronRight, Phone, Edit2, HelpCircle,
  ArrowRight, Eye, ListChecks, PlayCircle
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';
import { 
  generateScheduleDates, 
  formatSchedulesForDisplay, 
  generateScheduleSummary,
  getFrequencyConfig,
  getFrequencyOptions
} from '../../utils/scheduleGenerator';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Wizard step types - Step-by-step flow
const WIZARD_STEPS = {
  SERVICE_SELECTION: 'service_selection',  // Step 1: Select a service to schedule
  DATE_SELECTION: 'date_selection',        // Step 2: Select dates for the service
  REVIEW: 'review'                         // Final: Review all and confirm
};

// Role-based permissions for scheduling
const getSchedulePermissions = (portalType) => {
  const permissions = {
    admin: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, canConfirm: true, fullAccess: true },
    operations_manager: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, canConfirm: true, fullAccess: false },
    franchise: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: false, canConfirm: true, fullAccess: false },
    manager: { canView: true, canCreate: true, canEdit: true, canReschedule: true, canCancel: true, canAssignVendor: true, canConfirm: true, fullAccess: false },
    coordinator: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, canConfirm: false, fullAccess: false },
    supervisor: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, canConfirm: false, fullAccess: false },
    executive: { canView: true, canCreate: false, canEdit: false, canReschedule: false, canCancel: false, canAssignVendor: false, canConfirm: false, fullAccess: false }
  };
  return permissions[portalType] || permissions.executive;
};

const PropertySchedulingScreen = ({ user, portalType = 'admin' }) => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const propertyData = location.state?.property;
  const permissions = getSchedulePermissions(portalType);

  const [property, setProperty] = useState(propertyData || null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(getNextMonday());
  const [recommendedDates, setRecommendedDates] = useState([]);
  const [plannedVisits, setPlannedVisits] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  // Schedule confirmation state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationSchedule, setConfirmationSchedule] = useState([]);
  const [editingVisitIndex, setEditingVisitIndex] = useState(null);
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  
  // Reschedule state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleVisit, setRescheduleVisit] = useState(null);
  const [rescheduleScope, setRescheduleScope] = useState('this_visit_only'); // Default: This Visit Only
  
  // Edit recurrence modal state
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [editFrequency, setEditFrequency] = useState('monthly');
  const [editVisitCount, setEditVisitCount] = useState(12);
  
  // All visits modal state
  const [showAllVisitsModal, setShowAllVisitsModal] = useState(false);
  
  // Vendor availability state for calendar
  const [vendorAvailability, setVendorAvailability] = useState({ bookings: {}, maxDaily: 5 });
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  
  // Wizard state for step-by-step scheduling
  const [wizardStep, setWizardStep] = useState(WIZARD_STEPS.SERVICE_SELECTION);
  const [currentServiceIndex, setCurrentServiceIndex] = useState(0);
  
  // Store planned schedules for each service (before final confirmation)
  // Format: { serviceId: { service: {...}, visits: [...], isPlanned: boolean } }
  const [plannedSchedules, setPlannedSchedules] = useState({});
  
  // Final review and confirmation state
  const [showFinalReview, setShowFinalReview] = useState(false);
  const [confirmingAllSchedules, setConfirmingAllSchedules] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  function getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? 1 : 8);
    return new Date(today.setDate(diff));
  }

  // Helper functions - defined before use
  const formatDateFull = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateShort = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle editing a planned visit date (in the visit series cards)
  const handleEditPlannedVisitDate = (index, newDateStr) => {
    // Parse date string to avoid timezone issues (YYYY-MM-DD format)
    const [year, month, day] = newDateStr.split('-').map(Number);
    const newDate = new Date(year, month - 1, day); // month is 0-indexed
    if (isNaN(newDate.getTime())) return;
    
    const newDateFormatted = formatDateShort(newDate);
    const newDateFull = formatDateFull(newDate);
    
    // Update planned visits
    setPlannedVisits(prev => prev.map((visit, i) => {
      if (i === index) {
        return {
          ...visit,
          date: newDate,
          shortDateStr: newDateFormatted,
          dateStr: newDateFull,
          isEdited: true
        };
      }
      return visit;
    }));
    
    // If editing first visit, also update selectedSlot to keep in sync
    if (index === 0) {
      setSelectedSlot(prev => prev ? { ...prev, date: newDate } : { date: newDate, time: '10:00 AM', status: 'edited' });
      
      // Update recommended dates to show the edited date at top
      setRecommendedDates(prev => {
        if (prev.length === 0) return prev;
        return prev.map((rec, i) => {
          if (i === 0) {
            return {
              ...rec,
              date: newDate,
              dateStr: newDateFull,
              type: 'edited',
              reason: 'Custom date selected'
            };
          }
          return rec;
        });
      });
    }
    // Don't close editing mode here - let user also change time
  };

  // Handle editing a planned visit time (in the visit series cards)
  const handleEditPlannedVisitTime = (index, newTime) => {
    console.log('[Edit Visit Time] Visit', index + 1, 'changed to:', newTime);
    setPlannedVisits(prev => {
      const updated = prev.map((visit, i) => {
        if (i === index) {
          return {
            ...visit,
            time: newTime,
            isEdited: true
          };
        }
        return visit;
      });
      console.log('[Edit Visit Time] Updated plannedVisits:', updated.map(v => ({ visit: v.visitNumber, time: v.time, isEdited: v.isEdited })));
      return updated;
    });
    
    // If editing first visit, also update selectedSlot and recommended dates
    if (index === 0) {
      setSelectedSlot(prev => prev ? { ...prev, time: newTime } : null);
      
      setRecommendedDates(prev => {
        if (prev.length === 0) return prev;
        return prev.map((rec, i) => {
          if (i === 0) {
            return { ...rec, time: newTime, type: 'edited' };
          }
          return rec;
        });
      });
    }
    // Don't close editing mode - let user click Done button
  };

  // Handle applying new recurrence settings
  const handleApplyRecurrence = () => {
    if (!selectedService) return;
    
    // Get the start date - use selected slot, or first planned visit, or current date
    const startDate = selectedSlot?.date || 
                      (plannedVisits.length > 0 ? plannedVisits[0].date : new Date());
    const startTime = selectedSlot?.time || 
                      (plannedVisits.length > 0 ? plannedVisits[0].time : '10:00 AM');
    
    // Update service with new frequency and visit count
    const updatedService = {
      ...selectedService,
      frequency: editFrequency,
      visits: editVisitCount
    };
    
    // Regenerate visits with new settings
    const schedules = generateScheduleDates(
      startDate,
      editFrequency,
      editVisitCount
    );
    
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    const visitsWithTime = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: startTime,
      status: 'Planned'
    }));
    
    setPlannedVisits(visitsWithTime);
    setSelectedService(updatedService);
    setShowRecurrenceModal(false);
  };

  // Open recurrence modal with current values from the schedule
  const openRecurrenceModal = () => {
    if (selectedService) {
      // Use the current frequency from the service
      const currentFrequency = selectedService.frequency || 'monthly';
      setEditFrequency(currentFrequency);
      
      // Use service.visits first (the configured count), then frequency default, then plannedVisits length
      const frequencyConfig = getFrequencyConfig(currentFrequency);
      const currentVisitCount = selectedService.visits || frequencyConfig?.visitsPerYear || plannedVisits.length || 12;
      setEditVisitCount(currentVisitCount);
    }
    setShowRecurrenceModal(true);
  };

  useEffect(() => {
    fetchPropertyDetails();
  }, [propertyId]);

  // Track the previous service ID to detect service changes
  const prevServiceIdRef = useRef(null);

  // Handle service switching - reset state when service changes
  useEffect(() => {
    if (selectedService && prevServiceIdRef.current !== selectedService.id) {
      const isInitialLoad = prevServiceIdRef.current === null;
      prevServiceIdRef.current = selectedService.id;
      
      if (!isInitialLoad) {
        // Service changed - reset state for new service
        setPlannedVisits([]);
        setSelectedSlot(null);
      }
      
      // Fetch vendor availability for calendar
      if (selectedService.vendorId) {
        fetchVendorAvailability(selectedService.vendorId);
      }
      
      // Generate dates for the selected service
      generateRecommendedDates(selectedService);
      generatePlannedVisits(selectedService);
    }
  }, [selectedService?.id]);

  // Handle week navigation - regenerate recommended dates and refetch availability when week changes
  useEffect(() => {
    if (selectedService && !showConfirmation && !confirmingSchedule) {
      // Regenerate recommended dates when navigating weeks
      generateRecommendedDates(selectedService);
      // Refetch vendor availability for the new week
      if (selectedService.vendorId) {
        fetchVendorAvailability(selectedService.vendorId);
      }
    }
  }, [currentWeekStart]);

  const fetchPropertyDetails = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      
      if (propertyData) {
        setProperty(propertyData);
      }
      
      // Fetch real services from the backend
      const servicesResponse = await fetch(`${API_BASE}/api/schedules/property/${propertyId}/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let servicesToUse = [];
      
      if (servicesResponse.ok) {
        const servicesResult = await servicesResponse.json();
        if (servicesResult.success && servicesResult.data?.length > 0) {
          servicesToUse = servicesResult.data.map(s => ({
            id: s.id,
            // Set scheduleId for both 'scheduled' and 'completed' statuses
            scheduleId: (s.scheduling_status === 'scheduled' || s.scheduling_status === 'completed') 
              ? (s.service_schedule_id || s.scheduleId || s.id) 
              : null,
            name: s.service_name || s.serviceName,
            category: s.service_category || s.serviceCategory,
            vendorName: s.vendor_name || s.vendorName || 'Unassigned',
            vendorId: s.vendor_id || s.vendorId,
            frequency: s.frequency_type || s.frequency || 'Monthly',
            visits: s.total_visits || s.visits || 12,
            status: (s.scheduling_status === 'scheduled' || s.scheduling_status === 'completed') ? 'Scheduled' : 'Schedule',
            customVisits: s.custom_visits || s.customVisits,
            startDate: s.start_date || s.startDate,
            endDate: s.end_date || s.endDate
          }));
        }
      }
      
      // Use navigation state services if they have MORE services than API returned
      // This handles cases where API returns incomplete data or navigation state has more accurate count
      const navServicesCount = propertyData?.services?.length || 0;
      if (navServicesCount > servicesToUse.length) {
        console.log('[PropertyScheduling] Navigation state has more services:', navServicesCount, 'vs API:', servicesToUse.length);
        servicesToUse = propertyData.services.map((s, index) => ({
          id: s.id || `nav-${index}`,
          scheduleId: null,
          name: s.name || s.service,
          category: s.category || s.serviceType || s.name,
          vendorName: s.vendorName || s.vendor_name || 'Unassigned',
          vendorId: s.vendorId || s.vendor_id || null,
          frequency: s.frequency || s.frequencyType || 'Monthly',
          visits: s.visits || s.frequencyCount || 12,
          status: s.schedulingStatus === 'scheduled' ? 'Scheduled' : 'Schedule',
          customVisits: s.customVisits,
          startDate: s.startDate || s.scheduleDate,
          endDate: s.endDate
        }));
      }
      
      // Filter to only include services with assigned vendors
      const servicesWithVendors = servicesToUse.filter(s => s.vendorId);
      
      if (servicesWithVendors.length > 0) {
        setServices(servicesWithVendors);
        if (!selectedService) {
          setSelectedService(servicesWithVendors[0]);
          // Fetch vendor availability for the first service
          if (servicesWithVendors[0].vendorId) {
            fetchVendorAvailability(servicesWithVendors[0].vendorId);
          }
        }
      } else {
        // No services with assigned vendors found
        setServices([]);
        console.log('No services with assigned vendors found for this property');
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
      // Try to use navigation state services as fallback
      if (propertyData?.services?.length > 0) {
        const fallbackServices = propertyData.services.map((s, index) => ({
          id: s.id || `nav-${index}`,
          scheduleId: null,
          name: s.name || s.service,
          category: s.category || s.serviceType || s.name,
          vendorName: s.vendorName || s.vendor_name || 'Unassigned',
          vendorId: s.vendorId || s.vendor_id || null,
          frequency: s.frequency || s.frequencyType || 'Monthly',
          visits: s.visits || s.frequencyCount || 12,
          status: 'Schedule',
          customVisits: s.customVisits,
          startDate: s.startDate || s.scheduleDate,
          endDate: s.endDate
        })).filter(s => s.vendorId); // Only include services with assigned vendors
        
        setServices(fallbackServices);
        if (fallbackServices.length > 0 && !selectedService) {
          setSelectedService(fallbackServices[0]);
        }
      } else {
        setServices([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch vendor availability for the calendar grid
  const fetchVendorAvailability = async (vendorId) => {
    if (!vendorId) return;
    
    setLoadingAvailability(true);
    try {
      const token = getAuthToken();
      const month = currentWeekStart.getMonth() + 1;
      const year = currentWeekStart.getFullYear();
      
      const response = await fetch(
        `${API_BASE}/api/schedules/vendor/${vendorId}/availability?month=${month}&year=${year}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setVendorAvailability({
            bookings: result.data.bookings || {},
            maxDaily: result.data.maxDailyVisits || 5,
            availability: result.data.availability || []
          });
        }
      }
    } catch (error) {
      console.error('Error fetching vendor availability:', error);
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Generate recommended dates using real vendor availability from backend
  const generateRecommendedDates = async (service) => {
    if (!service?.vendorId) {
      // Fallback to default dates if no vendor assigned
      generateDefaultAvailableDates(service);
      return;
    }

    try {
      const token = getAuthToken();
      const startDate = new Date(currentWeekStart);
      startDate.setDate(startDate.getDate() + 5); // Default to Saturday of current week
      
      const params = new URLSearchParams({
        vendorId: service.vendorId,
        frequency: service.frequency || 'monthly',
        startDate: startDate.toISOString().split('T')[0],
        totalVisits: 4, // Get recommendations for first 4 visits
        zone: property?.zone || '',
        searchWindow: 3
      });

      const response = await fetch(`${API_BASE}/api/schedules/recommended-dates?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.recommendations?.length > 0) {
          // Convert backend recommendations to frontend format
          const dates = [];
          
          // Get vendor's working hours from API response
          const vendorWorkingHours = result.data.vendorWorkingHours;
          
          result.data.recommendations.slice(0, 4).forEach((rec, i) => {
            const bestOption = rec.bestOption;
            if (bestOption) {
              // Parse date string to Date object
              const [year, month, day] = bestOption.date.split('-').map(Number);
              const dateObj = new Date(year, month - 1, day);
              
              // Map recommendation type to frontend type
              let type = 'available';
              if (bestOption.recommendation === 'highly_recommended' || bestOption.recommendation === 'recommended') {
                type = 'recommended';
              } else if (bestOption.recommendation === 'limited') {
                type = 'limited';
              }
              
              // Generate clear reason text based on zone jobs
              let reason = '';
              const zoneJobs = bestOption.sameZoneJobs || 0;
              const zoneName = property?.zone || 'Zone A';
              
              if (vendorWorkingHours) {
                reason = `Vendor works ${vendorWorkingHours.from} - ${vendorWorkingHours.to}`;
              } else if (zoneJobs > 0) {
                reason = `Vendor already has ${zoneJobs} ${zoneName} job${zoneJobs > 1 ? 's' : ''} on this date`;
              } else if (bestOption.daysFromTarget === 0) {
                reason = 'Exact target date based on frequency';
              } else if (bestOption.availableSlots >= 3) {
                reason = 'High availability';
              } else if (bestOption.availableSlots >= 1) {
                reason = 'Limited availability';
              }
              
              // Use vendor's working hours start time if available, otherwise use recommended time from backend
              const recommendedTime = bestOption.recommendedTime || (vendorWorkingHours?.from) || '10:00 AM';
              
              dates.push({
                id: i + 1,
                date: dateObj,
                dateStr: formatDateFull(dateObj),
                time: recommendedTime,
                type: type,
                reason: reason,
                vendor: service.vendorName,
                zone: zoneName,
                score: bestOption.score,
                availableSlots: bestOption.availableSlots,
                sameZoneJobs: zoneJobs,
                daysFromTarget: bestOption.daysFromTarget,
                vendorWorkingHours: vendorWorkingHours
              });
            }
          });
          
          if (dates.length > 0) {
            setRecommendedDates(dates);
            return;
          }
        }
      }
      
      // Fallback to default dates if API fails or returns no data
      generateDefaultAvailableDates(service);
    } catch (error) {
      console.error('Error fetching recommended dates:', error);
      generateDefaultAvailableDates(service);
    }
  };

  // Fallback dates when vendor availability cannot be fetched
  // This generates basic available dates based on the current week
  const generateDefaultAvailableDates = (service) => {
    const dates = [];
    const baseDate = new Date(currentWeekStart);
    
    // Generate dates for the current week (weekdays only)
    const defaultSlots = [
      { day: 1, time: '10:00 AM', type: 'available', reason: service?.vendorId ? '' : 'No vendor assigned' },
      { day: 2, time: '2:00 PM', type: 'available', reason: '' },
      { day: 3, time: '10:00 AM', type: 'available', reason: '' },
      { day: 4, time: '11:00 AM', type: 'available', reason: '' }
    ];
    
    defaultSlots.forEach((rec, i) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + rec.day);
      dates.push({
        id: i + 1,
        date: date,
        dateStr: formatDateFull(date),
        time: rec.time,
        type: rec.type,
        reason: rec.reason,
        vendor: service?.vendorName || 'Unassigned',
        zone: property?.zone || 'Zone A'
      });
    });
    
    setRecommendedDates(dates);
  };

  // Load saved visits from database if service is already scheduled
  const loadSavedVisits = async (service) => {
    // Use scheduleId (could be numeric ID or string schedule_id like "SCH-xxx")
    const scheduleIdToUse = service?.scheduleId || service?.id;
    if (!scheduleIdToUse) return null;
    
    console.log('[PropertyScheduling] Loading saved visits for schedule:', scheduleIdToUse);
    
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/schedules/service/${scheduleIdToUse}/visits`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.length > 0) {
          return result.data.map(visit => {
            // Parse date carefully to avoid timezone issues
            const dateStr = visit.scheduled_date || visit.scheduledDate;
            let visitDate;
            if (typeof dateStr === 'string') {
              const datePart = dateStr.split('T')[0]; // Get YYYY-MM-DD
              const [year, month, day] = datePart.split('-').map(Number);
              visitDate = new Date(year, month - 1, day);
            } else {
              visitDate = new Date(dateStr);
            }
            
            return {
              visitNumber: visit.visit_number || visit.visitNumber,
              date: visitDate,
              dateStr: visitDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
              shortDateStr: visitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              time: visit.scheduled_time_start ? formatTimeFromDB(visit.scheduled_time_start) : '10:00 AM',
              status: visit.status === 'scheduled' ? 'Scheduled' : visit.status,
              isEdited: false,
              visitId: visit.visit_id || visit.visitId
            };
          });
        }
      }
    } catch (error) {
      console.error('Error loading saved visits:', error);
    }
    return null;
  };
  
  // Helper to format time from DB format (HH:MM:SS) to display format (H:MM AM/PM)
  const formatTimeFromDB = (timeStr) => {
    if (!timeStr) return '10:00 AM';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const isPM = hours >= 12;
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  };

  const generatePlannedVisits = async (service) => {
    const frequencyConfig = getFrequencyConfig(service.frequency);
    const expectedVisits = service.visits || frequencyConfig?.visitsPerYear || 12;
    
    // First, try to load saved visits if service is already scheduled
    if (service?.status === 'Scheduled' || service?.scheduleId) {
      const savedVisits = await loadSavedVisits(service);
      if (savedVisits && savedVisits.length > 0) {
        setPlannedVisits(savedVisits);
        return;
      }
    }
    
    // Use selected slot date or default to next week
    const firstServiceDate = selectedSlot?.date || (() => {
      const defaultDate = new Date(currentWeekStart);
      defaultDate.setDate(defaultDate.getDate() + 5); // Default to Saturday
      return defaultDate;
    })();
    
    // Check if this is a manual/customer requirement frequency
    if (!frequencyConfig?.autoGenerate) {
      // For customer requirement / on request - create empty visits for manual selection
      const manualVisits = [];
      const numVisits = service.customVisits || service.visits || 0;
      
      for (let i = 0; i < numVisits; i++) {
        manualVisits.push({
          visitNumber: i + 1,
          date: null,
          dateStr: 'Select Date',
          time: 'Select Time',
          status: 'Pending Selection',
          isManual: true
        });
      }
      setPlannedVisits(manualVisits);
      return;
    }
    
    // Generate automatic schedule based on frequency - use expectedVisits
    const schedules = generateScheduleDates(
      firstServiceDate,
      service.frequency,
      expectedVisits
    );
    
    // Format for display
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    
    // Add time slots
    const visitsWithTime = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: selectedSlot?.time || '10:00 AM',
      status: 'Planned'
    }));
    
    setPlannedVisits(visitsWithTime);
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getTimeSlots = () => {
    return ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'];
  };

  const getSlotStatus = (day, timeIndex) => {
    const timeSlots = getTimeSlots();
    const currentSlotTime = timeSlots[timeIndex];
    
    // Format date as YYYY-MM-DD for lookup
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const dayNum = String(day.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayNum}`;
    
    // Check if this slot matches any recommended date first
    const matchesRecommendedDate = recommendedDates.some(rec => {
      if (!rec.date) return false;
      const recYear = rec.date.getFullYear();
      const recMonth = String(rec.date.getMonth() + 1).padStart(2, '0');
      const recDay = String(rec.date.getDate()).padStart(2, '0');
      const recDateStr = `${recYear}-${recMonth}-${recDay}`;
      
      // Normalize time for comparison
      const normalizeTime = (t) => {
        if (!t) return '';
        return t.replace(/^0/, '').replace(':00 ', ' ').replace(':30 ', ':30 ');
      };
      const recTimeNorm = normalizeTime(rec.time);
      const slotTimeNorm = normalizeTime(currentSlotTime);
      
      return recDateStr === dateStr && recTimeNorm === slotTimeNorm && rec.type === 'recommended';
    });
    
    if (matchesRecommendedDate) return 'recommended';
    
    // Use real vendor availability data
    const bookingCount = vendorAvailability.bookings[dateStr] || 0;
    const maxDaily = vendorAvailability.maxDaily || 5;
    const availableSlots = maxDaily - bookingCount;
    
    // If vendor is fully booked for the day
    if (availableSlots <= 0) return 'booked';
    
    // If vendor has limited availability (less than 2 slots remaining)
    if (availableSlots <= 2) return 'limited';
    
    // Check if this time matches any recommended date (but not the top one)
    const matchesAvailableRecommended = recommendedDates.some(rec => {
      if (!rec.date) return false;
      const recYear = rec.date.getFullYear();
      const recMonth = String(rec.date.getMonth() + 1).padStart(2, '0');
      const recDay = String(rec.date.getDate()).padStart(2, '0');
      const recDateStr = `${recYear}-${recMonth}-${recDay}`;
      
      const normalizeTime = (t) => t?.replace(/^0/, '').replace(':00 ', ' ').replace(':30 ', ':30 ') || '';
      return recDateStr === dateStr && normalizeTime(rec.time) === normalizeTime(currentSlotTime);
    });
    
    if (matchesAvailableRecommended) return 'recommended';
    
    return 'available';
  };

  const handleSelectSlot = (day, time, status) => {
    if (status === 'booked') return;
    setSelectedSlot({ date: day, time, status });
    
    // If we already have planned visits, update the first one with the new slot
    // but keep other visits' dates intact
    if (plannedVisits.length > 0) {
      setPlannedVisits(prev => prev.map((visit, index) => {
        if (index === 0) {
          return {
            ...visit,
            date: day,
            dateStr: formatDateFull(day),
            shortDateStr: formatDateShort(day),
            time: time,
            isEdited: true
          };
        }
        return visit;
      }));
    }
  };

  // Handle clicking a recommended date - select it and generate visits
  const handleSelectRecommendedDate = (rec) => {
    if (!selectedService) return;
    
    // Set the selected slot
    setSelectedSlot({ date: rec.date, time: rec.time, status: rec.type });
    
    // Get the expected number of visits from service config
    const frequencyConfig = getFrequencyConfig(selectedService.frequency);
    const expectedVisits = selectedService.visits || frequencyConfig?.visitsPerYear || 12;
    
    // Generate visits starting from this date
    const schedules = generateScheduleDates(rec.date, selectedService.frequency, expectedVisits);
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    
    const updatedVisits = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: rec.time,
      status: 'Planned'
    }));
    
    setPlannedVisits(updatedVisits);
    
    // If confirmation modal is open, also update the confirmation schedule
    if (showConfirmation) {
      const confirmSchedule = updatedVisits.map((visit, index) => ({
        visitNumber: visit.visitNumber,
        targetDate: visit.date,
        targetDateStr: visit.dateStr || visit.shortDateStr,
        scheduledDate: visit.date,
        scheduledDateStr: visit.dateStr || visit.shortDateStr,
        time: visit.time || rec.time,
        status: 'pending_schedule',
        isEdited: false,
        isManual: false
      }));
      setConfirmationSchedule(confirmSchedule);
    }
  };

  // Use the selected/first recommended date and go to confirmation
  const handleUseRecommended = () => {
    if (!selectedService || !recommendedDates.length) return;
    
    // Use currently selected slot if available, otherwise use first recommended
    const rec = selectedSlot && selectedSlot.date 
      ? { date: selectedSlot.date, time: selectedSlot.time }
      : recommendedDates[0];
    
    // Set the selected slot
    setSelectedSlot({ date: rec.date, time: rec.time, status: 'recommended' });
    
    // Get the expected number of visits from service config
    const frequencyConfig = getFrequencyConfig(selectedService.frequency);
    const expectedVisits = selectedService.visits || frequencyConfig?.visitsPerYear || 12;
    
    // Generate all visits with correct count using the selected/recommended date
    const schedules = generateScheduleDates(rec.date, selectedService.frequency, expectedVisits);
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    
    const updatedVisits = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: rec.time,
      status: 'Planned'
    }));
    
    setPlannedVisits(updatedVisits);
    
    // Pass visits directly to confirmation to avoid state timing issues
    handlePrepareConfirmation(updatedVisits);
  };

  // Apply recommended date to all monthly visits
  const handleApplyToAllMonthly = () => {
    if (!selectedService || !recommendedDates.length) return;
    
    // Use selected slot if available, otherwise use first recommended
    const rec = selectedSlot ? 
      { date: selectedSlot.date, time: selectedSlot.time } : 
      recommendedDates[0];
    
    setSelectedSlot({ date: rec.date, time: rec.time, status: 'recommended' });
    
    // Get the expected number of visits from service config
    const frequencyConfig = getFrequencyConfig(selectedService.frequency);
    const expectedVisits = selectedService.visits || frequencyConfig?.visitsPerYear || 12;
    
    // Regenerate all visits with correct count using the selected/recommended date
    const schedules = generateScheduleDates(rec.date, selectedService.frequency, expectedVisits);
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    
    const updatedVisits = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: rec.time,
      status: 'Planned'
    }));
    
    setPlannedVisits(updatedVisits);
  };

  // Show customize dates modal - opens the confirmation screen where user can edit individual dates
  const handleCustomizeDates = () => {
    if (!selectedService) return;
    
    // If no visits generated yet, generate them first
    if (plannedVisits.length === 0) {
      const rec = selectedSlot || (recommendedDates.length > 0 ? recommendedDates[0] : null);
      if (rec) {
        const frequencyConfig = getFrequencyConfig(selectedService.frequency);
        const expectedVisits = selectedService.visits || frequencyConfig?.visitsPerYear || 12;
        
        const schedules = generateScheduleDates(rec.date || new Date(), selectedService.frequency, expectedVisits);
        const formattedSchedules = formatSchedulesForDisplay(schedules);
        
        const updatedVisits = formattedSchedules.map((schedule, index) => ({
          ...schedule,
          time: rec.time || '10:00 AM',
          status: 'Planned'
        }));
        
        setPlannedVisits(updatedVisits);
        
        // Pass visits directly to confirmation to avoid state timing issues
        handlePrepareConfirmation(updatedVisits);
        return;
      }
    }
    
    handlePrepareConfirmation();
  };

  // Prepare schedule for confirmation
  // Can optionally pass visits directly to avoid state timing issues
  const handlePrepareConfirmation = (directVisits = null) => {
    if (!selectedService) return;
    
    const visitsToUse = directVisits || plannedVisits;
    console.log('[Prepare Confirmation] Visits:', visitsToUse.map(v => ({ visit: v.visitNumber, time: v.time, edited: v.isEdited })));
    if (!selectedSlot && visitsToUse.length === 0) return;
    
    // Generate confirmation schedule with target dates and recommended dates
    // Preserve isEdited flag from planned visits
    const defaultTime = selectedSlot?.time || '10:00 AM';
    const schedule = visitsToUse.map((visit, index) => ({
      visitNumber: visit.visitNumber,
      targetDate: visit.date,
      targetDateStr: visit.dateStr || visit.shortDateStr,
      scheduledDate: visit.date, // Can be adjusted
      scheduledDateStr: visit.dateStr || visit.shortDateStr,
      time: visit.time || (index === 0 ? defaultTime : '10:00 AM'),
      status: 'pending_schedule',
      isEdited: visit.isEdited || false,
      isManual: visit.isManual || false
    }));
    
    setConfirmationSchedule(schedule);
    setShowConfirmation(true);
  };



  // Edit individual visit date
  const handleEditVisitDate = (index, newDateStr, newTime) => {
    // Parse date string to avoid timezone issues (YYYY-MM-DD format from input)
    const [year, month, day] = newDateStr.split('-').map(Number);
    const newDate = new Date(year, month - 1, day); // month is 0-indexed
    
    setConfirmationSchedule(prev => prev.map((v, i) => 
      i === index ? {
        ...v,
        scheduledDate: newDate,
        scheduledDateStr: newDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        time: newTime || v.time,
        isEdited: true
      } : v
    ));
    setEditingVisitIndex(null);
  };

  // Confirm final schedule
  const handleConfirmSchedule = async () => {
    setConfirmingSchedule(true);
    const token = getAuthToken();
    
    try {
      // Prepare schedule data for API
      const schedulePayload = {
        propertyId: propertyId,
        serviceId: selectedService?.id,
        serviceName: selectedService?.name,
        serviceCategory: selectedService?.category,
        vendorId: selectedService?.vendorId,
        vendorName: selectedService?.vendorName,
        frequency: selectedService?.frequency,
        totalVisits: confirmationSchedule.length,
        visits: confirmationSchedule.map(visit => {
          // Format dates as YYYY-MM-DD to avoid timezone issues
          const formatDateForAPI = (date) => {
            if (!date) return null;
            const d = date instanceof Date ? date : new Date(date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };
          
          return {
            visitNumber: visit.visitNumber,
            targetDate: formatDateForAPI(visit.targetDate),
            scheduledDate: formatDateForAPI(visit.scheduledDate),
            time: visit.time,
            status: visit.isEdited ? 'modified' : 'scheduled',
            isEdited: visit.isEdited || false
          };
        })
      };
      
      console.log('Sending schedule payload:', JSON.stringify(schedulePayload, null, 2));
      
      const response = await fetch(`${API_BASE}/api/schedules/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(schedulePayload)
      });
      
      console.log('Response status:', response.status);
      
      let result;
      try {
        result = await response.json();
        console.log('API response:', result);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok || !result.success) {
        console.error('API error:', result);
        // Show detailed error message
        const errorDetails = result.error || result.message || `Failed to save schedule (status: ${response.status})`;
        throw new Error(errorDetails);
      }
      
      // Close modal
      setShowConfirmation(false);
      
      // Update the service status to Scheduled and store the scheduleId
      const scheduleId = result.data?.serviceScheduleId;
      const updatedService = { ...selectedService, status: 'Scheduled', scheduleId: scheduleId };
      
      // Update services array
      setServices(prev => prev.map(s => 
        s.id === selectedService.id ? updatedService : s
      ));
      
      // Also update the selected service directly
      setSelectedService(updatedService);
      
      // Update planned visits to show as scheduled
      setPlannedVisits(prev => prev.map(v => ({ ...v, status: 'Scheduled' })));
      
      // Clear slot selection but keep showing the service
      setSelectedSlot(null);
      
      console.log('[Confirm Schedule] Service updated to Scheduled:', updatedService);
      
      // Show success notification - stay on same page
      showToast(`Schedule confirmed successfully! ${result.data?.visitsCreated || confirmationSchedule.length} visits created.`, 'success');
    } catch (error) {
      console.error('Error confirming schedule:', error);
      showToast(`Error confirming schedule: ${error.message}`, 'error');
    } finally {
      setConfirmingSchedule(false);
    }
  };

  // Save draft schedule
  const handleSaveDraft = async () => {
    if (!selectedService || plannedVisits.length === 0) {
      showToast('Please select a service and generate a schedule first', 'error');
      return;
    }
    
    const token = getAuthToken();
    
    try {
      // Format dates as YYYY-MM-DD to avoid timezone issues
      const formatDateForAPI = (date) => {
        if (!date) return null;
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const draftPayload = {
        propertyId: propertyId,
        serviceId: selectedService?.id,
        serviceName: selectedService?.name,
        frequency: selectedService?.frequency,
        status: 'draft',
        visits: plannedVisits.map(visit => ({
          visitNumber: visit.visitNumber,
          targetDate: formatDateForAPI(visit.date),
          time: visit.time,
          isEdited: visit.isEdited || false
        }))
      };
      
      const response = await fetch(`${API_BASE}/api/schedules/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(draftPayload)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save draft');
      }
      
      showToast('Draft saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving draft:', error);
      showToast('Error saving draft. Please try again.', 'error');
    }
  };

  // ===== WIZARD FUNCTIONS FOR STEP-BY-STEP SCHEDULING =====
  
  // Plan the current service (store locally, don't save to DB yet)
  const handlePlanService = () => {
    if (!selectedService || plannedVisits.length === 0 || !plannedVisits.some(v => v.date)) {
      showToast('Please select dates for this service first', 'error');
      return;
    }
    
    const currentServiceId = selectedService.id;
    
    // Store the planned schedule for this service
    setPlannedSchedules(prev => ({
      ...prev,
      [currentServiceId]: {
        service: { ...selectedService },
        visits: [...plannedVisits],
        isPlanned: true,
        plannedAt: new Date()
      }
    }));
    
    // Update service status in the services array to 'Planned'
    setServices(prev => prev.map(s => 
      s.id === currentServiceId ? { ...s, status: 'Planned' } : s
    ));
    
    // Move to next unscheduled service (pass the just-planned service id to avoid race condition)
    handleMoveToNextService(currentServiceId);
  };
  
  // Move to the next unscheduled service
  // justPlannedServiceId is passed to handle race condition with state updates
  const handleMoveToNextService = (justPlannedServiceId = null) => {
    // Filter services: exclude Scheduled, Planned status, and any in plannedSchedules (plus the just-planned one)
    const unscheduledServices = services.filter(s => {
      if (s.status === 'Scheduled' || s.status === 'Planned') return false;
      if (plannedSchedules[s.id]) return false;
      if (justPlannedServiceId && s.id === justPlannedServiceId) return false;
      return true;
    });
    
    if (unscheduledServices.length > 0) {
      // Find the next service to schedule
      const currentIdx = services.findIndex(s => s.id === selectedService?.id);
      let nextService = null;
      
      // Look for next unscheduled service after current
      for (let i = currentIdx + 1; i < services.length; i++) {
        const svc = services[i];
        if (svc.status !== 'Scheduled' && svc.status !== 'Planned' && 
            !plannedSchedules[svc.id] && svc.id !== justPlannedServiceId) {
          nextService = svc;
          break;
        }
      }
      
      // If not found, look from beginning
      if (!nextService) {
        for (let i = 0; i < currentIdx; i++) {
          const svc = services[i];
          if (svc.status !== 'Scheduled' && svc.status !== 'Planned' && 
              !plannedSchedules[svc.id] && svc.id !== justPlannedServiceId) {
            nextService = svc;
            break;
          }
        }
      }
      
      if (nextService) {
        setSelectedService(nextService);
        setPlannedVisits([]);
        setSelectedSlot(null);
        setCurrentServiceIndex(services.findIndex(s => s.id === nextService.id));
      }
    } else {
      // All services are planned - move to review step
      setWizardStep(WIZARD_STEPS.REVIEW);
      setShowFinalReview(true);
    }
  };
  
  // Get count of services by status
  const getServiceCounts = () => {
    const planned = Object.keys(plannedSchedules).length;
    const scheduled = services.filter(s => s.status === 'Scheduled').length;
    const pending = services.length - planned - scheduled;
    return { planned, scheduled, pending, total: services.length };
  };
  
  // Check if all services are planned (ready for final review)
  const allServicesPlanned = () => {
    const unplannedServices = services.filter(s => 
      s.status !== 'Scheduled' && !plannedSchedules[s.id]
    );
    return unplannedServices.length === 0 && Object.keys(plannedSchedules).length > 0;
  };
  
  // Start/show final review
  const handleShowFinalReview = () => {
    setWizardStep(WIZARD_STEPS.REVIEW);
    setShowFinalReview(true);
  };
  
  // Confirm all planned schedules at once
  const handleConfirmAllSchedules = async () => {
    setConfirmingAllSchedules(true);
    const token = getAuthToken();
    
    try {
      // Format dates as YYYY-MM-DD to avoid timezone issues
      const formatDateForAPI = (date) => {
        if (!date) return null;
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const results = [];
      const errors = [];
      
      // Process each planned service
      for (const [serviceId, planData] of Object.entries(plannedSchedules)) {
        const { service, visits } = planData;
        
        const schedulePayload = {
          propertyId: propertyId,
          serviceId: service.id,
          serviceName: service.name,
          serviceCategory: service.category,
          vendorId: service.vendorId,
          vendorName: service.vendorName,
          frequency: service.frequency,
          totalVisits: visits.length,
          visits: visits.map(visit => ({
            visitNumber: visit.visitNumber,
            targetDate: formatDateForAPI(visit.date),
            scheduledDate: formatDateForAPI(visit.date),
            time: visit.time,
            status: visit.isEdited ? 'modified' : 'scheduled',
            isEdited: visit.isEdited || false
          }))
        };
        
        try {
          const response = await fetch(`${API_BASE}/api/schedules/confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(schedulePayload)
          });
          
          const result = await response.json();
          
          if (response.ok && result.success) {
            results.push({
              serviceId,
              serviceName: service.name,
              scheduleId: result.data?.serviceScheduleId,
              visitsCreated: result.data?.visitsCreated || visits.length
            });
            
            // Update service status in the services array
            setServices(prev => prev.map(s => 
              s.id === service.id ? { ...s, status: 'Scheduled', scheduleId: result.data?.serviceScheduleId } : s
            ));
          } else {
            errors.push({ serviceName: service.name, error: result.error || result.message || 'Failed' });
          }
        } catch (err) {
          errors.push({ serviceName: service.name, error: err.message });
        }
      }
      
      // Clear planned schedules after confirmation
      setPlannedSchedules({});
      setShowFinalReview(false);
      setWizardStep(WIZARD_STEPS.SCHEDULING);
      
      // Show result
      if (errors.length === 0) {
        const totalVisits = results.reduce((sum, r) => sum + r.visitsCreated, 0);
        showToast(`All schedules confirmed! ${results.length} services scheduled with ${totalVisits} total visits.`, 'success');
      } else {
        showToast(`Partial success: ${results.length} scheduled, ${errors.length} failed.`, 'error');
      }
      
      // Refresh services list
      fetchPropertyDetails();
      
    } catch (error) {
      console.error('Error confirming all schedules:', error);
      showToast(`Error confirming schedules: ${error.message}`, 'error');
    } finally {
      setConfirmingAllSchedules(false);
    }
  };
  
  // Edit a planned service (go back to scheduling step)
  const handleEditPlannedService = (serviceId) => {
    const planData = plannedSchedules[serviceId];
    if (planData) {
      setSelectedService(planData.service);
      setPlannedVisits(planData.visits);
      setShowFinalReview(false);
      setWizardStep(WIZARD_STEPS.SCHEDULING);
    }
  };
  
  // Remove a service from planned (go back to scheduling)
  const handleRemoveFromPlanned = (serviceId) => {
    setPlannedSchedules(prev => {
      const updated = { ...prev };
      delete updated[serviceId];
      return updated;
    });
    
    // Update service status back to Schedule
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, status: 'Schedule' } : s
    ));
  };
  
  // ===== END WIZARD FUNCTIONS =====

  // Reschedule handlers
  const handleOpenReschedule = (visit) => {
    setRescheduleVisit(visit);
    setRescheduleScope('this_visit_only'); // Always default to This Visit Only
    setShowRescheduleModal(true);
  };

  const handleReschedule = async (newDate, newTime, reason) => {
    if (!rescheduleVisit) return;
    
    try {
      if (rescheduleScope === 'this_visit_only') {
        // Only affect this specific visit
        setConfirmationSchedule(prev => prev.map(v => 
          v.visitNumber === rescheduleVisit.visitNumber ? {
            ...v,
            scheduledDate: newDate,
            scheduledDateStr: new Date(newDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: newTime || v.time,
            status: 'rescheduled',
            originalDate: v.scheduledDate,
            rescheduleReason: reason,
            isEdited: true
          } : v
        ));
      } else {
        // Affect this and all future visits (shift pattern)
        const visitIndex = confirmationSchedule.findIndex(v => v.visitNumber === rescheduleVisit.visitNumber);
        const daysDiff = Math.round((new Date(newDate) - new Date(rescheduleVisit.scheduledDate)) / (1000 * 60 * 60 * 24));
        
        setConfirmationSchedule(prev => prev.map((v, i) => {
          if (i >= visitIndex) {
            const shiftedDate = new Date(v.scheduledDate);
            shiftedDate.setDate(shiftedDate.getDate() + daysDiff);
            return {
              ...v,
              scheduledDate: shiftedDate,
              scheduledDateStr: shiftedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              time: i === visitIndex ? (newTime || v.time) : v.time,
              status: i === visitIndex ? 'rescheduled' : v.status,
              isEdited: true
            };
          }
          return v;
        }));
      }
      
      setShowRescheduleModal(false);
      setRescheduleVisit(null);
    } catch (error) {
      console.error('Error rescheduling:', error);
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeekStart(newDate);
  };

  const goBack = () => navigate(-1);
  
  // Schedule status colors
  const getStatusColor = (status) => {
    const colors = {
      'pending_schedule': 'bg-gray-100 text-gray-700',
      'scheduled': 'bg-blue-100 text-blue-700',
      'upcoming': 'bg-indigo-100 text-indigo-700',
      'work_order_created': 'bg-purple-100 text-purple-700',
      'in_progress': 'bg-amber-100 text-amber-700',
      'completed': 'bg-green-100 text-green-700',
      'rescheduled': 'bg-orange-100 text-orange-700',
      'cancelled': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  const weekDays = getWeekDays();
  const timeSlots = getTimeSlots();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Schedule Property</h1>
            <nav className="text-xs sm:text-sm text-gray-500 hidden md:block">
              Home › Scheduling › Pending Property Schedules › <span className="text-gray-900">Schedule Property</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Back to Pending Schedules</span>
              <span className="xs:hidden">Back</span>
            </button>
          </div>
        </div>
      </div>

      

      {/* Property Info Card */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 md:px-6 py-3">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property ID</p>
                <p className="text-xs sm:text-sm font-semibold text-blue-600 truncate">{property?.propertyId || 'PROP-101'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property Name</p>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{property?.propertyName || 'Green Valley Apartments'}</p>
              </div>
              <div className="min-w-0 col-span-2 sm:col-span-1">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Customer</p>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                  {property?.customerName || 'Mr. Ramesh Kumar'}
                </p>
                <span className="text-[10px] sm:text-xs text-gray-500 font-normal flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> 98765 43210</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property Type</p>
                <p className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1 truncate"><Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 flex-shrink-0" /> Apartment</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Zone</p>
                <span className="inline-flex px-1.5 sm:px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] sm:text-xs font-medium rounded border border-blue-200">{property?.zone || 'Zone A'}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Package</p>
                <p className="text-xs sm:text-sm font-medium text-purple-700 truncate">{property?.packageName || 'Apartment Basic AMC'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Wizard Progress Header */}
      {permissions.canConfirm && (
        <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 overflow-x-auto">
          {/* Responsive layout - stacks on mobile, horizontal on larger screens */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4 min-w-max lg:min-w-0">
            {/* Left: Progress Stats */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
              <span className="flex items-center gap-1 text-amber-600 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {getServiceCounts().pending} Pending
              </span>
              <span className="flex items-center gap-1 text-blue-600 whitespace-nowrap">
                <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {getServiceCounts().planned} Planned
              </span>
              <span className="flex items-center gap-1 text-green-600 whitespace-nowrap">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {getServiceCounts().scheduled} Confirmed
              </span>
            </div>

            {/* Center: Step Indicator */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Step 1 */}
              <div className={`flex items-center gap-1 sm:gap-1.5 ${wizardStep === WIZARD_STEPS.SERVICE_SELECTION ? 'text-blue-600' : Object.keys(plannedSchedules).length > 0 || wizardStep === WIZARD_STEPS.REVIEW ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                  wizardStep === WIZARD_STEPS.SERVICE_SELECTION 
                    ? 'bg-blue-600 text-white' 
                    : Object.keys(plannedSchedules).length > 0 || wizardStep === WIZARD_STEPS.REVIEW
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                }`}>
                  {Object.keys(plannedSchedules).length > 0 || wizardStep === WIZARD_STEPS.REVIEW ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : '1'}
                </div>
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Select Service</span>
              </div>
              
              <div className={`w-4 sm:w-8 h-0.5 ${wizardStep !== WIZARD_STEPS.SERVICE_SELECTION ? 'bg-blue-400' : 'bg-gray-300'}`} />
              
              {/* Step 2 */}
              <div className={`flex items-center gap-1 sm:gap-1.5 ${wizardStep === WIZARD_STEPS.DATE_SELECTION ? 'text-blue-600' : wizardStep === WIZARD_STEPS.REVIEW ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                  wizardStep === WIZARD_STEPS.DATE_SELECTION 
                    ? 'bg-blue-600 text-white' 
                    : wizardStep === WIZARD_STEPS.REVIEW
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                }`}>
                  {wizardStep === WIZARD_STEPS.REVIEW ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : '2'}
                </div>
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Schedule Dates</span>
              </div>
              
              <div className={`w-4 sm:w-8 h-0.5 ${wizardStep === WIZARD_STEPS.REVIEW ? 'bg-blue-400' : 'bg-gray-300'}`} />
              
              {/* Step 3 */}
              <div className={`flex items-center gap-1 sm:gap-1.5 ${wizardStep === WIZARD_STEPS.REVIEW ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                  wizardStep === WIZARD_STEPS.REVIEW 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  3
                </div>
                <span className="text-[10px] sm:text-xs font-medium hidden sm:inline">Review & Confirm</span>
              </div>
            </div>

            {/* Right: Progress Bar */}
            <div className="w-24 sm:w-40 bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${((getServiceCounts().planned + getServiceCounts().scheduled) / Math.max(getServiceCounts().total, 1)) * 100}%` 
                }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* View-only notice for users without scheduling permissions */}
      {!permissions.canConfirm && (
        <div className="px-3 sm:px-6 py-2 sm:py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-gray-600">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm">View-only mode - You can view schedules but cannot make changes</span>
          </div>
        </div>
      )}

      {/* Main Content Area - Responsive 3-column layout */}
      <div className="p-3 sm:p-4 md:p-6 flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-x-auto">
        {/* Left: Services List with Step-by-Step Progress */}
        <div className="w-full lg:w-56 xl:w-64 lg:min-w-[224px] xl:min-w-[256px] flex-shrink-0 order-1 lg:order-none">
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Services to Schedule</h3>
              <span className="text-xs sm:text-sm text-gray-500">{services.length}</span>
            </div>
            
            {/* Step-by-step service list - horizontal scroll on mobile, vertical on larger screens */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-3 px-3 lg:mx-0 lg:px-0">
              {services.length === 0 ? (
                <div className="text-center py-6 sm:py-8 w-full">
                  <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mx-auto mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">No Services Found</p>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-1">This property has no services to schedule yet.</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">Ensure the estimate is approved and has services defined.</p>
                </div>
              ) : (
                services.map((service, index) => {
                  const isPlanned = plannedSchedules[service.id]?.isPlanned;
                  const isScheduled = service.status === 'Scheduled';
                  const isSelected = selectedService?.id === service.id;
                  const isPending = !isPlanned && !isScheduled;
                  
                  return (
                    <button
                      key={service.id}
                      onClick={() => {
                        if (!isScheduled) {
                          setSelectedService(service);
                          // Load planned visits if service was already planned
                          if (plannedSchedules[service.id]) {
                            setPlannedVisits(plannedSchedules[service.id].visits);
                          } else {
                            setPlannedVisits([]);
                            setSelectedSlot(null);
                          }
                        }
                      }}
                      disabled={isScheduled}
                      className={`flex-shrink-0 w-40 lg:w-full p-2 sm:p-3 rounded-lg border-2 text-left transition-all relative ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                          : isScheduled
                            ? 'border-green-300 bg-green-50 cursor-not-allowed'
                            : isPlanned
                              ? 'border-indigo-300 bg-indigo-50 hover:border-indigo-400'
                              : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Step number indicator - hidden on mobile */}
                      <div className={`hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 rounded-full items-center justify-center text-[10px] sm:text-xs font-bold ${
                        isScheduled 
                          ? 'bg-green-500 text-white'
                          : isPlanned
                            ? 'bg-indigo-500 text-white'
                            : isSelected
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-300 text-gray-600'
                      }`}>
                        {isScheduled ? <Check className="w-3 h-3" /> : isPlanned ? <Check className="w-3 h-3" /> : index + 1}
                      </div>
                      
                      <div className="lg:ml-3">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${
                            isScheduled ? 'bg-green-500' : isPlanned ? 'bg-indigo-500' : 'bg-amber-400'
                          }`} />
                          <span className="font-medium text-xs sm:text-sm truncate">{service.name}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate">{service.vendorName}</p>
                        <div className="flex items-center justify-between mt-1.5 sm:mt-2 gap-1">
                          <span className="text-[10px] sm:text-xs text-gray-400">{service.visits} visits</span>
                          <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            isScheduled 
                              ? 'bg-green-100 text-green-700' 
                              : isPlanned
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isScheduled ? 'Confirmed' : isPlanned ? 'Planned' : 'Pending'}
                          </span>
                        </div>
                        
                        {/* Show planned visit preview - hidden on mobile for space */}
                        {isPlanned && plannedSchedules[service.id] && (
                          <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-indigo-200 hidden lg:block">
                            <p className="text-[10px] sm:text-xs text-indigo-600">
                              {plannedSchedules[service.id].visits.length} visits planned
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            
            {/* Action buttons - only for users with permissions */}
            {permissions.canConfirm && Object.keys(plannedSchedules).length > 0 && (
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                <button
                  onClick={handleShowFinalReview}
                  className="w-full py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-xs sm:text-sm font-medium rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Review All ({Object.keys(plannedSchedules).length})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Calendar */}
        <div className="flex-1 min-w-0 order-3 lg:order-none">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Vendor Availability Calendar</h3>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">{selectedService?.vendorName} | {property?.zone || 'Zone A'}</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button onClick={() => navigateWeek(-1)} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                  </button>
                  
                  {/* Individual Date Selectors */}
                  <div className="flex items-center gap-0.5 sm:gap-1">
                    {/* Month Selector */}
                    <select
                      value={currentWeekStart.getMonth()}
                      onChange={(e) => {
                        const newDate = new Date(currentWeekStart);
                        newDate.setMonth(parseInt(e.target.value));
                        setCurrentWeekStart(newDate);
                      }}
                      className="px-1 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => (
                        <option key={i} value={i}>{month}</option>
                      ))}
                    </select>
                    
                    {/* Day Selector */}
                    <select
                      value={currentWeekStart.getDate()}
                      onChange={(e) => {
                        const newDate = new Date(currentWeekStart);
                        newDate.setDate(parseInt(e.target.value));
                        setCurrentWeekStart(newDate);
                      }}
                      className="px-1 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    
                    {/* Year Selector */}
                    <select
                      value={currentWeekStart.getFullYear()}
                      onChange={(e) => {
                        const newDate = new Date(currentWeekStart);
                        newDate.setFullYear(parseInt(e.target.value));
                        setCurrentWeekStart(newDate);
                      }}
                      className="px-1 sm:px-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button onClick={() => navigateWeek(1)} className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid - Scrollable on mobile */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="w-14 sm:w-20 px-1 sm:px-2 py-2 sm:py-3 text-[10px] sm:text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">Time</th>
                    {weekDays.map((day, i) => (
                      <th key={i} className="px-1 sm:px-2 py-2 sm:py-3 text-center min-w-[70px] sm:min-w-[90px]">
                        <p className="text-[10px] sm:text-xs font-medium text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className="text-xs sm:text-sm font-semibold">{day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((time, timeIndex) => (
                    <tr key={time} className="border-t border-gray-100">
                      <td className="px-1 sm:px-2 py-1 sm:py-2 text-[10px] sm:text-xs text-gray-500 sticky left-0 bg-white z-10">{time}</td>
                      {weekDays.map((day, dayIndex) => {
                        const status = getSlotStatus(day, timeIndex);
                        const isSelected = selectedSlot?.date?.getDate() === day.getDate() && selectedSlot?.time === time;
                        const tooltipText = status === 'booked' 
                          ? `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}\nStatus: Already booked\nVendor is not available`
                          : status === 'recommended'
                          ? `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}\nStatus: Recommended\nVendor: ${selectedService?.vendorName || 'N/A'}\nOptimal slot based on vendor schedule`
                          : status === 'limited'
                          ? `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}\nStatus: Limited availability\nVendor has other commitments nearby`
                          : `${day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}\nStatus: Available\nVendor: ${selectedService?.vendorName || 'N/A'}\nClick to select this slot`;
                        return (
                          <td key={dayIndex} className="px-0.5 sm:px-1 py-0.5 sm:py-1">
                            <button
                              onClick={() => handleSelectSlot(day, time, status)}
                              disabled={status === 'booked'}
                              title={tooltipText}
                              className={`w-full px-1 sm:px-2 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded transition-all ${
                                isSelected ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md' : ''
                              } ${
                                status === 'recommended' ? 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200' :
                                status === 'available' ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                                status === 'limited' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                                'bg-red-50 text-red-400 cursor-not-allowed'
                              }`}
                            >
                              <span className="hidden sm:inline">{time.replace(':00', '')}</span>
                              <span className="sm:hidden">{time.replace(':00 ', '').replace('AM', 'A').replace('PM', 'P')}</span>
                              <br />
                              <span className="text-[8px] sm:text-[10px]">
                                {status === 'recommended' ? 'Rec' : 
                                 status === 'available' ? 'Avail' :
                                 status === 'limited' ? 'Ltd' : 'Busy'}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend - Responsive wrap */}
            <div className="p-2 sm:p-4 border-t border-gray-200 flex flex-wrap items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-300 rounded" />
                <span className="text-[10px] sm:text-xs text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-100 border border-blue-300 rounded" />
                <span className="text-[10px] sm:text-xs text-gray-600">Recommended</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-100 border border-red-300 rounded" />
                <span className="text-[10px] sm:text-xs text-gray-600">Booked</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-amber-100 border border-amber-300 rounded" />
                <span className="text-[10px] sm:text-xs text-gray-600">Limited</span>
              </div>
            </div>

            {/* Selected Slot Info - Responsive */}
            {selectedSlot && (
              <div className="p-2 sm:p-4 border-t border-gray-200 bg-blue-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900">Selected Slot</p>
                      <p className="text-xs sm:text-sm text-blue-700 truncate">
                        {selectedSlot.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {selectedSlot.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full ${
                      selectedSlot.status === 'recommended' ? 'bg-blue-100 text-blue-700' :
                      selectedSlot.status === 'available' ? 'bg-green-100 text-green-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedSlot.status === 'recommended' ? 'Rec' : 
                       selectedSlot.status === 'available' ? 'Avail' : 'Ltd'}
                    </span>
                    <button 
                      onClick={() => setSelectedSlot(null)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recommended Dates */}
        <div className="w-full lg:w-44 xl:w-48 lg:min-w-[176px] xl:min-w-[192px] flex-shrink-0 order-2 lg:order-none">
          <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">Recommended Dates</h3>
              <span className="text-xs sm:text-sm text-gray-500">{recommendedDates.length}</span>
            </div>
            
            {/* Vendor's Working Hours */}
            {recommendedDates.length > 0 && recommendedDates[0].vendorWorkingHours && (
              <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                  <span className="text-xs sm:text-sm font-medium text-purple-800">Vendor Hours</span>
                </div>
                <p className="text-sm sm:text-lg font-bold text-purple-700">{recommendedDates[0].vendorWorkingHours.from} - {recommendedDates[0].vendorWorkingHours.to}</p>
                <p className="text-[10px] sm:text-xs text-purple-600 mt-0.5 sm:mt-1 hidden sm:block">Recommendations prioritize these working hours</p>
              </div>
            )}
            
            {/* Horizontal scroll on mobile, vertical on larger screens */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-2 px-2 lg:mx-0 lg:px-0">
              {recommendedDates.map((rec, i) => {
                // Check if this date is currently selected
                const isSelected = selectedSlot && 
                  selectedSlot.date?.getDate() === rec.date?.getDate() &&
                  selectedSlot.date?.getMonth() === rec.date?.getMonth() &&
                  selectedSlot.time === rec.time;
                
                return (
                  <div 
                    key={rec.id}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-200' :
                      i === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectRecommendedDate(rec)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          rec.type === 'edited' ? 'bg-purple-500' :
                          rec.type === 'recommended' ? 'bg-blue-500' :
                          rec.type === 'available' ? 'bg-green-500' : 'bg-amber-500'
                        }`} />
                        <span className="font-medium text-xs">{rec.dateStr}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{rec.time}</p>
                    <p className="text-[10px] text-gray-400">• {rec.zone}</p>
                    
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                        rec.type === 'edited' ? 'bg-purple-100 text-purple-700' :
                        rec.type === 'recommended' ? 'bg-blue-100 text-blue-700' :
                        rec.type === 'available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {rec.type === 'edited' ? 'Edited' : rec.type === 'recommended' ? 'Recommended' : rec.type === 'available' ? 'Available' : 'Limited'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 space-y-2">
              {/* Only show scheduling actions for users with permissions */}
              {permissions.canConfirm ? (
                <>
                  {/* Step 1: Generate visits from selected/recommended date */}
                  <button 
                    onClick={handleUseRecommended}
                    disabled={!recommendedDates.length || !selectedService || selectedService.status === 'Scheduled'}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {selectedSlot?.date 
                      ? `Use Selected (${formatDateShort(selectedSlot.date)})` 
                      : `Use Recommended ${recommendedDates[0]?.dateStr ? `(${recommendedDates[0].dateStr})` : ''}`
                    }
                  </button>
                  
                  <button 
                    onClick={handleCustomizeDates}
                    disabled={!selectedService || selectedService.status === 'Scheduled'}
                    className="w-full py-2 text-blue-600 text-sm font-medium hover:underline flex items-center justify-center gap-1 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-3 h-3" /> Customize Dates
                  </button>
                  
                  {/* Show already planned indicator */}
                  {plannedSchedules[selectedService?.id] && (
                    <div className="mt-2 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                      <p className="text-xs text-indigo-700 text-center flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        This service is planned
                      </p>
                      <button
                        onClick={() => handleRemoveFromPlanned(selectedService.id)}
                        className="w-full mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
                      >
                        Remove from planned
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  <Eye className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                  <p>View-only mode</p>
                  <p className="text-xs text-gray-400 mt-1">Contact your manager to schedule services</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Selected Service Visit Details */}
      {selectedService && plannedVisits.length > 0 && (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedService.name} - Visit Schedule
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedService.status === 'Scheduled' 
                    ? `${plannedVisits.length} visits scheduled` 
                    : `${plannedVisits.length} visits planned - Confirm to finalize`
                  }
                </p>
              </div>
              {permissions.canEdit && selectedService.status !== 'Scheduled' && (
                <button 
                  onClick={openRecurrenceModal}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <Edit2 className="w-3 h-3" /> Edit Recurrence
                </button>
              )}
            </div>
            
            {/* Visit cards */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {plannedVisits.map((visit, i) => (
                <div 
                  key={`visit-${i}`}
                  className={`flex-shrink-0 w-32 p-3 rounded-lg border text-center relative cursor-pointer ${
                    visit.status === 'Scheduled' || visit.status === 'scheduled' ? 'border-green-300 bg-green-50' : 
                    visit.status === 'Planned' ? 'border-blue-300 bg-blue-50' :
                    visit.isEdited ? 'border-blue-300 bg-blue-50' :
                    visit.isManual ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                  } hover:border-blue-400 hover:bg-blue-50/50`}
                  onClick={() => {
                    if (permissions.canEdit && visit.status !== 'completed' && visit.status !== 'in_progress' && editingVisitIndex !== i && selectedService.status !== 'Scheduled') {
                      setEditingVisitIndex(i);
                    }
                  }}
                >
                  <p className="text-xs text-gray-500">Visit {visit.visitNumber}</p>
                  {editingVisitIndex === i && selectedService.status !== 'Scheduled' ? (
                    <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={visit.date ? (() => {
                          const d = visit.date;
                          const year = d.getFullYear();
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const day = String(d.getDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        })() : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleEditPlannedVisitDate(i, e.target.value);
                          }
                        }}
                        className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={visit.time || '10:00 AM'}
                        onChange={(e) => {
                          handleEditPlannedVisitTime(i, e.target.value);
                        }}
                        className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
                          '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
                          '4:00 PM', '4:30 PM', '5:00 PM'].map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingVisitIndex(null);
                        }}
                        className="w-full mt-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-sm mt-1 whitespace-nowrap">
                        {visit.isManual ? (
                          <button className="text-amber-600 hover:text-amber-700 underline">
                            Select
                          </button>
                        ) : (
                          visit.shortDateStr || visit.dateStr
                        )}
                      </p>
                      <p className="text-xs text-gray-500">{visit.time}</p>
                    </>
                  )}
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                    visit.status === 'Scheduled' ? 'bg-green-100 text-green-700' : 
                    visit.status === 'Planned' ? 'bg-blue-100 text-blue-700' :
                    visit.isEdited ? 'bg-blue-100 text-blue-700' :
                    visit.isManual ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                  }`}>{visit.isEdited ? 'Edited' : visit.status}</span>
                </div>
              ))}
            </div>
            
            {/* Action buttons for wizard flow - only for users with permissions */}
            {permissions.canConfirm && selectedService.status !== 'Scheduled' && plannedVisits.length > 0 && plannedVisits.some(v => v.date) && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handlePrepareConfirmation}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 shadow-md"
                >
                  <Edit2 className="w-4 h-4" />
                  Review & Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Confirm Schedule</h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {selectedService?.name} – {selectedService?.vendorName}
                  </p>
                </div>
                <button 
                  onClick={() => setShowConfirmation(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="p-6 overflow-auto max-h-[60vh]">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Review the scheduled dates below. You can edit individual dates and times before confirming.
                </p>
              </div>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Visit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Target Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Scheduled Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {confirmationSchedule.map((visit, index) => (
                    <tr key={index} className={`hover:bg-gray-50 ${visit.isEdited ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{visit.visitNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{visit.targetDateStr}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editingVisitIndex === index ? (
                          <input
                            type="date"
                            value={(() => {
                              if (!visit.scheduledDate) return '';
                              const d = visit.scheduledDate instanceof Date ? visit.scheduledDate : new Date(visit.scheduledDate);
                              const year = d.getFullYear();
                              const month = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              return `${year}-${month}-${day}`;
                            })()}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleEditVisitDate(index, e.target.value, visit.time);
                              }
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className={`font-medium ${visit.isEdited ? 'text-amber-700' : 'text-gray-900'}`}>
                            {visit.scheduledDateStr}
                            {visit.isEdited && visit.status === 'rescheduled' && (
                              <span className="text-xs text-gray-500 ml-1">(was {new Date(visit.originalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={visit.time}
                          onChange={(e) => {
                            const newTime = e.target.value;
                            setConfirmationSchedule(prev => prev.map((v, i) => 
                              i === index ? { ...v, time: newTime, isEdited: true } : v
                            ));
                          }}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                          {['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
                            '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
                            '4:00 PM', '4:30 PM', '5:00 PM'].map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(visit.status)}`}>
                          {visit.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingVisitIndex(index)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Date"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenReschedule(visit)}
                            className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Reschedule"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {confirmationSchedule.filter(v => v.isEdited).length} of {confirmationSchedule.length} visits modified
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSchedule}
                  disabled={confirmingSchedule}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {confirmingSchedule ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && rescheduleVisit && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Reschedule Visit {rescheduleVisit.visitNumber}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Current: {rescheduleVisit.scheduledDateStr} at {rescheduleVisit.time}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* New Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                <input
                  type="date"
                  id="reschedule-date"
                  defaultValue={rescheduleVisit.scheduledDate ? (() => {
                    const d = new Date(rescheduleVisit.scheduledDate);
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  })() : ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* New Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                <select
                  id="reschedule-time"
                  defaultValue={rescheduleVisit.time}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', 
                    '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', 
                    '4:00 PM', '4:30 PM', '5:00 PM'].map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  id="reschedule-reason"
                  placeholder="Customer requested change..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Reschedule Scope */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Reschedule Scope</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reschedule-scope"
                      value="this_visit_only"
                      checked={rescheduleScope === 'this_visit_only'}
                      onChange={(e) => setRescheduleScope(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">This Visit Only</p>
                      <p className="text-xs text-gray-500">Only this occurrence will be changed. Future visits remain unchanged.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="reschedule-scope"
                      value="this_and_future"
                      checked={rescheduleScope === 'this_and_future'}
                      onChange={(e) => setRescheduleScope(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">This and Future Visits</p>
                      <p className="text-xs text-gray-500">Shift this and all future visits by the same amount.</p>
                    </div>
                  </label>
                </div>
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Default: "This Visit Only" - recommended for customer requests
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleVisit(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const newDate = document.getElementById('reschedule-date').value;
                  const newTime = document.getElementById('reschedule-time').value;
                  const reason = document.getElementById('reschedule-reason').value;
                  handleReschedule(newDate, newTime, reason);
                }}
                className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recurrence Modal */}
      {showRecurrenceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Recurrence</h3>
              <p className="text-sm text-gray-500 mt-1">
                Change the frequency and number of visits
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Frequency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency
                </label>
                <select
                  value={editFrequency}
                  onChange={(e) => {
                    const newFreq = e.target.value;
                    setEditFrequency(newFreq);
                    // Auto-update visit count based on frequency
                    const config = getFrequencyConfig(newFreq);
                    if (config?.visitsPerYear) {
                      setEditVisitCount(config.visitsPerYear);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="monthly">Monthly (12 visits/year)</option>
                  <option value="every 2 months">Every 2 Months (6 visits/year)</option>
                  <option value="quarterly">Quarterly (4 visits/year)</option>
                  <option value="half-yearly">Half-Yearly (2 visits/year)</option>
                  <option value="yearly">Yearly (1 visit/year)</option>
                </select>
              </div>

              {/* Number of Visits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Visits
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={editVisitCount}
                  onChange={(e) => setEditVisitCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Visits will be scheduled starting from the first service date
                </p>
              </div>

              {/* Current vs New Preview */}
              {plannedVisits.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Schedule</p>
                  <p className="text-sm text-gray-800">
                    {plannedVisits.length} visits, {selectedService?.frequency || 'monthly'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    First visit: {plannedVisits[0]?.shortDateStr || plannedVisits[0]?.dateStr}
                  </p>
                </div>
              )}
              
              {/* New Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-500 uppercase tracking-wide mb-1">New Schedule</p>
                <p className="text-sm text-blue-800">
                  <strong>{editVisitCount} visits, {editFrequency}</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Starting from {selectedSlot ? formatDateShort(selectedSlot.date) : (plannedVisits[0]?.shortDateStr || 'selected date')}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowRecurrenceModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyRecurrence}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Visits Modal */}
      {showAllVisitsModal && selectedService && plannedVisits.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">All Scheduled Visits</h2>
                  <p className="text-green-100 text-sm mt-1">
                    {selectedService.name} • {plannedVisits.length} visits
                  </p>
                </div>
                <button 
                  onClick={() => setShowAllVisitsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Visits Grid */}
            <div className="p-6 overflow-auto max-h-[70vh]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {plannedVisits.map((visit, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      visit.status === 'Scheduled' || visit.status === 'scheduled'
                        ? 'border-green-200 bg-green-50'
                        : visit.status === 'completed'
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-blue-200 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-500">Visit {visit.visitNumber || index + 1}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        visit.status === 'Scheduled' || visit.status === 'scheduled'
                          ? 'bg-green-100 text-green-700'
                          : visit.status === 'completed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {visit.status === 'Scheduled' || visit.status === 'scheduled' ? 'Scheduled' : visit.status || 'Planned'}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{visit.shortDateStr || visit.dateStr}</p>
                    <p className="text-sm text-gray-600 mt-1">{visit.time}</p>
                    {visit.visitId && (
                      <p className="text-xs text-gray-400 mt-2 font-mono">{visit.visitId}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-green-600">{plannedVisits.filter(v => v.status === 'Scheduled' || v.status === 'scheduled').length}</span> scheduled
                {plannedVisits.filter(v => v.status === 'completed').length > 0 && (
                  <span className="ml-3">
                    <span className="font-medium text-gray-600">{plannedVisits.filter(v => v.status === 'completed').length}</span> completed
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowAllVisitsModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FINAL REVIEW MODAL - Review All Planned Services ===== */}
      {showFinalReview && Object.keys(plannedSchedules).length > 0 && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <ListChecks className="w-7 h-7" />
                    Review All Planned Schedules
                  </h2>
                  <p className="text-green-100 text-sm mt-1">
                    Review all {Object.keys(plannedSchedules).length} services before final confirmation
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowFinalReview(false);
                    setWizardStep(WIZARD_STEPS.SCHEDULING);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            {/* Services List */}
            <div className="p-6 overflow-auto max-h-[65vh]">
              <div className="space-y-6">
                {Object.entries(plannedSchedules).map(([serviceId, planData], svcIndex) => {
                  const { service, visits } = planData;
                  const totalVisits = visits.length;
                  const firstVisit = visits[0];
                  const lastVisit = visits[visits.length - 1];
                  
                  return (
                    <div 
                      key={serviceId}
                      className="border-2 border-gray-200 rounded-xl overflow-hidden"
                    >
                      {/* Service Header */}
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                              {svcIndex + 1}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
                              <p className="text-sm text-gray-500">
                                {service.vendorName} • {service.frequency} • {totalVisits} visits
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditPlannedService(serviceId)}
                              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveFromPlanned(serviceId)}
                              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                        
                        {/* Quick Summary */}
                        <div className="mt-3 flex items-center gap-6 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            First: <strong>{firstVisit?.shortDateStr || firstVisit?.dateStr}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <CalendarDays className="w-4 h-4 text-gray-400" />
                            Last: <strong>{lastVisit?.shortDateStr || lastVisit?.dateStr}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            Default Time: <strong>{firstVisit?.time}</strong>
                          </span>
                        </div>
                      </div>
                      
                      {/* Visits Grid */}
                      <div className="p-4 bg-gray-50">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {visits.slice(0, 12).map((visit, idx) => (
                            <div 
                              key={idx}
                              className={`flex-shrink-0 w-28 p-2.5 rounded-lg border text-center ${
                                visit.isEdited 
                                  ? 'border-amber-300 bg-amber-50' 
                                  : 'border-indigo-200 bg-white'
                              }`}
                            >
                              <p className="text-xs text-gray-500 font-medium">Visit {visit.visitNumber}</p>
                              <p className="font-semibold text-sm mt-0.5">{visit.shortDateStr || visit.dateStr}</p>
                              <p className="text-xs text-gray-500">{visit.time}</p>
                              {visit.isEdited && (
                                <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                                  Modified
                                </span>
                              )}
                            </div>
                          ))}
                          {visits.length > 12 && (
                            <div className="flex-shrink-0 w-28 p-2.5 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
                              <span className="text-sm text-gray-500 font-medium">
                                +{visits.length - 12} more
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-100 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-2 font-bold text-gray-900">
                    {Object.keys(plannedSchedules).length} services
                  </span>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="font-bold text-gray-900">
                    {Object.values(plannedSchedules).reduce((sum, p) => sum + p.visits.length, 0)} visits
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowFinalReview(false);
                      setWizardStep(WIZARD_STEPS.SCHEDULING);
                    }}
                    className="px-5 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Back to Editing
                  </button>
                  <button
                    onClick={handleConfirmAllSchedules}
                    disabled={confirmingAllSchedules || Object.keys(plannedSchedules).length === 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                  >
                    {confirmingAllSchedules ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Confirming All...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirm All Schedules
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertySchedulingScreen;
