/**
 * Pointing an existing customer account at the property it was just added to.
 *
 * customer_accounts.email is UNIQUE, so every Add Customer / onboarding route looks the
 * contact email up before inserting:
 *
 *   no row             -> create the account, send the activation email
 *   row, not activated -> re-issue credentials, send it again
 *   row, activated     -> there is nothing left to activate: the account already has a
 *                         password. This third case used to fall through -- no email, no
 *                         link, a silent success -- so the new property had no portal
 *                         access at all and staff were told the customer was created.
 *
 * This module is what that branch should have done:
 *
 * linkCustomerToProperty moves the existing account onto the property it was just added
 * to. It also writes is_active = 1, because the staff member just re-added the customer
 * and a soft-deleted property leaves is_active = 0 -- which otherwise makes the customer
 * stare at "Invalid email or password" on login (the login query filters is_active
 * before it ever checks the password).
 *
 * notifyPropertyAdded sends the "you've been added" email. It is a notification, not an
 * activation: re-issuing a temp password for an activated account would silently
 * invalidate the credentials the customer already uses.
 *
 * Both functions fail safe: a link or send that errors is logged and reported false,
 * never thrown -- a property that was just saved must not 500 over a portal-access
 * detail.
 *
 * Regression test: node --test backend/utils/customerPropertyLink.test.js
 */

const { sendPropertyAddedEmail } = require('../services/emailService');

const linkCustomerToProperty = async (pool, accountId, { propertyId, propertyCode, propertyName }) => {
  try {
    await pool.execute(
      `UPDATE customer_accounts
          SET property_id = ?, property_code = ?, property_name = ?, is_active = 1, updated_at = NOW()
        WHERE id = ?`,
      [propertyId || null, propertyCode || null, propertyName || null, accountId]
    );
    return true;
  } catch (error) {
    // A deployment whose customer_accounts predates the property_name column must not
    // lose the link over the name.
    if (/unknown column/i.test(error.message || '')) {
      try {
        await pool.execute(
          `UPDATE customer_accounts
              SET property_id = ?, property_code = ?, is_active = 1, updated_at = NOW()
            WHERE id = ?`,
          [propertyId || null, propertyCode || null, accountId]
        );
        return true;
      } catch (retryError) {
        console.error('Customer account relink failed for account', accountId, retryError.message);
        return false;
      }
    }
    console.error('Customer account relink failed for account', accountId, error.message);
    return false;
  }
};

const notifyPropertyAdded = async ({ email, firstName, propertyName, propertyCode }) => {
  try {
    const result = await sendPropertyAddedEmail({ email, firstName, propertyName, propertyCode });
    return !!(result && result.success);
  } catch (error) {
    console.error('Property-added email failed for', email, error.message);
    return false;
  }
};

module.exports = { linkCustomerToProperty, notifyPropertyAdded };
