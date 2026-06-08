const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Generate unique property ID: PREFIX-XXXX-YYYYMMDD
const generatePropertyId = (entryType) => {
  const prefix = { GC: 'GC', APT: 'APT', VILLA: 'VLA', PLOT: 'PLT', FLAT: 'FLT' }[entryType] || 'PROP';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${random}-${date}`;
};

// ============================================
// POST /api/onboarding  — Create a new onboarded property
// ============================================
router.post('/', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      entryType,
      category,
      zone,
      areaName,
      division,
      propertyType,
      communityName,
      numberOfBlocks,
      blockNames,
      unitsPerBlock,
      blockInfo,
      blockNA,
      numberOfUnits,
      villaPlotNumber,
      // Address fields
      address,
      addressLine1,
      aptSuiteUnit,
      aptSuiteNA,
      city,
      state,
      postalCode,
      landmark,
      mapLocation,
      notes,
      associationContacts
    } = req.body;

    // Get actual user name from authenticated user
    let creatorName = 'System';
    if (req.user) {
      // Try to get full name from firstName + lastName
      if (req.user.firstName && req.user.lastName) {
        creatorName = `${req.user.firstName} ${req.user.lastName}`.trim();
      } else if (req.user.firstName) {
        creatorName = req.user.firstName;
      } else if (req.user.name) {
        creatorName = req.user.name;
      } else if (req.user.email) {
        // Use email prefix as name if nothing else available
        creatorName = req.user.email.split('@')[0];
      } else if (req.user.username && req.user.username !== req.user.role) {
        // Only use username if it's not the same as role
        creatorName = req.user.username;
      }
    }
    console.log('Onboarding createdBy:', creatorName, 'User:', JSON.stringify(req.user));

    // Calculate total units
    let totalUnits = 0;
    if (entryType === 'GC' && unitsPerBlock) {
      totalUnits = Object.values(unitsPerBlock).reduce((sum, u) => sum + (parseInt(u) || 0), 0);
    } else if (entryType === 'APT') {
      totalUnits = parseInt(numberOfUnits) || 0;
    } else if (entryType === 'VILLA' || entryType === 'PLOT' || entryType === 'FLAT') {
      totalUnits = 1;
    } else {
      totalUnits = 1;
    }

    const propertyId = generatePropertyId(entryType);

    const [result] = await conn.execute(
      `INSERT INTO onboarded_properties
        (property_id, entry_type, category, zone, area_name, division, property_type,
         community_name, number_of_blocks, block_names, units_per_block, block_info,
         block_na, number_of_units, villa_plot_number, total_units,
         address, address_line1, apt_suite_unit, apt_suite_na, city, state, postal_code,
         landmark, map_lat, map_lng, map_address, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId,
        entryType,
        category || 'residential',
        zone,
        areaName,
        division,
        propertyType,
        communityName,
        entryType === 'GC' ? (numberOfBlocks || null) : null,
        entryType === 'GC' && blockNames ? JSON.stringify(blockNames) : null,
        entryType === 'GC' && unitsPerBlock ? JSON.stringify(unitsPerBlock) : null,
        entryType === 'APT' ? (blockInfo || null) : null,
        entryType === 'APT' ? (blockNA ? 1 : 0) : 0,
        entryType === 'APT' ? (parseInt(numberOfUnits) || null) : null,
        (entryType === 'VILLA' || entryType === 'PLOT' || entryType === 'FLAT') ? (villaPlotNumber || null) : null,
        totalUnits,
        address || null,
        addressLine1 || null,
        aptSuiteUnit || null,
        aptSuiteNA ? 1 : 0,
        city || null,
        state || null,
        postalCode || null,
        landmark || null,
        mapLocation?.lat || null,
        mapLocation?.lng || null,
        mapLocation?.address || null,
        notes || null,
        creatorName
      ]
    );

    const insertedId = result.insertId;

    // Insert contacts
    if (associationContacts && associationContacts.length > 0) {
      for (const contact of associationContacts) {
        if (contact.name && contact.name.trim()) {
          await conn.execute(
            `INSERT INTO property_contacts (property_id, name, email, phone, country_code)
             VALUES (?, ?, ?, ?, ?)`,
            [
              insertedId,
              contact.name.trim(),
              contact.email || null,
              contact.phone || null,
              contact.countryCode || '+91'
            ]
          );
        }
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Property onboarded successfully',
      data: {
        id: insertedId.toString(),
        propertyId,
        entryType,
        name: communityName,
        zone,
        division,
        totalUnits,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error onboarding property:', error);
    res.status(500).json({
      success: false,
      message: 'Error onboarding property',
      error: error.message
    });
  } finally {
    conn.release();
  }
});

