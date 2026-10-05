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

// The capacity that prices a chosen slab. Choosing a slab used to set the capacity to its lower
// bound, which is wrong once slabs overlap: with 0–3, 0–6 and 0+, picking 0–6 set 0, and 0 lands in
// 0–3 again, so the choice snapped back. The lowest whole capacity whose tightest slab is the chosen
// one is the answer -- 4 for 0–6, 7 for 0+ -- and the server, applying the same rule, prices the
// same slab. The matching slab can only change at a slab's start or just past a slab's end, so
// those are the only points tried. A slab no capacity can reach (a duplicate of a tighter one)
// falls back to its lower bound.
export const capacityForSlab = (slabs, chosen) => {
  const usable = (Array.isArray(slabs) ? slabs : []).filter(slab => slab?.capacityFrom != null && String(slab.capacityFrom).trim() !== '');
  if (!chosen || !usable.includes(chosen)) return chosen ? Number(chosen.capacityFrom) : '';
  const from = Math.ceil(Number(chosen.capacityFrom));
  const to = chosen.capacityTo === null || chosen.capacityTo === '' || chosen.capacityTo === undefined ? Infinity : Number(chosen.capacityTo);
  const points = new Set([from]);
  for (const slab of usable) {
    points.add(Math.ceil(Number(slab.capacityFrom)));
    if (slab.capacityTo !== null && slab.capacityTo !== '' && slab.capacityTo !== undefined) points.add(Math.floor(Number(slab.capacityTo)) + 1);
  }
  const candidates = [...points].filter(point => Number.isFinite(point) && point >= from && point <= to).sort((a, b) => a - b);
  return candidates.find(point => narrowestRange(usable, point, 'capacityFrom', 'capacityTo') === chosen) ?? from;
};
