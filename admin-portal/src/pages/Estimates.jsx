import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Plus, List, Package, PlusCircle, Archive, Check, X, AlertCircle,
  ChevronDown, RefreshCw, Users
} from 'lucide-react';

import CreateEstimate from '../components/estimates/CreateEstimate';
import EstimatesList from '../components/estimates/EstimatesList';
import AMCPackageManager from '../components/estimates/AMCPackageManager';
import AddonsManager from '../components/estimates/AddonsManager';
import ArchivedEstimates from '../components/estimates/ArchivedEstimates';
import { useFP } from '../contexts/FPContext';

import {
  fetchEstimates, fetchAMCPackages, fetchAddons
} from '../utils/estimateStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

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
  const [estimates, setEstimates] = useState([]);
  const [archivedEstimates, setArchivedEstimates] = useState([]);
  const [stats, setStats] = useState({
    estimates: 0,
    archived: 0,
    amcPackages: 0,
    addons: 0
  });
  
  // FP Context for Admin mode
  const { selectedFp, fpList, selectFp } = useFP();
  const [fpDropdownOpen, setFpDropdownOpen] = useState(false);
  const token = sessionStorage.getItem('pm_auth_token');
  
  const handleFpSelect = (fp) => {
    selectFp(fp);
    setFpDropdownOpen(false);
  };
  
  // Auto-select Admin mode if no FP selected
  useEffect(() => {
    if (!selectedFp) {
      handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' });
    }
  }, []);

  useEffect(() => {
    if (selectedFp) {
      loadStats();
    }
  }, [defaultTab, selectedFp]);

  const loadStats = async () => {
    try {
      let estUrl, archUrl;
      
      // Use Admin endpoint for "all" mode, otherwise FP-specific endpoint
      if (selectedFp?.id === 'all') {
        estUrl = `${API_BASE}/api/admin/all-estimates?archived=false`;
        archUrl = `${API_BASE}/api/admin/all-estimates?archived=true`;
      } else if (selectedFp?.id) {
        estUrl = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/estimates?archived=false`;
        archUrl = `${API_BASE}/api/admin/fp-view/${selectedFp.id}/estimates?archived=true`;
      } else {
        return;
      }
      
      const [estRes, archRes, pkgRes, addRes] = await Promise.all([
        fetch(estUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(archUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetchAMCPackages(),
        fetchAddons()
      ]);
      const estData = await estRes.json();
      const archData = await archRes.json();
      const estArr = estData.success ? estData.data : [];
      const archArr = archData.success ? archData.data : [];
      setEstimates(estArr);
      setArchivedEstimates(archArr);
      setStats({
        estimates: estArr.length,
        archived: archArr.length,
        amcPackages: pkgRes.length,
        addons: addRes.length
      });
    } catch (error) {
      console.error('Load stats error:', error);
    }
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
            estimates={estimates}
            onRefresh={handleRefresh}
            showToast={showToast}
          />
        );
      case 'amc-manager':
        return (
          <AMCPackageManager admin={admin} showToast={showToast} selectedFp={selectedFp} onRefresh={handleRefresh} />
        );
      case 'addons':
        return (
          <AddonsManager admin={admin} showToast={showToast} selectedFp={selectedFp} onRefresh={handleRefresh} />
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

            <div className="flex items-center gap-6">
              {/* FP Switcher - Hide on Create tab */}
              {defaultTab !== 'create' && (
                <>
                  <div className="relative">
                    <button
                      onClick={() => setFpDropdownOpen(!fpDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
                      <span className="font-medium text-gray-700">
                        {selectedFp?.id === 'all' ? 'Admin (All FPs)' : selectedFp?.fpId || 'Select FP'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fpDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {fpDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
                        <button
                          onClick={() => handleFpSelect({ id: 'all', fpId: 'ADMIN', companyName: 'All FPs' })}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors border-b border-gray-100 ${
                            selectedFp?.id === 'all' ? 'bg-slate-50' : ''
                          }`}
                        >
                          <div className="font-medium flex items-center gap-2 text-slate-700">
                            <Users className="w-4 h-4" />
                            Admin (All FPs)
                          </div>
                        </button>
                        {fpList.map(fp => (
                          <button
                            key={fp.id}
                            onClick={() => handleFpSelect(fp)}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                              selectedFp?.id === fp.id ? 'bg-slate-50' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-800">{fp.fpId}</span>
                              <span className="text-xs text-gray-500">{fp.ownerName}</span>
                            </div>
                            <div className="text-sm text-gray-600 mt-0.5">{fp.companyName}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Refresh Button */}
                  <button
                    onClick={handleRefresh}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="w-5 h-5 text-gray-600" />
                  </button>
                </>
              )}
              
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
