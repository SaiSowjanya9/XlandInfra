import { Calendar, Clock } from 'lucide-react';

const Schedule = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Schedule
        </h1>
        <p className="text-dark-300">
          View and manage your scheduled appointments
        </p>
      </div>

      <div className="bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-8 sm:p-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-gold-600/20 border border-gold-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-gold-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">
            Coming Soon
          </h2>
          <p className="text-dark-300 max-w-md mx-auto mb-6">
            The scheduling feature is currently under development. 
            Soon you'll be able to view and manage all your service appointments here.
          </p>
          <div className="flex items-center justify-center space-x-2 text-dark-400">
            <Clock className="w-5 h-5" />
            <span>Check back soon for updates</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
