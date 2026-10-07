import { Fragment } from 'react';
import { formatCurrency, getAddonPrice, getEstimateAddons, getPropertyTypeLabel } from '../../utils/estimatePackageUtils';
import EstimateServicesTable, { EstimateGrandTotal } from './EstimateServicesTable';
import EstimateDocumentHeader from './EstimateDocumentHeader';
import EstimatePriceSummary from './EstimatePriceSummary';
import { EstimateTermsSection } from './EstimateTerms';
import { shortDivision } from '../../utils/fieldOptionsStore';
import usePrintShortcut from '../../hooks/usePrintShortcut';

/**
 * Everything a saved estimate holds, shown as the full-screen view behind an Estimate ID. Clicking
 * an ID in the Admin, Ops Manager, FP or Manager list leaves the list for this document, and the
 * Back button returns to it. Coordinator, Executive and Supervisor reach it through their own
 * full-screen view instead.
 *
 * It is laid out as the document itself: the letterhead with BILL TO facing it, the property the
 * estimate was written for, its services, what it comes to, and the terms. The PDF and the email
 * print the same sections in the same order, so nothing read here is a surprise to the customer.
 *
 * It is read-only. Pass `internal` — only from Admin, Operations Manager and FP views — to have the
 * services table also state Vendor Cost, XLAND Cost and Margin %, the same columns the create
 * form's draft table shows those portals. Everywhere else the table states the customer's price
 * alone, so what a colleague or the customer reads there is what the customer receives.
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

// `onPrint` -- the caller's Print -- also answers Ctrl+P while this estimate is open
export default function EstimateDetailPanel({ estimate, decode = value => value ?? '', status = null, internal = false, onPrint = null }) {
  usePrintShortcut(onPrint);
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
  const packagePrice = Number(estimate.package_price ?? estimate.packagePrice ?? estimate.packageRate) || 0;

  return (
    // print-document: a browser print of this view is this document alone -- the rule in
    // index.css drops the portal chrome, the page header and the buttons around it
    <div className="print-document space-y-4 bg-slate-50/60 px-4 py-4 sm:px-6 print:bg-white print:p-0">
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
            ['Division', shortDivision(estimate.division)],
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

      {/* The view lists the package's own services and the added services as two blocks -- the
          AMC Package, at its price, then the Services, at theirs -- with Total Services Price (the
          two together, which is the Price Summary's subtotal) under both. The customer's documents
          list them as one table instead (the user's call). Package rows keep their _tag, which is
          how the cost columns know to read them against their share of the package price. */}
      {packageServices.length > 0 && (
        <Section title={packageName ? `AMC Package - ${decode(packageName)}` : 'AMC Package - Services Included'}>
          <EstimateServicesTable
            rows={packageServices.map(s => (typeof s === 'string' ? { name: s, _tag: 'Package' } : { ...s, _tag: 'Package' }))}
            total={packagePrice} totalLabel="AMC Package Price" showTag={false}
            decode={decode}
            internal={internal}
          />
        </Section>
      )}
      {services.length > 0 && (
        <Section title="Services">
          <EstimateServicesTable
            rows={services}
            total={services.reduce((sum, row) => sum + getAddonPrice(row), 0)} totalLabel="Services Total"
            decode={decode}
            internal={internal}
          />
        </Section>
      )}
      {/* Total Services Price across both blocks, on their columns: under Vendor Cost, XLAND Cost
          and Margin % it carries the whole estimate's figures -- what the separate INTERNAL panel
          used to state -- and under Customer Price the subtotal */}
      {(packageServices.length > 0 || services.length > 0 || packageName) && (
        <EstimateGrandTotal internal={internal}
          rows={[...packageServices.filter(row => row && typeof row === 'object').map(row => ({ ...row, _tag: 'Package' })), ...services]}
          price={packagePrice + services.reduce((sum, row) => sum + getAddonPrice(row), 0)} />
      )}

      {/* The card carries its own Price Summary caption, so the section is not headed again */}
      <div className="border-t border-gray-100 pt-4">
        <EstimatePriceSummary estimate={estimate} />
      </div>

      {(estimate.description || estimate.notes) && (
        <Section title="Notes">
          <p className="bg-white p-4 rounded-lg border border-gray-100 text-sm text-gray-700 whitespace-pre-line">{decode(estimate.description || estimate.notes)}</p>
        </Section>
      )}

      <EstimateTermsSection estimate={estimate} className="border-t border-gray-100 pt-4" />
    </div>
  );
}
