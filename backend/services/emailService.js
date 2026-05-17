const nodemailer = require('nodemailer');

// Email configuration - uses environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS // Use App Password for Gmail
  }
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
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: CONTACT_EMAILS.join(', '),
    subject: `New Contact Inquiry from ${contactData.name} - XLAND INFRA`,
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
    console.log(`📧 Contact notification sent to ${CONTACT_EMAILS.join(', ')}`);
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

// Send customer account activation email
const sendCustomerActivationEmail = async (customerData) => {
  const { email, firstName, tempPassword, activationLink, propertyName } = customerData;
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Welcome to XLAND INFRA Customer Portal - Activate Your Account`,
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
  const portalUrl = loginUrl || process.env.ADMIN_PORTAL_URL || 'http://localhost:5174';
  
  const mailOptions = {
    from: `"XLAND INFRA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Welcome to XLAND INFRA - Your Account Has Been Created`,
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

module.exports = {
  sendWorkOrderNotification,
  sendContactNotification,
  sendRegistrationNotification,
  sendCustomerActivationEmail,
  sendPasswordResetConfirmation,
  sendEmployeeWelcomeEmail,
  NOTIFICATION_EMAIL
};
