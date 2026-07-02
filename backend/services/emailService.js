const nodemailer = require('nodemailer');
const { generateEstimatePDF } = require('./pdfService');
const { pool } = require('../config/database');

// Notification email addresses - Use info@xlandinfra.com only (no Gmail)
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'info@xlandinfra.com';
const CONTACT_EMAILS = ['info@xlandinfra.com'];
// Separate sender email for contact forms to avoid "Note to self" in Outlook
const CONTACT_FORM_SENDER = process.env.CONTACT_FORM_SENDER_EMAIL || process.env.EMAIL_USER;

/**
 * Get work order notification recipients based on property zone
 * Returns: FP email + zone-centric employees' emails + customer email
 * @param {number} franchisePartnerId - The FP ID for the property
 * @param {string} propertyZone - The zone name/id of the property
 * @param {string} customerEmail - Customer's email (optional)
 * @returns {Promise<string[]>} Array of email addresses
 */
const getWorkOrderNotificationRecipients = async (franchisePartnerId, propertyZone, customerEmail = null) => {
  const recipients = new Set();
  
  try {
    // 1. Get FP email
    if (franchisePartnerId) {
      const [fpResult] = await pool.execute(
        `SELECT email FROM franchise_partners WHERE id = ? AND is_active = 1`,
        [franchisePartnerId]
      );
      if (fpResult.length > 0 && fpResult[0].email) {
        recipients.add(fpResult[0].email.toLowerCase());
        console.log(`📧 Added FP email: ${fpResult[0].email}`);
      }
    }
    
    // 2. Get zone-centric employees' emails (ONLY employees with zone restrictions receive emails)
    if (franchisePartnerId && propertyZone) {
      // Get employees who have this zone assigned to them
      const [zoneEmployees] = await pool.execute(
        `SELECT DISTINCT fpe.email 
         FROM fp_employees fpe
         INNER JOIN fp_employee_zones fez ON fpe.id = fez.fp_employee_id
         WHERE fpe.franchise_partner_id = ? 
           AND fpe.is_active = 1 
           AND fpe.email IS NOT NULL
           AND (fez.zone_name = ? OR fez.zone_name = (SELECT name FROM zones WHERE id = ? LIMIT 1))`,
        [franchisePartnerId, propertyZone, propertyZone]
      );
      
      for (const emp of zoneEmployees) {
        if (emp.email) {
          recipients.add(emp.email.toLowerCase());
          console.log(`📧 Added zone employee email: ${emp.email}`);
        }
      }
      
      // NOTE: Employees WITHOUT zone restrictions do NOT receive work order emails
      // Only zone-centric employees (assigned to the property's zone) receive notifications
    }
    
    // 3. Add customer email if provided
    if (customerEmail) {
      recipients.add(customerEmail.toLowerCase());
      console.log(`📧 Added customer email: ${customerEmail}`);
    }
    
  } catch (error) {
    console.error('Error fetching work order notification recipients:', error.message);
    // Fallback to info email if there's an error
    recipients.add(NOTIFICATION_EMAIL);
  }
  
  // If no recipients found, use fallback
  if (recipients.size === 0) {
    recipients.add(NOTIFICATION_EMAIL);
    console.log(`📧 No recipients found, using fallback: ${NOTIFICATION_EMAIL}`);
  }
  
  return Array.from(recipients);
};

// Email configuration - uses environment variables
// Supports custom SMTP servers (Hostinger, GoDaddy, cPanel, etc.)
const createTransporter = () => {
  const host = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT) || 465;
  
  const config = {
    host: host,
    port: port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    // Improved deliverability settings
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5
  };

  console.log(`📧 Email configured: ${host}:${port} as ${process.env.EMAIL_USER}`);
  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

