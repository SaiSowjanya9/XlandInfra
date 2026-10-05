// middleware/security.js HTML-escapes every string a request carries, so text is stored with "/"
// as "&#x2F;", "&" as "&amp;" and so on. A form that loads such text and saves it again escapes the
// escapes ("&amp;#x2F;"), which grows the stored text on every save and makes one category show up
// twice. Readers that hand text back to a form decode it here first; storage stays escaped.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeOnce = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
  if (code[0] === '#') {
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  }
  return NAMED[code.toLowerCase()] ?? match;
});

// Repeated, because text that was already escaped twice must come back whole too
const decodeEntities = value => {
  if (typeof value !== 'string' || !value.includes('&')) return value;
  let text = value;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = decodeOnce(text);
    if (next === text) break;
    text = next;
  }
  return text;
};

const decodeDeep = value => {
  if (typeof value === 'string') return decodeEntities(value);
  if (Array.isArray(value)) return value.map(decodeDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeDeep(item)]));
  }
  return value;
};

module.exports = { decodeEntities, decodeDeep };
