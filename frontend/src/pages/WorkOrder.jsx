import { useState, useRef } from 'react';
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
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);

  // Get selected category
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
    setErrors(prev => ({ ...prev, categoryId: '' }));
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

  // Remove attachment
  const removeAttachment = (attachmentId) => {
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
    if (!formData.subcategoryId) {
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
      submitData.append('subcategoryId', formData.subcategoryId);
      submitData.append('description', formData.description);
      submitData.append('permissionToEnter', formData.permissionToEnter);
      submitData.append('entryNotes', formData.entryNotes);
      submitData.append('hasPet', formData.hasPet);
      // Add user property information
      if (user) {
        submitData.append('residentId', user.id);
        submitData.append('propertyId', user.propertyId);
        submitData.append('unitId', user.unitId);
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
            attachments: []
          });
          setSubmitSuccess(false);
        }, 3000);
      } else {
        setErrors({ submit: result.message || 'Failed to submit work order' });
      }
    } catch (error) {
      console.error('Error submitting work order:', error);
      setErrors({ submit: 'Failed to submit work order. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success message component
  if (submitSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-dark-800/80 rounded-2xl shadow-lg border border-gold-600/20 p-8 sm:p-12 text-center">
          <div className="w-20 h-20 bg-green-900/30 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Work Order Submitted!
          </h2>
          <p className="text-dark-300 mb-6">
            Your work order has been submitted successfully. Our team will review it and contact you shortly.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="py-3 px-6 rounded-lg font-semibold bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gold-400 hover:text-gold-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gold-600/20 border border-gold-500/30 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-gold-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">New Work Order</h1>
            <p className="text-dark-300">Submit a maintenance or repair request</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Category Selection */}
        <div className="bg-dark-800/80 rounded-xl shadow-lg border border-gold-600/20 p-5">
          <h3 className="text-lg font-semibold text-white mb-4">
            Service Category
          </h3>
          
          {/* Category Dropdown */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Category <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCategoryDropdown(!showCategoryDropdown);
                  setShowSubcategoryDropdown(false);
                }}
                className={`w-full px-4 py-3 bg-dark-700 border rounded-lg text-left flex items-center justify-between transition-all duration-200 ${
                  errors.categoryId 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-dark-600 focus:ring-gold-500 focus:border-gold-500'
                } ${showCategoryDropdown ? 'ring-2 ring-gold-500' : ''}`}
              >
                <span className={selectedCategory ? 'text-white' : 'text-dark-400'}>
                  {selectedCategory?.name || 'Select a category'}
                </span>
                <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showCategoryDropdown && (
                <div className="absolute z-20 w-full mt-2 bg-dark-700 border border-dark-600 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-dark-600 flex items-center justify-between transition-colors text-white ${
                        formData.categoryId === category.id.toString() ? 'bg-gold-600/20 text-gold-400' : ''
                      }`}
                    >
                      <span>{category.name}</span>
                      {formData.categoryId === category.id.toString() && (
                        <Check className="w-5 h-5 text-gold-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.categoryId && (
              <p className="mt-2 text-sm text-red-400 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.categoryId}
              </p>
            )}
          </div>

          {/* Subcategory Dropdown */}
          <div>
            <label className="block text-sm font-medium text-dark-200 mb-2">
              Subcategory <span className="text-red-400">*</span>
            </label>
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
                className={`w-full px-4 py-3 bg-dark-700 border rounded-lg text-left flex items-center justify-between transition-all duration-200 ${
                  !formData.categoryId 
                    ? 'bg-dark-800 cursor-not-allowed' 
                    : errors.subcategoryId 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-dark-600 focus:ring-gold-500 focus:border-gold-500'
                } ${showSubcategoryDropdown ? 'ring-2 ring-gold-500' : ''}`}
              >
                <span className={formData.subcategoryId ? 'text-white' : 'text-dark-400'}>
                  {formData.subcategoryId 
                    ? subcategories.find(s => s.id === parseInt(formData.subcategoryId))?.name 
                    : formData.categoryId 
                      ? 'Select a subcategory' 
                      : 'Select a category first'}
                </span>
                <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform duration-200 ${showSubcategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showSubcategoryDropdown && subcategories.length > 0 && (
                <div className="absolute z-20 w-full mt-2 bg-dark-700 border border-dark-600 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                  {subcategories.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleSubcategorySelect(sub.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-dark-600 flex items-center justify-between transition-colors text-white ${
                        formData.subcategoryId === sub.id.toString() ? 'bg-gold-600/20 text-gold-400' : ''
                      }`}
                    >
                      <span>{sub.name}</span>
                      {formData.subcategoryId === sub.id.toString() && (
                        <Check className="w-5 h-5 text-gold-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.subcategoryId && (
              <p className="mt-2 text-sm text-red-400 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.subcategoryId}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="bg-dark-800/80 rounded-xl shadow-lg border border-gold-600/20 p-5">
          <label className="block text-sm font-medium text-dark-200 mb-2">
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
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all duration-200 resize-none"
          />
          <div className="flex justify-end mt-2">
            <span className={`text-sm ${formData.description.length >= 450 ? 'text-orange-400' : 'text-dark-400'}`}>
              {formData.description.length}/500 characters
            </span>
          </div>
        </div>

        {/* Permission to Enter */}
        <div className="bg-dark-800/80 rounded-xl shadow-lg border border-gold-600/20 p-5">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <DoorOpen className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">
                Permission to Enter <span className="text-red-400">*</span>
              </label>
              <p className="text-sm text-dark-400 mt-1">
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
                  ? 'border-green-500 bg-green-900/30 text-green-400'
                  : 'border-dark-600 hover:border-dark-500 text-dark-300'
              }`}
            >
              <Check className={`w-5 h-5 ${formData.permissionToEnter === 'yes' ? 'text-green-400' : 'text-dark-500'}`} />
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
                  ? 'border-red-500 bg-red-900/30 text-red-400'
                  : 'border-dark-600 hover:border-dark-500 text-dark-300'
              }`}
            >
              <X className={`w-5 h-5 ${formData.permissionToEnter === 'no' ? 'text-red-400' : 'text-dark-500'}`} />
              <span className="font-medium">No</span>
            </button>
          </div>
          {errors.permissionToEnter && (
            <p className="mt-2 text-sm text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.permissionToEnter}
            </p>
          )}
        </div>

        {/* Entry Notes */}
        <div className="bg-dark-800/80 rounded-xl shadow-lg border border-gold-600/20 p-5">
          <label className="block text-sm font-medium text-dark-200 mb-2">
            Entry Notes
          </label>
          <p className="text-sm text-dark-400 mb-3">
            Provide any specific instructions for the repair person before entering your premises (e.g., gate code, parking instructions, etc.)
          </p>
          <textarea
            value={formData.entryNotes}
            onChange={(e) => setFormData(prev => ({ ...prev, entryNotes: e.target.value }))}
            placeholder="Enter any special instructions here..."
            rows={3}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 outline-none transition-all duration-200 resize-none"
          />
        </div>

        {/* Pet Information */}
        <div className="bg-dark-800/80 rounded-xl shadow-lg border border-gold-600/20 p-5">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <PawPrint className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">
                Do you have a pet? <span className="text-red-400">*</span>
              </label>
              <p className="text-sm text-dark-400 mt-1">
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
                  ? 'border-gold-500 bg-gold-600/20 text-gold-400'
                  : 'border-dark-600 hover:border-dark-500 text-dark-300'
              }`}
            >
              <Check className={`w-5 h-5 ${formData.hasPet === 'yes' ? 'text-gold-400' : 'text-dark-500'}`} />
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
                  ? 'border-dark-400 bg-dark-700 text-dark-200'
                  : 'border-dark-600 hover:border-dark-500 text-dark-300'
              }`}
            >
              <X className={`w-5 h-5 ${formData.hasPet === 'no' ? 'text-dark-300' : 'text-dark-500'}`} />
              <span className="font-medium">No</span>
            </button>
          </div>
          
          {formData.hasPet === 'yes' && (
            <div className="mt-4 p-4 bg-amber-900/30 border border-amber-500/50 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300">
                  <strong>Important:</strong> Please secure your pet in a safe location during the work order service. This ensures the safety of both your pet and our service personnel.
                </p>
              </div>
            </div>
          )}
          
          {errors.hasPet && (
            <p className="mt-2 text-sm text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.hasPet}
            </p>
          )}
        </div>

        {/* File Attachments */}
        <div className="bg-dark-800/80 rounded-xl shadow-lg border border-gold-600/20 p-5">
          <div className="flex items-start space-x-3 mb-4">
            <div className="w-10 h-10 bg-gold-600/20 border border-gold-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Paperclip className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">
                Upload Attachments
              </label>
              <p className="text-sm text-dark-400 mt-1">
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
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-600 rounded-lg hover:border-gold-500 hover:bg-gold-600/10 transition-all duration-200"
            >
              <Image className="w-6 h-6 text-dark-400 mb-2" />
              <span className="text-xs text-dark-300">Camera Roll</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = 'image/*';
                fileInputRef.current.capture = 'environment';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-600 rounded-lg hover:border-gold-500 hover:bg-gold-600/10 transition-all duration-200"
            >
              <Camera className="w-6 h-6 text-dark-400 mb-2" />
              <span className="text-xs text-dark-300">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.accept = '.pdf,image/*';
                fileInputRef.current.capture = '';
                fileInputRef.current.click();
              }}
              className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-dark-600 rounded-lg hover:border-gold-500 hover:bg-gold-600/10 transition-all duration-200"
            >
              <FileText className="w-6 h-6 text-dark-400 mb-2" />
              <span className="text-xs text-dark-300">PDF File</span>
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
              <p className="text-sm font-medium text-dark-200">
                Uploaded Files ({formData.attachments.length}/5)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="relative group border border-dark-600 rounded-lg overflow-hidden"
                  >
                    {attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt={attachment.name}
                        className="w-full h-24 object-cover"
                      />
                    ) : (
                      <div className="w-full h-24 bg-dark-700 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-dark-500" />
                      </div>
                    )}
                    <div className="p-2 bg-dark-700">
                      <p className="text-xs text-dark-200 truncate">{attachment.name}</p>
                      <p className="text-xs text-dark-400">{formatFileSize(attachment.size)}</p>
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
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-sm text-red-400">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 px-6 rounded-xl font-semibold flex items-center justify-center space-x-2 transition-all duration-200 ${
            isSubmitting
              ? 'bg-dark-600 cursor-not-allowed text-dark-400'
              : 'bg-gradient-to-r from-gold-600 to-gold-700 hover:from-gold-500 hover:to-gold-600 text-dark-900 shadow-lg hover:shadow-xl'
          }`}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
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
