/**
 * Invoice Service
 * Handles automatic invoice generation from estimates and work orders
 */

const { pool } = require('../config/database');
const { COMPANY, COMPANY_CONTACT_LINES } = require('../utils/companyInfo');
const { generateInvoicePDF } = require('./pdfService');
// Email sending is handled via sendEmail function imported dynamically to avoid circular dependencies

// GST Rate (fixed at 18%)
// Kept only as the statutory rate a screen may offer as a choice. It is NOT a fallback: a
// document's GST is whatever was set on it, and nothing set means 0.
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
 * Calculate invoice amounts.
 *
 * **The GST rate is the document's own, and it defaults to nothing.** This used to apply `GST_RATE`
 * -- a hardcoded 18 -- whatever the estimate said, so an estimate quoted and approved at 0% GST was
 * invoiced at 18%: the customer agreed to one figure and was billed another. The caller passes the
 * rate the estimate carries, and a rate nobody set is 0, as it is on the estimate.
 */
const calculateInvoiceAmounts = (subtotal, discountPercentage = 0, taxPercentage = 0) => {
  const taxPercent = parseFloat(taxPercentage) || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxPercent / 100);
  const totalAmount = taxableAmount + taxAmount;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discountPercentage: parseFloat(discountPercentage.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    taxPercentage: parseFloat(taxPercent.toFixed(2)),
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
      // Also fetch estimate_type to determine if this is a work order estimate
      [estimates] = await connection.execute(`
        SELECT fe.*, 
               fe.client_email as estimate_email, fe.client_name as estimate_customer_name,
               fe.client_phone as customer_phone,
               fe.property_name, 
               COALESCE(fe.property_code, fe.property_id) as property_code,
               fe.total_amount as total,
               fe.estimate_type,
               fe.work_order_id,
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
      // For work order estimates, use work_order_services field
      const isWorkOrderEstimate = estimate.estimate_type === 'work_order';
      let packageServices = [];
      try {
        // For work order estimates, check work_order_services first
        const rawPkgServices = isWorkOrderEstimate 
          ? (estimate.work_order_services || estimate.package_services)
          : (estimate.package_services || estimate.service_rows || estimate.serviceRows);
        
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
        
        // For work order estimates with no services, create one from work order data
        if (isWorkOrderEstimate && (!packageServices || packageServices.length === 0)) {
          console.log(`📦 Creating service from work order data for estimate ${estimate.estimate_id}`);
          const subtotalVal = parseFloat(estimate.subtotal) || parseFloat(estimate.total_amount) || 0;
          packageServices = [{
            name: estimate.work_order_subcategory || estimate.work_order_category || 'Work Order Service',
            description: estimate.work_order_description || estimate.description || `Work Order: ${estimate.work_order_id}`,
            price: subtotalVal,
            frequencyType: 'One-time',
            frequencyCount: 1
          }];
        }
        
        console.log(`📦 Raw package_services parsed: ${packageServices.length} services (isWorkOrder: ${isWorkOrderEstimate})`);
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
      
      console.log(`📦 FP Estimate - Package: ${estimate.package_name}, Services: ${packageServices.length}, Addons: ${addonsData.length}, isWorkOrder: ${isWorkOrderEstimate}`);
      
      // Calculate package price per service (distribute evenly if services exist)
      // For work order estimates, use the service's own price
      const packagePrice = parseFloat(estimate.package_price) || 0;
      const numServices = packageServices.length || 1;
      const pricePerService = packagePrice / numServices;
      
      // Add package services with their descriptions (NOT the package name)
      if (Array.isArray(packageServices) && packageServices.length > 0) {
        console.log(`📦 Processing ${packageServices.length} services for invoice creation`);
        packageServices.forEach((service, idx) => {
          console.log(`📦 Service ${idx + 1} raw data:`, JSON.stringify(service));
          const serviceName = decodeHtmlEntities(service.name || service.serviceName || service.service_name || service.service || 'Service');
          const serviceDesc = decodeHtmlEntities(service.description || '');
          console.log(`📦 Service ${idx + 1}: name="${serviceName}", description="${serviceDesc?.substring(0, 100)}"`);
          const frequency = service.frequencyType || service.frequency_type || service.frequency || '';
          const visits = service.frequencyCount || service.frequency_count || service.visits || 1;
          
          // For work order services, use service's own price; otherwise distribute package price
          const servicePrice = isWorkOrderEstimate 
            ? (parseFloat(service.price) || parseFloat(service.totalPrice) || parseFloat(estimate.subtotal) || 0)
            : pricePerService;
          
          const lineItem = {
            description: `${serviceName}${serviceDesc ? ' - ' + serviceDesc : ''}`,
            name: serviceName,
            details: serviceDesc,
            quantity: 1,
            unit_price: Math.round(servicePrice),
            total_price: Math.round(servicePrice),
            type: 'service',
            frequency: frequency,
            visits: visits
          };
          
          // For work order invoices, include category and subcategory
          if (isWorkOrderEstimate) {
            lineItem.category = estimate.work_order_category || service.category || '';
            lineItem.subcategory = estimate.work_order_subcategory || service.subcategory || '';
            lineItem.serviceCategory = estimate.work_order_category || '';
            lineItem.serviceSubcategory = estimate.work_order_subcategory || '';
          }
          
          items.push(lineItem);
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
            description: `${addonName}${addonDesc ? ' - ' + addonDesc : ''}`,
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
    
    // Calculate amounts at the rate the estimate itself carries -- GST included
    // For FP estimates: subtotal, discount_percent, total_amount
    // For regular estimates: subtotal, discount_percentage
    const subtotalValue = parseFloat(estimate.subtotal) || parseFloat(estimate.total) || parseFloat(estimate.total_amount) || 0;
    const discountValue = parseFloat(estimate.discount_percentage) || parseFloat(estimate.discount_percent) || parseFloat(estimate.discount) || 0;
    const gstValue = parseFloat(estimate.gst_percent) || parseFloat(estimate.gst_percentage) || parseFloat(estimate.tax_percentage) || 0;
    const amounts = calculateInvoiceAmounts(subtotalValue, discountValue, gstValue);
    
    console.log(`💰 Invoice amounts: Subtotal=${subtotalValue}, Discount=${discountValue}%, GST=${gstValue}%, Total=${amounts.totalAmount}`);
    
    // Prepare line items JSON - include all services and addons
    const lineItems = items.map(item => {
      const name = item.name || 'Service';
      const details = item.details || item.service_description || '';
      const desc = item.description || item.package_name || item.category_name || name;
      return {
        name: name,
        description: desc,
        details: details, // Store full description separately
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unit_price) || parseFloat(item.price) || 0,
        totalPrice: parseFloat(item.total_price) || (parseFloat(item.unit_price || item.price || 0) * (item.quantity || 1)),
        type: item.type || 'service',
        frequency: item.frequency || null,
        visits: item.visits || null,
        billingDuration: item.billingDuration || null,
        packageId: item.package_id,
        categoryId: item.category_id
      };
    });
    
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
    
    // Determine invoice type based on estimate type
    // Work order estimates should create work_order invoices
    const invoiceType = estimate.estimate_type === 'work_order' ? 'work_order' : 'estimate';
    const workOrderId = estimate.work_order_id || null;
    
    // Insert invoice
    console.log(`📝 Inserting invoice with ID: ${invoiceId}, Type: ${invoiceType}`);
    console.log(`📝 Customer: ${customerName}, Email: ${customerEmail}, Property: ${propertyName} (${propertyCode}), Total: ${amounts.totalAmount}`);
    if (workOrderId) {
      console.log(`📝 Work Order ID: ${workOrderId}`);
    }
    
    let result;
    try {
      [result] = await connection.execute(`
        INSERT INTO invoices (
          invoice_id, invoice_type, property_id, property_code, estimate_id, source_estimate_id,
          work_order_id, source_work_order_id,
          customer_id, franchise_partner_id, customer_name, customer_email, customer_phone,
          invoice_date, due_date, line_items, 
          subtotal, discount_percentage, discount_amount, 
          tax_percentage, tax_amount, total_amount, 
          amount_paid, balance_amount, status, payment_status,
          auto_generated, created_by, created_by_role, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoiceId,
        invoiceType,
        estimate.property_id || null,
        propertyCode, // Store property code string for direct lookup
        estimateId,
        estimate.estimate_id,
        workOrderId ? null : null, // work_order_id (internal ID) - we don't have it here
        workOrderId, // source_work_order_id (string ID like WO-123456)
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
        'draft', // Auto-generated invoices start as draft for review
        'pending',
        true,
        approvedBy,
        'system',
        workOrderId ? `Auto-generated from Work Order Estimate ${estimate.estimate_id} (WO: ${workOrderId})` : `Auto-generated from Estimate ${estimate.estimate_id}`
      ]);
      console.log(`✅ Invoice INSERT successful, ID: ${result.insertId}`);
    } catch (insertError) {
      console.error(`❌ Invoice INSERT failed:`, insertError.message);
      console.error(`❌ SQL Error Code:`, insertError.code);
      console.error(`❌ SQL Error:`, insertError.sqlMessage);
      throw insertError;
    }
    
    const insertedId = result.insertId;
    
    // Keep estimate status as 'approved' - don't change to 'converted'
    // The invoice status is tracked separately in the invoices table
    // Estimate remains 'approved' for reference
    
    await connection.commit();
    
    console.log(`✅ Invoice ${invoiceId} generated from estimate ${estimate.estimate_id}`);
    console.log(`📧 Customer email for invoice: ${customerEmail || 'NOT FOUND'}`);
    
    // NOTE: Email is NOT sent automatically for draft invoices
    // The team must review the invoice in "Generated Invoices" and click "Send"
    // This prevents sending incorrect or incomplete invoices
    console.log(`📋 Invoice ${invoiceId} created as DRAFT - awaiting team review before sending`);
    
    return {
      success: true,
      id: insertedId,
      invoiceId,
      totalAmount: amounts.totalAmount,
      customerEmail,
      estimateId: estimate.estimate_id,
      emailSent: false,
      paymentLinkCreated: false
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
    
    // A work order carries no GST rate of its own, so the invoice is raised without one
    const amounts = calculateInvoiceAmounts(subtotal, 0, parseFloat(workOrder.gst_percent) || 0);
    
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
 * Create Razorpay payment link for invoice
 */
const createPaymentLinkForInvoice = async (invoiceDbId, invoice) => {
  try {
    const Razorpay = require('razorpay');
    
    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
    
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.log('⚠️ Razorpay not configured - skipping payment link creation');
      return null;
    }
    
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });
    
    // Calculate expiry (7 days from now)
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
    const expiresAtDate = new Date(expiresAt * 1000);
    
    const balanceAmount = parseFloat(invoice.balance_amount) || parseFloat(invoice.total_amount) || 0;
    
    if (balanceAmount <= 0) {
      console.log('⚠️ Invoice has no balance - skipping payment link');
      return null;
    }
    
    // Create Razorpay payment link
    const paymentLinkOptions = {
      amount: Math.round(balanceAmount * 100), // Amount in paise
      currency: 'INR',
      accept_partial: true,
      first_min_partial_amount: 100,
      description: `Payment for Invoice: ${invoice.invoice_id}`,
      customer: {
        name: invoice.customer_name || 'Customer',
        email: invoice.customer_email || undefined,
        contact: invoice.customer_phone || undefined
      },
      notify: {
        sms: false,
        email: false // We send our own email
      },
      reminder_enable: true,
      notes: {
        invoice_id: invoice.invoice_id,
        internal_invoice_id: invoiceDbId.toString(),
        property_id: invoice.property_id?.toString() || '',
        customer_name: invoice.customer_name || ''
      },
      callback_url: `${process.env.FRONTEND_URL || 'https://xlandinfra.com'}/payment/success`,
      callback_method: 'get',
      expire_by: expiresAt
    };
    
    const paymentLink = await razorpay.paymentLink.create(paymentLinkOptions);
    
    // Update invoice with payment link details
    // NOTE: Status stays as 'draft' - invoice remains in "Generated Invoices" until payment is received
    await pool.execute(`
      UPDATE invoices SET
        payment_link = ?,
        razorpay_payment_link_id = ?,
        razorpay_short_url = ?,
        payment_link_created_at = NOW(),
        payment_link_expires_at = ?,
        payment_link_status = 'sent',
        payment_link_sent_at = NOW()
      WHERE id = ?
    `, [
      paymentLink.short_url,
      paymentLink.id,
      paymentLink.short_url,
      expiresAtDate,
      invoiceDbId
    ]);
    
    console.log(`✅ Payment link created for invoice ${invoice.invoice_id}: ${paymentLink.short_url}`);
    return paymentLink.short_url;
    
  } catch (error) {
    console.error('❌ Error creating payment link:', error.message);
    return null;
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
    
    // Create Razorpay payment link (stores in DB for later use)
    await createPaymentLinkForInvoice(invoiceDbId, invoice);
    
    // Link to our custom payment page (shows payment method selection)
    const frontendUrl = process.env.FRONTEND_URL || 'https://xlandinfra.com';
    const paymentPageUrl = `${frontendUrl}/pay/${invoiceId}`;
    
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
      // Decode HTML entities in descriptions and use details as fallback
      lineItems = lineItems.map(item => {
        const name = decodeHtmlEntities(item.name || '');
        const details = decodeHtmlEntities(item.details || '');
        const desc = decodeHtmlEntities(item.description || '');
        // Build full description: if details exist, use "name - details", otherwise use description
        const fullDescription = details ? `${name} - ${details}` : (desc || name || 'Service');
        return {
          ...item,
          description: fullDescription,
          name: name
        };
      });
    } catch (e) { lineItems = []; }
    
    // Generate line items HTML - Table format: # | Service | Description | Frequency | Visits (Gold Theme)
    const lineItemsHtml = lineItems.map((item, idx) => {
      const name = item.name || 'Service';
      const details = item.details || '';
      const freq = item.frequency || item.frequencyType || item.frequency_type || '-';
      const freqDisplay = freq && freq !== '-' ? freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase() : '-';
      const visits = item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1;
      return `
      <tr>
        <td style="padding: 7px 8px; border-bottom: 1px solid #EADFCF; font-size: 12px; color: #6B7280; vertical-align: top; width: 22px;">${idx + 1}</td>
        <td style="padding: 7px 8px; border-bottom: 1px solid #EADFCF; font-size: 12px; color: #1F2937; vertical-align: top;"><strong style="color: #111827;">${name}</strong></td>
        <td style="padding: 7px 8px; border-bottom: 1px solid #EADFCF; font-size: 11px; color: #6B7280; vertical-align: top; text-align: center;">${details || '-'}</td>
        <td style="padding: 7px 8px; border-bottom: 1px solid #EADFCF; font-size: 12px; color: #1F2937; vertical-align: top; text-align: center;">${freqDisplay}</td>
        <td style="padding: 7px 8px; border-bottom: 1px solid #EADFCF; font-size: 12px; color: #1F2937; vertical-align: top; text-align: right;">${visits}</td>
      </tr>
    `;
    }).join('');
    
    // The same letterhead, ruled tables and summary card as the estimate email, drawn from the same
    // company record. What it replaced was a navy-and-gold layout of its own: a centred lockup in a
    // black band, From and Bill To cards in blue, a gold-banded items table and a full-width totals
    // list -- nothing a customer could recognise as the estimate they had approved a week earlier.
    const warm = { section: '#FFF9EE', accentSoft: '#FEF3E2', border: '#EADFCF', accent: '#D4A574', text: '#1F2937', muted: '#6B7280' };
    const heading = label => `<p style="margin: 24px 0 11px 0; color: ${warm.text}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px;">${label}</p>`;
    const metaField = (label, value, colour = '#111827') => (value === undefined || value === null || value === '' ? '' : `
      <td width="25%" style="padding: 0 10px 0 0; vertical-align: top;">
        <span style="font-size: 9px; letter-spacing: 0.9px; text-transform: uppercase; color: ${warm.muted}; font-weight: 600;">${label}</span><br>
        <span style="font-size: 12px; font-weight: 600; color: ${colour};">${value}</span>
      </td>`);
    const partyRow = (label, value) => (value === undefined || value === null || value === '' ? '' : `
      <tr>
        <td style="padding: 1px 8px 1px 0; font-size: 10px; letter-spacing: 0.3px; text-transform: uppercase; color: ${warm.muted}; font-weight: 600; vertical-align: top; white-space: nowrap;">${label}</td>
        <td style="padding: 1px 0; font-size: 12px; color: #374151; vertical-align: top; word-break: break-word;">${value}</td>
      </tr>`);
    const summaryLine = (label, value, colour = warm.text) => `
      <tr>
        <td style="padding: 6px 12px; font-size: 12px; color: ${warm.muted}; border-bottom: 1px solid ${warm.border};">${label}</td>
        <td style="padding: 6px 12px; font-size: 12px; font-weight: 600; color: ${colour}; text-align: right; border-bottom: 1px solid ${warm.border}; white-space: nowrap;">${value}</td>
      </tr>`;
    const detailRow = (label, value, span = 1) => (value === undefined || value === null || value === '' ? '' : `
      <td width="16%" style="background: ${warm.section}; border: 1px solid ${warm.border}; padding: 6px 9px; font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: ${warm.muted}; vertical-align: top;">${label}</td>
      <td ${span > 1 ? `colspan="${span}" ` : ''}style="border: 1px solid ${warm.border}; padding: 6px 9px; font-size: 12px; font-weight: 600; color: ${warm.text}; vertical-align: top; word-break: break-word;">${value}</td>`);

    const propertyPairs = [
      ['Name', invoice.property_name], ['Type', invoice.property_type], ['Property ID', invoice.property_code],
      ['Zone', invoice.zone], ['City', invoice.city], ['Billing', invoice.billing_duration || 'One-time'],
      ['Estimate', invoice.source_estimate_id]
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');
    const propertyLines = [];
    for (let index = 0; index < propertyPairs.length; index += 2) propertyLines.push(propertyPairs.slice(index, index + 2));

    const amountPaid = parseFloat(invoice.amount_paid) || 0;
    const balanceDue = invoice.balance_amount === undefined || invoice.balance_amount === null
      ? totalAmount : parseFloat(invoice.balance_amount) || 0;

    const subject = `Invoice ${invoiceId} from ${COMPANY.legalName} - Payment Due`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceId}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 640px; margin: 0 auto; padding: 20px;">
          <div style="background: #C9A227; height: 6px; border-radius: 12px 12px 0 0;"></div>

          <div style="background: #ffffff; padding: 26px 28px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

            <!-- Letterhead: the company centred on the left, BILL TO facing it on the right -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="vertical-align: top; padding-right: 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td style="vertical-align: middle; padding-right: 12px;">
                        <img src="cid:xland-logo" alt="" width="50" height="50" style="display: block; width: 50px; height: 50px; object-fit: contain;">
                      </td>
                      <td style="vertical-align: middle; padding-top: 7px;">
                        <div style="font-size: 18px; font-weight: 700; letter-spacing: 2.4px; color: #1a1a1a; line-height: 1;">${COMPANY.name}</div>
                        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 6px auto 0;">
                          <tr>
                            <td width="22" style="vertical-align: middle;"><div style="height: 1px; background: #1a1a1a; font-size: 1px; line-height: 1px;">&#8203;</div></td>
                            <td style="padding: 0 7px;"><span style="color: #1a1a1a; font-size: 9px; letter-spacing: 3px; font-weight: 600;">${COMPANY.suffix}</span></td>
                            <td width="22" style="vertical-align: middle;"><div style="height: 1px; background: #1a1a1a; font-size: 1px; line-height: 1px;">&#8203;</div></td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 9px auto 0;">
                    <tr>
                      <td style="font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; color: ${warm.muted}; padding-bottom: 5px;">${COMPANY.tagline}</td>
                    </tr>
                    ${COMPANY.addressLines.map(line => `
                    <tr>
                      <td style="font-size: 11px; line-height: 1.7; color: #4b5563;">${line}</td>
                    </tr>`).join('')}
                    <!-- The phone, the email and the website share a single line beneath the
                         address, each behind its own icon. Stacked, the three of them made the
                         block six lines deep for what is one thought: how to reach us. -->
                    <tr>
                      <td style="padding-top: 3px;">
                        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                          ${COMPANY_CONTACT_LINES.map(([kind, value], index) => `
                          ${index ? '<td style="width: 12px;"></td>' : ''}
                          <td style="padding: 0 3px 0 0; vertical-align: middle; line-height: 0;">
                            <img src="cid:xland-icon-${kind}" alt="" width="11" height="11" style="display: block; width: 11px; height: 11px;">
                          </td>
                          <td style="font-size: 11px; color: #4b5563; vertical-align: middle; white-space: nowrap;">${value}</td>`).join('')}
                        </tr></table>
                      </td>
                    </tr>
                  </table>
                </td>
                <td width="240" style="vertical-align: top;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid ${warm.border}; border-radius: 8px; border-collapse: separate;">
                    <tr>
                      <td style="background: ${warm.accentSoft}; border-bottom: 1px solid ${warm.border}; padding: 6px 12px; font-size: 9.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #8A6D12; border-radius: 8px 8px 0 0;">Bill To</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 12px;">
                        <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 5px;">${customerName || invoice.client_name || 'Customer'}</div>
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          ${partyRow('Phone', invoice.customer_phone || invoice.client_phone)}
                          ${partyRow('Email', customerEmail || invoice.client_email)}
                          ${partyRow('Property', invoice.property_name)}
                          ${partyRow('Prop ID', invoice.property_code)}
                          ${partyRow('City', invoice.city)}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- The strip. The due date is the one figure carrying a deadline, so it is picked out. -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 18px; background: ${warm.section}; border-top: 1px solid ${warm.border}; border-bottom: 1px solid ${warm.border};">
              <tr>
                <td style="padding: 9px 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
                    <tr>
                      ${metaField('Invoice No.', invoiceId)}
                      ${metaField('Date', formatDate(invoice.invoice_date))}
                      ${metaField('Due Date', formatDate(dueDate), '#b91c1c')}
                      ${metaField('Balance Due', formatCurrency(balanceDue))}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <h2 style="color: #1f2937; margin: 22px 0 6px 0; font-size: 17px;">Hello ${customerName || invoice.client_name || 'Valued Customer'},</h2>
            <p style="color: #4b5563; line-height: 1.7; margin: 0; font-size: 13px;">
              Please find your invoice below${invoice.source_estimate_id ? `, raised from estimate ${invoice.source_estimate_id}` : ''}.
              The full breakdown is in the attached PDF.
            </p>

            ${propertyLines.length ? `${heading('Property Details')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; table-layout: fixed; border-collapse: collapse;">
              ${propertyLines.map(line => `
              <tr>
                ${line.map(([label, value]) => detailRow(label, value)).join('')}
                ${line.length === 1 ? `<td style="border: 1px solid ${warm.border};" colspan="2">&nbsp;</td>` : ''}
              </tr>`).join('')}
            </table>` : ''}

            ${lineItemsHtml ? `${heading('Services Billed')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
              <tr>
                ${['#', 'Service', 'Description', 'Frequency', 'Visits'].map((label, index) => `
                <th style="background: ${warm.section}; color: ${warm.muted}; font-size: 9.5px; letter-spacing: 0.6px; text-transform: uppercase;
                  font-weight: 700; padding: 7px 8px; border-bottom: 1px solid ${warm.border};
                  text-align: ${index === 4 ? 'right' : index >= 2 ? 'center' : 'left'};">${label}</th>`).join('')}
              </tr>
              ${lineItemsHtml}
            </table>` : ''}

            <!-- Invoice Summary, against the right edge as it is on the PDF -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 18px;">
              <tr>
                <td align="right">
                  <table role="presentation" width="280" cellpadding="0" cellspacing="0" style="border: 1px solid ${warm.border}; border-collapse: separate; border-radius: 8px;">
                    <tr>
                      <td colspan="2" style="background: ${warm.section}; border-bottom: 1px solid ${warm.border}; padding: 6px 12px; font-size: 9.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: ${warm.muted}; border-radius: 8px 8px 0 0;">Invoice Summary</td>
                    </tr>
                    ${summaryLine('Subtotal', formatCurrency(invoice.subtotal))}
                    ${parseFloat(invoice.discount_amount) > 0 ? summaryLine(`Discount (${invoice.discount_percentage || 0}%)`, `- ${formatCurrency(invoice.discount_amount)}`, '#047857') : ''}
                    ${summaryLine(`GST (${parseFloat(invoice.tax_percentage) || 0}%)`, formatCurrency(invoice.tax_amount))}
                    ${amountPaid > 0 ? summaryLine('Amount Paid', `- ${formatCurrency(amountPaid)}`, '#047857') : ''}
                    ${amountPaid > 0 ? summaryLine('Balance Due', formatCurrency(balanceDue)) : ''}
                    <tr>
                      <td style="background: ${warm.accent}; padding: 10px 12px; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: ${warm.text}; border-radius: 0 0 0 8px;">Total</td>
                      <td style="background: ${warm.accent}; padding: 10px 12px; font-size: 16px; font-weight: 700; color: ${warm.text}; text-align: right; white-space: nowrap; border-radius: 0 0 8px 0;">${formatCurrency(totalAmount)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            ${paymentPageUrl ? `<div style="margin: 28px 0 0;">
              <p style="color: #374151; font-weight: 600; margin: 0 0 16px 0; font-size: 15px; text-align: center;">Ready to pay?</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td>
                    <a href="${paymentPageUrl}" style="display: block; width: 240px; background: #059669; color: #ffffff; text-decoration: none; padding: 14px 0; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; white-space: nowrap;">Pay ${formatCurrency(balanceDue)}</a>
                  </td>
                </tr>
              </table>
            </div>` : ''}

            <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 13px 15px; margin-top: 22px; text-align: center;">
              <p style="color: #065f46; margin: 0; font-size: 13px;">
                <strong>&#128206; Invoice_${invoiceId}.pdf attached</strong><br>
                <span style="font-size: 12px; color: #047857;">The complete breakdown of services, pricing and payment details.</span>
              </p>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 13px 15px; margin-top: 12px;">
              <p style="color: #92400e; margin: 0; font-size: 13px;">
                <strong>&#9888; Payment due by ${formatDate(dueDate)}.</strong>
              </p>
            </div>

            <p style="color: #4b5563; line-height: 1.7; margin: 22px 0 0 0; font-size: 13px;">
              Any questions about this invoice? Write to <a href="mailto:${COMPANY.email}" style="color: #1e40af;">${COMPANY.email}</a>
              or call ${COMPANY.phone}.
            </p>
          </div>

          <!-- Footer: the company and how to reach it, and nothing else -->
          <div style="text-align: center; padding: 18px 20px; color: #9ca3af; font-size: 11px; line-height: 1.7;">
            <p style="margin: 0; color: #1a1a1a; font-weight: 700; letter-spacing: 1.6px;">${COMPANY.legalName}</p>
            <p style="margin: 6px 0 0 0;">${COMPANY.addressLines.join(', ')}</p>
            <p style="margin: 6px 0 0 0;">&copy; ${new Date().getFullYear()} ${COMPANY.legalName}. All rights reserved.</p>
          </div>
        </div>
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
        taxPercentage: parseFloat(invoice.tax_percentage) || 0,
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
      // The letterhead's logo and contact icons travel with the message, as the estimate's do:
      // its `cid:` references have nothing behind them otherwise and the header breaks.
      attachments: [
        ...emailService.BRAND_INLINE_IMAGES,
        ...(pdfBuffer ? [{
          filename: `Invoice_${invoiceId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }] : [])
      ]
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
  createPaymentLinkForInvoice,
  GST_RATE,
  DUE_DATE_DAYS
};
