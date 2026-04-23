import { Link } from 'react-router-dom';
import { ClipboardList, Calendar, CreditCard, HelpCircle, ArrowRight, Building2, Home } from 'lucide-react';

const Dashboard = ({ user }) => {
  const menuItems = [
    {
      path: '/dashboard/work-order',
      icon: ClipboardList,
      title: 'Work Order',
      description: 'Submit a new maintenance or repair request',
    },
    {
      path: '/dashboard/schedule',
      icon: Calendar,
      title: 'Schedule',
      description: 'View and manage your appointments',
    },
    {
      path: '/dashboard/payment',
      icon: CreditCard,
      title: 'Payment',
      description: 'Make payments and view billing history',
    },
    {
      path: '/dashboard/contact',
      icon: HelpCircle,
      title: 'Contact / Help',
      description: 'Get support and contact information',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Welcome, <span className="text-gold-gradient">{user?.firstName}!</span>
        </h1>
        <p className="text-dark-300">
          Manage your work orders, schedule appointments, and more.
        </p>
      </div>

      {/* Property Info Card */}
      {user && (
        <div className="mb-8 bg-gradient-to-r from-gold-600/20 to-gold-700/20 border border-gold-500/30 rounded-2xl p-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gold-500/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-gold-400" />
            </div>
            <div>
              <p className="text-gold-400/80 text-sm">Your Property</p>
              <h2 className="text-xl font-bold text-white">{user.propertyName}</h2>
              <div className="flex items-center space-x-2 mt-1">
                <Home className="w-4 h-4 text-gold-500/70" />
                <span className="text-dark-300">Unit {user.unitNumber}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="group bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-gold-500/40 gold-glow-hover"
            >
              <div className="bg-gradient-to-br from-gold-600/20 to-gold-700/20 p-6 border-b border-gold-600/20">
                <Icon className="w-12 h-12 text-gold-400" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-white">
                    {item.title}
                  </h2>
                  <ArrowRight className="w-5 h-5 text-dark-400 group-hover:text-gold-400 group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <p className="text-sm text-dark-300">
                  {item.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Stats or Recent Activity (Optional placeholder) */}
      <div className="mt-10 bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-dark-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-dark-500" />
          <p>No recent work orders</p>
          <Link
            to="/dashboard/work-order"
            className="inline-block mt-4 text-gold-400 font-medium hover:text-gold-300 transition-colors"
          >
            Create your first work order →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
