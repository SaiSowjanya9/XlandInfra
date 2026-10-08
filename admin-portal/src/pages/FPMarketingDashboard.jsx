import React from 'react';
import { BarChart3, Megaphone } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';

// Marketing Dashboard lands with the Marketing section; for now it is a placeholder while the
// Tracker is built out first.
const FPMarketingDashboard = ({ user }) => {
  const isFPManager = user?.role === 'manager';

  if (isFPManager) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-warm-border shadow-warm p-10 text-center">
          <Megaphone className="w-10 h-10 mx-auto mb-3 text-warm-accent" strokeWidth={1.5} />
          <h2 className="text-lg font-semibold text-warm-text">Marketing is not available for your account</h2>
          <p className="text-sm text-warm-muted mt-1">This section is available to the franchise partner account only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-warm-section border border-warm-border rounded-xl shadow-warm px-5 py-4 flex items-center gap-3">
        <div className="p-2.5 bg-warm-accent-soft rounded-[10px] flex-shrink-0">
          <BarChart3 className="w-5 h-5 text-warm-accent" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-warm-text">Marketing Dashboard</h1>
          <p className="text-xs text-warm-muted">Lead and conversion insights for direct estimates</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-warm-border shadow-warm overflow-hidden">
        <EmptyState
          icon={BarChart3}
          title="Coming Soon"
          description="The marketing dashboard is under development"
        />
      </div>
    </div>
  );
};

export default FPMarketingDashboard;
