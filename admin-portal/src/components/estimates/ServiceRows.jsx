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
    <div className="space-y-4">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-100 rounded-lg">
        <div className="col-span-5">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Service Name</span>
        </div>
        <div className="col-span-3">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency</span>
        </div>
        <div className="col-span-3">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate (₹)</span>
        </div>
        <div className="col-span-1">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</span>
        </div>
      </div>

      {/* Service Rows */}
      {serviceList.map((service, index) => (
        <div key={index} className="grid grid-cols-12 gap-4 items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors">
          {/* Service Name */}
          <div className="col-span-5">
            <ServiceSelector
              value={service.name}
              onChange={(val) => onUpdate(index, 'name', val)}
              services={availableServices}
              onServicesUpdate={onServicesUpdate}
            />
          </div>
          
          {/* Frequency */}
          <div className="col-span-3">
            <select
              value={service.frequencyType || 'Monthly'}
              onChange={(e) => onUpdate(index, 'frequencyType', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 bg-white"
            >
              {FREQUENCY_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          {/* Price */}
          <div className="col-span-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
              <input
                type="number"
                min="0"
                value={service.price}
                onChange={(e) => onUpdate(index, 'price', e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                placeholder="0"
              />
            </div>
          </div>
          
          {/* Delete Button */}
          <div className="col-span-1 flex justify-center">
            <button
              type="button"
              onClick={() => onRemove(index)}
              className={`p-2 rounded-lg transition-colors ${
                serviceList.length === 1 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'text-red-500 hover:bg-red-50 hover:text-red-600'
              }`}
              disabled={serviceList.length === 1}
              title={serviceList.length === 1 ? 'Cannot remove last service' : 'Remove service'}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}

      {/* Add Service Button */}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 text-indigo-600 font-medium border-2 border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 transition-colors w-full justify-center"
      >
        <Plus className="w-5 h-5" />
        Add Another Service
      </button>
    </div>
  );
};

export default ServiceRows;
