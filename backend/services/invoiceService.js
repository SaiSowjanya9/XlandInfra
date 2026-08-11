/**
 * Invoice Service
 * Handles automatic invoice generation from estimates and work orders
 */

const { pool } = require('../config/database');
const { generateInvoicePDF } = require('./pdfService');
// Email sending is handled via sendEmail function imported dynamically to avoid circular dependencies

// GST Rate (fixed at 18%)
const GST_RATE = 18;

// Decode HTML entities (fix triple/double encoded ampersands etc.)
const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&amp;amp;amp;/g, '&')
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

// Due date offset in days
const DUE_DATE_DAYS = 14;

/**
 * Generate unique invoice ID in format INV-00001
 */
const generateInvoiceId = async (fpId = null) => {
  const prefix = 'INV';
  
  try {
    // Get the max invoice number across all invoices (global sequence)
    const [existing] = await pool.execute(
      'SELECT MAX(current_number) as max_number FROM invoice_sequence WHERE franchise_partner_id <=> ?',
      [fpId]
    );
    
    let nextNumber;
    if (existing.length > 0 && existing[0].max_number) {
      nextNumber = existing[0].max_number + 1;
      await pool.execute(
        'UPDATE invoice_sequence SET current_number = ? WHERE franchise_partner_id <=> ?',
        [nextNumber, fpId]
      );
    } else {
      // Check if there's already a sequence record
      const [seqExists] = await pool.execute(
        'SELECT id FROM invoice_sequence WHERE franchise_partner_id <=> ?',
        [fpId]
      );
      
      nextNumber = 1;
      if (seqExists.length > 0) {
        await pool.execute(
          'UPDATE invoice_sequence SET current_number = ? WHERE franchise_partner_id <=> ?',
          [nextNumber, fpId]
        );
      } else {
        await pool.execute(
          'INSERT INTO invoice_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
          [fpId, new Date().getFullYear(), nextNumber, prefix]
        );
      }
    }
    
    // Format: INV-00001
    return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    console.error('Error generating invoice ID:', error);
    // Fallback with timestamp
    const timestamp = Date.now().toString(36).toUpperCase();
    return `${prefix}-${timestamp}`;
  }
};

/**
 * Calculate invoice amounts with GST
 */
