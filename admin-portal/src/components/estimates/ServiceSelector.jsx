import { useState } from 'react';
import { Plus } from 'lucide-react';
import { getServices, addService } from '../../utils/estimateStore';

const ServiceSelector = ({ value, onChange, services, onServicesUpdate }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [customValue, setCustomValue] = useState(value || '');

  const handleSelect = (service) => {
    onChange(service);
    setCustomValue(service);
    setShowDropdown(false);
  };

  const handleCustomInput = (e) => {
    setCustomValue(e.target.value);
    onChange(e.target.value);
  };

  const handleAddNew = () => {
    if (customValue.trim() && !services.includes(customValue.trim())) {
      addService(customValue.trim());
      if (onServicesUpdate) {
        onServicesUpdate(getServices());
      }
    }
    setShowDropdown(false);
  };

  const filteredServices = services.filter(s => 
    s.toLowerCase().includes(customValue.toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={customValue}
        onChange={handleCustomInput}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
        placeholder="Select or type service"
      />
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredServices.map((service, idx) => (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(service)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50"
            >
              {service}
            </button>
          ))}
          {customValue.trim() && !services.includes(customValue.trim()) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddNew}
              className="w-full px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 border-t"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add "{customValue}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiceSelector;
