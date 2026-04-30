import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
];

const PhoneInput = ({ 
  value = '', 
  countryCode = '+91', 
  onChange, 
  onCountryCodeChange,
  placeholder = 'Enter 10-digit phone number',
  className = '',
  required = false,
  disabled = false
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(input);
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <div className={`flex h-full ${className}`}>
      <div className="relative h-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setShowDropdown(!showDropdown)}
          className={`flex items-center gap-1 h-full px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-sm hover:bg-gray-100 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          disabled={disabled}
        >
          <span>{selectedCountry.flag}</span>
          <span>{selectedCountry.code}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>
        {showDropdown && (
          <div className="absolute z-20 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {COUNTRY_CODES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onCountryCodeChange?.(country.code);
                  setShowDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center gap-2 text-sm ${
                  country.code === countryCode ? 'bg-indigo-50 text-indigo-600' : ''
                }`}
              >
                <span>{country.flag}</span>
                <span>{country.code}</span>
                <span className="text-gray-500">{country.country}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        type="tel"
        value={value}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        maxLength={10}
        className={`flex-1 px-3 py-2 border border-gray-300 rounded-r-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        required={required}
        disabled={disabled}
      />
    </div>
  );
};

export default PhoneInput;
export { COUNTRY_CODES };
