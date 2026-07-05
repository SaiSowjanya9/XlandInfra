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
    
    // Update client_phone and client_email from properties table (direct columns)
    const [result1] = await pool.query(`
      UPDATE fp_estimates fe
      JOIN properties p ON fe.property_name = p.name AND fe.franchise_partner_id = p.franchise_partner_id
      SET fe.client_phone = COALESCE(NULLIF(fe.client_phone, ''), p.contact_phone),
          fe.client_email = COALESCE(NULLIF(fe.client_email, ''), p.contact_email)
      WHERE (fe.client_phone IS NULL OR fe.client_phone = '' OR fe.client_email IS NULL OR fe.client_email = '')
        AND (p.contact_phone IS NOT NULL OR p.contact_email IS NOT NULL)
    `);
    console.log('Updated from properties (direct columns):', result1.affectedRows, 'rows');

    // Update from onboarded_properties table (direct columns)
    const [result2] = await pool.query(`
      UPDATE fp_estimates fe
      JOIN onboarded_properties op ON fe.property_name = op.community_name AND fe.franchise_partner_id = op.franchise_partner_id
      SET fe.client_phone = COALESCE(NULLIF(fe.client_phone, ''), op.contact_phone),
          fe.client_email = COALESCE(NULLIF(fe.client_email, ''), op.contact_email)
      WHERE (fe.client_phone IS NULL OR fe.client_phone = '' OR fe.client_email IS NULL OR fe.client_email = '')
        AND (op.contact_phone IS NOT NULL OR op.contact_email IS NOT NULL)
    `);
    console.log('Updated from onboarded_properties (direct columns):', result2.affectedRows, 'rows');

    // Now update from association_contacts JSON field for remaining empty records
    // Get estimates still missing phone/email
    const [estimates] = await pool.query(`
      SELECT fe.id, fe.property_name, fe.franchise_partner_id, fe.client_phone, fe.client_email
      FROM fp_estimates fe
      WHERE (fe.client_phone IS NULL OR fe.client_phone = '' OR fe.client_email IS NULL OR fe.client_email = '')
    `);
    
    console.log('Checking association_contacts for', estimates.length, 'estimates...');
    let updatedCount = 0;
    
    for (const est of estimates) {
      let phone = est.client_phone;
      let email = est.client_email;
      
      // Try properties table
      const [props] = await pool.query(
        `SELECT association_contacts FROM properties WHERE name = ? AND franchise_partner_id = ? LIMIT 1`,
        [est.property_name, est.franchise_partner_id]
      );
      
      if (props.length > 0 && props[0].association_contacts) {
        try {
          const contacts = typeof props[0].association_contacts === 'string' 
            ? JSON.parse(props[0].association_contacts) : props[0].association_contacts;
          if (Array.isArray(contacts) && contacts.length > 0) {
            if (!phone && contacts[0].phone) phone = contacts[0].phone;
            if (!email && contacts[0].email) email = contacts[0].email;
          }
        } catch (e) {}
      }
      
      // Try onboarded_properties if still missing
      if (!phone || !email) {
        const [onboarded] = await pool.query(
          `SELECT association_contacts FROM onboarded_properties WHERE community_name = ? AND franchise_partner_id = ? LIMIT 1`,
          [est.property_name, est.franchise_partner_id]
        );
        
        if (onboarded.length > 0 && onboarded[0].association_contacts) {
          try {
            const contacts = typeof onboarded[0].association_contacts === 'string' 
              ? JSON.parse(onboarded[0].association_contacts) : onboarded[0].association_contacts;
            if (Array.isArray(contacts) && contacts.length > 0) {
              if (!phone && contacts[0].phone) phone = contacts[0].phone;
              if (!email && contacts[0].email) email = contacts[0].email;
            }
          } catch (e) {}
        }
      }
      
      // Update if we found any contact info
      if ((phone && phone !== est.client_phone) || (email && email !== est.client_email)) {
        await pool.query(
          `UPDATE fp_estimates SET client_phone = COALESCE(?, client_phone), client_email = COALESCE(?, client_email) WHERE id = ?`,
          [phone || null, email || null, est.id]
        );
        updatedCount++;
      }
    }
    
    console.log('Updated from association_contacts JSON:', updatedCount, 'rows');
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await pool.end();
  }
}

migrate();
