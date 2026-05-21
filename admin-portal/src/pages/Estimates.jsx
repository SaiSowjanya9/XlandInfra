import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, List, Package, PlusCircle, Archive, Check, X, AlertCircle
} from 'lucide-react';

import CreateEstimate from '../components/estimates/CreateEstimate';
import EstimatesList from '../components/estimates/EstimatesList';
import AMCPackageManager from '../components/estimates/AMCPackageManager';
import AddonsManager from '../components/estimates/AddonsManager';
import ArchivedEstimates from '../components/estimates/ArchivedEstimates';

import {
  getEstimates, getArchivedEstimates, getAMCPackages, getAddons
} from '../utils/estimateStore';

const TAB_TITLES = {
  'create': 'Create Estimate',
  'list': 'All Estimates',
  'amc-manager': 'AMC Packages',
  'addons': 'Add-ons',
  'archived': 'Archived Estimates'
};

const Estimates = ({ admin, defaultTab = 'list' }) => {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({
    estimates: 0,
    archived: 0,
    amcPackages: 0,
    addons: 0
  });

  useEffect(() => {
    loadStats();
  }, [defaultTab]);

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
    navigate('/employee/estimates/list');
  };

  const renderContent = () => {
    switch (defaultTab) {
      case 'create':
        return (
          <CreateEstimate
            admin={admin}
            onSuccess={handleEstimateCreated}
            showToast={showToast}
          />
        );
      case 'list':
        return (
          <EstimatesList
            admin={admin}
            onRefresh={handleRefresh}
            showToast={showToast}
          />
        );
      case 'amc-manager':
        return (
          <AMCPackageManager admin={admin} showToast={showToast} />
        );
      case 'addons':
        return (
          <AddonsManager admin={admin} showToast={showToast} />
        );
      case 'archived':
        return (
          <ArchivedEstimates
            admin={admin}
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
                <h1 className="text-2xl font-bold text-gray-800">{TAB_TITLES[defaultTab] || 'Estimates'}</h1>
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {renderContent()}
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
