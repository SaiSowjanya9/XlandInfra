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
    const borderLight = [229, 231, 235];     // Gray-200
    const gold = [180, 144, 52];             // Professional gold

    // ===== HEADER =====
    // Company Logo Area (text-based for reliability)
    doc.setFillColor(...gold);
    doc.roundedRect(margin, y, 12, 12, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('XI', margin + 6, y + 8, { align: 'center' });
    
    // Company Name
    doc.setTextColor(...navy);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('XLAND INFRA', margin + 16, y + 6);
    
    // Tagline
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...lightText);
    doc.text('Property Management Solutions Pvt. Ltd.', margin + 16, y + 11);

    // Document Badge (right side)
    const docType = type === 'estimate' ? 'ESTIMATE' : 'PACKAGE';
    const badgeWidth = 28;
    const badgeX = pageWidth - margin - badgeWidth;
    doc.setFillColor(...navy);
    doc.roundedRect(badgeX, y, badgeWidth, 10, 1.5, 1.5, 'F');
    doc.setTextColor(...gold);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(docType, badgeX + badgeWidth/2, y + 6.5, { align: 'center' });

    y += 18;
    
    // Divider line
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // ===== DOCUMENT INFO ROW =====
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mediumText);
    doc.text('ID:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    const estId = String(data.estimateId || data.packageId || 'N/A');
    doc.text(estId.length > 25 ? estId.substring(0, 25) + '...' : estId, margin + 8, y);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mediumText);
    doc.text('Date:', pageWidth - margin - 35, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    doc.text(formatDate(data.createdAt), pageWidth - margin - 23, y);
    y += 6;

    // ===== PACKAGE NAME BAR =====
    if (data.packageName) {
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, 'FD');
      
      // Gold left accent
      doc.setFillColor(...gold);
      doc.rect(margin, y + 1, 2, 7, 'F');
      
      doc.setTextColor(...navy);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(data.packageName, margin + 6, y + 6);
      
      if (data.billingDuration) {
        doc.setTextColor(...lightText);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Billing: ${data.billingDuration}`, pageWidth - margin - 3, y + 6, { align: 'right' });
      }
      y += 13;
    }

    // ===== SIDE-BY-SIDE CARDS: Property + Customer =====
    if (type !== 'package') {
      const gap = 6;
      const cardWidth = (pageWidth - margin * 2 - gap) / 2;
      const cardHeight = 32;
      
      // Property Details Card
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'FD');
      
      doc.setTextColor(...slate);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Property Details', margin + 4, y + 5);
      
      let py = y + 10;
      doc.setFontSize(7);
      
      // Row 1: Property ID | Property Type
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Property ID', margin + 4, py);
      doc.text('Type', margin + cardWidth/2 + 2, py);
      py += 4;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      const propId = String(data.propertyId || '-');
      doc.text(propId.length > 18 ? propId.substring(0, 18) + '...' : propId, margin + 4, py);
      doc.text(String(data.propertyType || '-'), margin + cardWidth/2 + 2, py);
      py += 6;
      
      // Row 2: Zone | Division
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Zone', margin + 4, py);
      doc.text('Division', margin + cardWidth/2 + 2, py);
      py += 4;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(String(data.zone || '-'), margin + 4, py);
      doc.text(String(data.division || data.divisionName || '-'), margin + cardWidth/2 + 2, py);
      
      // Customer Details Card
      const cx = margin + cardWidth + gap;
      doc.setFillColor(...cardBg);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(cx, y, cardWidth, cardHeight, 2, 2, 'FD');
      
      doc.setTextColor(...slate);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Details', cx + 4, y + 5);
      
      let cy = y + 10;
      doc.setFontSize(7);
      
      // Row 1: Name | Phone
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Name', cx + 4, cy);
      doc.text('Phone', cx + cardWidth/2 + 2, cy);
      cy += 4;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      doc.text(String(data.customerName || '-'), cx + 4, cy);
      doc.text(String(data.customerPhone || '-'), cx + cardWidth/2 + 2, cy);
      cy += 6;
      
      // Row 2: Email
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...lightText);
      doc.text('Email', cx + 4, cy);
      cy += 4;
      doc.setTextColor(...darkText);
      doc.setFont('helvetica', 'bold');
      const email = String(data.customerEmail || '-');
      doc.text(email.length > 28 ? email.substring(0, 28) + '...' : email, cx + 4, cy);
      
      y += cardHeight + 6;
    }

    // ===== SERVICES TABLE =====
    doc.setTextColor(...navy);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES INCLUDED', margin, y);
    y += 5;

    const services = data.services || [];
    const tableBody = services.length > 0 
      ? services.map((s, idx) => [
          String(idx + 1),
          String(s.name || s.service || 'Service'),
          String(s.frequencyType || 'Monthly'),
          String(s.frequencyCount || s.frequency || '-')
        ])
      : [['1', 'No services listed', '-', '-']];

    autoTable(doc, {
      startY: y,
      head: [['#', 'Service Description', 'Frequency', 'Visits']],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3, lineColor: borderLight, lineWidth: 0.2 },
      headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { textColor: darkText },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [252, 252, 253] }
    });

    y = doc.lastAutoTable.finalY + 6;

    // ===== ADD-ONS TABLE =====
    if (data.addons && data.addons.length > 0) {
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('ADD-ONS', margin, y);
      y += 5;

      const addonsBody = data.addons.map((a, idx) => [
        String(idx + 1),
        String(a.name || a.serviceName || 'Add-on'),
        String(a.frequencyType || a.frequency || 'One-time'),
        String(a.frequencyCount || a.visits || '-')
      ]);

      autoTable(doc, {
        startY: y,
        head: [['#', 'Add-on Service', 'Frequency', 'Visits']],
        body: addonsBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3, lineColor: borderLight, lineWidth: 0.2 },
        headStyles: { fillColor: slate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        bodyStyles: { textColor: darkText },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' }
        },
        alternateRowStyles: { fillColor: [252, 252, 253] }
      });

      y = doc.lastAutoTable.finalY + 6;
    }

    // ===== TOTAL BOX (Compact, Right-Aligned) =====
    const total = parseFloat(data.totalPrice) || parseFloat(data.subtotal) || 0;
    const totalBoxW = 75;
    const totalBoxH = 12;
    const totalBoxX = pageWidth - margin - totalBoxW;

    if (y + totalBoxH + 25 > pageHeight) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...navy);
    doc.roundedRect(totalBoxX, y, totalBoxW, totalBoxH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', totalBoxX + 5, y + 8);
    doc.setFontSize(10);
    doc.text(formatCurrency(total), totalBoxX + totalBoxW - 5, y + 8, { align: 'right' });

    y += totalBoxH + 8;

    // ===== NOTES/DESCRIPTION =====
    if (data.description && data.description.trim()) {
      if (y + 30 > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      
      doc.setTextColor(...navy);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTES', margin, y);
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
    }

    // ===== FOOTER =====
    const footerY = pageHeight - 12;
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    
    doc.setTextColor(...lightText);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('XLAND INFRA Property Management Solutions Pvt. Ltd. | This is a computer-generated document.', pageWidth / 2, footerY, { align: 'center' });

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
    console.log('[PDF] Package services:', estimate.packageServices);
    
    // PRIORITY 1: Check packageServices (services from selected AMC package)
    if (estimate.packageServices && Array.isArray(estimate.packageServices) && estimate.packageServices.length > 0) {
      console.log('[PDF] Using packageServices:', estimate.packageServices);
      services = estimate.packageServices.map(s => ({
        name: s.service || s.name || s.serviceName || 'Service',
        frequencyCount: s.frequencyCount || s.frequency || s.visits || 1,
        frequencyType: s.frequencyType || 'Monthly'
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
      console.log('[PDF] Processing services array:', estimate.services);
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
      console.log('[PDF] Adding package as service:', pkgName);
      services.push({
        name: pkgName + ' - AMC Services',
        frequencyCount: 12,
        frequencyType: estimate.billingDuration || estimate.billing_duration || 'Yearly'
      });
    }
    
    // Final fallback - if still no services but has a total, add a placeholder
    if (services.length === 0 && (estimate.total || estimate.totalPrice || estimate.subtotal)) {
      console.log('[PDF] No services found, adding placeholder');
      services.push({
        name: estimate.propertyType ? `${estimate.propertyType} Service` : 'Estimate Services',
        frequencyCount: 1,
        frequencyType: estimate.billingDuration || 'Yearly'
      });
    }
    
    console.log('[PDF] Final services:', services);

    // Parse addons from various formats (no prices - only names and frequency)
    let addons = [];
    
    // Try addons array first
    if (estimate.addons && Array.isArray(estimate.addons) && estimate.addons.length > 0) {
      addons = estimate.addons.map(a => ({
        name: a.name || a.serviceName || a.service_name || a.services?.[0]?.name || 'Add-on',
        frequencyType: a.frequencyType || a.frequency_type || a.services?.[0]?.frequencyType || 'One-time',
        frequencyCount: a.frequencyCount || a.frequency_count || a.visits || a.noOfVisits || a.no_of_visits || a.services?.[0]?.frequency || a.services?.[0]?.frequencyCount || 1
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
            frequencyCount: a.frequencyCount || a.frequency_count || a.visits || a.noOfVisits || a.no_of_visits || a.services?.[0]?.frequency || a.services?.[0]?.frequencyCount || 1
          }));
        }
      } catch (e) { console.log('[PDF] addons_data parse error:', e); }
    }
    // Try selectedAddons array (from form)
    if (addons.length === 0 && estimate.selectedAddons && Array.isArray(estimate.selectedAddons) && estimate.selectedAddons.length > 0) {
      addons = estimate.selectedAddons.map(a => ({
        name: a.name || a.serviceName || a.service_name || a.services?.[0]?.name || 'Add-on',
        frequencyType: a.frequencyType || a.frequency_type || a.services?.[0]?.frequencyType || 'One-time',
        frequencyCount: a.frequencyCount || a.frequency_count || a.visits || a.noOfVisits || a.no_of_visits || a.services?.[0]?.frequency || a.services?.[0]?.frequencyCount || 1
      }));
    }
    
    console.log('[PDF] Parsed addons:', addons);

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
