// Professional PDF Export using jsPDF - Direct Download, No Print Dialog
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { XLAND_LOGO_ICON } from './logoIconBase64.js';

// Debug logger - only logs in development
const isDev = import.meta.env.DEV;
const debug = (...args) => isDev && console.log(...args);

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

    // ===== HEADER with Dark Background =====
    const headerHeight = 24;
    doc.setFillColor(20, 20, 20); // Near black
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
    
    // Logo Icon (symbol only - left side)
    const logoSize = 18;
    try {
      doc.addImage(XLAND_LOGO_ICON, 'PNG', margin, 3, logoSize, logoSize);
    } catch (e) {
      // Fallback to gold square
      doc.setFillColor(...gold);
      doc.roundedRect(margin, 4, 16, 16, 2, 2, 'F');
    }
    
    // Company Name text beside logo (vertically centered with logo)
    const textX = margin + logoSize + 4;
    doc.setTextColor(...gold);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('XLAND INFRA', textX, 12);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('— PVT LTD —', textX, 17);

    // Document Badge (right side)
    const docType = type === 'estimate' ? 'ESTIMATE' : 'PACKAGE';
    const badgeWidth = 28;
    const badgeHeight = 10;
    const badgeX = pageWidth - margin - badgeWidth;
    const badgeY = 7;
    doc.setFillColor(...gold);
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(docType, badgeX + badgeWidth/2, badgeY + badgeHeight/2 + 1, { align: 'center' });

    y = headerHeight + 8;

    // ===== DOCUMENT INFO ROW =====
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...navy);
    doc.text('ID:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    const estId = String(data.estimateId || data.packageId || 'N/A');
    doc.text(estId.length > 25 ? estId.substring(0, 25) + '...' : estId, margin + 8, y);
    
    // Status badge (for estimates)
    if (type === 'estimate' && data.status) {
      const status = String(data.status).toLowerCase();
      const statusColors = {
        'draft': [107, 114, 128],     // gray
        'sent': [59, 130, 246],       // blue
        'approved': [34, 197, 94],    // green
        'rejected': [239, 68, 68],    // red
        'expired': [249, 115, 22]     // orange
      };
      const statusColor = statusColors[status] || [107, 114, 128];
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);
      
      const statusX = pageWidth / 2 - 10;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...mediumText);
      doc.text('Status:', statusX, y);
      doc.setFillColor(...statusColor);
      doc.roundedRect(statusX + 12, y - 3, 18, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.text(statusText, statusX + 12 + 9, y, { align: 'center' });
      doc.setFontSize(8);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...navy);
    doc.text('Date:', pageWidth - margin - 38, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    doc.text(formatDate(data.createdAt), pageWidth - margin - 25, y);
    y += 8;

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
      const propName = String(data.propertyName || data.communityName || '-');
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
      const custName = String(data.customerName || '-');
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

    // ===== SERVICES TABLE =====
    doc.setTextColor(...navy);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES INCLUDED', margin, y);
    y += 6;

    const services = data.services || data.packageServices || [];
    const tableBody = services.length > 0 
      ? services.map((s, idx) => {
          const freqCount = s.frequencyCount || s.frequency_count || s.frequency || 1;
          let freqType = String(s.frequencyType || s.frequency_type || 'Monthly');
          // Remove "Nx " prefix if present
          freqType = freqType.replace(/^\d+x\s*/i, '');
          return [
            String(idx + 1),
            String(s.name || s.service || 'Service'),
            String(s.description || '-'),
            String(freqType),
            String(freqCount)
          ];
        })
      : [['1', 'No services listed', '-', '-', '-']];

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

    // ===== ADD-ONS TABLE =====
    if (data.addons && data.addons.length > 0) {
      doc.setTextColor(...navy);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ADD-ONS', margin, y);
      y += 6;

      const addonsBody = data.addons.map((a, idx) => {
        const freqCount = a.frequencyCount || a.frequency_count || a.visits || 1;
        let freqType = String(a.frequencyType || a.frequency_type || a.frequency || 'Monthly');
        // Remove "Nx " prefix if present
        freqType = freqType.replace(/^\d+x\s*/i, '');
        return [
          String(idx + 1),
          String(a.name || a.serviceName || a.service_name || 'Add-on'),
          String(a.description || '-'),
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
      const noteLines = doc.splitTextToSize(String(data.description), pageWidth - margin * 2 - 8);
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
            frequencyCount: s.frequencyCount || s.frequency_count || s.frequency || s.visits || 1,
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
        frequencyCount: s.frequencyCount || s.frequency || s.visits || 1,
        frequencyType: s.frequencyType || 'Monthly',
        description: s.description || ''
      }));
    }
    // PRIORITY 2: Check serviceRows (package service rows from form)
    else if (estimate.serviceRows && Array.isArray(estimate.serviceRows) && estimate.serviceRows.length > 0) {
      services = estimate.serviceRows.filter(sr => sr.service || sr.name).map(sr => ({
        name: sr.service || sr.name || 'Service',
        frequencyCount: sr.frequencyCount || sr.frequency || 1,
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
            frequencyCount: inner.frequencyCount || inner.frequency || 1,
            frequencyType: inner.frequencyType || 'Monthly'
          }));
        }
        // Handle addon/service structure
        return {
          name: s.name || s.service || s.serviceName || s.description || 'Service',
          frequencyCount: s.frequencyCount || s.frequency || s.visits || 1,
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
        frequencyCount: a.frequencyCount || a.frequency_count || a.visits || a.noOfVisits || a.no_of_visits || a.services?.[0]?.frequency || a.services?.[0]?.frequencyCount || 1,
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
            frequencyCount: a.frequencyCount || a.frequency_count || a.visits || a.noOfVisits || a.no_of_visits || a.services?.[0]?.frequency || a.services?.[0]?.frequencyCount || 1,
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
        frequencyCount: a.frequencyCount || a.frequency_count || a.visits || a.noOfVisits || a.no_of_visits || a.services?.[0]?.frequency || a.services?.[0]?.frequencyCount || 1,
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
      createdAt: estimate.createdAt || estimate.created_at || new Date().toISOString()
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
        frequencyCount: sr.frequencyCount || sr.frequency || 1,
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
            frequencyCount: sr.frequencyCount || sr.frequency || 1,
            frequencyType: sr.frequencyType || 'Monthly',
            price: parseFloat(sr.price || sr.rate || 0)
          }));
        } else if (Array.isArray(parsed)) {
          services = parsed.map(s => ({
            name: s.name || s.service || s.serviceType || 'Service',
            description: s.description || '',
            frequencyCount: s.frequencyCount || s.frequency || 1,
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
        frequencyCount: s.frequencyCount || s.frequency || 1,
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

export default { exportEstimateToPDF, exportPackageToPDF };
