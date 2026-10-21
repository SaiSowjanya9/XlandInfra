import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, Loader2 } from 'lucide-react';
import DismissPanel from './common/DismissPanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * The customer's notification bell, in the portal header.
 *
 * It used to live in the body of the home page, which meant the one place a customer is told
 * anything -- a work order moving on, a complaint being answered -- disappeared the moment they
 * opened Work Orders, Schedules or Payments. It is the same fetch; it just sits above every page
 * now.
 *
 * `refreshToken` is how the header's Refresh reaches it: the count is the thing a customer watches,
 * so a Refresh that left the badge stale would be reporting the page and not the account.
 */
const NotificationBell = ({ refreshToken = 0 }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const authHeaders = () => {
    const token = localStorage.getItem('customerToken');
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null;
  };

  const fetchNotifications = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/customers/notifications?limit=10`, { headers });
      const result = await response.json();
      if (result.success) {
        setNotifications(result.data.notifications || []);
        setUnreadCount(result.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications, refreshToken]);

  const markAsRead = async (notificationId) => {
    const headers = authHeaders();
    if (!headers) return;

    try {
      await fetch(`${API_BASE_URL}/api/customers/notifications/${notificationId}/read`, { method: 'PUT', headers });
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const headers = authHeaders();
    if (!headers) return;

    try {
      await fetch(`${API_BASE_URL}/api/customers/notifications/mark-all-read`, { method: 'PUT', headers });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg text-gray-500 hover:text-gold-600 hover:bg-gold-600/10 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? <BellRing className="w-5 h-5 text-gold-600" /> : <Bell className="w-5 h-5" />}
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <DismissPanel
        open={open}
        onDismiss={() => setOpen(false)}
        className="absolute right-0 top-12 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold-600" />
            Notifications
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-gold-600 hover:text-gold-500 flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 text-gold-600 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.isRead) markAsRead(notification.id);
                  // Customer pages live under /dashboard; /contact alone is the public site's route
                  if (notification.actionUrl) navigate(notification.actionUrl);
                  setOpen(false);
                }}
                className={`w-full text-left p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                  !notification.isRead ? 'bg-gold-600/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!notification.isRead ? 'bg-gold-500' : 'bg-gray-200'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!notification.isRead ? 'text-gray-900' : 'text-gray-500'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(notification.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DismissPanel>
    </div>
  );
};

export default NotificationBell;
