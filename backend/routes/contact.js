const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { sendContactNotification } = require('../services/emailService');

// Initialize contact_submissions table
const initContactTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Contact submissions table initialized');
  } catch (error) {
    console.error('Error initializing contact table:', error.message);
  }
};

// Initialize table on module load
initContactTable();

// Submit contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    // Store submission in PostgreSQL
    const result = await pool.query(
      `INSERT INTO contact_submissions (name, email, phone, message, status)
       VALUES ($1, $2, $3, $4, 'new')
       RETURNING id, name, email, phone, message, status, created_at`,
      [name, email, phone || null, message]
    );

    const submission = result.rows[0];
    console.log('📝 New contact submission saved to database:', submission);

    // Send email notification
    const emailSent = await sendContactNotification({
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      message: submission.message,
      createdAt: submission.created_at
    });

    res.status(201).json({
      success: true,
      message: 'Your message has been submitted successfully',
      data: {
        id: submission.id,
        emailNotification: emailSent
      }
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting contact form',
      error: error.message
    });
  }
});

// Get all submissions (for admin)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM contact_submissions ORDER BY created_at DESC`
    );
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching contact submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contact submissions',
      error: error.message
    });
  }
});

// Update submission status (for admin)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE contact_submissions 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating submission',
      error: error.message
    });
  }
});

// Delete submission (for admin)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM contact_submissions WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    res.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting submission',
      error: error.message
    });
  }
});

module.exports = router;
