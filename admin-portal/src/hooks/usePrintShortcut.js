import { useEffect, useRef } from 'react';

/**
 * Ctrl+P (Cmd+P on a Mac) prints the document, not the screen. While an estimate is open, the
 * browser's own print of the page -- the portal's layout, its URL and date in the margins, the
 * services split across two half-filled pages -- is replaced by `onPrint`, which prints the same
 * generated PDF the Print button does. Pass a falsy `onPrint` (nothing open) to leave the shortcut
 * to the browser.
 */
export default function usePrintShortcut(onPrint) {
  const latest = useRef(onPrint);
  latest.current = onPrint;
  const active = Boolean(onPrint);
  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = event => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || String(event.key).toLowerCase() !== 'p') return;
      event.preventDefault();
      event.stopPropagation();
      latest.current?.();
    };
    // Capture, so it runs before anything else on the page can act on the keystroke
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [active]);
}
