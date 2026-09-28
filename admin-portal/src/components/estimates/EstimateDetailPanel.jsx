import { formatCurrency, getEstimateAddons, getPropertyTypeLabel, estimateInternalCosts } from '../../utils/estimatePackageUtils';
import EstimateServicesTable from './EstimateServicesTable';
import EstimateInternalSummary from './EstimateInternalSummary';
import { EstimateTermsSection } from './EstimateTerms';

/**
 * Everything a saved estimate holds, shown inside the row it belongs to. Clicking an Estimate ID in
 * the Admin, Ops Manager, FP or Manager list expands this instead of opening a modal: the property
 * it was written for, the customer, the package, every service with the figures it was priced from,
 * and what it costs XLAND.
 *
 * It is read-only. The figures come from the snapshot saved with each service, so the panel reports
 * what the estimate was costed at; re-pricing belongs to the edit flow.
 *
 * `internal` gates the cost columns and the Internal Cost & Profit Summary. Only these four portals
 * pass it, which is why Coordinator, Supervisor and Executive keep their customer-safe tables.
 */
const Field = ({ label, children, wide = false }) => (
  <div className={wide ? 'col-span-2' : undefined}>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="font-medium text-sm text-gray-800">{children || '-'}</p>
  </div>
);
const Section = ({ title, children }) => (
  <div className="border-t border-gray-100 pt-4">
    <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>
    {children}
  </div>
);
const parseList = value => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : parsed?.serviceRows || parsed?.services || [];
  } catch { return []; }
};
const parseMap = value => {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
};
// Each block with the units in it. The names and the counts are stored separately, keyed by block
// number, so a block named on one side and counted on the other still lists once.
const blockEntries = (estimate) => {
  const names = parseMap(estimate.block_names ?? estimate.blockNames);
  const units = parseMap(estimate.units_per_block ?? estimate.unitsPerBlock);
  const keys = [...new Set([...Object.keys(names), ...Object.keys(units)])];
  return keys.map(key => [names[key] || `Block ${key}`, units[key] ?? 0]);
};

export default function EstimateDetailPanel({ estimate, decode = value => value ?? '', internal = true }) {
  if (!estimate) return null;
  const services = getEstimateAddons(estimate);
  const costs = internal ? estimateInternalCosts(estimate, services) : null;
  const packageName = estimate.package_name || estimate.packageName;
  const packageServices = parseList(estimate.package_services ?? estimate.packageServices);
  const blocks = blockEntries(estimate);
  const propertyType = estimate.property_type || estimate.propertyType;
  const unitNumber = estimate.villa_plot_number || estimate.villaPlotNumber;
  const unitLabel = ['FLAT', 'Flat', 'flat'].includes(propertyType) ? 'Flat Number'
    : ['PLOT', 'Plot', 'plot'].includes(propertyType) ? 'Plot Number' : 'Villa Number';
  const money = value => formatCurrency(value || 0);

  return (
    <div className="space-y-4 bg-slate-50/60 px-4 py-4 sm:px-6">
      <Section title="Property Details">
        <div className="bg-white p-4 rounded-lg border border-gray-100 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(estimate.property_code || estimate.propertyCode) && <Field label="Property ID">{estimate.property_code || estimate.propertyCode}</Field>}
          <Field label="Property Name">{decode(estimate.property_name || estimate.propertyName || estimate.communityName)}</Field>
          <Field label="Property Type">{getPropertyTypeLabel(propertyType)}</Field>
          <Field label="Zone">{estimate.zone}</Field>
          <Field label="City">{estimate.city}</Field>
          {estimate.division && <Field label="Division">{estimate.division}</Field>}
          {(estimate.tower_name || estimate.towerName) && <Field label="Tower/Building Name">{decode(estimate.tower_name || estimate.towerName)}</Field>}
          {(estimate.block_number || estimate.blockNumber) && <Field label="Block Number">{estimate.block_number || estimate.blockNumber}</Field>}
          {unitNumber && <Field label={unitLabel}>{unitNumber}</Field>}
          {(estimate.number_of_blocks || estimate.numberOfBlocks) && <Field label="Number of Blocks">{estimate.number_of_blocks || estimate.numberOfBlocks}</Field>}
          {(estimate.total_units || estimate.totalUnits) && <Field label="Number of Units">{estimate.total_units || estimate.totalUnits}</Field>}
          <Field label="Address" wide>{decode(estimate.address || estimate.property_address || estimate.propertyAddress)}</Field>
        </div>
        {/* A gated community's blocks, with the units in each, as the property was entered */}
        {blocks.length > 0 && (
          <div className="mt-3 bg-white p-4 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Block Details</p>
            <div className="flex flex-wrap gap-2">
              {blocks.map(([name, units]) => (
                <span key={name} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-1.5 text-xs">
                  <span className="font-medium text-gray-800">{decode(name)}</span>
                  <span className="text-gray-500">{units} units</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* The customer is named in the row itself -- who they are and how to reach them -- so the
          panel does not repeat it and spends the space on the property and its services. */}

      {packageName && (
        <Section title="AMC Package">
          <div className="bg-white p-4 rounded-lg border border-gray-100">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-sm text-gray-800">{decode(packageName)}</p>
              <p className="text-sm font-semibold text-gray-800">{money(estimate.package_price || estimate.packagePrice || estimate.packageRate)}</p>
            </div>
            {packageServices.length > 0 && (
              <ul className="mt-3 space-y-1">
                {packageServices.map((service, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 text-xs text-gray-600">
                    <span>{decode(service.name || service.service)}</span>
                    <span className="text-gray-500">{service.frequencyType || service.frequency_type || 'Monthly'} · {service.frequencyCount ?? service.frequency_count ?? 0} visits</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      {services.length > 0 && (
        <Section title="Services">
          <EstimateServicesTable rows={services} decode={decode} internal={internal} />
        </Section>
      )}

      {internal && <EstimateInternalSummary costs={costs} />}

      <Section title="Price Summary">
        <div className="bg-white p-4 rounded-lg border border-gray-100 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Sub Total</span><span className="text-gray-800">{money(estimate.subtotal ?? estimate.subTotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Discount ({estimate.discount_percent || estimate.discountPercent || 0}%)</span><span className="text-red-500">-{money(estimate.discount_amount ?? estimate.discountAmount ?? estimate.discount)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">GST ({estimate.gst_percent || estimate.gstPercent || 0}%)</span><span className="text-gray-800">{money(estimate.gst_amount ?? estimate.gstAmount ?? estimate.tax)}</span></div>
          <div className="flex justify-between border-t border-gray-100 pt-2"><span className="font-semibold text-gray-800">Total</span><span className="font-bold text-gray-900">{money(estimate.total_amount ?? estimate.totalAmount ?? estimate.total ?? estimate.totalPrice)}</span></div>
        </div>
      </Section>

      {(estimate.description || estimate.notes) && (
        <Section title="Description / Notes">
          <p className="bg-white p-4 rounded-lg border border-gray-100 text-sm text-gray-700 whitespace-pre-line">{decode(estimate.description || estimate.notes)}</p>
        </Section>
      )}

      <EstimateTermsSection estimate={estimate} className="border-t border-gray-100 pt-4" />
    </div>
  );
}
