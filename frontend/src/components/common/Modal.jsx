import { useEffect } from 'react';

/**
 * One modal shell for every portal.
 *
 * Every dialog in the staff portals used to be hand-rolled as
 * `<div className="fixed inset-0 bg-black/50 flex ...">` around a white card -- 191 of them across
 * 80 files, which is why they drifted: three different alignments, five z-indexes, three radii,
 * `bg-white` and `bg-slate-50`, `border-gray-200` and no border at all, against the warm theme
 * the rest of the app runs on. This is the shell, once: the dimmed backdrop, the card's surface,
 * the Escape key, and the backdrop-click close.
 *
 * What it replaces, for a modal that closes on the backdrop:
 *
 *   <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20 overflow-y-auto" onClick={onClose}>
 *     <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
 *       ...
 *     </div>
 *   </div>
 *
 *   <Modal onClose={onClose} align="top" className="max-w-4xl max-h-[95vh] overflow-hidden">
 *     ...
 *   </Modal>
 *
 * `className` carries only the card's size and scroll behaviour (max-w-*, max-h-*, overflow-*,
 * flex layout); the surface itself -- white, `rounded-xl`, `border-warm-border`, `shadow-warm` --
 * comes from here so every portal's dialogs are the same surface.
 *
 * A click inside the card is always swallowed: an input click must never read as "clicked the
 * page behind the dialog". A modal that was deliberately inert (no backdrop close) keeps that by
 * omitting `onClose`; the card still swallows clicks either way.
 */
const Z_INDEX = {
  'z-40': 'z-40',
  'z-50': 'z-50',
  'z-60': 'z-[60]',
  'z-[60]': 'z-[60]',
  'z-[70]': 'z-[70]',
  'z-[100]': 'z-[100]',
  'z-[110]': 'z-[110]',
  'z-[9999]': 'z-[9999]',
};

const Modal = ({
  onClose,
  align = 'center',
  top = 'pt-20',
  zIndex = 'z-50',
  padding = 'p-4',
  overlayClassName = '',
  className = '',
  overlayRef,
  cardRef,
  ariaLabelledBy,
  children,
}) => {
  // Escape closes a modal that a backdrop click would close -- the keyboard equivalent.
  useEffect(() => {
    if (!onClose) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const placement = align === 'top'
    ? `items-start justify-center overflow-y-auto ${top}`
    : 'items-center justify-center';

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 bg-black/50 flex ${placement} ${Z_INDEX[zIndex] || 'z-50'} ${padding} ${overlayClassName}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div
        ref={cardRef}
        className={`bg-white rounded-xl border border-warm-border shadow-warm w-full ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
