// Professional PDF Export using jsPDF - Direct Download, No Print Dialog
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const GST_RATE = 0.18;
let isExporting = false;

// Format currency with proper Indian formatting - prevents character spacing issues
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  // Manual Indian number formatting to avoid Unicode spacing issues
  const formatted = num.toFixed(0);
  let result = '';
  const len = formatted.length;
  let count = 0;
  
  for (let i = len - 1; i >= 0; i--) {
    count++;
    result = formatted[i] + result;
    if (i > 0) {
      if (count === 3 && len > 3) {
        result = ',' + result;
      } else if (count > 3 && (count - 3) % 2 === 0) {
        result = ',' + result;
      }
    }
  }
  return 'Rs. ' + result;
};

// Format currency for display (shorter version)
const formatCurrencyShort = (amount) => {
  const num = parseFloat(amount) || 0;
  if (num >= 100000) {
    return 'Rs. ' + (num / 100000).toFixed(2) + 'L';
  }
  return formatCurrency(num);
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Generate Premium PDF with professional design
const generatePDF = (data, type, filename) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 15;

    // Colors
    const navy = [15, 40, 70];
    const gold = [180, 140, 60];
    const darkText = [30, 30, 30];
    const grayText = [100, 100, 100];
    const lightBg = [245, 247, 250];

    // ===== HEADER BANNER =====
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Gold accent line
    doc.setFillColor(...gold);
    doc.rect(0, 45, pageWidth, 2, 'F');

    // Logo circle
    doc.setFillColor(255, 255, 255);
    doc.circle(margin + 12, 22, 12, 'F');
    doc.setFillColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...navy);
    doc.text('XI', margin + 12, 26, { align: 'center' });

    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('XlandInfra', margin + 30, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('PROPERTY MANAGEMENT SOLUTIONS', margin + 30, 28);

    // Document type badge
    doc.setFillColor(...gold);
    doc.roundedRect(pageWidth - margin - 55, 12, 55, 22, 3, 3, 'F');
    doc.setTextColor(...navy);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(type === 'estimate' ? 'AMC ESTIMATE' : 'AMC PACKAGE', pageWidth - margin - 27.5, 21, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(data.estimateId || data.packageId || 'N/A', pageWidth - margin - 27.5, 29, { align: 'center' });

    y = 55;

    // Document date
    doc.setTextColor(...grayText);
    doc.setFontSize(9);
    doc.text(`Date: ${formatDate(data.createdAt)}`, pageWidth - margin, y, { align: 'right' });
    y += 12;

    // ===== PACKAGE NAME BANNER =====
    if (data.packageName) {
      doc.setFillColor(...lightBg);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, 'F');
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 3, 3, 'S');
      
      // Gold bar on left
      doc.setFillColor(...gold);
      doc.roundedRect(margin, y, 5, 18, 3, 0, 'F');
      doc.rect(margin + 3, y, 2, 18, 'F');
      
      doc.setTextColor(...navy);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(data.packageName, margin + 12, y + 12);
      
      doc.setTextColor(...grayText);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Billing: ${data.billingDuration || 'Yearly'}`, pageWidth - margin - 5, y + 12, { align: 'right' });
      y += 25;
    }

    // ===== INFO CARDS =====
    const cardWidth = (pageWidth - margin * 2 - 10) / 2;
    const cardHeight = 40;

    // Property Card
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, cardWidth, cardHeight, 4, 4, 'FD');
    
    // Card header
    doc.setFillColor(...navy);
    doc.roundedRect(margin, y, cardWidth, 10, 4, 4, 'F');
    doc.rect(margin, y + 6, cardWidth, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY DETAILS', margin + 8, y + 7);

    doc.setTextColor(...darkText);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let cardY = y + 18;
    if (data.propertyType) { 
      doc.setFont('helvetica', 'bold');
      doc.text('Type:', margin + 8, cardY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.propertyType, margin + 25, cardY);
      cardY += 7;
    }
    if (data.propertyName || data.communityName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', margin + 8, cardY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.propertyName || data.communityName, margin + 28, cardY);
      cardY += 7;
    }
    if (!data.propertyType && !data.propertyName && !data.communityName) {
      doc.setTextColor(...grayText);
      doc.text('No property details', margin + 8, y + 25);
    }

    // Customer Card
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + cardWidth + 10, y, cardWidth, cardHeight, 4, 4, 'FD');
    
    doc.setFillColor(...navy);
    doc.roundedRect(margin + cardWidth + 10, y, cardWidth, 10, 4, 4, 'F');
    doc.rect(margin + cardWidth + 10, y + 6, cardWidth, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER INFO', margin + cardWidth + 18, y + 7);

    doc.setTextColor(...darkText);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    cardY = y + 18;
    if (data.customerName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', margin + cardWidth + 18, cardY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.customerName, margin + cardWidth + 38, cardY);
      cardY += 7;
    }
    if (data.customerPhone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Phone:', margin + cardWidth + 18, cardY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.customerPhone, margin + cardWidth + 38, cardY);
      cardY += 7;
    }
    if (!data.customerName && !data.customerPhone) {
      doc.setTextColor(...grayText);
      doc.text('No customer details', margin + cardWidth + 18, y + 25);
    }

    y += cardHeight + 12;

    // ===== SERVICES TABLE =====
    doc.setTextColor(...navy);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES & ADD-ONS', margin, y);
    
    // Decorative line under title
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 2, margin + 45, y + 2);
    y += 6;

    // Calculate service prices from total if not provided
    const totalAmount = parseFloat(data.subtotal) || parseFloat(data.totalPrice) || 0;
    const serviceCount = (data.services || []).length || 1;
    const pricePerService = totalAmount / serviceCount;

    // Prepare table data with proper formatting
    const tableData = (data.services || []).map((s, idx) => [
      { content: String(idx + 1), styles: { halign: 'center', fontStyle: 'normal' } },
      { content: s.name || 'Service', styles: { fontStyle: 'bold' } },
      { content: String(s.frequencyCount || s.frequency || 1), styles: { halign: 'center' } },
      { content: s.frequencyType || 'Monthly', styles: { halign: 'center' } },
      { content: formatCurrency(s.price || pricePerService), styles: { halign: 'right', fontStyle: 'bold' } }
    ]);

    if (tableData.length === 0) {
      tableData.push([
        { content: '1', styles: { halign: 'center' } },
        { content: 'No services listed', styles: { fontStyle: 'normal' } },
        { content: '-', styles: { halign: 'center' } },
        { content: '-', styles: { halign: 'center' } },
        { content: '-', styles: { halign: 'right' } }
      ]);
    }

    // Table column widths (total should be pageWidth - margin*2)
    const tableWidth = pageWidth - margin * 2;
    const colWidths = {
      0: 12,  // S.No
      1: tableWidth - 12 - 18 - 28 - 38,  // Service (auto)
      2: 18,  // Qty
      3: 28,  // Frequency
      4: 38   // Amount
    };

    autoTable(doc, {
      startY: y,
      head: [['#', 'Service', 'Qty', 'Frequency', 'Amount']],
      body: tableData,
      margin: { left: margin, right: margin },
      tableWidth: tableWidth,
      styles: {
        fontSize: 9,
        cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: navy,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
        halign: 'left'
      },
      bodyStyles: {
        textColor: darkText,
        fillColor: [255, 255, 255]
      },
      columnStyles: {
        0: { cellWidth: colWidths[0], halign: 'center' },
        1: { cellWidth: colWidths[1], halign: 'left' },
        2: { cellWidth: colWidths[2], halign: 'center' },
        3: { cellWidth: colWidths[3], halign: 'center' },
        4: { cellWidth: colWidths[4], halign: 'right' }
      },
      alternateRowStyles: { 
        fillColor: [248, 250, 252] 
      },
      tableLineColor: [220, 220, 220],
      tableLineWidth: 0.2,
      theme: 'grid',
      showHead: 'firstPage',
      didParseCell: function(data) {
        // Header row styling
        if (data.section === 'head') {
          if (data.column.index === 0) data.cell.styles.halign = 'center';
          if (data.column.index === 2) data.cell.styles.halign = 'center';
          if (data.column.index === 3) data.cell.styles.halign = 'center';
          if (data.column.index === 4) data.cell.styles.halign = 'right';
        }
      }
    });

    y = doc.lastAutoTable.finalY + 12;

    // ===== PRICE SUMMARY TABLE =====
    const summaryWidth = 95;
    const summaryX = pageWidth - margin - summaryWidth;
    const labelX = summaryX + 10;
    const valueX = summaryX + summaryWidth - 10;
    const rowHeight = 10;
    
    // Calculate totals
    const subtotal = parseFloat(data.subtotal) || totalAmount;
    const discount = parseFloat(data.discount) || 0;
    const discountedSubtotal = subtotal - discount;
    const gstAmount = Math.round(discountedSubtotal * GST_RATE);
    const finalTotal = parseFloat(data.totalPrice) || (discountedSubtotal + gstAmount);

    // Summary box height calculation
    const hasDiscount = discount > 0;
    const summaryHeight = hasDiscount ? 72 : 60;

    // Summary container with border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.6);
    doc.roundedRect(summaryX, y, summaryWidth, summaryHeight, 3, 3, 'FD');

    // Header bar
    doc.setFillColor(...lightBg);
    doc.roundedRect(summaryX, y, summaryWidth, 14, 3, 3, 'F');
    doc.rect(summaryX, y + 10, summaryWidth, 4, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(summaryX, y + 14, summaryX + summaryWidth, y + 14);
    
    doc.setTextColor(...navy);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRICE SUMMARY', summaryX + summaryWidth / 2, y + 9.5, { align: 'center' });

    let sY = y + 22;
    
    // Subtotal row
    doc.setTextColor(...grayText);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal', labelX, sY);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(subtotal), valueX, sY, { align: 'right' });
    sY += rowHeight;

    // Discount row (if applicable)
    if (hasDiscount) {
      doc.setTextColor(180, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.text('Discount', labelX, sY);
      doc.setFont('helvetica', 'bold');
      doc.text('- ' + formatCurrency(discount), valueX, sY, { align: 'right' });
      sY += rowHeight;
    }

    // GST row
    doc.setTextColor(...grayText);
    doc.setFont('helvetica', 'normal');
    doc.text('GST (18%)', labelX, sY);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(gstAmount), valueX, sY, { align: 'right' });
    sY += 4;

    // Separator line before total
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(summaryX + 6, sY, summaryX + summaryWidth - 6, sY);
    sY += 6;

    // Total row with navy background
    const totalBarY = y + summaryHeight - 16;
    doc.setFillColor(...navy);
    doc.roundedRect(summaryX, totalBarY, summaryWidth, 16, 0, 0, 'F');
    doc.roundedRect(summaryX, totalBarY + 2, summaryWidth, 14, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', labelX, totalBarY + 11);
    doc.setFontSize(11);
    doc.text(formatCurrency(finalTotal), valueX, totalBarY + 11, { align: 'right' });

    // ===== FOOTER =====
    doc.setFillColor(...lightBg);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(0, pageHeight - 25, pageWidth, pageHeight - 25);
    
    doc.setTextColor(...navy);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('XlandInfra Property Management Solutions', pageWidth / 2, pageHeight - 16, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayText);
    doc.setFontSize(7);
    doc.text('This is a computer-generated document. For queries, contact support@xlandinfra.com', pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(filename);
    return true;
  } catch (error) {
    console.error('[PDF] Error:', error);
    return false;
  }
};

// Export estimate to PDF
export const exportEstimateToPDF = (estimate) => {
  console.log('[PDF] exportEstimateToPDF called');
  if (isExporting) {
    console.log('[PDF] Already exporting, skipping');
    return false;
  }
  isExporting = true;

  try {
    if (!estimate) throw new Error('No estimate data provided');
    console.log('[PDF] Estimate data:', estimate);

    // Prepare services
    let services = [];
    if (estimate.serviceRows && Array.isArray(estimate.serviceRows)) {
      services = estimate.serviceRows.map(sr => ({
        name: sr.service || sr.name || sr.serviceType || 'Service',
        frequencyCount: sr.frequencyCount || sr.frequency || 1,
        frequencyType: sr.frequencyType || 'Monthly',
        price: parseFloat(sr.price || sr.rate || 0)
      }));
    } else if (estimate.services && Array.isArray(estimate.services)) {
      services = estimate.services.map(s => ({
        name: s.name || s.service || s.serviceType || 'Service',
        frequencyCount: s.frequencyCount || s.frequency || 1,
        frequencyType: s.frequencyType || 'Monthly',
        price: parseFloat(s.price || s.rate || 0)
      }));
    }

    if (services.length === 0) {
      services = [{ name: 'AMC Service Package', frequencyCount: 1, frequencyType: 'Monthly', price: 0 }];
    }

    const exportData = {
      ...estimate,
      estimateId: estimate.estimateId || estimate.id || 'EST-' + Date.now(),
      services,
      addons: estimate.addons || [],
      billingDuration: estimate.billingDuration || 'Yearly',
      subtotal: parseFloat(estimate.subtotal || estimate.subTotal || estimate.totalPrice || 0),
      discount: parseFloat(estimate.discount || 0),
      totalPrice: parseFloat(estimate.totalPrice || estimate.subtotal || 0)
    };

    generatePDF(exportData, 'estimate', `AMC-Estimate-${exportData.estimateId}.pdf`);
    isExporting = false;
    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    isExporting = false;
    return false;
  }
};

// Export package to PDF
export const exportPackageToPDF = (pkg) => {
  console.log('[PDF] exportPackageToPDF called');
  if (isExporting) {
    console.log('[PDF] Already exporting, skipping');
    return false;
  }
  isExporting = true;

  try {
    if (!pkg) throw new Error('No package data provided');
    console.log('[PDF] Package data:', pkg);

    // Prepare services
    let services = [];
    if (pkg.serviceRows && Array.isArray(pkg.serviceRows)) {
      services = pkg.serviceRows.map(sr => ({
        name: sr.service || sr.name || sr.serviceType || 'Service',
        frequencyCount: sr.frequencyCount || sr.frequency || 1,
        frequencyType: sr.frequencyType || 'Monthly',
        price: parseFloat(sr.price || sr.rate || 0)
      }));
    } else if (typeof pkg.services === 'string') {
      services = pkg.services.split(',').map(s => ({
        name: s.trim() || 'Service',
        frequencyCount: 1,
        frequencyType: 'Monthly',
        price: 0
      }));
    } else if (Array.isArray(pkg.services)) {
      services = pkg.services.map(s => ({
        name: typeof s === 'string' ? s : (s.name || s.service || s.serviceType || 'Service'),
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
      packageName: pkg.packageName || pkg.name || 'AMC Package',
      propertyType: pkg.propertyType || 'General',
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
