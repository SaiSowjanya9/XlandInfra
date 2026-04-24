import { useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  Camera,
  Image,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  ChevronRight,
  Upload,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const CustomerWorkOrder = ({ user }) => {
  const [activeView, setActiveView] = useState('create'); // 'create' | 'history'
  const [categories, setCategories] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    categoryId: '',
    subcategoryId: '',
    description: '',
    permissionToEnter: '',
    entryNotes: '',
    hasPet: '',
    attachments: []
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchWorkOrders();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE}/work-orders/categories`);
      const result = await response.json();
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/work-orders`);
      const result = await response.json();
      if (result.success) {
        setWorkOrders(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get selected category for form
  const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
  const subcategories = selectedCategory?.subcategories || [];

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      categoryId: categoryId.toString(),
      subcategoryId: ''
    }));
    setShowCategoryDropdown(false);
    setFormErrors(prev => ({ ...prev, categoryId: '' }));
  };

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategoryId) => {
    setFormData(prev => ({
      ...prev,
      subcategoryId: subcategoryId.toString()
    }));
    setShowSubcategoryDropdown(false);
    setFormErrors(prev => ({ ...prev, subcategoryId: '' }));
  };

  // Handle file upload
  const handleFileUpload = (event, source = 'gallery') => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024;
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map(file => ({
        file,
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        source,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }));

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments].slice(0, 5)
      }));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (attachmentId) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== attachmentId)
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.categoryId) newErrors.categoryId = 'Please select a category';
    if (!formData.subcategoryId) newErrors.subcategoryId = 'Please select a subcategory';
    if (!formData.permissionToEnter) newErrors.permissionToEnter = 'Please select Yes or No';
    if (!formData.hasPet) newErrors.hasPet = 'Please select Yes or No';
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append('categoryId', formData.categoryId);
      submitData.append('subcategoryId', formData.subcategoryId);
      submitData.append('description', formData.description);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('entryNotes', formData.entryNotes);
      submitData.append('hasPet', formData.hasPet);
      
      // Add resident info if available
      if (user?.id) submitData.append('residentId', user.id);

      formData.attachments.forEach(attachment => {
        submitData.append('attachments', attachment.file);
      });

      const response = await fetch(`${API_BASE}/work-orders`, {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Work order submitted successfully! Your order ID is: ${result.data.workOrderId}`);
        setFormData({
          categoryId: '',
          subcategoryId: '',
          description: '',
          permissionToEnter: '',
          entryNotes: '',
          hasPet: '',
          attachments: []
        });
        fetchWorkOrders();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.message || 'Failed to submit work order');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      setError('Failed to submit work order. Please try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-500">Submit and track maintenance requests</p>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start space-x-3 text-green-700">
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Success!</p>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700">
          <AlertCircle className="w-5 h-5" /><span>{error}</span>
        </div>
      )}

      {/* View Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex">
          <button
            onClick={() => setActiveView('create')}
            className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium transition-all border-b-2 ${
              activeView === 'create'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Send className="w-5 h-5" />
            <span>Submit Request</span>
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium transition-all border-b-2 ${
              activeView === 'history'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>My Requests</span>
            {workOrders.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-600 text-white">
                {workOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeView === 'create' ? (
        /* Work Order Form */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                What type of issue are you reporting? <span className="text-red-500">*</span>
              </label>
              
              {/* Category Dropdown */}
              <div className="relative mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryDropdown(!showCategoryDropdown);
                    setShowSubcategoryDropdown(false);
                  }}
                  className={`w-full px-4 py-4 bg-white border-2 rounded-xl text-left flex items-center justify-between transition-all ${
                    formErrors.categoryId
                      ? 'border-red-400 focus:ring-red-500'
                      : selectedCategory
                        ? 'border-emerald-500 bg-emerald-50/30'
                        : 'border-gray-200 hover:border-emerald-300'
                  } ${showCategoryDropdown ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedCategory ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      <ClipboardList className={`w-5 h-5 ${selectedCategory ? 'text-emerald-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Category</p>
                      <p className={`font-medium ${selectedCategory ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedCategory?.name || 'Select a category'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showCategoryDropdown && (
                  <div className="absolute z-30 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategorySelect(category.id)}
                        className={`w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center justify-between transition-colors ${
                          formData.categoryId === category.id.toString() ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <span className={formData.categoryId === category.id.toString() ? 'text-emerald-700 font-medium' : 'text-gray-700'}>
                          {category.name}
                        </span>
                        {formData.categoryId === category.id.toString() && (
                          <Check className="w-5 h-5 text-emerald-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {formErrors.categoryId && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.categoryId}
                  </p>
                )}
              </div>

              {/* Subcategory Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (formData.categoryId) {
                      setShowSubcategoryDropdown(!showSubcategoryDropdown);
                      setShowCategoryDropdown(false);
                    }
                  }}
                  disabled={!formData.categoryId}
                  className={`w-full px-4 py-4 bg-white border-2 rounded-xl text-left flex items-center justify-between transition-all ${
                    !formData.categoryId
                      ? 'bg-gray-50 cursor-not-allowed border-gray-200'
                      : formErrors.subcategoryId
                        ? 'border-red-400'
                        : formData.subcategoryId
                          ? 'border-emerald-500 bg-emerald-50/30'
                          : 'border-gray-200 hover:border-emerald-300'
                  } ${showSubcategoryDropdown ? 'ring-2 ring-emerald-500' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.subcategoryId ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      <ChevronRight className={`w-5 h-5 ${formData.subcategoryId ? 'text-emerald-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Subcategory</p>
                      <p className={`font-medium ${formData.subcategoryId ? 'text-gray-900' : 'text-gray-400'}`}>
                        {formData.subcategoryId
                          ? subcategories.find(s => s.id === parseInt(formData.subcategoryId))?.name
                          : formData.categoryId
                            ? 'Select a subcategory'
                            : 'Select a category first'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showSubcategoryDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showSubcategoryDropdown && subcategories.length > 0 && (
                  <div className="absolute z-30 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                    {subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSubcategorySelect(sub.id)}
                        className={`w-full px-4 py-3 text-left hover:bg-emerald-50 flex items-center justify-between transition-colors ${
                          formData.subcategoryId === sub.id.toString() ? 'bg-emerald-50' : ''
                        }`}
                      >
                        <span className={formData.subcategoryId === sub.id.toString() ? 'text-emerald-700 font-medium' : 'text-gray-700'}>
                          {sub.name}
                        </span>
                        {formData.subcategoryId === sub.id.toString() && (
                          <Check className="w-5 h-5 text-emerald-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {formErrors.subcategoryId && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.subcategoryId}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                  }
                }}
                placeholder="Please describe the issue in detail. Include location, when it started, and any other helpful information..."
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-sm ${formData.description.length >= 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {formData.description.length}/500
                </span>
              </div>
            </div>

            {/* Permission to Enter & Pet */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Permission to Enter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Permission to Enter <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Can maintenance enter if you're not home?</p>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, permissionToEnter: 'yes' }));
                      setFormErrors(prev => ({ ...prev, permissionToEnter: '' }));
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${
                      formData.permissionToEnter === 'yes'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, permissionToEnter: 'no' }));
                      setFormErrors(prev => ({ ...prev, permissionToEnter: '' }));
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${
                      formData.permissionToEnter === 'no'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    No
                  </button>
                </div>
                {formErrors.permissionToEnter && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.permissionToEnter}
                  </p>
                )}
              </div>

              {/* Has Pet */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Do you have a pet? <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Let us know if there's a pet in the unit</p>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, hasPet: 'yes' }));
                      setFormErrors(prev => ({ ...prev, hasPet: '' }));
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${
                      formData.hasPet === 'yes'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, hasPet: 'no' }));
                      setFormErrors(prev => ({ ...prev, hasPet: '' }));
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${
                      formData.hasPet === 'no'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    No
                  </button>
                </div>
                {formErrors.hasPet && (
                  <p className="mt-2 text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {formErrors.hasPet}
                  </p>
                )}
              </div>
            </div>

            {/* Entry Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Entry Notes <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={formData.entryNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, entryNotes: e.target.value }))}
                placeholder="Any special instructions for entry? (gate code, parking info, key location, etc.)"
                rows={2}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none transition-all"
              />
            </div>

            {/* File Attachments */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Attachments <span className="text-gray-400 font-normal">(Optional - max 5 files)</span>
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Add photos or documents to help us understand the issue better
              </p>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                  }}
                  className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Image className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">From Gallery</span>
                  <span className="text-xs text-gray-400 mt-0.5">Select photos</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.setAttribute('capture', 'environment');
                    fileInputRef.current.click();
                  }}
                  className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Take Photo</span>
                  <span className="text-xs text-gray-400 mt-0.5">Use camera</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => handleFileUpload(e)}
                multiple
                className="hidden"
              />

              {formData.attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {formData.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group border-2 border-gray-200 rounded-xl overflow-hidden bg-white"
                    >
                      {attachment.preview ? (
                        <img src={attachment.preview} alt={attachment.name} className="w-full h-24 object-cover" />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                          <FileText className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs text-gray-600 truncate font-medium">{attachment.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(attachment.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 px-6 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all text-lg ${
                  isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Submit Work Order</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Work Orders History */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3"></div>
              <p className="text-gray-500">Loading your work orders...</p>
            </div>
          ) : workOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No work orders yet</p>
              <p className="text-gray-400 text-sm mt-1">Submit your first work order to get started</p>
              <button
                onClick={() => setActiveView('create')}
                className="mt-4 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Create Work Order
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="p-5 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(wo)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(wo.status)}`}>
                          {wo.status?.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-gray-400 font-mono">{wo.work_order_id}</span>
                      </div>
                      <div className="mt-2">
                        <p className="font-semibold text-gray-900">{wo.category_name}</p>
                        <p className="text-sm text-gray-500">{wo.subcategory_name}</p>
                      </div>
                      {wo.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{wo.description}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-500">
                        {new Date(wo.created_at).toLocaleDateString()}
                      </p>
                      <button className="mt-2 p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Work Order Details</h2>
                <p className="text-sm text-gray-500 font-mono">{selectedOrder.work_order_id}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex justify-center">
                <span className={`px-4 py-2 text-sm font-semibold rounded-full border ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status?.replace('_', ' ')}
                </span>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Category</p>
                <p className="font-semibold text-gray-900">{selectedOrder.category_name}</p>
                <p className="text-gray-600">{selectedOrder.subcategory_name}</p>
              </div>

              {selectedOrder.description && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="p-3 bg-gray-50 rounded-lg text-gray-700">{selectedOrder.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-xs text-indigo-600 uppercase tracking-wider">Permission to Enter</p>
                  <p className="font-semibold text-indigo-900 mt-1">{selectedOrder.permission_to_enter}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-600 uppercase tracking-wider">Has Pet</p>
                  <p className="font-semibold text-amber-900 mt-1">{selectedOrder.has_pet}</p>
                </div>
              </div>

              {selectedOrder.entry_notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Entry Notes</p>
                  <p className="p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">{selectedOrder.entry_notes}</p>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Submitted: {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(showCategoryDropdown || showSubcategoryDropdown) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setShowCategoryDropdown(false);
            setShowSubcategoryDropdown(false);
          }}
        />
      )}
    </div>
  );
};

export default CustomerWorkOrder;
