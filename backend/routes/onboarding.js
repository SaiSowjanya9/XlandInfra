const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Generate unique property ID: PREFIX-XXXX-YYYYMMDD
const generatePropertyId = (entryType) => {
  const prefix = { GC: 'GC', APT: 'APT', VILLA: 'VLA', PLOT: 'PLT' }[entryType] || 'PROP';
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${random}-${date}`;
};

// ============================================
// POST /api/onboarding  — Create a new onboarded property
// ============================================
router.post('/', async (req, res) => {
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
      address,
      landmark,
      mapLocation,
      notes,
      associationContacts
    } = req.body;

    // Calculate total units
    let totalUnits = 0;
    if (entryType === 'GC' && unitsPerBlock) {
      totalUnits = Object.values(unitsPerBlock).reduce((sum, u) => sum + (parseInt(u) || 0), 0);
    } else if (entryType === 'APT') {
      totalUnits = parseInt(numberOfUnits) || 0;
    } else {
      totalUnits = 1;
    }

    const propertyId = generatePropertyId(entryType);

    const [result] = await conn.execute(
      `INSERT INTO onboarded_properties
        (property_id, entry_type, category, zone, area_name, division, property_type,
         community_name, number_of_blocks, block_names, units_per_block, block_info,
         block_na, number_of_units, villa_plot_number, total_units,
         address, landmark, map_lat, map_lng, map_address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        (entryType === 'VILLA' || entryType === 'PLOT') ? (villaPlotNumber || null) : null,
        totalUnits,
        address || null,
        landmark || null,
        mapLocation?.lat || null,
        mapLocation?.lng || null,
        mapLocation?.address || null,
        notes || null
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
// GET /api/onboarding  — List all onboarded properties
// ============================================
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM onboarded_properties WHERE status = 'active' ORDER BY created_at DESC`
    );

    // Fetch contacts for all properties in one query
    const propertyIds = rows.map(r => r.id);
    let contactsMap = {};
    if (propertyIds.length > 0) {
      const placeholders = propertyIds.map(() => '?').join(',');
      const [contacts] = await pool.execute(
        `SELECT * FROM property_contacts WHERE property_id IN (${placeholders})`,
        propertyIds
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
    }

    const data = rows.map(row => ({
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
      landmark: row.landmark,
      mapLocation: (row.map_lat && row.map_lng) ? {
        lat: parseFloat(row.map_lat),
        lng: parseFloat(row.map_lng),
        address: row.map_address
      } : null,
      notes: row.notes,
      contacts: contactsMap[row.id] || [],
      status: row.status,
      createdAt: row.created_at
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching onboarded properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching onboarded properties',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/onboarding/:id  — Soft-delete a property
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      `UPDATE onboarded_properties SET status = 'deleted' WHERE id = ?`,
      [id]
    );

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
