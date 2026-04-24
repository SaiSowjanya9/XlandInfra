import { useState, useEffect } from 'react';
import { Building2, ClipboardList, Clock, CheckCircle2, FileText, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Properties', 
      value: stats?.properties || 0, 
      icon: Building2, 
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    { 
      label: 'Work Orders', 
      value: stats?.workOrders || 0, 
      icon: ClipboardList, 
      bgColor: 'bg-orange-100',
      iconColor: 'text-orange-600'
    },
    { 
      label: 'Pending', 
      value: stats?.pendingWorkOrders || 0, 
      icon: Clock, 
      bgColor: 'bg-amber-100',
      iconColor: 'text-amber-600'
    },
    { 
      label: 'Completed', 
      value: stats?.completedWorkOrders || 0, 
      icon: CheckCircle2, 
      bgColor: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your property management system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index} 
              className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                if (stat.label === 'Properties') navigate('/properties');
                else if (stat.label === 'Work Orders' || stat.label === 'Pending' || stat.label === 'Completed') navigate('/work-orders');
              }}
            >
              <div className={`w-11 h-11 ${stat.bgColor} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions & System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Quick Actions</h2>
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/properties')}
              className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors text-left group"
            >
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-gray-700 font-medium">Manage Properties</span>
            </button>
            <button 
              onClick={() => navigate('/work-orders')}
              className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-orange-50 rounded-lg transition-colors text-left group"
            >
              <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <ClipboardList className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-gray-700 font-medium">View Work Orders</span>
            </button>
            <button 
              onClick={() => navigate('/onboarding')}
              className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-emerald-50 rounded-lg transition-colors text-left group"
            >
              <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-gray-700 font-medium">New Property Onboarding</span>
            </button>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">System Info</h2>
          <div className="space-y-0">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-500">Role Permissions</span>
              <span className="font-semibold text-gray-800">Admin / Executive</span>
            </div>
            <div className="flex justify-between items-start py-3 border-b border-gray-100">
              <span className="text-gray-500">Admin</span>
              <span className="text-sm text-gray-600 text-right">Full access, Edit masters, Control reports</span>
            </div>
            <div className="flex justify-between items-start py-3">
              <span className="text-gray-500">Executive</span>
              <span className="text-sm text-gray-600 text-right">Enter data, Copy from forms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="text-sm text-gray-500 text-center py-8">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No recent activity to display</p>
          <p className="text-xs mt-1">Activity will appear here as you use the system</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
