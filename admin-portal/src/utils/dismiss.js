/**
 * Whether a click belongs outside an open floating panel, and should therefore close it.
 *
 * The decision is kept out of the component so it can be tested without a browser, because the
 * two ways of getting it wrong are both silent:
 *
 *   - treating a click on the panel's own trigger as "outside" closes the panel on mousedown and
 *     the trigger's click reopens it, so it never shuts;
 *   - treating a click inside the panel as "outside" closes it before the option is chosen.
 *
 * The anchor is the panel's parent element -- the positioned wrapper that holds both the trigger
 * and the panel -- so no ref is needed at the call site.
 *
 * Regression test: node --test admin-portal/src/utils/dismiss.test.js
 */
export const shouldDismiss = (panel, target) => {
  // Nothing rendered, or a synthetic event with no target: there is nothing to judge.
  if (!panel || !target) return false;
  const anchor = panel.parentElement || panel;
  // A target already detached from the document (an option that removed itself on click) must not
  // be read as a click on the page behind it.
  if (target.isConnected === false) return false;
  return !anchor.contains(target);
};
