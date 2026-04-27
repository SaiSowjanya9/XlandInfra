import { useState, useEffect } from 'react';
import { Truck, Building2, FileText, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getVendors } from '../utils/vendorStore';

const VendorDashboard = () => {
  const [stats, setStats] = useState({ totalVendors: 0, totalUnits: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const vendors = await getVendors();
        const totalUnits = vendors.reduce((sum, v) => sum + (v.totalUnits || 0), 0);
        setStats({ totalVendors: vendors.length, totalUnits });
      } catch (error) {
        console.error('Error fetching vendor stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { 
      label: 'Total Vendors', 
      value: stats.totalVendors, 
      icon: Truck, 
      bgColor: 'bg-amber-100',
      iconColor: 'text-amber-600'
    },
    { 
      label: 'Total Units', 
      value: stats.totalUnits, 
      icon: Building2, 
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Vendor Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your vendor management system</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div 
              key={index} 
              className="bg-white rounded-lg p-5 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate('/vendor/vendor-details')}
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

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Quick Actions</h2>
        <div className="space-y-3">
          <button 
            onClick={() => navigate('/vendor/vendor-details')}
            className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-amber-50 rounded-lg transition-colors text-left group"
          >
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center group-hover:bg-amber-200 transition-colors">
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-gray-700 font-medium">View Vendor Details</span>
          </button>
          <button 
            onClick={() => navigate('/vendor/add-vendor')}
            className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-emerald-50 rounded-lg transition-colors text-left group"
          >
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-gray-700 font-medium">Add New Vendor</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
