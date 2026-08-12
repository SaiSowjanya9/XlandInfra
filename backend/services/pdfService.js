const PDFDocument = require('pdfkit');
const path = require('path');

// Logo file path - icon only (without text) for horizontal layout - OPTIMIZED for smaller PDF size
const LOGO_PATH = path.join(__dirname, '../assets/logo-icon-optimized.png');

/**
 * Decode HTML entities (e.g., &amp; -> &, &#x2F; -> /)
 */
const decodeHtml = (html) => {
  if (!html || typeof html !== 'string') return html || '';
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
  let decoded = html;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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

      // Debug log received price values
      console.log('[PDF Service] Received price values:', {
        subtotal, discount, discountAmount, tax, gstPercent, total
      });

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
        doc.fontSize(10).fillColor(navy).text(`Package Price: Rs. ${Math.round(Number(packagePrice)).toLocaleString()}`, 60, y + 8);
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

      // Work Order Details (only for work order estimates) - same style as Property & Customer cards
      if (isWorkOrderEstimate && workOrderId) {
        doc.rect(50, y, 500, 60).fill('#e8f4fc').stroke('#cce7f7'); // Same blue as other cards
        doc.fontSize(10).fillColor(navy).text('Work Order Details', 60, y + 10);
        doc.fontSize(8).fillColor('#666666');
        let wy = y + 28;
        
        // Row 1: Work Order ID & Category
        doc.text('Work Order ID:', 60, wy);
        doc.fillColor('#333333').text(workOrderId, 130, wy);
        if (workOrderCategory) { 
          doc.fillColor('#666666').text('Category:', 280, wy); 
          doc.fillColor('#333333').text(workOrderCategory, 330, wy);
        }
        wy += 14;
        
        // Row 2: Subcategory & Priority
        doc.fillColor('#666666');
        if (workOrderSubcategory) { 
          doc.text('Subcategory:', 60, wy); 
          doc.fillColor('#333333').text(workOrderSubcategory, 130, wy);
        }
        if (workOrderPriority) { 
          doc.fillColor('#666666').text('Priority:', 280, wy); 
          doc.fillColor('#333333').text(workOrderPriority.toUpperCase(), 330, wy);
        }
        y += 70;
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

      // Services Table
      doc.fontSize(10).fillColor(navy).text('SERVICES INCLUDED', 50, y, { continued: false });
      y += 15;
      
      // Table header - separate Service and Description columns
      doc.rect(50, y, 500, 20).fill('#475569');
      doc.fontSize(8).fillColor('#ffffff');
      doc.text('#', 55, y + 6, { continued: false });
      doc.text('Service', 75, y + 6, { continued: false });
      doc.text('Description', 260, y + 6, { width: 130, align: 'center', continued: false });
      doc.text('Frequency', 400, y + 6, { continued: false });
      doc.text('Visits', 480, y + 6, { continued: false });
      y += 20;

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
      
      svcList.forEach((s, idx) => {
        const svcDesc = decodeHtml(s.description) || '-';
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
        doc.text(svcName.substring(0, 28), 75, y + 6, { continued: false });
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

      // Add-ons Table (if any) - ensure it's an array
      let addonList = addons;
      if (!Array.isArray(addonList)) {
        if (typeof addonList === 'string') {
          try { addonList = JSON.parse(addonList); } catch (e) { addonList = []; }
        } else {
          addonList = [];
        }
      }
      if (!Array.isArray(addonList)) addonList = [];
      if (addonList.length > 0) {
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
        doc.rect(50, y, 500, 20).fill('#475569');
        doc.fontSize(8).fillColor('#ffffff');
        doc.text('#', 55, y + 6, { continued: false });
        doc.text('Add-on Service', 75, y + 6, { continued: false });
        doc.text('Description', 260, y + 6, { width: 130, align: 'center', continued: false });
        doc.text('Frequency', 400, y + 6, { continued: false });
        doc.text('Visits', 480, y + 6, { continued: false });
        y += 20;

        addonList.forEach((a, idx) => {
          const addonDesc = decodeHtml(a.description) || '-';
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
          doc.text(addonName.substring(0, 28), 75, y + 6, { continued: false });
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
      doc.text('Subtotal:', 60, y + 10, { continued: false });
      doc.fillColor('#333333').text(`Rs. ${safeSubtotal.toLocaleString()}`, 450, y + 10, { continued: false });
      
      if (safeDiscount > 0 || safeDiscountAmount > 0) {
        doc.fillColor('#666666').text(`Discount (${safeDiscount}%):`, 60, y + 25, { continued: false });
        doc.fillColor('#333333').text(`-Rs. ${safeDiscountAmount.toLocaleString()}`, 450, y + 25, { continued: false });
      }
      
      doc.fillColor('#666666').text(`GST (${safeGstPercent}%):`, 60, y + 40, { continued: false });
      doc.fillColor('#333333').text(`Rs. ${safeTax.toLocaleString()}`, 450, y + 40, { continued: false });
      
      // Total line
      doc.rect(60, y + 55, 480, 1).fill('#e0e0e0');
      doc.fontSize(12).fillColor(navy).text('TOTAL:', 60, y + 62, { continued: false });
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(`Rs. ${safeTotal.toLocaleString()}`, 450, y + 62, { continued: false });
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

// Generate invoice PDF and return as buffer
const generateInvoicePDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const {
        invoiceId, estimateId, customerName, customerEmail, customerPhone,
        propertyName, propertyCode, propertyType, zone, city,
        invoiceDate, dueDate, billingDuration,
        lineItems, subtotal, discountAmount, discountPercentage, taxAmount, taxPercentage, totalAmount, balanceAmount
      } = invoice;

      // Ensure numeric values are valid
      const safeNum = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : Math.round(num);
      };
      const safeSubtotal = safeNum(subtotal);
      const safeDiscount = safeNum(discountAmount);
      const safeTax = safeNum(taxAmount);
      const safeTotal = safeNum(totalAmount);
      const safeBalance = safeNum(balanceAmount || totalAmount);

      // Colors
      const black = '#1a1a1a';
      const gold = '#d4a84b';
      const navy = '#1e3a5f';
      const lightGray = '#f8f9fa';
      const lightBlue = '#e8f4fc';

      // Header - Black background
      doc.rect(0, 0, 612, 55).fill(black);
      
      // Logo Icon
      try {
        doc.image(LOGO_PATH, 50, 8, { width: 38, height: 38 });
      } catch (logoErr) {
        doc.rect(50, 8, 38, 38).fill(gold);
      }
      
      // Company Name
      doc.fontSize(16).fillColor(gold).text('XLAND INFRA', 95, 20);
      const mainTextWidth = doc.widthOfString('XLAND INFRA');
      doc.fontSize(7);
      const pvtLtdText = 'PVT LTD';
      const pvtLtdWidth = doc.widthOfString(pvtLtdText);
      const pvtLtdX = 95 + (mainTextWidth - pvtLtdWidth) / 2;
      doc.fillColor(gold).text(pvtLtdText, pvtLtdX, 38);
      // Draw lines
      const lineY = 43;
      const lineGap = 4;
      doc.strokeColor(gold).lineWidth(0.5);
      doc.moveTo(95, lineY).lineTo(pvtLtdX - lineGap, lineY).stroke();
      doc.moveTo(pvtLtdX + pvtLtdWidth + lineGap, lineY).lineTo(95 + mainTextWidth, lineY).stroke();

      let y = 80;

      // Invoice Info Section
      doc.fontSize(9).fillColor('#666666');
      doc.text(`Invoice ID: ${invoiceId || 'N/A'}`, 50, y);
      if (estimateId) {
        doc.text(`Estimate: ${estimateId}`, 50, y + 12);
      }
      
      // Right side - dates
      doc.text(`Invoice Date: ${invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, 350, y);
      doc.text(`Due Date: ${dueDate ? new Date(dueDate).toLocaleDateString('en-IN') : '-'}`, 350, y + 12);
      if (billingDuration) {
        doc.fillColor('#2563eb').text(`Billing: ${billingDuration}`, 350, y + 24);
      }
      
      y += 50;

      // Total Amount Banner
      doc.rect(50, y, 500, 40).fill('#2563eb');
      doc.fontSize(10).fillColor('#ffffff').text('Total Amount Due', 60, y + 8);
      doc.fontSize(18).fillColor('#ffffff').text(`Rs. ${safeTotal.toLocaleString('en-IN')}`, 60, y + 20);
      y += 50;

      // Property & Customer Details (side by side)
      const cardWidth = 235;
      
      // Property Details Card
      doc.rect(50, y, cardWidth, 90).fill(lightBlue).stroke('#cce7f7');
      doc.fontSize(10).fillColor(navy).text('Property Details', 60, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let py = y + 26;
      doc.text(`Property ID: ${propertyCode || '-'}`, 60, py); py += 12;
      doc.text(`Name: ${decodeHtml(propertyName) || '-'}`, 60, py); py += 12;
      if (propertyType) { doc.text(`Type: ${propertyType}`, 60, py); py += 12; }
      if (zone) { doc.text(`Zone: ${zone}`, 60, py); py += 12; }
      if (city) { doc.text(`City: ${city}`, 60, py); }

      // Customer Details Card
      doc.rect(305, y, cardWidth, 90).fill(lightBlue).stroke('#cce7f7');
      doc.fontSize(10).fillColor(navy).text('Customer Details', 315, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let cy = y + 26;
      doc.text(`Name: ${decodeHtml(customerName) || '-'}`, 315, cy); cy += 12;
      doc.text(`Phone: ${customerPhone || '-'}`, 315, cy); cy += 12;
      doc.text(`Email: ${customerEmail || '-'}`, 315, cy); cy += 12;
      if (city) { doc.text(`City: ${city}`, 315, cy); }

      y += 105;

      // Services Table
      doc.fontSize(10).fillColor(navy).text('SERVICES INCLUDED', 50, y);
      y += 15;
      
      // Table header
      doc.rect(50, y, 500, 20).fill('#475569');
      doc.fontSize(8).fillColor('#ffffff');
      doc.text('#', 55, y + 6);
      doc.text('Service', 75, y + 6);
      doc.text('Description', 200, y + 6);
      doc.text('Frequency', 380, y + 6);
      doc.text('Visits', 480, y + 6);
      y += 20;

      // Parse line items
      let items = [];
      try {
        items = typeof lineItems === 'string' ? JSON.parse(lineItems) : (lineItems || []);
      } catch (e) { items = []; }

      const pageHeight = 780;
      
      items.forEach((item, idx) => {
        const fullDesc = decodeHtml(item.description || item.name || 'Service');
        const parts = fullDesc.split(' - ');
        const serviceName = parts[0] || 'Service';
        const serviceDesc = parts.slice(1).join(' - ') || '-';
        const freq = item.frequency || item.frequencyType || item.billingDuration || '-';
        const visits = item.visits || item.frequencyCount || item.quantity || 1;
        
        const rowHeight = 22;
        
        if (y + rowHeight > pageHeight) {
          doc.addPage();
          y = 50;
        }
        
        doc.rect(50, y, 500, rowHeight).fill(idx % 2 === 0 ? '#ffffff' : lightGray).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#333333');
        doc.text(`${idx + 1}`, 55, y + 7);
        doc.fillColor(navy).text(serviceName.substring(0, 20), 75, y + 7);
        doc.fillColor('#666666').text(serviceDesc.substring(0, 35), 200, y + 7);
        doc.text(freq, 380, y + 7);
        doc.text(`${visits}`, 480, y + 7);
        y += rowHeight;
      });

      y += 15;

      // Price Summary
      if (y + 100 > pageHeight) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(10).fillColor(navy).text('PRICE SUMMARY', 350, y);
      y += 18;
      
      doc.rect(350, y, 200, 80).fill(lightGray).stroke('#e0e0e0');
      doc.fontSize(9).fillColor('#666666');
      let sy = y + 10;
      doc.text('Subtotal:', 360, sy);
      doc.fillColor('#333333').text(`Rs. ${safeSubtotal.toLocaleString('en-IN')}`, 480, sy);
      sy += 14;
      
      if (safeDiscount > 0) {
        doc.fillColor('#059669').text(`Discount (${discountPercentage || 0}%):`, 360, sy);
        doc.text(`-Rs. ${safeDiscount.toLocaleString('en-IN')}`, 470, sy);
        sy += 14;
      }
      
      doc.fillColor('#666666').text(`GST (${taxPercentage || 18}%):`, 360, sy);
      doc.fillColor('#333333').text(`Rs. ${safeTax.toLocaleString('en-IN')}`, 480, sy);
      sy += 14;
      
      doc.strokeColor('#333333').lineWidth(0.5).moveTo(360, sy).lineTo(540, sy).stroke();
      sy += 8;
      
      doc.fontSize(11).fillColor(navy).text('Total:', 360, sy);
      doc.text(`Rs. ${safeTotal.toLocaleString('en-IN')}`, 470, sy);
      
      // Footer
      doc.fontSize(8).fillColor('#999999').text(
        'This is a computer-generated invoice. For queries, contact info@xlandinfra.com',
        50, 750, { align: 'center', width: 500 }
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
