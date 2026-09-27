const PDFDocument = require('pdfkit');
const { customerEstimateData } = require('../utils/estimateData');
const { estimateTermsLines } = require('../utils/estimateTerms');
const path = require('path');

// Logo file path - icon only (without text) for horizontal layout - OPTIMIZED for smaller PDF size
const LOGO_PATH = path.join(__dirname, '../assets/logo-icon-optimized.png');

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
  
  // Gold bar at bottom
  doc.rect(0, headerHeight, 595, 2).fill(gold);
  
  // The lockup -- logo, company name and the PVT LTD rule -- is measured and then centred on the
  // page rather than pinned to the left margin, and PVT LTD is centred on the name above it.
  // Mirrors drawPDFHeader in admin-portal/src/utils/pdfExport.js: a downloaded estimate and an
  // emailed one carry the same header.
  const pageWidth = 595;
  const logoSize = 16;
  const logoGap = 8;
  const lineLen = 4;
  const gap = 0.5;

  doc.fontSize(10).font('Helvetica-Bold');
  const nameWidth = doc.widthOfString('XLAND INFRA');
  doc.fontSize(4).font('Helvetica');
  const pvtLtdWidth = doc.widthOfString('PVT LTD');
  const pvtWidth = lineLen + gap + pvtLtdWidth + gap + lineLen;

  const textWidth = Math.max(nameWidth, pvtWidth);
  const lockupWidth = logoSize + logoGap + textWidth;
  // Centred, but never tighter than the page margin
  const lockupX = Math.max(margin, (pageWidth - lockupWidth) / 2);
  const textX = lockupX + logoSize + logoGap;

  // Logo - small size
  try {
    doc.image(LOGO_PATH, lockupX, 3, { width: logoSize, height: logoSize });
  } catch (logoErr) {
    doc.roundedRect(lockupX, 3, logoSize, logoSize, 1).fill(gold);
  }

  // Company name - XLAND INFRA, centred over the text column
  doc.fontSize(10).fillColor(gold).font('Helvetica-Bold')
     .text('XLAND INFRA', textX, 4, { width: textWidth, align: 'center', lineBreak: false });

  // PVT LTD with a rule on each side, centred under the name
  doc.fontSize(4).fillColor(gold).font('Helvetica');
  doc.strokeColor(gold).lineWidth(0.25);

  const pvtStartX = textX + (textWidth - pvtWidth) / 2;
  const lineY = 15;

  // Left line
  doc.moveTo(pvtStartX, lineY).lineTo(pvtStartX + lineLen, lineY).stroke();

  // PVT LTD text
  doc.text('PVT LTD', pvtStartX + lineLen + gap, lineY - 2.5, { lineBreak: false });

  // Right line
  const rightLineStart = pvtStartX + lineLen + gap + pvtLtdWidth + gap;
  doc.moveTo(rightLineStart, lineY).lineTo(rightLineStart + lineLen, lineY).stroke();

  return headerHeight + 8; // Return starting Y position for content
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

      // Colors
      const black = '#1a1a1a';
      const gold = '#d4a84b';
      const navy = '#1e3a5f';
      const lightGray = '#f8f9fa';

      // ===== HEADER - Use shared function =====
      let y = drawPDFHeader(doc, 50);

      // ===== LAYOUT GRID =====
      // One grid and one set of gaps for the whole document. Every label sits on one of two column
      // edges and every value under its own label, so nothing depends on a hand-picked X again.
      const MARGIN = 50;
      const CONTENT_WIDTH = 495;          // 595pt page less both margins
      const COL_GUTTER = 15;
      const COL_WIDTH = (CONTENT_WIDTH - COL_GUTTER) / 2;
      const COL_X = [MARGIN, MARGIN + COL_WIDTH + COL_GUTTER];
      const LABEL_COLOR = '#6b7280';
      const GAP = { heading: 15, row: 11, section: 20, label: 10 };
      const pageHeight = 780;             // A4 usable height
      const money = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

      const sectionHeading = text => {
        doc.fontSize(10).fillColor(navy).font('Helvetica-Bold').text(text, MARGIN, y, { lineBreak: false });
        y += GAP.heading;
      };

      // A field is its label with its value underneath, both confined to one column, so a value
      // that wraps can never run into the column beside it. Returns the height it used.
      const drawField = (label, value, x, width) => {
        const text = decodeHtml(String(value));
        doc.fontSize(7.5).font('Helvetica').fillColor(LABEL_COLOR).text(label.toUpperCase(), x, y, { width, lineBreak: false });
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333').text(text, x, y + GAP.label, { width });
        return GAP.label + doc.heightOfString(text, { width });
      };

      // Two fields to a line, always on the same two column edges. A field with nothing in it is
      // skipped without leaving a gap, and the line is as tall as its taller side.
      const fieldRow = (left, right) => {
        const filled = value => value !== undefined && value !== null && value !== '';
        let used = 0;
        if (filled(left?.[1])) used = Math.max(used, drawField(left[0], left[1], COL_X[0], COL_WIDTH));
        if (filled(right?.[1])) used = Math.max(used, drawField(right[0], right[1], COL_X[1], COL_WIDTH));
        if (used) y += used + GAP.row;
      };

      // A value too long for half the page -- an address, a note -- spans both columns
      const wideField = (label, value) => {
        if (value === undefined || value === null || value === '') return;
        y += drawField(label, value, MARGIN, CONTENT_WIDTH) + GAP.row;
      };

      const dateStr = new Date(createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      fieldRow(['Estimate No.', estimateId || 'N/A'], ['Date', dateStr]);
      y += GAP.section - GAP.row;

      const propTypeLabel = { 'GC': 'Gated Community', 'APT': 'Apartment', 'VILLA': 'Villa', 'PLOT': 'Plot' }[propertyType] || propertyType;

      sectionHeading('Property Details');
      fieldRow(['Name', propertyName], ['Type', propTypeLabel]);
      fieldRow(['Zone', zone], ['Division', division]);
      fieldRow(['Property ID', propertyCode], ['City', city]);
      fieldRow(['Blocks', numberOfBlocks], ['Total Units', totalUnits]);
      fieldRow(['Tower / Building', towerName], ['Block Number', blockNumber]);
      fieldRow(['Villa / Plot Number', villaPlotNumber], null);
      wideField('Address', address);
      y += GAP.section - GAP.row;

      sectionHeading('Customer Details');
      fieldRow(['Name', customerName], ['Phone', customerPhone]);
      fieldRow(['Email', customerEmail], null);
      y += GAP.section - GAP.row;

      // Work Order Details (only for work order estimates) - same two columns as the sections above
      if (isWorkOrderEstimate && workOrderId) {
        sectionHeading('Work Order Details');
        fieldRow(['Work Order ID', workOrderId], ['Category', workOrderCategory]);
        fieldRow(['Subcategory', workOrderSubcategory], ['Priority', String(workOrderPriority || '').toUpperCase()]);
        y += GAP.section - GAP.row;
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
      const TABLE_COLS = [
        { label: '#', width: 26, align: 'left' },
        { label: 'Service', width: 125, align: 'left' },
        { label: 'Description', width: 214, align: 'left' },
        { label: 'Frequency', width: 85, align: 'left' },
        { label: 'Visits', width: 45, align: 'right' }
      ];
      const CELL_PAD = 8;
      const COL_EDGES = TABLE_COLS.reduce((edges, col) => [...edges, edges[edges.length - 1] + col.width], [MARGIN]);
      const cellWidth = index => TABLE_COLS[index].width - CELL_PAD * 2;

      const drawTableHeader = () => {
        doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(navy);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
        TABLE_COLS.forEach((col, index) => doc.text(col.label, COL_EDGES[index] + CELL_PAD, y + 6.5,
          { width: cellWidth(index), align: col.align, lineBreak: false }));
        y += 20;
      };

      const drawServicesTable = rows => {
        drawTableHeader();
        rows.forEach((row, index) => {
          const cells = [String(index + 1), row.name, row.details, row.frequency, String(row.visits)];
          doc.fontSize(8).font('Helvetica');
          const height = Math.max(24, ...cells.map((text, column) =>
            doc.heightOfString(String(text), { width: cellWidth(column) }) + CELL_PAD * 2));
          if (y + height > pageHeight) { doc.addPage(); y = MARGIN; drawTableHeader(); }
          doc.rect(MARGIN, y, CONTENT_WIDTH, height).fill(index % 2 === 0 ? lightGray : '#ffffff');
          doc.fontSize(8).font('Helvetica').fillColor('#333333');
          cells.forEach((text, column) => doc.text(String(text), COL_EDGES[column] + CELL_PAD, y + CELL_PAD,
            { width: cellWidth(column), align: TABLE_COLS[column].align }));
          y += height;
        });
        y += GAP.row;
      };

      const tableRow = item => ({
        name: decodeHtml(item.name || item.service_name || item.serviceName || item.service || 'Service'),
        details: decodeHtml(item.details || item.description || item.service_description || '-') || '-',
        frequency: String(item.frequencyType || item.frequency_type || item.frequency || 'Monthly').replace(/^\d+x\s*/i, ''),
        visits: item.frequency_count ?? item.frequencyCount ?? item.visits ?? item.quantity ?? 1
      });

      // Only show Services Table for NON-work order estimates
      const hasWorkOrderId = workOrderId && String(workOrderId).length > 0;
      const isWOEstimate = isWorkOrderEstimate || hasWorkOrderId || estimateType === 'work_order';
      
      // Billing Duration - on the grid, like every other field
      const billingValue = billingDuration || billing_duration || 'Yearly';
      const formattedBilling = billingValue.charAt(0).toUpperCase() + billingValue.slice(1).replace('-', ' ');
      fieldRow(['Billing', formattedBilling], null);
      y += GAP.section - GAP.row;

      if (!isWOEstimate && svcList.length > 0) {
        sectionHeading('Services Included');
        drawServicesTable(svcList.map(tableRow));
      }

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
      if (!isWOEstimate && addonList.length > 0) {
        // The heading and its first row stay together rather than splitting across a page
        doc.fontSize(8).font('Helvetica');
        const firstRow = tableRow(addonList[0]);
        const firstHeight = Math.max(24, doc.heightOfString(firstRow.details, { width: cellWidth(2) }) + CELL_PAD * 2);
        if (y + GAP.heading + 20 + firstHeight > pageHeight) { doc.addPage(); y = MARGIN; }

        sectionHeading('Services');
        drawServicesTable(addonList.map(tableRow));

        if (y + 20 > pageHeight) { doc.addPage(); y = MARGIN; }
        const addonsTotal = addonList.reduce((sum, addon) => sum + Number(addon.totalPrice ?? addon.price ?? 0), 0);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(navy)
           .text(`Total Services Price: Rs. ${money(addonsTotal)}`, MARGIN, y, { width: CONTENT_WIDTH, align: 'right', lineBreak: false });
        y += GAP.section;
      }

      // Check if Price Summary needs new page
      if (y + 60 > pageHeight) {
        doc.addPage();
        y = 50;
      }
      
      // ===== PRICE SUMMARY =====
      // A money block reads down its own right edge: the figures line up on one edge, the labels on
      // another, and the total is ruled off above so it is the last thing the eye lands on.
      sectionHeading('Price Summary');

      const SUMMARY_WIDTH = 230;
      const SUMMARY_X = MARGIN + CONTENT_WIDTH - SUMMARY_WIDTH;
      const SUMMARY_LABEL_WIDTH = 120;
      const summaryLine = (label, value, strong = false) => {
        doc.fontSize(strong ? 10 : 9).font(strong ? 'Helvetica-Bold' : 'Helvetica').fillColor(strong ? navy : LABEL_COLOR)
           .text(label, SUMMARY_X, y, { width: SUMMARY_LABEL_WIDTH, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(strong ? navy : '#333333')
           .text(value, SUMMARY_X + SUMMARY_LABEL_WIDTH, y, { width: SUMMARY_WIDTH - SUMMARY_LABEL_WIDTH, align: 'right', lineBreak: false });
        y += strong ? 17 : 14;
      };

      summaryLine('Subtotal', `Rs. ${money(safeSubtotal)}`);
      if (safeDiscount > 0 || safeDiscountAmount > 0) summaryLine(`Discount (${safeDiscount}%)`, `- Rs. ${money(safeDiscountAmount)}`);
      summaryLine(`GST (${safeGstPercent}%)`, `Rs. ${money(safeTax)}`);
      doc.strokeColor('#e0e0e0').lineWidth(0.5).moveTo(SUMMARY_X, y + 1).lineTo(MARGIN + CONTENT_WIDTH, y + 1).stroke();
      y += 7;
      summaryLine('TOTAL', `Rs. ${money(safeTotal)}`, true);
      doc.font('Helvetica');
      y += GAP.section - 17;

      // Notes/Description
      if (description) {
        if (y + 40 > pageHeight) { doc.addPage(); y = MARGIN; }
        sectionHeading('Notes');
        doc.fontSize(9).fillColor('#333333').font('Helvetica').text(decodeHtml(description), MARGIN, y, { width: CONTENT_WIDTH, lineGap: 3 });
        y += doc.heightOfString(decodeHtml(description), { width: CONTENT_WIDTH, lineGap: 3 }) + GAP.section;
      }

      // Terms & Conditions - last section, and only when the estimate carries them
      const termsLines = estimateTermsLines({ includeTerms, termsConditions: estimate.termsConditions });
      if (termsLines.length) {
        if (y + 40 > pageHeight) { doc.addPage(); y = MARGIN; }
        doc.fontSize(10).fillColor(navy).font('Helvetica-Bold').text('TERMS & CONDITIONS', MARGIN, y, { lineBreak: false });
        y += GAP.heading;
        doc.fontSize(8).fillColor('#333333').font('Helvetica');
        termsLines.forEach((line, index) => {
          const text = `${index + 1}. ${decodeHtml(line)}`;
          const height = doc.heightOfString(text, { width: CONTENT_WIDTH, lineGap: 2 });
          if (y + height > pageHeight) { doc.addPage(); y = MARGIN; }
          doc.text(text, MARGIN, y, { width: CONTENT_WIDTH, lineGap: 2, continued: false });
          y += height + 4;
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate invoice PDF and return as buffer - Compact Single Page Design (Image 2)
const generateInvoicePDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        invoiceId, estimateId, invoiceType, customerName, customerEmail, customerPhone,
        propertyName, propertyCode, propertyType, zone, city,
        invoiceDate, dueDate, billingDuration,
        lineItems, subtotal, discountAmount, discountPercentage, taxAmount, taxPercentage, totalAmount, balanceAmount,
        workOrderId, workOrderCategory, workOrderSubcategory, workOrderDescription
      } = invoice;
      
      // Check if work order invoice - by invoiceType OR presence of workOrderId
      const isWorkOrderInvoice = invoiceType === 'work_order' || (workOrderId && workOrderId.length > 0);
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);

      const safeNum = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : Math.round(num);
      };
      const safeSubtotal = safeNum(subtotal);
      const safeDiscount = safeNum(discountAmount);
      const safeTax = safeNum(taxAmount);
      const safeTotal = safeNum(totalAmount);
      const safeTaxPercent = safeNum(taxPercentage) || 18;

      // Colors per design spec (Image 2)
      const headerBlack = '#151515';
      const gold = '#C9A227';
      const lightGold = '#E8C66A';
      const primaryText = '#171717';
      const secondaryText = '#555555';
      const borderGray = '#E5E5E5';
      const cardBg = '#FBF7EE';
      const white = '#ffffff';

      // Parse line items first to calculate dynamic sizing
      let items = [];
      try {
        items = typeof lineItems === 'string' ? JSON.parse(lineItems) : (lineItems || []);
      } catch (e) { items = []; }
      
      // Calculate if we need compact mode (many items)
      const itemCount = items.length;
      const isCompact = itemCount > 4;

      // ===== HEADER - Use shared function =====
      let y = drawPDFHeader(doc, margin);

      // ===== ID / DATE / DUE ROW (Compact) =====
      doc.fontSize(8).fillColor(secondaryText).text('ID:', margin, y);
      doc.fontSize(10).fillColor(primaryText).font('Helvetica-Bold').text(invoiceId || 'N/A', margin + 12, y);
      
      const dateX = pageWidth - margin - 100;
      doc.fontSize(8).fillColor(secondaryText).font('Helvetica').text('Date:', dateX, y);
      const invDateStr = invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text(invDateStr, dateX + 28, y);
      
      // Estimate and Due on same line (y + 12)
      if (estimateId) {
        doc.fontSize(7).fillColor(gold).font('Helvetica').text(`Estimate: ${estimateId}`, margin, y + 12);
      }
      doc.fontSize(8).fillColor(secondaryText).font('Helvetica').text('Due:', dateX, y + 12);
      const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text(dueDateStr, dateX + 28, y + 12);
      
      doc.font('Helvetica');
      y += 28;

      // ===== TOTAL AMOUNT DUE BANNER (Compact) =====
      const bannerHeight = 22;
      doc.roundedRect(margin, y, contentWidth, bannerHeight, 4).fill(gold);
      doc.fontSize(6).fillColor(white).text('TOTAL AMOUNT DUE', pageWidth / 2 - 28, y + 4);
      doc.fontSize(11).fillColor(white).font('Helvetica-Bold').text(`Rs. ${safeTotal.toLocaleString('en-IN')}`, pageWidth / 2 - 30, y + 12);
      doc.font('Helvetica');
      y += bannerHeight + 8;

      // ===== PROPERTY & CUSTOMER DETAILS (cream bg, compact) =====
      const cardWidth = (contentWidth - 10) / 2;
      const cardHeight = 80;
      
      // Property Details Card
      doc.roundedRect(margin, y, cardWidth, cardHeight, 5).fill(cardBg);
      
      doc.fontSize(8).fillColor(primaryText).font('Helvetica-Bold').text('PROPERTY DETAILS', margin + 10, y + 8);
      doc.font('Helvetica');
      
      let py = y + 20;
      const lineH = 11;
      doc.fontSize(7).fillColor(secondaryText);
      doc.text(`Property ID: ${propertyCode || '-'}`, margin + 10, py); py += lineH;
      doc.text(`Name: ${decodeHtml(propertyName) || '-'}`, margin + 10, py); py += lineH;
      doc.text(`Type: ${propertyType || '-'}`, margin + 10, py); py += lineH;
      doc.text(`Zone: ${zone || '-'}`, margin + 10, py); py += lineH;
      doc.text(`City: ${city || '-'}`, margin + 10, py);

      // Customer Details Card
      const custX = margin + cardWidth + 10;
      doc.roundedRect(custX, y, cardWidth, cardHeight, 5).fill(cardBg);
      
      doc.fontSize(8).fillColor(primaryText).font('Helvetica-Bold').text('CUSTOMER DETAILS', custX + 10, y + 8);
      doc.font('Helvetica');
      
      let cy = y + 20;
      doc.fontSize(7).fillColor(secondaryText);
      doc.text(`Name: ${decodeHtml(customerName) || '-'}`, custX + 10, cy); cy += lineH;
      doc.text(`Phone: ${customerPhone || '-'}`, custX + 10, cy); cy += lineH;
      const emailStr = customerEmail || '-';
      doc.text(`Email: ${emailStr.length > 30 ? emailStr.substring(0, 30) + '...' : emailStr}`, custX + 10, cy); cy += lineH;
      doc.text(`City: ${city || '-'}`, custX + 10, cy);

      y += cardHeight + 10;

      // ===== WORK ORDER DETAILS (for work order invoices) =====
      if (isWorkOrderInvoice) {
        // Get work order details from invoice data or first line item
        const woItem = items[0] || {};
        const category = workOrderCategory || woItem.category || woItem.serviceCategory || '-';
        const subcategory = workOrderSubcategory || woItem.subcategory || woItem.serviceSubcategory || '-';
        const woDescription = decodeHtml(workOrderDescription || woItem.description || woItem.details || '');
        
        // Section header - no decorative line
        doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('WORK ORDER DETAILS', margin, y + 3, { lineBreak: false });
        doc.font('Helvetica');
        y += 16;
        
        // Work order details box - orange tinted
        const hasDescription = woDescription && woDescription.length > 0;
        const woBoxHeight = hasDescription && woDescription.length > 50 ? 70 : (hasDescription ? 60 : 45);
        doc.roundedRect(margin, y, contentWidth, woBoxHeight, 4).fill('#FFF7ED').stroke('#FDBA74');
        
        // Three columns: Work Order ID, Category, Subcategory
        const col1 = margin + 12;
        const col2 = margin + 180;
        const col3 = margin + 340;
        
        doc.fontSize(7).fillColor('#9A3412');
        doc.text('Work Order ID', col1, y + 10);
        doc.text('Category', col2, y + 10);
        doc.text('Subcategory', col3, y + 10);
        
        doc.fontSize(9).fillColor('#EA580C').font('Helvetica-Bold');
        doc.text(workOrderId || '-', col1, y + 22);
        doc.font('Helvetica').fillColor(primaryText);
        doc.text(category, col2, y + 22);
        doc.text(subcategory, col3, y + 22);
        
        // Description row if exists - centered
        if (hasDescription) {
          doc.fontSize(7).fillColor('#9A3412').text('Description', margin, y + 38, { width: contentWidth, align: 'center' });
          doc.fontSize(8).fillColor(primaryText).text(woDescription.substring(0, 100), margin, y + 50, { width: contentWidth, align: 'center' });
        }
        
        y += woBoxHeight + 15;
      }

      // ===== SERVICES INCLUDED TABLE =====
      // Filter to only include services (exclude addons)
      const serviceItems = items.filter(item => {
        const desc = String(item.description || item.name || '').toLowerCase();
        const isAddon = item.type === 'addon' || desc.includes('add-on') || desc.includes('addon');
        return !isAddon;
      });
      
      // Filter addon items
      const addonItems = items.filter(item => {
        if (item.type === 'addon') return true;
        const desc = String(item.description || item.name || '').toLowerCase();
        return desc.includes('add-on') || desc.includes('addon');
      });
      
      if (!isWorkOrderInvoice && serviceItems.length > 0) {
        // Section header - no decorative line
        doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('SERVICES INCLUDED', margin, y + 3, { lineBreak: false });
        doc.font('Helvetica');
        y += 18;
        
        // Table header - Gold background
        // Column positions: # | Service | Description (centered header) | Frequency | Visits
        const tableHeaderH = 20;
        const colNum = margin + 8;
        const colService = margin + 28;
        const colServiceW = 70;
        const colDesc = margin + 100;
        const colDescW = 280; // Wide description column
        const colFreq = margin + 390;
        const colVisits = margin + 460;
        
        doc.rect(margin, y, contentWidth, tableHeaderH).fill(gold);
        doc.fontSize(8).fillColor(white);
        doc.text('#', colNum, y + 6);
        doc.text('Service', colService, y + 6);
        doc.text('Description', colDesc + (colDescW / 2) - 25, y + 6); // Centered header
        doc.text('Frequency', colFreq, y + 6);
        doc.text('Visits', colVisits, y + 6);
        y += tableHeaderH;

        // Helper function to manually wrap text into lines
        const wrapText = (text, maxCharsPerLine) => {
          const words = text.split(' ');
          const lines = [];
          let currentLine = '';
          
          words.forEach(word => {
            if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
              currentLine = (currentLine + ' ' + word).trim();
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          });
          if (currentLine) lines.push(currentLine);
          return lines;
        };

        // Table rows - with full description wrapping to multiple lines
        // Check for page break and add new page if needed
        const checkPageBreak = (neededHeight) => {
          const reservedForSummary = 150; // Space for price summary + footer
          if (y + neededHeight > pageHeight - reservedForSummary) {
            doc.addPage();
            y = margin;
            // Redraw table header on new page
            doc.rect(margin, y, contentWidth, tableHeaderH).fill(gold);
            doc.fontSize(8).fillColor(white);
            doc.text('#', colNum, y + 6);
            doc.text('Service', colService, y + 6);
            doc.text('Description', colDesc + (colDescW / 2) - 25, y + 6);
            doc.text('Frequency', colFreq, y + 6);
            doc.text('Visits', colVisits, y + 6);
            y += tableHeaderH;
          }
        };

        serviceItems.forEach((item, idx) => {
          // Get service name from dedicated name field first
          const serviceName = decodeHtml(item.name || item.serviceName || item.service_name || 'Service');
          
          // Get description from all possible fields - prioritize dedicated description fields
          let serviceDesc = decodeHtml(
            item.details || 
            item.service_description || 
            item.serviceDescription || 
            item.itemDescription ||
            ''
          );
          
          // If no dedicated description field, check the main description field
          if (!serviceDesc && item.description) {
            const fullDesc = decodeHtml(String(item.description));
            // Only split if description starts with service name followed by " - "
            if (fullDesc.toLowerCase().startsWith(serviceName.toLowerCase() + ' - ')) {
              serviceDesc = fullDesc.substring(serviceName.length + 3); // Remove "ServiceName - "
            } else if (fullDesc.toLowerCase() !== serviceName.toLowerCase()) {
              // Use full description if it's different from the name
              serviceDesc = fullDesc;
            }
          }
          
          if (!serviceDesc) serviceDesc = '-';
          
          const freq = item.frequency || item.frequencyType || item.billingDuration || '-';
          const visits = item.visits || item.frequencyCount || item.quantity || 1;
          
          console.log(`[PDF-v3] Row ${idx + 1}: name="${serviceName}", desc="${serviceDesc}"`);
          
          // Manually wrap description text into lines (45 chars per line)
          const descLines = wrapText(serviceDesc, 50);
          const lineHeight = 9;
          const rowH = Math.max(22, (descLines.length * lineHeight) + 10);
          
          // Check if we need a page break before this row
          checkPageBreak(rowH);
          
          // Draw row background
          const rowColor = idx % 2 === 0 ? '#FAFAFA' : white;
          doc.rect(margin, y, contentWidth, rowH).fill(rowColor);
          doc.rect(margin, y, contentWidth, rowH).lineWidth(0.3).stroke(borderGray);
          
          // Draw # column
          doc.fontSize(7).fillColor(primaryText);
          doc.text(`${idx + 1}`, colNum, y + 6, { lineBreak: false });
          
          // Draw Service name
          doc.text(serviceName, colService, y + 6, { width: colServiceW, lineBreak: false });
          
          // Draw Description - each line manually, centered in the description column
          doc.fillColor(secondaryText);
          let descY = y + 6;
          descLines.forEach((line, lineIdx) => {
            doc.text(line, colDesc, descY + (lineIdx * lineHeight), { width: colDescW, align: 'center', lineBreak: false });
          });
          
          // Draw Frequency and Visits (top-aligned)
          doc.fillColor(primaryText);
          doc.text(freq, colFreq, y + 6, { lineBreak: false });
          doc.text(`${visits}`, colVisits, y + 6, { lineBreak: false });
          
          y += rowH;
        });

        y += 15;
      }

      // ===== ADD-ONS TABLE =====
      if (!isWorkOrderInvoice && addonItems.length > 0) {
        // Section header
        doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('SERVICES', margin, y + 3, { lineBreak: false });
        doc.font('Helvetica');
        y += 18;
        
        // Table header - Purple background for addons
        const tableHeaderH = 20;
        const colNum = margin + 8;
        const colAddon = margin + 28;
        const colAddonW = 70;
        const colDesc = margin + 100;
        const colDescW = 220; // Description column
        const colFreq = margin + 330;
        const colVisits = margin + 400;
        const colPrice = margin + 450;
        
        const addonGold = '#c9a227';
        doc.rect(margin, y, contentWidth, tableHeaderH).fill(addonGold);
        doc.fontSize(8).fillColor(white);
        doc.text('#', colNum, y + 6);
        doc.text('Service', colAddon, y + 6);
        doc.text('Description', colDesc + (colDescW / 2) - 25, y + 6);
        doc.text('Frequency', colFreq, y + 6);
        doc.text('Visits', colVisits, y + 6);
        doc.text('Price', colPrice, y + 6);
        y += tableHeaderH;

        // Helper function to wrap text
        const wrapAddonText = (text, maxCharsPerLine) => {
          const words = text.split(' ');
          const lines = [];
          let currentLine = '';
          
          words.forEach(word => {
            if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
              currentLine = (currentLine + ' ' + word).trim();
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            }
          });
          if (currentLine) lines.push(currentLine);
          return lines;
        };

        // Check page break function for addons
        const checkAddonPageBreak = (neededHeight) => {
          const reservedForSummary = 150;
          if (y + neededHeight > pageHeight - reservedForSummary) {
            doc.addPage();
            y = margin;
            doc.rect(margin, y, contentWidth, tableHeaderH).fill(addonGold);
            doc.fontSize(8).fillColor(white);
            doc.text('#', colNum, y + 6);
            doc.text('Service', colAddon, y + 6);
            doc.text('Description', colDesc + (colDescW / 2) - 25, y + 6);
            doc.text('Frequency', colFreq, y + 6);
            doc.text('Visits', colVisits, y + 6);
            doc.text('Price', colPrice, y + 6);
            y += tableHeaderH;
          }
        };

        addonItems.forEach((item, idx) => {
          // Parse addon name and description
          const fullDesc = decodeHtml(item.description || item.name || 'Service');
          let addonName = fullDesc;
          let addonDesc = '-';
          
          if (fullDesc.includes(' - ')) {
            const parts = fullDesc.split(' - ');
            addonName = parts[0];
            addonDesc = parts.slice(1).join(' - ') || '-';
          }
          
          const freq = item.frequency || item.frequencyType || item.billingDuration || '-';
          const visits = item.visits || item.frequencyCount || item.quantity || 1;
          const price = parseFloat(item.totalPrice || item.total_price || item.unitPrice || item.unit_price || 0);
          
          const descLines = wrapAddonText(addonDesc, 40);
          const lineHeight = 9;
          const rowH = Math.max(22, (descLines.length * lineHeight) + 10);
          
          checkAddonPageBreak(rowH);
          
          const rowColor = idx % 2 === 0 ? '#FAFAFA' : white;
          doc.rect(margin, y, contentWidth, rowH).fill(rowColor);
          doc.rect(margin, y, contentWidth, rowH).lineWidth(0.3).stroke(borderGray);
          
          doc.fontSize(7).fillColor(primaryText);
          doc.text(`${idx + 1}`, colNum, y + 6, { lineBreak: false });
          doc.text(addonName.substring(0, 15), colAddon, y + 6, { width: colAddonW, lineBreak: false });
          
          doc.fillColor(secondaryText);
          let descY = y + 6;
          descLines.forEach((line, lineIdx) => {
            doc.text(line, colDesc, descY + (lineIdx * lineHeight), { width: colDescW, align: 'center', lineBreak: false });
          });
          
          doc.fillColor(primaryText);
          doc.text(freq, colFreq, y + 6, { lineBreak: false });
          doc.text(`${visits}`, colVisits, y + 6, { lineBreak: false });
          doc.text(`Rs.${price.toLocaleString('en-IN')}`, colPrice, y + 6, { lineBreak: false });
          
          y += rowH;
        });

        y += 15;
      }

      // ===== PRICE SUMMARY - Right aligned (no icon) =====
      const summaryWidth = 170;
      const summaryX = pageWidth - margin - summaryWidth;
      
      doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('PRICE SUMMARY', summaryX, y + 2, { lineBreak: false });
      doc.font('Helvetica');
      y += 20;
      
      // Summary box
      const summaryHeight = safeDiscount > 0 ? 70 : 58;
      doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 4).lineWidth(0.5).stroke(borderGray);
      
      let sy = y + 12;
      doc.fontSize(8).fillColor(secondaryText);
      doc.text('Subtotal:', summaryX + 12, sy);
      doc.fillColor(primaryText).text(`Rs. ${safeSubtotal.toLocaleString('en-IN')}`, summaryX + 100, sy);
      sy += 12;
      
      if (safeDiscount > 0) {
        doc.fillColor('#059669').text(`Discount:`, summaryX + 12, sy);
        doc.text(`-Rs. ${safeDiscount.toLocaleString('en-IN')}`, summaryX + 100, sy);
        sy += 12;
      }
      
      doc.fillColor(secondaryText).text(`GST (${safeTaxPercent}.00%):`, summaryX + 12, sy);
      doc.fillColor(primaryText).text(`Rs. ${safeTax.toLocaleString('en-IN')}`, summaryX + 100, sy);
      sy += 12;
      
      doc.strokeColor(borderGray).lineWidth(0.5).moveTo(summaryX + 8, sy).lineTo(summaryX + summaryWidth - 8, sy).stroke();
      sy += 10;
      
      doc.fontSize(9).fillColor(gold).font('Helvetica-Bold').text('Total:', summaryX + 12, sy);
      doc.text(`Rs. ${safeTotal.toLocaleString('en-IN')}`, summaryX + 100, sy);
      doc.font('Helvetica');

      y = y + summaryHeight + 20;

      // ===== FOOTER =====
      // Ensure footer is at bottom of page
      const footerY = Math.max(y, pageHeight - 50);
      doc.strokeColor(borderGray).lineWidth(0.5).moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).stroke();
      
      // Heart icon (outlined)
      doc.circle(margin + 8, footerY + 12, 5).lineWidth(0.5).stroke(borderGray);
      
      doc.fontSize(8).fillColor(secondaryText).text(
        'We appreciate your trust in our services.',
        margin + 18, footerY + 9
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate Payment Receipt PDF - Simple clean design
const generateReceiptPDF = async (payment) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        paymentId,
        invoiceId,
        customerName,
        propertyName,
        amount,          // Amount paid in this transaction
        invoiceAmount,   // Total invoice amount
        balanceAmount,   // Remaining balance after this payment
        paymentMethod,
        paymentDate,
        transactionReference,
        referenceNumber,
        status
      } = payment;

      const margin = 50;
      const green = '#22c55e';
      const darkGray = '#1f2937';
      const lightGray = '#6b7280';
      const blue = '#3b82f6';

      // Calculate values
      const amountPaid = parseFloat(amount) || 0;
      const totalInvoice = parseFloat(invoiceAmount) || amountPaid;
      const remaining = parseFloat(balanceAmount) || 0;

      // Format date
      const paymentDateFormatted = paymentDate ? new Date(paymentDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Payment method labels
      const methodLabels = {
        razorpay: 'Card/Net Banking',
        cash: 'Cash',
        bank_transfer: 'Bank Transfer',
        upi: 'UPI',
        check: 'Cheque'
      };

      let yPos = margin;

      // ========== HEADER SECTION ==========
      // Green checkmark circle
      doc.circle(margin + 20, yPos + 20, 18).fill(green);
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
         .text('✓', margin + 12, yPos + 10);

      // "You paid ₹X,XXX" heading
      doc.fillColor(darkGray).fontSize(22).font('Helvetica-Bold')
         .text(`You paid ₹${amountPaid.toLocaleString('en-IN')}`, margin + 50, yPos + 8);

      // "to Company Name on Date"
      doc.fillColor(lightGray).fontSize(12).font('Helvetica')
         .text(`to XLAND INFRA on ${paymentDateFormatted}`, margin + 50, yPos + 35);

      yPos += 80;

      // Divider line
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(margin, yPos).lineTo(545, yPos).stroke();
      yPos += 30;

      // ========== PAYMENT DETAILS SECTION ==========
      doc.fillColor(darkGray).fontSize(16).font('Helvetica-Bold')
         .text('Payment details', margin, yPos);
      yPos += 35;

      // Helper function for detail rows
      const addDetailRow = (label, value, valueColor = darkGray, isBold = false) => {
        doc.fillColor(lightGray).fontSize(11).font('Helvetica').text(label, margin, yPos);
        doc.fillColor(valueColor).font(isBold ? 'Helvetica-Bold' : 'Helvetica')
           .text(value, 350, yPos, { width: 195, align: 'right' });
        yPos += 28;
      };

      // Invoice no.
      addDetailRow('Invoice no.', invoiceId || paymentId, blue);

      // Invoice amount (total)
      addDetailRow('Invoice amount', `₹${totalInvoice.toLocaleString('en-IN')}`);

      // Amount paid
      addDetailRow('Amount paid', `₹${amountPaid.toLocaleString('en-IN')}`, darkGray, true);

      // Remaining balance
      const balanceText = remaining <= 0 ? '₹0' : `₹${remaining.toLocaleString('en-IN')}`;
      const balanceColor = remaining <= 0 ? green : '#ef4444';
      addDetailRow('Remaining balance', balanceText, balanceColor, true);

      yPos += 10;

      // Divider line
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(margin, yPos).lineTo(545, yPos).stroke();
      yPos += 25;

      // Status
      const statusText = remaining <= 0 ? 'Fully Paid' : 'Partially Paid';
      addDetailRow('Status', statusText, remaining <= 0 ? green : '#f59e0b', true);

      // Payment method
      addDetailRow('Payment method', methodLabels[paymentMethod] || paymentMethod || '-');

      // Reference/Transaction ID
      if (transactionReference || referenceNumber) {
        addDetailRow('Reference ID', transactionReference || referenceNumber);
      }

      // Receipt ID
      addDetailRow('Receipt ID', paymentId);

      // Customer/Property
      if (customerName || propertyName) {
        addDetailRow('Customer', customerName || propertyName);
      }

      yPos += 30;

      // ========== FOOTER NOTE ==========
      doc.fillColor(lightGray).fontSize(10).font('Helvetica')
         .text("Please don't reply to this email, if you need any help regarding this message, please contact the business directly.", margin, yPos, { width: 495 });
      
      yPos += 50;

      doc.fillColor(darkGray).fontSize(11).font('Helvetica')
         .text('Thank you,', margin, yPos);
      yPos += 18;
      doc.fillColor(darkGray).fontSize(11).font('Helvetica-Bold')
         .text('XLAND INFRA PM SERVICES PVT LTD', margin, yPos);

      // ========== COMPANY FOOTER ==========
      yPos = 750;
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(margin, yPos).lineTo(545, yPos).stroke();
      yPos += 15;
      doc.fillColor('#9ca3af').fontSize(8).font('Helvetica')
         .text('Gachibowli, Hyderabad, Telangana - 500032 | GST: 36AADCX1234A1Z5', margin, yPos, { align: 'center' });
      yPos += 12;
      doc.text('support@xlandinfra.com | www.xlandinfra.com', margin, yPos, { align: 'center' });

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
