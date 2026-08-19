// Professional PDF Export using jsPDF - Direct Download, No Print Dialog
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { XLAND_LOGO_ICON } from './logoIconBase64.js';

// Debug logger - only logs in development
const isDev = import.meta.env.DEV;
const debug = (...args) => isDev && console.log(...args);

// Decode HTML entities (e.g., &amp; -> &, &#x2F; -> /)
// Runs multiple times to handle multiple levels of encoding (e.g., &amp;amp;amp; -> &)
const decodeHtml = (html) => {
  if (!html || typeof html !== 'string') return html || '';
  
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

const GST_RATE = 0.18;

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
  return 'Rs. ' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

// Generate Premium PDF with professional design
const generatePDF = (data, type, filename) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 12;

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

    // ===== HEADER - Black with elegant flowing gold wave (Image 1 style) =====
    const headerHeight = 48;
    
    // Black header background
    doc.setFillColor(26, 26, 26); // #1a1a1a
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    // Draw elegant flowing gold wave at bottom of header
    doc.setFillColor(184, 134, 11); // Dark gold #b8860b
    // Create wave effect using bezier curves
    const waveY = headerHeight - 6;
    doc.setDrawColor(201, 162, 39); // Gold
    doc.setLineWidth(4);
    
    // Draw flowing wave pattern
    for (let x = 0; x < pageWidth; x += 40) {
      doc.setFillColor(201, 162, 39);
      // Simple wave approximation using small arcs
    }
    
    // Gold wave band at bottom
    doc.setFillColor(201, 162, 39); // #c9a227
    doc.rect(0, headerHeight - 8, pageWidth, 8, 'F');
    
    // Add subtle curve overlay for wave effect
    doc.setFillColor(26, 26, 26); // Black overlay for wave
    doc.ellipse(pageWidth * 0.25, headerHeight - 4, 50, 6, 'F');
    doc.ellipse(pageWidth * 0.75, headerHeight - 4, 50, 6, 'F');
    
    // Logo on left
    const logoSize = 30;
    try {
      doc.addImage(XLAND_LOGO_ICON, 'PNG', margin, 8, logoSize, logoSize);
    } catch (e) {
      doc.setFillColor(...gold);
      doc.roundedRect(margin, 8, 30, 30, 3, 3, 'F');
    }
    
    // Company name - "XLAND INFRA" in gold
    const textX = margin + logoSize + 8;
    doc.setTextColor(...gold);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('XLAND INFRA', textX, 22);
    
    // "PVT LTD" with decorative lines on both sides
    const pvtLtdY = 32;
    const pvtLtdText = 'PVT LTD';
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const pvtLtdWidth = doc.getTextWidth(pvtLtdText);
    const lineLength = 18;
    const lineGap = 4;
    
    // Left decorative line
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(textX, pvtLtdY - 2, textX + lineLength, pvtLtdY - 2);
    
    // PVT LTD text
    doc.setTextColor(...gold);
    doc.text(pvtLtdText, textX + lineLength + lineGap, pvtLtdY);
    
    // Right decorative line
    doc.line(textX + lineLength + lineGap + pvtLtdWidth + lineGap, pvtLtdY - 2, 
             textX + lineLength + lineGap + pvtLtdWidth + lineGap + lineLength, pvtLtdY - 2);

    y = headerHeight + 8;

    // ===== DOCUMENT INFO ROW - Gray background =====
    doc.setFillColor(248, 250, 252); // gray-50
    doc.rect(0, y, pageWidth, 24, 'F');
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.line(0, y + 24, pageWidth, y + 24);
    
    const metaY = y + 8;
    const colWidth = (pageWidth - margin * 2) / 3;
    
    // Column 1: Estimate/Package ID
    const docType = type === 'estimate' ? 'ESTIMATE' : 'PACKAGE';
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(docType + ' NO.', margin, metaY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39); // gray-900
    const estId = String(data.estimateId || data.packageId || 'N/A');
    doc.text(estId.length > 20 ? estId.substring(0, 20) + '...' : estId, margin, metaY + 6);
    
    // Column 2: Date
    const col2X = margin + colWidth;
    doc.setFontSize(7);
    doc.setTextColor(107, 114, 128);
    doc.text('DATE', col2X, metaY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text(formatDate(data.createdAt), col2X, metaY + 6);
    
    // Column 3: Status Badge (for estimates)
    if (type === 'estimate' && data.status) {
      const col3X = margin + colWidth * 2;
      const status = String(data.status).toLowerCase();
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);
      const statusColors = {
        'draft': { bg: [229, 231, 235], text: [75, 85, 99] },      // gray
        'sent': { bg: [219, 234, 254], text: [29, 78, 216] },       // blue
        'approved': { bg: [220, 252, 231], text: [21, 128, 61] },   // green
        'rejected': { bg: [254, 226, 226], text: [185, 28, 28] },   // red
        'expired': { bg: [255, 237, 213], text: [194, 65, 12] }     // orange
      };
      const statusStyle = statusColors[status] || statusColors.draft;
      
      const badgeWidth = 35;
      const badgeHeight = 10;
      doc.setFillColor(...statusStyle.bg);
      doc.roundedRect(col3X, metaY - 2, badgeWidth, badgeHeight, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...statusStyle.text);
      doc.text(statusText.toUpperCase(), col3X + badgeWidth/2, metaY + 4, { align: 'center' });
    }
    
    y += 30;

    // ===== PACKAGE PRICE BAR =====
    if (data.packagePrice || data.package_price) {
      doc.setFillColor(...cardBgBlue);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 12, 2, 2, 'FD');
      
      doc.setTextColor(...navy);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Package Price: ' + formatCurrency(data.packagePrice || data.package_price), margin + 6, y + 8);
      
      doc.setTextColor(...slate);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const billingLabel = (data.billing_duration || data.billingDuration || 'yearly').charAt(0).toUpperCase() + (data.billing_duration || data.billingDuration || 'yearly').slice(1).replace('-', ' ') + ' Billing';
      doc.text(billingLabel, pageWidth - margin - 6, y + 8, { align: 'right' });
      y += 16;
    }

    // ===== SIDE-BY-SIDE CARDS: Property + Customer =====
    if (type !== 'package') {
      const gap = 6;
      const cardWidth = (pageWidth - margin * 2 - gap) / 2;
      
      // Determine card height based on property type - need extra rows for GC/Apartment
      const propType = String(data.propertyType || '').toUpperCase();
      const isGC = ['GC', 'GATED COMMUNITY', 'GATED_COMMUNITY'].includes(propType);
      const isApt = ['APT', 'APARTMENT'].includes(propType);
      const isVilla = ['VILLA', 'VL'].includes(propType);
      const isFlat = ['FLAT', 'FL'].includes(propType);
      const isPlot = ['PLOT', 'PL'].includes(propType);
      // APT has 4 rows (Name/Type, Zone, Tower/Block, Units) - needs more height than GC (3 rows)
      const cardHeight = isApt ? 56 : (isGC ? 46 : ((isVilla || isFlat || isPlot) ? 40 : 34));
      
      // Property Details Card - ensure same blue background as Customer Details
      doc.setFillColor(239, 246, 255); // cardBgBlue - explicit RGB
      doc.setDrawColor(229, 231, 235); // borderLight - explicit RGB
      doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'FD');
      
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Property Details', margin + 6, y + 6);
      
      let py = y + 12;
      doc.setFontSize(8);
      
      // Row 1: Property ID | Property Type
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Name', margin + 6, py);
      doc.text('Type', margin + cardWidth/2 + 6, py);
      py += 5;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      const propName = decodeHtml(String(data.propertyName || data.communityName || '-'));
      doc.text(propName.length > 16 ? propName.substring(0, 16) + '...' : propName, margin + 6, py);
      const typeLabel = isGC ? 'Gated Community' : isApt ? 'Apartment' : isVilla ? 'Villa' : isFlat ? 'Flat' : isPlot ? 'Plot' : String(data.propertyType || '-');
      doc.text(typeLabel, margin + cardWidth/2 + 6, py);
      py += 7;
      
      // Row 2: Zone | Division (Division only for property-based estimates)
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Zone', margin + 6, py);
      // Show Division label only for property-based estimates with division value
      const isPropertyBased = data.estimateType === 'property_based' || data.estimate_type === 'property_based' || data.propertyId || data.property_id;
      const hasDivision = isPropertyBased && (data.division || data.divisionName || data.division_name);
      if (hasDivision) {
        doc.text('Division', margin + cardWidth/2 + 6, py);
      }
      py += 5;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(String(data.zone || '-'), margin + 6, py);
      if (hasDivision) {
        doc.text(String(data.division || data.divisionName || data.division_name), margin + cardWidth/2 + 6, py);
      }
      
      // Property-type specific fields - use consistent x-coordinates (margin + 6 for left, margin + cardWidth/2 + 6 for right)
      const leftCol = margin + 6;
      const rightCol = margin + cardWidth/2 + 6;
      
      if (isGC) {
        py += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('No. of Blocks', leftCol, py);
        doc.text('Total Units', rightCol, py);
        py += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.numberOfBlocks || data.number_of_blocks || '-'), leftCol, py);
        doc.text(String(data.totalUnits || data.total_units || '-'), rightCol, py);
      } else if (isApt) {
        py += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('Tower/Building', leftCol, py);
        doc.text('Block No.', rightCol, py);
        py += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.towerName || data.tower_name || '-'), leftCol, py);
        doc.text(String(data.blockNumber || data.block_number || '-'), rightCol, py);
        py += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('No. of Units', leftCol, py);
        py += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.totalUnits || data.total_units || '-'), leftCol, py);
      } else if (isVilla) {
        py += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('Villa Number', leftCol, py);
        py += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.villaPlotNumber || data.villa_plot_number || data.villa_number || '-'), leftCol, py);
      } else if (isFlat) {
        py += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('Flat Number', leftCol, py);
        py += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.villaPlotNumber || data.villa_plot_number || data.flat_number || '-'), leftCol, py);
      } else if (isPlot) {
        py += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('Plot Number', leftCol, py);
        py += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.villaPlotNumber || data.villa_plot_number || data.plot_number || '-'), leftCol, py);
      }
      
      // Customer Details Card - same blue background as Property Details
      const cx = margin + cardWidth + gap;
      doc.setFillColor(239, 246, 255); // cardBgBlue - explicit RGB
      doc.setDrawColor(229, 231, 235); // borderLight - explicit RGB  
      doc.roundedRect(cx, y, cardWidth, cardHeight, 2, 2, 'FD');
      
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Details', cx + 6, y + 6);
      
      let cy = y + 12;
      doc.setFontSize(8);
      
      // Row 1: Name
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Name', cx + 6, cy);
      doc.text('Phone', cx + cardWidth/2 + 4, cy);
      cy += 5;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      const custName = decodeHtml(String(data.customerName || '-'));
      doc.text(custName.length > 14 ? custName.substring(0, 14) + '...' : custName, cx + 6, cy);
      doc.text(String(data.customerPhone || '-'), cx + cardWidth/2 + 4, cy);
      cy += 7;
      
      // Row 2: Email
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Email', cx + 6, cy);
      cy += 5;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      const email = String(data.customerEmail || '-');
      doc.text(email.length > 30 ? email.substring(0, 30) + '...' : email, cx + 6, cy);
      cy += 7;
      
      // Row 3: City (if available)
      if (data.city) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightText);
        doc.text('City', cx + 6, cy);
        cy += 5;
        doc.setTextColor(...darkText);
        doc.setFont('helvetica', 'bold');
        doc.text(String(data.city || '-'), cx + 6, cy);
      }
      
      y += cardHeight + 8;
    }

    // ===== WORK ORDER DETAILS (only for work order estimates) =====
    if (data.isWorkOrderEstimate && data.workOrderId) {
      // Use same blue card style as Property & Customer Details for consistency
      const woBoxHeight = 32; // Increased height for better spacing
      doc.setFillColor(239, 246, 255); // cardBgBlue - same as other cards
      doc.setDrawColor(229, 231, 235); // borderLight - same as other cards
      doc.roundedRect(margin, y, pageWidth - margin * 2, woBoxHeight, 2, 2, 'FD');
      
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Work Order Details', margin + 6, y + 6);
      
      let wy = y + 13;
      doc.setFontSize(8);
      
      // Row 1: Work Order ID & Category (using same layout as Property/Customer cards)
      const leftCol = margin + 6;
      const midCol = margin + 95;
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Work Order ID', leftCol, wy);
      doc.text('Category', midCol, wy);
      wy += 5;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(String(data.workOrderId || '-'), leftCol, wy);
      doc.text(String(data.workOrderCategory || '-'), midCol, wy);
      wy += 7;
      
      // Row 2: Subcategory & Priority
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Subcategory', leftCol, wy);
      doc.text('Priority', midCol, wy);
      wy += 5;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(String(data.workOrderSubcategory || '-'), leftCol, wy);
      doc.text(String(data.workOrderPriority || '-').toUpperCase(), midCol, wy);
      
      y += woBoxHeight + 10; // Add proper spacing after the box
    }

    // ===== AMC PACKAGE DESCRIPTION =====
    if (data.amcPackageDescription && data.amcPackageDescription.trim()) {
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('PACKAGE DESCRIPTION', margin, y);
      y += 4;
      
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...borderLight);
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

    // ===== SERVICES TABLE (Skip for Work Order Estimates) =====
    const isWorkOrder = data.isWorkOrderEstimate || data.estimate_type === 'work_order' || data.estimateType === 'work_order' || data.workOrderId;
    const services = data.services || data.packageServices || [];
    
    if (!isWorkOrder && services.length > 0) {
      doc.setTextColor(...navy);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICES INCLUDED', margin, y);
      y += 6;

      const tableBody = services.map((s, idx) => {
            const freqCount = s.frequencyCount ?? s.frequency_count ?? s.frequency ?? 1;
            let freqType = String(s.frequencyType || s.frequency_type || 'Monthly');
            // Remove "Nx " prefix if present
            freqType = freqType.replace(/^\d+x\s*/i, '');
            return [
              String(idx + 1),
              decodeHtml(String(s.name || s.service || 'Service')),
              decodeHtml(String(s.description || '-')),
              String(freqType),
              String(freqCount)
            ];
          });

      autoTable(doc, {
      startY: y,
      head: [['#', 'Service', 'Description', 'Frequency', 'Visits']],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5, lineColor: [50, 50, 50], lineWidth: 0.3, halign: 'center', overflow: 'linebreak', cellWidth: 'wrap' },
      headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, lineColor: [50, 50, 50], halign: 'center' },
      bodyStyles: { textColor: darkText, lineColor: [100, 100, 100], minCellHeight: 8 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 35, halign: 'left' },
        2: { cellWidth: 75, halign: 'left' },
        3: { cellWidth: 30, halign: 'center' },
        4: { cellWidth: 15, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      rowPageBreak: 'avoid'
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // ===== ADD-ONS TABLE (Skip for Work Order Estimates) =====
    if (!isWorkOrder && data.addons && data.addons.length > 0) {
      doc.setTextColor(...navy);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ADD-ONS', margin, y);
      y += 6;

      const addonsBody = data.addons.map((a, idx) => {
        const freqCount = a.frequencyCount ?? a.frequency_count ?? a.visits ?? 1;
        let freqType = String(a.frequencyType || a.frequency_type || a.frequency || 'Monthly');
        // Remove "Nx " prefix if present
        freqType = freqType.replace(/^\d+x\s*/i, '');
        return [
          String(idx + 1),
          decodeHtml(String(a.name || a.serviceName || a.service_name || 'Add-on')),
          decodeHtml(String(a.description || '-')),
          String(freqType),
          String(freqCount)
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['#', 'Add-on Service', 'Description', 'Frequency', 'Visits']],
        body: addonsBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2.5, lineColor: [50, 50, 50], lineWidth: 0.3, halign: 'center', overflow: 'linebreak', cellWidth: 'wrap' },
        headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, lineColor: [50, 50, 50], halign: 'center' },
        bodyStyles: { textColor: darkText, lineColor: [100, 100, 100], minCellHeight: 8 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 35, halign: 'left' },
          2: { cellWidth: 75, halign: 'left' },
          3: { cellWidth: 30, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' }
        },
        alternateRowStyles: { fillColor: [252, 252, 253] },
        rowPageBreak: 'avoid'
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // ===== PRICE SUMMARY BOX =====
    const subtotal = parseFloat(data.subtotal) || 0;
    
    // Get discount values - try explicit values first, then calculate
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
    
    // Calculate final total: (Subtotal - Discount) + GST
    const total = Math.round(afterDiscount + gstAmount);
    
    const priceBoxW = 85;
    const priceBoxX = pageWidth - margin - priceBoxW;
    const hasDiscount = discountAmount > 0;
    const priceBoxH = 14 + (hasDiscount ? 7 : 0) + 7 + 12;

    // Check for page break BEFORE drawing title (keep title and box together)
    if (y + priceBoxH + 30 > pageHeight) {
      doc.addPage();
      y = 20;
    }

    // Price Summary Title - right aligned above the box
    doc.setTextColor(...navy);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PRICE SUMMARY', priceBoxX, y);
    y += 6;

    // Price Summary Card
    doc.setFillColor(...cardBg);
    doc.setDrawColor(...borderLight);
    doc.roundedRect(priceBoxX, y, priceBoxW, priceBoxH, 2, 2, 'FD');
    
    let py = y + 6;
    
    // Subtotal row
    doc.setTextColor(...mediumText);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', priceBoxX + 6, py);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(subtotal), priceBoxX + priceBoxW - 6, py, { align: 'right' });
    py += 7;
    
    // Discount row (if applicable)
    if (hasDiscount) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mediumText);
      doc.text(`Discount (${discountPercent}%):`, priceBoxX + 6, py);
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text('-' + formatCurrency(discountAmount), priceBoxX + priceBoxW - 6, py, { align: 'right' });
      py += 7;
    }
    
    // GST row
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mediumText);
    doc.text(`GST (${gstPercent}%):`, priceBoxX + 6, py);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(gstAmount), priceBoxX + priceBoxW - 6, py, { align: 'right' });
    py += 8;
    
    // Total row with navy background
    doc.setFillColor(...navy);
    doc.roundedRect(priceBoxX + 3, py - 2, priceBoxW - 6, 11, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', priceBoxX + 8, py + 5);
    doc.setFontSize(10);
    doc.text(formatCurrency(total), priceBoxX + priceBoxW - 8, py + 5, { align: 'right' });

    y += priceBoxH + 10;

    // ===== NOTES/DESCRIPTION (After Price Summary) =====
    if (data.description && data.description.trim()) {
      if (y + 30 > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTES / DESCRIPTION', margin, y);
      y += 4;
      
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...borderLight);
      const noteLines = doc.splitTextToSize(decodeHtml(String(data.description)), pageWidth - margin * 2 - 8);
      const noteBoxH = Math.min(Math.max(12, noteLines.length * 4 + 6), 40);
      doc.roundedRect(margin, y, pageWidth - margin * 2, noteBoxH, 2, 2, 'FD');
      
      doc.setTextColor(...mediumText);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(noteLines.slice(0, 8), margin + 4, y + 5);
      y += noteBoxH + 6;
    }

    // ===== FOOTER =====
    const footerY = pageHeight - 12;
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    
    doc.setTextColor(...lightText);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('XLAND INFRA | This is a computer-generated document.', pageWidth / 2, footerY, { align: 'center' });

    savePDFCrossPlatform(doc, filename);
    return true;
  } catch (error) {
    console.error('[PDF] Error:', error);
    return false;
  }
};

