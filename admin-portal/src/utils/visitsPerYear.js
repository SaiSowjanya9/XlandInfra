// Visits Per Year is the one figure the service dialogs let a user retype by hand, once Override
// frequency is ticked, and `type="number"` does not hold the line on it: a browser accepts "e",
// "-", "+" and a stray letter in such a box and then reports `value` as '' for the lot, so the box
// displayed text the component never saw. The server prices from the state, not the box, so the
// service was quoted with no visits at all -- or the quote failed with "Visits must be a number"
// over a field that looked filled in. These read whatever was typed as the digits of it.
//
// The bounds mirror `visitsFor` in backend/utils/servicePricing.js: a whole count, 0 to 366, and
// zero only for a frequency that schedules nothing (On Request).
export const MAX_VISITS_PER_YEAR = 366;

// What the field shows while it is being typed in: the digits of `value`, capped at a year of
// days, or '' when every character has been deleted. Never NaN, so the input stays controlled.
export const sanitizeVisits = value => {
  const digits = String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits === '' ? '' : Math.min(Number(digits), MAX_VISITS_PER_YEAR);
};

// What the field settles on when it is left. `fallback` is the count the current frequency implies,
// so clearing the box restores it rather than sending nothing, and a typed 0 is kept only where the
// frequency schedules no visits -- the server refuses it anywhere else.
export const resolveVisits = (value, fallback) => {
  const visits = sanitizeVisits(value);
  const floor = sanitizeVisits(fallback);
  if (visits === '') return floor === '' ? '' : floor;
  return visits === 0 && floor !== 0 ? 1 : visits;
};
