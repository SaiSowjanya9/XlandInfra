const PDFDocument = require('pdfkit');
const { customerEstimateData, stripInternalServiceDetails, billToParty } = require('../utils/estimateData');
const { estimateTermsLines } = require('../utils/estimateTerms');
const { COMPANY, COMPANY_CONTACT_LINES, COMPANY_FOOTER_LINE } = require('../utils/companyInfo');
const path = require('path');

// Logo file path - the brand mark on its own, without the typeset name, since every layout here
// sets the name itself beside it. `logo-contract.png` is `Contract Logo.png` scaled to 314px, so a
// 1.2MB original is not embedded in every emailed PDF, and with a **transparent** background: the
// same file has to read on the estimate's white letterhead and on the invoice's black header strip.
// A white-backed version showed as a white box on the strip, and the icon it replaced was a pale
// rendering that all but vanished on white.
const LOGO_PATH = path.join(__dirname, '../assets/logo-contract.png');

/**
 * Decode HTML entities (e.g., &amp; -> &, &#x2F; -> /)
 * Handles double-encoded entities like &amp;amp; -> &
 */
const decodeHtml = (html) => {
  if (!html || typeof html !== 'string') return html || '';
  const entities = {
    '&amp;amp;': '&',  // Double-encoded ampersand
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
    '&#x26;': '&'
  };
  let decoded = html;
  // Run multiple passes to handle double-encoding
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const [entity, char] of Object.entries(entities)) {
      const before = decoded;
      decoded = decoded.replace(new RegExp(entity, 'gi'), char);
      if (decoded !== before) changed = true;
    }
    // Handle numeric entities
    const before = decoded;
    decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded !== before) changed = true;
    if (!changed) break;
  }
  return decoded;
};

// ===== SHARED PDF HEADER FUNCTION =====
// Used by all PDF exports for consistent branding
const drawPDFHeader = (doc, margin) => {
  const gold = '#C9A227';
  const headerBlack = '#1a1a1a';
  const headerHeight = 22; // Thin header strip
  
  // Black header background
  doc.rect(0, 0, 595, headerHeight).fill(headerBlack);

  // The lockup -- logo, company name and the PVT LTD rule -- is measured and then centred on the
  // page rather than pinned to the left margin; PVT LTD is centred on the name above it, and the
  // two text lines are centred on the **logo's own height** rather than pinned near its top.
  // Mirrors drawPDFHeader in admin-portal/src/utils/pdfExport.js: an invoice or receipt downloaded
  // from the portal and one sent by email carry the same header.
  const pageWidth = 595;
  const logoSize = 16;
  const logoY = 3;
  const logoGap = 8;
  const lineLen = 4;
  const gap = 1.5;

  doc.fontSize(10).font('Helvetica-Bold');
  const nameWidth = doc.widthOfString('XLAND INFRA');
  const titleHeight = doc.currentLineHeight();
  doc.fontSize(4).font('Helvetica');
  const pvtLtdWidth = doc.widthOfString('PVT LTD');
  const suffixHeight = doc.currentLineHeight();
  const pvtWidth = lineLen + gap + pvtLtdWidth + gap + lineLen;

  const textWidth = Math.max(nameWidth, pvtWidth);
  const lockupWidth = logoSize + logoGap + textWidth;
  // Centred, but never tighter than the page margin
  const lockupX = Math.max(margin, (pageWidth - lockupWidth) / 2);
  const textX = lockupX + logoSize + logoGap;
  // Centred on the logo's midline, so it holds whether the text block is the taller of the two
  // The name line is centred on the logo, not the block: the suffix is light and drags a
  // block-centred midpoint down, which leaves the name riding high above the mark.
  const suffixDrop = 2;
  const blockTop = logoY + logoSize / 2 - titleHeight / 2;

  // Logo - small size
  try {
    doc.image(LOGO_PATH, lockupX, logoY, { fit: [logoSize, logoSize], align: 'center', valign: 'center' });
  } catch (logoErr) {
    doc.roundedRect(lockupX, logoY, logoSize, logoSize, 1).fill(gold);
  }

  // Company name - XLAND INFRA, centred over the text column
  doc.fontSize(10).fillColor(gold).font('Helvetica-Bold')
     .text('XLAND INFRA', textX, blockTop, { width: textWidth, align: 'center', lineBreak: false });

  // PVT LTD with a rule on each side, centred under the name
  doc.fontSize(4).fillColor(gold).font('Helvetica');
  doc.strokeColor(gold).lineWidth(0.25);

  const pvtStartX = textX + (textWidth - pvtWidth) / 2;
  const lineY = blockTop + titleHeight + suffixDrop + suffixHeight / 2;

  // Left line
  doc.moveTo(pvtStartX, lineY).lineTo(pvtStartX + lineLen, lineY).stroke();

  // PVT LTD text
  doc.text('PVT LTD', pvtStartX + lineLen + gap, lineY - 2.5, { lineBreak: false });

  // Right line
  const rightLineStart = pvtStartX + lineLen + gap + pvtLtdWidth + gap;
  doc.moveTo(rightLineStart, lineY).lineTo(rightLineStart + lineLen, lineY).stroke();

  return headerHeight + 8; // Return starting Y position for content
};

// ===== ESTIMATE LETTERHEAD =====
// An estimate opens as a letter does: the logo, XLAND INFRA with PVT LTD ruled beneath it and the
// company's own contact lines down the left, and BILL TO -- the customer -- facing them on the
// right; under both, a strip naming the document, its number, date, type and billing cycle.
// `drawPDFHeader` above is the centred brand strip, which the invoice still uses; a centred lockup
// leaves nowhere for two facing blocks. Mirrors drawEstimateLetterhead in
// admin-portal/src/utils/pdfExport.js, so a downloaded estimate and an emailed one are the same
// document.
/** Figures read the same on every document: grouped the Indian way, paise only where they exist. */
const money = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Dates read the same on every document: 29 Sep 2026, in IST. */
const formatDocumentDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  : '-');

// The portal's warm palette (`admin-portal/tailwind.config.js`), which every document is drawn in
const WARM = {
  section: '#FFF9EE',
  accentSoft: '#FEF3E2',
  border: '#EADFCF',
  accent: '#D4A574',
  text: '#1F2937',
  muted: '#6B7280'
};

// The icon beside a contact line, drawn from primitives rather than from a glyph: Helvetica has no
// handset or envelope, and embedding a symbol font or three PNGs for 8pt of line art is not worth
// the bytes in a document that is emailed. Mirrors drawContactIcon in the portal's pdfExport.js.
const drawContactIcon = (doc, kind, x, y, size) => {
  doc.strokeColor('#C9A227').lineWidth(0.6);
  if (kind === 'phone') {
    // A handset: a rounded body with the earpiece slot across the top. Narrower than this and it
    // reads as a plain bar at 7pt.
    const width = size * 0.66;
    const left = x + (size - width) / 2;
    doc.roundedRect(left, y, width, size, size * 0.18).stroke();
    doc.moveTo(left + width * 0.28, y + size * 0.19).lineTo(left + width * 0.72, y + size * 0.19).stroke();
  } else if (kind === 'email') {
    // An envelope: the body, and the flap folding to its middle
    const top = y + size * 0.16;
    const height = size * 0.68;
    doc.roundedRect(x, top, size, height, size * 0.1).stroke();
    doc.moveTo(x, top).lineTo(x + size / 2, top + height * 0.55).lineTo(x + size, top).stroke();
  } else if (kind === 'website') {
    // A globe: the sphere, its meridian and its equator
    const radius = size / 2;
    doc.circle(x + radius, y + radius, radius).stroke();
    doc.ellipse(x + radius, y + radius, radius * 0.45, radius).stroke();
    doc.moveTo(x, y + radius).lineTo(x + size, y + radius).stroke();
  }
};

