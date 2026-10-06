// Professional PDF Export using jsPDF - Direct Download, No Print Dialog
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getEstimateAddons, getAddonPrice, getServiceDescription, stripInternalServiceDetails, getPackagePropertyTypes, getPropertyTypeLabel, serviceMethodAndInput, withoutInputSegment } from './estimatePackageUtils';
import { billToParty } from './estimateStore';
import { estimateTermsLines } from './estimateTerms';
import { packageInternalSummary } from './packageServicePricing';
import { COMPANY, COMPANY_CONTACT_LINES, COMPANY_FOOTER_LINE } from './companyInfo';
import { XLAND_LOGO_ICON } from './logoIconBase64.js';

// Debug logger - only logs in development
const isDev = import.meta.env.DEV;
const debug = (...args) => isDev && console.log(...args);

// Decode HTML entities (e.g., &amp; -> &, &#x2F; -> /)
// Runs multiple times to handle multiple levels of encoding (e.g., &amp;amp;amp; -> &)
const decodeHtml = (html) => {
  // A non-string would print as [object Object] in a customer PDF; render nothing instead
  if (html == null || typeof html === 'object') return '';
  if (typeof html !== 'string') return String(html);
  
  const decodeOnce = (str) => {
    const entities = {
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
    let decoded = str;
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    }
    // Handle numeric entities
    decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return decoded;
  };
  
  // Decode multiple times to handle nested encoding (max 5 iterations)
  let decoded = html;
  let prev = '';
  let iterations = 0;
  while (decoded !== prev && iterations < 5) {
    prev = decoded;
    decoded = decodeOnce(decoded);
    iterations++;
  }
  return decoded;
};


// Detect iOS devices (iPhone, iPad, iPod)
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Cross-platform PDF save function - uses blob download for reliability
const savePDFCrossPlatform = (doc, filename) => {
  console.log('[PDF Save] Starting save for:', filename);
  try {
    // Use blob-based download for all platforms (more reliable)
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    console.log('[PDF Save] Download triggered for:', filename);
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }, 1000);
    
  } catch (error) {
    console.error('[PDF Save] Error:', error);
    // Fallback to doc.save()
    try {
      doc.save(filename);
    } catch (e2) {
      console.error('[PDF Save] Fallback also failed:', e2);
    }
  }
};
let isExporting = false;

// Format currency with proper Indian formatting
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

// Safe string helper - ensures all values passed to jsPDF are valid strings
const safeStr = (val, fallback = '-') => {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
};

// ===== SHARED PDF HEADER FUNCTION =====
// Used by all PDF exports for consistent branding
const drawPDFHeader = (doc, margin) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const gold = [201, 162, 39];
  const headerHeight = 18; // Thin header strip
  
  // Black header background
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // The whole lockup -- logo, company name and the PVT LTD rule under it -- is measured first and
  // then centred on the page, rather than being pinned to the left margin. PVT LTD is centred on
  // the name above it instead of starting at the same X, which left it hanging to one side, and the
  // two text lines are centred on the logo's own height rather than pinned near its top.
  const logoSize = 14;
  const logoY = 2;
  const logoGap = 5;
  const pvtLtdText = 'PVT LTD';
  const lineLen = 4;
  const gap = 0.8;
  const mm = points => points * 0.3528;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const nameWidth = doc.getTextWidth('XLAND INFRA');
  doc.setFontSize(4);
  doc.setFont('helvetica', 'normal');
  const pvtLtdWidth = doc.getTextWidth(pvtLtdText);
  const pvtWidth = lineLen + gap + pvtLtdWidth + gap + lineLen;

  const textWidth = Math.max(nameWidth, pvtWidth);
  const lockupWidth = logoSize + logoGap + textWidth;
  // Centred, but never tighter than the page margin on a narrower page size
  const lockupX = Math.max(margin, (pageWidth - lockupWidth) / 2);
  const textCenterX = lockupX + logoSize + logoGap + textWidth / 2;
  // Centred on the logo's midline, so it holds whether the text block is the taller of the two
  // The name line is centred on the logo, not the block: the suffix is light and drags a
  // block-centred midpoint down, which leaves the name riding high above the mark.
  const titleHeight = mm(10);
  const suffixHeight = mm(4);
  const suffixDrop = mm(2);
  const blockTop = logoY + logoSize / 2 - titleHeight / 2;

  try {
    doc.addImage(XLAND_LOGO_ICON, 'PNG', lockupX, logoY, logoSize, logoSize);
  } catch (e) {
    doc.setFillColor(...gold);
    doc.roundedRect(lockupX, logoY, logoSize, logoSize, 1, 1, 'F');
  }

  // Company name - XLAND INFRA, set on its baseline within the centred block
  doc.setTextColor(...gold);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('XLAND INFRA', textCenterX, blockTop + titleHeight * 0.72, { align: 'center' });

  // PVT LTD with a rule on each side, centred under the name
  doc.setFontSize(4);
  doc.setFont('helvetica', 'normal');
  const pvtStartX = textCenterX - pvtWidth / 2;
  const lineY = blockTop + titleHeight + suffixDrop + suffixHeight / 2;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.25);
  // Left line
  doc.line(pvtStartX, lineY, pvtStartX + lineLen, lineY);
  // PVT LTD text
  doc.text(pvtLtdText, pvtStartX + lineLen + gap, lineY + 0.6);
  // Right line
  doc.line(pvtStartX + lineLen + gap + pvtLtdWidth + gap, lineY, pvtStartX + pvtWidth, lineY);

  return headerHeight + 8; // Return starting Y position for content
};

// The portal's warm palette (`tailwind.config.js`), so an estimate reads the same on paper as it
// does on screen: cream section bars, warm rules, the tan accent on the total. Nothing in an
// estimate is drawn in the old slate blue; the package export still is.
const WARM = {
  section: [255, 249, 238],   // warm.section     #FFF9EE
  accentSoft: [254, 243, 226], // warm.accent-soft #FEF3E2
  border: [234, 223, 207],    // warm.border      #EADFCF
  accent: [212, 165, 116],    // warm.accent      #D4A574
  text: [31, 41, 55],         // warm.text        #1F2937
  muted: [107, 114, 128]      // warm.muted       #6B7280
};

// ===== ESTIMATE LETTERHEAD =====
// An estimate opens as a letter does: the logo, XLAND INFRA with PVT LTD ruled beneath it and the
// company's own contact lines down the left, and BILL TO -- the customer -- facing them on the
// right. Under both, a strip naming the document, its number, date, type and billing cycle.
// `drawPDFHeader` above is the centred brand strip the package export still uses; an estimate no
// longer uses it, because a centred lockup leaves nowhere for the two facing blocks.
// Mirrored by drawEstimateLetterhead in backend/services/pdfService.js, so the PDF a portal
// downloads and the PDF the customer is emailed are the same document.
// The icon beside a contact line, drawn from primitives rather than from a glyph: Helvetica has no
// handset or envelope, and embedding a symbol font or three PNGs for 3mm of line art is not worth
// the bytes in a document that is emailed. Matches the lucide icons the portal renders.
const drawContactIcon = (doc, kind, x, y, size) => {
  doc.setDrawColor(201, 162, 39);
  doc.setLineWidth(0.22);
  if (kind === 'phone') {
    // A handset: a rounded body with the earpiece slot across the top. Narrower than this and it
    // reads as a plain bar at this size.
    const width = size * 0.66;
    const left = x + (size - width) / 2;
    doc.roundedRect(left, y, width, size, size * 0.18, size * 0.18, 'S');
    doc.line(left + width * 0.28, y + size * 0.19, left + width * 0.72, y + size * 0.19);
  } else if (kind === 'email') {
    // An envelope: the body, and the flap folding to its middle
    const top = y + size * 0.16;
    const height = size * 0.68;
    doc.roundedRect(x, top, size, height, size * 0.1, size * 0.1, 'S');
    doc.line(x, top, x + size / 2, top + height * 0.55);
    doc.line(x + size, top, x + size / 2, top + height * 0.55);
  } else if (kind === 'website') {
    // A globe: the sphere, its meridian and its equator
    const radius = size / 2;
    doc.circle(x + radius, y + radius, radius, 'S');
    doc.ellipse(x + radius, y + radius, radius * 0.45, radius, 'S');
    doc.line(x, y + radius, x + size, y + radius);
  }
};

