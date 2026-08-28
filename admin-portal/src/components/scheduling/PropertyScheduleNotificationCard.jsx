import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Building2,
  Wrench,
  UserCheck,
  ArrowRight,
  Bell,
  X,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { getAuthToken } from '../../utils/safeStorage';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Notification Card for Property Ready for Scheduling
 * Displays when a property has all vendors assigned and is ready to be scheduled
 */
const PropertyScheduleNotificationCard = ({
  notification,
  portalType = 'admin',
  onDismiss,
  onSchedule
}) => {
  const navigate = useNavigate();
  const token = getAuthToken();

  const getBasePath = () => {
    const pathMap = {
      'franchise': '/fp',
      'manager': '/manager',
      'admin': '',
      'employee': ''
    };
    return pathMap[portalType] || '';
  };

  const handleScheduleClick = () => {
    if (onSchedule) {
      onSchedule(notification);
    } else {
      const basePath = getBasePath();
      const propertyId = notification.referenceData?.propertyId || notification.referenceId;
      navigate(`${basePath}/schedules/pending?propertyId=${propertyId}`);
    }
  };

  const handleDismiss = async () => {
    if (onDismiss) {
      onDismiss(notification.id);
    }

    // Mark as read via API
    try {
      await fetch(`${API_BASE}/api/schedules/notifications/${notification.id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  const data = notification.referenceData || {};

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Bell className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-sm font-semibold text-blue-900">
            {notification.title || 'New Property Ready for Scheduling'}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-blue-100 rounded transition-colors"
        >
          <X className="w-4 h-4 text-blue-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Property Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-gray-400">Property ID:</span>
              <span className="font-medium text-gray-900">{data.propertyId || 'PROP-XXX'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{data.propertyName || 'Property Name'}</span>
            </div>
          </div>

          {/* Service Stats */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">Services Ready:</span>
              <span className="font-bold text-blue-600">{data.servicesReady || data.totalServices || 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4 text-green-500" />
              <span className="text-gray-600">Vendors Assigned:</span>
              <span className="font-bold text-green-600">{data.vendorsAssigned || 0}</span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-600">Scheduling Status:</span>
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
              Pending
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleScheduleClick}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <CalendarClock className="w-4 h-4" />
          Schedule Property
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Footer - Time */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          {notification.createdAt 
            ? `Added ${new Date(notification.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}`
            : 'Just now'
          }
        </p>
      </div>
    </div>
  );
};

/**
 * Pending Schedules Badge Component
 * Shows count of pending property schedules in dashboards
 */
export const PendingSchedulesBadge = ({
  count,
  onClick,
  portalType = 'admin',
  showCard = false
}) => {
  const navigate = useNavigate();

  const getBasePath = () => {
    const pathMap = {
      'franchise': '/fp',
      'manager': '/manager',
      'admin': '',
      'employee': ''
    };
    return pathMap[portalType] || '';
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      const basePath = getBasePath();
      navigate(`${basePath}/schedules/pending`);
    }
  };

  if (count === 0) return null;

  if (showCard) {
    return (
      <div 
        onClick={handleClick}
        className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200 p-4 cursor-pointer hover:shadow-lg transition-all group"
      >
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <CalendarClock className="w-6 h-6 text-orange-600" />
          </div>
          <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded-full">
            {count}
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-lg font-semibold text-gray-900">Pending Property Schedules</h3>
          <p className="text-sm text-gray-500 mt-1">Properties ready for scheduling</p>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-orange-600 font-medium group-hover:gap-3 transition-all">
          <span>Schedule Now</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 transition-colors"
    >
      <CalendarClock className="w-5 h-5" />
      <span className="text-sm font-medium">Pending Property Schedules:</span>
      <span className="px-2 py-0.5 bg-orange-500 text-white text-sm font-bold rounded-full">
        {count}
      </span>
    </button>
  );
};

/**
 * Hook to fetch pending schedules count
 */
export const usePendingSchedulesCount = (portalType = 'admin') => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const token = getAuthToken();

  const getApiPath = () => {
    const portalMap = {
      'franchise': 'fp',
      'manager': 'manager',
      'admin': 'admin',
      'employee': 'admin'
    };
    return portalMap[portalType] || 'admin';
  };

  const fetchCount = useCallback(async () => {
    try {
      const apiPath = getApiPath();
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/pending-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        setCount(result.data?.count || 0);
      }
    } catch (err) {
      console.error('Error fetching pending count:', err);
    } finally {
      setLoading(false);
    }
  }, [token, portalType]);

  useEffect(() => {
    fetchCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
};

/**
 * Scheduling Notifications Panel
 * Shows list of scheduling notifications
 */
export const SchedulingNotificationsPanel = ({ 
  portalType = 'admin',
  maxItems = 5,
  onViewAll
}) => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const getApiPath = () => {
    const portalMap = {
      'franchise': 'fp',
      'manager': 'manager',
      'admin': 'admin',
      'employee': 'admin'
    };
    return portalMap[portalType] || 'admin';
  };

  const getBasePath = () => {
    const pathMap = {
      'franchise': '/fp',
      'manager': '/manager',
      'admin': '',
      'employee': ''
    };
    return pathMap[portalType] || '';
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const apiPath = getApiPath();
      const response = await fetch(`${API_BASE}/api/${apiPath}/schedules/notifications?limit=${maxItems}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.success) {
        setNotifications(result.data || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [token, portalType, maxItems]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleDismiss = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      const basePath = getBasePath();
      navigate(`${basePath}/schedules/pending`);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Scheduling Notifications</h3>
        <button
          onClick={handleViewAll}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <PropertyScheduleNotificationCard
            key={notification.id}
            notification={notification}
            portalType={portalType}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
};

export default PropertyScheduleNotificationCard;
