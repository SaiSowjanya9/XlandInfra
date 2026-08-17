import { CreditCard, Receipt, FileText, Wallet, History, BarChart3 } from 'lucide-react';

const pageConfig = {
  dashboard: {
    title: 'Billing Dashboard',
    description: 'Overview of billing and payment activities',
    icon: BarChart3
  },
  'generate-invoices': {
    title: 'Generate Invoices',
    description: 'Create and generate new invoices',
    icon: FileText
  },
  invoices: {
    title: 'Invoices',
    description: 'View and manage all invoices',
    icon: Receipt
  },
  payments: {
    title: 'Payments',
    description: 'Track and manage payments',
    icon: CreditCard
  },
  'make-payments': {
    title: 'Make Payments',
    description: 'Process and record payments',
    icon: Wallet
  },
  'payment-history': {
    title: 'Payment History',
    description: 'View payment transaction history',
    icon: History
  }
};

const BillingPlaceholder = ({ page = 'dashboard', portalName = 'Admin' }) => {
  const config = pageConfig[page] || pageConfig.dashboard;
  const Icon = config.icon;

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20">
              <Icon className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{config.title}</h1>
              <p className="text-sm text-slate-500">{portalName} Portal</p>
            </div>
          </div>
        </div>

        {/* Placeholder Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="text-center py-12">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-6">
              <Icon className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">{config.title}</h2>
            <p className="text-slate-500 mb-6">{config.description}</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Coming Soon
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-medium text-slate-500 mb-1">Status</div>
            <div className="text-lg font-semibold text-slate-700">Under Development</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-medium text-slate-500 mb-1">Module</div>
            <div className="text-lg font-semibold text-slate-700">Billing & Payments</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="text-sm font-medium text-slate-500 mb-1">Portal</div>
            <div className="text-lg font-semibold text-slate-700">{portalName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPlaceholder;
