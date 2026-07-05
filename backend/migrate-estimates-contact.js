const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'xland_pm'
  });

  try {
    console.log('Starting migration to update estimates with contact info...');
    
    // Update client_phone and client_email from properties table
    const [result1] = await pool.query(`
      UPDATE fp_estimates fe
      JOIN properties p ON fe.property_name = p.name AND fe.franchise_partner_id = p.franchise_partner_id
      SET fe.client_phone = COALESCE(NULLIF(fe.client_phone, ''), p.contact_phone),
          fe.client_email = COALESCE(NULLIF(fe.client_email, ''), p.contact_email)
      WHERE (fe.client_phone IS NULL OR fe.client_phone = '' OR fe.client_email IS NULL OR fe.client_email = '')
        AND (p.contact_phone IS NOT NULL OR p.contact_email IS NOT NULL)
    `);
    console.log('Updated from properties:', result1.affectedRows, 'rows');

    // Update from onboarded_properties table
    const [result2] = await pool.query(`
      UPDATE fp_estimates fe
      JOIN onboarded_properties op ON fe.property_name = op.community_name AND fe.franchise_partner_id = op.franchise_partner_id
      SET fe.client_phone = COALESCE(NULLIF(fe.client_phone, ''), op.contact_phone),
          fe.client_email = COALESCE(NULLIF(fe.client_email, ''), op.contact_email)
      WHERE (fe.client_phone IS NULL OR fe.client_phone = '' OR fe.client_email IS NULL OR fe.client_email = '')
        AND (op.contact_phone IS NOT NULL OR op.contact_email IS NOT NULL)
    `);
    console.log('Updated from onboarded_properties:', result2.affectedRows, 'rows');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await pool.end();
  }
}

migrate();
