import { useState, useEffect } from 'react';
import { Building2, ClipboardList, Clock, CheckCircle } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
    { label: 'Properties', value: stats?.properties || 0, icon: Building2, color: 'bg-blue-500' },
    { label: 'Work Orders', value: stats?.workOrders || 0, icon: ClipboardList, color: 'bg-orange-500' },
    { label: 'Pending', value: stats?.pendingWorkOrders || 0, icon: Clock, color: 'bg-amber-500' },
    { label: 'Completed', value: stats?.completedWorkOrders || 0, icon: CheckCircle, color: 'bg-green-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your property management system</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a href="/properties" className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <Building2 className="w-5 h-5 text-primary-600 mr-3" />
              <span>Manage Properties</span>
            </a>
            <a href="/work-orders" className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <ClipboardList className="w-5 h-5 text-primary-600 mr-3" />
              <span>View Work Orders</span>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Info</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Role Permissions</span>
              <span className="font-medium">Admin / Executive</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Admin</span>
              <span className="text-sm text-gray-600">Full access, Edit masters, Control reports</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Executive</span>
              <span className="text-sm text-gray-600">Enter data, Copy from forms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
