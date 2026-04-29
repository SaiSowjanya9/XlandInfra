import { useState, useEffect } from 'react';
import {
  FileText, Plus, List, Package, PlusCircle, Archive, Check, X, AlertCircle
} from 'lucide-react';

import CreateEstimate from '../components/estimates/CreateEstimate';
import EstimatesList from '../components/estimates/EstimatesList';
import AMCPackage from '../components/estimates/AMCPackage';
import AddonsManager from '../components/estimates/AddonsManager';
import ArchivedEstimates from '../components/estimates/ArchivedEstimates';

import {
  getEstimates, getArchivedEstimates, getAMCPackages, getAddons
} from '../utils/estimateStore';

const TABS = [
  { id: 'create', label: 'Create Estimate', icon: Plus },
  { id: 'list', label: 'All Estimates', icon: List },
  { id: 'amc', label: 'AMC Package', icon: Package },
  { id: 'addons', label: 'Add-ons', icon: PlusCircle },
  { id: 'archived', label: 'Archived', icon: Archive }
];

const Estimates = ({ admin }) => {
  const [activeTab, setActiveTab] = useState('list');
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({
    estimates: 0,
    archived: 0,
    amcPackages: 0,
    addons: 0
  });

  useEffect(() => {
    loadStats();
  }, [activeTab]);

  const loadStats = () => {
    setStats({
      estimates: getEstimates().length,
      archived: getArchivedEstimates().length,
      amcPackages: getAMCPackages().length,
      addons: getAddons().length
    });
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRefresh = () => {
    loadStats();
  };

  const handleEstimateCreated = () => {
    loadStats();
    setActiveTab('list');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'create':
        return (
          <CreateEstimate
            onSuccess={handleEstimateCreated}
            showToast={showToast}
          />
        );
      case 'list':
        return (
          <EstimatesList
            onRefresh={handleRefresh}
            showToast={showToast}
          />
        );
      case 'amc':
        return (
          <AMCPackage showToast={showToast} />
        );
      case 'addons':
        return (
          <AddonsManager showToast={showToast} />
        );
      case 'archived':
        return (
          <ArchivedEstimates
            onRefresh={handleRefresh}
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Estimates</h1>
                <p className="text-sm text-gray-500">Create and manage estimates, AMC packages, and add-ons</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.estimates}</p>
                <p className="text-xs text-gray-500">Active Estimates</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.amcPackages}</p>
                <p className="text-xs text-gray-500">AMC Packages</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.addons}</p>
                <p className="text-xs text-gray-500">Add-ons</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.archived}</p>
                <p className="text-xs text-gray-500">Archived</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.id === 'archived' && stats.archived > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      {stats.archived}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {renderTabContent()}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-white'
          }`}>
            {toast.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : null}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Estimates;
