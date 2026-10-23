import { X } from 'lucide-react';
import Modal from './Modal';
import { COMPANY_LOGO_ICON, COMPANY } from '../../utils/companyInfo';

/**
 * Mirror of `admin-portal/src/components/common/ViewModal.jsx` — the same read-only "view
 * details" chrome for the customer portal: cream letterhead, white meta strip, warm section
 * cards, Close button at the foot. Keep the two files in step.
 */

export const ViewLetterhead = ({ onClose }) => (
  <div className="flex-shrink-0 relative">
    <div className="bg-warm-section px-6 py-3">
      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-2 right-2 p-1 hover:bg-black/5 rounded transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
      <div className="flex items-center justify-center gap-3">
        <img src={COMPANY_LOGO_ICON} alt={COMPANY.name} className="h-14 w-14 object-contain" />
        <div className="flex flex-col justify-center">
          <h1 className="text-gray-900 text-sm font-bold tracking-wider leading-tight">{COMPANY.name}</h1>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-5 h-[1px] bg-gray-900/50"></div>
            <span className="text-gray-900 text-[7px] tracking-[0.12em]">{COMPANY.suffix}</span>
            <div className="w-5 h-[1px] bg-gray-900/50"></div>
          </div>
        </div>
      </div>
    </div>
    <div className="h-1.5 bg-warm-border"></div>
  </div>
);

const ViewModal = ({
  onClose,
  id,
  idLabel = 'ID',
  title,
  subtitle,
  meta = [],
  badge,
  banner,
  actions,
  footer,
  maxWidth = 'max-w-2xl',
  bodyClassName = '',
  className = '',
  align,
  zIndex,
  overlayClassName,
  ariaLabelledBy,
  children,
}) => {
  const metaRows = Array.isArray(meta) ? meta.filter(Boolean) : [meta];
  const showStrip = id || title || subtitle || metaRows.length > 0 || badge;

  return (
    <Modal
      onClose={onClose}
      align={align}
      zIndex={zIndex}
      overlayClassName={overlayClassName}
      ariaLabelledBy={ariaLabelledBy}
      className={`w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden ${className}`}
    >
      <ViewLetterhead onClose={onClose} />

      {showStrip && (
        <div className="px-5 py-3 flex-shrink-0 bg-white border-b border-warm-border">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              {id && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] text-gray-500">{idLabel}:</span>
                  <span className="text-xs font-bold text-gray-900 break-all">{id}</span>
                </div>
              )}
              {title && <p className="text-sm font-semibold text-gray-900">{title}</p>}
              {subtitle && <p className="text-[11px] text-warm-muted mt-0.5">{subtitle}</p>}
            </div>
            {(metaRows.length > 0 || badge) && (
              <div className="text-right flex-shrink-0 space-y-0.5">
                {metaRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2 justify-end">
                    {row.label && <span className="text-[10px] text-gray-500">{row.label}:</span>}
                    <span className="text-[11px] font-semibold text-gray-900">{row.value}</span>
                  </div>
                ))}
                {badge && <div className="flex justify-end pt-0.5">{badge}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`overflow-y-auto flex-1 px-5 py-4 space-y-4 bg-white ${bodyClassName}`}>
        {banner}
        {children}
      </div>

      {footer === undefined || footer ? (
        <div className="px-5 py-3 flex-shrink-0 bg-white border-t border-warm-border flex items-center justify-end gap-3">
          {actions}
          {footer || (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-warm-text border border-warm-border rounded-lg hover:bg-warm-accent-soft transition-colors"
            >
              Close
            </button>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

/** A cream detail card, the way the invoice view draws Property Details / Customer Details. */
export const ViewSection = ({ title, icon: Icon, children, className = '', bodyClassName = '' }) => (
  <div className={`bg-warm-section rounded-lg p-3 border border-warm-border ${className}`}>
    {title && (
      <p className="text-gray-900 text-xs font-bold uppercase mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-warm-accent-hover" />}
        {title}
      </p>
    )}
    <div className={bodyClassName}>{children}</div>
  </div>
);

/** Label-over-value detail field, for use inside a ViewSection grid. */
export const ViewField = ({ label, value, className = '', valueClassName = '', children }) => (
  <div className={className}>
    <p className="text-xs text-gray-500">{label}</p>
    {children || <p className={`text-sm font-medium text-gray-900 ${valueClassName}`}>{value ?? '-'}</p>}
  </div>
);

/** Inline `Label: value` line, the format the invoice view's detail cards use. */
export const ViewLine = ({ label, value, className = '', valueClassName = '' }) => (
  <p className={`text-gray-600 ${className}`}>
    {label}: <span className={`text-gray-800 ${valueClassName}`}>{value ?? '-'}</span>
  </p>
);

/** The grid a ViewSection's fields sit in: two columns on desktop, one on mobile. */
export const ViewGrid = ({ cols = 2, children, className = '' }) => (
  <div
    className={`grid gap-x-4 gap-y-3 ${
      { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[cols] || 'grid-cols-1 sm:grid-cols-2'
    } ${className}`}
  >
    {children}
  </div>
);

export default ViewModal;