/**
 * The letterhead every customer-facing document opens with -- estimate, invoice and receipt alike,
 * so a customer who receives all three receives one house style rather than three.
 *
 * `party` is the card facing the company: `{ title, name, rows }`. `meta` is the ruled strip's
 * fields, `[label, value]`, shared out evenly across the width.
 */
const drawLetterhead = (doc, margin, { party = {}, meta = [] } = {}) => {
  const pageWidth = 595;
  const gold = '#C9A227';
  const labelGray = '#6b7280';

  // --- Left: the company, running down one edge ---
  // The logo sits at the page margin with the name beside it; the tagline, address and contact
  // lines then start on that same edge, directly under the logo. Centring them under the whole
  // lockup pushed the details left of the mark that introduces them.
  const logoSize = 46;
  const logoY = 22;
  const logoGap = 11;
  const ruleLength = 12;
  const ruleGap = 4;
  const iconSize = 7;
  const iconTextGap = 3;                                  // icon to its own value
  const contactGap = 11;                                  // one contact to the next along the line

  doc.fontSize(14).font('Helvetica-Bold');
  const nameWidth = doc.widthOfString(COMPANY.name, { characterSpacing: 1.2 });

  const taglineText = String(COMPANY.tagline).toUpperCase();

  // The phone, the email and the website sit on **one line** beneath the address, each behind its
  // own icon. Stacked, the three of them made the letterhead a column six lines deep for what is
  // one thought -- how to reach us. A point smaller than the address, because three of them on a
  // line have to clear the BILL TO card facing them.
  doc.fontSize(7).font('Helvetica');
  const contactItems = COMPANY_CONTACT_LINES.map(([kind, value]) => ({
    kind, value: String(value), width: iconSize + iconTextGap + doc.widthOfString(String(value))
  }));

  // Every line of the block starts on the page's left edge, under the logo itself.
  const textLeft = margin;

  const logoX = margin;
  try {
    // `fit` rather than width and height: forcing a non-square icon square squashed it
    doc.image(LOGO_PATH, logoX, logoY, { fit: [logoSize, logoSize], align: 'center', valign: 'center' });
  } catch (logoErr) {
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 2).fill(gold);
  }

  // **The name line is centred on the logo, not the block.** Centring the whole block -- name plus
  // ruled suffix -- puts its midpoint on the logo's midline, and since the suffix is a light line of
  // 5.5pt text it drags that midpoint down, leaving the name itself riding high above the mark. The
  // name is what the eye pairs with the logo, so its own centre sits on the logo's centre and the
  // suffix hangs beneath.
  const textX = logoX + logoSize + logoGap;
  doc.fontSize(14).font('Helvetica-Bold');
  const titleHeight = doc.currentLineHeight();
  doc.fontSize(5.5).font('Helvetica');
  const suffixDrop = 5;                                   // name baseline to the rule
  const blockTop = logoY + logoSize / 2 - titleHeight / 2;
  // The furthest right the company block reaches: the party card may grow leftward up to this, so
  // a long email or property code keeps to one line inside it.
  let companyRight = textX + nameWidth;

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a1a1a')
     .text(COMPANY.name, textX, blockTop, { characterSpacing: 1.2, lineBreak: false });

  // PVT LTD, ruled on both sides and centred under the name, in the same near-black as the name
  doc.fontSize(5.5).font('Helvetica').fillColor('#1a1a1a');
  const suffixWidth = doc.widthOfString(COMPANY.suffix, { characterSpacing: 1.8 });
  const lockupWidth = ruleLength + ruleGap + suffixWidth + ruleGap + ruleLength;
  const suffixX = textX + Math.max(0, (nameWidth - lockupWidth) / 2);
  const ruleY = blockTop + titleHeight + suffixDrop;
  doc.strokeColor('#1a1a1a').lineWidth(0.4);
  doc.moveTo(suffixX, ruleY).lineTo(suffixX + ruleLength, ruleY).stroke();
  doc.text(COMPANY.suffix, suffixX + ruleLength + ruleGap, ruleY - 3, { characterSpacing: 1.8, lineBreak: false });
  doc.moveTo(suffixX + lockupWidth - ruleLength, ruleY).lineTo(suffixX + lockupWidth, ruleY).stroke();

  doc.fontSize(6.5).font('Helvetica').fillColor(labelGray)
     .text(taglineText, textLeft, logoY + logoSize + 6, { characterSpacing: 0.7, lineBreak: false });
  companyRight = Math.max(companyRight, textLeft + doc.widthOfString(taglineText, { characterSpacing: 0.7 }));

  let lineY = logoY + logoSize + 18;
  doc.fontSize(7.5);
  COMPANY.addressLines.forEach(line => {
    doc.fillColor('#4b5563').text(line, textLeft, lineY, { lineBreak: false });
    companyRight = Math.max(companyRight, textLeft + doc.widthOfString(line));
    lineY += 10;
  });
  // The contact line sits a little apart from the address, so the two read as separate blocks
  lineY += 5;

  // The one contact line, under the address
  doc.fontSize(7);
  let contactX = textLeft;
  contactItems.forEach(item => {
    // The icon sits on the line's x-height rather than its baseline, or it floats above the text
    drawContactIcon(doc, item.kind, contactX, lineY + 0.5, iconSize);
    doc.fillColor('#4b5563').text(item.value, contactX + iconSize + iconTextGap, lineY, { lineBreak: false });
    contactX += item.width + contactGap;
  });
  companyRight = Math.max(companyRight, contactX - contactGap);
  const companyBottom = lineY + 11;

  // --- Right: the party the document is addressed to ---
  // The card is exactly as wide as its widest single-line value -- an email or a property code
  // stays whole on one line -- never narrower than 200pt and never reaching into the company block.
  const rows = (party.rows || []).filter(([, value]) => value !== undefined && value !== null && value !== '');
  doc.fontSize(7).font('Helvetica');
  const widestValue = rows.reduce((width, [, value]) => Math.max(width, doc.widthOfString(decodeHtml(String(value)))), 0);
  const boxWidth = Math.min(Math.max(200, widestValue + 72), Math.max(200, pageWidth - margin - companyRight - 10));
  const boxX = pageWidth - margin - boxWidth;
  const capHeight = 16;

  // Measured before anything is drawn, so the box is exactly as tall as its contents
  const nameText = decodeHtml(String(party.name || '-'));
  doc.fontSize(9.5).font('Helvetica-Bold');
  const nameHeight = doc.heightOfString(nameText, { width: boxWidth - 16 });
  doc.fontSize(7).font('Helvetica');
  // A value too long to sit beside its label -- a very long email -- drops to its own line across
  // the card's full width rather than snapping mid-word.
  const valueTexts = rows.map(([, value]) => decodeHtml(String(value)));
  const valueFits = valueTexts.map(text => doc.widthOfString(text) <= boxWidth - 62);
  const rowHeights = valueTexts.map((text, index) => {
    const height = doc.heightOfString(text, { width: valueFits[index] ? boxWidth - 62 : boxWidth - 20 });
    return valueFits[index] ? height : height + 8;
  });
  const bodyHeight = 10 + nameHeight + 4 + rowHeights.reduce((sum, height) => sum + height + 2, 0) + 8;

  doc.rect(boxX, logoY, boxWidth, capHeight + bodyHeight).fillAndStroke('#ffffff', WARM.border);
  doc.rect(boxX, logoY, boxWidth, capHeight).fill(WARM.accentSoft);
  doc.strokeColor(WARM.border).lineWidth(0.5)
     .moveTo(boxX, logoY + capHeight).lineTo(boxX + boxWidth, logoY + capHeight).stroke();
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#8A6D12')
     .text(String(party.title || 'Bill To').toUpperCase(), boxX + 10, logoY + 5.5, { characterSpacing: 1.4, lineBreak: false });

  let rowY = logoY + capHeight + 10;
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#111827')
     .text(nameText, boxX + 10, rowY, { width: boxWidth - 16 });
  rowY += nameHeight + 4;

  rows.forEach(([label], index) => {
    doc.fontSize(6).font('Helvetica-Bold').fillColor(labelGray)
       .text(String(label).toUpperCase(), boxX + 10, rowY + 1, { width: 42, lineBreak: false });
    doc.fontSize(7).font('Helvetica').fillColor('#374151')
       .text(valueTexts[index], boxX + (valueFits[index] ? 52 : 10), valueFits[index] ? rowY : rowY + 8,
         { width: valueFits[index] ? boxWidth - 62 : boxWidth - 20 });
    rowY += rowHeights[index] + 2;
  });

  // --- The strip naming the document ---
  let y = Math.max(companyBottom, logoY + capHeight + bodyHeight) + 12;
  const stripHeight = 30;
  doc.rect(margin, y, pageWidth - margin * 2, stripHeight).fill(WARM.section);
  doc.strokeColor(WARM.border).lineWidth(0.6);
  doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke();
  doc.moveTo(margin, y + stripHeight).lineTo(pageWidth - margin, y + stripHeight).stroke();

  // The strip does not announce what the document is -- that is never in doubt -- so its fields
  // share the width evenly instead of crowding to the left of a label.
  const stripWidth = pageWidth - margin * 2;
  const stated = meta.filter(([, value]) => value !== undefined && value !== null && value !== '');
  const fieldWidth = (stripWidth - 32) / Math.max(stated.length, 1);
  const fields = stated.map(([label, value], index) => [label, value, margin + 16 + index * fieldWidth, fieldWidth - 10]);
  fields.forEach(([label, value, x, width]) => {
    doc.fontSize(5.5).font('Helvetica').fillColor(labelGray)
       .text(label, x, y + 7, { width, characterSpacing: 0.4, lineBreak: false });
    // One line only: the strip is a glance, and a wrapped value would push into the row below
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827')
       .text(String(value), x, y + 17, { width, lineBreak: false, ellipsis: true });
  });

  doc.font('Helvetica');
  return y + stripHeight + 18;
};

