// Professional PDF Export using jsPDF - Direct Download, No Print Dialog
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const GST_RATE = 0.18;
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

// Generate Premium PDF with professional design - Soft/Subtle colors
const generatePDF = (data, type, filename) => {
  try {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 10;

    // Soft/Subtle Colors - No bright colors
    const primaryColor = [71, 85, 105];      // Slate-600
    const darkText = [51, 65, 85];           // Slate-700
    const grayText = [100, 116, 139];        // Slate-500
    const lightGray = [248, 250, 252];       // Slate-50
    const borderColor = [203, 213, 225];     // Slate-300
    const accentColor = [148, 163, 184];     // Slate-400
    
    // Helper function to check page overflow and add new page if needed
    const checkPageOverflow = (neededHeight) => {
      if (y + neededHeight > pageHeight - 25) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // ===== HEADER =====
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 32, 'F');
    
    // Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('XLAND INFRA', margin, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Property Management Solutions', margin, 23);

    // Document type badge
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.roundedRect(pageWidth - margin - 45, 8, 45, 16, 2, 2, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const docType = type === 'estimate' ? 'ESTIMATE' : 'PACKAGE';
    doc.text(docType, pageWidth - margin - 22.5, 18, { align: 'center' });

    y = 40;

    // ===== DOCUMENT INFO =====
    doc.setTextColor(...darkText);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Estimate ID:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.estimateId || data.packageId || 'N/A', margin + 28, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Date:', pageWidth - margin - 60, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.createdAt), pageWidth - margin - 45, y);
    y += 10;

    // ===== PACKAGE/ESTIMATE NAME =====
    if (data.packageName) {
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 2, 2, 'F');
      doc.setFillColor(...accentColor);
      doc.rect(margin, y, 3, 14, 'F');
      
      doc.setTextColor(...primaryColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(data.packageName, margin + 8, y + 9);
      
      if (data.billingDuration) {
        doc.setTextColor(...grayText);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Billing: ${data.billingDuration}`, pageWidth - margin - 5, y + 9, { align: 'right' });
      }
      y += 20;
    }

    // ===== TWO COLUMN INFO SECTION (Skip for AMC Package PDFs) =====
    if (type !== 'package') {
    const colWidth = (pageWidth - margin * 2 - 10) / 2;
    // Dynamic box height based on property fields available
    let extraFields = 0;
    if (data.areaName) extraFields++;
    if (data.numberOfBlocks) extraFields++;
    if (data.unitsPerBlock) extraFields++;
    if (data.totalUnits || data.numberOfUnits) extraFields++;
    if (data.villaPlotNumber) extraFields++;
    const boxHeight = 60 + (extraFields * 7);
    
    // Property Details Box
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, colWidth, boxHeight, 3, 3, 'S');
    
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin, y, colWidth, 12, 3, 3, 'F');
    doc.rect(margin, y + 8, colWidth, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROPERTY DETAILS', margin + 5, y + 8);
    
    let infoY = y + 18;
    doc.setTextColor(...darkText);
    doc.setFontSize(8);
    
    // Property ID - always show
    doc.setFont('helvetica', 'bold');
    doc.text('Property ID:', margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.propertyId || data.property_code || data.property_id || '-'), margin + 32, infoY);
    infoY += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Property Type:', margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.propertyType || data.property_type || '-'), margin + 32, infoY);
    infoY += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Zone:', margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.zone || '-'), margin + 32, infoY);
    infoY += 7;
    
    // Division - always show
    doc.setFont('helvetica', 'bold');
    doc.text('Division:', margin + 5, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.division || '-'), margin + 32, infoY);
    infoY += 7;
    
    // Area Name
    if (data.areaName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Area:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.areaName).substring(0, 15), margin + 32, infoY);
      infoY += 7;
    }
    
    // GC/APT specific: Number of Blocks
    if (data.numberOfBlocks) {
      doc.setFont('helvetica', 'bold');
      doc.text('No. of Blocks:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.numberOfBlocks), margin + 32, infoY);
      infoY += 7;
    }
    
    // Units per Block
    if (data.unitsPerBlock) {
      doc.setFont('helvetica', 'bold');
      doc.text('Units/Block:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.unitsPerBlock), margin + 32, infoY);
      infoY += 7;
    }
    
    // Total Units
    if (data.totalUnits || data.numberOfUnits) {
      doc.setFont('helvetica', 'bold');
      doc.text('Total Units:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.totalUnits || data.numberOfUnits), margin + 32, infoY);
      infoY += 7;
    }
    
    // PLOT/VILLA specific: Plot Number
    if (data.villaPlotNumber) {
      doc.setFont('helvetica', 'bold');
      doc.text('Plot/Villa No:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.villaPlotNumber), margin + 32, infoY);
      infoY += 7;
    }
    
    // Customer Details Box
    doc.setDrawColor(...borderColor);
    doc.roundedRect(margin + colWidth + 10, y, colWidth, boxHeight, 3, 3, 'S');
    
    doc.setFillColor(...primaryColor);
    doc.roundedRect(margin + colWidth + 10, y, colWidth, 12, 3, 3, 'F');
    doc.rect(margin + colWidth + 10, y + 8, colWidth, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOMER DETAILS', margin + colWidth + 15, y + 8);
    
    infoY = y + 18;
    doc.setTextColor(...darkText);
    doc.setFontSize(8);
    
    // Always show all customer fields
    const custX = margin + colWidth + 15;
    const custValX = margin + colWidth + 42;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Contact Name:', custX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.customerName || '-').substring(0, 20), custValX, infoY);
    infoY += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Community:', custX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.communityName || data.propertyName || '-').substring(0, 20), custValX, infoY);
    infoY += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', custX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(String(data.customerPhone || data.phone || '-'), custValX, infoY);
    infoY += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Email:', custX, infoY);
    doc.setFont('helvetica', 'normal');
    const email = String(data.customerEmail || data.email || '-');
    doc.setFontSize(7);
    doc.text(email, custValX, infoY);
    doc.setFontSize(8);
    infoY += 7;
    
    // Address inside Customer Details box
    doc.setFont('helvetica', 'bold');
    doc.text('Address:', custX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(String(data.address || '-').substring(0, 25), custValX, infoY);
    doc.setFontSize(8);
    
    y += boxHeight + 8;
    } // End of property/customer details section (skipped for package type)

    // ===== NO OF VISITS =====
    if (data.noOfVisits) {
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, 70, 10, 2, 2, 'F');
      doc.setTextColor(...darkText);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('No. of Visits:', margin + 5, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.noOfVisits), margin + 35, y + 7);
      y += 14;
    }

    // ===== SERVICES TABLE =====
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES INCLUDED', margin, y);
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 2, margin + 40, y + 2);
    y += 8;

    // Prepare services data with No. of Visits column
    const services = data.services || [];
    const tableBody = [];
    
    if (services.length > 0) {
      services.forEach((s, idx) => {
        // Get frequency count for each service
        const serviceVisits = s.frequencyCount || s.frequency || s.visits || s.noOfVisits || '-';
        const row = [
          String(idx + 1),
          String(s.name || s.service || 'Service'),
          String(s.frequencyType || 'Monthly'),
          String(serviceVisits) // Show visits for each service
        ];
        tableBody.push(row);
        
        // Add description if exists
        if (s.description) {
          tableBody.push(['', { content: s.description, styles: { fontStyle: 'italic', textColor: grayText, fontSize: 7 } }, '', '']);
        }
      });
    } else {
      const fallbackVisits = data.noOfVisits || '-';
      tableBody.push(['1', 'No services listed', '-', String(fallbackVisits)]);
    }

    // Add addons to table
    if (data.addons && data.addons.length > 0) {
      data.addons.forEach((addon, idx) => {
        const addonName = addon.name || addon.serviceName || addon.services?.[0]?.name || 'Additional Service';
        tableBody.push([
          String(services.length + idx + 1),
          addonName,
          '-',
          ''
        ]);
        
        // Add description if exists
        if (addon.description) {
          tableBody.push(['', { content: addon.description, styles: { fontStyle: 'italic', textColor: grayText, fontSize: 7 } }, '', '']);
        }
      });
    }

    autoTable(doc, {
      startY: y,
      head: [['#', 'Service Description', 'Frequency', 'No. of Visits']],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: borderColor,
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        textColor: darkText
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 28, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [250, 251, 252] }
    });

    y = doc.lastAutoTable.finalY + 8;

    // ===== PRICE SUMMARY (Right after services to minimize whitespace) =====
    const summaryWidth = 100;
    const summaryX = pageWidth - margin - summaryWidth;
    
    const subtotal = parseFloat(data.subtotal) || parseFloat(data.totalPrice) || 0;
    const discount = parseFloat(data.discount) || 0;
    const afterDiscount = subtotal - discount;
    const gst = Math.round(afterDiscount * GST_RATE);
    const total = parseFloat(data.totalPrice) || (afterDiscount + gst);
    
    const summaryBoxHeight = discount > 0 ? 90 : 78;

    // Outer box with subtle shadow effect
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(summaryX, y, summaryWidth, summaryBoxHeight, 4, 4, 'FD');
    
    // Header bar with primary color
    doc.setFillColor(...primaryColor);
    doc.roundedRect(summaryX, y, summaryWidth, 14, 4, 4, 'F');
    doc.rect(summaryX, y + 10, summaryWidth, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRICE SUMMARY', summaryX + summaryWidth / 2, y + 9, { align: 'center' });
    
    let sumY = y + 24;
    
    // Subtotal row
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal', summaryX + 10, sumY);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(subtotal), summaryX + summaryWidth - 10, sumY, { align: 'right' });
    sumY += 12;
    
    // Discount row (if applicable)
    if (discount > 0) {
      doc.setTextColor(34, 139, 34); // Green for discount
      doc.setFont('helvetica', 'normal');
      doc.text('Discount', summaryX + 10, sumY);
      doc.setFont('helvetica', 'bold');
      doc.text('- ' + formatCurrency(discount), summaryX + summaryWidth - 10, sumY, { align: 'right' });
      sumY += 12;
    }
    
    // GST row
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('GST (18%)', summaryX + 10, sumY);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(gst), summaryX + summaryWidth - 10, sumY, { align: 'right' });
    sumY += 8;
    
    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(summaryX + 8, sumY, summaryX + summaryWidth - 8, sumY);
    sumY += 10;
    
    // Total bar with accent color - black text for readability
    doc.setFillColor(...accentColor);
    doc.roundedRect(summaryX + 5, sumY - 3, summaryWidth - 10, 18, 3, 3, 'F');
    doc.setTextColor(0, 0, 0); // Black text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', summaryX + 12, sumY + 8);
    doc.setFontSize(11);
    doc.text(formatCurrency(total), summaryX + summaryWidth - 12, sumY + 8, { align: 'right' });

    y += summaryBoxHeight + 10;

    // ===== DESCRIPTION SECTION (After price summary) =====
    if (data.description && data.description.trim()) {
      const maxDescLines = 50;
      const lineHeight = 5;
      const descWidth = pageWidth - margin * 2;
      const textWidth = descWidth - 20;
      
      doc.setFontSize(8);
      let descLines = doc.splitTextToSize(data.description, textWidth);
      
      if (descLines.length > maxDescLines) {
        descLines = descLines.slice(0, maxDescLines);
        descLines[maxDescLines - 1] = descLines[maxDescLines - 1] + '...';
      }
      
      const headerHeight = 18;
      const contentHeight = descLines.length * lineHeight;
      const descBoxHeight = headerHeight + contentHeight + 10;
      
      // Check if description fits on current page
      if (y + descBoxHeight > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      
      // Description box
      doc.setFillColor(250, 251, 252);
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, descWidth, descBoxHeight, 4, 4, 'FD');
      
      // Header bar
      doc.setFillColor(...primaryColor);
      doc.roundedRect(margin, y, descWidth, 14, 4, 4, 'F');
      doc.rect(margin, y + 10, descWidth, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('DESCRIPTION / NOTES', margin + 10, y + 9);
      
      // Description content
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      let textY = y + headerHeight + 4;
      descLines.forEach((line) => {
        doc.text(line, margin + 10, textY);
        textY += lineHeight;
      });
    }

    // ===== FOOTER =====
    doc.setFillColor(...lightGray);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.5);
    doc.line(0, pageHeight - 20, pageWidth, pageHeight - 20);
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('XLAND INFRA Property Management Solutions', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grayText);
    doc.setFontSize(7);
    doc.text('This is a computer-generated document. For queries, contact info@xlandinfra.com', pageWidth / 2, pageHeight - 6, { align: 'center' });

    doc.save(filename);
    return true;
  } catch (error) {
    console.error('[PDF] Error:', error);
    return false;
  }
};

// Export estimate to PDF
export const exportEstimateToPDF = (estimate) => {
  console.log('[PDF] exportEstimateToPDF called for:', estimate?.estimateId || estimate?.estimate_id);

  try {
    if (!estimate) {
      console.error('[PDF] No estimate data provided');
      return false;
    }

    // Prepare services from various possible formats
    let services = [];
    
    console.log('[PDF] Estimate type:', estimate.estimateType || estimate.estimate_type);
    console.log('[PDF] Phone fields:', { customerPhone: estimate.customerPhone, phone: estimate.phone, customer_phone: estimate.customer_phone, contactPhone: estimate.contactPhone });
    
    // Check serviceRows first (package service rows from form)
    if (estimate.serviceRows && Array.isArray(estimate.serviceRows) && estimate.serviceRows.length > 0) {
      services = estimate.serviceRows.filter(sr => sr.service || sr.name).map(sr => ({
        name: sr.service || sr.name || 'Service',
        frequencyCount: sr.frequencyCount || sr.frequency || 1,
        frequencyType: sr.frequencyType || 'Monthly',
        price: parseFloat(sr.price || sr.rate || 0)
      }));
    }
    // Check services array (from database or form)
    else if (estimate.services && Array.isArray(estimate.services) && estimate.services.length > 0) {
      console.log('[PDF] Processing services array:', estimate.services);
      services = estimate.services.map(s => {
        // Handle nested package structure
        if (s.type === 'package' && s.services) {
          return {
            name: s.name || 'Package',
            frequencyCount: 1,
            frequencyType: 'Yearly',
            price: parseFloat(s.price || 0)
          };
        }
        // Handle addon/service structure
        return {
          name: s.name || s.service || s.serviceName || s.description || 'Service',
          frequencyCount: s.frequencyCount || s.frequency || s.visits || 1,
          frequencyType: s.frequencyType || s.billingType || s.billing || 'Monthly',
          price: parseFloat(s.price || s.rate || s.amount || s.total || 0)
        };
      });
    }
    
    // If package name exists and no services, add package as main service
    if (services.length === 0 && (estimate.packageName || estimate.package_name)) {
      const pkgName = estimate.packageName || estimate.package_name;
      console.log('[PDF] Adding package as service:', pkgName);
      services.push({
        name: pkgName,
        frequencyCount: 1,
        frequencyType: estimate.billingDuration || estimate.billing_duration || 'Yearly',
        price: parseFloat(estimate.packageRate || estimate.subtotal || estimate.total || 0)
      });
    }
    
    // Final fallback - if still no services but has a total, add a placeholder
    if (services.length === 0 && (estimate.total || estimate.totalPrice || estimate.subtotal)) {
      console.log('[PDF] No services found, adding placeholder');
      services.push({
        name: estimate.propertyType ? `${estimate.propertyType} Service` : 'Estimate Services',
        frequencyCount: 1,
        frequencyType: estimate.billingDuration || 'Yearly',
        price: parseFloat(estimate.subtotal || estimate.total || estimate.totalPrice || 0)
      });
    }
    
    console.log('[PDF] Final services:', services);

    // Parse addons from various formats
    let addons = [];
    if (estimate.addons && Array.isArray(estimate.addons)) {
      addons = estimate.addons.map(a => ({
        name: a.name || a.serviceName || a.services?.[0]?.name || 'Add-on',
        price: parseFloat(a.price || a.totalPrice || a.services?.[0]?.price || 0)
      }));
    }

    const exportData = {
      estimateId: estimate.estimateId || estimate.estimate_id || estimate.id || 'EST-' + Date.now(),
      estimateType: estimate.estimateType || estimate.estimate_type || (estimate.propertyId || estimate.property_id ? 'property-based' : 'direct'),
      packageName: estimate.packageName || estimate.package_name,
      propertyId: estimate.propertyId || estimate.property_id,
      propertyType: estimate.propertyType || estimate.property_type || estimate.entryType || 'N/A',
      propertyName: estimate.propertyName || estimate.property_name,
      communityName: estimate.communityName || estimate.community_name || estimate.propertyName || estimate.property_name,
      zone: estimate.zone || estimate.zoneName || estimate.zone_name,
      areaName: estimate.areaName || estimate.area_name || estimate.area,
      division: estimate.division || estimate.divisionName || estimate.division_name,
      // GC/APT specific fields
      numberOfBlocks: estimate.numberOfBlocks || estimate.number_of_blocks || estimate.blocks,
      unitsPerBlock: estimate.unitsPerBlock || estimate.units_per_block,
      totalUnits: estimate.totalUnits || estimate.total_units || estimate.numberOfUnits || estimate.number_of_units,
      blockNames: estimate.blockNames || estimate.block_names,
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
      subtotal: parseFloat(estimate.subtotal || estimate.subTotal || estimate.sub_total || estimate.total_amount || estimate.totalPrice || 0),
      discount: parseFloat(estimate.discount || 0),
      totalPrice: parseFloat(estimate.totalPrice || estimate.total || estimate.total_price || estimate.total_amount || estimate.subtotal || 0),
      createdAt: estimate.createdAt || estimate.created_at || new Date().toISOString()
    };

    console.log('[PDF] Generating PDF for:', exportData.estimateId);
    const result = generatePDF(exportData, 'estimate', `Estimate-${exportData.estimateId}.pdf`);
    console.log('[PDF] generatePDF result:', result);
    return result;
  } catch (error) {
    console.error('PDF Export Error:', error);
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
