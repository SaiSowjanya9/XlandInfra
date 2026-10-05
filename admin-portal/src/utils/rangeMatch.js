// Slabs and manpower ranges may overlap or leave gaps, so a value takes the tightest range that
// contains it -- the same choice the server makes in backend/utils/servicePricing.js.
export const narrowestRange = (items, value, from, to) => {
  if (!Array.isArray(items) || value == null || String(value).trim() === '' || !Number.isFinite(Number(value))) return undefined;
  const amount = Number(value);
  let best, bestWidth = Infinity;
  for (const item of items) {
    if (item?.[from] == null || item[from] === '' || amount < Number(item[from])) continue;
    const open = item[to] === null;
    if (!open && (item[to] === undefined || item[to] === '' || amount > Number(item[to]))) continue;
    const width = open ? Infinity : Number(item[to]) - Number(item[from]);
    if (!best || width < bestWidth) { best = item; bestWidth = width; }
  }
  return best;
};
