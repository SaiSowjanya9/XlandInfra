import { Truck, Construction, Clock } from 'lucide-react';

const VendorDashboard = () => {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Dashboard</h1>
        <p className="text-gray-500">Welcome to the vendor portal</p>
      </div>

      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Construction className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Coming Soon</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            The vendor portal is currently under development. New features for managing contracts, service assignments, and vendor profiles will be available soon.
          </p>
          <div className="inline-flex items-center space-x-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>Under Development</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
