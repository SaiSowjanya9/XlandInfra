const PDFDocument = require('pdfkit');

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

      // Colors
      const navy = '#1e3a5f';
      const gold = '#d4a84b';
      const lightGray = '#f8f9fa';

      // Header
      doc.rect(0, 0, 612, 70).fill(navy);
      doc.fontSize(22).fillColor('#ffffff').text('XLAND INFRA', 50, 25);
      doc.fontSize(10).fillColor('#cccccc').text('Pvt. Ltd.', 50, 50);
      
      // ESTIMATE badge
      doc.rect(470, 20, 80, 30).fill(gold);
      doc.fontSize(12).fillColor(navy).text('ESTIMATE', 480, 32);

      let y = 90;

      // Estimate Info
      doc.fontSize(9).fillColor('#666666');
      doc.text(`ID: ${estimateId || 'N/A'}`, 50, y);
      doc.text(`Date: ${createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 400, y);
      y += 25;

      // Package Name Bar
      if (packageName) {
        doc.rect(50, y, 500, 25).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(12).fillColor(navy).text(packageName, 60, y + 7);
        doc.fontSize(9).fillColor('#888888').text('Yearly Billing', 450, y + 8);
        y += 35;
        
        // Package Price
        if (packagePrice) {
          doc.fontSize(10).fillColor(navy).text(`Package Price: Rs. ${Number(packagePrice).toLocaleString()}`, 50, y);
          y += 20;
        }
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
      
      // Table header
      doc.rect(50, y, 500, 20).fill('#475569');
      doc.fontSize(8).fillColor('#ffffff');
      doc.text('#', 55, y + 6);
      doc.text('Service Description', 80, y + 6);
      doc.text('Frequency', 380, y + 6);
      doc.text('Visits', 480, y + 6);
      y += 20;

      // Services rows
      const svcList = services || [];
      svcList.forEach((s, idx) => {
        const rowColor = idx % 2 === 0 ? '#ffffff' : '#f8f9fa';
        doc.rect(50, y, 500, 18).fill(rowColor).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#333333');
        doc.text(String(idx + 1), 55, y + 5);
        const svcName = s.name || s.service || 'Service';
        const svcDesc = s.description ? `${svcName} - ${s.description}` : svcName;
        doc.text(svcDesc.substring(0, 55), 80, y + 5);
        const freqCount = s.frequencyCount || s.frequency_count || 1;
        let freqType = s.frequencyType || s.frequency_type || 'Monthly';
        // Remove "Nx " prefix if present (e.g., "12x Monthly" -> "Monthly")
        freqType = freqType.replace(/^\d+x\s*/i, '');
        doc.text(freqType, 380, y + 5);
        doc.text(String(freqCount), 485, y + 5);
        y += 18;
      });

      y += 10;

      // Add-ons Table (if any)
      const addonList = addons || [];
      if (addonList.length > 0) {
        doc.fontSize(10).fillColor(navy).text('ADD-ONS', 50, y);
        y += 15;
        
        doc.rect(50, y, 500, 20).fill('#475569');
        doc.fontSize(8).fillColor('#ffffff');
        doc.text('#', 55, y + 6);
        doc.text('Add-on Service', 80, y + 6);
        doc.text('Frequency', 380, y + 6);
        doc.text('Visits', 480, y + 6);
        y += 20;

        addonList.forEach((a, idx) => {
          const rowColor = idx % 2 === 0 ? '#ffffff' : '#f0fdf4';
          doc.rect(50, y, 500, 18).fill(rowColor).stroke('#e0e0e0');
          doc.fontSize(8).fillColor('#333333');
          doc.text(String(idx + 1), 55, y + 5);
          const addonName = a.name || a.service_name || 'Add-on';
          const addonDesc = a.description ? `${addonName} - ${a.description}` : addonName;
          doc.text(addonDesc.substring(0, 55), 80, y + 5);
          const freqCount = a.frequency_count || a.frequencyCount || 1;
          let freqType = a.frequency_type || a.frequencyType || 'Monthly';
          // Remove "Nx " prefix if present (e.g., "12x Monthly" -> "Monthly")
          freqType = freqType.replace(/^\d+x\s*/i, '');
          doc.text(freqType, 380, y + 5);
          doc.text(String(freqCount), 485, y + 5);
          y += 18;
        });

        y += 10;
      }

      // Price Summary
      doc.fontSize(10).fillColor(navy).text('PRICE SUMMARY', 50, y);
      y += 15;
      doc.rect(50, y, 500, 80).fill(lightGray).stroke('#e0e0e0');
      
      doc.fontSize(9).fillColor('#666666');
      doc.text('Subtotal:', 60, y + 10);
      doc.fillColor('#333333').text(`Rs. ${Number(subtotal || 0).toLocaleString()}`, 450, y + 10);
      
      if (discount > 0 || discountAmount > 0) {
        doc.fillColor('#22c55e').text(`Discount (${discount || 0}%):`, 60, y + 25);
        doc.text(`-Rs. ${Number(discountAmount || 0).toLocaleString()}`, 450, y + 25);
      }
      
      doc.fillColor('#666666').text(`GST (${gstPercent || 18}%):`, 60, y + 40);
      doc.fillColor('#333333').text(`Rs. ${Number(tax || 0).toLocaleString()}`, 450, y + 40);
      
      // Total line
      doc.rect(60, y + 55, 480, 1).fill('#e0e0e0');
      doc.fontSize(12).fillColor(navy).text('TOTAL:', 60, y + 62);
      doc.fontSize(14).fillColor('#4f46e5').text(`Rs. ${Number(total || 0).toLocaleString()}`, 420, y + 60);
      y += 90;

      // Notes/Description (after Price Summary)
      if (description) {
        doc.fontSize(10).fillColor(navy).text('NOTES / DESCRIPTION', 50, y);
        y += 15;
        doc.rect(50, y, 500, 30).fill(lightGray).stroke('#e0e0e0');
        doc.fontSize(8).fillColor('#444444').text(description, 60, y + 8, { width: 480 });
        y += 40;
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
