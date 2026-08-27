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

// ===== SHARED PDF HEADER FUNCTION =====
// Used by all PDF exports for consistent branding
const drawPDFHeader = (doc, margin) => {
  const gold = '#C9A227';
  const headerBlack = '#1a1a1a';
  const headerHeight = 38; // Compact header
  
  // Black header background
  doc.rect(0, 0, 595, headerHeight).fill(headerBlack);
  
  // Gold bar at bottom
  doc.rect(0, headerHeight, 595, 4).fill(gold);
  
  // Logo - compact size
  try {
    doc.image(LOGO_PATH, margin + 5, 4, { width: 30, height: 30 });
  } catch (logoErr) {
    doc.roundedRect(margin + 5, 4, 30, 30, 3).fill(gold);
  }
  
  // Company name
  const textX = margin + 45;
  doc.fontSize(14).fillColor(gold).font('Helvetica-Bold').text('XLAND INFRA', textX, 10);
  
  // PVT LTD with decorative lines - format: — PVT LTD —
  doc.fontSize(6).fillColor(gold).font('Helvetica');
  doc.strokeColor(gold).lineWidth(0.4);
  
  // Fixed positions
  const lineY = 26;
  const lineLen = 7;
  const gap = 0.5;
  const pvtLtdWidth = doc.widthOfString('PVT LTD');
  
  // Left line
  doc.moveTo(textX, lineY).lineTo(textX + lineLen, lineY).stroke();
  
  // PVT LTD text
  doc.text('PVT LTD', textX + lineLen + gap, 23, { lineBreak: false });
  
  // Right line
  const rightLineStart = textX + lineLen + gap + pvtLtdWidth + gap;
  doc.moveTo(rightLineStart, lineY).lineTo(rightLineStart + lineLen, lineY).stroke();
  
  return headerHeight + 15; // Return starting Y position for content
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
        billingDuration, billing_duration,
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

      // ===== HEADER - Use shared function =====
      let y = drawPDFHeader(doc, 50);

      // Add ESTIMATE badge in header (top right) - filled gold with black text (not bold)
      doc.roundedRect(465, 12, 90, 24, 4).fill('#D4A84B');
      doc.fontSize(12).fillColor('#1a1a1a').font('Helvetica').text('ESTIMATE', 480, 18);
      doc.font('Helvetica');

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

      // Work Order Details (only for work order estimates) - 2x2 Grid layout
      if (isWorkOrderEstimate && workOrderId) {
        doc.rect(50, y, 500, 55).fill('#e8f4fc').stroke('#cce7f7');
        doc.fontSize(10).fillColor(navy).text('Work Order Details', 60, y + 8);
        
        // 2x2 grid layout - labels and values inline
        const leftCol = 60, rightCol = 300;
        const row1Y = y + 25;
        const row2Y = y + 40;
        
        // Row 1: Work Order ID | Category - all values in black
        doc.fontSize(8).fillColor('#666666');
        doc.text('Work Order ID:', leftCol, row1Y);
        doc.fillColor('#333333').text(String(workOrderId || '-'), leftCol + 75, row1Y);
        
        doc.fillColor('#666666');
        doc.text('Category:', rightCol, row1Y);
        doc.fillColor('#333333').text(String(workOrderCategory || '-'), rightCol + 55, row1Y);
        
        // Row 2: Subcategory | Priority
        doc.fillColor('#666666');
        doc.text('Subcategory:', leftCol, row2Y);
        doc.fillColor('#333333').text(String(workOrderSubcategory || '-'), leftCol + 75, row2Y);
        
        doc.fillColor('#666666');
        doc.text('Priority:', rightCol, row2Y);
        doc.fillColor('#333333').text(String(workOrderPriority || '-').toUpperCase(), rightCol + 55, row2Y);
        
        y += 63;
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
        doc.text('Service', 72, y + 6, { continued: false });
        doc.text('Description', 155, y + 6, { continued: false });
        doc.text('Frequency', 420, y + 6, { continued: false });
        doc.text('Visits', 500, y + 6, { continued: false });
        y += 20;

        const descColWidthEst = 255; // Increased width for description
        svcList.forEach((s, idx) => {
          // Use s.details as fallback for full description (backend stores it separately)
          const svcDesc = decodeHtml(s.details || s.description || s.service_description) || '-';
          // Calculate row height based on description length (approx 50 chars per line with new width)
          const descLines = Math.ceil(svcDesc.length / 50);
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
          doc.text(svcName, 72, y + 6, { width: 78, continued: false });
          // Full description with proper width for wrapping
          doc.text(svcDesc, 155, y + 6, { width: descColWidthEst, height: rowHeight - 8, continued: false });
          const freqCount = s.frequencyCount ?? s.frequency_count ?? 1;
          let freqType = s.frequencyType || s.frequency_type || 'Monthly';
          freqType = freqType.replace(/^\d+x\s*/i, '');
          doc.text(freqType, 420, y + 6, { continued: false });
          doc.text(String(freqCount), 500, y + 6, { continued: false });
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
        doc.text('Description', 190, y + 6, { width: 200, align: 'center', continued: false });
        doc.text('Frequency', 400, y + 6, { continued: false });
        doc.text('Visits', 490, y + 6, { continued: false });
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
      if (y + 120 > pageHeight) {
        doc.addPage();
        y = 50;
      }

      // Billing Duration - just before Price Summary
      const billingValue = billingDuration || billing_duration || 'Yearly';
      const formattedBilling = billingValue.charAt(0).toUpperCase() + billingValue.slice(1).replace('-', ' ');
      doc.fontSize(9).fillColor('#666666').text('Billing:', 50, y);
      doc.fillColor('#333333').text(formattedBilling, 500, y, { align: 'right' });
      y += 20;
      
      // Price Summary - use safe values
      doc.fontSize(10).fillColor(navy).text('PRICE SUMMARY', 50, y, { continued: false });
      y += 15;
      doc.rect(50, y, 500, 80).fill(lightGray).stroke('#e0e0e0');
      
      doc.fontSize(9).fillColor('#666666');
      doc.text('Subtotal:', 60, y + 10);
      doc.fillColor('#333333').text(`Rs. ${safeSubtotal.toLocaleString()}`, 450, y + 10);
      
      if (safeDiscount > 0 || safeDiscountAmount > 0) {
        doc.fillColor('#666666').text(`Discount (${safeDiscount}%):`, 60, y + 25);
        doc.fillColor('#333333').text(`-Rs. ${safeDiscountAmount.toLocaleString()}`, 450, y + 25);
      }
      
      doc.fillColor('#666666').text(`GST (${safeGstPercent}%):`, 60, y + 40);
      doc.fillColor('#333333').text(`Rs. ${safeTax.toLocaleString()}`, 450, y + 40);
      
      // Total line - black color for value
      doc.rect(60, y + 55, 480, 1).fill('#e0e0e0');
      doc.fontSize(12).fillColor(navy).font('Helvetica-Bold').text('TOTAL:', 60, y + 62);
      doc.fontSize(12).fillColor('#1a1a1a').text(`Rs. ${safeTotal.toLocaleString()}`, 450, y + 62);
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
        doc.fontSize(9).fillColor('#333333').text(decodeHtml(description), 50, y, { width: 500, lineGap: 4, continued: false });
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
        doc.fontSize(9).fillColor(primaryText).font('Helvetica-Bold').text('ADD-ONS', margin, y + 3, { lineBreak: false });
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
        doc.text('Add-on', colAddon, y + 6);
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
            doc.text('Add-on', colAddon, y + 6);
            doc.text('Description', colDesc + (colDescW / 2) - 25, y + 6);
            doc.text('Frequency', colFreq, y + 6);
            doc.text('Visits', colVisits, y + 6);
            doc.text('Price', colPrice, y + 6);
            y += tableHeaderH;
          }
        };

        addonItems.forEach((item, idx) => {
          // Parse addon name and description
          const fullDesc = decodeHtml(item.description || item.name || 'Add-on');
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
