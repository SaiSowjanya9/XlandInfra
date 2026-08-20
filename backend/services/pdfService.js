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
  const headerHeight = 28;
  
  // Black header background
  doc.rect(0, 0, 595, headerHeight).fill(headerBlack);
  
  // Gold bar at bottom
  doc.rect(0, headerHeight, 595, 5).fill(gold);
  
  // Logo - compact
  try {
    doc.image(LOGO_PATH, margin + 3, 3, { width: 22, height: 22 });
  } catch (logoErr) {
    doc.roundedRect(margin + 3, 3, 22, 22, 2).fill(gold);
  }
  
  // Company name - compact
  const textX = margin + 30;
  doc.fontSize(11).fillColor(gold).text('XLAND INFRA', textX, 6);
  
  // PVT LTD with decorative lines - positioned below XLAND INFRA
  doc.fontSize(5).fillColor(gold);
  doc.strokeColor(gold).lineWidth(0.4);
  // Left line
  doc.moveTo(textX, 19).lineTo(textX + 10, 19).stroke();
  // PVT LTD text
  doc.text('PVT LTD', textX + 12, 16, { lineBreak: false });
  // Right line
  doc.moveTo(textX + 32, 19).lineTo(textX + 42, 19).stroke();
  
  return headerHeight + 10; // Return starting Y position for content
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

      // ===== HEADER - Use shared function =====
      let y = drawPDFHeader(doc, 50);
      
      // ESTIMATE badge on the right
      doc.roundedRect(455, 8, 90, 20, 3).fill('#C9A227');
      doc.fontSize(10).fillColor(black).text('ESTIMATE', 455, 12, { width: 90, align: 'center', lineBreak: false });

      y = 48;

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

