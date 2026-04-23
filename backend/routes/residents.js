const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

// Verify resident for registration (match against pre-registered data)
router.post('/verify', async (req, res) => {
  try {
    const { unitId, email, firstName, lastName, phone } = req.body;

    if (!unitId || !email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if resident exists with matching details
    const [residents] = await pool.execute(
      `SELECT r.*, u.unit_number, p.name as property_name, p.property_id 
       FROM residents r 
       JOIN units u ON r.unit_id = u.id 
       JOIN properties p ON u.property_id = p.id
       WHERE r.unit_id = ? 
       AND LOWER(r.email) = LOWER(?) 
       AND LOWER(r.first_name) = LOWER(?) 
       AND LOWER(r.last_name) = LOWER(?)
       AND r.is_active = TRUE`,
      [unitId, email, firstName, lastName]
    );

    if (residents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sorry, we couldn't find any records matching the data entered. Please try again. If the problem persists, please contact your community management."
      });
    }

    const resident = residents[0];

    if (resident.is_registered) {
      return res.status(400).json({
        success: false,
        message: 'This account has already been registered. Please login instead.'
      });
    }

    res.json({
      success: true,
      message: 'Resident verified successfully',
      data: {
        residentId: resident.resident_id,
        firstName: resident.first_name,
        lastName: resident.last_name,
        email: resident.email,
        unitNumber: resident.unit_number,
        propertyName: resident.property_name,
        propertyId: resident.property_id
      }
    });
  } catch (error) {
    console.error('Error verifying resident:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying resident',
      error: error.message
    });
  }
});

// Complete resident registration (set password)
router.post('/register', async (req, res) => {
  try {
    const { residentId, password } = req.body;

    if (!residentId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Resident ID and password are required'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update resident as registered
    const [result] = await pool.execute(
      `UPDATE residents 
       SET is_registered = TRUE, 
           password_hash = ?, 
           registration_date = NOW() 
       WHERE resident_id = ? AND is_active = TRUE`,
      [passwordHash, residentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    // Fetch updated resident info
    const [residents] = await pool.execute(
      `SELECT r.*, u.unit_number, p.name as property_name, p.property_id 
       FROM residents r 
       JOIN units u ON r.unit_id = u.id 
       JOIN properties p ON u.property_id = p.id
       WHERE r.resident_id = ?`,
      [residentId]
    );

    res.json({
      success: true,
      message: 'Registration completed successfully',
      data: {
        residentId: residents[0].resident_id,
        firstName: residents[0].first_name,
        lastName: residents[0].last_name,
        email: residents[0].email,
        unitNumber: residents[0].unit_number,
        propertyName: residents[0].property_name
      }
    });
  } catch (error) {
    console.error('Error registering resident:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing registration',
      error: error.message
    });
  }
});

// Resident login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const [residents] = await pool.execute(
      `SELECT r.*, u.unit_number, u.id as unit_id, p.name as property_name, p.id as property_db_id, p.property_id 
       FROM residents r 
       JOIN units u ON r.unit_id = u.id 
       JOIN properties p ON u.property_id = p.id
       WHERE LOWER(r.email) = LOWER(?) AND r.is_active = TRUE AND r.is_registered = TRUE`,
      [email]
    );

    if (residents.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const resident = residents[0];
    const isValidPassword = await bcrypt.compare(password, resident.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        id: resident.id,
        residentId: resident.resident_id,
        firstName: resident.first_name,
        lastName: resident.last_name,
        email: resident.email,
        phone: resident.phone,
        unitId: resident.unit_id,
        unitNumber: resident.unit_number,
        propertyId: resident.property_db_id,
        propertyCode: resident.property_id,
        propertyName: resident.property_name
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// Get resident profile
router.get('/profile/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;

    const [residents] = await pool.execute(
      `SELECT r.*, u.unit_number, p.name as property_name, p.property_id, p.address 
       FROM residents r 
       JOIN units u ON r.unit_id = u.id 
       JOIN properties p ON u.property_id = p.id
       WHERE r.resident_id = ? AND r.is_active = TRUE`,
      [residentId]
    );

    if (residents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resident not found'
      });
    }

    const resident = residents[0];

    res.json({
      success: true,
      data: {
        residentId: resident.resident_id,
        firstName: resident.first_name,
        lastName: resident.last_name,
        email: resident.email,
        phone: resident.phone,
        unitNumber: resident.unit_number,
        propertyName: resident.property_name,
        propertyId: resident.property_id,
        propertyAddress: resident.address,
        leaseStartDate: resident.lease_start_date,
        leaseEndDate: resident.lease_end_date
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
});

module.exports = router;
