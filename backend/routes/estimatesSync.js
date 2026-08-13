const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/database');
const { sendEstimateEmail, sendEstimateActionNotification } = require('../services/emailService');

// GET all estimates (supports ?archived=true for archived estimates)
router.get('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.json({ success: true, data: [] });
    }
    
    const { archived } = req.query;
    const isArchived = archived === 'true';
    
    const pool = db.pool;
    const [estimates] = await pool.execute(
      `SELECT * FROM estimates WHERE is_active = 1 AND is_archived = ? ORDER BY created_at DESC`,
      [isArchived ? 1 : 0]
    );
    
    // Also fetch from fp_estimates table (where FP creates estimates)
    let fpEstimates = [];
    try {
      constq [fpEst] = await pool.execute(
        `SELECT * FROM fp_estimates WHERE (is_archived = ? OR is_archived IS NULL) ORDER BY created_at DESC`,
        [isArchived ? 1 : 0]
      );
      fpEstimates = fpEst;
    } catch (e) { console.log('FP estimates fetch:', e.message); }
    
    // Combine both tables
    const allEstimates = [...estimates, ...fpEstimates];
    
    // Transform to match frontend format
    const formattedEstimates = allEstimates.map(est => {
      // Handle JSON fields - MySQL may return object or string
      let services = [];
      let addons = [];
      if (est.services) {
        services = typeof est.services === 'string' ? JSON.parse(est.services) : est.services;
      }
      if (est.addons || est.addons_data) {
        try {
          const addonData = est.addons || est.addons_data;
          addons = typeof addonData === 'string' ? JSON.parse(addonData) : addonData;
        } catch (e) {}
      }
      return {
        // IDs
        estimateId: est.estimate_id,
        estimate_id: est.estimate_id,
        estimateType: est.estimate_type || (est.property_type ? 'property-based' : 'direct'),
        estimate_type: est.estimate_type || (est.property_type ? 'property_based' : 'direct'),
        // Customer info (both camelCase and snake_case)
        customerName: est.customer_name || est.client_name,
        client_name: est.client_name || est.customer_name,
        customerEmail: est.customer_email || est.client_email,
        client_email: est.client_email || est.customer_email,
        customerPhone: est.customer_phone || est.client_phone,
        client_phone: est.client_phone || est.customer_phone,
        // Property info
        propertyType: est.property_type,
        property_type: est.property_type,
        propertyName: est.property_name,
        property_name: est.property_name,
        propertyAddress: est.property_address || est.address,
        propertyId: est.property_id || est.property_code,
        property_id: est.property_id,
        property_code: est.property_code || est.property_id,
        communityName: est.community_name || est.property_name,
        zone: est.zone,
        division: est.division,
        city: est.city,
        address: est.property_address || est.address,
        // Package info
        packageName: est.package_name,
        package_name: est.package_name,
        packageId: est.package_id,
        packagePrice: parseFloat(est.package_price || 0),
        package_price: parseFloat(est.package_price || 0),
        // Other details
        noOfVisits: est.no_of_visits,
        description: est.description,
        services: services,
        addons: addons,
        // Pricing
        subtotal: parseFloat(est.subtotal || est.package_price || 0),
        discount: parseFloat(est.discount || est.discount_amount || 0),
        discount_amount: parseFloat(est.discount_amount || est.discount || 0),
        discount_percent: parseFloat(est.discount_percent || 0),
        tax: parseFloat(est.tax || est.gst_amount || 0),
        gst_amount: parseFloat(est.gst_amount || est.tax || 0),
        gst_percent: parseFloat(est.gst_percent || 0),
        total: parseFloat(est.total || est.total_amount || 0),
        total_amount: parseFloat(est.total_amount || est.total || 0),
        // Notes and status
        notes: est.notes || est.description,
        status: est.status,
        isArchived: est.is_archived,
        archivedAt: est.archived_at,
        validUntil: est.valid_until,
        // Timestamps
        createdAt: est.created_at,
        created_at: est.created_at,
        updatedAt: est.updated_at,
        // Creator info
        created_by_name: est.created_by_name,
        created_by_role: est.created_by_role
      };
    });
    
    res.json({ success: true, data: formattedEstimates });
  } catch (error) {
    console.error('Get estimates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE estimate
router.post('/', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { 
      customerName, customerEmail, customerPhone,
      propertyType, propertyName, propertyAddress,
      services, addons, subtotal, discount, tax, total,
      notes, status, validUntil,
      subTotal, gst, totalPrice,
      // Additional fields
      propertyId, communityName, zone, division, address,
      noOfVisits, description, packageName, packageId
    } = req.body;
    
    const estimateId = `EST-${Date.now()}`;
    
    // Use proper field names (frontend sends different names)
    const finalSubtotal = subtotal || subTotal || 0;
    const finalTax = tax || gst || 0;
    const finalTotal = total || totalPrice || 0;
    const finalAddress = propertyAddress || address || null;
    const finalDescription = description || notes || null;
    
    const pool = db.pool;
    const titleValue = customerName || propertyName || communityName || 'Direct Estimate';
    
    // Get admin user ID for created_by (required NOT NULL field)
    let createdById = 1; // Default to admin user ID 1
    try {
      const [adminUsers] = await pool.execute(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
      if (adminUsers.length > 0) {
        createdById = adminUsers[0].id;
      }
    } catch (e) {
      console.log('Could not fetch admin user, using default ID 1');
    }
    
    await pool.execute(
      `INSERT INTO estimates (
        estimate_id, title, customer_name, customer_email, customer_phone,
        property_type, property_name, property_address,
        services, addons, subtotal, discount, tax, total,
        notes, status, valid_until,
        property_id, community_name, zone, division, no_of_visits, description, package_name, package_id,
        is_active, is_archived, estimate_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estimateId,
        titleValue,  // title is NOT NULL
        customerName || null,
        customerEmail || null,
        customerPhone || null,
        propertyType || null,
        propertyName || communityName || null,
        finalAddress,
        services ? JSON.stringify(services) : null,
        addons ? JSON.stringify(addons) : null,
        finalSubtotal,
        discount || 0,
        finalTax,
        finalTotal,
        notes || null,
        status || 'Draft',
        validUntil || null,
        propertyId || null,
        communityName || null,
        zone || null,
        division || null,
        noOfVisits || null,
        finalDescription,
        packageName || null,
        packageId || null,
        1,  // is_active = 1
        0,  // is_archived = false
        'direct',  // estimate_type
        createdById  // created_by is NOT NULL
      ]
    );
    
    res.json({ 
      success: true, 
      message: 'Estimate created',
      data: { estimateId }
    });
  } catch (error) {
    console.error('Create estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE estimate
router.put('/:estimateId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const { 
      customerName, customerEmail, customerPhone,
      propertyType, propertyName, propertyAddress,
      services, addons, subtotal, discount, tax, total,
      notes, status, validUntil
    } = req.body;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE estimates SET 
        customer_name = COALESCE(?, customer_name),
        customer_email = COALESCE(?, customer_email),
        customer_phone = COALESCE(?, customer_phone),
        property_type = COALESCE(?, property_type),
        property_name = COALESCE(?, property_name),
        property_address = COALESCE(?, property_address),
        services = COALESCE(?, services),
        addons = COALESCE(?, addons),
        subtotal = COALESCE(?, subtotal),
        discount = COALESCE(?, discount),
        tax = COALESCE(?, tax),
        total = COALESCE(?, total),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status),
        valid_until = COALESCE(?, valid_until)
       WHERE estimate_id = ?`,
      [
        customerName,
        customerEmail,
        customerPhone,
        propertyType,
        propertyName,
        propertyAddress,
        services ? JSON.stringify(services) : null,
        addons ? JSON.stringify(addons) : null,
        subtotal,
        discount,
        tax,
        total,
        notes,
        status,
        validUntil,
        estimateId
      ]
    );
    
    res.json({ success: true, message: 'Estimate updated' });
  } catch (error) {
    console.error('Update estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ARCHIVE estimate
router.put('/:estimateId/archive', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const pool = db.pool;
    
    // Try to archive in estimates table first
    const [result1] = await pool.execute(
      `UPDATE estimates SET is_archived = TRUE, archived_at = NOW() WHERE estimate_id = ?`,
      [estimateId]
    );
    
    // Also try to archive in fp_estimates table
    let result2 = { affectedRows: 0 };
    try {
      [result2] = await pool.execute(
        `UPDATE fp_estimates SET is_archived = TRUE, archived_at = NOW() WHERE estimate_id = ?`,
        [estimateId]
      );
    } catch (e) { console.log('FP archive attempt:', e.message); }
    
    if (result1.affectedRows > 0 || result2.affectedRows > 0) {
      res.json({ success: true, message: 'Estimate archived' });
    } else {
      res.status(404).json({ success: false, message: 'Estimate not found' });
    }
  } catch (error) {
    console.error('Archive estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// RESTORE estimate
router.put('/:estimateId/restore', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const pool = db.pool;
    
    // Try to restore in estimates table
    const [result1] = await pool.execute(
      `UPDATE estimates SET is_archived = FALSE, archived_at = NULL WHERE estimate_id = ?`,
      [estimateId]
    );
    
    // Also try to restore in fp_estimates table
    let result2 = { affectedRows: 0 };
    try {
      [result2] = await pool.execute(
        `UPDATE fp_estimates SET is_archived = FALSE, archived_at = NULL WHERE estimate_id = ?`,
        [estimateId]
      );
    } catch (e) { console.log('FP restore attempt:', e.message); }
    
    if (result1.affectedRows > 0 || result2.affectedRows > 0) {
      res.json({ success: true, message: 'Estimate restored' });
    } else {
      res.status(404).json({ success: false, message: 'Estimate not found' });
    }
  } catch (error) {
    console.error('Restore estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE ALL archived estimates
router.delete('/archived/delete-all', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const pool = db.pool;
    let totalDeleted = 0;
    
    // Delete from estimates table
    const [result1] = await pool.execute(
      `DELETE FROM estimates WHERE is_archived = 1 OR status = 'Archived'`
    );
    totalDeleted += result1.affectedRows;
    
    // Also delete from fp_estimates table
    try {
      const [result2] = await pool.execute(
        `DELETE FROM fp_estimates WHERE is_archived = 1`
      );
      totalDeleted += result2.affectedRows;
    } catch (e) { 
      console.log('FP estimates delete:', e.message); 
    }
    
    res.json({ 
      success: true, 
      message: `${totalDeleted} archived estimates deleted`,
      deletedCount: totalDeleted
    });
  } catch (error) {
    console.error('Delete all archived estimates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE single archived estimate permanently (must be before /:estimateId route)
router.delete('/archived/:estimateId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const pool = db.pool;
    let deleted = false;
    
    // Delete from estimates table
    const [result1] = await pool.execute(
      `DELETE FROM estimates WHERE estimate_id = ? AND (is_archived = 1 OR status = 'Archived')`,
      [estimateId]
    );
    if (result1.affectedRows > 0) deleted = true;
    
    // Also delete from fp_estimates table
    try {
      const [result2] = await pool.execute(
        `DELETE FROM fp_estimates WHERE estimate_id = ? AND is_archived = 1`,
        [estimateId]
      );
      if (result2.affectedRows > 0) deleted = true;
    } catch (e) { 
      console.log('FP estimate delete:', e.message); 
    }
    
    if (deleted) {
      res.json({ success: true, message: 'Estimate permanently deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Archived estimate not found' });
    }
  } catch (error) {
    console.error('Delete archived estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE estimate (soft delete)
router.delete('/:estimateId', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    
    const pool = db.pool;
    await pool.execute(
      `UPDATE estimates SET is_active = 0 WHERE estimate_id = ?`,
      [estimateId]
    );
    
    res.json({ success: true, message: 'Estimate deleted' });
  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// SEND estimate email to customer
router.post('/:estimateId/send', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    
    const pool = db.pool;
    const [estimates] = await pool.execute(
      `SELECT * FROM estimates WHERE estimate_id = ? AND is_active = 1`,
      [estimateId]
    );
    
    if (estimates.length === 0) {
      return res.status(404).json({ success: false, message: 'Estimate not found' });
    }
    
    const est = estimates[0];
    
    // Parse JSON fields
    let services = [];
    let addons = [];
    if (est.services) {
      services = typeof est.services === 'string' ? JSON.parse(est.services) : est.services;
    }
    if (est.addons) {
      addons = typeof est.addons === 'string' ? JSON.parse(est.addons) : est.addons;
    }
    
    // Enrich addons with descriptions from fp_addons table
    if (addons.length > 0) {
      const addonIds = addons.map(a => a.id || a.addon_id).filter(Boolean);
      if (addonIds.length > 0) {
        try {
          const [addonDetails] = await pool.execute(
            `SELECT id, service_name, description, frequency_type, frequency_count, price FROM fp_addons WHERE id IN (${addonIds.map(() => '?').join(',')})`,
            addonIds
          );
          const addonMap = {};
          addonDetails.forEach(ad => { addonMap[ad.id] = ad; });
          addons = addons.map(a => {
            const addonId = a.id || a.addon_id;
            const details = addonMap[addonId];
            return {
              ...a,
              name: a.name || a.service_name || details?.service_name || 'Add-on',
              description: a.description || details?.description || '',
              frequency_type: a.frequency_type || a.frequencyType || details?.frequency_type || 'Monthly',
              frequency_count: a.frequency_count ?? a.frequencyCount ?? details?.frequency_count ?? 1
            };
          });
        } catch (addonErr) {
          console.log('Failed to enrich addons:', addonErr.message);
        }
      }
    }
    
    // Generate action token for approve/reject links
    const actionToken = crypto.randomBytes(32).toString('hex');
    
    // Parse block data for GC
    let blockNames = {};
    let unitsPerBlock = {};
    try {
      if (est.block_names) blockNames = typeof est.block_names === 'string' ? JSON.parse(est.block_names) : est.block_names;
      if (est.units_per_block) unitsPerBlock = typeof est.units_per_block === 'string' ? JSON.parse(est.units_per_block) : est.units_per_block;
    } catch (e) {}

    // Parse package services with descriptions
    let packageServices = [];
    const isWorkOrderEstimate = est.estimate_type === 'work_order';
    try {
      const rawServices = isWorkOrderEstimate 
        ? (est.work_order_services || est.package_services)
        : est.package_services;
      if (rawServices) {
        packageServices = typeof rawServices === 'string' ? JSON.parse(rawServices) : rawServices;
      }
      
      // For work order estimates with no services, create one from the work order data
      if (isWorkOrderEstimate && (!packageServices || packageServices.length === 0)) {
        packageServices = [{
          name: est.work_order_subcategory || est.work_order_category || 'Work Order Service',
          description: est.work_order_description || est.description || `Work Order: ${est.work_order_id}`,
          price: parseFloat(est.subtotal) || 0,
          frequencyType: 'One-time',
          frequencyCount: 1
        }];
      }
    } catch (e) {}

    // Prepare estimate data for email
    const estimateData = {
      estimateId: est.estimate_id,
      estimateType: est.estimate_type,
      customerName: est.customer_name,
      customerEmail: est.customer_email,
      customerPhone: est.customer_phone || est.client_phone || '',
      propertyName: est.property_name,
      propertyType: est.property_type,
      zone: est.zone,
      division: est.division,
      city: est.city,
      address: est.address || est.property_address,
      // GC-specific
      numberOfBlocks: est.number_of_blocks,
      blockNames: blockNames,
      unitsPerBlock: unitsPerBlock,
      totalUnits: est.total_units,
      // Apartment-specific
      towerName: est.tower_name,
      blockNumber: est.block_number,
      // Villa/Plot-specific
      villaPlotNumber: est.villa_plot_number,
      // Package info with description
      packageName: est.package_name,
      amcPackageDescription: est.amc_package_description || '',
      description: est.description || '',
      // Services with descriptions
      services: packageServices.length > 0 ? packageServices : services,
      addons: addons,
      subtotal: parseFloat(est.subtotal || 0),
      discount: parseFloat(est.discount || 0),
      tax: parseFloat(est.tax || 0),
      total: parseFloat(est.total || 0),
      validUntil: est.valid_until,
      // Work Order fields
      isWorkOrderEstimate,
      workOrderId: est.work_order_id,
      workOrderCategory: est.work_order_category,
      workOrderSubcategory: est.work_order_subcategory,
      workOrderDescription: est.work_order_description,
      workOrderPriority: est.work_order_priority,
      workOrderStatus: est.work_order_status
    };
    
    if (!estimateData.customerEmail) {
      return res.status(400).json({ success: false, message: 'No customer email found for this estimate' });
    }
    
    // Send the email with action token
    const emailResult = await sendEstimateEmail(estimateData, actionToken);
    
    if (emailResult.success) {
      // Update estimate status to 'Sent' and store action token and sent date
      await pool.execute(
        `UPDATE estimates SET status = 'Sent', action_token = ?, sent_at = NOW() WHERE estimate_id = ?`,
        [actionToken, estimateId]
      );
      
      res.json({ 
        success: true, 
        message: `Estimate sent to ${estimateData.customerEmail}`,
        email: estimateData.customerEmail
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: emailResult.error || 'Failed to send email'
      });
    }
  } catch (error) {
    console.error('Send estimate email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUBLIC: Customer approve/reject estimate
router.post('/:estimateId/action', async (req, res) => {
  console.log(`🔔 Estimate action called: ${req.params.estimateId}, action: ${req.body.action}`);
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const { action, token } = req.body;
    console.log(`📋 Processing estimate action: ${estimateId}, action: ${action}`);
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token required' });
    }
    
    const pool = db.pool;
    
    // First check regular estimates table
    let [estimates] = await pool.execute(
      `SELECT *, 'regular' as source FROM estimates WHERE estimate_id = ? AND action_token = ? AND is_active = 1`,
      [estimateId, token]
    );
    
    let source = 'regular';
    
    // If not found, check fp_estimates table
    if (estimates.length === 0) {
      [estimates] = await pool.execute(
        `SELECT *, 'fp' as source FROM fp_estimates WHERE estimate_id = ? AND action_token = ?`,
        [estimateId, token]
      );
      source = 'fp';
    }
    
    if (estimates.length === 0) {
      console.log(`❌ Estimate ${estimateId} not found with token ${token ? token.substring(0, 10) + '...' : 'null'}`);
      // Check if estimate exists at all (with any token)
      const [anyEst] = await pool.execute(
        `SELECT estimate_id, status, action_token FROM fp_estimates WHERE estimate_id = ?`,
        [estimateId]
      );
      if (anyEst.length > 0) {
        console.log(`⚠️ Estimate exists but token mismatch. DB token: ${anyEst[0].action_token ? anyEst[0].action_token.substring(0, 10) + '...' : 'null'}, Status: ${anyEst[0].status}`);
      }
      return res.status(404).json({ success: false, message: 'Estimate not found or link expired. Please request a new estimate email.' });
    }
    
    const est = estimates[0];
    console.log(`✅ Found estimate in ${source} table: ID=${est.id}, Status=${est.status}, Token match: yes`);
    
    // Check if already actioned
    if (['Approved', 'Rejected', 'approved', 'rejected'].includes(est.status)) {
      return res.status(400).json({ 
        success: false, 
        message: `This estimate has already been ${est.status.toLowerCase()}` 
      });
    }
    
    // Check if expired
    if (est.status === 'Expired' || est.status === 'expired') {
      return res.status(400).json({ success: false, message: 'This estimate has expired' });
    }
    
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    // Update estimate status based on source table
    if (source === 'fp') {
      console.log(`📝 Updating FP estimate ${estimateId} to status: ${newStatus}`);
      const [updateResult] = await pool.execute(
        `UPDATE fp_estimates SET status = ?, updated_at = NOW() WHERE estimate_id = ?`,
        [newStatus, estimateId]
      );
      console.log(`✅ FP estimate update result: ${updateResult.affectedRows} rows affected`);
      if (updateResult.affectedRows === 0) {
        console.error(`❌ No rows updated! estimate_id=${estimateId} may not exist in fp_estimates table`);
        // Double check by querying
        const [check] = await pool.execute(`SELECT id, estimate_id, status FROM fp_estimates WHERE estimate_id = ?`, [estimateId]);
        console.error(`❌ Debug: Found ${check.length} estimates with estimate_id=${estimateId}`, check[0] || 'none');
        return res.status(500).json({ success: false, message: 'Failed to update estimate status. Please try again.' });
      }
    } else {
      console.log(`📝 Updating regular estimate ${estimateId} to status: ${action === 'approve' ? 'Approved' : 'Rejected'}`);
      const [updateResult] = await pool.execute(
        `UPDATE estimates SET status = ?, actioned_at = NOW() WHERE estimate_id = ?`,
        [action === 'approve' ? 'Approved' : 'Rejected', estimateId]
      );
      console.log(`✅ Regular estimate update result: ${updateResult.affectedRows} rows affected`);
      if (updateResult.affectedRows === 0) {
        console.error(`❌ No rows updated! estimate_id=${estimateId} may not exist in estimates table`);
        return res.status(500).json({ success: false, message: 'Failed to update estimate status. Please try again.' });
      }
    }
    
    // Auto-generate invoice when customer approves estimate
    let invoiceResult = null;
    if (action === 'approve') {
      console.log(`🔔 Starting invoice generation for estimate ${estimateId}`);
      console.log(`📋 Estimate details: ID=${est.id}, Source=${source}, Email=${est.customer_email || est.client_email}, Total=${est.total || est.total_amount}`);
      try {
        const { generateInvoiceFromEstimate } = require('../services/invoiceService');
        // Use internal DB id for invoice generation, pass source to handle fp_estimates
        invoiceResult = await generateInvoiceFromEstimate(est.id, null, source);
        console.log(`✅ Auto-generated invoice for customer-approved estimate ${estimateId} (source: ${source}):`, invoiceResult);
        // Note: Invoice email is sent automatically inside generateInvoiceFromEstimate()
        // No need to send again here to avoid duplicate emails
      } catch (invoiceError) {
        console.error('❌ Failed to auto-generate invoice for customer approval:', invoiceError);
        console.error('❌ Error stack:', invoiceError.stack);
        // Don't fail the approval if invoice generation fails
      }
    } else {
      console.log(`ℹ️ Estimate ${estimateId} was rejected, no invoice generated`);
    }
    
    res.json({ 
      success: true, 
      message: `Estimate ${newStatus} successfully`,
      status: action === 'approve' ? 'Approved' : 'Rejected',
      invoice: invoiceResult ? {
        invoiceId: invoiceResult.invoiceId,
        totalAmount: invoiceResult.totalAmount
      } : null
    });
  } catch (error) {
    console.error('Estimate action error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get estimate status for action page (public)
router.get('/:estimateId/status', async (req, res) => {
  try {
    if (!db.isDbConnected) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { estimateId } = req.params;
    const { token } = req.query;
    
    const pool = db.pool;
    
    // First check regular estimates table
    let [estimates] = await pool.execute(
      `SELECT estimate_id, customer_name, property_name, total, status, sent_at, 'regular' as source
       FROM estimates WHERE estimate_id = ? AND action_token = ? AND is_active = 1`,
      [estimateId, token]
    );
    
    // If not found, check fp_estimates table
    if (estimates.length === 0) {
      [estimates] = await pool.execute(
        `SELECT estimate_id, client_name as customer_name, property_name, total_amount as total, status, created_at as sent_at, 'fp' as source
         FROM fp_estimates WHERE estimate_id = ? AND action_token = ?`,
        [estimateId, token]
      );
    }
    
    if (estimates.length === 0) {
      console.log(`❌ Status lookup: Estimate ${estimateId} not found with token ${token ? token.substring(0, 10) + '...' : 'null'}`);
      // Check if estimate exists with any token
      const [anyEst] = await pool.execute(
        `SELECT estimate_id, status, action_token FROM fp_estimates WHERE estimate_id = ?`,
        [estimateId]
      );
      if (anyEst.length > 0) {
        console.log(`⚠️ Estimate exists but token mismatch. DB token: ${anyEst[0].action_token ? anyEst[0].action_token.substring(0, 10) + '...' : 'null'}, Status: ${anyEst[0].status}`);
        return res.status(404).json({ success: false, message: 'This link has expired. The estimate was updated and a new email was sent.' });
      }
      return res.status(404).json({ success: false, message: 'Estimate not found or invalid token' });
    }
    
    const est = estimates[0];
    console.log(`✅ Status lookup: Found estimate ${estimateId}, status=${est.status}`);
    res.json({ 
      success: true, 
      data: {
        estimateId: est.estimate_id,
        customerName: est.customer_name,
        propertyName: est.property_name,
        total: parseFloat(est.total || 0),
        status: est.status,
        sentAt: est.sent_at,
        source: est.source
      }
    });
  } catch (error) {
    console.error('Get estimate status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Scheduled job: Auto-expire estimates after 1 month and auto-delete archived after 2 months
const runScheduledTasks = async () => {
  if (!db.isDbConnected) return;
  
  try {
    const pool = db.pool;
    
    // Auto-expire: Estimates with status 'Sent' and sent_at > 1 month ago
    const [expiredResult] = await pool.execute(
      `UPDATE estimates SET status = 'Expired' 
       WHERE status = 'Sent' AND sent_at IS NOT NULL AND sent_at < DATE_SUB(NOW(), INTERVAL 1 MONTH)`
    );
    if (expiredResult.affectedRows > 0) {
      console.log(`⏰ Auto-expired ${expiredResult.affectedRows} estimates`);
    }
    
    // Auto-delete: Archived estimates older than 2 months
    const [deletedResult] = await pool.execute(
      `DELETE FROM estimates 
       WHERE status = 'Archived' AND archived_at IS NOT NULL AND archived_at < DATE_SUB(NOW(), INTERVAL 2 MONTH)`
    );
    if (deletedResult.affectedRows > 0) {
      console.log(`🗑️ Auto-deleted ${deletedResult.affectedRows} archived estimates`);
    }
  } catch (error) {
    console.error('Scheduled task error:', error);
  }
};

// Run scheduled tasks every hour
setInterval(runScheduledTasks, 60 * 60 * 1000);
// Also run on startup after 30 seconds
setTimeout(runScheduledTasks, 30000);

module.exports = router;