/** The letterhead an estimate opens with: the billed party in BILL TO, the estimate named in the strip. */
const drawEstimateLetterhead = (doc, margin, estimate) => {
  const billing = String(estimate.billingDuration || estimate.billing_duration || 'Yearly');
  const estimateType = String(estimate.estimateType || '-').replace(/_/g, ' ');
  const sentence = text => String(text).charAt(0).toUpperCase() + String(text).slice(1);
  // A gated community or apartment estimate is billed to the property, which headlines the
  // card; a villa, flat or plot is billed to the customer, and the property stays a row.
  const billedTo = billToParty(estimate);
  return drawLetterhead(doc, margin, {
    party: {
      title: 'Bill To',
      name: billedTo.name,
      rows: [
        ['Contact', billedTo.contact],
        ['Phone', estimate.customerPhone],
        ['Email', estimate.customerEmail],
        ['Property', billedTo.property],
        ['Prop ID', estimate.propertyCode],
        ['City', estimate.city]
      ]
    },
    meta: [
      ['ESTIMATE NO.', estimate.estimateId || '-'],
      ['DATE', formatDocumentDate(estimate.createdAt)],
      ['TYPE', sentence(estimateType)],
      ['BILLING', sentence(billing.replace('-', ' '))]
    ]
  });
};

const PAGE = { width: 595, bottom: 772 };
const CONTENT = PAGE.width - 100;                          // A4 less a 50pt margin either side
const DOC_GAP = { heading: 17, row: 7, section: 14 };
const stated = field => Array.isArray(field) && field[1] !== undefined && field[1] !== null && field[1] !== '';

/** A section's name, in warm text, with air beneath it before whatever it introduces. */
const drawSectionHeading = (doc, y, text, margin = 50) => {
  doc.fontSize(10).fillColor(WARM.text).font('Helvetica-Bold').text(text, margin, y, { lineBreak: false });
  return y + DOC_GAP.heading;
};

/**
 * A section's fields as a ruled table: the label in a cream cell, its value in the white cell
 * beside it, two pairs to a line, so the block lines up with the items table under it. `wide` rows
 * -- an address, a description -- take a line of their own. Empty fields are dropped before
 * anything is placed, so the rest close up rather than leaving a hole in mid-air.
 */
const drawDetailTable = (doc, y, fields, { margin = 50, wide = [] } = {}) => {
  const pairWidth = CONTENT / 2;
  const labelWidth = 96;
  const pad = 6;
  const pairs = fields.filter(stated);
  const wideRows = wide.filter(stated);
  if (!pairs.length && !wideRows.length) return y;

  const lines = [];
  for (let index = 0; index < pairs.length; index += 2) lines.push({ cells: pairs.slice(index, index + 2), full: false });
  wideRows.forEach(field => lines.push({ cells: [field], full: true }));

  const top = y;
  lines.forEach(({ cells, full }) => {
    const width = full ? CONTENT : pairWidth;
    doc.fontSize(8).font('Helvetica-Bold');
    const height = Math.max(18, ...cells.map(([, value]) =>
      doc.heightOfString(decodeHtml(String(value)), { width: width - labelWidth - pad * 2 }) + pad * 2));

    cells.forEach(([label, value], pair) => {
      const x = margin + (full ? 0 : pair * pairWidth);
      doc.rect(x, y, labelWidth, height).fillAndStroke(WARM.section, WARM.border);
      doc.rect(x + labelWidth, y, width - labelWidth, height).fillAndStroke('#ffffff', WARM.border);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(WARM.muted)
         .text(String(label).toUpperCase(), x + pad, y + pad + 1, { width: labelWidth - pad * 2, lineBreak: false });
      doc.fontSize(8).font('Helvetica-Bold').fillColor(WARM.text)
         .text(decodeHtml(String(value)), x + labelWidth + pad, y + pad, { width: width - labelWidth - pad * 2 });
    });
    // An odd last pair leaves no half-empty cell behind: the line is closed off plainly
    if (cells.length === 1 && !full) doc.rect(margin + pairWidth, y, pairWidth, height).fillAndStroke('#ffffff', WARM.border);
    y += height;
  });
  doc.rect(margin, top, CONTENT, y - top).stroke(WARM.border);
  return y;
};

/**
 * The items on the document: a cream header of uppercase labels, and white rows told apart by the
 * rule between them -- never by banding, which made the table the loudest thing on the page. The
 * header repeats when the table crosses a page.
 *
 * `columns` are `{ label, width, align }` and add up to the content width; `rows` are arrays of
 * cell values in the same order.
 */
