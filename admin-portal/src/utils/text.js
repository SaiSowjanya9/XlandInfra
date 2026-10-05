// Text helpers shared by every form.
//
// The backend HTML-escapes every string it receives (middleware/security.js), so stored text comes
// back with "/" as "&#x2F;" and "&" as "&amp;". Loading that into a field and saving it again
// escapes the escapes, so anything a form reads back is decoded first. Mirrors
// backend/utils/htmlEntities.js.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeOnce = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
  if (code[0] === '#') {
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  }
  return NAMED[code.toLowerCase()] ?? match;
});

export const decodeEntities = value => {
  if (typeof value !== 'string' || !value.includes('&')) return value;
  let text = value;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = decodeOnce(text);
    if (next === text) break;
    text = next;
  }
  return text;
};

export const decodeDeep = value => {
  if (typeof value === 'string') return decodeEntities(value);
  if (Array.isArray(value)) return value.map(decodeDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeDeep(item)]));
  }
  return value;
};

// The first letter of a typed value is upper case; the rest is left exactly as typed, so "AC
// servicing" stays "AC servicing" rather than becoming "Ac servicing".
export const capitalizeFirst = value => {
  if (typeof value !== 'string') return value;
  const index = value.search(/\S/);
  return index < 0 ? value : value.slice(0, index) + value.charAt(index).toUpperCase() + value.slice(index + 1);
};

// Two values are the same entry when they differ only in case or surrounding/doubled spaces
export const sameEntry = (first, second) =>
  String(first ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === String(second ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
