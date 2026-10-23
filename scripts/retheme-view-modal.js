#!/usr/bin/env node
/**
 * Rethemes the body of ONE view modal in a file to the warm "ViewModal" skin.
 *
 * Usage: node scripts/retheme-view-modal.js <file> <marker> [--dry]
 *
 * <marker> is a unique string on or near the line that opens the modal block
 * (e.g. `{/* View Details Modal *\/}` — the script finds the first `<Modal`
 * after it and processes up to the matching `</Modal>`).
 *
 * Inside that block it:
 *   1. Swaps neutral grey card/chrome classes for the warm palette.
 *   2. Rewrites `<div><h3 className="...">TITLE</h3>...</div>` sections as
 *      `<ViewSection title="TITLE">...</ViewSection>` when TITLE is plain
 *      text or a single {expr}.
 * It does NOT touch the Modal tag itself or the header/footer — those are
 * hand-edited so the right id/title/meta props are passed.
 */
const fs = require('fs');

const [,, file, marker, ...flags] = process.argv;
const DRY = flags.includes('--dry');
if (!file || !marker) { console.error('usage: retheme-view-modal.js <file> <marker> [--dry]'); process.exit(1); }

let src = fs.readFileSync(file, 'utf8');
const markerIdx = src.indexOf(marker);
if (markerIdx === -1) { console.error(`marker not found: ${marker}`); process.exit(1); }

// Find the opening <Modal (or <ViewModal) after the marker, then its matching close.
let openIdx = src.indexOf('<ViewModal', markerIdx);
let tagName = 'ViewModal';
if (openIdx === -1) { openIdx = src.indexOf('<Modal', markerIdx); tagName = 'Modal'; }
if (openIdx === -1) { console.error('no <Modal after marker'); process.exit(1); }
let depth = 0, closeIdx = -1;
{
  const tagRe = new RegExp(`<\\/?${tagName}\\b[^>]*?\\/?>`, 'g');
  tagRe.lastIndex = openIdx;
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const t = m[0];
    if (t.startsWith('</')) { depth--; if (depth === 0) { closeIdx = m.index + t.length; break; } }
    else if (!t.endsWith('/>')) depth++;
  }
}
if (closeIdx === -1) { console.error(`could not match </${tagName}>`); process.exit(1); }

let block = src.slice(openIdx, closeIdx);

// ---- 1. class re-skin -------------------------------------------------------
const SWAPS = [
  [/bg-gray-50\/60/g, 'bg-warm-section'],
  [/bg-gray-50/g, 'bg-warm-section'],
  [/bg-slate-50/g, 'bg-warm-section'],
  [/border-gray-200/g, 'border-warm-border'],
  [/border-gray-100/g, 'border-warm-border'],
  [/bg-purple-50/g, 'bg-warm-accent-soft'],
  [/text-purple-800/g, 'text-warm-text'],
  [/bg-amber-50/g, 'bg-warm-accent-soft'],
  [/border-amber-100/g, 'border-warm-border'],
  [/hover:bg-gray-50/g, 'hover:bg-warm-section'],
];
for (const [re, rep] of SWAPS) block = block.replace(re, rep);

// ---- 2. h3-headed section divs -> ViewSection -------------------------------
// Walk the block; whenever a <div...>'s first child element is an <h3>, turn
// the pair into <ViewSection title="..."> ... </ViewSection>.
function matchingClose(s, start) {
  // start = index of '<' of an opening tag like <div ...>
  const name = s.slice(start + 1).match(/^[A-Za-z][\w.]*/)[0];
  const re = new RegExp(`<\\/?${name}\\b[^>]*?\\/?>`, 'g');
  re.lastIndex = start;
  let d = 0, m;
  while ((m = re.exec(s)) !== null) {
    const t = m[0];
    if (t.startsWith('</')) { d--; if (d === 0) return { end: m.index + t.length, closeStart: m.index, closeTag: t }; }
    else if (!/\/>$/.test(t)) d++;
  }
  return null;
}

const h3re = /(^|\n)(\s*)<div([^>]*)>\s*<h3[^>]*>([\s\S]*?)<\/h3>/g;
function transform(src2) {
  let out = '', i = 0, changed = false;
  h3re.lastIndex = 0;
  let m;
  while ((m = h3re.exec(src2)) !== null) {
    const absDiv = m.index + m[1].length + m[2].length; // index of '<div'
    const title = m[4].trim();
    // only convert simple titles: plain text or a single {expr}
    const simple = !/[<>]/.test(title) && !/\{[^}]*\}\s*\S/.test(title);
    const match = matchingClose(src2, absDiv);
    if (!simple || !match) continue; // leave it; keep scanning after this match
    out += src2.slice(i, absDiv) + `<ViewSection `;
    const cm = m[3].match(/className="([^"]*)"/);
    const prop = cm && cm[1].trim() ? ` className="${cm[1].trim()}"` : '';
    const titleProp = /^[\w\s/&(),.'%-]+$/.test(title)
      ? `title="${title.replace(/"/g, '&quot;')}"`
      : `title={${title.replace(/^\{/, '').replace(/\}$/, '')}}`;
    out += `${titleProp}${prop}>`;
    out += src2.slice(m.index + m[0].length, match.closeStart);
    out += `</ViewSection>`;
    i = match.end;
    h3re.lastIndex = match.end;
    changed = true;
  }
  out += src2.slice(i);
  return { out, changed };
}

const { out, changed } = transform(block);
block = out;

const result = src.slice(0, openIdx) + block + src.slice(closeIdx);
if (DRY) {
  console.log(`--- ${file} [${marker}] sectionWrap=${changed}`);
  console.log(block.slice(0, 3000));
} else {
  fs.writeFileSync(file, result);
  console.log(`${file}: rethemed (sections wrapped: ${changed})`);
}