// ============================================
// GET /api/onboarding  — List all properties from BOTH tables
// ============================================
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const data = [];
    
    // 1. Fetch from onboarded_properties table
    let onboardedQuery = `SELECT * FROM onboarded_properties`;
    if (status === 'all') {
      onboardedQuery += ` ORDER BY created_at DESC`;
    } else if (status === 'deleted') {
      onboardedQuery += ` WHERE status = 'deleted' ORDER BY created_at DESC`;
    } else {
      onboardedQuery += ` WHERE status = 'active' ORDER BY created_at DESC`;
    }
    
    const [onboardedRows] = await pool.execute(onboardedQuery);

    // Fetch contacts for onboarded_properties
    const onboardedIds = onboardedRows.map(r => r.id);
    let contactsMap = {};
    if (onboardedIds.length > 0) {
      const placeholders = onboardedIds.map(() => '?').join(',');
      try {
        const [contacts] = await pool.execute(
          `SELECT * FROM property_contacts WHERE property_id IN (${placeholders})`,
          onboardedIds
        );
        contacts.forEach(c => {
          if (!contactsMap[c.property_id]) contactsMap[c.property_id] = [];
          contactsMap[c.property_id].push({
            name: c.name,
            email: c.email,
            phone: c.phone,
            countryCode: c.country_code
          });
        });
      } catch (e) { /* property_contacts may not exist */ }
    }

    // Transform onboarded_properties
    onboardedRows.forEach(row => {
      data.push({
        id: row.id.toString(),
        propertyId: row.property_id,
        entryType: row.entry_type,
        category: row.category,
        name: row.community_name,
        zone: row.zone,
        areaName: row.area_name,
        division: row.division,
        propertyType: row.property_type,
        numberOfBlocks: row.number_of_blocks,
        blockNames: row.block_names ? (typeof row.block_names === 'string' ? JSON.parse(row.block_names) : row.block_names) : null,
        unitsPerBlock: row.units_per_block ? (typeof row.units_per_block === 'string' ? JSON.parse(row.units_per_block) : row.units_per_block) : null,
        blockInfo: row.block_info,
        blockNA: !!row.block_na,
        numberOfUnits: row.number_of_units,
        villaPlotNumber: row.villa_plot_number,
        totalUnits: row.total_units,
        address: row.address,
        addressLine1: row.address_line1,
        aptSuiteUnit: row.apt_suite_unit,
        aptSuiteNA: !!row.apt_suite_na,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
        landmark: row.landmark,
        mapLocation: (row.map_lat && row.map_lng) ? {
          lat: parseFloat(row.map_lat),
          lng: parseFloat(row.map_lng),
          address: row.map_address
        } : null,
        notes: row.notes,
        contacts: contactsMap[row.id] || [],
        status: row.status,
        createdBy: row.created_by || 'System',
        createdAt: row.created_at,
        sourceTable: 'onboarded_properties'
      });
    });

    // 2. Fetch from properties table (Coordinator/Executive created)
    let propertiesQuery = `SELECT * FROM properties WHERE 1=1`;
    if (status === 'deleted') {
      propertiesQuery += ` AND status = 'deleted'`;
    } else if (status !== 'all') {
      propertiesQuery += ` AND (status IS NULL OR status = 'active')`;
    }
    propertiesQuery += ` ORDER BY created_at DESC`;
    
    try {
      const [propRows] = await pool.execute(propertiesQuery);
      
      // Transform properties table data
      propRows.forEach(row => {
        // Skip if already in onboarded_properties (check by property_id)
        if (data.some(d => d.propertyId === row.property_id)) return;
        
        // Build contacts from inline fields
        const contacts = [];
        if (row.contact_person || row.contact_email || row.contact_phone) {
          contacts.push({
            name: row.contact_person || '',
            email: row.contact_email || '',
            phone: row.contact_phone || '',
            countryCode: '+91'
          });
        }
        
        // Determine entry type from property_id prefix
        let entryType = row.entry_type || 'GC';
        if (row.property_id?.includes('-VILLA-')) entryType = 'VILLA';
        else if (row.property_id?.includes('-APT-')) entryType = 'APT';
        else if (row.property_id?.includes('-FLAT-')) entryType = 'FLAT';
        else if (row.property_id?.includes('-PLOT-')) entryType = 'PLOT';
        else if (row.property_id?.includes('-GC-')) entryType = 'GC';
        
        data.push({
          id: `prop-${row.id}`,
          propertyId: row.property_id,
          entryType: entryType,
          category: row.category || 'residential',
          name: row.name,
          zone: row.zone_id || row.zone || '',
          areaName: row.area_name || '',
          division: row.division_id || row.division || '',
          propertyType: row.property_type,
          numberOfBlocks: row.number_of_blocks,
          blockNames: row.block_names ? (typeof row.block_names === 'string' ? JSON.parse(row.block_names) : row.block_names) : null,
          unitsPerBlock: row.units_per_block ? (typeof row.units_per_block === 'string' ? JSON.parse(row.units_per_block) : row.units_per_block) : null,
          blockInfo: row.block_info,
          blockNA: false,
          numberOfUnits: row.number_of_units,
          villaPlotNumber: row.villa_plot_number,
          totalUnits: row.total_units || row.number_of_units || 0,
          address: row.address,
          addressLine1: row.address,
          aptSuiteUnit: '',
          aptSuiteNA: false,
          city: row.city,
          state: row.state,
          postalCode: row.zip_code || '',
          landmark: row.landmark || '',
          mapLocation: (row.latitude && row.longitude) ? {
            lat: parseFloat(row.latitude),
            lng: parseFloat(row.longitude),
            address: row.address
          } : null,
          notes: row.notes || '',
          contacts: contacts,
          status: row.status || 'active',
          createdBy: row.created_by || 'System',
          createdAt: row.created_at,
          sourceTable: 'properties'
        });
      });
    } catch (e) {
      console.log('Properties table fetch skipped:', e.message);
    }

    // Sort by created date descending
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// ============================================
// GET /api/onboarding/suggestions/zones — Distinct zones from properties + vendors
// ============================================
router.get('/suggestions/zones', async (req, res) => {
  try {
    const [propRows] = await pool.execute(
      `SELECT DISTINCT zone FROM onboarded_properties WHERE zone IS NOT NULL AND zone != '' AND status = 'active'`
    );
    let vendorZones = [];
    try {
      const [vRows] = await pool.execute(
        `SELECT DISTINCT zone FROM onboarded_vendors WHERE zone IS NOT NULL AND zone != '' AND status = 'active'`
      );
      vendorZones = vRows;
    } catch (_) {}
    const allZones = [...new Set([...propRows.map(r => r.zone), ...vendorZones.map(r => r.zone)])].filter(Boolean).sort();
    res.json({ success: true, data: allZones });
  } catch (error) {
    console.error('Error fetching zone suggestions:', error);
    res.json({ success: true, data: [] });
  }
});