// `kind` is 'estimate' or 'package'. A package is billed to nobody, so its card names the package
// -- what it covers and how many services -- and its strip reads Package No., Date, Billing, Services.
const drawEstimateLetterhead = (doc, margin, data, { kind = 'estimate' } = {}) => {
  const isPackage = kind === 'package';
  const pageWidth = doc.internal.pageSize.getWidth();
  const gold = [201, 162, 39];
  const labelGray = [107, 114, 128];

  // --- Left: the company, running down one edge ---
  // The logo sits at the page margin with the name beside it; the tagline, address and contact
  // lines then start on that same edge, directly under the logo. Centring them under the whole
  // lockup pushed the details left of the mark that introduces them.
  const logoSize = 16;
  const logoY = 8;
  const logoGap = 4;
  const nameSpacing = 0.5;
  const suffixSpacing = 0.7;
  const ruleLength = 5;
  const ruleGap = 1.6;
  const iconSize = 2.6;
  const iconTextGap = 1.1;                                // icon to its own value
  const contactGap = 3.9;                                 // one contact to the next along the line

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  // getTextWidth ignores charSpace, so the spacing has to be added back by hand
  const nameWidth = doc.getTextWidth(COMPANY.name) + nameSpacing * COMPANY.name.length;

  doc.setFont('helvetica', 'normal');
  const taglineText = String(COMPANY.tagline).toUpperCase();

  // The phone, the email and the website sit on **one line** beneath the address, each behind its
  // own icon. Stacked, the three of them made the letterhead a column six lines deep for what is
  // one thought -- how to reach us. A point smaller than the address, because three of them on a
  // line have to clear the BILL TO card facing them.
  doc.setFontSize(7);
  const contactItems = COMPANY_CONTACT_LINES.map(([kind, value]) => ({
    kind, value: String(value), width: iconSize + iconTextGap + doc.getTextWidth(String(value))
  }));

  // Every line of the block starts on the page's left edge, under the logo itself.
  const textLeft = margin;

  const logoX = margin;
  try {
    doc.addImage(XLAND_LOGO_ICON, 'PNG', logoX, logoY, logoSize, logoSize);
  } catch (e) {
    doc.setFillColor(...gold);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 1, 1, 'F');
  }

  // **The name line is centred on the logo, not the block.** Centring the whole block -- name plus
  // ruled suffix -- puts its midpoint on the logo's midline, and since the suffix is a light line of
  // 5.5pt text it drags that midpoint down, leaving the name itself riding high above the mark. The
  // name is what the eye pairs with the logo, so its own centre sits on the logo's centre and the
  // suffix hangs beneath. Point sizes are converted to mm, the unit this document is in.
  const textX = logoX + logoSize + logoGap;
  const mm = points => points * 0.3528;
  const titleHeight = mm(14);
  const suffixDrop = mm(5);                               // name baseline down to the rule
  const blockTop = logoY + logoSize / 2 - titleHeight / 2;
  // The furthest right the company block reaches: the BILL TO card may grow leftward up to this,
  // so a long email keeps to one line inside it.
  let companyRight = textX + nameWidth;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 26);
  // jsPDF sets text on its baseline, so the cap height is added to the block's top
  doc.text(COMPANY.name, textX, blockTop + titleHeight * 0.72, { charSpace: nameSpacing });

  // PVT LTD, ruled on both sides and centred under the name, in the same near-black as the name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(26, 26, 26);
  const suffixWidth = doc.getTextWidth(COMPANY.suffix) + suffixSpacing * COMPANY.suffix.length;
  const lockupWidth = ruleLength + ruleGap + suffixWidth + ruleGap + ruleLength;
  const suffixX = textX + Math.max(0, (nameWidth - lockupWidth) / 2);
  const ruleY = blockTop + titleHeight * 0.72 + suffixDrop;
  doc.setDrawColor(26, 26, 26);
  doc.setLineWidth(0.2);
  doc.line(suffixX, ruleY, suffixX + ruleLength, ruleY);
  doc.text(COMPANY.suffix, suffixX + ruleLength + ruleGap, ruleY + 0.7, { charSpace: suffixSpacing });
  doc.line(suffixX + lockupWidth - ruleLength, ruleY, suffixX + lockupWidth, ruleY);

  doc.setFontSize(6.5);
  doc.setTextColor(...labelGray);
  doc.text(taglineText, textLeft, logoY + logoSize + 2.5, { charSpace: 0.3 });
  companyRight = Math.max(companyRight, textLeft + doc.getTextWidth(taglineText) + 0.3 * taglineText.length);

  let lineY = logoY + logoSize + 7;
  doc.setFontSize(7.5);
  doc.setTextColor(75, 85, 99);
  COMPANY.addressLines.forEach(line => {
    doc.text(line, textLeft, lineY);
    companyRight = Math.max(companyRight, textLeft + doc.getTextWidth(line));
    lineY += 3.6;
  });
  // The contact line sits a little apart from the address, so the two read as separate blocks
  lineY += 1.6;
  // The one contact line, under the address
  doc.setFontSize(7);
  let contactX = textLeft;
  contactItems.forEach(item => {
    // The icon sits on the line's x-height rather than its baseline, or it floats above the text
    drawContactIcon(doc, item.kind, contactX, lineY - 2.1, iconSize);
    doc.setTextColor(75, 85, 99);
    doc.text(item.value, contactX + iconSize + iconTextGap, lineY);
    contactX += item.width + contactGap;
  });
  companyRight = Math.max(companyRight, contactX - contactGap);
  lineY += 3.8;
  const companyBottom = lineY;

  // --- Right: BILL TO ---
  // The card is exactly as wide as its widest single-line value -- an email or a property code
  // stays whole on one line -- never narrower than 70mm and never reaching into the company block.
  // A gated community or an apartment estimate is billed to the property, so its name takes the
  // headline and the customer drops to a Contact line; a villa, flat or plot is billed to the
  // person and the property stays a row. billToParty decides.
  const serviceCount = (data.services || []).length;
  const billedTo = isPackage ? { name: data.packageName || 'AMC Package' } : billToParty(data);
  const rows = (isPackage ? [
    ['Applies To', data.propertyTypeLabel || data.propertyType],
    ['Services', serviceCount ? String(serviceCount) : '']
  ] : [
    ['Contact', billedTo.contact],
    ['Phone', data.customerPhone],
    ['Email', data.customerEmail],
    ['Property', billedTo.property],
    ['Prop ID', data.propertyCode],
    ['City', data.city]
  ]).filter(([, value]) => value !== undefined && value !== null && value !== '');

  doc.setFontSize(7);
  const widestValue = rows.reduce((width, [, value]) => Math.max(width, doc.getTextWidth(decodeHtml(String(value)))), 0);
  const boxWidth = Math.min(Math.max(70, widestValue + 24), Math.max(70, pageWidth - margin - companyRight - 3));
  const boxX = pageWidth - margin - boxWidth;
  const capHeight = 5.5;

  // Measured before anything is drawn, so the box is exactly as tall as its contents. A value too
  // long to sit beside its label -- a very long email -- drops to its own line across the card's
  // full width rather than snapping mid-word.
  doc.setFontSize(7);
  const wrapped = rows.map(([label, value]) => {
    const text = decodeHtml(String(value));
    const fits = doc.getTextWidth(text) <= boxWidth - 22;
    return [label, fits ? [text] : doc.splitTextToSize(text, boxWidth - 8), fits];
  });
  doc.setFontSize(9.5);
  const nameLines = doc.splitTextToSize(decodeHtml(String(billedTo.name || '-')), boxWidth - 8);
  const bodyHeight = 3 + nameLines.length * 4 + 1.5 + wrapped.reduce((height, [, lines, fits]) => height + (lines.length + (fits ? 0 : 1)) * 3.4, 0) + 3;
  const boxHeight = capHeight + bodyHeight;

  doc.setFillColor(...WARM.accentSoft);
  doc.setDrawColor(...WARM.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(boxX, logoY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFillColor(255, 255, 255);
  doc.rect(boxX + 0.2, logoY + capHeight, boxWidth - 0.4, bodyHeight - 0.6, 'F');
  doc.setDrawColor(...WARM.border);
  doc.line(boxX, logoY + capHeight, boxX + boxWidth, logoY + capHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(138, 109, 18);
  doc.text(isPackage ? 'AMC PACKAGE' : 'BILL TO', boxX + 4, logoY + 3.7, { charSpace: 0.6 });

  let rowY = logoY + capHeight + 4.5;
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(nameLines, boxX + 4, rowY);
  rowY += nameLines.length * 4 + 1.5;

  wrapped.forEach(([label, lines, fits]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...labelGray);
    doc.text(String(label).toUpperCase(), boxX + 4, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(55, 65, 81);
    doc.text(lines, boxX + (fits ? 18 : 4), fits ? rowY : rowY + 3.4);
    rowY += (lines.length + (fits ? 0 : 1)) * 3.4;
  });

  // --- The strip naming the document ---
  let y = Math.max(companyBottom, logoY + boxHeight) + 4;
  const stripHeight = 11;
  doc.setFillColor(...WARM.section);
  doc.rect(margin, y, pageWidth - margin * 2, stripHeight, 'F');
  doc.setDrawColor(...WARM.border);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageWidth - margin, y);
  doc.line(margin, y + stripHeight, pageWidth - margin, y + stripHeight);

  // The strip does not announce the word ESTIMATE -- what the document is is not in doubt -- so
  // its four fields share the width evenly instead of crowding to the left of it.
  const billing = String(data.billingDuration || data.billing_duration || 'Yearly');
  const estimateType = String(data.estimateType || data.estimate_type || '-').replace(/_/g, ' ');
  const stripWidth = pageWidth - margin * 2;
  const fieldWidth = (stripWidth - 12) / 4;
  const billingLabel = billing.charAt(0).toUpperCase() + billing.slice(1).replace('-', ' ');
  const fields = (isPackage ? [
    ['PACKAGE NO.', String(data.packageCode || data.packageId || data.estimateId || '-')],
    ['DATE', formatDate(data.createdAt)],
    ['BILLING', billingLabel],
    ['SERVICES', String(serviceCount)]
  ] : [
    ['ESTIMATE NO.', String(data.estimateId || data.packageId || '-')],
    ['DATE', formatDate(data.createdAt)],
    ['TYPE', estimateType.charAt(0).toUpperCase() + estimateType.slice(1)],
    ['BILLING', billingLabel]
  ]).map(([label, value], index) => [label, value, margin + 6 + index * fieldWidth, fieldWidth - 4]);
  fields.forEach(([label, value, x, width]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...labelGray);
    doc.text(label, x, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(17, 24, 39);
    // One line only: the strip is a glance, and a wrapped value would push into the row below
    doc.text(doc.splitTextToSize(value, width)[0] || '-', x, y + 8.4);
  });

  return y + stripHeight + 7;
};

// Generate Premium PDF with professional design
const generatePDF = (data, type, filename, { returnDoc = false } = {}) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Professional Color Palette
    const navy = [30, 41, 59];               // Dark navy
    const slate = [71, 85, 105];             // Slate-600
    const darkText = [31, 41, 55];           // Gray-800
    const mediumText = [75, 85, 99];         // Gray-600
    const lightText = [107, 114, 128];       // Gray-500
    const cardBg = [249, 250, 251];          // Gray-50
    const cardBgBlue = [239, 246, 255];      // Light blue (blue-50)
    const borderLight = [229, 231, 235];     // Gray-200
    const gold = [180, 144, 52];             // Professional gold
    const { section: warmSection, border: warmBorder, accent: warmAccent, text: warmText, muted: warmMuted } = WARM;
    // An estimate and a package are one house style: the letterhead, warm headings, cream tables
    const warm = type === 'estimate' || type === 'package';
    const heading = warm ? warmText : navy;

    // ===== HEADER =====
    // The letterhead -- company left, the card facing it right, the document strip under both. An
    // estimate's card is BILL TO; a package's names the package, since it is billed to nobody.
    let y = drawEstimateLetterhead(doc, margin, data, { kind: type === 'package' ? 'package' : 'estimate' });

    // ===== PROPERTY DETAILS (Plain, stacked vertically) =====
    if (type !== 'package') {
      const propType = String(data.propertyType || '').toUpperCase();
      const isGC = ['GC', 'GATED COMMUNITY', 'GATED_COMMUNITY'].includes(propType);
      const isApt = ['APT', 'APARTMENT'].includes(propType);
      const isVilla = ['VILLA', 'VL'].includes(propType);
      const isFlat = ['FLAT', 'FL'].includes(propType);
      const isPlot = ['PLOT', 'PL'].includes(propType);
      
      // Property Details Header
      doc.setTextColor(...heading);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Property Details', margin, y);
      // A heading needs air under it: a 10pt line is ~3.5mm tall, so it was sitting on its content
      y += 9;

      const propertyFields = [
        ['Name', decodeHtml(String(data.propertyName || data.communityName || ''))],
        ['Type', isGC ? 'Gated Community' : isApt ? 'Apartment' : isVilla ? 'Villa' : isFlat ? 'Flat' : isPlot ? 'Plot' : data.propertyType],
        ['Property ID', data.propertyCode],
        ['Zone', data.zone],
        ...((data.estimateType === 'property_based' || data.estimate_type === 'property_based' || data.propertyId || data.property_id)
          ? [['Division', data.division || data.divisionName || data.division_name]] : []),
        ['City', data.city],
        ...(isGC ? [['No. of Blocks', data.numberOfBlocks || data.number_of_blocks], ['Total Units', data.totalUnits || data.total_units]] : []),
        ...(isApt ? [['Tower / Building', data.towerName || data.tower_name], ['Block Number', data.blockNumber || data.block_number],
          ['No. of Units', data.totalUnits || data.total_units]] : []),
        ...(isVilla || isFlat || isPlot
          ? [[isVilla ? 'Villa Number' : isFlat ? 'Flat Number' : 'Plot Number', data.villaPlotNumber || data.villa_plot_number]] : [])
      ].filter(([, value]) => value !== undefined && value !== null && value !== '');

      // The fields are a ruled table, not a floating grid: the label in a cream cell, its value
      // in the white cell beside it, two pairs to a line, so the block lines up with the services
      // table under it. Mirrors detailTable in backend/services/pdfService.js. An address takes a
      // line of its own; empty fields are dropped, so the rest close up.
      const contentWidth = pageWidth - margin * 2;
      const pairWidth = contentWidth / 2;
      const labelWidth = 34;
      const pad = 2.2;
      const address = decodeHtml(String(data.address || data.propertyAddress || ''));
      const lines = [];
      for (let index = 0; index < propertyFields.length; index += 2) lines.push(propertyFields.slice(index, index + 2));
      if (address) lines.push([['Address', address], null]);

      const tableTop = y;
      lines.forEach((line, lineIndex) => {
        const full = address && lineIndex === lines.length - 1;
        const width = full ? contentWidth : pairWidth;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        const cells = line.filter(Boolean).map(([label, value]) =>
          [label, doc.splitTextToSize(String(value), width - labelWidth - pad * 2)]);
        const height = Math.max(6.4, ...cells.map(([, wrapped]) => wrapped.length * 3.6 + pad * 2));

        cells.forEach(([label, wrapped], pair) => {
          const x = margin + (full ? 0 : pair * pairWidth);
          doc.setFillColor(...warmSection);
          doc.setDrawColor(...warmBorder);
          doc.setLineWidth(0.2);
          doc.rect(x, y, labelWidth, height, 'FD');
          doc.setFillColor(255, 255, 255);
          doc.rect(x + labelWidth, y, width - labelWidth, height, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(...warmMuted);
          doc.text(String(label).toUpperCase(), x + pad, y + pad + 2.4);
          doc.setFontSize(8.5);
          doc.setTextColor(...warmText);
          doc.text(wrapped, x + labelWidth + pad, y + pad + 2.6);
        });
        // An odd last pair leaves no half-empty cell behind: the line is closed off plainly
        if (cells.length === 1 && !full) {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(...warmBorder);
          doc.rect(margin + pairWidth, y, pairWidth, height, 'FD');
        }
        y += height;
      });
      // One outline around the whole block, so the inner rules read as a grid rather than boxes
      doc.setDrawColor(...warmBorder);
      doc.rect(margin, tableTop, contentWidth, y - tableTop, 'S');

      // The customer is named in BILL TO at the head of the page, so there is no Customer Details
      // section here: it would state the same three fields twice.
      y += 7;
    }

    // ===== WORK ORDER DETAILS (only for work order estimates) - Compact 4-column layout =====
    if (data.isWorkOrderEstimate && data.workOrderId) {
      const woBoxHeight = 22;
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(margin, y, pageWidth - margin * 2, woBoxHeight, 2, 2, 'FD');
      
      doc.setTextColor(...heading);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Work Order Details', margin + 6, y + 5);
      
      // 4-column layout on single row
      const col1 = margin + 6;
      const col2 = margin + 55;
      const col3 = margin + 105;
      const col4 = margin + 150;
      const wy = y + 13;
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Work Order ID', col1, wy);
      doc.text('Category', col2, wy);
      doc.text('Subcategory', col3, wy);
      doc.text('Priority', col4, wy);
      
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(String(data.workOrderId || '-').substring(0, 18), col1, wy + 5);
      doc.text(String(data.workOrderCategory || '-').substring(0, 15), col2, wy + 5);
      doc.text(String(data.workOrderSubcategory || '-').substring(0, 15), col3, wy + 5);
      doc.text(String(data.workOrderPriority || '-').toUpperCase(), col4, wy + 5);
      
      y += woBoxHeight + 8;
    }

    // ===== AMC PACKAGE DESCRIPTION =====
    if (data.amcPackageDescription && data.amcPackageDescription.trim()) {
      doc.setTextColor(...heading);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PACKAGE DESCRIPTION', margin, y);
      y += 6;
      
      // Cream, like the panel the backend's PDF draws
      doc.setFillColor(...(warm ? warmSection : cardBg));
      doc.setDrawColor(...(warm ? warmBorder : borderLight));
      const descLines = doc.splitTextToSize(String(data.amcPackageDescription), pageWidth - margin * 2 - 8);
      // Allow full description - up to 80 height and 20 lines
      const descBoxH = Math.min(Math.max(10, descLines.length * 4 + 4), 80);
      doc.roundedRect(margin, y, pageWidth - margin * 2, descBoxH, 2, 2, 'FD');
      
      doc.setTextColor(...mediumText);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(descLines.slice(0, 20), margin + 4, y + 4);
      y += descBoxH + 4;
    }

    // Billing is stated in the letterhead's strip on an estimate and a package alike
    if (!warm) {
      const billingValue = data.billing_duration || data.billingDuration || 'Yearly';
      const formattedBilling = billingValue.charAt(0).toUpperCase() + billingValue.slice(1).replace('-', ' ');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumText);
      doc.text('Billing:', margin, y);
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(formattedBilling, margin + 18, y);
      y += 8;
    }

    // ===== SERVICES TABLE (Skip for Work Order Estimates) =====
    const isWorkOrder = data.isWorkOrderEstimate || data.estimate_type === 'work_order' || data.estimateType === 'work_order' || data.workOrderId;
    const services = data.services || data.packageServices || [];
    
    // Both service lists share one renderer. No service states a price of its own -- the estimate
    // is priced as a whole, in Total Services Price and the Price Summary -- and there is no Qty
    // column; the user asked for both to go. `priced` still marks an estimate, whose total is shown.
    const priced = type === 'estimate';
    // Uppercase and aligned per column, as the backend's PDF sets them
    // Every column of the estimate view except its internal Vendor Cost, XLAND Cost and Margin %
    const serviceHead = [['#', 'SERVICE', 'METHOD', 'INPUT / DETAILS', 'DESCRIPTION', 'FREQUENCY', 'VISITS']];
    const serviceColumnStyles = {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 33, halign: 'left' },
      2: { cellWidth: 22, halign: 'left' },
      3: { cellWidth: 26, halign: 'left' },
      4: { cellWidth: 55, halign: 'left' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' }
    };
    // Drawn in the cream skin the portal uses -- warm section header, warm rules, figures in warm
    // text -- for an estimate and a package alike
    const serviceTableStyles = warm ? {
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2, lineColor: warmBorder, lineWidth: 0.2, halign: 'center', overflow: 'linebreak', cellWidth: 'wrap' },
      headStyles: { fillColor: warmSection, textColor: warmMuted, fontStyle: 'bold', fontSize: 6.5, lineColor: warmBorder },
      bodyStyles: { textColor: warmText, lineColor: warmBorder, minCellHeight: 6.5 },
      columnStyles: serviceColumnStyles,
      // No banding: the cream belongs to the column header alone, and the rule between rows is
      // enough to tell them apart
      alternateRowStyles: { fillColor: [255, 255, 255] },
      rowPageBreak: 'avoid',
      // autoTable applies columnStyles to the body only, so a header would sit centred over a
      // left-aligned column. Give each header the alignment its column already has.
      didParseCell: (data) => {
        const align = serviceColumnStyles[data.column.index]?.halign;
        if (data.section === 'head' && align) data.cell.styles.halign = align;
      }
    } : {
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, lineColor: [50, 50, 50], lineWidth: 0.3, halign: 'center', overflow: 'linebreak', cellWidth: 'wrap' },
      headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, lineColor: [50, 50, 50], halign: 'center' },
      bodyStyles: { textColor: darkText, lineColor: [100, 100, 100], minCellHeight: 8 },
      columnStyles: serviceColumnStyles,
      alternateRowStyles: { fillColor: [252, 252, 253] },
      rowPageBreak: 'avoid'
    };
    // The category says what kind of service this is, so it reads under the name rather than among
    // the details -- the same place the modal and the backend's PDF set it. `getServiceDescription`
    // leads its detail line with the same category, so that copy is dropped: printing it in both
    // columns of the same row says nothing twice.
    const withoutCategory = (text, category) => {
      if (!text || !category) return text || '';
      return String(text).split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed.toLowerCase().startsWith(String(category).toLowerCase())) return trimmed;
        return trimmed.slice(String(category).length).replace(/^\s*\|\s*/, '').trim();
      }).filter(Boolean).join('\n');
    };
    const serviceRow = (item, index) => {
      const category = decodeHtml(String(item.category || ''));
      const name = [decodeHtml(String(item.name || item.service || item.serviceName || item.service_name || 'Service')),
        category].filter(Boolean).join('\n');
      const freqType = String(item.frequencyType || item.frequency_type || item.frequency || 'Monthly').replace(/^\d+x\s*/i, '');
      const visits = item.frequencyCount ?? item.frequency_count ?? item.visits ?? 1;
      const details = withoutInputSegment(withoutCategory(stripInternalServiceDetails(decodeHtml(String(item.description || ''))), category), item.input);
      return [String(index + 1), name, item.method || '-', item.input || '-', details || '-', freqType, String(visits)];
    };

    if (!isWorkOrder && services.length > 0) {
      doc.setTextColor(...heading);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(priced ? 'AMC PACKAGE - SERVICES INCLUDED' : 'SERVICES INCLUDED', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: serviceHead,
        body: services.map((service, index) => serviceRow(service, index)),
        ...serviceTableStyles
      });

      y = doc.lastAutoTable.finalY + 6;
    }

    // ===== SERVICES TABLE (Skip for Work Order Estimates) =====
    if (!isWorkOrder && data.addons && data.addons.length > 0) {
      doc.setTextColor(...heading);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICES', margin, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: serviceHead,
        body: data.addons.map((addon, index) => serviceRow(addon, index)),
        ...serviceTableStyles
      });

      y = doc.lastAutoTable.finalY + 6;
    }

    // Total Services Price is the whole of it: the package price plus the added services, so it
    // agrees with the Price Summary's subtotal. It used to count the added services alone, which
    // printed Rs. 3,42,384 above a subtotal of Rs. 3,87,384. A small line under it names the
    // package, as the estimate view does.
    const packagePrice = Number(data.packagePrice) || 0;
    if (priced && !isWorkOrder && (data.addons?.length || services.length || packagePrice)) {
      if (y + 18 > pageHeight) { doc.addPage(); y = 20; }
      const addonsTotal = data.addonsTotal ?? (data.addons || []).reduce((sum, addon) => sum + getAddonPrice(addon), 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...heading);
      doc.text('Total Services Price', margin, y);
      doc.text(formatCurrency(packagePrice + addonsTotal), pageWidth - margin, y, { align: 'right' });
      y += 5;
      if (data.packageName && packagePrice) {
        const count = services.length;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...warmMuted);
        doc.text(`Includes the AMC package "${decodeHtml(String(data.packageName))}" at ${formatCurrency(packagePrice)}${count ? `, covering ${count} service${count === 1 ? '' : 's'}` : ''}.`, margin, y);
        y += 4;
      }
      y += 4;
    }

    // ===== PRICE SUMMARY (Plain, right-aligned) =====
    const subtotal = parseFloat(data.subtotal) || 0;
    
    // Get discount values
    let discountPercent = parseFloat(data.discountPercent || data.discount_percent || data.discount) || 0;
    let discountAmount = parseFloat(data.discountAmount || data.discount_amount) || 0;
    
    // Get GST values
    let gstPercent = parseFloat(data.gstPercent || data.gst_percent || data.gst) || 0;
    let gstAmount = parseFloat(data.gstAmount || data.gst_amount) || 0;
    
    // Calculate discount amount from percent if not provided
    if (discountAmount === 0 && discountPercent > 0 && subtotal > 0) {
      discountAmount = Math.round((subtotal * discountPercent) / 100);
    }
    
    // Calculate amount after discount
    const afterDiscount = subtotal - discountAmount;
    
    // Calculate GST on the after-discount amount
    if (gstAmount === 0 && gstPercent > 0 && afterDiscount > 0) {
      gstAmount = Math.round((afterDiscount * gstPercent) / 100);
    }
    
    // Calculate final total
    const savedTotal = data.totalPrice ?? data.total;
    const total = savedTotal != null && Number.isFinite(Number(savedTotal)) ? Number(savedTotal) : Math.round((afterDiscount + gstAmount + Number.EPSILON) * 100) / 100;
    const hasDiscount = discountAmount > 0;

    // A money block reads down its own right edge: the figures line up on one edge, the labels on
    // another, and the total is ruled off in black so it is the last thing the eye lands on.
    const sumWidth = 72;
    const sumX = pageWidth - margin - sumWidth;
    const sumRows = [
      ['Subtotal', formatCurrency(subtotal)],
      ...(hasDiscount ? [[`Discount (${discountPercent}%)`, '- ' + formatCurrency(discountAmount)]] : []),
      [`GST (${gstPercent}%)`, formatCurrency(gstAmount)]
    ];
    const capH = 5.5;
    const rowH = 5.4;
    const totalH = 8.5;
    const sumHeight = capH + sumRows.length * rowH + totalH + 2;

    // Break only if the block will not actually fit above the footer: a fixed 50mm guard pushed a
    // 35mm summary onto a page of its own with a third of the previous page still empty
    if (y + sumHeight > pageHeight - 16) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...warmSection);
    doc.setDrawColor(...warmBorder);
    doc.setLineWidth(0.25);
    doc.rect(sumX, y, sumWidth, capH, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...warmMuted);
    doc.text('PRICE SUMMARY', sumX + 3, y + 3.7, { charSpace: 0.5 });

    doc.setDrawColor(...warmBorder);
    doc.rect(sumX, y + capH, sumWidth, sumRows.length * rowH + 2, 'S');
    let rowY = y + capH + 4.6;
    sumRows.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...warmMuted);
      doc.text(label, sumX + 3, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...warmText);
      doc.text(value, sumX + sumWidth - 3, rowY, { align: 'right' });
      rowY += rowH;
    });

    // The total sits on the tan accent in dark text: white on tan does not meet contrast
    const totalY = y + capH + sumRows.length * rowH + 2;
    doc.setFillColor(...warmAccent);
    doc.rect(sumX, totalY, sumWidth, totalH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...warmText);
    doc.text('TOTAL', sumX + 3, totalY + 5.6, { charSpace: 0.6 });
    doc.setFontSize(10.5);
    doc.text(formatCurrency(total), sumX + sumWidth - 3, totalY + 5.8, { align: 'right' });

    y += sumHeight + 8;

    // ===== INTERNAL (package PDF only) =====
    // The four figures the package form shows -- Annual Vendor Cost, XLAND Cost, Customer Price,
    // Margin -- in four cells under the price summary. Only a package export carries them: an
    // estimate's PDF goes to the customer and never states a cost.
    const internal = type === 'package' ? data.internalSummary : null;
    if (internal) {
      if (y + 24 > pageHeight) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text('INTERNAL', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('(not shown to customers)', margin + doc.getTextWidth('INTERNAL') + 2, y);
      y += 3;
      const cells = [
        ['Annual Vendor Cost', formatCurrency(internal.vendorCost)],
        ['XLAND Cost', formatCurrency(internal.xlandCost)],
        ['Customer Price', formatCurrency(internal.customerPrice)],
        ['Margin', internal.marginPercent == null ? '-' : `${internal.marginPercent}%`]
      ];
      const gap = 3;
      const cellW = (pageWidth - margin * 2 - gap * (cells.length - 1)) / cells.length;
      const cellH = 13;
      cells.forEach(([label, value], index) => {
        const x = margin + index * (cellW + gap);
        doc.setDrawColor(...borderLight);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, cellW, cellH, 1.5, 1.5, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...lightText);
        doc.text(label, x + 3, y + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const negative = label === 'Margin' && internal.xlandCost < 0;
        doc.setTextColor(...(label === 'Margin' ? (negative ? [220, 38, 38] : [5, 150, 105]) : darkText));
        doc.text(value, x + 3, y + 10);
      });
      y += cellH + 8;
    }

    // ===== NOTES (Plain) =====
    // Measured whole like the terms below: jsPDF never paginates a drawn block, so without the
    // upfront check an overflowing note ran under the footer instead of onto a fresh page.
    if (data.description && data.description.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const noteLines = doc.splitTextToSize(decodeHtml(String(data.description)), pageWidth - margin * 2).slice(0, 8);
      if (y + 8 + noteLines.length * 4 + 6 > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }

      doc.setTextColor(...heading);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTES', margin, y);
      y += 8;

      doc.setTextColor(...darkText);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(noteLines, margin, y);
      y += noteLines.length * 4 + 6;
    }

    // ===== TERMS & CONDITIONS - last section, only when the estimate carries them =====
    const termsLines = estimateTermsLines(data);
    if (termsLines.length) {
      // The block reads as one: measured whole before anything is drawn, so it either fits on
      // this page or opens a fresh one -- never split mid-list. A block taller than a page
      // still flows, since it cannot fit anywhere whole.
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const wrapped = termsLines.map((clause, index) =>
        doc.splitTextToSize(`${index + 1}. ${decodeHtml(String(clause))}`, pageWidth - margin * 2 - 4));
      const blockHeight = 8 + wrapped.reduce((height, lines) => height + lines.length * 3.6 + 2, 0) + 4;
      if (y + 16 + blockHeight > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.setTextColor(...heading);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TERMS & CONDITIONS', margin, y);
      y += 8;

      doc.setTextColor(...darkText);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      wrapped.forEach(lines => {
        if (y + lines.length * 3.6 > pageHeight - 25) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, margin + 2, y);
        y += lines.length * 3.6 + 2;
      });
      y += 4;
    }

    // ===== FOOTER =====
    const footerY = pageHeight - 12;
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    
    // The company and how to reach it, and nothing else: no "computer-generated document" note,
    // no automated-mail disclaimer, no watermark. An estimate is a document the customer is asked
    // to approve, and a disclaimer across it reads as though it were a draft.
    doc.setTextColor(...lightText);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(COMPANY_FOOTER_LINE, pageWidth / 2, footerY, { align: 'center' });

    // The print path takes the document itself; every other caller gets the file saved
    if (returnDoc) return doc;
    savePDFCrossPlatform(doc, filename);
    return true;
  } catch (error) {
    console.error('[PDF] Error:', error);
    return false;
  }
};

