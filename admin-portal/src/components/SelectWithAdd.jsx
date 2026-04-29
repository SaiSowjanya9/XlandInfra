import { useState } from 'react';
import { Plus, X, Check, ChevronDown } from 'lucide-react';

/**
 * Select dropdown with ability to add new options
 * Used for Categories, Sub-categories, Divisions, Service Types
 */
const SelectWithAdd = ({
  label,
  value,
  onChange,
  options = [],
  onAddOption,
  placeholder = 'Select an option',
  required = false,
  disabled = false,
  error = '',
  className = '',
  allowAdd = true,
  addPlaceholder = 'Enter new option'
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [addError, setAddError] = useState('');

  const handleAddOption = () => {
    if (!newOption.trim()) {
      setAddError('Please enter a value');
      return;
    }

    if (options.includes(newOption.trim())) {
      setAddError('This option already exists');
      return;
    }

    if (onAddOption) {
      const result = onAddOption(newOption.trim());
      if (result?.success === false) {
        setAddError(result.message || 'Failed to add option');
        return;
      }
    }

    // Auto-select the new option
    onChange(newOption.trim());
    setNewOption('');
    setAddError('');
    setShowAddModal(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
    if (e.key === 'Escape') {
      setShowAddModal(false);
      setNewOption('');
      setAddError('');
    }
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="flex gap-2">
        {/* Select Dropdown */}
        <div className="relative flex-1">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-3 py-2.5 pr-10 bg-white border rounded-lg text-sm appearance-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all ${
              error ? 'border-red-300 bg-red-50' : 'border-gray-300'
            } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Add Button */}
        {allowAdd && !disabled && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
            title={`Add new ${label?.toLowerCase() || 'option'}`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {/* Add Option Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setNewOption('');
            setAddError('');
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Add New {label || 'Option'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  This will be available for future selections
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setNewOption('');
                  setAddError('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {label || 'Option'} Name
                </label>
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => {
                    setNewOption(e.target.value);
                    setAddError('');
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={addPlaceholder}
                  autoFocus
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 outline-none transition-all ${
                    addError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {addError && (
                  <p className="mt-2 text-sm text-red-500">{addError}</p>
                )}
              </div>

              {/* Current Options Preview */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Current options ({options.length}):</p>
                <div className="max-h-32 overflow-y-auto bg-gray-50 rounded-lg p-2">
                  <div className="flex flex-wrap gap-1">
                    {options.slice(0, 10).map((opt) => (
                      <span 
                        key={opt}
                        className="inline-flex items-center px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600"
                      >
                        {opt}
                      </span>
                    ))}
                    {options.length > 10 && (
                      <span className="inline-flex items-center px-2 py-1 text-xs text-gray-400">
                        +{options.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setNewOption('');
                  setAddError('');
                }}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddOption}
                disabled={!newOption.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                <Check className="w-4 h-4" />
                Add {label || 'Option'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectWithAdd;