// ============================================
// GET /api/onboarding/suggestions/areas — Distinct areas from properties + vendors
// ============================================
router.get('/suggestions/areas', async (req, res) => {
  try {
    const [propRows] = await pool.execute(
      `SELECT DISTINCT area_name FROM onboarded_properties WHERE area_name IS NOT NULL AND area_name != '' AND status = 'active'`
    );
    let vendorAreas = [];
    try {
      const [vRows] = await pool.execute(
        `SELECT DISTINCT area_name FROM onboarded_vendors WHERE area_name IS NOT NULL AND area_name != '' AND status = 'active'`
      );
      vendorAreas = vRows;
    } catch (_) {}
    const allAreas = [...new Set([...propRows.map(r => r.area_name), ...vendorAreas.map(r => r.area_name)])].filter(Boolean).sort();
    res.json({ success: true, data: allAreas });
  } catch (error) {
    console.error('Error fetching area suggestions:', error);
    res.json({ success: true, data: [] });
  }
});

// ============================================
// GET /api/onboarding/lookup/:propertyId — Find property by property_id string
// ============================================
router.get('/lookup/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const [rows] = await pool.execute(
      `SELECT * FROM onboarded_properties WHERE property_id = ? AND status = 'active'`,
      [propertyId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    const row = rows[0];
    res.json({
      success: true,
      data: {
        id: row.id.toString(),
        propertyId: row.property_id,
        entryType: row.entry_type,
        category: row.category,
        name: row.community_name,
        zone: row.zone,
        areaName: row.area_name,
        division: row.division,
        propertyType: row.property_type,
        numberOfBlocks: row.number_of_blocks,
        blockNames: row.block_names ? (typeof row.block_names === 'string' ? JSON.parse(row.block_names) : row.block_names) : null,
        unitsPerBlock: row.units_per_block ? (typeof row.units_per_block === 'string' ? JSON.parse(row.units_per_block) : row.units_per_block) : null,
        blockInfo: row.block_info,
        blockNA: !!row.block_na,
        numberOfUnits: row.number_of_units,
        villaPlotNumber: row.villa_plot_number,
        totalUnits: row.total_units
      }
    });
  } catch (error) {
    console.error('Error looking up property:', error);
    res.status(500).json({ success: false, message: 'Error looking up property' });
  }
});

// ============================================
// DELETE /api/onboarding/:id  — Soft-delete a property
// ============================================
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Delete Property] Attempting to delete property with id:', id);
    
    // Try to delete by numeric id first
    let result;
    [result] = await pool.execute(
      `UPDATE onboarded_properties SET status = 'deleted' WHERE id = ?`,
      [id]
    );

    // If no rows affected, try by property_id (string)
    if (result.affectedRows === 0) {
      console.log('[Delete Property] No match by id, trying property_id...');
      [result] = await pool.execute(
        `UPDATE onboarded_properties SET status = 'deleted' WHERE property_id = ?`,
        [id]
      );
    }

    console.log('[Delete Property] Result:', result.affectedRows, 'rows affected');

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property',
      error: error.message
    });
  }
});

module.exports = router;
