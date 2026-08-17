import React, { useState } from 'react';
import { FileText, CreditCard, Calendar, ChevronRight } from 'lucide-react';
import BillingUI from './BillingUI';
import SchedulingUI from './SchedulingUI';

const Phase2Documentation = () => {
  const [activeTab, setActiveTab] = useState('billing');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-blue-200 text-sm mb-2">
            <FileText className="w-4 h-4" />
            <span>XlandInfra Documentation</span>
            <ChevronRight className="w-4 h-4" />
            <span>Phase 2</span>
          </div>
          <h1 className="text-3xl font-bold">Phase 2 - UI Documentation</h1>
          <p className="text-blue-100 mt-2">Billing & Payments | Scheduling Module</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'billing'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Billing & Payments
            </button>
            <button
              onClick={() => setActiveTab('scheduling')}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === 'scheduling'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-5 h-5" />
              Scheduling
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'billing' ? <BillingUI /> : <SchedulingUI />}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p>XlandInfra Phase 2 Documentation • Last Updated: August 2026</p>
        </div>
      </footer>
    </div>
  );
};

export default Phase2Documentation;
