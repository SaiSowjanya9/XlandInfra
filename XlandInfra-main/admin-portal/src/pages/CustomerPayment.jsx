import { CreditCard, DollarSign, Calendar, FileText, Clock, CheckCircle2 } from 'lucide-react';

const CustomerPayment = ({ user }) => {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-500">Manage your rent and other payments</p>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-emerald-100 text-sm">Current Balance</p>
            <p className="text-4xl font-bold mt-1">$0.00</p>
          </div>
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
            <DollarSign className="w-8 h-8" />
          </div>
        </div>
        <div className="flex items-center space-x-2 text-emerald-100 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>No outstanding balance</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all text-left group">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Make a Payment</h3>
          <p className="text-sm text-gray-500 mt-1">Pay rent or other charges</p>
        </button>
        <button className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all text-left group">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Auto Pay</h3>
          <p className="text-sm text-gray-500 mt-1">Set up automatic payments</p>
        </button>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
        </div>
        <div className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No payment history</p>
          <p className="text-gray-400 text-sm mt-1">Your payment records will appear here</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
        <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800">Payment Integration Coming Soon</p>
          <p className="text-sm text-amber-600 mt-1">
            Online payment functionality will be available in a future update. 
            For now, please contact the management office for payment options.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerPayment;
