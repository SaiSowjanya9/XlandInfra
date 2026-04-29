import SelectWithAdd from '../SelectWithAdd';
import { getServices, addService } from '../../utils/estimateStore';

const ServiceSelector = ({ value, onChange, services, onServicesUpdate }) => {
  const handleAddService = (serviceName) => {
    const result = addService(serviceName);
    if (result.success) {
      if (onServicesUpdate) {
        onServicesUpdate(getServices());
      }
      onChange(serviceName);
    }
    return result;
  };

  return (
    <SelectWithAdd
      label=""
      value={value}
      onChange={onChange}
      options={services}
      onAddOption={handleAddService}
      placeholder="Select or type service"
      required={false}
      addPlaceholder="Enter new service name"
    />
  );
};

export default ServiceSelector;
