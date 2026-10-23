#!/usr/bin/env node
/**
 * Replaces a hand-rolled view-modal header + <Modal> tag with <ViewModal ...>
 * props (letterhead + ID/title meta strip come from the component), and drops
 * a trailing footer that only holds a Close button.
 *
 * Usage: node scripts/chrome-view-modal.js <file> <marker> [--dry]
 *   <marker> unique string just before the target `<Modal` (a comment or line).
 *
 * It handles the common shapes:
 *   <Modal ...>
 *     <div ...header...>  <- contains an X close button and h2/h3 title,
 *         optional code <p>, optional chip <span>
 *     </div>
 *     <div className="p-* space-y-* overflow-y-auto ...">  <- body kept as-is
 *     ...
 *     <div ...border-t...>...Close...</div>                 <- dropped
 *   </Modal>
 *
 * If it cannot recognise the shape it prints MANUAL and leaves the file alone.
 */
const fs = require('fs');
const [,, file, marker, ...flags] = process.argv;
const DRY = flags.includes('--dry');
if (!file || !marker) { console.error('usage: chrome-view-modal.js <file> <marker> [--dry]'); process.exit(1); }

let src = fs.readFileSync(file, 'utf8');
const markerIdx = src.indexOf(marker);
if (markerIdx === -1) { console.error(`marker not found: ${marker}`); process.exit(1); }

const openIdx = src.indexOf('<Modal', markerIdx);
if (openIdx === -1) { console.error('no <Modal after marker'); process.exit(1); }

// matching </Modal>
let closeEnd = -1, closeStart = -1;
{
  const tagRe = /<\/?Modal\b[^>]*\/?>/g; tagRe.lastIndex = openIdx;
  let d = 0, m;
  while ((m = tagRe.exec(src)) !== null) {
    const t = m[0];
    if (t.startsWith('</')) { d--; if (d === 0) { closeStart = m.index; closeEnd = m.index + t.length; break; } }
    else if (!t.endsWith('/>')) d++;
  }
}
if (closeEnd === -1) { console.error('unmatched <Modal>'); process.exit(1); }

const openTagEnd = src.indexOf('>', openIdx) + 1;
const openTag = src.slice(openIdx, openTagEnd);
let inner = src.slice(openTagEnd, closeStart);

// --- locate the header div: first top-level <div> that contains an X button ---
function matchTag(s, start) {
  const name = s.slice(start + 1).match(/^[A-Za-z][\w.]*/)[0];
  const re = new RegExp(`<\\/?${name}\\b[^>]*?\\/?>`, 'g'); re.lastIndex = start;
  let d = 0, m;
  while ((m = re.exec(s)) !== null) {
    const t = m[0];
    if (t.startsWith('</')) { d--; if (d === 0) return { closeStart: m.index, end: m.index + t.length }; }
    else if (!/\/>$/.test(t)) d++;
  }
  return null;
}

// first element child of the card
const firstEl = inner.match(/\s*(\{\/\*[\s\S]*?\*\/\}\s*)*<(div|section|header)\b/);
if (!firstEl) { console.log('MANUAL: no header element'); process.exit(0); }
const headerStart = firstEl.index + firstEl[0].length - firstEl[2].length - 1;
const headerMatch = matchTag(inner, headerStart);
if (!headerMatch) { console.log('MANUAL: header not matched'); process.exit(0); }
const header = inner.slice(headerStart, headerMatch.end);
if (!/<X\b/.test(header)) { console.log('MANUAL: header has no X close button'); process.exit(0); }

// --- extract pieces from the header ---
// onClose: the onClick of the button containing <X
let onClose = null;
{
  const btnRe = /<button[\s\S]*?<\/button>/g; let bm;
  while ((bm = btnRe.exec(header)) !== null) {
    if (/<X\b/.test(bm[0])) {
      const oc = bm[0].match(/onClick=\{([\s\S]*?)\}\s*(?:className|>)/) || bm[0].match(/onClick=\{([\s\S]*?)\}/);
      if (oc) onClose = oc[1].trim();
      break;
    }
  }
}
if (!onClose) { console.log('MANUAL: no onClose found'); process.exit(0); }
if (onClose.startsWith('() =>') ) onClose = onClose; // keep arrow as-is

