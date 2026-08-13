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
        packageServices.forEach(service => {
          const serviceName = decodeHtmlEntities(service.name || service.serviceName || service.service_name || service.service || 'Service');
          const serviceDesc = decodeHtmlEntities(service.description || '');
          const frequency = service.frequencyType || service.frequency_type || service.frequency || '';
          const visits = service.frequencyCount || service.frequency_count || service.visits || 1;
          
          // For work order services, use service's own price; otherwise distribute package price
          const servicePrice = isWorkOrderEstimate 
            ? (parseFloat(service.price) || parseFloat(service.totalPrice) || parseFloat(estimate.subtotal) || 0)
            : pricePerService;
          
          items.push({
            description: `${serviceName}${serviceDesc ? ' - ' + serviceDesc : ''}`,
            quantity: 1,
            unit_price: Math.round(servicePrice),
            total_price: Math.round(servicePrice),
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
        'sent', // Auto-generated invoices are marked as sent
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
    await pool.execute(`
      UPDATE invoices SET
        payment_link = ?,
        razorpay_payment_link_id = ?,
        razorpay_short_url = ?,
        payment_link_created_at = NOW(),
        payment_link_expires_at = ?,
        payment_link_status = 'sent',
        payment_link_sent_at = NOW(),
        status = 'sent'
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
    
    // Create Razorpay payment link
    const paymentLink = await createPaymentLinkForInvoice(invoiceDbId, invoice);
    
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
    
    const subject = `Invoice ${invoiceId} from XLAND INFRA PVT LTD - Payment Due`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoiceId}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
          <tr>
            <td align="center" style="padding: 20px 10px;">
              <!-- Main Container -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                
                <!-- Header with Logo and Company Info -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 24px 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="vertical-align: middle;">
                          <!-- Company Logo & Name -->
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-right: 12px; vertical-align: middle;">
                                <div style="width: 50px; height: 50px; background: #d4a853; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                  <span style="color: #1a1a1a; font-size: 24px; font-weight: bold;">X</span>
                                </div>
                              </td>
                              <td style="vertical-align: middle;">
                                <h1 style="color: #d4a853; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 1px;">XLAND INFRA</h1>
                                <p style="color: #888; margin: 2px 0 0; font-size: 11px; letter-spacing: 2px;">PVT LTD</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" style="vertical-align: middle; text-align: right;">
                          <span style="display: inline-block; background: #d4a853; color: #1a1a1a; padding: 8px 20px; border-radius: 4px; font-size: 18px; font-weight: bold; letter-spacing: 2px;">INVOICE</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Invoice Number & Dates Row -->
                <tr>
                  <td style="padding: 20px 30px; background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" style="vertical-align: top;">
                          <span style="color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Invoice No.</span><br>
                          <span style="color: #1a365d; font-size: 16px; font-weight: bold;">${invoiceId}</span>
                          ${invoice.source_estimate_id ? `<br><span style="color: #718096; font-size: 10px;">Ref: ${invoice.source_estimate_id}</span>` : ''}
                        </td>
                        <td width="33%" style="vertical-align: top; text-align: center;">
                          <span style="color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Invoice Date</span><br>
                          <span style="color: #2d3748; font-size: 14px; font-weight: 600;">${formatDate(invoice.invoice_date)}</span>
                        </td>
                        <td width="33%" style="vertical-align: top; text-align: right;">
                          <span style="color: #e53e3e; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Due Date</span><br>
                          <span style="color: #e53e3e; font-size: 14px; font-weight: 600;">${formatDate(dueDate)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- From & Bill To Section -->
                <tr>
                  <td style="padding: 25px 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- FROM: Company Details -->
                        <td width="48%" style="vertical-align: top; padding-right: 15px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #1a1a1a; border-radius: 8px; overflow: hidden;">
                            <tr>
                              <td style="padding: 16px 18px;">
                                <span style="color: #d4a853; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">From</span>
                                <h3 style="color: #ffffff; margin: 8px 0 4px; font-size: 15px; font-weight: bold;">XLAND INFRA PVT LTD</h3>
                                <p style="color: #a0aec0; margin: 0; font-size: 12px; line-height: 1.6;">
                                  Property Management Services<br>
                                  D.No. 7-333/A/1, Nri Hospital Road<br>
                                  Mangalagiri, Guntur, 522503<br>
                                  <span style="color: #d4a853;">Email:</span> info@xlandinfra.com<br>
                                  <span style="color: #d4a853;">Phone:</span> +91 8500 010 111
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <!-- BILL TO: Customer Details -->
                        <td width="48%" style="vertical-align: top; padding-left: 15px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f0f9ff; border-radius: 8px; overflow: hidden; border: 1px solid #bfdbfe;">
                            <tr>
                              <td style="padding: 16px 18px;">
                                <span style="color: #1e40af; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Bill To</span>
                                <h3 style="color: #1e3a5f; margin: 8px 0 4px; font-size: 15px; font-weight: bold;">${customerName || invoice.client_name || 'Customer'}</h3>
                                <p style="color: #475569; margin: 0; font-size: 12px; line-height: 1.6;">
                                  ${invoice.property_name ? `<strong>Property:</strong> ${invoice.property_name}<br>` : ''}
                                  ${invoice.property_code ? `<strong>Property ID:</strong> ${invoice.property_code}<br>` : ''}
                                  ${invoice.property_type ? `<strong>Type:</strong> ${invoice.property_type}<br>` : ''}
                                  ${invoice.city || invoice.zone ? `${invoice.city || ''}${invoice.city && invoice.zone ? ', ' : ''}${invoice.zone || ''}<br>` : ''}
                                  <strong>Phone:</strong> ${invoice.customer_phone || invoice.client_phone || '-'}<br>
                                  <strong>Email:</strong> ${customerEmail || invoice.client_email || '-'}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Amount Due Highlight -->
                <tr>
                  <td style="padding: 0 30px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 8px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px; text-align: center;">
                          <span style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Total Amount Due</span><br>
                          <span style="color: #ffffff; font-size: 36px; font-weight: bold;">${formatCurrency(totalAmount)}</span>
                          <br><span style="color: rgba(255,255,255,0.7); font-size: 11px;">Billing: ${invoice.billing_duration || 'One-time'}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- AMC Services Section -->
                ${lineItems.filter(i => i.type === 'service' || !i.type).length > 0 ? `
                <tr>
                  <td style="padding: 0 30px 20px;">
                    <div style="background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; overflow: hidden;">
                      <div style="background: #16a34a; padding: 12px 16px;">
                        <span style="color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📋 AMC Services</span>
                      </div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr style="background: #dcfce7;">
                          <th style="padding: 10px 12px; text-align: left; color: #166534; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #bbf7d0;">Service</th>
                          <th style="padding: 10px 12px; text-align: center; color: #166534; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #bbf7d0; width: 80px;">Frequency</th>
                          <th style="padding: 10px 12px; text-align: center; color: #166534; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #bbf7d0; width: 50px;">Visits</th>
                          <th style="padding: 10px 12px; text-align: right; color: #166534; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #bbf7d0; width: 90px;">Amount</th>
                        </tr>
                        ${lineItems.filter(i => i.type === 'service' || !i.type).map((item, idx) => {
                          const fullDesc = item.description || item.name || 'Service';
                          const parts = fullDesc.split(' - ');
                          const serviceName = parts[0] || 'Service';
                          const serviceDesc = parts.slice(1).join(' - ') || '';
                          const freq = item.frequency || item.frequencyType || item.frequency_type || item.billingDuration || '-';
                          const freqDisplay = freq && freq !== '-' ? freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase() : '-';
                          const visits = item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1;
                          const price = item.totalPrice || item.total_price || item.unitPrice || item.unit_price || 0;
                          return `
                        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f0fdf4'};">
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                            <strong style="color: #166534; font-size: 13px;">${serviceName}</strong>
                            ${serviceDesc ? `<br><span style="color: #6b7280; font-size: 11px; line-height: 1.4;">${serviceDesc}</span>` : ''}
                          </td>
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 12px; vertical-align: top;">${freqDisplay}</td>
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 12px; vertical-align: top;">${visits}</td>
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #166534; font-size: 13px; font-weight: 600; vertical-align: top;">${formatCurrency(price)}</td>
                        </tr>`;
                        }).join('')}
                      </table>
                    </div>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Add-ons Section -->
                ${lineItems.filter(i => i.type === 'addon').length > 0 ? `
                <tr>
                  <td style="padding: 0 30px 20px;">
                    <div style="background: #fefce8; border-radius: 8px; border: 1px solid #fde047; overflow: hidden;">
                      <div style="background: #ca8a04; padding: 12px 16px;">
                        <span style="color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">➕ Add-on Services</span>
                      </div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr style="background: #fef9c3;">
                          <th style="padding: 10px 12px; text-align: left; color: #854d0e; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #fde047;">Add-on</th>
                          <th style="padding: 10px 12px; text-align: center; color: #854d0e; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #fde047; width: 80px;">Frequency</th>
                          <th style="padding: 10px 12px; text-align: center; color: #854d0e; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #fde047; width: 50px;">Visits</th>
                          <th style="padding: 10px 12px; text-align: right; color: #854d0e; font-size: 11px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #fde047; width: 90px;">Amount</th>
                        </tr>
                        ${lineItems.filter(i => i.type === 'addon').map((item, idx) => {
                          const fullDesc = item.description || item.name || 'Add-on';
                          const parts = fullDesc.split(' - ');
                          const addonName = parts[0] || 'Add-on';
                          const addonDesc = parts.slice(1).join(' - ') || '';
                          const freq = item.frequency || item.frequencyType || item.frequency_type || '-';
                          const freqDisplay = freq && freq !== '-' ? freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase() : '-';
                          const visits = item.visits || item.frequencyCount || item.frequency_count || item.quantity || 1;
                          const price = item.totalPrice || item.total_price || item.unitPrice || item.unit_price || 0;
                          return `
                        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fefce8'};">
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
                            <strong style="color: #854d0e; font-size: 13px;">${addonName}</strong>
                            ${addonDesc ? `<br><span style="color: #6b7280; font-size: 11px; line-height: 1.4;">${addonDesc}</span>` : ''}
                          </td>
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 12px; vertical-align: top;">${freqDisplay}</td>
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #4b5563; font-size: 12px; vertical-align: top;">${visits}</td>
                          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #854d0e; font-size: 13px; font-weight: 600; vertical-align: top;">${formatCurrency(price)}</td>
                        </tr>`;
                        }).join('')}
                      </table>
                    </div>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Price Summary -->
                <tr>
                  <td style="padding: 0 30px 20px;">
                    <div style="background: #1e293b; border-radius: 8px; overflow: hidden;">
                      <div style="padding: 14px 16px; border-bottom: 1px solid #334155;">
                        <span style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">💰 Price Summary</span>
                      </div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 16px;">
                        <tr>
                          <td style="padding: 8px 16px; color: #94a3b8; font-size: 13px;">Subtotal</td>
                          <td style="padding: 8px 16px; text-align: right; color: #e2e8f0; font-size: 13px;">${formatCurrency(invoice.subtotal)}</td>
                        </tr>
                        ${parseFloat(invoice.discount_amount) > 0 ? `
                        <tr>
                          <td style="padding: 8px 16px; color: #94a3b8; font-size: 13px;">Discount (${invoice.discount_percentage || 0}%)</td>
                          <td style="padding: 8px 16px; text-align: right; color: #4ade80; font-size: 13px;">-${formatCurrency(invoice.discount_amount)}</td>
                        </tr>
                        ` : ''}
                        <tr>
                          <td style="padding: 8px 16px; color: #94a3b8; font-size: 13px;">GST (${invoice.tax_percentage || 18}%)</td>
                          <td style="padding: 8px 16px; text-align: right; color: #e2e8f0; font-size: 13px;">${formatCurrency(invoice.tax_amount)}</td>
                        </tr>
                        <tr>
                          <td colspan="2" style="padding: 8px 16px;"><hr style="border: none; border-top: 1px solid #475569; margin: 0;"></td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 16px; color: #ffffff; font-size: 16px; font-weight: bold;">Grand Total</td>
                          <td style="padding: 10px 16px; text-align: right; color: #fbbf24; font-size: 20px; font-weight: bold;">${formatCurrency(totalAmount)}</td>
                        </tr>
                        ${parseFloat(invoice.amount_paid) > 0 ? `
                        <tr>
                          <td colspan="2" style="padding: 4px 16px;"><hr style="border: none; border-top: 1px dashed #475569; margin: 0;"></td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 16px; color: #4ade80; font-size: 13px;">Amount Paid</td>
                          <td style="padding: 8px 16px; text-align: right; color: #4ade80; font-size: 13px;">${formatCurrency(invoice.amount_paid)}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 16px; color: #f87171; font-size: 15px; font-weight: bold;">Balance Due</td>
                          <td style="padding: 10px 16px; text-align: right; color: #f87171; font-size: 18px; font-weight: bold;">${formatCurrency(invoice.balance_amount || totalAmount)}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>
                  </td>
                </tr>
                
                <!-- Pay Now Button -->
                ${paymentLink ? `
                <tr>
                  <td style="padding: 0 30px 20px; text-align: center;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4);">
                            💳 PAY NOW
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding-top: 12px;">
                          <p style="margin: 0; color: #6b7280; font-size: 12px;">Secure payment powered by Razorpay</p>
                          <p style="margin: 4px 0 0; color: #9ca3af; font-size: 11px;">UPI • Cards • Net Banking • Wallets</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                
                <!-- Terms & Payment Info -->
                <tr>
                  <td style="padding: 0 30px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fefce8; border-radius: 8px; border: 1px solid #fde047;">
                      <tr>
                        <td style="padding: 16px 18px;">
                          <span style="color: #854d0e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Terms & Conditions</span>
                          <ul style="margin: 10px 0 0; padding-left: 18px; color: #713f12; font-size: 11px; line-height: 1.7;">
                            <li>Payment is due within 14 days of invoice date</li>
                            <li>Late payments may incur additional charges</li>
                            <li>All services are subject to our standard terms of service</li>
                          </ul>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 25px 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <h3 style="color: #d4a853; margin: 0 0 4px; font-size: 16px; font-weight: bold; letter-spacing: 1px;">XLAND INFRA PVT LTD</h3>
                          <p style="color: #9ca3af; margin: 0 0 12px; font-size: 11px;">Your Trusted Property Management Partner</p>
                          <p style="color: #6b7280; margin: 0; font-size: 11px; line-height: 1.6;">
                            D.No. 7-333/A/1, Nri Hospital Road, Mangalagiri, Guntur - 522503<br>
                            Phone: +91 8500 010 111 | Email: info@xlandinfra.com
                          </p>
                          <hr style="border: none; border-top: 1px solid #374151; margin: 15px 0;">
                          <p style="color: #6b7280; margin: 0; font-size: 10px;">
                            © ${new Date().getFullYear()} XLAND INFRA PVT LTD. All rights reserved.<br>
                            This is a computer-generated invoice and does not require a signature.
                          </p>
                        </td>
                      </tr>
                    </table>
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