// Resolve an estimate to the document's data: services, addons and every alias a stored row
// or a portal's own shape may carry. Shared by the download and the print path.
const estimateExportData = (estimate) => {
  debug('[PDF] exportEstimateToPDF called for:', estimate?.estimateId || estimate?.estimate_id);

  try {
    if (!estimate) {
      console.error('[PDF] No estimate data provided');
      return false;
    }

    estimate = { ...estimate, addons: getEstimateAddons(estimate) };
    if (typeof estimate.services === 'string') {
      try { estimate.services = JSON.parse(estimate.services); } catch { estimate.services = []; }
    }

    // Prepare services from various possible formats
    let services = [];
    
    debug('[PDF] Estimate type:', estimate.estimateType || estimate.estimate_type);
    debug('[PDF] Package services:', estimate.packageServices);
    
    // PRIORITY 1: Check package_services (from database with descriptions)
    if (estimate.package_services) {
      try {
        const pkgServices = typeof estimate.package_services === 'string' ? JSON.parse(estimate.package_services) : estimate.package_services;
        if (Array.isArray(pkgServices) && pkgServices.length > 0) {
          debug('[PDF] Using package_services:', pkgServices);
          services = pkgServices.map(s => ({
            name: s.service || s.name || s.serviceName || 'Service',
            frequencyCount: s.frequencyCount ?? s.frequency_count ?? s.frequency ?? s.visits ?? 1,
            frequencyType: s.frequencyType || s.frequency_type || 'Monthly',
            description: s.description || '',
            category: s.category || '',
            quantity: s.quantity ?? null,
            ...serviceMethodAndInput(s, { isPackage: true })
          }));
        }
      } catch (e) { debug('[PDF] package_services parse error:', e); }
    }
    // PRIORITY 2: Check packageServices (services from selected AMC package)
    if (services.length === 0 && estimate.packageServices && Array.isArray(estimate.packageServices) && estimate.packageServices.length > 0) {
      debug('[PDF] Using packageServices:', estimate.packageServices);
      services = estimate.packageServices.map(s => ({
        name: s.service || s.name || s.serviceName || 'Service',
        frequencyCount: s.frequencyCount ?? s.frequency ?? s.visits ?? 1,
        frequencyType: s.frequencyType || 'Monthly',
        description: s.description || '',
        category: s.category || '',
        quantity: s.quantity ?? null,
        ...serviceMethodAndInput(s, { isPackage: true })
      }));
    }
    // A stored estimate keeps its package rows under services_data -- the same field
    // backend/utils/estimateData.js falls back to -- as serviceRows, services, or a bare array
    if (services.length === 0 && estimate.services_data) {
      try {
        const parsed = typeof estimate.services_data === 'string' ? JSON.parse(estimate.services_data) : estimate.services_data;
        const list = Array.isArray(parsed) ? parsed : (parsed?.serviceRows || parsed?.services || []);
        if (Array.isArray(list) && list.length > 0) {
          debug('[PDF] Using services_data:', list);
          services = list.map(s => ({
            name: s.service || s.name || s.serviceName || 'Service',
            frequencyCount: s.frequencyCount ?? s.frequency_count ?? s.frequency ?? s.visits ?? 1,
            frequencyType: s.frequencyType || s.frequency_type || 'Monthly',
            description: s.description || '',
            category: s.category || '',
            quantity: s.quantity ?? null,
            ...serviceMethodAndInput(s, { isPackage: true })
          }));
        }
      } catch (e) { debug('[PDF] services_data parse error:', e); }
    }
    // PRIORITY 2: Check serviceRows (package service rows from form)
    if (services.length === 0 && estimate.serviceRows && Array.isArray(estimate.serviceRows) && estimate.serviceRows.length > 0) {
      services = estimate.serviceRows.filter(sr => sr.service || sr.name).map(sr => ({
        name: sr.service || sr.name || 'Service',
        frequencyCount: sr.frequencyCount ?? sr.frequency ?? 1,
        frequencyType: sr.frequencyType || 'Monthly',
        ...serviceMethodAndInput(sr, { isPackage: true })
      }));
    }
    // PRIORITY 3: Check services array (from database or form)
    else if (estimate.services && Array.isArray(estimate.services) && estimate.services.length > 0) {
      debug('[PDF] Processing services array:', estimate.services);
      services = estimate.services.map(s => {
        // Handle nested package structure with services inside
        if (s.services && Array.isArray(s.services)) {
          return s.services.map(inner => ({
            name: inner.name || inner.service || 'Service',
            frequencyCount: inner.frequencyCount ?? inner.frequency ?? 1,
            frequencyType: inner.frequencyType || inner.frequency_type || 'Monthly',
            description: getServiceDescription(inner),
            category: inner.category || '',
            quantity: inner.quantity ?? null,
            ...serviceMethodAndInput(inner)
          }));
        }
        // Handle addon/service structure
        return {
          name: s.name || s.service || s.serviceName || s.description || 'Service',
          frequencyCount: s.frequencyCount ?? s.frequency ?? s.visits ?? 1,
          frequencyType: s.frequencyType || s.frequency_type || s.billingType || s.billing || 'Monthly',
          description: getServiceDescription(s),
          category: s.category || '',
          quantity: s.quantity ?? null,
          ...serviceMethodAndInput(s)
        };
      }).flat();
    }
    
    // If package name exists and no services, show package name as fallback
    if (services.length === 0 && (estimate.packageName || estimate.package_name)) {
      const pkgName = estimate.packageName || estimate.package_name;
      debug('[PDF] Adding package as service:', pkgName);
      services.push({
        name: pkgName + ' - AMC Services',
        frequencyCount: 12,
        frequencyType: estimate.billingDuration || estimate.billing_duration || 'Yearly'
      });
    }
    
    // Final fallback - if still no services but has a total, add a placeholder
    if (services.length === 0 && estimate.addons.length === 0 && (estimate.total || estimate.totalPrice || estimate.subtotal)) {
      debug('[PDF] No services found, adding placeholder');
      services.push({
        name: estimate.propertyType ? `${estimate.propertyType} Service` : 'Estimate Services',
        frequencyCount: 1,
        frequencyType: estimate.billingDuration || 'Yearly'
      });
    }
    
    debug('[PDF] Final services:', services);

    // Parse addons from various formats (including descriptions)
    let addons = [];

    // A service as the document states it. Category, quantity and price are carried through
    // rather than dropped: the table has a column for each of them, and an addon flattened to
    // name and frequency alone printed every price as Rs. 0.
    const exportService = (item) => ({
      name: item.name || item.serviceName || item.service_name || item.services?.[0]?.name || 'Service',
      frequencyType: item.frequencyType || item.frequency_type || item.services?.[0]?.frequencyType || 'One-time',
      frequencyCount: item.frequencyCount ?? item.frequency_count ?? item.visits ?? item.noOfVisits ?? item.no_of_visits ?? item.services?.[0]?.frequency ?? item.services?.[0]?.frequencyCount ?? 1,
      description: getServiceDescription(item),
      category: item.category || item.service_category || '',
      quantity: item.quantity ?? item.pricingInputs?.quantity ?? null,
      price: getAddonPrice(item),
      ...serviceMethodAndInput(item)
    });

    // Try addons array first
    if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
      addons = estimate.addons.map(exportService);
    }
    // Try addons_data JSON string (from backend)
    if (addons.length === 0 && estimate.addons_data) {
      try {
        const parsed = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
        if (Array.isArray(parsed) && parsed.length > 0) addons = parsed.map(exportService);
      } catch (e) { debug('[PDF] addons_data parse error:', e); }
    }
    // Try selectedAddons array (from form)
    if (addons.length === 0 && estimate.selectedAddons && Array.isArray(estimate.selectedAddons) && estimate.selectedAddons.length > 0) {
      addons = estimate.selectedAddons.map(exportService);
    }
    
    debug('[PDF] Parsed addons:', addons);

    const exportData = {
      estimateId: estimate.estimateId || estimate.estimate_id || estimate.id || 'EST-' + Date.now(),
      estimateType: estimate.estimateType || estimate.estimate_type || (estimate.propertyId || estimate.property_id ? 'property-based' : 'direct'),
      packageName: estimate.packageName || estimate.package_name,
      // The package's price belongs in Total Services Price beside the added services
      packagePrice: parseFloat(estimate.packagePrice ?? estimate.package_price ?? estimate.packageRate) || 0,
      amcPackageDescription: estimate.amc_package_description || estimate.amcPackageDescription || '',
      propertyId: estimate.propertyId || estimate.property_id,
      // The code the property is known by, named in BILL TO beside the customer
      propertyCode: estimate.propertyCode || estimate.property_code,
      propertyType: estimate.propertyType || estimate.property_type || estimate.entryType || 'N/A',
      propertyName: estimate.propertyName || estimate.property_name,
      communityName: estimate.communityName || estimate.community_name || estimate.propertyName || estimate.property_name,
      zone: estimate.zone || estimate.zoneName || estimate.zone_name || estimate.zoneId || estimate.zone_id,
      areaName: estimate.areaName || estimate.area_name || estimate.area || estimate.areaId || estimate.area_id,
      division: estimate.division || estimate.divisionName || estimate.division_name || estimate.divisionId || estimate.division_id,
      // GC/APT specific fields
      numberOfBlocks: estimate.numberOfBlocks || estimate.number_of_blocks || estimate.blocks,
      unitsPerBlock: estimate.unitsPerBlock || estimate.units_per_block,
      totalUnits: estimate.totalUnits || estimate.total_units || estimate.numberOfUnits || estimate.number_of_units,
      blockNames: estimate.blockNames || estimate.block_names,
      // APT specific fields
      towerName: estimate.towerName || estimate.tower_name,
      blockNumber: estimate.blockNumber || estimate.block_number,
      // PLOT/VILLA specific fields
      villaPlotNumber: estimate.villaPlotNumber || estimate.villa_plot_number || estimate.plotNumber || estimate.plot_number,
      address: estimate.address || estimate.propertyAddress || estimate.property_address || estimate.fullAddress,
      city: estimate.city,
      state: estimate.state,
      pincode: estimate.pincode || estimate.postalCode || estimate.postal_code,
      customerName: estimate.customerName || estimate.clientName || estimate.customer_name || estimate.client_name,
      customerPhone: estimate.customerPhone || estimate.phone || estimate.customer_phone || estimate.contactPhone || estimate.contact_phone || estimate.mobile || estimate.contactNumber || estimate.phoneNumber || estimate.clientPhone,
      customerEmail: estimate.customerEmail || estimate.email || estimate.customer_email || estimate.contactEmail || estimate.contact_email,
      noOfVisits: estimate.noOfVisits || estimate.no_of_visits || estimate.visits || estimate.numberOfVisits,
      description: estimate.description || estimate.notes || estimate.remarks,
      services,
      addons,
      addonsTotal: estimate.addons.reduce((sum, addon) => sum + getAddonPrice(addon), 0),
      billingDuration: estimate.billingDuration || estimate.billing_duration || 'Yearly',
      subtotal: parseFloat(estimate.subtotal || estimate.subTotal || estimate.sub_total || 0),
      discountPercent: parseFloat(estimate.discountPercent ?? estimate.discount_percent ?? estimate.discount_percentage ?? 0),
      discountAmount: parseFloat(estimate.discountAmount ?? estimate.discount_amount ?? estimate.discount ?? 0),
      gstPercent: parseFloat(estimate.gstPercent ?? estimate.gst_percent ?? estimate.tax_percentage ?? 0),
      gstAmount: parseFloat(estimate.gstAmount ?? estimate.gst_amount ?? estimate.tax_amount ?? estimate.tax ?? estimate.gst ?? 0),
      totalPrice: parseFloat(estimate.totalPrice || estimate.total || estimate.total_price || estimate.total_amount || 0),
      createdAt: estimate.createdAt || estimate.created_at || new Date().toISOString(),
      // Work Order Estimate fields
      isWorkOrderEstimate: estimate.estimate_type === 'work_order' || estimate.estimateType === 'work_order',
      workOrderId: estimate.work_order_id || estimate.workOrderId,
      workOrderCategory: estimate.work_order_category || estimate.workOrderCategory,
      workOrderSubcategory: estimate.work_order_subcategory || estimate.workOrderSubcategory,
      workOrderDescription: estimate.work_order_description || estimate.workOrderDescription,
      workOrderPriority: estimate.work_order_priority || estimate.workOrderPriority,
      workOrderStatus: estimate.work_order_status || estimate.workOrderStatus,
      // Terms & Conditions, printed only when the estimate was created with them
      includeTerms: estimate.includeTerms ?? estimate.include_terms,
      termsConditions: estimate.termsConditions ?? estimate.terms_conditions
    };

    return exportData;
  } catch (error) {
    console.error('PDF Export Error:', error);
    return null;
  }
};