const drawItemsTable = (doc, y, { columns, rows, margin = 50 }) => {
  const pad = 8;
  const edges = columns.reduce((all, column) => [...all, all[all.length - 1] + column.width], [margin]);
  const cellWidth = index => columns[index].width - pad * 2;

  const header = () => {
    doc.rect(margin, y, CONTENT, 20).fillAndStroke(WARM.section, WARM.border);
    doc.fontSize(7).font('Helvetica-Bold').fillColor(WARM.muted);
    columns.forEach((column, index) => doc.text(String(column.label).toUpperCase(), edges[index] + pad, y + 7,
      { width: cellWidth(index), align: column.align || 'left', lineBreak: false, ellipsis: false }));
    y += 20;
  };

  header();
  rows.forEach(cells => {
    doc.fontSize(8).font('Helvetica');
    const height = Math.max(24, ...cells.map((text, column) =>
      doc.heightOfString(String(text), { width: cellWidth(column) }) + pad * 2));
    if (y + height > PAGE.bottom - 60) { doc.addPage(); y = margin; header(); }
    doc.rect(margin, y, CONTENT, height).fillAndStroke('#ffffff', WARM.border);
    doc.fontSize(8).font('Helvetica').fillColor(WARM.text);
    cells.forEach((text, column) => doc.text(String(text), edges[column] + pad, y + pad,
      { width: cellWidth(column), align: columns[column].align || 'left' }));
    y += height;
  });
  return y + DOC_GAP.row;
};

/**
 * The money, in a card against the right edge: the figures line up on one edge, the labels on
 * another, and the total is ruled off on the tan accent so it is the last thing the eye lands on.
 * Dark text on the tan -- white on it does not meet contrast.
 */
const drawSummaryCard = (doc, y, { rows = [], total, caption = 'Price Summary', margin = 50 }) => {
  const width = 205;
  const x = margin + CONTENT - width;
  const capHeight = 16;
  const rowHeight = 15;
  const totalHeight = 24;
  if (y + capHeight + rows.length * rowHeight + 6 + totalHeight > PAGE.bottom - 16) { doc.addPage(); y = margin; }

  doc.rect(x, y, width, capHeight + rows.length * rowHeight + 6).fillAndStroke('#ffffff', WARM.border);
  doc.rect(x, y, width, capHeight).fill(WARM.section);
  doc.strokeColor(WARM.border).lineWidth(0.6).moveTo(x, y + capHeight).lineTo(x + width, y + capHeight).stroke();
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(WARM.muted)
     .text(String(caption).toUpperCase(), x + 10, y + 5.5, { characterSpacing: 1.2, lineBreak: false });

  let rowY = y + capHeight + 5;
  rows.forEach(([label, value, colour]) => {
    doc.fontSize(8).font('Helvetica').fillColor(WARM.muted).text(label, x + 10, rowY, { width: 110, lineBreak: false });
    doc.font('Helvetica-Bold').fillColor(colour || WARM.text)
       .text(value, x + 120, rowY, { width: width - 130, align: 'right', lineBreak: false });
    rowY += rowHeight;
  });

  const totalY = y + capHeight + rows.length * rowHeight + 6;
  doc.rect(x, totalY, width, totalHeight).fill(WARM.accent);
  doc.fontSize(7).font('Helvetica-Bold').fillColor(WARM.text)
     .text(String(total[0]).toUpperCase(), x + 10, totalY + 8.5, { characterSpacing: 1.4, lineBreak: false });
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor(WARM.text)
     .text(total[1], x + 60, totalY + 7, { width: width - 70, align: 'right', lineBreak: false });
  doc.font('Helvetica');
  return totalY + totalHeight + DOC_GAP.section;
};

/**
 * The footer: the company and how to reach it, centred, and nothing else. No "computer-generated
 * document" note, no automated-mail disclaimer, no watermark -- these are documents a customer is
 * asked to act on, and a disclaimer across one reads as though it were a draft. It stays inside the
 * bottom margin, or PDFKit flows it onto a blank extra page.
 */
const drawDocumentFooter = (doc, y, margin = 50) => {
  const footerY = PAGE.bottom;
  if (y >= footerY - 14) return;
  doc.strokeColor(WARM.border).lineWidth(0.5).moveTo(margin, footerY - 8).lineTo(margin + CONTENT, footerY - 8).stroke();
  doc.fontSize(6).font('Helvetica').fillColor('#9ca3af')
     .text(COMPANY_FOOTER_LINE, margin, footerY, { width: CONTENT, align: 'center', lineBreak: false });
};

