import { Calendar, Clock, MapPin, User, Bell, CheckCircle2 } from 'lucide-react';

const CustomerSchedule = ({ user }) => {
  const upcomingEvents = [
    // Demo data - will be replaced with real data from API
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <Calendar className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
            <p className="text-gray-500">View upcoming appointments and events</p>
          </div>
        </div>
      </div>

      {/* Calendar View Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex border-b border-gray-200">
          <button className="flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50">
            <Calendar className="w-5 h-5" />
            <span>Upcoming</span>
          </button>
          <button className="flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50">
            <Clock className="w-5 h-5" />
            <span>Past</span>
          </button>
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full font-medium">
            {upcomingEvents.length} scheduled
          </span>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No upcoming appointments</p>
            <p className="text-gray-400 text-sm mt-1">
              When you have scheduled appointments, they'll appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-14 h-14 bg-amber-100 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-xs text-amber-600 font-medium uppercase">
                      {event.month}
                    </span>
                    <span className="text-xl font-bold text-amber-700">{event.day}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{event.title}</h3>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>{event.time}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <MapPin className="w-4 h-4" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      {event.assignee && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <User className="w-4 h-4" />
                          <span>{event.assignee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    event.status === 'confirmed' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {event.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications Card */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Schedule Notifications</h3>
            <p className="text-sm text-gray-500 mt-1">
              You'll receive reminders for upcoming appointments via email and SMS
            </p>
            <button className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Manage notification preferences →
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-emerald-800">How Scheduling Works</p>
          <p className="text-sm text-emerald-600 mt-1">
            When you submit a work order, our team will schedule an appointment and notify you. 
            You can view and manage all your appointments from this page.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerSchedule;