// Export estimate to PDF
export const exportEstimateToPDF = (estimate) => {
  debug('[PDF] exportEstimateToPDF called for:', estimate?.estimateId || estimate?.estimate_id);

  try {
    if (!estimate) {
      console.error('[PDF] No estimate data provided');
      return false;
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
            description: s.description || ''
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
        description: s.description || ''
      }));
    }
    // PRIORITY 2: Check serviceRows (package service rows from form)
    else if (estimate.serviceRows && Array.isArray(estimate.serviceRows) && estimate.serviceRows.length > 0) {
      services = estimate.serviceRows.filter(sr => sr.service || sr.name).map(sr => ({
        name: sr.service || sr.name || 'Service',
        frequencyCount: sr.frequencyCount ?? sr.frequency ?? 1,
        frequencyType: sr.frequencyType || 'Monthly'
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
            frequencyType: inner.frequencyType || 'Monthly'
          }));
        }
        // Handle addon/service structure
        return {
          name: s.name || s.service || s.serviceName || s.description || 'Service',
          frequencyCount: s.frequencyCount ?? s.frequency ?? s.visits ?? 1,
          frequencyType: s.frequencyType || s.billingType || s.billing || 'Monthly'
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
    if (services.length === 0 && (estimate.total || estimate.totalPrice || estimate.subtotal)) {
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
    
    // Try addons array first
    if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
      addons = estimate.addons.map(a => ({
        name: a.name || a.serviceName || a.service_name || a.services?.[0]?.name || 'Add-on',
        frequencyType: a.frequencyType || a.frequency_type || a.services?.[0]?.frequencyType || 'One-time',
        frequencyCount: a.frequencyCount ?? a.frequency_count ?? a.visits ?? a.noOfVisits ?? a.no_of_visits ?? a.services?.[0]?.frequency ?? a.services?.[0]?.frequencyCount ?? 1,
        description: a.description || ''
      }));
    }
    // Try addons_data JSON string (from backend)
    if (addons.length === 0 && estimate.addons_data) {
      try {
        const parsed = typeof estimate.addons_data === 'string' ? JSON.parse(estimate.addons_data) : estimate.addons_data;
        if (Array.isArray(parsed) && parsed.length > 0) {
          addons = parsed.map(a => ({
            name: a.name || a.serviceName || a.service_name || a.services?.[0]?.name || 'Add-on',
            frequencyType: a.frequencyType || a.frequency_type || a.services?.[0]?.frequencyType || 'One-time',
            frequencyCount: a.frequencyCount ?? a.frequency_count ?? a.visits ?? a.noOfVisits ?? a.no_of_visits ?? a.services?.[0]?.frequency ?? a.services?.[0]?.frequencyCount ?? 1,
            description: a.description || ''
          }));
        }
      } catch (e) { debug('[PDF] addons_data parse error:', e); }
    }
    // Try selectedAddons array (from form)
    if (addons.length === 0 && estimate.selectedAddons && Array.isArray(estimate.selectedAddons) && estimate.selectedAddons.length > 0) {
      addons = estimate.selectedAddons.map(a => ({
        name: a.name || a.serviceName || a.service_name || a.services?.[0]?.name || 'Add-on',
        frequencyType: a.frequencyType || a.frequency_type || a.services?.[0]?.frequencyType || 'One-time',
        frequencyCount: a.frequencyCount ?? a.frequency_count ?? a.visits ?? a.noOfVisits ?? a.no_of_visits ?? a.services?.[0]?.frequency ?? a.services?.[0]?.frequencyCount ?? 1,
        description: a.description || ''
      }));
    }
    
    debug('[PDF] Parsed addons:', addons);

    const exportData = {
      estimateId: estimate.estimateId || estimate.estimate_id || estimate.id || 'EST-' + Date.now(),
      estimateType: estimate.estimateType || estimate.estimate_type || (estimate.propertyId || estimate.property_id ? 'property-based' : 'direct'),
      packageName: estimate.packageName || estimate.package_name,
      amcPackageDescription: estimate.amc_package_description || estimate.amcPackageDescription || '',
      propertyId: estimate.propertyId || estimate.property_id,
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
      billingDuration: estimate.billingDuration || estimate.billing_duration || 'Yearly',
      subtotal: parseFloat(estimate.subtotal || estimate.subTotal || estimate.sub_total || 0),
      discountPercent: parseFloat(estimate.discountPercent || estimate.discount_percent || estimate.discount || 0),
      discountAmount: parseFloat(estimate.discountAmount || estimate.discount_amount || 0),
      gstPercent: parseFloat(estimate.gstPercent || estimate.gst_percent || estimate.gst || 0),
      gstAmount: parseFloat(estimate.gstAmount || estimate.gst_amount || 0),
      totalPrice: parseFloat(estimate.totalPrice || estimate.total || estimate.total_price || estimate.total_amount || 0),
      createdAt: estimate.createdAt || estimate.created_at || new Date().toISOString(),
      // Work Order Estimate fields
      isWorkOrderEstimate: estimate.estimate_type === 'work_order' || estimate.estimateType === 'work_order',
      workOrderId: estimate.work_order_id || estimate.workOrderId,
      workOrderCategory: estimate.work_order_category || estimate.workOrderCategory,
      workOrderSubcategory: estimate.work_order_subcategory || estimate.workOrderSubcategory,
      workOrderDescription: estimate.work_order_description || estimate.workOrderDescription,
      workOrderPriority: estimate.work_order_priority || estimate.workOrderPriority,
      workOrderStatus: estimate.work_order_status || estimate.workOrderStatus
    };

    debug('[PDF] Generating PDF for:', exportData.estimateId);
    const result = generatePDF(exportData, 'estimate', `Estimate-${exportData.estimateId}.pdf`);
    debug('[PDF] generatePDF result:', result);
    return result;
  } catch (error) {
    console.error('PDF Export Error:', error);
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

    const exportData = {
      packageId: pkg.packageId || pkg.id || 'PKG-' + Date.now(),
      estimateId: pkg.packageId || pkg.id || 'PKG-' + Date.now(),
      packageName: pkg.packageName || pkg.name || 'AMC Package',
      propertyType: pkg.propertyType || 'General',
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
      createdAt: pkg.createdAt || new Date().toISOString()
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
    const margin = 15;
    let y = 0;

    // Colors per design spec
    const headerBlack = [21, 21, 21];     // #151515
    const gold = [211, 154, 26];          // #D39A1A
    const darkGold = [183, 122, 0];       // #B77A00
    const lightGold = [232, 198, 106];    // #E8C66A
    const totalGold = [197, 138, 10];     // #C58A0A
    const primaryText = [23, 23, 23];     // #171717
    const secondaryText = [85, 85, 85];   // #555555
    const borderGray = [229, 229, 229];   // #E5E5E5
    const cardBg = [251, 247, 238];       // #FBF7EE
    const white = [255, 255, 255];

    // ===== HEADER - Black #151515 with gold wave =====
    const headerHeight = 55;
    
    // Black header background
    doc.setFillColor(...headerBlack);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    // Gold wave at bottom of header
    doc.setFillColor(...gold);
    doc.rect(0, headerHeight - 12, pageWidth, 12, 'F');
    
    // Create wave effect with overlapping black curves
    doc.setFillColor(...headerBlack);
    doc.ellipse(pageWidth * 0.15, headerHeight - 8, 50, 10, 'F');
    doc.ellipse(pageWidth * 0.5, headerHeight - 6, 60, 12, 'F');
    doc.ellipse(pageWidth * 0.85, headerHeight - 8, 50, 10, 'F');
    
    // Light gold highlight layer
    doc.setFillColor(...lightGold);
    doc.ellipse(pageWidth * 0.15, headerHeight - 4, 40, 5, 'F');
    doc.ellipse(pageWidth * 0.5, headerHeight - 3, 45, 6, 'F');
    doc.ellipse(pageWidth * 0.85, headerHeight - 4, 40, 5, 'F');
    
    // Logo
    const logoSize = 30;
    try {
      doc.addImage(XLAND_LOGO_ICON, 'PNG', margin + 5, 10, logoSize, logoSize);
    } catch (e) {
      doc.setFillColor(...gold);
      doc.roundedRect(margin + 5, 10, logoSize, logoSize, 3, 3, 'F');
    }
    
    // Company name
    const textX = margin + logoSize + 15;
    doc.setTextColor(...gold);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('XLAND INFRA', textX, 22);
    
    // PVT LTD with decorative lines
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const pvtLtdY = 32;
    const pvtText = 'PVT LTD';
    const pvtWidth = doc.getTextWidth(pvtText);
    const lineLen = 20;
    const lineGap = 4;
    
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(textX, pvtLtdY, textX + lineLen, pvtLtdY);
    doc.text(pvtText, textX + lineLen + lineGap, pvtLtdY + 1);
    doc.line(textX + lineLen + lineGap + pvtWidth + lineGap, pvtLtdY, textX + lineLen + lineGap + pvtWidth + lineGap + lineLen, pvtLtdY);

    y = headerHeight + 10;

    // ===== ID / DATE / DUE ROW =====
    doc.setFontSize(9);
    doc.setTextColor(...secondaryText);
    doc.text('ID:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryText);
    doc.text(String(invoice.invoiceId || 'N/A'), margin + 10, y);
    
    if (invoice.sourceEstimateId) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...secondaryText);
      doc.text('Estimate: ' + invoice.sourceEstimateId, margin, y + 7);
    }
    
    // Date and Due on right
    const rightCol = pageWidth - margin - 55;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('Date:', rightCol, y - 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryText);
    doc.text(formatDate(invoice.invoiceDate), rightCol + 18, y - 4);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('Due:', rightCol, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryText);
    doc.text(formatDate(invoice.dueDate), rightCol + 18, y + 5);
    
    y += 20;

    // ===== TOTAL AMOUNT DUE BANNER - #D39A1A rounded =====
    const bannerHeight = 32;
    doc.setFillColor(...gold);
    doc.roundedRect(margin, y, pageWidth - margin * 2, bannerHeight, 5, 5, 'F');
    
    doc.setTextColor(...white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('TOTAL AMOUNT DUE', pageWidth / 2, y + 10, { align: 'center' });
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Rs. ' + Math.round(invoice.totalAmount || 0).toLocaleString('en-IN'), pageWidth / 2, y + 24, { align: 'center' });
    
    y += bannerHeight + 12;

    // ===== PROPERTY & CUSTOMER DETAILS - Cream bg, filled gold icons (Image 2) =====
    const cardGap = 8;
    const cardWidth = (pageWidth - margin * 2 - cardGap) / 2;
    const cardHeight = 58;
    
    // Property Details Card - cream background
    doc.setFillColor(...cardBg);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 4, 4, 'F');
    
    // Property icon - FILLED gold square with white icon
    doc.setFillColor(...gold);
    doc.roundedRect(margin + 10, y + 8, 14, 14, 2, 2, 'F');
    // Building icon inside (white)
    doc.setFillColor(...white);
    doc.rect(margin + 13, y + 12, 2, 7, 'F');
    doc.rect(margin + 16, y + 14, 2, 5, 'F');
    doc.rect(margin + 19, y + 12, 2, 7, 'F');
    
    doc.setTextColor(...primaryText);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY DETAILS', margin + 28, y + 17);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let py = y + 28;
    doc.setTextColor(...secondaryText);
    doc.text('Property ID: ' + String(invoice.propertyCode || '-'), margin + 10, py);
    py += 6;
    doc.text('Name: ' + String(invoice.propertyName || '-').substring(0, 22), margin + 10, py);
    py += 6;
    doc.text('Type: ' + String(invoice.propertyType || '-'), margin + 10, py);
    py += 6;
    doc.text('Zone: ' + String(invoice.zone || '-'), margin + 10, py);
    py += 6;
    doc.text('City: ' + String(invoice.city || '-'), margin + 10, py);
    
    // Customer Details Card - cream background
    const custCardX = margin + cardWidth + cardGap;
    doc.setFillColor(...cardBg);
    doc.roundedRect(custCardX, y, cardWidth, cardHeight, 4, 4, 'F');
    
    // Customer icon - FILLED gold square with white icon
    doc.setFillColor(...gold);
    doc.roundedRect(custCardX + 10, y + 8, 14, 14, 2, 2, 'F');
    // Person icon inside (white)
    doc.setFillColor(...white);
    doc.circle(custCardX + 17, y + 13, 3, 'F');
    doc.roundedRect(custCardX + 12, y + 17, 10, 3, 1, 1, 'F');
    
    doc.setTextColor(...primaryText);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER DETAILS', custCardX + 28, y + 17);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cy = y + 28;
    doc.setTextColor(...secondaryText);
    doc.text('Name: ' + String(invoice.customerName || '-'), custCardX + 10, cy);
    cy += 6;
    doc.text('Phone: ' + String(invoice.customerPhone || '-'), custCardX + 10, cy);
    cy += 6;
    const email = String(invoice.customerEmail || '-');
    doc.text('Email: ' + (email.length > 22 ? email.substring(0, 22) + '...' : email), custCardX + 10, cy);
    cy += 6;
    doc.text('City: ' + String(invoice.city || '-'), custCardX + 10, cy);
    
    y += cardHeight + 12;

    // ===== SERVICES INCLUDED - Gold themed table =====
    // Parse services
    const allItems = lineItems.filter(item => {
      const desc = String(item.description || item.name || '').toLowerCase();
      return !desc.includes('amc package:') && !desc.includes('amc services');
    });

    const isAddon = (item) => {
      const typeStr = String(item.type || '').toLowerCase();
      return typeStr === 'addon' || typeStr === 'add-on' || typeStr === 'add_on';
    };

    const services = allItems.filter(item => !isAddon(item)).map(item => {
      const itemName = decodeHtml(item.name || '');
      const itemDetails = decodeHtml(item.details || '');
      const fullDesc = decodeHtml(String(item.description || item.name || 'Service'));
      const parts = fullDesc.split(' - ');
      return {
        name: itemName || parts[0] || 'Service',
        description: itemDetails || parts.slice(1).join(' - ') || '-',
        frequency: item.frequency || item.frequencyType || item.frequency_type || '-',
        visits: item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1
      };
    });

    const isWorkOrderInvoice = invoice.invoiceType === 'work_order' || invoice.invoice_type === 'work_order';

    if (!isWorkOrderInvoice && services.length > 0) {
      // Section header
      doc.setTextColor(...primaryText);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICES INCLUDED', margin, y + 5);
      
      // Decorative gold line after text
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.5);
      doc.line(margin + 42, y + 3, pageWidth - margin, y + 3);
      
      y += 12;

      // Services table with gold header
      autoTable(doc, {
        startY: y,
        head: [['#', 'Service', 'Description', 'Frequency', 'Visits']],
        body: services.map((item, idx) => [
          String(idx + 1),
          decodeHtml(String(item.name)).substring(0, 30),
          decodeHtml(String(item.description)).substring(0, 50) || '-',
          String(item.frequency).charAt(0).toUpperCase() + String(item.frequency).slice(1).toLowerCase(),
          String(item.visits)
        ]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 5, valign: 'middle' },
        headStyles: { fillColor: gold, textColor: white, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { textColor: primaryText },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: { 
          0: { cellWidth: 14, halign: 'center' }, 
          1: { cellWidth: 40 }, 
          2: { cellWidth: 'auto' }, 
          3: { cellWidth: 32, halign: 'center' }, 
          4: { cellWidth: 20, halign: 'center' } 
        },
        margin: { left: margin, right: margin },
        tableLineColor: borderGray,
        tableLineWidth: 0.1
      });
      y = doc.lastAutoTable.finalY + 15;
    }

    // ===== PRICE SUMMARY - Right aligned =====
    const summaryWidth = 110;
    const summaryX = pageWidth - margin - summaryWidth;
    
    // Section header
    doc.setTextColor(...primaryText);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRICE SUMMARY', summaryX, y + 4);
    
    // Decorative gold line after text
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(summaryX + 36, y + 2, pageWidth - margin, y + 2);
    
    y += 10;

    // Price summary box
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    doc.roundedRect(summaryX, y, summaryWidth, 45, 4, 4, 'S');
    
    let sy = y + 12;
    const labelX = summaryX + 10;
    const valueX = summaryX + summaryWidth - 10;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('Subtotal:', labelX, sy);
    doc.setTextColor(...primaryText);
    doc.text('Rs. ' + Math.round(invoice.subtotal || 0).toLocaleString('en-IN'), valueX, sy, { align: 'right' });
    sy += 9;
    
    doc.setTextColor(...secondaryText);
    doc.text('GST (' + (invoice.taxPercentage || 18).toFixed(2) + '%):', labelX, sy);
    doc.setTextColor(...primaryText);
    doc.text('Rs. ' + Math.round(invoice.taxAmount || 0).toLocaleString('en-IN'), valueX, sy, { align: 'right' });
    sy += 11;
    
    // Total line
    doc.setDrawColor(...borderGray);
    doc.line(summaryX + 8, sy - 4, summaryX + summaryWidth - 8, sy - 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...gold);
    doc.text('Total:', labelX, sy + 2);
    doc.text('Rs. ' + Math.round(invoice.totalAmount || 0).toLocaleString('en-IN'), valueX, sy + 2, { align: 'right' });
    
    y += 55;

    // ===== FOOTER - Gray separator and message (Image 2) =====
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    
    y += 8;
    
    // Heart icon placeholder
    doc.setDrawColor(...borderGray);
    doc.circle(margin + 8, y + 2, 4, 'S');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...secondaryText);
    doc.text('We appreciate your trust in our services.', margin + 18, y + 3);

    // Save
    savePDFCrossPlatform(doc, `Invoice-${invoice.invoiceId || 'INV'}.pdf`);
    return true;

  } catch (error) {
    console.error('[PDF] Invoice export error:', error);
    return false;
  }
};

export default { exportEstimateToPDF, exportPackageToPDF, exportInvoiceToPDF };
