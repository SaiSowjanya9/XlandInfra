import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  CreditCard,
  Calendar,
  Phone,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Home,
  Megaphone,
  PartyPopper,
  FileText,
  HelpCircle,
  Bell,
  MapPin,
  Users,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const CustomerDashboard = ({ user }) => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, completed: 0 });

  useEffect(() => {
    fetchRecentOrders();
  }, []);

  const fetchRecentOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/work-orders?limit=5`);
      const result = await response.json();
      if (result.success) {
        setRecentOrders(result.data?.slice(0, 3) || []);
        setStats(result.counts || { pending: 0, completed: 0 });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickAccess = [
    { title: 'Work Order', icon: ClipboardList, path: '/customer/work-order', color: 'bg-blue-500' },
    { title: 'Payment', icon: CreditCard, path: '/customer/payment', color: 'bg-emerald-500' },
    { title: 'Schedule', icon: Calendar, path: '/customer/schedule', color: 'bg-amber-500' },
    { title: 'Contact', icon: Phone, path: '/customer/contact', color: 'bg-purple-500' },
  ];

  const announcements = [
    {
      id: 1,
      type: 'announcement',
      title: 'Water Supply Maintenance',
      description: 'Scheduled maintenance on April 28th from 10 AM to 2 PM. Please store water accordingly.',
      date: 'Apr 25, 2026',
      priority: 'high',
    },
    {
      id: 2,
      type: 'event',
      title: 'Community BBQ Event',
      description: 'Join us for a community gathering this Saturday at the clubhouse. Food and drinks provided!',
      date: 'Apr 27, 2026',
      time: '4:00 PM - 8:00 PM',
      location: 'Clubhouse Garden',
    },
    {
      id: 3,
      type: 'announcement',
      title: 'New Parking Rules',
      description: 'Updated visitor parking guidelines are now in effect. Please review the new rules.',
      date: 'Apr 22, 2026',
      priority: 'medium',
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'assigned': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Home className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.firstName || 'Resident'}!
            </h1>
            <p className="text-gray-500">
              {user?.unitNumber ? `Unit ${user.unitNumber}` : 'Resident Portal'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Access</h2>
        <div className="grid grid-cols-4 gap-3">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all group text-center"
              >
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-700 group-hover:text-emerald-600 transition-colors">
                  {item.title}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Announcements & Events */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Announcements & Events</h2>
          <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-1">
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {announcements.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  item.type === 'event' ? 'bg-purple-100' : 
                  item.priority === 'high' ? 'bg-red-100' : 'bg-blue-100'
                }`}>
                  {item.type === 'event' ? (
                    <PartyPopper className={`w-5 h-5 text-purple-600`} />
                  ) : (
                    <Megaphone className={`w-5 h-5 ${item.priority === 'high' ? 'text-red-600' : 'text-blue-600'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    {item.priority === 'high' && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                        Important
                      </span>
                    )}
                    {item.type === 'event' && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                        Event
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.date}</span>
                    </span>
                    {item.time && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.time}</span>
                      </span>
                    )}
                    {item.location && (
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{item.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent Work Orders</h2>
          <Link
            to="/customer/work-order"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center space-x-1"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-3 text-gray-500">Loading...</p>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No work orders yet</p>
              <Link
                to="/customer/work-order"
                className="inline-block mt-3 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
              >
                Submit your first work order →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{order.category_name}</p>
                      <p className="text-sm text-gray-500">{order.subcategory_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status?.replace('_', ' ')}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Emergency Banner */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl p-5 text-white">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Need immediate assistance?</h3>
            <p className="text-sm text-emerald-100 mt-1">
              For emergencies, please contact the management office directly at (555) 123-4567
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
