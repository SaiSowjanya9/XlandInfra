const nodemailer = require('nodemailer');

// Email configuration - uses environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // Use App Password for Gmail
  }
});

// Notification email address
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'ssmspy@gmail.com';

// Send notification for new work order submission
const sendWorkOrderNotification = async (workOrder) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: NOTIFICATION_EMAIL,
    subject: `New Work Order Submitted - ${workOrder.orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1e293b; color: #f1f5f9;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #d97706;">
          <h1 style="color: #fbbf24; margin: 0;">XlandInfra Customer Portal</h1>
          <p style="color: #94a3b8; margin-top: 5px;">New Work Order Notification</p>
        </div>
        
        <div style="padding: 20px 0;">
          <h2 style="color: #fbbf24; margin-bottom: 15px;">Work Order Details</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Order Number:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9; font-weight: bold;">${workOrder.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Category:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${workOrder.categoryName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Subcategory:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${workOrder.subcategoryName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Description:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${workOrder.description || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Permission to Enter:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${workOrder.permissionToEnter === 'yes' ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Has Pet:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${workOrder.hasPet === 'yes' ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Status:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #fbbf24; font-weight: bold;">${workOrder.status.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #94a3b8;">Submitted At:</td>
              <td style="padding: 10px; color: #f1f5f9;">${new Date(workOrder.createdAt).toLocaleString()}</td>
            </tr>
          </table>
          
          ${workOrder.entryNotes ? `
          <div style="margin-top: 20px; padding: 15px; background-color: #334155; border-radius: 8px;">
            <h3 style="color: #fbbf24; margin: 0 0 10px 0;">Entry Notes:</h3>
            <p style="color: #f1f5f9; margin: 0;">${workOrder.entryNotes}</p>
          </div>
          ` : ''}
          
          ${workOrder.attachments && workOrder.attachments.length > 0 ? `
          <div style="margin-top: 20px;">
            <h3 style="color: #fbbf24;">Attachments: ${workOrder.attachments.length} file(s)</h3>
          </div>
          ` : ''}
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #334155; color: #64748b; font-size: 12px;">
          <p>This is an automated notification from XlandInfra Customer Portal</p>
          <p>© ${new Date().getFullYear()} XlandInfra Pvt Ltd. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Work order notification sent to ${NOTIFICATION_EMAIL}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    return false;
  }
};

// Send notification for contact form submission
const sendContactNotification = async (contactData) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: NOTIFICATION_EMAIL,
    subject: `New Contact Form Submission - ${contactData.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1e293b; color: #f1f5f9;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #d97706;">
          <h1 style="color: #fbbf24; margin: 0;">XlandInfra Customer Portal</h1>
          <p style="color: #94a3b8; margin-top: 5px;">New Contact Form Submission</p>
        </div>
        
        <div style="padding: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9; font-weight: bold;">${contactData.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${contactData.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Phone:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${contactData.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #94a3b8;">Submitted At:</td>
              <td style="padding: 10px; color: #f1f5f9;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #334155; border-radius: 8px;">
            <h3 style="color: #fbbf24; margin: 0 0 10px 0;">Message:</h3>
            <p style="color: #f1f5f9; margin: 0; white-space: pre-wrap;">${contactData.message}</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #334155; color: #64748b; font-size: 12px;">
          <p>This is an automated notification from XlandInfra Customer Portal</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Contact notification sent to ${NOTIFICATION_EMAIL}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    return false;
  }
};

// Send notification for new user registration
const sendRegistrationNotification = async (userData) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: NOTIFICATION_EMAIL,
    subject: `New User Registration - ${userData.firstName} ${userData.lastName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1e293b; color: #f1f5f9;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #d97706;">
          <h1 style="color: #fbbf24; margin: 0;">XlandInfra Customer Portal</h1>
          <p style="color: #94a3b8; margin-top: 5px;">New User Registration</p>
        </div>
        
        <div style="padding: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9; font-weight: bold;">${userData.firstName} ${userData.lastName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${userData.email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Phone:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${userData.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #94a3b8;">Unit Number:</td>
              <td style="padding: 10px; border-bottom: 1px solid #334155; color: #f1f5f9;">${userData.unitNumber || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; color: #94a3b8;">Registered At:</td>
              <td style="padding: 10px; color: #f1f5f9;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid #334155; color: #64748b; font-size: 12px;">
          <p>This is an automated notification from XlandInfra Customer Portal</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Registration notification sent to ${NOTIFICATION_EMAIL}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    return false;
  }
};

module.exports = {
  sendWorkOrderNotification,
  sendContactNotification,
  sendRegistrationNotification,
  NOTIFICATION_EMAIL
};