// Generate estimate PDF and return as buffer
const generateEstimatePDF = async (estimate) => {
  estimate = customerEstimateData(estimate);
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        estimateId, estimateType, customerName, customerEmail, customerPhone,
        propertyName, propertyType, propertyCode, zone, division, city, address,
        numberOfBlocks, totalUnits, towerName, blockNumber, villaPlotNumber,
        packageName, packagePrice, amcPackageDescription, services, addons,
        subtotal, discount, discountAmount, tax, gstPercent, total, description, createdAt,
        billingDuration, billing_duration,
        // Terms & Conditions, printed only when the estimate was created with them
        includeTerms,
        // Work Order Estimate fields
        isWorkOrderEstimate, workOrderId, workOrderCategory, workOrderSubcategory,
        workOrderDescription, workOrderPriority, workOrderStatus
      } = estimate;

      // Debug log received values
      console.log('[PDF Service] Received price values:', {
        subtotal, discount, discountAmount, tax, gstPercent, total
      });
      console.log('[PDF Service] isWorkOrderEstimate:', isWorkOrderEstimate, 'estimateType:', estimateType, 'workOrderId:', workOrderId);

      // Ensure numeric values are valid (handle NaN, undefined, null) - round to whole numbers
      const safeNum = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : Math.round((num + Number.EPSILON) * 100) / 100;
      };
      const safeSubtotal = safeNum(subtotal);
      const safeDiscount = safeNum(discount);
      const safeDiscountAmount = safeNum(discountAmount);
      const safeTax = safeNum(tax);
      const safeGstPercent = safeNum(gstPercent);
      const safeTotal = safeNum(total);

      // Colors. The estimate is drawn in the portal's warm palette (`tailwind.config.js`), so it
      // reads the same on paper as it does on screen: cream section bars, warm rules, the tan
      // accent on the total. `navy` is kept as the name every heading is set in, but it is the
      // warm text colour now -- nothing in an estimate is slate blue.
      const black = '#1a1a1a';
      const gold = '#d4a84b';
      const navy = WARM.text;
      const lightGray = WARM.section;

      // ===== HEADER =====
      // The letterhead: company left, BILL TO right, and the strip naming the estimate under both
      let y = drawEstimateLetterhead(doc, 50, estimate);

      // ===== LAYOUT GRID =====
      // One grid and one set of gaps for the whole document. Every label sits on one of two column
      // edges and every value under its own label, so nothing depends on a hand-picked X again.
      const MARGIN = 50;
      const CONTENT_WIDTH = 495;          // 595pt page less both margins
      const COL_GUTTER = 15;
      // Three columns, because the detail fields are short: a two-column grid left half of every
      // line empty and stretched the front page over most of a sheet.
      const COLUMNS = 3;
      const COL_WIDTH = (CONTENT_WIDTH - COL_GUTTER * (COLUMNS - 1)) / COLUMNS;
      const COL_X = Array.from({ length: COLUMNS }, (_, index) => MARGIN + index * (COL_WIDTH + COL_GUTTER));
      const LABEL_COLOR = '#6b7280';
      // `heading` is the drop from a heading's top to the first thing under it. A 10pt line is
      // about 11pt tall, so the old 11 left the heading sitting directly on its own content.
      const GAP = { heading: 17, row: 7, section: 14, label: 8.5 };
      const pageHeight = 780;             // A4 usable height
      const money = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

      const sectionHeading = text => {
        doc.fontSize(10).fillColor(navy).font('Helvetica-Bold').text(text, MARGIN, y, { lineBreak: false });
        y += GAP.heading;
      };

      /**
       * A section's fields as a ruled table: the label in a cream cell, its value in the white
       * cell beside it, two pairs to a line. Every cell is on the same grid, so the block lines up
       * with the services table under it. It replaces the floating label-over-value grid, where
       * each field found its own baseline and a missing one left a hole in mid-air.
       *
       * A value too long for half the width -- an address -- is passed as `wide` and takes a line
       * of its own. Empty fields are dropped before anything is placed, so the rest close up.
       */
      const PAIR_WIDTH = CONTENT_WIDTH / 2;
      const LABEL_WIDTH = 96;
      const CELL_PADDING = 6;
      const detailTable = (fields, { wide = [] } = {}) => {
        const present = fields.filter(field => Array.isArray(field) && field[1] !== undefined && field[1] !== null && field[1] !== '');
        const wideRows = wide.filter(field => Array.isArray(field) && field[1] !== undefined && field[1] !== null && field[1] !== '');
        if (!present.length && !wideRows.length) return;

        const lines = [];
        for (let index = 0; index < present.length; index += 2) lines.push(present.slice(index, index + 2));
        wideRows.forEach(field => lines.push([field]));

        const top = y;
        lines.forEach((line, lineIndex) => {
          const full = line.length === 1 && lineIndex >= Math.ceil(present.length / 2);
          const valueWidth = (full ? CONTENT_WIDTH : PAIR_WIDTH) - LABEL_WIDTH - CELL_PADDING * 2;
          doc.fontSize(8).font('Helvetica-Bold');
          const height = Math.max(18, ...line.map(([, value]) =>
            doc.heightOfString(decodeHtml(String(value)), { width: valueWidth }) + CELL_PADDING * 2));

          line.forEach(([label, value], pair) => {
            const x = MARGIN + (full ? 0 : pair * PAIR_WIDTH);
            const width = full ? CONTENT_WIDTH : PAIR_WIDTH;
            doc.rect(x, y, LABEL_WIDTH, height).fillAndStroke(WARM.section, WARM.border);
            doc.rect(x + LABEL_WIDTH, y, width - LABEL_WIDTH, height).fillAndStroke('#ffffff', WARM.border);
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor(LABEL_COLOR)
               .text(String(label).toUpperCase(), x + CELL_PADDING, y + CELL_PADDING + 1,
                 { width: LABEL_WIDTH - CELL_PADDING * 2, lineBreak: false });
            doc.fontSize(8).font('Helvetica-Bold').fillColor(WARM.text)
               .text(decodeHtml(String(value)), x + LABEL_WIDTH + CELL_PADDING, y + CELL_PADDING,
                 { width: width - LABEL_WIDTH - CELL_PADDING * 2 });
          });
          // An odd last pair leaves no half-empty cell behind: the line is closed off plainly
          if (line.length === 1 && !full) {
            doc.rect(MARGIN + PAIR_WIDTH, y, PAIR_WIDTH, height).fillAndStroke('#ffffff', WARM.border);
          }
          y += height;
        });
        // One outline around the whole block, so the inner rules read as a grid rather than boxes
        doc.rect(MARGIN, top, CONTENT_WIDTH, y - top).stroke(WARM.border);
      };

      // The estimate number and date are in the letterhead strip above, and the customer is in
      // BILL TO beside it, so neither is stated again here.
      const propTypeLabel = { 'GC': 'Gated Community', 'APT': 'Apartment', 'VILLA': 'Villa', 'PLOT': 'Plot' }[propertyType] || propertyType;

      sectionHeading('Property Details');
      detailTable([
        ['Name', propertyName], ['Type', propTypeLabel], ['Property ID', propertyCode],
        ['Zone', zone], ['Division', division], ['City', city],
        ['Blocks', numberOfBlocks], ['Total Units', totalUnits],
        ['Tower / Building', towerName], ['Block Number', blockNumber], ['Villa / Plot Number', villaPlotNumber]
      ], { wide: [['Address', address]] });
      y += GAP.section;

      // Work Order Details (only for work order estimates) - same two columns as the sections above
      if (isWorkOrderEstimate && workOrderId) {
        sectionHeading('Work Order Details');
        detailTable([
          ['Work Order ID', workOrderId], ['Category', workOrderCategory],
          ['Subcategory', workOrderSubcategory], ['Priority', String(workOrderPriority || '').toUpperCase()]
        ]);
        y += GAP.section;
      }

      // Package Description - the panel is as tall as the text measures, not a guess from its length
      if (amcPackageDescription) {
        const decodedPkgDesc = decodeHtml(amcPackageDescription);
        sectionHeading('Package Description');
        doc.fontSize(8).font('Helvetica');
        const boxHeight = doc.heightOfString(decodedPkgDesc, { width: CONTENT_WIDTH - 20, lineGap: 2 }) + 16;
        if (y + boxHeight > pageHeight) { doc.addPage(); y = MARGIN; }
        doc.rect(MARGIN, y, CONTENT_WIDTH, boxHeight).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#444444').text(decodedPkgDesc, MARGIN + 10, y + 8, { width: CONTENT_WIDTH - 20, lineGap: 2 });
        y += boxHeight + GAP.section;
      }

      // Services rows - ensure it's an array
      let svcList = services;
      if (!Array.isArray(svcList)) {
        if (typeof svcList === 'string') {
          try { svcList = JSON.parse(svcList); } catch (e) { svcList = []; }
        } else {
          svcList = [];
        }
      }
      if (!Array.isArray(svcList)) svcList = [];

      // ===== SERVICES TABLE =====
      // Both service lists share one renderer: the columns add up to the content width, every cell
      // carries the same padding, a row is as tall as its tallest cell actually measures rather
      // than a guess from character count, and the header repeats when a table crosses a page.
      // Every field of a service the customer is entitled to read has a column: what it is, what it
      // covers, how it is priced and what was measured, how often and how many visits -- every column
      // of the portal's estimate view except its internal Vendor Cost, XLAND Cost and Margin %. No
      // Price and no Qty column: no service states a price
      // of its own -- the estimate is priced as a whole, in Total Services Price and the Price
      // Summary -- and the printed and downloaded estimate reads the same.
      const TABLE_COLS = [
        { label: '#', width: 22, align: 'left' },
        // The view's order: name, description, what was measured, how it is priced, schedule
        { label: 'Service', width: 92, align: 'left' },
        { label: 'Description', width: 125, align: 'left' },
        { label: 'Input / Details', width: 84, align: 'left' },
        { label: 'Method', width: 62, align: 'left' },
        { label: 'Frequency', width: 66, align: 'left' },
        // Wide enough for the word VISITS set in caps: at 40pt it broke after VISIT
        { label: 'Visits', width: 44, align: 'right' }
      ];
      const CELL_PAD = 8;
      const COL_EDGES = TABLE_COLS.reduce((edges, col) => [...edges, edges[edges.length - 1] + col.width], [MARGIN]);
      const cellWidth = index => TABLE_COLS[index].width - CELL_PAD * 2;

      // The cream skin the portal's services table is drawn in: a warm section bar with muted
      // labels, warm rules between the rows, and figures in warm text
      const drawTableHeader = () => {
        doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fillAndStroke(WARM.section, WARM.border);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(WARM.muted);
        TABLE_COLS.forEach((col, index) => doc.text(col.label.toUpperCase(), COL_EDGES[index] + CELL_PAD, y + 7,
          { width: cellWidth(index), align: col.align, lineBreak: false, ellipsis: false }));
        y += 20;
      };

      const drawServicesTable = rows => {
        drawTableHeader();
        rows.forEach((row, index) => {
          const cells = [String(index + 1), row.name, row.details, row.input, row.method, row.frequency, String(row.visits)];
          doc.fontSize(8).font('Helvetica');
          const height = Math.max(24, ...cells.map((text, column) =>
            doc.heightOfString(String(text), { width: cellWidth(column) }) + CELL_PAD * 2));
          if (y + height > pageHeight) { doc.addPage(); y = MARGIN; drawTableHeader(); }
          // White, every row: the cream belongs to the column header alone, and the rule between
          // rows is enough to tell them apart. Banding the body made the table shout.
          doc.rect(MARGIN, y, CONTENT_WIDTH, height).fillAndStroke('#ffffff', WARM.border);
          doc.fontSize(8).font('Helvetica').fillColor(WARM.text);
          cells.forEach((text, column) => doc.text(String(text), COL_EDGES[column] + CELL_PAD, y + CELL_PAD,
            { width: cellWidth(column), align: TABLE_COLS[column].align }));
          y += height;
        });
        y += GAP.row;
      };

      // `tag` marks a package's own service in the combined table, under its name and category
      const tableRow = (item, tag = '') => ({
        // The category says what kind of service this is, so it reads under the name rather than
        // among the details in the Description column
        name: [decodeHtml(item.name || item.service_name || item.serviceName || item.service || 'Service'),
          decodeHtml(item.category || ''), tag].filter(Boolean).join('\n'),
        // Property Types is catalog configuration, not something a customer document states
        details: stripInternalServiceDetails(decodeHtml(item.details || item.description || item.service_description || '-')) || '-',
        frequency: String(item.frequencyType || item.frequency_type || item.frequency || 'Monthly').replace(/^\d+x\s*/i, ''),
        visits: item.frequency_count ?? item.frequencyCount ?? item.visits ?? 1,
        method: item.method || '-',
        input: item.input || '-'
      });

      // Only show Services Table for NON-work order estimates
      const hasWorkOrderId = workOrderId && String(workOrderId).length > 0;
      const isWOEstimate = isWorkOrderEstimate || hasWorkOrderId || estimateType === 'work_order';
      
      // Billing is stated in the letterhead strip, so it is not repeated here


      // Add-ons Table (if any) - ensure it's an array
      // Skip for Work Order Estimates - they don't have add-ons
      let addonList = addons;
      if (!Array.isArray(addonList)) {
        if (typeof addonList === 'string') {
          try { addonList = JSON.parse(addonList); } catch (e) { addonList = []; }
        } else {
          addonList = [];
        }
      }
      if (!Array.isArray(addonList)) addonList = [];
      // Skip for Work Order Estimates
      // The package's own services and the services added to it are one table, numbered straight
      // through -- the package's marked "Package" under their name -- as the printed copy has them
      const tableRows = [...svcList.map(item => tableRow(item, packageName ? 'Package' : '')), ...addonList.map(item => tableRow(item))];
      if (!isWOEstimate && tableRows.length > 0) {
        // The heading and its first row stay together rather than splitting across a page
        doc.fontSize(8).font('Helvetica');
        const firstRow = tableRows[0];
        const firstHeight = Math.max(24, doc.heightOfString(firstRow.details, { width: cellWidth(2) }) + CELL_PAD * 2);
        if (y + GAP.heading + 20 + firstHeight > pageHeight) { doc.addPage(); y = MARGIN; }

        sectionHeading('Services');
        drawServicesTable(tableRows);
      }
      // Total Services Price is the whole of it -- the package price plus the added services -- so
      // it agrees with the Price Summary's subtotal; it used to leave the package out. A small line
      // under it names the package, as the portal's estimate view and printed copy do.
      const pkgPrice = Number(packagePrice) || 0;
      if (!isWOEstimate && (addonList.length > 0 || pkgPrice > 0)) {
        if (y + 30 > pageHeight) { doc.addPage(); y = MARGIN; }
        const addonsTotal = addonList.reduce((sum, addon) => sum + Number(addon.totalPrice ?? addon.price ?? 0), 0);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(navy)
           .text(`Total Services Price: Rs. ${money(pkgPrice + addonsTotal)}`, MARGIN, y, { width: CONTENT_WIDTH, align: 'right', lineBreak: false });
        if (packageName && pkgPrice > 0) {
          y += 13;
          doc.fontSize(7).font('Helvetica').fillColor('#6B7280')
             .text(`Includes the AMC package "${decodeHtml(String(packageName))}" at Rs. ${money(pkgPrice)}.`, MARGIN, y, { width: CONTENT_WIDTH, align: 'right', lineBreak: false });
        }
        y += GAP.section;
      }

      // Check if Price Summary needs new page
      if (y + 60 > pageHeight) {
        doc.addPage();
        y = 50;
      }
      
      // ===== PRICE SUMMARY =====
      // A money block reads down its own right edge: the figures line up on one edge, the labels
      // on another, and the total is ruled off in black so it is the last thing the eye lands on.
      const SUMMARY_WIDTH = 205;
      const SUMMARY_X = MARGIN + CONTENT_WIDTH - SUMMARY_WIDTH;
      const CAP_HEIGHT = 16;
      const ROW_HEIGHT = 15;
      const TOTAL_HEIGHT = 24;
      const summaryRows = [
        ['Subtotal', `Rs. ${money(safeSubtotal)}`],
        ...(safeDiscount > 0 || safeDiscountAmount > 0 ? [[`Discount (${safeDiscount}%)`, `- Rs. ${money(safeDiscountAmount)}`]] : []),
        [`GST (${safeGstPercent}%)`, `Rs. ${money(safeTax)}`]
      ];
      const summaryHeight = CAP_HEIGHT + summaryRows.length * ROW_HEIGHT + 6 + TOTAL_HEIGHT;
      if (y + summaryHeight > pageHeight) { doc.addPage(); y = MARGIN; }

      doc.rect(SUMMARY_X, y, SUMMARY_WIDTH, CAP_HEIGHT + summaryRows.length * ROW_HEIGHT + 6)
         .fillAndStroke('#ffffff', WARM.border);
      doc.rect(SUMMARY_X, y, SUMMARY_WIDTH, CAP_HEIGHT).fill(WARM.section);
      doc.strokeColor(WARM.border).lineWidth(0.6)
         .moveTo(SUMMARY_X, y + CAP_HEIGHT).lineTo(SUMMARY_X + SUMMARY_WIDTH, y + CAP_HEIGHT).stroke();
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor(WARM.muted)
         .text('PRICE SUMMARY', SUMMARY_X + 10, y + 5.5, { characterSpacing: 1.2, lineBreak: false });

      let summaryY = y + CAP_HEIGHT + 5;
      summaryRows.forEach(([label, value]) => {
        doc.fontSize(8).font('Helvetica').fillColor(WARM.muted)
           .text(label, SUMMARY_X + 10, summaryY, { width: 110, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(WARM.text)
           .text(value, SUMMARY_X + 120, summaryY, { width: SUMMARY_WIDTH - 130, align: 'right', lineBreak: false });
        summaryY += ROW_HEIGHT;
      });

      // The total sits on the tan accent in dark text: white on tan does not meet contrast
      const totalY = y + CAP_HEIGHT + summaryRows.length * ROW_HEIGHT + 6;
      doc.rect(SUMMARY_X, totalY, SUMMARY_WIDTH, TOTAL_HEIGHT).fill(WARM.accent);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(WARM.text)
         .text('TOTAL', SUMMARY_X + 10, totalY + 8.5, { characterSpacing: 1.4, lineBreak: false });
      doc.fontSize(10.5).font('Helvetica-Bold').fillColor(WARM.text)
         .text(`Rs. ${money(safeTotal)}`, SUMMARY_X + 60, totalY + 7, { width: SUMMARY_WIDTH - 70, align: 'right', lineBreak: false });
      doc.font('Helvetica');
      y = totalY + TOTAL_HEIGHT + GAP.section;

      // Notes - measured whole like the terms below, so the block moves to a fresh page rather
      // than splitting mid-paragraph. PDFKit paginates a doc.text that overflows, which is what
      // split it before.
      if (description) {
        const notesHeight = GAP.heading + doc.heightOfString(decodeHtml(description), { width: CONTENT_WIDTH, lineGap: 3 });
        if (y + notesHeight > pageHeight) { doc.addPage(); y = MARGIN; }
        sectionHeading('Notes');
        doc.fontSize(9).fillColor('#333333').font('Helvetica').text(decodeHtml(description), MARGIN, y, { width: CONTENT_WIDTH, lineGap: 3 });
        y += doc.heightOfString(decodeHtml(description), { width: CONTENT_WIDTH, lineGap: 3 }) + GAP.section;
      }

      // Terms & Conditions - last section, and only when the estimate carries them. The block
      // reads as one: measured whole before anything is drawn, so it either fits on this page
      // or opens a fresh one -- never split mid-list. A block taller than a page still flows,
      // since it cannot fit anywhere whole.
      const termsLines = estimateTermsLines({ includeTerms, termsConditions: estimate.termsConditions });
      if (termsLines.length) {
        doc.fontSize(8).font('Helvetica');
        const clauseHeights = termsLines.map((line, index) =>
          doc.heightOfString(`${index + 1}. ${decodeHtml(line)}`, { width: CONTENT_WIDTH, lineGap: 2 }) + 4);
        const blockHeight = 10 + GAP.heading + clauseHeights.reduce((sum, h) => sum + h, 0);
        if (y + blockHeight > pageHeight) { doc.addPage(); y = MARGIN; }
        doc.fontSize(10).fillColor(navy).font('Helvetica-Bold').text('TERMS & CONDITIONS', MARGIN, y, { lineBreak: false });
        y += GAP.heading;
        doc.fontSize(8).fillColor('#333333').font('Helvetica');
        termsLines.forEach((line, index) => {
          const text = `${index + 1}. ${decodeHtml(line)}`;
          const height = clauseHeights[index] - 4;
          if (y + height > pageHeight) { doc.addPage(); y = MARGIN; }
          doc.text(text, MARGIN, y, { width: CONTENT_WIDTH, lineGap: 2, continued: false });
          y += height + 4;
        });
      }

      // Footer: who sent it and how to reach them, on the last page. It must stay inside the
      // document's bottom margin (842 less 50), or PDFKit flows it onto a blank extra page.
      const footerY = 772;
      if (y < footerY - 14) {
        // The company and how to reach it, and nothing else: no "computer-generated document"
        // note, no automated-mail disclaimer, no watermark. An estimate is a document the customer
        // is asked to approve, and a disclaimer across it reads as though it were a draft.
        doc.strokeColor(WARM.border).lineWidth(0.5).moveTo(MARGIN, footerY - 8).lineTo(MARGIN + CONTENT_WIDTH, footerY - 8).stroke();
        doc.fontSize(6).font('Helvetica').fillColor('#9ca3af')
           .text(COMPANY_FOOTER_LINE, MARGIN, footerY, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate invoice PDF and return as buffer.
//
// Built from the same furniture as the estimate -- `drawLetterhead`, `drawDetailTable`,
// `drawItemsTable`, `drawSummaryCard`, `drawDocumentFooter` -- so a customer who receives an
// estimate and then an invoice receives one house style rather than two. What it replaced was a
// bespoke layout of gold banners, cream cards and hand-wrapped text that shared nothing with it.
const generateInvoicePDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        invoiceId, estimateId, invoiceType, customerName, customerEmail, customerPhone,
        propertyName, propertyCode, propertyType, zone, city,
        invoiceDate, dueDate, billingDuration,
        lineItems, subtotal, discountAmount, discountPercentage, taxAmount, taxPercentage,
        totalAmount, balanceAmount, amountPaid,
        workOrderId, workOrderCategory, workOrderSubcategory, workOrderDescription
      } = invoice;

      const MARGIN = 50;
      const figure = value => { const number = parseFloat(value); return Number.isFinite(number) ? number : 0; };
      const rupees = value => `Rs. ${money(figure(value))}`;
      const isWorkOrder = invoiceType === 'work_order' || !!(workOrderId && String(workOrderId).length);

      let items = [];
      try { items = typeof lineItems === 'string' ? JSON.parse(lineItems) : (lineItems || []); } catch (error) { items = []; }
      if (!Array.isArray(items)) items = [];

      const paid = figure(amountPaid);
      const balance = balanceAmount === undefined || balanceAmount === null ? figure(totalAmount) : figure(balanceAmount);

      // ===== LETTERHEAD =====
      // The due date is the one figure on an invoice that carries a deadline, so it is picked out
      // in red exactly as the estimate's Valid Until is.
      let y = drawLetterhead(doc, MARGIN, {
        party: (() => {
          // The estimate's rule holds here too: a community is billed to the property,
          // a villa, flat or plot to the person
          const billedTo = billToParty({ customerName, propertyName, propertyType });
          return {
            title: 'Bill To',
            name: billedTo.name,
            rows: [
              ['Contact', billedTo.contact],
              ['Phone', customerPhone],
              ['Email', customerEmail],
              ['Property', billedTo.property],
              ['Prop ID', propertyCode],
              ['City', city]
            ]
          };
        })(),
        meta: [
          ['INVOICE NO.', invoiceId || '-'],
          ['DATE', formatDocumentDate(invoiceDate)],
          ['DUE DATE', formatDocumentDate(dueDate)],
          ['BALANCE DUE', rupees(balance)]
        ]
      });

      // ===== PROPERTY DETAILS =====
      const propertyTypeLabel = { GC: 'Gated Community', APT: 'Apartment', VILLA: 'Villa', FLAT: 'Flat', PLOT: 'Plot' }[propertyType] || propertyType;
      const propertyFields = [
        ['Name', propertyName], ['Type', propertyTypeLabel], ['Property ID', propertyCode],
        ['Zone', zone], ['City', city],
        ['Billing', billingDuration ? String(billingDuration).replace('-', ' ').replace(/^./, c => c.toUpperCase()) : ''],
        ['Estimate', estimateId]
      ];
      if (propertyFields.some(stated)) {
        y = drawSectionHeading(doc, y, 'Property Details', MARGIN);
        y = drawDetailTable(doc, y, propertyFields, { margin: MARGIN });
        y += DOC_GAP.section;
      }

      // ===== WORK ORDER DETAILS =====
      if (isWorkOrder) {
        const firstItem = items[0] || {};
        y = drawSectionHeading(doc, y, 'Work Order Details', MARGIN);
        y = drawDetailTable(doc, y, [
          ['Work Order ID', workOrderId],
          ['Category', workOrderCategory || firstItem.category || firstItem.serviceCategory],
          ['Subcategory', workOrderSubcategory || firstItem.subcategory || firstItem.serviceSubcategory]
        ], {
          margin: MARGIN,
          wide: [['Description', stripInternalServiceDetails(workOrderDescription || firstItem.description || firstItem.details || '')]]
        });
        y += DOC_GAP.section;
      }

      // ===== ITEMS =====
      // One table, whatever the line is: an invoice bills for services and they are all billed the
      // same way. The old layout split them into "Services Included" and "Add-ons" by sniffing the
      // word "addon" out of a description, which put a service in the wrong table on a typo.
      if (items.length) {
        y = drawSectionHeading(doc, y, isWorkOrder ? 'Work Billed' : 'Services Billed', MARGIN);
        y = drawItemsTable(doc, y, {
          margin: MARGIN,
          columns: [
            { label: '#', width: 26 },
            { label: 'Description', width: 199 },
            { label: 'Frequency', width: 78 },
            { label: 'Visits', width: 44, align: 'right' },
            { label: 'Qty', width: 34, align: 'right' },
            { label: 'Amount', width: 114, align: 'right' }
          ],
          rows: items.map((item, index) => {
            const name = stripInternalServiceDetails(decodeHtml(String(item.description || item.name || item.serviceName || item.service_name || 'Service')));
            const detail = stripInternalServiceDetails(decodeHtml(String(item.details || item.serviceDescription || '')));
            const quantity = item.quantity ?? item.qty;
            const amount = item.amount ?? item.totalPrice ?? item.total_price ?? item.unitPrice ?? item.unit_price ?? 0;
            return [
              String(index + 1),
              [name, detail].filter(Boolean).join('\n'),
              String(item.frequency || item.frequencyType || item.frequency_type || '-').replace(/^\d+x\s*/i, ''),
              String(item.visits ?? item.frequencyCount ?? item.frequency_count ?? 1),
              quantity === undefined || quantity === null || quantity === '' ? '-' : String(quantity),
              money(figure(amount))
            ];
          })
        });
      }

      // ===== SUMMARY =====
      // Amount Paid and Balance Due appear only once something has been paid: on a fresh invoice
      // the balance is the total, and saying so twice adds nothing.
      const summaryRows = [['Subtotal', rupees(subtotal)]];
      if (figure(discountAmount) > 0) {
        summaryRows.push([`Discount (${money(figure(discountPercentage))}%)`, `- ${rupees(discountAmount)}`, '#047857']);
      }
      summaryRows.push([`GST (${money(figure(taxPercentage))}%)`, rupees(taxAmount)]);
      if (paid > 0) {
        summaryRows.push(['Amount Paid', `- ${rupees(paid)}`, '#047857']);
        summaryRows.push(['Balance Due', rupees(balance)]);
      }
      y = drawSummaryCard(doc, y, {
        margin: MARGIN,
        caption: 'Invoice Summary',
        rows: summaryRows,
        total: ['Total', rupees(totalAmount)]
      });

      drawDocumentFooter(doc, y, MARGIN);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate Payment Receipt PDF.
//
// The same furniture as the estimate and the invoice -- letterhead, ruled detail table, summary
// card, footer -- so the three documents a customer receives read as one house style. What it
// replaced was a green-and-blue layout of its own, and a footer carrying a Hyderabad address and a
// placeholder GST number the company does not trade under.
const generateReceiptPDF = async (payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        paymentId, invoiceId, customerName, customerEmail, customerPhone, propertyName, propertyCode,
        propertyType, property_type,
        amount,          // Amount paid in this transaction
        invoiceAmount,   // Total invoice amount
        balanceAmount,   // Remaining balance after this payment
        paymentMethod, paymentDate, transactionReference, referenceNumber, status
      } = payment;

      const MARGIN = 50;
      const figure = value => { const number = parseFloat(value); return Number.isFinite(number) ? number : 0; };
      const rupees = value => `Rs. ${money(figure(value))}`;
      const amountPaid = figure(amount);
      const totalInvoice = figure(invoiceAmount) || amountPaid;
      const remaining = figure(balanceAmount);
      const methodLabel = String(paymentMethod || '')
        .replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) || '-';

      // ===== LETTERHEAD =====
      // RECEIVED FROM, not BILL TO: money has already changed hands, and a receipt acknowledges it
      // rather than asking for it. The amount paid is the figure the reader is looking for, so it
      // is in the strip beside the date.
      let y = drawLetterhead(doc, MARGIN, {
        party: (() => {
          // Same billing rule as the estimate: the property headlines for a community,
          // the person for a villa, flat or plot
          const billedTo = billToParty({ customerName, propertyName, propertyType: propertyType || property_type });
          return {
            title: 'Received From',
            name: billedTo.name,
            rows: [
              ['Contact', billedTo.contact],
              ['Phone', customerPhone],
              ['Email', customerEmail],
              ['Property', billedTo.property],
              ['Prop ID', propertyCode]
            ]
          };
        })(),
        meta: [
          ['RECEIPT NO.', paymentId || '-'],
          ['DATE', formatDocumentDate(paymentDate || Date.now())],
          ['AMOUNT PAID', rupees(amountPaid)],
          ['STATUS', String(status || 'Paid').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())]
        ]
      });

      // ===== PAYMENT DETAILS =====
      y = drawSectionHeading(doc, y, 'Payment Details', MARGIN);
      y = drawDetailTable(doc, y, [
        ['Invoice', invoiceId],
        ['Method', methodLabel],
        ['Transaction Ref', transactionReference],
        ['Reference No.', referenceNumber],
        ['Property', propertyName],
        ['Property ID', propertyCode]
      ], { margin: MARGIN });
      y += DOC_GAP.section;

      // ===== SUMMARY =====
      // What the invoice came to, what this payment settled, and what is left. A receipt that
      // states only the amount paid leaves the reader to work out whether they still owe anything.
      const summaryRows = [
        ['Invoice Total', rupees(totalInvoice)],
        ['This Payment', `- ${rupees(amountPaid)}`, '#047857']
      ];
      y = drawSummaryCard(doc, y, {
        margin: MARGIN,
        caption: 'Payment Summary',
        rows: summaryRows,
        total: [remaining > 0 ? 'Balance Due' : 'Fully Paid', rupees(remaining)]
      });

      y = drawSectionHeading(doc, y, 'Thank You', MARGIN);
      doc.fontSize(9).font('Helvetica').fillColor('#333333')
         .text(remaining > 0
           ? `We have received ${rupees(amountPaid)} against invoice ${invoiceId || ''}. A balance of ${rupees(remaining)} remains outstanding.`
           : `We have received ${rupees(amountPaid)} against invoice ${invoiceId || ''}. This invoice is now settled in full.`,
           MARGIN, y, { width: CONTENT, lineGap: 3 });

      drawDocumentFooter(doc, y + 40, MARGIN);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateEstimatePDF,
  generateInvoicePDF,
  generateReceiptPDF
};
