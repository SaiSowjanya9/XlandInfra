const PDFDocument = require('pdfkit');
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

// Generate estimate PDF and return as buffer
const generateEstimatePDF = async (estimate) => {
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
        return isNaN(num) ? 0 : Math.round(num);
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

      // Header - Black background with clean layout
      doc.rect(0, 0, 612, 55).fill(black);
      
      // Logo Icon (symbol only - left side)
      try {
        doc.image(LOGO_PATH, 50, 8, { width: 38, height: 38 });
      } catch (logoErr) {
        console.log('Logo load error:', logoErr.message);
        // Fallback to gold square
        doc.rect(50, 8, 38, 38).fill(gold);
      }
      
      // Company Name text beside logo (vertically centered with logo)
      doc.fontSize(16).fillColor(gold).text('XLAND INFRA', 95, 20);
      const mainTextWidth = doc.widthOfString('XLAND INFRA');
      doc.fontSize(7);
      const pvtLtdText = 'PVT LTD';
      const pvtLtdWidth = doc.widthOfString(pvtLtdText);
      const pvtLtdX = 95 + (mainTextWidth - pvtLtdWidth) / 2;
      doc.fillColor(gold).text(pvtLtdText, pvtLtdX, 38);
      // Draw equal-length lines on both sides
      const lineY = 43;
      const lineGap = 4;
      doc.strokeColor(gold).lineWidth(0.5);
      doc.moveTo(95, lineY).lineTo(pvtLtdX - lineGap, lineY).stroke();
      doc.moveTo(pvtLtdX + pvtLtdWidth + lineGap, lineY).lineTo(95 + mainTextWidth, lineY).stroke();
      
      // ESTIMATE badge on the right (rounded corners to match frontend)
      doc.roundedRect(455, 12, 100, 26, 4).fill(gold);
      doc.fontSize(11).fillColor(black).text('ESTIMATE', 455, 19, { width: 100, align: 'center', lineBreak: false });

      let y = 75;

      // Estimate Info - styled like invoice
      // ID label
      doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold').text('ID:', 60, y);
      // ID value in larger bold font
      doc.fontSize(14).fillColor(black).text(estimateId || 'N/A', 85, y - 2);
      
      // Date on right side
      doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold').text('Date:', 400, y);
      const dateStr = createdAt ? new Date(createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      doc.fontSize(12).fillColor(black).text(dateStr, 435, y - 1);
      doc.font('Helvetica'); // Reset font
      y += 30;

      // Package Price Bar (NO package name - per requirement)
      if (packagePrice) {
        doc.rect(50, y, 500, 25).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(10).fillColor(navy).text(`Package Price: ₹${Math.round(Number(packagePrice)).toLocaleString()}`, 60, y + 8);
        doc.fontSize(10).fillColor(navy).text('Billing: Yearly', 400, y + 8);
        y += 35;
      }

      // Property & Customer Details (side by side)
      const cardWidth = 235;
      
      // Property Details Card - same blue background as Customer Details
      doc.rect(50, y, cardWidth, 100).fill('#e8f4fc').stroke('#cce7f7');
      doc.fontSize(10).fillColor(navy).text('Property Details', 60, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let py = y + 28;
      if (propertyCode) { doc.text(`Property ID: ${propertyCode}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      if (propertyName) { doc.text(`Name: ${decodeHtml(propertyName)}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      const propTypeLabel = { 'GC': 'Gated Community', 'APT': 'Apartment', 'VILLA': 'Villa', 'PLOT': 'Plot' }[propertyType] || propertyType;
      if (propTypeLabel) { doc.text(`Type: ${propTypeLabel}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      if (zone) { doc.text(`Zone: ${zone}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      if (division) { doc.text(`Division: ${division}`, 60, py, { width: cardWidth - 20 }); py += 12; }

      // Customer Details Card
      doc.rect(305, y, cardWidth, 100).fill('#e8f4fc').stroke('#cce7f7');
      doc.fontSize(10).fillColor(navy).text('Customer Details', 315, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let cy = y + 28;
      if (customerName) { doc.text(`Name: ${decodeHtml(customerName)}`, 315, cy, { width: cardWidth - 20 }); cy += 12; }
      if (customerPhone) { doc.text(`Phone: ${customerPhone}`, 315, cy, { width: cardWidth - 20 }); cy += 12; }
      if (customerEmail) { 
        // Use smaller font for long emails to ensure they fit
        const emailFontSize = customerEmail.length > 25 ? 7 : 8;
        doc.fontSize(emailFontSize).text(`Email: ${customerEmail}`, 315, cy, { width: cardWidth - 20 }); 
        cy += (customerEmail.length > 35 ? 20 : 12); // Extra space if email wraps
        doc.fontSize(8); // Reset font size
      }
      if (city) { doc.text(`City: ${city}`, 315, cy, { width: cardWidth - 20 }); cy += 12; }

      y += 115;

      // Work Order Details (only for work order estimates) - Compact 4-column layout
      if (isWorkOrderEstimate && workOrderId) {
        doc.rect(50, y, 500, 40).fill('#e8f4fc').stroke('#cce7f7');
        doc.fontSize(10).fillColor(navy).text('Work Order Details', 60, y + 8);
        
        // 4-column layout on single row
        const col1 = 60, col2 = 175, col3 = 300, col4 = 430;
        const wy = y + 22;
        
        doc.fontSize(7).fillColor('#666666');
        doc.text('Work Order ID', col1, wy);
        doc.text('Category', col2, wy);
        doc.text('Subcategory', col3, wy);
        doc.text('Priority', col4, wy);
        
        doc.fontSize(8).fillColor('#333333');
        doc.text(String(workOrderId || '-').substring(0, 20), col1, wy + 9);
        doc.text(String(workOrderCategory || '-').substring(0, 18), col2, wy + 9);
        doc.text(String(workOrderSubcategory || '-').substring(0, 18), col3, wy + 9);
        doc.text(String(workOrderPriority || '-').toUpperCase(), col4, wy + 9);
        
        y += 48;
      }

      // Package Description - dynamic height based on content
      if (amcPackageDescription) {
        const decodedPkgDesc = decodeHtml(amcPackageDescription);
        doc.fontSize(10).fillColor(navy).text('PACKAGE DESCRIPTION', 50, y);
        y += 15;
        // Calculate height needed for description (approx 12 chars per line at font size 8)
        const descLines = Math.ceil(decodedPkgDesc.length / 70);
        const descBoxHeight = Math.min(Math.max(descLines * 12 + 16, 50), 150); // Min 50, max 150
        doc.rect(50, y, 500, descBoxHeight).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#444444').text(decodedPkgDesc, 60, y + 8, { width: 480, height: descBoxHeight - 12 });
        y += descBoxHeight + 10;
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
      const pageHeight = 780; // A4 usable height
      
      // Only show Services Table for NON-work order estimates
      // Work Order Estimates: SKIP services table entirely - they show work order details instead
      // IMPORTANT: If workOrderId exists, this is a work order estimate - DO NOT show services
      const hasWorkOrderId = workOrderId && String(workOrderId).length > 0;
      const isWOEstimate = isWorkOrderEstimate || hasWorkOrderId || estimateType === 'work_order';
      console.log('🔴 [PDF Service] SERVICES CHECK v2 - isWorkOrderEstimate:', isWorkOrderEstimate, 'workOrderId:', workOrderId, 'hasWorkOrderId:', hasWorkOrderId, 'estimateType:', estimateType, 'isWOEstimate:', isWOEstimate, 'WILL SHOW SERVICES:', !isWOEstimate && svcList.length > 0);
      
      if (!isWOEstimate && svcList.length > 0) {
        doc.fontSize(10).fillColor(navy).text('SERVICES INCLUDED', 50, y, { continued: false });
        y += 15;
        
        // Table header - separate Service and Description columns
        doc.rect(50, y, 500, 20).fill('#1e3a5f');
        doc.fontSize(8).fillColor('#ffffff');
        doc.text('#', 55, y + 6, { continued: false });
        doc.text('Service', 75, y + 6, { continued: false });
        doc.text('Description', 260, y + 6, { width: 130, align: 'center', continued: false });
        doc.text('Frequency', 400, y + 6, { continued: false });
        doc.text('Visits', 480, y + 6, { continued: false });
        y += 20;

        svcList.forEach((s, idx) => {
          // Use s.details as fallback for full description (backend stores it separately)
          const svcDesc = decodeHtml(s.details || s.description || s.service_description) || '-';
          // Calculate row height based on description length (approx 40 chars per line)
          const descLines = Math.ceil(svcDesc.length / 40);
          const rowHeight = Math.max(22, descLines * 11);
          
          // Check if we need a new page
          if (y + rowHeight > pageHeight) {
            doc.addPage();
            y = 50;
          }
          
          const rowColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
          doc.rect(50, y, 500, rowHeight).fill(rowColor).stroke('#e0e0e0');
          doc.fontSize(8).fillColor('#333333');
          doc.text(String(idx + 1), 55, y + 6, { continued: false });
          const svcName = decodeHtml(s.name || s.service || 'Service');
          doc.text(svcName, 75, y + 6, { width: 110, continued: false });
          // Full description with height constraint to prevent page overflow
          doc.text(svcDesc, 190, y + 6, { width: 200, height: rowHeight - 8, align: 'center', continued: false });
          const freqCount = s.frequencyCount ?? s.frequency_count ?? 1;
          let freqType = s.frequencyType || s.frequency_type || 'Monthly';
          freqType = freqType.replace(/^\d+x\s*/i, '');
          doc.text(freqType, 400, y + 6, { continued: false });
          doc.text(String(freqCount), 490, y + 6, { continued: false });
          y += rowHeight;
        });

        y += 10;
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
        // Calculate first row height to ensure header + at least one row fit together
        const firstAddonDesc = addonList[0]?.description || '-';
        const firstRowLines = Math.ceil(firstAddonDesc.length / 40);
        const firstRowHeight = Math.max(22, firstRowLines * 11);
        const headerHeight = 35; // Title (15) + Table header (20)
        
        // Check if header + first row need new page (keep them together)
        if (y + headerHeight + firstRowHeight > pageHeight) {
          doc.addPage();
          y = 50;
        }
        
        doc.fontSize(10).fillColor(navy).text('ADD-ONS', 50, y, { continued: false });
        y += 15;
        
        // Add-ons header - separate Service and Description columns
        doc.rect(50, y, 500, 20).fill('#1e3a5f');
        doc.fontSize(8).fillColor('#ffffff');
        doc.text('#', 55, y + 6, { continued: false });
        doc.text('Add-on Service', 75, y + 6, { continued: false });
        doc.text('Description', 260, y + 6, { width: 130, align: 'center', continued: false });
        doc.text('Frequency', 400, y + 6, { continued: false });
        doc.text('Visits', 480, y + 6, { continued: false });
        y += 20;

        addonList.forEach((a, idx) => {
          // Use a.details as fallback for full description (backend stores it separately)
          const addonDesc = decodeHtml(a.details || a.description || a.service_description) || '-';
          // Calculate row height based on description length (approx 40 chars per line)
          const descLines = Math.ceil(addonDesc.length / 40);
          const rowHeight = Math.max(22, descLines * 11);
          
          // Check if we need a new page (skip check for first row - already handled above)
          if (idx > 0 && y + rowHeight > pageHeight) {
            doc.addPage();
            y = 50;
          }
          
          const rowColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
          doc.rect(50, y, 500, rowHeight).fill(rowColor).stroke('#e0e0e0');
          doc.fontSize(8).fillColor('#333333');
          doc.text(String(idx + 1), 55, y + 6, { continued: false });
          // Handle all possible addon name fields
          const addonName = decodeHtml(a.name || a.service_name || a.serviceName || a.service || 'Add-on');
          doc.text(addonName, 75, y + 6, { width: 110, continued: false });
          // Full description with height constraint to prevent page overflow
          doc.text(addonDesc, 190, y + 6, { width: 200, height: rowHeight - 8, align: 'center', continued: false });
          // Handle all possible frequency field names (frequency, frequency_type, frequencyType)
          const freqCount = a.frequency_count ?? a.frequencyCount ?? a.visits ?? a.quantity ?? 1;
          let freqType = a.frequency_type || a.frequencyType || a.frequency || 'Monthly';
          freqType = freqType.replace(/^\d+x\s*/i, '');
          doc.text(freqType, 400, y + 6, { continued: false });
          doc.text(String(freqCount), 490, y + 6, { continued: false });
          y += rowHeight;
        });

        y += 10;
      }

      // Check if Price Summary needs new page
      if (y + 100 > pageHeight) {
        doc.addPage();
        y = 50;
      }
      
      // Price Summary - use safe values
      doc.fontSize(10).fillColor(navy).text('PRICE SUMMARY', 50, y, { continued: false });
      y += 15;
      doc.rect(50, y, 500, 80).fill(lightGray).stroke('#e0e0e0');
      
      doc.fontSize(9).fillColor('#666666');
      doc.text('Subtotal', 60, y + 10, { continued: false });
      doc.fillColor('#333333').text(`₹${safeSubtotal.toLocaleString()}`, 450, y + 10, { continued: false });
      
      if (safeDiscount > 0 || safeDiscountAmount > 0) {
        doc.fillColor('#666666').text(`Discount (${safeDiscount}%)`, 60, y + 25, { continued: false });
        doc.fillColor('#333333').text(`-₹${safeDiscountAmount.toLocaleString()}`, 450, y + 25, { continued: false });
      }
      
      doc.fillColor('#666666').text(`GST (${safeGstPercent}%)`, 60, y + 40, { continued: false });
      doc.fillColor('#333333').text(`₹${safeTax.toLocaleString()}`, 450, y + 40, { continued: false });
      
      // Total line
      doc.rect(60, y + 55, 480, 1).fill('#e0e0e0');
      doc.fontSize(12).fillColor(gold).text('Grand Total', 60, y + 62, { continued: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(gold).text(`₹${safeTotal.toLocaleString()}`, 450, y + 62, { continued: false });
      doc.font('Helvetica');
      y += 90;

      // Notes/Description (after Price Summary)
      if (description) {
        // Check if notes need new page
        if (y + 70 > pageHeight) {
          doc.addPage();
          y = 50;
        }
        doc.fontSize(10).fillColor(navy).text('NOTES / DESCRIPTION', 50, y, { continued: false });
        y += 18;
        doc.fontSize(9).fillColor('#333333').text(description, 50, y, { width: 500, lineGap: 4, continued: false });
        y += 50;
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
        workOrderId
      } = invoice;
      
      const isWorkOrderInvoice = invoiceType === 'work_order';
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

      // ===== HEADER - Simple black with gold wave (Image 2) =====
      const headerHeight = 50;
      
      // Simple black header
      doc.rect(0, 0, pageWidth, headerHeight).fill(headerBlack);
      
      // Gold wave - simple bar at bottom
      doc.rect(0, headerHeight, pageWidth, 8).fill(gold);
      
      // Logo
      try {
        doc.image(LOGO_PATH, margin + 15, 8, { width: 32, height: 32 });
      } catch (logoErr) {
        doc.roundedRect(margin + 15, 8, 32, 32, 4).fill(gold);
      }
      
      // Company name
      doc.fontSize(20).fillColor(gold).text('XLAND INFRA', margin + 55, 15);
      
      // PVT LTD with lines
      doc.fontSize(7).fillColor(gold);
      const pvtX = margin + 72;
      doc.strokeColor(gold).lineWidth(0.5);
      doc.moveTo(pvtX - 15, 35).lineTo(pvtX - 3, 35).stroke();
      doc.text('PVT LTD', pvtX, 32);
      doc.moveTo(pvtX + 25, 35).lineTo(pvtX + 37, 35).stroke();

      let y = headerHeight + 15;

      // ===== ID / DATE / DUE ROW (Image 2) =====
      doc.fontSize(9).fillColor(secondaryText).text('ID:', margin, y);
      doc.fontSize(13).fillColor(primaryText).font('Helvetica-Bold').text(invoiceId || 'N/A', margin + 16, y - 1);
      
      if (estimateId) {
        doc.fontSize(8).fillColor(gold).font('Helvetica').text(`Estimate: ${estimateId}`, margin, y + 14);
      }
      
      const dateX = pageWidth - margin - 110;
      doc.fontSize(9).fillColor(secondaryText).font('Helvetica').text('Date:', dateX, y);
      const invDateStr = invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      doc.fontSize(11).fillColor(primaryText).font('Helvetica-Bold').text(invDateStr, dateX + 32, y - 1);
      
      doc.fontSize(9).fillColor(secondaryText).font('Helvetica').text('Due:', dateX, y + 16);
      const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      doc.fontSize(11).fillColor(primaryText).font('Helvetica-Bold').text(dueDateStr, dateX + 32, y + 15);
      
      doc.font('Helvetica');
      y += 38;

      // ===== TOTAL AMOUNT DUE BANNER =====
      const bannerHeight = 38;
      doc.roundedRect(margin, y, contentWidth, bannerHeight, 6).fill(gold);
      doc.fontSize(10).fillColor(white).text('TOTAL AMOUNT DUE', pageWidth / 2 - 42, y + 8);
      doc.fontSize(22).fillColor(white).font('Helvetica-Bold').text(`Rs. ${safeTotal.toLocaleString('en-IN')}`, pageWidth / 2 - 45, y + 20);
      doc.font('Helvetica');
      y += bannerHeight + 12;

      // ===== PROPERTY & CUSTOMER DETAILS (Image 2 - cream bg, filled gold icons) =====
      const cardWidth = (contentWidth - 12) / 2;
      const cardHeight = isCompact ? 75 : 85;
      
      // Property Details Card
      doc.roundedRect(margin, y, cardWidth, cardHeight, 5).fill(cardBg);
      
      // Filled gold icon with white building
      doc.roundedRect(margin + 10, y + 10, 16, 16, 3).fill(gold);
      doc.rect(margin + 14, y + 15, 2, 7).fill(white);
      doc.rect(margin + 17, y + 17, 2, 5).fill(white);
      doc.rect(margin + 20, y + 15, 2, 7).fill(white);
      
      doc.fontSize(8).fillColor(primaryText).font('Helvetica-Bold').text('PROPERTY DETAILS', margin + 30, y + 15);
      doc.font('Helvetica');
      
      let py = y + 32;
      const lineH = isCompact ? 9 : 10;
      doc.fontSize(7).fillColor(secondaryText);
      doc.text(`Property ID: ${propertyCode || '-'}`, margin + 10, py); py += lineH;
      doc.text(`Name: ${decodeHtml(propertyName) || '-'}`, margin + 10, py); py += lineH;
      doc.text(`Type: ${propertyType || '-'}`, margin + 10, py); py += lineH;
      doc.text(`Zone: ${zone || '-'}`, margin + 10, py); py += lineH;
      doc.text(`City: ${city || '-'}`, margin + 10, py);

      // Customer Details Card
      const custX = margin + cardWidth + 12;
      doc.roundedRect(custX, y, cardWidth, cardHeight, 5).fill(cardBg);
      
      // Filled gold icon with white person
      doc.roundedRect(custX + 10, y + 10, 16, 16, 3).fill(gold);
      doc.circle(custX + 18, y + 15, 3).fill(white);
      doc.roundedRect(custX + 13, y + 20, 10, 3, 1).fill(white);
      
      doc.fontSize(8).fillColor(primaryText).font('Helvetica-Bold').text('CUSTOMER DETAILS', custX + 30, y + 15);
      doc.font('Helvetica');
      
      let cy = y + 32;
      doc.fontSize(7).fillColor(secondaryText);
      doc.text(`Name: ${decodeHtml(customerName) || '-'}`, custX + 10, cy); cy += lineH;
      doc.text(`Phone: ${customerPhone || '-'}`, custX + 10, cy); cy += lineH;
      const emailStr = customerEmail || '-';
      doc.text(`Email: ${emailStr.length > 28 ? emailStr.substring(0, 28) + '...' : emailStr}`, custX + 10, cy); cy += lineH;
      doc.text(`City: ${city || '-'}`, custX + 10, cy);

      y += cardHeight + 12;

      // ===== SERVICES INCLUDED TABLE =====
      if (!isWorkOrderInvoice && items.length > 0) {
        // Section header with filled gold icon
        doc.roundedRect(margin, y, 14, 14, 2).fill(gold);
        doc.rect(margin + 4, y + 4, 6, 6).fill(white);
        
        doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('SERVICES INCLUDED', margin + 20, y + 3);
        doc.strokeColor(gold).lineWidth(0.5).moveTo(margin + 85, y + 7).lineTo(pageWidth - margin, y + 7).stroke();
        doc.font('Helvetica');
        y += 18;
        
        // Table header - Gold background
        const tableHeaderH = 20;
        doc.rect(margin, y, contentWidth, tableHeaderH).fill(gold);
        doc.fontSize(8).fillColor(white);
        doc.text('#', margin + 8, y + 6);
        doc.text('Service', margin + 35, y + 6);
        doc.text('Description', margin + 140, y + 6);
        doc.text('Frequency', margin + 320, y + 6);
        doc.text('Visits', margin + 420, y + 6);
        y += tableHeaderH;

        // Table rows - compact
        const rowH = isCompact ? 16 : 18;
        items.forEach((item, idx) => {
          const details = decodeHtml(item.details || '');
          const fullDesc = decodeHtml(item.description || item.name || 'Service');
          const parts = fullDesc.split(' - ');
          const serviceName = parts[0] || 'Service';
          const serviceDesc = details || parts.slice(1).join(' - ') || '-';
          const freq = item.frequency || item.frequencyType || item.billingDuration || '-';
          const visits = item.visits || item.frequencyCount || item.quantity || 1;
          
          doc.rect(margin, y, contentWidth, rowH).lineWidth(0.3).stroke(borderGray);
          doc.fontSize(7).fillColor(primaryText);
          doc.text(`${idx + 1}`, margin + 10, y + 5);
          doc.text(serviceName.substring(0, 25), margin + 35, y + 5);
          doc.fillColor(secondaryText).text(serviceDesc.substring(0, 40), margin + 140, y + 5);
          doc.text(freq.substring(0, 12), margin + 320, y + 5);
          doc.text(`${visits}`, margin + 428, y + 5);
          y += rowH;
        });

        y += 15;
      }

      // ===== PRICE SUMMARY - Right aligned with shield icon =====
      const summaryWidth = 170;
      const summaryX = pageWidth - margin - summaryWidth;
      
      // Shield icon (filled gold)
      doc.roundedRect(summaryX, y, 14, 14, 2).fill(gold);
      doc.moveTo(summaryX + 7, y + 3).lineTo(summaryX + 11, y + 5).lineTo(summaryX + 11, y + 9).lineTo(summaryX + 7, y + 12).lineTo(summaryX + 3, y + 9).lineTo(summaryX + 3, y + 5).closePath().fill(white);
      
      doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('PRICE SUMMARY', summaryX + 20, y + 2);
      doc.strokeColor(gold).lineWidth(0.5).moveTo(summaryX + 75, y + 6).lineTo(pageWidth - margin, y + 6).stroke();
      doc.font('Helvetica');
      y += 16;
      
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

module.exports = {
  generateEstimatePDF,
  generateInvoicePDF
};