// Default email headers for better deliverability
const getDefaultHeaders = () => ({
  'X-Priority': '3',
  'X-Mailer': 'XLAND INFRA Notification System',
  'Precedence': 'bulk',
  'List-Unsubscribe': `<mailto:${process.env.EMAIL_USER}?subject=Unsubscribe>`,
  'Organization': 'XLAND INFRA Private Limited'
});

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
              <td style="padding: 10px; color: #f1f5f9;">${new Date(workOrder.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
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
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 20px;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#1e293b" style="background-color: #1e293b; max-width: 600px;">
              <!-- Header -->
              <tr>
                <td align="center" bgcolor="#1e293b" style="background-color: #1e293b; padding: 25px 20px; border-bottom: 3px solid #d97706;">
                  <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; color: #fbbf24;">XlandInfra Customer Portal</h1>
                  <p style="margin: 8px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8;">New Contact Form Submission</p>
                </td>
              </tr>
              
              <!-- Content - Order: Name, Email, Phone, City, Subject -->
              <tr>
                <td bgcolor="#1e293b" style="background-color: #1e293b; padding: 25px 30px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Name:</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff; font-weight: bold;">${contactData.name}</td>
                    </tr>
                    <tr>
                      <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Email:</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #60a5fa;"><a href="mailto:${contactData.email}" style="color: #60a5fa; text-decoration: none;">${contactData.email}</a></td>
                    </tr>
                    <tr>
                      <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Phone:</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${contactData.phone || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">City:</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${contactData.city || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Subject:</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${contactData.subject || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td width="120" style="padding: 12px 10px; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Submitted At:</td>
                      <td style="padding: 12px 10px; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Message Section -->
              <tr>
                <td bgcolor="#1e293b" style="background-color: #1e293b; padding: 0 30px 25px 30px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#334155" style="background-color: #334155;">
                    <tr>
                      <td style="padding: 15px;">
                        <h3 style="margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 16px; color: #fbbf24;">Message:</h3>
                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff; line-height: 1.5;">${contactData.message.replace(/\n/g, '<br>')}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td align="center" bgcolor="#1e293b" style="background-color: #1e293b; padding: 20px; border-top: 1px solid #475569;">
                  <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #64748b;">This is an automated notification from XlandInfra Customer Portal</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    // Send separate emails to each recipient for reliable delivery
    const emailPromises = CONTACT_EMAILS.map(async (email) => {
      const mailOptions = {
        from: `"Customer Inquiry" <${CONTACT_FORM_SENDER}>`,
        replyTo: `"${contactData.name}" <${contactData.email}>`,
        to: email,
        subject: `[Customer Inquiry] ${contactData.subject || 'New Inquiry'} - ${contactData.name}`,
        html: emailHtml
      };
      
      try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Contact notification sent to ${email}`);
        return { email, success: true };
      } catch (err) {
        console.error(`❌ Failed to send to ${email}:`, err.message);
        return { email, success: false, error: err.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`📧 Contact notification: ${successCount}/${CONTACT_EMAILS.length} emails sent successfully`);
    
    return successCount > 0;
  } catch (error) {
    console.error('Error sending contact emails:', error.message);
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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#1e293b" style="background-color: #1e293b; max-width: 600px;">
                <!-- Header -->
                <tr>
                  <td align="center" bgcolor="#1e293b" style="background-color: #1e293b; padding: 25px 20px; border-bottom: 3px solid #d97706;">
                    <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; color: #fbbf24;">XlandInfra Customer Portal</h1>
                    <p style="margin: 8px 0 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8;">New User Registration</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td bgcolor="#1e293b" style="background-color: #1e293b; padding: 25px 30px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Name:</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff; font-weight: bold;">${userData.firstName} ${userData.lastName}</td>
                      </tr>
                      <tr>
                        <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Email:</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #60a5fa;"><a href="mailto:${userData.email}" style="color: #60a5fa; text-decoration: none;">${userData.email}</a></td>
                      </tr>
                      <tr>
                        <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Phone:</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${userData.phone || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td width="120" style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Unit Number:</td>
                        <td style="padding: 12px 10px; border-bottom: 1px solid #475569; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${userData.unitNumber || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td width="120" style="padding: 12px 10px; font-family: Arial, sans-serif; font-size: 14px; color: #94a3b8; vertical-align: top;">Registered At:</td>
                        <td style="padding: 12px 10px; font-family: Arial, sans-serif; font-size: 14px; color: #ffffff;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td align="center" bgcolor="#1e293b" style="background-color: #1e293b; padding: 20px; border-top: 1px solid #475569;">
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #64748b;">This is an automated notification from XlandInfra Customer Portal</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
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

// Send customer account activation email
const sendCustomerActivationEmail = async (customerData) => {
  const { email, firstName, tempPassword, activationLink, propertyName, propertyId } = customerData;
  
  console.log('📧 sendCustomerActivationEmail called with:', { email, firstName, propertyName, propertyId, activationLink: activationLink?.substring(0, 50) + '...' });
  console.log('📧 EMAIL_USER configured:', process.env.EMAIL_USER ? 'Yes' : 'NO - MISSING!');
  console.log('📧 EMAIL_PASS configured:', process.env.EMAIL_PASS ? 'Yes' : 'NO - MISSING!');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email credentials not configured! Set EMAIL_USER and EMAIL_PASS in .env');
    return { success: false, error: 'Email credentials not configured' };
  }
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: email,
    subject: `Welcome to XLAND INFRA Customer Portal - Activate Your Account`,
    headers: {
      ...getDefaultHeaders(),
      'X-Entity-Ref-ID': `activation-${Date.now()}`,
      'Message-ID': `<activation-${Date.now()}@xlandinfra.com>`
    },
    text: `Welcome to XLAND INFRA Customer Portal!\n\nHello ${firstName || 'Valued Customer'},\n\nYour account has been created for ${propertyName || 'XLAND INFRA'} property portal.${propertyId ? `\nProperty ID: ${propertyId}` : ''}\n\nYour Login Credentials:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nActivate your account: ${activationLink}\n\nThis link expires in 72 hours.\n\nRegards,\nXLAND INFRA Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 11px; letter-spacing: 3px;">PRIVATE LIMITED</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
            <h2 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Welcome, ${firstName || 'Valued Customer'}!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0;">
              Your customer account has been created for the <strong style="color: #D8B25C;">${propertyName || 'XLAND INFRA'}</strong> property portal.${propertyId ? `<br><span style="color: #888; font-size: 13px;">Property ID: <strong style="color: #D8B25C;">${propertyId}</strong></span>` : ''}
              <br>Please activate your account to access your personalized dashboard.
            </p>
            
            <!-- Credentials Box -->
            <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Login Credentials</h3>
              
              <div style="margin-bottom: 15px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Registered Email</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #333;">${email}</p>
              </div>
              
              <div>
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                <p style="color: #D8B25C; font-size: 20px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #D8B25C44; letter-spacing: 3px; font-weight: bold;">${tempPassword}</p>
              </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${activationLink}" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
                ACTIVATE YOUR ACCOUNT
              </a>
            </div>
            
            <p style="color: #888; font-size: 13px; text-align: center; margin: 25px 0 0 0;">
              Or copy and paste this link in your browser:<br>
              <a href="${activationLink}" style="color: #D8B25C; word-break: break-all; font-size: 12px;">${activationLink}</a>
            </p>
            
            <!-- Warning -->
            <div style="background: #2a1a0a; border: 1px solid #D8B25C44; border-radius: 8px; padding: 15px 20px; margin-top: 30px;">
              <p style="color: #D8B25C; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>Important:</strong> This activation link will expire in <strong>72 hours</strong>. 
                Please activate your account and set a new password before the link expires.
              </p>
            </div>
            
            <!-- Login Info -->
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 15px 20px; margin-top: 20px; text-align: center;">
              <p style="color: #888; font-size: 13px; margin: 0;">
                After activation, login at: <a href="https://xlandinfra.com/login" style="color: #D8B25C; font-weight: bold;">https://xlandinfra.com/login</a>
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
            <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-align: center;">
              If you did not request this account, please ignore this email or contact our support team.
            </p>
            <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    console.log('📧 Attempting to send email via transporter...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Customer activation email sent to ${email} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending customer activation email:', error.message);
    console.error('❌ Full error:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset confirmation email
const sendPasswordResetConfirmation = async (customerData) => {
  const { email, firstName } = customerData;
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Account Activated Successfully - XLAND INFRA Customer Portal`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none; text-align: center;">
            <h2 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Account Activated!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
              Hi ${firstName || 'Valued Customer'}, your account has been successfully activated. 
              You can now log in to your Customer Portal using your email and the password you just created.
            </p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px;">
              LOGIN TO YOUR PORTAL
            </a>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
            <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Account activation confirmation sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending confirmation email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send welcome email to new employee/staff user
const sendEmployeeWelcomeEmail = async (userData) => {
  const { email, firstName, lastName, username, tempPassword, role, userId, loginUrl } = userData;
  
  const roleLabels = {
    admin: 'Admin',
    operations_manager: 'Operations Manager',
    franchise_partner: 'Franchise Partner',
    franchise: 'Franchise Partner',
    manager: 'Manager',
    coordinator: 'Coordinator',
    supervisor: 'Supervisor',
    executive: 'Executive'
  };
  
  const roleLabel = roleLabels[role] || role;
  const portalUrl = loginUrl || process.env.ADMIN_PORTAL_URL || 'https://admin.xlandinfra.com';
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: email,
    subject: `Welcome to XLAND INFRA - Your Account Has Been Created`,
    headers: {
      ...getDefaultHeaders(),
      'X-Entity-Ref-ID': `employee-welcome-${Date.now()}`,
      'Message-ID': `<employee-${Date.now()}@xlandinfra.com>`
    },
    text: `Welcome to XLAND INFRA!\n\nHello ${firstName || 'Team Member'},\n\nYour account has been created for XLAND INFRA Service Portal.\nRole: ${roleLabel}\n\nYour Login Credentials:\nUser ID: ${userId}\nUsername: ${username || email}\nTemporary Password: ${tempPassword}\n\nLogin at: ${portalUrl}\n\nYou will be required to change your password on first login.\n\nRegards,\nXLAND INFRA Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 11px; letter-spacing: 3px;">PRIVATE LIMITED</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
            <h2 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Welcome, ${firstName || 'Team Member'}!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0;">
              Your account has been created for the <strong style="color: #D8B25C;">XLAND INFRA Service Portal</strong>. 
              You have been assigned the role of <strong style="color: #D8B25C;">${roleLabel}</strong>.
            </p>
            
            <!-- Credentials Box -->
            <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Login Credentials</h3>
              
              <div style="margin-bottom: 15px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">User ID</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #333;">${userId}</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Username / Email</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #333;">${username || email}</p>
              </div>
              
              <div>
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                <p style="color: #D8B25C; font-size: 20px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #D8B25C44; letter-spacing: 3px; font-weight: bold;">${tempPassword}</p>
              </div>
            </div>
            
            <!-- Login Instructions -->
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 16px;">Login Instructions</h3>
              <ol style="color: #cccccc; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Go to the XLAND INFRA Service Portal</li>
                <li>Enter your username/email and temporary password</li>
                <li>You will be prompted to create a new password</li>
                <li>Set your new password to complete account setup</li>
              </ol>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
                LOGIN TO PORTAL
              </a>
            </div>
            
            <p style="color: #888; font-size: 13px; text-align: center; margin: 25px 0 0 0;">
              Or copy and paste this link in your browser:<br>
              <a href="${portalUrl}" style="color: #D8B25C; word-break: break-all; font-size: 12px;">${portalUrl}</a>
            </p>
            
            <!-- Warning -->
            <div style="background: #2a1a0a; border: 1px solid #D8B25C44; border-radius: 8px; padding: 15px 20px; margin-top: 30px;">
              <p style="color: #D8B25C; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>Important:</strong> For security reasons, you must change your temporary password on your first login. 
                Keep your credentials secure and do not share them with anyone.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
            <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-align: center;">
              If you did not expect this email, please contact your administrator immediately.
            </p>
            <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Employee welcome email sent to ${email} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending employee welcome email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send welcome email to new FP Employee with login instructions
const sendFPEmployeeWelcomeEmail = async (userData) => {
  const { email, firstName, lastName, username, userId, tempPassword, companyName, role, loginUrl } = userData;
  
  const roleLabels = {
    fp_admin: 'FP Admin',
    fp_manager: 'FP Manager',
    fp_supervisor: 'FP Supervisor',
    fp_executive: 'FP Executive'
  };
  
  const roleLabel = roleLabels[role] || 'Employee';
  const portalUrl = loginUrl || process.env.ADMIN_PORTAL_URL || 'http://localhost:5174';
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Welcome to XLAND INFRA - Your Employee Account Has Been Created`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 11px; letter-spacing: 3px;">PRIVATE LIMITED</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
            <h2 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Welcome, ${firstName || 'Team Member'}!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0;">
              Your employee account has been created for <strong style="color: #D8B25C;">${companyName || 'XLAND INFRA'}</strong>. 
              You have been assigned the role of <strong style="color: #D8B25C;">${roleLabel}</strong>.
            </p>
            
            <!-- Credentials Box -->
            <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Login Credentials</h3>
              
              <div style="margin-bottom: 15px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Employee ID</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #333;">${userId}</p>
              </div>
              
              <div style="margin-bottom: 15px;">
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Login Email</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #333;">${email}</p>
              </div>
              
              <div>
                <p style="color: #888; font-size: 12px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                <p style="color: #D8B25C; font-size: 20px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 12px 15px; border-radius: 8px; border: 1px solid #D8B25C44; letter-spacing: 3px; font-weight: bold;">${tempPassword}</p>
              </div>
            </div>
            
            <!-- Login Instructions -->
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 16px;">First-Time Login Instructions</h3>
              <ol style="color: #cccccc; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                <li>Click the <strong style="color: #D8B25C;">"Login to Portal"</strong> button below</li>
                <li>Select <strong style="color: #D8B25C;">"Employee Portal"</strong> from the portal options</li>
                <li>Enter your <strong>email</strong> and <strong>temporary password</strong> shown above</li>
                <li>You will be prompted to create a <strong>new secure password</strong></li>
                <li>Set your new password (minimum 8 characters) to activate your account</li>
                <li>Once activated, you can access all your assigned features</li>
              </ol>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
                LOGIN TO PORTAL
              </a>
            </div>
            
            <p style="color: #888; font-size: 13px; text-align: center; margin: 25px 0 0 0;">
              Or copy and paste this link in your browser:<br>
              <a href="${portalUrl}" style="color: #D8B25C; word-break: break-all; font-size: 12px;">${portalUrl}</a>
            </p>
            
            <!-- Security Warning -->
            <div style="background: #2a1a0a; border: 1px solid #D8B25C44; border-radius: 8px; padding: 15px 20px; margin-top: 30px;">
              <p style="color: #D8B25C; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>Security Notice:</strong> For your protection, you <strong>must change</strong> your temporary password on your first login. 
                Choose a strong password with at least 8 characters. Never share your password with anyone.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
            <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-align: center;">
              If you did not expect this email, please contact your administrator immediately.
            </p>
            <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 FP Employee welcome email sent to ${email} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending FP employee welcome email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send estimate email to customer with Approve/Reject buttons
const sendEstimateEmail = async (estimate, actionToken) => {
  const { 
    customerName, customerEmail, estimateId, propertyName, propertyType,
    zone, division, city, address,
    numberOfBlocks, blockNames, unitsPerBlock, totalUnits,
    towerName, blockNumber, villaPlotNumber,
    services, addons, subtotal, discount, tax, total, validUntil,
    amcPackageDescription, packageName, description
  } = estimate;
  
  if (!customerEmail) {
    return { success: false, error: 'No customer email provided' };
  }

  // Base URL for action links
  const baseUrl = process.env.FRONTEND_URL || 'https://admin.xlandinfra.com';
  const approveUrl = `${baseUrl}/estimate-action/${estimateId}?action=approve&token=${actionToken}`;
  const rejectUrl = `${baseUrl}/estimate-action/${estimateId}?action=reject&token=${actionToken}`;

  // Format services list with descriptions
  const servicesHtml = (services || []).map(s => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${s.name || s.service || 'Service'}</strong>
        ${s.frequencyType ? `<br><span style="font-size: 12px; color: #6b7280;">${s.frequencyType} - ${s.frequencyCount || 1} visits</span>` : ''}
        ${s.description ? `<br><span style="font-size: 12px; color: #6b7280;">${s.description}</span>` : ''}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top;">₹${Number(s.price || s.rate || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  // Format addons list with descriptions
  const addonsHtml = (addons || []).map(a => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${a.name || a.serviceName || a.services?.[0]?.name || 'Add-on'}</strong>
        ${a.frequency_type || a.frequencyType ? `<br><span style="font-size: 12px; color: #6b7280;">${a.frequency_type || a.frequencyType} - ${a.frequency_count || a.frequencyCount || 1} visits</span>` : ''}
        ${a.description ? `<br><span style="font-size: 12px; color: #6b7280;">${a.description}</span>` : ''}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top;">₹${Number(a.price || a.totalPrice || a.services?.[0]?.price || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  // Calculate expiry date (1 month from now)
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 1);

  // Get property type label
  const getPropertyTypeLabel = (type) => {
    const labels = { 'GC': 'Gated Community', 'APT': 'Apartment', 'Apt': 'Apartment', 'VILLA': 'Villa', 'PLOT': 'Plot' };
    return labels[type] || type || '-';
  };

  // Build property details HTML based on property type
  let propertyDetailsHtml = `
    <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Property Type:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${getPropertyTypeLabel(propertyType)}</td></tr>
    ${zone ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Zone:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${zone}</td></tr>` : ''}
    ${division ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Division:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${division}</td></tr>` : ''}
    ${city ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">City:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${city}</td></tr>` : ''}
    ${address ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Address:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${address}</td></tr>` : ''}
  `;

  // GC-specific fields
  if (['GC', 'gated_community', 'Gated Community'].includes(propertyType)) {
    propertyDetailsHtml += `
      ${numberOfBlocks ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Number of Blocks:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${numberOfBlocks}</td></tr>` : ''}
      ${totalUnits ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Total Units:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${totalUnits}</td></tr>` : ''}
    `;
    // Add block details if available
    if (blockNames && Object.keys(blockNames).length > 0) {
      const blockDetailsList = Object.entries(blockNames).map(([key, name]) => 
        `${name || 'Block ' + key}: ${unitsPerBlock?.[key] || 0} units`
      ).join(', ');
      propertyDetailsHtml += `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Block Details:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${blockDetailsList}</td></tr>`;
    }
  }

  // Apartment-specific fields
  if (['APT', 'Apt', 'apartment', 'Apartment'].includes(propertyType)) {
    propertyDetailsHtml += `
      ${towerName ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Tower/Building:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${towerName}</td></tr>` : ''}
      ${blockNumber ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Block Number:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${blockNumber}</td></tr>` : ''}
      ${totalUnits ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Number of Units:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${totalUnits}</td></tr>` : ''}
    `;
  }

  // Villa/Plot-specific fields
  if (['VILLA', 'Villa', 'villa', 'PLOT', 'Plot', 'plot'].includes(propertyType)) {
    propertyDetailsHtml += `
      ${villaPlotNumber ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Villa/Plot Number:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${villaPlotNumber}</td></tr>` : ''}
    `;
  }

  // Generate PDF attachment
  let pdfBuffer = null;
  try {
    // Debug log: values being passed to PDF
    console.log('[Email Service] Price values for PDF:', {
      subtotal, discount, discountAmount: estimate.discountAmount,
      tax, gstPercent: estimate.gstPercent, total
    });
    
    pdfBuffer = await generateEstimatePDF({
      estimateId, customerName, customerEmail, customerPhone: estimate.customerPhone,
      propertyName, propertyType, propertyCode: estimate.propertyCode, zone, division, city, address,
      numberOfBlocks, totalUnits, towerName, blockNumber, villaPlotNumber,
      packageName, packagePrice: estimate.packagePrice, amcPackageDescription, 
      services, addons, subtotal, discount, discountAmount: estimate.discountAmount,
      tax, gstPercent: estimate.gstPercent, total, description, createdAt: estimate.createdAt
    });
    console.log(`📄 PDF generated for estimate ${estimateId}`);
  } catch (pdfError) {
    console.error('PDF generation failed:', pdfError.message);
  }

  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: customerEmail,
    subject: `Your Estimate ${estimateId} from XLAND INFRA - Action Required`,
    headers: getDefaultHeaders(),
    attachments: pdfBuffer ? [{
      filename: `Estimate_${estimateId}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }] : [],
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">XLAND INFRA</h1>
            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Pvt. Ltd.</p>
          </div>
          
          <!-- Content -->
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Hello ${customerName || 'Valued Customer'},</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for your interest in our services. Please find attached the detailed estimate for your property.
            </p>
            
            <!-- Estimate Info -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Estimate ID:</td>
                  <td style="padding: 8px 0; padding-left: 15px; color: #1f2937; font-weight: 600;">${estimateId}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Valid Until:</td>
                  <td style="padding: 8px 0; padding-left: 15px; color: #dc2626; font-weight: 600;">${expiryDate.toLocaleDateString('en-IN')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">AMC Package:</td>
                  <td style="padding: 8px 0; padding-left: 15px; color: #4338ca; font-weight: 600;">${packageName || '-'}</td>
                </tr>
              </table>
            </div>
            
            <!-- Property Details -->
            <div style="background: #eff6ff; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
              <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Property Details</h3>
              <table style="width: 100%;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Property Name:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937; font-weight: 500;">${propertyName || '-'}</td></tr>
                ${propertyDetailsHtml}
              </table>
            </div>
            
            <!-- Customer Details -->
            <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 600;">Customer Details</h3>
              <table style="width: 100%;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Name:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937; font-weight: 500;">${customerName || '-'}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Email:</td><td style="padding: 6px 0; padding-left: 15px; color: #1f2937;">${customerEmail || '-'}</td></tr>
              </table>
            </div>
            
            <!-- Price Summary -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
              <h3 style="margin: 0 0 15px 0; color: #374151; font-size: 14px; font-weight: 600;">Price Summary</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal:</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500;">₹ ${Number(subtotal || 0).toLocaleString()}</td>
                </tr>
                ${discount > 0 ? `<tr>
                  <td style="padding: 8px 0; color: #059669; font-size: 14px;">Discount (${discount}%):</td>
                  <td style="padding: 8px 0; text-align: right; color: #059669; font-weight: 500;">- ₹ ${Number(estimate.discountAmount || 0).toLocaleString()}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">GST (${estimate.gstPercent || 0}%):</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500;">₹ ${Number(tax || 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <!-- Total Amount -->
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
              <p style="color: #e0e7ff; margin: 0 0 5px 0; font-size: 14px;">Total Estimate Amount</p>
              <p style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">₹ ${Number(total || 0).toLocaleString()}</p>
            </div>
            
            <!-- PDF Notice -->
            <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
              <p style="color: #065f46; margin: 0; font-size: 14px;">
                📎 <strong>Detailed estimate attached as PDF</strong><br>
                <span style="font-size: 12px; color: #047857;">Please find the complete breakdown of AMC package services, add-ons, and pricing in the attached PDF document.</span>
              </p>
            </div>
            
            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #374151; font-weight: 600; margin-bottom: 20px; font-size: 16px;">Please review and take action:</p>
              <a href="${approveUrl}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 16px; font-weight: 600; margin-right: 15px;">
                ✓ Approve Estimate
              </a>
              <a href="${rejectUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                ✗ Reject Estimate
              </a>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-top: 20px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>⚠️ Important:</strong> This estimate will automatically expire on <strong>${expiryDate.toLocaleDateString('en-IN')}</strong> if no action is taken.
              </p>
            </div>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 25px 0 0 0; font-size: 14px;">
              If you have any questions about this estimate, please don't hesitate to contact us at <a href="mailto:info@xlandinfra.com" style="color: #1e40af;">info@xlandinfra.com</a>.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.</p>
            <p style="margin: 8px 0 0 0;">This is an automated email. Please do not reply directly.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Estimate email sent to ${customerEmail} (Estimate: ${estimateId}, Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending estimate email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send notification to admins when estimate is approved/rejected
const sendEstimateActionNotification = async (estimate, action, customerName) => {
  const { estimateId, propertyName, total, customerEmail } = estimate;
  const actionColor = action === 'Approved' ? '#059669' : '#dc2626';
  const actionEmoji = action === 'Approved' ? '✅' : '❌';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">XLAND INFRA</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Estimate ${action} Notification</p>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 25px;">
            <span style="font-size: 48px;">${actionEmoji}</span>
            <h2 style="color: ${actionColor}; margin: 15px 0 0 0; font-size: 24px;">Estimate ${action}</h2>
          </div>
          
          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Estimate ID:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${estimateId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Customer Name:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${customerName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Customer Email:</td>
                <td style="padding: 8px 0; color: #1f2937; text-align: right;">${customerEmail || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Property:</td>
                <td style="padding: 8px 0; color: #1f2937; text-align: right;">${propertyName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Total Amount:</td>
                <td style="padding: 8px 0; color: #1e40af; font-weight: 700; font-size: 18px; text-align: right;">₹${Number(total || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Action Date:</td>
                <td style="padding: 8px 0; color: #1f2937; text-align: right;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #4b5563; line-height: 1.6; margin: 0; font-size: 14px; text-align: center;">
            The customer has <strong style="color: ${actionColor};">${action.toLowerCase()}</strong> the estimate. 
            ${action === 'Approved' ? 'Please proceed with the next steps.' : 'You may follow up with the customer for feedback.'}
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send to admin emails - info@xlandinfra.com only
  const adminEmails = ['info@xlandinfra.com'];
  
  try {
    const emailPromises = adminEmails.map(async (email) => {
      const mailOptions = {
        from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${actionEmoji} Estimate ${estimateId} ${action} by ${customerName || 'Customer'}`,
        headers: getDefaultHeaders(),
        html: emailHtml
      };
      
      try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 Estimate action notification sent to ${email}`);
        return { email, success: true };
      } catch (err) {
        console.error(`❌ Failed to send to ${email}:`, err.message);
        return { email, success: false, error: err.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`📧 Estimate action notification: ${successCount}/${adminEmails.length} emails sent`);
    return { success: successCount > 0, results };
  } catch (error) {
    console.error('Error sending estimate action notification:', error.message);
    return { success: false, error: error.message };
  }
};

// Send password reset email with temporary password
const sendPasswordResetEmail = async (userData) => {
  const { email, firstName, tempPassword, resetLink, userType, expiryHours } = userData;
  
  const portalName = userType === 'customer' ? 'Customer Portal' : 'Service Portal';
  const portalLabel = userType === 'customer' ? 'HomeHub' : 'Admin';
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: email,
    subject: `Password Reset Request - XLAND INFRA ${portalLabel} Portal`,
    headers: {
      ...getDefaultHeaders(),
      'X-Entity-Ref-ID': `password-reset-${Date.now()}`,
      'Message-ID': `<pwd-reset-${Date.now()}@xlandinfra.com>`
    },
    text: `Password Reset Request\n\nHello ${firstName || 'User'},\n\nWe received a request to reset your password for XLAND INFRA ${portalName}.\n\nTemporary Password: ${tempPassword}\n\nReset your password: ${resetLink}\n\nThis link expires in ${expiryHours || 48} hours.\n\nIf you did not request this, please ignore this email.\n\nRegards,\nXLAND INFRA Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 11px; letter-spacing: 3px;">PRIVATE LIMITED</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
            <div style="text-align: center; margin-bottom: 25px;">
              <h2 style="color: #D8B25C; margin: 0; font-size: 24px; font-weight: 400;">Password Reset Request</h2>
            </div>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0; text-align: center;">
              Hello <strong style="color: #ffffff;">${firstName || 'User'}</strong>, we received a request to reset your password for the <strong style="color: #D8B25C;">${portalName}</strong>.
            </p>
            
            <!-- Temporary Password Box -->
            <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Your Temporary Password</h3>
              
              <div style="text-align: center;">
                <p style="color: #D8B25C; font-size: 28px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 15px 20px; border-radius: 8px; border: 1px solid #D8B25C44; letter-spacing: 4px; font-weight: bold; display: inline-block;">${tempPassword}</p>
              </div>
              
              <p style="color: #888; font-size: 12px; text-align: center; margin: 15px 0 0 0;">
                Use this temporary password along with your new password to complete the reset
              </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetLink}" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
                RESET PASSWORD
              </a>
            </div>
            
            <p style="color: #888; font-size: 13px; text-align: center; margin: 25px 0 0 0;">
              Or copy and paste this link in your browser:<br>
              <a href="${resetLink}" style="color: #D8B25C; word-break: break-all; font-size: 12px;">${resetLink}</a>
            </p>
            
            <!-- Warning -->
            <div style="background: #2a1a0a; border: 1px solid #D8B25C44; border-radius: 8px; padding: 15px 20px; margin-top: 30px;">
              <p style="color: #D8B25C; font-size: 13px; margin: 0; line-height: 1.6;">
                <strong>Important:</strong> This password reset link will expire in <strong>${expiryHours || 48} hours</strong>. 
                If you did not request this password reset, please ignore this email or contact support.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
            <p style="color: #666; font-size: 12px; margin: 0 0 10px 0; text-align: center;">
              If you did not request this password reset, you can safely ignore this email.
            </p>
            <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Password reset email sent to ${email} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send password reset success confirmation
const sendPasswordResetSuccess = async (userData) => {
  const { email, firstName, userType } = userData;
  
  const portalName = userType === 'customer' ? 'Customer Portal' : 'Service Portal';
  const loginUrl = userType === 'customer' 
    ? (process.env.FRONTEND_URL || 'https://xlandinfra.com') + '/login'
    : (process.env.ADMIN_PORTAL_URL || 'https://admin.xlandinfra.com');
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Password Reset Successful - XLAND INFRA`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none; text-align: center;">
            <h2 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Password Reset Successful!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
              Hi ${firstName || 'User'}, your password for the <strong style="color: #D8B25C;">${portalName}</strong> has been successfully reset. 
              You can now log in with your new password.
            </p>
            
            <a href="${loginUrl}" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px;">
              LOGIN NOW
            </a>
            
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 15px 20px; margin-top: 30px;">
              <p style="color: #888; font-size: 13px; margin: 0; line-height: 1.6;">
                🔒 <strong style="color: #ccc;">Security Tip:</strong> If you did not make this change, please contact our support team immediately.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: 2px solid #D8B25C;">
            <p style="color: #444; font-size: 11px; margin: 0; text-align: center;">
              © ${new Date().getFullYear()} XLAND INFRA Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Password reset success email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset success email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send email when admin updates user's password
const sendPasswordUpdatedByAdminEmail = async (userData) => {
  const { email, firstName, newPassword, portalUrl } = userData;
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: email,
    subject: `Your Password Has Been Updated - XLAND INFRA`,
    headers: {
      ...getDefaultHeaders(),
      'X-Entity-Ref-ID': `password-update-${Date.now()}`,
      'Message-ID': `<pwd-update-${Date.now()}@xlandinfra.com>`
    },
    text: `Password Updated\n\nHello ${firstName || 'User'},\n\nYour password has been updated by an administrator.\n\nNew Password: ${newPassword}\n\nLogin: ${portalUrl}\n\nPlease change your password after logging in for security.\n\nRegards,\nXLAND INFRA Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #1a1a1a 0%, #0D0D0D 100%); border-radius: 16px 16px 0 0; border: 1px solid #D8B25C33; border-bottom: none;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 300; letter-spacing: 2px;">
              XLAND<span style="color: #D8B25C;">INFRA</span>
            </h1>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 11px; letter-spacing: 3px;">PRIVATE LIMITED</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
            <div style="text-align: center; margin-bottom: 25px;">
              <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #D8B25C22 0%, #D8B25C11 100%); border-radius: 50%; margin: 0 auto 20px auto; border: 2px solid #D8B25C44; text-align: center; line-height: 66px;">
                <span style="font-size: 36px; color: #D8B25C; font-weight: bold; vertical-align: middle;">&#10003;</span>
              </div>
              <h2 style="color: #D8B25C; margin: 0; font-size: 24px; font-weight: 400;">Password Updated</h2>
            </div>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0; text-align: center;">
              Hello <strong style="color: #ffffff;">${firstName || 'User'}</strong>, your password has been updated by an administrator.
            </p>
            
            <!-- New Password Box -->
            <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Your New Password</h3>
              
              <div style="text-align: center;">
                <p style="color: #D8B25C; font-size: 28px; margin: 0; font-family: monospace; background: #1a1a1a; padding: 15px 20px; border-radius: 8px; border: 1px solid #D8B25C44; letter-spacing: 4px; font-weight: bold; display: inline-block;">${newPassword}</p>
              </div>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="${portalUrl}" style="display: inline-block; background-color: #D8B25C; color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
                LOGIN NOW
              </a>
            </div>
            
            <!-- Security Note -->
            <div style="background: #2a1a0a; border: 1px solid #D8B25C44; border-radius: 8px; padding: 15px 20px; margin-top: 30px;">
              <p style="color: #D8B25C; font-size: 13px; margin: 0; line-height: 1.6;">
                ⚠️ <strong>Security Tip:</strong> We recommend changing your password after logging in for enhanced security.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: none; text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} XLAND INFRA. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Password updated email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending password updated email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send vendor property assignment notification
const sendVendorAssignmentEmail = async (vendorEmail, vendorName, property) => {
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: vendorEmail,
    subject: `Property Assignment - ${property.name} | XLAND INFRA`,
    headers: getDefaultHeaders(),
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="margin: 0; padding: 0; background-color: #0D0D0D; font-family: 'Segoe UI', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #0D0D0D; margin: 0; font-size: 28px; font-weight: 700;">XLAND INFRA</h1>
            <p style="color: #0D0D0D; margin: 10px 0 0 0; font-size: 14px; opacity: 0.8;">Property Management System</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(180deg, #1a1a1a 0%, #141414 100%); padding: 40px 30px; border: 1px solid #D8B25C33; border-top: none; border-bottom: none;">
            <div style="text-align: center; margin-bottom: 25px;">
              <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #D8B25C22 0%, #D8B25C11 100%); border-radius: 50%; margin: 0 auto 20px auto; border: 2px solid #D8B25C44; text-align: center; line-height: 66px;">
                <span style="font-size: 36px; color: #D8B25C;">🏠</span>
              </div>
              <h2 style="color: #D8B25C; margin: 0; font-size: 24px; font-weight: 400;">New Property Assignment</h2>
            </div>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0; text-align: center;">
              Hello <strong style="color: #ffffff;">${vendorName}</strong>, you have been assigned to a new property.
            </p>
            
            <!-- Property Details Box -->
            <div style="background: #0D0D0D; border: 1px solid #D8B25C44; border-radius: 12px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; text-align: center;">Property Details</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #888;">Property ID:</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #fff; font-weight: bold;">${property.property_id || property.id}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #888;">Property Name:</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #fff; font-weight: bold;">${property.name}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #888;">Type:</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #fff;">${property.property_type || '-'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #888;">Address:</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #fff;">${property.address || '-'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #888;">City:</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #fff;">${property.city || '-'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #888;">Zone:</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #D8B25C22; color: #fff;">${property.zone || property.zone_id || '-'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 10px; color: #888;">Contact:</td>
                  <td style="padding: 12px 10px; color: #fff;">${property.contact_person || '-'} ${property.contact_phone ? '(' + property.contact_phone + ')' : ''}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #888; font-size: 13px; text-align: center; margin-top: 20px;">
              Please review the property details and coordinate with the property management team for any queries.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #0D0D0D; padding: 25px 30px; border-radius: 0 0 16px 16px; border: 1px solid #D8B25C33; border-top: none; text-align: center;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} XLAND INFRA. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Vendor assignment email sent to ${vendorEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending vendor assignment email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send notification when work order is created (from any portal)
const sendWorkOrderCreatedNotification = async (workOrderData) => {
  const {
    orderId, orderNumber, title, propertyName, propertyId,
    propertyType, propertyAddress, propertyCity, propertyState,
    customerName, customerEmail, customerPhone,
    zoneName, division,
    categoryName, subcategoryName, priority, description,
    permissionToEnter, hasPet, entryNotes,
    createdBy, createdByRole, createdFromPortal,
    franchisePartnerId, propertyZone,
    attachments = []
  } = workOrderData;

  // Build attachments HTML section - use main domain for uploads
  const BASE_URL = process.env.BASE_URL || 'https://xlandinfra.com';
  let attachmentsHtml = '';
  if (attachments && attachments.length > 0) {
    const attachmentItems = attachments.map(att => {
      const filePath = att.file_path?.startsWith('uploads/') ? att.file_path : `uploads/${att.file_path || att.file_name}`;
      const fileUrl = `${BASE_URL}/${filePath}`;
      const isImage = att.file_type?.startsWith('image/');
      const displayName = att.original_name || att.file_name || 'File';
      
      if (isImage) {
        return `
          <td style="padding: 8px; text-align: center; vertical-align: top;">
            <a href="${fileUrl}" target="_blank" style="text-decoration: none;">
              <img src="${fileUrl}" alt="${displayName}" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 1px solid #e5e7eb; object-fit: cover;" />
            </a>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280; word-break: break-all;">${displayName.substring(0, 20)}${displayName.length > 20 ? '...' : ''}</p>
          </td>
        `;
      } else {
        return `
          <td style="padding: 8px; text-align: center; vertical-align: top;">
            <a href="${fileUrl}" target="_blank" style="text-decoration: none;">
              <div style="width: 80px; height: 80px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 1px solid #e5e7eb;">
                <span style="font-size: 24px;">📄</span>
              </div>
            </a>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #6b7280; word-break: break-all;">${displayName.substring(0, 20)}${displayName.length > 20 ? '...' : ''}</p>
          </td>
        `;
      }
    }).join('');

    attachmentsHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f0f9ff; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #0ea5e9;">
        <tr>
          <td style="padding: 16px;">
            <h2 style="margin: 0 0 12px 0; color: #1e293b; font-size: 14px; font-weight: 600;">📎 Attachments (${attachments.length})</h2>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
              <tr>
                ${attachmentItems}
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b', 
    low: '#22c55e'
  };

  const portalColors = {
    'Customer Portal': '#6366f1',
    'Manager Portal': '#3b82f6',
    'Coordinator Portal': '#14b8a6',
    'Admin Portal': '#8b5cf6',
    'FP Portal': '#f59e0b'
  };

  // Build full address
  const fullAddress = [propertyAddress, propertyCity, propertyState].filter(Boolean).join(', ');

  // Get recipients: FP email + zone-centric employees (NO admin email)
  let internalRecipients = [];
  if (franchisePartnerId) {
    const fpRecipients = await getWorkOrderNotificationRecipients(franchisePartnerId, propertyZone, null);
    internalRecipients = fpRecipients.filter(email => email.toLowerCase() !== NOTIFICATION_EMAIL.toLowerCase());
    console.log(`📧 Work order notification recipients for FP ${franchisePartnerId}, zone ${propertyZone}:`, internalRecipients);
  }

  // Send SEPARATE emails to each recipient (no BCC - complete privacy)
  // If no customer email, don't send
  if (!customerEmail) {
    console.log('📧 No customer email provided, skipping work order notification');
    return;
  }
  
  // Build list of all recipients (customer + FP + zone employees)
  const allRecipients = [customerEmail, ...internalRecipients.filter(email => email.toLowerCase() !== customerEmail.toLowerCase())];
  console.log(`📧 Sending separate emails to ${allRecipients.length} recipients:`, allRecipients);

  const emailSubject = `Work Order Created - ${orderNumber || orderId} | ${propertyName || 'Service Request'}`;
  const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Work Order Notification</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f3f4f6;">
          <tr>
            <td style="padding: 20px 10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #334155 0%, #1e293b 100%); padding: 25px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #c9a227; font-size: 20px; font-weight: 600; word-wrap: break-word;">New Work Order Created</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 20px;">
                    
                    <!-- Customer Info -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f8f9fc; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #3b82f6;">
                      <tr>
                        <td style="padding: 16px;">
                          <h2 style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px; font-weight: 600;">Customer Details</h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 80px; vertical-align: top;">Name:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: bold; font-size: 14px; word-break: break-word;">${customerName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Email:</td>
                              <td style="padding: 6px 0; word-break: break-all;"><a href="mailto:${customerEmail}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">${customerEmail || '-'}</a></td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Phone:</td>
                              <td style="padding: 6px 0;"><a href="tel:${customerPhone}" style="color: #3b82f6; font-weight: bold; font-size: 14px; text-decoration: none;">${customerPhone || '-'}</a></td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Zone Area:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${zoneName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Division:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${division || '-'}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Property Info -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f8faf8; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #6b7280;">
                      <tr>
                        <td style="padding: 16px;">
                          <h2 style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px; font-weight: 600;">Property Details</h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 80px; vertical-align: top;">Name:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-size: 14px; word-break: break-word;">${propertyName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Type:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${propertyType || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">ID:</td>
                              <td style="padding: 6px 0; color: #64748b; font-family: monospace; font-size: 12px; word-break: break-all;">${propertyId || '-'}</td>
                            </tr>
                            ${fullAddress ? `
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Address:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px; word-break: break-word;">${fullAddress}</td>
                            </tr>
                            ` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Work Order Details -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #fafafa; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #c9a227;">
                      <tr>
                        <td style="padding: 16px;">
                          <h2 style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px; font-weight: 600;">Work Order Details</h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 80px; vertical-align: top;">Order ID:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-size: 14px; word-break: break-all;">${orderNumber || orderId}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Title:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-size: 13px; word-break: break-word;">${title || `Service Request - ${categoryName}`}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Category:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${categoryName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Subcategory:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${subcategoryName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Priority:</td>
                              <td style="padding: 6px 0;">
                                <span style="display: inline-block; background: ${priorityColors[priority] || '#64748b'}; color: white; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                  ${(priority || 'MEDIUM').toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Description -->
                    ${description ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #fafafa; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #9ca3af;">
                      <tr>
                        <td style="padding: 16px;">
                          <h2 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">Description</h2>
                          <p style="margin: 0; color: #374151; line-height: 1.5; font-size: 13px; word-break: break-word;">${description}</p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    
                    <!-- Entry Notes -->
                    ${entryNotes ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #fef2f2; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #f87171;">
                      <tr>
                        <td style="padding: 16px;">
                          <h2 style="margin: 0 0 8px 0; color: #991b1b; font-size: 14px; font-weight: 600;">Entry Notes</h2>
                          <p style="margin: 0; color: #374151; line-height: 1.5; font-size: 13px; word-break: break-word;">${entryNotes}</p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    
                    <!-- Attachments -->
                    ${attachmentsHtml}
                    
                    <!-- Created By -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f1f5f9; border-radius: 8px; margin-top: 20px;">
                      <tr>
                        <td style="padding: 12px; text-align: center;">
                          <p style="margin: 0; color: #64748b; font-size: 12px;">
                            Created by <strong style="color: #1e293b;">${createdBy || 'System'}</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #334155; padding: 16px; text-align: center;">
                    <p style="margin: 0; color: #e2e8f0; font-size: 11px;">
                      XLAND INFRA Private Limited | Automated Notification
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

  // Send SEPARATE individual emails to each recipient (complete privacy - no BCC visible)
  try {
    for (const recipientEmail of allRecipients) {
      const mailOptions = {
        from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml
      };
      await transporter.sendMail(mailOptions);
      console.log(`📧 Work order notification sent to: ${recipientEmail}`);
    }
    console.log(`📧 Work order creation notification sent for ${orderNumber || orderId} to ${allRecipients.length} recipients`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending work order notification:', error.message);
    return { success: false, error: error.message };
  }
};

// Send notification when work order is completed
const sendWorkOrderCompletedNotification = async (workOrderData) => {
  console.log('📧 [COMPLETION EMAIL] Function called with data:', JSON.stringify(workOrderData, null, 2));
  
  const {
    orderId, orderNumber, title, propertyName, propertyId,
    customerName, customerEmail, customerPhone,
    zoneName, division,
    categoryName, subcategoryName, description, closingNotes,
    completedBy, completedByRole, completedAt,
    franchisePartnerId, propertyZone
  } = workOrderData;

  console.log(`📧 [COMPLETION EMAIL] Customer: ${customerEmail}, FP: ${franchisePartnerId}, Zone: ${propertyZone}`);

  // Get recipients: FP email + zone-centric employees (NO admin email)
  let internalRecipients = [];
  if (franchisePartnerId) {
    const fpRecipients = await getWorkOrderNotificationRecipients(franchisePartnerId, propertyZone, null);
    internalRecipients = fpRecipients.filter(email => email.toLowerCase() !== NOTIFICATION_EMAIL.toLowerCase());
    console.log(`📧 Work order completion notification recipients for FP ${franchisePartnerId}, zone ${propertyZone}:`, internalRecipients);
  }

  // If no customer email, still try to send to FP/employees
  if (!customerEmail && internalRecipients.length === 0) {
    console.log('📧 No customer email and no internal recipients, skipping work order completion notification');
    return { success: false, error: 'No recipients found' };
  }

  // Build list of all recipients (customer + FP + zone employees)
  const allRecipients = [
    customerEmail,
    ...internalRecipients.filter(email => !customerEmail || email.toLowerCase() !== customerEmail.toLowerCase())
  ].filter(Boolean); // Remove null/undefined
  
  if (allRecipients.length === 0) {
    console.log('📧 No valid recipients for completion notification');
    return { success: false, error: 'No valid recipients' };
  }
  
  console.log(`📧 Sending separate completion emails to ${allRecipients.length} recipients:`, allRecipients);

  // Format completion date
  const completionDate = completedAt ? new Date(completedAt).toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata', 
    dateStyle: 'long', 
    timeStyle: 'short' 
  }) : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'short' });

  const emailSubject = `Work Order Completed - ${orderNumber || orderId}`;
  const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f3f4f6;">
          <tr>
            <td style="padding: 20px 10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">Work Order Completed</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 25px 20px;">
                    <!-- Greeting -->
                    <p style="margin: 0 0 20px 0; color: #1e293b; font-size: 15px; line-height: 1.6;">
                      Hello,<br><br>
                      The work order you submitted has been completed successfully.
                    </p>
                    
                    <!-- Work Order Details -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f8fafc; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Work Order Details</h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 100px; vertical-align: top;">ID:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${orderNumber || orderId}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Status:</td>
                              <td style="padding: 6px 0;">
                                <span style="background: #10b981; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">COMPLETED</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Category:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${categoryName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Problem:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${subcategoryName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Completed:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 14px;">${completionDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Customer Details -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #eff6ff; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Customer Details</h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 100px; vertical-align: top;">Name:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${customerName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Email:</td>
                              <td style="padding: 6px 0;"><a href="mailto:${customerEmail}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">${customerEmail || '-'}</a></td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Phone:</td>
                              <td style="padding: 6px 0;"><a href="tel:${customerPhone}" style="color: #3b82f6; font-weight: 600; font-size: 14px; text-decoration: none;">${customerPhone || '-'}</a></td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Zone Area:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${zoneName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">Division:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-size: 13px;">${division || '-'}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Property Details -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f0fdf4; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px; font-weight: 600;">Property Details</h2>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; width: 100px; vertical-align: top;">Name:</td>
                              <td style="padding: 6px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${propertyName || '-'}</td>
                            </tr>
                            <tr>
                              <td style="padding: 6px 0; color: #64748b; font-size: 13px; vertical-align: top;">ID:</td>
                              <td style="padding: 6px 0; color: #64748b; font-family: monospace; font-size: 12px;">${propertyId || '-'}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    ${description ? `
                    <!-- Description -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #fef3c7; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px; font-weight: 600;">Description</h2>
                          <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.5;">${description}</p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    ${closingNotes ? `
                    <!-- Closing Notes -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f0f9ff; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 10px 0; color: #0369a1; font-size: 14px; font-weight: 600;">Closing Notes</h2>
                          <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.5;">${closingNotes}</p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    
                    <!-- Completed By -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background: #f1f5f9; border-radius: 12px;">
                      <tr>
                        <td style="padding: 15px; text-align: center;">
                          <p style="margin: 0; color: #64748b; font-size: 13px;">
                            Marked as completed by <strong style="color: #059669;">${completedBy || 'System'}</strong>
                            ${completedByRole ? `(${completedByRole})` : ''}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background: #1e293b; padding: 20px; text-align: center;">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                      XLAND INFRA Private Limited | Work Order Completion Notification
                    </p>
                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 11px;">
                      © ${new Date().getFullYear()} All rights reserved
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

  // Send SEPARATE individual emails to each recipient (complete privacy - no BCC visible)
  try {
    for (const recipientEmail of allRecipients) {
      const mailOptions = {
        from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml
      };
      await transporter.sendMail(mailOptions);
      console.log(`📧 Work order completion notification sent to: ${recipientEmail}`);
    }
    console.log(`📧 Work order completion notification sent for ${orderNumber || orderId} to ${allRecipients.length} recipients`);
    return { success: true };
  } catch (error) {
    console.error('Error sending completion notification:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWorkOrderNotification,
  sendWorkOrderCreatedNotification,
  sendWorkOrderCompletedNotification,
  sendContactNotification,
  sendRegistrationNotification,
  sendCustomerActivationEmail,
  sendPasswordResetConfirmation,
  sendEmployeeWelcomeEmail,
  sendFPEmployeeWelcomeEmail,
  sendEstimateEmail,
  sendEstimateActionNotification,
  sendPasswordResetEmail,
  sendPasswordResetSuccess,
  sendPasswordUpdatedByAdminEmail,
  sendVendorAssignmentEmail,
  getWorkOrderNotificationRecipients,
  NOTIFICATION_EMAIL
};