const calculateInvoiceAmounts = (subtotal, discountPercentage = 0) => {
  const discountAmount = subtotal * (discountPercentage / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (GST_RATE / 100);
  const totalAmount = taxableAmount + taxAmount;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountPercentage: parseFloat(discountPercentage.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    taxPercentage: GST_RATE,
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    balanceAmount: parseFloat(totalAmount.toFixed(2))
  };
};

/**
 * Generate invoice from an approved estimate
 * @param {number} estimateId - The estimate ID (internal DB ID)
 * @param {number} approvedBy - User ID who approved the estimate
 * @param {string} source - Source table: 'regular' for estimates, 'fp' for fp_estimates
 * @returns {Object} Created invoice data
 */
const generateInvoiceFromEstimate = async (estimateId, approvedBy = null, source = 'regular') => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let estimates;
    
    if (source === 'fp') {
      // Query fp_estimates table for FP estimates
      // FP estimates use client_name, client_email, client_phone (not customer_*)
      // Note: FP estimates store property_id as the property code string (e.g., "APT-1782187354586")
      [estimates] = await connection.execute(`
        SELECT fe.*, 
               fe.client_email as estimate_email, fe.client_name as estimate_customer_name,
               fe.client_phone as customer_phone,
               fe.property_name, 
               COALESCE(fe.property_code, fe.property_id) as property_code,
               fe.total_amount as total,
               op.community_name as onboarded_property_name, op.property_id as onboarded_property_code,
               op.contact_email as op_email, op.contact_phone as op_phone,
               fe.franchise_partner_id
        FROM fp_estimates fe
        LEFT JOIN onboarded_properties op ON fe.property_id = op.id
        WHERE fe.id = ?
      `, [estimateId]);
    } else {
      // Query regular estimates table
      [estimates] = await connection.execute(`
        SELECT e.*, 
               e.customer_email as estimate_email, e.customer_name as estimate_customer_name,
               c.name as client_name, c.email as client_email, c.phone as client_phone, c.client_id as client_code,
               p.name as property_name, p.property_id as property_code,
               op.community_name as onboarded_property_name, op.property_id as onboarded_property_code,
               op.contact_email as op_email, op.contact_phone as op_phone,
               op.franchise_partner_id
        FROM estimates e
        LEFT JOIN clients c ON e.client_id = c.id
        LEFT JOIN properties p ON e.property_id = p.id
        LEFT JOIN onboarded_properties op ON e.property_id = op.id
        WHERE e.id = ?
      `, [estimateId]);
    }
    
    console.log(`📋 Querying ${source === 'fp' ? 'fp_estimates' : 'estimates'} table for ID: ${estimateId}`);
    console.log(`📋 Query result: Found ${estimates.length} estimate(s)`);
    
    if (estimates.length === 0) {
      console.error(`❌ Estimate not found in ${source === 'fp' ? 'fp_estimates' : 'estimates'} table for ID: ${estimateId}`);
      throw new Error(`Estimate not found in ${source === 'fp' ? 'fp_estimates' : 'estimates'} table`);
    }
    
    const estimate = estimates[0];
    console.log(`📋 Estimate found: ${estimate.estimate_id}, Client: ${estimate.client_name || estimate.estimate_customer_name}, Email: ${estimate.client_email || estimate.estimate_email}`);
    
    // Check if invoice already exists for this estimate (check by source_estimate_id string)
    const [existingInvoice] = await connection.execute(
      'SELECT id, invoice_id FROM invoices WHERE source_estimate_id = ?',
      [estimate.estimate_id]
    );
    
    if (existingInvoice.length > 0) {
      console.log(`Invoice ${existingInvoice[0].invoice_id} already exists for estimate ${estimate.estimate_id}`);
      await connection.rollback();
      return { 
        success: true, 
        alreadyExists: true, 
        invoiceId: existingInvoice[0].invoice_id,
        id: existingInvoice[0].id
      };
    }
    
    // Get estimate line items (only for regular estimates, FP estimates store items in JSON)
    let items = [];
    if (source === 'fp') {
      // FP estimates store:
      // - package_name, package_price: Main AMC package
      // - package_services: Services included in the package (JSON array with descriptions)
      // - addons_data: Add-on services (JSON array with name, description, price, frequency, visits, totalPrice)
      
      // Parse package_services - check multiple possible field names and structures
      let packageServices = [];
      try {
        // Try package_services first
        const rawPkgServices = estimate.package_services || estimate.service_rows || estimate.serviceRows;
        if (rawPkgServices) {
          const parsed = typeof rawPkgServices === 'string' ? JSON.parse(rawPkgServices) : rawPkgServices;
          if (Array.isArray(parsed)) {
            packageServices = parsed;
          } else if (parsed?.serviceRows) {
            packageServices = parsed.serviceRows;
          } else if (parsed?.services) {
            packageServices = parsed.services;
          } else if (parsed?.rows) {
            packageServices = parsed.rows;
          }
        }
        console.log(`📦 Raw package_services parsed: ${packageServices.length} services`);
        if (packageServices.length > 0) {
          console.log(`📦 First service sample:`, JSON.stringify(packageServices[0]));
        }
      } catch (e) { 
        console.log(`⚠️ Error parsing package_services:`, e.message);
        packageServices = []; 
      }
      
      // Parse addons_data
      let addonsData = [];
      try {
        const rawAddons = estimate.addons_data || estimate.addons || estimate.addon_services;
        addonsData = rawAddons ? 
          (typeof rawAddons === 'string' ? JSON.parse(rawAddons) : rawAddons) : [];
        if (!Array.isArray(addonsData)) {
          addonsData = addonsData?.addons || addonsData?.rows || [];
        }
        console.log(`📦 Raw addons_data parsed: ${addonsData.length} addons`);
        if (addonsData.length > 0) {
          console.log(`📦 First addon sample:`, JSON.stringify(addonsData[0]));
        }
      } catch (e) { 
        console.log(`⚠️ Error parsing addons_data:`, e.message);
        addonsData = []; 
      }
      
      console.log(`📦 FP Estimate - Package: ${estimate.package_name}, Services: ${packageServices.length}, Addons: ${addonsData.length}`);
      
      // Calculate package price per service (distribute evenly if services exist)
      const packagePrice = parseFloat(estimate.package_price) || 0;
      const numServices = packageServices.length || 1;
      const pricePerService = packagePrice / numServices;
      
      // Add package services with their descriptions (NOT the package name)
      if (Array.isArray(packageServices) && packageServices.length > 0) {
        packageServices.forEach(service => {
          const serviceName = decodeHtmlEntities(service.name || service.serviceName || service.service_name || service.service || 'Service');
          const serviceDesc = decodeHtmlEntities(service.description || '');
          const frequency = service.frequencyType || service.frequency_type || service.frequency || '';
          const visits = service.frequencyCount || service.frequency_count || service.visits || 1;
          
          items.push({
            description: `${serviceName}${serviceDesc ? ' - ' + serviceDesc.substring(0, 60) : ''}`,
            quantity: 1,
            unit_price: Math.round(pricePerService),
            total_price: Math.round(pricePerService),
            type: 'service',
            frequency: frequency,
            visits: visits
          });
        });
      } else if (estimate.package_name && packagePrice > 0) {
        // Fallback: if no service details, show package services as single item
        items.push({
          description: `AMC Services (${decodeHtmlEntities(estimate.package_name)})`,
          quantity: 1,
          unit_price: packagePrice,
          total_price: packagePrice,
          type: 'service',
          billingDuration: estimate.billing_duration || 'yearly'
        });
      }
      
      // Add add-on services with their descriptions
      if (Array.isArray(addonsData) && addonsData.length > 0) {
        addonsData.forEach(addon => {
          const addonName = decodeHtmlEntities(addon.name || addon.serviceName || addon.service_name || 'Add-on Service');
          const addonDesc = decodeHtmlEntities(addon.description || '');
          const frequency = addon.frequency_type || addon.frequencyType || addon.frequency || '';
          const visits = addon.frequency_count || addon.frequencyCount || addon.visits || addon.quantity || 1;
          // Get the price - could be totalPrice, price, calculatedPrice, etc.
          const addonPrice = parseFloat(addon.totalPrice) || parseFloat(addon.calculatedPrice) || 
                            parseFloat(addon.price) || parseFloat(addon.unitPrice) || 0;
          
          items.push({
            description: `${addonName}${addonDesc ? ' - ' + addonDesc.substring(0, 60) : ''}`,
            quantity: 1,
            unit_price: addonPrice,
            total_price: addonPrice,
            type: 'addon',
            frequency: frequency,
            visits: visits
          });
        });
      }
      
      console.log(`📦 FP Estimate total line items: ${items.length}`);
    } else {
      const [regularItems] = await connection.execute(`
        SELECT ei.*, p.name as package_name, c.name as category_name
        FROM estimate_items ei
        LEFT JOIN packages p ON ei.package_id = p.id
        LEFT JOIN categories c ON ei.category_id = c.id
        WHERE ei.estimate_id = ?
        ORDER BY ei.sort_order
      `, [estimateId]);
      items = regularItems;
    }
    
    // Calculate amounts with 18% GST
    // For FP estimates: subtotal, discount_percent, total_amount
    // For regular estimates: subtotal, discount_percentage
    const subtotalValue = parseFloat(estimate.subtotal) || parseFloat(estimate.total) || parseFloat(estimate.total_amount) || 0;
    const discountValue = parseFloat(estimate.discount_percentage) || parseFloat(estimate.discount_percent) || parseFloat(estimate.discount) || 0;
    const amounts = calculateInvoiceAmounts(subtotalValue, discountValue);
    
    console.log(`💰 Invoice amounts: Subtotal=${subtotalValue}, Discount=${discountValue}%, Total=${amounts.totalAmount}`);
    
    // Prepare line items JSON - include all services and addons
    const lineItems = items.map(item => ({
      description: item.description || item.package_name || item.category_name || item.name || 'Service',
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.unit_price) || parseFloat(item.price) || 0,
      totalPrice: parseFloat(item.total_price) || (parseFloat(item.unit_price || item.price || 0) * (item.quantity || 1)),
      type: item.type || 'service',
      frequency: item.frequency || null,
      visits: item.visits || null,
      billingDuration: item.billingDuration || null,
      packageId: item.package_id,
      categoryId: item.category_id
    }));
    
    console.log(`📋 Line items for invoice: ${JSON.stringify(lineItems)}`);
    
    // Generate invoice ID
    const fpId = estimate.franchise_partner_id || null;
    const invoiceId = await generateInvoiceId(fpId);
    
    // Calculate dates
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);
    
    // Determine customer details (check estimate's own fields first, then linked tables)
    const customerName = estimate.estimate_customer_name || estimate.client_name || estimate.onboarded_property_name || estimate.property_name || 'Customer';
    const customerEmail = estimate.estimate_email || estimate.client_email || estimate.op_email || null;
    const customerPhone = estimate.customer_phone || estimate.client_phone || estimate.op_phone || null;
    const propertyName = estimate.onboarded_property_name || estimate.property_name || null;
    // Property code: use stored property_code, or property_id if it looks like a code (APT-xxx, GC-xxx, etc.)
    let propertyCode = estimate.onboarded_property_code || estimate.property_code || null;
    if (!propertyCode && estimate.property_id && typeof estimate.property_id === 'string' && 
        /^(APT|GC|VILLA|PLOT|FL)-/.test(estimate.property_id)) {
      propertyCode = estimate.property_id;
    }
    
    // Insert invoice
    console.log(`📝 Inserting invoice with ID: ${invoiceId}`);
    console.log(`📝 Customer: ${customerName}, Email: ${customerEmail}, Property: ${propertyName} (${propertyCode}), Total: ${amounts.totalAmount}`);
    
    let result;
    try {
      [result] = await connection.execute(`
        INSERT INTO invoices (
          invoice_id, invoice_type, property_id, property_code, estimate_id, source_estimate_id,
          customer_id, franchise_partner_id, customer_name, customer_email, customer_phone,
          invoice_date, due_date, line_items, 
          subtotal, discount_percentage, discount_amount, 
          tax_percentage, tax_amount, total_amount, 
          amount_paid, balance_amount, status, payment_status,
          auto_generated, created_by, created_by_role, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        'estimate',
        estimate.property_id || null,
        propertyCode, // Store property code string for direct lookup
        estimateId,
        estimate.estimate_id,
        estimate.client_id || null,
        fpId,
        customerName,
        customerEmail,
        customerPhone,
        invoiceDate.toISOString().split('T')[0],
        dueDate.toISOString().split('T')[0],
        JSON.stringify(lineItems),
        amounts.subtotal,
        amounts.discountPercentage,
        amounts.discountAmount,
        amounts.taxPercentage,
        amounts.taxAmount,
        amounts.totalAmount,
        0, // amount_paid
        amounts.balanceAmount,
        'sent', // Auto-generated invoices are marked as sent
        'pending',
        true,
        approvedBy,
        'system',
        `Auto-generated from Estimate ${estimate.estimate_id}`
      ]);
      console.log(`✅ Invoice INSERT successful, ID: ${result.insertId}`);
    } catch (insertError) {
      console.error(`❌ Invoice INSERT failed:`, insertError.message);
      console.error(`❌ SQL Error Code:`, insertError.code);
      console.error(`❌ SQL Error:`, insertError.sqlMessage);
      throw insertError;
    }
    
    const insertedId = result.insertId;
    
    // Update estimate status to 'converted' based on source table
    if (source === 'fp') {
      await connection.execute(
        'UPDATE fp_estimates SET status = ? WHERE id = ?',
        ['converted', estimateId]
      );
    } else {
      await connection.execute(
        'UPDATE estimates SET status = ? WHERE id = ?',
        ['converted', estimateId]
      );
    }
    
    await connection.commit();
    
    console.log(`✅ Invoice ${invoiceId} generated from estimate ${estimate.estimate_id}`);
    console.log(`📧 Customer email for invoice: ${customerEmail || 'NOT FOUND'}`);
    
    // Send email notification (don't await to avoid blocking)
    if (customerEmail) {
      console.log(`📧 Sending invoice email to: ${customerEmail}`);
      sendInvoiceEmailNotification(insertedId, customerEmail, customerName, invoiceId, amounts.totalAmount, dueDate)
        .catch(err => console.error('❌ Failed to send invoice email:', err));
    } else {
      console.log(`⚠️ No customer email found for invoice ${invoiceId} - email not sent`);
    }
    
    return {
      success: true,
      id: insertedId,
      invoiceId,
      totalAmount: amounts.totalAmount,
      customerEmail,
      estimateId: estimate.estimate_id
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Error generating invoice from estimate:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Generate invoice from a completed work order
 * @param {number} workOrderId - The work order ID (internal DB ID)
 * @param {number} completedBy - User ID who completed the work order
 * @returns {Object} Created invoice data
 */
const generateInvoiceFromWorkOrder = async (workOrderId, completedBy = null) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get work order details with client and property info
    const [workOrders] = await connection.execute(`
      SELECT wo.*, 
             c.name as client_name, c.email as client_email, c.phone as client_phone,
             p.name as property_name, p.property_id as property_code,
             op.community_name as onboarded_property_name, op.property_id as onboarded_property_code,
             op.contact_email as op_email, op.contact_phone as op_phone,
             op.franchise_partner_id,
             cat.name as category_name
      FROM work_orders wo
      LEFT JOIN clients c ON wo.client_id = c.id
      LEFT JOIN properties p ON wo.property_id = p.id
      LEFT JOIN onboarded_properties op ON wo.property_id = op.id
      LEFT JOIN categories cat ON wo.category_id = cat.id
      WHERE wo.id = ?
    `, [workOrderId]);
    
    if (workOrders.length === 0) {
      throw new Error('Work order not found');
    }
    
    const workOrder = workOrders[0];
    
    // Check if invoice already exists for this work order
    const [existingInvoice] = await connection.execute(
      'SELECT id, invoice_id FROM invoices WHERE work_order_id = ?',
      [workOrderId]
    );
    
    if (existingInvoice.length > 0) {
      console.log(`Invoice ${existingInvoice[0].invoice_id} already exists for work order ${workOrder.work_order_id}`);
      await connection.rollback();
      return { 
        success: true, 
        alreadyExists: true, 
        invoiceId: existingInvoice[0].invoice_id,
        id: existingInvoice[0].id
      };
    }
    
    // For work orders, we need to calculate costs based on the work order details
    // This could come from vendor pricing, estimated hours, or a flat rate
    // For now, we'll use a placeholder - this should be customized based on actual business logic
    const subtotal = parseFloat(workOrder.estimated_cost) || parseFloat(workOrder.actual_cost) || 0;
    
    // If no cost is defined, skip invoice generation
    if (subtotal <= 0) {
      console.log(`Skipping invoice generation for work order ${workOrder.work_order_id} - no cost defined`);
      await connection.rollback();
      return {
        success: false,
        reason: 'no_cost',
        message: 'Work order has no cost defined'
      };
    }
    
    // Calculate amounts with 18% GST
    const amounts = calculateInvoiceAmounts(subtotal, 0);
    
    // Prepare line items
    const lineItems = [{
      description: workOrder.title || workOrder.category_name || 'Work Order Service',
      quantity: 1,
      unitPrice: subtotal,
      totalPrice: subtotal,
      workOrderId: workOrder.work_order_id
    }];
    
    // Generate invoice ID
    const fpId = workOrder.franchise_partner_id || null;
    const invoiceId = await generateInvoiceId(fpId);
    
    // Calculate dates
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);
    
    // Determine customer details
    const customerName = workOrder.client_name || workOrder.onboarded_property_name || workOrder.property_name || 'Customer';
    const customerEmail = workOrder.client_email || workOrder.op_email || null;
    const customerPhone = workOrder.client_phone || workOrder.op_phone || null;
    
    // Insert invoice
    const [result] = await connection.execute(`
      INSERT INTO invoices (
        invoice_id, invoice_type, property_id, work_order_id, source_work_order_id,
        customer_id, franchise_partner_id, customer_name, customer_email, customer_phone,
        invoice_date, due_date, line_items, 
        subtotal, discount_percentage, discount_amount, 
        tax_percentage, tax_amount, total_amount, 
        amount_paid, balance_amount, status, payment_status,
        auto_generated, created_by, created_by_role, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId,
      'work_order',
      workOrder.property_id,
      workOrderId,
      workOrder.work_order_id,
      workOrder.client_id,
      fpId,
      customerName,
      customerEmail,
      customerPhone,
      invoiceDate.toISOString().split('T')[0],
      dueDate.toISOString().split('T')[0],
      JSON.stringify(lineItems),
      amounts.subtotal,
      0, // discount_percentage
      0, // discount_amount
      amounts.taxPercentage,
      amounts.taxAmount,
      amounts.totalAmount,
      0, // amount_paid
      amounts.balanceAmount,
      'sent',
      'pending',
      true,
      completedBy,
      'system',
      `Auto-generated from Work Order ${workOrder.work_order_id}`
    ]);
    
    const insertedId = result.insertId;
    
    await connection.commit();
    
    console.log(`✅ Invoice ${invoiceId} generated from work order ${workOrder.work_order_id}`);
    
    // Send email notification
    if (customerEmail) {
      sendInvoiceEmailNotification(insertedId, customerEmail, customerName, invoiceId, amounts.totalAmount, dueDate)
        .catch(err => console.error('Failed to send invoice email:', err));
    }
    
    return {
      success: true,
      id: insertedId,
      invoiceId,
      totalAmount: amounts.totalAmount,
      customerEmail,
      workOrderId: workOrder.work_order_id
    };
    
  } catch (error) {
    await connection.rollback();
    console.error('Error generating invoice from work order:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Send invoice email notification with full details matching estimate design
 */
const sendInvoiceEmailNotification = async (invoiceDbId, customerEmail, customerName, invoiceId, totalAmount, dueDate) => {
  try {
    // Import email service here to avoid circular dependency
    const emailService = require('./emailService');
    
    // Fetch full invoice details
    const [invoices] = await pool.execute(`
      SELECT i.*, 
             fe.property_name, fe.property_code, fe.property_type, fe.zone, fe.city, fe.address,
             fe.client_name, fe.client_phone, fe.client_email,
             fe.package_name, fe.package_price, fe.billing_duration,
             fe.subtotal as estimate_subtotal, fe.discount_percent, fe.discount_amount as estimate_discount,
             fe.gst_percent, fe.gst_amount as estimate_gst, fe.total_amount as estimate_total
      FROM invoices i
      LEFT JOIN fp_estimates fe ON i.source_estimate_id = fe.estimate_id
      WHERE i.id = ?
    `, [invoiceDbId]);
    
    const invoice = invoices[0] || {};
    
    const formatCurrency = (amount) => {
      const num = parseFloat(amount) || 0;
      return '₹' + num.toLocaleString('en-IN');
    };
    
    const formatDate = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
      });
    };
    
    // Parse line items
    let lineItems = [];
    try {
      lineItems = invoice.line_items ? (typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items) : [];
      // Decode HTML entities in descriptions
      lineItems = lineItems.map(item => ({
        ...item,
        description: decodeHtmlEntities(item.description),
        name: decodeHtmlEntities(item.name)
      }));
    } catch (e) { lineItems = []; }
    
    // Generate line items HTML
    const lineItemsHtml = lineItems.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px; color: #4a5568;">${idx + 1}</td>
        <td style="padding: 12px; color: #2d3748;">${item.description || item.name || 'Service'}</td>
        <td style="padding: 12px; text-align: center; color: #4a5568;">${item.quantity || 1}</td>
        <td style="padding: 12px; text-align: right; color: #4a5568;">${formatCurrency(item.unitPrice || item.unit_price || 0)}</td>
        <td style="padding: 12px; text-align: right; color: #2d3748; font-weight: 600;">${formatCurrency(item.totalPrice || item.total_price || 0)}</td>
      </tr>
    `).join('');
    
    const subject = `Invoice ${invoiceId} from XLAND INFRA - Payment Due`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceId}</title>
        <!--[if mso]>
        <style type="text/css">
          table { border-collapse: collapse; }
          .mobile-hide { display: table-cell !important; }
        </style>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
          <tr>
            <td align="center" style="padding: 20px 10px;">
              <!-- Main Container -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 24px 20px; text-align: center;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <h1 style="color: #d4a853; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">XLAND INFRA</h1>
                          <p style="color: #888; margin: 4px 0 0; font-size: 11px; letter-spacing: 2px;">PVT LTD</p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
                
                <!-- Invoice Info -->
                <tr>
                  <td style="padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 8px;">
                          <span style="color: #718096; font-size: 12px;">Invoice ID</span><br>
                          <span style="color: #1a365d; font-size: 18px; font-weight: bold;">${invoiceId}</span>
                        </td>
                      </tr>
                      ${invoice.source_estimate_id ? `
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <span style="color: #718096; font-size: 11px;">Estimate: ${invoice.source_estimate_id}</span>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td width="50%" style="vertical-align: top;">
                                <span style="color: #718096; font-size: 11px;">Invoice Date</span><br>
                                <span style="color: #2d3748; font-size: 14px; font-weight: 500;">${formatDate(invoice.invoice_date)}</span>
                              </td>
                              <td width="50%" style="vertical-align: top; text-align: right;">
                                <span style="color: #e53e3e; font-size: 11px;">Due Date</span><br>
                                <span style="color: #e53e3e; font-size: 14px; font-weight: 600;">${formatDate(dueDate)}</span>
                                <br><span style="color: #2b6cb0; font-size: 12px; font-weight: 500;">Billing: ${invoice.billing_duration || 'One-time'}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Amount Highlight -->
                <tr>
                  <td style="padding: 20px; background: linear-gradient(135deg, #2b6cb0 0%, #3182ce 100%); text-align: center;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Total Amount Due</span><br>
                    <span style="color: #ffffff; font-size: 32px; font-weight: bold;">${formatCurrency(totalAmount)}</span>
                  </td>
                </tr>
                
                <!-- Property Details & Customer Details - Side by Side -->
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Property Details -->
                        <td width="48%" style="vertical-align: top; padding-right: 10px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e8f4f8; border-radius: 8px; overflow: hidden; height: 100%;">
                            <tr>
                              <td style="padding: 16px; border-left: 4px solid #3182ce;">
                                <span style="color: #2b6cb0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Property Details</span>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                                  <tr>
                                    <td style="padding: 4px 0; color: #718096; font-size: 13px;">Property ID: ${invoice.property_code || '-'}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">Name:</strong> ${invoice.property_name || invoice.customer_name || '-'}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">Type:</strong> ${invoice.property_type || '-'}</td>
                                  </tr>
                                  ${invoice.zone ? `<tr><td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">Zone:</strong> ${invoice.zone}</td></tr>` : ''}
                                  ${invoice.city ? `<tr><td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">City:</strong> ${invoice.city}</td></tr>` : ''}
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- Customer Details -->
                        <td width="48%" style="vertical-align: top; padding-left: 10px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e8f4f8; border-radius: 8px; overflow: hidden; height: 100%;">
                            <tr>
                              <td style="padding: 16px; border-left: 4px solid #3182ce;">
                                <span style="color: #2b6cb0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Customer Details</span>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                                  <tr>
                                    <td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">Name:</strong> ${customerName || invoice.client_name || '-'}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">Phone:</strong> ${invoice.customer_phone || invoice.client_phone || '-'}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">Email:</strong> ${customerEmail || invoice.client_email || '-'}</td>
                                  </tr>
                                  ${invoice.city ? `<tr><td style="padding: 4px 0; color: #718096; font-size: 13px;"><strong style="color: #2d3748;">City:</strong> ${invoice.city}</td></tr>` : ''}
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Services Included -->
                ${lineItems.length > 0 ? `
                <tr>
                  <td style="padding: 0 20px 20px;">
                    <span style="color: #2d3748; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Services Included</span>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                      <tr style="background: #f7fafc;">
                        <th style="padding: 10px 8px; text-align: center; color: #4a5568; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 30px;">#</th>
                        <th style="padding: 10px 8px; text-align: left; color: #4a5568; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 120px;">Service</th>
                        <th style="padding: 10px 8px; text-align: left; color: #4a5568; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Description</th>
                        <th style="padding: 10px 8px; text-align: center; color: #4a5568; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 80px;">Frequency</th>
                        <th style="padding: 10px 8px; text-align: center; color: #4a5568; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; width: 50px;">Visits</th>
                      </tr>
                      ${lineItems.map((item, idx) => {
                        const fullDesc = item.description || item.name || 'Service';
                        const parts = fullDesc.split(' - ');
                        const serviceName = parts[0] || 'Service';
                        const serviceDesc = parts.slice(1).join(' - ') || '-';
                        const freq = item.frequency || item.frequencyType || item.frequency_type || item.billingDuration || '-';
                        const freqDisplay = freq && freq !== '-' ? freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase() : '-';
                        const visits = item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1;
                        return `
                      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f7fafc'};">
                        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #4a5568; font-size: 13px;">${idx + 1}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #1a365d; font-size: 13px; font-weight: 600;">${serviceName}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #4a5568; font-size: 13px;">${serviceDesc}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #4a5568; font-size: 13px;">${freqDisplay}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #4a5568; font-size: 13px;">${visits}</td>
                      </tr>`;
                      }).join('')}
                    </table>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Amount Summary -->
                <tr>
                  <td style="padding: 0 20px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f7fafc; border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 6px 0; color: #718096; font-size: 13px;">Subtotal</td>
                              <td style="padding: 6px 0; text-align: right; color: #2d3748; font-size: 13px;">${formatCurrency(invoice.subtotal)}</td>
                            </tr>
                            ${parseFloat(invoice.discount_amount) > 0 ? `
                            <tr>
                              <td style="padding: 6px 0; color: #718096; font-size: 13px;">Discount (${invoice.discount_percentage || 0}%)</td>
                              <td style="padding: 6px 0; text-align: right; color: #38a169; font-size: 13px;">-${formatCurrency(invoice.discount_amount)}</td>
                            </tr>
                            ` : ''}
                            <tr>
                              <td style="padding: 6px 0; color: #718096; font-size: 13px;">GST (${invoice.tax_percentage || 18}%)</td>
                              <td style="padding: 6px 0; text-align: right; color: #2d3748; font-size: 13px;">${formatCurrency(invoice.tax_amount)}</td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding: 8px 0;"><hr style="border: none; border-top: 1px solid #e2e8f0; margin: 0;"></td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #1a365d; font-size: 15px; font-weight: bold;">Total</td>
                              <td style="padding: 6px 0; text-align: right; color: #1a365d; font-size: 18px; font-weight: bold;">${formatCurrency(totalAmount)}</td>
                            </tr>
                            ${parseFloat(invoice.amount_paid) > 0 ? `
                            <tr>
                              <td style="padding: 6px 0; color: #38a169; font-size: 13px;">Paid</td>
                              <td style="padding: 6px 0; text-align: right; color: #38a169; font-size: 13px;">${formatCurrency(invoice.amount_paid)}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #e53e3e; font-size: 15px; font-weight: bold;">Balance Due</td>
                              <td style="padding: 6px 0; text-align: right; color: #e53e3e; font-size: 18px; font-weight: bold;">${formatCurrency(invoice.balance_amount || totalAmount)}</td>
                            </tr>
                            ` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Payment Instructions -->
                <tr>
                  <td style="padding: 0 20px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fffbeb; border-radius: 8px; border-left: 4px solid #d4a853;">
                      <tr>
                        <td style="padding: 16px;">
                          <span style="color: #92400e; font-size: 14px; font-weight: 600;">💳 Payment Instructions</span>
                          <p style="margin: 8px 0 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                            Please make the payment before the due date to avoid any late fees.<br>
                            For queries: <a href="mailto:info@xlandinfra.com" style="color: #2563eb; text-decoration: none;">info@xlandinfra.com</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #1a1a1a; padding: 20px; text-align: center;">
                    <p style="color: #d4a853; margin: 0 0 8px; font-size: 14px; font-weight: 600;">XLAND INFRA PVT LTD</p>
                    <p style="color: #888; margin: 0; font-size: 11px;">
                      © ${new Date().getFullYear()} All rights reserved.
                    </p>
                    <p style="color: #666; margin: 8px 0 0; font-size: 10px;">
                      This is an auto-generated invoice. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    // Generate PDF attachment
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateInvoicePDF({
        invoiceId,
        estimateId: invoice.source_estimate_id,
        customerName: customerName || invoice.client_name,
        customerEmail: customerEmail || invoice.client_email,
        customerPhone: invoice.customer_phone || invoice.client_phone,
        propertyName: invoice.property_name,
        propertyCode: invoice.property_code,
        propertyType: invoice.property_type,
        zone: invoice.zone,
        city: invoice.city,
        invoiceDate: invoice.invoice_date,
        dueDate: dueDate,
        billingDuration: invoice.billing_duration,
        lineItems: lineItems,
        subtotal: invoice.subtotal,
        discountAmount: invoice.discount_amount,
        discountPercentage: invoice.discount_percentage,
        taxAmount: invoice.tax_amount,
        taxPercentage: invoice.tax_percentage || 18,
        totalAmount: totalAmount,
        balanceAmount: invoice.balance_amount || totalAmount
      });
      console.log(`📄 Invoice PDF generated for ${invoiceId}`);
    } catch (pdfError) {
      console.error('Failed to generate invoice PDF:', pdfError.message);
      // Continue without PDF attachment
    }

    await emailService.sendEmail({
      to: customerEmail,
      subject,
      html,
      attachments: pdfBuffer ? [{
        filename: `Invoice_${invoiceId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }] : []
    });
    
    // Update invoice to mark email as sent
    await pool.execute(
      'UPDATE invoices SET email_sent_at = NOW(), sent_at = NOW() WHERE id = ?',
      [invoiceDbId]
    );
    
    console.log(`📧 Invoice email sent to ${customerEmail} for invoice ${invoiceId} (with PDF: ${pdfBuffer ? 'yes' : 'no'})`);
    
  } catch (error) {
    console.error('Error sending invoice email:', error);
    throw error;
  }
};

module.exports = {
  generateInvoiceId,
  calculateInvoiceAmounts,
  generateInvoiceFromEstimate,
  generateInvoiceFromWorkOrder,
  sendInvoiceEmailNotification,
  GST_RATE,
  DUE_DATE_DAYS
};
