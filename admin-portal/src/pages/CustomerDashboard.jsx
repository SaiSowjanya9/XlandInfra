import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { Link } from 'react-router-dom';
import { getAuthToken } from '../utils/safeStorage';
import {
  ClipboardList,
  CreditCard,
  Calendar,
  Phone,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  PartyPopper,
  MapPin,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import WorkOrderPieChart from '../components/WorkOrderPieChart';

const API_BASE = '/api';

const CustomerDashboard = ({ user }) => {
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, completed: 0, byStatus: {} });
  const [customerData, setCustomerData] = useState(null);

  // Work order status data for pie chart
  const workOrderStatusData = stats?.byStatus || {
    pending: stats?.pending || 0,
    completed: stats?.completed || 0
  };

  const fetchCustomerDashboard = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      const token = safeStorage.getItem('customer_token') || getAuthToken();
      const response = await fetch(`${API_BASE}/customers/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await response.json();
      if (result.success) {
        setCustomerData(result.data.customer);
        setRecentOrders(result.data.recentWorkOrders?.slice(0, 3) || []);
        setStats(result.data.stats || { pending: 0, completed: 0 });
      }
    } catch (error) {
      console.error('Error fetching customer dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDashboard(true); // Initial load with loading spinner
    
    // Auto-refresh every 30 seconds (silent, no loading spinner)
    const interval = setInterval(() => {
      fetchCustomerDashboard(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const quickAccess = [
    { title: 'Work Orders', icon: ClipboardList, path: '/customer/work-order', gradient: 'from-blue-500 to-indigo-600' },
    { title: 'Payments', icon: CreditCard, path: '/customer/payment', gradient: 'from-teal-500 to-cyan-600' },
    { title: 'Schedule', icon: Calendar, path: '/customer/schedule', gradient: 'from-violet-500 to-purple-600' },
    { title: 'Contact', icon: Phone, path: '/customer/contact', gradient: 'from-amber-500 to-orange-600' },
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
      case 'pending': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'assigned': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'in_progress': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'closed': return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-2xl" />
        <div className="relative p-6 lg:p-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <span className="text-white font-bold text-lg">
                {(customerData?.firstName || user?.firstName)?.[0]}{(customerData?.lastName || user?.lastName)?.[0] || 'R'}
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Welcome back</p>
              <h1 className="text-2xl font-bold text-white">
                {customerData?.firstName || user?.firstName || 'Resident'} {customerData?.lastName || user?.lastName || ''}
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {customerData?.propertyName || user?.unitNumber ? `${customerData?.propertyName || `Unit ${user?.unitNumber}`}` : 'Resident Portal'} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Quick Access</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group relative bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:bg-slate-900 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <div className={`w-12 h-12 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-white group-hover:text-teal-400 transition-colors">{item.title}</p>
                <ArrowUpRight className="absolute top-4 right-4 w-4 h-4 text-slate-600 group-hover:text-teal-400 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Work Order Status Pie Chart */}
      <WorkOrderPieChart
        data={workOrderStatusData}
        title="Work Orders"
        basePath="/customer/work-order"
        size="default"
        className="!bg-slate-900/50 !border-white/5"
      />

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Announcements & Events */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Announcements & Events</h2>
            <button className="text-sm text-teal-400 hover:text-teal-300 font-medium flex items-center gap-1 transition-colors">
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {announcements.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/50 border border-white/5 rounded-xl p-4 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    item.type === 'event' ? 'bg-violet-500/10' : 
                    item.priority === 'high' ? 'bg-red-500/10' : 'bg-blue-500/10'
                  }`}>
                    {item.type === 'event' ? (
                      <PartyPopper className="w-5 h-5 text-violet-400" />
                    ) : (
                      <Megaphone className={`w-5 h-5 ${item.priority === 'high' ? 'text-red-400' : 'text-blue-400'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-white">{item.title}</h3>
                      {item.priority === 'high' && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                          Important
                        </span>
                      )}
                      {item.type === 'event' && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          Event
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{item.date}</span>
                      </span>
                      {item.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{item.time}</span>
                        </span>
                      )}
                      {item.location && (
                        <span className="flex items-center gap-1">
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

      </div>

      {/* Emergency Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border border-teal-500/20 rounded-2xl p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Need immediate assistance?</h3>
            <p className="text-sm text-slate-400 mt-1">
              For emergencies, please contact the management office directly at{' '}
              <span className="text-teal-400 font-medium">(555) 123-4567</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
