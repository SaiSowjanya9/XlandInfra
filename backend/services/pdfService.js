const PDFDocument = require('pdfkit');
const { XLAND_LOGO } = require('../utils/logoBase64');

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
        estimateId, customerName, customerEmail, customerPhone,
        propertyName, propertyType, propertyCode, zone, division, city, address,
        numberOfBlocks, totalUnits, towerName, blockNumber, villaPlotNumber,
        packageName, packagePrice, amcPackageDescription, services, addons,
        subtotal, discount, discountAmount, tax, gstPercent, total, description, createdAt
      } = estimate;

      // Debug log received price values
      console.log('[PDF Service] Received price values:', {
        subtotal, discount, discountAmount, tax, gstPercent, total
      });

      // Ensure numeric values are valid (handle NaN, undefined, null)
      const safeNum = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
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

      // Header - Black background with gold accent
      doc.rect(0, 0, 612, 50).fill(black);
      
      // Company Logo - use actual logo image
      try {
        const logoBase64 = XLAND_LOGO.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(logoBase64, 'base64');
        doc.image(logoBuffer, 50, 8, { width: 35, height: 35 });
      } catch (logoErr) {
        // Fallback to gold square with XI if logo fails
        doc.rect(50, 12, 26, 26).fill(gold);
        doc.fontSize(14).fillColor(black).text('XI', 56, 20);
      }
      
      // Company name text
      doc.fontSize(16).fillColor('#ffffff').text('XLAND INFRA', 90, 18);
      
      // ESTIMATE badge
      doc.rect(470, 15, 80, 22).fill(gold);
      doc.fontSize(10).fillColor(black).text('ESTIMATE', 485, 22);

      let y = 90;

      // Estimate Info
      doc.fontSize(9).fillColor('#666666');
      doc.text(`ID: ${estimateId || 'N/A'}`, 50, y);
      doc.text(`Date: ${createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 400, y);
      y += 25;

      // Package Price Bar (NO package name - per requirement)
      if (packagePrice) {
        doc.rect(50, y, 500, 25).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(10).fillColor(navy).text(`Package Price: Rs. ${Number(packagePrice).toLocaleString()}`, 60, y + 8);
        doc.fontSize(9).fillColor('#888888').text('Yearly Billing', 450, y + 8);
        y += 35;
      }

      // Property & Customer Details (side by side)
      const cardWidth = 235;
      
      // Property Details Card
      doc.rect(50, y, cardWidth, 100).fill(lightGray).stroke('#e0e0e0');
      doc.fontSize(10).fillColor(navy).text('Property Details', 60, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let py = y + 28;
      if (propertyCode) { doc.text(`Property ID: ${propertyCode}`, 60, py); py += 12; }
      if (propertyName) { doc.text(`Name: ${propertyName}`, 60, py); py += 12; }
      const propTypeLabel = { 'GC': 'Gated Community', 'APT': 'Apartment', 'VILLA': 'Villa', 'PLOT': 'Plot' }[propertyType] || propertyType;
      if (propTypeLabel) { doc.text(`Type: ${propTypeLabel}`, 60, py); py += 12; }
      if (zone) { doc.text(`Zone: ${zone}`, 60, py); py += 12; }
      if (division) { doc.text(`Division: ${division}`, 60, py); py += 12; }

      // Customer Details Card
      doc.rect(305, y, cardWidth, 100).fill('#e8f4fc').stroke('#cce7f7');
      doc.fontSize(10).fillColor(navy).text('Customer Details', 315, y + 10);
      doc.fontSize(8).fillColor('#666666');
      let cy = y + 28;
      if (customerName) { doc.text(`Name: ${customerName}`, 315, cy); cy += 12; }
      if (customerPhone) { doc.text(`Phone: ${customerPhone}`, 315, cy); cy += 12; }
      if (customerEmail) { doc.text(`Email: ${customerEmail}`, 315, cy); cy += 12; }
      if (city) { doc.text(`City: ${city}`, 315, cy); cy += 12; }

      y += 115;

      // Package Description - dynamic height based on content
      if (amcPackageDescription) {
        doc.fontSize(10).fillColor(navy).text('PACKAGE DESCRIPTION', 50, y);
        y += 15;
        // Calculate height needed for description (approx 12 chars per line at font size 8)
        const descLines = Math.ceil(amcPackageDescription.length / 70);
        const descBoxHeight = Math.min(Math.max(descLines * 12 + 16, 50), 150); // Min 50, max 150
        doc.rect(50, y, 500, descBoxHeight).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#444444').text(amcPackageDescription, 60, y + 8, { width: 480, height: descBoxHeight - 12 });
        y += descBoxHeight + 10;
      }

      // Services Table
      doc.fontSize(10).fillColor(navy).text('SERVICES INCLUDED', 50, y);
      y += 15;
      
      // Table header - separate Service and Description columns
      doc.rect(50, y, 500, 20).fill('#475569');
      doc.fontSize(8).fillColor('#ffffff');
      doc.text('#', 55, y + 6);
      doc.text('Service', 75, y + 6);
      doc.text('Description', 260, y + 6, { width: 130, align: 'center' }); // Center aligned
      doc.text('Frequency', 400, y + 6);
      doc.text('Visits', 480, y + 6);
      y += 20;

      // Services rows
      const svcList = services || [];
      svcList.forEach((s, idx) => {
        const rowColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
        doc.rect(50, y, 500, 22).fill(rowColor).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#333333');
        doc.text(String(idx + 1), 55, y + 6);
        const svcName = s.name || s.service || 'Service';
        doc.text(svcName.substring(0, 28), 75, y + 6);
        const svcDesc = s.description || '-';
        doc.text(svcDesc.substring(0, 35), 190, y + 6, { width: 200, align: 'center' }); // Center aligned
        const freqCount = s.frequencyCount || s.frequency_count || 1;
        let freqType = s.frequencyType || s.frequency_type || 'Monthly';
        // Remove "Nx " prefix if present (e.g., "12x Monthly" -> "Monthly")
        freqType = freqType.replace(/^\d+x\s*/i, '');
        doc.text(freqType, 400, y + 6);
        doc.text(String(freqCount), 490, y + 6);
        y += 22;
      });

      y += 10;

      // Add-ons Table (if any)
      const addonList = addons || [];
      if (addonList.length > 0) {
        doc.fontSize(10).fillColor(navy).text('ADD-ONS', 50, y);
        y += 15;
        
        // Add-ons header - separate Service and Description columns
        doc.rect(50, y, 500, 20).fill('#475569');
        doc.fontSize(8).fillColor('#ffffff');
        doc.text('#', 55, y + 6);
        doc.text('Add-on Service', 75, y + 6);
        doc.text('Description', 260, y + 6, { width: 130, align: 'center' }); // Center aligned
        doc.text('Frequency', 400, y + 6);
        doc.text('Visits', 480, y + 6);
        y += 20;

        addonList.forEach((a, idx) => {
          const rowColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
          doc.rect(50, y, 500, 22).fill(rowColor).stroke('#e0e0e0');
          doc.fontSize(8).fillColor('#333333');
          doc.text(String(idx + 1), 55, y + 6);
          const addonName = a.name || a.service_name || 'Add-on';
          doc.text(addonName.substring(0, 28), 75, y + 6);
          const addonDesc = a.description || '-';
          doc.text(addonDesc.substring(0, 35), 190, y + 6, { width: 200, align: 'center' }); // Center aligned
          const freqCount = a.frequency_count || a.frequencyCount || 1;
          let freqType = a.frequency_type || a.frequencyType || 'Monthly';
          // Remove "Nx " prefix if present (e.g., "12x Monthly" -> "Monthly")
          freqType = freqType.replace(/^\d+x\s*/i, '');
          doc.text(freqType, 400, y + 6);
          doc.text(String(freqCount), 490, y + 6);
          y += 22;
        });

        y += 10;
      }

      // Price Summary - use safe values
      doc.fontSize(10).fillColor(navy).text('PRICE SUMMARY', 50, y);
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
      
      // Total line
      doc.rect(60, y + 55, 480, 1).fill('#e0e0e0');
      doc.fontSize(12).fillColor(navy).text('TOTAL:', 60, y + 62);
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(`Rs. ${safeTotal.toLocaleString()}`, 450, y + 62);
      doc.font('Helvetica');
      y += 90;

      // Notes/Description (after Price Summary)
      if (description) {
        doc.fontSize(10).fillColor(navy).text('NOTES / DESCRIPTION', 50, y);
        y += 18;
        doc.fontSize(9).fillColor('#333333').text(description, 50, y, { width: 500, lineGap: 4 });
        y += 50;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateEstimatePDF
};
