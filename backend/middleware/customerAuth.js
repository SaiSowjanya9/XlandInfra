/**
 * Customer-portal authentication.
 *
 * Customer and staff tokens are signed with the same secret, so a valid signature alone does not
 * say who the caller is: a staff token for users.id = 3 would otherwise be read as customer
 * account 3. Only a token minted by the customer login (role 'customer') is accepted, and the
 * account must still exist and be active.
 */
const { pool } = require('../config/database');
const { verifyToken } = require('./auth');

const requireCustomer = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Please log in to continue' });
  }

  const decoded = verifyToken(authHeader.split(' ')[1]);
  if (!decoded || decoded.role !== 'customer' || !decoded.id) {
    return res.status(401).json({ success: false, message: 'Please log in to continue' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM customer_accounts WHERE id = ? AND is_active = 1',
      [decoded.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Customer account not found or inactive' });
    }
    req.customerAccount = rows[0];
    next();
  } catch (error) {
    console.error('Customer authentication error:', error);
    res.status(500).json({ success: false, message: 'Could not verify your account' });
  }
};

module.exports = { requireCustomer };
