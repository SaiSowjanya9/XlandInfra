/**
 * Issuing a customer's activation credentials, in one place.
 *
 * A customer account is activated by following an emailed link: the row carries an
 * `activation_token`, an `activation_expires` stamp and `temp_password_hash`, and
 * `POST /api/customers/set-password` exchanges them for a real password. Three places need to
 * (re)issue that set -- the customer's own "resend activation" on the login screen, and the
 * admin portal's Customers list -- so the steps live here rather than being copied.
 *
 * The franchise portal's own /customer-accounts/:id/activate predates this flow: it writes a
 * plaintext `temp_password` and `password_hash` directly and sends no email at all (its code still
 * carries the "TODO: Send activation email" note), which means the customer is never told. New
 * callers should use this helper so the customer actually receives the link.
 *
 * Regression test: node --test backend/utils/customerActivation.test.js
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendCustomerActivationEmail } = require('../services/emailService');

const ACTIVATION_EXPIRY_HOURS = 72;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://xlandinfra.com';

// 8 characters, with the shapes a customer cannot read apart (0/O, 1/I) left out -- this password
// is typed in from an email.
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const generateActivationToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Issue a fresh activation token and temporary password for one account and email them out.
 *
 * The temporary password is only ever stored hashed, and is returned here solely so a caller can
 * show it to staff who are reading it to the customer over the phone -- it is never persisted in
 * clear text the way the older franchise-portal route did.
 *
 * @param {object} pool  mysql2 pool
 * @param {object} account  { id, email, first_name, property_name, property_code }
 * @returns {Promise<{ emailSent: boolean, tempPassword: string, expiresAt: Date }>}
 */
const issueActivation = async (pool, account) => {
  const tempPassword = generateTempPassword();
  const tempPasswordHash = await bcrypt.hash(tempPassword, 12);
  const activationToken = generateActivationToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_EXPIRY_HOURS * 60 * 60 * 1000);

  await pool.execute(
    `UPDATE customer_accounts
     SET temp_password_hash = ?,
         activation_token = ?,
         activation_expires = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [tempPasswordHash, activationToken, expiresAt, account.id]
  );

  // A send that fails must not lose the issued credentials: the row is already updated, so the
  // link stays valid and the email can be resent.
  let emailSent = false;
  try {
    const result = await sendCustomerActivationEmail({
      email: account.email,
      firstName: account.first_name,
      tempPassword,
      activationLink: `${FRONTEND_URL}/activate/${activationToken}`,
      propertyName: account.property_name,
      propertyId: account.property_code
    });
    emailSent = !!(result && result.success);
  } catch (error) {
    console.error('Activation email failed for account', account.id, error.message);
  }

  return { emailSent, tempPassword, expiresAt };
};

module.exports = {
  ACTIVATION_EXPIRY_HOURS,
  generateTempPassword,
  generateActivationToken,
  issueActivation
};
