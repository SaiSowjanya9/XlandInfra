import { Fragment } from 'react';
import { formatCurrency, getEstimateAddons, getPropertyTypeLabel } from '../../utils/estimatePackageUtils';
import EstimateServicesTable from './EstimateServicesTable';
import EstimateDocumentHeader from './EstimateDocumentHeader';
import EstimatePriceSummary from './EstimatePriceSummary';
import { EstimateTermsSection } from './EstimateTerms';

/**
 * Everything a saved estimate holds, shown inside the row it belongs to. Clicking an Estimate ID in
 * the Admin, Ops Manager, FP or Manager list expands this instead of opening a modal.
 *
 * It is laid out as the document itself: the letterhead with BILL TO facing it, the property the
 * estimate was written for, its services, what it comes to, and the terms. The PDF and the email
 * print the same sections in the same order, so nothing read here is a surprise to the customer.
 *
 * It is read-only, and it states the customer's price alone -- no vendor cost, XLAND cost or
 * margin. Those figures belong to the payments dashboard's Cost & Margin panel, which is gated on
 * `canViewEstimateMargins`; an estimate screen shows what the customer is quoted.
 */
/**
 * A section's fields as a ruled table: the label in a cream cell, its value in the white cell
 * beside it, two pairs to a line. The same table the PDF draws, so the block lines up with the
 * services table under it instead of floating as a grid of label-over-value pairs, each finding
 * its own baseline. `wide` rows -- an address -- take a line of their own. Empty fields are
 * dropped before anything is placed, so the rest close up.
 */
const labelCell = 'w-[16%] bg-warm-section border border-warm-border px-2.5 py-1.5 align-top text-[10px] font-semibold uppercase tracking-wide text-warm-muted';
const valueCell = 'border border-warm-border px-2.5 py-1.5 align-top text-[13px] font-semibold text-warm-text break-words';
const DetailTable = ({ fields, wide = [] }) => {
  const present = fields.filter(([, value]) => value !== undefined && value !== null && value !== '');
  const wideRows = wide.filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!present.length && !wideRows.length) return null;
  const lines = [];
  for (let index = 0; index < present.length; index += 2) lines.push(present.slice(index, index + 2));
  return (
    <div className="overflow-hidden rounded-lg border border-warm-border">
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              {line.map(([label, value]) => (
                <Fragment key={label}>
                  <th scope="row" className={`${labelCell} text-left`}>{label}</th>
                  <td className={valueCell}>{value}</td>
                </Fragment>
              ))}
              {/* An odd last pair leaves no half-empty cell behind: the line is closed off plainly */}
              {line.length === 1 && <td className={valueCell} colSpan={2} />}
            </tr>
          ))}
          {wideRows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row" className={`${labelCell} text-left`}>{label}</th>
              <td className={valueCell} colSpan={3}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
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

export default function EstimateDetailPanel({ estimate, decode = value => value ?? '', status = null }) {
  if (!estimate) return null;
  const services = getEstimateAddons(estimate);
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
      {/* Who the estimate is from and who it is for, as the printed document opens */}
      <div className="rounded-lg border border-gray-100 bg-white px-4 pt-3">
        <EstimateDocumentHeader estimate={estimate} decode={decode} status={status} />
      </div>

      <Section title="Property Details">
        <DetailTable
          fields={[
            ['Name', decode(estimate.property_name || estimate.propertyName || estimate.communityName)],
            ['Type', getPropertyTypeLabel(propertyType)],
            ['Property ID', estimate.property_code || estimate.propertyCode],
            ['Zone', estimate.zone],
            ['Division', estimate.division],
            ['City', estimate.city],
            ['Tower / Building', decode(estimate.tower_name || estimate.towerName)],
            ['Block Number', estimate.block_number || estimate.blockNumber],
            [unitLabel, unitNumber],
            ['No. of Blocks', estimate.number_of_blocks || estimate.numberOfBlocks],
            ['No. of Units', estimate.total_units || estimate.totalUnits]
          ]}
          wide={[['Address', decode(estimate.address || estimate.property_address || estimate.propertyAddress)]]}
        />
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
          <EstimateServicesTable rows={services} decode={decode} />
        </Section>
      )}

      {/* The card carries its own Price Summary caption, so the section is not headed again */}
      <div className="border-t border-gray-100 pt-4">
        <EstimatePriceSummary estimate={estimate} />
      </div>

      {(estimate.description || estimate.notes) && (
        <Section title="Description / Notes">
          <p className="bg-white p-4 rounded-lg border border-gray-100 text-sm text-gray-700 whitespace-pre-line">{decode(estimate.description || estimate.notes)}</p>
        </Section>
      )}

      <EstimateTermsSection estimate={estimate} className="border-t border-gray-100 pt-4" />
    </div>
  );
}
