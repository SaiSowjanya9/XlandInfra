const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all properties
router.get('/', async (req, res) => {
  try {
    const [properties] = await pool.execute(
      `SELECT * FROM properties WHERE is_active = TRUE ORDER BY name`
    );

    res.json({
      success: true,
      data: properties.map(prop => ({
        id: prop.id,
        propertyId: prop.property_id,
        name: prop.name,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zipCode: prop.zip_code,
        country: prop.country
      }))
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
});

// Get property by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [properties] = await pool.execute(
      `SELECT * FROM properties WHERE id = ? AND is_active = TRUE`,
      [id]
    );

    if (properties.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const prop = properties[0];

    res.json({
      success: true,
      data: {
        id: prop.id,
        propertyId: prop.property_id,
        name: prop.name,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zipCode: prop.zip_code,
        country: prop.country
      }
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching property',
      error: error.message
    });
  }
});

module.exports = router;
