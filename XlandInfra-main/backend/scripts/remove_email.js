/**
 * Script to remove a specific email from all database tables
 * Run with: node scripts/remove_email.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.production') });

const EMAIL_TO_REMOVE = 'Charank6999@gmail.com';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'customer_portal',
  port: process.env.DB_PORT || 3306,
  ...(process.env.DB_SSL === 'true' && {
    ssl: { rejectUnauthorized: true }
  })
};

async function removeEmail() {
  const conn = await mysql.createConnection(dbConfig);
  
  console.log(`\n🔍 Searching for email: ${EMAIL_TO_REMOVE}\n`);
  console.log('='.repeat(60));
  
  let totalDeleted = 0;
  
  try {
    // 1. Check and delete from customer_accounts
    const [customerAccounts] = await conn.execute(
      'SELECT id, customer_id, email, first_name, last_name FROM customer_accounts WHERE LOWER(email) = LOWER(?)',
      [EMAIL_TO_REMOVE]
    );
    if (customerAccounts.length > 0) {
      console.log(`\n📋 customer_accounts: Found ${customerAccounts.length} record(s)`);
      customerAccounts.forEach(r => console.log(`   - ID: ${r.id}, Customer ID: ${r.customer_id}, Name: ${r.first_name} ${r.last_name}`));
      
      // Delete related activity logs first
      await conn.execute('DELETE FROM customer_activity_log WHERE customer_id IN (SELECT id FROM customer_accounts WHERE LOWER(email) = LOWER(?))', [EMAIL_TO_REMOVE]);
      
      const [result] = await conn.execute('DELETE FROM customer_accounts WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
      console.log(`   ✅ Deleted ${result.affectedRows} record(s) from customer_accounts`);
      totalDeleted += result.affectedRows;
    }

    // 2. Check and delete from users table
    const [users] = await conn.execute(
      'SELECT id, username, email, first_name, last_name, role FROM users WHERE LOWER(email) = LOWER(?)',
      [EMAIL_TO_REMOVE]
    );
    if (users.length > 0) {
      console.log(`\n👤 users: Found ${users.length} record(s)`);
      users.forEach(r => console.log(`   - ID: ${r.id}, Username: ${r.username}, Role: ${r.role}`));
      
      const [result] = await conn.execute('DELETE FROM users WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
      console.log(`   ✅ Deleted ${result.affectedRows} record(s) from users`);
      totalDeleted += result.affectedRows;
    }

    // 3. Check and delete from residents table
    try {
      const [residents] = await conn.execute(
        'SELECT id, resident_id, email, first_name, last_name FROM residents WHERE LOWER(email) = LOWER(?)',
        [EMAIL_TO_REMOVE]
      );
      if (residents.length > 0) {
        console.log(`\n🏠 residents: Found ${residents.length} record(s)`);
        residents.forEach(r => console.log(`   - ID: ${r.id}, Resident ID: ${r.resident_id}, Name: ${r.first_name} ${r.last_name}`));
        
        const [result] = await conn.execute('DELETE FROM residents WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        console.log(`   ✅ Deleted ${result.affectedRows} record(s) from residents`);
        totalDeleted += result.affectedRows;
      }
    } catch (e) { /* table may not exist */ }

    // 4. Check and delete from property_contacts table
    try {
      const [contacts] = await conn.execute(
        'SELECT id, property_id, name, email FROM property_contacts WHERE LOWER(email) = LOWER(?)',
        [EMAIL_TO_REMOVE]
      );
      if (contacts.length > 0) {
        console.log(`\n📞 property_contacts: Found ${contacts.length} record(s)`);
        contacts.forEach(r => console.log(`   - ID: ${r.id}, Property ID: ${r.property_id}, Name: ${r.name}`));
        
        const [result] = await conn.execute('DELETE FROM property_contacts WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        console.log(`   ✅ Deleted ${result.affectedRows} record(s) from property_contacts`);
        totalDeleted += result.affectedRows;
      }
    } catch (e) { /* table may not exist */ }

    // 5. Check and delete from fp_employees table
    try {
      const [fpEmployees] = await conn.execute(
        'SELECT id, name, email, role FROM fp_employees WHERE LOWER(email) = LOWER(?)',
        [EMAIL_TO_REMOVE]
      );
      if (fpEmployees.length > 0) {
        console.log(`\n👷 fp_employees: Found ${fpEmployees.length} record(s)`);
        fpEmployees.forEach(r => console.log(`   - ID: ${r.id}, Name: ${r.name}, Role: ${r.role}`));
        
        const [result] = await conn.execute('DELETE FROM fp_employees WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        console.log(`   ✅ Deleted ${result.affectedRows} record(s) from fp_employees`);
        totalDeleted += result.affectedRows;
      }
    } catch (e) { /* table may not exist */ }

    // 6. Check and update onboarded_vendors (owner, manager, poc emails)
    try {
      const [vendors] = await conn.execute(
        `SELECT id, vendor_id, owner_name, owner_email, manager_email, poc_email 
         FROM onboarded_vendors 
         WHERE LOWER(owner_email) = LOWER(?) OR LOWER(manager_email) = LOWER(?) OR LOWER(poc_email) = LOWER(?)`,
        [EMAIL_TO_REMOVE, EMAIL_TO_REMOVE, EMAIL_TO_REMOVE]
      );
      if (vendors.length > 0) {
        console.log(`\n🏪 onboarded_vendors: Found ${vendors.length} record(s) with this email`);
        vendors.forEach(r => console.log(`   - Vendor ID: ${r.vendor_id}, Owner: ${r.owner_name}`));
        
        // Clear the email fields instead of deleting the vendor
        await conn.execute('UPDATE onboarded_vendors SET owner_email = NULL WHERE LOWER(owner_email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        await conn.execute('UPDATE onboarded_vendors SET manager_email = NULL WHERE LOWER(manager_email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        await conn.execute('UPDATE onboarded_vendors SET poc_email = NULL WHERE LOWER(poc_email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        console.log(`   ✅ Cleared email fields in onboarded_vendors`);
      }
    } catch (e) { /* table may not exist */ }

    // 7. Check and delete from clients table
    try {
      const [clients] = await conn.execute(
        'SELECT id, name, email FROM clients WHERE LOWER(email) = LOWER(?)',
        [EMAIL_TO_REMOVE]
      );
      if (clients.length > 0) {
        console.log(`\n👥 clients: Found ${clients.length} record(s)`);
        clients.forEach(r => console.log(`   - ID: ${r.id}, Name: ${r.name}`));
        
        const [result] = await conn.execute('DELETE FROM clients WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        console.log(`   ✅ Deleted ${result.affectedRows} record(s) from clients`);
        totalDeleted += result.affectedRows;
      }
    } catch (e) { /* table may not exist */ }

    // 8. Check and delete from contact_submissions table
    try {
      const [submissions] = await conn.execute(
        'SELECT id, name, email, subject FROM contact_submissions WHERE LOWER(email) = LOWER(?)',
        [EMAIL_TO_REMOVE]
      );
      if (submissions.length > 0) {
        console.log(`\n📧 contact_submissions: Found ${submissions.length} record(s)`);
        submissions.forEach(r => console.log(`   - ID: ${r.id}, Name: ${r.name}, Subject: ${r.subject}`));
        
        const [result] = await conn.execute('DELETE FROM contact_submissions WHERE LOWER(email) = LOWER(?)', [EMAIL_TO_REMOVE]);
        console.log(`   ✅ Deleted ${result.affectedRows} record(s) from contact_submissions`);
        totalDeleted += result.affectedRows;
      }
    } catch (e) { /* table may not exist */ }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ COMPLETE: Removed ${totalDeleted} total record(s) for ${EMAIL_TO_REMOVE}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await conn.end();
  }
}

removeEmail();
