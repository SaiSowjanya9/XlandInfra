const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendContactNotification } = require('../services/emailService');

// Initialize contact_submissions table
const initContactTable = async () => {
  try {
    if (!db.pool || !db.isDbConnected) {
      console.log('⚠️ Skipping contact table initialization - database not connected');
      return;
    }
    await db.pool.execute(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Contact submissions table initialized');
  } catch (error) {
    console.error('Error initializing contact table:', error.message);
  }
};

// Initialize table after a short delay to allow database connection
setTimeout(() => initContactTable(), 2000);

// Submit contact form
router.post('/', async (req, res) => {
  console.log('📝 Contact form submission received:', { name: req.body.name, email: req.body.email, phone: req.body.phone });
  
  try {
    const { name, email, phone, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      console.log('❌ Contact form validation failed - missing fields');
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required'
      });
    }

    // Check if database is connected
    if (!db.pool || !db.isDbConnected) {
      // Still send email notification even without database
      const emailSent = await sendContactNotification({
        name,
        email,
        phone: phone || null,
        message,
        createdAt: new Date()
      });

      return res.status(201).json({
        success: true,
        message: 'Your message has been submitted successfully',
        data: {
          id: null,
          emailNotification: emailSent,
          note: 'Database not connected - email notification sent'
        }
      });
    }

    // Store submission in MySQL
    const [result] = await db.pool.execute(
      `INSERT INTO contact_submissions (name, email, phone, message, status)
       VALUES (?, ?, ?, ?, 'new')`,
      [name, email, phone || null, message]
    );

    const insertId = result.insertId;
    
    // Fetch the inserted record
    const [rows] = await db.pool.execute(
      `SELECT id, name, email, phone, message, status, created_at FROM contact_submissions WHERE id = ?`,
      [insertId]
    );
    
    const submission = rows[0];
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
    if (!db.pool || !db.isDbConnected) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        note: 'Database not connected'
      });
    }

    const [rows] = await db.pool.execute(
      `SELECT * FROM contact_submissions ORDER BY created_at DESC`
    );
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
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

    if (!db.pool || !db.isDbConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }

    const [result] = await db.pool.execute(
      `UPDATE contact_submissions 
       SET status = ? 
       WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Fetch updated record
    const [rows] = await db.pool.execute(
      `SELECT * FROM contact_submissions WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      data: rows[0]
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

    if (!db.pool || !db.isDbConnected) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }

    const [result] = await db.pool.execute(
      `DELETE FROM contact_submissions WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
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
