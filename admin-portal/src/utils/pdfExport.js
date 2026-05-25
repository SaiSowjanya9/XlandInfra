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

    // ===== TWO COLUMN INFO SECTION =====
    const colWidth = (pageWidth - margin * 2 - 10) / 2;
    const boxHeight = 58;
    
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
    
    if (data.propertyId) {
      doc.setFont('helvetica', 'bold');
      doc.text('Property ID:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.propertyId), margin + 30, infoY);
      infoY += 6;
    }
    if (data.propertyType) {
      doc.setFont('helvetica', 'bold');
      doc.text('Property Type:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.propertyType), margin + 30, infoY);
      infoY += 6;
    }
    if (data.zone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Zone:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.zone), margin + 30, infoY);
      infoY += 6;
    }
    if (data.division) {
      doc.setFont('helvetica', 'bold');
      doc.text('Division:', margin + 5, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.division), margin + 30, infoY);
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
    
    if (data.customerName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Contact Name:', margin + colWidth + 15, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.customerName).substring(0, 18), margin + colWidth + 40, infoY);
      infoY += 6;
    }
    if (data.communityName || data.propertyName) {
      doc.setFont('helvetica', 'bold');
      doc.text('Community:', margin + colWidth + 15, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.communityName || data.propertyName || '').substring(0, 18), margin + colWidth + 40, infoY);
      infoY += 6;
    }
    if (data.address) {
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', margin + colWidth + 15, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.address).substring(0, 18), margin + colWidth + 40, infoY);
      infoY += 6;
    }
    if (data.customerPhone || data.phone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Phone:', margin + colWidth + 15, infoY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(data.customerPhone || data.phone || ''), margin + colWidth + 40, infoY);
      infoY += 6;
    }
    if (data.customerEmail || data.email) {
      doc.setFont('helvetica', 'bold');
      doc.text('Email:', margin + colWidth + 15, infoY);
      doc.setFont('helvetica', 'normal');
      const email = String(data.customerEmail || data.email || '');
      doc.text(email.substring(0, 22), margin + colWidth + 40, infoY);
    }
    
    y += boxHeight + 8;

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

    // ===== SERVICES TABLE (No Amount column) =====
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICES INCLUDED', margin, y);
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 2, margin + 40, y + 2);
    y += 8;

    // Prepare services data - No Amount column, No [Add-on] prefix
    const services = data.services || [];
    const tableBody = [];
    
    if (services.length > 0) {
      services.forEach((s, idx) => {
        const row = [
          String(idx + 1),
          String(s.name || s.service || 'Service'),
          String(s.frequencyType || 'Monthly')
        ];
        tableBody.push(row);
        
        // Add description if exists
        if (s.description) {
          tableBody.push(['', { content: s.description, styles: { fontStyle: 'italic', textColor: grayText, fontSize: 7 } }, '']);
        }
      });
    } else {
      tableBody.push(['1', 'No services listed', '-']);
    }

    // Add addons to table (without [Add-on] prefix)
    if (data.addons && data.addons.length > 0) {
      data.addons.forEach((addon, idx) => {
        const addonName = addon.name || addon.serviceName || addon.services?.[0]?.name || 'Additional Service';
        tableBody.push([
          String(services.length + idx + 1),
          addonName,
          '-'
        ]);
        
        // Add description if exists
        if (addon.description) {
          tableBody.push(['', { content: addon.description, styles: { fontStyle: 'italic', textColor: grayText, fontSize: 7 } }, '']);
        }
      });
    }

    autoTable(doc, {
      startY: y,
      head: [['#', 'Service Description', 'Frequency']],
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
        2: { cellWidth: 30, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [250, 251, 252] }
    });

    y = doc.lastAutoTable.finalY + 10;

    // ===== DESCRIPTION SECTION =====
    if (data.description) {
      doc.setFillColor(...lightGray);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, 'F');
      doc.setTextColor(...darkText);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Description:', margin + 5, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const descLines = doc.splitTextToSize(data.description, pageWidth - margin * 2 - 10);
      doc.text(descLines.slice(0, 2), margin + 5, y + 14);
      y += 24;
    }

    // ===== TOTAL PRICE SUMMARY =====
    const summaryWidth = 90;
    const summaryX = pageWidth - margin - summaryWidth;
    
    const subtotal = parseFloat(data.subtotal) || parseFloat(data.totalPrice) || 0;
    const discount = parseFloat(data.discount) || 0;
    const afterDiscount = subtotal - discount;
    const gst = Math.round(afterDiscount * GST_RATE);
    const total = parseFloat(data.totalPrice) || (afterDiscount + gst);

    // Summary box
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(summaryX, y, summaryWidth, discount > 0 ? 65 : 55, 3, 3, 'S');
    
    // Header
    doc.setFillColor(...lightGray);
    doc.roundedRect(summaryX, y, summaryWidth, 12, 3, 3, 'F');
    doc.rect(summaryX, y + 8, summaryWidth, 4, 'F');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PRICE SUMMARY', summaryX + summaryWidth / 2, y + 8, { align: 'center' });
    
    let sumY = y + 20;
    
    // Subtotal
    doc.setTextColor(...grayText);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal', summaryX + 8, sumY);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(subtotal), summaryX + summaryWidth - 8, sumY, { align: 'right' });
    sumY += 8;
    
    // Discount
    if (discount > 0) {
      doc.setTextColor([120, 113, 108]); // Soft brown/gray for discount
      doc.setFont('helvetica', 'normal');
      doc.text('Discount', summaryX + 8, sumY);
      doc.setFont('helvetica', 'bold');
      doc.text('- ' + formatCurrency(discount), summaryX + summaryWidth - 8, sumY, { align: 'right' });
      sumY += 8;
    }
    
    // GST
    doc.setTextColor(...grayText);
    doc.setFont('helvetica', 'normal');
    doc.text('GST (18%)', summaryX + 8, sumY);
    doc.setTextColor(...darkText);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(gst), summaryX + summaryWidth - 8, sumY, { align: 'right' });
    sumY += 5;
    
    // Separator
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.5);
    doc.line(summaryX + 5, sumY, summaryX + summaryWidth - 5, sumY);
    sumY += 8;
    
    // Total
    doc.setFillColor(...primaryColor);
    doc.roundedRect(summaryX, sumY - 3, summaryWidth, 14, 0, 0, 'F');
    doc.roundedRect(summaryX, sumY, summaryWidth, 11, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', summaryX + 8, sumY + 7);
    doc.text(formatCurrency(total), summaryX + summaryWidth - 8, sumY + 7, { align: 'right' });

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
  console.log('[PDF] exportEstimateToPDF called with:', estimate);
  if (isExporting) return false;
  isExporting = true;

  try {
    if (!estimate) throw new Error('No estimate data provided');

    // Prepare services from various possible formats
    let services = [];
    
    // Check serviceRows first (package service rows)
    if (estimate.serviceRows && Array.isArray(estimate.serviceRows)) {
      services = estimate.serviceRows.filter(sr => sr.service || sr.name).map(sr => ({
        name: sr.service || sr.name || 'Service',
        frequencyCount: sr.frequencyCount || sr.frequency || 1,
        frequencyType: sr.frequencyType || 'Monthly',
        price: parseFloat(sr.price || sr.rate || 0)
      }));
    }
    // Check services array
    else if (estimate.services && Array.isArray(estimate.services)) {
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
        return {
          name: s.name || s.service || 'Service',
          frequencyCount: s.frequencyCount || s.frequency || 1,
          frequencyType: s.frequencyType || 'Monthly',
          price: parseFloat(s.price || s.rate || 0)
        };
      });
    }
    
    // If package name exists, add it as a service
    if (services.length === 0 && estimate.packageName) {
      services.push({
        name: estimate.packageName,
        frequencyCount: 1,
        frequencyType: estimate.billingDuration || 'Yearly',
        price: parseFloat(estimate.packageRate || estimate.subtotal || 0)
      });
    }

    // Parse addons from various formats
    let addons = [];
    if (estimate.addons && Array.isArray(estimate.addons)) {
      addons = estimate.addons.map(a => ({
        name: a.name || a.serviceName || a.services?.[0]?.name || 'Add-on',
        price: parseFloat(a.price || a.totalPrice || a.services?.[0]?.price || 0)
      }));
    }

    const exportData = {
      estimateId: estimate.estimateId || estimate.id || 'EST-' + Date.now(),
      packageName: estimate.packageName,
      propertyId: estimate.propertyId || estimate.property_id,
      propertyType: estimate.propertyType || estimate.entryType || estimate.property_type,
      propertyName: estimate.propertyName || estimate.property_name,
      communityName: estimate.communityName || estimate.community_name || estimate.propertyName || estimate.property_name,
      zone: estimate.zone || estimate.zoneName || estimate.areaName || estimate.area_name,
      division: estimate.division || estimate.divisionName || estimate.division_name,
      address: estimate.address || estimate.propertyAddress || estimate.property_address || estimate.fullAddress,
      customerName: estimate.customerName || estimate.clientName || estimate.customer_name || estimate.client_name,
      customerPhone: estimate.customerPhone || estimate.phone || estimate.customer_phone || estimate.contactPhone,
      customerEmail: estimate.customerEmail || estimate.email || estimate.customer_email || estimate.contactEmail,
      noOfVisits: estimate.noOfVisits || estimate.visits || estimate.numberOfVisits || estimate.no_of_visits,
      description: estimate.description || estimate.notes || estimate.remarks,
      services,
      addons,
      billingDuration: estimate.billingDuration || estimate.billing_duration || 'Yearly',
      subtotal: parseFloat(estimate.subtotal || estimate.subTotal || estimate.sub_total || estimate.totalPrice || 0),
      discount: parseFloat(estimate.discount || 0),
      totalPrice: parseFloat(estimate.totalPrice || estimate.total || estimate.total_price || estimate.subtotal || 0),
      createdAt: estimate.createdAt || estimate.created_at || new Date().toISOString()
    };

    generatePDF(exportData, 'estimate', `Estimate-${exportData.estimateId}.pdf`);
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
