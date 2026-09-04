import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Package, Calendar, CalendarDays, Clock,
  CheckCircle, AlertCircle, Sparkles, User, Wrench, RefreshCw, X, Save,
  Star, Info, Check, ChevronLeft, ChevronRight, Phone, Edit2, HelpCircle
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

const PropertySchedulingScreen = ({ user, portalType = 'admin' }) => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const propertyData = location.state?.property;

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
    
    setPlannedVisits(prev => prev.map((visit, i) => {
      if (i === index) {
        return {
          ...visit,
          date: newDate,
          shortDateStr: formatDateShort(newDate),
          dateStr: formatDateFull(newDate),
          isEdited: true
        };
      }
      return visit;
    }));
    setEditingVisitIndex(null);
  };

  // Handle applying new recurrence settings
  const handleApplyRecurrence = () => {
    if (!selectedService || !selectedSlot) return;
    
    // Update service with new frequency and visit count
    const updatedService = {
      ...selectedService,
      frequency: editFrequency,
      visits: editVisitCount
    };
    
    // Regenerate visits with new settings
    const schedules = generateScheduleDates(
      selectedSlot.date,
      editFrequency,
      editVisitCount
    );
    
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    const visitsWithTime = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: selectedSlot.time || '10:00 AM',
      status: index === 0 ? 'Scheduled' : 'Target'
    }));
    
    setPlannedVisits(visitsWithTime);
    setSelectedService(updatedService);
    setShowRecurrenceModal(false);
  };

  // Open recurrence modal with current values
  const openRecurrenceModal = () => {
    if (selectedService) {
      setEditFrequency(selectedService.frequency || 'monthly');
      setEditVisitCount(selectedService.visits || getFrequencyConfig(selectedService.frequency)?.visitsPerYear || 12);
    }
    setShowRecurrenceModal(true);
  };

  useEffect(() => {
    fetchPropertyDetails();
  }, [propertyId]);

  useEffect(() => {
    if (selectedService) {
      generateRecommendedDates(selectedService);
      generatePlannedVisits(selectedService);
    }
  }, [selectedService, currentWeekStart, selectedSlot]);

  const fetchPropertyDetails = async () => {
    setLoading(true);
    try {
      if (propertyData) {
        setProperty(propertyData);
        const mockServices = generateMockServices(propertyData);
        setServices(mockServices);
        if (mockServices.length > 0) {
          setSelectedService(mockServices[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockServices = (prop) => {
    return [
      { id: 1, name: 'HVAC', vendorName: 'ABC HVAC', vendorId: 1, frequency: 'Monthly', visits: 12, status: 'Schedule' },
      { id: 2, name: 'Plumbing', vendorName: 'XYZ Plumbing', vendorId: 2, frequency: 'Every 2 Months', visits: 6, status: 'Schedule' },
      { id: 3, name: 'Lift AMC', vendorName: 'Elevate Services', vendorId: 3, frequency: 'Quarterly', visits: 4, status: 'Schedule' },
      { id: 4, name: 'Pest Control', vendorName: 'PestFree Experts', vendorId: 4, frequency: 'Half-Yearly', visits: 2, status: 'Schedule' },
      { id: 5, name: 'Water Tank Cleaning', vendorName: 'Aqua Clean Services', vendorId: 5, frequency: 'Yearly', visits: 1, status: 'Schedule' },
      { id: 6, name: 'Deep Cleaning', vendorName: 'CleanPro Services', vendorId: 6, frequency: 'Customer Requirement', visits: 3, customVisits: 3, status: 'Schedule' },
      { id: 7, name: 'Emergency Repairs', vendorName: 'QuickFix Team', vendorId: 7, frequency: 'On Request', visits: 0, status: 'On Request' }
    ];
  };

  const generateRecommendedDates = (service) => {
    const dates = [];
    const baseDate = new Date(currentWeekStart);
    
    // Generate 4 recommended dates
    const recommendedDays = [
      { day: 5, time: '10:00 AM', type: 'recommended', reason: 'Vendor already has Zone A jobs' },
      { day: 3, time: '02:00 PM', type: 'available', reason: '' },
      { day: 6, time: '09:30 AM', type: 'available', reason: '' },
      { day: 0, time: '11:00 AM', type: 'limited', reason: '' }
    ];
    
    recommendedDays.forEach((rec, i) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + rec.day);
      dates.push({
        id: i + 1,
        date: date,
        dateStr: formatDateFull(date),
        time: rec.time,
        type: rec.type,
        reason: rec.reason,
        vendor: service.vendorName,
        zone: property?.zone || 'Zone A'
      });
    });
    
    setRecommendedDates(dates);
  };

  const generatePlannedVisits = (service) => {
    // Use selected slot date or default to next week
    const firstServiceDate = selectedSlot?.date || (() => {
      const defaultDate = new Date(currentWeekStart);
      defaultDate.setDate(defaultDate.getDate() + 5); // Default to Saturday
      return defaultDate;
    })();
    
    const frequencyConfig = getFrequencyConfig(service.frequency);
    
    // Check if this is a manual/customer requirement frequency
    if (!frequencyConfig.autoGenerate) {
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
    
    // Generate automatic schedule based on frequency
    const schedules = generateScheduleDates(
      firstServiceDate,
      service.frequency,
      service.visits || frequencyConfig.visitsPerYear
    );
    
    // Format for display
    const formattedSchedules = formatSchedulesForDisplay(schedules);
    
    // Add time slots
    const visitsWithTime = formattedSchedules.map((schedule, index) => ({
      ...schedule,
      time: selectedSlot?.time || '10:00 AM',
      status: index === 0 ? 'Scheduled' : 'Target'
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
    const dayOfWeek = day.getDay();
    const dayNum = day.getDate();
    
    // Simulate different slot statuses
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (timeIndex < 4) return 'available';
      return 'limited';
    }
    if (dayNum === 12 && timeIndex === 2) return 'recommended';
    if (dayNum === 10 && timeIndex === 6) return 'recommended';
    if (timeIndex === 5 || timeIndex === 7) return 'booked';
    if (timeIndex > 6) return 'limited';
    return 'available';
  };

  const handleSelectSlot = (day, time, status) => {
    if (status === 'booked') return;
    setSelectedSlot({ date: day, time, status });
  };

  const handleUseRecommended = () => {
    if (recommendedDates.length > 0) {
      const rec = recommendedDates[0];
      setSelectedSlot({ date: rec.date, time: rec.time, status: 'recommended' });
      // Automatically prepare confirmation with recommended date
      setTimeout(() => handlePrepareConfirmation(), 100);
    }
  };

  // Apply recommended date to all monthly visits
  const handleApplyToAllMonthly = () => {
    if (!selectedService || !recommendedDates.length) return;
    
    const rec = recommendedDates[0];
    setSelectedSlot({ date: rec.date, time: rec.time, status: 'recommended' });
    
    // Update all planned visits with the same day-of-week pattern
    const updatedVisits = plannedVisits.map((visit, index) => {
      if (index === 0) {
        return { ...visit, date: rec.date, dateStr: formatDateFull(rec.date), time: rec.time };
      }
      // For subsequent visits, maintain the same day of week
      const newDate = new Date(rec.date);
      newDate.setMonth(newDate.getMonth() + index);
      return { ...visit, date: newDate, dateStr: formatDateFull(newDate), time: rec.time };
    });
    
    setPlannedVisits(updatedVisits);
    handlePrepareConfirmation();
  };

  // Show customize dates modal
  const handleCustomizeDates = () => {
    if (!selectedService) return;
    // Set the first slot if not already selected
    if (!selectedSlot && recommendedDates.length > 0) {
      const rec = recommendedDates[0];
      setSelectedSlot({ date: rec.date, time: rec.time, status: 'recommended' });
    }
    handlePrepareConfirmation();
  };

  // Prepare schedule for confirmation
  const handlePrepareConfirmation = () => {
    if (!selectedService) return;
    if (!selectedSlot && plannedVisits.length === 0) return;
    
    // Generate confirmation schedule with target dates and recommended dates
    // Preserve isEdited flag from planned visits
    const defaultTime = selectedSlot?.time || '10:00 AM';
    const schedule = plannedVisits.map((visit, index) => ({
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
  const handleEditVisitDate = (index, newDate, newTime) => {
    setConfirmationSchedule(prev => prev.map((v, i) => 
      i === index ? {
        ...v,
        scheduledDate: newDate,
        scheduledDateStr: new Date(newDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
        visits: confirmationSchedule.map(visit => ({
          visitNumber: visit.visitNumber,
          targetDate: visit.targetDate instanceof Date ? visit.targetDate.toISOString() : visit.targetDate,
          scheduledDate: visit.scheduledDate instanceof Date ? visit.scheduledDate.toISOString() : visit.scheduledDate,
          time: visit.time,
          status: visit.isEdited ? 'modified' : 'scheduled',
          isEdited: visit.isEdited || false
        }))
      };
      
      console.log('Sending schedule payload:', schedulePayload);
      
      const response = await fetch(`${API_BASE}/api/schedules/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(schedulePayload)
      });
      
      const result = await response.json();
      console.log('API response:', result);
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Failed to save schedule');
      }
      
      alert(`Schedule confirmed successfully! ${result.data?.visitsCreated || confirmationSchedule.length} visits created.`);
      setShowConfirmation(false);
      
      // Update the service status to Scheduled
      setServices(prev => prev.map(s => 
        s.id === selectedService.id ? { ...s, status: 'Scheduled' } : s
      ));
      
      // Clear selection and navigate back to pending schedules
      setSelectedService(null);
      setPlannedVisits([]);
      setSelectedSlot(null);
      
      // Navigate back based on portal type
      const basePath = portalType === 'admin' ? '' : `/${portalType}`;
      navigate(`${basePath}/schedules/pending`);
    } catch (error) {
      console.error('Error confirming schedule:', error);
      alert(`Error confirming schedule: ${error.message}`);
    } finally {
      setConfirmingSchedule(false);
    }
  };

  // Save draft schedule
  const handleSaveDraft = async () => {
    if (!selectedService || plannedVisits.length === 0) {
      alert('Please select a service and generate a schedule first');
      return;
    }
    
    const token = getAuthToken();
    
    try {
      const draftPayload = {
        propertyId: propertyId,
        serviceId: selectedService?.id,
        serviceName: selectedService?.name,
        frequency: selectedService?.frequency,
        status: 'draft',
        visits: plannedVisits.map(visit => ({
          visitNumber: visit.visitNumber,
          targetDate: visit.date instanceof Date ? visit.date.toISOString() : visit.date,
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
      
      alert('Draft saved successfully!');
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Error saving draft. Please try again.');
    }
  };

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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Schedule Property</h1>
            <nav className="text-sm text-gray-500">
              Home › Scheduling › Pending Property Schedules › <span className="text-gray-900">Schedule Property</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Pending Schedules
            </button>
            <button 
              onClick={handleSaveDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>
            <button 
              onClick={handlePrepareConfirmation}
              disabled={(!selectedSlot && plannedVisits.length === 0) || !selectedService}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Confirm Schedule
            </button>
          </div>
        </div>
      </div>

      

      {/* Property Info Card */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property ID</p>
            <p className="text-sm font-semibold text-blue-600">{property?.propertyId || 'PROP-101'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property Name</p>
            <p className="text-sm font-semibold text-gray-900">{property?.propertyName || 'Green Valley Apartments'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Customer</p>
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              {property?.customerName || 'Mr. Ramesh Kumar'}
              <span className="text-xs text-gray-500 font-normal flex items-center gap-1"><Phone className="w-3 h-3" /> 98765 43210</span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Property Type</p>
            <p className="text-sm font-medium text-gray-700 flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" /> Apartment</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Zone</p>
            <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-200">{property?.zone || 'Zone A'}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Package</p>
            <p className="text-sm font-medium text-purple-700">{property?.packageName || 'Apartment Basic AMC'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Contract Period</p>
            <p className="text-sm font-medium text-gray-700">
              {property?.contractStartDate ? new Date(property.contractStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Sep 2026'} 
              {' - '}
              {property?.contractEndDate ? new Date(property.contractEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '31 Aug 2027'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 flex gap-6">
        {/* Left: Services List */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Services to Schedule</h3>
              <span className="text-sm text-gray-500">{services.length}</span>
            </div>
            <div className="space-y-2">
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    selectedService?.id === service.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'Scheduled' ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className="font-medium text-sm">{service.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{service.vendorName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{service.frequency}</span>
                    <span className="text-xs text-gray-400">{service.visits}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      service.status === 'Scheduled' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>{service.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Calendar */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Vendor Availability Calendar</h3>
                  <p className="text-sm text-gray-500">{selectedService?.vendorName} | {property?.zone || 'Zone A'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigateWeek(-1)} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  {/* Individual Date Selectors */}
                  <div className="flex items-center gap-1">
                    {/* Month Selector */}
                    <select
                      value={currentWeekStart.getMonth()}
                      onChange={(e) => {
                        const newDate = new Date(currentWeekStart);
                        newDate.setMonth(parseInt(e.target.value));
                        setCurrentWeekStart(newDate);
                      }}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button onClick={() => navigateWeek(1)} className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                  <button 
                    onClick={() => setCurrentWeekStart(getNextMonday())}
                    className="ml-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Today
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="w-20 px-2 py-3 text-xs font-medium text-gray-500">Time</th>
                    {weekDays.map((day, i) => (
                      <th key={i} className="px-2 py-3 text-center">
                        <p className="text-xs font-medium text-gray-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className="text-sm font-semibold">{day.getDate()} {day.toLocaleDateString('en-US', { month: 'short' })}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((time, timeIndex) => (
                    <tr key={time} className="border-t border-gray-100">
                      <td className="px-2 py-2 text-xs text-gray-500">{time}</td>
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
                          <td key={dayIndex} className="px-1 py-1">
                            <button
                              onClick={() => handleSelectSlot(day, time, status)}
                              disabled={status === 'booked'}
                              title={tooltipText}
                              className={`w-full px-2 py-1.5 text-xs rounded transition-all ${
                                isSelected ? 'ring-2 ring-blue-500 ring-offset-1 shadow-md' : ''
                              } ${
                                status === 'recommended' ? 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200' :
                                status === 'available' ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                                status === 'limited' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                                'bg-red-50 text-red-400 cursor-not-allowed'
                              }`}
                            >
                              {time.replace(':00', '')}
                              <br />
                              <span className="text-[10px]">
                                {status === 'recommended' ? 'Recommended' : 
                                 status === 'available' ? 'Available' :
                                 status === 'limited' ? 'Limited' : 'Booked'}
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

            {/* Legend */}
            <div className="p-4 border-t border-gray-200 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
                <span className="text-xs text-gray-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded" />
                <span className="text-xs text-gray-600">Recommended</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
                <span className="text-xs text-gray-600">Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-100 border border-amber-300 rounded" />
                <span className="text-xs text-gray-600">Limited / Busy</span>
              </div>
            </div>

            {/* Selected Slot Info */}
            {selectedSlot && (
              <div className="p-4 border-t border-gray-200 bg-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Selected Slot</p>
                      <p className="text-sm text-blue-700">
                        {selectedSlot.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} at {selectedSlot.time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      selectedSlot.status === 'recommended' ? 'bg-blue-100 text-blue-700' :
                      selectedSlot.status === 'available' ? 'bg-green-100 text-green-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {selectedSlot.status === 'recommended' ? 'Recommended' : 
                       selectedSlot.status === 'available' ? 'Available' : 'Limited'}
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
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Recommended Dates</h3>
              <span className="text-sm text-gray-500">{recommendedDates.length}</span>
            </div>
            <div className="space-y-3">
              {recommendedDates.map((rec, i) => (
                <div 
                  key={rec.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    i === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedSlot({ date: rec.date, time: rec.time, status: rec.type })}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      rec.type === 'recommended' ? 'bg-blue-500' :
                      rec.type === 'available' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    <span className="font-medium text-sm">{rec.dateStr}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{rec.time}</p>
                  <p className="text-xs text-gray-400">{rec.vendor} • {rec.zone}</p>
                  {rec.reason && (
                    <p className="text-xs text-blue-600 mt-1 italic">{rec.reason}</p>
                  )}
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                    rec.type === 'recommended' ? 'bg-blue-100 text-blue-700' :
                    rec.type === 'available' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {rec.type === 'recommended' ? 'Recommended' : rec.type === 'available' ? 'Available' : 'Limited'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <button 
                onClick={handleUseRecommended}
                disabled={!recommendedDates.length}
                className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Use Recommended {recommendedDates[0]?.dateStr ? `(${recommendedDates[0].dateStr})` : ''}
              </button>
              <button 
                onClick={handleApplyToAllMonthly}
                disabled={!recommendedDates.length || !selectedService}
                className="w-full py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Apply to All Monthly Visits
              </button>
              <button 
                onClick={handleCustomizeDates}
                disabled={!selectedService}
                className="w-full py-2 text-blue-600 text-sm font-medium hover:underline flex items-center justify-center gap-1 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <Edit2 className="w-3 h-3" /> Customize Dates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Planned Visits Series */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Planned Visit Series</h3>
              <p className="text-sm text-gray-500">
                {selectedSlot 
                  ? generateScheduleSummary(selectedService?.frequency, selectedSlot.date)
                  : `${selectedService?.frequency || 'Monthly'}: Select first service date to generate schedule`
                }
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {getFrequencyConfig(selectedService?.frequency)?.autoGenerate 
                  ? `${selectedService?.visits || getFrequencyConfig(selectedService?.frequency)?.visitsPerYear} visits total • Dates can be adjusted based on vendor availability`
                  : selectedService?.frequency?.toLowerCase() === 'on request'
                    ? 'No automatic schedule - service requested when needed'
                    : `${selectedService?.visits || selectedService?.customVisits || 0} visits to be manually scheduled`
                }
              </p>
            </div>
            <button 
              onClick={openRecurrenceModal}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <Edit2 className="w-3 h-3" /> Edit Recurrence
            </button>
          </div>
          
          {/* Show message for On Request services */}
          {selectedService?.frequency?.toLowerCase() === 'on request' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-amber-800 font-medium">On Request Service</p>
              <p className="text-xs text-amber-600 mt-1">
                No automatic schedule is generated. Service will be scheduled when the customer requests it.
              </p>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {plannedVisits.map((visit, i) => (
                <div 
                  key={i}
                  className={`flex-shrink-0 w-32 p-3 rounded-lg border text-center relative ${
                    visit.status === 'Scheduled' ? 'border-green-300 bg-green-50' : 
                    visit.isEdited ? 'border-blue-300 bg-blue-50' :
                    visit.isManual ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                  } ${visit.status === 'Target' && !visit.isManual ? 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/50' : ''}`}
                  onClick={() => {
                    if (visit.status === 'Target' && !visit.isManual && editingVisitIndex !== i) {
                      setEditingVisitIndex(i);
                    }
                  }}
                >
                  <p className="text-xs text-gray-500">Visit {visit.visitNumber}</p>
                  {editingVisitIndex === i ? (
                    <div className="mt-1">
                      <input
                        type="date"
                        defaultValue={visit.date ? visit.date.toISOString().split('T')[0] : ''}
                        onChange={(e) => handleEditPlannedVisitDate(i, e.target.value)}
                        onBlur={() => setEditingVisitIndex(null)}
                        className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <p className="font-semibold text-sm mt-1 whitespace-nowrap">
                      {visit.isManual ? (
                        <button className="text-amber-600 hover:text-amber-700 underline">
                          Select
                        </button>
                      ) : (
                        visit.shortDateStr || visit.dateStr
                      )}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">{visit.time}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded ${
                    visit.status === 'Scheduled' ? 'bg-green-100 text-green-700' : 
                    visit.isEdited ? 'bg-blue-100 text-blue-700' :
                    visit.isManual ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                  }`}>{visit.isEdited ? 'Edited' : visit.status}</span>
                </div>
              ))}
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {getFrequencyConfig(selectedService?.frequency)?.autoGenerate 
              ? 'The series is generated based on the first visit date. Dates may be adjusted slightly based on vendor availability.'
              : 'Manual scheduling required. Select dates for each visit individually.'
            }
          </p>
          
          {/* Confirm Schedule Button */}
          {selectedSlot && plannedVisits.length > 0 && !selectedService?.frequency?.toLowerCase().includes('request') && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handlePrepareConfirmation}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Review & Confirm Schedule
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                            defaultValue={visit.scheduledDate ? new Date(visit.scheduledDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => handleEditVisitDate(index, e.target.value, visit.time)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                            autoFocus
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                  defaultValue={rescheduleVisit.scheduledDate ? new Date(rescheduleVisit.scheduledDate).toISOString().split('T')[0] : ''}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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

              {/* Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> {editVisitCount} visits, {editFrequency}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Starting from {selectedSlot ? formatDateShort(selectedSlot.date) : 'selected date'}
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
    </div>
  );
};

export default PropertySchedulingScreen;
