import { useLayoutEffect, useRef } from 'react';

/**
 * Keeps a floating panel (a dropdown, a date picker) inside the screen.
 *
 * The portals' dropdowns are `absolute right-0 w-80`: pinned to the right edge of whatever opened
 * them. On a desktop that trigger sits at the right of a wide header, so the panel opens leftwards
 * into empty space. On a phone or tablet the trigger can sit mid-row, and a 320px panel pinned to
 * its right edge runs off the left of the screen -- the Start Date / End Date inputs of the
 * dashboard's date filter were cut in half on a 390px phone.
 *
 * After the panel renders, this measures it and nudges it sideways with the CSS `translate`
 * property (which composes with Tailwind's `transform` classes rather than replacing them) so it
 * sits at least `gutter` px from both edges. It re-measures on resize and orientation change.
 * Panels should also cap their width, e.g. `max-w-[calc(100vw-1rem)]`, so they always can fit.
 */
const GUTTER = 8;

const place = (el, gutter = GUTTER) => {
  el.style.translate = '';
  const { left, right } = el.getBoundingClientRect();
  const viewport = document.documentElement.clientWidth;
  let shift = 0;
  if (left < gutter) shift = gutter - left;
  else if (right > viewport - gutter) shift = Math.max(gutter - left, viewport - gutter - right);
  if (shift) el.style.translate = `${Math.round(shift)}px 0`;
};

/**
 * Callback-ref form, for a panel rendered as `{open && <div ref={clampToViewport} …>}` -- no
 * state or hook needed at the call site. The resize listener drops itself once the panel unmounts.
 */
export const clampToViewport = (el) => {
  if (!el) return;
  const onResize = () => {
    if (!el.isConnected) {
      window.removeEventListener('resize', onResize);
      return;
    }
    place(el);
  };
  place(el);
  window.addEventListener('resize', onResize);
};

const useViewportClamp = (open, gutter = GUTTER) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return undefined;
    const onResize = () => place(el, gutter);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, gutter]);

  return ref;
};

export default useViewportClamp;