// Generate invoice PDF and return as buffer - Matching Estimate Layout
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
        lineItems, subtotal, discountAmount, discountPercentage, taxAmount, taxPercentage, totalAmount, balanceAmount,
        workOrderId, workOrderCategory, workOrderSubcategory, workOrderDescription
      } = invoice;
      
      // Check if work order invoice - by invoiceType OR presence of workOrderId
      const isWorkOrderInvoice = invoiceType === 'work_order' || (workOrderId && workOrderId.length > 0);
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 50; // Same as estimate PDF
      const contentWidth = 500; // pageWidth - margin*2

      const safeNum = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : Math.round(num);
      };
      const safeSubtotal = safeNum(subtotal);
      const safeDiscount = safeNum(discountAmount);
      const safeTax = safeNum(taxAmount);
      const safeTotal = safeNum(totalAmount);
      const safeTaxPercent = safeNum(taxPercentage) || 18;

      // Colors - matching estimate PDF
      const black = '#1a1a1a';
      const gold = '#d4a84b';
      const navy = '#1e3a5f';
      const lightGray = '#f8f9fa';
      const lightBlue = '#e8f4fc';
      const borderBlue = '#cce7f7';
      const white = '#ffffff';

      // Parse line items
      let items = [];
      try {
        items = typeof lineItems === 'string' ? JSON.parse(lineItems) : (lineItems || []);
      } catch (e) { items = []; }

      // ===== HEADER - Use shared function =====
      let y = drawPDFHeader(doc, margin);
      
      // INVOICE badge on the right (matching estimate's ESTIMATE badge)
      doc.roundedRect(455, 8, 90, 20, 3).fill('#C9A227');
      doc.fontSize(10).fillColor(black).text('INVOICE', 455, 12, { width: 90, align: 'center', lineBreak: false });

      y = 48;

      // ===== ID / DATE ROW - Matching Estimate Layout =====
      doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold').text('ID:', 60, y);
      doc.fontSize(14).fillColor(black).text(invoiceId || 'N/A', 85, y - 2);
      
      // Date and Due on right side
      doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold').text('Date:', 400, y);
      const invDateStr = invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      doc.fontSize(12).fillColor(black).text(invDateStr, 435, y - 1);
      
      doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold').text('Due:', 400, y + 18);
      const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      doc.fontSize(12).fillColor('#dc2626').text(dueDateStr, 430, y + 17);
      doc.font('Helvetica');
      
      y += 45;

      // Estimate reference (if exists)
      if (estimateId) {
        doc.fontSize(8).fillColor(gold).text(`Estimate: ${estimateId}`, 60, y - 10);
      }

      // ===== TOTAL AMOUNT DUE BANNER - Matching Estimate Package Bar =====
      doc.rect(50, y, 500, 25).fill(lightGray).stroke('#e0e0e0');
      doc.fontSize(10).fillColor(navy).text(`Total Amount Due: ₹${safeTotal.toLocaleString('en-IN')}`, 60, y + 8);
      doc.fontSize(10).fillColor(navy).text(`Billing: ${billingDuration || 'One-time'}`, 400, y + 8);
      y += 35;

      // ===== PROPERTY & CUSTOMER DETAILS - Matching Estimate Layout =====
      const cardWidth = 235;
      const cardHeight = 100;
      
      // Property Details Card - Light blue background like estimate
      doc.rect(50, y, cardWidth, cardHeight).fill(lightBlue).stroke(borderBlue);
      doc.fontSize(10).fillColor(navy).text('Property Details', 60, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let py = y + 28;
      if (propertyCode) { doc.text(`Property ID: ${propertyCode}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      if (propertyName) { doc.text(`Name: ${decodeHtml(propertyName)}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      const propTypeLabel = { 'GC': 'Gated Community', 'APT': 'Apartment', 'VILLA': 'Villa', 'PLOT': 'Plot' }[propertyType] || propertyType || '-';
      doc.text(`Type: ${propTypeLabel}`, 60, py, { width: cardWidth - 20 }); py += 12;
      if (zone) { doc.text(`Zone: ${zone}`, 60, py, { width: cardWidth - 20 }); py += 12; }
      if (city) { doc.text(`City: ${city}`, 60, py, { width: cardWidth - 20 }); }

      // Customer Details Card - Light blue background like estimate
      doc.rect(305, y, cardWidth, cardHeight).fill(lightBlue).stroke(borderBlue);
      doc.fontSize(10).fillColor(navy).text('Customer Details', 315, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let cy = y + 28;
      if (customerName) { doc.text(`Name: ${decodeHtml(customerName)}`, 315, cy, { width: cardWidth - 20 }); cy += 12; }
      if (customerPhone) { doc.text(`Phone: ${customerPhone}`, 315, cy, { width: cardWidth - 20 }); cy += 12; }
      if (customerEmail) { 
        const emailFontSize = customerEmail.length > 25 ? 7 : 8;
        doc.fontSize(emailFontSize).text(`Email: ${customerEmail}`, 315, cy, { width: cardWidth - 20 }); 
        cy += (customerEmail.length > 35 ? 20 : 12);
        doc.fontSize(8);
      }
      if (city) { doc.text(`City: ${city}`, 315, cy, { width: cardWidth - 20 }); }

      // ===== WORK ORDER DETAILS (for work order invoices) - Matching Estimate Layout =====
      if (isWorkOrderInvoice) {
        const woItem = items[0] || {};
        const category = workOrderCategory || woItem.category || woItem.serviceCategory || '-';
        const subcategory = workOrderSubcategory || woItem.subcategory || woItem.serviceSubcategory || '-';
        const woDescription = decodeHtml(workOrderDescription || woItem.description || woItem.details || '');
        
        // Work Order Details box - matching estimate style (4-column layout)
        doc.rect(50, y, 500, 40).fill(lightBlue).stroke(borderBlue);
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
        doc.text(String(category || '-').substring(0, 18), col2, wy + 9);
        doc.text(String(subcategory || '-').substring(0, 18), col3, wy + 9);
        doc.text('NORMAL', col4, wy + 9);
        
        y += 48;
        
        // Description if exists
        if (woDescription && woDescription.length > 0) {
          doc.fontSize(10).fillColor(navy).text('Work Description', 50, y);
          y += 15;
          const descLines = Math.ceil(woDescription.length / 70);
          const descBoxHeight = Math.min(Math.max(descLines * 12 + 16, 30), 80);
          doc.rect(50, y, 500, descBoxHeight).fill(lightGray).stroke('#e0e0e0');
          doc.fontSize(8).fillColor('#444444').text(woDescription, 60, y + 8, { width: 480, height: descBoxHeight - 12 });
          y += descBoxHeight + 10;
        }
      }

      // ===== SERVICES INCLUDED TABLE =====
      if (!isWorkOrderInvoice && items.length > 0) {
        doc.fontSize(10).fillColor(navy).text('SERVICES INCLUDED', 50, y);
        y += 6;
        
        // Table header - matching estimate style
        const tableHeaderH = 20;
        doc.rect(50, y, 500, tableHeaderH).fill(gold);
        doc.fontSize(8).fillColor(white);
        doc.text('#', 58, y + 6);
        doc.text('Service', 85, y + 6);
        doc.text('Description', 190, y + 6);
        doc.text('Frequency', 370, y + 6);
        doc.text('Visits', 470, y + 6);
        y += tableHeaderH;

        // Table rows - matching estimate style
        const rowH = 18;
        items.forEach((item, idx) => {
          const details = decodeHtml(item.details || '');
          const fullDesc = decodeHtml(item.description || item.name || 'Service');
          const parts = fullDesc.split(' - ');
          const serviceName = parts[0] || 'Service';
          const serviceDesc = details || parts.slice(1).join(' - ') || '-';
          const freq = item.frequency || item.frequencyType || item.billingDuration || '-';
          const visits = item.visits || item.frequencyCount || item.quantity || 1;
          
          doc.rect(50, y, 500, rowH).lineWidth(0.3).stroke('#e0e0e0');
          doc.fontSize(8).fillColor('#333333');
          doc.text(`${idx + 1}`, 60, y + 5);
          doc.text(serviceName.substring(0, 25), 85, y + 5);
          doc.fillColor('#666666').text(serviceDesc.substring(0, 40), 190, y + 5);
          doc.text(freq.substring(0, 12), 370, y + 5);
          doc.text(`${visits}`, 475, y + 5);
          y += rowH;
        });

        y += 15;
      }

      // ===== PRICE SUMMARY - Matching Estimate Layout =====
      // Check if need new page
      if (y > pageHeight - 150) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(10).fillColor(navy).text('PRICE SUMMARY', 50, y, { continued: false });
      y += 15;
      
      const summaryHeight = safeDiscount > 0 ? 80 : 70;
      doc.rect(50, y, 500, summaryHeight).fill(lightGray).stroke('#e0e0e0');

      doc.fontSize(9).fillColor('#666666');
      doc.text('Subtotal', 60, y + 10, { continued: false });
      doc.text(`₹${safeSubtotal.toLocaleString('en-IN')}`, 450, y + 10, { width: 80, align: 'right' });
      
      let psy = y + 25;
      if (safeDiscount > 0) {
        doc.fillColor('#059669').text('Discount', 60, psy, { continued: false });
        doc.text(`-₹${safeDiscount.toLocaleString('en-IN')}`, 450, psy, { width: 80, align: 'right' });
        psy += 15;
      }
      
      doc.fillColor('#666666').text(`GST (${safeTaxPercent}%)`, 60, psy, { continued: false });
      doc.text(`₹${safeTax.toLocaleString('en-IN')}`, 450, psy, { width: 80, align: 'right' });
      psy += 20;
      
      // Total row - gold accent
      doc.rect(50, psy - 5, 500, 25).fill('#d4a84b');
      doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold').text('TOTAL', 60, psy, { continued: false });
      doc.text(`₹${safeTotal.toLocaleString('en-IN')}`, 420, psy, { width: 110, align: 'right' });
      doc.font('Helvetica');

      y = y + summaryHeight + 30;

      // ===== FOOTER =====
      const footerY = Math.max(y, pageHeight - 60);
      doc.fontSize(8).fillColor('#888888').text(
        'Thank you for your business! For questions, contact info@xlandinfra.com',
        50, footerY, { width: 500, align: 'center' }
      );
      doc.fontSize(7).fillColor('#aaaaaa').text(
        `Generated on ${new Date().toLocaleDateString('en-IN')} | XLAND INFRA Pvt Ltd`,
        50, footerY + 15, { width: 500, align: 'center' }
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
