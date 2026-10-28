import { FileText, RefreshCw, Truck } from 'lucide-react';
import PropertyLocationDisplay from './PropertyLocationDisplay';
import { formatDate } from '../../utils/dateFormat';
import { shortDivision } from '../../utils/fieldOptionsStore';

/**
 * The one read-only property details body, shared by every portal's property view modal
 * (admin, ops manager, FP, manager, coordinator, supervisor, executive). Each portal used to
 * keep its own copy, so the same property looked different depending on who opened it --
 * grey labels and blue chips in some portals, the warm document style in the FP portal.
 * This is the FP design: warm section cards, warm-muted labels, warm-accent chips.
 *
 * Property rows reach the portals with slightly different field names, so every read goes
 * through the widest fallback (`block_names || blockNames`, `zip_code || postal_code`,
 * `est.estimate_id || est.estimateId`).
 *
 *   <PropertyViewBody
 *     property={selectedProperty}
 *     zoneName={zones.find(z => z.id == p.zone_id)?.name}      // optional name override
 *     divisionName={divisions.find(d => d.id == p.division_id)?.name}
 *     typeLabel={getTypeLabel(p.property_type)}                // optional badge text
 *     estimates={propertyEstimates}
 *     loadingEstimates={loadingEstimates}
 *     vendorAssignments={propertyVendorAssignments}
 *     loadingVendorAssignments={loadingVendorAssignments}
 *   />
 */

const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-semibold text-warm-text mb-2">{children}</h3>
);

const Label = ({ children }) => (
  <p className="text-[11px] font-medium uppercase tracking-wide text-warm-muted mb-0.5">{children}</p>
);

const Value = ({ children, className = '' }) => (
  <p className={`text-sm font-medium text-warm-text ${className}`}>{children ?? '-'}</p>
);

const cardClass = 'rounded-[10px] border border-warm-border bg-warm-section/60 px-4 py-3';

const titleCase = (value) =>
  value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';

// Map internal unit-type keys to display names (covers every key any portal writes).
const unitTypeLabel = (key) => ({
  'studio': 'Studio', 'Studio': 'Studio',
  'oneBed': '1 BHK', '1 BHK': '1 BHK', '1BHK': '1 BHK',
  'twoBed': '2 BHK', '2 BHK': '2 BHK', '2BHK': '2 BHK',
  'threeBed': '3 BHK', '3 BHK': '3 BHK', '3BHK': '3 BHK',
  'fourBed': '4 BHK', '4 BHK': '4 BHK', '4BHK': '4 BHK',
  'fiveBed': '5 BHK', '5 BHK': '5 BHK', '5BHK': '5 BHK'
}[key] || key);

const parseJsonField = (value, fallback) => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value || fallback);
  } catch {
    return fallback;
  }
};

const formatPhone = (phone) => {
  if (!phone) return '-';
  const trimmed = phone.toString().trim();
  if (trimmed.startsWith('+91') && !trimmed.startsWith('+91 ')) return `+91 ${trimmed.slice(3)}`;
  return trimmed.startsWith('+') ? trimmed : `+91 ${trimmed}`;
};

