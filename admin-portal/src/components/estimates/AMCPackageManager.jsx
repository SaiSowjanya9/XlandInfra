import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  DollarSign,
  Edit,
  X,
  FileText,
  Download,
  Mail,
} from 'lucide-react';
import {
  getAMCPackages,
  createAMCPackage,
  updateAMCPackage,
  deleteAMCPackage,
} from '../../utils/estimateStore';

// Property type options

const AMCPackageManager = ({ showToast }) => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'all-packages'
  const [amcPackages, setAmcPackages] = useState([]);
  
  // Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);

  // Simplified package form - single package entity
  const [amcForm, setAmcForm] = useState({
    packageName: '',
    services: '', // Free-type text for services
    rate: '', // Single rate for entire package
  });

  const loadData = () => {
    setAmcPackages(getAMCPackages());
  };

  useEffect(() => {
    loadData();
  }, []);


  // Form actions
  const handleSavePackage = () => {
    if (!amcForm.packageName.trim()) {
      showToast?.('Please enter a package name', 'error');
      return;
    }

    if (!amcForm.services.trim()) {
      showToast?.('Please enter services', 'error');
      return;
    }

    if (!amcForm.rate || parseFloat(amcForm.rate) <= 0) {
      showToast?.('Please enter a valid rate', 'error');
      return;
    }

    const packageData = {
      packageName: amcForm.packageName.trim(),
      services: amcForm.services.trim(),
      rate: parseFloat(amcForm.rate),
      status: 'active',
    };

    if (editingPackage) {
      updateAMCPackage(editingPackage.packageId, packageData);
      showToast?.('AMC Package updated successfully!', 'success');
      setShowEditModal(false);
    } else {
      createAMCPackage(packageData);
      showToast?.('AMC Package created successfully!', 'success');
    }

    resetForm();
    loadData();
  };

  const handleOpenEditModal = (pkg) => {
    setEditingPackage(pkg);
    // Handle old format (array) vs new format (string) for services
    let servicesText = '';
    if (typeof pkg.services === 'string') {
      servicesText = pkg.services;
    } else if (Array.isArray(pkg.services)) {
      servicesText = pkg.services.map(s => s.name).filter(Boolean).join(', ');
    }
    
    setAmcForm({
      packageName: pkg.packageName || '',
      services: servicesText,
      rate: pkg.rate?.toString() || '',
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingPackage(null);
    resetForm();
  };

  const handleDeletePackage = (packageId) => {
    if (window.confirm('Are you sure you want to delete this AMC package?')) {
      deleteAMCPackage(packageId);
      showToast?.('AMC Package deleted', 'success');
      if (showEditModal) setShowEditModal(false);
      loadData();
    }
  };

  const resetForm = () => {
    setAmcForm({
      packageName: '',
      services: '',
      rate: '',
    });
    setEditingPackage(null);
  };

  // Export to PDF (placeholder)
  const handleExportPDF = (pkg) => {
    showToast?.('PDF export feature coming soon!', 'info');
  };

  // Email package (placeholder)
  const handleEmailPackage = (pkg) => {
    showToast?.('Email feature coming soon!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'create'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Package
          </div>
        </button>
        <button
          onClick={() => setActiveTab('all-packages')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all-packages'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            All AMC Packages
            {amcPackages.length > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">
                {amcPackages.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* All AMC Packages Tab */}
      {activeTab === 'all-packages' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">All AMC Packages</h3>
            <p className="text-sm text-gray-500">{amcPackages.length} package(s) saved</p>
          </div>

          {amcPackages.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No AMC packages yet</p>
              <p className="text-sm text-gray-400">Create AMC packages from the "Create Package" tab</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {amcPackages.map((pkg) => (
                <div key={pkg.packageId} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {pkg.packageName || 'Unnamed Package'}
                          <span className="ml-2 text-xs font-normal text-gray-500">({pkg.packageId})</span>
                        </p>
                        {pkg.propertyId && (
                          <p className="text-sm text-gray-600">
                            Property: {pkg.propertyId} - {pkg.propertyName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Package Rate</p>
                        <p className="font-semibold text-indigo-600">₹{(pkg.rate || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleOpenEditModal(pkg)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportPDF(pkg)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          title="Export PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEmailPackage(pkg)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePackage(pkg.packageId)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {pkg.services && (
                    <div className="mt-3 ml-14">
                      <p className="text-xs text-gray-500 mb-1">Services:</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        {typeof pkg.services === 'string' 
                          ? pkg.services 
                          : Array.isArray(pkg.services) 
                            ? pkg.services.map(s => s.name).filter(Boolean).join(', ')
                            : ''}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Package Tab */}
      {activeTab === 'create' && (
      <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Create AMC Package</h2>
              <p className="text-sm text-gray-500">Define a package with services and pricing</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Package Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Package Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={amcForm.packageName}
              onChange={(e) => setAmcForm({ ...amcForm, packageName: e.target.value })}
              placeholder="e.g., Annual Maintenance Package - Premium"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            />
          </div>


          {/* Services - Free Type Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Services <span className="text-red-500">*</span>
            </label>
            <textarea
              value={amcForm.services}
              onChange={(e) => setAmcForm({ ...amcForm, services: e.target.value })}
              placeholder="Enter services included in this package (e.g., Lawn Mowing, Pool Maintenance, Cleaning, Security...)"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Enter all services that are part of this package</p>
          </div>

          {/* Package Rate */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Package Rate (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              min="0"
              value={amcForm.rate}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                setAmcForm({ ...amcForm, rate: value });
              }}
              placeholder="Enter package rate"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>


          {/* Price Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Price Summary</h3>
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold">Package Rate</p>
                <p className="text-3xl font-bold">₹{(parseFloat(amcForm.rate) || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={resetForm}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSavePackage}
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save AMC Package
          </button>
        </div>
      </div>
      </>
      )}

      {/* Edit Package Modal */}
      {showEditModal && editingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Edit className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Edit AMC Package</h3>
                  <p className="text-sm text-gray-500">{editingPackage.packageId}</p>
                </div>
              </div>
              <button
                onClick={handleCloseEditModal}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Package Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={amcForm.packageName}
                  onChange={(e) => setAmcForm({ ...amcForm, packageName: e.target.value })}
                  placeholder="e.g., Annual Maintenance Package - Premium"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>


              {/* Services */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={amcForm.services}
                  onChange={(e) => setAmcForm({ ...amcForm, services: e.target.value })}
                  placeholder="Enter services..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              {/* Package Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Rate (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  value={amcForm.rate}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setAmcForm({ ...amcForm, rate: value });
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Price Summary */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-indigo-700">Package Rate:</span>
                  <span className="text-lg font-bold text-indigo-700">₹{(parseFloat(amcForm.rate) || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => handleDeletePackage(editingPackage.packageId)}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePackage}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
)}
    </div>
  );
};

export default AMCPackageManager;
