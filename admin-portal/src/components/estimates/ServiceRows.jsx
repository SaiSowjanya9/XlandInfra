import { Plus, Trash2 } from 'lucide-react';
import ServiceSelector from './ServiceSelector';
import { FREQUENCY_TYPES } from '../../utils/estimateStore';

const ServiceRows = ({ 
  services: serviceList, 
  onUpdate, 
  onAdd, 
  onRemove, 
  availableServices, 
  onServicesUpdate 
}) => {
  return (
    <div className="space-y-3">
      {serviceList.map((service, index) => (
        <div key={index} className="flex gap-3 items-start p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Service Name</label>
            <ServiceSelector
              value={service.name}
              onChange={(val) => onUpdate(index, 'name', val)}
              services={availableServices}
              onServicesUpdate={onServicesUpdate}
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
            <input
              type="number"
              min="1"
              value={service.frequency}
              onChange={(e) => onUpdate(index, 'frequency', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={service.frequencyType}
              onChange={(e) => onUpdate(index, 'frequencyType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200"
            >
              {FREQUENCY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-gray-500 mb-1">Price (₹)</label>
            <input
              type="number"
              min="0"
              value={service.price}
              onChange={(e) => onUpdate(index, 'price', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200"
              placeholder="0"
            />
          </div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg"
            disabled={serviceList.length === 1}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
      >
        <Plus className="w-4 h-4" />
        Add Service
      </button>
    </div>
  );
};

export default ServiceRows;
