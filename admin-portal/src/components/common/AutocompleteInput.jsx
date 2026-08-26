import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

/**
 * AutocompleteInput - A reusable typeahead/autocomplete component
 * 
 * Props:
 * - value: Current input value
 * - onChange: Callback when value changes
 * - options: Array of strings or objects with 'label' and 'value' keys
 * - placeholder: Input placeholder text
 * - label: Label text (optional)
 * - required: Whether field is required
 * - disabled: Whether input is disabled
 * - allowCustom: Allow custom values not in the list (default: true)
 * - className: Additional CSS classes for container
 * - inputClassName: Additional CSS classes for input
 * - error: Error message to display
 * - onSelect: Callback when an option is selected from dropdown
 * - filterFn: Custom filter function (optional)
 * - renderOption: Custom option renderer (optional)
 * - maxResults: Maximum number of results to show (default: 10)
 */
const AutocompleteInput = ({
  value = '',
  onChange,
  options = [],
  placeholder = 'Type to search...',
  label,
  required = false,
  disabled = false,
  allowCustom = true,
  className = '',
  inputClassName = '',
  error,
  onSelect,
  filterFn,
  renderOption,
  maxResults = 10,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  // Normalize options to { label, value } format
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Default filter function with fuzzy matching
  const defaultFilter = (option, query) => {
    if (!query) return true;
    const searchTerm = query.toLowerCase().trim();
    const optionLabel = option.label.toLowerCase();
    
    // Exact match at start
    if (optionLabel.startsWith(searchTerm)) return { match: true, score: 3 };
    
    // Contains match
    if (optionLabel.includes(searchTerm)) return { match: true, score: 2 };
    
    // Fuzzy match - check if all characters appear in order
    let searchIndex = 0;
    for (let i = 0; i < optionLabel.length && searchIndex < searchTerm.length; i++) {
      if (optionLabel[i] === searchTerm[searchIndex]) {
        searchIndex++;
      }
    }
    if (searchIndex === searchTerm.length) return { match: true, score: 1 };
    
    return { match: false, score: 0 };
  };

  // Filter and sort options
  const getFilteredOptions = () => {
    const filter = filterFn || defaultFilter;
    const results = normalizedOptions
      .map(opt => ({ ...opt, ...filter(opt, inputValue) }))
      .filter(opt => opt.match)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    return results;
  };

  const filteredOptions = getFilteredOptions();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
    if (allowCustom) {
      onChange?.(newValue);
    }
  };

  // Handle option selection
  const handleSelect = (option) => {
    setInputValue(option.label);
    onChange?.(option.value);
    onSelect?.(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && e.key === 'ArrowDown') {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (allowCustom && inputValue) {
          onChange?.(inputValue);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedEl = dropdownRef.current.children[highlightedIndex];
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Clear input
  const handleClear = () => {
    setInputValue('');
    onChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-16 border rounded-lg text-sm transition-colors
            ${error ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : 'border-gray-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
            ${inputClassName}`}
          autoComplete="off"
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`p-1 hover:bg-gray-100 rounded text-gray-400 ${disabled ? 'cursor-not-allowed' : ''}`}
            disabled={disabled}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option)}
              className={`px-3 py-2 cursor-pointer text-sm flex items-center justify-between
                ${index === highlightedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}
                ${option.value === value ? 'bg-blue-50' : ''}
              `}
            >
              {renderOption ? (
                renderOption(option)
              ) : (
                <span>{option.label}</span>
              )}
              {option.value === value && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && inputValue && filteredOptions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="px-3 py-2 text-sm text-gray-500">
            {allowCustom ? (
              <span>No matches found. Press Enter to use "<strong>{inputValue}</strong>"</span>
            ) : (
              <span>No matches found</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