// Export estimate to PDF
export const exportEstimateToPDF = (estimate) => {
  const exportData = estimateExportData(estimate);
  if (!exportData) return false;
  debug('[PDF] Generating PDF for:', exportData.estimateId);
  const result = generatePDF(exportData, 'estimate', `Estimate-${exportData.estimateId}.pdf`);
  debug('[PDF] generatePDF result:', result);
  return result;
};

// Print the estimate's PDF rather than the page it sits in. The browser's own print stamps the
// page title and URL on every sheet -- chrome no stylesheet can remove -- while a document
// opened in the PDF viewer prints alone. The generated file loads into a hidden frame and that
// frame prints; if the frame cannot print, the PDF opens in a tab instead.
export const printEstimatePDF = (estimate) => {
  try {
    const exportData = estimateExportData(estimate);
    if (!exportData) return false;
    const doc = generatePDF(exportData, 'estimate', `Estimate-${exportData.estimateId}.pdf`, { returnDoc: true });
    if (!doc) return false;
    const url = URL.createObjectURL(doc.output('blob'));
    const frame = document.createElement('iframe');
    frame.title = `Estimate ${exportData.estimateId}`;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        window.open(url, '_blank');
      }
      // The blob outlives the dialog: some browsers never fire afterprint on a frame, so a
      // timer is the fallback
      const done = () => { frame.remove(); URL.revokeObjectURL(url); };
      frame.contentWindow.addEventListener?.('afterprint', done, { once: true });
      setTimeout(done, 60000);
    };
    frame.src = url;
    return true;
  } catch (error) {
    console.error('[PDF] Print error:', error);
    return false;
  }
};

