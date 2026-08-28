// Schedule Module Components Index
// Export all schedule-related components for easy imports

export { default as AllSchedulesPage } from './AllSchedulesPage';
export { default as ScheduleCalendarView } from './ScheduleCalendarView';
export { default as RescheduleServicePage } from './RescheduleServicePage';
export { default as PropertySchedulingScreen } from './PropertySchedulingScreen';
export { default as PendingPropertySchedules } from './PendingPropertySchedules';
export { default as SchedulesDashboard } from './SchedulesDashboard';
export { default as ScheduleService } from './ScheduleService';
export { default as RescheduleRequestModal } from './RescheduleRequestModal';
export { default as CancelScheduleModal } from './CancelScheduleModal';
export { default as VendorWorkOrderCard } from './VendorWorkOrderCard';

// Schedule Status Constants
export const SCHEDULE_STATUSES = {
  PENDING_SCHEDULE: 'pending_schedule',
  SCHEDULED: 'scheduled',
  UPCOMING: 'upcoming',
  WORK_ORDER_CREATED: 'work_order_created',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  RESCHEDULED: 'rescheduled',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
  VERIFICATION_PENDING: 'verification_pending'
};

// Status Display Labels
export const STATUS_LABELS = {
  pending_schedule: 'Pending Schedule',
  scheduled: 'Scheduled',
  upcoming: 'Upcoming',
  work_order_created: 'Work Order Created',
  in_progress: 'In Progress',
  completed: 'Completed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
  verification_pending: 'Verification Pending'
};

// Status Colors
export const STATUS_COLORS = {
  pending_schedule: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  upcoming: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  work_order_created: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  rescheduled: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-500', border: 'border-red-200' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  verification_pending: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' }
};

// Reschedule Scope Constants
export const RESCHEDULE_SCOPE = {
  THIS_VISIT_ONLY: 'this_visit_only',
  THIS_AND_FUTURE: 'this_and_future'
};

// Frequency Types
export const FREQUENCY_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BI_WEEKLY: 'bi_weekly',
  MONTHLY: 'monthly',
  EVERY_2_MONTHS: 'every_2_months',
  QUARTERLY: 'quarterly',
  HALF_YEARLY: 'half_yearly',
  YEARLY: 'yearly',
  CUSTOMER_REQUIREMENT: 'customer_requirement',
  ON_REQUEST: 'on_request'
};

// Helper function to get status badge classes
export const getStatusBadgeClasses = (status) => {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.scheduled;
  return `${colors.bg} ${colors.text} ${colors.border}`;
};

// Helper function to format schedule date
export const formatScheduleDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper function to format schedule time
export const formatScheduleTime = (time) => {
  if (!time) return '';
  try {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return time;
  }
};
