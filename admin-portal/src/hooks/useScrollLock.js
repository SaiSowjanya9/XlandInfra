import { useEffect } from 'react';

// Holds the page still while a dialog is open over it. The estimate dialogs (Add Service, Custom
// Service, the package service list) are fixed overlays, and the page behind them kept scrolling:
// the wheel over the backdrop moved the form underneath, and a dialog's own list, once it reached
// its end, handed the scroll on to the page. The page's scrollbar is swapped for padding of the
// same width so nothing behind the dialog shifts sideways.
//
// Locks are counted, so a dialog opened over another keeps the page held until the last closes.
let holders = 0;
let saved = null;

export default function useScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    if (holders === 0) {
      const scrollbar = window.innerWidth - root.clientWidth;
      saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
      root.style.overflow = 'hidden';
      if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    }
    holders += 1;
    return () => {
      holders -= 1;
      if (holders === 0 && saved) {
        root.style.overflow = saved.overflow;
        root.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}
