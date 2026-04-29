import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

const StateSelect = ({ 
  value = '', 
  onChange, 
  placeholder = 'Select or type state',
  className = '',
  required = false,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStates = INDIAN_STATES.filter(state =>
    state.toLowerCase().startsWith(searchTerm.toLowerCase())
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setIsOpen(true);
    
    // Check for exact match
    const exactMatch = INDIAN_STATES.find(
      s => s.toLowerCase() === val.toLowerCase()
    );
    if (exactMatch) {
      onChange(exactMatch);
    }
  };

  const handleSelect = (state) => {
    onChange(state);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          required={required}
          disabled={disabled}
        />
        <ChevronDown 
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>
      
      {isOpen && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredStates.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No states found</div>
          ) : (
            filteredStates.map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => handleSelect(state)}
                className={`w-full px-3 py-2 text-left hover:bg-indigo-50 text-sm ${
                  state === value ? 'bg-indigo-50 text-indigo-600 font-medium' : ''
                }`}
              >
                {state}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StateSelect;
export { INDIAN_STATES };