const PropertyViewBody = ({
  property: p,
  zoneName,
  divisionName,
  typeLabel,
  estimates = [],
  loadingEstimates = false,
  vendorAssignments = [],
  loadingVendorAssignments = false,
}) => {
  const typeStr = String(p.property_type || p.entryType || p.propertyType || '').toLowerCase();
  const entryStr = String(p.entry_type || p.entryType || '').toLowerCase();
  const matches = (names) => names.some(n => typeStr === n || entryStr === n);

  const isGC = matches(['gated_community', 'gc', 'gated community']);
  const isApt = matches(['apartment', 'apt']);
  const isVilla = matches(['villa']);
  const isFlat = matches(['flat']);
  const isPlot = matches(['plot']);
  const hasWatchman = ['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes(typeStr)
    || ['gc', 'apt', 'gated_community', 'apartment', 'gated community'].includes(entryStr);

  const blockNames = parseJsonField(p.block_names || p.blockNames, {});
  const unitsPerBlock = parseJsonField(p.units_per_block || p.unitsPerBlock, {});
  const blockUnitTypes = parseJsonField(p.block_unit_types || p.blockUnitTypes, {});
  const numBlocks = p.number_of_blocks || p.numberOfBlocks || Object.keys(blockNames).length || Object.keys(unitsPerBlock).length || 1;

  const totalUnits = (() => {
    const total = Object.values(unitsPerBlock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    if (total > 0) return total;
    return p.total_units || p.totalUnits || p.units || p.number_of_units || p.numberOfUnits || '-';
  })();

  const zip = p.postalCode || p.zip_code || p.postal_code || '-';
  const unitNumber = p.villa_plot_number || p.villaPlotNumber || 'N/A';

  let contacts = [];
  try {
    if (p.association_contacts) contacts = parseJsonField(p.association_contacts, []);
  } catch { contacts = []; }
  if (contacts.length === 0 && (p.contact_person || p.contact_email || p.contact_phone)) {
    contacts = [{ name: p.contact_person, email: p.contact_email, phone: p.contact_phone }];
  }
  if (contacts.length === 0 && Array.isArray(p.contacts)) contacts = p.contacts;

  const UnitChips = ({ unitTypes }) => {
    const entries = Object.entries(unitTypes).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, count]) => (
          <span key={key} className="px-2 py-1 bg-warm-accent-soft text-warm-text text-xs rounded-full">
            {unitTypeLabel(key)}: {count}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Property Information */}
      <div>
        <SectionTitle>Property Information</SectionTitle>
        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 ${cardClass}`}>
          <div><Label>Zone</Label><Value>{zoneName || p.zone_name || p.zone || p.zoneName || p.zoneId || p.zone_id}</Value></div>
          <div><Label>Area Name</Label><Value>{p.area || p.area_name || p.areaName}</Value></div>
          <div><Label>Division</Label><Value>{divisionName || shortDivision(p.division_name || p.division || p.division_id)}</Value></div>
          <div><Label>Property Type</Label><Value>{typeLabel || titleCase(typeStr || entryStr)}</Value></div>
          <div><Label>Total Units</Label><Value>{totalUnits}</Value></div>
          <div><Label>Created Date</Label><Value>{formatDate(p.created_at || p.createdAt)}</Value></div>
        </div>
      </div>

      {/* Gated Community Block Details */}
      {isGC && (
        <div>
          <SectionTitle>Block Details</SectionTitle>
          <div className="mb-3">
            <Label>Number of Blocks</Label>
            <Value>{numBlocks}</Value>
          </div>
          {(Object.keys(blockNames).length > 0 || Object.keys(unitsPerBlock).length > 0) && (
            <div className="space-y-2">
              {Array.from({ length: numBlocks }, (_, i) => i + 1).map(blockNum => {
                const blockName = blockNames[blockNum] || blockNames[String(blockNum)] || `Block ${blockNum}`;
                const unitTypes = blockUnitTypes[blockNum] || blockUnitTypes[String(blockNum)] || blockUnitTypes[blockName] || {};
                return (
                  <div key={blockNum} className="px-4 py-3 bg-warm-section rounded-[10px] border border-warm-border">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-semibold text-warm-accent-hover">{blockName}</p>
                      <p className="text-sm font-medium text-warm-text">{unitsPerBlock[blockNum] || unitsPerBlock[String(blockNum)] || 0} units</p>
                    </div>
                    <UnitChips unitTypes={unitTypes} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Apartment Details */}
      {isApt && (
        <div>
          <SectionTitle>Apartment Details</SectionTitle>
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 ${cardClass} mb-3`}>
            <div><Label>Block Information</Label><Value>{p.block_na ? 'N/A' : (p.block_info || p.blockInfo)}</Value></div>
            <div><Label>Number of Units</Label><Value>{p.number_of_units || p.numberOfUnits}</Value></div>
          </div>
          {(() => {
            const unitTypes = blockUnitTypes['apt'] || blockUnitTypes['1'] || blockUnitTypes[1] || {};
            if (!Object.values(unitTypes).some(v => v > 0)) return null;
            return (
              <div className="p-3 bg-warm-section rounded-[10px] border border-warm-border">
                <p className="text-xs text-warm-muted mb-2 font-medium">Unit Type Breakdown</p>
                <UnitChips unitTypes={unitTypes} />
              </div>
            );
          })()}
        </div>
      )}

      {/* Villa Details */}
      {isVilla && (
        <div>
          <SectionTitle>Villa Details</SectionTitle>
          <div className={cardClass}>
            <Label>Villa Number</Label>
            <Value>{unitNumber === 'N/A' ? '-' : unitNumber}</Value>
          </div>
        </div>
      )}

      {/* Flat Details */}
      {isFlat && (
        <div>
          <SectionTitle>Flat Details</SectionTitle>
          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 ${cardClass}`}>
            <div><Label>Flat Number</Label><Value>{unitNumber === 'N/A' ? '-' : unitNumber}</Value></div>
            <div><Label>Block Information</Label><Value>{p.flat_block_na ? 'N/A' : (p.flat_block_info || p.flatBlockInfo)}</Value></div>
          </div>
        </div>
      )}

      {/* Plot Details */}
      {isPlot && (
        <div>
          <SectionTitle>Plot Details</SectionTitle>
          <div className={cardClass}>
            <Label>Plot Number</Label>
            <Value>{p.plot_na ? 'N/A' : (unitNumber === 'N/A' ? '-' : unitNumber)}</Value>
          </div>
        </div>
      )}

      {/* Address */}
      <div>
        <SectionTitle>Address</SectionTitle>
        <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 ${cardClass}`}>
          <div className="col-span-2 sm:col-span-3"><Label>Street Address</Label><Value>{p.address}</Value></div>
          <div><Label>Apt/Suite</Label><Value>{unitNumber}</Value></div>
          <div><Label>City</Label><Value>{p.city}</Value></div>
          <div><Label>State/Province</Label><Value>{p.state}</Value></div>
          <div><Label>ZIP/Postal Code</Label><Value>{zip}</Value></div>
        </div>
      </div>

      {/* Property Location */}
      <div>
        <SectionTitle>Property Location</SectionTitle>
        <PropertyLocationDisplay
          location={{
            lat: p.mapLocation?.lat || p.latitude,
            lng: p.mapLocation?.lng || p.longitude,
            address: p.mapLocation?.address || p.landmark || `${p.address || ''}, ${p.city || ''}, ${p.state || ''}, ${p.postalCode || p.zip_code || ''}`
          }}
          propertyName={p.name || p.community_name || 'Property'}
        />
      </div>

      {/* Contact Information */}
      {contacts.length > 0 && (
        <div>
          <SectionTitle>Contact Information</SectionTitle>
          <div className="space-y-2">
            {contacts.map((contact, index) => (
              <div key={index} className="bg-warm-section rounded-[10px] border border-warm-border px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 bg-warm-accent-soft rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-warm-accent-hover">{index + 1}</span>
                  </div>
                  <span className="text-xs text-warm-muted">Contact {index + 1}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2.5fr_1fr] gap-x-6 gap-y-2">
                  <div className="min-w-0"><Label>Name</Label><Value>{contact.name}</Value></div>
                  <div className="min-w-0"><Label>Email</Label><Value className="break-all">{contact.email}</Value></div>
                  <div className="min-w-0"><Label>Phone</Label><Value className="whitespace-nowrap">{formatPhone(contact.phone)}</Value></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchman Information - GC and APT only */}
      {hasWatchman && (
        <div>
          <SectionTitle>Watchman Information</SectionTitle>
          <div className="bg-amber-50 rounded-[10px] px-4 py-3 border border-amber-100">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div><Label>Watchman Name</Label><Value>{p.watchman_name || p.watchmanName || 'N/A'}</Value></div>
              <div><Label>Watchman Contact</Label><Value>{formatPhone(p.watchman_contact || p.watchmanContact) === '-' ? 'N/A' : formatPhone(p.watchman_contact || p.watchmanContact)}</Value></div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Notes */}
      {p.notes && (
        <div>
          <SectionTitle>Additional Notes</SectionTitle>
          <div className="bg-warm-section rounded-[10px] px-4 py-3 border border-warm-border">
            <p className="text-sm text-warm-text whitespace-pre-wrap">{p.notes}</p>
          </div>
        </div>
      )}

      {/* Estimates */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-warm-muted" />
          <h3 className="text-base font-semibold text-warm-text">Estimates ({estimates.length})</h3>
        </div>
        {loadingEstimates ? (
          <div className="bg-warm-section rounded-[10px] p-8 text-center">
            <RefreshCw className="w-8 h-8 text-warm-muted mx-auto mb-3 animate-spin" />
            <p className="text-sm text-warm-muted">Loading estimates...</p>
          </div>
        ) : estimates.length === 0 ? (
          <div className="bg-warm-section rounded-[10px] p-8 text-center">
            <FileText className="w-10 h-10 text-warm-border mx-auto mb-3" />
            <p className="text-sm text-warm-muted">No estimates for this property</p>
            <p className="text-xs text-warm-muted mt-1">Create an estimate from the Estimates section</p>
          </div>
        ) : (
          <div className="space-y-3">
            {estimates.map((est) => (
              <div key={est.id || est.estimate_id || est.estimateId} className="bg-white border border-warm-border rounded-[10px] p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-warm-text">{est.estimate_id || est.estimateId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    est.status === 'approved' ? 'bg-green-100 text-green-700' :
                    est.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-warm-accent-soft text-warm-text'
                  }`}>{est.status || 'draft'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-warm-muted">Package:</span>
                    <span className="ml-1 font-medium">{est.package_name || est.packageName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-warm-muted">Total:</span>
                    <span className="ml-1 font-semibold text-green-600">₹{Number(est.total_amount || est.totalPrice || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-warm-muted">Created:</span>
                    <span className="ml-1">{formatDate(est.created_at || est.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-warm-muted">By:</span>
                    <span className="ml-1">{est.created_by_name || est.createdByName || est.createdBy || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assigned Vendors - read only */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-4 h-4 text-warm-accent" />
          <h3 className="text-base font-semibold text-warm-text">Assigned Vendors</h3>
        </div>
        {loadingVendorAssignments ? (
          <div className="bg-warm-section rounded-[10px] p-6 text-center">
            <RefreshCw className="w-6 h-6 text-warm-muted mx-auto mb-2 animate-spin" />
            <p className="text-sm text-warm-muted">Loading vendor assignments...</p>
          </div>
        ) : vendorAssignments.length === 0 ? (
          <div className="bg-warm-section rounded-[10px] p-6 text-center">
            <Truck className="w-8 h-8 text-warm-border mx-auto mb-2" />
            <p className="text-sm text-warm-muted">No vendors assigned to this property</p>
          </div>
        ) : (
          <div className="border border-warm-border rounded-[10px] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-warm-section border-b border-warm-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-warm-text">Service Type</th>
                  <th className="px-4 py-3 text-left font-medium text-warm-text">Vendor Name</th>
                  <th className="px-4 py-3 text-left font-medium text-warm-text">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border/70">
                {vendorAssignments.map((assignment, idx) => (
                  <tr key={idx} className="hover:bg-warm-section">
                    <td className="px-4 py-3">
                      <span className="font-medium text-warm-text">{assignment.serviceType || assignment.service_type || 'General'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-warm-text">{assignment.vendorName || assignment.vendor_name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-warm-muted text-xs">{assignment.vendorPhone || assignment.vendor_phone || '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyViewBody;
