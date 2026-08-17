// Simplified PhoneInput - India only (+91)
const PhoneInput = ({ 
  value = '', 
  onChange, 
  placeholder = 'Enter 10-digit phone number',
  className = '',
  required = false,
  disabled = false
}) => {
  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(input);
  };

  return (
    <div className={`flex h-full ${className}`}>
      <div className="flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-sm">
        <span>+91</span>
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
