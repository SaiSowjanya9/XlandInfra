const express = require('express');
const router = express.Router();
const { sendContactNotification } = require('../services/emailService');

// In-memory storage for submissions (replace with database in production)
const submissions = [];

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

    // Create submission object
    const submission = {
      id: Date.now().toString(),
      name,
      email,
      phone: phone || null,
      message,
      createdAt: new Date().toISOString(),
      status: 'new'
    };

    // Store submission
    submissions.push(submission);
    console.log('📝 New contact submission:', submission);

    // Send email notification
    const emailSent = await sendContactNotification(submission);

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
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: submissions,
    total: submissions.length
  });
});

module.exports = router;
