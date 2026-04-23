const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all units with property info
router.get('/', async (req, res) => {
  try {
    const [units] = await pool.execute(
      `SELECT u.*, p.name as property_name, p.property_id as property_code
       FROM units u 
       JOIN properties p ON u.property_id = p.id 
       WHERE u.is_active = TRUE
       ORDER BY p.name, u.unit_number`
    );

    res.json({
      success: true,
      data: units.map(unit => ({
        id: unit.id,
        unitNumber: unit.unit_number,
        floor: unit.floor,
        propertyId: unit.property_id,
        propertyName: unit.property_name,
        propertyCode: unit.property_code,
        displayName: `${unit.property_name} - Unit ${unit.unit_number}`
      }))
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching units',
      error: error.message
    });
  }
});

// Get units by property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    const [units] = await pool.execute(
      `SELECT u.*, p.name as property_name 
       FROM units u 
       JOIN properties p ON u.property_id = p.id 
       WHERE u.property_id = ? AND u.is_active = TRUE
       ORDER BY u.unit_number`,
      [propertyId]
    );

    res.json({
      success: true,
      data: units.map(unit => ({
        id: unit.id,
        unitNumber: unit.unit_number,
        floor: unit.floor,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        squareFeet: unit.square_feet,
        isOccupied: unit.is_occupied,
        propertyName: unit.property_name
      }))
    });
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching units',
      error: error.message
    });
  }
});

module.exports = router;