// Export package to PDF
export const exportPackageToPDF = (pkg) => {
  debug('[PDF] exportPackageToPDF called');
  if (isExporting) {
    debug('[PDF] Already exporting, skipping');
    return false;
  }
  isExporting = true;

  try {
    if (!pkg) throw new Error('No package data provided');
    debug('[PDF] Package data:', pkg);

    // Prepare services
    let services = [];
    if (pkg.serviceRows && Array.isArray(pkg.serviceRows)) {
      services = pkg.serviceRows.map(sr => ({
        name: sr.service || sr.name || sr.serviceType || 'Service',
        ...serviceMethodAndInput(sr, { isPackage: true }),
        category: sr.category || '',
        description: sr.description || '',
        frequencyCount: sr.frequencyCount ?? sr.frequency ?? 1,
        frequencyType: sr.frequencyType || 'Monthly',
        price: parseFloat(sr.price || sr.rate || 0)
      }));
    } else if (typeof pkg.services === 'string') {
      // Try to parse JSON first
      try {
        const parsed = JSON.parse(pkg.services);
        if (parsed.serviceRows && Array.isArray(parsed.serviceRows)) {
          services = parsed.serviceRows.map(sr => ({
            name: sr.service || sr.name || sr.serviceType || 'Service',
            ...serviceMethodAndInput(sr, { isPackage: true }),
            category: sr.category || '',
            description: sr.description || '',
            frequencyCount: sr.frequencyCount ?? sr.frequency ?? 1,
            frequencyType: sr.frequencyType || 'Monthly',
            price: parseFloat(sr.price || sr.rate || 0)
          }));
        } else if (Array.isArray(parsed)) {
          services = parsed.map(s => ({
            name: s.name || s.service || s.serviceType || 'Service',
            description: s.description || '',
            frequencyCount: s.frequencyCount ?? s.frequency ?? 1,
            frequencyType: s.frequencyType || 'Monthly',
            price: parseFloat(s.price || 0)
          }));
        }
      } catch (e) {
        // Fallback to comma-separated
        services = pkg.services.split(',').map(s => ({
          name: s.trim() || 'Service',
          description: '',
          frequencyCount: 1,
          frequencyType: 'Monthly',
          price: 0
        }));
      }
    } else if (Array.isArray(pkg.services)) {
      services = pkg.services.map(s => ({
        name: typeof s === 'string' ? s : (s.name || s.service || s.serviceType || 'Service'),
        description: typeof s === 'string' ? '' : (s.description || ''),
        frequencyCount: s.frequencyCount ?? s.frequency ?? 1,
        frequencyType: s.frequencyType || 'Monthly',
        price: parseFloat(s.price || 0)
      }));
    }

    if (services.length === 0) {
      services = [{ name: 'AMC Service Package', frequencyCount: 1, frequencyType: 'Monthly', price: 0 }];
    }

    const totalPrice = parseFloat(pkg.rate || pkg.totalPrice || pkg.totalRate || pkg.price || 0);
    // The rows as saved, with the vendor cost each was priced on, for the INTERNAL section
    let savedRows = Array.isArray(pkg.serviceRows) && pkg.serviceRows.length ? pkg.serviceRows : [];
    if (!savedRows.length) {
      const stored = typeof pkg.services === 'string' ? (() => { try { return JSON.parse(pkg.services); } catch { return null; } })() : pkg.services;
      savedRows = Array.isArray(stored?.serviceRows) ? stored.serviceRows : Array.isArray(stored) ? stored.filter(s => s && typeof s === 'object') : [];
    }

    const exportData = {
      packageId: pkg.packageId || pkg.id || 'PKG-' + Date.now(),
      estimateId: pkg.packageId || pkg.id || 'PKG-' + Date.now(),
      packageName: pkg.packageName || pkg.name || 'AMC Package',
      packageCode: pkg.packageCode || pkg.package_code || pkg.packageId,
      propertyType: pkg.propertyType || 'General',
      // Every type the package covers, named in full on the letterhead's card
      propertyTypeLabel: (() => {
        const types = Array.isArray(pkg.propertyTypes) && pkg.propertyTypes.length ? pkg.propertyTypes : getPackagePropertyTypes(pkg);
        return (types || []).map(getPropertyTypeLabel).filter(Boolean).join(', ');
      })(),
      propertyId: pkg.propertyId,
      zone: pkg.zone || pkg.zoneName,
      division: pkg.division || pkg.divisionName,
      communityName: pkg.communityName || pkg.propertyName,
      address: pkg.address,
      customerName: pkg.customerName || pkg.clientName,
      customerPhone: pkg.customerPhone || pkg.phone,
      customerEmail: pkg.customerEmail || pkg.email,
      noOfVisits: pkg.noOfVisits || pkg.visits,
      description: pkg.description || pkg.notes,
      services,
      billingDuration: pkg.billingDuration || 'Yearly',
      subtotal: totalPrice,
      discount: parseFloat(pkg.discount || 0),
      totalPrice: totalPrice,
      createdAt: pkg.createdAt || new Date().toISOString(),
      // Vendor cost, XLAND cost, customer price, margin -- a package PDF is downloaded by the
      // internal portals that price packages, never sent to a customer
      internalSummary: packageInternalSummary(savedRows, totalPrice)
    };

    generatePDF(exportData, 'package', `AMC-Package-${(exportData.packageName).replace(/\s+/g, '-')}.pdf`);
    isExporting = false;
    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    isExporting = false;
    return false;
  }
};

