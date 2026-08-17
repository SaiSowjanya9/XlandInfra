// Quick email test script
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('=== Email Configuration Test ===');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '****' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: parseInt(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Test the connection
transporter.verify(function(error, success) {
  if (error) {
    console.log('\n❌ Email connection FAILED:');
    console.log(error.message);
    console.log('\nPossible fixes:');
    console.log('1. Generate a new App Password in Google Account > Security > 2-Step Verification > App Passwords');
    console.log('2. Make sure 2-Step Verification is enabled on the Gmail account');
    console.log('3. Check if the app password is correct (16 characters, no spaces)');
  } else {
    console.log('\n✅ Email server is ready to send messages!');
    
    // Send a test email
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to self
      subject: 'XLAND INFRA - Email Test',
      text: 'If you receive this, email is working!'
    }).then(info => {
      console.log('✅ Test email sent successfully!');
      console.log('Message ID:', info.messageId);
      process.exit(0);
    }).catch(err => {
      console.log('❌ Failed to send test email:', err.message);
      process.exit(1);
    });
  }
});
