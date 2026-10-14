import { useEffect, useRef } from 'react';
import { shouldDismiss } from '../../utils/dismiss';

/**
 * A floating panel -- a dropdown, a picker, a suggestion list -- that closes when you click away
 * from it or press Escape.
 *
 * Most of the portals' dropdowns were written as `{open && <div className="absolute ...">}` with
 * nothing listening for a click elsewhere, so an open one stayed open while you worked on the rest
 * of the page, and several could be open at once. A dozen screens had each grown their own
 * `useEffect` + `useRef` + `mousedown` listener for it; this is that, once.
 *
 * Drop-in for the markup it replaces:
 *
 *   {open && (<div className="absolute ...">…</div>)}
 *   <DismissPanel open={open} onDismiss={() => setOpen(false)} className="absolute ...">…</DismissPanel>
 *
 * **No ref is needed at the call site.** The trigger -- the button or input that opened the panel --
 * is always a sibling inside the same positioned wrapper, so the panel's own `parentElement` is
 * the anchor, and a click anywhere inside it counts as "inside". That matters: closing on the
 * trigger's own mousedown would let its click reopen the panel, and it would never shut.
 */
const DismissPanel = ({ open, onDismiss, className = '', children, ...rest }) => {
  const panelRef = useRef(null);
  // Held in a ref so changing the handler does not tear the listener down and rebuild it, and so
  // the listener always calls the current one.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (shouldDismiss(panelRef.current, event.target)) dismissRef.current?.();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') dismissRef.current?.();
    };
    // mousedown, not click: a click fires after the mouse is released, by which time the thing
    // underneath may have moved or gone.
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={panelRef} className={className} {...rest}>
      {children}
    </div>
  );
};

export default DismissPanel;
