import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Paperclip,
  Camera,
  Image,
  FileText,
  X,
  Check,
  AlertCircle,
  PawPrint,
  DoorOpen,
  ClipboardList,
  Send,
  ArrowLeft
} from 'lucide-react';
import { categories } from '../data/categories';

const WorkOrder = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const categoryBtnRef = useRef(null);
  const subcategoryBtnRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    categoryId: '',
    subcategoryId: '',
    customSubcategory: '',
    description: '',
    permissionToEnter: '',
    entryNotes: '',
    hasPet: '',
    priority: 'medium',
    attachments: []
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [toast, setToast] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Get selected category
  const selectedCategory = categories.find(c => c.id === parseInt(formData.categoryId));
  const subcategories = selectedCategory?.subcategories || [];

  // Calculate dropdown position
  const updateDropdownPosition = (ref) => {
    if (ref?.current) {
      const rect = ref.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  // Toggle category dropdown
  const toggleCategoryDropdown = () => {
    if (!showCategoryDropdown) {
      updateDropdownPosition(categoryBtnRef);
    }
    setShowCategoryDropdown(!showCategoryDropdown);
    setShowSubcategoryDropdown(false);
  };

  // Toggle subcategory dropdown
  const toggleSubcategoryDropdown = () => {
    if (formData.categoryId) {
      if (!showSubcategoryDropdown) {
        updateDropdownPosition(subcategoryBtnRef);
      }
      setShowSubcategoryDropdown(!showSubcategoryDropdown);
      setShowCategoryDropdown(false);
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      categoryId: categoryId.toString(),
      subcategoryId: '',
      customSubcategory: ''
    }));
    setShowCategoryDropdown(false);
    setErrors(prev => ({ ...prev, categoryId: '', subcategoryId: '', customSubcategory: '' }));
  };

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategoryId) => {
    setFormData(prev => ({
      ...prev,
      subcategoryId: subcategoryId.toString()
    }));
    setShowSubcategoryDropdown(false);
    setErrors(prev => ({ ...prev, subcategoryId: '' }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showCategoryDropdown || showSubcategoryDropdown) {
        const target = e.target;
        // Don't close if clicking inside dropdown or on trigger
        if (!target.closest('.portal-dropdown') && 
            !target.closest('[data-dropdown-trigger]')) {
          setShowCategoryDropdown(false);
          setShowSubcategoryDropdown(false);
        }
      }
    };
    // Use click event instead of mousedown/touchstart to avoid interfering with scroll
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCategoryDropdown, showSubcategoryDropdown]);

  // Handle file upload
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map(file => ({
        file,
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }));

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments].slice(0, 5)
      }));
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      formData.attachments.forEach(attachment => {
        if (attachment.preview) {
          URL.revokeObjectURL(attachment.preview);
        }
      });
    };
  }, []);

  // Remove attachment and cleanup blob URL
  const removeAttachment = (attachmentId) => {
    const attachment = formData.attachments.find(a => a.id === attachmentId);
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter(a => a.id !== attachmentId)
    }));
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.categoryId) {
      newErrors.categoryId = 'Please select a category';
    }
    // Check if "Other" category is selected (isCustom flag)
    const isOtherCategory = selectedCategory?.isCustom || selectedCategory?.name === 'Other';
    if (isOtherCategory) {
      if (!formData.customSubcategory?.trim()) {
        newErrors.customSubcategory = 'Please enter a subcategory';
      }
    } else if (!formData.subcategoryId) {
      newErrors.subcategoryId = 'Please select a subcategory';
    }
    if (!formData.permissionToEnter) {
      newErrors.permissionToEnter = 'Please select an option';
    }
    if (!formData.hasPet) {
      newErrors.hasPet = 'Please select an option';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('categoryId', formData.categoryId);
      // Add category name from the selected category
      submitData.append('categoryName', selectedCategory?.name || '');
      // For "Other" category, send custom subcategory text
      const isOtherCategory = selectedCategory?.isCustom || selectedCategory?.name === 'Other';
      if (isOtherCategory && formData.customSubcategory) {
        submitData.append('customSubcategory', formData.customSubcategory);
        submitData.append('subcategoryId', ''); // No predefined subcategory
        submitData.append('subcategoryName', formData.customSubcategory);
      } else {
        submitData.append('subcategoryId', formData.subcategoryId);
        // Add subcategory name
        const selectedSubcat = subcategories.find(s => s.id === parseInt(formData.subcategoryId));
        submitData.append('subcategoryName', selectedSubcat?.name || '');
      }
      submitData.append('description', formData.description);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('entryNotes', formData.entryNotes);
      submitData.append('hasPet', formData.hasPet);
      submitData.append('priority', formData.priority);
      // Add user and property information
      if (user) {
        submitData.append('residentId', user.id || '');
        submitData.append('propertyId', user.propertyId || '');
        submitData.append('unitId', user.unitId || '');
        submitData.append('customerName', `${user.firstName || ''} ${user.lastName || ''}`.trim());
        submitData.append('customerEmail', user.email || '');
        submitData.append('customerPhone', user.phone || '');
        submitData.append('propertyName', user.propertyName || '');
        submitData.append('propertyCode', user.propertyCode || '');
        submitData.append('block', user.block || '');
        submitData.append('flatNumber', user.unitNumber || user.flatNumber || '');
      }
      
      formData.attachments.forEach(attachment => {
        submitData.append('attachments', attachment.file);
      });

      const response = await fetch('/api/work-orders', {
        method: 'POST',
        body: submitData
      });

      const result = await response.json();

      if (result.success) {
        // Show toast notification for 5 seconds
        setToast({ message: 'Work order submitted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 5000);
        
        setSubmitSuccess(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setFormData({
            categoryId: '',
            subcategoryId: '',
            description: '',
            permissionToEnter: '',
            entryNotes: '',
            hasPet: '',
            priority: 'medium',
            attachments: []
          });
          setSubmitSuccess(false);
        }, 3000);
      } else {
        const errorMsg = result.message || result.error || 'Failed to submit work order';
        setToast({ message: errorMsg, type: 'error' });
        setTimeout(() => setToast(null), 8000);
        setErrors({ submit: errorMsg });
      }
    } catch (error) {
      console.error('Error submitting work order:', error);
      setToast({ message: 'Network error. Please check your connection and try again.', type: 'error' });
      setTimeout(() => setToast(null), 8000);
      setErrors({ submit: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success message component
  if (submitSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-warm-border rounded-2xl shadow-lg border border-warm-accent-hover/20 p-8 sm:p-12 text-center">
          <div className="w-20 h-20 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-warm-text mb-3">
            Work Order Submitted!
          </h2>
          <p className="text-warm-muted mb-6">
            Your work order has been submitted successfully. Our team will review it and contact you shortly.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="py-3 px-6 rounded-lg font-semibold bg-gradient-to-r from-warm-accent-hover to-warm-accent-hover hover:from-warm-accent hover:to-warm-accent-hover text-warm-text transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-slide-in ${
          toast.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-100' 
            : 'bg-red-50 border-red-200 text-red-100'
        }`}>
          {toast.type === 'success' ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button 
            onClick={() => setToast(null)} 
            className="ml-2 p-1 hover:bg-warm-accent-soft rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-warm-accent-hover hover:text-warm-accent mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-warm-accent-hover/20 border border-warm-accent/30 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-warm-accent-hover" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-warm-text">New Work Order</h1>
            <p className="text-warm-muted">Submit a maintenance or repair request</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection */}
        <div className={`bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5 overflow-visible relative ${(showCategoryDropdown || showSubcategoryDropdown) ? 'z-50' : 'z-0'}`}>
          <h3 className="text-lg font-semibold text-warm-text mb-4">
            Service Category
          </h3>
          
          {/* Category Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-warm-text mb-2">
              Category <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <button
                ref={categoryBtnRef}
                type="button"
                data-dropdown-trigger
                onClick={toggleCategoryDropdown}
                className={`w-full px-4 py-3 bg-warm-accent-soft border rounded-lg text-left flex items-center justify-between transition-all duration-200 ${
                  errors.categoryId 
                    ? 'border-red-300 focus:ring-red-300' 
                    : 'border-warm-border focus:ring-warm-accent focus:border-warm-accent'
                } ${showCategoryDropdown ? 'ring-2 ring-warm-accent' : ''}`}
              >
                <span className={selectedCategory ? 'text-warm-text' : 'text-warm-muted'}>
                  {selectedCategory?.name || 'Select a category'}
                </span>
                <ChevronDown className={`w-5 h-5 text-warm-muted transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showCategoryDropdown && createPortal(
                <div 
                  className="portal-dropdown fixed bg-warm-section border-2 border-warm-accent/50 rounded-xl shadow-2xl overflow-y-scroll"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                    width: dropdownPosition.width,
                    maxHeight: 'min(50vh, 300px)',
                    zIndex: 9999
                  }}
                >
                  {categories.map((category, index) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full px-4 py-3.5 text-left hover:bg-warm-accent-hover/20 flex items-center justify-between transition-colors text-sm sm:text-base active:bg-warm-accent-hover/30 ${
                        formData.categoryId === category.id.toString() 
                          ? 'bg-warm-accent-hover/20 text-warm-accent-hover' 
                          : 'text-warm-text'
                      } ${index !== categories.length - 1 ? 'border-b border-warm-border' : ''}`}
                    >
                      <span>{category.name}</span>
                      {formData.categoryId === category.id.toString() && (
                        <Check className="w-5 h-5 text-warm-accent-hover" />
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
            {errors.categoryId && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.categoryId}
              </p>
            )}
          </div>

          {/* Subcategory - Dropdown or Text Input based on category */}
          <div>
            <label className="block text-sm font-medium text-warm-text mb-2">
              Subcategory <span className="text-red-600">*</span>
            </label>
            {/* Show text input for "Other" category, dropdown for rest */}
            {selectedCategory?.isCustom || selectedCategory?.name === 'Other' ? (
              <div>
                <input
                  type="text"
                  value={formData.customSubcategory}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, customSubcategory: e.target.value }));
                    setErrors(prev => ({ ...prev, customSubcategory: '' }));
                  }}
                  placeholder="Enter subcategory / issue type"
                  className={`w-full px-4 py-3 bg-warm-accent-soft border rounded-lg text-warm-text placeholder-warm-muted transition-all duration-200 ${
                    errors.customSubcategory 
                      ? 'border-red-300 focus:ring-red-300' 
                      : 'border-warm-border focus:ring-warm-accent focus:border-warm-accent'
                  }`}
                />
                {errors.customSubcategory && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.customSubcategory}
                  </p>
                )}
              </div>
            ) : (
              <div className="relative">
                <button
                  ref={subcategoryBtnRef}
                  type="button"
                  data-dropdown-trigger
                  onClick={toggleSubcategoryDropdown}
                  disabled={!formData.categoryId}
                  className={`w-full px-4 py-3 bg-warm-accent-soft border rounded-lg text-left flex items-center justify-between transition-all duration-200 ${
                    !formData.categoryId 
                      ? 'bg-warm-section cursor-not-allowed' 
                      : errors.subcategoryId 
                        ? 'border-red-300 focus:ring-red-300' 
                        : 'border-warm-border focus:ring-warm-accent focus:border-warm-accent'
                  } ${showSubcategoryDropdown ? 'ring-2 ring-warm-accent' : ''}`}
                >
                  <span className={formData.subcategoryId ? 'text-warm-text' : 'text-warm-muted'}>
                    {formData.subcategoryId 
                      ? subcategories.find(s => s.id === parseInt(formData.subcategoryId))?.name 
                      : formData.categoryId 
                        ? 'Select a subcategory' 
                        : 'Select a category first'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-warm-muted transition-transform duration-200 ${showSubcategoryDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showSubcategoryDropdown && createPortal(
                  <div 
                    className="portal-dropdown fixed bg-warm-section border-2 border-warm-accent/50 rounded-xl shadow-2xl overflow-y-scroll"
                    style={{
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      maxHeight: 'min(50vh, 300px)',
                      zIndex: 9999
                    }}
                  >
                    {subcategories.length > 0 ? (
                      subcategories.map((sub, index) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSubcategorySelect(sub.id)}
                          className={`w-full px-4 py-3.5 text-left hover:bg-warm-accent-hover/20 flex items-center justify-between transition-colors text-sm sm:text-base active:bg-warm-accent-hover/30 ${
                            formData.subcategoryId === sub.id.toString() 
                              ? 'bg-warm-accent-hover/20 text-warm-accent-hover' 
                              : 'text-warm-text'
                          } ${index !== subcategories.length - 1 ? 'border-b border-warm-border' : ''}`}
                        >
                          <span>{sub.name}</span>
                          {formData.subcategoryId === sub.id.toString() && (
                            <Check className="w-5 h-5 text-warm-accent-hover" />
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3.5 text-warm-muted text-sm text-center">
                        No subcategories available
                      </div>
                    )}
                  </div>,
                  document.body
                )}
                {errors.subcategoryId && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.subcategoryId}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5">
          <label className="block text-sm font-medium text-warm-text mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                setFormData(prev => ({ ...prev, description: e.target.value }));
              }
            }}
            placeholder="Please describe the issue or request in detail..."
            rows={4}
            className="w-full px-4 py-3 bg-warm-accent-soft border border-warm-border rounded-lg text-warm-text placeholder-warm-muted focus:ring-2 focus:ring-warm-accent/50 focus:border-warm-accent outline-none transition-all duration-200 resize-none"
          />
          <div className="flex justify-end mt-2">
            <span className={`text-sm ${formData.description.length >= 450 ? 'text-orange-600' : 'text-warm-muted'}`}>
              {formData.description.length}/500 characters
            </span>
          </div>
        </div>

        {/* Permission to Enter */}
        <div className="bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-warm-accent-hover/20 border border-warm-accent/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <DoorOpen className="w-5 h-5 text-warm-accent-hover" />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-text">
                Permission to Enter <span className="text-red-600">*</span>
              </label>
              <p className="text-sm text-warm-muted mt-1">
                Allow the repair person to enter your premises if you are not available to respond at the door.
              </p>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, permissionToEnter: 'yes' }));
                setErrors(prev => ({ ...prev, permissionToEnter: '' }));
              }}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
                formData.permissionToEnter === 'yes'
                  ? 'border-green-300 bg-green-50 text-green-600'
                  : 'border-warm-border hover:border-warm-border text-warm-muted'
              }`}
            >
              <Check className={`w-5 h-5 ${formData.permissionToEnter === 'yes' ? 'text-green-600' : 'text-warm-muted'}`} />
              <span className="font-medium">Yes</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, permissionToEnter: 'no' }));
                setErrors(prev => ({ ...prev, permissionToEnter: '' }));
              }}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
                formData.permissionToEnter === 'no'
                  ? 'border-red-300 bg-red-50 text-red-600'
                  : 'border-warm-border hover:border-warm-border text-warm-muted'
              }`}
            >
              <X className={`w-5 h-5 ${formData.permissionToEnter === 'no' ? 'text-red-600' : 'text-warm-muted'}`} />
              <span className="font-medium">No</span>
            </button>
          </div>
          {errors.permissionToEnter && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.permissionToEnter}
            </p>
          )}
        </div>

        {/* Entry Notes */}
        <div className="bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5">
          <label className="block text-sm font-medium text-warm-text mb-2">
            Entry Notes
          </label>
          <p className="text-sm text-warm-muted mb-3">
            Provide any specific instructions for the repair person before entering your premises (e.g., gate code, parking instructions, etc.)
          </p>
          <textarea
            value={formData.entryNotes}
            onChange={(e) => setFormData(prev => ({ ...prev, entryNotes: e.target.value }))}
            placeholder="Enter any special instructions here..."
            rows={3}
            className="w-full px-4 py-3 bg-warm-accent-soft border border-warm-border rounded-lg text-warm-text placeholder-warm-muted focus:ring-2 focus:ring-warm-accent/50 focus:border-warm-accent outline-none transition-all duration-200 resize-none"
          />
        </div>

        {/* Pet Information */}
        <div className="bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-warm-accent-hover/20 border border-warm-accent/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <PawPrint className="w-5 h-5 text-warm-accent-hover" />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-text">
                Do you have a pet? <span className="text-red-600">*</span>
              </label>
              <p className="text-sm text-warm-muted mt-1">
                Let us know if there are pets in your home.
              </p>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, hasPet: 'yes' }));
                setErrors(prev => ({ ...prev, hasPet: '' }));
              }}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
                formData.hasPet === 'yes'
                  ? 'border-warm-accent bg-warm-accent-hover/20 text-warm-accent-hover'
                  : 'border-warm-border hover:border-warm-border text-warm-muted'
              }`}
            >
              <Check className={`w-5 h-5 ${formData.hasPet === 'yes' ? 'text-warm-accent-hover' : 'text-warm-muted'}`} />
              <span className="font-medium">Yes</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData(prev => ({ ...prev, hasPet: 'no' }));
                setErrors(prev => ({ ...prev, hasPet: '' }));
              }}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all duration-200 flex items-center justify-center space-x-2 ${
                formData.hasPet === 'no'
                  ? 'border-warm-border bg-warm-accent-soft text-warm-text'
                  : 'border-warm-border hover:border-warm-border text-warm-muted'
              }`}
            >
              <X className={`w-5 h-5 ${formData.hasPet === 'no' ? 'text-warm-muted' : 'text-warm-muted'}`} />
              <span className="font-medium">No</span>
            </button>
          </div>
          
          {formData.hasPet === 'yes' && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-600">
                  <strong>Important:</strong> Please secure your pet in a safe location during the work order service. This ensures the safety of both your pet and our service personnel.
                </p>
              </div>
            </div>
          )}
          
          {errors.hasPet && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.hasPet}
            </p>
          )}
        </div>

        {/* Priority Selection */}
        <div className="bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5">
          <label className="block text-sm font-medium text-warm-text mb-4">
            Priority
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {['low', 'medium', 'high', 'urgent'].map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, priority }))}
                className={`py-3 px-4 rounded-lg border-2 transition-all capitalize font-medium text-sm ${
                  formData.priority === priority
                    ? priority === 'low' ? 'border-green-300 bg-green-50 text-green-600'
                      : priority === 'medium' ? 'border-yellow-300 bg-yellow-50 text-yellow-600'
                        : priority === 'high' ? 'border-orange-300 bg-orange-50 text-orange-600'
                          : 'border-red-300 bg-red-50 text-red-600'
                    : 'border-warm-border hover:border-warm-border text-warm-muted'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        {/* File Attachments */}
        <div className="bg-warm-border rounded-xl shadow-lg border border-warm-accent-hover/20 p-5">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-warm-accent-hover/20 border border-warm-accent/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Paperclip className="w-5 h-5 text-warm-accent-hover" />
            </div>
            <div>
              <label className="block text-sm font-medium text-warm-text">
                Upload Attachments
              </label>
              <p className="text-sm text-warm-muted mt-1">
                Add photos or documents to help describe the issue (max 5 files, 10MB each)
              </p>
            </div>
          </div>

          {/* Upload Options */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.capture = '';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-warm-border rounded-lg hover:border-warm-accent hover:bg-warm-accent-hover/10 transition-all duration-200"
            >
              <Image className="w-6 h-6 text-warm-muted mb-2" />
              <span className="text-xs text-warm-muted">Camera Roll</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.capture = 'environment';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-warm-border rounded-lg hover:border-warm-accent hover:bg-warm-accent-hover/10 transition-all duration-200"
            >
              <Camera className="w-6 h-6 text-warm-muted mb-2" />
              <span className="text-xs text-warm-muted">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = '.pdf,image/*';
                fileInputRef.current.capture = '';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-warm-border rounded-lg hover:border-warm-accent hover:bg-warm-accent-hover/10 transition-all duration-200"
            >
              <FileText className="w-6 h-6 text-warm-muted mb-2" />
              <span className="text-xs text-warm-muted">PDF File</span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />

          {/* Uploaded Files Preview */}
          {formData.attachments.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-warm-text">
                Uploaded Files ({formData.attachments.length}/5)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative group border border-warm-border rounded-lg overflow-hidden"
                  >
                    {attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt={attachment.name}
                        className="w-full h-24 object-cover"
                      />
                    ) : (
                      <div className="w-full h-24 bg-warm-accent-soft flex items-center justify-center">
                        <FileText className="w-8 h-8 text-warm-muted" />
                      </div>
                    )}
                    <div className="p-2 bg-warm-accent-soft">
                      <p className="text-xs text-warm-text truncate">{attachment.name}</p>
                      <p className="text-xs text-warm-muted">{formatFileSize(attachment.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 px-6 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all duration-200 ${
            isSubmitting
              ? 'bg-warm-border cursor-not-allowed text-warm-muted'
              : 'bg-gradient-to-r from-warm-accent-hover to-warm-accent-hover hover:from-warm-accent hover:to-warm-accent-hover text-warm-text shadow-lg hover:shadow-xl'
          }`}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-warm-text" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Submit Work Order</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default WorkOrder;
