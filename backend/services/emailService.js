const nodemailer = require('nodemailer');

// Email configuration - uses environment variables
// Supports both Gmail and custom SMTP servers (Hostinger, GoDaddy, cPanel, etc.)
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

// Notification email addresses
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'ssmspy@gmail.com';
const CONTACT_EMAILS = ['info@xlandinfra.com', 'xlandinfra@gmail.com'];

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
  const emailHtml = `
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
  `;

  try {
    // Send separate emails to each recipient for reliable delivery
    const emailPromises = CONTACT_EMAILS.map(async (email) => {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `New Contact Inquiry from ${contactData.name} - XLAND INFRA`,
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

// Send customer account activation email
const sendCustomerActivationEmail = async (customerData) => {
  const { email, firstName, tempPassword, activationLink, propertyName } = customerData;
  
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
    text: `Welcome to XLAND INFRA Customer Portal!\n\nHello ${firstName || 'Valued Customer'},\n\nYour account has been created for ${propertyName || 'XLAND INFRA'} property portal.\n\nYour Login Credentials:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nActivate your account: ${activationLink}\n\nThis link expires in 72 hours.\n\nRegards,\nXLAND INFRA Team`,
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
              Your customer account has been created for the <strong style="color: #D8B25C;">${propertyName || 'XLAND INFRA'}</strong> property portal. 
              Please activate your account to access your personalized dashboard.
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
              <a href="${activationLink}" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
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
                ⚠️ <strong>Important:</strong> This activation link will expire in <strong>72 hours</strong>. 
                Please activate your account and set a new password before the link expires.
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
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Customer activation email sent to ${email} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending customer activation email:', error.message);
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
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); border-radius: 50%; margin: 0 auto 25px auto; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 40px;">✓</span>
            </div>
            
            <h2 style="color: #D8B25C; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Account Activated!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
              Hi ${firstName || 'Valued Customer'}, your account has been successfully activated. 
              You can now log in to your Customer Portal using your email and the password you just created.
            </p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px;">
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
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
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
                ⚠️ <strong>Important:</strong> For security reasons, you must change your temporary password on your first login. 
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
              <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 16px;">📋 First-Time Login Instructions</h3>
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
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
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
                🔒 <strong>Security Notice:</strong> For your protection, you <strong>must change</strong> your temporary password on your first login. 
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
  const { customerName, customerEmail, estimateId, propertyName, services, addons, subtotal, discount, tax, total, validUntil } = estimate;
  
  if (!customerEmail) {
    return { success: false, error: 'No customer email provided' };
  }

  // Base URL for action links
  const baseUrl = process.env.FRONTEND_URL || 'https://admin.xlandinfra.com';
  const approveUrl = `${baseUrl}/estimate-action/${estimateId}?action=approve&token=${actionToken}`;
  const rejectUrl = `${baseUrl}/estimate-action/${estimateId}?action=reject&token=${actionToken}`;

  // Format services list
  const servicesHtml = (services || []).map(s => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${s.name || s.service || 'Service'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${Number(s.price || s.rate || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  // Format addons list
  const addonsHtml = (addons || []).map(a => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${a.name || a.serviceName || a.services?.[0]?.name || 'Add-on'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${Number(a.price || a.totalPrice || a.services?.[0]?.price || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  // Calculate expiry date (1 month from now)
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 1);

  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: customerEmail,
    subject: `Your Estimate ${estimateId} from XLAND INFRA - Action Required`,
    headers: getDefaultHeaders(),
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
            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">Property Management Solutions</p>
          </div>
          
          <!-- Content -->
          <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Hello ${customerName || 'Valued Customer'},</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for your interest in our services. Please find below the estimate for your property <strong>${propertyName || 'N/A'}</strong>.
            </p>
            
            <!-- Estimate Details -->
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
              </table>
            </div>
            
            <!-- Services Table -->
            ${services?.length > 0 || addons?.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-size: 14px; color: #374151; border-bottom: 2px solid #e5e7eb;">Description</th>
                  <th style="padding: 12px; text-align: right; font-size: 14px; color: #374151; border-bottom: 2px solid #e5e7eb;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${servicesHtml}
                ${addonsHtml}
              </tbody>
            </table>
            ` : ''}
            
            <!-- Totals -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 15px; margin-bottom: 25px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6b7280;">Subtotal</span>
                <span style="color: #1f2937;">₹${Number(subtotal || 0).toLocaleString()}</span>
              </div>
              ${discount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6b7280;">Discount</span>
                <span style="color: #059669;">-₹${Number(discount).toLocaleString()}</span>
              </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6b7280;">Tax (GST)</span>
                <span style="color: #1f2937;">₹${Number(tax || 0).toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid #e5e7eb; margin-top: 8px;">
                <span style="color: #1f2937; font-weight: 700; font-size: 16px;">Total</span>
                <span style="color: #1e40af; font-weight: 700; font-size: 18px;">₹${Number(total || 0).toLocaleString()}</span>
              </div>
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
                <td style="padding: 8px 0; color: #1f2937; text-align: right;">${new Date().toLocaleString('en-IN')}</td>
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

  // Send to admin emails
  const adminEmails = ['info@xlandinfra.com', 'xlandinfra@gmail.com'];
  
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
              <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #D8B25C22 0%, #D8B25C11 100%); border-radius: 50%; margin: 0 auto 20px auto; display: flex; align-items: center; justify-content: center; border: 2px solid #D8B25C44;">
                <span style="font-size: 32px;">🔐</span>
              </div>
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
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
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
                ⚠️ <strong>Important:</strong> This password reset link will expire in <strong>${expiryHours || 48} hours</strong>. 
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
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 50%; margin: 0 auto 25px auto; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 40px; color: white;">✓</span>
            </div>
            
            <h2 style="color: #22c55e; margin: 0 0 20px 0; font-size: 24px; font-weight: 400;">Password Reset Successful!</h2>
            
            <p style="color: #cccccc; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
              Hi ${firstName || 'User'}, your password for the <strong style="color: #D8B25C;">${portalName}</strong> has been successfully reset. 
              You can now log in with your new password.
            </p>
            
            <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px;">
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
              <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #D8B25C 0%, #C9A227 100%); color: #0D0D0D; text-decoration: none; padding: 16px 40px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 1px; box-shadow: 0 4px 20px rgba(216, 178, 92, 0.3);">
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

module.exports = {
  sendWorkOrderNotification,
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
  NOTIFICATION_EMAIL
};
