/**
 * Invoice Service
 * Handles automatic invoice generation from estimates and work orders
 */

const { pool } = require('../config/database');
// Email sending is handled via sendEmail function imported dynamically to avoid circular dependencies

// GST Rate (fixed at 18%)
const GST_RATE = 18;

// Due date offset in days
const DUE_DATE_DAYS = 14;

/**
 * Generate unique invoice ID
 */
const generateInvoiceId = async (fpId = null) => {
  const year = new Date().getFullYear();
  const prefix = 'INV';
  
  try {
    const [existing] = await pool.execute(
      'SELECT current_number FROM invoice_sequence WHERE franchise_partner_id <=> ? AND year = ?',
      [fpId, year]
    );
    
    let nextNumber;
    if (existing.length > 0) {
      nextNumber = existing[0].current_number + 1;
      await pool.execute(
        'UPDATE invoice_sequence SET current_number = ? WHERE franchise_partner_id <=> ? AND year = ?',
        [nextNumber, fpId, year]
      );
    } else {
      nextNumber = 1;
      await pool.execute(
        'INSERT INTO invoice_sequence (franchise_partner_id, year, current_number, prefix) VALUES (?, ?, ?, ?)',
        [fpId, year, nextNumber, prefix]
      );
    }
    
    return `${prefix}-${year}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
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
 * @returns {Object} Created invoice data
 */
const generateInvoiceFromEstimate = async (estimateId, approvedBy = null) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Get estimate details with client and property info
    const [estimates] = await connection.execute(`
      SELECT e.*, 
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
    
    if (estimates.length === 0) {
      throw new Error('Estimate not found');
    }
    
    const estimate = estimates[0];
    
    // Check if invoice already exists for this estimate
    const [existingInvoice] = await connection.execute(
      'SELECT id, invoice_id FROM invoices WHERE estimate_id = ?',
      [estimateId]
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
    
    // Get estimate line items
    const [items] = await connection.execute(`
      SELECT ei.*, p.name as package_name, c.name as category_name
      FROM estimate_items ei
      LEFT JOIN packages p ON ei.package_id = p.id
      LEFT JOIN categories c ON ei.category_id = c.id
      WHERE ei.estimate_id = ?
      ORDER BY ei.sort_order
    `, [estimateId]);
    
    // Calculate amounts with 18% GST
    const amounts = calculateInvoiceAmounts(
      parseFloat(estimate.subtotal) || 0,
      parseFloat(estimate.discount_percentage) || 0
    );
    
    // Prepare line items JSON
    const lineItems = items.map(item => ({
      description: item.description || item.package_name || item.category_name || 'Service',
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.unit_price) || 0,
      totalPrice: parseFloat(item.total_price) || 0,
      packageId: item.package_id,
      categoryId: item.category_id
    }));
    
    // Generate invoice ID
    const fpId = estimate.franchise_partner_id || null;
    const invoiceId = await generateInvoiceId(fpId);
    
    // Calculate dates
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + DUE_DATE_DAYS);
    
    // Determine customer details
    const customerName = estimate.client_name || estimate.onboarded_property_name || estimate.property_name || 'Customer';
    const customerEmail = estimate.client_email || estimate.op_email || null;
    const customerPhone = estimate.client_phone || estimate.op_phone || null;
    const propertyName = estimate.onboarded_property_name || estimate.property_name || null;
    const propertyCode = estimate.onboarded_property_code || estimate.property_code || null;
    
    // Insert invoice
    const [result] = await connection.execute(`
      INSERT INTO invoices (
        invoice_id, invoice_type, property_id, estimate_id, source_estimate_id,
        customer_id, franchise_partner_id, customer_name, customer_email, customer_phone,
        invoice_date, due_date, line_items, 
        subtotal, discount_percentage, discount_amount, 
        tax_percentage, tax_amount, total_amount, 
        amount_paid, balance_amount, status, payment_status,
        auto_generated, created_by, created_by_role, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoiceId,
      'estimate',
      estimate.property_id,
      estimateId,
      estimate.estimate_id,
      estimate.client_id,
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
    
    const insertedId = result.insertId;
    
    // Update estimate status to 'converted'
    await connection.execute(
      'UPDATE estimates SET status = ? WHERE id = ?',
      ['converted', estimateId]
    );
    
    await connection.commit();
    
    console.log(`✅ Invoice ${invoiceId} generated from estimate ${estimate.estimate_id}`);
    
    // Send email notification (don't await to avoid blocking)
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
 * Send invoice email notification
 */
const sendInvoiceEmailNotification = async (invoiceDbId, customerEmail, customerName, invoiceId, totalAmount, dueDate) => {
  try {
    // Import email service here to avoid circular dependency
    const emailService = require('./emailService');
    
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };
    
    const formattedDueDate = new Date(dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    
    const subject = `Invoice ${invoiceId} from XLAND INFRA`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">XLAND INFRA</h1>
          <p style="color: #cbd5e0; margin: 10px 0 0 0;">Property Management Services</p>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #1a365d; margin-top: 0;">Invoice Generated</h2>
          
          <p style="color: #4a5568;">Dear ${customerName},</p>
          
          <p style="color: #4a5568;">
            A new invoice has been generated for your services. Please find the details below:
          </p>
          
          <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #718096;">Invoice Number:</td>
                <td style="padding: 8px 0; color: #1a365d; font-weight: bold; text-align: right;">${invoiceId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #718096;">Total Amount:</td>
                <td style="padding: 8px 0; color: #1a365d; font-weight: bold; text-align: right; font-size: 18px;">${formatCurrency(totalAmount)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #718096;">Due Date:</td>
                <td style="padding: 8px 0; color: #e53e3e; font-weight: bold; text-align: right;">${formattedDueDate}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #4a5568;">
            Please make the payment before the due date to avoid any late fees.
          </p>
          
          <p style="color: #4a5568;">
            For any queries, please contact us at <a href="mailto:info@xlandinfra.com" style="color: #3182ce;">info@xlandinfra.com</a>
          </p>
          
          <p style="color: #4a5568; margin-top: 30px;">
            Thank you for choosing XLAND INFRA!
          </p>
        </div>
        
        <div style="background: #edf2f7; padding: 20px; text-align: center;">
          <p style="color: #718096; margin: 0; font-size: 12px;">
            © ${new Date().getFullYear()} XLAND INFRA. All rights reserved.
          </p>
        </div>
      </div>
    `;
    
    await emailService.sendEmail({
      to: customerEmail,
      subject,
      html
    });
    
    // Update invoice to mark email as sent
    await pool.execute(
      'UPDATE invoices SET email_sent_at = NOW(), sent_at = NOW() WHERE id = ?',
      [invoiceDbId]
    );
    
    console.log(`📧 Invoice email sent to ${customerEmail} for invoice ${invoiceId}`);
    
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
