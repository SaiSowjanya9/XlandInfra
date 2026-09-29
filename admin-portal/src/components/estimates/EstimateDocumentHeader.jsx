import { Fragment } from 'react';
import { Globe, Mail, Phone } from 'lucide-react';
import { COMPANY, COMPANY_CONTACT_LINES, COMPANY_LOGO_ICON } from '../../utils/companyInfo';

// The icon beside each contact line. The PDFs draw the same three from primitives.
const CONTACT_ICONS = { phone: Phone, email: Mail, website: Globe };

/**
 * The letterhead every estimate opens with, on screen.
 *
 * Left: the logo, XLAND INFRA with PVT LTD ruled beneath it, and how to reach the company. Right:
 * BILL TO, the customer the estimate was written for. Under both, a strip naming the document and
 * its number, date, type and billing cycle.
 *
 * The same three parts, in the same order, are drawn by the PDF (`utils/pdfExport.js` and
 * `backend/services/pdfService.js`) and by the estimate email, so what a colleague reads in the
 * portal is what the customer receives. The wording of the company block comes from
 * `utils/companyInfo.js`, which the backend has a twin of.
 */

const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');

const formatDate = value => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const BillRow = ({ label, children }) => (
  <div className="flex gap-2">
    <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 pt-px">{label}</span>
    <span className="min-w-0 break-words text-[11px] text-gray-700">{children}</span>
  </div>
);

// The fields share the strip evenly rather than sitting in a clump at its left edge
const MetaField = ({ label, children }) => (
  <div className="min-w-[5.5rem] flex-1">
    <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xs font-semibold text-gray-800">{children || '-'}</p>
  </div>
);

export default function EstimateDocumentHeader({ estimate, decode = value => value ?? '', status = null }) {
  if (!estimate) return null;
  const customerName = decode(first(estimate.client_name, estimate.customer_name, estimate.customerName) || '');
  const propertyName = decode(first(estimate.property_name, estimate.propertyName, estimate.communityName) || '');
  const propertyCode = first(estimate.property_code, estimate.propertyCode);
  const billingRaw = first(estimate.billing_duration, estimate.billingDuration) || 'Yearly';

  return (
    <div>
      <div className="h-[3px] rounded-sm bg-gradient-to-r from-[#C9A227] via-[#E6C766] to-[#C9A227]" />

      <div className="flex flex-col gap-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        {/* The company block is one centred stack: the logo and the name sit on the first line,
            and the tagline, address and contact lines centre on the whole lockup beneath them --
            not under the name alone, which left them hanging to the right of the logo. */}
        <div className="flex min-w-0 flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <img src={COMPANY_LOGO_ICON} alt="" className="h-12 w-12 shrink-0 object-contain" />
            <div>
              <p className="text-[17px] font-bold leading-none tracking-[0.13em] text-gray-900">{COMPANY.name}</p>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className="h-px w-6 bg-gray-900/50" />
                <span className="text-[8px] font-semibold tracking-[0.28em] text-gray-900">{COMPANY.suffix}</span>
                <span className="h-px w-6 bg-gray-900/50" />
              </div>
            </div>
          </div>
          {/* Every line starts on one vertical edge, with the icons in a column of their own to
              the left of it: an inline grid, so the block still centres on the lockup while its
              text reads down a straight edge instead of each line centring on its own width. */}
          <div className="mt-2 inline-grid grid-cols-[0.75rem_auto] items-center gap-x-1.5 gap-y-0.5 text-left">
            <p className="col-start-2 text-[9px] uppercase tracking-wider text-gray-500">{COMPANY.tagline}</p>
            {COMPANY.addressLines.map(line => (
              <p key={line} className="col-start-2 text-[11px] leading-relaxed text-gray-600">{line}</p>
            ))}
            {COMPANY_CONTACT_LINES.map(([kind, value]) => {
              const Icon = CONTACT_ICONS[kind];
              return (
                <Fragment key={kind}>
                  <span className="col-start-1 flex justify-center">
                    {Icon && <Icon className="h-3 w-3 text-[#C9A227]" strokeWidth={2} />}
                  </span>
                  <p className="col-start-2 text-[11px] leading-relaxed text-gray-600">{value}</p>
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="w-full overflow-hidden rounded-lg border border-warm-border sm:w-64 sm:shrink-0">
          <p className="border-b border-warm-border bg-warm-accent-soft px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#8A6D12]">Bill To</p>
          <div className="space-y-1 px-3 py-2.5">
            <p className="text-[13px] font-bold text-gray-900 break-words">{customerName || '-'}</p>
            <BillRow label="Phone">{first(estimate.client_phone, estimate.customer_phone, estimate.customerPhone) || '-'}</BillRow>
            <BillRow label="Email">{first(estimate.client_email, estimate.customer_email, estimate.customerEmail) || '-'}</BillRow>
            {propertyName && <BillRow label="Property">{propertyName}</BillRow>}
            {propertyCode && <BillRow label="Prop ID">{propertyCode}</BillRow>}
            {estimate.city && <BillRow label="City">{decode(estimate.city)}</BillRow>}
          </div>
        </div>
      </div>

      {/* The strip no longer announces the word ESTIMATE -- the document it belongs to is not in
          doubt -- so its fields spread across the full width instead of crowding to the left. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-warm-border bg-warm-section px-4 py-2">
        <MetaField label="Estimate No.">{first(estimate.estimate_id, estimate.estimateId)}</MetaField>
        <MetaField label="Date">{formatDate(first(estimate.created_at, estimate.createdAt))}</MetaField>
        <MetaField label="Type">
          <span className="capitalize">{String(first(estimate.estimate_type, estimate.estimateType) || '-').replace(/_/g, ' ')}</span>
        </MetaField>
        <MetaField label="Billing"><span className="capitalize">{String(billingRaw).replace(/-/g, ' ')}</span></MetaField>
        {status && <div className="ml-auto">{status}</div>}
      </div>
    </div>
  );
}