// Export Invoice to PDF - Matching Image 2 design exactly
export const exportInvoiceToPDF = (invoice) => {
  try {
    if (!invoice) {
      console.error('[PDF] No invoice data provided');
      return false;
    }

    // Parse line items
    let lineItems = [];
    if (invoice.lineItems) {
      lineItems = typeof invoice.lineItems === 'string' ? JSON.parse(invoice.lineItems) : invoice.lineItems;
    } else if (invoice.line_items) {
      lineItems = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 0;

    // Colors per design spec (Image 2)
    const headerBlack = [21, 21, 21];
    const gold = [201, 162, 39];          // #C9A227
    const lightGold = [232, 198, 106];
    const primaryText = [23, 23, 23];
    const secondaryText = [85, 85, 85];
    const borderGray = [229, 229, 229];
    const cardBg = [251, 247, 238];
    const white = [255, 255, 255];

    // Calculate if compact mode needed
    const itemCount = lineItems.length;
    const isCompact = itemCount > 4;

    // ===== HEADER - Use shared function =====
    y = drawPDFHeader(doc, margin);

    // ===== ID / DATE / DUE ROW (Compact) =====
    doc.setFontSize(8);
    doc.setTextColor(...secondaryText);
    doc.text('ID:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...primaryText);
    doc.text(String(invoice.invoiceId || 'N/A'), margin + 12, y);
    
    if (invoice.sourceEstimateId) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gold);
      doc.text('Estimate: ' + invoice.sourceEstimateId, margin, y + 10);
    }
    
    // Date and Due on right - aligned to right edge
    const dateLabel = pageWidth - margin - 60;
    const dateValue = pageWidth - margin - 32;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('Date:', dateLabel, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryText);
    doc.text(formatDate(invoice.invoiceDate), dateValue, y);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('Due:', dateLabel, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...primaryText);
    doc.text(formatDate(invoice.dueDate), dateValue, y + 12);
    
    y += 28;

    // ===== TOTAL AMOUNT DUE BANNER (Compact & Elegant) =====
    const bannerHeight = 18;
    doc.setFillColor(...gold);
    doc.roundedRect(margin, y, pageWidth - margin * 2, bannerHeight, 3, 3, 'F');
    
    doc.setTextColor(...white);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL AMOUNT DUE', pageWidth / 2, y + 5, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Rs. ' + Math.round(invoice.totalAmount || 0).toLocaleString('en-IN'), pageWidth / 2, y + 13, { align: 'center' });
    
    y += bannerHeight + 8;

    // ===== PROPERTY & CUSTOMER DETAILS (Compact) =====
    const cardGap = 6;
    const cardWidth = (pageWidth - margin * 2 - cardGap) / 2;
    const cardHeight = isCompact ? 42 : 48;
    const lineH = isCompact ? 5 : 5.5;
    
    // Property Details Card
    doc.setFillColor(...cardBg);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 3, 3, 'F');
    
    doc.setTextColor(...primaryText);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY DETAILS', margin + 6, y + 12);
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    let py = y + 20;
    doc.setTextColor(...secondaryText);
    doc.text('Property ID: ' + String(invoice.propertyCode || '-'), margin + 6, py); py += lineH;
    doc.text('Name: ' + String(invoice.propertyName || '-').substring(0, 20), margin + 6, py); py += lineH;
    doc.text('Type: ' + String(invoice.propertyType || '-'), margin + 6, py); py += lineH;
    doc.text('Zone: ' + String(invoice.zone || '-'), margin + 6, py); py += lineH;
    doc.text('City: ' + String(invoice.city || '-'), margin + 6, py);
    
    // Customer Details Card
    const custCardX = margin + cardWidth + cardGap;
    doc.setFillColor(...cardBg);
    doc.roundedRect(custCardX, y, cardWidth, cardHeight, 3, 3, 'F');
    
    doc.setTextColor(...primaryText);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER DETAILS', custCardX + 6, y + 12);
    
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    let cy = y + 20;
    doc.setTextColor(...secondaryText);
    doc.text('Name: ' + String(invoice.customerName || '-'), custCardX + 6, cy); cy += lineH;
    doc.text('Phone: ' + String(invoice.customerPhone || '-'), custCardX + 6, cy); cy += lineH;
    // maxWidth scales a long email down rather than truncating it -- the full address always prints
    const email = String(invoice.customerEmail || '-');
    doc.text('Email: ' + email, custCardX + 6, cy, { maxWidth: cardWidth - 10 }); cy += lineH;
    doc.text('City: ' + String(invoice.city || '-'), custCardX + 6, cy);
    
    y += cardHeight + 8;

    // ===== SERVICES INCLUDED - Gold themed table =====
    // Parse services
    const allItems = lineItems.filter(item => {
      const desc = String(item.description || item.name || '').toLowerCase();
      return !desc.includes('amc package:') && !desc.includes('amc services');
    });

    const isAddon = (item) => {
      const typeStr = String(item.type || '').toLowerCase();
      if (typeStr === 'addon' || typeStr === 'add-on' || typeStr === 'add_on') return true;
      const desc = String(item.description || item.name || '').toLowerCase();
      return desc.includes('add-on') || desc.includes('addon');
    };

    const services = allItems.filter(item => !isAddon(item)).map(item => {
      const itemName = decodeHtml(item.name || '');
      const itemDetails = stripInternalServiceDetails(decodeHtml(item.details || ''));
      const fullDesc = stripInternalServiceDetails(decodeHtml(String(item.description || item.name || 'Service')));
      const parts = fullDesc.split(' - ');
      return {
        name: itemName || parts[0] || 'Service',
        description: itemDetails || parts.slice(1).join(' - ') || '-',
        frequency: item.frequency || item.frequencyType || item.frequency_type || '-',
        visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1
      };
    });

    // Extract addons
    const addons = allItems.filter(item => isAddon(item)).map(item => {
      const fullDesc = stripInternalServiceDetails(decodeHtml(String(item.description || item.name || 'Service')));
      let addonName = fullDesc;
      let addonDesc = '-';
      
      if (fullDesc.includes(' - ')) {
        const parts = fullDesc.split(' - ');
        addonName = parts[0];
        addonDesc = parts.slice(1).join(' - ') || '-';
      }
      
      return {
        name: addonName,
        description: addonDesc,
        frequency: item.frequency || item.frequencyType || item.frequency_type || '-',
        visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1,
        price: parseFloat(item.totalPrice || item.total_price || item.unitPrice || item.unit_price || 0)
      };
    });

    const isWorkOrderInvoice = invoice.invoiceType === 'work_order' || invoice.invoice_type === 'work_order';

    // ===== WORK ORDER DETAILS (for work order invoices) =====
    if (isWorkOrderInvoice) {
      const woItem = services[0] || {};
      const category = invoice.workOrderCategory || invoice.work_order_category || woItem.category || '-';
      const subcategory = invoice.workOrderSubcategory || invoice.work_order_subcategory || woItem.subcategory || '-';
      const woDescription = decodeHtml(invoice.workOrderDescription || invoice.work_order_description || woItem.description || '');
      const woId = invoice.workOrderId || invoice.work_order_id || '-';
      
      // Section header - line starts AFTER text
      doc.setTextColor(...primaryText);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('WORK ORDER DETAILS', margin, y + 5);
      doc.setDrawColor(249, 115, 22); // Orange
      doc.setLineWidth(0.3);
      // Orange line AFTER text (~50px wide at fontSize 7)
      doc.line(margin + 52, y + 4, margin + 82, y + 4);
      y += 10;
      
      // Work order details box - orange tinted
      const woBoxHeight = woDescription && woDescription.length > 50 ? 28 : 22;
      doc.setFillColor(255, 247, 237); // #FFF7ED
      doc.setDrawColor(253, 186, 116); // #FDBA74
      doc.roundedRect(margin, y, pageWidth - margin * 2, woBoxHeight, 2, 2, 'FD');
      
      // Three columns
      const col1 = margin + 6;
      const col2 = margin + 75;
      const col3 = margin + 155;
      
      doc.setFontSize(5);
      doc.setTextColor(154, 52, 18); // #9A3412
      doc.setFont('helvetica', 'normal');
      doc.text('Work Order ID', col1, y + 5);
      doc.text('Category', col2, y + 5);
      doc.text('Subcategory', col3, y + 5);
      
      doc.setFontSize(7);
      doc.setTextColor(234, 88, 12); // #EA580C
      doc.setFont('helvetica', 'bold');
      doc.text(String(woId), col1, y + 11);
      doc.setTextColor(...primaryText);
      doc.setFont('helvetica', 'normal');
      doc.text(String(category).substring(0, 20), col2, y + 11);
      doc.text(String(subcategory).substring(0, 20), col3, y + 11);
      
      // Description if exists
      if (woDescription && woDescription !== '-') {
        doc.setFontSize(5);
        doc.setTextColor(154, 52, 18);
        doc.text('Description', col1, y + 17);
        doc.setFontSize(6);
        doc.setTextColor(...primaryText);
        doc.text(woDescription.substring(0, 80), col1, y + 22);
      }
      
      y += woBoxHeight + 8;
    }

    if (!isWorkOrderInvoice && services.length > 0) {
      // Section header - text only (no decorative line)
      doc.setTextColor(...primaryText);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICES INCLUDED', margin, y + 5);
      
      y += 10;

      // Services table - with full descriptions and text wrapping
      autoTable(doc, {
        startY: y,
        head: [['#', 'Service', 'Description', 'Frequency', 'Visits']],
        body: services.map((item, idx) => [
          String(idx + 1),
          decodeHtml(String(item.name)),
          decodeHtml(String(item.description)) || '-',
          String(item.frequency),
          String(item.visits)
        ]),
        theme: 'grid',
        styles: { 
          fontSize: 6.5, 
          cellPadding: 3, 
          valign: 'middle', 
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: { fillColor: gold, textColor: white, fontStyle: 'bold', fontSize: 7, halign: 'center' },
        bodyStyles: { textColor: primaryText, minCellHeight: 10, lineColor: [220, 220, 220] },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        columnStyles: { 
          0: { cellWidth: 8, halign: 'center' }, 
          1: { cellWidth: 30, halign: 'left' }, 
          2: { cellWidth: 'auto', halign: 'left' }, 
          3: { cellWidth: 25, halign: 'center' }, 
          4: { cellWidth: 15, halign: 'center' } 
        },
        margin: { left: margin, right: margin },
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.2
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ===== ADDONS SECTION =====
    if (!isWorkOrderInvoice && addons.length > 0) {
      // Section header
      doc.setTextColor(...primaryText);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICES', margin, y + 5);
      
      y += 10;

      // Addons table - purple themed
      const addonGold = [201, 162, 39]; // #c9a227 - same as services for consistency
      autoTable(doc, {
        startY: y,
        head: [['#', 'Service', 'Description', 'Frequency', 'Visits', 'Price']],
        body: addons.map((item, idx) => [
          String(idx + 1),
          decodeHtml(String(item.name)),
          decodeHtml(String(item.description)) || '-',
          String(item.frequency),
          String(item.visits),
          `Rs. ${Math.round(item.price).toLocaleString('en-IN')}`
        ]),
        theme: 'grid',
        styles: { 
          fontSize: 6.5, 
          cellPadding: 3, 
          valign: 'middle', 
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: { fillColor: addonGold, textColor: white, fontStyle: 'bold', fontSize: 7, halign: 'center' },
        bodyStyles: { textColor: primaryText, minCellHeight: 10, lineColor: [220, 220, 220] },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        columnStyles: { 
          0: { cellWidth: 8, halign: 'center' }, 
          1: { cellWidth: 28, halign: 'left' }, 
          2: { cellWidth: 'auto', halign: 'left' }, 
          3: { cellWidth: 22, halign: 'center' }, 
          4: { cellWidth: 12, halign: 'center' },
          5: { cellWidth: 25, halign: 'right' } 
        },
        margin: { left: margin, right: margin },
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.2
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ===== PRICE SUMMARY - Right aligned (Compact) =====
    const summaryWidth = 90;
    const summaryX = pageWidth - margin - summaryWidth;
    
    // Section header - text only (no decorative line)
    doc.setTextColor(...primaryText);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('PRICE SUMMARY', summaryX, y + 5);
    
    y += 10;

    // Price summary box
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.3);
    doc.roundedRect(summaryX, y, summaryWidth, 36, 3, 3, 'S');
    
    let sy = y + 9;
    const labelX = summaryX + 6;
    const valueX = summaryX + summaryWidth - 6;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('Subtotal:', labelX, sy);
    doc.setTextColor(...primaryText);
    doc.text('Rs. ' + Math.round(invoice.subtotal || 0).toLocaleString('en-IN'), valueX, sy, { align: 'right' });
    sy += 7;
    
    doc.setTextColor(...secondaryText);
    doc.text('GST (' + (parseFloat(invoice.taxPercentage) || 0).toFixed(2) + '%):', labelX, sy);
    doc.setTextColor(...primaryText);
    doc.text('Rs. ' + Math.round(invoice.taxAmount || 0).toLocaleString('en-IN'), valueX, sy, { align: 'right' });
    sy += 8;
    
    doc.setDrawColor(...borderGray);
    doc.line(summaryX + 4, sy - 3, summaryX + summaryWidth - 4, sy - 3);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primaryText);
    doc.text('Grand Total:', labelX, sy + 2);
    doc.setTextColor(...gold);
    doc.text('Rs. ' + Math.round(invoice.totalAmount || 0).toLocaleString('en-IN'), valueX, sy + 2, { align: 'right' });
    
    y += 42;

    // ===== FOOTER =====
    const footerY = Math.max(y, pageHeight - 15);
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    
    doc.setDrawColor(...borderGray);
    doc.circle(margin + 5, footerY + 5, 3, 'S');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('We appreciate your trust in our services.', margin + 12, footerY + 6);

    // Save
    savePDFCrossPlatform(doc, `Invoice-${invoice.invoiceId || 'INV'}.pdf`);
    return true;

  } catch (error) {
    console.error('[PDF] Invoice export error:', error);
    return false;
  }
};

export default { exportEstimateToPDF, exportPackageToPDF, exportInvoiceToPDF };