// title: first <h2|h3> in header
let title = null;
{
  const tm = header.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
  if (tm) {
    let t = tm[1].trim();
    // unwrap {expr}
    const em = t.match(/^\{([\s\S]*)\}$/);
    title = em ? `{${em[1].trim()}}` : `"${t.replace(/"/g, '&quot;')}"`;
    if (/[<>]/.test(t)) title = null; // contains markup -> skip auto title
  }
}

// id/code: first <p> in header holding an {expr}, usually font-mono or gray-500
let id = null;
{
  const pm = header.match(/<p[^>]*>(\{[^}]*\})<\/p>/);
  if (pm) id = pm[1];
}

// badge: a standalone chip <span> in the header (not inside a button, not the X)
let badge = null;
{
  const stripped = header.replace(/<button[\s\S]*?<\/button>/g, '');
  const sm = stripped.match(/<span[^>]*className="[^"]*(rounded-full|rounded)[^"]*"[^>]*>[\s\S]*?<\/span>/);
  if (sm) badge = sm[0];
}

// --- find the scrollable body div right after the header ---
let rest = inner.slice(headerMatch.end);
const bodyOpen = rest.match(/^(\s*)<div[^>]*className="([^"]*)"[^>]*>/);
let bodyKeepOpen = '';
if (bodyOpen) {
  const cls = bodyOpen[2];
  if (/overflow-y-auto|space-y-|p-\d/.test(cls)) {
    // keep the div but trim it to a neutral spacing wrapper
    bodyKeepOpen = `${bodyOpen[1]}<div className="space-y-4">`;
    rest = rest.slice(bodyOpen.index + bodyOpen[0].length);
  } else {
    bodyKeepOpen = '';
    rest = rest.slice(bodyOpen.index);
  }
}

// --- trailing footer with only a Close button? drop it ---
let footer = '';
{
  // look at the last <div ...>...</div> in rest
  const lastDiv = rest.lastIndexOf('<div');
  if (lastDiv !== -1) {
    const m2 = matchTag(rest, lastDiv);
    if (m2 && rest.slice(m2.end).trim() === '') {
      const f = rest.slice(lastDiv, m2.end);
      const btnCount = (f.match(/<button/g) || []).length;
      if (btnCount <= 2 && /Close/.test(f)) {
        rest = rest.slice(0, lastDiv);
      }
    }
  }
}

const props = [];
props.push(`onClose={${onClose}}`);
const wm = openTag.match(/max-w-[a-z0-9-]+/i);
if (wm) props.push(`maxWidth="${wm[0]}"`);
if (id) props.push(`id=${id}`);
if (title) props.push(`title=${title}`);
if (badge) props.push(`badge={${badge}}`);
const align = openTag.match(/align="(\w+)"/); if (align) props.push(`align="${align[1]}"`);
const zindex = openTag.match(/zIndex="([^"]+)"/); if (zindex) props.push(`zIndex="${zindex[1]}"`);
const onCloseModal = openTag.match(/onClose=\{[^}]*\}/);
// prefer the Modal's own onClose if present (more reliable than the X button's)
if (onCloseModal) props[0] = onCloseModal[0].replace('onClose=', 'onClose=');

const newBlock = `<ViewModal ${props.join('\n          ')}\n        >${bodyKeepOpen}${rest}\n        </ViewModal>`;
const result = src.slice(0, openIdx) + newBlock + src.slice(closeEnd);

if (DRY) {
  console.log(`=== ${file}`);
  console.log(newBlock.slice(0, 900));
  console.log('...');
} else {
  fs.writeFileSync(file, result);
  console.log(`${file}: chrome applied (title=${!!title}, id=${!!id}, badge=${!!badge})`);
}
